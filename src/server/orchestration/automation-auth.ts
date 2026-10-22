import { secretMatches } from "@/server/security/secrets";
export function isAutomationAuthorized(request: Request): boolean {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  return [process.env.AUTOMATION_SECRET, process.env.CRON_SECRET]
    .some(secret => !!secret && secret.length >= 32 && secretMatches(supplied, secret));
}
