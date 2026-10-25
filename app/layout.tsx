import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { SiteNav, SiteNavFallback } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { getViewer } from "@/lib/auth";
import { venue } from "@/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${venue.name} | Your next game starts here`, template: `%s | ${venue.name}` },
  description: "Your next game starts at StarApple. Choose a pickleball court, pick your time, and pay when you play. All times in Manila time.",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#18211e",
};
async function Navigation() { const viewer = await getViewer(); return <SiteNav signedIn={Boolean(viewer)} admin={Boolean(viewer?.profile?.is_admin)} />; }
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body><a className="skip-link" href="#main">Skip to content</a><Suspense fallback={<SiteNavFallback />}><Navigation /></Suspense><main id="main">{children}</main><SiteFooter /></body>
    </html>
  );
}
