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
  title: "Sentinel Recovery — Ethereum Evidence Services",
  description:
    "Request a fixed-scope $750 public Node/TypeScript release-blocker reproduction with a 24-hour target, no meeting, and public inputs only.",
  openGraph: {
    title: "Sentinel Recovery — Ethereum Evidence Services",
    description:
      "A $750 public Node/TypeScript release-blocker reproduction with a 24-hour target, plus fixed-scope evidence services and agent-safe payment boundaries.",
    type: "website",
    url: "https://terminallylazy.github.io/sentinel-recovery-support/",
  },
  twitter: {
    card: "summary",
    title: "Sentinel Recovery — Ethereum Evidence Services",
    description:
      "Turn one public Node/TypeScript release blocker into a deterministic reproducer or source-pinned dossier for $750.",
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
