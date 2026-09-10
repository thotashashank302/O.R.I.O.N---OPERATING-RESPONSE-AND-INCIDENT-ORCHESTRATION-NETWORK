import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import nextEnv from "@next/env";
import { runLocalWorker } from "./local-worker.mjs";

const production = process.argv.includes("--production");
nextEnv.loadEnvConfig(process.cwd(), !production);
const port = Number(process.env.PORT || 3000);
const intervalMs = Number(process.env.LOCAL_WORKER_INTERVAL_MS || 10_000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be between 1 and 65535.");
if (!Number.isInteger(intervalMs) || intervalMs < 1000) throw new Error("LOCAL_WORKER_INTERVAL_MS must be at least 1000.");
if (!process.env.AUTOMATION_SECRET || process.env.AUTOMATION_SECRET.length < 32) {
  throw new Error("Set AUTOMATION_SECRET (at least 32 characters) in .env before starting local mode.");
}

const origin = `http://127.0.0.1:${port}`;
const controller = new AbortController();
const require = createRequire(import.meta.url);
const server = spawn(process.execPath, [require.resolve("next/dist/bin/next"),
  production ? "start" : "dev", ...(!production ? ["--webpack"] : []),
  "--hostname", "127.0.0.1", "--port", String(port)], {
  stdio: "inherit",
  env: { ...process.env, APP_URL: `http://localhost:${port}` },
});
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  controller.abort();
  server.kill("SIGTERM");
  const timer = setTimeout(() => server.kill("SIGKILL"), 5000);
  timer.unref();
  server.once("exit", () => clearTimeout(timer));
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
server.on("error", () => { console.error("[local] Could not start Next.js."); stop(1); });
server.on("exit", (code) => { if (!stopping) stop(code ?? 1); });
console.log(`[local] http://localhost:${port}; background checks every ${intervalMs / 1000}s after the previous tick completes. Ctrl+C stops both.`);
try {
  await runLocalWorker({ origin, secret: process.env.AUTOMATION_SECRET, intervalMs, signal: controller.signal });
} catch (error) {
  console.error(`[local] ${error.message}`);
  stop(1);
}
