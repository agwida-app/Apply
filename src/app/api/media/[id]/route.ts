import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const m = await db.media.findUnique({ where: { id } });
  if (!m) return new NextResponse("not found", { status: 404 });
  return new NextResponse(new Uint8Array(m.data), {
    headers: { "Content-Type": m.mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}
