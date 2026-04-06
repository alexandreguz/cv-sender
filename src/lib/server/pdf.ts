// src/lib/server/pdf.ts
// Shared PDF generation utility used by generate-cv and cv-document routes.
// Builds an A4 resume from a base Profile + CvDocument content using pdf-lib.
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Profile, CvDocument } from "./db";

// A4 dimensions in points
const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN = 50;
const TEXT_W = PAGE_W - MARGIN * 2;

/**
 * Strips characters outside latin-1 that standard PDF fonts cannot encode.
 * Hebrew or other non-latin text is silently removed to avoid pdf-lib errors.
 */
function pdfSafe(text: string): string {
  return text.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");
}

/** Splits text into lines that fit within `maxWidth` at the given font size. */
function wrapText(
  text: string,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  size: number,
  maxWidth: number
): string[] {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Generates an A4 PDF buffer from a base Profile and a CvDocument.
 * Layout: name → job title → contact → summary → skills → experience → education.
 */
export async function buildCvPdf(
  profile: Profile | null,
  doc: CvDocument
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);

  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  type EmbedFont = typeof boldFont;

  let y = 800;

  /** Draws a single line and advances the cursor. */
  function draw(
    text: string,
    font: EmbedFont,
    size: number,
    indent = 0
  ) {
    const safe = pdfSafe(text);
    if (!safe.trim()) return;
    try {
      page.drawText(safe, { x: MARGIN + indent, y, size, font });
    } catch {
      // skip text that the standard font cannot encode
    }
    y -= size + 4;
  }

  /** Draws word-wrapped text and advances the cursor for each line. */
  function drawWrapped(
    text: string,
    font: EmbedFont,
    size: number,
    indent = 0
  ) {
    const lines = wrapText(text, font, size, TEXT_W - indent);
    for (const line of lines) {
      if (y < 60) break;
      try {
        page.drawText(line, { x: MARGIN + indent, y, size, font });
      } catch {
        // skip non-encodable lines
      }
      y -= size + 4;
    }
  }

  /** Draws a thin horizontal rule and adds vertical spacing. */
  function drawRule() {
    y += 2;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.75),
    });
    y -= 8;
  }

  /** Draws a bold section heading followed by a horizontal rule. */
  function section(title: string) {
    y -= 8;
    draw(title, boldFont, 11);
    drawRule();
  }

  // ── Header ──────────────────────────────────────────────────────────────
  draw(profile?.name ?? "", boldFont, 22);
  // Only draw the job title line when it is set (omitted for Base Profile CVs)
  if (doc.title.trim()) draw(doc.title, regularFont, 13);
  y -= 2;

  const contactParts = [profile?.email, profile?.phone, profile?.location].filter(Boolean);
  if (contactParts.length) draw(contactParts.join("  |  "), regularFont, 9);

  const linkParts = [
    profile?.linkedin ? `LinkedIn: ${profile.linkedin}` : "",
    profile?.github   ? `GitHub: ${profile.github}` : "",
  ].filter(Boolean);
  if (linkParts.length) draw(linkParts.join("  |  "), regularFont, 9);

  // ── Summary ─────────────────────────────────────────────────────────────
  if (doc.summary) {
    section("Summary");
    drawWrapped(doc.summary, regularFont, 10);
  }

  // ── Skills ──────────────────────────────────────────────────────────────
  if (doc.skills.length > 0) {
    section("Skills");
    drawWrapped(doc.skills.join("  ·  "), regularFont, 10);
  }

  // ── Experience ──────────────────────────────────────────────────────────
  const exps = profile?.experiences ?? [];
  if (exps.length > 0) {
    section("Experience");
    for (const exp of exps) {
      if (y < 80) break;
      const dates = exp.isCurrent
        ? `${exp.startDate} — Present`
        : `${exp.startDate}${exp.endDate ? ` — ${exp.endDate}` : ""}`;
      draw(`${exp.position}  ·  ${exp.company}`, boldFont, 10);
      draw(dates, regularFont, 9);
      if (exp.description) drawWrapped(exp.description, regularFont, 9, 10);
      y -= 4;
    }
  }

  // ── Education ────────────────────────────────────────────────────────────
  if (profile?.education) {
    section("Education");
    drawWrapped(profile.education, regularFont, 10);
  }

  return pdfDoc.save();
}
