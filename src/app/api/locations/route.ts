import { NextRequest, NextResponse } from "next/server";
import { createLocation, listLocations } from "@/server/identity/locations";

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const { searchParams } = new URL(req.url);
    const institutionId = searchParams.get("institution_id");
    const kind = searchParams.get("kind") || undefined;

    if (!institutionId) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "institution_id query parameter is required" }, requestId },
        { status: 400 }
      );
    }

    const locations = await listLocations(institutionId, kind);
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
    const { searchParams } = new URL(req.url);
    const institutionId = searchParams.get("institution_id");
    const body = await req.json();

    const targetInstitutionId = institutionId || body.institution_id;
    if (!targetInstitutionId) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "institution_id is required" }, requestId },
        { status: 400 }
      );
    }

    const result = await createLocation(targetInstitutionId, body);
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
