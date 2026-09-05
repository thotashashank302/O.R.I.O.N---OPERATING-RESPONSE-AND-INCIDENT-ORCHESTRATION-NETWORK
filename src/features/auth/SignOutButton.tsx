"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {error ? <span role="alert" className="text-xs text-red-300">{error}</span> : null}
      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          try {
            const response = await fetch("/api/auth/logout", { method: "POST" });
            if (!response.ok) throw new Error("Sign-out failed. Please try again.");
            window.localStorage.removeItem("orion.active-membership-id");
            document.cookie = "orion-membership=; Path=/; Max-Age=0; SameSite=Lax";
            router.push("/login");
          } catch (signOutError) {
            setError(signOutError instanceof Error ? signOutError.message : "Sign-out failed. Please try again.");
          } finally {
            setLoading(false);
          }
        }}
        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-all border border-slate-700 disabled:opacity-50"
      >
        {loading ? "Signing Out…" : "Sign Out"}
      </button>
    </div>
  );
}
