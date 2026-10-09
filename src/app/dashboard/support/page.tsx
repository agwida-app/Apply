import Link from "next/link";
import { Badge, PageHeader, TICKET_STATUS, fmtDate } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { createTicket } from "../actions";

export default async function Support() {
  const user = await requireUser();
  const tickets = await db.ticket.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
  const wa = process.env.SUPPORT_WHATSAPP;
  return (
    <div>
      <PageHeader title="الدعم الفني" desc="راسلنا وسنرد عليك في أقرب وقت" />
      <div className="grid gap-4 lg:grid-cols-5">
        <form action={createTicket} className="card space-y-3 lg:col-span-2 lg:self-start">
          <div className="font-extrabold">رسالة جديدة</div>
          <div><label className="label">الموضوع</label><input name="subject" required className="input" placeholder="مثال: الرد لا يعمل على منشور" /></div>
          <div><label className="label">التفاصيل</label><textarea name="body" required rows={5} className="input" /></div>
          <button className="btn-primary w-full">إرسال</button>
          {wa && <a href={`https://wa.me/${wa.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="btn-ghost w-full">💬 أو تواصل عبر واتساب</a>}
        </form>
        <div className="card lg:col-span-3">
          <div className="mb-3 font-extrabold">رسائلك</div>
          {tickets.length === 0 ? <p className="muted text-sm">لا توجد رسائل.</p> : (
            <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/dashboard/support/${t.id}`} className="flex items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <div className="truncate font-bold">{t.unreadByUser && <span className="me-1 inline-block h-2 w-2 rounded-full bg-red-500" />}{t.subject}</div>
                      <div className="faint text-xs">{fmtDate(t.updatedAt)}</div>
                    </div>
                    <Badge tone={TICKET_STATUS[t.status]?.tone}>{TICKET_STATUS[t.status]?.label}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
