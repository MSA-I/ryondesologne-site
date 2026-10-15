# Rayon de Sologne - website source

Static website for Rayon de Sologne (domaine, manoir, auberge and bistrot du Grand Liot, Sologne, France).
Built with [Astro](https://astro.build) as a fully static site (no server code, no database). Content language: French.

## Build

```sh
npm install
npm run build      # writes the static site to dist/
npx astro preview  # serves dist/ locally
```

`npm run dev` starts the development server.

The optimised images are committed in `public/media/`. The build step `scripts/copy-assets.mjs` normally syncs them from an
`../05-assets` folder of the original working project; in this standalone repository that folder does not exist, so the script
skips the sync and keeps the committed `public/media/` as is.

## Deploy

Upload `dist/` to Cloudflare Pages (build command `npm run build`, output directory `dist`). Cloudflare Pages honours
`public/_redirects` (old URL to new URL, 301) and `public/_headers` (security headers), both copied into `dist/`.
`public/.htaccess` holds the same redirects for an Apache host.

The old single-photo pages of the wedding album are redirected with one wildcard rule
(`/album/photos-mariage/*` to `/album/photos-mariage/`); individual rules naming private persons were removed from this public repository.

## Client content placeholders

Some texts are not yet supplied by the client (legal details, privacy policy, a few contact lines). Their placeholders are
hidden: the constant `showPlaceholders` in `src/lib/site.ts` is `false`, and each place that holds a placeholder renders nothing
and keeps its marker text in the source. Set it to `true` to show them again, then replace each with the client's text.

## Notes

- `src/content/**` is imported scan data from the previous website. Private persons' names in image names and captions were
  replaced with `x` before publication.
- `omitted/`, `PLAN.md`, `progress.md` are working notes of the build.
