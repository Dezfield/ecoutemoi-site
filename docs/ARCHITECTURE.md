# Architecture

Independent public frontend. No mobile imports, database clients, authentication, admin API, analytics or forms. Only the existing public brand SVG is copied from mobile. Existing source repositories remain untouched.

React renders the same view at build time and in the browser. Vite emits the client assets; a TypeScript script writes `/index.html`, `/privacy/index.html`, `/terms/index.html`, `/community/index.html`, `/account-deletion/index.html`, `/support/index.html`, and `/404.html`. Direct navigation and refresh resolve to real files. Unknown routes have a real 404 document; no SPA fallback. JavaScript enhances navigation and the optional motion toggle. Content and FAQ work without JavaScript. CSS media queries provide phone/tablet/wide layouts.

Components: Button (navigation anchor), Section, Container, Card, Badge, Navigation, Footer, FAQItem (native details/summary), FlowStep, Brand, Wave, VoiceArtwork, DocumentPage. System Arial/Segoe UI and Georgia avoid external font requests. Brand Ember #E46F07 retained; website green #091C18 added as requested. Tokens in src/tokens.css; breakpoints in styles.css at 360/520/800/1100/1700px. Buttons ≥44px. Motion uses transform/opacity and respects reduced motion; waveform is decorative, carries no audio or playback claim.

Build configuration SITE_BASE: root `/` for local/apex; `/ecoutemoi-site/` for project Pages. All internal links, script, stylesheet and image URLs respect this base. Canonical and social origin are preview-local unless explicitly built in production mode. Preview robots disallows all indexing. Future production uses the canonical apex; legal placeholders stay noindex until replaced. No unconfirmed app store links, dates, limits, pricing or subscription features.

Domain topology (from owner brief; not a live Cloudflare inventory): ecoutemoi.ru = future public frontend; www = future canonical redirect; admin.ecoutemoi.ru = separate existing administration, do not modify; api.ecoutemoi.ru = reserved future backend domain, do not create. Backend continues on its existing provider endpoint, which is not exposed by this site's UI.

Alternatives reviewed in AUDIT_REPORT.md: a client-only SPA complicates direct refresh and static SEO; SSR adds unnecessary runtime. Static route generation meets the requested hosting constraints. Development/QA use local Node processes only; production requires only dist files.
