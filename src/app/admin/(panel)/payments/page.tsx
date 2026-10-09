import Link from "next/link";
import { Badge, PageHeader, Stat, fmtDate } from "@/components/ui";
import { PROVIDER_LABEL } from "@/lib/billing";
import { db } from "@/lib/db";
import { startOfMonth } from "@/lib/engine";
import { PLANS, PlanId, formatLyd } from "@/lib/plans";
import { confirmPayment, rejectPayment } from "../../actions";

const TABS = [["pending", "بانتظار التأكيد"], ["paid", "مدفوعة"], ["failed", "فاشلة/ملغاة"], ["all", "الكل"]] as const;
const STATUS: Record<string, { label: string; tone: "green" | "amber" | "red" | "gray" }> = {
  paid: { label: "مدفوع", tone: "green" }, pending: { label: "معلّق", tone: "amber" }, failed: { label: "فشل", tone: "red" }, canceled: { label: "ملغى", tone: "gray" },
};

export default async function Payments({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = "pending" } = await searchParams;
  const where =
    t === "pending" ? { provider: "manual", status: "pending" } :
    t === "paid" ? { status: "paid" } :
    t === "failed" ? { status: { in: ["failed", "canceled"] } } : {};
  const [payments, month, byProvider] = await Promise.all([
    db.payment.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { user: true } }),
    db.payment.aggregate({ where: { status: "paid", currency: "LYD", paidAt: { gte: startOfMonth() } }, _sum: { amount: true }, _count: true }),
    db.payment.groupBy({ by: ["provider"], where: { status: "paid", currency: "LYD", paidAt: { gte: startOfMonth() } }, _sum: { amount: true } }),
  ]);

  return (
    <div>
      <PageHeader title="المدفوعات" desc="سداد، إدفع لي، البطاقات المحلية، والتحويلات اليدوية" />
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="إيرادات هذا الشهر" value={formatLyd(month._sum.amount ?? 0)} hint={`${month._count} عملية`} />
        {byProvider.slice(0, 3).map((b) => <Stat key={b.provider} label={PROVIDER_LABEL[b.provider] ?? b.provider} value={formatLyd(b._sum.amount ?? 0)} hint="هذا الشهر" />)}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(([v, l]) => (
          <Link key={v} href={`/admin/payments?t=${v}`} className={`rounded-full px-4 py-1.5 text-sm font-bold ${t === v ? "bg-brand-600 text-white" : "border"}`} style={t === v ? undefined : { borderColor: "var(--border)" }}>{l}</Link>
        ))}
      </div>
      <div className="card">
        {payments.length === 0 ? <p className="muted text-sm">لا توجد مدفوعات</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>العميل</th><th>الباقة</th><th>المبلغ</th><th>الطريقة</th><th>المرجع</th><th>الحالة</th><th></th></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/admin/clients/${p.userId}`} className="font-bold hover:underline">{p.user.name}</Link><div className="faint text-xs">{fmtDate(p.createdAt)}</div></td>
                  <td>{PLANS[p.plan as PlanId]?.name}<div className="faint text-xs">{p.months} شهر</div></td>
                  <td className="whitespace-nowrap font-bold tabular-nums">{p.currency === "LYD" ? formatLyd(p.amount) : `${p.amount} ${p.currency}`}</td>
                  <td>{PROVIDER_LABEL[p.provider] ?? p.provider}{p.mobile && <div className="faint text-xs" dir="ltr">{p.mobile}</div>}</td>
                  <td className="text-xs" dir="ltr">{p.reference ?? p.transactionId ?? "—"}<div className="faint">{p.invoiceNo}</div></td>
                  <td><Badge tone={STATUS[p.status]?.tone}>{STATUS[p.status]?.label}</Badge>{p.error && <div className="mt-1 max-w-[12rem] text-xs text-red-600">{p.error}</div>}</td>
                  <td>
                    {p.status !== "paid" && (p.provider === "manual" || p.provider === "cards") && (
                      <div className="flex flex-col gap-1">
                        <form action={confirmPayment}><input type="hidden" name="id" value={p.id} /><button className="btn-primary w-full py-1.5 text-xs">✓ تأكيد وتفعيل</button></form>
                        {p.status === "pending" && <form action={rejectPayment}><input type="hidden" name="id" value={p.id} /><button className="w-full py-1 text-xs font-bold text-red-600 hover:underline">رفض</button></form>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
      <p className="faint mt-3 text-xs">💡 قبل تأكيد التحويل اليدوي تحقّق من وصول المبلغ في حسابك البنكي/المحفظة. يمكن أيضاً تأكيد دفعة بطاقة علقت بعد التحقق منها في لوحة Plutu.</p>
    </div>
  );
}
