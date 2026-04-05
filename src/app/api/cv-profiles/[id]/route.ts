// GET    /api/cv-profiles/[id] — fetch a single CV profile by id
// PATCH  /api/cv-profiles/[id] — partially update a CV profile
// DELETE /api/cv-profiles/[id] — permanently remove a CV profile
import { NextResponse } from "next/server";
import { getCvProfile, updateCvProfile, deleteCvProfile } from "@/lib/server/db";

type Params = { params: Promise<{ id: string }> };

/** Returns a single CV profile. Responds with 404 if the id does not exist. */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const profile = getCvProfile(id);
  if (!profile) {
    return NextResponse.json({ message: "CV profile not found" }, { status: 404 });
  }
  return NextResponse.json(profile);
}

/** Applies a partial patch to the CV profile and returns the updated record. */
export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const updated = updateCvProfile(id, body);
  if (!updated) {
    return NextResponse.json({ message: "CV profile not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

/** Permanently deletes a CV profile from memory and disk. */
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const deleted = deleteCvProfile(id);
  if (!deleted) {
    return NextResponse.json({ message: "CV profile not found" }, { status: 404 });
  }
  return NextResponse.json({ message: "CV profile deleted" });
}
