"use client";
// /preview — read-only CV preview built from the base profile stored on the server.
// Provides "Download HTML" and "Download PDF" (print-to-PDF) buttons.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Download, FileText, Loader2 } from "lucide-react";
import type { Profile } from "@/lib/server/db";

export default function PreviewPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch the base profile from the server when the component first renders
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setProfile(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /**
   * Builds a complete, self-contained HTML string from the profile data.
   * Shared by the HTML download and the PDF print window.
   * When `autoPrint` is true, a script tag is injected to trigger window.print() on load.
   */
  function buildResumeHtml(autoPrint = false) {
    if (!profile) return "";

    const skillsList = (profile.skills ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => `<li>${s}</li>`)
      .join("");

    const expHtml = (profile.experiences ?? [])
      .map((e) => {
        const dateRange = e.isCurrent
          ? `${e.startDate} — Present`
          : `${e.startDate}${e.endDate ? ` — ${e.endDate}` : ""}`;
        return `
<div class="exp">
  <strong>${e.position}</strong> &middot; ${e.company}
  <span class="date">${dateRange}</span>
  ${e.description ? `<p>${e.description}</p>` : ""}
</div>`;
      })
      .join("\n");

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${profile.name || "Resume"}</title>
<style>
  body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; padding: 32px; max-width: 860px; margin: 0 auto; }
  h1 { color: #1d4ed8; margin-bottom: 4px; }
  h2 { color: #1d4ed8; font-size: 1.1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-top: 24px; }
  .meta { color: #64748b; font-size: 0.9rem; margin-bottom: 4px; }
  ul { padding-left: 20px; }
  p { white-space: pre-line; margin: 4px 0; }
  .exp { border-left: 3px solid #bfdbfe; padding-left: 12px; margin-bottom: 14px; }
  .exp strong { display: block; }
  .date { font-size: 0.82rem; color: #94a3b8; }
  @media print {
    body { padding: 0; }
    @page { margin: 20mm; }
  }
</style>
</head>
<body>
<h1>${profile.name || "—"}</h1>
<p class="meta">${profile.location || ""}</p>
<p class="meta">
  ${profile.email ? `Email: ${profile.email}` : ""}
  ${profile.phone ? ` &bull; Phone: ${profile.phone}` : ""}
</p>
<p class="meta">
  ${profile.linkedin ? `LinkedIn: <a href="${profile.linkedin}">${profile.linkedin}</a>` : ""}
  ${profile.github ? ` &bull; GitHub: <a href="${profile.github}">${profile.github}</a>` : ""}
</p>
${profile.summary ? `<h2>Summary</h2><p>${profile.summary}</p>` : ""}
${skillsList ? `<h2>Skills</h2><ul>${skillsList}</ul>` : ""}
${expHtml ? `<h2>Experience</h2>${expHtml}` : ""}
${profile.education ? `<h2>Education</h2><p>${profile.education}</p>` : ""}
${autoPrint ? `<script>window.onload = () => { window.print(); };</script>` : ""}
</body>
</html>`;
  }

  /** Triggers a browser file download of the resume as a .html file. */
  function downloadHtml() {
    if (!profile) return;
    const html = buildResumeHtml(false);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(profile.name || "resume").replace(/\s+/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Opens the resume in a new window and triggers the browser print dialog.
   * The user can then choose "Save as PDF" from any browser's print dialog.
   * This approach supports all character sets (including Hebrew) without extra packages.
   */
  function downloadPdf() {
    if (!profile) return;
    const html = buildResumeHtml(true);
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  if (loading) {
    return (
      <main className="p-6 max-w-4xl mx-auto flex items-center gap-2 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading profile...
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <p className="text-gray-500 mb-4">No profile saved yet. Fill in your base profile first.</p>
        <button
          onClick={() => router.push("/profile")}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
        >
          Go to Profile
        </button>
      </main>
    );
  }

  const skillsList = (profile.skills ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <main className="max-w-4xl mx-auto p-8 my-8 bg-white shadow-md rounded-xl">

      {/* Resume header */}
      <header className="mb-8 pb-6 border-b border-gray-200">
        <h1 className="text-4xl font-bold text-blue-700 mb-1">{profile.name || "—"}</h1>
        {profile.location && <p className="text-gray-500 text-sm">{profile.location}</p>}

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
          {profile.email && <span>✉ {profile.email}</span>}
          {profile.phone && <span>📞 {profile.phone}</span>}
          {profile.linkedin && (
            <a href={profile.linkedin} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
              LinkedIn
            </a>
          )}
          {profile.github && (
            <a href={profile.github} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
              GitHub
            </a>
          )}
        </div>
      </header>

      {/* Summary */}
      {profile.summary && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-blue-700 mb-2">Summary</h2>
          <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{profile.summary}</p>
        </section>
      )}

      {/* Skills */}
      {skillsList.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-blue-700 mb-2">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {skillsList.map((skill, i) => (
              <span key={i} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">{skill}</span>
            ))}
          </div>
        </section>
      )}

      {/* Structured experience list */}
      {(profile.experiences ?? []).length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-blue-700 mb-3">Experience</h2>
          <div className="space-y-4">
            {(profile.experiences ?? []).map((exp) => (
              <div key={exp.id} className="border-l-4 border-blue-200 pl-4">
                <p className="font-semibold text-gray-900 text-sm">{exp.position}</p>
                <p className="text-blue-600 text-sm">{exp.company}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {exp.isCurrent
                    ? `${exp.startDate} — Present`
                    : `${exp.startDate}${exp.endDate ? ` — ${exp.endDate}` : ""}`}
                </p>
                {exp.description && (
                  <p className="text-gray-700 text-sm leading-relaxed mt-1 whitespace-pre-line">
                    {exp.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Education */}
      {profile.education && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-blue-700 mb-2">Education</h2>
          <div className="border-l-4 border-blue-200 pl-4">
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{profile.education}</p>
          </div>
        </section>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-gray-200">
        <button
          onClick={() => router.push("/profile")}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm transition-colors"
        >
          <Edit2 className="w-4 h-4" /> Edit Profile
        </button>
        <button
          onClick={downloadHtml}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm transition-colors"
        >
          <Download className="w-4 h-4" /> Download HTML
        </button>
        <button
          onClick={downloadPdf}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm transition-colors"
        >
          <FileText className="w-4 h-4" /> Download PDF
        </button>
      </div>
    </main>
  );
}
