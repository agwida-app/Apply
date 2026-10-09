import Link from "next/link";
import { RuleEditor } from "@/components/RuleEditor";
import { Empty, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function NewRule() {
  const user = await requireUser();
  const pages = await db.page.findMany({ where: { userId: user.id, active: true }, select: { id: true, name: true, platform: true } });
  return (
    <div>
      <PageHeader title="إضافة منشور" desc="اختر المنشور ثم حدد الرد والرسالة الخاصة" />
      {pages.length === 0
        ? <Empty title="اربط حساباً أولاً" desc="يجب ربط صفحة فيسبوك أو حساب إنستغرام قبل إضافة منشور." action={<Link href="/dashboard/accounts" className="btn-primary">ربط حساب</Link>} />
        : <RuleEditor pages={pages} />}
    </div>
  );
}
