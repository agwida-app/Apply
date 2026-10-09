import Link from "next/link";
import { Avatar, Badge, DailyBars, PageHeader, Stat, TextLink, fmtDate } from "@/components/ui";
import { db } from "@/lib/db";
import { SUB_STATUS_LABEL, formatLyd } from "@/lib/plans";
import { startOfMonth } from "@/lib/engine";
import { bucketByDay, lastNDays } from "@/lib/stats";

export default async function AdminHome() {
  const days = lastNDays(14);
  const today = days[days.length - 1];
  const [revenue, clients, activeSubs, trials, repliesToday, failedToday, chartRows, brokenPages, pendingPay, openErrors, recentUsers, expiring] = await Promise.all([
    db.payment.aggregate({ where: { status: "paid", currency: "LYD", paidAt: { gte: startOfMonth() } }, _sum: { amount: true } }),
    db.user.count({ where: { isDemo: false } }),
    db.user.count({ where: { subscriptionStatus: "active", isDemo: false } }),
    db.user.count({ where: { subscriptionStatus: "trialing", isDemo: false } }),
    db.replyLog.count({ where: { status: { in: ["done", "partial"] }, createdAt: { gte: today } } }),
    db.replyLog.count({ where: { status: "failed", createdAt: { gte: today } } }),
    db.replyLog.findMany({ where: { status: { in: ["done", "partial"] }, createdAt: { gte: days[0] } }, select: { createdAt: true } }),
    db.page.findMany({ where: { health: "error" }, include: { user: true }, take: 10 }),
    db.payment.findMany({ where: { provider: "manual", status: "pending" }, include: { user: true }, take: 10 }),
    db.systemEvent.findMany({ where: { resolved: false, level: "error" }, orderBy: { createdAt: "desc" }, take: 5, include: { user: true } }),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    db.user.findMany({ where: { subscriptionStatus: { in: ["active", "trialing"] }, subscriptionEndsAt: { lte: new Date(Date.now() + 3 * 86400e3), gte: new Date() } }, take: 10 }),
  ]);

  return (
    <div>
      <PageHeader title="نظرة عامة" desc="صحة النظام ونشاط العملاء" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="إجمالي العملاء" value={clients} hint={`${trials} في التجربة`} />
        <Stat label="اشتراكات مدفوعة" value={activeSubs} hint={`إيرادات الشهر: ${formatLyd(revenue._sum.amount ?? 0)}`} />
        <Stat label="ردود اليوم" value={repliesToday.toLocaleString("ar")} />
        <Stat label="فشل اليوم" value={failedToday} hint={repliesToday + failedToday ? `${Math.round((failedToday / (repliesToday + failedToday)) * 100)}% نسبة فشل` : undefined} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 font-extrabold">⚠️ يحتاج انتباهك</div>
          <ul className="space-y-3 text-sm">
            {pendingPay.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2"><span>💳 <b>{p.user.name}</b> حوّل {formatLyd(p.amount)} بانتظار التأكيد</span><TextLink href="/admin/payments">تأكيد</TextLink></li>
            ))}
            {brokenPages.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2"><span>🔌 <b>{p.user.name}</b>: «{p.name}» يحتاج إعادة ربط</span><TextLink href={`/admin/clients/${p.userId}`}>عرض</TextLink></li>
            ))}
            {expiring.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2"><span>⏳ اشتراك <b>{u.name}</b> ينتهي {fmtDate(u.subscriptionEndsAt!)}</span><TextLink href={`/admin/clients/${u.id}`}>تواصل</TextLink></li>
            ))}
            {openErrors.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2"><span className="min-w-0 truncate">🔴 {e.user?.name ?? "النظام"}: {e.message}</span><TextLink href="/admin/events">عرض</TextLink></li>
            ))}
            {!pendingPay.length && !brokenPages.length && !expiring.length && !openErrors.length && <li className="muted">✓ لا توجد مشاكل حالياً</li>}
          </ul>
        </div>
        <div className="card">
          <div className="mb-4 font-extrabold">الردود على مستوى المنصة (14 يوماً)</div>
          <DailyBars data={bucketByDay(chartRows, days)} />
        </div>
      </div>

      <div className="card mt-4">
        <div className="mb-3 flex items-center justify-between font-extrabold">أحدث العملاء <TextLink href="/admin/clients">الكل</TextLink></div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recentUsers.map((u) => (
            <li key={u.id}>
              <Link href={`/admin/clients/${u.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-[var(--surface-2)]">
                <Avatar src={u.avatarUrl} name={u.name} />
                <div className="min-w-0"><div className="truncate font-bold">{u.name} {u.isDemo && <Badge>تجريبي</Badge>}</div><div className="faint text-xs">{SUB_STATUS_LABEL[u.subscriptionStatus]} · {fmtDate(u.createdAt)}</div></div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
