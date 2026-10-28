import { getStripeClient, getStripeWebhookSecret } from "@/lib/stripe";
import { activateSubscription, getSubscriptionById } from "@/lib/subscriptionService";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing Stripe signature", { status: 400 });

  let event;
  try {
    event = getStripeClient().webhooks.constructEvent(await request.text(), signature, getStripeWebhookSecret());
  } catch (error) {
    console.error("[Stripe webhook] Invalid signature", error instanceof Error ? error.message : error);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object as import("stripe").default.Checkout.Session;
      if (session.payment_status !== "paid") return new Response("Awaiting payment", { status: 200 });
      const subscriptionId = session.metadata?.subscriptionId;
      if (subscriptionId && (await getSubscriptionById(subscriptionId))) {
        await activateSubscription(subscriptionId);
      }
    }

    if (event.type === "checkout.session.async_payment_failed") {
      console.warn("[Stripe webhook] Async payment failed", event.id);
    }
  } catch (error) {
    console.error("[Stripe webhook] Processing failed", error instanceof Error ? error.message : error);
    return new Response("Webhook processing failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
