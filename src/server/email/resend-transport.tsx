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
    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to: [message.recipient],
      subject: message.urgent ? "Urgent ORION task requires acknowledgement" : "ORION task requires acknowledgement",
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
