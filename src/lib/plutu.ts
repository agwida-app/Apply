/**
 * بوابة الدفع الليبية Plutu (plutu.ly): سداد، إدفع لي، البطاقات المصرفية المحلية.
 * مبني على حزمة Plutu الرسمية (getplutu/plutu-php).
 * عند عدم ضبط المفاتيح مع DEMO_MODE=true تعمل محاكاة: رمز التحقق دائماً 123456 (سداد) أو 1234 (إدفع لي).
 */
import crypto from "node:crypto";

const BASE = () => process.env.PLUTU_BASE_URL || "https://api.plutus.ly/api/v1";

export type LocalMethod = "sadad" | "edfali" | "cards";
const GATEWAY: Record<LocalMethod, string> = { sadad: "sadadapi", edfali: "edfali", cards: "localbankcards" };

export const plutuConfigured = () => !!(process.env.PLUTU_API_KEY && process.env.PLUTU_ACCESS_TOKEN);
export const plutuDemo = () => !plutuConfigured() && process.env.DEMO_MODE === "true";

/** الطرق المفعلة (PLUTU_METHODS="sadad,edfali,cards") */
export function enabledMethods(): LocalMethod[] {
  if (!plutuConfigured() && !plutuDemo()) return [];
  const all: LocalMethod[] = ["sadad", "edfali", "cards"];
  const env = process.env.PLUTU_METHODS?.split(",").map((s) => s.trim());
  return env?.length ? all.filter((m) => env.includes(m)) : all;
}

export const METHOD_INFO: Record<LocalMethod, { label: string; desc: string; otpLength?: number }> = {
  sadad: { label: "سداد", desc: "محفظة سداد (المدار) — رقم يبدأ بـ 091 أو 093", otpLength: 6 },
  edfali: { label: "إدفع لي", desc: "خدمة إدفع لي — رقم هاتف يبدأ بـ 09", otpLength: 4 },
  cards: { label: "بطاقة مصرفية محلية", desc: "بطاقات المصارف الليبية — يتم تحويلك لصفحة الدفع الآمنة" },
};

export const validMobile = (m: LocalMethod, mobile: string) =>
  m === "sadad" ? /^09[13]\d{7}$/.test(mobile) : /^09[1-6]\d{7}$/.test(mobile);

export class PlutuError extends Error {}

type PlutuResult = { process_id?: string | number; transaction_id?: string | number; redirect_url?: string; amount?: string | number };

async function call(method: LocalMethod, action: "verify" | "confirm", params: Record<string, string | number>): Promise<PlutuResult> {
  const res = await fetch(`${BASE()}/transaction/${GATEWAY[method]}/${action}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "X-API-KEY": process.env.PLUTU_API_KEY!,
      Authorization: `Bearer ${process.env.PLUTU_ACCESS_TOKEN}`,
    },
    body: new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error || json.status !== 200) {
    throw new PlutuError(json.error?.message ?? json.message ?? `Plutu ${res.status}`);
  }
  return json.result ?? {};
}

/** الخطوة 1 (سداد / إدفع لي): يُرسل رمز تحقق لهاتف العميل ويعيد process_id */
export async function walletVerify(method: "sadad" | "edfali", mobile: string, amount: number, birthYear?: number) {
  if (plutuDemo()) return { processId: String(Date.now()) };
  const r = await call(method, "verify", { mobile_number: mobile, amount, ...(method === "sadad" ? { birth_year: birthYear! } : {}) });
  if (!r.process_id) throw new PlutuError("لم يتم استلام رقم العملية");
  return { processId: String(r.process_id) };
}

/** الخطوة 2: تأكيد الدفع برمز التحقق */
export async function walletConfirm(method: "sadad" | "edfali", processId: string, code: string, amount: number, invoiceNo: string, customerIp?: string) {
  if (plutuDemo()) {
    if (code !== (method === "sadad" ? "123456" : "1234")) throw new PlutuError("رمز التحقق غير صحيح");
    return { transactionId: `demo-${Date.now()}` };
  }
  const r = await call(method, "confirm", { process_id: processId, code, amount, invoice_no: invoiceNo, ...(customerIp ? { customer_ip: customerIp } : {}) });
  return { transactionId: r.transaction_id ? String(r.transaction_id) : null };
}

/** البطاقات المحلية: يعيد رابط صفحة الدفع، وبعد الدفع يعود العميل إلى returnUrl مع نتيجة موقّعة */
export async function cardsCheckout(amount: number, invoiceNo: string, returnUrl: string, customerIp?: string) {
  if (plutuDemo()) {
    const params = new URLSearchParams({ gateway: "localbankcards", approved: "1", invoice_no: invoiceNo, amount: String(amount), transaction_id: `demo-${Date.now()}` });
    params.set("hashed", callbackHash(params));
    return `${returnUrl}?${params}`;
  }
  const r = await call("cards", "confirm", { amount, invoice_no: invoiceNo, return_url: returnUrl, lang: "ar", ...(customerIp ? { customer_ip: customerIp } : {}) });
  if (!r.redirect_url) throw new PlutuError("لم يتم استلام رابط الدفع");
  return r.redirect_url;
}

const CALLBACK_KEYS = ["gateway", "approved", "canceled", "invoice_no", "amount", "transaction_id"];

/** نفس طريقة PHP: http_build_query للحقول المعروفة بترتيب وصولها، ثم HMAC-SHA256 بالمفتاح السري وأحرف كبيرة */
function callbackHash(params: URLSearchParams) {
  const secret = process.env.PLUTU_SECRET_KEY || (plutuDemo() ? "demo-secret" : "");
  if (!secret) throw new PlutuError("PLUTU_SECRET_KEY غير مضبوط");
  const data = [...params.entries()]
    .filter(([k]) => CALLBACK_KEYS.includes(k))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/%20/g, "+")}`)
    .join("&");
  return crypto.createHmac("sha256", secret).update(data).digest("hex").toUpperCase();
}

export function verifyCallback(params: URLSearchParams) {
  const got = params.get("hashed") ?? "";
  const expected = callbackHash(params);
  const ok = got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  return {
    valid: ok,
    approved: params.get("approved") === "1",
    canceled: params.get("canceled") === "1",
    invoiceNo: params.get("invoice_no") ?? "",
    amount: Number(params.get("amount")),
    transactionId: params.get("transaction_id"),
  };
}
