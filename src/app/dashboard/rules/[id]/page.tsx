import Link from "next/link";
import { notFound } from "next/navigation";
import { RuleEditor } from "@/components/RuleEditor";
import { Alert, Badge, LOG_STATUS, PageHeader, SKIP_REASON, Stat, fmtDate } from "@/components/ui";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { parseList } from "@/lib/text";
import { requireUser } from "@/lib/session";
import { deleteRule, simulateComment, toggleRule } from "../../actions";

export default async function RuleDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const user = await requireUser();
  const rule = await db.rule.findFirst({ where: { id, userId: user.id }, include: { page: true } });
  if (!rule) notFound();

  const [stats, logs] = await Promise.all([
    db.replyLog.groupBy({ by: ["status"], where: { ruleId: rule.id }, _count: true }),
    db.replyLog.findMany({ where: { ruleId: rule.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const count = (s: string) => stats.find((x) => x.status === s)?._count ?? 0;
  const isDemo = decrypt(rule.page.accessToken).startsWith("demo:");

  return (
    <div>
      <PageHeader title={rule.name || "تفاصيل المنشور"} desc={rule.page.name}
        action={
          <div className="flex gap-2">
            <form action={toggleRule}><input type="hidden" name="id" value={rule.id} /><button className={rule.enabled ? "btn-ghost" : "btn-primary"}>{rule.enabled ? "⏸ إيقاف الردود" : "▶ تشغيل الردود"}</button></form>
            <Link href="/dashboard/rules" className="btn-ghost">رجوع</Link>
          </div>
        } />
      {saved && <Alert tone="green">✓ تم الحفظ. الردود التلقائية {rule.enabled ? "تعمل الآن على هذا المنشور" : "متوقفة لهذا المنشور"}.</Alert>}

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="تم الرد" value={count("done")} />
        <Stat label="جزئي" value={count("partial")} hint="نجح أحد الردين فقط" />
        <Stat label="فشل" value={count("failed")} />
        <Stat label="تم تجاهله" value={count("skipped")} hint="كلمات مفتاحية / مكرر" />
      </div>

      {isDemo && (
        <form action={simulateComment} className="card mb-4 border-2 border-dashed border-brand-300 dark:border-brand-700">
          <input type="hidden" name="id" value={rule.id} />
          <div className="mb-3 font-extrabold">🧪 محاكاة تعليق زبون (الوضع التجريبي)</div>
          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <input name="name" className="input" placeholder="اسم الزبون" defaultValue="محمد علي" />
            <input name="text" className="input" placeholder="نص التعليق" defaultValue={parseList(rule.keywords)[0] ?? "كم السعر؟"} />
            <button className="btn-primary">إرسال التعليق</button>
          </div>
          <label className="faint mt-2 flex items-center gap-2 text-xs"><input type="checkbox" name="sameUser" /> نفس الشخص في كل مرة (لتجربة «مرة واحدة لكل شخص»)</label>
        </form>
      )}

      <div className="card mb-8">
        <div className="mb-3 font-extrabold">آخر التعليقات على هذا المنشور</div>
        {logs.length === 0 ? <p className="muted text-sm">لم تصل تعليقات بعد. علّق على المنشور من حساب آخر لتجربة الرد.</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>المعلّق</th><th>التعليق</th><th>الحالة</th><th>التفاصيل</th><th>الوقت</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="font-bold">{l.commenterName ?? "—"}</td>
                  <td className="max-w-xs">{l.commentText}</td>
                  <td><Badge tone={LOG_STATUS[l.status]?.tone}>{LOG_STATUS[l.status]?.label}</Badge></td>
                  <td className="muted text-xs">
                    {l.skipReason && (SKIP_REASON[l.skipReason] ?? l.skipReason)}
                    {l.publicStatus && <div>💬 {l.publicStatus === "sent" ? "أُرسل" : l.publicStatus === "off" ? "—" : "فشل"}</div>}
                    {l.privateStatus && <div>📩 {l.privateStatus === "sent" ? "أُرسلت" : l.privateStatus === "off" ? "—" : "فشلت"}</div>}
                    {l.error && <div className="text-red-600">{l.error}</div>}
                  </td>
                  <td className="faint whitespace-nowrap text-xs">{fmtDate(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      <h2 className="mb-3 text-lg font-extrabold">تعديل الرد والرسالة</h2>
      <RuleEditor pages={[]} initial={{
        id: rule.id, pageId: rule.pageId, postId: rule.postId, postUrl: rule.postUrl, postPreview: rule.postPreview, postImage: rule.postImage,
        name: rule.name ?? "", publicReply: rule.publicReply, replyVariants: parseList(rule.replyVariants), privateReply: rule.privateReply,
        dmMessage: rule.dmMessage ?? "", keywords: parseList(rule.keywords), oncePerUser: rule.oncePerUser, delaySeconds: rule.delaySeconds,
        pageName: rule.page.name, platform: rule.page.platform,
      }} />

      <form action={deleteRule} className="mt-8 text-center">
        <input type="hidden" name="id" value={rule.id} />
        <button className="text-sm font-bold text-red-600 hover:underline">🗑 حذف هذا المنشور من الردود التلقائية</button>
      </form>
    </div>
  );
}
