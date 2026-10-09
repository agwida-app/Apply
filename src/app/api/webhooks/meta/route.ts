import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { handleIncomingComment, IncomingComment } from "@/lib/engine";
import { logEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

// تحقق فيسبوك عند تسجيل رابط الـ Webhook
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === process.env.META_VERIFY_TOKEN) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

type Change = { field: string; value: Record<string, any> };
type Body = { object: string; entry?: { id: string; changes?: Change[] }[] };

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256") ?? "";
  const expected = "sha256=" + crypto.createHmac("sha256", process.env.META_APP_SECRET ?? "").update(raw).digest("hex");
  if (!process.env.META_APP_SECRET || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return new NextResponse("bad signature", { status: 401 });
  }

  let body: Body;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("bad json", { status: 400 });
  }

  const comments: IncomingComment[] = [];
  for (const entry of body.entry ?? []) {
    for (const ch of entry.changes ?? []) {
      const v = ch.value ?? {};
      if (body.object === "page" && ch.field === "feed" && v.item === "comment" && v.verb === "add") {
        comments.push({
          platform: "facebook", accountId: entry.id, commentId: v.comment_id, postId: v.post_id,
          parentId: v.parent_id, fromId: v.from?.id, fromName: v.from?.name, text: v.message ?? "",
        });
      } else if (body.object === "instagram" && ch.field === "comments" && v.id && v.media?.id) {
        comments.push({
          platform: "instagram", accountId: entry.id, commentId: v.id, postId: v.media.id,
          parentId: v.parent_id ?? null, fromId: v.from?.id, fromName: v.from?.username, text: v.text ?? "",
        });
      }
    }
  }

  // نرد دائماً بـ 200 حتى لا يعيد فيسبوك الإرسال أو يعطّل الـ Webhook؛ الأخطاء تُسجل في لوحة الإدارة
  await Promise.all(comments.map((c) =>
    handleIncomingComment(c).catch((e) => logEvent("error", "webhook", `comment ${c.commentId}: ${(e as Error).message}`))));
  return NextResponse.json({ ok: true });
}
