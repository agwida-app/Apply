/**
 * TikTok API for Business (Accounts API): ربط الحساب، الفيديوهات، الرد العلني على التعليقات، والـ Webhook.
 *
 * يختلف عن Meta في:
 * - التوثيق بترويسة Access-Token، وكل الردود HTTP 200 بصيغة { code, message, data } و code != 0 = فشل.
 * - معرّفات التعليقات والفيديوهات أرقام من 19 خانة؛ JSON.parse العادي يقرّبها فتضيع، لذلك نحوّلها لنصوص قبل التحليل.
 * - توكن الوصول صالح 24 ساعة فقط ويُجدَّد بتوكن التجديد.
 * - الرد العلني محدود بـ 150 حرفاً، ولا يوجد مفتاح منع التكرار: لا نعيد المحاولة إلا عند تجاوز معدل الطلبات.
 * التوكنات التي تبدأ بـ "demo:" لا تتصل بتيك توك (الوضع التجريبي).
 */
import crypto from "node:crypto";

const API = "https://business-api.tiktok.com/open_api/v1.3";
export const TIKTOK_REPLY_MAX = 150;
export const TIKTOK_SCOPES = ["user.info.basic", "user.info.username", "video.list", "comment.list", "comment.list.manage"];
const REQUIRED_SCOPES = ["comment.list", "comment.list.manage"];

export const tiktokConfigured = () => !!(process.env.TIKTOK_APP_ID && process.env.TIKTOK_APP_SECRET);
export const tiktokDemo = () => !tiktokConfigured() && process.env.DEMO_MODE === "true";
const isDemo = (t: string) => t.startsWith("demo:");
const redirectUri = () => `${process.env.APP_URL}/api/auth/tiktok/callback`;

export class TikTokError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
  }
  get isRateLimited() { return [40016, 40100, 40133].includes(this.code ?? 0); }
  get isAuthError() { return [40001, 40102, 40103, 40104, 40105, 40107, 40125].includes(this.code ?? 0); }
}

const BIG_IDS = /(?<!\\)"(comment_id|video_id|parent_comment_id|item_id)"\s*:\s*(-?\d+)/g;
export function parseTikTokJson<T>(text: string): T {
  return JSON.parse(text.replace(BIG_IDS, '"$1":"$2"')) as T;
}

