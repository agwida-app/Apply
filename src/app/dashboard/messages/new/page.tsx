import { TemplateEditor } from "@/components/TemplateEditor";
import { PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { toTemplateData } from "@/lib/messenger";
import { requireUser } from "@/lib/session";

export default async function NewTemplate() {
  const user = await requireUser();
  const [others, page] = await Promise.all([
    db.messageTemplate.findMany({ where: { userId: user.id } }),
    db.page.findFirst({ where: { userId: user.id, platform: { not: "tiktok" } } }),
  ]);
  return (
    <div>
      <PageHeader title="رسالة تفاعلية جديدة" />
      <TemplateEditor others={others.map(toTemplateData)} pageName={page?.name ?? "صفحتك"} />
    </div>
  );
}
