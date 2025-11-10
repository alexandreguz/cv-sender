export const runtime = "nodejs";

import fs from "fs/promises";
import path from "path";

async function findLatestLinkedinFile() {
  const dir = path.resolve(process.cwd(), "data");
  try {
    const files = await fs.readdir(dir);
    const matches = files.filter((f) => f.startsWith("linkedin-about-jobs-") && f.endsWith(".json"));
    if (!matches.length) return null;
    // pick latest by timestamp in name (they include Date.now()) or by mtime
    matches.sort();
    const latest = matches[matches.length - 1];
    return path.join(dir, latest);
  } catch (e) {
    return null;
  }
}

export async function GET(req: Request) {
  const searchParams = new URL(req.url).searchParams;
  const portal = searchParams.get("portal") || "linkedin";

  if (portal === "linkedin") {
    const file = await findLatestLinkedinFile();
    if (!file) {
      return new Response(JSON.stringify({ ok: false, error: "no linkedin result file found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const raw = await fs.readFile(file, "utf8");
      const json = JSON.parse(raw);
      // If the file has a 'results' array, return only that
      const jobs = Array.isArray(json.results) ? json.results : Array.isArray(json) ? json : [];
      return new Response(JSON.stringify({ ok: true, file: path.basename(file), data: jobs }), {
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

  // For other portals, we'll implement them later
  return new Response(JSON.stringify({ ok: false, error: "Portal not supported yet" }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}