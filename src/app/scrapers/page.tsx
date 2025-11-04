"use client";
import { useState, useEffect } from "react";
import LinkedinSearchForm from "../../components/LinkedinSearchForm";

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

export default function ScrapersPage() {
  const [selectedPortal, setSelectedPortal] = useState<string | null>(null);
  const [scraping, setScraping] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [lastScrapedAt, setLastScrapedAt] = useState<string | null>(null);
  const [selected, setSelected] = useState<Job | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (selectedPortal === "linkedin") {
      fetchLinkedInResults();
    }
  }, [selectedPortal]);

  async function fetchLinkedInResults() {
    try {
      const r = await fetch("/api/linkedin-results");
      const j = await r.json();
      if (j.ok && Array.isArray(j.data)) {
        // Filter out jobs with timeout errors or incomplete data
        const filteredJobs = j.data.filter((job: Job) => {
          // Remove jobs with timeout errors
          if (job.error?.includes("Timeout") || job.error?.includes("timeout")) {
            return false;
          }
          // Remove jobs without essential data
          if (!job.title || !job.company || !job.url) {
            return false;
          }
          // Remove jobs without any description content
          if (!job.about_raw && !job.about_company && !job.about_summary && 
              !job.about_responsibilities && !job.about_requirements) {
            return false;
          }
          return true;
        });
        
        setJobs(filteredJobs);
        setFileName(j.file || null);
        // Extract date from filename, it usually has a timestamp
        if (j.file) {
          const match = j.file.match(/(\d{4}-\d{2}-\d{2}|\d{13})/);
          if (match) {
            const timestamp = match[1];
            const date = timestamp.length > 8 
              ? new Date(parseInt(timestamp))
              : new Date(timestamp);
            setLastScrapedAt(date.toLocaleString());
          }
        }
      } else {
        setJobs([]);
        setFileName(null);
      }
    } catch (err) {
      console.error(err);
      setJobs([]);
      setFileName(null);
    }
  }

  async function addToDashboard(job: Job) {
    try {
      const rawReq = job.about_requirements || job.about_responsibilities || job.about_summary || job.about_raw || "";
      const lines = rawReq
        .split(/\r?\n|\u2022|\u2023|\-|\*|•/)
        .map(s => s.replace(/[\t\u00A0]/g, "").trim())
        .filter(Boolean);

      const skills = Array.from(new Set(lines)).join(", ");

      const payload = {
        title: job.title ?? "",
        company: job.company ?? "",
        source: "linkedin",
        url: job.url ?? "",
        status: "new",
        skills,
      };

      const r = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        throw new Error(`POST /api/jobs failed: ${r.status} ${r.statusText} ${txt}`);
      }
      
      const created = await r.json().catch(() => null);
      const createdJob = Array.isArray(created) ? created[0] : created;
      
      if (createdJob && createdJob.id) {
        const g = await fetch("/api/generate-cv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId: createdJob.id }),
        });
        const gj = await g.json();
        if (gj.cvId) {
          alert("Job adicionado e CV gerado");
        } else {
          alert("Job adicionado, mas erro ao gerar CV");
        }
      } else {
        alert("Erro ao criar job no dashboard");
      }
    } catch (err) {
      console.error("addToDashboard error", err);
      alert("Erro ao adicionar ao dashboard");
    }
  }

  return (
    <main className="p-6 max-w-full mx-auto">
      <h1 className="text-2xl font-bold mb-4">Scrapers</h1>

      <section className="mb-6 bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-2">Portais de Vagas</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedPortal(selectedPortal === "linkedin" ? null : "linkedin")}
            className={`px-4 py-2 ${selectedPortal === "linkedin" ? "bg-blue-600" : "bg-gray-800"} text-white rounded transition-colors hover:bg-gray-900 cursor-pointer`}
          >LinkedIn</button>
          <button
            onClick={() => setSelectedPortal(selectedPortal === "alljobs" ? null : "alljobs")}
            className={`px-4 py-2 ${selectedPortal === "alljobs" ? "bg-blue-600" : "bg-gray-700"} text-white rounded transition-colors hover:bg-gray-800 cursor-pointer`}
          >AllJobs</button>
          <button
            onClick={() => setSelectedPortal(selectedPortal === "jobnet" ? null : "jobnet")}
            className={`px-4 py-2 ${selectedPortal === "jobnet" ? "bg-blue-600" : "bg-gray-700"} text-white rounded transition-colors hover:bg-gray-800 cursor-pointer`}
          >Jobnet</button>
          <button
            onClick={() => setSelectedPortal(selectedPortal === "drushim" ? null : "drushim")}
            className={`px-4 py-2 ${selectedPortal === "drushim" ? "bg-blue-600" : "bg-gray-700"} text-white rounded transition-colors hover:bg-gray-800 cursor-pointer`}
          >Drushim</button>
        </div>
        <p className="text-sm text-gray-500 mt-2">Selecione um portal para começar a busca.</p>
      </section>

      {selectedPortal === "linkedin" && (
        <>
          <section className="mb-6">
            <LinkedinSearchForm />
          </section>

          <section className="mb-6">
            {lastScrapedAt && (
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">Última atualização:</span> {lastScrapedAt}
                  </p>
                </div>
              </div>
            )}
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
                    <th className="p-2 border">Actions</th>
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
                      <td className="p-2 border align-top">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            await addToDashboard(job);
                          }}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                        >
                          Adicionar ao dashboard
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {selectedPortal && selectedPortal !== "linkedin" && (
        <section className="mb-6 bg-white p-4 rounded shadow">
          <p className="text-gray-600">Formulário de busca para {selectedPortal} será implementado em breve.</p>
        </section>
      )}

      {/* Job Details Modal */}
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
