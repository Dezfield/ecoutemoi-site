# Local verification evidence

Run from the website directory, with installed Edge:
```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run preview
```
In another console: `npm.cmd run qa`. Saves browser-results.json and desktop/mobile/full-page/document screenshots. The test uses Edge Chromium, not a physical iPhone or Android handset. Homepage widths: 320, 360, 390, 412, 768, 1024, 1440, 1920 and 2560 CSS pixels. Secondary pages checked at 320 and 1440. JavaScript-disabled content and FAQ also checked.

For Lighthouse, run `npm.cmd run build:production`, keep the local static server running, then `node scripts/lighthouse.mjs`. This measures an indexable production artifact on localhost without publishing. It saves separate HTML/JSON reports for mobile simulated throttling and desktop. Rebuild with `npm.cmd run build` afterward to restore noindex preview. The initial CLI run wrote a report but failed during Windows temp-directory cleanup; the final script uses a managed browser lifetime instead.

For project Pages asset paths:
```powershell
$env:SITE_BASE='/ecoutemoi-site/'
npm.cmd run build
node scripts/check-base.mjs
Remove-Item Env:SITE_BASE
npm.cmd run check
```

Automated accessibility does not replace screen-reader and device review. Local Lighthouse excludes real hosting latency, CDN cache policy, DNS and certificate behavior. Live deployment and physical device acceptance are not claimed. Final measured results belong in docs/PREVIEW_REPORT.md.
