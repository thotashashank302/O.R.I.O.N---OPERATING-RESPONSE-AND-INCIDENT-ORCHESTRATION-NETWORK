import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'O.R.I.O.N — Operating Response and Incident Orchestration Network',
  description: 'Autonomous multi-agent college campus incident response and coordination network',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 antialiased">{children}</body>
    </html>
  );
}
