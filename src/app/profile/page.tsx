"use client";
// /profile — base personal profile form.
// On mount, loads the existing profile from the server (GET /api/profile).
// On save, posts the form to the server (POST /api/profile) which persists it to data/profile.json.
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, Eye, Loader2, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Experience = {
  id: string;
  company: string;
  position: string;
  startDate: string;    // free-text, e.g. "Jan 2022"
  endDate: string;      // empty when isCurrent is true
  isCurrent: boolean;
  description: string;
};

type ProfileForm = {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  summary: string;
  skills: string;
  education: string;
};

// Empty state for the experience inline form
const EMPTY_EXP: Omit<Experience, "id"> = {
  company: "",
  position: "",
  startDate: "",
  endDate: "",
  isCurrent: false,
  description: "",
};

const EMPTY_FORM: ProfileForm = {
  name: "",
  email: "",
  phone: "",
  location: "",
  linkedin: "",
  github: "",
  summary: "",
  skills: "",
  education: "",
};

/** Generates a simple unique id in the browser (no crypto dependency). */
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const router = useRouter();

  // Personal info fields
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);

  // Structured work history
  const [experiences, setExperiences] = useState<Experience[]>([]);

  // Which experience is being edited: "new" | existing id | null (none)
  const [draftId, setDraftId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Omit<Experience, "id">>(EMPTY_EXP);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch the stored profile once when the component mounts and populate the form fields
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setForm({
            name: data.name ?? "",
            email: data.email ?? "",
            phone: data.phone ?? "",
            location: data.location ?? "",
            linkedin: data.linkedin ?? "",
            github: data.github ?? "",
            summary: data.summary ?? "",
            skills: data.skills ?? "",
            education: data.education ?? "",
          });
          // Load structured experiences; fall back to empty list
          if (Array.isArray(data.experiences)) {
            setExperiences(data.experiences);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /** Updates the matching form field whenever the user types into any input or textarea. */
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // ---------------------------------------------------------------------------
  // Experience management (local state — committed on Save Profile)
  // ---------------------------------------------------------------------------

  /** Opens the inline form to add a new experience entry. */
  function startAdd() {
    setDraft(EMPTY_EXP);
    setDraftId("new");
  }

  /** Populates the inline form with an existing experience for editing. */
  function startEdit(exp: Experience) {
    setDraft({
      company: exp.company,
      position: exp.position,
      startDate: exp.startDate,
      endDate: exp.endDate,
      isCurrent: exp.isCurrent,
      description: exp.description,
    });
    setDraftId(exp.id);
  }

  /** Discards any in-progress add/edit without saving. */
  function cancelDraft() {
    setDraftId(null);
    setDraft(EMPTY_EXP);
  }

  /** Commits the current draft: appends a new entry or updates an existing one. */
  function commitDraft() {
    if (!draft.company.trim() || !draft.position.trim()) {
      toast.error("Company and position are required");
      return;
    }
    if (draftId === "new") {
      setExperiences((prev) => [...prev, { ...draft, id: uid() }]);
    } else {
      setExperiences((prev) =>
        prev.map((e) => (e.id === draftId ? { ...draft, id: draftId } : e))
      );
    }
    cancelDraft();
  }

  /** Removes an experience entry from the list. */
  function deleteExp(id: string) {
    setExperiences((prev) => prev.filter((e) => e.id !== id));
    // If the deleted item was being edited, close the form
    if (draftId === id) cancelDraft();
  }

  // ---------------------------------------------------------------------------
  // Form submit
  // ---------------------------------------------------------------------------

  /** POSTs the full profile (including structured experiences) to /api/profile. */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Auto-close any open draft before saving
    if (draftId) cancelDraft();
    setSaving(true);
    try {
      const r = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, experiences }),
      });
      if (!r.ok) throw new Error("Failed to save");
      toast.success("Profile saved successfully");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <main className="p-6 max-w-2xl mx-auto flex items-center gap-2 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading profile...
      </main>
    );
  }

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Base Profile</h1>
        <p className="text-gray-500 mt-1">
          Your personal information — used as a foundation for all CV profiles.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Personal info ─────────────────────────────────────────────── */}
        <fieldset className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <legend className="text-sm font-semibold text-gray-700 px-1">Personal Information</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name"  name="name"     value={form.name}     onChange={handleChange} placeholder="John Doe" />
            <Field label="Email"      name="email"    value={form.email}    onChange={handleChange} placeholder="john@example.com" type="email" />
            <Field label="Phone"      name="phone"    value={form.phone}    onChange={handleChange} placeholder="+972 50 000 0000" />
            <Field label="Location"   name="location" value={form.location} onChange={handleChange} placeholder="Tel Aviv, Israel" />
            <Field label="LinkedIn"   name="linkedin" value={form.linkedin} onChange={handleChange} placeholder="https://linkedin.com/in/..." />
            <Field label="GitHub"     name="github"   value={form.github}   onChange={handleChange} placeholder="https://github.com/..." />
          </div>
        </fieldset>

        {/* ── Professional summary ───────────────────────────────────────── */}
        <fieldset className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <legend className="text-sm font-semibold text-gray-700 px-1">Professional Summary</legend>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
            <textarea
              name="summary"
              value={form.summary}
              onChange={handleChange}
              rows={3}
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Brief professional summary used as a base across all profiles..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Base Skills
              <span className="text-gray-400 font-normal ml-1">(comma-separated)</span>
            </label>
            <input
              type="text"
              name="skills"
              value={form.skills}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="JavaScript, Python, Selenium, Cypress, SQL..."
            />
          </div>
        </fieldset>

        {/* ── Professional Experience ────────────────────────────────────── */}
        <fieldset className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <legend className="text-sm font-semibold text-gray-700 px-1">Professional Experience</legend>
            {/* Only show Add button when no draft is open */}
            {draftId === null && (
              <button
                type="button"
                onClick={startAdd}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Experience
              </button>
            )}
          </div>

          {/* Existing experience cards */}
          {experiences.map((exp) =>
            draftId === exp.id ? (
              // Inline edit form replaces the card
              <ExpForm
                key={exp.id}
                draft={draft}
                setDraft={setDraft}
                onCommit={commitDraft}
                onCancel={cancelDraft}
              />
            ) : (
              <ExpCard
                key={exp.id}
                exp={exp}
                onEdit={() => startEdit(exp)}
                onDelete={() => deleteExp(exp.id)}
                disabled={draftId !== null}
              />
            )
          )}

          {/* Inline add form at the bottom */}
          {draftId === "new" && (
            <ExpForm
              draft={draft}
              setDraft={setDraft}
              onCommit={commitDraft}
              onCancel={cancelDraft}
            />
          )}

          {experiences.length === 0 && draftId === null && (
            <p className="text-sm text-gray-400 text-center py-4">
              No experience added yet. Click &quot;Add Experience&quot; to start.
            </p>
          )}
        </fieldset>

        {/* ── Education ─────────────────────────────────────────────────── */}
        <fieldset className="bg-white border border-gray-200 rounded-xl p-5">
          <legend className="text-sm font-semibold text-gray-700 px-1 mb-3">Education</legend>
          <textarea
            name="education"
            value={form.education}
            onChange={handleChange}
            rows={3}
            className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Degrees, certifications, courses..."
          />
        </fieldset>

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors text-sm font-medium"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving..." : "Save Profile"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/preview")}
            className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <Eye className="w-4 h-4" /> View Preview
          </button>
        </div>
      </form>
    </main>
  );
}

