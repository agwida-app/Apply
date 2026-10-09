"use server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { markPaymentPaid, newInvoiceNo } from "@/lib/billing";
import { logEvent } from "@/lib/events";
import { DURATIONS, PLANS, PlanId, priceLydFor } from "@/lib/plans";
import { cardsCheckout, enabledMethods, LocalMethod, METHOD_INFO, PlutuError, validMobile, walletConfirm, walletVerify } from "@/lib/plutu";
import { requireUser } from "@/lib/session";

async function clientIp() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
}
const msg = (e: unknown) => (e instanceof PlutuError ? e.message : "تعذر الاتصال ببوابة الدفع، حاول مرة أخرى.");

export async function startLocalPayment(input: { method: LocalMethod; plan: PlanId; months: number; mobile?: string; birthYear?: number }):
  Promise<{ error?: string; paymentId?: string; otpLength?: number; redirect?: string }> {
  const user = await requireUser();
  const { method, plan, months } = input;
  if (!enabledMethods().includes(method)) return { error: "طريقة الدفع غير متاحة" };
  if (!PLANS[plan] || !DURATIONS.some((d) => d.months === months)) return { error: "اختيار غير صالح" };
  const amount = priceLydFor(plan, months);
  const invoiceNo = newInvoiceNo();

  try {
    if (method === "cards") {
      const payment = await db.payment.create({ data: { userId: user.id, plan, months, amount, provider: "cards", invoiceNo } });
      const url = await cardsCheckout(amount, invoiceNo, `${process.env.APP_URL}/api/payments/plutu/return`, await clientIp());
      return { paymentId: payment.id, redirect: url };
    }

    const mobile = (input.mobile ?? "").replace(/\D/g, "").replace(/^218/, "0");
    if (!validMobile(method, mobile)) return { error: method === "sadad" ? "رقم سداد يجب أن يبدأ بـ 091 أو 093 ويتكون من 10 أرقام" : "رقم الهاتف يجب أن يبدأ بـ 09 ويتكون من 10 أرقام" };
    const year = Number(input.birthYear);
    if (method === "sadad" && !(year >= 1940 && year <= new Date().getFullYear() - 12)) return { error: "سنة الميلاد غير صحيحة" };

    const { processId } = await walletVerify(method, mobile, amount, year);
    const payment = await db.payment.create({ data: { userId: user.id, plan, months, amount, provider: method, invoiceNo, processId, mobile } });
    return { paymentId: payment.id, otpLength: METHOD_INFO[method].otpLength };
  } catch (e) {
    await logEvent("warn", "billing", `فشل بدء الدفع (${METHOD_INFO[method].label}): ${(e as Error).message}`, user.id);
    return { error: msg(e) };
  }
}

export async function confirmLocalPayment(paymentId: string, code: string): Promise<{ error?: string; ok?: boolean }> {
  const user = await requireUser();
  const p = await db.payment.findFirst({ where: { id: paymentId, userId: user.id } });
  if (!p || (p.provider !== "sadad" && p.provider !== "edfali") || !p.processId) return { error: "العملية غير موجودة" };
  if (p.status === "paid") return { ok: true };
  if (!/^\d{4,6}$/.test(code.trim())) return { error: "أدخل رمز التحقق المرسل لهاتفك" };
  try {
    const { transactionId } = await walletConfirm(p.provider, p.processId, code.trim(), p.amount, p.invoiceNo, await clientIp());
    await markPaymentPaid(p.id, transactionId);
    return { ok: true };
  } catch (e) {
    await db.payment.update({ where: { id: p.id }, data: { status: "failed", error: (e as Error).message.slice(0, 500) } });
    return { error: msg(e) };
  }
}
