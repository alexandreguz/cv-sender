// src/app/api/jobs/route.ts
import { NextResponse } from "next/server";
import { listJobs, updateJob, insertJobs, deleteJob } from "@/lib/server/db";

export async function GET() {
  const jobs = listJobs();
  return NextResponse.json(jobs);
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, patch } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const updated = updateJob(id, patch);
  if (!updated) return NextResponse.json({ error: "job not found" }, { status: 404 });
  return NextResponse.json({ message: "updated", job: updated });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Accept either a single job object or an array of job objects
    const jobs = Array.isArray(body) ? body : [body];
    const inserted = insertJobs(jobs);
    // return single object when one created, otherwise the array
    return NextResponse.json(inserted.length === 1 ? inserted[0] : inserted, { status: 201 });
  } catch (err) {
    console.error("/api/jobs POST error", err);
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  let id: string | null = null;
  try {
    const body = await req.json().catch(() => null);
    if (body && typeof body.id === "string") {
      id = body.id;
    }
  } catch {
    // ignore body parse errors
  }

  if (!id) {
    const { searchParams } = new URL(req.url);
    id = searchParams.get("id");
  }

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const removed = deleteJob(id);
  if (!removed) {
    return NextResponse.json({ error: "job not found" }, { status: 404 });
  }

  return NextResponse.json({ message: "deleted", id });
}
