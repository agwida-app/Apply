import { NextRequest, NextResponse } from "next/server";
import { processDue } from "@/lib/engine";
import { safeEqual } from "@/lib/crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new NextResponse("unauthorized", { status: 401 });
  const n = await processDue();
  return NextResponse.json({ processed: n });
}
