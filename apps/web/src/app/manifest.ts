import type { MetadataRoute } from "next";

/** Home-screen install: name, icon and full-screen launch. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fitness App",
    short_name: "Fitness",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#f4f5f7",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
