import { Link } from 'react-router'
import { Markdown } from '../../components/Markdown'
import { Resource } from '../../components/Resource'
import { pageOf } from '../../data/pages'
import { usePages } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'

/** The address is a written page the administrator maintains, not a text in the
 *  code, so the same record answers here and on "O ligi" (PDL P28a). */
export const ADDRESS_SLUG = 'rec-predsednika'

/* The address of the president of the association, back on the front page beside
 * the scoreboard and twice its width (PDL P28a, 30.07.2026).
 *
 * It went out earlier the same day together with the block above the counters,
 * and that was one removal too many: the name and the slogan in that block were
 * repeating the header, but the address is not written anywhere else on the
 * portal.
 *
 * It reads the written pages on its own rather than through the resources the
 * rest of the front page waits on, so a failure on either side costs one widget
 * and not the page.
 */
export function President() {
  const { locale, t } = useI18n()
  const state = usePages()

  return (
    <Resource state={state}>
      {(pages) => {
        const page = pageOf(pages, ADDRESS_SLUG)

        return (
          <section className="card">
            {page.sections.map((section) => (
              <article className="address" key={section.heading}>
                <h2 className="address__title">{section.heading}</h2>
                <Markdown text={section.body} />
              </article>
            ))}

            {/* The text says where the rulebook is; this is the way there, since
                a written page carries no links of its own. */}
            <Link className="card__more" to={`/${locale}/pravilnik`}>
              {t('home.wholeRulebook')}
            </Link>
          </section>
        )
      }}
    </Resource>
  )
}
