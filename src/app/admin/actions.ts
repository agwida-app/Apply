"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { PLANS, PlanId } from "@/lib/plans";
import { clearSession, requireAdmin, setSession } from "@/lib/session";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const done = (userId?: string) => { revalidatePath("/admin", "layout"); if (userId) revalidatePath(`/admin/clients/${userId}`); };

export async function activateSubscription(f: FormData) {
  await requireAdmin();
  const userId = str(f, "userId");
  const plan = str(f, "plan") as PlanId;
  const months = Math.max(1, Math.min(24, Number(str(f, "months")) || 1));
  if (!PLANS[plan]) return;
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  // التمديد يبدأ من نهاية الاشتراك الحالي إن كان سارياً
  const base = user.subscriptionStatus === "active" && user.subscriptionEndsAt && user.subscriptionEndsAt > new Date() ? user.subscriptionEndsAt : new Date();
  const ends = new Date(base); ends.setMonth(ends.getMonth() + months);
  await db.user.update({ where: { id: userId }, data: { plan, subscriptionStatus: "active", subscriptionEndsAt: ends } });
  await db.systemEvent.updateMany({ where: { userId, source: "billing", resolved: false }, data: { resolved: true } });
  await logEvent("info", "admin", `تفعيل باقة ${PLANS[plan].name} لمدة ${months} شهر`, userId);
  done(userId);
}

export async function extendTrial(f: FormData) {
  await requireAdmin();
  const userId = str(f, "userId");
  const days = Math.max(1, Math.min(90, Number(str(f, "days")) || 7));
  await db.user.update({ where: { id: userId }, data: { subscriptionStatus: "trialing", subscriptionEndsAt: new Date(Date.now() + days * 86400e3) } });
  await logEvent("info", "admin", `منح فترة تجريبية ${days} يوم`, userId);
  done(userId);
}

export async function cancelSubscription(f: FormData) {
  await requireAdmin();
  const userId = str(f, "userId");
  await db.user.update({ where: { id: userId }, data: { subscriptionStatus: "canceled" } });
  await logEvent("warn", "admin", "إلغاء الاشتراك من الإدارة", userId);
  done(userId);
}

export async function toggleSuspend(f: FormData) {
  await requireAdmin();
  const userId = str(f, "userId");
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  await db.user.update({ where: { id: userId }, data: { status: u.status === "active" ? "suspended" : "active" } });
  await logEvent("warn", "admin", u.status === "active" ? "تم إيقاف الحساب" : "تم إعادة تفعيل الحساب", userId);
  done(userId);
}

export async function saveNote(f: FormData) {
  await requireAdmin();
  const userId = str(f, "userId");
  await db.user.update({ where: { id: userId }, data: { adminNote: str(f, "note").slice(0, 5000) || null } });
  done(userId);
}

/** رسالة من الإدارة للعميل: تظهر في قسم الدعم لديه مع إشعار */
export async function messageClient(f: FormData) {
  await requireAdmin();
  const userId = str(f, "userId");
  const subject = str(f, "subject").slice(0, 150) || "رسالة من فريق الدعم";
  const body = str(f, "body").slice(0, 5000);
  if (!body) return;
  const t = await db.ticket.create({ data: { userId, subject, status: "answered", unreadByUser: true, unreadByAdmin: false, messages: { create: { fromAdmin: true, body } } } });
  redirect(`/admin/tickets/${t.id}`);
}

export async function adminReplyTicket(f: FormData) {
  await requireAdmin();
  const id = str(f, "id");
  const body = str(f, "body").slice(0, 5000);
  if (!body) return;
  await db.ticket.update({ where: { id }, data: { status: "answered", unreadByUser: true, unreadByAdmin: false, messages: { create: { fromAdmin: true, body } } } });
  done();
  revalidatePath(`/admin/tickets/${id}`);
}

export async function closeTicket(f: FormData) {
  await requireAdmin();
  await db.ticket.update({ where: { id: str(f, "id") }, data: { status: "closed", unreadByAdmin: false } });
  done();
}

export async function resolveEvent(f: FormData) {
  await requireAdmin();
  const id = str(f, "id");
  if (id === "all") await db.systemEvent.updateMany({ where: { resolved: false }, data: { resolved: true } });
  else await db.systemEvent.update({ where: { id }, data: { resolved: true } });
  done();
}

export async function retryLog(f: FormData) {
  await requireAdmin();
  const id = str(f, "id");
  await db.replyLog.updateMany({ where: { id, status: { in: ["failed", "partial"] } }, data: { status: "pending", attempts: 0, runAt: new Date() } });
  const { processLog } = await import("@/lib/engine");
  await processLog(id);
  done(str(f, "userId"));
}

/** الدخول كعميل لمساعدته (يُسجّل في الأحداث) */
export async function impersonate(f: FormData) {
  await requireAdmin();
  const userId = str(f, "userId");
  await logEvent("info", "admin", "دخول الإدارة إلى حساب العميل للدعم", userId);
  await setSession({ role: "client", userId });
  redirect("/dashboard");
}

export async function adminLogout() {
  await clearSession();
  redirect("/admin/login");
}
