// GET /api/cv/[id] — streams a generated CV as a downloadable PDF file
import { getCV } from "@/lib/server/db";

type Params = { params: Promise<{ id: string }> };

/**
 * Looks up the CV by id and returns its PDF bytes with the appropriate headers.
 * Note: CVs are stored in RAM only and will be lost on server restart.
 */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  const cv = getCV(id);
  if (!cv) {
    return new Response(JSON.stringify({ error: "CV not found" }), { status: 404 });
  }

  return new Response(Buffer.from(cv.pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      // Triggers a browser download dialogue with a descriptive filename
      "Content-Disposition": `attachment; filename="cv-${id}.pdf"`,
    },
  });
}
