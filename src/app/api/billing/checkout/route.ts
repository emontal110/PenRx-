import { apiError, apiJson, readJsonBody } from "@/lib/apiHttp";
import { getStripeClient } from "@/lib/stripe";
import { resolvePlan } from "@/lib/env";
import { submitSubscription, attachStripeCheckoutSession } from "@/lib/subscriptionService";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJsonBody<{
    planId?: string;
    machineId?: string;
    doctorName?: string;
    clinicName?: string;
    senderPhone?: string;
  }>(request);
  if (!body.ok) return apiError(request, "محتوى الطلب غير صالح.", 400);

  const plan = resolvePlan(String(body.data.planId || ""));
  if (!plan || plan.isTrial) return apiError(request, "خطة مدفوعة صالحة مطلوبة.", 400);

  const subscription = await submitSubscription({
    planId: plan.id,
    paymentMethod: "stripe",
    senderPhone: String(body.data.senderPhone || "0000000000"),
    transactionRef: "stripe-pending",
    machineId: String(body.data.machineId || ""),
    allowedMachineIds: [String(body.data.machineId || "")],
    doctorName: String(body.data.doctorName || ""),
    clinicName: String(body.data.clinicName || ""),
  });

  const origin = new URL(request.url).origin;
  const session = await getStripeClient().checkout.sessions.create({
    mode: "payment",
    ui_mode: "hosted_page",
    line_items: [{
      price_data: {
        currency: "egp",
        product_data: { name: `PenRX+ - ${plan.nameAr}` },
        unit_amount: Math.round(plan.priceEGP * 100),
      },
      quantity: 1,
    }],
    metadata: { subscriptionId: subscription.id, planId: plan.id, machineId: subscription.machineId },
    success_url: `${origin}/subscriptions?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/subscriptions?payment=cancelled`,
    integration_identifier: `penrx_checkout_${Math.random().toString(36).slice(2, 10)}`,
  });

  await attachStripeCheckoutSession(subscription.id, session.id);
  return apiJson(request, { success: true, url: session.url, subscriptionId: subscription.id });
}
