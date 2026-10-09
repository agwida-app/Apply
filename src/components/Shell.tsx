"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type NavItem = { href: string; label: string; icon: string; badge?: number };

export function Shell({ nav, brand, user, children }: { nav: NavItem[]; brand: string; user: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => path === href || (href.split("/").length > 2 && path.startsWith(href + "/"));

  const links = (
    <nav className="flex flex-col gap-1">
      {nav.map((n) => (
        <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition ${isActive(n.href) ? "bg-brand-600 text-white" : "hover:bg-[var(--surface-2)]"}`}>
          <span className="text-lg">{n.icon}</span>
          <span className="flex-1">{n.label}</span>
          {!!n.badge && <span className="rounded-full bg-red-500 px-2 text-xs text-white">{n.badge}</span>}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      {/* الشريط العلوي على الجوال */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 lg:hidden" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <Link href={nav[0].href} className="text-xl font-extrabold text-brand-600">{brand}</Link>
        <button aria-label="القائمة" className="btn-ghost px-3 py-2" onClick={() => setOpen(!open)}>{open ? "✕" : "☰"}</button>
      </header>
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      <aside className={`fixed inset-y-0 right-0 z-40 flex w-72 flex-col gap-6 border-l p-4 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${open ? "translate-x-0" : "translate-x-full"}`}
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <Link href={nav[0].href} className="px-3 pt-2 text-2xl font-extrabold text-brand-600">{brand}</Link>
        <div className="flex-1 overflow-y-auto">{links}</div>
        <div className="border-t pt-4" style={{ borderColor: "var(--border)" }}>{user}</div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
