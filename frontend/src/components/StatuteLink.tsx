import { useI18n } from '../i18n/useI18n'
import './StatuteLink.css'

/** The statute as it is served, named the way the owner named it (21.08.2026).
 *  The space is written out, because a browser asks for it that way and a link
 *  that differs from the file by one character is a link to nothing.
 *
 *  The same file the footer links to (src/app/Shell.tsx). Two links to one
 *  document, and the address is written twice; it is written twice on purpose
 *  rather than shared, because sharing it would make the footer import from a
 *  component of the written pages for the sake of one string. If the file is
 *  ever renamed, a test holds both of them to the same value. */
const STATUTE_FILE = '/BTL%20Statut.pdf'

/**
 * The statute, offered for download at the foot of the rulebook (owner,
 * 22.08.2026): a sheet of paper with a folded corner, and the name of the
 * document beside it.
 *
 * Drawn rather than fetched. A thumbnail of the first page would mean rendering
 * a PDF in the browser, and the whole of what a thumbnail says here is „this is
 * a document you can take away", which a drawing says as well and at no cost.
 */
export function StatuteLink() {
  const { t } = useI18n()

  return (
    <a className="statute" href={STATUTE_FILE} download>
      <svg className="statute__sheet" viewBox="0 0 32 40" aria-hidden="true" focusable="false">
        <path
          className="statute__page"
          d="M3 1.5h17L29 10v28.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2.5a1 1 0 0 1 1-1Z"
        />
        <path className="statute__fold" d="M20 1.5 29 10h-9V1.5Z" />
        <text className="statute__kind" x="16" y="30" textAnchor="middle">
          PDF
        </text>
      </svg>
      <span className="statute__name">{t('rulebook.statuteFile')}</span>
    </a>
  )
}
