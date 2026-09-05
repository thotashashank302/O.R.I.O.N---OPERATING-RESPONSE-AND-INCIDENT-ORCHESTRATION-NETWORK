/**
 * ORION — Verification Agent Module
 * Developer 4 (Anjali) owns this file.
 * Module assignment: D4 implements Verification under D1's published schema.
 *
 * Uses Featherless/Llama-3.3-70B-Instruct via the shared provider wrapper.
 * Enforces: AI verdict alone CANNOT close physical/sensitive work.
 * All results are validated with Zod before being persisted.
 *
 * Category-specific verifier rules from 09_EXECUTION_DECISIONS.md §2.
 */

import { z } from "zod";
import type {
  VerificationContext,
  VerificationDecision,
  ResolutionEvidence,
} from "@/contracts/operations";

// ─────────────────────────────────────────────
// Zod schema for validating Featherless response
// ─────────────────────────────────────────────

const VerificationDecisionSchema = z.object({
  task_id: z.string(),
  verdict: z.enum(["verified", "failed", "pending_human"]),
  missing_evidence: z.array(z.string()),
  reasons: z.array(z.string()).min(1),
  suggested_replan_reason: z.string().nullable(),
});

// ─────────────────────────────────────────────
// Category → physical check requirement rules
// From 09_EXECUTION_DECISIONS.md §2
// ─────────────────────────────────────────────

const PHYSICAL_CHECK_CATEGORIES = new Set([
  "electrical",
  "fan",
  "ac",
  "door",
  "key",
  "access",
  "security",
  "emergency",
  "safety",
  "plumbing",
]);

const HUMAN_ONLY_CATEGORIES = new Set([
  "personal",
  "cr_misconduct",
  "emergency",
  "safety",
]);

/**
 * Determines if a category requires mandatory human physical verification.
 * AI verdict alone cannot close these.
 * Checks each word in the category string individually.
 */
export function requiresHumanPhysicalCheck(category: string): boolean {
  // Split on any delimiter: /, space, _, -
  const words = category.toLowerCase().split(/[/\s_\-]+/);
  return words.some(
    (word) =>
      PHYSICAL_CHECK_CATEGORIES.has(word) ||
      HUMAN_ONLY_CATEGORIES.has(word)
  );
}

/**
 * Builds the system prompt for the Verification agent.
 * Instructs the model to produce structured evidence checks per category.
 */
function buildSystemPrompt(context: VerificationContext): string {
  return `You are the ORION Verification Agent. Your role is to check submitted evidence against task requirements.

CRITICAL RULES:
- You CANNOT autonomously close physical, electrical, security, or safety tasks. These require human confirmation.
- You CANNOT access arbitrary URLs, run code, or contact anyone.
- You MUST produce structured JSON only — no prose outside the JSON object.
- Evidence photos are private and NOT provided to you; you check structured notes and functional test results only.
- Your verdict must be one of: "verified", "failed", or "pending_human".
- Use "pending_human" when physical checks are required even if notes look complete.

TASK CATEGORY: ${context.incident_category}
REQUIRES HUMAN PHYSICAL CHECK: ${context.requires_human_physical_check}
SPECIALIST PROFILE: ${context.specialist_profile}

CHECKLIST ITEMS:
${context.checklist.map((item, i) => `${i + 1}. ${item}`).join("\n")}

EVIDENCE REQUIREMENTS:
${context.evidence_requirements.map((req, i) => `${i + 1}. ${req}`).join("\n")}

SUBMITTED EVIDENCE:
${formatEvidence(context.submitted_evidence)}

Produce a JSON object with this exact schema:
{
  "task_id": "<task_id>",
  "verdict": "verified" | "failed" | "pending_human",
  "missing_evidence": ["<description of gap>", ...],
  "reasons": ["<reason 1>", ...],
  "suggested_replan_reason": "<reason>" | null
}

If requires_human_physical_check is true, set verdict to "pending_human" and explain in reasons.
If any evidence requirement is unmet, set verdict to "failed" and list in missing_evidence.`;
}

function formatEvidence(evidence: ResolutionEvidence[]): string {
  if (evidence.length === 0) return "No evidence submitted.";
  return evidence
    .map(
      (e, i) =>
        `${i + 1}. [${e.kind.toUpperCase()}] version=${e.evidence_version}: ${e.content}`
    )
    .join("\n");
}

/**
 * Calls the Featherless provider to run a verification check.
 * Returns a validated VerificationDecision.
 *
 * Retry logic: up to 3 attempts with exponential backoff (1/2/4s).
 * On persistent failure: returns a pending_human verdict (fail safe).
 */
