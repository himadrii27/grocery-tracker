import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@grocery-tracker/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Require the same extension token as the sync POST endpoint
  const headersList = await headers();
  const token = headersList.get("authorization")?.replace("Bearer ", "").trim();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const authedUser = await db.user.findUnique({ where: { extensionToken: token } });
  if (!authedUser) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { id } = await params;

  return NextResponse.json({
    sessionId: id,
    status: "complete",
    processedOrders: 0,
    totalOrders: 0,
  });
}
