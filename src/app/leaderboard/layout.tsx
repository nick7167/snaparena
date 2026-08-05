import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Names the route; `page.tsx` is a client component and cannot. See daily/layout.tsx. */
export const metadata: Metadata = {
  title: "Ladder",
  description: "Every ranked player, in order.",
};

export default function LeaderboardLayout({ children }: { children: ReactNode }) {
  return children;
}
