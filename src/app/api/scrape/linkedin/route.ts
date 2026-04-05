export const runtime = "nodejs";

// POST /api/scrape/linkedin
// Scrapes LinkedIn job listings for the configured keywords/location using Playwright.
// Accepts optional { keywords, location } in the request body to override stored values.
// Results are saved to data/linkedin-about-jobs-{timestamp}.json and also returned inline.
import fs from "fs/promises";
import path from "path";
import type { Page } from "playwright";
import { getKeywords, setKeywords } from "@/lib/server/db";

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

/** Writes data as pretty-printed JSON to a timestamped file in data/ and returns file metadata. */
async function saveJson(filenameBase: string, data: unknown) {
  const dir = path.resolve(process.cwd(), "data");
  await fs.mkdir(dir, { recursive: true });
  const name = `${filenameBase}-${Date.now()}.json`;
  const file = path.join(dir, name);
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
  return { file, name, count: Array.isArray(data) ? data.length : 1 };
}

// ---------------------------------------------------------------------------
// Page extraction helpers
// ---------------------------------------------------------------------------

/**
 * Tries a list of selectors in order and returns the inner text of the first one that loads.
 * Returns an empty string if none of the selectors are found within the timeout.
 */
async function extractAboutTheJob(page: Page): Promise<string> {
  const selectors = [
    "#job-details",
    ".show-more-less-html__markup",
    ".jobs-description__content",
    "jobs-box__html-content",
    ".jobs-description__container",
  ];
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      await locator.waitFor({ timeout: 3000 });
      const raw = await locator.evaluate((el: HTMLElement) => el.innerText ?? "");
      if (raw && raw.length > 30) return raw.replace(/\n{3,}/g, "\n\n").trim();
    } catch {
      continue; // selector not found — try the next one
    }
  }
  return "";
}

/**
 * Extracts structured metadata (title, company, location, date, etc.) from a LinkedIn job page.
 * Uses a helper that silently returns "" for any selector that times out.
 */
async function extractJobInfo(page: Page) {
  /** Waits for a selector and returns its text content, or "" on timeout. */
  const safeText = async (sel: string) => {
    try {
      const locator = page.locator(sel).first();
      await locator.waitFor({ timeout: 1500 });
      return (await locator.evaluate((el: HTMLElement) => el.textContent?.trim() ?? "")) ?? "";
    } catch {
      return "";
    }
  };

  return {
    title:      await safeText("h1.top-card-layout__title, h1"),
    company:    await safeText(".topcard__org-name-link, .top-card-layout__entity-info a, .topcard__org-name"),
    location:   await safeText(".topcard__flavor--bullet, .topcard__flavor--metadata, .sub-nav-cta__meta-text"),
    datePosted: await safeText(".posted-time-ago__text, .topcard__flavor--metadata time"),
    jobType:    await safeText("li.job-criteria__item:nth-child(1) span.job-criteria__text--criteria"),
    seniority:  await safeText("li.job-criteria__item:nth-child(2) span.job-criteria__text--criteria"),
    industries: await safeText("li.job-criteria__item:nth-child(3) span.job-criteria__text--criteria"),
  };
}

// ---------------------------------------------------------------------------
// Section parser
// ---------------------------------------------------------------------------

type Sections = { company: string; summary: string; responsibilities: string; requirements: string };

/**
 * Splits the raw "About the job" text into four named sections using heading keywords.
 * Falls back to paragraph position heuristics when no explicit headings are found.
 */
