/** الرسائل الواردة في ماسنجر/إنستغرام: الضغط على الأزرار والخيارات السريعة، والكلمات المفتاحية */
import { db } from "./db";
import { logEvent } from "./events";
import { parsePayload, toTemplateData } from "./messenger";
import { hasActiveSubscription } from "./plans";
import { sendTemplateToUser } from "./platforms";
import { matchesKeywords, parseList } from "./text";

export type MessagingEvent = {
  sender?: { id: string };
  postback?: { payload?: string };
  message?: { text?: string; is_echo?: boolean; quick_reply?: { payload?: string } };
};

export async function handleMessagingEvent(platform: "facebook" | "instagram", accountId: string, ev: MessagingEvent) {
  if (!ev.sender?.id || ev.message?.is_echo || ev.sender.id === accountId) return;
  const page = await db.page.findUnique({ where: { platform_externalId: { platform, externalId: accountId } }, include: { user: true } });
  if (!page || !page.active || page.user.status !== "active" || !hasActiveSubscription(page.user)) return;

  let template = null;
  let from = 0;
  const payload = parsePayload(ev.postback?.payload ?? ev.message?.quick_reply?.payload);
  if (payload) {
    template = await db.messageTemplate.findFirst({ where: { id: payload.templateId, userId: page.userId } });
    from = payload.from;
  } else if (ev.message?.text) {
    // نرد فقط عندما تطابق الرسالة كلمات مفتاحية حددها العميل، حتى لا نقاطع المحادثات العادية
    const all = await db.messageTemplate.findMany({ where: { userId: page.userId, keywords: { not: "[]" } } });
    template = all.find((t) => matchesKeywords(ev.message!.text!, parseList(t.keywords))) ?? null;
  }
  if (!template) return;

  try {
    await sendTemplateToUser(page, ev.sender.id, toTemplateData(template), from);
    await db.messageTemplate.update({ where: { id: template.id }, data: { sendCount: { increment: 1 } } });
  } catch (e) {
    await logEvent("error", "inbox", `فشل إرسال «${template.name}» في ${page.name}: ${(e as Error).message}`, page.userId);
  }
}
