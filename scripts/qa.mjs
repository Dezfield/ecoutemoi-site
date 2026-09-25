import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
// Installed Microsoft Edge by default; QA_CHROMIUM_PATH selects another Chromium binary (e.g. CI or Linux).
const browser = await chromium.launch(process.env.QA_CHROMIUM_PATH ? { executablePath: process.env.QA_CHROMIUM_PATH, headless: true } : { channel: 'msedge', headless: true });
const base = 'http://127.0.0.1:4173/';
const errors = [], results = [];
const context = await browser.newContext();
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
for (const width of [320, 360, 390, 412, 768, 1024, 1440, 1920, 2560]) {
  await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
  await page.goto(base); await page.emulateMedia({ reducedMotion: 'reduce' });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `Overflow ${width}`);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  results.push({ width, overflow: false, violations: axe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) })) });
  if (width === 390 || width === 1440) {
    await page.screenshot({ path: `qa/${width === 390 ? 'mobile' : 'desktop'}-full.png`, fullPage: true });
    await page.screenshot({ path: `qa/${width === 390 ? 'mobile' : 'desktop'}-hero.png` });
  }
}
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base);
await page.getByRole('button', { name: 'Меню' }).click();
assert.equal(await page.getByRole('button', { name: 'Закрыть' }).getAttribute('aria-expanded'), 'true');
await page.keyboard.press('Escape');
assert.equal(await page.getByRole('button', { name: 'Меню' }).getAttribute('aria-expanded'), 'false');
await page.getByRole('button', { name: 'Меню' }).click();
const accountLink = page.getByRole('navigation').getByRole('link', { name: 'Личный кабинет' });
assert(await accountLink.isVisible(), 'Личный кабинет in mobile menu');
const appUrl = await page.evaluate(() => document.documentElement.dataset.appUrl);
assert.equal(await accountLink.getAttribute('href'), appUrl);
assert.equal(await accountLink.getAttribute('target'), null, 'Личный кабинет opens in the same tab');
await page.getByRole('navigation').getByRole('link', { name: 'FAQ', exact: true }).click();
assert.equal(await page.getByRole('button', { name: 'Меню' }).getAttribute('aria-expanded'), 'false');
const faq = page.locator('summary').first(); await faq.focus(); await page.keyboard.press('Enter');
assert.equal(await page.locator('details').first().getAttribute('open'), '');
await page.getByRole('button', { name: 'Приостановить анимацию волны' }).click();
assert.equal(await page.getByRole('button', { name: 'Включить анимацию волны' }).getAttribute('aria-pressed'), 'true');
await page.setViewportSize({ width: 1440, height: 1000 });
assert(await page.getByRole('navigation').getByRole('link', { name: 'Личный кабинет' }).isVisible(), 'Личный кабинет in desktop navigation');
const appOrigin = new URL(await page.evaluate(() => document.documentElement.dataset.appUrl)).origin;
const internalLinks = await page.locator('a[href]').evaluateAll(elements => [...new Set(elements.map(a => a.href))]);
for (const link of internalLinks) {
  const url = new URL(link);
  if (url.origin === appOrigin && url.pathname === '/') continue; // the separate web app (app.ecoutemoi.ru), not part of this artifact
  if (url.origin !== new URL(base).origin) throw new Error(`Unexpected external link ${link}`);
  const response = await page.request.get(url.origin + url.pathname);
  assert(response.ok(), `Broken link ${link}`);
  if (url.hash && url.pathname === '/') assert(await page.locator(url.hash).count(), `Missing anchor ${link}`);
}
for (const route of ['privacy', 'terms', 'community', 'account-deletion', 'support']) {
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const response = await page.goto(base + route + '/'); assert.equal(response.status(), 200);
    await page.reload(); assert.equal(await page.locator('h1').count(), 1);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Route overflow ${route} ${width}`);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    results.push({ route, width, violations: axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })) });
  }
  await page.screenshot({ path: `qa/${route}.png`, fullPage: true });
}
const missing = await page.goto(base + 'missing-page/'); assert.equal(missing.status(), 404);
assert(await page.getByRole('heading', { name: 'Здесь пока тихо.' }).isVisible());
const nojs = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
const staticPage = await nojs.newPage(); await staticPage.goto(base);
assert(await staticPage.getByRole('heading', { level: 1 }).isVisible());
assert(await staticPage.getByRole('navigation').isVisible());
assert.equal(await staticPage.locator('header').evaluate(node => getComputedStyle(node).position), 'static');
await staticPage.locator('summary').first().click(); assert.equal(await staticPage.locator('details').first().getAttribute('open'), '');
await nojs.close();
// A 404 intentionally triggers a resource-error console event; record separately.
const unexpectedErrors = errors.filter(error => !error.includes('404 (Not Found)'));
writeFileSync('qa/browser-results.json', JSON.stringify({ results, errors, unexpectedErrors, checkedLinks: internalLinks.length, interactions: 'menu/Escape/link-close/account link desktop+mobile/FAQ keyboard/motion toggle/no-JS/deep refresh/404 passed' }, null, 2));
await browser.close();
assert.equal(unexpectedErrors.length, 0, 'Unexpected browser errors');
assert.equal(results.reduce((sum, result) => sum + result.violations.length, 0), 0, 'Accessibility violations');
console.log(`Browser QA passed: ${results.length} viewport/route combinations, ${internalLinks.length} links, interactions, no-JS, 404 and axe.`);
