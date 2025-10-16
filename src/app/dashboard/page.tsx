// "use client";
// import { useEffect, useState } from "react";

// type Job = {
//   id: string;
//   title: string;
//   company: string;
//   description?: string;
//   source: string;
//   url?: string;
//   status: string;
//   cvId?: string | null;
//   createdAt: string;
// };

// export default function DashboardPage() {
//   const [titles, setTitles] = useState("");
//   const [skills, setSkills] = useState("");
//   const [jobs, setJobs] = useState<Job[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [scraping, setScraping] = useState(false);

//   useEffect(() => {
//     fetchJobs();
//     fetchKeywords();
//   }, []);

//   async function fetchJobs() {
//     setLoading(true);
//     try {
//       const r = await fetch("/api/jobs");
//       const data = await r.json();
//       setJobs(data ?? []);
//     } catch (err) {
//       console.error(err);
//       setJobs([]);
//     } finally {
//       setLoading(false);
//     }
//   }

//   async function fetchKeywords() {
//     try {
//       const r = await fetch("/api/keywords");
//       const j = await r.json();
//       setTitles((j.titles ?? []).join(", "));
//       setSkills((j.skills ?? []).join(", "));
//     } catch (err) {
//       console.error("fetchKeywords error", err);
//     }
//   }

//   async function saveKeywords(e: React.FormEvent) {
//     e.preventDefault();
//     const t = titles.split(",").map((s) => s.trim()).filter(Boolean);
//     const s = skills.split(",").map((s) => s.trim()).filter(Boolean);
//     await fetch("/api/keywords", {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ titles: t, skills: s }),
//     });
//     alert("Keywords salvas");
//   }

//   async function triggerScrape(portal: string) {
//     setScraping(true);
//     try {
//       await fetch(`/api/scrape/${portal}`, { method: "POST" });
//       await fetchJobs();
//     } catch (err) {
//       console.error("triggerScrape error", err);
//       alert("Erro ao rodar scraper");
//     } finally {
//       setScraping(false);
//     }
//   }

//   async function generateCv(jobId: string) {
//     try {
//       const r = await fetch("/api/generate-cv", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ jobId }),
//       });
//       const j = await r.json();
//       if (j.cvId) {
//         alert("CV gerado");
//         fetchJobs();
//       } else {
//         alert("Erro gerando CV");
//       }
//     } catch (err) {
//       console.error("generateCv error", err);
//       alert("Erro gerando CV");
//     }
//   }

//   async function downloadCv(cvId?: string | null) {
//     if (!cvId) return alert("Nenhum CV disponível");
//     window.open(`/api/cv/${cvId}`, "_blank");
//   }

//   async function updateStatus(jobId: string, status: string) {
//     try {
//       await fetch("/api/jobs", {
//         method: "PATCH",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ id: jobId, patch: { status } }),
//       });
//       fetchJobs();
//     } catch (err) {
//       console.error("updateStatus error", err);
//     }
//   }

//   return (
//     <>
//     <main className="p-6 max-w-5xl mx-auto">
//       <h1 className="text-3xl font-bold mb-4">cv-sender — Dashboard</h1>

//       <section className="mb-6 bg-white p-4 rounded shadow">
//         <h2 className="text-xl font-semibold mb-2">Keywords (titles, skills)</h2>
//         <form onSubmit={saveKeywords} className="space-y-2">
//           <div>
//             <label className="block text-sm font-medium">Position titles (comma separated)</label>
//             <input
//               value={titles}
//               onChange={(e) => setTitles(e.target.value)}
//               className="w-full border rounded p-2"
//               placeholder="QA Automation, Backend Engineer"
//             />
//           </div>
//           <div>
//             <label className="block text-sm font-medium">Skills (comma separated)</label>
//             <input
//               value={skills}
//               onChange={(e) => setSkills(e.target.value)}
//               className="w-full border rounded p-2"
//               placeholder="Selenium, Cypress, Python"
//             />
//           </div>
//           <div className="flex gap-2">
//             <button className="px-4 py-2 bg-blue-600 text-white rounded">Save Keywords</button>
//             <button
//               type="button"
//               onClick={() => {
//                 setTitles("");
//                 setSkills("");
//               }}
//               className="px-4 py-2 border rounded"
//             >
//               Clear
//             </button>
//           </div>
//         </form>
//       </section>

