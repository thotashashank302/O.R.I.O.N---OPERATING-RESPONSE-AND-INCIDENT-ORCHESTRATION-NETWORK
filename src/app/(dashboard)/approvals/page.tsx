import { redirect } from "next/navigation";
import { createClient } from "@/server/db/client";
import { activeMembership } from "@/server/auth/active-membership";
import { listApprovalQueue } from "@/server/operations/approval-queue";
import { HODApprovalPanel } from "@/features/operations/HODApprovalPanel";
export default async function ApprovalsPage() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership, error } = await activeMembership(db, user.id);
  if (error) throw new Error("Approval access is temporarily unavailable");
  if (!membership) redirect("/login");
  const approvals = await listApprovalQueue(membership);
  return <section className="mx-auto max-w-3xl space-y-5 p-6"><h1 className="text-2xl font-bold">Action approvals</h1>
    <p>Review the proposed staff, checklist and required evidence. The decision applies to this exact action and plan version.</p>
    {!approvals.length && <p>No current actions require your approval.</p>}
    {approvals.map(a => <HODApprovalPanel key={a.id} approvalId={a.id} actionDescription={a.description}
      requestedByName={a.staffName} actionPayloadHash={a.actionPayloadHash} planVersion={a.planVersion} isHighRiskPhysical />)}
  </section>;
}
