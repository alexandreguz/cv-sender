// src/app/api/generate-cv/route.ts
import { NextResponse } from "next/server";
import { getProfile, storeCV, updateJob, listJobs } from "@/lib/server/db";
import { PDFDocument, StandardFonts } from "pdf-lib";

function findJobById(jobId: string) {
  const jobs = listJobs();
  return jobs.find(j => j.id === jobId) ?? null;
}

async function generateCvPdfBytes(profile: any, job: any) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let cursorY = 800;
  const put = (text: string) => {
    page.drawText(text, { x: 50, y: cursorY, size: 11, font: helvetica });
    cursorY -= 18;
  };
  put(`Name: ${profile?.name ?? ""}`);
  put(`Email: ${profile?.email ?? ""}`);
  put(`Applying to: ${job.title} — ${job.company}`);
  cursorY -= 10;
  put("Skills:");
  put(profile?.skills ?? "");
  put("Experience:");
  put(profile?.experience ?? "");
  const bytes = await pdfDoc.save();
  return bytes;
}

export async function POST(req: Request) {
  const body = await req.json();
  const { jobId } = body;
  if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
  const job = findJobById(jobId);
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });
  const profile = getProfile();
  const pdfBytes = await generateCvPdfBytes(profile, job);
  const cvId = storeCV(jobId, profile?.id ?? null, pdfBytes);
  updateJob(jobId, { status: "ready", cvId });
  return NextResponse.json({ message: "CV generated", cvId });
}