//       <section className="mb-6 bg-white p-4 rounded shadow">
//         <h2 className="text-xl font-semibold mb-2">Run scrapers</h2>
//         <div className="flex gap-2">
//           <button onClick={() => triggerScrape("linkedin")} disabled={scraping} className="px-4 py-2 bg-gray-800 text-white rounded">Run LinkedIn</button>
//           <button onClick={() => triggerScrape("alljobs")} disabled={scraping} className="px-4 py-2 bg-gray-700 text-white rounded">Run AllJobs</button>
//           <button onClick={() => triggerScrape("jobnet")} disabled={scraping} className="px-4 py-2 bg-gray-700 text-white rounded">Run Jobnet</button>
//           <button onClick={() => triggerScrape("drushim")} disabled={scraping} className="px-4 py-2 bg-gray-700 text-white rounded">Run Drushim</button>
//         </div>
//         <p className="text-sm text-gray-500 mt-2">Each button triggers the site-specific automation (POC mock). Later we replace with real scrapers.</p>
//       </section>

//       <section className="bg-white p-4 rounded shadow">
//         <h2 className="text-xl font-semibold mb-2">Jobs</h2>
//         {loading ? <div>Loading...</div> : (
//           <div className="overflow-x-auto">
//             <table className="w-full text-sm">
//               <thead>
//                 <tr className="text-left">
//                   <th className="p-2">Title</th>
//                   <th className="p-2">Company</th>
//                   <th className="p-2">Source</th>
//                   <th className="p-2">Status</th>
//                   <th className="p-2">CV</th>
//                   <th className="p-2">Actions</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {jobs.map((job) => (
//                   <tr key={job.id} className="border-t">
//                     <td className="p-2">{job.title}</td>
//                     <td className="p-2">{job.company}</td>
//                     <td className="p-2">{job.source}</td>
//                     <td className="p-2">{job.status}</td>
//                     <td className="p-2">
//                       {job.cvId ? (
//                         <button onClick={() => downloadCv(job.cvId)} className="text-blue-600 underline">Download CV</button>
//                       ) : (
//                         <span className="text-gray-500">—</span>
//                       )}
//                     </td>
//                     <td className="p-2 space-x-2">
//                       <button onClick={() => generateCv(job.id)} className="px-2 py-1 bg-green-600 text-white rounded">Gen CV</button>
//                       <button onClick={() => updateStatus(job.id, "sent")} className="px-2 py-1 bg-blue-600 text-white rounded">Mark Sent</button>
//                       <button onClick={() => updateStatus(job.id, "rejected")} className="px-2 py-1 border rounded">Reject</button>
//                       <a href={job.url} target="_blank" rel="noreferrer" className="px-2 py-1 border rounded">Open</a>
//                     </td>
//                   </tr>
//                 ))}
//                 {jobs.length === 0 && (
//                   <tr><td colSpan={6} className="p-4 text-gray-500">No jobs yet. Run a scraper.</td></tr>
//                 )}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </section>
//     </main>
//     </>
//   );
// }

// src/app/dashboard/page.tsx
"use client";
import { useEffect, useState } from "react";

type Job = {
  id: string;
  title: string;
  company: string;
  description?: string;
  source: string;
  url?: string;
  status: string;
  cvId?: string | null;
  createdAt: string;
};