function parseAboutSections(raw: string): Sections {
  const sections: Sections = { company: "", summary: "", responsibilities: "", requirements: "" };
  if (!raw?.trim()) return sections;

  const text = raw.replace(/\r/g, "");
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  // Maps common heading phrases to our four section keys
  const headingMap: Record<string, keyof Sections> = {
    "who we are": "company",
    "about the job": "summary",
    "about the company": "company",
    "what you'll do": "responsibilities",
    "what you will do": "responsibilities",
    responsibilities: "responsibilities",
    "what you will be doing": "responsibilities",
    "what you'll need": "requirements",
    requirements: "requirements",
    qualifications: "requirements",
    "what we are looking for": "requirements",
    "what we're looking for": "requirements",
  };

  // Build a regex that matches any of the known heading phrases
  const headingPatterns = Object.keys(headingMap).map((h) =>
    h.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
  );
  const markerRe = new RegExp(`(?:\\n\\s*)(${headingPatterns.join("|")})[\\s:]*`, "ig");

  // Collect all heading positions in the text
  const markerMatches: Array<{ index: number; title: string; match: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(text))) {
    markerMatches.push({ index: m.index, title: m[1].toLowerCase(), match: m[0] });
  }

  if (markerMatches.length) {
    // Assign each block of text between headings to its section
    for (let i = 0; i < markerMatches.length; i++) {
      const start = markerMatches[i].index + markerMatches[i].match.length;
      const end = i + 1 < markerMatches.length ? markerMatches[i + 1].index : text.length;
      const titleKey = markerMatches[i].title as keyof Sections;
      const body = text.slice(start, end).trim();
      const key = headingMap[titleKey] ?? null;
      if (key) {
        sections[key] = sections[key] ? `${sections[key]}\n\n${body}` : body;
      } else if (!sections.summary) {
        sections.summary = body; // unknown heading — treat as summary
      } else {
        sections.requirements = sections.requirements ? `${sections.requirements}\n\n${body}` : body;
      }
    }
    // Anything before the first heading is likely a company description
    const before = text.slice(0, markerMatches[0].index).trim();
    if (before && !sections.company) sections.company = before.split(/\n\s*\n/)[0];
  } else {
    // Fallback: use paragraph order as a positional heuristic
    if (paras[0]) sections.company = paras[0];
    if (paras[1]) sections.summary = paras[1];
    if (paras.length > 2) sections.responsibilities = paras.slice(2, 4).join("\n\n");
    if (paras.length > 4) sections.requirements = paras.slice(4).join("\n\n");
  }

  // Collapse runs of blank lines in every section
  for (const k of Object.keys(sections) as (keyof Sections)[]) {
    if (sections[k]) sections[k] = sections[k].replace(/\n{3,}/g, "\n\n").trim();
  }

  return sections;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

type JobResult = {
  index: number;
  url: string;
  title: string;
  company: string;
  location: string;
  datePosted: string;
  jobType: string;
  seniority: string;
  industries: string;
  about_raw: string;
  about_company: string;
  about_summary: string;
  about_responsibilities: string;
  about_requirements: string;
  error?: string;
};

