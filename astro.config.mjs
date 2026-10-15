import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://www.rayondesologne.fr",
  output: "static",
  trailingSlash: "ignore",
  build: {
    format: "preserve",
    inlineStylesheets: "never",
  },
  vite: {
    build: { assetsInlineLimit: 0 },
  },
});