export default function DashboardPage() {
  const [titles, setTitles] = useState("");
  const [skills, setSkills] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);

  useEffect(() => {
    fetchJobs();
    fetchKeywords();
  }, []);

  async function fetchJobs() {
    setLoading(true);
    const r = await fetch("/api/jobs");
    const data = await r.json();
    setJobs(data ?? []);
    setLoading(false);
  }

  async function fetchKeywords() {
    const r = await fetch("/api/keywords");
    const j = await r.json();
    setTitles((j.titles ?? []).join(", "));
    setSkills((j.skills ?? []).join(", "));
  }

  async function saveKeywords(e: React.FormEvent) {
    e.preventDefault();
    const t = titles.split(",").map(s => s.trim()).filter(Boolean);
    const s = skills.split(",").map(s => s.trim()).filter(Boolean);
    await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titles: t, skills: s }),
    });
    alert("Keywords salvas");
  }

  async function triggerScrape(portal: string) {
    setScraping(true);
    await fetch(`/api/scrape/${portal}`, { method: "POST" });
    await fetchJobs();
    setScraping(false);
  }

  async function generateCv(jobId: string) {
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
  }

  async function downloadCv(cvId?: string | null) {
    if (!cvId) return alert("Nenhum CV disponível");
    window.open(`/api/cv/${cvId}`, "_blank");
  }

  async function updateStatus(jobId: string, status: string) {
    await fetch("/api/jobs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: jobId, patch: { status } }),
    });
    fetchJobs();
  }

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">cv-sender — Dashboard</h1>

      <section className="mb-6 bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-2">Keywords (titles, skills)</h2>
        <form onSubmit={saveKeywords} className="space-y-2">
          <div>
            <label className="block text-sm font-medium">Position titles (comma separated)</label>
            <input value={titles} onChange={(e) => setTitles(e.target.value)} className="w-full border rounded p-2" placeholder="QA Automation, Backend Engineer" />
          </div>
          <div>
            <label className="block text-sm font-medium">Skills (comma separated)</label>
            <input value={skills} onChange={(e) => setSkills(e.target.value)} className="w-full border rounded p-2" placeholder="Selenium, Cypress, Python" />
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 bg-blue-600 text-white rounded">Save Keywords</button>
            <button type="button" onClick={() => { setTitles(""); setSkills(""); }} className="px-4 py-2 border rounded">Clear</button>
          </div>
        </form>
      </section>

      <section className="mb-6 bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-2">Run scrapers</h2>
        <div className="flex gap-2">
          <button onClick={() => triggerScrape("linkedin")} disabled={scraping} className="px-4 py-2 bg-gray-800 text-white rounded">Run LinkedIn</button>
          <button onClick={() => triggerScrape("alljobs")} disabled={scraping} className="px-4 py-2 bg-gray-700 text-white rounded">Run AllJobs</button>
          <button onClick={() => triggerScrape("jobnet")} disabled={scraping} className="px-4 py-2 bg-gray-700 text-white rounded">Run Jobnet</button>
          <button onClick={() => triggerScrape("drushim")} disabled={scraping} className="px-4 py-2 bg-gray-700 text-white rounded">Run Drushim</button>
        </div>
        <p className="text-sm text-gray-500 mt-2">Each button triggers the site-specific automation (POC mock). Later we replace with real scrapers.</p>
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-2">Jobs</h2>
        {loading ? <div>Loading...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">Title</th>
                  <th className="p-2">Company</th>
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
                    <td className="p-2">{job.source}</td>
                    <td className="p-2">{job.status}</td>
                    <td className="p-2">
                      {job.cvId ? (
                        <button onClick={() => downloadCv(job.cvId)} className="text-blue-600 underline">Download CV</button>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="p-2 space-x-2">
                      <button onClick={() => generateCv(job.id)} className="px-2 py-1 bg-green-600 text-white rounded">Gen CV</button>
                      <button onClick={() => updateStatus(job.id, "sent")} className="px-2 py-1 bg-blue-600 text-white rounded">Mark Sent</button>
                      <button onClick={() => updateStatus(job.id, "rejected")} className="px-2 py-1 border rounded">Reject</button>
                      <a href={job.url} target="_blank" rel="noreferrer" className="px-2 py-1 border rounded">Open</a>
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
    </main>
  );
}
