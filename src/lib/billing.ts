import crypto from "node:crypto";
import { db } from "./db";
import { logEvent } from "./events";
import { PLANS, PlanId } from "./plans";

export const PROVIDER_LABEL: Record<string, string> = {
  sadad: "سداد", edfali: "إدفع لي", cards: "بطاقة مصرفية محلية", manual: "تحويل يدوي", stripe: "بطاقة دولية",
};

export function newInvoiceNo() {
  return `RD${Date.now()}${crypto.randomInt(100, 999)}`;
}

/** تفعيل أو تمديد الاشتراك: يبدأ من نهاية الاشتراك الحالي إن كان سارياً */
export async function activatePlan(userId: string, plan: PlanId, months: number) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const base = user.subscriptionStatus === "active" && user.subscriptionEndsAt && user.subscriptionEndsAt > new Date() ? user.subscriptionEndsAt : new Date();
  const ends = new Date(base);
  ends.setMonth(ends.getMonth() + months);
  await db.user.update({ where: { id: userId }, data: { plan, subscriptionStatus: "active", subscriptionEndsAt: ends } });
  return ends;
}

/** تعليم الدفعة كمدفوعة وتفعيل الاشتراك. آمنة عند استدعائها أكثر من مرة لنفس الدفعة */
export async function markPaymentPaid(paymentId: string, transactionId?: string | null) {
  const claimed = await db.payment.updateMany({
    where: { id: paymentId, status: { in: ["pending", "failed"] } },
    data: { status: "paid", paidAt: new Date(), transactionId: transactionId ?? undefined, error: null },
  });
  if (claimed.count === 0) return false;
  const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
  await activatePlan(p.userId, p.plan as PlanId, p.months);
  await logEvent("info", "billing", `دفعة ناجحة (${PROVIDER_LABEL[p.provider] ?? p.provider}): ${p.amount} ${p.currency} - باقة ${PLANS[p.plan as PlanId]?.name} لمدة ${p.months} شهر`, p.userId);
  return true;
}
