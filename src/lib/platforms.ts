/** طبقة موحّدة فوق فيسبوك/إنستغرام (Meta) وتيك توك */
import type { Page } from "@prisma/client";
import { db } from "./db";
import { decrypt, encrypt } from "./crypto";
import { findPostByUrl, listPosts, MetaError, Post, replyPrivate, replyPublic, sendMessage } from "./meta";
import { buildMessages, firstText, payloadFor, TemplateData } from "./messenger";
import { findTikTokVideoByUrl, listTikTokVideos, refreshTikTokTokens, replyTikTokComment, TikTokError, TIKTOK_REPLY_MAX } from "./tiktok";

export const PLATFORM_LABEL: Record<string, string> = { facebook: "فيسبوك", instagram: "إنستغرام", tiktok: "تيك توك" };

/** هل تسمح المنصة بإرسال رسالة خاصة رداً على تعليق؟ */
export const supportsPrivateReply = (platform: string) => platform !== "tiktok";
export const replyMaxLength = (platform: string) => (platform === "tiktok" ? TIKTOK_REPLY_MAX : 2000);

/** توكن صالح للاستخدام؛ توكن تيك توك يُجدَّد تلقائياً قبل انتهائه (صلاحيته 24 ساعة) */
export async function accessTokenFor(page: Page): Promise<string> {
  const token = decrypt(page.accessToken);
  if (page.platform !== "tiktok" || token.startsWith("demo:") || !page.refreshToken) return token;
  if (page.tokenExpiresAt && page.tokenExpiresAt.getTime() > Date.now() + 10 * 60_000) return token;
  const t = await refreshTikTokTokens(decrypt(page.refreshToken));
  await db.page.update({ where: { id: page.id }, data: { accessToken: encrypt(t.accessToken), refreshToken: encrypt(t.refreshToken), tokenExpiresAt: t.expiresAt } });
  return t.accessToken;
}

export async function listPostsFor(page: Page): Promise<Post[]> {
  const token = await accessTokenFor(page);
  if (page.platform === "tiktok") return listTikTokVideos(token, page.externalId, 2);
  return listPosts({ platform: page.platform, externalId: page.externalId, accessToken: token });
}

export async function findPostFor(page: Page, url: string): Promise<Post | null> {
  const token = await accessTokenFor(page);
  if (page.platform === "tiktok") return findTikTokVideoByUrl(token, page.externalId, url);
  return findPostByUrl({ platform: page.platform, externalId: page.externalId, accessToken: token }, url);
}

export async function sendPublicReply(page: Page, postId: string, commentId: string, text: string) {
  const token = await accessTokenFor(page);
  if (page.platform === "tiktok") return replyTikTokComment(token, page.externalId, postId, commentId, text);
  return replyPublic({ platform: page.platform, accessToken: token }, commentId, text);
}

export async function sendPrivateReply(page: Page, commentId: string, text: string) {
  if (!supportsPrivateReply(page.platform)) throw new Error("المنصة لا تدعم الرسائل الخاصة");
  return replyPrivate({ fbPageId: page.fbPageId, accessToken: await accessTokenFor(page) }, commentId, text);
}

/** تصنيف الخطأ: هل هو صلاحيات (يحتاج إعادة ربط)، وهل تجوز إعادة المحاولة؟ */
export function classifyError(e: unknown): { message: string; auth: boolean; retryable: boolean } {
  if (e instanceof TikTokError) {
    // الرد في تيك توك ليس آمناً عند التكرار: نعيد المحاولة فقط عند تجاوز معدل الطلبات
    return { message: e.message, auth: e.isAuthError, retryable: e.isRateLimited };
  }
  if (e instanceof MetaError) {
    return { message: e.message, auth: e.isAuthError, retryable: e.code === undefined || [1, 2, 4, 17, 32, 613].includes(e.code) };
  }
  return { message: e instanceof Error ? e.message : String(e), auth: false, retryable: true };
}

/** إرسال رسالة تفاعلية كاملة لزبون راسل الصفحة (خلال نافذة الـ 24 ساعة) */
export async function sendTemplateToUser(page: Page, userId: string, t: TemplateData, from = 0) {
  const acc = { fbPageId: page.fbPageId, accessToken: await accessTokenFor(page) };
  for (const m of buildMessages(t, page.platform, from)) await sendMessage(acc, { id: userId }, m);
}

/**
 * رد خاص على تعليق برسالة تفاعلية. فيسبوك يسمح برسالة واحدة فقط كرد خاص، لذلك:
 * - مع نص مقدمة (مثلاً من الذكاء الاصطناعي): نرسله مع زر «عرض التفاصيل» يفتح الرسالة التفاعلية.
 * - بدونه: نرسل أول جزء من الرسالة التفاعلية، وإن كان فيها أكثر نضيف زر «المزيد».
 * - إذا رفض فيسبوك الشكل الغني نرسل نصاً بسيطاً مع زر «عرض التفاصيل» (عند الضغط تُرسل الرسالة كاملة).
 */
export async function sendPrivateTemplate(page: Page, commentId: string, t: TemplateData, leadText?: string | null) {
  const acc = { fbPageId: page.fbPageId, accessToken: await accessTokenFor(page) };
  const showMore = (title: string, from: number) => [{ content_type: "text", title, payload: payloadFor(t.id, from) }];
  if (leadText?.trim()) {
    return sendMessage(acc, { comment_id: commentId }, { text: leadText, quick_replies: showMore("عرض التفاصيل ⬇", 0) });
  }
  const msgs = buildMessages(t, page.platform);
  if (!msgs.length) throw new Error("الرسالة التفاعلية فارغة");
  const first = { ...msgs[0] };
  if (msgs.length > 1) first.quick_replies = showMore("المزيد ⬇", 1);
  try {
    await sendMessage(acc, { comment_id: commentId }, first);
  } catch (e) {
    if (classifyError(e).auth) throw e;
    await sendMessage(acc, { comment_id: commentId }, { text: firstText(t) ?? "أهلاً بك 👋", quick_replies: showMore("عرض التفاصيل ⬇", 0) });
  }
}
