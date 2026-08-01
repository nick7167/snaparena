import { ImageResponse } from "next/og";

/**
 * Social card for the site root.
 *
 * NOTE ON COLOURS: this file cannot use the design tokens. ImageResponse renders
 * through Satori, which supports a flexbox subset of CSS and none of Tailwind's
 * generated classes or CSS custom properties. The hex values below are copies of the
 * Pressing palette from globals.css and are a genuine second source of truth — if the
 * palette changes, change them here too.
 *
 *   --ink-900  #0E1017      --paper  #F4F1EA
 *   --ink-700  #1D2230      --gold   #F0B429
 *   --muted    #7A8398
 */

export const alt = "SNAP — one second of a song. Name it before they do.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0E1017",
          padding: 80,
        }}
      >
        {/* Wordmark: the same chamfered mark as the rank emblem, drawn with clipPath
            because Satori has no SVG-in-CSS support. */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 44,
              height: 44,
              background: "#F4F1EA",
              clipPath: "polygon(22% 0, 100% 0, 100% 78%, 78% 100%, 0 100%, 0 22%)",
            }}
          />
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              color: "#F4F1EA",
              letterSpacing: -1,
            }}
          >
            SNAP
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 88,
              fontWeight: 800,
              color: "#F4F1EA",
              lineHeight: 1.05,
              letterSpacing: -3,
            }}
          >
            One second of a song.
          </div>
          <div
            style={{
              fontSize: 88,
              fontWeight: 800,
              color: "#7A8398",
              lineHeight: 1.05,
              letterSpacing: -3,
            }}
          >
            Name it before they do.
          </div>
        </div>

        {/* A waveform strip, echoing the guessing screen's spine. Solid bars are the
            unlocked second; dim bars are the rest of the song. */}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 72 }}>
          {BARS.map((height, index) => (
            <div
              key={index}
              style={{
                width: 14,
                height: `${height}%`,
                background: index < 12 ? "#F4F1EA" : "#1D2230",
              }}
            />
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 30, color: "#F0B429", fontWeight: 700 }}>
            Play today&rsquo;s challenge
          </div>
        </div>
      </div>
    ),
    size,
  );
}

/** Fixed, not random — the image is statically generated and must be deterministic. */
const BARS = [
  18, 34, 62, 88, 54, 30, 46, 72, 96, 60, 38, 22, 30, 48, 70, 52, 34, 20, 28, 44, 66, 40,
  26, 16, 24, 38, 56, 34, 20, 14,
];
