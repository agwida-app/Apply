import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Badge, LOG_STATUS, PageHeader, PlatformIcon, SKIP_REASON, Stat, TICKET_STATUS, fmtDate } from "@/components/ui";
import { db } from "@/lib/db";
import { startOfMonth } from "@/lib/engine";
import { PLANS, PlanId, SUB_STATUS_LABEL, formatLyd, hasActiveSubscription, limitsFor } from "@/lib/plans";
import { PROVIDER_LABEL } from "@/lib/billing";
import { activateSubscription, cancelSubscription, extendTrial, impersonate, messageClient, retryLog, saveNote, toggleSuspend } from "../../../actions";

export default async function ClientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await db.user.findUnique({
    where: { id },
    include: {
      pages: { include: { _count: { select: { rules: true } } } },
      rules: { include: { page: true }, orderBy: { createdAt: "desc" } },
      tickets: { orderBy: { updatedAt: "desc" }, take: 10 },
      events: { orderBy: { createdAt: "desc" }, take: 15 },
      payments: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!u) notFound();
  const [monthReplies, failed30, total, logs] = await Promise.all([
    db.replyLog.count({ where: { userId: id, status: { in: ["done", "partial"] }, createdAt: { gte: startOfMonth() } } }),
    db.replyLog.count({ where: { userId: id, status: "failed", createdAt: { gte: new Date(Date.now() - 30 * 86400e3) } } }),
    db.replyLog.count({ where: { userId: id, status: { in: ["done", "partial"] } } }),
    db.replyLog.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  const wa = u.phone?.replace(/\D/g, "");

  return (
    <div>
      <PageHeader title={u.name} desc={`عميل منذ ${fmtDate(u.createdAt)} · آخر دخول ${fmtDate(u.lastLoginAt)}`}
        action={<Link href="/admin/clients" className="btn-ghost">رجوع</Link>} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* بطاقة العميل والتواصل */}
        <div className="card space-y-4">
          <div className="flex items-center gap-3">
            <Avatar src={u.avatarUrl} name={u.name} size={56} />
            <div>
              <div className="text-lg font-extrabold">{u.name}</div>
              <div className="flex flex-wrap gap-1">
                <Badge tone={u.status === "active" ? "green" : "red"}>{u.status === "active" ? "نشط" : "موقوف"}</Badge>
                {u.isDemo && <Badge>تجريبي</Badge>}
              </div>
            </div>
          </div>
          <div className="space-y-1 text-sm" dir="ltr">
            {u.email && <div>✉️ <a href={`mailto:${u.email}`} className="text-brand-600 hover:underline">{u.email}</a></div>}
            {u.phone && <div>📞 {u.phone}</div>}
            <div className="faint text-xs">FB ID: {u.fbUserId}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="btn-ghost py-2 text-xs">💬 واتساب</a>}
            {u.email && <a href={`mailto:${u.email}`} className="btn-ghost py-2 text-xs">✉️ بريد</a>}
            <form action={impersonate}><input type="hidden" name="userId" value={u.id} /><button className="btn-ghost py-2 text-xs" title="ستخرج من جلسة الإدارة">👁 الدخول كالعميل</button></form>
            <form action={toggleSuspend}><input type="hidden" name="userId" value={u.id} /><button className={`${u.status === "active" ? "btn-danger" : "btn-primary"} py-2 text-xs`}>{u.status === "active" ? "إيقاف الحساب" : "إعادة التفعيل"}</button></form>
          </div>
          <form action={saveNote} className="space-y-2">
            <input type="hidden" name="userId" value={u.id} />
            <label className="label">ملاحظات داخلية</label>
            <textarea name="note" rows={3} className="input" defaultValue={u.adminNote ?? ""} placeholder="لا يراها العميل" />
            <button className="btn-ghost w-full py-2 text-xs">حفظ الملاحظة</button>
          </form>
        </div>

        {/* الاشتراك */}
        <div className="card space-y-4">
          <div className="font-extrabold">الاشتراك</div>
          <div className="flex items-center gap-2">
            <Badge tone={hasActiveSubscription(u) ? "green" : "amber"}>{SUB_STATUS_LABEL[u.subscriptionStatus]}</Badge>
            <span className="font-bold">{u.plan ? PLANS[u.plan as PlanId]?.name : "—"}</span>
          </div>
          {u.subscriptionEndsAt && <div className="muted text-sm">ينتهي: {fmtDate(u.subscriptionEndsAt)}</div>}
          {u.stripeCustomerId && <div className="faint text-xs" dir="ltr">Stripe: {u.stripeCustomerId}</div>}
          <form action={activateSubscription} className="space-y-2 rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
            <input type="hidden" name="userId" value={u.id} />
            <div className="text-sm font-bold">تفعيل / تمديد يدوي</div>
            <div className="grid grid-cols-2 gap-2">
              <select name="plan" className="input" defaultValue={u.plan ?? "starter"}>
                {(Object.keys(PLANS) as PlanId[]).map((p) => <option key={p} value={p}>{PLANS[p].name}</option>)}
              </select>
              <select name="months" className="input" defaultValue="1">
                {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} شهر</option>)}
              </select>
            </div>
            <button className="btn-primary w-full py-2">تفعيل</button>
          </form>
          <div className="flex gap-2">
            <form action={extendTrial} className="flex flex-1 gap-2">
              <input type="hidden" name="userId" value={u.id} />
              <input name="days" type="number" min={1} max={90} defaultValue={7} className="input w-20" />
              <button className="btn-ghost flex-1 py-2 text-xs">منح تجربة (أيام)</button>
            </form>
            <form action={cancelSubscription}><input type="hidden" name="userId" value={u.id} /><button className="py-2 text-xs font-bold text-red-600 hover:underline">إلغاء</button></form>
          </div>
        </div>

        {/* مراسلة */}
        <form action={messageClient} className="card space-y-3">
          <input type="hidden" name="userId" value={u.id} />
          <div className="font-extrabold">إرسال رسالة للعميل</div>
          <p className="faint text-xs">تظهر في قسم الدعم لدى العميل مع إشعار.</p>
          <input name="subject" className="input" placeholder="الموضوع" />
          <textarea name="body" required rows={5} className="input" placeholder="مرحباً، لاحظنا أن…" />
          <button className="btn-primary w-full">إرسال</button>
        </form>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="ردود هذا الشهر" value={monthReplies} hint={`الحد ${limitsFor(u).repliesPerMonth.toLocaleString("ar")}`} />
        <Stat label="إجمالي الردود" value={total.toLocaleString("ar")} />
        <Stat label="فشل (30 يوماً)" value={failed30} />
        <Stat label="منشورات" value={u.rules.length} hint={`${u.rules.filter((r) => r.enabled).length} نشط`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 font-extrabold">الحسابات المربوطة</div>
          {u.pages.length === 0 ? <p className="muted text-sm">لا يوجد</p> : (
            <ul className="space-y-2 text-sm">
              {u.pages.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><PlatformIcon platform={p.platform} /> {p.name} <span className="faint text-xs">({p._count.rules} منشور)</span></span>
                  {p.health === "error" ? <Badge tone="red" >⚠ {p.lastError?.slice(0, 30)}</Badge> : p.active ? <Badge tone="green">يعمل</Badge> : <Badge>متوقف</Badge>}
                </li>
              ))}
            </ul>
          )}
          <div className="mb-3 mt-6 font-extrabold">المنشورات</div>
          <ul className="space-y-2 text-sm">
            {u.rules.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">{r.name || r.postPreview?.slice(0, 50) || r.postId}</span>
                {r.enabled ? <Badge tone="green">نشط</Badge> : <Badge>متوقف</Badge>}
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <div className="mb-3 font-extrabold">الأحداث والأخطاء</div>
          <ul className="space-y-2 text-sm">
            {u.events.map((e) => (
              <li key={e.id} className="flex gap-2">
                <span>{e.level === "error" ? "🔴" : e.level === "warn" ? "🟡" : "🔵"}</span>
                <div className="min-w-0"><div className={e.resolved ? "muted" : ""}>{e.message}</div><div className="faint text-xs">{fmtDate(e.createdAt)}</div></div>
              </li>
            ))}
            {u.events.length === 0 && <li className="muted">لا يوجد</li>}
          </ul>
          <div className="mb-3 mt-6 font-extrabold">رسائل الدعم</div>
          <ul className="space-y-2 text-sm">
            {u.tickets.map((t) => (
              <li key={t.id} className="flex justify-between gap-2"><Link href={`/admin/tickets/${t.id}`} className="truncate text-brand-600 hover:underline">{t.subject}</Link><Badge tone={TICKET_STATUS[t.status]?.tone}>{TICKET_STATUS[t.status]?.label}</Badge></li>
            ))}
            {u.tickets.length === 0 && <li className="muted">لا يوجد</li>}
          </ul>
          <div className="mb-3 mt-6 font-extrabold">المدفوعات <Link href="/admin/payments?t=all" className="text-xs text-brand-600">(الكل)</Link></div>
          <ul className="space-y-2 text-sm">
            {u.payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>{formatLyd(p.amount)} · {PROVIDER_LABEL[p.provider] ?? p.provider} · {p.months} شهر <span className="faint text-xs">{fmtDate(p.createdAt)}</span></span>
                <Badge tone={p.status === "paid" ? "green" : p.status === "pending" ? "amber" : "red"}>{p.status === "paid" ? "مدفوع" : p.status === "pending" ? "معلّق" : p.status === "failed" ? "فشل" : "ملغى"}</Badge>
              </li>
            ))}
            {u.payments.length === 0 && <li className="muted">لا يوجد</li>}
          </ul>
        </div>
      </div>

      <div className="card mt-4">
        <div className="mb-3 font-extrabold">آخر التعليقات</div>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>الوقت</th><th>المعلّق</th><th>التعليق</th><th>الحالة</th><th></th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="faint whitespace-nowrap text-xs">{fmtDate(l.createdAt)}</td>
                <td>{l.commenterName}</td>
                <td className="max-w-xs">{l.commentText}</td>
                <td>
                  <Badge tone={LOG_STATUS[l.status]?.tone}>{LOG_STATUS[l.status]?.label}</Badge>
                  {l.skipReason && <div className="faint text-xs">{SKIP_REASON[l.skipReason] ?? l.skipReason}</div>}
                  {l.error && <div className="text-xs text-red-600">{l.error}</div>}
                </td>
                <td>{(l.status === "failed" || l.status === "partial") && (
                  <form action={retryLog}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="userId" value={u.id} /><button className="btn-ghost py-1 text-xs">↻ إعادة</button></form>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
