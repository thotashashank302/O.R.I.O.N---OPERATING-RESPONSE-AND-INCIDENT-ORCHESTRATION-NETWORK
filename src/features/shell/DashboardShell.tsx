"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ContextSwitcher } from "@/features/identity/ContextSwitcher";
import { SignOutButton } from "@/features/auth/SignOutButton";

type NavItem = { label: string; href: string; icon: "overview" | "incident" | "people" | "work" | "evidence" | "settings" };

const ROLE_META = {
  principal: { label: "Principal", subtitle: "Institution governance" },
  admin: { label: "Administrator", subtitle: "Campus configuration" },
  hod: { label: "Head of Department", subtitle: "Operations oversight" },
  cr: { label: "Class Representative", subtitle: "Section coordination" },
  student: { label: "Student", subtitle: "Campus issue desk" },
  staff: { label: "Operations Staff", subtitle: "Assigned work" },
  transport: { label: "Transport", subtitle: "Route operations" },
  clubs: { label: "Club Coordinator", subtitle: "Club operations" },
} as const;

const ROLE_NAV: Record<keyof typeof ROLE_META, NavItem[]> = {
  principal: [
    { label: "Governance", href: "/principal", icon: "overview" },
    { label: "People & roles", href: "/principal#members", icon: "people" },
    { label: "Campus structure", href: "/principal#structure", icon: "settings" },
  ],
  admin: [
    { label: "Administration", href: "/admin", icon: "overview" },
    { label: "People & roles", href: "/admin#members", icon: "people" },
    { label: "Routing policy", href: "/admin#handlers", icon: "settings" },
  ],
  hod: [
    { label: "Operations", href: "/hod", icon: "overview" },
    { label: "Incident queue", href: "/hod#incidents", icon: "incident" },
    { label: "Approvals", href: "/hod#approvals", icon: "evidence" },
  ],
  cr: [
    { label: "Section desk", href: "/cr", icon: "overview" },
    { label: "Issue feed", href: "/cr#incidents", icon: "incident" },
    { label: "Verification", href: "/cr#verification", icon: "evidence" },
  ],
  student: [
    { label: "Campus desk", href: "/student", icon: "overview" },
    { label: "Issue feed", href: "/student#incidents", icon: "incident" },
    { label: "My reports", href: "/student#reports", icon: "work" },
  ],
  staff: [
    { label: "Work queue", href: "/staff", icon: "work" },
    { label: "Availability", href: "/staff#availability", icon: "people" },
    { label: "Evidence", href: "/staff#evidence", icon: "evidence" },
  ],
  transport: [
    { label: "Route desk", href: "/transport", icon: "overview" },
    { label: "Route issues", href: "/transport#incidents", icon: "incident" },
  ],
  clubs: [
    { label: "Club desk", href: "/clubs", icon: "overview" },
    { label: "Club issues", href: "/clubs#incidents", icon: "incident" },
  ],
};

function pathRole(pathname: string): keyof typeof ROLE_META {
  const segment = pathname.split("/").filter(Boolean)[0];
  return segment && segment in ROLE_META ? (segment as keyof typeof ROLE_META) : "student";
}

function NavIcon({ name }: { name: NavItem["icon"] }) {
  const paths = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    incident: <><path d="M12 3 2.8 19h18.4L12 3Z"/><path d="M12 9v4"/><path d="M12 16.5h.01"/></>,
    people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    work: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></>,
    evidence: <><path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 3.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2V9.6h.1A1.7 1.7 0 0 0 3.6 8a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8 3.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2h4v.1A1.7 1.7 0 0 0 15 3.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8c.16.38.37.72.6 1 .3.36.7.57 1.1.6h.1v4h-.1a1.7 1.7 0 0 0-1.7 1.4Z"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const role = pathRole(pathname);
  const meta = ROLE_META[role];
  const nav = ROLE_NAV[role];

  return (
    <div className="orion-dashboard">
      <aside className="orion-sidebar">
        <Link className="orion-wordmark" href={`/${role}`} aria-label="ORION dashboard">
          <span className="orion-mark"><span /></span>
          <span><strong>ORION</strong><small>Campus operations</small></span>
        </Link>

        <div className="orion-role-block">
          <span>Active workspace</span>
          <strong>{meta.label}</strong>
          <small>{meta.subtitle}</small>
        </div>

        <nav className="orion-nav" aria-label={`${meta.label} navigation`}>
          {nav.map((item) => {
            const active = item.href === pathname;
            return (
              <Link key={item.label} href={item.href} className={active ? "is-active" : undefined}>
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="orion-system-note">
          <span className="orion-status-dot" />
          <div><strong>Bounded orchestration</strong><small>Human verification enforced</small></div>
        </div>
      </aside>

      <div className="orion-workspace">
        <header className="orion-topbar">
          <div>
            <span>{meta.subtitle}</span>
            <strong>{meta.label} workspace</strong>
          </div>
          <div className="orion-topbar-actions">
            <ContextSwitcher />
            <SignOutButton />
          </div>
        </header>
        <main className="orion-dashboard-content">{children}</main>
      </div>
    </div>
  );
}
