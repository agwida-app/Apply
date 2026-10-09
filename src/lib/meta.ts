/**
 * عميل Meta Graph API (فيسبوك + إنستغرام) مع وضع تجريبي.
 * التوكنات التي تبدأ بـ "demo:" لا تتصل بفيسبوك إطلاقاً.
 */
const GRAPH = () => `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || "v21.0"}`;

export class MetaError extends Error {
  constructor(message: string, public code?: number, public subcode?: number) {
    super(message);
  }
  /** التوكن منتهي أو تم سحب الصلاحية: يجب على العميل إعادة الربط */
  get isAuthError() {
    return this.code === 190 || this.code === 102 || this.code === 10 || this.code === 200;
  }
}

export const isDemoMode = () => process.env.DEMO_MODE === "true";
const isDemoToken = (t: string) => t.startsWith("demo:");

async function graph<T>(path: string, token: string, init?: { method?: string; body?: Record<string, unknown>; query?: Record<string, string> }): Promise<T> {
  const url = new URL(GRAPH() + path);
  for (const [k, v] of Object.entries(init?.query ?? {})) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    throw new MetaError(e.message ?? `Graph API ${res.status}`, e.code, e.error_subcode);
  }
  return json as T;
}

// ---------- OAuth ----------
export const OAUTH_SCOPES = [
  "public_profile", "email",
  "pages_show_list", "pages_read_engagement", "pages_read_user_content",
  "pages_manage_metadata", "pages_manage_engagement", "pages_messaging",
  "instagram_basic", "instagram_manage_comments", "instagram_manage_messages",
  "business_management",
];

export function oauthUrl(state: string) {
  const u = new URL(`https://www.facebook.com/${process.env.META_GRAPH_VERSION || "v21.0"}/dialog/oauth`);
  u.searchParams.set("client_id", process.env.META_APP_ID!);
  u.searchParams.set("redirect_uri", `${process.env.APP_URL}/api/auth/facebook/callback`);
  u.searchParams.set("state", state);
  u.searchParams.set("scope", OAUTH_SCOPES.join(","));
  return u.toString();
}

export async function exchangeCode(code: string) {
  const short = await graph<{ access_token: string }>("/oauth/access_token", "", {
    query: {
      client_id: process.env.META_APP_ID!, client_secret: process.env.META_APP_SECRET!,
      redirect_uri: `${process.env.APP_URL}/api/auth/facebook/callback`, code,
    },
  });
  // تحويل إلى توكن طويل الأمد (60 يوم) - وتوكنات الصفحات المستخرجة منه لا تنتهي
  const long = await graph<{ access_token: string }>("/oauth/access_token", "", {
    query: {
      grant_type: "fb_exchange_token", client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!, fb_exchange_token: short.access_token,
    },
  });
  return long.access_token;
}

export async function getMe(userToken: string) {
  if (isDemoToken(userToken)) return { id: "demo-user", name: "عميل تجريبي", email: "demo@example.com", picture: null as string | null };
  const me = await graph<{ id: string; name: string; email?: string; picture?: { data: { url: string } } }>(
    "/me", userToken, { query: { fields: "id,name,email,picture.type(large)" } });
  return { id: me.id, name: me.name, email: me.email ?? null, picture: me.picture?.data.url ?? null };
}

export type ManagedAccount = {
  platform: "facebook" | "instagram";
  externalId: string;
  fbPageId: string;
  name: string;
  picture: string | null;
  accessToken: string;
};

/** كل الصفحات التي يديرها المستخدم + حسابات إنستغرام التجارية المرتبطة بها */
export async function getManagedAccounts(userToken: string): Promise<ManagedAccount[]> {
  if (isDemoToken(userToken)) return DEMO_ACCOUNTS;
  type P = { id: string; name: string; access_token: string; picture?: { data: { url: string } };
    instagram_business_account?: { id: string; username: string; profile_picture_url?: string } };
  const out: ManagedAccount[] = [];
  let next: string | null = "/me/accounts";
  let after: string | undefined;
  while (next) {
    const res: { data: P[]; paging?: { cursors?: { after?: string }; next?: string } } = await graph(next, userToken, {
      query: { fields: "id,name,access_token,picture,instagram_business_account{id,username,profile_picture_url}", limit: "100", ...(after ? { after } : {}) },
    });
    for (const p of res.data) {
      out.push({ platform: "facebook", externalId: p.id, fbPageId: p.id, name: p.name, picture: p.picture?.data.url ?? null, accessToken: p.access_token });
      const ig = p.instagram_business_account;
      if (ig) out.push({ platform: "instagram", externalId: ig.id, fbPageId: p.id, name: `@${ig.username}`, picture: ig.profile_picture_url ?? null, accessToken: p.access_token });
    }
    after = res.paging?.cursors?.after;
    next = res.paging?.next && after ? "/me/accounts" : null;
  }
  return out;
}

/** اشتراك الصفحة في Webhooks حتى تصلنا التعليقات */
export async function subscribePage(fbPageId: string, pageToken: string) {
  if (isDemoToken(pageToken)) return;
  await graph(`/${fbPageId}/subscribed_apps`, pageToken, { method: "POST", query: { subscribed_fields: "feed,messages" } });
}

export async function unsubscribePage(fbPageId: string, pageToken: string) {
  if (isDemoToken(pageToken)) return;
  await graph(`/${fbPageId}/subscribed_apps`, pageToken, { method: "DELETE" }).catch(() => {});
}

