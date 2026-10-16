"use client";
import { useEffect, useRef, useState } from "react";
import type { Button, MessageItem, TemplateData } from "@/lib/messenger";

type Entry = { from: "page"; item: MessageItem } | { from: "user"; text: string } | { from: "quick"; templateId: string; replies: TemplateData["quickReplies"] };

/** معاينة تفاعلية بشكل ماسنجر: الضغط على الأزرار ينتقل بين الرسائل كما سيحدث عند الزبون */
export function MessengerPreview({ start, all, pageName }: { start: TemplateData; all: TemplateData[]; pageName: string }) {
  const [log, setLog] = useState<Entry[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const find = (id: string) => (id === start.id ? start : all.find((t) => t.id === id));

  const show = (t: TemplateData, userText?: string) => {
    const add: Entry[] = [];
    if (userText) add.push({ from: "user", text: userText });
    t.messages.forEach((item) => add.push({ from: "page", item }));
    if (t.quickReplies.length) add.push({ from: "quick", templateId: t.id, replies: t.quickReplies });
    setLog((l) => (userText ? [...l.filter((e) => e.from !== "quick"), ...add] : add));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => show(start), [JSON.stringify(start)]);
  useEffect(() => end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), [log.length]);

  const press = (b: Button) => {
    if (b.type === "template") { const t = find(b.templateId); if (t) show(t, b.title); }
    else if (b.type === "url") window.open(b.url, "_blank");
  };
  const icon = (b: Button) => (b.type === "phone" ? "📞 " : b.type === "url" ? "↗ " : "");
  const Btn = ({ b }: { b: Button }) => (
    <button type="button" onClick={() => press(b)} className="w-full rounded-xl bg-[#3a3a3c] px-3 py-2 text-[13px] font-medium text-white transition hover:bg-[#48484a]">{icon(b)}{b.title || "زر"}</button>
  );

  return (
    <div className="overflow-hidden rounded-[28px] border-[6px] border-[#1c1c1e] bg-black text-white shadow-soft">
      <div className="flex items-center gap-2 border-b border-white/10 bg-[#111] px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-xs font-bold">{pageName.trim()[0] ?? "ص"}</span>
        <div className="min-w-0"><div className="truncate text-sm font-semibold">{pageName}</div><div className="text-[11px] text-white/50">نشط الآن</div></div>
      </div>
      <div className="h-[520px] space-y-2 overflow-y-auto p-3" dir="rtl">
        {log.length === 0 && <p className="pt-20 text-center text-xs text-white/40">أضف محتوى لتظهر المعاينة هنا</p>}
        {log.map((e, i) => {
          if (e.from === "user") return <div key={i} className="flex justify-end"><div className="rounded-2xl rounded-br-md bg-[#4f6bff] px-3 py-2 text-sm">{e.text}</div></div>;
          if (e.from === "quick") return (
            <div key={i} className="flex flex-wrap justify-center gap-1.5 pt-1">
              {e.replies.map((q, j) => (
                <button key={j} type="button" onClick={() => { const t = find(q.templateId); if (t) show(t, q.title); }}
                  className="rounded-full border border-[#4f6bff] px-3 py-1 text-xs text-[#8ea0ff] hover:bg-[#4f6bff]/10">{q.title}</button>
              ))}
            </div>
          );
          const m = e.item;
          if (m.kind === "image") return m.imageUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img key={i} src={m.imageUrl} alt="" className="max-h-64 w-3/4 rounded-2xl object-cover" />
            : null;
          if (m.kind === "text") return (
            <div key={i} className="w-4/5 overflow-hidden rounded-2xl bg-[#303030]">
              <div className="whitespace-pre-wrap px-3 py-2 text-sm">{m.text || "…"}</div>
              {m.buttons.length > 0 && <div className="space-y-1.5 px-2 pb-2">{m.buttons.map((b, j) => <Btn key={j} b={b} />)}</div>}
            </div>
          );
          return (
            <div key={i} className="-mx-3 flex snap-x gap-2 overflow-x-auto px-3 pb-1">
              {m.cards.map((c, j) => (
                <div key={j} className="w-56 shrink-0 snap-start overflow-hidden rounded-2xl bg-[#303030]">
                  {c.imageUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={c.imageUrl} alt="" className="h-36 w-full object-cover" />
                    : <div className="grid h-36 place-items-center bg-gradient-to-br from-fuchsia-600 to-violet-700 text-3xl">🖼</div>}
                  <div className="px-3 py-2"><div className="text-sm font-semibold">{c.title || "عنوان البطاقة"}</div>{c.subtitle && <div className="text-xs text-white/60">{c.subtitle}</div>}</div>
                  {c.buttons.length > 0 && <div className="space-y-1.5 px-2 pb-2">{c.buttons.map((b, k) => <Btn key={k} b={b} />)}</div>}
                </div>
              ))}
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <div className="flex items-center gap-2 border-t border-white/10 bg-[#111] px-3 py-2.5">
        <div className="flex-1 rounded-full bg-[#2a2a2c] px-4 py-1.5 text-xs text-white/40">Aa</div>
        <button type="button" onClick={() => show(start)} className="text-xs text-[#8ea0ff]">↺ إعادة</button>
      </div>
    </div>
  );
}
