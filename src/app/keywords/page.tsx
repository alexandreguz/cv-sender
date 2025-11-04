"use client";
import { useEffect, useState } from "react";

export default function KeywordsPage() {
  const [titles, setTitles] = useState("");
  const [skills, setSkills] = useState("");
  const [location, setLocation] = useState("");

  useEffect(() => {
    fetchKeywords();
  }, []);

  async function fetchKeywords() {
    try {
      const response = await fetch("/api/keywords");
      const data = await response.json();
      if (data?.data) {
        setTitles((data.data.titles ?? []).join(", "));
        setSkills((data.data.skills ?? []).join(", "));
        setLocation(data.data.location ?? "");
      }
    } catch (err) {
      console.error("fetchKeywords error", err);
    }
  }

  async function saveKeywords(e: React.FormEvent) {
    e.preventDefault();
    const t = titles.split(",").map(s => s.trim()).filter(Boolean);
    const s = skills.split(",").map(s => s.trim()).filter(Boolean);
    await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titles: t, skills: s, location }),
    });
    console.log("Keywords saved:", { titles: t, skills: s, location });
    alert("Keywords salvas");
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Keywords</h1>

      <section className="mb-6 bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-2">Titles, Skills & Location</h2>
        <form onSubmit={saveKeywords} className="space-y-2">
          <div>
            <label className="block text-sm font-medium">Position titles (comma separated)</label>
            <input value={titles} onChange={(e) => setTitles(e.target.value)} className="w-full border rounded p-2" placeholder="QA Automation, Backend Engineer" />
          </div>
          <div>
            <label className="block text-sm font-medium">Skills (comma separated)</label>
            <input value={skills} onChange={(e) => setSkills(e.target.value)} className="w-full border rounded p-2" placeholder="Selenium, Cypress, Python" />
          </div>
          <div>
            <label className="block text-sm font-medium">Location (opcional)</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full border rounded p-2" placeholder="Israel, Remote, Brazil" />
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-blue-600 text-white rounded">Save Keywords</button>
            <button type="button" onClick={() => { setTitles(""); setSkills(""); setLocation(""); }} className="px-4 py-2 border rounded">Clear</button>
          </div>
        </form>
      </section>
    </main>
  );
}
