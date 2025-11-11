// src/lib/server/db.ts
// simples "banco" em memória para MVP (server-side only)
// Agora com persistência em arquivo para `keywords` (data/keywords.json)
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

type Profile = {
  id: string;
  name?: string;
  email?: string;
  position?: string;
  skills?: string;
  experience?: string;
  education?: string;
};

export type Job = {
  id: string;
  title: string;
  company: string;
  location?: string;
  description?: string;
  source: string;
  url?: string;
  status: "new" | "ready" | "sent" | "rejected" | "in_process";
  cvId?: string | null; // id do CV gerado, se houver
  createdAt: string;
};

type CV = {
  id: string;
  jobId: string;
  profileId: string | null;
  pdfBytes: Uint8Array;
  createdAt: string;
};
const PROFILE: { value: Profile | null } = { value: null };
// KEYWORDS now persists to data/keywords.json with shape { titles: string[], skills: string[], location?: string }
const KEYWORDS: { titles: string[]; skills: string[]; location?: string } = { titles: [], skills: [] };
const KEYWORDS_FILE = path.resolve(process.cwd(), "data", "keywords.json");

// carregar keywords do arquivo (se existir) durante inicialização
try {
  if (fs.existsSync(KEYWORDS_FILE)) {
    const raw = fs.readFileSync(KEYWORDS_FILE, "utf8");
    const parsed = JSON.parse(raw || "{}");
    if (parsed && typeof parsed === "object") {
      if (Array.isArray(parsed.titles)) KEYWORDS.titles = parsed.titles;
      if (Array.isArray(parsed.skills)) KEYWORDS.skills = parsed.skills;
      if (typeof parsed.location === "string") KEYWORDS.location = parsed.location;
    }
  }
} catch (e) {
  // ignore errors reading file on startup
}
const JOBS: Map<string, Job> = new Map();
const CVS: Map<string, CV> = new Map();
const JOBS_FILE = path.resolve(process.cwd(), "data", "jobs.json");

// Load jobs from file on startup
try {
  if (fs.existsSync(JOBS_FILE)) {
    const raw = fs.readFileSync(JOBS_FILE, "utf8");
    const arr = JSON.parse(raw || "[]");
    if (Array.isArray(arr)) {
      for (const job of arr) {
        if (job && job.id) JOBS.set(job.id, job);
      }
    }
  }
} catch (e) {
  // ignore errors reading jobs file
}

export function getProfile() {
  return PROFILE.value;
}
export function setProfile(p: Partial<Profile>) {
  const id = PROFILE.value?.id ?? randomUUID();
  PROFILE.value = { ...(PROFILE.value ?? { id }), ...p };
  return PROFILE.value;
}
export function getKeywords() {
  return { ...KEYWORDS };
}
export function setKeywords(payload: { titles?: string[]; skills?: string[]; location?: string }) {
  if (payload.titles) KEYWORDS.titles = payload.titles;
  if (payload.skills) KEYWORDS.skills = payload.skills;
  if (typeof payload.location === "string") KEYWORDS.location = payload.location;

  // persistir em arquivo
  try {
    const dir = path.resolve(process.cwd(), "data");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(KEYWORDS, null, 2), "utf8");
  } catch (e) {
    // non-fatal: keep in-memory state
  }

  return getKeywords();
}

function persistJobs() {
  try {
    const dir = path.resolve(process.cwd(), "data");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(JOBS_FILE, JSON.stringify(Array.from(JOBS.values()), null, 2), "utf8");
  } catch (e) {
    // non-fatal
  }
}

export function insertJobs(jobs: Omit<Job, "id" | "createdAt">[]) {
  const inserted: Job[] = [];
  for (const j of jobs) {
    const id = randomUUID();
    const job: Job = {
      id,
      ...j,
      status: j.status ?? "new",
      cvId: null,
      createdAt: new Date().toISOString(),
    };
    JOBS.set(id, job);
    inserted.push(job);
  }
  persistJobs();
  return inserted;
}

export function listJobs() {
  return Array.from(JOBS.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function updateJob(id: string, patch: Partial<Job>) {
  const job = JOBS.get(id);
  if (!job) return null;
  const updated = { ...job, ...patch };
  JOBS.set(id, updated);
  persistJobs();
  return updated;
}

export function deleteJob(id: string) {
  const existed = JOBS.delete(id);
  if (existed) persistJobs();
  return existed;
}

export function storeCV(jobId: string, profileId: string | null, pdfBytes: Uint8Array) {
  const id = randomUUID();
  const cv: CV = { id, jobId, profileId, pdfBytes, createdAt: new Date().toISOString() };
  CVS.set(id, cv);
  // link CV ID into job
  const job = JOBS.get(jobId);
  if (job) job.cvId = id;
  return id;
}

export function getCV(id: string) {
  return CVS.get(id) ?? null;
}

export function clearAllForDev() {
  PROFILE.value = null;
  KEYWORDS.titles = [];
  KEYWORDS.skills = [];
  JOBS.clear();
  CVS.clear();
  persistJobs();
}
