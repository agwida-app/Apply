import { Alert, Avatar, Badge, Empty, PageHeader, PlatformIcon, TextLink } from "@/components/ui";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { getManagedAccounts, ManagedAccount } from "@/lib/meta";
import { hasActiveSubscription, limitsFor } from "@/lib/plans";
import { requireUser } from "@/lib/session";
import { connectAccount, removeAccount, toggleAccount } from "../actions";

const ERR: Record<string, string> = {
  limit: "وصلت للحد الأقصى من الحسابات في باقتك. رقِّ الباقة لإضافة المزيد.",
  taken: "هذا الحساب مربوط بعميل آخر في النظام. تواصل مع الدعم إن كان ملكك.",
  not_found: "لم نجد هذا الحساب ضمن صفحاتك. أعد تسجيل الدخول بفيسبوك ومنح الصلاحيات.",
  subscribe: "تعذر تفعيل استقبال التعليقات لهذه الصفحة. تأكد أنك مسؤول (Admin) عن الصفحة ومنحت كل الصلاحيات.",
};

export default async function Accounts({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const { error, ok } = await searchParams;
  const user = await requireUser();
  const pages = await db.page.findMany({ where: { userId: user.id }, include: { _count: { select: { rules: true } } }, orderBy: { createdAt: "asc" } });

  let available: ManagedAccount[] = [];
  let fetchError: string | null = null;
  if (user.fbUserToken) {
    try {
      available = await getManagedAccounts(decrypt(user.fbUserToken));
    } catch {
      fetchError = "انتهت صلاحية تسجيل الدخول بفيسبوك. سجّل الدخول مرة أخرى لعرض صفحاتك.";
    }
  }
  const linked = new Set(pages.map((p) => `${p.platform}:${p.externalId}`));
  const notLinked = available.filter((a) => !linked.has(`${a.platform}:${a.externalId}`));
  const active = hasActiveSubscription(user);

  return (
    <div>
      <PageHeader title="الحسابات المربوطة" desc={`صفحات فيسبوك وحسابات إنستغرام التي يعمل عليها الرد التلقائي (${pages.length} من ${limitsFor(user).pages})`} />
      {error && <Alert tone="red">{ERR[error] ?? "حدث خطأ"}</Alert>}
      {ok && <Alert tone="green">تم ربط الحساب بنجاح ✓ الآن أضف منشوراً لتبدأ الردود.</Alert>}

      {pages.length === 0 ? (
        <Empty title="لا توجد حسابات مربوطة" desc="اختر من صفحاتك بالأسفل لربطها." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {pages.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-center gap-3">
                <Avatar src={p.pictureUrl} name={p.name} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-bold"><PlatformIcon platform={p.platform} /> <span className="truncate">{p.name}</span></div>
                  <div className="faint text-xs">{p._count.rules} منشور مضاف</div>
                </div>
                {p.health === "error" ? <Badge tone="red">⚠ يحتاج إعادة ربط</Badge> : p.active ? <Badge tone="green">● يعمل</Badge> : <Badge>متوقف</Badge>}
              </div>
              {p.health === "error" && (
                <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
                  {p.lastError} <a href="/api/auth/facebook" className="font-bold underline">إعادة تسجيل الدخول بفيسبوك</a> ثم اضغط «ربط» على الحساب من القائمة بالأسفل.
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <form action={toggleAccount}><input type="hidden" name="id" value={p.id} /><button className="btn-ghost py-2 text-xs">{p.active ? "⏸ إيقاف مؤقت" : "▶ تشغيل"}</button></form>
                {p.health === "error" && (
                  <form action={connectAccount}><input type="hidden" name="platform" value={p.platform} /><input type="hidden" name="externalId" value={p.externalId} /><button className="btn-primary py-2 text-xs">↻ إعادة الربط</button></form>
                )}
                <form action={removeAccount} className="ms-auto"><input type="hidden" name="id" value={p.id} /><button className="py-2 text-xs font-bold text-red-600 hover:underline">فصل الحساب</button></form>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-10 text-lg font-extrabold">إضافة حساب</h2>
      {!active && <Alert>يجب تفعيل الاشتراك قبل ربط الحسابات. <TextLink href="/dashboard/billing">الاشتراك</TextLink></Alert>}
      {fetchError ? (
        <Alert tone="red">{fetchError} <a href="/api/auth/facebook" className="font-bold underline">تسجيل الدخول بفيسبوك</a></Alert>
      ) : notLinked.length === 0 ? (
        <div className="card muted text-sm">
          لا توجد حسابات أخرى متاحة. إن لم تظهر صفحتك: تأكد أنك مسؤول عنها، ثم <a href="/api/auth/facebook" className="font-bold text-brand-600 underline">أعد تسجيل الدخول</a> واختر الصفحة في نافذة فيسبوك.
          لربط إنستغرام يجب أن يكون الحساب «تجارياً» ومربوطاً بصفحة فيسبوك.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {notLinked.map((a) => (
            <form key={`${a.platform}:${a.externalId}`} action={connectAccount} className="card flex items-center gap-3">
              <input type="hidden" name="platform" value={a.platform} /><input type="hidden" name="externalId" value={a.externalId} />
              <Avatar src={a.picture} name={a.name} size={40} />
              <div className="flex min-w-0 flex-1 items-center gap-2 font-bold"><PlatformIcon platform={a.platform} /><span className="truncate">{a.name}</span></div>
              <button disabled={!active} className="btn-primary py-2">ربط</button>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
