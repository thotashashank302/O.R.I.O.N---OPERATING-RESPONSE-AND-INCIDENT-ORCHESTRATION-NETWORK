import { describe, expect, it, vi } from "vitest";
// @ts-expect-error Standalone Node script intentionally ships without TypeScript compilation.
import { runLocalWorker } from "../../scripts/local-worker.mjs";

describe("local background scheduler", () => {
  it("authenticates, retries server failures, and never overlaps long ticks", async () => {
    const controller = new AbortController();
    let active = 0;
    let peak = 0;
    let calls = 0;
    const fetchImpl = vi.fn(async (_url: string, options: RequestInit) => {
      expect(options.method).toBe("POST");
      expect(options.headers).toEqual({ authorization: "Bearer test-secret" });
      active++;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 15));
      active--;
      if (++calls === 1) return new Response(null, { status: 503 });
      controller.abort();
      return Response.json({ data: { claimed: 1, succeeded: 1, retried: 0, dead: 0 } });
    });
    await runLocalWorker({ origin: "http://127.0.0.1:3000", secret: "test-secret", intervalMs: 1,
      signal: controller.signal, fetchImpl, log: vi.fn() });
    expect(calls).toBe(2);
    expect(peak).toBe(1);
  });

  it("stops on invalid credentials instead of silently retrying forever", async () => {
    await expect(runLocalWorker({ origin: "http://127.0.0.1:3000", secret: "wrong",
      signal: new AbortController().signal,
      fetchImpl: async () => new Response(null, { status: 401 }), log: vi.fn(),
    })).rejects.toThrow("Worker authentication failed");
  });
});
