import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@grocery-tracker/db";

/**
 * POST /api/extension/token
 *
 * Called by the extension-auth page (which has a valid Clerk session).
 * Generates a random, permanent extension token for the user and stores it in the DB.
 * The extension stores this token and uses it for all future sync calls — no expiry.
 */
export async function POST() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate a secure random token (48 bytes = 96 hex chars)
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(48))).toString("hex");

  // upsert: create the user row if it doesn't exist yet (Clerk webhook may not be configured)
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${clerkId}@unknown`;

  const user = await db.user.upsert({
    where: { clerkId },
    create: { clerkId, email, extensionToken: token },
    update: { extensionToken: token },
    select: { extensionToken: true },
  });

  return NextResponse.json({ token: user.extensionToken });
}
