import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://terminallylazy.github.io/sentinel-recovery-support/",
  ),
  title: "Support Sentinel Recovery",
  description:
    "Fund evidence-first Ethereum mistake triage, public safety boundaries, and agent-safe handoffs without recovery guarantees.",
  openGraph: {
    title: "Support Sentinel Recovery",
    description:
      "Voluntary Ethereum Mainnet support for evidence-first recovery research and agent-safe public infrastructure.",
    type: "website",
    url: "https://terminallylazy.github.io/sentinel-recovery-support/",
  },
  twitter: {
    card: "summary",
    title: "Support Sentinel Recovery",
    description:
      "Fund evidence-first Ethereum mistake triage without recovery guarantees.",
  },
  alternates: {
    canonical: "https://terminallylazy.github.io/sentinel-recovery-support/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${mono.variable}`}>{children}</body>
    </html>
  );
}
