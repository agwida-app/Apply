import { NextRequest, NextResponse } from "next/server";
import { logEvent } from "@/lib/events";
import { getSession } from "@/lib/session";
import { exchangeTikTokCode, getTikTokProfile, hasRequiredScopes, subscribeTikTokWebhook } from "@/lib/tiktok";
import { saveTikTokAccount } from "@/lib/tiktok-connect";

export async function GET(req: NextRequest) {
  const app = process.env.APP_URL!;
  const back = (q: string) => {
    const res = NextResponse.redirect(`${app}/dashboard/accounts?${q}`);
    res.cookies.delete("tt_oauth_state");
    return res;
  };
  const s = await getSession();
  if (!s || s.role !== "client") return NextResponse.redirect(`${app}/login`);
  const code = req.nextUrl.searchParams.get("code") ?? req.nextUrl.searchParams.get("auth_code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state || state !== req.cookies.get("tt_oauth_state")?.value) return back("error=tiktok_oauth");

  try {
    const t = await exchangeTikTokCode(code);
    if (!hasRequiredScopes(t.scope)) return back("error=tiktok_scopes");
    const profile = await getTikTokProfile(t.accessToken, t.openId);
    const err = await saveTikTokAccount(s.userId, t, profile);
    if (err) return back(`error=${err === "subscription" ? "subscribe" : err}`);
    // الـ Webhook على مستوى التطبيق: تحديثه عند كل ربط آمن ويضمن أن الرابط صحيح
    await subscribeTikTokWebhook().catch((e) => logEvent("error", "auth", `فشل تفعيل Webhook تيك توك: ${(e as Error).message}`, s.userId));
    return back("ok=1");
  } catch (e) {
    await logEvent("error", "auth", `فشل ربط تيك توك: ${(e as Error).message}`, s.userId);
    return back("error=tiktok_oauth");
  }
}
