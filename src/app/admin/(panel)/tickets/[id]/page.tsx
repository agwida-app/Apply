import Link from "next/link";
import { notFound } from "next/navigation";
import { Thread } from "@/components/Thread";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { adminReplyTicket, closeTicket } from "../../../actions";

export default async function AdminTicket({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await db.ticket.findUnique({ where: { id }, include: { user: true, messages: { orderBy: { createdAt: "asc" } } } });
  if (!t) notFound();
  if (t.unreadByAdmin) await db.ticket.update({ where: { id: t.id }, data: { unreadByAdmin: false } });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t.subject} desc={`من: ${t.user.name}`}
        action={<div className="flex gap-2">
          <Link href={`/admin/clients/${t.userId}`} className="btn-ghost">ملف العميل</Link>
          {t.status !== "closed" && <form action={closeTicket}><input type="hidden" name="id" value={t.id} /><button className="btn-ghost">إغلاق</button></form>}
        </div>} />
      <div className="card"><Thread messages={t.messages} viewer="admin" /></div>
      <form action={adminReplyTicket} className="card mt-4 flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="id" value={t.id} />
        <textarea name="body" required rows={2} className="input" placeholder="اكتب ردك…" />
        <button className="btn-primary shrink-0">إرسال</button>
      </form>
    </div>
  );
}
