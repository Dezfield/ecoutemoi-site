import { readFileSync, existsSync } from 'node:fs';
import assert from 'node:assert/strict';
const base = '/ecoutemoi-site/';
for (const route of ['', 'privacy/', 'terms/', 'community/', 'account-deletion/', 'support/']) {
  const html = readFileSync(`dist/${route}index.html`, 'utf8');
  assert(html.includes(`data-base="${base}"`));
  for (const match of html.matchAll(/(?:src|href)="(\/[^"#]*)"/g)) {
    const url = match[1]; assert(url.startsWith(base), `Unprefixed asset/link: ${url}`);
    const file = url.slice(base.length);
    if (file.includes('#')) continue;
    assert(existsSync(`dist/${file}`), `Missing target ${file}`);
  }
}
console.log('Project Pages base verified: all six routes and referenced root-relative assets/links use /ecoutemoi-site/.');
