import type { EmailStatus } from "@/contracts/domain";

const eventStates = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "sent",
  "email.bounced": "bounced",
  "email.complained": "suppressed",
  "email.suppressed": "suppressed",
  "email.failed": "failed",
} as const satisfies Record<string, EmailStatus>;

const progressRank: Partial<Record<EmailStatus, number>> = { queued: 0, sending: 1, sent: 2, delivered: 3 };
const terminal = new Set<EmailStatus>(["delivered", "bounced", "suppressed"]);

export function statusForEmailEvent(type: string): EmailStatus | null {
  return eventStates[type as keyof typeof eventStates] ?? null;
}

export function reduceEmailStatus(current: EmailStatus, incoming: EmailStatus): EmailStatus {
  if (terminal.has(current)) return current;
  if (incoming === "failed") return current === "sent" ? current : incoming;
  if (incoming === "bounced" || incoming === "suppressed") return incoming;
  if (incoming === "delivered") return incoming;
  return (progressRank[incoming] ?? -1) > (progressRank[current] ?? -1) ? incoming : current;
}
