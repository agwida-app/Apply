import { db } from "./db";
import { encrypt } from "./crypto";
import { logEvent } from "./events";
import { hasActiveSubscription, limitsFor } from "./plans";
import type { TikTokTokens } from "./tiktok";

/** حفظ حساب تيك توك للعميل بعد الربط. يعيد رمز خطأ أو null */
export async function saveTikTokAccount(userId: string, t: TikTokTokens, profile: { username: string | null; displayName: string | null; avatar: string | null }) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!hasActiveSubscription(user)) return "subscription";
  const existing = await db.page.findUnique({ where: { platform_externalId: { platform: "tiktok", externalId: t.openId } } });
  if (existing && existing.userId !== userId) return "taken";
  if (!existing && (await db.page.count({ where: { userId } })) >= limitsFor(user).pages) return "limit";
  const data = {
    name: profile.username ? `@${profile.username}` : profile.displayName ?? "TikTok", pictureUrl: profile.avatar,
    accessToken: encrypt(t.accessToken), refreshToken: encrypt(t.refreshToken), tokenExpiresAt: t.expiresAt,
    health: "ok", lastError: null, active: true,
  };
  if (existing) await db.page.update({ where: { id: existing.id }, data });
  else await db.page.create({ data: { ...data, userId, platform: "tiktok", externalId: t.openId, fbPageId: t.openId } });
  await logEvent("info", "auth", `تم ربط حساب تيك توك: ${data.name}`, userId);
  return null;
}
