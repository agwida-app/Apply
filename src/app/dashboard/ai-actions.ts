"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { aiAvailable, generateAiReply, TONES } from "@/lib/ai";
import { startOfMonth } from "@/lib/engine";
import { limitsFor } from "@/lib/plans";
import { requireUser } from "@/lib/session";

export async function saveAiSettings(form: FormData) {
  const user = await requireUser();
  const tone = String(form.get("tone"));
  await db.user.update({ where: { id: user.id }, data: {
    businessInfo: String(form.get("businessInfo") ?? "").slice(0, 8000) || null,
    aiTone: TONES[tone] ? tone : "friendly",
  } });
  revalidatePath("/dashboard/ai");
}

// حد بسيط لتجارب الرد الذكي لكل عميل يومياً (حماية من الاستهلاك المفرط)
const TEST_LIMIT_PER_DAY = 30;
const tests = new Map<string, { day: string; n: number }>();

/** تجربة الرد الذكي على تعليق تجريبي */
export async function testAiReply(input: { businessInfo: string; tone: string; comment: string; name: string; platform: string }) {
  const user = await requireUser();
  if (!aiAvailable()) return { error: "الرد الذكي غير مفعّل على الخادم بعد." };
  const limit = limitsFor(user).aiRepliesPerMonth;
  const used = await db.replyLog.count({ where: { userId: user.id, aiUsed: true, createdAt: { gte: startOfMonth() } } });
  if (used >= limit) return { error: limit ? "انتهى رصيد الردود الذكية لهذا الشهر." : "باقتك لا تشمل الرد الذكي. رقِّ إلى الاحترافية أو الأعمال." };
  if (!input.comment.trim()) return { error: "اكتب تعليقاً للتجربة." };
  const day = new Date().toISOString().slice(0, 10);
  const t = tests.get(user.id);
  const n = t?.day === day ? t.n : 0;
  if (n >= TEST_LIMIT_PER_DAY) return { error: "وصلت لحد التجارب اليومي، حاول غداً." };
  tests.set(user.id, { day, n: n + 1 });
  try {
    const r = await generateAiReply({
      platform: input.platform, businessInfo: input.businessInfo.slice(0, 8000), tone: input.tone, postText: null,
      commenterName: input.name.slice(0, 60) || null, comment: input.comment.slice(0, 500),
      wantPublic: true, wantDm: input.platform !== "tiktok", publicMax: input.platform === "tiktok" ? 150 : 2000,
    });
    return { result: r };
  } catch (e) {
    return { error: "تعذر توليد الرد: " + (e as Error).message };
  }
}
