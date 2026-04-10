// POST /api/generate-cv
// Generates a tailored PDF resume for a specific job using a chosen CvProfile.
// Special value cvProfileId="__base__" generates a plain Base Profile CV with no job-title overlay.
// On success: stores CvDocument (persisted), stores PDF bytes (in-memory), updates job status.
import { NextResponse } from "next/server";
import {
  getProfile,
  getCvProfile,
  storeCV,
  storeCvDocument,
  updateJob,
  listJobs,
  type Job,
  type CvDocument,
} from "@/lib/server/db";
import { buildCvPdf } from "@/lib/server/pdf";

/** Sentinel value used when the user wants a plain Base Profile CV with no job-type overlay. */
const BASE_PROFILE_ID = "__base__";

/** Finds a job by id from the in-memory list. Returns null if not found. */
function findJobById(jobId: string): Job | null {
  return listJobs().find((j) => j.id === jobId) ?? null;
}

/** Validates the request, generates the PDF, stores the CvDocument, and updates the job. */
export async function POST(req: Request) {
  const body = await req.json();
  const { jobId, cvProfileId } = body;

  if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  if (!cvProfileId) return NextResponse.json({ error: "cvProfileId is required" }, { status: 400 });

  const job = findJobById(jobId);
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  const profile = getProfile();

  // Build the CvDocument fields.
  // "__base__" uses the base profile data directly (no job-specific title or tailored skills).
  let docTitle: string;
  let docSummary: string;
  let docSkills: string[];

  if (cvProfileId === BASE_PROFILE_ID) {
    docTitle = "";  // no job title below the name — this is the generic resume
    docSummary = profile?.summary ?? "";
    docSkills = (profile?.skills ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    const cvProfile = getCvProfile(cvProfileId);
    if (!cvProfile) return NextResponse.json({ error: "CV profile not found" }, { status: 404 });
    docTitle = cvProfile.title;
    // Fall back to the base profile summary when the CvProfile has no tailored summary.
    // This ensures the Summary section always appears — only skills change per profile.
    docSummary = cvProfile.summary?.trim() ? cvProfile.summary : (profile?.summary ?? "");
    docSkills = cvProfile.skills;
  }

  // Build a temporary CvDocument object to drive PDF generation (id filled in after storeCV)
  const tempDoc: CvDocument = {
    id: "",
    jobId,
    profileId: profile?.id ?? "",
    cvProfileId,
    title: docTitle,
    summary: docSummary,
    skills: docSkills,
    updatedAt: new Date().toISOString(),
  };

  // Generate PDF bytes from base profile + CvDocument content
  const pdfBytes = await buildCvPdf(profile, tempDoc);

  // Store PDF bytes in memory — storeCV returns the assigned id
  const cvId = storeCV(jobId, profile?.id ?? null, pdfBytes);

  // Persist the CvDocument using the same id assigned to the PDF
  storeCvDocument({ ...tempDoc, id: cvId });

  // Mark the job as ready and record which CvProfile was used
  updateJob(jobId, { status: "ready", cvId, cvProfileId });

  return NextResponse.json({ message: "CV generated", cvId });
}
