"use client";

import { useEffect, useState } from "react";
import type { UserContextItem, UserContextResponse } from "@/contracts/identity";

const STORAGE_KEY = "orion.active-membership-id";
const CONTEXT_EVENT = "orion-context-change";

export function selectOrionContext(context: UserContextItem): void {
  window.localStorage.setItem(STORAGE_KEY, context.membership_id);
  document.cookie = "orion-membership=" + encodeURIComponent(context.membership_id) + "; Path=/; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
  window.dispatchEvent(new CustomEvent(CONTEXT_EVENT, { detail: context }));
}

export function useActiveContext() {
  const [contexts, setContexts] = useState<UserContextItem[]>([]);
  const [activeContext, setActiveContext] = useState<UserContextItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const choose = (items: UserContextItem[], fallback: UserContextItem | null | undefined) => {
      const selectedId = window.localStorage.getItem(STORAGE_KEY);
      return items.find((item) => item.membership_id === selectedId && item.membership_status === "active")
        ?? (fallback?.membership_status === "active" ? fallback : null)
        ?? items.find((item) => item.membership_status === "active")
        ?? null;
    };

    fetch("/api/me/contexts")
      .then(async (response) => {
        const payload = (await response.json()) as { data?: UserContextResponse; error?: { message?: string } };
        if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Unable to load membership context");
        return payload.data;
      })
      .then((payload) => {
        if (cancelled) return;
        setContexts(payload.contexts);
        setActiveContext(choose(payload.contexts, payload.active_context));
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load membership context");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const handleChange = (event: Event) => setActiveContext((event as CustomEvent<UserContextItem>).detail);
    window.addEventListener(CONTEXT_EVENT, handleChange);
    return () => {
      cancelled = true;
      window.removeEventListener(CONTEXT_EVENT, handleChange);
    };
  }, []);

  return { contexts, activeContext, loading, error };
}

export function orionContextHeaders(context: UserContextItem): HeadersInit {
  return {
    "x-orion-institution-id": context.institution_id,
    "x-orion-membership-id": context.membership_id,
  };
}
