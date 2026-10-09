"use server";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { handleIncomingComment } from "@/lib/engine";
import { logEvent } from "@/lib/events";
import { findPostByUrl, getManagedAccounts, listPosts, MetaError, Post, subscribePage, unsubscribePage } from "@/lib/meta";
import { DURATIONS, hasActiveSubscription, limitsFor, PLANS, PlanId, priceLydFor } from "@/lib/plans";
import { newInvoiceNo } from "@/lib/billing";
import { requireUser } from "@/lib/session";
import { priceFor, stripe, stripeEnabled } from "@/lib/stripe";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------- الحسابات ----------
export async function connectAccount(form: FormData) {
  const user = await requireUser();
  const platform = String(form.get("platform"));
  const externalId = String(form.get("externalId"));
  if (!hasActiveSubscription(user)) redirect("/dashboard/billing?need=1");
  if (!user.fbUserToken) redirect("/login");

  const acc = (await getManagedAccounts(decrypt(user.fbUserToken))).find((a) => a.platform === platform && a.externalId === externalId);
  if (!acc) redirect("/dashboard/accounts?error=not_found");

  const existing = await db.page.findUnique({ where: { platform_externalId: { platform, externalId } } });
  if (existing && existing.userId !== user.id) redirect("/dashboard/accounts?error=taken");
  if (!existing) {
    const count = await db.page.count({ where: { userId: user.id } });
    if (count >= limitsFor(user).pages) redirect("/dashboard/accounts?error=limit");
  }
  try {
    await subscribePage(acc.fbPageId, acc.accessToken);
  } catch (e) {
    await logEvent("error", "auth", `فشل اشتراك الصفحة ${acc.name} في الـ Webhook: ${errMsg(e)}`, user.id);
    redirect("/dashboard/accounts?error=subscribe");
  }
  const data = { name: acc.name, pictureUrl: acc.picture, accessToken: encrypt(acc.accessToken), fbPageId: acc.fbPageId, health: "ok", lastError: null, active: true };
  if (existing) await db.page.update({ where: { id: existing.id }, data });
  else await db.page.create({ data: { ...data, userId: user.id, platform, externalId } });
  await logEvent("info", "auth", `تم ربط ${platform === "instagram" ? "حساب إنستغرام" : "صفحة"}: ${acc.name}`, user.id);
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/accounts?ok=1");
}

export async function toggleAccount(form: FormData) {
  const user = await requireUser();
  const page = await db.page.findFirst({ where: { id: String(form.get("id")), userId: user.id } });
  if (!page) return;
  await db.page.update({ where: { id: page.id }, data: { active: !page.active } });
  revalidatePath("/dashboard", "layout");
}

export async function removeAccount(form: FormData) {
  const user = await requireUser();
  const page = await db.page.findFirst({ where: { id: String(form.get("id")), userId: user.id } });
  if (!page) return;
  const others = await db.page.count({ where: { fbPageId: page.fbPageId, id: { not: page.id } } });
  if (!others) await unsubscribePage(page.fbPageId, decrypt(page.accessToken));
  await db.page.delete({ where: { id: page.id } });
  revalidatePath("/dashboard", "layout");
}

// ---------- المنشورات ----------
async function ownedPage(pageId: string) {
  const user = await requireUser();
  const page = await db.page.findFirst({ where: { id: pageId, userId: user.id } });
  if (!page) throw new Error("not found");
  return { page, acc: { platform: page.platform, externalId: page.externalId, accessToken: decrypt(page.accessToken) } };
}

export async function fetchPosts(pageId: string): Promise<{ posts?: Post[]; error?: string }> {
  try {
    const { acc } = await ownedPage(pageId);
    return { posts: await listPosts(acc) };
  } catch (e) {
    return { error: e instanceof MetaError && e.isAuthError ? "انتهت صلاحية الربط، أعد ربط الحساب." : "تعذر جلب المنشورات: " + errMsg(e) };
  }
}

