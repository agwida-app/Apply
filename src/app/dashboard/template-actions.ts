"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sanitizeTemplate } from "@/lib/messenger";
import { requireUser } from "@/lib/session";

export async function saveTemplate(input: { id?: string; name: string; keywords: string[]; messages: unknown; quickReplies: unknown }): Promise<{ id?: string; error?: string }> {
  const user = await requireUser();
  const name = input.name.trim().slice(0, 80);
  if (!name) return { error: "اكتب اسماً للرسالة." };
  const own = await db.messageTemplate.findMany({ where: { userId: user.id }, select: { id: true } });
  const ids = new Set(own.map((t) => t.id));
  if (input.id && !ids.has(input.id)) return { error: "الرسالة غير موجودة" };
  const clean = sanitizeTemplate(input, ids);
  if (!clean.messages.length) return { error: "أضف نصاً أو صورة أو بطاقة واحدة على الأقل." };
  const data = {
    name, messages: JSON.stringify(clean.messages), quickReplies: JSON.stringify(clean.quickReplies),
    keywords: JSON.stringify(input.keywords.map((k) => k.trim()).filter(Boolean).slice(0, 30)),
  };
  const t = input.id
    ? await db.messageTemplate.update({ where: { id: input.id }, data })
    : await db.messageTemplate.create({ data: { ...data, userId: user.id } });
  revalidatePath("/dashboard/messages");
  return { id: t.id };
}

export async function deleteTemplate(form: FormData) {
  const user = await requireUser();
  await db.messageTemplate.deleteMany({ where: { id: String(form.get("id")), userId: user.id } });
  revalidatePath("/dashboard/messages");
  redirect("/dashboard/messages");
}
