import Link from "next/link";
import { Avatar, Badge, PageHeader, fmtDate } from "@/components/ui";
import { db } from "@/lib/db";
import { startOfMonth } from "@/lib/engine";
import { PLANS, PlanId, SUB_STATUS_LABEL, hasActiveSubscription } from "@/lib/plans";

const FILTERS = [["", "الكل"], ["active", "نشط"], ["trialing", "تجربة"], ["pending", "بانتظار الدفع"], ["canceled", "ملغى"], ["issues", "لديهم مشاكل"]] as const;

export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  const { q = "", f = "" } = await searchParams;
  const users = await db.user.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }] } : {}),
      ...(f === "issues" ? { pages: { some: { health: "error" } } } : f ? { subscriptionStatus: f } : {}),
    },
    orderBy: { lastLoginAt: "desc" },
    take: 200,
    include: { pages: { select: { health: true } }, _count: { select: { rules: { where: { enabled: true } } } } },
  });
  const usage = await db.replyLog.groupBy({ by: ["userId"], where: { status: { in: ["done", "partial"] }, createdAt: { gte: startOfMonth() } }, _count: true });
  const usageMap = new Map(usage.map((u) => [u.userId, u._count]));

  return (
    <div>
      <PageHeader title="العملاء" desc={`${users.length} عميل`} />
      <form className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input name="q" defaultValue={q} className="input" placeholder="بحث بالاسم أو البريد أو الهاتف…" />
        <input type="hidden" name="f" value={f} />
        <button className="btn-primary">بحث</button>
      </form>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map(([v, l]) => (
          <Link key={v} href={`/admin/clients?f=${v}&q=${encodeURIComponent(q)}`} className={`rounded-full px-4 py-1.5 text-sm font-bold ${f === v ? "bg-brand-600 text-white" : "border"}`} style={f === v ? undefined : { borderColor: "var(--border)" }}>{l}</Link>
        ))}
      </div>
      <div className="card">
        <div className="table-wrap"><table className="table">
          <thead><tr><th>العميل</th><th>الاشتراك</th><th>حسابات</th><th>منشورات نشطة</th><th>ردود الشهر</th><th>آخر دخول</th></tr></thead>
          <tbody>
            {users.map((u) => {
              const broken = u.pages.filter((p) => p.health === "error").length;
              return (
                <tr key={u.id}>
                  <td>
                    <Link href={`/admin/clients/${u.id}`} className="flex items-center gap-2 font-bold hover:underline">
                      <Avatar src={u.avatarUrl} name={u.name} size={28} /> {u.name}
                      {u.status === "suspended" && <Badge tone="red">موقوف</Badge>}{u.isDemo && <Badge>تجريبي</Badge>}
                    </Link>
                    <div className="faint text-xs" dir="ltr">{u.email ?? u.phone ?? ""}</div>
                  </td>
                  <td>
                    <Badge tone={hasActiveSubscription(u) ? "green" : u.subscriptionStatus === "pending" ? "amber" : "gray"}>{SUB_STATUS_LABEL[u.subscriptionStatus]}</Badge>
                    <div className="faint text-xs">{u.plan ? PLANS[u.plan as PlanId]?.name : ""}{u.subscriptionEndsAt ? ` · حتى ${fmtDate(u.subscriptionEndsAt)}` : ""}</div>
                  </td>
                  <td>{u.pages.length} {broken > 0 && <Badge tone="red">⚠ {broken}</Badge>}</td>
                  <td>{u._count.rules}</td>
                  <td className="tabular-nums">{(usageMap.get(u.id) ?? 0).toLocaleString("ar")}</td>
                  <td className="faint whitespace-nowrap text-xs">{fmtDate(u.lastLoginAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
