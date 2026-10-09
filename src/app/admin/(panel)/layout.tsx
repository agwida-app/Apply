import { Shell } from "@/components/Shell";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { adminLogout } from "../actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const [tickets, errors, pendingPayments] = await Promise.all([
    db.ticket.count({ where: { unreadByAdmin: true, status: { not: "closed" } } }),
    db.systemEvent.count({ where: { resolved: false, level: { in: ["error", "warn"] } } }),
    db.payment.count({ where: { provider: "manual", status: "pending" } }),
  ]);
  return (
    <Shell brand="ردّ · الإدارة"
      nav={[
        { href: "/admin", label: "نظرة عامة", icon: "📊" },
        { href: "/admin/clients", label: "العملاء", icon: "👥" },
        { href: "/admin/payments", label: "المدفوعات", icon: "💰", badge: pendingPayments },
        { href: "/admin/events", label: "المشاكل والتنبيهات", icon: "🚨", badge: errors },
        { href: "/admin/tickets", label: "رسائل الدعم", icon: "✉️", badge: tickets },
      ]}
      user={<form action={adminLogout} className="flex items-center justify-between text-sm"><span className="font-bold">👑 المدير</span><button className="faint text-xs hover:underline">خروج</button></form>}>
      {children}
    </Shell>
  );
}
