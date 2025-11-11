// src/app/dashboard/page.tsx
"use client";
import { useEffect, useState } from "react";

type Job = {
  id: string;
  title: string;
  company: string;
  location?: string;
  description?: string;
  source: string;
  url?: string;
  status: string;
  cvId?: string | null;
  createdAt: string;
};

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [jobPendingRemoval, setJobPendingRemoval] = useState<Job | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    fetchJobs();
  }, []);

  async function fetchJobs() {
    setLoading(true);
    try {
      const r = await fetch("/api/jobs");
      const data = await r.json();
      setJobs(data ?? []);
    } catch (err) {
      console.error(err);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }

  async function generateCv(jobId: string) {
    try {
      const r = await fetch("/api/generate-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const j = await r.json();
      if (j.cvId) {
        alert("CV gerado");
        fetchJobs();
      } else {
        alert("Erro gerando CV");
      }
    } catch (err) {
      console.error("generateCv error", err);
      alert("Erro gerando CV");
    }
  }

  async function downloadCv(cvId?: string | null) {
    if (!cvId) return alert("Nenhum CV disponível");
    window.open(`/api/cv/${cvId}`, "_blank");
  }

  async function updateStatus(jobId: string, status: string) {
    try {
      await fetch("/api/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: jobId, patch: { status } }),
      });
      fetchJobs();
    } catch (err) {
      console.error("updateStatus error", err);
    }
  }

  function promptRemoval(job: Job) {
    setJobPendingRemoval(job);
  }

  function cancelRemoval() {
    setJobPendingRemoval(null);
    setRemoving(false);
  }

  async function removeJob(jobId: string) {
    setRemoving(true);
    try {
      await fetch("/api/jobs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: jobId }),
      });
      setJobs((prev) => prev.filter((job) => job.id !== jobId));
      cancelRemoval();
    } catch (err) {
      console.error("removeJob error", err);
      setRemoving(false);
    }
  }

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">cv-sender — Dashboard</h1>

      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-2">Jobs</h2>
        {loading ? <div>Loading...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">Title</th>
                  <th className="p-2">Company</th>
                  <th className="p-2">Location</th>
                  <th className="p-2">Source</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">CV</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.id} className="border-t">
                    <td className="p-2">{job.title}</td>
                    <td className="p-2">{job.company}</td>
                    <td className="p-2">{job.location ?? "-"}</td>
                    <td className="p-2">{job.source}</td>
                    <td className="p-2">{job.status}</td>
                    <td className="p-2">
                      {job.cvId ? (
                        <button onClick={() => downloadCv(job.cvId)} className="text-blue-600 underline">Download CV</button>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2 flex-nowrap">
                        <button onClick={() => generateCv(job.id)} className="px-2 py-1 bg-green-600 text-white rounded">Gen CV</button>
                        <button onClick={() => updateStatus(job.id, "sent")} className="px-2 py-1 bg-blue-600 text-white rounded">Mark Sent</button>
                        <button onClick={() => promptRemoval(job)} className="px-2 py-1 border rounded">Reject</button>
                        <a href={job.url} target="_blank" rel="noreferrer" className="px-2 py-1 border rounded">Open</a>
                      </div>
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr><td colSpan={6} className="p-4 text-gray-500">No jobs yet. Run a scraper.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {jobPendingRemoval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={cancelRemoval} />
          <div className="relative bg-white rounded shadow-lg max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-semibold mb-3">Confirmar exclusão</h2>
            <p className="text-sm text-gray-600">
              Tem certeza que deseja remover a vaga{" "}
              <span className="font-semibold">{jobPendingRemoval.title}</span> da empresa{" "}
              <span className="font-semibold">{jobPendingRemoval.company}</span>? Esta ação não poderá ser desfeita.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={cancelRemoval}
                className="px-4 py-2 border rounded"
                disabled={removing}
              >
                Cancelar
              </button>
              <button
                onClick={() => removeJob(jobPendingRemoval.id)}
                className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-60"
                disabled={removing}
              >
                {removing ? "Removendo..." : "Remover"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
