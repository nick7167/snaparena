import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The room code is already in the URL, so this needs no lookup — which is the right
 * trade for a route whose links are pasted into a group chat and opened within minutes.
 *
 * `robots` is off deliberately: a room is a private match between people who were sent
 * the code, and it has no business being indexed.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;

  return {
    title: `Room ${code.toUpperCase()}`,
    description: "Join this private match on SNAP.",
    robots: { index: false, follow: false },
  };
}

export default function RoomLayout({ children }: { children: ReactNode }) {
  return children;
}