export async function runVerificationAgent(
  context: VerificationContext
): Promise<VerificationDecision> {
  const apiKey = process.env.FEATHERLESS_API_KEY;
  const baseUrl =
    process.env.FEATHERLESS_BASE_URL ?? "https://api.featherless.ai/v1";
  const model =
    process.env.FEATHERLESS_MODEL ??
    "meta-llama/Llama-3.3-70B-Instruct";

  if (!apiKey) {
    console.error("[verification-agent] FEATHERLESS_API_KEY not configured");
    return failSafePendingHuman(context, "Provider not configured");
  }

  // Force pending_human for human-only categories before calling AI
  if (
    HUMAN_ONLY_CATEGORIES.has(
      context.incident_category.toLowerCase().replace(/[/_\s]+/g, "_")
    )
  ) {
    return {
      task_id: context.task_id,
      verdict: "pending_human",
      missing_evidence: [],
      reasons: [
        `Category '${context.incident_category}' requires human-only handling. AI cannot verify or close this task.`,
      ],
      suggested_replan_reason: null,
    };
  }

  const systemPrompt = buildSystemPrompt(context);
  const userMessage = `Verify task ${context.task_id}. Evidence version: ${
    context.submitted_evidence.at(-1)?.evidence_version ?? 0
  }. Return JSON only.`;

  const maxAttempts = 3;
  const backoffMs = [1000, 2000, 4000];

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          max_tokens: 1024,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(60_000), // 60s AI timeout
      });

      if (response.status === 429 || response.status >= 500) {
        console.warn(
          `[verification-agent] attempt=${attempt + 1} status=${response.status} — retrying`
        );
        if (attempt < maxAttempts - 1) {
          await sleep(backoffMs[attempt]);
          continue;
        }
        break;
      }

      if (!response.ok) {
        throw new Error(`Unexpected status ${response.status}`);
      }

      const json = await response.json();
      const raw = json?.choices?.[0]?.message?.content;

      if (!raw) throw new Error("Empty model response");

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Model didn't return valid JSON — attempt bounded repair
        parsed = await repairJson(raw, context.task_id);
      }

      // Zod validation
      const validated = VerificationDecisionSchema.safeParse(parsed);
      if (!validated.success) {
        console.warn(
          `[verification-agent] schema validation failed:`,
          validated.error.flatten()
        );
        if (attempt < maxAttempts - 1) {
          await sleep(backoffMs[attempt]);
          continue;
        }
        break;
      }

      const decision = validated.data;

      // Safety override: physical tasks always get pending_human
      if (
        context.requires_human_physical_check &&
        decision.verdict === "verified"
      ) {
        decision.verdict = "pending_human";
        decision.reasons.push(
          "Physical verification required — human must confirm before this task can be marked verified."
        );
      }

      return decision;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[verification-agent] attempt=${attempt + 1} error: ${message}`
      );
      if (attempt < maxAttempts - 1) {
        await sleep(backoffMs[attempt]);
      }
    }
  }

  // All attempts failed — fail safe
  return failSafePendingHuman(context, "Agent failed after max attempts");
}

/**
 * Bounded JSON repair: asks model to fix malformed output once.
 */
async function repairJson(
  raw: string,
  taskId: string
): Promise<unknown> {
  try {
    const apiKey = process.env.FEATHERLESS_API_KEY!;
    const baseUrl =
      process.env.FEATHERLESS_BASE_URL ?? "https://api.featherless.ai/v1";
    const model =
      process.env.FEATHERLESS_MODEL ?? "meta-llama/Llama-3.3-70B-Instruct";

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Fix the following malformed JSON to match the VerificationDecision schema. Return only valid JSON, no other text.",
          },
          {
            role: "user",
            content: `task_id="${taskId}"\n\nMalformed output:\n${raw}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) throw new Error("Repair failed");
    const json = await response.json();
    return JSON.parse(json?.choices?.[0]?.message?.content ?? "{}");
  } catch {
    return {};
  }
}

function failSafePendingHuman(
  context: VerificationContext,
  reason: string
): VerificationDecision {
  return {
    task_id: context.task_id,
    verdict: "pending_human",
    missing_evidence: context.evidence_requirements,
    reasons: [
      `Verification agent could not complete check: ${reason}. Human review required.`,
    ],
    suggested_replan_reason: null,
  };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Category-specific functional verifier rule lookup.
 * Used by B2 evidence form to show the right checklist items.
 */
export function getVerifierRulesForCategory(category: string): {
  required_evidence: string[];
  human_confirmation_required: boolean;
  verifier_role_note: string;
} {
  const cat = category.toLowerCase().replace(/[/_\s]+/g, "_");

  const rules: Record<
    string,
    {
      required_evidence: string[];
      human_confirmation_required: boolean;
      verifier_role_note: string;
    }
  > = {
    electrical: {
      required_evidence: [
        "Safety clearance confirmation note",
        "Functional test result (equipment on/off cycle)",
        "No live wire exposure confirmed",
      ],
      human_confirmation_required: true,
      verifier_role_note:
        "Authorized CR or lab owner after staff safety clearance",
    },
    cleaning: {
      required_evidence: [
        "Completion note with area details",
        "Sanitization checklist completed",
      ],
      human_confirmation_required: false,
      verifier_role_note: "Reporting CR or location owner",
    },
    it_network: {
      required_evidence: [
        "Network connectivity test result",
        "Resolution description with diagnostic steps",
      ],
      human_confirmation_required: false,
      verifier_role_note: "Assigned lab owner or authorized reporting CR",
    },
    facilities: {
      required_evidence: [
        "Repair completion note",
        "Functional test (e.g., door closes properly, plumbing functional)",
      ],
      human_confirmation_required: false,
      verifier_role_note: "Reporting CR or location owner",
    },
    security: {
      required_evidence: [
        "Access resolution note",
        "Authorization confirmation from location owner",
      ],
      human_confirmation_required: true,
      verifier_role_note: "Authorized requester or location owner",
    },
    transport: {
      required_evidence: ["Route/issue resolution note", "Rider confirmation"],
      human_confirmation_required: false,
      verifier_role_note: "Authorized reporting rider or transport supervisor",
    },
    emergency: {
      required_evidence: [],
      human_confirmation_required: true,
      verifier_role_note:
        "Authorized human incident lead only — AI cannot handle",
    },
  };

  return (
    rules[cat] ?? {
      required_evidence: ["Work completion note", "Issue resolved confirmation"],
      human_confirmation_required: false,
      verifier_role_note: "Supervisor selects appropriate verifier",
    }
  );
}
