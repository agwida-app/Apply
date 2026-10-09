"use client";
import { useMemo, useState, useTransition } from "react";
import { confirmLocalPayment, startLocalPayment } from "@/app/dashboard/payments";

type Plan = { id: "starter" | "pro" | "business"; name: string; priceLyd: number; price: number; features: string[] };
type Method = { id: "sadad" | "edfali" | "cards"; label: string; desc: string };
type Props = {
  plans: Plan[];
  durations: { months: number; discount: number }[];
  methods: Method[];
  stripeOn: boolean;
  bankInfo?: string;
  currentPlan?: string | null;
  demo: boolean;
  manualAction: (f: FormData) => void;
  stripeAction: (f: FormData) => void;
};

const fmt = (n: number) => `${n.toLocaleString("ar-LY")} د.ل`;
const METHOD_ICON: Record<string, string> = { sadad: "📱", edfali: "📲", cards: "💳", manual: "🏦", stripe: "🌍" };

export function Checkout({ plans, durations, methods, stripeOn, bankInfo, currentPlan, demo, manualAction, stripeAction }: Props) {
  const [plan, setPlan] = useState<Plan["id"]>((currentPlan as Plan["id"]) ?? "pro");
  const [months, setMonths] = useState(1);
  const tabs = [...methods.map((m) => m.id), "manual", ...(stripeOn ? ["stripe"] : [])] as string[];
  const [method, setMethod] = useState(tabs[0]);
  const [mobile, setMobile] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [otp, setOtp] = useState<{ paymentId: string; length: number } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const p = plans.find((x) => x.id === plan)!;
  const d = durations.find((x) => x.months === months)!;
  const total = useMemo(() => Math.round(p.priceLyd * months * (1 - d.discount)), [p, months, d]);
  const full = p.priceLyd * months;
  const resetOtp = () => { setOtp(null); setCode(""); setError(null); };

  const pay = () => start(async () => {
    setError(null);
    const r = await startLocalPayment({ method: method as Method["id"], plan, months, mobile, birthYear: Number(birthYear) });
    if (r.error) return setError(r.error);
    if (r.redirect) { window.location.href = r.redirect; return; }
    setOtp({ paymentId: r.paymentId!, length: r.otpLength ?? 6 });
  });
  const confirm = () => start(async () => {
    setError(null);
    const r = await confirmLocalPayment(otp!.paymentId, code);
    if (r.error) return setError(r.error);
    setDone(true);
    setTimeout(() => (window.location.href = "/dashboard/billing?paid=1"), 1200);
  });

  if (done) return <div className="card py-12 text-center"><div className="text-5xl">✅</div><div className="mt-3 text-xl font-extrabold">تم الدفع بنجاح</div><p className="muted mt-1">جارٍ تفعيل اشتراكك…</p></div>;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-3">
        {/* الباقة */}
        <div className="card">
          <div className="mb-3 font-extrabold">1. اختر الباقة</div>
          <div className="grid gap-2 sm:grid-cols-3">
            {plans.map((x) => (
              <button key={x.id} type="button" onClick={() => { setPlan(x.id); resetOtp(); }}
                className={`rounded-xl border p-3 text-start ${plan === x.id ? "border-brand-600 ring-2 ring-brand-200 dark:ring-brand-800" : ""}`}
                style={plan === x.id ? undefined : { borderColor: "var(--border)" }}>
                <div className="font-extrabold">{x.name} {currentPlan === x.id && <span className="text-xs text-brand-600">(باقتك)</span>}</div>
                <div className="mt-1 text-lg font-extrabold">{fmt(x.priceLyd)}<span className="muted text-xs font-medium"> / شهر</span></div>
                <ul className="muted mt-2 space-y-0.5 text-xs">{x.features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
              </button>
            ))}
          </div>
        </div>
        {/* المدة */}
        <div className="card">
          <div className="mb-3 font-extrabold">2. المدة</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {durations.map((x) => (
              <button key={x.months} type="button" onClick={() => { setMonths(x.months); resetOtp(); }}
                className={`rounded-xl border p-3 text-center ${months === x.months ? "border-brand-600 bg-brand-600 text-white" : ""}`}
                style={months === x.months ? undefined : { borderColor: "var(--border)" }}>
                <div className="font-extrabold">{x.months === 12 ? "سنة" : `${x.months} ${x.months === 1 ? "شهر" : "أشهر"}`}</div>
                {x.discount > 0 && <div className={`text-xs font-bold ${months === x.months ? "" : "text-emerald-600"}`}>وفّر {Math.round(x.discount * 100)}%</div>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* الدفع */}
      <div className="card lg:col-span-2 lg:self-start">
        <div className="mb-3 font-extrabold">3. طريقة الدفع</div>
        <div className="grid grid-cols-2 gap-2">
          {tabs.map((t) => {
            const m = methods.find((x) => x.id === t);
            const label = m?.label ?? (t === "manual" ? "تحويل / إيداع" : "بطاقة دولية");
            return (
              <button key={t} type="button" onClick={() => { setMethod(t); resetOtp(); }}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold ${method === t ? "border-brand-600 ring-2 ring-brand-200 dark:ring-brand-800" : ""}`}
                style={method === t ? undefined : { borderColor: "var(--border)" }}>
                <span className="text-lg">{METHOD_ICON[t]}</span>{label}
              </button>
            );
          })}
        </div>

        <div className="my-4 rounded-xl p-3" style={{ background: "var(--surface-2)" }}>
          <div className="flex justify-between text-sm"><span className="muted">{p.name} × {months} {months === 1 ? "شهر" : "أشهر"}</span>{d.discount > 0 && <s className="faint">{fmt(full)}</s>}</div>
          <div className="mt-1 flex items-baseline justify-between"><span className="font-bold">الإجمالي</span><span className="text-2xl font-extrabold">{method === "stripe" ? `$${p.price * months}` : fmt(total)}</span></div>
        </div>

        {demo && methods.length > 0 && !["manual", "stripe"].includes(method) && (
          <p className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">🧪 وضع تجريبي: رمز التحقق {method === "sadad" ? "123456" : "1234"}</p>
        )}

        {(method === "sadad" || method === "edfali") && !otp && (
          <div className="space-y-3">
            <p className="faint text-xs">{methods.find((m) => m.id === method)?.desc}</p>
            <div><label className="label">رقم الهاتف</label><input className="input" dir="ltr" inputMode="numeric" placeholder="09XXXXXXXX" value={mobile} onChange={(e) => setMobile(e.target.value)} /></div>
            {method === "sadad" && <div><label className="label">سنة الميلاد</label><input className="input" dir="ltr" inputMode="numeric" placeholder="1990" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} /></div>}
            <button type="button" onClick={pay} disabled={pending} className="btn-primary w-full py-3">{pending ? "جارٍ الإرسال…" : "إرسال رمز التحقق"}</button>
          </div>
        )}
        {otp && (
          <div className="space-y-3">
            <p className="text-sm">أرسلنا رمز تحقق من {otp.length} أرقام إلى <b dir="ltr">{mobile}</b></p>
            <input className="input text-center text-2xl tracking-[0.5em]" dir="ltr" inputMode="numeric" autoFocus maxLength={otp.length} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <button type="button" onClick={confirm} disabled={pending || code.length !== otp.length} className="btn-primary w-full py-3">{pending ? "جارٍ التأكيد…" : `ادفع ${fmt(total)}`}</button>
            <button type="button" onClick={resetOtp} className="faint w-full text-xs hover:underline">تغيير الرقم</button>
          </div>
        )}
        {method === "cards" && (
          <div className="space-y-3">
            <p className="faint text-xs">{methods.find((m) => m.id === "cards")?.desc}</p>
            <button type="button" onClick={pay} disabled={pending} className="btn-primary w-full py-3">{pending ? "جارٍ التحويل…" : `ادفع ${fmt(total)} بالبطاقة`}</button>
          </div>
        )}
        {method === "manual" && (
          <form action={manualAction} className="space-y-3 text-sm">
            <input type="hidden" name="plan" value={plan} /><input type="hidden" name="months" value={months} />
            <p className="faint text-xs">حوّل المبلغ ثم أرسل رقم العملية، وسيتم تفعيل اشتراكك بعد التحقق.</p>
            {bankInfo && <div className="whitespace-pre-wrap rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>{bankInfo}</div>}
            <input name="ref" className="input" placeholder="رقم العملية / اسم المحوِّل" required />
            <button className="btn-primary w-full py-3">أرسلت التحويل</button>
          </form>
        )}
        {method === "stripe" && (
          <form action={stripeAction}><input type="hidden" name="plan" value={plan} /><button className="btn-primary w-full py-3">💳 ادفع بالبطاقة الدولية (اشتراك شهري)</button></form>
        )}
        {error && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">{error}</div>}
        <p className="faint mt-4 text-center text-xs">🔒 الدفع عبر بوابة آمنة. لا نحتفظ ببيانات بطاقتك.</p>
      </div>
    </div>
  );
}
