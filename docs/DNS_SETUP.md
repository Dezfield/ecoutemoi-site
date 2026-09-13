# DNS setup

Owner approved publication and domain connection on 2026-09-13. The four apex A records and www CNAME below are installed in Cloudflare, DNS only, TTL Auto. GitHub ownership verification succeeded; preserve its _github-pages-challenge-dezfield TXT record. The Pages custom domain was saved before the apex records were added. Certificate provisioning is managed by GitHub Pages.

## Current and intended topology
Before connection, apex A/AAAA and www were absent. Three existing admin records (one CNAME and two verification TXT records) were inventoried and remain unchanged, including DNS-only mode and Auto TTL. admin.ecoutemoi.ru returned HTTP 200 over valid HTTPS after the changes. Nameservers remain austin.ns.cloudflare.com and meadow.ns.cloudflare.com. api.ecoutemoi.ru remains reserved for future work.

**DO NOT DELETE admin.ecoutemoi.ru.** Do not change nameservers, wildcard records, mail records, verification records, backend endpoints or Supabase settings. Any conflict with an existing service requires explicit owner review.

## Configuration and maintenance
1. Verify domain ownership in GitHub account settings following GitHub's domain verification procedure; protect the verification TXT record. This is itself a DNS change requiring approval.
2. Add ecoutemoi.ru as the repository Pages custom domain BEFORE repointing DNS, to reduce takeover risk. For custom Actions, a CNAME file is not required and is ignored; configure domain in Pages settings.
3. With owner authorization, set only the required apex A records:

| Type | Name | Value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | dezfield.github.io |

These IPs were read from official GitHub docs, not recalled from memory. Re-check immediately before execution. Confirm repository owner is Dezfield before using its CNAME target; do not append the repository name. Optional IPv6 AAAA: 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153. Inventory existing AAAA records so they cannot send IPv6 users to an old destination; review their change explicitly.

Start with DNS only (grey cloud), TTL Auto or 300 seconds for changed website records. This exposes the documented Pages answers and allows direct GitHub DNS/TLS validation; no Cloudflare caching or redirect rule is needed for this basic deployment. Do not change the admin proxy mode. A later Proxied setup is a separate decision requiring HTTPS/redirect revalidation.

4. Wait for Pages DNS verification and certificate provisioning; enable Enforce HTTPS. GitHub notes propagation/certificate controls can take up to 24 hours. Preserve CAA unless evidence identifies a certificate conflict, then request a targeted change.
5. With apex as the Pages custom domain and correct www CNAME, GitHub provides the www→apex redirect. Do not add a production Cloudflare redirect before approval.

## Verification (read-only)
```powershell
nslookup -type=A ecoutemoi.ru
nslookup -type=AAAA ecoutemoi.ru
nslookup -type=CNAME www.ecoutemoi.ru
Resolve-DnsName ecoutemoi.ru
curl.exe -I https://ecoutemoi.ru
curl.exe -I https://www.ecoutemoi.ru
curl.exe -I https://admin.ecoutemoi.ru
curl.exe -I https://ecoutemoi.ru/privacy/
curl.exe -I https://ecoutemoi.ru/definitely-missing/
```
If dig is available: `dig ecoutemoi.ru A +noall +answer`, `dig ecoutemoi.ru AAAA +noall +answer`, `dig www.ecoutemoi.ru CNAME +noall +answer`. Check multiple recursive resolvers. In browser inspect certificate hostname/chain/expiry, mixed content, loaded assets, route refresh, favicon, OG, phone and desktop. Verify admin remains in its original expected state (an auth response may be correct; do not infer breakage from a protected route).

## Rollback
Keep the prior Pages artifact and zone export. Re-deploy the last accepted artifact for content regressions. For DNS regressions, restore only the exact apex/www records changed in this operation, including former AAAA/proxy/TTL settings; leave all other records untouched. Verify apex, www and admin. Do not remove the GitHub custom domain while DNS still points to Pages; that can leave a takeover opportunity. Keep the domain verification record.

Sources:
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site
- https://developers.cloudflare.com/dns/proxy-status/

