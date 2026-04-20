import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Семейное дерево",
    short_name: "Дерево",
    description: "Редактор семейного дерева для семьи.",
    display: "standalone",
    background_color: "#121816",
    theme_color: "#121816",
    start_url: "/",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
