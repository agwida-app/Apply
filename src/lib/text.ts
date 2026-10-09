/** توحيد النص العربي للمطابقة: إزالة التشكيل وتوحيد الألف والياء والتاء المربوطة */
export function normalizeArabic(s: string) {
  return s
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesKeywords(text: string, keywords: string[]) {
  if (keywords.length === 0) return true;
  const t = normalizeArabic(text);
  return keywords.some((k) => k.trim() && t.includes(normalizeArabic(k)));
}

/** استبدال المتغيرات في نص الرد: {name} = الاسم الأول للمعلّق */
export function renderTemplate(tpl: string, vars: { name?: string | null }) {
  const first = (vars.name ?? "").trim().split(/\s+/)[0] || "";
  return tpl.replace(/\{name\}|\{الاسم\}/g, first).replace(/\s{2,}/g, " ").trim();
}

export function parseList(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()) : [];
  } catch {
    return [];
  }
}

export function pick<T>(arr: T[]): T | undefined {
  return arr[Math.floor(Math.random() * arr.length)];
}
