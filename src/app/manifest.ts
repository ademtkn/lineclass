import type { MetadataRoute } from "next";

/** Telefonda "Ana ekrana ekle" için uygulama adı ve simgesi. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LineClass",
    short_name: "LineClass",
    start_url: "/",
    display: "standalone",
    background_color: "#05080d",
    theme_color: "#1a5a8a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
