import Link from "next/link";
import { Badge, Empty, LOG_STATUS, PageHeader, SKIP_REASON, fmtDate } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

const FILTERS = [["", "الكل"], ["done", "تم الرد"], ["failed", "فشل"], ["skipped", "تم تجاهله"], ["pending", "مجدول"]] as const;
const PER_PAGE = 30;

export default async function Activity({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const { status = "", page = "1" } = await searchParams;
  const user = await requireUser();
  const p = Math.max(1, Number(page) || 1);
  const where = { userId: user.id, ...(status ? { status } : {}) };
  const [logs, total] = await Promise.all([
    db.replyLog.findMany({ where, orderBy: { createdAt: "desc" }, take: PER_PAGE, skip: (p - 1) * PER_PAGE, include: { page: true, rule: true } }),
    db.replyLog.count({ where }),
  ]);
  const pages = Math.ceil(total / PER_PAGE);
  const href = (o: { status?: string; page?: number }) => `/dashboard/activity?status=${o.status ?? status}&page=${o.page ?? 1}`;

  return (
    <div>
      <PageHeader title="سجل النشاط" desc="كل تعليق وصل وما الذي حدث معه" />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(([v, l]) => (
          <Link key={v} href={href({ status: v })} className={`rounded-full px-4 py-1.5 text-sm font-bold ${status === v ? "bg-brand-600 text-white" : "border"}`} style={status === v ? undefined : { borderColor: "var(--border)" }}>{l}</Link>
        ))}
      </div>
      {logs.length === 0 ? <Empty title="لا يوجد نشاط" /> : (
        <div className="card">
          <div className="table-wrap"><table className="table">
            <thead><tr><th>الوقت</th><th>المعلّق</th><th>التعليق</th><th>المنشور</th><th>الحالة</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="faint whitespace-nowrap text-xs">{fmtDate(l.createdAt)}</td>
                  <td className="font-bold">{l.commenterName ?? "—"}</td>
                  <td className="max-w-xs">{l.commentText}</td>
                  <td className="text-xs">{l.rule ? <Link href={`/dashboard/rules/${l.rule.id}`} className="text-brand-600 hover:underline">{l.rule.name || l.rule.postPreview?.slice(0, 30) || "منشور"}</Link> : "—"}<div className="faint">{l.page.name}</div></td>
                  <td>
                    <Badge tone={LOG_STATUS[l.status]?.tone}>{LOG_STATUS[l.status]?.label}</Badge>
                    {l.skipReason && <div className="faint mt-1 text-xs">{SKIP_REASON[l.skipReason] ?? l.skipReason}</div>}
                    {l.error && <div className="mt-1 text-xs text-red-600">{l.error}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              {p > 1 && <Link href={href({ page: p - 1 })} className="btn-ghost py-1.5">السابق</Link>}
              <span className="muted">{p} / {pages}</span>
              {p < pages && <Link href={href({ page: p + 1 })} className="btn-ghost py-1.5">التالي</Link>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
