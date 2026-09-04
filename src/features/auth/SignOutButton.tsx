"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/features/auth/supabase-browser";

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        await createSupabaseBrowserClient().auth.signOut();
        window.localStorage.removeItem("orion.active-membership-id");
        router.replace("/login");
        router.refresh();
      }}
      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-all border border-slate-700 disabled:opacity-50"
    >
      {loading ? "Signing Out…" : "Sign Out"}
    </button>
  );
}
