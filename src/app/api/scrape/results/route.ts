export const runtime = "nodejs";

// GET  /api/scrape/results?portal=linkedin|alljobs
//   Returns all scrape sessions for the given portal as an array, newest first.
//   Each session: { file, portal, jobs, meta, searchedAt }
//
// DELETE /api/scrape/results?file=<filename>&portal=linkedin|alljobs
//   Deletes the given result file from the portal's data directory.
import fs from "fs/promises";
import path from "path";

// ---------------------------------------------------------------------------
// Portal → directory mapping
// ---------------------------------------------------------------------------

const PORTAL_DIRS: Record<string, () => string> = {
  linkedin: () => path.resolve(process.cwd(), "data", "linkedin"),
  alljobs: () => path.resolve(process.cwd(), "data", "alljobs"),
};

/** Returns the data directory for the given portal, or null for unknown portals. */
function portalDir(portal: string): string | null {
  return PORTAL_DIRS[portal]?.() ?? null;
}

// ---------------------------------------------------------------------------
// Session parsing
// ---------------------------------------------------------------------------

type Session = {
  file: string;
  portal: string;
  jobs: unknown[];
  meta: Record<string, unknown> | null;
  searchedAt: string | null;
};

/** Parse a single result file into a Session object. */
async function parseFile(filePath: string, portal: string): Promise<Session | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const json = JSON.parse(raw);
    const jobs = Array.isArray(json.results) ? json.results : Array.isArray(json) ? json : [];
    const meta: Record<string, unknown> | null = json.search ?? null;

    // Extract timestamp from filename for display (13-digit unix ms)
    const basename = path.basename(filePath);
    const tsMatch = basename.match(/(\d{13})/);
    const searchedAt = tsMatch ? new Date(parseInt(tsMatch[1])).toLocaleString() : null;

    return { file: basename, portal, jobs, meta, searchedAt };
  } catch {
    return null;
  }
}

/** Collect all session files for a portal directory, newest first. */
async function collectSessions(portal: string): Promise<Session[]> {
  const dir = portalDir(portal);
  if (!dir) return [];

  const sessions: Session[] = [];
  try {
    const files = (await fs.readdir(dir))
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse(); // newest first (filenames contain timestamps)
    for (const f of files) {
      const s = await parseFile(path.join(dir, f), portal);
      if (s) sessions.push(s);
    }
  } catch {
    // Directory may not exist yet — return empty
  }
  return sessions;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/** GET — return all sessions for the requested portal, newest first. */
export async function GET(req: Request) {
  const portal = new URL(req.url).searchParams.get("portal") ?? "linkedin";

  if (!PORTAL_DIRS[portal]) {
    return new Response(
      JSON.stringify({ ok: false, error: `Portal "${portal}" not supported` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const sessions = await collectSessions(portal);
  return new Response(JSON.stringify({ ok: true, sessions }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** DELETE — remove a single result file by filename and portal. */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const filename = url.searchParams.get("file");
  const portal = url.searchParams.get("portal") ?? "linkedin";

  if (!filename || filename.includes("/") || filename.includes("..")) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid filename" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const dir = portalDir(portal);
  if (!dir) {
    return new Response(
      JSON.stringify({ ok: false, error: `Portal "${portal}" not supported` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    await fs.unlink(path.join(dir, filename));
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
