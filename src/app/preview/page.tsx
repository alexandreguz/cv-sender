"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Profile = {
  position?: string;
  skills?: string;
  experience?: string;
  education?: string;
  name?: string;
  contact?: string;
  email?: string;
  linkedin?: string;
};

export default function PreviewPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("profilePreview");
      if (raw) {
        setProfile(JSON.parse(raw));
      } else {
        // fallback to another common key
        const alt = localStorage.getItem("profile");
        if (alt) setProfile(JSON.parse(alt));
      }
    } catch (e) {
      console.error("Failed to read localStorage:", e);
    }
  }, []);

  const downloadHtml = () => {
    const p = profile || {};
    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${p.name ?? "My Resume"}</title>
<style>body{font-family:Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; color:#0f172a; padding:24px; max-width:900px; margin:0 auto} h1{color:#0ea5e9} .section{margin-bottom:20px} .muted{color:#6b7280}</style>
</head>
<body>
<header>
  <h1>${p.name ?? "Your Name"}</h1>
  <p class="muted">${p.position ?? ""}</p>
  <p class="muted">Contact: ${p.contact ?? "—"} • Email: ${p.email ?? "—"}</p>
  <p class="muted">LinkedIn: ${p.linkedin ?? "—"}</p>
</header>
<section class="section">
  <h2>Skills</h2>
  <p>${p.skills ?? "—"}</p>
</section>
<section class="section">
  <h2>Experience</h2>
  <p>${(p.experience ?? "—").replace(/\n/g, "<br/>")}</p>
</section>
<section class="section">
  <h2>Education</h2>
  <p>${(p.education ?? "—").replace(/\n/g, "<br/>")}</p>
</section>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(profile?.name ?? "resume").replace(/\s+/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!profile) {
    return (
      <main className="p-6 max-w-4xl mx-auto">
        <p className="mb-4">No saved profile. Fill out the form first.</p>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/profile")}
            className="bg-gray-200 px-4 py-2 rounded"
          >
            Go to Form
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
    <main className="max-w-4xl mx-auto p-8 bg-white shadow rounded-lg mt-10 mb-10">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-4xl font-bold text-blue-600">{profile.name ?? "Your Name"}</h1>
          <p className="text-xl font-semibold">{profile.position ?? "Desired position"}</p>
          <p className="text-gray-600">
            Contact: {profile.contact ?? "—"} • Email:{" "}
            <a className="text-blue-600" href={`mailto:${profile.email ?? ""}`}>
              {profile.email ?? "—"}
            </a>
          </p>
          <p className="text-gray-600">
            LinkedIn:{" "}
            {profile.linkedin ? (
              <a className="text-blue-600" href={profile.linkedin} target="_blank" rel="noreferrer">
                {profile.linkedin}
              </a>
            ) : (
              "—"
            )}
          </p>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold text-blue-600 mb-2">Skills</h2>
        {(() => {
          const skillsList = (profile.skills ?? "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

          if (skillsList.length === 0) {
            return <p>No skills provided</p>;
          }

          return (
            <ul className="list-disc ml-5">
              {skillsList.map((skill, idx) => (
                <li key={idx}>{skill}</li>
              ))}
            </ul>
          );
        })()}
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold text-blue-600 mb-2">Experience</h2>
        <div className="p-4 border-l-4 border-blue-600 bg-gray-100">
          <p className="whitespace-pre-line">{profile.experience ?? "No experience provided"}</p>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-2xl font-semibold text-blue-600 mb-2">Education</h2>
        <div className="p-4 border-l-4 border-blue-600 bg-gray-100">
          <p className="whitespace-pre-line">{profile.education ?? "No education provided"}</p>
        </div>
      </section>

      <div className="flex gap-3">
        <button
          onClick={() => router.push("/profile")}
          className="bg-gray-200 px-4 py-2 rounded"
        >
          Edit
        </button>
        <button onClick={downloadHtml} className="bg-blue-600 text-white px-4 py-2 rounded">
          Download HTML
        </button>
      </div>
    </main>
    </>
  );
}