export async function findPost(pageId: string, url: string): Promise<{ post?: Post; error?: string }> {
  try {
    const { acc } = await ownedPage(pageId);
    const post = await findPostByUrl(acc, url);
    return post ? { post } : { error: "لم نجد هذا المنشور في الصفحة المختارة. تأكد أن الرابط لمنشور من نفس الصفحة، أو اختره من القائمة." };
  } catch (e) {
    return { error: "تعذر البحث: " + errMsg(e) };
  }
}

// ---------- القواعد ----------
export type RuleInput = {
  id?: string; pageId: string; postId: string; postUrl?: string | null; postPreview?: string | null; postImage?: string | null;
  name?: string; publicReply: boolean; replyVariants: string[]; privateReply: boolean; dmMessage: string;
  keywords: string[]; oncePerUser: boolean; delaySeconds: number;
};

export async function saveRule(input: RuleInput): Promise<{ error?: string; id?: string }> {
  const user = await requireUser();
  if (!hasActiveSubscription(user)) return { error: "اشتراكك غير نشط. جدّد الاشتراك لتفعيل الردود." };
  const page = await db.page.findFirst({ where: { id: input.pageId, userId: user.id } });
  if (!page) return { error: "الحساب غير موجود" };

  const variants = input.replyVariants.map((v) => v.trim()).filter(Boolean).slice(0, 10);
  const dm = input.dmMessage.trim();
  if (input.publicReply && !variants.length) return { error: "اكتب نص الرد العلني أو أوقف خيار الرد العلني." };
  if (input.privateReply && !dm) return { error: "اكتب نص الرسالة الخاصة أو أوقف خيار الرسالة الخاصة." };
  if (!input.publicReply && !input.privateReply) return { error: "فعّل الرد العلني أو الرسالة الخاصة على الأقل." };
  if (dm.length > 2000 || variants.some((v) => v.length > 2000)) return { error: "النص طويل جداً (الحد 2000 حرف)." };

  const data = {
    name: input.name?.trim() || null, publicReply: input.publicReply, replyVariants: JSON.stringify(variants),
    privateReply: input.privateReply, dmMessage: dm || null,
    keywords: JSON.stringify(input.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 30)),
    oncePerUser: input.oncePerUser, delaySeconds: Math.max(0, Math.min(3600, Math.round(input.delaySeconds) || 0)),
  };

  if (input.id) {
    const rule = await db.rule.findFirst({ where: { id: input.id, userId: user.id } });
    if (!rule) return { error: "القاعدة غير موجودة" };
    await db.rule.update({ where: { id: rule.id }, data });
    revalidatePath("/dashboard", "layout");
    return { id: rule.id };
  }

  const active = await db.rule.count({ where: { userId: user.id, enabled: true } });
  if (active >= limitsFor(user).rules) return { error: `وصلت للحد الأقصى من المنشورات النشطة في باقتك (${limitsFor(user).rules}). أوقف منشوراً أو رقِّ باقتك.` };
  const dup = await db.rule.findUnique({ where: { pageId_postId: { pageId: page.id, postId: input.postId } } });
  if (dup) return { error: "هذا المنشور مضاف مسبقاً. يمكنك تعديله من قائمة المنشورات.", id: dup.id };

  const rule = await db.rule.create({
    data: { ...data, userId: user.id, pageId: page.id, postId: input.postId, postUrl: input.postUrl ?? null,
      postPreview: input.postPreview?.slice(0, 500) ?? null, postImage: input.postImage ?? null },
  });
  revalidatePath("/dashboard", "layout");
  return { id: rule.id };
}

export async function toggleRule(form: FormData) {
  const user = await requireUser();
  const rule = await db.rule.findFirst({ where: { id: String(form.get("id")), userId: user.id } });
  if (!rule) return;
  if (!rule.enabled) {
    const active = await db.rule.count({ where: { userId: user.id, enabled: true } });
    if (active >= limitsFor(user).rules) redirect(`/dashboard/rules?error=limit`);
  }
  await db.rule.update({ where: { id: rule.id }, data: { enabled: !rule.enabled } });
  revalidatePath("/dashboard", "layout");
}

