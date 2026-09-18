# Écoute Moi

Official public website for the voice-first dating application, 18+.

**Слушать. Слышать. Видеть.**

## Stack
React, TypeScript, Vite, static HTML route generation, GitHub Pages. Node.js 24 LTS and npm are required. The public site has no application backend, trackers, authentication or user-data collection; its header links to the separate web app (личный кабинет) at https://app.ecoutemoi.ru.

The web app lives in `app/` as an independent Vite build with its own dependencies — see `app/README.md` and `docs/WEB_APP_DEPLOYMENT.md`.

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

Set `SITE_BASE=/ecoutemoi-site/` for project Pages; use `/` for the apex domain. `SITE_ORIGIN` sets preview metadata origin. Production uses https://ecoutemoi.ru and rejects non-root base paths. `APP_URL` (preview builds only) changes the Личный кабинет link target, e.g. `APP_URL=http://127.0.0.1:5174`; production always links to https://app.ecoutemoi.ru/. In `npm run dev`, `VITE_APP_URL` does the same.

## Structure
- `src/`: React components, product copy, styles and design tokens.
- `public/`: vector brand mark and social preview image.
- `scripts/`: rendering, preview server and QA.
- `docs/`: architecture, security and deployment instructions.
- `.github/workflows/`: verified build and Pages deployment (`pages.yml`), web app verification (`app.yml`).
- `app/`: web app for app.ecoutemoi.ru (separate build and deployment).

## Verification
`npm run check` runs ESLint, TypeScript, build and static checks. `npm run qa` uses installed Microsoft Edge (or `QA_CHROMIUM_PATH=<chromium binary>`) for responsive layouts, axe accessibility, links, keyboard controls, no-JS content and 404 checks. See `qa/README.md` for Lighthouse commands. QA artifacts and private owner-review notes are excluded from Git.

## Publishing
The owner approved this first website release on 13 September 2026. See `docs/DEPLOYMENT.md` and `docs/DNS_SETUP.md`. Publication is controlled by repository variables and the `github-pages` environment. Domain settings and DNS are managed separately from the build.

Legal documents and the external support contact remain in preparation. No unconfirmed store links, launch dates, subscription prices or features are published.
