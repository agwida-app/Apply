"use client";
import { useRef, useState } from "react";

/** رفع صورة أو لصق رابطها */
export function ImageInput({ value, onChange }: { value?: string; onChange: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const upload = async (f: File) => {
    setBusy(true); setErr(null);
    const fd = new FormData(); fd.append("file", f);
    const r = await fetch("/api/media", { method: "POST", body: fd }).then((x) => x.json()).catch(() => ({ error: "فشل الرفع" }));
    setBusy(false);
    if (r.url) onChange(r.url); else setErr(r.error ?? "فشل الرفع");
  };
  return (
    <div>
      <div className="flex gap-2">
        {value
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={value} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
          : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-lg" style={{ background: "var(--surface-2)" }}>🖼</span>}
        <input className="input" dir="ltr" placeholder="https://… أو ارفع صورة" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="btn-ghost shrink-0 px-3">{busy ? "…" : "⬆ رفع"}</button>
        <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
      {err && <p className="mt-1 text-xs text-rose-600">{err}</p>}
    </div>
  );
}
