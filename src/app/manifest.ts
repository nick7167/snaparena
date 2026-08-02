import type { MetadataRoute } from "next";

/**
 * PWA manifest — what SNAP looks like installed to a home screen.
 *
 * `background_color` is ink-900 rather than ink-800 so the splash screen matches the
 * icon's own background and the app appears to grow out of it rather than cut against it.
 *
 * Two icon purposes, and both are needed: "any" is used as supplied, while "maskable"
 * gets cropped to whatever shape the platform prefers — Android can clip 20% from each
 * edge, which would take the chamfer off. The maskable file is built with the plate at
 * 60% so the safe zone holds it whole. Ship only "any" and Android letterboxes it inside
 * a white rounded square; ship only "maskable" and the plate looks lost on desktop.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SNAP",
    short_name: "SNAP",
    description: "One second of a song. Name it before they do.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e1017",
    theme_color: "#0e1017",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
