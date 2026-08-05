import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Names the route; `page.tsx` is a client component and cannot. See daily/layout.tsx. */
export const metadata: Metadata = {
  title: "Ranked",
  description:
    "One rating. Six tiers. The faster player takes the round, and everybody can see where you landed.",
};

export default function RankedLayout({ children }: { children: ReactNode }) {
  return children;
}
