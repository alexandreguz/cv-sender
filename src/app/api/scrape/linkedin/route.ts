// // src/app/api/scrape/linkedin/route.ts
// export const runtime = "nodejs";

// import fs from "fs/promises";
// import path from "path";
// import type { NextRequest } from "next/server";

// type Params = { portal?: string };

// const DEFAULT_SEARCH_URL =
//   "https://www.linkedin.com/jobs/search/?keywords=QA%20Automation&location=Israel&f_TP=1"; // ajuste a query se quiser

// async function ensureDataDir() {
//   const dir = path.resolve(process.cwd(), "data");
//   await fs.mkdir(dir, { recursive: true });
//   return dir;
// }

// // helper para salvar JSON
// async function saveJson(filenameBase: string, data: any) {
//   const dir = await ensureDataDir();
//   const name = `${filenameBase}-${Date.now()}.json`;
//   const file = path.join(dir, name);
//   await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
//   return { file, name, count: Array.isArray(data) ? data.length : 1 };
// }

// /**
//  * Extrai requisitos de uma página de vaga do LinkedIn.
//  * Usa vários seletores possíveis para cobrir variações.
//  */
// async function extractRequirementsFromJobPage(page: any, jobUrl: string) {
//   // seletores plausíveis para "qualifications / requirements / responsibilities"
//   const requirementSelectors = [
//     ".description__job-criteria-list", // sometimes used
//     ".job-criteria__list", // LinkedIn new
//     ".show-more-less-html__markup", // fallback: job description block
//     ".job-description__content", // older
//     ".description__text", // fallback
//     "section[aria-label='Job description']",
//   ];

//   // tenta esperar por algum seletor conhecido depois de abrir a vaga
//   for (const sel of requirementSelectors) {
//     try {
//       await page.waitForSelector(sel, { timeout: 3000 });
//       const raw = await page.$eval(sel, (el: Element) => (el as HTMLElement).innerText || el.textContent || "");
//       if (raw && raw.trim().length > 10) {
//         // heurística simples: quebrar por linhas e filtrar curtas
//         const lines = raw
//           .split(/\r?\n/)
//           .map((l) => l.trim())
//           .filter((l) => l.length > 3);
//         return { raw, lines };
//       }
//     } catch (e) {
//       // não achou esse seletor — continua tentando outros
//     }
//   }

//   // se nada encontrado, tentar coletar o conteúdo completo do body da descrição
//   try {
//     const fallback = await page.$eval("body", (b: Element) => ((b as HTMLElement).innerText || "").slice(0, 5000));
//     return { raw: fallback, lines: fallback.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) };
//   } catch (e) {
//     return { raw: "", lines: [] };
//   }
// }

// /**
//  * Faz o scraping específico para LinkedIn: abre searchUrl, clica em cada job-card,
//  * abre cada vaga em nova aba para extrair requirements e monta uma lista.
//  */
// export async function POST(_req: Request, _context: { params?: Params | Promise<Params> }) {
//   const searchUrl = DEFAULT_SEARCH_URL;

//   // opcional: passar cookie de sessão via env var para evitar bloqueios e ver mais conteúdo
//   const providedSessionCookie = process.env.LINKEDIN_SESSION_COOKIE; // form: "li_at=XXXX;"
//   const maxJobs = +(process.env.LINKEDIN_MAX_JOBS || "30"); // limite total
//   const concurrency = +(process.env.LINKEDIN_CONCURRENCY || "3"); // número de abas concorrentes

//   // dynamic import do playwright (para não falhar no build se não instalado)
//   try {
//     const { chromium } = await import("playwright");

//     const browser = await chromium.launch({
//       headless: true,
//       args: ["--no-sandbox", "--disable-setuid-sandbox"],
//     });

//     const context = await browser.newContext({
//       // tenta reduzir detecção
//       userAgent:
//         "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
//       viewport: { width: 1280, height: 800 },
//     });

//     // se cookie de sessão fornecido, adiciona ao contexto
//     if (providedSessionCookie) {
//       // espera cookie no formato "li_at=VAL;"
//       const match = /li_at=([^;]+)/.exec(providedSessionCookie);
//       if (match) {
//         await context.addCookies([
//           {
//             name: "li_at",
//             value: match[1],
//             domain: ".www.linkedin.com",
//             path: "/",
//             httpOnly: true,
//             secure: true,
//             sameSite: "Lax",
//           },
//         ]);
//       }
//     }

