"use client";

import { useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "./supabase-browser";
import styles from "@/app/(auth)/login/login.module.css";

export function PasswordRecovery({ reset = false }: { reset?: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (reset && password !== confirmation) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      const client = createSupabaseBrowserClient();
      if (reset) {
        const { data, error: sessionError } = await client.auth.getUser();
        if (sessionError || !data.user) throw new Error("This recovery link has expired or is invalid. Request a new link.");
        const { error: updateError } = await client.auth.updateUser({ password });
        if (updateError) throw updateError;
        const { error: signOutError } = await client.auth.signOut({ scope: "local" });
        if (signOutError) throw new Error("Password updated. Please sign out before signing in with your new password.");
        setMessage("Password updated. You can now sign in with your new password.");
      } else {
        const { error: requestError } = await client.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (requestError) throw requestError;
        setMessage("If an account exists for this email, you’ll receive a password reset link. Open it in this browser.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to complete this request. Please try again.");
    } finally { setBusy(false); }
  }

  const field = "mt-2 w-full rounded-md border border-[#575147] bg-[#22211e] px-4 py-3 text-[#eee6d9]";
  return <main className={`${styles.login} grid min-h-screen place-items-center bg-[#191816] p-6 text-[#eee6d9]`}>
    <section className="w-full max-w-md">
      <Link href="/login" className="text-sm text-[#c8b38f] underline underline-offset-4">Back to sign in</Link>
      <h1 className="mt-8 font-[Georgia] text-3xl">{reset ? "Choose a new password" : "Reset your password"}</h1>
      <p className="mt-3 text-sm leading-relaxed text-[#b4aea3]">{reset ? "Use at least 12 characters for your new password." : "Enter your institutional email to request a recovery link."}</p>
      {message ? <p role="status" className="mt-6 rounded-md border border-[#575147] p-4 text-sm">{message}</p> :
        <form onSubmit={submit} className="mt-6 space-y-5">
          {reset ? <>
            <label className="block text-sm">New password<input type="password" autoComplete="new-password" minLength={12} maxLength={256} required value={password} onChange={e => setPassword(e.target.value)} className={field} /></label>
            <label className="block text-sm">Confirm password<input type="password" autoComplete="new-password" minLength={12} maxLength={256} required value={confirmation} onChange={e => setConfirmation(e.target.value)} className={field} /></label>
          </> : <label className="block text-sm">Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} className={field} /></label>}
          <button disabled={busy} className="w-full rounded-md bg-[#c8b38f] px-4 py-3 font-semibold text-[#211e19] hover:bg-[#dcc9a9] disabled:opacity-50">{busy ? "Please wait…" : reset ? "Save new password" : "Send reset link"}</button>
        </form>}
      {error && <p role="alert" className="mt-4 text-sm text-red-300">{error} {reset && <Link href="/forgot-password" className="underline">Request a new link</Link>}</p>}
    </section>
  </main>;
}
