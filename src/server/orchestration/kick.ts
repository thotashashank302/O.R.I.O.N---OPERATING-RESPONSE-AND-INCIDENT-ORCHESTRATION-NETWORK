import { after } from "next/server";
import { createProductionWorker } from "./production-worker";

export function kickWorker(reason: string) {
  after(async () => {
    try { await createProductionWorker().tick(reason); }
    catch (error) { console.error("[ORION] Worker interrupted; durable jobs remain queued", error); }
  });
}
