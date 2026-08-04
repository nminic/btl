import { PageSectionBody } from '../components/PageSectionBody'
import { Resource } from '../components/Resource'
import { livePage, sectionsOf } from '../data/pages'
import { usePages } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import { useSession } from '../session/useSession'
import './StaticPage.css'

/* Written pages: the terms, the privacy policy, the page about the league, the
 * history. The text is data rather than dictionary entries, because these run
 * to thousands of words and are revised on their own schedule. The rulebook is
 * written the same way but has its own screen, because it needs contents.
 *
 * The body is Markdown, rendered by the one component that reads it. Raw HTML
 * is never interpreted, so nothing that ends up in these files can put an
 * element of its own on the page.
 *
 * A page may also take in another page, which is how the address of the president
 * stands on "O ligi" and on the front page while being one record (see
 * src/data/pages.ts).
 */
export function StaticPage({ slug }: { slug: string }) {
  const { deletions } = useSession()
  const { t } = useI18n()
  const state = usePages()

  return (
    <Resource state={state}>
      {(pages) => {
        const page = livePage(pages, slug, deletions.pages ?? [])

        if (page === undefined) {
          return <h1>{t('notFound.title')}</h1>
        }

        return (
          <article className="page">
            <h1>{page.title}</h1>

            {sectionsOf(pages, page).map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                <PageSectionBody section={section} />
              </section>
            ))}
          </article>
        )
      }}
    </Resource>
  )
}
