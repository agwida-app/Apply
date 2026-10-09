import { db } from "./db";
import { decrypt } from "./crypto";
import { logEvent } from "./events";
import { MetaError, replyPrivate, replyPublic } from "./meta";
import { hasActiveSubscription, limitsFor } from "./plans";
import { matchesKeywords, parseList, pick, renderTemplate } from "./text";

export type IncomingComment = {
  platform: "facebook" | "instagram";
  accountId: string; // Page ID أو IG ID
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
  const log = await db.replyLog.findUniqueOrThrow({ where: { id }, include: { rule: true, page: true } });
  const { rule, page } = log;
  if (!rule) {
    await db.replyLog.update({ where: { id }, data: { status: "skipped", skipReason: "rule_deleted", processedAt: new Date() } });
    return;
  }

  const acc = { platform: page.platform, fbPageId: page.fbPageId, accessToken: decrypt(page.accessToken) };
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
      const err = e instanceof MetaError ? e : new MetaError(String((e as Error)?.message ?? e));
      errors.push(err.message);
      if (err.isAuthError) authError = true;
      else if (err.code === undefined || err.code === 1 || err.code === 2 || err.code === 4 || err.code === 17 || err.code === 32 || err.code === 613) retryable = true;
      return "failed";
    }
  };

  const variants = parseList(rule.replyVariants);
  const publicText = pick(variants);
  const publicStatus = await run(rule.publicReply && !!publicText, log.publicStatus, () => replyPublic(acc, log.commentId, renderTemplate(publicText!, vars)));
  const privateStatus = await run(rule.privateReply && !!rule.dmMessage?.trim(), log.privateStatus, () => replyPrivate(acc, log.commentId, renderTemplate(rule.dmMessage!, vars)));

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
