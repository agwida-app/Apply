import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { tiktokConfigured, tiktokDemo, tiktokOauthUrl } from "@/lib/tiktok";
import { saveTikTokAccount } from "@/lib/tiktok-connect";

export async function GET() {
  const app = process.env.APP_URL!;
  const s = await getSession();
  if (!s || s.role !== "client") return NextResponse.redirect(`${app}/login`);

  // الوضع التجريبي: حساب تيك توك وهمي بدون الاتصال بتيك توك
  if (tiktokDemo()) {
    const err = await saveTikTokAccount(s.userId, { accessToken: "demo:tiktok", refreshToken: "demo:tiktok", openId: `demo-tt-${s.userId}`, scope: "", expiresAt: new Date(Date.now() + 365 * 86400e3) },
      { username: "elegance.store", displayName: "متجر الأناقة (تجريبي)", avatar: null });
    return NextResponse.redirect(`${app}/dashboard/accounts?${err ? `error=${err}` : "ok=1"}`);
  }
  if (!tiktokConfigured()) return NextResponse.redirect(`${app}/dashboard/accounts?error=tiktok_not_configured`);

  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(tiktokOauthUrl(state));
  res.cookies.set("tt_oauth_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/", secure: process.env.NODE_ENV === "production" });
  return res;
}
