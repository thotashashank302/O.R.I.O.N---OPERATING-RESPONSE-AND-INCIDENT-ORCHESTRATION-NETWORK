import { AcknowledgementForm } from "./acknowledgement-form";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Acknowledge assignment · ORION", referrer: "no-referrer", robots: { index: false, follow: false } };

export default async function EmailActionConfirmPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const value = (await searchParams).token;
  const token = typeof value === "string" ? value : "";
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-16">
      <section className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-6 shadow-2xl shadow-black/20 sm:p-10" aria-labelledby="action-title">
        <h1 id="action-title" className="text-3xl font-semibold tracking-tight text-slate-50">Acknowledge your assignment</h1>
        <p className="mt-4 leading-7 text-slate-300">This page does not reveal incident details. Confirmation succeeds only for the intended signed-in member while the single-use link and assignment version remain valid.</p>
        {token ? <AcknowledgementForm token={token} /> : <p role="alert" className="mt-6 rounded-md border border-red-800 bg-red-950/40 p-4 text-sm text-red-200">The action link is missing or incomplete.</p>}
      </section>
    </main>
  );
}
