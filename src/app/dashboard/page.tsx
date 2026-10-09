import Link from "next/link";
import { Alert, Badge, DailyBars, LOG_STATUS, PageHeader, Stat, TextLink, fmtDate } from "@/components/ui";
import { db } from "@/lib/db";
import { startOfMonth } from "@/lib/engine";
import { hasActiveSubscription, limitsFor } from "@/lib/plans";
import { requireUser } from "@/lib/session";
import { bucketByDay, lastNDays } from "@/lib/stats";

export default async function Overview() {
  const user = await requireUser();
  const days = lastNDays(14);
  const [pages, rules, monthReplies, recent, chartRows, failed] = await Promise.all([
    db.page.findMany({ where: { userId: user.id } }),
    db.rule.count({ where: { userId: user.id, enabled: true } }),
    db.replyLog.count({ where: { userId: user.id, status: { in: ["done", "partial"] }, createdAt: { gte: startOfMonth() } } }),
    db.replyLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 6, include: { rule: true } }),
    db.replyLog.findMany({ where: { userId: user.id, status: { in: ["done", "partial"] }, createdAt: { gte: days[0] } }, select: { createdAt: true } }),
    db.replyLog.count({ where: { userId: user.id, status: "failed", createdAt: { gte: days[0] } } }),
  ]);
  const limits = limitsFor(user);
  const active = hasActiveSubscription(user);
  const broken = pages.filter((p) => p.health === "error");
  const total14 = chartRows.length;
  const successRate = total14 + failed ? Math.round((total14 / (total14 + failed)) * 100) : null;

  // خطوات البدء للعميل الجديد
  const steps = [
    { done: active, label: "فعّل اشتراكك", href: "/dashboard/billing" },
    { done: pages.length > 0, label: "اربط صفحة فيسبوك أو حساب إنستغرام", href: "/dashboard/accounts" },
    { done: rules > 0, label: "اختر منشوراً واكتب الرد والرسالة", href: "/dashboard/rules/new" },
  ];
  const onboarding = steps.some((s) => !s.done);

  return (
    <div>
      <PageHeader title={`أهلاً ${user.name.split(" ")[0]} 👋`} desc="نظرة سريعة على نشاط الردود التلقائية"
        action={<Link href="/dashboard/rules/new" className="btn-primary">+ إضافة منشور</Link>} />

      {!active && <Alert tone="red">اشتراكك غير نشط — الردود التلقائية متوقفة حالياً. <TextLink href="/dashboard/billing">فعّل الاشتراك</TextLink></Alert>}
      {broken.map((p) => <Alert key={p.id} tone="red">⚠️ مشكلة في ربط «{p.name}»: {p.lastError} <TextLink href="/dashboard/accounts">إصلاح</TextLink></Alert>)}
      {user.subscriptionStatus === "trialing" && user.subscriptionEndsAt && (
        <Alert tone="blue">أنت في الفترة التجريبية حتى {fmtDate(user.subscriptionEndsAt)}. <TextLink href="/dashboard/billing">اختر باقة</TextLink></Alert>
      )}

      {onboarding && (
        <div className="card mb-6">
          <div className="mb-3 font-extrabold">ابدأ في 3 خطوات</div>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-center gap-3">
                <span className={`grid h-7 w-7 place-items-center rounded-full text-sm font-bold ${s.done ? "bg-emerald-500 text-white" : "bg-[var(--surface-2)]"}`}>{s.done ? "✓" : i + 1}</span>
                {s.done ? <span className="muted line-through">{s.label}</span> : <TextLink href={s.href}>{s.label}</TextLink>}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="ردود هذا الشهر" value={monthReplies.toLocaleString("ar")} hint={`من أصل ${limits.repliesPerMonth.toLocaleString("ar")}`} />
        <Stat label="منشورات نشطة" value={rules} hint={`الحد: ${limits.rules}`} />
        <Stat label="حسابات مربوطة" value={pages.length} hint={`الحد: ${limits.pages}`} />
        <Stat label="نسبة النجاح (14 يوم)" value={successRate === null ? "—" : `${successRate}%`} hint={failed ? `${failed} محاولة فاشلة` : undefined} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="card lg:col-span-3">
          <div className="mb-4 font-extrabold">الردود خلال آخر 14 يوماً</div>
          <DailyBars data={bucketByDay(chartRows, days)} />
        </div>
        <div className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between font-extrabold">آخر التعليقات <TextLink href="/dashboard/activity">الكل</TextLink></div>
          {recent.length === 0 ? <p className="muted text-sm">لا توجد تعليقات بعد.</p> : (
            <ul className="space-y-3">
              {recent.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <b>{l.commenterName ?? "زائر"}</b>: <span className="muted">{l.commentText?.slice(0, 50)}</span>
                    <div className="faint text-xs">{fmtDate(l.createdAt)}</div>
                  </div>
                  <Badge tone={LOG_STATUS[l.status]?.tone}>{LOG_STATUS[l.status]?.label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
