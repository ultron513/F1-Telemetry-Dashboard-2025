import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Pit Wall — F1 Telemetry Dashboard",
    short_name: "Pit Wall",
    description:
      "Formula 1 telemetry, strategy, race-control replays and championship analysis for every session from 2023 to 2026.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "any",
    background_color: "#0b0d11",
    theme_color: "#0b0d11",
    categories: ["sports", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Telemetry", url: "/telemetry", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Race control replay", url: "/race-control", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Standings", url: "/standings", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
