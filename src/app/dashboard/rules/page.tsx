import Link from "next/link";
import { Alert, Badge, Empty, PageHeader, PlatformIcon } from "@/components/ui";
import { db } from "@/lib/db";
import { parseList } from "@/lib/text";
import { requireUser } from "@/lib/session";
import { toggleRule } from "../actions";

export default async function Rules({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const user = await requireUser();
  const rules = await db.rule.findMany({
    where: { userId: user.id }, orderBy: { createdAt: "desc" },
    include: { page: true, _count: { select: { logs: { where: { status: { in: ["done", "partial"] } } } } } },
  });
  return (
    <div>
      <PageHeader title="المنشورات والردود" desc="كل منشور له رده الخاص ورسالته الخاصة"
        action={<Link href="/dashboard/rules/new" className="btn-primary">+ إضافة منشور</Link>} />
      {error === "limit" && <Alert tone="red">وصلت للحد الأقصى من المنشورات النشطة في باقتك.</Alert>}
      {rules.length === 0 ? (
        <Empty title="لم تضف أي منشور بعد" desc="اختر منشوراً من صفحتك واكتب الرد والرسالة التي تصل للزبون."
          action={<Link href="/dashboard/rules/new" className="btn-primary">إضافة أول منشور</Link>} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rules.map((r) => {
            const kw = parseList(r.keywords);
            return (
              <div key={r.id} className="card flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2 text-sm font-bold"><PlatformIcon platform={r.page.platform} /><span className="truncate">{r.page.name}</span></div>
                  {r.enabled ? <Badge tone="green">● يعمل</Badge> : <Badge>متوقف</Badge>}
                </div>
                <Link href={`/dashboard/rules/${r.id}`} className="mt-3 flex-1">
                  {r.name && <div className="font-extrabold">{r.name}</div>}
                  <p className="muted line-clamp-2 text-sm">{r.postPreview || "(منشور بدون نص)"}</p>
                </Link>
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  {r.publicReply && <Badge tone="blue">💬 رد علني</Badge>}
                  {r.privateReply && <Badge tone="blue">📩 رسالة خاصة</Badge>}
                  {kw.length > 0 && <Badge tone="amber">🔑 {kw.length} كلمات</Badge>}
                  {r.delaySeconds > 0 && <Badge>⏱ تأخير</Badge>}
                </div>
                <div className="mt-4 flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--border)" }}>
                  <span className="text-sm"><b className="tabular-nums">{r._count.logs.toLocaleString("ar")}</b> <span className="muted">رد</span></span>
                  <div className="flex gap-2">
                    <form action={toggleRule}><input type="hidden" name="id" value={r.id} /><button className="btn-ghost py-1.5 text-xs">{r.enabled ? "⏸ إيقاف" : "▶ تشغيل"}</button></form>
                    <Link href={`/dashboard/rules/${r.id}`} className="btn-ghost py-1.5 text-xs">تفاصيل</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
