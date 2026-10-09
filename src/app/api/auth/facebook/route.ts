import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { oauthUrl } from "@/lib/meta";

export function GET() {
  if (!process.env.META_APP_ID) return NextResponse.redirect(`${process.env.APP_URL}/login?error=not_configured`);
  const state = crypto.randomBytes(16).toString("hex");
  const res = NextResponse.redirect(oauthUrl(state));
  res.cookies.set("fb_oauth_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/", secure: process.env.NODE_ENV === "production" });
  return res;
}
