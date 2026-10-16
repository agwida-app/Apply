import { db } from "./db";
import { logEvent } from "./events";
import { classifyError, replyMaxLength, sendPrivateReply, sendPublicReply, supportsPrivateReply } from "./platforms";
import { aiAvailable, generateAiReply } from "./ai";
import { hasActiveSubscription, limitsFor } from "./plans";
import { matchesKeywords, parseList, pick, renderTemplate } from "./text";

export type IncomingComment = {
  platform: "facebook" | "instagram" | "tiktok";
  accountId: string; // Page ID أو IG ID أو TikTok open_id
  commentId: string;
  postId: string;
  parentId?: string | null;
  fromId?: string | null;
  fromName?: string | null;
  text: string;
};

const MAX_ATTEMPTS = 3;

export function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** يُستدعى لكل تعليق جديد يصل من الـ Webhook (أو من المحاكاة في الوضع التجريبي) */
export async function handleIncomingComment(c: IncomingComment) {
  const page = await db.page.findUnique({
    where: { platform_externalId: { platform: c.platform, externalId: c.accountId } },
    include: { user: true },
  });
  if (!page || !page.active) return { skipped: "no_page" };

  // تجاهل تعليقات الصفحة نفسها (يمنع الحلقات اللانهائية)
  if (c.fromId && (c.fromId === page.externalId || c.fromId === page.fbPageId)) return { skipped: "own_comment" };
  // تجاهل الردود داخل سلسلة تعليق (نرد فقط على التعليقات الرئيسية)
  if (c.parentId && c.parentId !== c.postId) return { skipped: "nested_reply" };

  const rule = await db.rule.findUnique({ where: { pageId_postId: { pageId: page.id, postId: c.postId } } });
  if (!rule || !rule.enabled) return { skipped: "no_rule" };

  const base = {
    userId: page.userId, pageId: page.id, ruleId: rule.id, commentId: c.commentId,
    commenterId: c.fromId ?? null, commenterName: c.fromName ?? null, commentText: c.text.slice(0, 2000),
  };
  const skip = async (reason: string) => {
    await db.replyLog.upsert({ where: { commentId: c.commentId }, update: {}, create: { ...base, status: "skipped", skipReason: reason, processedAt: new Date() } });
    return { skipped: reason };
  };

  if (page.user.status !== "active") return skip("account_suspended");
  if (!hasActiveSubscription(page.user)) {
    await logEvent("warn", "engine", `تعليق تم تجاهله لأن الاشتراك غير نشط (${page.name})`, page.userId);
    return skip("subscription_inactive");
  }
  const used = await db.replyLog.count({ where: { userId: page.userId, status: { in: ["done", "partial"] }, createdAt: { gte: startOfMonth() } } });
  if (used >= limitsFor(page.user).repliesPerMonth) {
    await logEvent("warn", "engine", `تم الوصول للحد الشهري من الردود`, page.userId);
    return skip("quota_exceeded");
  }
  if (!matchesKeywords(c.text, parseList(rule.keywords))) return skip("keyword_mismatch");
  if (rule.oncePerUser && c.fromId) {
    const prev = await db.replyLog.findFirst({ where: { ruleId: rule.id, commenterId: c.fromId, status: { in: ["done", "partial", "pending", "processing"] } } });
    if (prev) return skip("already_replied");
  }

  // commentId فريد: إعادة إرسال نفس الـ Webhook من فيسبوك لا تُنتج رداً مكرراً
  const existing = await db.replyLog.findUnique({ where: { commentId: c.commentId } });
  if (existing) return { skipped: "duplicate" };
  const log = await db.replyLog.create({ data: { ...base, status: "pending", runAt: new Date(Date.now() + rule.delaySeconds * 1000) } });

  if (rule.delaySeconds === 0) await processLog(log.id);
  return { queued: log.id };
}

