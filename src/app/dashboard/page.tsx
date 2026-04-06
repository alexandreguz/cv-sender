"use client";
// /dashboard — job application tracker.
// Each row has an inline CvProfile dropdown + "Generate CV" button.
// Clicking "Preview" on a row with a CV expands an inline panel for viewing and editing the CV.
import { useEffect, useState, useCallback, Fragment } from "react";
import {
  Loader2, Zap, Eye, EyeOff, Pencil, X, Check,
  Download, ExternalLink, Trash2, Plus,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Job = {
  id: string;
  title: string;
  company: string;
  location?: string;
  source: string;
  url?: string;
  status: string;
  cvId?: string | null;
  cvProfileId?: string | null;
  createdAt: string;
};

type CvProfile = {
  id: string;
  title: string;
  is_active: boolean;
};

type CvDocument = {
  id: string;
  jobId: string;
  cvProfileId: string;
  title: string;
  summary: string;
  skills: string[];
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Status badge config
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  new:         "bg-gray-100 text-gray-600",
  ready:       "bg-blue-100 text-blue-700",
  sent:        "bg-purple-100 text-purple-700",
  viewed:      "bg-yellow-100 text-yellow-700",
  interview:   "bg-green-100 text-green-700",
  rejected:    "bg-red-100 text-red-700",
  no_response: "bg-orange-100 text-orange-700",
};

const ALL_STATUSES = ["new", "ready", "sent", "viewed", "interview", "rejected", "no_response"];

const COL_COUNT = 6; // Title | Source | Status | CV Profile | CV | Actions

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [cvProfiles, setCvProfiles] = useState<CvProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Per-job selected CvProfile id for the dropdown (jobId → cvProfileId)
  const [selectedProfile, setSelectedProfile] = useState<Record<string, string>>({});

  // Which job's preview row is currently expanded
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  // CvDocument loaded for the expanded preview row
  const [cvDoc, setCvDoc] = useState<CvDocument | null>(null);
  const [docLoading, setDocLoading] = useState(false);

  // Edit mode state for the preview panel
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editSkills, setEditSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [saving, setSaving] = useState(false);

  // Which job is currently having its CV generated (shows spinner)
  const [generating, setGenerating] = useState<string | null>(null);

  // Job pending deletion confirmation
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [deleting, setDeleting] = useState(false);

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  /** Fetches all jobs from the server and updates local state. */
  const loadJobs = useCallback(async () => {
    try {
      const r = await fetch("/api/jobs");
      const data = await r.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, []);

  /** Fetches active CV profiles and prepends the synthetic "Base Profile" option. */
  const loadCvProfiles = useCallback(async () => {
    try {
      const r = await fetch("/api/cv-profiles");
      const data: CvProfile[] = await r.json();
      const active = Array.isArray(data) ? data.filter((p) => p.is_active) : [];
      // Prepend the Base Profile synthetic option so it is always available
      setCvProfiles([
        { id: "__base__", title: "Base Profile", is_active: true },
        ...active,
      ]);
    } catch {
      setCvProfiles([{ id: "__base__", title: "Base Profile", is_active: true }]);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    loadCvProfiles();
  }, [loadJobs, loadCvProfiles]);

  // -------------------------------------------------------------------------
  // CV generation
  // -------------------------------------------------------------------------

  /** Calls the generate-cv API with the job id and the selected CvProfile id. */
  async function generateCv(jobId: string) {
    const cvProfileId = selectedProfile[jobId] ?? cvProfiles[0]?.id;
    if (!cvProfileId) {
      toast.error("No active CV Profile found — create one in CV Profiles first");
      return;
    }
    setGenerating(jobId);
    try {
      const r = await fetch("/api/generate-cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, cvProfileId }),
      });
      if (!r.ok) throw new Error();
      toast.success("CV generated successfully");
      await loadJobs();
    } catch {
      toast.error("Failed to generate CV");
    } finally {
      setGenerating(null);
    }
  }

  // -------------------------------------------------------------------------
  // Preview panel
  // -------------------------------------------------------------------------

  /** Toggles the inline preview row for a job. Loads the CvDocument on open. */
  async function togglePreview(job: Job) {
    // Close if already open
    if (expandedJob === job.id) {
      setExpandedJob(null);
      setCvDoc(null);
      setEditMode(false);
      return;
    }
    if (!job.cvId) {
      toast.error("Generate a CV first");
      return;
    }
    setExpandedJob(job.id);
    setCvDoc(null);
    setDocLoading(true);
    try {
      const r = await fetch(`/api/cv-document/${job.cvId}`);
      if (r.ok) {
        setCvDoc(await r.json());
      } else {
        toast.error("CV document not found — please regenerate the CV");
        setExpandedJob(null);
      }
    } catch {
      toast.error("Failed to load CV preview");
      setExpandedJob(null);
    } finally {
      setDocLoading(false);
    }
  }

  /** Enters edit mode by copying CvDocument fields into editable state. */
  function startEdit() {
    if (!cvDoc) return;
    setEditTitle(cvDoc.title);
    setEditSummary(cvDoc.summary);
    setEditSkills([...cvDoc.skills]);
    setSkillInput("");
    setEditMode(true);
  }

  /** Discards unsaved edits and returns to view mode. */
  function cancelEdit() {
    setEditMode(false);
    setSkillInput("");
  }

  /** Appends the current skill input to the skill list and clears the input. */
  function addSkill() {
    const v = skillInput.trim();
    if (!v) return;
    setEditSkills((prev) => [...prev, v]);
    setSkillInput("");
  }

  /** Removes the skill at the given index from the edit-mode list. */
  function removeSkill(i: number) {
    setEditSkills((prev) => prev.filter((_, idx) => idx !== i));
  }

  /** PATCHes the CvDocument with the edited values and refreshes the preview. */
  async function saveEdit() {
    if (!cvDoc) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/cv-document/${cvDoc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, summary: editSummary, skills: editSkills }),
      });
      if (!r.ok) throw new Error();
      setCvDoc(await r.json());
      setEditMode(false);
      toast.success("CV updated successfully");
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  // -------------------------------------------------------------------------
  // Job management
  // -------------------------------------------------------------------------

  /** Sends a PATCH to update the job status and refreshes the list. */
  async function updateStatus(jobId: string, status: string) {
    try {
      await fetch("/api/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: jobId, patch: { status } }),
      });
      await loadJobs();
    } catch {
      toast.error("Failed to update status");
    }
  }

  /** Deletes the confirmed job and removes it from local state. */
  async function confirmDelete() {
    if (!jobToDelete) return;
    setDeleting(true);
    try {
      await fetch("/api/jobs", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: jobToDelete.id }),
      });
      setJobs((prev) => prev.filter((j) => j.id !== jobToDelete.id));
      if (expandedJob === jobToDelete.id) setExpandedJob(null);
      setJobToDelete(null);
      toast.success("Job removed");
    } catch {
      toast.error("Failed to delete job");
    } finally {
      setDeleting(false);
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <main className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          {jobs.length} job{jobs.length !== 1 ? "s" : ""} tracked
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500 p-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading jobs...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Job</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Source</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">CV Profile</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">CV</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={COL_COUNT} className="px-4 py-10 text-center text-gray-400">
                      No jobs yet. Run a scraper to import listings.
                    </td>
                  </tr>
                )}

                {jobs.map((job) => (
                  <Fragment key={job.id}>
                    {/* ── Main job row ─────────────────────────────────── */}
                    <tr className={`hover:bg-gray-50 transition-colors ${expandedJob === job.id ? "bg-blue-50/40" : ""}`}>

                      {/* Job title + company */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 leading-tight">{job.title}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{job.company}{job.location ? ` · ${job.location}` : ""}</p>
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3 text-gray-500">{job.source}</td>

                      {/* Status — inline select */}
                      <td className="px-4 py-3">
                        <select
                          value={job.status}
                          onChange={(e) => updateStatus(job.id, e.target.value)}
                          className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${STATUS_STYLES[job.status] ?? STATUS_STYLES.new}`}
                        >
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s}>{s.replace("_", " ")}</option>
                          ))}
                        </select>
                      </td>

                      {/* CV Profile dropdown */}
                      <td className="px-4 py-3">
                        {cvProfiles.length === 0 ? (
                          <span className="text-xs text-gray-400">No active profiles</span>
                        ) : (
                          <select
                            value={selectedProfile[job.id] ?? cvProfiles[0]?.id ?? ""}
                            onChange={(e) =>
                              setSelectedProfile((prev) => ({ ...prev, [job.id]: e.target.value }))
                            }
                            className="text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[160px]"
                          >
                            {cvProfiles.map((p) => (
                              <option key={p.id} value={p.id}>{p.title}</option>
                            ))}
                          </select>
                        )}
                      </td>

                      {/* Generate CV + Download */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => generateCv(job.id)}
                            disabled={generating === job.id || cvProfiles.length === 0}
                            title="Generate CV"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-xs font-medium"
                          >
                            {generating === job.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Zap className="w-3.5 h-3.5" />}
                            Generate
                          </button>
                          {job.cvId && (
                            <a
                              href={`/api/cv/${job.cvId}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Download PDF"
                              className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Actions: preview, open URL, delete */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {job.cvId && (
                            <button
                              onClick={() => togglePreview(job)}
                              title={expandedJob === job.id ? "Close preview" : "Preview CV"}
                              className={`p-1.5 rounded transition-colors ${
                                expandedJob === job.id
                                  ? "text-blue-600 bg-blue-50"
                                  : "text-gray-400 hover:text-blue-600"
                              }`}
                            >
                              {expandedJob === job.id
                                ? <EyeOff className="w-3.5 h-3.5" />
                                : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}
                          {job.url && (
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noreferrer"
                              title="Open job listing"
                              className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => setJobToDelete(job)}
                            title="Delete job"
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* ── Inline CV preview/edit row ───────────────────── */}
                    {expandedJob === job.id && (
                      <tr>
                        <td colSpan={COL_COUNT} className="bg-blue-50/30 border-t border-blue-100 p-0">
                          <div className="p-5">
                            {docLoading ? (
                              <div className="flex items-center gap-2 text-gray-500 py-4">
                                <Loader2 className="w-4 h-4 animate-spin" /> Loading CV preview...
                              </div>
                            ) : cvDoc ? (
                              <CvPreviewPanel
                                job={job}
                                cvDoc={cvDoc}
                                editMode={editMode}
                                editTitle={editTitle}
                                editSummary={editSummary}
                                editSkills={editSkills}
                                skillInput={skillInput}
                                saving={saving}
                                onStartEdit={startEdit}
                                onCancelEdit={cancelEdit}
                                onSaveEdit={saveEdit}
                                onEditTitle={setEditTitle}
                                onEditSummary={setEditSummary}
                                onSkillInput={setSkillInput}
                                onAddSkill={addSkill}
                                onRemoveSkill={removeSkill}
                                onClose={() => togglePreview(job)}
                              />
                            ) : (
                              <p className="text-sm text-gray-500 py-4">
                                CV data unavailable — please regenerate the CV.
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Delete confirmation overlay ────────────────────────────────────── */}
      {jobToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setJobToDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Remove Job</h2>
            <p className="text-sm text-gray-600">
              Remove <span className="font-semibold">{jobToDelete.title}</span> at{" "}
              <span className="font-semibold">{jobToDelete.company}</span>? This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setJobToDelete(null)}
                disabled={deleting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// CvPreviewPanel — inline CV view + edit panel inside the expanded table row
// ---------------------------------------------------------------------------

type CvPreviewPanelProps = {
  job: Job;
  cvDoc: CvDocument;
  editMode: boolean;
  editTitle: string;
  editSummary: string;
  editSkills: string[];
  skillInput: string;
  saving: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditTitle: (v: string) => void;
  onEditSummary: (v: string) => void;
  onSkillInput: (v: string) => void;
  onAddSkill: () => void;
  onRemoveSkill: (i: number) => void;
  onClose: () => void;
};

/** Renders the CV content inline below a job row. Supports view and edit modes. */
function CvPreviewPanel({
  job,
  cvDoc,
  editMode,
  editTitle,
  editSummary,
  editSkills,
  skillInput,
  saving,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditTitle,
  onEditSummary,
  onSkillInput,
  onAddSkill,
  onRemoveSkill,
  onClose,
}: CvPreviewPanelProps) {
  return (
    <div className="bg-white border border-blue-200 rounded-xl overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-blue-100 bg-white">
        <span className="text-sm font-semibold text-gray-700">
          CV Preview — {job.title} · {job.company}
        </span>
        <div className="flex items-center gap-2">
          {!editMode ? (
            <>
              <button
                onClick={onStartEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
              <a
                href={`/api/cv/${job.cvId}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-3 h-3" /> Download PDF
              </a>
            </>
          ) : (
            <>
              <button
                onClick={onCancelEdit}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
              <button
                onClick={onSaveEdit}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          )}
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Panel body */}
      <div className="p-5 space-y-4">
        {editMode ? (
          /* ── Edit mode ─────────────────────────────────────────────── */
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Job Title</label>
              <input
                value={editTitle}
                onChange={(e) => onEditTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Summary</label>
              <textarea
                rows={4}
                value={editSummary}
                onChange={(e) => onEditSummary(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">Skills</label>
              <div className="flex gap-2 mb-2">
                <input
                  value={skillInput}
                  onChange={(e) => onSkillInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAddSkill())}
                  placeholder="Add a skill and press Enter"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={onAddSkill}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {editSkills.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onRemoveSkill(i)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    {s} <X className="w-2.5 h-2.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── View mode ─────────────────────────────────────────────── */
          <div className="space-y-4">
            {/* Title */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Job Title</p>
              <p className="text-lg font-bold text-blue-700">{cvDoc.title}</p>
            </div>

            {/* Summary */}
            {cvDoc.summary && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Summary</p>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{cvDoc.summary}</p>
              </div>
            )}

            {/* Skills */}
            {cvDoc.skills.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Skills</p>
                <div className="flex flex-wrap gap-1.5">
                  {cvDoc.skills.map((s, i) => (
                    <span key={i} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs">{s}</span>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-400 pt-2">
              Base profile data (experiences, education, contact) is included in the PDF.
              Last updated: {new Date(cvDoc.updatedAt).toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
