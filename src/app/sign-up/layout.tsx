import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Names the route; `page.tsx` is a client component and cannot. See daily/layout.tsx. */
export const metadata: Metadata = {
  title: "Create your account",
  description: "Your scores go on the board, and your rating starts moving.",
  robots: { index: false, follow: true },
};

export default function SignUpLayout({ children }: { children: ReactNode }) {
  return children;
}
