export const runtime = "nodejs";

// POST /api/scrape/drushim
// 2-phase Playwright scraper for Drushim (drushim.co.il):
//   Phase 1 — collect job URLs from search results pages (.job-item containers)
//   Phase 2 — visit each job page in parallel workers to extract full description
// Results saved to data/drushim/drushim-{timestamp}.json
// On failure saves debug HTML to data/drushim/debug-*.html for selector tuning.

import fs from "fs/promises";
import path from "path";
import { buildDrushimUrl, type DrushimCity } from "@/lib/server/drushim-cities";

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

/** Writes data as pretty-printed JSON to a timestamped file in data/drushim/. */
async function saveJson(data: unknown) {
  const dir = path.resolve(process.cwd(), "data", "drushim");
  await fs.mkdir(dir, { recursive: true });
  const name = `drushim-${Date.now()}.json`;
  const file = path.join(dir, name);
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
  return { file, name, count: Array.isArray(data) ? data.length : 1 };
}

/** Saves raw HTML to data/drushim/debug-*.html for selector debugging. */
async function saveDebugHtml(html: string, label = "page") {
  const dir = path.resolve(process.cwd(), "data", "drushim");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `debug-${label}-${Date.now()}.html`);
  await fs.writeFile(file, html, "utf8");
  console.warn(`[drushim] debug HTML saved → ${file}`);
}

// ---------------------------------------------------------------------------
// Section parser
// ---------------------------------------------------------------------------

type Sections = {
  company: string;
  summary: string;
  responsibilities: string;
  requirements: string;
};

/**
 * Splits raw Hebrew/English job description into named sections.
 * Drushim job pages typically contain "תיאור משרה" (job description) and
 * "דרישות התפקיד" (requirements) as labelled sections.
 */
