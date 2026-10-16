"use client";
import { useState, useTransition } from "react";
import { testAiReply } from "@/app/dashboard/ai-actions";

export function AiTester({ tones, initialInfo, initialTone, saveAction }: {
  tones: { id: string; label: string }[]; initialInfo: string; initialTone: string; saveAction: (f: FormData) => void;
}) {
  const [info, setInfo] = useState(initialInfo);
  const [tone, setTone] = useState(initialTone);
  const [name, setName] = useState("سارة");
  const [comment, setComment] = useState("كم سعر الفستان الأسود؟ وفيه توصيل لبنغازي؟");
  const [platform, setPlatform] = useState("facebook");
  const [res, setRes] = useState<{ shouldReply: boolean; publicReply: string; dmMessage: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const SAMPLE = "اسم المتجر: متجر الأناقة\nنبيع: فساتين وعبايات وحقائب نسائية\nالأسعار: الفساتين من 120 إلى 250 د.ل، العبايات 180 د.ل، الحقائب من 60 د.ل\nالمقاسات: S إلى XXL\nالتوصيل: طرابلس 10 د.ل خلال يوم، باقي المدن 20 د.ل خلال 2-4 أيام\nالدفع: عند الاستلام أو تحويل\nطريقة الطلب: أرسل الاسم والمدينة ورقم الهاتف وصورة القطعة\nأوقات العمل: 10 صباحاً - 10 مساءً";

  const test = () => start(async () => {
    setError(null); setRes(null);
    const r = await testAiReply({ businessInfo: info, tone, comment, name, platform });
    if (r.error) setError(r.error); else setRes(r.result!);
  });

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <form action={saveAction} className="card space-y-4 lg:col-span-3">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label mb-0">معلومات متجرك</label>
            {!info && <button type="button" onClick={() => setInfo(SAMPLE)} className="text-xs font-bold text-brand-600 hover:underline">استخدم مثالاً</button>}
          </div>
          <p className="faint mb-2 text-xs">اكتب كل ما يسأل عنه زبائنك: المنتجات، الأسعار، المقاسات، التوصيل، طريقة الطلب، أوقات العمل. الذكاء الاصطناعي يجيب من هذه المعلومات فقط ولا يخترع أسعاراً.</p>
          <textarea name="businessInfo" rows={12} className="input" value={info} onChange={(e) => setInfo(e.target.value)} placeholder={SAMPLE} />
          <div className="faint text-left text-xs">{info.length}/8000</div>
        </div>
        <div>
          <label className="label">أسلوب الرد</label>
          <div className="flex flex-wrap gap-2">
            {tones.map((t) => (
              <label key={t.id} className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-bold ${tone === t.id ? "border-brand-600 bg-brand-600 text-white" : ""}`} style={tone === t.id ? undefined : { borderColor: "var(--border)" }}>
                <input type="radio" name="tone" value={t.id} checked={tone === t.id} onChange={() => setTone(t.id)} className="hidden" />{t.label}
              </label>
            ))}
          </div>
        </div>
        <button className="btn-primary w-full">حفظ</button>
      </form>

      <div className="card space-y-3 lg:col-span-2 lg:self-start">
        <div className="font-extrabold">🧪 جرّب الرد الذكي</div>
        <div className="grid grid-cols-3 gap-2">
          {[["facebook", "فيسبوك"], ["instagram", "إنستغرام"], ["tiktok", "تيك توك"]].map(([v, l]) => (
            <button key={v} type="button" onClick={() => setPlatform(v)} className={`rounded-lg border py-1.5 text-xs font-bold ${platform === v ? "border-brand-600 bg-brand-600 text-white" : ""}`} style={platform === v ? undefined : { borderColor: "var(--border)" }}>{l}</button>
          ))}
        </div>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الزبون" />
        <textarea className="input" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="تعليق الزبون" />
        <button type="button" onClick={test} disabled={pending} className="btn-primary w-full">{pending ? "يكتب الرد…" : "🤖 اكتب الرد"}</button>
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">{error}</div>}
        {res && (
          <div className="space-y-3 text-sm">
            {!res.shouldReply && <div className="rounded-xl bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">قرر الذكاء الاصطناعي عدم الرد (يبدو سبام أو إساءة).</div>}
            {res.publicReply && <div><div className="faint mb-1 text-xs">💬 الرد العلني</div><div className="whitespace-pre-wrap rounded-2xl px-3 py-2" style={{ background: "var(--surface-2)" }}>{res.publicReply}</div></div>}
            {res.dmMessage && <div><div className="faint mb-1 text-xs">📩 الرسالة الخاصة</div><div className="whitespace-pre-wrap rounded-2xl bg-brand-600 px-3 py-2 text-white">{res.dmMessage}</div></div>}
            <p className="faint text-xs">التجربة تستخدم المعلومات المكتوبة حالياً، حتى قبل الحفظ.</p>
          </div>
        )}
      </div>
    </div>
  );
}
