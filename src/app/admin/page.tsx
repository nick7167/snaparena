import { notFound } from "next/navigation";
import { AdminDashboard } from "./dashboard";

/**
 * Catalogue health — dev only.
 *
 * `tracks.stats` was built and never called. It answers the question that actually
 * blocks play: is there enough music? A thin difficulty tier means matches start
 * repeating tracks, which is invisible until players notice they've had a song twice.
 *
 * Same guard as /design. This is operational data and does not belong on the public
 * site, and the query reads up to 5,000 rows per call.
 */
export default function AdminPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AdminDashboard />;
}
