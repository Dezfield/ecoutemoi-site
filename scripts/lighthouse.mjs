import { chromium } from 'playwright';
import lighthouse from 'lighthouse';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--remote-debugging-port=9223'] });
try {
  for (const mode of ['mobile', 'desktop']) {
    const flags = { port: 9223, output: ['html', 'json'], logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] };
    if (mode === 'desktop') Object.assign(flags, { formFactor: 'desktop', screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false }, throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1, requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 } });
    const result = await lighthouse('http://127.0.0.1:4173/', flags);
    writeFileSync(`qa/lighthouse-${mode}.html`, result.report[0]);
    writeFileSync(`qa/lighthouse-${mode}.json`, result.report[1]);
    console.log(mode, JSON.stringify(Object.fromEntries(Object.entries(result.lhr.categories).map(([id, item]) => [id, item.score * 100]))));
    console.log('Metrics', result.lhr.audits['largest-contentful-paint'].displayValue, result.lhr.audits['cumulative-layout-shift'].displayValue);
    console.log('Failed', Object.entries(result.lhr.audits).filter(([, a]) => a.score !== null && a.score < .9).map(([id,a]) => `${id}: ${a.displayValue || a.title}`).join('\n'));
  }
} finally { await browser.close(); }
