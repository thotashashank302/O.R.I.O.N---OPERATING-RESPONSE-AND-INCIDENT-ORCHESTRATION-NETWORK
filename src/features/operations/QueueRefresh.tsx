"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Refresh display only. The server scheduler performs background work. */
export function QueueRefresh() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = window.setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [router]);
  return null;
}
