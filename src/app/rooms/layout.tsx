import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Names the route; `page.tsx` is a client component and cannot. See daily/layout.tsx.
 *
 * Applies to `/rooms/[code]` too, which overrides the title with the room's own code —
 * a nested layout inherits everything it does not restate.
 */
export const metadata: Metadata = {
  title: "Rooms",
  description: "Private matches with friends. Last one standing, no rating at stake.",
};

export default function RoomsLayout({ children }: { children: ReactNode }) {
  return children;
}
