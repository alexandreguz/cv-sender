export const runtime = "nodejs";

// GET  /api/scrape/results?portal=linkedin
//   Returns all scrape sessions from data/linkedin/ as an array, newest first.
//   Each session: { file, jobs, meta, searchedAt }
//
// DELETE /api/scrape/results?file=<filename>
//   Deletes the given result file from data/linkedin/.
import fs from "fs/promises";
import path from "path";

const LINKEDIN_DIR = () => path.resolve(process.cwd(), "data", "linkedin");

type Session = {
  file: string;
  jobs: unknown[];
  meta: Record<string, unknown> | null;
  searchedAt: string | null;
};

/** Parse a single result file into a Session object. */
async function parseFile(filePath: string): Promise<Session | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const json = JSON.parse(raw);
    const jobs = Array.isArray(json.results) ? json.results : Array.isArray(json) ? json : [];
    const meta: Record<string, unknown> | null = json.search ?? null;

    // Extract timestamp from filename for display (13-digit unix ms)
    const basename = path.basename(filePath);
    const tsMatch = basename.match(/(\d{13})/);
    const searchedAt = tsMatch ? new Date(parseInt(tsMatch[1])).toLocaleString() : null;

    return { file: basename, jobs, meta, searchedAt };
  } catch {
    return null;
  }
}

/** Collect all session files from data/linkedin/, newest first. */
async function collectAllSessions(): Promise<Session[]> {
  const sessions: Session[] = [];
  try {
    const files = (await fs.readdir(LINKEDIN_DIR()))
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse(); // newest first
    for (const f of files) {
      const s = await parseFile(path.join(LINKEDIN_DIR(), f));
      if (s) sessions.push(s);
    }
  } catch {
    // directory may not exist yet — return empty list
  }
  return sessions;
}

/** GET — return all sessions for the requested portal. */
export async function GET(req: Request) {
  const portal = new URL(req.url).searchParams.get("portal") ?? "linkedin";

  if (portal !== "linkedin") {
    return new Response(JSON.stringify({ ok: false, error: "Portal not supported yet" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const sessions = await collectAllSessions();
  return new Response(JSON.stringify({ ok: true, sessions }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** DELETE — remove a single result file by filename. */
export async function DELETE(req: Request) {
  const filename = new URL(req.url).searchParams.get("file");
  if (!filename || filename.includes("/") || filename.includes("..")) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid filename" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Only delete files that live inside data/linkedin/
  try {
    await fs.unlink(path.join(LINKEDIN_DIR(), filename));
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "File not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
}
