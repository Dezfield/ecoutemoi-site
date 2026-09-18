// Public bundle boundary check for app/dist (run after `vite build`).
// Fails if the browser bundle contains a service_role key, a Supabase secret
// key, source maps, or other obvious credentials. A publishable/anon key is
// expected to be present when the build is configured.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dist = process.argv[2] || 'dist';
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(path);
  }
};
walk(dist);

assert(files.some((file) => file.endsWith('index.html')), 'index.html missing');
assert(!files.some((file) => file.endsWith('.map')), 'source maps must not be published');

const jwtPattern = /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
for (const file of files.filter((path) => /\.(js|html|css|txt|json)$/.test(path))) {
  const text = readFileSync(file, 'utf8');
  assert(!/sb_secret_[A-Za-z0-9_-]{10,}/.test(text), `Supabase secret key in ${file}`);
  assert(!/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(text), `Private key in ${file}`);
  assert(!/ghp_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}/.test(text), `Token-like secret in ${file}`);
  for (const token of text.match(jwtPattern) ?? []) {
    let role = null;
    try {
      role = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).role ?? null;
    } catch {
      role = null;
    }
    assert.notEqual(role, 'service_role', `service_role JWT embedded in ${file}`);
  }
}
const index = readFileSync(join(dist, 'index.html'), 'utf8');
assert.match(index, /<meta name="robots" content="noindex,nofollow"/, 'app must be noindex');
assert.equal(readFileSync(join(dist, 'robots.txt'), 'utf8').trim(), 'User-agent: *\nDisallow: /');
console.log(`Bundle boundary check passed (${files.length} files): no secret keys, no source maps, noindex.`);
