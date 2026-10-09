import Link from "next/link";

export function PageHeader({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {desc && <p className="muted mt-1 text-sm">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card">
      <div className="muted text-sm">{label}</div>
      <div className="mt-1 text-3xl font-extrabold tabular-nums">{value}</div>
      {hint && <div className="faint mt-1 text-xs">{hint}</div>}
    </div>
  );
}

const TONES = {
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  blue: "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200",
  gray: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};
export function Badge({ tone = "gray", children }: { tone?: keyof typeof TONES; children: React.ReactNode }) {
  return <span className={`badge ${TONES[tone]}`}>{children}</span>;
}

export const LOG_STATUS: Record<string, { label: string; tone: keyof typeof TONES }> = {
  done: { label: "✓ تم الرد", tone: "green" },
  partial: { label: "◐ جزئي", tone: "amber" },
  failed: { label: "✕ فشل", tone: "red" },
  pending: { label: "⏱ مجدول", tone: "blue" },
  processing: { label: "… جارٍ", tone: "blue" },
  skipped: { label: "– تم التجاهل", tone: "gray" },
};

export const SKIP_REASON: Record<string, string> = {
  keyword_mismatch: "لا يحتوي الكلمات المفتاحية",
  already_replied: "تم الرد على نفس الشخص سابقاً",
  subscription_inactive: "الاشتراك غير نشط",
  quota_exceeded: "تجاوز الحد الشهري",
  account_suspended: "الحساب موقوف",
  rule_deleted: "تم حذف القاعدة",
};

export function Empty({ title, desc, action }: { title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center py-12 text-center">
      <div className="mb-3 text-4xl">💬</div>
      <div className="text-lg font-bold">{title}</div>
      {desc && <p className="muted mt-1 max-w-md text-sm">{desc}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "amber", children }: { tone?: "amber" | "red" | "blue" | "green"; children: React.ReactNode }) {
  const c = {
    amber: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200",
    red: "border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200",
    blue: "border-brand-300 bg-brand-50 text-brand-900 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-100",
    green: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200",
  }[tone];
  return <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${c}`}>{children}</div>;
}

export function PlatformIcon({ platform }: { platform: string }) {
  return platform === "instagram"
    ? <span title="إنستغرام" className="inline-grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 text-xs font-bold text-white">IG</span>
    : <span title="فيسبوك" className="inline-grid h-6 w-6 place-items-center rounded-md bg-[#1877f2] text-xs font-bold text-white">f</span>;
}

export function Avatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />
    : <span className="grid place-items-center rounded-full bg-brand-600 font-bold text-white" style={{ width: size, height: size }}>{name.trim()[0] ?? "?"}</span>;
}

export function fmtDate(d: Date) {
  return new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="font-bold text-brand-600 hover:underline dark:text-brand-300">{children}</Link>;
}

/** مخطط أعمدة لسلسلة واحدة (عدد الردود يومياً) مع تلميح عند المرور */
export function DailyBars({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div>
      <div className="flex h-40 items-end gap-[2px]" role="img" aria-label={`الردود خلال ${data.length} يوماً: ${total}`}>
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end">
            <div className="w-full rounded-t bg-brand-500 transition group-hover:bg-brand-700 dark:bg-brand-400 dark:group-hover:bg-brand-200"
              style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 4 : 1, opacity: d.count ? 1 : 0.25 }} />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">
              {d.day}: <b>{d.count}</b>
            </div>
          </div>
        ))}
      </div>
      <div className="faint mt-2 flex justify-between text-xs">
        <span>{data[0]?.day}</span><span>{data[data.length - 1]?.day}</span>
      </div>
    </div>
  );
}

export const TICKET_STATUS: Record<string, { label: string; tone: "blue" | "green" | "gray" }> = {
  open: { label: "مفتوحة", tone: "blue" }, answered: { label: "تم الرد", tone: "green" }, closed: { label: "مغلقة", tone: "gray" },
};