async function call<T>(path: string, opts: { method?: "GET" | "POST"; token?: string; query?: Record<string, unknown>; body?: Record<string, unknown> } = {}): Promise<T> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
  }
  let text: string;
  try {
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: { ...(opts.token ? { "Access-Token": opts.token } : {}), ...(opts.body ? { "Content-Type": "application/json" } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    text = await res.text();
  } catch (e) {
    throw new TikTokError(`TikTok ${path}: ${(e as Error).message}`);
  }
  let env: { code?: number; message?: string; data?: T };
  try {
    env = parseTikTokJson(text);
  } catch {
    throw new TikTokError(`TikTok ${path}: رد غير صالح`);
  }
  if (env.code !== 0) throw new TikTokError(env.message || `TikTok ${path} failed`, env.code);
  return (env.data ?? {}) as T;
}

// ---------- OAuth ----------
export function tiktokOauthUrl(state: string) {
  const p = new URLSearchParams({
    client_key: process.env.TIKTOK_APP_ID!, response_type: "code", scope: TIKTOK_SCOPES.join(","),
    redirect_uri: redirectUri(), state, disable_auto_auth: "1",
  });
  return `https://www.tiktok.com/v2/auth/authorize/?${p}`;
}

export type TikTokTokens = { accessToken: string; refreshToken: string; openId: string; scope: string; expiresAt: Date };
type TokenRes = { access_token?: string; refresh_token?: string; open_id?: string; scope?: string; expires_in?: number };
const toTokens = (d: TokenRes): TikTokTokens => {
  if (!d.access_token || !d.refresh_token || !d.open_id) throw new TikTokError("رد التوكن ناقص");
  return { accessToken: d.access_token, refreshToken: d.refresh_token, openId: d.open_id, scope: d.scope ?? "", expiresAt: new Date(Date.now() + (d.expires_in ?? 86400) * 1000) };
};

export async function exchangeTikTokCode(code: string) {
  return toTokens(await call<TokenRes>("tt_user/oauth2/token/", { method: "POST", body: {
    client_id: process.env.TIKTOK_APP_ID, client_secret: process.env.TIKTOK_APP_SECRET,
    grant_type: "authorization_code", auth_code: code, redirect_uri: redirectUri(),
  } }));
}

export async function refreshTikTokTokens(refreshToken: string) {
  return toTokens(await call<TokenRes>("tt_user/oauth2/refresh_token/", { method: "POST", body: {
    client_id: process.env.TIKTOK_APP_ID, client_secret: process.env.TIKTOK_APP_SECRET,
    grant_type: "refresh_token", refresh_token: refreshToken,
  } }));
}

export const hasRequiredScopes = (scope: string) => {
  const granted = new Set(scope.split(/[\s,]+/));
  return REQUIRED_SCOPES.every((s) => granted.has(s));
};

export async function getTikTokProfile(token: string, openId: string) {
  if (isDemo(token)) return { username: "elegance.store", displayName: "متجر الأناقة (تجريبي)", avatar: null as string | null };
  const d = await call<{ username?: string; display_name?: string; profile_image?: string }>("business/get/", {
    token, query: { business_id: openId, fields: ["username", "display_name", "profile_image"] },
  });
  return { username: d.username ?? null, displayName: d.display_name ?? null, avatar: d.profile_image ?? null };
}

/** اشتراك تطبيقنا في Webhook التعليقات (مرة لكل تطبيق، وآمن عند التكرار) */
export async function subscribeTikTokWebhook() {
  await call("business/webhook/update/", { method: "POST", body: {
    app_id: process.env.TIKTOK_APP_ID, secret: process.env.TIKTOK_APP_SECRET,
    event_type: "COMMENT", callback_url: `${process.env.APP_URL}/api/webhooks/tiktok`,
  } });
}

// ---------- الفيديوهات ----------
export type TikTokVideo = { id: string; text: string; image: string | null; permalink: string | null; createdAt: string };
type RawVideo = { item_id?: string; caption?: string; thumbnail_url?: string; share_url?: string; create_time?: string | number };

let videoPath: string | null = null;
async function videoPage(token: string, openId: string, cursor?: number) {
  const query = { business_id: openId, fields: ["item_id", "caption", "thumbnail_url", "share_url", "create_time"], max_count: 20, cursor };
  // التوثيق يذكر business/video/list/ وبعض العملاء يستخدمون business/videos/list/
  for (const path of videoPath ? [videoPath] : ["business/video/list/", "business/videos/list/"]) {
    try {
      const d = await call<{ videos?: RawVideo[]; cursor?: number; has_more?: boolean }>(path, { token, query });
      videoPath = path;
      return d;
    } catch (e) {
      if (videoPath || path === "business/videos/list/" || !(e instanceof TikTokError && e.code === 40008)) throw e;
    }
  }
  return {};
}

export async function listTikTokVideos(token: string, openId: string, pages = 1): Promise<TikTokVideo[]> {
  if (isDemo(token)) return DEMO_VIDEOS;
  const out: TikTokVideo[] = [];
  let cursor: number | undefined;
  for (let i = 0; i < pages; i++) {
    const d = await videoPage(token, openId, cursor);
    for (const v of d.videos ?? []) {
      if (!v.item_id) continue;
      out.push({ id: String(v.item_id), text: v.caption ?? "", image: v.thumbnail_url ?? null, permalink: v.share_url ?? null,
        createdAt: v.create_time ? new Date(Number(v.create_time) * 1000).toISOString() : "" });
    }
    if (!d.has_more || typeof d.cursor !== "number") break;
    cursor = d.cursor;
  }
  return out;
}

/** رابط الفيديو بالشكل tiktok.com/@user/video/123... ؛ نتأكد أنه من فيديوهات الحساب */
export async function findTikTokVideoByUrl(token: string, openId: string, url: string) {
  const id = url.match(/\/video\/(\d{8,})/)?.[1] ?? url.match(/^\s*(\d{15,})\s*$/)?.[1];
  const videos = await listTikTokVideos(token, openId, 5);
  if (id) return videos.find((v) => v.id === id) ?? null;
  const norm = (s: string) => s.replace(/^https?:\/\/(www\.|m\.|vm\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "");
  return videos.find((v) => v.permalink && norm(v.permalink) === norm(url)) ?? null;
}

// ---------- التعليقات ----------
export async function getTikTokComment(token: string, openId: string, videoId: string, commentId: string) {
  if (isDemo(token)) return null;
  const d = await call<{ comments?: { comment_id?: string; text?: string; username?: string; owner?: boolean; parent_comment_id?: string }[] }>("business/comment/list/", {
    token, query: { business_id: openId, video_id: videoId, comment_ids: [commentId], status: "ALL", max_count: 1 },
  });
  const c = d.comments?.find((x) => String(x.comment_id) === commentId);
  return c ? { text: c.text ?? "", username: c.username ?? null, owner: c.owner === true } : null;
}

export async function replyTikTokComment(token: string, openId: string, videoId: string, commentId: string, text: string) {
  if (isDemo(token)) return;
  await call("business/comment/reply/create/", { method: "POST", token, body: {
    business_id: openId, video_id: videoId, comment_id: commentId, text: [...text].slice(0, TIKTOK_REPLY_MAX).join(""),
  } });
}

// ---------- Webhook ----------
/** الترويسة TikTok-Signature بصيغة t=<ثوانٍ>,s=<hex> حيث s = HMAC-SHA256 لـ `${t}.${body}` بسر التطبيق */
export function verifyTikTokSignature(raw: string, header: string | null, now = Date.now()) {
  const secret = process.env.TIKTOK_APP_SECRET;
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=").map((x) => x.trim())));
  const t = parts.t, s = (parts.s ?? "").toLowerCase();
  if (!/^\d+$/.test(t ?? "") || !s) return false;
  const age = Math.floor(now / 1000) - Number(t);
  if (age > 300 || age < -30) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex");
  return expected.length === s.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(s));
}

/** يعيد تعليقاً رئيسياً جديداً فقط (لا الردود ولا الحذف)، وردودنا تصل كردود فتُتجاهل تلقائياً */
export function parseTikTokCommentEvent(raw: string) {
  let env: { event?: string; user_openid?: string; content?: unknown };
  try { env = parseTikTokJson(raw); } catch { return null; }
  let c = env.content as Record<string, unknown> | string | undefined;
  if (typeof c === "string") { try { c = parseTikTokJson(c); } catch { return null; } }
  if (env.event !== "comment.update" || !env.user_openid || !c || typeof c !== "object") return null;
  if (c.comment_action !== "insert") return null;
  if (c.comment_type !== undefined && c.comment_type !== "comment") return null;
  const parent = c.parent_comment_id == null ? "" : String(c.parent_comment_id);
  if (parent && parent !== "0") return null;
  if (!c.comment_id || !c.video_id) return null;
  return {
    openId: env.user_openid, commentId: String(c.comment_id), videoId: String(c.video_id),
    text: typeof c.text === "string" ? c.text : undefined,
    username: typeof c.username === "string" ? c.username : undefined,
  };
}

const DEMO_VIDEOS: TikTokVideo[] = [
  { id: "7400000000000000001", text: "🎥 جولة في المجموعة الجديدة! علّق «السعر» ونرد عليك", image: null, permalink: "https://www.tiktok.com/@elegance.store/video/7400000000000000001", createdAt: new Date().toISOString() },
  { id: "7400000000000000002", text: "تنسيقات الصيف ☀️ أي لون تفضّل؟", image: null, permalink: "https://www.tiktok.com/@elegance.store/video/7400000000000000002", createdAt: new Date(Date.now() - 86400e3).toISOString() },
];
