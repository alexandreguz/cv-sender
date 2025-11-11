// src/app/api/scrape/linkedin/route.ts
export const runtime = "nodejs";

import fs from "fs/promises";
import path from "path";
import { getKeywords, setKeywords } from "@/lib/server/db";

type Params = { portal?: string };



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
    "#job-details",
    ".show-more-less-html__markup",
    ".jobs-description__content",
    'jobs-box__html-content',
    '.jobs-description__container'
  ];

  for (const selector of sections) {
    const locator = page.locator(selector).first();
    try {
      await locator.waitFor({ timeout: 3000 });
      const raw = await locator.evaluate((el: HTMLElement) => el.innerText || "");
      if (raw && raw.length > 30) {
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
  const safeText = async (sel: string) => {
    const locator = page.locator(sel).first();
    try {
      await locator.waitFor({ timeout: 1500 });
      return (
        (await locator.evaluate((el: HTMLElement) => el.textContent?.trim() || "")) ||
        ""
      );
    } catch {
      return "";
    }
  };

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

export async function POST(req: Request, _context: { params?: Params | Promise<Params> }) {
  // Permite sobrescrever keywords/location via payload e persiste para futuros scrapes.
  const body = await req.json().catch(() => ({}));
  const bodyKeywords = Array.isArray(body?.keywords)
    ? body.keywords
    : typeof body?.keywords === "string"
      ? body.keywords.split(/[,;\n]/).map((s: string) => s.trim()).filter(Boolean)
      : [];
  const bodyLocation =
    typeof body?.location === "string" && body.location.trim() ? body.location.trim() : "";

  const kw = getKeywords();

  const titles: string[] =
    bodyKeywords.length > 0
      ? bodyKeywords
      : Array.isArray(kw.titles)
        ? kw.titles.filter(Boolean)
        : [];
  const location =
    bodyLocation ||
    (typeof kw.location === "string" && kw.location.trim() ? kw.location.trim() : "");

  if (bodyKeywords.length > 0 || bodyLocation) {
    // Atualiza armazenamento com os novos parâmetros para manter consistência com /api/keywords.
    const currentSkills = Array.isArray(kw.skills) ? kw.skills.filter(Boolean) : [];
    const uniqueTitles = Array.from(new Set(titles));
    setKeywords({ titles: uniqueTitles, skills: currentSkills, location });
  }

  if (!titles || titles.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: "Nenhuma keyword configurada. Use /api/keywords para adicionar titles." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

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

    // Executa uma busca para cada título configurado até atingir maxJobs
    let jobLinks: string[] = [];
    const searchUrlsUsed: string[] = [];

    for (const title of titles) {
      if (jobLinks.length >= maxJobs) break;
      const s = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(title)}${
        location ? `&location=${encodeURIComponent(location)}` : ""
      }`;
      searchUrlsUsed.push(s);
      try {
        await page.goto(s, { waitUntil: "networkidle", timeout: 30000 });

        // scroll para carregar conteúdo
        await page.evaluate(async () => {
          for (let i = 0; i < 6; i++) {
            window.scrollBy(0, window.innerHeight);
            await new Promise((r) => setTimeout(r, 600));
          }
        });

        const links = await page
          .locator("a[href*='/jobs/view/']")
          .evaluateAll((els) =>
            Array.from(
              new Set(
                els
                  .map((a) => (a as HTMLAnchorElement).href)
                  .filter(Boolean)
                  .map((href) => href.split("?")[0])
              )
            )
          );
        for (const l of links) {
          if (jobLinks.length >= maxJobs) break;
          if (!jobLinks.includes(l)) jobLinks.push(l);
        }
      } catch (e) {
        // ignora erros de uma busca específica e continua com próximas keywords
        continue;
      }
    }

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

    // salvar também os parâmetros de busca junto com os resultados
    const payloadToSave = {
      search: { titles, location, searchUrls: searchUrlsUsed },
      results,
    };

    const saved = await saveJson("linkedin-about-jobs", payloadToSave);

    // Retorna metadados do arquivo salvo e os resultados diretamente no corpo
    return new Response(
      JSON.stringify({ ok: true, portal: "linkedin", ...saved, results }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
