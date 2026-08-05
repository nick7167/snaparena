"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/ui/Button";
import { Card } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";

/**
 * The route error boundary.
 *
 * Until this existed, an uncaught render error landed on Next's default page: an unstyled
 * "Application error: a client-side exception has occurred", with no wordmark, no
 * navigation and no route back into the app.
 *
 * That is a live hazard rather than a theoretical one. Every game screen is a client
 * component subscribing to Convex queries, and several of those throw rather than
 * returning null — `requireUser` throws for an identity with no user row. The codebase
 * dodges this by hand in three places, each with a comment about the crash it prevents
 * (ranked/page.tsx, practice/page.tsx, queue-driver.tsx). Those guards are correct, but
 * they are one-at-a-time; this catches the class.
 *
 * Deliberately NOT `global-error.tsx`: that replaces the root layout, so it would render
 * without fonts, providers or the shell. This one keeps the chrome, which means the player
 * still has the sidebar and can leave under their own steam.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The only console write in the app, and it earns its place: without it a production
    // crash leaves nothing anywhere. `digest` is the id that ties this to the server log.
    console.error("Route error", error.digest ?? "", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-16">
      <Card className="flex flex-col items-start gap-4 p-6">
        <span className="text-signal-text text-2xl leading-none">
          <Glyph name="damage" filled />
        </span>

        <div className="flex flex-col gap-2">
          <h1 className="font-display text-display-2 font-extrabold">
            That screen broke
          </h1>
          <p className="text-body text-secondary">
            Something went wrong rendering this page. Nothing you did caused it, and
            nothing you have played is lost.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={reset}>Try again</Button>
          <ButtonLink variant="secondary" href="/">
            Go home
          </ButtonLink>
        </div>
      </Card>

      {/*
       * Named specifically, because it is the case that actually costs something.
       *
       * A duel lives on the server — the phase machine, the health, the round log. A client
       * crash does not end it, and `ranked.activeMatch` will put the player straight back
       * into it. Saying so is the difference between "I lost my match" and "I reloaded".
       */}
      <p className="text-body-sm text-muted">
        Were you in a duel?{" "}
        <a href="/ranked" className="text-secondary hover:text-paper rounded-xs underline">
          Rejoin it here
        </a>{" "}
        — the match is held on the server, so it is usually still waiting for you.
      </p>
    </div>
  );
}
