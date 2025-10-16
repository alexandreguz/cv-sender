// src/app/api/keywords/route.ts
import { NextResponse } from "next/server";
import { getKeywords, setKeywords } from "@/lib/server/db";

export async function GET() {
  return NextResponse.json(getKeywords());
}

export async function POST(req: Request) {
  const payload = await req.json();
  // expected { titles?: string[], skills?: string[] }
  const updated = setKeywords(payload);
  return NextResponse.json({ message: "Keywords atualizadas", keywords: updated });
}
