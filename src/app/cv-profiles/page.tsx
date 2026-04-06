"use client";
// /cv-profiles — CRUD page for job-type CV profiles.
// Each profile represents one type of job application (e.g. QA Automation, Frontend Developer)
// and holds the tailored skills, search keywords, and target platforms for that role.
// Data is fetched from and persisted to /api/cv-profiles → data/cv-profiles.json.
import { useState, useEffect, useCallback } from "react";
import { Briefcase, Plus, Edit2, Trash2, Tag, X, Save, Loader2, ToggleLeft, ToggleRight, User, ExternalLink, Lock, Calendar, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BaseProfile = {
  name: string;
  email?: string;
  summary?: string;
  skills?: string;
};

type CvProfile = {
  id: string;
  title: string;
  /** Company this profile was created for (set when created from a job posting) */
  company?: string;
  /** Original job posting URL (set when created from a scraper result) */
  url?: string;
  summary?: string;
  skills: string[];
  search_keywords: string[];
  platforms: string[];
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormState = Omit<CvProfile, "id" | "createdAt" | "updatedAt">;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORMS = ["LinkedIn", "AllJobs", "Jobmaster"] as const;

const EMPTY_FORM: FormState = {
  title: "",
  summary: "",
  skills: [],
  search_keywords: [],
  platforms: [],
  is_active: true,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CvProfilesPage() {
  const [profiles, setProfiles] = useState<CvProfile[]>([]);
  const [baseProfile, setBaseProfile] = useState<BaseProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // editing = null (closed) | "new" | "<profile id>"
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [skillInput, setSkillInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [saving, setSaving] = useState(false);

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  /** Fetches all CV profiles from the server and updates local state. */
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/cv-profiles");
      const data = await r.json();
      setProfiles(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load profiles");
    } finally {
      setLoading(false);
    }
  }, []);

  /** Fetches the base personal profile to display the read-only Base Profile card. */
  const loadBaseProfile = useCallback(async () => {
    try {
      const r = await fetch("/api/profile");
      if (r.ok) setBaseProfile(await r.json());
    } catch {
      // non-critical — card will show a placeholder if missing
    }
  }, []);

  useEffect(() => {
    load();
    loadBaseProfile();
  }, [load, loadBaseProfile]);

  // -------------------------------------------------------------------------
  // Modal helpers
  // -------------------------------------------------------------------------

  /** Resets the form to empty values and opens the modal in "create" mode. */
  function openNew() {
    setEditing("new");
    setForm(EMPTY_FORM);
    setSkillInput("");
    setKeywordInput("");
  }

  /** Populates the form with the selected profile's data and opens the modal in "edit" mode. */
  function openEdit(p: CvProfile) {
    setEditing(p.id);
    setForm({
      title: p.title,
      summary: p.summary ?? "",
      skills: [...p.skills],
      search_keywords: [...p.search_keywords],
      platforms: [...p.platforms],
      is_active: p.is_active,
    });
    setSkillInput("");
    setKeywordInput("");
  }

  /** Closes the editor modal without saving. */
  function closeModal() {
    setEditing(null);
  }

  // -------------------------------------------------------------------------
  // Form mutations
  // -------------------------------------------------------------------------

  /** Appends the current skill input value to the skills list, then clears the input. */
  function addSkill() {
    const v = skillInput.trim();
    if (!v) return;
    setForm((prev) => ({ ...prev, skills: [...prev.skills, v] }));
    setSkillInput("");
  }

  /** Removes the skill at the given index from the skills list. */
  function removeSkill(index: number) {
    setForm((prev) => ({ ...prev, skills: prev.skills.filter((_, i) => i !== index) }));
  }

  /** Appends the current keyword input value to the search_keywords list, then clears the input. */
  function addKeyword() {
    const v = keywordInput.trim();
    if (!v) return;
    setForm((prev) => ({ ...prev, search_keywords: [...prev.search_keywords, v] }));
    setKeywordInput("");
  }

  /** Removes the keyword at the given index from the search_keywords list. */
  function removeKeyword(index: number) {
    setForm((prev) => ({ ...prev, search_keywords: prev.search_keywords.filter((_, i) => i !== index) }));
  }

  /** Adds a platform to the list if absent, or removes it if already present. */
  function togglePlatform(platform: string) {
    setForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
    }));
  }

  // -------------------------------------------------------------------------
  // API actions
  // -------------------------------------------------------------------------

  /** POSTs (create) or PATCHes (update) the form to the server, then refreshes the list. */
  async function save() {
    if (!form.title.trim()) {
      toast.error("Profile title is required");
      return;
    }
    setSaving(true);
    try {
      if (editing === "new") {
        await fetch("/api/cv-profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        toast.success("Profile created");
      } else {
        await fetch(`/api/cv-profiles/${editing}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        toast.success("Profile updated");
      }
      await load();
      closeModal();
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  /** Asks for confirmation, then sends DELETE to the server and refreshes the list. */
  async function deleteProfile(id: string) {
    if (!confirm("Delete this profile?")) return;
    try {
      await fetch(`/api/cv-profiles/${id}`, { method: "DELETE" });
      toast.success("Profile deleted");
      await load();
    } catch {
      toast.error("Failed to delete profile");
    }
  }

  /** Flips the is_active flag of a profile by sending a PATCH with the opposite value. */
  async function toggleActive(profile: CvProfile) {
    try {
      await fetch(`/api/cv-profiles/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !profile.is_active }),
      });
      await load();
    } catch {
      toast.error("Failed to update profile");
    }
  }

  /**
   * Creates a new job entry in the dashboard using the CV profile's title and company.
   * The job is pre-linked to this profile so the user can generate the CV immediately.
   */
  async function addProfileToDashboard(profile: CvProfile) {
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: profile.title,
          company: profile.company ?? "",
          // Include the original job posting URL so the dashboard shows the source link icon
          url: profile.url ?? "",
          source: profile.url ? "linkedin" : "manual",
          status: "new",
          cvProfileId: profile.id,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Added to Dashboard");
    } catch {
      toast.error("Failed to add to Dashboard");
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <main className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CV Profiles</h1>
          <p className="text-gray-500 mt-1">Configure each job type with specific skills and search keywords.</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New Profile
        </button>
      </div>

      {/* Profile grid */}
      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading profiles...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Base Profile card — always first, read-only */}
          <BaseProfileCard profile={baseProfile} />

          {profiles.length === 0 ? (
            <div className="md:col-span-2 lg:col-span-2 text-center py-16 bg-white border border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center">
              <Briefcase className="w-10 h-10 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No job profiles yet</p>
              <p className="text-gray-400 text-sm mt-1">Click &quot;New Profile&quot; to add your first job type.</p>
            </div>
          ) : profiles.map((p) => (
            <ProfileCard
              key={p.id}
              profile={p}
              onEdit={() => openEdit(p)}
              onDelete={() => deleteProfile(p.id)}
              onToggleActive={() => toggleActive(p)}
              onAddToDashboard={() => addProfileToDashboard(p)}
            />
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editing && (
        <EditorModal
          isNew={editing === "new"}
          form={form}
          setForm={setForm}
          skillInput={skillInput}
          setSkillInput={setSkillInput}
          keywordInput={keywordInput}
          setKeywordInput={setKeywordInput}
          saving={saving}
          onAddSkill={addSkill}
          onRemoveSkill={removeSkill}
          onAddKeyword={addKeyword}
          onRemoveKeyword={removeKeyword}
          onTogglePlatform={togglePlatform}
          onSave={save}
          onClose={closeModal}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// BaseProfileCard — read-only card always shown first in the grid
// ---------------------------------------------------------------------------

type BaseProfileCardProps = { profile: BaseProfile | null };

/**
 * Displays the base personal profile as a non-editable card.
 * Includes a lock badge and a link to edit the profile on /profile.
 */
function BaseProfileCard({ profile }: BaseProfileCardProps) {
  const skillCount = (profile?.skills ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean).length;

  return (
    <div className="bg-white rounded-xl border-2 border-indigo-200 p-5 relative">
      {/* Lock badge — indicates read-only */}
      <div className="absolute top-3 right-3 flex items-center gap-1 bg-indigo-50 text-indigo-600 text-xs font-medium px-2 py-0.5 rounded-full border border-indigo-200">
        <Lock className="w-2.5 h-2.5" /> Base
      </div>

      {/* Card header */}
      <div className="flex items-center gap-2 mb-3 pr-16">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-indigo-600" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm truncate">
            {profile?.name ?? "Base Profile"}
          </h3>
          {profile?.email && (
            <p className="text-xs text-gray-400 truncate">{profile.email}</p>
          )}
        </div>
      </div>

      {/* Summary preview */}
      {profile?.summary && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{profile.summary}</p>
      )}

      {/* Skill count badge */}
      {skillCount > 0 && (
        <div className="mb-3">
          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs">
            {skillCount} base skill{skillCount !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Placeholder when no profile saved yet */}
      {!profile && (
        <p className="text-xs text-gray-400 mb-3 italic">No base profile saved yet.</p>
      )}

      {/* Edit link — navigates to /profile instead of opening a modal */}
      <a
        href="/profile"
        className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 transition-colors mt-1"
      >
        <ExternalLink className="w-3 h-3" /> Edit in Base Profile
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProfileCard — summary card shown in the grid for each CV profile
// ---------------------------------------------------------------------------

type ProfileCardProps = {
  profile: CvProfile;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onAddToDashboard: () => void;
};

/** Displays a single CV profile as a card with title, summary, skill badges, platform badges, and action buttons. */
function ProfileCard({ profile, onEdit, onDelete, onToggleActive, onAddToDashboard }: ProfileCardProps) {
  const visibleSkills = profile.skills.slice(0, 5);
  const extraSkills = profile.skills.length - 5;

  return (
    <div className={`bg-white rounded-xl border p-5 transition-shadow hover:shadow-md ${profile.is_active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
      {/* Card header */}
      <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{profile.title}</h3>
            {/* Show originating company when profile was created from a job posting */}
            {profile.company && (
              <p className="text-xs text-gray-500 mt-0.5">{profile.company}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onToggleActive}
            title={profile.is_active ? "Deactivate" : "Activate"}
            className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
          >
            {profile.is_active
              ? <ToggleRight className="w-4 h-4 text-blue-600" />
              : <ToggleLeft className="w-4 h-4" />}
          </button>
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Summary */}
      {profile.summary && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">{profile.summary}</p>
      )}

      {/* Skills */}
      {visibleSkills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {visibleSkills.map((s, i) => (
            <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">{s}</span>
          ))}
          {extraSkills > 0 && (
            <span className="px-2 py-0.5 border border-gray-200 text-gray-500 rounded-full text-xs">+{extraSkills}</span>
          )}
        </div>
      )}

      {/* Platforms */}
      {profile.platforms.length > 0 && (
        <div className="flex gap-1.5 mb-3">
          {profile.platforms.map((pl) => (
            <span key={pl} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{pl}</span>
          ))}
        </div>
      )}

      {/* Footer: creation date + Add to Dashboard button */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {new Date(profile.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
        </p>
        <button
          onClick={onAddToDashboard}
          title="Add to Dashboard"
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
        >
          <LayoutDashboard className="w-3 h-3" />
          Add to Dashboard
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditorModal — full-screen modal for creating or editing a CV profile
// ---------------------------------------------------------------------------

type EditorModalProps = {
  isNew: boolean;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  skillInput: string;
  setSkillInput: (v: string) => void;
  keywordInput: string;
  setKeywordInput: (v: string) => void;
  saving: boolean;
  onAddSkill: () => void;
  onRemoveSkill: (i: number) => void;
  onAddKeyword: () => void;
  onRemoveKeyword: (i: number) => void;
  onTogglePlatform: (p: string) => void;
  onSave: () => void;
  onClose: () => void;
};

/**
 * Modal overlay with fields for title, summary, skills (tag input),
 * search keywords (tag input), and platform toggles.
 * Calls onSave / onClose when the user confirms or cancels.
 */
function EditorModal({
  isNew, form, setForm,
  skillInput, setSkillInput,
  keywordInput, setKeywordInput,
  saving,
  onAddSkill, onRemoveSkill,
  onAddKeyword, onRemoveKeyword,
  onTogglePlatform,
  onSave, onClose,
}: EditorModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* Modal header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isNew ? "New CV Profile" : "Edit CV Profile"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal body */}
        <div className="p-6 space-y-5">

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Profile Title</label>
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. QA Automation Developer"
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Summary */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Objective / Summary</label>
            <textarea
              rows={3}
              value={form.summary ?? ""}
              onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
              placeholder="Tailored summary for this type of job application..."
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Skills */}
          <div>
            <label className="flex items-center gap-1 text-xs font-medium text-gray-500 mb-2">
              <Tag className="w-3 h-3" /> Technical Skills
            </label>
            <div className="flex gap-2 mb-2">
              <input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAddSkill())}
                placeholder="e.g. Cypress, Playwright, Jest..."
                className="flex-1 border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={onAddSkill}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.skills.map((s, i) => (
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

          {/* Search Keywords */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Search Keywords</label>
            <div className="flex gap-2 mb-2">
              <input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onAddKeyword())}
                placeholder="e.g. QA automation, test engineer..."
                className="flex-1 border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={onAddKeyword}
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.search_keywords.map((k, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onRemoveKeyword(i)}
                  className="flex items-center gap-1 px-2.5 py-1 border border-gray-300 text-gray-600 rounded-full text-xs hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
                >
                  {k} <X className="w-2.5 h-2.5" />
                </button>
              ))}
            </div>
          </div>

          {/* Platforms */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Target Platforms</label>
            <div className="flex gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onTogglePlatform(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    form.platforms.includes(p)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-500 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors font-medium"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
