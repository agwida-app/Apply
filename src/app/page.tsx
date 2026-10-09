import Link from "next/link";
import { PLANS, PlanId } from "@/lib/plans";

const STEPS = [
  { icon: "🔗", title: "اربط صفحتك", desc: "سجّل الدخول بحساب فيسبوك المرتبط بصفحتك واختر الصفحة أو حساب إنستغرام." },
  { icon: "📌", title: "اختر المنشور", desc: "الصق رابط المنشور أو اختره من قائمة منشوراتك مباشرة." },
  { icon: "✍️", title: "اكتب الرد والرسالة", desc: "حدد التعليق العلني والرسالة الخاصة التي تصل للزبون في الماسنجر." },
  { icon: "⚡", title: "اترك الباقي علينا", desc: "كل من يعلّق يحصل على رد فوري ورسالة خاصة على مدار الساعة." },
];

const FEATURES = [
  ["💬", "رد علني + رسالة خاصة", "رد على التعليق وأرسل التفاصيل في الخاص بنقرة واحدة."],
  ["🎲", "ردود متنوعة", "اكتب عدة صيغ للرد ويختار النظام إحداها عشوائياً ليبدو طبيعياً."],
  ["🔑", "كلمات مفتاحية", "رد فقط على من يكتب «السعر» أو «تم» أو أي كلمة تختارها."],
  ["👤", "اسم الزبون", "استخدم {name} ليظهر اسم المعلّق في الرد تلقائياً."],
  ["⏱", "تأخير ذكي", "أخّر الرد دقائق ليبدو بشرياً بدل الرد في نفس الثانية."],
  ["📊", "إحصائيات وسجل", "تابع كل تعليق وكل رد ونسبة النجاح من لوحتك."],
];

export default function Home() {
  return (
    <div>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <span className="text-2xl font-extrabold text-brand-600">ردّ</span>
        <div className="flex gap-2">
          <Link href="/login" className="btn-ghost">تسجيل الدخول</Link>
          <Link href="/login" className="btn-primary hidden sm:inline-flex">ابدأ مجاناً</Link>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 pb-16 pt-10 text-center sm:pt-20">
        <span className="badge bg-brand-100 text-brand-800 dark:bg-brand-900/50 dark:text-brand-200">فيسبوك + إنستغرام</span>
        <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-6xl">
          كل تعليق على منشورك<br /><span className="text-brand-600">يحصل على رد فوري</span>
        </h1>
        <p className="muted mx-auto mt-5 max-w-2xl text-lg">
          ردّ يرد تلقائياً على تعليقات زبائنك ويرسل لهم رسالة خاصة بالتفاصيل — لا تضيّع أي زبون بعد اليوم.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login" className="btn-primary px-6 py-3 text-base">جرّب مجاناً {process.env.TRIAL_DAYS && Number(process.env.TRIAL_DAYS) > 0 ? `${process.env.TRIAL_DAYS} أيام` : ""}</Link>
          <a href="#pricing" className="btn-ghost px-6 py-3 text-base">الأسعار</a>
        </div>

        {/* مثال حي */}
        <div className="card mx-auto mt-14 max-w-md text-start">
          <div className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-300 dark:bg-slate-600">👩</span>
            <div className="rounded-2xl px-3 py-2" style={{ background: "var(--surface-2)" }}><b className="text-sm">سارة</b><div>كم السعر؟</div></div>
          </div>
          <div className="mt-3 flex gap-3 ps-12">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-sm text-white">ر</span>
            <div className="rounded-2xl px-3 py-2" style={{ background: "var(--surface-2)" }}><b className="text-sm">متجرك</b><div>أهلاً سارة 🌷 أرسلنا لك التفاصيل على الخاص</div></div>
          </div>
          <div className="mt-4 rounded-2xl bg-brand-600 px-4 py-3 text-sm text-white">
            📩 رسالة خاصة: السعر 120 ريال والتوصيل مجاني. للطلب أرسل عنوانك 👇
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-8 text-center text-3xl font-extrabold">كيف يعمل؟</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card">
              <div className="text-3xl">{s.icon}</div>
              <div className="mt-3 font-extrabold">{i + 1}. {s.title}</div>
              <p className="muted mt-1 text-sm">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-8 text-center text-3xl font-extrabold">المزايا</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([icon, t, d]) => (
            <div key={t} className="card flex gap-4">
              <div className="text-2xl">{icon}</div>
              <div><div className="font-extrabold">{t}</div><p className="muted mt-1 text-sm">{d}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-2 text-center text-3xl font-extrabold">الأسعار</h2>
        <p className="muted mb-8 text-center">ادفع بسداد، إدفع لي، البطاقات المصرفية المحلية أو التحويل — وخصم حتى 20% عند الاشتراك السنوي</p>
        <div className="grid gap-4 md:grid-cols-3">
          {(Object.keys(PLANS) as PlanId[]).map((id) => {
            const p = PLANS[id];
            const featured = id === "pro";
            return (
              <div key={id} className={`card flex flex-col ${featured ? "ring-2 ring-brand-600" : ""}`}>
                {featured && <span className="badge mb-3 w-fit bg-brand-600 text-white">الأكثر طلباً</span>}
                <div className="text-lg font-extrabold">{p.name}</div>
                <div className="mt-2 text-4xl font-extrabold">{p.priceLyd} <span className="text-2xl">د.ل</span><span className="muted text-base font-medium"> / شهرياً</span></div>
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {p.features.map((f) => <li key={f}>✓ {f}</li>)}
                </ul>
                <Link href="/login" className={`mt-6 ${featured ? "btn-primary" : "btn-ghost"}`}>اشترك الآن</Link>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="faint py-10 text-center text-sm">© {new Date().getFullYear()} ردّ — جميع الحقوق محفوظة</footer>
    </div>
  );
}
