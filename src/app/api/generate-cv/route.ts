// POST /api/generate-cv — generates a PDF resume for a specific job
// Uses the stored base profile and the job details to build the PDF via pdf-lib.
// On success, marks the job status as "ready" and stores the cvId.
import { NextResponse } from "next/server";
import { getProfile, storeCV, updateJob, listJobs, type Profile, type Job } from "@/lib/server/db";
import { PDFDocument, StandardFonts } from "pdf-lib";

/** Finds a job by id from the in-memory list. Returns null if not found. */
function findJobById(jobId: string): Job | null {
  return listJobs().find((j) => j.id === jobId) ?? null;
}

/**
 * Builds a simple A4 PDF with candidate info and job details.
 * Uses the base profile for personal data; falls back to empty strings when fields are missing.
 */
async function generateCvPdfBytes(profile: Profile | null, job: Job): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 dimensions in points
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let cursorY = 800;

  /** Draws a single line of text and moves the cursor down. */
  const put = (text: string) => {
    page.drawText(text, { x: 50, y: cursorY, size: 11, font });
    cursorY -= 18;
  };

  put(`Name: ${profile?.name ?? ""}`);
  put(`Email: ${profile?.email ?? ""}`);
  put(`Applying to: ${job.title} — ${job.company}`);
  cursorY -= 10;
  put("Skills:");
  put(profile?.skills ?? "");
  put("Experience:");
  // Flatten structured experiences into plain text for the PDF
  const expText = (profile?.experiences ?? [])
    .map((e) => `${e.position} at ${e.company} (${e.startDate}${e.isCurrent ? " — Present" : e.endDate ? ` — ${e.endDate}` : ""})`)
    .join(", ");
  put(expText);

  return pdfDoc.save();
}

/** Validates the request, generates the PDF, stores it, and updates the job record. */
export async function POST(req: Request) {
  const body = await req.json();
  const { jobId } = body;

  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });

  const job = findJobById(jobId);
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  const profile = getProfile();
  const pdfBytes = await generateCvPdfBytes(profile, job);

  // Store the PDF bytes in memory and link its id to the job
  const cvId = storeCV(jobId, profile?.id ?? null, pdfBytes);

  // Mark the job as ready so the dashboard and automation API can pick it up
  updateJob(jobId, { status: "ready", cvId });

  return NextResponse.json({ message: "CV generated", cvId });
}