//     const page = await context.newPage();

//     // navega até a busca
//     await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 30000 });

//     // scroll para carregar lazy content
//     await page.evaluate(async () => {
//       for (let i = 0; i < 6; i++) {
//         window.scrollBy(0, window.innerHeight);
//         // small pause
//         await new Promise((r) => setTimeout(r, 500));
//       }
//     });

//     // selecionadores de cards de vagas no LinkedIn (tentar vários)
//     const cardSelectors = [
//       ".jobs-search-results__list-item", // list item container
//       ".job-card-container", // job card container
//       ".result-card__contents", // older
//       ".jobs-search-results__result-item",
//     ];

//     // pegar links dos cards (elimina duplicatas)
//     let jobLinks: string[] = [];
//     for (const cs of cardSelectors) {
//       try {
//         const links = await page.$$eval(`${cs} a`, (els: Element[]) =>
//           els
//             .map((a) => {
//               const href = (a as HTMLAnchorElement).href;
//               return href && href.includes("/jobs/view/") ? href.split("?")[0] : null;
//             })
//             .filter(Boolean)
//         );
//         jobLinks = jobLinks.concat(links as string[]);
//       } catch (e) {
//         // ignora
//       }
//       if (jobLinks.length >= maxJobs) break;
//     }

//     // dedupe e trim
//     jobLinks = Array.from(new Set(jobLinks)).slice(0, maxJobs);

//     // fallback: se não achou links via cards, tentar anchors gerais
//     if (jobLinks.length === 0) {
//       const anchors = await page.$$eval("a[href*='/jobs/view/']", (els: Element[]) =>
//         els.map((a) => (a as HTMLAnchorElement).href.split("?")[0])
//       );
//       jobLinks = Array.from(new Set(anchors)).slice(0, maxJobs);
//     }

//     // se ainda vazio, erro
//     if (!jobLinks.length) {
//       await browser.close();
//       return new Response(JSON.stringify({ ok: false, error: "No job links found (LinkedIn may be blocking requests)." }), {
//         status: 500,
//         headers: { "Content-Type": "application/json" },
//       });
//     }

//     // processar links em batches com concorrência
//     const results: any[] = [];
//     let idx = 0;

//     async function worker() {
//       while (true) {
//         const i = idx++;
//         if (i >= jobLinks.length) return;
//         const jobUrl = jobLinks[i];
//         let jobData: any = { url: jobUrl, index: i };

//         // abrir nova aba por vaga (isolado)
//         const jobPage = await context.newPage();
//         try {
//           await jobPage.goto(jobUrl, { waitUntil: "networkidle", timeout: 20000 });
//           // coletar título / empresa / local
//           const title = await jobPage.$eval("h1", (el: Element) => (el.textContent || "").trim()).catch(() => "");
//           const company = await jobPage.$eval(".topcard__org-name-link, .topcard__flavor a, .topcard__org-name", (el: Element) =>
//             (el.textContent || "").trim()
//           ).catch(() => "");
//           const location = await jobPage.$eval(".topcard__flavor--bullet, .topcard__flavor--metadata, .topcard__flavor", (el: Element) =>
//             (el.textContent || "").trim()
//           ).catch(() => "");

//           const { raw, lines } = await extractRequirementsFromJobPage(jobPage, jobUrl);

//           jobData = {
//             url: jobUrl,
//             title: title || null,
//             company: company || null,
//             location: location || null,
//             requirements_raw: raw,
//             requirements_lines: lines,
//           };

//           // pequena espera entre requisições para reduzir chance de bloqueio
//           await new Promise((r) => setTimeout(r, 400 + Math.random() * 400));
//         } catch (err: any) {
//           jobData.error = String(err?.message || err);
//         } finally {
//           try {
//             await jobPage.close();
//           } catch {}
//         }
//         results.push(jobData);
//       }
//     }

//     // lançar workers
//     const workers = [];
//     for (let k = 0; k < Math.min(concurrency, jobLinks.length); k++) workers.push(worker());
//     await Promise.all(workers);

//     await browser.close();

//     // salvar resultado em arquivo JSON
//     const saved = await saveJson("linkedin-jobs", results);

//     return new Response(JSON.stringify({ ok: true, portal: "linkedin", ...saved }), {
//       status: 200,
//       headers: { "Content-Type": "application/json" },
//     });
//   } catch (err: any) {
//     return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
//       status: 500,
//       headers: { "Content-Type": "application/json" },
//     });
//   }
// }


