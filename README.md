# Écoute Moi

Official public website for the voice-first dating application, 18+.

**Слушать. Слышать. Видеть.**

## Stack
React, TypeScript, Vite, static HTML route generation, GitHub Pages. Node.js 24 LTS and npm are required. No application backend, trackers, authentication or user-data collection.

## Development
```sh
npm ci
npm run dev
```
On Windows PowerShell use `npm.cmd` instead of `npm` if script execution is restricted.

## Build and preview
```sh
npm run check
npm run preview
```
Open http://127.0.0.1:4173. `build` produces a noindex preview; `build:production` produces the production artifact. Neither command publishes a website.

Set `SITE_BASE=/ecoutemoi-site/` for project Pages; use `/` for the apex domain. `SITE_ORIGIN` sets preview metadata origin. Production uses https://ecoutemoi.ru and rejects non-root base paths.

## Structure
- `src/`: React components, product copy, styles and design tokens.
- `public/`: vector brand mark and social preview image.
- `scripts/`: rendering, preview server and QA.
- `docs/`: architecture, security and deployment instructions.
- `.github/workflows/`: verified build and Pages deployment.

## Verification
`npm run check` runs ESLint, TypeScript, build and static checks. `npm run qa` uses installed Microsoft Edge for responsive layouts, axe accessibility, links, keyboard controls, no-JS content and 404 checks. See `qa/README.md` for Lighthouse commands. QA artifacts and private owner-review notes are excluded from Git.

## Publishing
The owner approved this first website release on 13 September 2026. See `docs/DEPLOYMENT.md` and `docs/DNS_SETUP.md`. Publication is controlled by repository variables and the `github-pages` environment. Domain settings and DNS are managed separately from the build.

Legal documents and the external support contact remain in preparation. No unconfirmed store links, launch dates, subscription prices or features are published.