/** تنفيذ الرد لسجل واحد. آمن ضد التنفيذ المزدوج عبر "حجز" السجل أولاً */
export async function processLog(id: string) {
  const claimed = await db.replyLog.updateMany({ where: { id, status: "pending" }, data: { status: "processing", attempts: { increment: 1 } } });
  if (claimed.count === 0) return;
  const log = await db.replyLog.findUniqueOrThrow({ where: { id }, include: { rule: true, page: { include: { user: true } } } });
  const { rule, page } = log;
  if (!rule) {
    await db.replyLog.update({ where: { id }, data: { status: "skipped", skipReason: "rule_deleted", processedAt: new Date() } });
    return;
  }

  const vars = { name: log.commenterName };
  const errors: string[] = [];
  let authError = false;
  let retryable = false;

  const run = async (enabled: boolean, done: string | null, fn: () => Promise<void>) => {
    if (!enabled) return "off";
    if (done === "sent") return "sent"; // لا تُعِد إرسال ما نجح في محاولة سابقة
    try {
      await fn();
      return "sent";
    } catch (e) {
      const c = classifyError(e);
      errors.push(c.message);
      if (c.auth) authError = true;
      else if (c.retryable) retryable = true;
      return "failed";
    }
  };

  const wantPublic = rule.publicReply;
  const wantDm = rule.privateReply && supportsPrivateReply(page.platform);

  // الرد الذكي: نولّده مرة واحدة ونحفظه، فإعادة المحاولة ترسل نفس النص
  let aiPublic = log.aiPublicText, aiDm = log.aiDmText;
  if (rule.aiMode && !log.aiUsed && aiAvailable()) {
    const used = await db.replyLog.count({ where: { userId: log.userId, aiUsed: true, createdAt: { gte: startOfMonth() } } });
    if (used < limitsFor(page.user).aiRepliesPerMonth) {
      try {
        const ai = await generateAiReply({
          platform: page.platform, businessInfo: page.user.businessInfo ?? "", tone: page.user.aiTone,
          postText: rule.postPreview, commenterName: log.commenterName, comment: log.commentText ?? "",
          wantPublic, wantDm, publicMax: replyMaxLength(page.platform),
        });
        if (!ai.shouldReply) {
          await db.replyLog.update({ where: { id }, data: { status: "skipped", skipReason: "ai_skipped", aiUsed: true, processedAt: new Date() } });
          return;
        }
        aiPublic = ai.publicReply || null;
        aiDm = ai.dmMessage || null;
        await db.replyLog.update({ where: { id }, data: { aiUsed: true, aiPublicText: aiPublic, aiDmText: aiDm } });
      } catch (e) {
        await logEvent("warn", "ai", `تعذر الرد الذكي، تم استخدام الرد الثابت: ${(e as Error).message}`, log.userId);
      }
    }
  }

  const template = pick(parseList(rule.replyVariants));
  const publicText = aiPublic ?? (template ? renderTemplate(template, vars) : null);
  const dmText = aiDm ?? (rule.dmMessage?.trim() ? renderTemplate(rule.dmMessage, vars) : null);
  const publicStatus = await run(wantPublic && !!publicText, log.publicStatus, () => sendPublicReply(page, rule.postId, log.commentId, publicText!));
  const privateStatus = await run(wantDm && !!dmText, log.privateStatus, () => sendPrivateReply(page, log.commentId, dmText!));

  const sent = [publicStatus, privateStatus].filter((s) => s === "sent").length;
  const failed = [publicStatus, privateStatus].filter((s) => s === "failed").length;

  if (failed && retryable && !authError && log.attempts < MAX_ATTEMPTS) {
    await db.replyLog.update({
      where: { id },
      data: { status: "pending", publicStatus, privateStatus, error: errors.join(" | "), runAt: new Date(Date.now() + 60_000 * log.attempts) },
    });
    return;
  }

  const status = failed === 0 ? "done" : sent > 0 ? "partial" : "failed";
  await db.replyLog.update({
    where: { id },
    data: { status, publicStatus, privateStatus, error: errors.length ? errors.join(" | ") : null, processedAt: new Date() },
  });

  if (authError) {
    await db.page.update({ where: { id: page.id }, data: { health: "error", lastError: "انتهت صلاحية الربط أو تم سحب الأذونات. أعد ربط الحساب." } });
    await logEvent("error", "engine", `خطأ صلاحيات في ${page.name}: ${errors.join(" | ")}`, page.userId);
  } else if (failed) {
    await logEvent("error", "engine", `فشل الرد على تعليق في ${page.name}: ${errors.join(" | ")}`, page.userId);
  } else if (page.health !== "ok") {
    await db.page.update({ where: { id: page.id }, data: { health: "ok", lastError: null } });
  }
}

/** معالجة المهام المؤجلة المستحقة (يستدعيها الـ cron أو الـ worker) */
export async function processDue(limit = 50) {
  // استرجاع المهام العالقة (توقف السيرفر أثناء المعالجة)
  await db.replyLog.updateMany({
    where: { status: "processing", runAt: { lt: new Date(Date.now() - 10 * 60_000) }, attempts: { lt: MAX_ATTEMPTS } },
    data: { status: "pending" },
  });
  const due = await db.replyLog.findMany({ where: { status: "pending", runAt: { lte: new Date() } }, orderBy: { runAt: "asc" }, take: limit, select: { id: true } });
  for (const { id } of due) {
    try {
      await processLog(id);
    } catch (e) {
      await logEvent("error", "engine", `processLog ${id}: ${(e as Error).message}`);
    }
  }
  return due.length;
}
