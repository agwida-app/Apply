import Link from "next/link";
import { notFound } from "next/navigation";
import { TemplateEditor } from "@/components/TemplateEditor";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { toTemplateData } from "@/lib/messenger";
import { parseList } from "@/lib/text";
import { requireUser } from "@/lib/session";
import { deleteTemplate } from "../../template-actions";

export default async function EditTemplate({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [t, others, page] = await Promise.all([
    db.messageTemplate.findFirst({ where: { id, userId: user.id } }),
    db.messageTemplate.findMany({ where: { userId: user.id, id: { not: id } } }),
    db.page.findFirst({ where: { userId: user.id, platform: { not: "tiktok" } } }),
  ]);
  if (!t) notFound();
  return (
    <div>
      <PageHeader title={t.name} desc={`أُرسلت ${t.sendCount.toLocaleString("ar")} مرة`} action={<Link href="/dashboard/messages" className="btn-ghost">رجوع</Link>} />
      <TemplateEditor key={t.updatedAt.toISOString()} initial={{ ...toTemplateData(t), keywords: parseList(t.keywords) }} others={others.map(toTemplateData)} pageName={page?.name ?? "صفحتك"} />
      <form action={deleteTemplate} className="mt-8 text-center">
        <input type="hidden" name="id" value={t.id} />
        <button className="text-sm font-medium text-rose-600 hover:underline">🗑 حذف هذه الرسالة</button>
      </form>
    </div>
  );
}
