import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Names the route; `page.tsx` is a client component and cannot.
 *
 * `robots` off: this is a per-account setup flow behind auth, and it has no business in
 * a search index.
 */
export const metadata: Metadata = {
  title: "Welcome",
  robots: { index: false, follow: false },
};

export default function WelcomeLayout({ children }: { children: ReactNode }) {
  return children;
}
