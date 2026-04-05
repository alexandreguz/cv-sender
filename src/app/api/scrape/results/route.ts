export const runtime = "nodejs";

// GET /api/scrape/results?portal=linkedin
// Returns the parsed contents of the most recent scrape result file for the given portal.
// Currently only "linkedin" is supported; other portals return 400.
import fs from "fs/promises";
import path from "path";

/**
 * Scans the data/ directory for files matching the LinkedIn result pattern
 * and returns the full path of the most recent one (sorted lexicographically by filename).
 * Returns null if no matching file exists.
 */
async function findLatestLinkedinFile(): Promise<string | null> {
  const dir = path.resolve(process.cwd(), "data");
  try {
    const files = await fs.readdir(dir);
    const matches = files.filter(
      (f) => f.startsWith("linkedin-about-jobs-") && f.endsWith(".json")
    );
    if (!matches.length) return null;
    matches.sort(); // filenames include a timestamp, so alphabetical = chronological
    return path.join(dir, matches[matches.length - 1]);
  } catch {
    return null;
  }
}

/** Reads the latest LinkedIn scrape file and returns its job results array. */
export async function GET(req: Request) {
  const portal = new URL(req.url).searchParams.get("portal") ?? "linkedin";

  if (portal !== "linkedin") {
    return new Response(JSON.stringify({ ok: false, error: "Portal not supported yet" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const file = await findLatestLinkedinFile();
  if (!file) {
    return new Response(JSON.stringify({ ok: false, error: "No LinkedIn result file found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const raw = await fs.readFile(file, "utf8");
    const json = JSON.parse(raw);
    // The file may wrap results in a { results: [] } envelope or be a bare array
    const jobs = Array.isArray(json.results) ? json.results : Array.isArray(json) ? json : [];
    return new Response(
      JSON.stringify({ ok: true, file: path.basename(file), data: jobs }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err instanceof Error ? err.message : err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
