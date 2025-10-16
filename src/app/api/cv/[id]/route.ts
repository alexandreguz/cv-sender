// src/app/api/cv/[id]/route.ts
import { getCV } from "@/lib/server/db";

export async function GET(_req: Request, { params }: { params: { id?: string } }) {
  const id = params?.id;
  if (!id) {
    return new Response(JSON.stringify({ error: "id required" }), { status: 400 });
  }

  const cv = getCV(id);
  if (!cv) {
    return new Response(JSON.stringify({ error: "cv not found" }), { status: 404 });
  }

  // 👇 converte o Uint8Array em Buffer
  const pdfBuffer = Buffer.from(cv.pdfBytes);

  return new Response(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="cv-${id}.pdf"`,
    },
  });
}
