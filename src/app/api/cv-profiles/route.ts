// GET /api/cv-profiles  — list all CV profiles (newest first)
// POST /api/cv-profiles — create a new CV profile
import { NextResponse } from "next/server";
import { listCvProfiles, createCvProfile } from "@/lib/server/db";

/** Returns the full list of CV profiles from the in-memory store. */
export async function GET() {
  return NextResponse.json(listCvProfiles());
}

/**
 * Validates the request body and creates a new CV profile.
 * Required: title. Optional: company, summary, skills, search_keywords, platforms, is_active.
 */
export async function POST(req: Request) {
  const body = await req.json();

  if (!body.title || typeof body.title !== "string") {
    return NextResponse.json({ message: "title is required" }, { status: 400 });
  }

  const profile = createCvProfile({
    title: body.title,
    // company and url are optional — set when the profile is created from a specific job posting
    company: typeof body.company === "string" && body.company.trim() ? body.company.trim() : undefined,
    url: typeof body.url === "string" && body.url.trim() ? body.url.trim() : undefined,
    summary: body.summary ?? "",
    skills: Array.isArray(body.skills) ? body.skills : [],
    search_keywords: Array.isArray(body.search_keywords) ? body.search_keywords : [],
    platforms: Array.isArray(body.platforms) ? body.platforms : [],
    is_active: body.is_active !== false,
  });

  return NextResponse.json(profile, { status: 201 });
}
