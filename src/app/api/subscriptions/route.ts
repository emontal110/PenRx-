import { NextResponse } from "next/server";
import {
  getAllSubscriptions,
  getSubscriptionByMachine,
  getSubscriptionBySubscriberId,
  submitSubscription,
  linkDeviceToSubscriber,
} from "@/lib/subscriptionManager";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const machineId = searchParams.get("machineId");
    const subscriberId = searchParams.get("subscriberId");

    if (machineId) {
      const match = await getSubscriptionByMachine(machineId);
      return NextResponse.json({ subscription: match });
    }

    if (subscriberId) {
      const match = await getSubscriptionBySubscriberId(subscriberId);
      return NextResponse.json({ subscription: match });
    }

    const subscriptions = await getAllSubscriptions();
    return NextResponse.json({ success: true, subscriptions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch subscriptions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    // Doctor linking their second/third device to existing subscriber ID
    if (action === "link_device") {
      const { subscriberId, machineId } = body;
      if (!subscriberId || !machineId) {
        return NextResponse.json({ error: "Subscriber ID and Machine ID are required" }, { status: 400 });
      }

      const updated = await linkDeviceToSubscriber(subscriberId, machineId);
      if (!updated) {
        return NextResponse.json({ error: "لم يتم العثور على حساب مشترك بهذا المعرّف" }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: "تم ربط الجهاز الجديد بنجاح بحساب المشترك",
        subscription: updated,
      });
    }

    // New subscription submission
    const {
      id,
      subscriberId,
      planId,
      planName,
      price,
      paymentMethod,
      senderPhone,
      transactionRef,
      machineId,
      doctorName,
      clinicName,
      durationDays,
      isTrial,
    } = body;

    if (!machineId) {
      return NextResponse.json({ error: "Machine ID is required" }, { status: 400 });
    }

    const newSub = await submitSubscription({
      id,
      subscriberId,
      planId,
      planName,
      price: Number(price) || 0,
      paymentMethod: paymentMethod || "vodafone",
      senderPhone: senderPhone || "",
      transactionRef: transactionRef || "",
      machineId,
      doctorName,
      clinicName,
      durationDays: Number(durationDays) || 30,
      isTrial: Boolean(isTrial),
    });

    return NextResponse.json({ success: true, subscription: newSub });
  } catch (err: any) {
    console.error("Subscription create error:", err);
    return NextResponse.json({ error: err.message || "Failed to process request" }, { status: 500 });
  }
}
