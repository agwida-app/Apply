import { db } from "./db";
import { encrypt } from "./crypto";
import { logEvent } from "./events";

/** إنشاء/تحديث العميل بعد تسجيل الدخول بفيسبوك */
export async function upsertUserFromFacebook(me: { id: string; name: string; email: string | null; picture: string | null }, userToken: string, isDemo = false) {
  const existing = await db.user.findUnique({ where: { fbUserId: me.id } });
  if (existing) {
    return db.user.update({
      where: { id: existing.id },
      data: { name: me.name, email: me.email ?? existing.email, avatarUrl: me.picture, fbUserToken: encrypt(userToken), lastLoginAt: new Date() },
    });
  }
  const trialDays = Number(process.env.TRIAL_DAYS ?? 0);
  const user = await db.user.create({
    data: {
      fbUserId: me.id, name: me.name, email: me.email, avatarUrl: me.picture, fbUserToken: encrypt(userToken), isDemo,
      ...(trialDays > 0 ? { subscriptionStatus: "trialing", subscriptionEndsAt: new Date(Date.now() + trialDays * 86400e3) } : {}),
    },
  });
  await logEvent("info", "auth", `عميل جديد: ${me.name}`, user.id);
  return user;
}
