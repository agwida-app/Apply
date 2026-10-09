import { Shell } from "@/components/Shell";
import { Avatar, Badge } from "@/components/ui";
import { db } from "@/lib/db";
import { SUB_STATUS_LABEL, hasActiveSubscription } from "@/lib/plans";
import { requireUser } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [unread, broken] = await Promise.all([
    db.ticket.count({ where: { userId: user.id, unreadByUser: true } }),
    db.page.count({ where: { userId: user.id, health: "error" } }),
  ]);
  const active = hasActiveSubscription(user);
  return (
    <Shell
      brand="ردّ"
      nav={[
        { href: "/dashboard", label: "الرئيسية", icon: "🏠" },
        { href: "/dashboard/rules", label: "المنشورات والردود", icon: "💬" },
        { href: "/dashboard/accounts", label: "الحسابات المربوطة", icon: "🔗", badge: broken },
        { href: "/dashboard/activity", label: "سجل النشاط", icon: "📋" },
        { href: "/dashboard/billing", label: "الاشتراك", icon: "💳" },
        { href: "/dashboard/support", label: "الدعم", icon: "🛟", badge: unread },
      ]}
      user={
        <div className="flex items-center gap-3">
          <Avatar src={user.avatarUrl} name={user.name} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{user.name}</div>
            <Badge tone={active ? "green" : "amber"}>{SUB_STATUS_LABEL[user.subscriptionStatus]}</Badge>
          </div>
          <form action="/api/auth/logout" method="post"><button className="faint text-xs hover:underline">خروج</button></form>
        </div>
      }
    >
      {children}
    </Shell>
  );
}