// src/app/api/scrape/linkedin/route.ts
export const runtime = "nodejs";

import fs from "fs/promises";
import path from "path";

type Params = { portal?: string };

const DEFAULT_SEARCH_URL =
  "https://www.linkedin.com/jobs/search/?keywords=QA%20Automation&location=Israel";

/** Cria diretório data e salva JSON */
async function saveJson(filenameBase: string, data: any) {
  const dir = path.resolve(process.cwd(), "data");
  await fs.mkdir(dir, { recursive: true });
  const name = `${filenameBase}-${Date.now()}.json`;
  const file = path.join(dir, name);
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
  return { file, name, count: Array.isArray(data) ? data.length : 1 };
}

/** Extrai a seção "About the job" e campos relacionados */
async function extractAboutTheJob(page: any) {
  const sections = [
    "section[aria-label='About the job']",
    "section[data-test-job-description-section]",
    ".show-more-less-html__markup",
    ".description__text",
    ".job-description__content",
  ];

  for (const selector of sections) {
    try {
      await page.waitForSelector(selector, { timeout: 3000 });
      const raw = await page.$eval(selector, (el: Element) => (el as HTMLElement).innerText || "");
      if (raw && raw.length > 30) {
        // limpeza básica
        const clean = raw.replace(/\n{3,}/g, "\n\n").trim();
        return clean;
      }
    } catch {
      continue;
    }
  }
  return "";
}

/** Extrai informações gerais da vaga */
async function extractJobInfo(page: any) {
  const safeText = async (sel: string) =>
    (await page.$eval(sel, (el: Element) => el.textContent?.trim() || "").catch(() => "")) || "";

  const title = await safeText("h1.top-card-layout__title, h1");
  const company = await safeText(".topcard__org-name-link, .top-card-layout__entity-info a, .topcard__org-name");
  const location = await safeText(
    ".topcard__flavor--bullet, .topcard__flavor--metadata, .sub-nav-cta__meta-text"
  );
  const datePosted = await safeText(".posted-time-ago__text, .topcard__flavor--metadata time");
  const jobType = await safeText("li.job-criteria__item:nth-child(1) span.job-criteria__text--criteria");
  const seniority = await safeText("li.job-criteria__item:nth-child(2) span.job-criteria__text--criteria");
  const industries = await safeText("li.job-criteria__item:nth-child(3) span.job-criteria__text--criteria");

  return { title, company, location, datePosted, jobType, seniority, industries };
}

