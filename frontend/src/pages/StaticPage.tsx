import { Markdown } from '../components/Markdown'
import { Resource } from '../components/Resource'
import { usePages } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import './StaticPage.css'

/* Written pages: the terms, the privacy policy, the page about the league, the
 * history. The text is data rather than dictionary entries, because these run
 * to thousands of words and are revised on their own schedule. The rulebook is
 * written the same way but has its own screen, because it needs contents.
 *
 * The body is Markdown, rendered by the one component that reads it. Raw HTML
 * is never interpreted, so nothing that ends up in these files can put an
 * element of its own on the page.
 */
export function StaticPage({ slug }: { slug: string }) {
  const { t } = useI18n()
  const state = usePages()

  return (
    <Resource state={state}>
      {(pages) => {
        const page = pages[slug]

        if (page === undefined) {
          return <h1>{t('notFound.title')}</h1>
        }

        return (
          <article className="page">
            <h1>{page.title}</h1>

            {page.sections.map((section) => (
              <section key={section.heading}>
                <h2>{section.heading}</h2>
                <Markdown text={section.body} />
              </section>
            ))}
          </article>
        )
      }}
    </Resource>
  )
}
