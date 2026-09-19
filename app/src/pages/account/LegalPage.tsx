import { Icon } from '../../components/Icon';
import { PageHeader } from '../../components/PageHeader';
import { config } from '../../config';

const documents = [
  { href: config.links.privacy, title: 'Политика конфиденциальности' },
  { href: config.links.terms, title: 'Пользовательское соглашение' },
  { href: config.links.community, title: 'Правила сообщества' },
  { href: config.links.accountDeletion, title: 'Удаление аккаунта' },
  { href: config.links.support, title: 'Поддержка' },
];

/** Links to the pages of the public site; nothing is copied here. */
export function LegalPage() {
  return (
    <>
      <PageHeader eyebrow="Информация" title="Документы">
        <p>Документы Écoute Moi размещаются на сайте.</p>
      </PageHeader>
      <section className="panel">
        <ul className="list">
          {documents.map((doc) => (
            <li key={doc.href}>
              <a className="list-row list-link" href={doc.href}>
                <Icon name="doc" />
                <span className="list-main"><span className="list-title">{doc.title}</span></span>
                <Icon name="external" size={16} />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
