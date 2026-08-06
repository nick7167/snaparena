import { AdminGate } from "./gate";

/**
 * Operator screen: catalogue health, and who else can get in here.
 *
 * It used to be gated on `NODE_ENV === "production"` and nothing else, which made it a
 * developer-machine page rather than an operator page — the person who actually needs the
 * catalogue numbers is whoever runs the game, and they are looking at the deployed site.
 *
 * The guard is now the admin role, checked on the server for every request AND again by
 * every query this page calls. The server check is what keeps the page out of view; the
 * per-query checks are what keep the data safe, since a client can call a query directly
 * whatever the page decides to render.
 */
export default function AdminPage() {
  return <AdminGate />;
}
