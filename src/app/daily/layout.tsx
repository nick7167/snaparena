import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Exists only to name the route.
 *
 * `page.tsx` is a client component and cannot export `metadata`, so the title lives here.
 * The layout adds no markup — it returns its children untouched.
 */
export const metadata: Metadata = {
  title: "Today's challenge",
  description:
    "Five songs. Everyone in the world gets the same five today. One attempt, no account needed.",
};

export default function DailyLayout({ children }: { children: ReactNode }) {
  return children;
}
