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
    "Request fixed-scope $49/$99/$199 public-data reviews or support evidence-first tooling. Non-custodial, with no recovery guarantees.",
  openGraph: {
    title: "Sentinel Recovery — Ethereum Evidence Services",
    description:
      "Fixed-scope Ethereum public-data services, voluntary support, and agent-safe payment contracts without custody or recovery guarantees.",
    type: "website",
    url: "https://terminallylazy.github.io/sentinel-recovery-support/",
  },
  twitter: {
    card: "summary",
    title: "Sentinel Recovery — Ethereum Evidence Services",
    description:
      "Request a $49/$99/$199 Ethereum evidence deliverable or support the public tooling.",
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
