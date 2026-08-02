import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Clerk's request interceptor.
 *
 * Named `proxy`, not `middleware`: Next 16 deprecated the `middleware` file convention
 * and renamed it to `proxy`. Same contract, same matcher, and `clerkMiddleware()` keeps
 * its own name because it is Clerk's export rather than Next's convention.
 *
 * The app ran without any of this while auth was entirely client-side and every sign-in
 * happened in Clerk's hosted modal. Custom sign-in and sign-up routes need it: it is what
 * makes `auth()` available on the server and what lets Clerk resolve its own redirect
 * URLs to our routes.
 *
 * Deliberately does NOT protect anything. Every route in this app is publicly reachable —
 * ranked and rooms gate on `<SignedIn>` in the page itself, and the daily is open to
 * anonymous players by design. Adding route protection here would wall off the daily,
 * which is the one surface a stranger is supposed to be able to use.
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Everything except Next's internals and static assets. The negative lookahead on
    // file extensions is what keeps the emblem PNGs and the audio off this path — they
    // are the heaviest requests in the app and none of them need a session.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp3|m4a|ogg|wav)).*)",
    // API and tRPC routes always run it.
    "/(api|trpc)(.*)",
  ],
};
