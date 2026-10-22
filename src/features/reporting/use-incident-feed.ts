"use client";
import { useCallback, useEffect, useState } from "react";
import type { UserContextItem } from "@/contracts/identity";
import type { IncidentSummaryProps } from "./components/IncidentCard";
import { orionContextHeaders } from "@/features/identity/use-active-context";

type Incident = IncidentSummaryProps["incident"];
export function useIncidentFeed(context: UserContextItem | null) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const read = useCallback(async (cursor?: string | null, signal?: AbortSignal) => {
    if (!context) return { incidents: [] as Incident[], nextCursor: null };
    const response = await fetch(`/api/incidents${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { headers: orionContextHeaders(context), signal });
    const payload = await response.json();
    if (!response.ok || !payload.data?.incidents) throw new Error(payload.error?.message ?? "Unable to load the incident feed");
    return payload.data as { incidents: Incident[]; nextCursor: string | null };
  }, [context]);
  useEffect(() => {
    const controller = new AbortController();
    read(null, controller.signal).then(page => { if (controller.signal.aborted) return; setIncidents(page.incidents); setNextCursor(page.nextCursor); setFeedError(null); })
      .catch(error => { if (!controller.signal.aborted) setFeedError(error instanceof Error ? error.message : "Unable to load incidents"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [read]);
  const load = async (append: boolean) => {
    setLoading(true);
    try {
      const page = await read(append ? nextCursor : null);
      setIncidents(previous => append ? [...new Map([...previous, ...page.incidents].map(item => [item.id, item])).values()] : page.incidents);
      setNextCursor(page.nextCursor); setFeedError(null);
    } catch (error) { setFeedError(error instanceof Error ? error.message : "Unable to load incidents"); }
    finally { setLoading(false); }
  };
  return { incidents, loading, feedError, nextCursor, loadIncidents: () => load(false), loadMore: () => load(true) };
}
