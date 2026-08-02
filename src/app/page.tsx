import { auth } from "@clerk/nextjs/server";
import { Landing } from "./landing";
import { Hub } from "./hub";

/**
 * Home.
 *
 * Two entirely different jobs behind one route: a signed-in player gets a hub, a stranger
 * gets a single screen whose only purpose is to get them into today's challenge.
 *
 * THE CHOICE IS MADE ON THE SERVER, and that is load-bearing. The obvious implementation
 * — wrapping each half in `<SignedIn>`/`<SignedOut>` — does not work here. Those resolve
 * from `useUser()` on the client and render null until Clerk loads, so BOTH halves are
 * absent from the server-rendered HTML: crawlers, link previews and any JS-less client
 * saw an empty document, on the one page whose entire job is reaching people who have
 * never been here.
 *
 * `auth()` needs the Clerk proxy (src/proxy.ts) to be in place, which it now is. Before
 * that existed there was no server-side answer to "is this person signed in?", which is
 * why the previous version had to gate on the client and keep its pitch outside the gate
 * to compensate.
 *
 * The cost is that this route is server-rendered on demand rather than static. That is
 * correct for a page whose content depends on who is asking.
 */
export default async function Home() {
  const { userId } = await auth();

  return userId ? (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-12">
      <Hub />
    </div>
  ) : (
    <Landing />
  );
}
