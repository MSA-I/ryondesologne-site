# Security headers, rayondesologne-fr (T39)

The build ships a CSP `<meta>` (SecurityMeta.astro, read by every page) and `public/_headers` (copied to the root of `dist/`).
`_headers` is read as is by Netlify and Cloudflare Pages. Other hosts: paste the values below into the host's own header settings
(Apache `Header always set`, nginx `add_header ... always`, Vercel `vercel.json` `headers`, etc.).
A meta tag cannot carry HSTS, frame-ancestors, X-Content-Type-Options, Referrer-Policy or Permissions-Policy: these must be real response headers.
After going live, check the answered headers on the real host (not the source files), e.g. `curl -sI https://www.rayondesologne.fr/`.

## Headers (in `_headers`, block `/*`)

| Header | Value | Why |
|---|---|---|
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` | Browsers use HTTPS only for a year. Add `preload` only if Moshe confirms every subdomain of rayondesologne.fr serves HTTPS (it is a one-way list submission). Set it only once the host serves HTTPS with a valid certificate. |
| X-Content-Type-Options | `nosniff` | A file is used only as the type the host says; no script from a mislabeled upload. |
| Referrer-Policy | `strict-origin-when-cross-origin` | Other sites (Zenchef, Instagram, planner...) receive only the origin, not the page path. |
| Permissions-Policy | `geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()` | The site uses none of these features; the planner cannot request them either. |
| Content-Security-Policy | `frame-ancestors 'self'` | Nobody else can frame the site (clickjacking). It is its own header here because a CSP meta ignores `frame-ancestors`. Browsers combine it with the meta CSP (both apply). |
| X-Frame-Options | `SAMEORIGIN` | Same protection for old browsers. |
| Cross-Origin-Opener-Policy | `same-origin-allow-popups` | Isolates the page from windows that open it, while the Zenchef / mariages.net new-tab links and any planner popup keep working. |

Caching (same file):

| Path | Cache-Control | Why |
|---|---|---|
| `/_astro/*` | `public, max-age=31536000, immutable` | File names carry a content hash. |
| `/fonts/*` | `public, max-age=31536000, immutable` | Self-hosted woff2, versioned file names (`-latin-1`, `-latin-3`). If a font file is replaced, rename it. |
| `/media/*` | `public, max-age=2592000` | Deviation from PLAN (immutable): image names are not hashed, so a replaced photo would stay stale for a year. 30 days. |
| `/medias/*` | `public, max-age=2592000` | Old client paths, PDFs. |
| `/site.webmanifest` | `Content-Type: application/manifest+json` | Correct type for hosts that do not guess it. |

## CSP (meta, one per page, built from `src/content/embeds/_origins.json`)

```
default-src 'self';
script-src 'self' https://www.googletagmanager.com https://gadget.open-system.fr https://*.for-system.com;
connect-src 'self' https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com https://gadget.open-system.fr https://*.for-system.com;
img-src 'self' data: https://www.googletagmanager.com https://*.google-analytics.com https://gadget.open-system.fr;
style-src 'self' 'unsafe-inline' https://gadget.open-system.fr;
font-src 'self' https://gadget.open-system.fr;
frame-src https://gadget.open-system.fr;
base-uri 'self'; form-action 'self' mailto:; object-src 'none'; upgrade-insecure-requests
```

- No inline script anywhere: the build has no `<script>` without `src` (JSON data blocks aside, which CSP does not treat as script) and no inline event handler. `unsafe-eval` is not needed.
- `style-src 'unsafe-inline'`: the client planner injects style attributes and style tags; the site's own CSS is external files.
- GA4 (`www.googletagmanager.com`, `*.google-analytics.com`) is requested only after the visitor accepts cookies (`src/scripts/ga4.js`); listing the hosts does not load anything before consent.
- `https://*.for-system.com`: the planner (idIntegration 646) calls its back end through JSONP scripts (`etape-rest`, `quota`, `centrevaldeloire-mb-prestataire`.for-system.com). `_origins.json` lists only what the markup names; these were found by running the built pages under this CSP in a browser. If the planner vendor adds another host, a planner page logs a CSP error and SecurityMeta.astro (`PLANNER_API`) gets the new origin.
- `upgrade-insecure-requests`: the planner's theme CSS names one image over `http://gadget.open-system.fr/...`; it is upgraded to HTTPS.
- External links (Zenchef, Matterport, mariages.net, Pinterest, Calameo, Google, Instagram, Facebook) are navigation: no CSP entry.
- `form-action 'self' mailto:`: the contact and newsletter forms send through the client's existing channel (T13); if that channel is an https endpoint on another host, add it here.

## Third-party scripts without SRI

Subresource Integrity needs a fixed file. These are unversioned, vendor-updated files, so SRI would break the site at the next vendor update:
- `https://www.googletagmanager.com/gtag/js?id=G-4VN4372P6E` (GA4, after consent only)
- `https://gadget.open-system.fr/widgets-libs/rel/noyau-1.0.min.js` (planner, loaded when its box nears the viewport)

Everything else is self-hosted (fonts, images, scripts).

## Host notes

- Extensionless `/newsletters/subscribe/` is built as a folder with `index.html`; hosts need their default "pretty URLs" / directory index setting on. Pages like `/pages/le-restaurant.html` keep their `.html` to match the old URLs.
- The planner's theme CSS requests `/widgets/themes/...` from its own host `gadget.open-system.fr` on the live site. On `localhost` it asks `http://localhost/widgets/...` (vendor developer mode), which the CSP blocks: that is a local-test artifact only (checked in the vendor script, see progress.md), not a live problem. Confirm on the real host.

## Verification done (T39)

- `npx astro build --outDir ../.tmp-build/T39`: 114 pages, each with the CSP meta; no inline `<script>` without `src`, no `on*=` handlers, no `.map` files, no `console.log`/`debugger`/`document.write` in built JS, no duplicate ids, no `<button>` inside `<a>`, every `target="_blank"` link has `noopener`, doctype and charset first on every page.
- `npm audit --omit=dev`: found 0 vulnerabilities.
- Browser run (Chromium, local static server sending the `_headers` `/*` block plus the meta CSP, cookies accepted, page scrolled): `/`, `/pages/le-restaurant.html`, `/contact/contact.html`: no CSP violation, GA4 script injected. `/pages/reservations.html` (5 planners) and `/pages/le-manoir-du-grand-liot.html`: planners reach state `ready`, only the `localhost/widgets` artifact above is blocked.
- Skill check scripts (`check-web-best`, `check-static`) are deferred per Moshe (progress.md, 2026-10-14).
- Not tested: the deployed host's actual response headers (needs the real host).
