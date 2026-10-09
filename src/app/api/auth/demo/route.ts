import { NextResponse } from "next/server";
import { getMe, isDemoMode } from "@/lib/meta";
import { setSession } from "@/lib/session";
import { upsertUserFromFacebook } from "@/lib/users";

export async function POST() {
  if (!isDemoMode()) return new NextResponse("demo disabled", { status: 404 });
  const token = "demo:user";
  const user = await upsertUserFromFacebook(await getMe(token), token, true);
  await setSession({ role: "client", userId: user.id });
  return NextResponse.redirect(`${process.env.APP_URL}/dashboard`, 303);
}
