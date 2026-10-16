import Link from "next/link";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { toTemplateData } from "@/lib/messenger";
import { parseList } from "@/lib/text";
import { requireUser } from "@/lib/session";

export default async function Messages() {
  const user = await requireUser();
  const list = await db.messageTemplate.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, include: { _count: { select: { rules: true } } } });
  return (
    <div>
      <PageHeader title="الرسائل التفاعلية" desc="صور، بطاقات منتجات، وأزرار تُرسل للزبون في الخاص (ماسنجر وإنستغرام)"
        action={<Link href="/dashboard/messages/new" className="btn-primary">+ رسالة جديدة</Link>} />
      {list.length === 0 ? (
        <Empty title="لا توجد رسائل تفاعلية بعد" desc="أنشئ قائمة منتجات بالصور والأزرار، واربطها بمنشوراتك ليستلمها كل من يعلّق في الخاص."
          action={<Link href="/dashboard/messages/new" className="btn-primary">إنشاء أول رسالة</Link>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => {
            const d = toTemplateData(t);
            const kw = parseList(t.keywords);
            const cards = d.messages.reduce((n, m) => n + (m.kind === "cards" ? m.cards.length : 0), 0);
            const images = d.messages.filter((m) => m.kind === "image").length;
            return (
              <Link key={t.id} href={`/dashboard/messages/${t.id}`} className="card block transition hover:border-brand-300">
                <div className="font-semibold">{t.name}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge>{d.messages.length === 1 ? "جزء واحد" : `${d.messages.length} أجزاء`}</Badge>
                  {cards > 0 && <Badge tone="blue">🛍 {cards === 1 ? "بطاقة" : `${cards} بطاقات`}</Badge>}
                  {images > 0 && <Badge tone="blue">🖼 {images === 1 ? "صورة" : `${images} صور`}</Badge>}
                  {d.quickReplies.length > 0 && <Badge>{d.quickReplies.length === 1 ? "خيار سريع" : `${d.quickReplies.length} خيارات`}</Badge>}
                  {kw.length > 0 && <Badge tone="amber">🔑 {kw.slice(0, 2).join("، ")}</Badge>}
                </div>
                <div className="faint mt-3 text-xs">أُرسلت {t.sendCount.toLocaleString("ar")} مرة · مستخدمة في {t._count.rules} منشور</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
