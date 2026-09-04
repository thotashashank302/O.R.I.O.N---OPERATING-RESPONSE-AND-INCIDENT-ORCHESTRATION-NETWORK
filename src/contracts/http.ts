import { z } from "zod";

export const expectedVersionSchema = z.object({ expectedVersion: z.number().int().positive() });

export type ApiSuccess<T> = { data: T; requestId: string };
export type ApiFailure = { error: { code: string; message: string }; requestId: string };

export function ok<T>(data: T, requestId: string, status = 200): Response {
  return Response.json({ data, requestId } satisfies ApiSuccess<T>, { status });
}

export function fail(code: string, message: string, requestId: string, status: number): Response {
  return Response.json({ error: { code, message }, requestId } satisfies ApiFailure, { status });
}