function parseAboutSections(raw: string): Sections {
  const sections: Sections = {
    company: "",
    summary: "",
    responsibilities: "",
    requirements: "",
  };
  if (!raw?.trim()) return sections;

  const text = raw.replace(/\r/g, "");
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  const headingMap: Record<string, keyof Sections> = {
    // Hebrew (common on Drushim)
    "תיאור משרה": "summary",
    "תיאור התפקיד": "summary",
    "על התפקיד": "summary",
    "אחריות": "responsibilities",
    "תחומי אחריות": "responsibilities",
    "דרישות": "requirements",
    "דרישות התפקיד": "requirements",
    "דרישות חובה": "requirements",
    "דרישות ניסיון": "requirements",
    // English
    "about the job": "summary",
    "about the role": "summary",
    responsibilities: "responsibilities",
    requirements: "requirements",
    qualifications: "requirements",
  };

  const headingPatterns = Object.keys(headingMap).map((h) =>
    h.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
  );
  const markerRe = new RegExp(
    `(?:^|\\n\\s*)(${headingPatterns.join("|")})[\\s:：\\.]*`,
    "ig"
  );

  const markers: Array<{ index: number; title: string; match: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(text))) {
    markers.push({ index: m.index, title: m[1].toLowerCase().trim(), match: m[0] });
  }

  if (markers.length) {
    for (let i = 0; i < markers.length; i++) {
      const start = markers[i].index + markers[i].match.length;
      const end = i + 1 < markers.length ? markers[i + 1].index : text.length;
      const body = text.slice(start, end).trim();
      const key = headingMap[markers[i].title] ?? null;
      if (key) {
        sections[key] = sections[key] ? `${sections[key]}\n\n${body}` : body;
      } else if (!sections.summary) {
        sections.summary = body;
      }
    }
    const before = text.slice(0, markers[0].index).trim();
    if (before && !sections.company) sections.company = before.split(/\n\s*\n/)[0];
  } else {
    if (paras[0]) sections.summary = paras[0];
    if (paras.length > 1) sections.requirements = paras.slice(1).join("\n\n");
  }

  for (const k of Object.keys(sections) as (keyof Sections)[]) {
    if (sections[k]) sections[k] = sections[k].replace(/\n{3,}/g, "\n\n").trim();
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

type JobResult = {
  index: number;
  url: string;
  title: string;
  company: string;
  location: string;
  datePosted: string;
  about_raw: string;
  about_company: string;
  about_summary: string;
  about_responsibilities: string;
  about_requirements: string;
  error?: string;
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * POST /api/scrape/drushim
 * Body: { keyword: string, cityLabel?: string, areaPath?: string, geolexid?: string, range?: number, maxPages?: number }
 *
 * Phase 1: collects job page URLs from search result pages.
 * Phase 2: visits each job page in parallel and extracts structured data.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const keyword =
    typeof body?.keyword === "string"
      ? body.keyword.trim()
      : Array.isArray(body?.keywords)
      ? ((body.keywords as string[])[0]?.trim() ?? "")
      : "";

  if (!keyword) {
    return new Response(
      JSON.stringify({ ok: false, error: "keyword is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Reconstruct city config from request body
  const cityLabel = typeof body?.cityLabel === "string" ? body.cityLabel : "All Israel";
  const city: DrushimCity = {
    label: cityLabel,
    areaPath: typeof body?.areaPath === "string" ? body.areaPath : "",
    geolexid: typeof body?.geolexid === "string" ? body.geolexid : "",
    range: typeof body?.range === "number" ? body.range : 15,
  };

  const maxPages = typeof body?.maxPages === "number" ? body.maxPages : 2;
  const maxJobs = +(process.env.DRUSHIM_MAX_JOBS ?? "30");
  const concurrency = +(process.env.DRUSHIM_CONCURRENCY ?? "3");

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { chromium } = require("playwright-extra") as {
      chromium: import("playwright").BrowserType;
    };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const stealth = require("puppeteer-extra-plugin-stealth")();
    // @ts-expect-error — playwright-extra uses .use() at runtime
    chromium.use(stealth);

    const browser = await chromium.launch({ headless: true });
    const browserContext = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      viewport: { width: 1366, height: 768 },
      locale: "he-IL",
      timezoneId: "Asia/Jerusalem",
      extraHTTPHeaders: {
        "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    await browserContext.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
    });

    // -------------------------------------------------------------------------
    // Phase 1 — collect job URLs from search result pages
    // -------------------------------------------------------------------------
    const searchPage = await browserContext.newPage();
    const jobUrls: string[] = [];

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      if (jobUrls.length >= maxJobs) break;

      const searchUrl = buildDrushimUrl(keyword, city, pageNum);
      console.info(`[drushim] fetching page ${pageNum}: ${searchUrl}`);

      try {
        await searchPage.goto(searchUrl, { waitUntil: "networkidle", timeout: 40000 });
        await searchPage.waitForTimeout(3000);

        // Wait for job containers to render (Vue.js SPA)
        try {
          await searchPage.waitForSelector(".job-item", { timeout: 12000 });
        } catch {
          const html = await searchPage.content();
          await saveDebugHtml(html, `search-p${pageNum}`);
          console.warn(`[drushim] .job-item not found on page ${pageNum} — debug HTML saved`);
          break;
        }

        // Extract job detail URLs from this results page
        const links = await searchPage.evaluate(() => {
          return Array.from(
            document.querySelectorAll<HTMLAnchorElement>('a[href*="/job/"]')
          )
            .map((a) => {
              const href = a.getAttribute("href") ?? "";
              // Normalise to absolute URL
              return href.startsWith("http")
                ? href
                : `https://www.drushim.co.il${href}`;
            })
            // Keep only canonical job page URLs (avoid duplicates from share/social buttons)
            .filter((href) => /\/job\/\d+\//.test(href));
        });

        const seen = new Set(jobUrls);
        for (const link of links) {
          if (jobUrls.length >= maxJobs) break;
          if (!seen.has(link)) {
            seen.add(link);
            jobUrls.push(link);
          }
        }

        if (links.length === 0) break; // no more results
      } catch (err) {
        console.error(`[drushim] search page ${pageNum} error:`, err);
        try {
          const html = await searchPage.content();
          await saveDebugHtml(html, `search-error-p${pageNum}`);
        } catch { /* ignore */ }
        continue;
      }
    }

    await searchPage.close();

    if (!jobUrls.length) {
      await browser.close();
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "No job links found. A debug HTML snapshot has been saved to data/drushim/ — " +
            "check what Drushim returned to the scraper.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------------------
    // Phase 2 — visit each job page in parallel workers
    // -------------------------------------------------------------------------
    const results: JobResult[] = [];
    let queueIndex = 0;

    /** Worker: pops URLs from the queue and extracts structured data. */
    async function worker() {
      while (queueIndex < jobUrls.length) {
        const i = queueIndex++;
        const jobUrl = jobUrls[i];
        const jobPage = await browserContext.newPage();
        try {
          await jobPage.goto(jobUrl, { waitUntil: "networkidle", timeout: 30000 });
          await jobPage.waitForTimeout(2000);

          const info = await jobPage.evaluate(() => {
            // Title
            const title =
              (document.querySelector(".job-url") as HTMLElement)?.innerText?.trim() ??
              (document.querySelector("h1") as HTMLElement)?.innerText?.trim() ??
              "";

            // Company name — inside the .bidi span in the job details top area
            const company =
              (document.querySelector(".job-details-top .bidi") as HTMLElement)?.innerText?.trim() ??
              (document.querySelector(".bidi") as HTMLElement)?.innerText?.trim() ??
              "";

            // Location — the first .pointer-underline span (city name or "מספר מקומות")
            const location =
              (document.querySelector(".pointer-underline") as HTMLElement)?.innerText?.trim() ?? "";

            // Date
            const date =
              (document.querySelector(".display-18.inline-flex") as HTMLElement)?.innerText?.trim() ?? "";

            // Full job description — .job-details-wrap is the main container on the detail page
            const descEl =
              document.querySelector(".job-details-wrap") ??
              document.querySelector(".job-details-box") ??
              document.querySelector(".vacancyFullDetails");
            const about_raw = (descEl as HTMLElement)?.innerText?.trim() ?? "";

            // Requirements section specifically — .job-requirements
            const reqEl = document.querySelector(".job-requirements");
            const requirements = (reqEl as HTMLElement)?.innerText?.trim() ?? "";

            return { title, company, location, date, about_raw, requirements };
          });

          const parsed = parseAboutSections(info.about_raw);
          // If .job-requirements gave us direct text, prefer it over parsed
          if (info.requirements && !parsed.requirements) {
            parsed.requirements = info.requirements;
          }

          results.push({
            index: i + 1,
            url: jobUrl,
            title: info.title,
            company: info.company,
            location: info.location,
            datePosted: info.date,
            about_raw: info.about_raw,
            about_company: parsed.company,
            about_summary: parsed.summary,
            about_responsibilities: parsed.responsibilities,
            about_requirements: parsed.requirements,
          });

          await new Promise((r) => setTimeout(r, 300 + Math.random() * 400));
        } catch (err) {
          results.push({
            index: i + 1,
            url: jobUrl,
            title: "", company: "", location: "", datePosted: "",
            about_raw: "", about_company: "", about_summary: "",
            about_responsibilities: "", about_requirements: "",
            error: err instanceof Error ? err.message : String(err),
          });
        } finally {
          await jobPage.close();
        }
      }
    }

    const workers: Promise<void>[] = [];
    for (let k = 0; k < Math.min(concurrency, jobUrls.length); k++) {
      workers.push(worker());
    }
    await Promise.all(workers);

    await browser.close();

    const payloadToSave = {
      search: { titles: [keyword], city: cityLabel, areaPath: city.areaPath, geolexid: city.geolexid },
      results,
    };
    const saved = await saveJson(payloadToSave);

    return new Response(
      JSON.stringify({
        ok: true,
        portal: "drushim",
        ...saved,
        results,
        meta: {
          titles: [keyword],
          location: cityLabel,
          searchedAt: new Date().toISOString(),
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
