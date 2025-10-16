// src/app/api/profile/route.ts
import { NextResponse } from "next/server";
import { getProfile, setProfile } from "@/lib/server/db";

export async function GET() {
  const profile = getProfile();
  return NextResponse.json(profile ?? { message: "Nenhum perfil salvo" });
}

export async function POST(req: Request) {
  const data = await req.json();
  const saved = setProfile(data);
  return NextResponse.json({ message: "Perfil salvo", profile: saved });
}
