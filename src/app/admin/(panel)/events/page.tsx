import Link from "next/link";
import { Badge, PageHeader, fmtDate } from "@/components/ui";
import { db } from "@/lib/db";
import { resolveEvent } from "../../actions";

const LEVELS = [["", "غير المحلولة"], ["error", "أخطاء"], ["warn", "تحذيرات"], ["info", "معلومات"], ["all", "الكل"]] as const;

export default async function Events({ searchParams }: { searchParams: Promise<{ l?: string }> }) {
  const { l = "" } = await searchParams;
  const where = l === "all" ? {} : l ? { level: l } : { resolved: false, level: { in: ["error", "warn"] } };
  const events = await db.systemEvent.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, include: { user: true } });
  return (
    <div>
      <PageHeader title="المشاكل والتنبيهات" desc="أخطاء الردود، انتهاء صلاحيات الربط، طلبات الدفع، وغيرها"
        action={<form action={resolveEvent}><input type="hidden" name="id" value="all" /><button className="btn-ghost">✓ تعليم الكل كمحلول</button></form>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {LEVELS.map(([v, t]) => (
          <Link key={v} href={`/admin/events?l=${v}`} className={`rounded-full px-4 py-1.5 text-sm font-bold ${l === v ? "bg-brand-600 text-white" : "border"}`} style={l === v ? undefined : { borderColor: "var(--border)" }}>{t}</Link>
        ))}
      </div>
      <div className="card">
        {events.length === 0 ? <p className="muted text-sm">✓ لا توجد مشاكل</p> : (
          <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
            {events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start gap-3 py-3">
                <Badge tone={e.level === "error" ? "red" : e.level === "warn" ? "amber" : "blue"}>{e.level === "error" ? "خطأ" : e.level === "warn" ? "تحذير" : "معلومة"}</Badge>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm ${e.resolved ? "muted line-through" : ""}`}>{e.message}</div>
                  <div className="faint text-xs">
                    {e.source} · {fmtDate(e.createdAt)}
                    {e.user && <> · <Link href={`/admin/clients/${e.user.id}`} className="text-brand-600 hover:underline">{e.user.name}</Link></>}
                  </div>
                </div>
                {!e.resolved && <form action={resolveEvent}><input type="hidden" name="id" value={e.id} /><button className="btn-ghost py-1 text-xs">✓ تم الحل</button></form>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