export async function POST(_req: Request, _context: { params?: Params | Promise<Params> }) {
  const searchUrl = DEFAULT_SEARCH_URL;

  const sessionCookie = process.env.LINKEDIN_SESSION_COOKIE; // opcional
  const maxJobs = +(process.env.LINKEDIN_MAX_JOBS || "30");
  const concurrency = +(process.env.LINKEDIN_CONCURRENCY || "3");

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });

    // se fornecido cookie de sessão (li_at)
    if (sessionCookie) {
      const match = /li_at=([^;]+)/.exec(sessionCookie);
      if (match) {
        await context.addCookies([
          {
            name: "li_at",
            value: match[1],
            domain: ".www.linkedin.com",
            path: "/",
            httpOnly: true,
            secure: true,
            sameSite: "Lax",
          },
        ]);
      }
    }

    const page = await context.newPage();
    await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 30000 });

    // scroll down para carregar mais vagas
    await page.evaluate(async () => {
      for (let i = 0; i < 8; i++) {
        window.scrollBy(0, window.innerHeight);
        await new Promise((r) => setTimeout(r, 800));
      }
    });

    // coleta links das vagas
    let jobLinks = await page.$$eval("a[href*='/jobs/view/']", (els: Element[]) =>
      Array.from(new Set(els.map((a) => (a as HTMLAnchorElement).href.split("?")[0]))).slice(0, 60)
    );
    jobLinks = jobLinks.slice(0, maxJobs);

    if (!jobLinks.length) {
      await browser.close();
      return new Response(
        JSON.stringify({ ok: false, error: "No job links found - LinkedIn may be blocking scraping" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];
    let index = 0;

    function parseAboutSections(raw: string) {
      if (!raw || !raw.trim()) return { company: "", summary: "", responsibilities: "", requirements: "" };
      const text = raw.replace(/\r/g, "");

      // split into paragraphs
      const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

      // common heading keywords mapped to section keys
      const headingMap: { [k: string]: string } = {
        'who we are': 'company',
        'about the job': 'summary',
        'about the company': 'company',
        'who we are:': 'company',
        'who we are\b': 'company',
        "what you'll do": 'responsibilities',
        "what you will do": 'responsibilities',
        'responsibilities': 'responsibilities',
        'what you will be doing': 'responsibilities',
        "what you'll need": 'requirements',
        'requirements': 'requirements',
        'qualifications': 'requirements',
        'what we are looking for': 'requirements',
        "what we're looking for": 'requirements',
        'you will': 'responsibilities',
        'you will be': 'responsibilities',
      };

      const headings = Object.keys(headingMap).map((h) => h.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'));
      const headingRe = new RegExp('(^|\\n)\\s*(?:' + headings.join('|') + ')[\\s:]*', 'i');

      // try to find explicit headings in the text
      const sections: any = { company: '', summary: '', responsibilities: '', requirements: '' };

      // If there are explicit heading markers, split by them
      const markerRe = new RegExp('(?:\\n\s*)(' + headings.join('|') + ')[\\s:]*', 'ig');
      const parts: { title: string; body: string }[] = [];
      let lastIndex = 0;
      let lastTitle = '';
      let m: RegExpExecArray | null;
      const normalized = text;
      const matches: Array<{ index: number; title: string; match: string }> = [];
      while ((m = markerRe.exec(normalized))) {
        matches.push({ index: m.index, title: m[1].toLowerCase(), match: m[0] });
      }

      if (matches.length) {
        for (let i = 0; i < matches.length; i++) {
          const start = matches[i].index + matches[i].match.length;
          const end = i + 1 < matches.length ? matches[i + 1].index : normalized.length;
          const title = matches[i].title;
          const body = normalized.slice(start, end).trim();
          parts.push({ title, body });
        }
        // anything before first match could be company description
        const before = normalized.slice(0, matches[0].index).trim();
        if (before) sections.company = before.split(/\n\s*\n/)[0];
      } else {
        // fallback: use paragraph heuristics
        if (paras.length > 0) sections.company = paras[0];
        if (paras.length > 1) sections.summary = paras[1];
        if (paras.length > 2) sections.responsibilities = paras.slice(2, 4).join('\n\n');
        if (paras.length > 4) sections.requirements = paras.slice(4).join('\n\n');
      }

      // map parts found by headings into sections
      for (const p of parts) {
        const key = headingMap[p.title] || headingMap[Object.keys(headingMap).find(k => p.title.includes(k)) || ''] || null;
        if (key) {
          // append if already present
          sections[key] = (sections[key] ? sections[key] + '\n\n' : '') + p.body;
        } else {
          // if unknown, try to heuristically distribute
          if (!sections.summary) sections.summary = p.body;
          else sections.requirements = (sections.requirements ? sections.requirements + '\n\n' : '') + p.body;
        }
      }

      // normalize whitespace
      for (const k of Object.keys(sections)) {
        if (sections[k]) sections[k] = sections[k].replace(/\n{3,}/g, '\n\n').trim();
      }

      return sections;
    }

    async function worker() {
      while (index < jobLinks.length) {
        const i = index++;
        const jobUrl = jobLinks[i];
        const jobPage = await context.newPage();
        try {
          await jobPage.goto(jobUrl, { waitUntil: "networkidle", timeout: 25000 });

          const info = await extractJobInfo(jobPage);
          const about_raw = await extractAboutTheJob(jobPage);
          const parsed = parseAboutSections(about_raw || "");

          results.push({
            index: i + 1,
            url: jobUrl,
            ...info,
            about_raw,
            about_company: parsed.company,
            about_summary: parsed.summary,
            about_responsibilities: parsed.responsibilities,
            about_requirements: parsed.requirements,
          });

          // pequena pausa entre as requisições
          await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
        } catch (err: any) {
          results.push({ url: jobUrl, error: err?.message || String(err) });
        } finally {
          await jobPage.close();
        }
      }
    }

    const workers = [];
    for (let k = 0; k < Math.min(concurrency, jobLinks.length); k++) workers.push(worker());
    await Promise.all(workers);

    await browser.close();

    const saved = await saveJson("linkedin-about-jobs", results);

    return new Response(JSON.stringify({ ok: true, portal: "linkedin", ...saved }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
