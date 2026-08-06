import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Names the route; `page.tsx` is a client component and cannot. See daily/layout.tsx.
 *
 * A visitor is only ever here for the half-second an OAuth redirect takes to settle, but
 * the tab title is what a browser writes into history — and "SNAP" for a screen nobody
 * chose to visit made the back stack unreadable.
 */
export const metadata: Metadata = {
  title: "Signing you in",
  robots: { index: false, follow: false },
};

export default function SsoCallbackLayout({ children }: { children: ReactNode }) {
  return children;
}
