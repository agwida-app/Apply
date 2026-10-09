import { Alert, Badge, PageHeader, fmtDate } from "@/components/ui";
import { db } from "@/lib/db";
import { startOfMonth } from "@/lib/engine";
import { PLANS, PlanId, SUB_STATUS_LABEL, hasActiveSubscription, limitsFor } from "@/lib/plans";
import { requireUser } from "@/lib/session";
import { stripeEnabled } from "@/lib/stripe";
import { requestManualPayment, startCheckout, updateProfile } from "../actions";

export default async function Billing({ searchParams }: { searchParams: Promise<{ paid?: string; requested?: string; need?: string; error?: string }> }) {
  const q = await searchParams;
  const user = await requireUser();
  const used = await db.replyLog.count({ where: { userId: user.id, status: { in: ["done", "partial"] }, createdAt: { gte: startOfMonth() } } });
  const limit = limitsFor(user).repliesPerMonth;
  const active = hasActiveSubscription(user);
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const stripeOn = stripeEnabled();

  return (
    <div>
      <PageHeader title="الاشتراك" />
      {q.paid && <Alert tone="green">✓ تم الدفع بنجاح. قد يستغرق التفعيل بضع ثوانٍ.</Alert>}
      {q.requested && <Alert tone="blue">تم استلام طلبك. سيتم تفعيل الاشتراك بعد التحقق من التحويل (عادة خلال ساعات).</Alert>}
      {q.need && <Alert>يجب تفعيل الاشتراك أولاً.</Alert>}
      {q.error === "stripe" && <Alert tone="red">الدفع الإلكتروني غير متاح حالياً. استخدم التحويل البنكي.</Alert>}

      <div className="card mb-6 grid gap-6 md:grid-cols-2">
        <div>
          <div className="muted text-sm">الباقة الحالية</div>
          <div className="mt-1 flex items-center gap-2 text-2xl font-extrabold">
            {user.subscriptionStatus === "trialing" ? "تجربة مجانية" : user.plan ? PLANS[user.plan as PlanId]?.name : "—"}
            <Badge tone={active ? "green" : "amber"}>{SUB_STATUS_LABEL[user.subscriptionStatus]}</Badge>
          </div>
          {user.subscriptionEndsAt && <div className="faint mt-1 text-sm">{active ? "ينتهي" : "انتهى"} في {fmtDate(user.subscriptionEndsAt)}</div>}
        </div>
        <div>
          <div className="mb-1 flex justify-between text-sm"><span className="muted">الردود هذا الشهر</span><b className="tabular-nums">{used.toLocaleString("ar")} / {limit.toLocaleString("ar")}</b></div>
          <div className="h-2.5 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
            <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-500" : "bg-brand-600"}`} style={{ width: `${pct}%` }} />
          </div>
          {pct >= 80 && <p className="mt-1 text-xs text-red-600">اقتربت من الحد الشهري — رقِّ باقتك حتى لا تتوقف الردود.</p>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(PLANS) as PlanId[]).map((id) => {
          const p = PLANS[id];
          const current = user.plan === id && user.subscriptionStatus === "active";
          return (
            <div key={id} className={`card flex flex-col ${current ? "ring-2 ring-brand-600" : ""}`}>
              <div className="flex items-center justify-between"><div className="font-extrabold">{p.name}</div>{current && <Badge tone="blue">باقتك</Badge>}</div>
              <div className="mt-2 text-3xl font-extrabold">${p.price}<span className="muted text-sm font-medium"> / شهر</span></div>
              <ul className="mt-4 flex-1 space-y-1.5 text-sm">{p.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
              {stripeOn && !current && (
                <form action={startCheckout} className="mt-4"><input type="hidden" name="plan" value={id} /><button className="btn-primary w-full">💳 ادفع بالبطاقة</button></form>
              )}
              {!current && (
                <details className="mt-2">
                  <summary className="btn-ghost w-full cursor-pointer list-none">🏦 تحويل بنكي / محفظة</summary>
                  <form action={requestManualPayment} className="mt-3 space-y-2 text-sm">
                    <input type="hidden" name="plan" value={id} />
                    <div className="whitespace-pre-wrap rounded-xl p-3" style={{ background: "var(--surface-2)" }}>{process.env.BANK_TRANSFER_INFO}</div>
                    <input name="ref" className="input" placeholder="رقم العملية / اسم المحوِّل" required />
                    <button className="btn-primary w-full">أرسلت التحويل</button>
                  </form>
                </details>
              )}
            </div>
          );
        })}
      </div>

      <form action={updateProfile} className="card mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="sm:col-span-3 font-extrabold">بيانات التواصل <span className="faint text-xs font-normal">(لنتواصل معك عند وجود مشكلة)</span></div>
        <div><label className="label">رقم الهاتف / واتساب</label><input name="phone" className="input" dir="ltr" defaultValue={user.phone ?? ""} /></div>
        <div><label className="label">البريد الإلكتروني</label><input name="email" type="email" className="input" dir="ltr" defaultValue={user.email ?? ""} /></div>
        <button className="btn-primary">حفظ</button>
      </form>
    </div>
  );
}
