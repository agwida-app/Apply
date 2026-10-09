export type PlanId = "starter" | "pro" | "business";

export const PLANS: Record<PlanId, {
  name: string; price: number; priceLyd: number; pages: number; rules: number; repliesPerMonth: number; features: string[];
}> = {
  starter: {
    name: "الأساسية", price: 9, priceLyd: 60, pages: 1, rules: 5, repliesPerMonth: 1000,
    features: ["صفحة واحدة", "5 منشورات نشطة", "1,000 رد شهرياً", "رد علني + رسالة خاصة"],
  },
  pro: {
    name: "الاحترافية", price: 19, priceLyd: 120, pages: 3, rules: 30, repliesPerMonth: 10000,
    features: ["3 صفحات (فيسبوك أو إنستغرام)", "30 منشور نشط", "10,000 رد شهرياً", "كلمات مفتاحية وردود متعددة"],
  },
  business: {
    name: "الأعمال", price: 49, priceLyd: 300, pages: 10, rules: 200, repliesPerMonth: 100000,
    features: ["10 صفحات", "200 منشور نشط", "100,000 رد شهرياً", "دعم أولوية"],
  },
};

export const TRIAL_LIMITS = { pages: 1, rules: 2, repliesPerMonth: 100 };

export function limitsFor(user: { plan: string | null; subscriptionStatus: string }) {
  if (user.subscriptionStatus === "trialing") return TRIAL_LIMITS;
  const p = user.plan && PLANS[user.plan as PlanId];
  return p ? { pages: p.pages, rules: p.rules, repliesPerMonth: p.repliesPerMonth } : { pages: 0, rules: 0, repliesPerMonth: 0 };
}

export function hasActiveSubscription(user: { subscriptionStatus: string; subscriptionEndsAt: Date | null }) {
  if (!["active", "trialing"].includes(user.subscriptionStatus)) return false;
  return !user.subscriptionEndsAt || user.subscriptionEndsAt > new Date();
}

export const SUB_STATUS_LABEL: Record<string, string> = {
  none: "بدون اشتراك", trialing: "تجربة مجانية", active: "نشط", pending: "بانتظار تأكيد الدفع",
  past_due: "متأخر الدفع", canceled: "ملغى",
};

/** مدد الاشتراك المدفوع مسبقاً (الدفع المحلي ليس متكرراً) مع خصم للمدد الأطول */
export const DURATIONS = [
  { months: 1, discount: 0 },
  { months: 3, discount: 0.05 },
  { months: 6, discount: 0.1 },
  { months: 12, discount: 0.2 },
] as const;

export function priceLydFor(plan: PlanId, months: number) {
  const d = DURATIONS.find((x) => x.months === months);
  if (!d) throw new Error("invalid duration");
  return Math.round(PLANS[plan].priceLyd * months * (1 - d.discount));
}

export const formatLyd = (n: number) => `${n.toLocaleString("ar-LY")} د.ل`;
