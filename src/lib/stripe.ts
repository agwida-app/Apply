import Stripe from "stripe";
import type { PlanId } from "./plans";

export const stripeEnabled = () => !!process.env.STRIPE_SECRET_KEY;
let client: Stripe | null = null;
export function stripe() {
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return client;
}

export function priceFor(plan: PlanId) {
  return { starter: process.env.STRIPE_PRICE_STARTER, pro: process.env.STRIPE_PRICE_PRO, business: process.env.STRIPE_PRICE_BUSINESS }[plan];
}

export function planForPrice(priceId: string | undefined): PlanId | null {
  for (const p of ["starter", "pro", "business"] as PlanId[]) if (priceId && priceFor(p) === priceId) return p;
  return null;
}

export function mapStripeStatus(s: Stripe.Subscription.Status) {
  if (s === "active" || s === "trialing") return "active";
  if (s === "past_due" || s === "unpaid" || s === "incomplete") return "past_due";
  return "canceled";
}
