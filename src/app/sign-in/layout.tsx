import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Names the route; `page.tsx` is a client component and cannot. See daily/layout.tsx. */
export const metadata: Metadata = {
  title: "Sign in",
  description: "Pick up your rating, your level and your streak.",
  // A sign-in form has nothing to offer a search result, and its `?redirect_url=`
  // variants would otherwise look like distinct pages.
  robots: { index: false, follow: true },
};

export default function SignInLayout({ children }: { children: ReactNode }) {
  return children;
}
