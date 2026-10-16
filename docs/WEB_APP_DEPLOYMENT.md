# Web 2.0 development and deployment

Current release instructions and remaining gates: [WEB_2_RELEASE_GATES.md](WEB_2_RELEASE_GATES.md).

The public site remains a separate build at ecoutemoi.ru; app/ remains a Vite SPA at app.ecoutemoi.ru. Existing production hosting and DNS are unchanged. This branch does not deploy either site.

Build root site with npm run check; build app with cd app and npm run check. Browser QA: npm run test:e2e (synthetic backend, see release gates). Environment values retain VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and VITE_PUBLIC_SITE_URL. Only public configuration belongs in VITE values. Keep VITE_AUTH_SIGNUP_ENABLED=false and the provider allowlist empty until explicit real-provider/consent QA. No provider secrets belong in the frontend.

The backend source/production matrix is [WEB_BACKEND_MATRIX.md](WEB_BACKEND_MATRIX.md). The pre-Web-2 deployment guide is preserved at [archive/web-before-2/WEB_APP_DEPLOYMENT.md](archive/web-before-2/WEB_APP_DEPLOYMENT.md) and is historical, not current operational instructions.
