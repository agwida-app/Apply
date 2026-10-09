import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/events";
import { mapStripeStatus, planForPrice, stripe, stripeEnabled } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!stripeEnabled()) return new NextResponse("disabled", { status: 404 });
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, req.headers.get("stripe-signature") ?? "", process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new NextResponse("bad signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const userId = s.client_reference_id;
    if (userId) {
      await db.user.update({
        where: { id: userId },
        data: { plan: s.metadata?.plan ?? undefined, subscriptionStatus: "active", subscriptionEndsAt: null, stripeCustomerId: typeof s.customer === "string" ? s.customer : s.customer?.id },
      });
      await logEvent("info", "billing", `دفعة ناجحة عبر Stripe (${s.metadata?.plan})`, userId);
    }
  } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
    const user = await db.user.findFirst({ where: { stripeCustomerId: customer } });
    if (user) {
      const status = event.type === "customer.subscription.deleted" ? "canceled" : mapStripeStatus(sub.status);
      const plan = planForPrice(sub.items.data[0]?.price.id) ?? user.plan;
      await db.user.update({ where: { id: user.id }, data: { subscriptionStatus: status, plan } });
      if (status !== "active") await logEvent("warn", "billing", `حالة الاشتراك أصبحت: ${status}`, user.id);
    }
  }
  return NextResponse.json({ received: true });
}
