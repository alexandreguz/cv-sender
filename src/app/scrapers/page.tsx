"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Plus,
  LayoutDashboard,
  Briefcase,
  MapPin,
  Calendar,
  X,
  Loader2,
  Trash2,
  Eye,
} from "lucide-react";
import { ALLJOBS_CITIES } from "@/lib/server/alljobs-cities";
import { DRUSHIM_CITIES } from "@/lib/server/drushim-cities";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ScrapedJob = {
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

type SessionMeta = {
  titles?: string[];
  location?: string;
};

type Session = {
  file: string;
  portal: "linkedin" | "alljobs" | "drushim";
  jobs: ScrapedJob[];
  meta: SessionMeta | null;
  searchedAt: string | null;
  showing: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse raw requirements text into a list of skill tokens (one per bullet line). */
function parseSkills(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/\r?\n|[•\u2022\u2023]/)
        .map((s) => s.replace(/^[\s\-*\t\u00A0]+|[\s\-*\t\u00A0]+$/g, "").trim())
        .filter((s) => s.length > 1 && s.length < 80)
    )
  );
}

/** Filter out scraper error / empty rows. */
function filterJobs(jobs: unknown[]): ScrapedJob[] {
  return (jobs as ScrapedJob[]).filter(
    (j) =>
      j.title &&
      j.company &&
      j.url &&
      !j.error?.toLowerCase().includes("timeout") &&
      (j.about_raw || j.about_company || j.about_summary || j.about_requirements)
  );
}

// ---------------------------------------------------------------------------
// Portal branding helpers
// ---------------------------------------------------------------------------

const PORTAL_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  alljobs: "AllJobs",
  drushim: "Drushim",
};

const PORTAL_BADGE_CLASSES: Record<string, string> = {
  linkedin: "bg-blue-100 text-blue-700",
  alljobs: "bg-orange-100 text-orange-700",
  drushim: "bg-green-100 text-green-700",
};

// ---------------------------------------------------------------------------
// JobDetailModal — shows all scraped fields for a single job
// ---------------------------------------------------------------------------

