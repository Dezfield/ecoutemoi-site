# Deployment

Owner approved publication and connection of ecoutemoi.ru on 2026-09-13. Public repository: https://github.com/Dezfield/ecoutemoi-site. GitHub Actions is the Pages source. Current repository variables: SITE_BASE=/, PAGES_DEPLOY_APPROVED=true, PRODUCTION_APPROVED=true. Domain ownership is verified and the Pages custom domain is ecoutemoi.ru. The initial production workflow completed successfully: https://github.com/Dezfield/ecoutemoi-site/actions/runs/34770779859. Legal placeholders remain explicit pending final owner-provided details.

For a new installation, follow these steps. The existing installation has owner approval; do not recreate it.
2. After owner authorizes publication, create the repository Dezfield/ecoutemoi-site (confirm account and visibility). Review source for private data, initialize a fresh Git history, commit and push. GitHub Pages plan support differs for private repositories; Free supports public repositories. Confirm plan/visibility before choosing. Do not expose the existing private app source.
3. Choose GitHub Actions as Pages source. Configure the `github-pages` environment with owner review if available.
4. For temporary project Pages, set SITE_BASE=/ecoutemoi-site/, PAGES_DEPLOY_APPROVED=true; leave PRODUCTION_APPROVED unset. Push main or dispatch the workflow. It installs via npm ci, lints, type-checks, builds, runs static checks, uploads dist and deploys. PRs build only. The workflow sets SITE_ORIGIN to the repository owner's github.io origin for preview metadata; local preview defaults to 127.0.0.1. No custom domain in this step.
5. For the approved apex release, set SITE_BASE=/ and PRODUCTION_APPROVED=true only after content approval. Build/test root assets and routes. Configure the verified custom domain in GitHub Pages, then perform separately approved Cloudflare record changes described in DNS_SETUP.md.
6. Inspect Action status and Pages URL, then check all routes, assets, true 404, certificate, canonical URL, social card, apex and www redirect. A successful CI build alone is not a successful live deployment.

To reproduce locally: npm ci; npm run check; npm run preview. For production artifact review use npm run build:production and Lighthouse, then rebuild preview before owner handoff. No build command changes remote infrastructure.

GitHub Pages is appropriate for this informational frontend, not a checkout, subscription transaction service or sensitive-data application. Check its documented usage/limits before public launch if scope expands.

Official sources checked 2026-09-13:
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://vite.dev/guide/static-deploy.html
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

