import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
const paths = ['', 'privacy/', 'terms/', 'community/', 'account-deletion/', 'support/'];
for (const path of paths) {
  const html = readFileSync(`dist/${path}index.html`, 'utf8');
  assert.match(html, /<h1[ >]/); assert.match(html, /lang="ru"/); assert.match(html, /rel="canonical"/);
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
  assert(!/admin\.ecoutemoi|supabase\.co|service_role|eyJ[A-Za-z0-9_-]{35,}|https:\/\/(apps\.apple\.com|play\.google\.com)/i.test(html));
  const appUrl = html.match(/data-app-url="([^"]+)"/)?.[1];
  assert(appUrl && /^https?:\/\/[^/?#]+\/$/.test(appUrl), `Missing or invalid data-app-url on /${path}`);
  if (/content="index,follow"/.test(html)) assert.equal(appUrl, 'https://app.ecoutemoi.ru/', 'Production must link to the approved app domain');
  assert(html.includes(`<a class="nav-account" href="${appUrl}">Личный кабинет</a>`), `Missing Личный кабинет link on /${path}`);
}
assert.match(readFileSync('dist/404.html', 'utf8'), /Страница не найдена/);
for (const file of readdirSync('dist/assets')) {
  if (!/\.(js|css)$/.test(file)) continue;
  assert(!/admin\.ecoutemoi|supabase\.co|service_role|ghp_[a-zA-Z0-9]{20}|AIza[\w-]{25}/i.test(readFileSync(`dist/assets/${file}`, 'utf8')));
}
console.log('Static checks passed: six pages, 404, prerendered content, metadata, app entry link, public bundle boundary.');
