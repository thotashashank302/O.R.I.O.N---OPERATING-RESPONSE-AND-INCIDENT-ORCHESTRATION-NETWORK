import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const supabaseServerEnvSchema = publicEnvSchema.extend({ SUPABASE_SECRET_KEY: z.string().min(1) });

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SECRET_KEY: z.string().min(1),
  FEATHERLESS_API_KEY: z.string().min(1),
  FEATHERLESS_BASE_URL: z.string().url().default("https://api.featherless.ai/v1"),
  FEATHERLESS_MODEL: z.string().min(1).default("meta-llama/Llama-3.3-70B-Instruct"),
  AUTOMATION_SECRET: z.string().min(32),
  DEMO_MODE: z.enum(["true", "false"]).default("false"),
});

const emailDeliveryEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM: z.string().min(3),
  EMAIL_ACTION_SECRET: z.string().min(32),
  APP_URL: z.string().url(),
  DEMO_MODE: z.enum(["true", "false"]).default("false"),
  DEMO_RECIPIENT_ALLOWLIST: z.string().default(""),
});

const emailWebhookEnvSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
  RESEND_WEBHOOK_SECRET: z.string().min(16),
});

const emailActionEnvSchema = z.object({ EMAIL_ACTION_SECRET: z.string().min(32) });

export function getPublicEnv() {
  return publicEnvSchema.parse(process.env);
}

export function getServerEnv() {
  return serverEnvSchema.parse(process.env);
}

export function getSupabaseServerEnv() {
  return supabaseServerEnvSchema.parse(process.env);
}

export function getEmailDeliveryEnv() {
  return emailDeliveryEnvSchema.parse(process.env);
}

export function getEmailWebhookEnv() {
  return emailWebhookEnvSchema.parse(process.env);
}

export function getEmailActionEnv() {
  return emailActionEnvSchema.parse(process.env);
}
