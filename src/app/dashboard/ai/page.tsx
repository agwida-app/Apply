import { AiTester } from "@/components/AiTester";
import { Alert, PageHeader, Stat, TextLink } from "@/components/ui";
import { aiAvailable, aiConfigured, TONES } from "@/lib/ai";
import { db } from "@/lib/db";
import { startOfMonth } from "@/lib/engine";
import { limitsFor } from "@/lib/plans";
import { requireUser } from "@/lib/session";
import { saveAiSettings } from "../ai-actions";

export default async function AiPage() {
  const user = await requireUser();
  const [used, rules] = await Promise.all([
    db.replyLog.count({ where: { userId: user.id, aiUsed: true, createdAt: { gte: startOfMonth() } } }),
    db.rule.count({ where: { userId: user.id, aiMode: true, enabled: true } }),
  ]);
  const limit = limitsFor(user).aiRepliesPerMonth;
  return (
    <div>
      <PageHeader title="🤖 الرد الذكي" desc="الذكاء الاصطناعي يقرأ تعليق الزبون ويرد عليه حسب معلومات متجرك، بدل رد ثابت للجميع" />
      {!aiAvailable() && <Alert tone="red">الرد الذكي غير مفعّل على الخادم بعد.</Alert>}
      {aiAvailable() && !aiConfigured() && <Alert tone="blue">🧪 وضع تجريبي: الردود هنا نموذجية وليست من الذكاء الاصطناعي الحقيقي.</Alert>}
      {limit === 0 && <Alert>باقتك الحالية لا تشمل الرد الذكي. <TextLink href="/dashboard/billing">رقِّ إلى الاحترافية</TextLink></Alert>}
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="ردود ذكية هذا الشهر" value={used.toLocaleString("ar")} hint={`من أصل ${limit.toLocaleString("ar")}`} />
        <Stat label="منشورات تستخدم الرد الذكي" value={rules} hint="فعّله من إعدادات كل منشور" />
      </div>
      <AiTester tones={Object.entries(TONES).map(([id, t]) => ({ id, label: t.label }))} initialInfo={user.businessInfo ?? ""} initialTone={user.aiTone} saveAction={saveAiSettings} />
      <div className="card mt-4 text-sm">
        <div className="mb-2 font-extrabold">كيف يعمل؟</div>
        <ul className="muted list-inside list-disc space-y-1">
          <li>فعّل «الرد الذكي» من إعدادات المنشور، وسيُكتب لكل زبون رد خاص بسؤاله.</li>
          <li>لا يخترع أسعاراً أو وعوداً: إذا لم يجد الجواب في معلومات متجرك، يقول إن الفريق سيتواصل معه.</li>
          <li>يتجاهل السبام والإساءات تلقائياً.</li>
          <li>إذا انتهى الرصيد أو حدث خطأ، يُرسل ردك الثابت تلقائياً فلا يضيع أي زبون.</li>
        </ul>
      </div>
    </div>
  );
}
