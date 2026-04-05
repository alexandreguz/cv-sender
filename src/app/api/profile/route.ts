// GET /api/profile  — returns the saved base personal profile (404 if none)
// POST /api/profile — saves (or merges into) the base personal profile
import { NextResponse } from "next/server";
import { getProfile, setProfile } from "@/lib/server/db";

/** Returns the current base profile from the in-memory store. */
export async function GET() {
  const profile = getProfile();
  if (!profile) {
    return NextResponse.json({ message: "No profile found" }, { status: 404 });
  }
  return NextResponse.json(profile);
}

/** Accepts a partial profile object, merges it with the existing one, and persists to disk. */
export async function POST(req: Request) {
  const data = await req.json();
  const saved = setProfile(data);
  return NextResponse.json({ message: "Profile saved", profile: saved });
}
