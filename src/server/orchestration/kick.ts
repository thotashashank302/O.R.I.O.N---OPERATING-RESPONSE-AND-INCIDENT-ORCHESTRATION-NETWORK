import { after } from "next/server";
import { createProductionWorker } from "./production-worker";

export function kickWorker(reason: string) {
  try {
    after(async () => {
      try { await createProductionWorker().tick(reason); }
      catch (error) { console.error("[ORION] Worker interrupted; durable jobs remain queued", error); }
    });
  } catch (error) {
    console.warn("[ORION] kickWorker outside request context; ticking worker asynchronously in background", error);
    createProductionWorker().tick(reason).catch((workerErr) => {
      console.error("[ORION] Background fallback worker tick error:", workerErr);
    });
  }
}
