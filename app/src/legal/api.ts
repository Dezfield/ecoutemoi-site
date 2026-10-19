import documents from './documents.json';
import { requireSupabase } from '../lib/supabase';

export type DocumentType = keyof typeof documents;
export type LegalState = {
  available: boolean;
  mandatoryPending: boolean;
  accepted: Record<DocumentType, boolean>;
  withdrawable: Record<DocumentType, boolean>;
  incompatible: Record<DocumentType, boolean>;
  featureAvailable: Record<DocumentType, boolean>;
  outdatedBuild: boolean;
};
const empty = () => ({ terms: false, privacy_policy: false, audio_publication: false, selfie_verification: false });
const unavailable: LegalState = { available: false, mandatoryPending: false, accepted: empty(), withdrawable: empty(), incompatible: empty(), featureAvailable: empty(), outdatedBuild: false };
export function parseLegalState(data: unknown): LegalState {
  const row = (data ?? {}) as { documents?: unknown; mandatory_pending?: unknown };
  const accepted = empty(), withdrawable = empty(), incompatible = empty(), featureAvailable = empty();
  const seen = new Set<DocumentType>();
  for (const item of Array.isArray(row.documents) ? row.documents : []) {
    const doc = (item ?? {}) as { doc_type?: string; version?: string; sha256?: string; accepted?: unknown; withdrawable?: unknown; feature_available?: unknown };
    if (!doc.doc_type || !Object.hasOwn(documents, doc.doc_type)) continue;
    const type = doc.doc_type as DocumentType, local = documents[type];
    seen.add(type);
    incompatible[type] = doc.version !== local.version || doc.sha256 !== local.sha256;
    accepted[type] = doc.accepted === true && !incompatible[type];
    withdrawable[type] = !local.mandatory && (doc.withdrawable === true || doc.accepted === true);
    featureAvailable[type] = doc.feature_available !== false;
  }
  for (const type of Object.keys(documents) as DocumentType[]) if (!seen.has(type)) incompatible[type] = true;
  return { available: true, mandatoryPending: row.mandatory_pending === true || !accepted.terms || !accepted.privacy_policy,
    accepted, withdrawable, incompatible, featureAvailable, outdatedBuild: incompatible.terms || incompatible.privacy_policy };
}
export async function loadLegalState(): Promise<LegalState> {
  const { data, error } = await requireSupabase().rpc('get_my_legal_acceptance_v1');
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') return unavailable;
    throw error;
  }
  return parseLegalState(data);
}
export async function acceptDocuments(types: DocumentType[]): Promise<LegalState> {
  const { data, error } = await requireSupabase().rpc('accept_legal_documents_v1', {
    p_documents: types.map((type) => ({ doc_type: type, version: documents[type].version, sha256: documents[type].sha256 })),
    p_platform: 'web', p_app_version: 'web-2026-10-19',
  });
  if (error) throw error;
  return parseLegalState(data);
}
export async function withdrawConsent(type: 'audio_publication' | 'selfie_verification'): Promise<LegalState> {
  const { data, error } = await requireSupabase().rpc('withdraw_legal_consent_v1', { p_doc_type: type, p_platform: 'web', p_app_version: 'web-2026-10-19' });
  if (error) throw error;
  return parseLegalState(data);
}
export { documents };
