import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { handleIncomingComment } from "@/lib/engine";
import { logEvent } from "@/lib/events";
import { accessTokenFor } from "@/lib/platforms";
import { getTikTokComment, parseTikTokCommentEvent, verifyTikTokSignature } from "@/lib/tiktok";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyTikTokSignature(raw, req.headers.get("tiktok-signature"))) return new NextResponse("bad signature", { status: 401 });

  const ev = parseTikTokCommentEvent(raw);
  if (!ev) return NextResponse.json({ ok: true });

  try {
    const page = await db.page.findUnique({ where: { platform_externalId: { platform: "tiktok", externalId: ev.openId } } });
    if (!page || !page.active) return NextResponse.json({ ok: true });
    // نص التعليق واسم المعلّق غير مضمونين في الإشعار، فنجلبهما عند الحاجة؛ ونتجاهل تعليقات صاحب الحساب
    let text = ev.text, username = ev.username;
    if (text === undefined || !username) {
      const c = await getTikTokComment(await accessTokenFor(page), page.externalId, ev.videoId, ev.commentId);
      if (c?.owner) return NextResponse.json({ ok: true });
      text ??= c?.text ?? "";
      username ??= c?.username ?? undefined;
    }
    await handleIncomingComment({
      platform: "tiktok", accountId: ev.openId, commentId: ev.commentId, postId: ev.videoId,
      parentId: null, fromId: username ? `tt:${username}` : null, fromName: username ?? null, text: text ?? "",
    });
  } catch (e) {
    await logEvent("error", "webhook", `tiktok comment ${ev.commentId}: ${(e as Error).message}`);
  }
  return NextResponse.json({ ok: true });
}
