import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Names the route; `page.tsx` is a client component and cannot. See daily/layout.tsx. */
export const metadata: Metadata = {
  title: "Settings",
  /**
   * Kept out of search results and link previews. Nothing here is secret, but an account
   * page is not a destination anyone should arrive at from a search engine.
   */
  robots: { index: false, follow: false },
};

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
