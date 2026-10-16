import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX = 5 * 1024 * 1024;

/** رفع صورة للرسائل: تُخزَّن في قاعدة البيانات وتُخدم برابط عام يستطيع فيسبوك جلبه */
export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s || s.role !== "client") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "لم يتم اختيار صورة" }, { status: 400 });
  if (!TYPES.includes(file.type)) return NextResponse.json({ error: "الصيغ المدعومة: JPG, PNG, WEBP, GIF" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "حجم الصورة أكبر من 5 ميغابايت" }, { status: 400 });
  const m = await db.media.create({ data: { userId: s.userId, mime: file.type, size: file.size, data: new Uint8Array(await file.arrayBuffer()) } });
  return NextResponse.json({ url: `${process.env.APP_URL}/api/media/${m.id}` });
}
