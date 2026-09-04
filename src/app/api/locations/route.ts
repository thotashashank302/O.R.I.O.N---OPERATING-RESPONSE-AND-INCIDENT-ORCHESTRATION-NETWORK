import { NextRequest, NextResponse } from "next/server";
import { createLocation, listLocations } from "@/server/identity/locations";
import { requireRequestContext } from "@/server/auth/request-context";

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const context = await requireRequestContext(req);
    const { searchParams } = new URL(req.url);
    const kind = searchParams.get("kind") || undefined;

    const locations = await listLocations(context.institutionId, kind);
    return NextResponse.json({ data: locations, requestId });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Failed to fetch locations" }, requestId },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const context = await requireRequestContext(req, ["principal", "admin"]);
    const body = await req.json();
    const result = await createLocation(context.institutionId, body);
    if (!result.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: result.error }, requestId },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: result.data, requestId }, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err instanceof Error ? err.message : "Failed to create location" }, requestId },
      { status: 500 }
    );
  }
}
