import { useI18n } from '../../i18n/useI18n'
import '../member/Member.css'

/**
 * The address administration answers at, and nothing on it (owner, 06.08.2026).
 *
 * It held four counts and three links. Every one of them said again what the
 * navigation beside it already says: the number waiting is on each queue in
 * that navigation and on the bell in the header, and the links led to the two
 * sections and the price list, which are the navigation itself. PDL P28a has
 * said since 30.07.2026 that no number on this portal stands in two places, and
 * this screen was the place they stood a second time.
 *
 * What is left is the name, unseen, because a page with no name at all is one a
 * screen reader cannot announce and one the browser tab cannot title. Whoever
 * arrives here is one press from the work; whoever wants the work goes straight
 * to it, which is what the navigation is for.
 */
export function Admin() {
  const { t } = useI18n()

  return (
    <div className="member">
      <h1 className="visually-hidden">{t('admin.title')}</h1>
    </div>
  )
}
