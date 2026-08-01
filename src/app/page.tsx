import Link from "next/link";
import { REVEAL_BEATS, SCORE_TIERS, SETS_TO_WIN, SONGS_PER_SET } from "@/engine/config";

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-14 px-4 py-20">
      <section className="flex flex-col gap-5">
        <h1 className="text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl">
          One second of a song.
          <br />
          <span className="bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent">
            Name it before they do.
          </span>
        </h1>
        <p className="max-w-xl text-lg text-white/60">
          Best of {SETS_TO_WIN + 1} sets, {SONGS_PER_SET} songs a set. The clip grows the
          longer you take — and so does everyone else&rsquo;s chance to beat you to it.
        </p>

        <div className="mt-2 flex flex-wrap gap-3">
          <Link
            href="/daily"
            className="rounded-lg bg-gradient-to-r from-cyan-400 to-fuchsia-500 px-6 py-3
                       font-semibold text-black transition hover:brightness-110"
          >
            Play today&rsquo;s challenge
          </Link>
          <Link
            href="/ranked"
            className="rounded-lg border border-white/20 px-6 py-3 font-semibold
                       transition hover:bg-white/10"
          >
            Ranked 1v1
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xs uppercase tracking-[0.3em] text-white/40">Score by tier</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SCORE_TIERS.map((tier, index) => (
            <div
              key={tier.id}
              className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/5 p-4"
            >
              <span className="text-sm font-bold tracking-wider text-cyan-300">
                {tier.id === "snap" && "⚡ "}
                {tier.label}
              </span>
              <span className="text-2xl font-black tabular-nums">{tier.points}</span>
              <span className="text-xs text-white/40">
                on the {REVEAL_BEATS[index].playToMs / 1000}s clip
              </span>
            </div>
          ))}
        </div>
        <p className="text-sm text-white/40">
          Guess on the one-second clip and it&rsquo;s a SNAP — the only call worth bragging
          about. Wait for more of the song and it costs you.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-[0.3em] text-white/40">How a round runs</h2>
        <ol className="flex flex-col gap-2 text-white/70">
          {REVEAL_BEATS.map((beat, index) => (
            <li key={beat.atRoundMs} className="flex gap-4">
              <span className="w-14 shrink-0 tabular-nums text-white/30">
                {beat.atRoundMs / 1000}s
              </span>
              <span>
                {index === 0
                  ? `You hear the first ${beat.playToMs / 1000} second`
                  : `The clip grows to ${beat.playToMs / 1000} seconds`}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
