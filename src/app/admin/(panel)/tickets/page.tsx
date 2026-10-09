import Link from "next/link";
import { Badge, PageHeader, TICKET_STATUS, fmtDate } from "@/components/ui";
import { db } from "@/lib/db";

export default async function AdminTickets() {
  const tickets = await db.ticket.findMany({ orderBy: [{ unreadByAdmin: "desc" }, { updatedAt: "desc" }], take: 200, include: { user: true } });
  return (
    <div>
      <PageHeader title="رسائل الدعم" />
      <div className="card">
        {tickets.length === 0 ? <p className="muted text-sm">لا توجد رسائل</p> : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/admin/tickets/${t.id}`} className="flex items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-bold">{t.unreadByAdmin && t.status !== "closed" && <span className="me-1 inline-block h-2 w-2 rounded-full bg-red-500" />}{t.subject}</div>
                    <div className="faint text-xs">{t.user.name} · {fmtDate(t.updatedAt)}</div>
                  </div>
                  <Badge tone={TICKET_STATUS[t.status]?.tone}>{TICKET_STATUS[t.status]?.label}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
