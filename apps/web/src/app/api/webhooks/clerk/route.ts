import { headers } from "next/headers";
import { Webhook } from "svix";
import { db } from "@grocery-tracker/db";
import type { NextRequest } from "next/server";

interface UserCreatedEvent {
  type: "user.created";
  data: {
    id: string;
    email_addresses: Array<{ email_address: string; id: string }>;
    primary_email_address_id: string;
  };
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response("Webhook secret not configured", { status: 500 });
  }

  const headersList = await headers();
  const svixId = headersList.get("svix-id");
  const svixTimestamp = headersList.get("svix-timestamp");
  const svixSignature = headersList.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.text();
  const wh = new Webhook(webhookSecret);

  let event: UserCreatedEvent;
  try {
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as UserCreatedEvent;
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (event.type === "user.created") {
    const primaryEmail = event.data.email_addresses.find(
      (e) => e.id === event.data.primary_email_address_id
    );

    if (!primaryEmail) {
      return new Response("No primary email", { status: 400 });
    }

    await db.user.create({
      data: {
        clerkId: event.data.id,
        email: primaryEmail.email_address,
        preferences: { create: {} },
      },
    });
  }

  return new Response("OK", { status: 200 });
}
