import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const documents = JSON.parse(readFileSync('src/legal/documents.json', 'utf8'));
function fixture() {
  const calls = [];
  const source = ts.transpileModule(readFileSync('src/legal/api.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('exports', 'require', source)(exports, (path) => path.endsWith('documents.json') ? { default: documents } : {
    requireSupabase: () => ({ rpc: async (name, args) => { calls.push({ name, args }); return { data: state(), error: null }; } }),
  });
  return { api: exports, calls };
}
const state = () => ({ documents: Object.entries(documents).map(([type, doc]) => ({ doc_type: type, version: doc.version, sha256: doc.sha256, accepted: true, feature_available: true })) });
test('web presents the exact canonical text represented by each acceptance hash', () => {
  for (const [type, doc] of Object.entries(documents)) {
    const canonical = [`${type}@${doc.version}`, doc.title, doc.intro, ...doc.sections.map((section) => `${section.title}\n${section.body}`)].join('\n\n');
    assert.equal(createHash('sha256').update(canonical).digest('hex'), doc.sha256);
  }
  const site = JSON.parse(readFileSync('../src/legalDocuments.json', 'utf8'));
  assert.equal(site.privacy.version, documents.privacy_policy.version);
  assert.deepEqual(site.privacy.sections.map((s) => ({ title: s.title, body: s.paragraphs.join('\n\n') })), documents.privacy_policy.sections);
});
test('optional mismatches do not lock mandatory acceptance; previous consent stays withdrawable', () => {
  const { api } = fixture(), row = state();
  row.documents[0].accepted = false;
  Object.assign(row.documents.find((d) => d.doc_type === 'audio_publication'), { version: '2026-10-20', accepted: false, withdrawable: true });
  const parsed = api.parseLegalState(row);
  assert.equal(parsed.mandatoryPending, true);
  assert.equal(parsed.outdatedBuild, false);
  assert.equal(parsed.incompatible.audio_publication, true);
  assert.equal(parsed.withdrawable.audio_publication, true);
});
test('mandatory mismatches and missing mandatory documents fail closed', () => {
  const { api } = fixture(), row = state(); row.documents[0].sha256 = 'changed';
  assert.equal(api.parseLegalState(row).outdatedBuild, true);
  assert.equal(api.parseLegalState(null).mandatoryPending, true);
});
test('web acceptance sends only the documents explicitly selected, with web platform and exact hashes', async () => {
  const { api, calls } = fixture();
  await api.acceptDocuments(['terms', 'privacy_policy']);
  assert.equal(calls[0].name, 'accept_legal_documents_v1');
  assert.equal(calls[0].args.p_platform, 'web');
  assert.deepEqual(calls[0].args.p_documents, ['terms', 'privacy_policy'].map((type) => ({ doc_type: type, version: documents[type].version, sha256: documents[type].sha256 })));
  await api.withdrawConsent('audio_publication');
  assert.equal(calls[1].args.p_doc_type, 'audio_publication');
});
