import React from 'react';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { App } from '../src/App';
import { pages, title, description } from '../src/content';
const production = process.argv.includes('--production');
const base = process.env.SITE_BASE || '/';
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw new Error('SITE_BASE must be / or /repository-name/');
if (production && base !== '/') throw new Error('Apex production requires SITE_BASE=/');
const originInput = production ? 'https://ecoutemoi.ru' : (process.env.SITE_ORIGIN || 'http://127.0.0.1:4173');
const originUrl = new URL(originInput);
if (!['https:', 'http:'].includes(originUrl.protocol) || originUrl.pathname !== '/' || originUrl.search || originUrl.hash || originUrl.username || originUrl.password) throw new Error('SITE_ORIGIN must be a plain HTTP(S) origin');
const origin = originUrl.origin;
const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const template = readFileSync('dist/index.html', 'utf8');
for (const route of ['/', ...Object.keys(pages), '/404']) {
  const url = `${origin}${base}${route === '/' ? '' : `${route.slice(1)}/`}`;
  const pageTitle = route === '/' ? title : `${pages[route] || 'Страница не найдена'} — Écoute Moi`;
  const indexable = production && (route === '/' || route === '/account-deletion' || route === '/support');
  const meta = `<meta name="description" content="${escape(description)}"><meta name="robots" content="${indexable ? 'index,follow' : 'noindex,follow'}"><link rel="canonical" href="${url}"><meta property="og:type" content="website"><meta property="og:locale" content="ru_RU"><meta property="og:site_name" content="Écoute Moi"><meta property="og:title" content="${escape(pageTitle)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${origin}${base}og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="Écoute Moi. Слушать. Слышать. Видеть."><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(pageTitle)}"><meta name="twitter:description" content="${escape(description)}"><meta name="twitter:image" content="${origin}${base}og.png">`;
  const html = template.replace('<html lang="ru">', `<html lang="ru" data-base="${base}" data-route="${route}">`).replace(/<title>.*?<\/title>/, `<title>${escape(pageTitle)}</title>`).replace('</head>', `${meta}</head>`).replace('<div id="root"></div>', `<div id="root">${renderToString(<App path={route} base={base}/>)}</div>`);
  const file = route === '/' ? 'dist/index.html' : route === '/404' ? 'dist/404.html' : `dist${route}/index.html`;
  if (route !== '/' && route !== '/404') mkdirSync(`dist${route}`, { recursive: true });
  writeFileSync(file, html);
}
writeFileSync('dist/robots.txt', production ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n');
writeFileSync('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${(production ? ['/', '/account-deletion/', '/support/'] : []).map(path => `<url><loc>${origin}${path}</loc></url>`).join('')}</urlset>`);
writeFileSync('dist/.nojekyll', '');
console.log(`Rendered seven routes; ${production ? 'PRODUCTION artifact only — deployment requires owner approval' : 'PREVIEW noindex'}; base ${base}`);
