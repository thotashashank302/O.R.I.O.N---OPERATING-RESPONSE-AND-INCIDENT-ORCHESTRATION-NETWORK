import { NextRequest, NextResponse } from "next/server";
import { getUserContexts } from "@/server/identity/roles";

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id") || "demo-user-id";

    const contexts = await getUserContexts(userId);
    if (!contexts) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "User contexts not found" }, requestId },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: contexts, requestId });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Failed to fetch user contexts" }, requestId },
      { status: 500 }
    );
  }
}
