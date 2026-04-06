// src/lib/server/db.ts
// Server-side in-memory store with JSON file persistence.
// All entities are loaded from disk on startup and written back on every mutation.
// This file is the single source of truth for all data in the app.
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(process.cwd(), "data");

/** Creates the data/ directory if it does not exist yet. */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

/** Reads and parses a JSON file from disk. Returns fallback if missing or corrupt. */
function readJson<T>(file: string, fallback: T): T {
  try {
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, "utf8");
      return JSON.parse(raw || JSON.stringify(fallback));
    }
  } catch {
    // ignore parse errors and return the safe fallback
  }
  return fallback;
}

/** Serialises data to JSON and writes it to disk. Non-fatal on failure. */
function writeJson(file: string, data: unknown) {
  try {
    ensureDataDir();
    fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  } catch {
    // keep in-memory state intact even if the write fails
  }
}

// ---------------------------------------------------------------------------
// Profile — personal base data
// ---------------------------------------------------------------------------

/** A single entry in the structured work history list. */
export type Experience = {
  id: string;
  company: string;
  position: string;
  startDate: string;  // free-text, e.g. "Jan 2022" or "2022-01"
  endDate: string;    // empty string when isCurrent is true
  isCurrent: boolean;
  description: string;
};

export type Profile = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  /** Generic professional summary used as a base for all CV profiles */
  summary?: string;
  /** Comma-separated base skill pool, adapted per CV profile */
  skills?: string;
  /** Structured work history — replaces the old free-text experience field */
  experiences?: Experience[];
  education?: string;
  updatedAt: string;
};

const PROFILE_FILE = path.join(DATA_DIR, "profile.json");

// Load profile from disk once at module startup
let PROFILE: Profile | null = readJson<Profile | null>(PROFILE_FILE, null);

/** Returns the stored base profile, or null if none has been saved yet. */
export function getProfile(): Profile | null {
  return PROFILE;
}

/** Merges patch into the current profile and persists the result to disk. */
export function setProfile(patch: Partial<Omit<Profile, "id">>): Profile {
  const now = new Date().toISOString();
  PROFILE = {
    ...(PROFILE ?? { id: randomUUID(), name: "", email: "" }),
    ...patch,
    updatedAt: now,
  };
  writeJson(PROFILE_FILE, PROFILE);
  return PROFILE;
}

// ---------------------------------------------------------------------------
// CvProfile — per-job-type resume profile
// ---------------------------------------------------------------------------

export type CvProfile = {
  id: string;
  title: string;
  /** Company this profile was created for (set when created from a specific job posting) */
  company?: string;
  /** Original job posting URL (set when created from a scraper result) */
  url?: string;
  /** Tailored objective / summary for this job type */
  summary?: string;
  /** Technical skills specific to this profile */
  skills: string[];
  /** Keywords used to search for jobs of this type */
  search_keywords: string[];
  /** Platforms where this profile is used: LinkedIn, AllJobs, Jobmaster */
  platforms: string[];
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
};

const CV_PROFILES_FILE = path.join(DATA_DIR, "cv-profiles.json");

// Load all CV profiles from disk once at module startup
const CV_PROFILES: Map<string, CvProfile> = new Map(
  readJson<CvProfile[]>(CV_PROFILES_FILE, []).map((p) => [p.id, p])
);

/** Serialises the entire CV profiles map to disk. */
function persistCvProfiles() {
  writeJson(CV_PROFILES_FILE, Array.from(CV_PROFILES.values()));
}

/** Returns all CV profiles sorted by creation date descending (newest first). */
export function listCvProfiles(): CvProfile[] {
  return Array.from(CV_PROFILES.values()).sort(
    (a, b) => (a.createdAt < b.createdAt ? 1 : -1)
  );
}

/** Returns a single CV profile by id, or null if not found. */
export function getCvProfile(id: string): CvProfile | null {
  return CV_PROFILES.get(id) ?? null;
}

