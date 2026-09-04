import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "react-email";

export interface AssignmentNotificationProps {
  actionUrl: string;
  acknowledgementDeadline: string;
  urgent: boolean;
}

export default function AssignmentNotification({ actionUrl, acknowledgementDeadline, urgent }: AssignmentNotificationProps) {
  const accent = urgent ? "#f97316" : "#22d3ee";
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{urgent ? "Urgent ORION action requires acknowledgement" : "An ORION task requires acknowledgement"}</Preview>
      <Body style={{ margin: 0, backgroundColor: "#07101d", color: "#e6f6ff", fontFamily: "Arial, sans-serif" }}>
        <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "40px 24px" }}>
          <Text style={{ color: accent, fontSize: "12px", fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" }}>ORION secure notification</Text>
          <Heading style={{ color: "#f8fafc", fontSize: "28px", lineHeight: "34px", margin: "12px 0" }}>
            {urgent ? "Urgent response requested" : "A task is ready for you"}
          </Heading>
          <Text style={{ color: "#b8c6d9", fontSize: "16px", lineHeight: "25px" }}>
            Sign in to ORION to review the authorized case details. Sensitive incident content is intentionally excluded from this email.
          </Text>
          <Section style={{ borderLeft: `3px solid ${accent}`, backgroundColor: "#0d1a2b", padding: "12px 16px", margin: "24px 0" }}>
            <Text style={{ color: "#dce8f5", margin: 0 }}>Acknowledge by {acknowledgementDeadline}</Text>
          </Section>
          <Button href={actionUrl} style={{ backgroundColor: accent, color: "#03111c", fontWeight: 700, padding: "13px 20px", textDecoration: "none" }}>
            Review and acknowledge
          </Button>
          <Text style={{ color: "#7f91a8", fontSize: "12px", lineHeight: "18px", marginTop: "28px" }}>
            This link is single-use, expires quickly, and only works for the intended signed-in staff member.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
