export const runtime = "nodejs";

// POST /api/scrape/alljobs
// Scrapes AllJobs job listings using Playwright with stealth mode to avoid bot detection.
// AllJobs renders all job data (title, company, description) inline in the search results
// page — no need to visit individual job pages.
// Accepts { keyword, cityId?, cityLabel?, maxPages? } in the request body.
// Results are saved to data/alljobs/alljobs-{timestamp}.json and returned inline.
// On failure, saves a debug HTML snapshot to data/alljobs/debug-*.html for selector tuning.

import fs from "fs/promises";
import path from "path";

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

/** Writes data as pretty-printed JSON to a timestamped file in data/alljobs/. */
async function saveJson(filenameBase: string, data: unknown) {
  const dir = path.resolve(process.cwd(), "data", "alljobs");
  await fs.mkdir(dir, { recursive: true });
  const name = `${filenameBase}-${Date.now()}.json`;
  const file = path.join(dir, name);
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
  return { file, name, count: Array.isArray(data) ? data.length : 1 };
}

/** Saves raw HTML to data/alljobs/debug-*.html for selector debugging. */
async function saveDebugHtml(html: string, label = "page") {
  const dir = path.resolve(process.cwd(), "data", "alljobs");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `debug-${label}-${Date.now()}.html`);
  await fs.writeFile(file, html, "utf8");
  console.warn(`[alljobs] debug HTML saved → ${file}`);
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
 * Splits raw job description text into named sections.
 * Recognises common English and Hebrew heading keywords.
 * Falls back to paragraph-order heuristics when no headings are found.
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
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const headingMap: Record<string, keyof Sections> = {
    // English
    "who we are": "company",
    "about the company": "company",
    "about the job": "summary",
    "about the role": "summary",
    "what you'll do": "responsibilities",
    "what you will do": "responsibilities",
    responsibilities: "responsibilities",
    "what you'll need": "requirements",
    "what we are looking for": "requirements",
    requirements: "requirements",
    qualifications: "requirements",
    // Hebrew
    "על התפקיד": "summary",
    "תיאור התפקיד": "responsibilities",
    "דרישות": "requirements",
    "דרישות התפקיד": "requirements",
    "דרישות חובה": "requirements",
    "תחומי אחריות": "responsibilities",
  };

  const headingPatterns = Object.keys(headingMap).map((h) =>
    h.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
  );
  const markerRe = new RegExp(
    `(?:^|\\n\\s*)(${headingPatterns.join("|")})[\\s:：\\.]*`,
    "ig"
  );

  const markerMatches: Array<{ index: number; title: string; match: string }> =
    [];
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(text))) {
    markerMatches.push({
      index: m.index,
      title: m[1].toLowerCase().trim(),
      match: m[0],
    });
  }

  if (markerMatches.length) {
    for (let i = 0; i < markerMatches.length; i++) {
      const start = markerMatches[i].index + markerMatches[i].match.length;
      const end =
        i + 1 < markerMatches.length
          ? markerMatches[i + 1].index
          : text.length;
      const body = text.slice(start, end).trim();
      const key = headingMap[markerMatches[i].title] ?? null;
      if (key) {
        sections[key] = sections[key]
          ? `${sections[key]}\n\n${body}`
          : body;
      } else if (!sections.summary) {
        sections.summary = body;
      } else {
        sections.requirements = sections.requirements
          ? `${sections.requirements}\n\n${body}`
          : body;
      }
    }
    const before = text.slice(0, markerMatches[0].index).trim();
    if (before && !sections.company)
      sections.company = before.split(/\n\s*\n/)[0];
  } else {
    if (paras[0]) sections.company = paras[0];
    if (paras[1]) sections.summary = paras[1];
    if (paras.length > 2)
      sections.responsibilities = paras.slice(2, 4).join("\n\n");
    if (paras.length > 4)
      sections.requirements = paras.slice(4).join("\n\n");
  }

  for (const k of Object.keys(sections) as (keyof Sections)[]) {
    if (sections[k])
      sections[k] = sections[k].replace(/\n{3,}/g, "\n\n").trim();
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
 * Scrapes AllJobs search results using a stealth Chromium browser.
 * All job data is extracted directly from the results page (no per-job page visits).
 * On failure, saves debug HTML to data/alljobs/ for selector investigation.
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

  const cityId =
    typeof body?.cityId === "string" ? body.cityId.trim() : "";
  const cityLabel =
    typeof body?.cityLabel === "string" ? body.cityLabel.trim() : "All Israel";
  const maxPages =
    typeof body?.maxPages === "number" ? body.maxPages : 2;
  const maxJobs = +(process.env.ALLJOBS_MAX_JOBS ?? "30");

  try {
    // Use playwright-extra with stealth plugin to avoid bot detection
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
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    });

    const page = await browserContext.newPage();

    // Mask common headless-detection signals
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      // Simulate a real user's plugin list length
      Object.defineProperty(navigator, "plugins", {
        get: () => ({ length: 3 }),
      });
    });

    const results: JobResult[] = [];
    let globalIndex = 1;

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      if (results.length >= maxJobs) break;

      const searchUrl =
        `https://www.alljobs.co.il/SearchResultsGuest.aspx` +
        `?page=${pageNum}` +
        `&freetxt=${encodeURIComponent(keyword)}` +
        (cityId ? `&city=${cityId}` : "") +
        `&type=&region=`;

      console.info(`[alljobs] fetching page ${pageNum}: ${searchUrl}`);

      try {
        // Use domcontentloaded first, then wait for Angular to render
        await page.goto(searchUrl, {
          waitUntil: "domcontentloaded",
          timeout: 40000,
        });

        // Give AngularJS time to boot and render job cards
        await page.waitForTimeout(4000);

        // Try to wait for actual job containers
        let jobsRendered = false;
        try {
          await page.waitForSelector('[id^="job-box-container"]', {
            timeout: 12000,
          });
          jobsRendered = true;
        } catch {
          // Containers did not appear — save debug HTML and stop
          const html = await page.content();
          await saveDebugHtml(html, `p${pageNum}`);
          console.warn(
            `[alljobs] job containers not found on page ${pageNum} — debug HTML saved`
          );
          break;
        }

        if (!jobsRendered) break;

        // Extract all job data directly from the search results page
        const pageJobs = await page.evaluate(
          (args: { base: string; max: number; startIdx: number }) => {
            const { base, max, startIdx } = args;
            const containers = Array.from(
              document.querySelectorAll('[id^="job-box-container"]')
            );

            return containers.slice(0, max).map((container, i) => {
              // Title
              const titleEl = container.querySelector(
                ".job-content-top-title h2"
              );
              const title = (titleEl as HTMLElement)?.innerText?.trim() ?? "";

              // URL (link to individual job page for reference)
              const linkEl = container.querySelector<HTMLAnchorElement>(
                '.job-content-top-title a[href*="UploadSingle"]'
              );
              const href = linkEl?.getAttribute("href") ?? "";
              const url = href
                ? href.startsWith("http")
                  ? href
                  : base + href
                : "";

              // Company
              const companyEl = container.querySelector(
                ".job-content-top-title .T14 a"
              );
              const company =
                (companyEl as HTMLElement)?.innerText?.trim() ?? "";

              // Date posted
              const dateEl = container.querySelector(".job-content-top-date");
              const datePosted =
                (dateEl as HTMLElement)?.innerText?.trim() ?? "";

              // Location — use TreeWalker to skip the nested city dropdown
              const locationBlock = container.querySelector(
                ".job-content-top-location"
              );
              let location = "";
              if (locationBlock) {
                const walker = document.createTreeWalker(
                  locationBlock,
                  NodeFilter.SHOW_TEXT,
                  {
                    acceptNode(node) {
                      const p = node.parentElement;
                      if (!p) return NodeFilter.FILTER_REJECT;
                      if (
                        p.classList.contains("job-regions-box") ||
                        p.closest(".job-regions-box")
                      )
                        return NodeFilter.FILTER_REJECT;
                      return NodeFilter.FILTER_ACCEPT;
                    },
                  }
                );
                const parts: string[] = [];
                let node: Node | null;
                while ((node = walker.nextNode())) {
                  const t = node.textContent?.trim();
                  if (t && t !== ":") parts.push(t);
                }
                location = parts.join(" ").replace(/\s+/g, " ").trim();
              }

              // Description — already rendered inline in the results page
              const descEls = container.querySelectorAll(
                ".job-content-top-desc"
              );
              const about_raw = Array.from(descEls)
                .map((el) => (el as HTMLElement).innerText?.trim() ?? "")
                .filter(Boolean)
                .join("\n\n");

              return {
                index: startIdx + i,
                url,
                title,
                company,
                location,
                datePosted,
                about_raw,
              };
            });
          },
          {
            base: "https://www.alljobs.co.il",
            max: maxJobs - results.length,
            startIdx: globalIndex,
          }
        );

        for (const job of pageJobs) {
          if (!job.title) continue; // skip ad/empty containers
          const parsed = parseAboutSections(job.about_raw);
          results.push({
            ...job,
            about_company: parsed.company,
            about_summary: parsed.summary,
            about_responsibilities: parsed.responsibilities,
            about_requirements: parsed.requirements,
          });
          globalIndex++;
          if (results.length >= maxJobs) break;
        }

        if (pageJobs.length === 0) break;
      } catch (err) {
        console.error(`[alljobs] page ${pageNum} error:`, err);
        // Save debug HTML to help diagnose unexpected errors
        try {
          const html = await page.content();
          await saveDebugHtml(html, `error-p${pageNum}`);
        } catch {
          // ignore secondary failure
        }
        continue;
      }
    }

    await browser.close();

    if (results.length === 0) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            "No job listings found. A debug HTML snapshot has been saved to " +
            "data/alljobs/ — check the file to see what AllJobs returned to the scraper.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const payloadToSave = {
      search: { titles: [keyword], city: cityLabel, cityId },
      results,
    };
    const saved = await saveJson("alljobs", payloadToSave);

    return new Response(
      JSON.stringify({
        ok: true,
        portal: "alljobs",
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