/** Creates a new CV profile, assigns id + timestamps, and persists to disk. */
export function createCvProfile(
  data: Omit<CvProfile, "id" | "createdAt" | "updatedAt">
): CvProfile {
  const now = new Date().toISOString();
  const profile: CvProfile = { ...data, id: randomUUID(), createdAt: now, updatedAt: now };
  CV_PROFILES.set(profile.id, profile);
  persistCvProfiles();
  return profile;
}

/** Applies a partial patch to an existing CV profile and persists. Returns null if not found. */
export function updateCvProfile(
  id: string,
  patch: Partial<Omit<CvProfile, "id" | "createdAt">>
): CvProfile | null {
  const existing = CV_PROFILES.get(id);
  if (!existing) return null;
  const updated: CvProfile = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  CV_PROFILES.set(id, updated);
  persistCvProfiles();
  return updated;
}

/** Removes a CV profile by id. Returns true if it existed, false otherwise. */
export function deleteCvProfile(id: string): boolean {
  const existed = CV_PROFILES.delete(id);
  if (existed) persistCvProfiles();
  return existed;
}

// ---------------------------------------------------------------------------
// Keywords — job search terms shared across scrapers
// ---------------------------------------------------------------------------

export type Keywords = { titles: string[]; skills: string[]; location?: string };

const KEYWORDS_FILE = path.join(DATA_DIR, "keywords.json");

// Load keywords from disk once at module startup
const KEYWORDS: Keywords = readJson<Keywords>(KEYWORDS_FILE, { titles: [], skills: [] });

/** Returns a shallow copy of the current keyword configuration. */
export function getKeywords(): Keywords {
  return { ...KEYWORDS };
}

/** Merges new keyword values and persists the updated configuration to disk. */
export function setKeywords(payload: Partial<Keywords>): Keywords {
  if (payload.titles) KEYWORDS.titles = payload.titles;
  if (payload.skills) KEYWORDS.skills = payload.skills;
  if (typeof payload.location === "string") KEYWORDS.location = payload.location;
  writeJson(KEYWORDS_FILE, KEYWORDS);
  return getKeywords();
}

// ---------------------------------------------------------------------------
// Job — a job listing fetched from a scraper
// ---------------------------------------------------------------------------

export type Job = {
  id: string;
  title: string;
  company: string;
  location?: string;
  description?: string;
  source: string;
  url?: string;
  /** Tracks where the application stands in the hiring funnel */
  status: "new" | "ready" | "sent" | "viewed" | "interview" | "rejected" | "no_response";
  /** ID of the generated CV, null if no CV has been created yet */
  cvId?: string | null;
  /** ID of the CvProfile used when generating the CV */
  cvProfileId?: string | null;
  createdAt: string;
};

const JOBS_FILE = path.join(DATA_DIR, "jobs.json");

// Load jobs from disk once at module startup
const JOBS: Map<string, Job> = new Map(
  readJson<Job[]>(JOBS_FILE, []).map((j) => [j.id, j])
);

/** Serialises the entire jobs map to disk. */
function persistJobs() {
  writeJson(JOBS_FILE, Array.from(JOBS.values()));
}

/** Inserts one or more jobs, assigning ids and timestamps, then persists. */
export function insertJobs(jobs: Omit<Job, "id" | "createdAt">[]): Job[] {
  const inserted: Job[] = [];
  for (const j of jobs) {
    const id = randomUUID();
    const job: Job = { ...j, id, status: j.status ?? "new", cvId: null, createdAt: new Date().toISOString() };
    JOBS.set(id, job);
    inserted.push(job);
  }
  persistJobs();
  return inserted;
}

