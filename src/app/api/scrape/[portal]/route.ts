// // src/app/api/scrape/[portal]/route.ts
// import { NextResponse } from "next/server";
// import { insertJobs, getKeywords, storeCV, getProfile, updateJob } from "@/lib/server/db";
// import type { Job } from "@/lib/server/db";
// import { PDFDocument, StandardFonts } from "pdf-lib";

// type Portal = "linkedin" | "alljobs" | "jobnet" | "drushim";

// function mockJobsForPortal(portal: Portal, keywords: { titles: string[]; skills: string[] }): Omit<Job, "id" | "createdAt">[] {
//   // generate 3 mock jobs per portal. If keywords.titles exist, sprinkle them in some titles.
//   const baseTitles = [
//     "QA Automation Engineer",
//     "Software Engineer",
//     "Data Analyst",
//     "DevOps Engineer",
//     "Frontend Developer"
//   ];
//   const titles = (keywords.titles.length ? keywords.titles.concat(baseTitles) : baseTitles);

//   const samples = [];
//   for (let i = 0; i < 3; i++) {
//     const title = titles[(i + (portal.length)) % titles.length];
//     const skillSnippet = (keywords.skills.length ? keywords.skills[i % keywords.skills.length] : "JavaScript, Python");
//     samples.push({
//       title: `${title} (${portal.toUpperCase()})`,
//       company: `${portal}-company-${i + 1}`,
//       location: "Israel",
//       description: `Vaga ${title} - precisa de ${skillSnippet}. Portal: ${portal}. Responsabilidades: automação, testes, deploy.`,
//       source: portal,
//       url: `https://${portal}.example/job/${Math.floor(Math.random() * 10000)}`,
//       status: "new" as const,
//     });
//   }
//   return samples;
// }

// async function generateCvPdfBytes(profile: any, job: Job) {
//   // simple PDF generator via pdf-lib
//   const pdfDoc = await PDFDocument.create();
//   const page = pdfDoc.addPage([595, 842]); // A4-ish
//   const { width, height } = page.getSize();
//   const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

//   const lines = [
//     `Name: ${profile?.name ?? "Candidate"}`,
//     `Email: ${profile?.email ?? "email@example.com"}`,
//     `Position (desired): ${profile?.position ?? ""}`,
//     `Applying for: ${job.title} at ${job.company}`,
//     "",
//     "Skills:",
//     `${profile?.skills ?? ""}`,
//     "",
//     "Experience:",
//     `${profile?.experience ?? job.description ?? ""}`,
//     "",
//     "Education:",
//     `${profile?.education ?? ""}`,
//     "",
//     "Match summary:",
//     `This CV was auto-generated to highlight skills related to the job: ${job.title}`,
//   ];

//   let cursorY = height - 50;
//   const fontSize = 11;
//   for (const line of lines) {
//     page.drawText(line, { x: 50, y: cursorY, size: fontSize, font: helvetica });
//     cursorY -= fontSize + 6;
//     if (cursorY < 60) break;
//   }

//   const pdfBytes = await pdfDoc.save();
//   return pdfBytes;
// }

// export async function POST(req: Request, { params }: { params: { portal?: string } }) {
//   const portalParam = params?.portal as string | undefined;
//   if (!portalParam) return NextResponse.json({ error: "Portal missing" }, { status: 400 });
//   const portal = portalParam.toLowerCase() as Portal;

//   const keywords = getKeywords();
//   // create mock jobs
//   const jobs = mockJobsForPortal(portal, keywords);

//   // insert into DB
//   const inserted = insertJobs(jobs);

//   // run a simple matcher: if title or description includes any keyword title/skill -> mark 'ready' and generate CV
//   const profile = getProfile();

//   for (const job of inserted) {
//     let matched = false;
//     const text = (`${job.title} ${job.description}`).toLowerCase();
//     for (const t of keywords.titles) if (t && text.includes(t.toLowerCase())) matched = true;
//     for (const s of keywords.skills) if (s && text.includes(s.toLowerCase())) matched = true;

//     if (matched && profile) {
//       // generate CV PDF bytes
//       const pdfBytes = await generateCvPdfBytes(profile, job);
//       const cvId = storeCV(job.id, profile.id ?? null, pdfBytes);
//       updateJob(job.id, { status: "ready", cvId });
//     }
//   }

//   return NextResponse.json({ message: `Scraped ${portal}`, inserted: inserted.length });
// }


export const runtime = "nodejs";

import fs from "fs/promises";
import path from "path";
import type { NextRequest } from "next/server";

type Params = { portal?: string };

async function saveText(portal: string, items: string[]) {
  const dir = path.resolve(process.cwd(), "data");
  await fs.mkdir(dir, { recursive: true });
  const name = `scrape-${portal}-${Date.now()}.txt`;
  const file = path.join(dir, name);
  await fs.writeFile(file, items.join("\n"), "utf8");
  return { file, name, count: items.length };
}

async function genericScrape(pageUrl: string) {
  // try to extract meaningful text nodes commonly used for job titles
  const selectors = [
    ".base-search-card__title",
    ".job-card-list__title",
    ".result-card__title",
    "h1",
    "h2",
    "h3",
    "a",
    ".title",
    ".jobTitle",
  ].join(",");

  // dynamic import so route won't fail at build if playwright isn't installed
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 30_000 });
    const raw = await page.$$eval(selectors, (els) =>
      els.map((el) => (el.textContent || "").trim())
    );
    await browser.close();
    const items = Array.from(new Set(raw.map((r) => r.replace(/\s+/g, " ").trim()))).filter(
      (s) => s && s.length > 2
    );
    return items;
  } catch (err) {
    await browser.close();
    throw err;
  }
}

export async function POST(_req: Request, context: { params?: Params | Promise<Params> }) {
  // params may be a promise in Next.js app router — await before accessing properties
  const params = await context.params;
  console.log("Params:", params);
  const portal = (params?.portal || "unknown").toLowerCase();
  console.log(`Scrape requested for portal: ${portal}`);

  try {
    let items: string[] = [];

    switch (portal) {
      // case "linkedin":
      //   // example LinkedIn search for "QA Automation" — adjust as needed
      //   items = await genericScrape(
      //     "https://www.linkedin.com/jobs/search?keywords=QA%20Automation&location=Israel&position=1&pageNum=0"
      //   );
      //   break;
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
  } catch (err: any) {
    const message =
      err?.message ||
      "scrape failed - ensure playwright is installed and browsers are available";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}