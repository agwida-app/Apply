import Link from "next/link";
import { isDemoMode } from "@/lib/meta";

const ERRORS: Record<string, string> = {
  oauth: "تعذر تسجيل الدخول بفيسبوك. حاول مرة أخرى.",
  suspended: "تم إيقاف هذا الحساب. تواصل مع الدعم.",
  not_configured: "تسجيل الدخول بفيسبوك غير مُعدّ بعد (META_APP_ID).",
};

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-md p-8 text-center">
        <Link href="/" className="text-3xl font-extrabold text-brand-600">ردّ</Link>
        <h1 className="mt-6 text-xl font-extrabold">تسجيل الدخول</h1>
        <p className="muted mt-2 text-sm">سجّل الدخول بحساب فيسبوك الشخصي الذي يدير صفحتك. سنطلب فقط الصلاحيات اللازمة للرد على التعليقات وإرسال الرسائل.</p>
        {error && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">{ERRORS[error] ?? "حدث خطأ"}</div>}
        <a href="/api/auth/facebook" className="btn mt-6 w-full bg-[#1877f2] py-3 text-base text-white hover:bg-[#166fe5]">
          <span className="text-xl font-extrabold">f</span> المتابعة باستخدام فيسبوك
        </a>
        {isDemoMode() && (
          <form action="/api/auth/demo" method="post" className="mt-3">
            <button className="btn-ghost w-full py-3">🧪 دخول تجريبي (بدون فيسبوك)</button>
          </form>
        )}
        <p className="faint mt-6 text-xs">بالمتابعة أنت توافق على شروط الاستخدام وسياسة الخصوصية.</p>
      </div>
    </div>
  );
}