function JobDetailModal({ job, onClose }: { job: ScrapedJob; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{job.title ?? "Job Details"}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {job.company ?? ""}{job.location ? ` — ${job.location}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors ml-4 flex-shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-4 text-xs text-gray-400 mb-5 flex-wrap">
          {job.datePosted && <span>Posted: {job.datePosted}</span>}
          {job.url && (
            <a href={job.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
              Open listing ↗
            </a>
          )}
        </div>

        {[
          { label: "About the Company", content: job.about_company },
          { label: "Summary", content: job.about_summary },
          { label: "Responsibilities", content: job.about_responsibilities },
          { label: "Requirements", content: job.about_requirements },
          { label: "Raw Description", content: job.about_raw },
        ]
          .filter((s) => s.content)
          .map((s) => (
            <section key={s.label} className="mb-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">{s.label}</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{s.content}</p>
            </section>
          ))}

        {job.error && <p className="text-sm text-red-500 mt-2">Error: {job.error}</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AddSkillsModal — create a CvProfile from a job's requirements
// ---------------------------------------------------------------------------

type AddSkillsModalProps = {
  job: ScrapedJob;
  onClose: () => void;
  onSaved: () => void;
};

function AddSkillsModal({ job, onClose, onSaved }: AddSkillsModalProps) {
  const [title, setTitle] = useState(job.title ?? "");
  const [company, setCompany] = useState(job.company ?? "");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>(() =>
    parseSkills(job.about_requirements ?? job.about_responsibilities ?? job.about_summary ?? "")
  );
  const [platforms, setPlatforms] = useState<string[]>(["linkedin"]);
  const [saving, setSaving] = useState(false);

  function handleSkillKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const v = skillInput.trim().replace(/,$/, "");
      if (v && !skills.includes(v)) setSkills((prev) => [...prev, v]);
      setSkillInput("");
    }
  }

  function removeSkill(s: string) {
    setSkills((prev) => prev.filter((x) => x !== s));
  }

  function togglePlatform(p: string) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function saveProfile() {
    if (!title.trim()) { toast.error("Job title is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/cv-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          company: company.trim() || undefined,
          url: job.url ?? undefined,
          skills,
          search_keywords: [title.trim()],
          platforms,
          is_active: true,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("CV Profile created");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(`Failed to save: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Add Requirements to CV Profile</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X size={20} />
          </button>
        </div>

        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-700">Job Title *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. QA Automation Engineer" />
        </label>

        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-700">Company</span>
          <input value={company} onChange={(e) => setCompany(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Acme Corp" />
        </label>

        <div className="mb-3">
          <span className="text-sm font-medium text-gray-700">Skills</span>
          <div className="mt-1 flex flex-wrap gap-1 min-h-[40px] border border-gray-300 rounded-lg px-3 py-2">
            {skills.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full">
                {s}
                <button onClick={() => removeSkill(s)} className="text-blue-500 hover:text-blue-800"><X size={10} /></button>
              </span>
            ))}
            <input value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyDown={handleSkillKey}
              placeholder={skills.length === 0 ? "Type a skill and press Enter…" : ""}
              className="flex-1 min-w-[120px] text-sm outline-none" />
          </div>
          <p className="text-xs text-gray-400 mt-1">Press Enter or comma to add a skill tag.</p>
        </div>

        <div className="mb-5">
          <span className="text-sm font-medium text-gray-700">Platforms</span>
          <div className="mt-1 flex gap-2">
            {(["linkedin", "alljobs", "jobmaster"] as const).map((p) => (
              <button key={p} onClick={() => togglePlatform(p)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  platforms.includes(p)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                }`}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
          <button onClick={saveProfile} disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Save Profile
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeleteConfirmModal
// ---------------------------------------------------------------------------

function DeleteConfirmModal({
  onConfirm,
  onCancel,
  deleting,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-2">Delete this search session?</h2>
        <p className="text-sm text-gray-500 mb-5">
          All job listings from this session will be permanently removed. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={deleting}
            className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center gap-1">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Portal icons
// ---------------------------------------------------------------------------

function LinkedinIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

/** AllJobs logo approximation — briefcase icon. */
function AllJobsIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** Drushim logo approximation — magnifying glass icon. */
function DrushimIcon({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ScrapersPage() {
  // LinkedIn search form state
  const [showLinkedInForm, setShowLinkedInForm] = useState(false);
  const [liJobTitle, setLiJobTitle] = useState("");
  const [liCountry, setLiCountry] = useState("");
  const [liCity, setLiCity] = useState("");
  const [liScraping, setLiScraping] = useState(false);

  // AllJobs search form state
  const [showAllJobsForm, setShowAllJobsForm] = useState(false);
  const [ajJobTitle, setAjJobTitle] = useState("");
  const [ajCityId, setAjCityId] = useState("");
  const [ajCityLabel, setAjCityLabel] = useState("All Israel");
  const [ajScraping, setAjScraping] = useState(false);

  // Drushim search form state
  const [showDrushimForm, setShowDrushimForm] = useState(false);
  const [drJobTitle, setDrJobTitle] = useState("");
  const [drCityIdx, setDrCityIdx] = useState(0); // index into DRUSHIM_CITIES
  const [drScraping, setDrScraping] = useState(false);

  // All saved sessions (all portals merged, sorted newest first)
  const [sessions, setSessions] = useState<Session[]>([]);

  // Modal state
  const [detailJob, setDetailJob] = useState<ScrapedJob | null>(null);
  const [modalJob, setModalJob] = useState<ScrapedJob | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ file: string; portal: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Adding-to-dashboard loading state per job url
  const [addingJob, setAddingJob] = useState<string | null>(null);

  /** Fetch sessions from all portals and merge, newest first. */
  const loadSessions = useCallback(async () => {
    try {
      const [liRes, ajRes, drRes] = await Promise.allSettled([
        fetch("/api/scrape/results?portal=linkedin").then((r) => r.json()),
        fetch("/api/scrape/results?portal=alljobs").then((r) => r.json()),
        fetch("/api/scrape/results?portal=drushim").then((r) => r.json()),
      ]);

      const toSessions = (
        result: PromiseSettledResult<{ ok: boolean; sessions?: unknown[] }>,
        portal: Session["portal"]
      ): Session[] => {
        if (result.status !== "fulfilled" || !result.value.ok) return [];
        return (result.value.sessions ?? []).map((raw: unknown) => {
          const s = raw as Omit<Session, "jobs" | "showing" | "portal"> & { jobs: unknown[] };
          return { ...s, portal, jobs: filterJobs(s.jobs), showing: false };
        });
      };

      const merged = [
        ...toSessions(liRes, "linkedin"),
        ...toSessions(ajRes, "alljobs"),
        ...toSessions(drRes, "drushim"),
      ].sort((a, b) => {
        const ta = a.searchedAt ?? a.file;
        const tb = b.searchedAt ?? b.file;
        return ta > tb ? -1 : 1;
      });

      setSessions(merged);
    } catch {
      // No results yet — that's fine
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  /** Run the LinkedIn scraper. */
  async function handleLinkedInSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!liJobTitle.trim() || !liCountry.trim()) {
      toast.error("Job title and country are required");
      return;
    }
    setLiScraping(true);
    try {
      const res = await fetch("/api/scrape/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: [liJobTitle.trim()],
          country: liCountry.trim(),
          city: liCity.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Scraping failed");
      const count = filterJobs(Array.isArray(data.results) ? data.results : []).length;
      toast.success(`Found ${count} job listings`);
      setShowLinkedInForm(false);
      await loadSessions();
    } catch (err) {
      toast.error(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLiScraping(false);
    }
  }

  /** Run the AllJobs scraper. */
  async function handleAllJobsSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!ajJobTitle.trim()) {
      toast.error("Job title is required");
      return;
    }
    setAjScraping(true);
    try {
      const res = await fetch("/api/scrape/alljobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: ajJobTitle.trim(),
          cityId: ajCityId,
          cityLabel: ajCityLabel,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Scraping failed");
      const count = filterJobs(Array.isArray(data.results) ? data.results : []).length;
      toast.success(`Found ${count} job listings`);
      setShowAllJobsForm(false);
      await loadSessions();
    } catch (err) {
      toast.error(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAjScraping(false);
    }
  }

  /** Toggle job table visibility for a session. */
  function toggleSession(file: string) {
    setSessions((prev) =>
      prev.map((s) => (s.file === file ? { ...s, showing: !s.showing } : s))
    );
  }

  /** Delete a session file after confirmation. */
  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/scrape/results?file=${encodeURIComponent(deleteTarget.file)}&portal=${deleteTarget.portal}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(await res.text());
      setSessions((prev) => prev.filter((s) => s.file !== deleteTarget.file));
      toast.success("Session deleted");
    } catch (err) {
      toast.error(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  /** Run the Drushim scraper. */
  async function handleDrushimSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!drJobTitle.trim()) { toast.error("Job title is required"); return; }
    const city = DRUSHIM_CITIES[drCityIdx];
    setDrScraping(true);
    try {
      const res = await fetch("/api/scrape/drushim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword: drJobTitle.trim(),
          cityLabel: city.label,
          areaPath: city.areaPath,
          geolexid: city.geolexid,
          range: city.range,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Scraping failed");
      const count = filterJobs(Array.isArray(data.results) ? data.results : []).length;
      toast.success(`Found ${count} job listings`);
      setShowDrushimForm(false);
      await loadSessions();
    } catch (err) {
      toast.error(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDrScraping(false);
    }
  }

  /** Add a scraped job directly to the dashboard. */
  async function addToDashboard(job: ScrapedJob) {
    const key = job.url ?? job.title ?? "";
    setAddingJob(key);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: job.title ?? "",
          company: job.company ?? "",
          source: job.url?.includes("drushim") ? "drushim" : job.url?.includes("linkedin") ? "linkedin" : "alljobs",
          url: job.url ?? "",
          location: job.location ?? "",
          status: "new",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Added to Dashboard");
    } catch (err) {
      toast.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAddingJob(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <main className="p-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Scrapers</h1>
        <div className="flex gap-2">
          {/* LinkedIn search button */}
          <button
            onClick={() => { setShowLinkedInForm((v) => !v); setShowAllJobsForm(false); setShowDrushimForm(false); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <LinkedinIcon size={16} />
            Search LinkedIn
            {showLinkedInForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {/* AllJobs search button */}
          <button
            onClick={() => { setShowAllJobsForm((v) => !v); setShowLinkedInForm(false); setShowDrushimForm(false); }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
          >
            <AllJobsIcon size={16} />
            Search AllJobs
            {showAllJobsForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {/* Drushim search button */}
          <button
            onClick={() => { setShowDrushimForm((v) => !v); setShowLinkedInForm(false); setShowAllJobsForm(false); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
          >
            <DrushimIcon size={16} />
            Search Drushim
            {showDrushimForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* LinkedIn inline search form */}
      {showLinkedInForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <LinkedinIcon size={16} className="text-blue-600" />
            LinkedIn Job Search
          </h2>
          <form onSubmit={handleLinkedInSearch} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Title <span className="text-red-500">*</span>
              </label>
              <input value={liJobTitle} onChange={(e) => setLiJobTitle(e.target.value)}
                placeholder="e.g. QA Automation Engineer" required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Country <span className="text-red-500">*</span>
              </label>
              <input value={liCountry} onChange={(e) => setLiCountry(e.target.value)}
                placeholder="e.g. Israel, Brazil" required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City / Area <span className="text-gray-400">(optional)</span>
              </label>
              <input value={liCity} onChange={(e) => setLiCity(e.target.value)}
                placeholder="e.g. Tel Aviv, Jerusalem"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <button type="submit" disabled={liScraping}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors">
                {liScraping ? <><Loader2 size={14} className="animate-spin" /> Searching…</> : <><Search size={14} /> Search</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* AllJobs inline search form */}
      {showAllJobsForm && (
        <div className="bg-white border border-orange-200 rounded-xl p-5 mb-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <AllJobsIcon size={16} className="text-orange-500" />
            AllJobs Job Search
          </h2>
          <form onSubmit={handleAllJobsSearch} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Title <span className="text-red-500">*</span>
              </label>
              <input value={ajJobTitle} onChange={(e) => setAjJobTitle(e.target.value)}
                placeholder="e.g. QA Automation Engineer" required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <select
                value={ajCityId}
                onChange={(e) => {
                  const opt = ALLJOBS_CITIES.find((c) => c.value === e.target.value);
                  setAjCityId(e.target.value);
                  setAjCityLabel(opt?.label ?? "All Israel");
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {ALLJOBS_CITIES.map((c) => (
                  <option key={`${c.label}-${c.value}`} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" disabled={ajScraping}
                className="flex items-center gap-2 px-5 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-60 transition-colors">
                {ajScraping ? <><Loader2 size={14} className="animate-spin" /> Searching…</> : <><Search size={14} /> Search</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Drushim inline search form */}
      {showDrushimForm && (
        <div className="bg-white border border-green-200 rounded-xl p-5 mb-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <DrushimIcon size={16} className="text-green-600" />
            Drushim Job Search
          </h2>
          <form onSubmit={handleDrushimSearch} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Job Title <span className="text-red-500">*</span>
              </label>
              <input value={drJobTitle} onChange={(e) => setDrJobTitle(e.target.value)}
                placeholder="e.g. QA Engineer" required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City <span className="text-red-500">*</span>
              </label>
              <select
                value={drCityIdx}
                onChange={(e) => setDrCityIdx(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {DRUSHIM_CITIES.map((c, idx) => (
                  <option key={`${c.label}-${idx}`} value={idx}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" disabled={drScraping}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors">
                {drScraping ? <><Loader2 size={14} className="animate-spin" /> Searching…</> : <><Search size={14} /> Search</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Session list */}
      {sessions.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
          No search sessions yet. Click &quot;Search LinkedIn&quot;, &quot;Search AllJobs&quot;, or &quot;Search Drushim&quot; to start.
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {sessions.map((session) => (
            <div key={session.file} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              {/* Session card header */}
              <div className="flex items-start justify-between p-5">
                <div className="flex gap-4">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    session.portal === "linkedin" ? "bg-blue-100" : session.portal === "drushim" ? "bg-green-100" : "bg-orange-100"
                  }`}>
                    {session.portal === "linkedin"
                      ? <LinkedinIcon size={18} className="text-blue-600" />
                      : session.portal === "drushim"
                      ? <DrushimIcon size={18} className="text-green-600" />
                      : <AllJobsIcon size={18} className="text-orange-500" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      {/* Portal badge */}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PORTAL_BADGE_CLASSES[session.portal] ?? "bg-gray-100 text-gray-600"}`}>
                        {PORTAL_LABELS[session.portal] ?? session.portal}
                      </span>
                      <p className="font-semibold text-gray-900 flex items-center gap-1 text-sm">
                        <Briefcase size={13} className="text-gray-500" />
                        {session.meta?.titles?.join(", ") ?? "Job Search"}
                      </p>
                    </div>
                    {session.meta?.location && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin size={12} />
                        {session.meta.location}
                      </p>
                    )}
                    {session.searchedAt && (
                      <p className="text-sm text-gray-400 flex items-center gap-1 mt-0.5">
                        <Calendar size={12} />
                        {session.searchedAt}
                      </p>
                    )}
                    <p className="text-sm text-gray-600 mt-1">
                      <span className="font-medium">{session.jobs.length}</span> results found
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDeleteTarget({ file: session.file, portal: session.portal })}
                    title="Delete this session"
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    onClick={() => toggleSession(session.file)}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    {session.showing
                      ? <><ChevronUp size={14} /> Hide</>
                      : <><ChevronDown size={14} /> View Listings</>}
                  </button>
                </div>
              </div>

              {/* Job listings table */}
              {session.showing && (
                <div className="border-t border-gray-100 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-8">#</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Title</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Company</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Location</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide max-w-xs">Requirements</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {session.jobs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-6 text-center text-gray-400 text-sm">No results found.</td>
                        </tr>
                      ) : (
                        session.jobs.map((job, idx) => {
                          const key = job.url ?? String(idx);
                          return (
                            <tr key={key} className="hover:bg-gray-50 align-top transition-colors">
                              <td className="px-3 py-3 text-gray-400">{job.index ?? idx + 1}</td>
                              <td className="px-3 py-3 font-medium text-gray-900">
                                {job.url
                                  ? <a href={job.url} target="_blank" rel="noreferrer" className="hover:text-blue-600 hover:underline">{job.title ?? "-"}</a>
                                  : job.title ?? "-"}
                              </td>
                              <td className="px-3 py-3 text-gray-600">{job.company ?? "-"}</td>
                              <td className="px-3 py-3 text-gray-500">{job.location ?? "-"}</td>
                              <td className="px-3 py-3 text-gray-400 whitespace-nowrap">{job.datePosted ?? "-"}</td>
                              <td className="px-3 py-3 text-gray-500 max-w-xs">
                                <p className="line-clamp-3 whitespace-pre-line text-xs leading-relaxed">
                                  {job.about_requirements
                                    ? job.about_requirements.slice(0, 200) + (job.about_requirements.length > 200 ? "…" : "")
                                    : "-"}
                                </p>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex flex-col gap-1.5 min-w-[140px]">
                                  <button onClick={() => setDetailJob(job)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                                    <Eye size={11} /> View Details
                                  </button>
                                  <button onClick={() => addToDashboard(job)} disabled={addingJob === key}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition-colors">
                                    {addingJob === key ? <Loader2 size={11} className="animate-spin" /> : <LayoutDashboard size={11} />}
                                    Add to Dashboard
                                  </button>
                                  <button onClick={() => setModalJob(job)}
                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                    <Plus size={11} /> Add Skills to CV
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Other portals placeholder */}
      <div className="bg-white border border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">
        Support for Jobmaster coming soon.
      </div>

      {/* Modals */}
      {detailJob && <JobDetailModal job={detailJob} onClose={() => setDetailJob(null)} />}
      {modalJob && <AddSkillsModal job={modalJob} onClose={() => setModalJob(null)} onSaved={() => setModalJob(null)} />}
      {deleteTarget && (
        <DeleteConfirmModal
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </main>
  );
}
