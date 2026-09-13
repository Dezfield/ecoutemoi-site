# Security and privacy boundary

Public static assets only. No Supabase client, service URLs, keys, account sessions, user media, trackers, analytics, cookie banner, cookies or localStorage usage. No forms collect information. All links point within this site; future store links require verification. No env file is needed. SITE_BASE is a non-secret build parameter.

Git ignores node_modules, dist, env files and generated QA artifacts. Static checks scan output for known internal URL/credential patterns; dependency audit checks npm advisories. These checks reduce accidental disclosure and are not a guarantee against all secrets. Review new source and staged diff before creating a public repository or committing; never import private project history. No source maps shipped.

React escapes text; no dangerouslySetInnerHTML or remote content. Build-time HTML assembly uses escaped known metadata. Local preview is bound to 127.0.0.1 and rejects paths outside dist. It is a development utility, not an internet server. GitHub Pages cannot configure arbitrary application security response headers from this project; do not claim a CSP or HSTS policy was deployed. Enforce HTTPS in Pages after approved domain setup. Cloudflare hardening remains a separate approved configuration task.

CI has read-only default permissions. Deployment alone gets pages:write and id-token:write and uses the github-pages environment. The approval variable defaults off; configure required reviewers where supported as an additional human release gate. No Cloudflare or backend token exists in the workflow. No DNS mutations are automated.

Future changes that add forms, tracking, authentication, external resources or account data require a new privacy/security review. Legal placeholders and missing contact are content release blockers, not hidden completed features.
