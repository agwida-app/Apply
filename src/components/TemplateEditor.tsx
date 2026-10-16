"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveTemplate } from "@/app/dashboard/template-actions";
import { LIMITS, type Button, type Card, type MessageItem, type QuickReply, type TemplateData } from "@/lib/messenger";
import { ImageInput } from "./ImageInput";
import { MessengerPreview } from "./MessengerPreview";

type Opt = { id: string; name: string };

function ButtonsEditor({ value, onChange, targets }: { value: Button[]; onChange: (b: Button[]) => void; targets: Opt[] }) {
  const set = (i: number, b: Button) => onChange(value.map((x, j) => (j === i ? b : x)));
  return (
    <div className="space-y-2">
      {value.map((b, i) => (
        <div key={i} className="grid gap-2 rounded-xl p-2 sm:grid-cols-[7rem_1fr_1fr_auto]" style={{ background: "var(--surface-2)" }}>
          <select className="input py-2" value={b.type} onChange={(e) => {
            const type = e.target.value as Button["type"];
            set(i, type === "url" ? { type, title: b.title, url: "" } : type === "phone" ? { type, title: b.title, phone: "" } : { type, title: b.title, templateId: targets[0]?.id ?? "" });
          }}>
            <option value="template">يفتح رسالة</option>
            <option value="url">رابط</option>
            <option value="phone">اتصال</option>
          </select>
          <input className="input py-2" placeholder="نص الزر" maxLength={LIMITS.buttonTitle} value={b.title} onChange={(e) => set(i, { ...b, title: e.target.value })} />
          {b.type === "url" && <input className="input py-2" dir="ltr" placeholder="https://…" value={b.url} onChange={(e) => set(i, { ...b, url: e.target.value })} />}
          {b.type === "phone" && <input className="input py-2" dir="ltr" placeholder="+21891…" value={b.phone} onChange={(e) => set(i, { ...b, phone: e.target.value })} />}
          {b.type === "template" && (
            <select className="input py-2" value={b.templateId} onChange={(e) => set(i, { ...b, templateId: e.target.value })}>
              {targets.length === 0 && <option value="">احفظ رسائل أخرى أولاً</option>}
              {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <button type="button" aria-label="حذف" onClick={() => onChange(value.filter((_, j) => j !== i))} className="faint px-2 hover:text-rose-600">✕</button>
        </div>
      ))}
      {value.length < LIMITS.buttons && (
        <button type="button" onClick={() => onChange([...value, { type: "template", title: "", templateId: targets[0]?.id ?? "" }])} className="chip text-xs">+ زر</button>
      )}
    </div>
  );
}

export function TemplateEditor({ initial, others, pageName }: { initial?: TemplateData & { keywords: string[] }; others: TemplateData[]; pageName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [keywords, setKeywords] = useState((initial?.keywords ?? []).join("، "));
  const [messages, setMessages] = useState<MessageItem[]>(initial?.messages ?? [{ kind: "text", text: "", buttons: [] }]);
  const [quick, setQuick] = useState<QuickReply[]>(initial?.quickReplies ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const targets: Opt[] = [...(initial ? [{ id: initial.id, name: `${initial.name} (هذه الرسالة)` }] : []), ...others.map((o) => ({ id: o.id, name: o.name }))];
  const setMsg = (i: number, m: MessageItem) => setMessages(messages.map((x, j) => (j === i ? m : x)));
  const move = (i: number, d: number) => { const a = [...messages]; [a[i], a[i + d]] = [a[i + d], a[i]]; setMessages(a); };
  const add = (kind: MessageItem["kind"]) => setMessages([...messages,
    kind === "text" ? { kind, text: "", buttons: [] } : kind === "image" ? { kind, imageUrl: "" } : { kind, cards: [{ title: "", subtitle: "", imageUrl: "", buttons: [] }] }]);

  const preview: TemplateData = { id: initial?.id ?? "__new", name, messages, quickReplies: quick };

  const submit = () => start(async () => {
    setError(null); setSaved(false);
    const r = await saveTemplate({ id: initial?.id, name, keywords: keywords.split(/[,،\n]/), messages, quickReplies: quick });
    if (r.error) return setError(r.error);
    setSaved(true);
    if (!initial) router.push(`/dashboard/messages/${r.id}?saved=1`);
    router.refresh();
  });

  const KIND = { text: "💬 نص وأزرار", image: "🖼 صورة", cards: "🛍 بطاقات منتجات" };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-4">
        <div className="card grid gap-3 sm:grid-cols-2">
          <div><label className="label">اسم الرسالة (لك فقط)</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: قائمة المنتجات" /></div>
          <div>
            <label className="label">تُرسل تلقائياً إذا كتب الزبون (اختياري)</label>
            <input className="input" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="مثال: القائمة، المنتجات، الأسعار" />
          </div>
        </div>

        {messages.map((m, i) => (
          <div key={i} className="card space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{i + 1}. {KIND[m.kind]}</span>
              <div className="faint flex gap-1 text-sm">
                {i > 0 && <button type="button" onClick={() => move(i, -1)} className="px-2 hover:text-[var(--ink)]">↑</button>}
                {i < messages.length - 1 && <button type="button" onClick={() => move(i, 1)} className="px-2 hover:text-[var(--ink)]">↓</button>}
                <button type="button" onClick={() => setMessages(messages.filter((_, j) => j !== i))} className="px-2 hover:text-rose-600">✕</button>
              </div>
            </div>
            {m.kind === "text" && <>
              <textarea rows={3} className="input" value={m.text} onChange={(e) => setMsg(i, { ...m, text: e.target.value })} placeholder="مثال: هل تود الرجوع للقائمة السابقة؟" />
              <ButtonsEditor value={m.buttons} onChange={(b) => setMsg(i, { ...m, buttons: b })} targets={targets} />
            </>}
            {m.kind === "image" && <ImageInput value={m.imageUrl} onChange={(u) => setMsg(i, { ...m, imageUrl: u })} />}
            {m.kind === "cards" && <>
              {m.cards.map((c, k) => {
                const setCard = (nc: Card) => setMsg(i, { ...m, cards: m.cards.map((x, j) => (j === k ? nc : x)) });
                return (
                  <div key={k} className="space-y-2 rounded-xl border p-3" style={{ borderColor: "var(--border)" }}>
                    <div className="flex items-center justify-between text-xs"><span className="faint">بطاقة {k + 1}</span>
                      {m.cards.length > 1 && <button type="button" onClick={() => setMsg(i, { ...m, cards: m.cards.filter((_, j) => j !== k) })} className="faint hover:text-rose-600">حذف</button>}</div>
                    <ImageInput value={c.imageUrl} onChange={(u) => setCard({ ...c, imageUrl: u })} />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input className="input" maxLength={LIMITS.cardTitle} placeholder="العنوان: iPhone 17 (Lavender)" value={c.title} onChange={(e) => setCard({ ...c, title: e.target.value })} />
                      <input className="input" maxLength={LIMITS.cardSubtitle} placeholder="الوصف: متوفر الآن، للطلب اضغط تواصل معنا" value={c.subtitle ?? ""} onChange={(e) => setCard({ ...c, subtitle: e.target.value })} />
                    </div>
                    <ButtonsEditor value={c.buttons} onChange={(b) => setCard({ ...c, buttons: b })} targets={targets} />
                  </div>
                );
              })}
              {m.cards.length < LIMITS.cards && <button type="button" onClick={() => setMsg(i, { ...m, cards: [...m.cards, { title: "", subtitle: "", imageUrl: "", buttons: [] }] })} className="chip text-xs">+ بطاقة ({m.cards.length}/{LIMITS.cards})</button>}
            </>}
          </div>
        ))}

        {messages.length < LIMITS.messages && (
          <div className="card flex flex-wrap items-center gap-2">
            <span className="muted text-sm">أضف:</span>
            {(["text", "image", "cards"] as const).map((k) => <button key={k} type="button" onClick={() => add(k)} className="chip">{KIND[k]}</button>)}
          </div>
        )}

        <div className="card space-y-2">
          <div className="text-sm font-semibold">خيارات سريعة <span className="faint font-normal">(أزرار دائرية أسفل الرسالة، كل خيار يفتح رسالة)</span></div>
          {quick.map((q, i) => (
            <div key={i} className="flex gap-2">
              <input className="input" maxLength={LIMITS.quickTitle} placeholder="مثال: قائمة المنتجات" value={q.title} onChange={(e) => setQuick(quick.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <select className="input" value={q.templateId} onChange={(e) => setQuick(quick.map((x, j) => (j === i ? { ...x, templateId: e.target.value } : x)))}>
                {targets.length === 0 && <option value="">احفظ رسائل أخرى أولاً</option>}
                {targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button type="button" onClick={() => setQuick(quick.filter((_, j) => j !== i))} className="faint px-2 hover:text-rose-600">✕</button>
            </div>
          ))}
          {quick.length < LIMITS.quickReplies && <button type="button" onClick={() => setQuick([...quick, { title: "", templateId: targets[0]?.id ?? "" }])} className="chip text-xs">+ خيار سريع</button>}
          {targets.length === 0 && <p className="faint text-xs">💡 لربط الأزرار برسائل أخرى، احفظ هذه الرسالة ثم أنشئ رسائل أخرى (مثل «المساعدة» و«تواصل معنا»).</p>}
        </div>
      </div>

      <div className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <MessengerPreview start={preview} all={others} pageName={pageName} />
        {error && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</div>}
        {saved && <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">✓ تم الحفظ</div>}
        <button type="button" onClick={submit} disabled={pending} className="btn-primary w-full py-3">{pending ? "جارٍ الحفظ…" : "حفظ الرسالة"}</button>
      </div>
    </div>
  );
}
