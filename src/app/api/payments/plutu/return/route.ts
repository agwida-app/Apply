import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { markPaymentPaid } from "@/lib/billing";
import { logEvent } from "@/lib/events";
import { verifyCallback } from "@/lib/plutu";

export const dynamic = "force-dynamic";

/** يعود العميل هنا من صفحة دفع البطاقات المحلية مع نتيجة موقّعة من Plutu */
export async function GET(req: NextRequest) {
  const back = (q: string) => NextResponse.redirect(`${process.env.APP_URL}/dashboard/billing?${q}`);
  let cb;
  try {
    cb = verifyCallback(req.nextUrl.searchParams);
  } catch {
    return back("pay=error");
  }
  if (!cb.valid) {
    await logEvent("error", "billing", `توقيع غير صالح في رجوع الدفع (فاتورة ${cb.invoiceNo})`);
    return back("pay=error");
  }
  const p = await db.payment.findUnique({ where: { invoiceNo: cb.invoiceNo } });
  if (!p || p.provider !== "cards") return back("pay=error");

  if (cb.approved) {
    if (Math.abs(cb.amount - p.amount) > 0.001) {
      await db.payment.update({ where: { id: p.id }, data: { status: "failed", error: `المبلغ غير مطابق: ${cb.amount}` } });
      await logEvent("error", "billing", `مبلغ غير مطابق للفاتورة ${p.invoiceNo}: ${cb.amount} بدل ${p.amount}`, p.userId);
      return back("pay=error");
    }
    await markPaymentPaid(p.id, cb.transactionId);
    return back("paid=1");
  }
  if (p.status === "pending") await db.payment.update({ where: { id: p.id }, data: { status: cb.canceled ? "canceled" : "failed" } });
  return back(cb.canceled ? "pay=canceled" : "pay=failed");
}