/**
 * Main scraping handler.
 * 1. Resolves which keywords/location to use (request body overrides stored values).
 * 2. Searches LinkedIn for each keyword and collects job page URLs.
 * 3. Visits each URL in parallel workers and extracts structured data.
 * 4. Saves results to disk and returns them in the response body.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  // Accept keywords as an array or a comma/semicolon/newline-separated string
  const bodyKeywords: string[] = Array.isArray(body?.keywords)
    ? (body.keywords as string[])
    : typeof body?.keywords === "string"
    ? (body.keywords as string).split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
    : [];
  const bodyLocation =
    typeof body?.location === "string" && (body.location as string).trim()
      ? (body.location as string).trim()
      : "";

  // Fall back to stored keywords when the request body does not supply them
  const kw = getKeywords();
  const titles: string[] = bodyKeywords.length > 0 ? bodyKeywords : kw.titles.filter(Boolean);
  const location = bodyLocation || (kw.location?.trim() ?? "");

  // Persist any new parameters so future scrapes remember them
  if (bodyKeywords.length > 0 || bodyLocation) {
    setKeywords({ titles: Array.from(new Set(titles)), skills: kw.skills, location });
  }

  if (!titles.length) {
    return new Response(
      JSON.stringify({ ok: false, error: "No keywords configured. Use /api/keywords to add job titles." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const sessionCookie = process.env.LINKEDIN_SESSION_COOKIE; // optional li_at cookie for logged-in scraping
  const maxJobs = +(process.env.LINKEDIN_MAX_JOBS ?? "30");
  const concurrency = +(process.env.LINKEDIN_CONCURRENCY ?? "3"); // parallel browser tabs

  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const browserContext = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });

    // Inject the session cookie when provided so LinkedIn shows full job descriptions
    if (sessionCookie) {
      const match = /li_at=([^;]+)/.exec(sessionCookie);
      if (match) {
        await browserContext.addCookies([{
          name: "li_at", value: match[1],
          domain: ".www.linkedin.com", path: "/",
          httpOnly: true, secure: true, sameSite: "Lax",
        }]);
      }
    }

    // -----------------------------------------------------------------------
    // Phase 1 — collect job page URLs from search result pages
    // -----------------------------------------------------------------------
    const page = await browserContext.newPage();
    let jobLinks: string[] = [];
    const searchUrlsUsed: string[] = [];

    for (const title of titles) {
      if (jobLinks.length >= maxJobs) break;
      const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(title)}${
        location ? `&location=${encodeURIComponent(location)}` : ""
      }`;
      searchUrlsUsed.push(searchUrl);

      try {
        await page.goto(searchUrl, { waitUntil: "networkidle", timeout: 30000 });
        // Scroll to trigger lazy-loaded job cards
        await page.evaluate(async () => {
          for (let i = 0; i < 6; i++) {
            window.scrollBy(0, window.innerHeight);
            await new Promise((r) => setTimeout(r, 600));
          }
        });
        const links = await page.locator("a[href*='/jobs/view/']").evaluateAll((els) =>
          Array.from(new Set(
            els.map((a) => (a as HTMLAnchorElement).href).filter(Boolean).map((h) => h.split("?")[0])
          ))
        );
        for (const l of links) {
          if (jobLinks.length >= maxJobs) break;
          if (!jobLinks.includes(l)) jobLinks.push(l);
        }
      } catch {
        continue; // skip this keyword if the search page times out or errors
      }
    }

    jobLinks = jobLinks.slice(0, maxJobs);

    if (!jobLinks.length) {
      await browser.close();
      return new Response(
        JSON.stringify({ ok: false, error: "No job links found — LinkedIn may be blocking scraping" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // -----------------------------------------------------------------------
    // Phase 2 — visit each job page and extract structured data in parallel
    // -----------------------------------------------------------------------
    const results: JobResult[] = [];
    let index = 0;

    /** Worker that processes job URLs from the shared queue until it is empty. */
    async function worker() {
      while (index < jobLinks.length) {
        const i = index++;
        const jobUrl = jobLinks[i];
        const jobPage = await browserContext.newPage();
        try {
          await jobPage.goto(jobUrl, { waitUntil: "networkidle", timeout: 25000 });
          const info = await extractJobInfo(jobPage);
          const about_raw = await extractAboutTheJob(jobPage);
          const parsed = parseAboutSections(about_raw);
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
          // Small random delay to reduce the chance of rate-limiting
          await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
        } catch (err) {
          results.push({
            index: i + 1, url: jobUrl,
            title: "", company: "", location: "", datePosted: "",
            jobType: "", seniority: "", industries: "",
            about_raw: "", about_company: "", about_summary: "",
            about_responsibilities: "", about_requirements: "",
            error: err instanceof Error ? err.message : String(err),
          });
        } finally {
          await jobPage.close();
        }
      }
    }

    // Launch N concurrent workers
    const workers: Promise<void>[] = [];
    for (let k = 0; k < Math.min(concurrency, jobLinks.length); k++) workers.push(worker());
    await Promise.all(workers);

    await browser.close();

    // Save search metadata alongside the results so results can be traced back to their query
    const payloadToSave = { search: { titles, location, searchUrls: searchUrlsUsed }, results };
    const saved = await saveJson("linkedin-about-jobs", payloadToSave);

    return new Response(
      JSON.stringify({ ok: true, portal: "linkedin", ...saved, results }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