export async function deleteRule(form: FormData) {
  const user = await requireUser();
  await db.rule.deleteMany({ where: { id: String(form.get("id")), userId: user.id } });
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/rules");
}

/** الوضع التجريبي: محاكاة تعليق زبون على المنشور */
export async function simulateComment(form: FormData) {
  const user = await requireUser();
  const rule = await db.rule.findFirst({ where: { id: String(form.get("id")), userId: user.id }, include: { page: true } });
  if (!rule || !decrypt(rule.page.accessToken).startsWith("demo:")) return;
  const name = String(form.get("name") || "زبون تجريبي").slice(0, 60);
  await handleIncomingComment({
    platform: rule.page.platform as "facebook" | "instagram", accountId: rule.page.externalId,
    commentId: "sim_" + crypto.randomUUID(), postId: rule.postId, parentId: null,
    fromId: String(form.get("sameUser")) === "on" ? "sim_user_fixed" : "sim_" + crypto.randomUUID(),
    fromName: name, text: String(form.get("text") || "").slice(0, 500),
  });
  revalidatePath(`/dashboard/rules/${rule.id}`);
}

// ---------- الدعم ----------
export async function createTicket(form: FormData) {
  const user = await requireUser();
  const subject = String(form.get("subject") ?? "").trim().slice(0, 150);
  const body = String(form.get("body") ?? "").trim().slice(0, 5000);
  if (!subject || !body) return;
  const t = await db.ticket.create({ data: { userId: user.id, subject, messages: { create: { fromAdmin: false, body } } } });
  redirect(`/dashboard/support/${t.id}`);
}

export async function replyTicket(form: FormData) {
  const user = await requireUser();
  const t = await db.ticket.findFirst({ where: { id: String(form.get("id")), userId: user.id } });
  const body = String(form.get("body") ?? "").trim().slice(0, 5000);
  if (!t || !body) return;
  await db.ticket.update({ where: { id: t.id }, data: { status: "open", unreadByAdmin: true, messages: { create: { fromAdmin: false, body } } } });
  revalidatePath(`/dashboard/support/${t.id}`);
}

export async function updateProfile(form: FormData) {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: {
    phone: String(form.get("phone") ?? "").trim().slice(0, 30) || null,
    email: String(form.get("email") ?? "").trim().slice(0, 120) || null,
  } });
  revalidatePath("/dashboard/billing");
}

// ---------- الدفع ----------
export async function startCheckout(form: FormData) {
  const user = await requireUser();
  const plan = String(form.get("plan")) as PlanId;
  if (!PLANS[plan]) return;
  const price = priceFor(plan);
  if (!stripeEnabled() || !price) redirect("/dashboard/billing?error=stripe");
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    client_reference_id: user.id,
    customer: user.stripeCustomerId ?? undefined,
    customer_email: user.stripeCustomerId ? undefined : user.email ?? undefined,
    metadata: { plan },
    success_url: `${process.env.APP_URL}/dashboard/billing?paid=1`,
    cancel_url: `${process.env.APP_URL}/dashboard/billing`,
  });
  redirect(session.url!);
}

export async function requestManualPayment(form: FormData) {
  const user = await requireUser();
  const plan = String(form.get("plan")) as PlanId;
  const months = Number(form.get("months")) || 1;
  if (!PLANS[plan] || !DURATIONS.some((d) => d.months === months)) return;
  const ref = String(form.get("ref") ?? "").trim().slice(0, 200);
  const amount = priceLydFor(plan, months);
  await db.payment.create({ data: { userId: user.id, plan, months, amount, provider: "manual", invoiceNo: newInvoiceNo(), reference: ref || null } });
  // لا نُلغي تجربة/اشتراك نشط: الطلب يظهر في الإدارة لتأكيده
  if (!hasActiveSubscription(user)) await db.user.update({ where: { id: user.id }, data: { subscriptionStatus: "pending", plan } });
  await logEvent("warn", "billing", `طلب تفعيل باقة ${PLANS[plan].name} (${months} شهر - ${amount} د.ل) بتحويل يدوي. المرجع: ${ref || "—"}`, user.id);
  redirect("/dashboard/billing?requested=1");
}
