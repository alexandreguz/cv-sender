// src/app/api/jobs/route.ts
import { NextResponse } from "next/server";
import { listJobs, updateJob } from "@/lib/server/db";

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
