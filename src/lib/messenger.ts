/**
 * الرسائل التفاعلية لماسنجر وإنستغرام: نص، صورة، بطاقات منتجات (Carousel) بأزرار، وخيارات سريعة.
 * كل زر أو خيار يمكنه فتح رسالة تفاعلية أخرى (payload = "T:<templateId>:<من أي رسالة>").
 */
export type Button =
  | { type: "url"; title: string; url: string }
  | { type: "template"; title: string; templateId: string }
  | { type: "phone"; title: string; phone: string };
export type Card = { title: string; subtitle?: string; imageUrl?: string; buttons: Button[] };
export type MessageItem =
  | { kind: "text"; text: string; buttons: Button[] }
  | { kind: "image"; imageUrl: string }
  | { kind: "cards"; cards: Card[] };
export type QuickReply = { title: string; templateId: string };
export type TemplateData = { id: string; name: string; messages: MessageItem[]; quickReplies: QuickReply[] };

export const LIMITS = { buttonTitle: 20, buttons: 3, cards: 10, cardTitle: 80, cardSubtitle: 80, text: 2000, quickReplies: 13, quickTitle: 20, messages: 5 };

export const payloadFor = (templateId: string, from = 0) => `T:${templateId}:${from}`;
export function parsePayload(p: string | undefined | null) {
  const m = p?.match(/^T:([a-z0-9]+):(\d+)$/i);
  return m ? { templateId: m[1], from: Number(m[2]) } : null;
}

const cut = (s: string, n: number) => [...(s ?? "")].slice(0, n).join("");

function buttonsFor(buttons: Button[], platform: string) {
  return buttons.slice(0, LIMITS.buttons).flatMap((b): Record<string, string>[] => {
    const title = cut(b.title, LIMITS.buttonTitle);
    if (b.type === "url") return [{ type: "web_url", url: b.url, title }];
    if (b.type === "template") return [{ type: "postback", title, payload: payloadFor(b.templateId) }];
    // زر الاتصال غير مدعوم في إنستغرام
    if (b.type === "phone" && platform !== "instagram") return [{ type: "phone_number", title, payload: b.phone }];
    return [];
  });
}

/** يحوّل الرسالة التفاعلية إلى رسائل Send API (الخيارات السريعة تُلحق بآخر رسالة) */
export function buildMessages(t: TemplateData, platform: string, from = 0): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const m of t.messages.slice(from)) {
    if (m.kind === "image" && m.imageUrl) {
      out.push({ attachment: { type: "image", payload: { url: m.imageUrl, is_reusable: true } } });
    } else if (m.kind === "text" && m.text.trim()) {
      const buttons = buttonsFor(m.buttons ?? [], platform);
      out.push(buttons.length
        ? { attachment: { type: "template", payload: { template_type: "button", text: cut(m.text, 640), buttons } } }
        : { text: cut(m.text, LIMITS.text) });
    } else if (m.kind === "cards" && m.cards.length) {
      out.push({ attachment: { type: "template", payload: { template_type: "generic", elements: m.cards.slice(0, LIMITS.cards).map((c) => ({
        title: cut(c.title, LIMITS.cardTitle) || " ",
        ...(c.subtitle ? { subtitle: cut(c.subtitle, LIMITS.cardSubtitle) } : {}),
        ...(c.imageUrl ? { image_url: c.imageUrl } : {}),
        ...(c.buttons?.length ? { buttons: buttonsFor(c.buttons, platform) } : {}),
      })) } } });
    }
  }
  const qr = quickRepliesFor(t.quickReplies);
  if (out.length && qr.length) out[out.length - 1].quick_replies = qr;
  return out;
}

export const quickRepliesFor = (q: QuickReply[]) =>
  q.slice(0, LIMITS.quickReplies).filter((x) => x.title.trim()).map((x) => ({ content_type: "text", title: cut(x.title, LIMITS.quickTitle), payload: payloadFor(x.templateId) }));

/** أول نص في الرسالة التفاعلية (للنسخة الاحتياطية النصية) */
export function firstText(t: TemplateData) {
  for (const m of t.messages) {
    if (m.kind === "text" && m.text.trim()) return m.text;
    if (m.kind === "cards" && m.cards[0]?.title) return m.cards[0].title;
  }
  return null;
}

/** تنظيف وتحقق مما يرسله المتصفح قبل الحفظ */
export function sanitizeTemplate(input: { messages: unknown; quickReplies: unknown }, ownIds: Set<string>) {
  const btn = (b: any): Button | null => {
    const title = cut(String(b?.title ?? "").trim(), LIMITS.buttonTitle);
    if (!title) return null;
    if (b.type === "url" && /^https?:\/\/\S+$/i.test(String(b.url ?? "").trim())) return { type: "url", title, url: String(b.url).trim() };
    if (b.type === "template" && ownIds.has(String(b.templateId))) return { type: "template", title, templateId: String(b.templateId) };
    if (b.type === "phone" && /^\+?\d{6,15}$/.test(String(b.phone ?? "").replace(/[\s-]/g, ""))) return { type: "phone", title, phone: String(b.phone).replace(/[\s-]/g, "") };
    return null;
  };
  const img = (u: unknown) => (typeof u === "string" && /^https?:\/\/\S+$/i.test(u.trim()) ? u.trim() : undefined);
  const messages: MessageItem[] = (Array.isArray(input.messages) ? input.messages : []).slice(0, LIMITS.messages).flatMap((m: any): MessageItem[] => {
    if (m?.kind === "text") {
      const text = String(m.text ?? "").slice(0, LIMITS.text);
      return text.trim() ? [{ kind: "text", text, buttons: (m.buttons ?? []).map(btn).filter(Boolean).slice(0, LIMITS.buttons) as Button[] }] : [];
    }
    if (m?.kind === "image") return img(m.imageUrl) ? [{ kind: "image", imageUrl: img(m.imageUrl)! }] : [];
    if (m?.kind === "cards") {
      const cards = (m.cards ?? []).slice(0, LIMITS.cards).map((c: any) => ({
        title: cut(String(c?.title ?? "").trim(), LIMITS.cardTitle), subtitle: cut(String(c?.subtitle ?? "").trim(), LIMITS.cardSubtitle) || undefined,
        imageUrl: img(c?.imageUrl), buttons: (c?.buttons ?? []).map(btn).filter(Boolean).slice(0, LIMITS.buttons) as Button[],
      })).filter((c: Card) => c.title);
      return cards.length ? [{ kind: "cards", cards }] : [];
    }
    return [];
  });
  const quickReplies: QuickReply[] = (Array.isArray(input.quickReplies) ? input.quickReplies : []).slice(0, LIMITS.quickReplies)
    .map((q: any) => ({ title: cut(String(q?.title ?? "").trim(), LIMITS.quickTitle), templateId: String(q?.templateId ?? "") }))
    .filter((q) => q.title && ownIds.has(q.templateId));
  return { messages, quickReplies };
}

export function toTemplateData(t: { id: string; name: string; messages: string; quickReplies: string }): TemplateData {
  const parse = (s: string) => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; } };
  return { id: t.id, name: t.name, messages: parse(t.messages), quickReplies: parse(t.quickReplies) };
}
