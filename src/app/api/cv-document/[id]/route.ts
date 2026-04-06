// GET    /api/cv-document/[id] — returns the structured CvDocument for preview + edit
// PATCH  /api/cv-document/[id] — updates title/summary/skills and regenerates the PDF bytes
import { NextResponse } from "next/server";
import { getCvDocument, updateCvDocument, getProfile, storeCV } from "@/lib/server/db";
import { buildCvPdf } from "@/lib/server/pdf";

type Params = { params: Promise<{ id: string }> };

/** Returns the CvDocument JSON used by the dashboard preview panel. */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const doc = getCvDocument(id);
  if (!doc) {
    return NextResponse.json({ error: "CV document not found" }, { status: 404 });
  }
  return NextResponse.json(doc);
}

/**
 * Applies edits (title, summary, skills) to the CvDocument, persists the changes,
 * and regenerates the PDF bytes in memory so the download link stays valid.
 */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();

  const updated = updateCvDocument(id, {
    title:   typeof body.title   === "string" ? body.title   : undefined,
    summary: typeof body.summary === "string" ? body.summary : undefined,
    skills:  Array.isArray(body.skills)       ? body.skills  : undefined,
  });

  if (!updated) {
    return NextResponse.json({ error: "CV document not found" }, { status: 404 });
  }

  // Regenerate the PDF using the same cvId so the download link stays valid
  const profile = getProfile();
  const pdfBytes = await buildCvPdf(profile, updated);
  storeCV(updated.jobId, updated.profileId || null, pdfBytes, updated.id);

  return NextResponse.json(updated);
}