/** Returns all jobs sorted by creation date descending (newest first). */
export function listJobs(): Job[] {
  return Array.from(JOBS.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Applies a partial patch to an existing job and persists. Returns null if not found. */
export function updateJob(id: string, patch: Partial<Job>): Job | null {
  const job = JOBS.get(id);
  if (!job) return null;
  const updated = { ...job, ...patch };
  JOBS.set(id, updated);
  persistJobs();
  return updated;
}

/** Removes a job by id and persists. Returns true if the job existed. */
export function deleteJob(id: string): boolean {
  const existed = JOBS.delete(id);
  if (existed) persistJobs();
  return existed;
}

// ---------------------------------------------------------------------------
// CvDocument — structured CV content snapshot (persisted); used for preview + edit
// ---------------------------------------------------------------------------

export type CvDocument = {
  id: string;          // same id as the PDF cvId stored on the Job
  jobId: string;
  profileId: string;   // base profile id at generation time
  cvProfileId: string; // which CvProfile was used
  title: string;       // job title from CvProfile — shown below candidate name; editable
  summary: string;     // tailored summary from CvProfile — editable per application
  skills: string[];    // tailored skills from CvProfile — editable per application
  updatedAt: string;
};

const CV_DOCUMENTS_FILE = path.join(DATA_DIR, "cv-documents.json");

// Load all CvDocuments from disk once at module startup
const CV_DOCUMENTS: Map<string, CvDocument> = new Map(
  readJson<CvDocument[]>(CV_DOCUMENTS_FILE, []).map((d) => [d.id, d])
);

/** Serialises all CvDocuments to disk. */
function persistCvDocuments() {
  writeJson(CV_DOCUMENTS_FILE, Array.from(CV_DOCUMENTS.values()));
}

/** Stores a new CvDocument and persists to disk. Returns the stored document. */
export function storeCvDocument(doc: CvDocument): CvDocument {
  CV_DOCUMENTS.set(doc.id, doc);
  persistCvDocuments();
  return doc;
}

/** Returns a CvDocument by id, or null if not found. */
export function getCvDocument(id: string): CvDocument | null {
  return CV_DOCUMENTS.get(id) ?? null;
}

/** Applies a partial patch to an existing CvDocument and persists. Returns null if not found. */
export function updateCvDocument(
  id: string,
  patch: Partial<Pick<CvDocument, "title" | "summary" | "skills">>
): CvDocument | null {
  const existing = CV_DOCUMENTS.get(id);
  if (!existing) return null;
  const updated: CvDocument = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  CV_DOCUMENTS.set(id, updated);
  persistCvDocuments();
  return updated;
}

// ---------------------------------------------------------------------------
// CV — generated PDF bytes (in-memory only; lost on server restart)
// ---------------------------------------------------------------------------

type CV = {
  id: string;
  jobId: string;
  profileId: string | null;
  pdfBytes: Uint8Array;
  createdAt: string;
};

// CVs live only in RAM — persisting large binary blobs to JSON is impractical.
const CVS: Map<string, CV> = new Map();

/**
 * Stores generated PDF bytes in memory under the given id (or a new UUID if omitted).
 * Links the CV id back to the job record so the dashboard can serve a download link.
 */
export function storeCV(
  jobId: string,
  profileId: string | null,
  pdfBytes: Uint8Array,
  existingId?: string
): string {
  const id = existingId ?? randomUUID();
  CVS.set(id, { id, jobId, profileId, pdfBytes, createdAt: new Date().toISOString() });
  // Keep the job's cvId in sync so the dashboard can show a download link
  const job = JOBS.get(jobId);
  if (job) job.cvId = id;
  return id;
}

/** Retrieves a stored CV by id, or null if it does not exist (or server was restarted). */
export function getCV(id: string): CV | null {
  return CVS.get(id) ?? null;
}

// ---------------------------------------------------------------------------
// Dev utilities
// ---------------------------------------------------------------------------

/** Wipes all in-memory data and flushes empty JSON files to disk. Useful for testing. */
export function clearAllForDev() {
  PROFILE = null;
  KEYWORDS.titles = [];
  KEYWORDS.skills = [];
  delete KEYWORDS.location;
  JOBS.clear();
  CVS.clear();
  CV_PROFILES.clear();
  CV_DOCUMENTS.clear();
  persistJobs();
  persistCvProfiles();
  persistCvDocuments();
}
