import { NextResponse } from "next/server";
import {
  getAllSubscriptions,
  activateSubscription,
  suspendSubscription,
  adjustSubscriptionDays,
  addAllowedDevice,
  removeAllowedDevice,
  deleteSubscription,
} from "@/lib/subscriptionManager";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const subscriptions = await getAllSubscriptions();
    return NextResponse.json({ success: true, subscriptions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({ error: "Subscription ID and action are required" }, { status: 400 });
    }

    if (action === "ACTIVATE") {
      const days = Number(body.durationDays) || 30;
      const updated = await activateSubscription(id, days);
      return NextResponse.json({ success: true, subscription: updated });
    }

    if (action === "SUSPEND") {
      const updated = await suspendSubscription(id);
      return NextResponse.json({ success: true, subscription: updated });
    }

    if (action === "ADJUST_DAYS") {
      const delta = Number(body.daysDelta) || 0;
      const updated = await adjustSubscriptionDays(id, delta);
      return NextResponse.json({ success: true, subscription: updated });
    }

    if (action === "ADD_DEVICE") {
      const machineId = body.machineId;
      if (!machineId || !machineId.trim()) {
        return NextResponse.json({ error: "Machine ID is required" }, { status: 400 });
      }
      const updated = await addAllowedDevice(id, machineId.trim());
      return NextResponse.json({ success: true, subscription: updated });
    }

    if (action === "REMOVE_DEVICE") {
      const machineId = body.machineId;
      if (!machineId) {
        return NextResponse.json({ error: "Machine ID is required" }, { status: 400 });
      }
      const updated = await removeAllowedDevice(id, machineId);
      return NextResponse.json({ success: true, subscription: updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await deleteSubscription(id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
