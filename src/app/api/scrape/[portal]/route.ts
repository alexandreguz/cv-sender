export const runtime = "nodejs";

// POST /api/scrape/[portal]
// Generic Playwright scraper for non-LinkedIn portals (alljobs, jobnet, drushim).
// Extracts visible text from common job-listing selectors and saves results to a .txt file.
// Note: LinkedIn is handled by the dedicated /api/scrape/linkedin route.
import fs from "fs/promises";
import path from "path";

type RouteParams = { params: Promise<{ portal: string }> };

/** Writes scraped text items to a timestamped .txt file inside data/ and returns file metadata. */
async function saveText(portal: string, items: string[]) {
  const dir = path.resolve(process.cwd(), "data");
  await fs.mkdir(dir, { recursive: true });
  const name = `scrape-${portal}-${Date.now()}.txt`;
  const file = path.join(dir, name);
  await fs.writeFile(file, items.join("\n"), "utf8");
  return { file, name, count: items.length };
}

/**
 * Opens a Chromium browser, navigates to pageUrl, and extracts text from a broad set
 * of selectors commonly used for job titles across different portals.
 * Deduplicates and filters out empty or very short strings before returning.
 */
async function genericScrape(pageUrl: string) {
  const selectors = [
    ".base-search-card__title",
    ".job-card-list__title",
    ".result-card__title",
    "h1", "h2", "h3",
    "a",
    ".title",
    ".jobTitle",
  ].join(",");

  // Dynamic import so the route compiles even when Playwright is not installed
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 30_000 });
    const raw = await page.$$eval(selectors, (els) =>
      els.map((el) => (el.textContent || "").trim())
    );
    await browser.close();
    // Deduplicate and remove whitespace-only entries
    return Array.from(new Set(raw.map((r) => r.replace(/\s+/g, " ").trim()))).filter(
      (s) => s && s.length > 2
    );
  } catch (err) {
    await browser.close();
    throw err;
  }
}

/**
 * Routes the scrape request to the correct portal URL.
 * Saves results to disk and returns file metadata + item count.
 */
export async function POST(_req: Request, { params }: RouteParams) {
  const { portal: portalParam } = await params;
  const portal = (portalParam || "unknown").toLowerCase();

  try {
    let items: string[] = [];

    switch (portal) {
      case "alljobs":
        items = await genericScrape("https://www.alljobs.co.il/SearchResults?KeyWords=QA");
        break;
      case "jobnet":
        items = await genericScrape("https://www.jobnet.dk/SearchResult?keywords=QA");
        break;
      case "drushim":
        items = await genericScrape("https://drushim.co.il/search?q=QA");
        break;
      default:
        return new Response(JSON.stringify({ error: "unknown portal" }), { status: 400 });
    }

    const saved = await saveText(portal, items);

    return new Response(JSON.stringify({ ok: true, portal, ...saved }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "scrape failed - ensure playwright is installed and browsers are available";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
