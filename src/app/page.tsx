import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#06101b] text-white">
      <Image
        src="/images/orion-campus-login.webp"
        alt="Modern university operations campus at night"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,12,21,.5),rgba(4,12,21,.74)_58%,rgba(4,12,21,.96)),linear-gradient(90deg,rgba(4,12,21,.35),transparent_60%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1500px] flex-col px-6 py-7 sm:px-10 sm:py-9 lg:px-14">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-7 w-7 place-items-center border border-white/35 bg-black/20">
              <span className="h-1.5 w-1.5 rounded-full bg-[#63b5d7]" />
            </span>
            <span className="text-[12px] font-semibold uppercase tracking-[.2em]">ORION</span>
          </div>
          <Link href="/login" className="text-[10px] uppercase tracking-[.18em] text-white/65 underline decoration-white/30 underline-offset-8 hover:text-white">
            Skip to sign in
          </Link>
        </header>

        <section className="my-auto max-w-5xl py-16">
          <p className="mb-5 text-[10px] uppercase tracking-[.22em] text-[#8dc7df]">Campus incident orchestration</p>
          <h1 className="font-[Georgia] text-[clamp(4.6rem,13vw,11rem)] font-normal leading-[.78] tracking-[-.04em]">O.R.I.O.N</h1>
          <p className="mt-8 max-w-2xl font-[Georgia] text-xl leading-relaxed text-white/82 sm:text-2xl">
            Operating Response and Incident Orchestration Network
          </p>
          <p className="mt-5 max-w-xl text-sm leading-6 text-white/62">
            Authorized reporting, bounded AI coordination, accountable staff action, and human-grounded verification in one campus operations system.
          </p>
          <Link href="/login" className="mt-10 inline-flex min-h-12 items-center gap-8 bg-[#78bdd9] px-6 text-sm font-semibold text-[#06101b] shadow-[0_16px_40px_rgba(0,0,0,.25)] transition hover:bg-[#91cee5]">
            Enter operations <span aria-hidden="true">→</span>
          </Link>
        </section>

        <footer className="flex flex-col gap-3 border-t border-white/18 pt-5 text-[10px] uppercase tracking-[.15em] text-white/50 sm:flex-row sm:items-center sm:justify-between">
          <span>Four bounded agents · One accountable incident record</span>
          <span>Human verification remains authoritative</span>
        </footer>
      </div>
    </main>
  );
}
