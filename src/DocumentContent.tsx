import { Fragment, type ReactNode } from 'react';
import documents from './legalDocuments.json';

type DocumentProps = { path: string; base: string };
type Section = { title: string; paragraphs?: string[]; steps?: string[] };
type LegalDocument = { lead: string; sections: Section[]; updatedAt?: string };
const pages: Record<string, LegalDocument> = {
  '/privacy': documents.privacy,
  '/terms': documents.terms,
  '/community': documents.community,
  '/account-deletion': documents['account-deletion'],
  '/support': documents.support,
};

function linkedText(text: string, base: string): ReactNode {
  return text.split(/(https:\/\/[^\s,;]+|support@ecoutemoi\.ru)/g).map((part, index) => {
    if (part === 'support@ecoutemoi.ru') return <a key={index} href={`mailto:${part}`}>{part}</a>;
    if (!part.startsWith('https://')) return <Fragment key={index}>{part}</Fragment>;
    const trailing = part.match(/[.).]+$/)?.[0] ?? '';
    const url = trailing ? part.slice(0, -trailing.length) : part;
    const href = url.startsWith('https://ecoutemoi.ru/') ? base + url.slice('https://ecoutemoi.ru/'.length) : url;
    return <Fragment key={index}><a href={href}>{url}</a>{trailing}</Fragment>;
  });
}

export function DocumentContent({ path, base }: DocumentProps) {
  const document = pages[path];
  if (!document) return null;
  return <>
    <div className="document-notice" role="note"><strong>Редакция от {document.updatedAt ?? documents.updatedAt}</strong></div>
    <p className="document-lead">{document.lead}</p>
    {document.sections.map(section => <section key={section.title} className="document-part">
      <h2>{section.title}</h2>
      {section.paragraphs?.map((paragraph, index) => <p key={index}>{linkedText(paragraph, base)}</p>)}
      {section.steps && <ol className="document-steps">{section.steps.map(step => <li key={step}>{linkedText(step, base)}</li>)}</ol>}
    </section>)}
  </>;
}
