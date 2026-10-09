import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, getMe } from "@/lib/meta";
import { setSession } from "@/lib/session";
import { upsertUserFromFacebook } from "@/lib/users";
import { logEvent } from "@/lib/events";

export async function GET(req: NextRequest) {
  const app = process.env.APP_URL!;
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state || state !== req.cookies.get("fb_oauth_state")?.value) {
    return NextResponse.redirect(`${app}/login?error=oauth`);
  }
  try {
    const token = await exchangeCode(code);
    const me = await getMe(token);
    const user = await upsertUserFromFacebook(me, token);
    if (user.status === "suspended") return NextResponse.redirect(`${app}/login?error=suspended`);
    await setSession({ role: "client", userId: user.id });
    const res = NextResponse.redirect(`${app}/dashboard`);
    res.cookies.delete("fb_oauth_state");
    return res;
  } catch (e) {
    await logEvent("error", "auth", `فشل تسجيل الدخول بفيسبوك: ${(e as Error).message}`);
    return NextResponse.redirect(`${app}/login?error=oauth`);
  }
}
