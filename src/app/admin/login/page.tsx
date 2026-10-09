import { redirect } from "next/navigation";
import { safeEqual } from "@/lib/crypto";
import { logEvent } from "@/lib/events";
import { setSession } from "@/lib/session";

async function login(form: FormData) {
  "use server";
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const okEmail = process.env.ADMIN_EMAIL && safeEqual(email.toLowerCase(), process.env.ADMIN_EMAIL.toLowerCase());
  const okPass = process.env.ADMIN_PASSWORD && safeEqual(password, process.env.ADMIN_PASSWORD);
  if (!okEmail || !okPass) {
    await logEvent("warn", "auth", `محاولة دخول فاشلة للوحة الإدارة (${email})`);
    redirect("/admin/login?error=1");
  }
  await setSession({ role: "admin" });
  redirect("/admin");
}

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form action={login} className="card w-full max-w-sm space-y-4 p-8">
        <h1 className="text-center text-xl font-extrabold">لوحة الإدارة</h1>
        {error && <div className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">بيانات الدخول غير صحيحة</div>}
        <div><label className="label">البريد الإلكتروني</label><input name="email" type="email" required className="input" dir="ltr" /></div>
        <div><label className="label">كلمة المرور</label><input name="password" type="password" required className="input" dir="ltr" /></div>
        <button className="btn-primary w-full">دخول</button>
      </form>
    </div>
  );
}
