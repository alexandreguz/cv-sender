// src/lib/server/db.ts
// simples "banco" em memória para MVP (server-side only)
import { randomUUID } from "crypto";

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
const KEYWORDS: { titles: string[]; skills: string[] } = { titles: [], skills: [] };
const JOBS: Map<string, Job> = new Map();
const CVS: Map<string, CV> = new Map();

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
export function setKeywords(payload: { titles?: string[]; skills?: string[] }) {
  if (payload.titles) KEYWORDS.titles = payload.titles;
  if (payload.skills) KEYWORDS.skills = payload.skills;
  return getKeywords();
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
  return updated;
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
}
