import { Checkout } from "@/components/Checkout";
import { Alert, Badge, PageHeader, fmtDate } from "@/components/ui";
import { PROVIDER_LABEL } from "@/lib/billing";
import { db } from "@/lib/db";
import { startOfMonth } from "@/lib/engine";
import { DURATIONS, PLANS, PlanId, SUB_STATUS_LABEL, formatLyd, hasActiveSubscription, limitsFor } from "@/lib/plans";
import { enabledMethods, METHOD_INFO, plutuDemo } from "@/lib/plutu";
import { requireUser } from "@/lib/session";
import { stripeEnabled } from "@/lib/stripe";
import { requestManualPayment, startCheckout, updateProfile } from "../actions";

const PAY_STATUS: Record<string, { label: string; tone: "green" | "amber" | "red" | "gray" }> = {
  paid: { label: "مدفوع", tone: "green" }, pending: { label: "قيد المعالجة", tone: "amber" }, failed: { label: "فشل", tone: "red" }, canceled: { label: "ملغى", tone: "gray" },
};

export default async function Billing({ searchParams }: { searchParams: Promise<{ paid?: string; requested?: string; need?: string; error?: string; pay?: string }> }) {
  const q = await searchParams;
  const user = await requireUser();
  const [used, payments] = await Promise.all([
    db.replyLog.count({ where: { userId: user.id, status: { in: ["done", "partial"] }, createdAt: { gte: startOfMonth() } } }),
    db.payment.findMany({ where: { userId: user.id, NOT: { provider: { in: ["sadad", "edfali", "cards"] }, status: "pending" } }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const limit = limitsFor(user).repliesPerMonth;
  const active = hasActiveSubscription(user);
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const methods = enabledMethods().map((id) => ({ id, label: METHOD_INFO[id].label, desc: METHOD_INFO[id].desc }));

  return (
    <div>
      <PageHeader title="الاشتراك" />
      {q.paid && <Alert tone="green">✓ تم الدفع بنجاح وتفعيل اشتراكك. شكراً لك!</Alert>}
      {q.requested && <Alert tone="blue">تم استلام طلبك. سيتم تفعيل الاشتراك بعد التحقق من التحويل (عادة خلال ساعات).</Alert>}
      {q.need && <Alert>يجب تفعيل الاشتراك أولاً.</Alert>}
      {q.error === "stripe" && <Alert tone="red">الدفع بالبطاقة الدولية غير متاح حالياً.</Alert>}
      {q.pay === "canceled" && <Alert>تم إلغاء عملية الدفع.</Alert>}
      {(q.pay === "failed" || q.pay === "error") && <Alert tone="red">لم تكتمل عملية الدفع. لم يتم خصم أي مبلغ، أو تواصل مع الدعم إن تم الخصم.</Alert>}

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

      <h2 className="mb-3 text-lg font-extrabold">{active ? "تجديد أو ترقية الاشتراك" : "اشترك الآن"}</h2>
      <Checkout
        plans={(Object.keys(PLANS) as PlanId[]).map((id) => ({ id, name: PLANS[id].name, priceLyd: PLANS[id].priceLyd, price: PLANS[id].price, features: PLANS[id].features }))}
        durations={DURATIONS.map((d) => ({ ...d }))}
        methods={methods}
        stripeOn={stripeEnabled()}
        bankInfo={process.env.BANK_TRANSFER_INFO}
        currentPlan={user.plan}
        demo={plutuDemo()}
        manualAction={requestManualPayment}
        stripeAction={startCheckout}
      />
      {active && <p className="faint mt-2 text-xs">عند التجديد تُضاف المدة الجديدة إلى نهاية اشتراكك الحالي.</p>}

      {payments.length > 0 && (
        <div className="card mt-6">
          <div className="mb-3 font-extrabold">سجل المدفوعات</div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>التاريخ</th><th>الباقة</th><th>المبلغ</th><th>الطريقة</th><th>الحالة</th><th>رقم الفاتورة</th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="faint whitespace-nowrap text-xs">{fmtDate(p.createdAt)}</td>
                  <td>{PLANS[p.plan as PlanId]?.name} · {p.months} شهر</td>
                  <td className="tabular-nums">{p.currency === "LYD" ? formatLyd(p.amount) : `${p.amount} ${p.currency}`}</td>
                  <td>{PROVIDER_LABEL[p.provider] ?? p.provider}</td>
                  <td><Badge tone={PAY_STATUS[p.status]?.tone}>{p.provider === "manual" && p.status === "pending" ? "بانتظار التأكيد" : PAY_STATUS[p.status]?.label}</Badge></td>
                  <td className="faint text-xs" dir="ltr">{p.invoiceNo}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      <form action={updateProfile} className="card mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div className="font-extrabold sm:col-span-3">بيانات التواصل <span className="faint text-xs font-normal">(لنتواصل معك عند وجود مشكلة)</span></div>
        <div><label className="label">رقم الهاتف / واتساب</label><input name="phone" className="input" dir="ltr" defaultValue={user.phone ?? ""} /></div>
        <div><label className="label">البريد الإلكتروني</label><input name="email" type="email" className="input" dir="ltr" defaultValue={user.email ?? ""} /></div>
        <button className="btn-primary">حفظ</button>
      </form>
    </div>
  );
}
