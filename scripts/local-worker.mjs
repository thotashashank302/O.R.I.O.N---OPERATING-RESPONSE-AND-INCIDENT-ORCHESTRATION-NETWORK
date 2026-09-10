import { setTimeout as delay } from "node:timers/promises";

// Await each response before polling again: long AI jobs must not overlap.
export async function runLocalWorker({ origin, secret, intervalMs = 10_000, signal, fetchImpl = fetch, log = console.log }) {
  while (!signal.aborted) {
    try {
      const response = await fetchImpl(`${origin}/api/automation/tick`, {
        method: "POST",
        headers: { authorization: `Bearer ${secret}` },
        redirect: "error",
        signal,
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error("Worker authentication failed; check AUTOMATION_SECRET and restart.");
      }
      if (!response.ok) {
        log(`[worker] HTTP ${response.status}; will retry.`);
      } else {
        const { data } = await response.json();
        log(`[worker] claimed=${data.claimed} succeeded=${data.succeeded} retried=${data.retried} dead=${data.dead}`);
      }
    } catch (error) {
      if (signal.aborted) break;
      if (error.message.startsWith("Worker authentication failed")) throw error;
      log("[worker] Server unavailable or invalid response; will retry.");
    }
    try { await delay(intervalMs, undefined, { signal }); } catch { break; }
  }
}
