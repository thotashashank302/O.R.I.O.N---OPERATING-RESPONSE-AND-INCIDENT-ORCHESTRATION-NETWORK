import type { UserContextResponse } from "@/contracts/identity";

export async function fetchAuthenticatedContexts(): Promise<UserContextResponse> {
  const response = await fetch("/api/me/contexts", {
    cache: "no-store",
    credentials: "same-origin",
  });
  const payload = (await response.json()) as {
    data?: UserContextResponse;
    error?: { message?: string };
  };
  if (!response.ok || !payload.data) {
    throw new Error(payload.error?.message ?? "Unable to load your campus access.");
  }
  return payload.data;
}
