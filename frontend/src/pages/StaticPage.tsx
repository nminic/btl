import { Resource } from '../components/Resource'
import { usePages } from '../data/useResource'
import { useI18n } from '../i18n/useI18n'
import './StaticPage.css'

/* Written pages: the rulebook, the terms, the privacy policy, the page about
 * the league. The text is data rather than dictionary entries, because these
 * run to thousands of words and are revised on their own schedule.
 *
 * Paragraphs are split on blank lines and nothing else is interpreted. No
 * markup is rendered from the text, so nothing that ends up in these files can
 * ever put an element on the page.
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
                {section.body
                  .split('\n\n')
                  .filter((paragraph) => paragraph.trim() !== '')
                  .map((paragraph) => (
                    <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                  ))}
              </section>
            ))}
          </article>
        )
      }}
    </Resource>
  )
}
