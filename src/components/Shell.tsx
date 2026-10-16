"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** تبديل الوضع: فاتح / داكن / حسب الجهاز */
export function ThemeToggle() {
  const [mode, setMode] = useState("system");
  useEffect(() => { try { setMode(localStorage.getItem("theme") ?? "system"); } catch {} }, []);
  const apply = (m: string) => {
    setMode(m);
    try { if (m === "system") localStorage.removeItem("theme"); else localStorage.setItem("theme", m); } catch {}
    const dark = m === "dark" || (m === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  };
  return (
    <div className="flex rounded-xl p-1 text-xs" style={{ background: "var(--surface-2)" }}>
      {[["light", "☀️ فاتح"], ["dark", "🌙 داكن"], ["system", "تلقائي"]].map(([m, l]) => (
        <button key={m} type="button" onClick={() => apply(m)}
          className={`flex-1 rounded-lg py-1.5 font-medium transition ${mode === m ? "bg-[var(--surface)] shadow-soft" : "faint"}`}>{l}</button>
      ))}
    </div>
  );
}

export type NavItem = { href: string; label: string; icon: string; badge?: number };

export function Shell({ nav, brand, user, children }: { nav: NavItem[]; brand: string; user: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => path === href || (href.split("/").length > 2 && path.startsWith(href + "/"));

  const links = (
    <nav className="flex flex-col gap-1">
      {nav.map((n) => (
        <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${isActive(n.href) ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-900/40 dark:text-brand-200" : "muted font-medium hover:bg-[var(--surface-2)]"}`}>
          <span className="text-lg">{n.icon}</span>
          <span className="flex-1">{n.label}</span>
          {!!n.badge && <span className="rounded-full bg-rose-500 px-2 text-xs text-white">{n.badge}</span>}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* الشريط العلوي على الجوال */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 lg:hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <Link href={nav[0].href} className="text-xl font-bold text-brand-600">{brand}</Link>
        <button aria-label="القائمة" className="btn-ghost px-3 py-2" onClick={() => setOpen(!open)}>{open ? "✕" : "☰"}</button>
      </header>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside className={`fixed inset-y-0 right-0 z-40 flex w-72 flex-col gap-6 border-l p-4 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <Link href={nav[0].href} className="px-3 pt-2 text-2xl font-bold text-brand-600">{brand}</Link>
        <div className="flex-1 overflow-y-auto">{links}</div>
        <div className="space-y-3 border-t pt-4" style={{ borderColor: "var(--border)" }}><ThemeToggle />{user}</div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