// ---------- المنشورات ----------
export type Post = { id: string; text: string; image: string | null; permalink: string | null; createdAt: string };

export async function listPosts(acc: { platform: string; externalId: string; accessToken: string }, limit = 25): Promise<Post[]> {
  if (isDemoToken(acc.accessToken)) return DEMO_POSTS.map((p) => ({ ...p, id: `${acc.externalId}_${p.id}` }));
  if (acc.platform === "instagram") {
    const r = await graph<{ data: { id: string; caption?: string; media_url?: string; thumbnail_url?: string; permalink: string; timestamp: string }[] }>(
      `/${acc.externalId}/media`, acc.accessToken, { query: { fields: "id,caption,media_url,thumbnail_url,permalink,timestamp", limit: String(limit) } });
    return r.data.map((m) => ({ id: m.id, text: m.caption ?? "", image: m.thumbnail_url ?? m.media_url ?? null, permalink: m.permalink, createdAt: m.timestamp }));
  }
  const r = await graph<{ data: { id: string; message?: string; full_picture?: string; permalink_url?: string; created_time: string }[] }>(
    `/${acc.externalId}/posts`, acc.accessToken, { query: { fields: "id,message,full_picture,permalink_url,created_time", limit: String(limit) } });
  return r.data.map((p) => ({ id: p.id, text: p.message ?? "", image: p.full_picture ?? null, permalink: p.permalink_url ?? null, createdAt: p.created_time }));
}

/** إيجاد منشور من رابطه: نجرب استخراج المعرّف رقمياً ثم نطابق مع آخر المنشورات */
export async function findPostByUrl(acc: { platform: string; externalId: string; accessToken: string }, rawUrl: string): Promise<Post | null> {
  const url = rawUrl.trim();
  const posts = await listPosts(acc, 100);
  const norm = (s: string) => s.replace(/^https?:\/\/(www\.|m\.|web\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "");
  const target = norm(url);
  const byLink = posts.find((p) => p.permalink && norm(p.permalink) === target);
  if (byLink) return byLink;

  if (acc.platform === "instagram") {
    const code = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/)?.[1];
    return code ? posts.find((p) => p.permalink?.includes(`/${code}`)) ?? null : null;
  }
  const candidates = [
    url.match(/story_fbid=(\d+)/)?.[1], url.match(/fbid=(\d+)/)?.[1],
    url.match(/\/posts\/(\d+)/)?.[1], url.match(/\/videos\/(\d+)/)?.[1],
    url.match(/\/permalink\/(\d+)/)?.[1], url.match(/\/reel\/(\d+)/)?.[1],
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    const hit = posts.find((p) => p.id === c || p.id.endsWith(`_${c}`));
    if (hit) return hit;
  }
  if (candidates[0] && !isDemoToken(acc.accessToken)) {
    try {
      const p = await graph<{ id: string; message?: string; full_picture?: string; permalink_url?: string; created_time: string }>(
        `/${acc.externalId}_${candidates[0]}`, acc.accessToken, { query: { fields: "id,message,full_picture,permalink_url,created_time" } });
      return { id: p.id, text: p.message ?? "", image: p.full_picture ?? null, permalink: p.permalink_url ?? null, createdAt: p.created_time };
    } catch { /* المنشور ليس لهذه الصفحة */ }
  }
  return null;
}

// ---------- الردود ----------
export async function replyPublic(acc: { platform: string; accessToken: string }, commentId: string, message: string) {
  if (isDemoToken(acc.accessToken)) return;
  if (acc.platform === "instagram") await graph(`/${commentId}/replies`, acc.accessToken, { method: "POST", body: { message } });
  else await graph(`/${commentId}/comments`, acc.accessToken, { method: "POST", body: { message } });
}

/** رد خاص (Private Reply): رسالة واحدة فقط لكل تعليق، وخلال 7 أيام من التعليق */
export async function replyPrivate(acc: { fbPageId: string; accessToken: string }, commentId: string, text: string) {
  if (isDemoToken(acc.accessToken)) return;
  await graph(`/${acc.fbPageId}/messages`, acc.accessToken, {
    method: "POST", body: { recipient: { comment_id: commentId }, message: { text } },
  });
}

// ---------- بيانات تجريبية ----------
const DEMO_ACCOUNTS: ManagedAccount[] = [
  { platform: "facebook", externalId: "demo-page-1", fbPageId: "demo-page-1", name: "متجر الأناقة (تجريبي)", picture: null, accessToken: "demo:page1" },
  { platform: "instagram", externalId: "demo-ig-1", fbPageId: "demo-page-1", name: "@elegance.store (تجريبي)", picture: null, accessToken: "demo:page1" },
];
const DEMO_POSTS: Post[] = [
  { id: "1001", text: "🔥 تخفيضات نهاية الموسم! خصم 50% على كل الفساتين. علّق \"السعر\" ونرسلك التفاصيل على الخاص", image: null, permalink: "https://facebook.com/demo/posts/1001", createdAt: new Date().toISOString() },
  { id: "1002", text: "وصلت المجموعة الجديدة من الحقائب 👜 علّق بكلمة \"تم\" ليصلك الكتالوج", image: null, permalink: "https://facebook.com/demo/posts/1002", createdAt: new Date(Date.now() - 86400e3).toISOString() },
  { id: "1003", text: "مسابقة! علّق بلونك المفضل وادخل السحب على قسيمة شرائية 🎁", image: null, permalink: "https://facebook.com/demo/posts/1003", createdAt: new Date(Date.now() - 3 * 86400e3).toISOString() },
];
