import { NextRequest, NextResponse } from "next/server";
import { enrollTransport } from "@/server/identity/eligibility";

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const body = await req.json();
    const result = await enrollTransport(body);

    if (!result.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: result.error }, requestId },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: result.data, requestId }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "SERVER_ERROR", message: err.message || "Failed to enroll transport" }, requestId },
      { status: 500 }
    );
  }
}
