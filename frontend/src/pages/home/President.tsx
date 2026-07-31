import { Markdown } from '../../components/Markdown'
import { Resource } from '../../components/Resource'
import { pageOf } from '../../data/pages'
import { usePages } from '../../data/useResource'

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
 *
 * The way to the rulebook is inside the sentence that mentions it, and so is the
 * address of the association (owner, 31.07.2026). There was a "Ceo pravilnik"
 * link under the text because a written page carried no links of its own; it
 * does now, and the same destination twice in one card is one of them wasted.
 */
export function President() {
  const state = usePages()

  return (
    <Resource state={state}>
      {(pages) => {
        const page = pageOf(pages, ADDRESS_SLUG)

        return (
          <div className="card">
            {page.sections.map((section) => (
              <article className="address" key={section.heading}>
                <h2 className="address__title">{section.heading}</h2>
                <Markdown text={section.body} />
              </article>
            ))}
          </div>
        )
      }}
    </Resource>
  )
}
