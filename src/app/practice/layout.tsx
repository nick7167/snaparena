import type { Metadata } from "next";
import type { ReactNode } from "react";

/** Names the route; `page.tsx` is a client component and cannot. See daily/layout.tsx. */
export const metadata: Metadata = {
  title: "Practice",
  description: "Duel a bot. XP and badges count, rating never moves.",
};

export default function PracticeLayout({ children }: { children: ReactNode }) {
  return children;
}
