"use client";
import { useEffect, useState } from "react";

type Job = {
  index?: number;
  url?: string;
  title?: string | null;
  company?: string | null;
  location?: string | null;
  datePosted?: string | null;
  about_raw?: string;
  error?: string;
  about_company?: string;
  about_summary?: string;
  about_responsibilities?: string;
  about_requirements?: string;
};

export default function LinkedinResultsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selected, setSelected] = useState<Job | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const r = await fetch("/api/linkedin-results");
      const j = await r.json();
      if (j.ok && Array.isArray(j.data)) {
        setJobs(j.data);
        setFileName(j.file || null);
      } else {
        setJobs([]);
      }
    } catch (err) {
      console.error(err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">LinkedIn Scrape Results</h1>
      <p className="text-sm text-gray-600 mb-4">Source file: {fileName ?? "-"}</p>

      {loading ? (
        <div>Loading...</div>
      ) : jobs.length === 0 ? (
        <div className="text-gray-500">No results found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-gray-100 text-left">
                <th className="p-2 border">#</th>
                <th className="p-2 border">Title</th>
                <th className="p-2 border">Company</th>
                <th className="p-2 border">Location</th>
                <th className="p-2 border">Date Posted</th>
                <th className="p-2 border">URL</th>
                <th className="p-2 border">Company (snippet)</th>
                <th className="p-2 border">Summary (snippet)</th>
                <th className="p-2 border">Requirements (snippet)</th>
                <th className="p-2 border">Error</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, idx) => (
                <tr
                  key={idx}
                  className="border-t align-top hover:bg-gray-50 cursor-pointer"
                  onClick={() => {
                    setSelected(job);
                    setIsOpen(true);
                  }}
                >
                  <td className="p-2 border align-top">{job.index ?? idx + 1}</td>
                  <td className="p-2 border align-top">{job.title ?? "-"}</td>
                  <td className="p-2 border align-top">{job.company ?? "-"}</td>
                  <td className="p-2 border align-top">{job.location ?? "-"}</td>
                  <td className="p-2 border align-top">{job.datePosted ?? "-"}</td>
                  <td className="p-2 border align-top">
                    {job.url ? (
                      <a
                        onClick={(e) => e.stopPropagation()}
                        href={job.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline"
                      >
                        Open
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="p-2 border align-top whitespace-pre-line max-w-xl">
                    {job.about_company ? job.about_company.slice(0, 120) + (job.about_company.length > 120 ? "..." : "") : (job.about_raw ? job.about_raw.slice(0, 120) + (job.about_raw.length > 120 ? "..." : "") : "-")}
                  </td>
                  <td className="p-2 border align-top whitespace-pre-line max-w-xl">
                    {job.about_summary ? job.about_summary.slice(0, 120) + (job.about_summary.length > 120 ? "..." : "") : "-"}
                  </td>
                  <td className="p-2 border align-top whitespace-pre-line max-w-xl">
                    {job.about_requirements ? job.about_requirements.slice(0, 120) + (job.about_requirements.length > 120 ? "..." : "") : "-"}
                  </td>
                  <td className="p-2 border align-top text-red-600">{job.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isOpen && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsOpen(false)} />
          <div className="relative bg-white rounded shadow-lg max-w-3xl w-full mx-4 p-6 overflow-auto max-h-[80vh]">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-semibold">Job details</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-600 hover:text-gray-900 ml-4"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-4">
              <p className="font-medium">Title: {selected.title ?? "-"}</p>
              <p className="text-sm text-gray-600">Company: {selected.company ?? "-"} — {selected.location ?? "-"}</p>
              <p className="text-sm text-gray-500">Posted: {selected.datePosted ?? "-"}</p>

              <section className="mt-4">
                <h3 className="font-semibold">Company</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{selected.about_company || "(no company description)"}</p>
              </section>

              <section className="mt-4">
                <h3 className="font-semibold">Summary</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{selected.about_summary || "(no summary)"}</p>
              </section>

              <section className="mt-4">
                <h3 className="font-semibold">Responsibilities</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{selected.about_responsibilities || "(no responsibilities)"}</p>
              </section>

              <section className="mt-4">
                <h3 className="font-semibold">Requirements</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{selected.about_requirements || "(no requirements)"}</p>
              </section>

              {selected.error && <p className="text-red-600 mt-4">Error: {selected.error}</p>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
