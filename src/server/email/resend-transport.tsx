import { Resend } from "resend";
import AssignmentNotification from "@/emails/assignment-notification";

export interface AssignmentEmail {
  recipient: string;
  actionUrl: string;
  acknowledgementDeadline: string;
  urgent: boolean;
  idempotencyKey: string;
}

export interface EmailTransport {
  sendAssignment(message: AssignmentEmail): Promise<{ providerId: string }>;
}

export class ResendEmailTransport implements EmailTransport {
  private readonly resend: Resend;

  constructor(apiKey: string, private readonly from: string) {
    this.resend = new Resend(apiKey);
  }

  async sendAssignment(message: AssignmentEmail): Promise<{ providerId: string }> {
    const isDemoAddress = message.recipient.endsWith("@orion-demo.edu") || message.recipient.endsWith(".local") || message.recipient.endsWith(".test");
    const verifiedFallback = process.env.DEMO_RECIPIENT_ALLOWLIST?.split(",")[0]?.replace(/["']/g, "").trim() || "lokinindi.shivani@gmail.com";
    const targetRecipient = isDemoAddress ? verifiedFallback : message.recipient;
    const subjectPrefix = isDemoAddress ? `[ORION for ${message.recipient}] ` : "";

    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to: [targetRecipient],
      subject: `${subjectPrefix}${message.urgent ? "Urgent ORION task requires acknowledgement" : "ORION task requires acknowledgement"}`,
      react: AssignmentNotification({
        actionUrl: message.actionUrl,
        acknowledgementDeadline: message.acknowledgementDeadline,
        urgent: message.urgent,
      }),
    }, { idempotencyKey: message.idempotencyKey });
    if (error || !data?.id) throw new Error(error?.message ?? "Email provider returned no message id");
    return { providerId: data.id };
  }
}