// ---------------------------------------------------------------------------
// ExpCard — read-only display of a single experience entry
// ---------------------------------------------------------------------------

type ExpCardProps = {
  exp: Experience;
  onEdit: () => void;
  onDelete: () => void;
  disabled: boolean; // true when another entry is being edited
};

/** Shows a single experience entry with Edit and Delete action buttons. */
function ExpCard({ exp, onEdit, onDelete, disabled }: ExpCardProps) {
  const dateRange = exp.isCurrent
    ? `${exp.startDate} — Present`
    : `${exp.startDate}${exp.endDate ? ` — ${exp.endDate}` : ""}`;

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-gray-900 text-sm">{exp.position}</p>
          <p className="text-blue-600 text-sm">{exp.company}</p>
          <p className="text-gray-400 text-xs mt-0.5">{dateRange}</p>
        </div>
        {/* Action buttons — hidden while another entry is being edited */}
        {!disabled && (
          <div className="flex gap-1 shrink-0">
            <button
              type="button"
              onClick={onEdit}
              title="Edit"
              className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="Delete"
              className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
      {exp.description && (
        <p className="mt-2 text-xs text-gray-600 leading-relaxed whitespace-pre-line">
          {exp.description}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExpForm — inline add / edit form for a single experience entry
// ---------------------------------------------------------------------------

type ExpFormProps = {
  draft: Omit<Experience, "id">;
  setDraft: React.Dispatch<React.SetStateAction<Omit<Experience, "id">>>;
  onCommit: () => void;
  onCancel: () => void;
};

/** Inline form for creating or editing an experience entry. */
function ExpForm({ draft, setDraft, onCommit, onCancel }: ExpFormProps) {
  /** Generic change handler for all text inputs inside the experience form. */
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setDraft((prev) => ({ ...prev, [name]: value }));
  }

  return (
    <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Company *</label>
          <input
            name="company"
            value={draft.company}
            onChange={handleChange}
            placeholder="e.g. Acme Corp"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Position *</label>
          <input
            name="position"
            value={draft.position}
            onChange={handleChange}
            placeholder="e.g. QA Automation Engineer"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
          <input
            name="startDate"
            value={draft.startDate}
            onChange={handleChange}
            placeholder="e.g. Jan 2022"
            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
          <input
            name="endDate"
            value={draft.endDate}
            onChange={handleChange}
            placeholder="e.g. Mar 2024"
            disabled={draft.isCurrent}
            className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:opacity-40 disabled:cursor-not-allowed"
          />
          {/* "Currently working here" toggle */}
          <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={draft.isCurrent}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  isCurrent: e.target.checked,
                  endDate: e.target.checked ? "" : prev.endDate,
                }))
              }
              className="w-3.5 h-3.5 rounded accent-blue-600"
            />
            <span className="text-xs text-gray-600">Currently working here</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
        <textarea
          name="description"
          value={draft.description}
          onChange={handleChange}
          rows={3}
          placeholder="Responsibilities, achievements, technologies used..."
          className="w-full border border-gray-300 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      {/* Form action buttons */}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Cancel
        </button>
        <button
          type="button"
          onClick={onCommit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Check className="w-3.5 h-3.5" /> Confirm
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field — minimal labelled input, local to this file
// ---------------------------------------------------------------------------

type FieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
};

/** Renders a labelled text input with consistent styling. */
function Field({ label, name, value, onChange, placeholder, type = "text" }: FieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}
