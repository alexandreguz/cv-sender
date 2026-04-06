// GET /api/cv/[id] — streams a generated CV as a downloadable PDF file.
// If the PDF bytes are not in memory (e.g. after a server restart), the CV is
// automatically regenerated from the persisted CvDocument and base profile.
import { getCV, getCvDocument, getProfile, storeCV } from "@/lib/server/db";
import { buildCvPdf } from "@/lib/server/pdf";

type Params = { params: Promise<{ id: string }> };

/**
 * Returns the PDF for the given CV id.
 * Tries in-memory first; falls back to regenerating from the persisted CvDocument
 * so that hot-reloads and server restarts do not break the download link.
 */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  let pdfBytes: Uint8Array | null = getCV(id)?.pdfBytes ?? null;

  if (!pdfBytes) {
    // PDF not in memory — try to regenerate from the persisted CvDocument
    const doc = getCvDocument(id);
    if (!doc) {
      return new Response(JSON.stringify({ error: "CV not found" }), { status: 404 });
    }
    const profile = getProfile();
    pdfBytes = await buildCvPdf(profile, doc);
    // Cache the bytes back in memory using the same id so subsequent requests are fast
    storeCV(doc.jobId, doc.profileId || null, pdfBytes, id);
  }

  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cv-${id}.pdf"`,
    },
  });
}
