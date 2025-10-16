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

export async function GET() {
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
    return new Response(JSON.stringify({ ok: true, file: path.basename(file), data: json }), {
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
