import { ButtonLink } from "@/ui/Button";
import { Card } from "@/ui/Surface";
import { Glyph } from "@/ui/Glyph";

/**
 * 404.
 *
 * The app previously fell through to Next's default, which is the only screen in the
 * product carrying none of its chrome — no wordmark, no navigation, no way back except the
 * browser's own controls.
 *
 * A server component, unlike `error.tsx`: there is nothing to catch and nothing to reset,
 * so this renders as static HTML and costs nothing.
 *
 * Reached by a mistyped URL, a stale link, and by `notFound()` — which /design and /admin
 * both call in production, so this is also what a poking visitor sees there.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-16">
      <Card className="flex flex-col items-start gap-4 p-6">
        <span className="text-muted text-2xl leading-none">
          <Glyph name="song" />
        </span>

        <div className="flex flex-col gap-2">
          <h1 className="font-display text-display-2 font-extrabold">
            Nothing here
          </h1>
          <p className="text-body text-secondary">
            That page does not exist, or it has been taken down.
          </p>
        </div>

        {/* Three real destinations rather than a lone "go home". Someone who mistyped a
            profile or a room code wants to get back to playing, not to a landing page. */}
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/">Go home</ButtonLink>
          <ButtonLink variant="secondary" href="/daily">
            <Glyph name="tier" filled />
            Today&rsquo;s challenge
          </ButtonLink>
          <ButtonLink variant="secondary" href="/leaderboard">
            Ladder
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
