import { ImageResponse } from "next/og";
import { DAILY_SONGS } from "@/engine/config";

/**
 * Social card for the daily challenge — the link people actually share.
 *
 * Static rather than per-result. Showing someone's score in the preview would need the
 * result encoded in the URL plus a Convex read during image generation; that is a
 * feature, not a polish pass. This still takes a shared link from no preview at all to
 * a real card.
 *
 * Same colour caveat as the root card: Satori cannot read the token layer, so these hex
 * values are copies of the Pressing palette and must be updated alongside globals.css.
 */

export const alt = `SNAP — today's challenge. ${DAILY_SONGS} songs, the same ${DAILY_SONGS} for everyone.`;
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
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 44,
              height: 44,
              background: "#F4F1EA",
              clipPath: "polygon(22% 0, 100% 0, 100% 78%, 78% 100%, 0 100%, 0 22%)",
            }}
          />
          <div style={{ fontSize: 44, fontWeight: 800, color: "#F4F1EA", letterSpacing: -1 }}>
            SNAP
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              color: "#F0B429",
              letterSpacing: 4,
            }}
          >
            TODAY&rsquo;S CHALLENGE
          </div>
          <div
            style={{
              fontSize: 92,
              fontWeight: 800,
              color: "#F4F1EA",
              lineHeight: 1.05,
              letterSpacing: -3,
            }}
          >
            {`${DAILY_SONGS} songs. One second each.`}
          </div>
          <div style={{ fontSize: 36, color: "#7A8398" }}>
            {`The same ${DAILY_SONGS} for everyone, everywhere, today.`}
          </div>
        </div>

        {/* The result grid people paste when they share — the shape of the game. */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {["#F4F1EA", "#F0B429", "#F4F1EA", "#1D2230", "#F0B429"].map((fill, index) => (
            <div
              key={index}
              style={{ width: 64, height: 64, background: fill, borderRadius: 8 }}
            />
          ))}
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 30, color: "#7A8398" }}>No account needed</div>
        </div>
      </div>
    ),
    size,
  );
}
