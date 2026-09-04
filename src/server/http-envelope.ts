export function jsonSuccess<T>(data: T, status: number = 200) {
  return Response.json(
    {
      data,
      requestId: crypto.randomUUID(),
    },
    { status }
  );
}

export function jsonError(code: string, message: string, status: number = 400) {
  return Response.json(
    {
      error: {
        code,
        message,
      },
      requestId: crypto.randomUUID(),
    },
    { status }
  );
}
