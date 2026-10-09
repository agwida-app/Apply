import Link from "next/link";
import { notFound } from "next/navigation";
import { Thread } from "@/components/Thread";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { replyTicket } from "../../actions";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const t = await db.ticket.findFirst({ where: { id, userId: user.id }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (!t) notFound();
  if (t.unreadByUser) await db.ticket.update({ where: { id: t.id }, data: { unreadByUser: false } });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t.subject} action={<Link href="/dashboard/support" className="btn-ghost">رجوع</Link>} />
      <div className="card"><Thread messages={t.messages} viewer="client" /></div>
      <form action={replyTicket} className="card mt-4 flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="id" value={t.id} />
        <textarea name="body" required rows={2} className="input" placeholder="اكتب ردك…" />
        <button className="btn-primary shrink-0">إرسال</button>
      </form>
    </div>
  );
}
