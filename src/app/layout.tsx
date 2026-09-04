import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ORION",
  description: "Operating Response and Incident Orchestration Network",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
