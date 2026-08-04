import { Markdown } from '../../components/Markdown'
import { Resource } from '../../components/Resource'
import { pageOf, PRESIDENT_PAGE } from '../../data/pages'
import { usePages } from '../../data/useResource'

/** The address is a written page the administrator maintains, not a text in the
 *  code (PDL P28a). Which record it is belongs to the data layer, because the
 *  list of pages has to know it is drawn here and has no address of its own. */
export const ADDRESS_SLUG = PRESIDENT_PAGE

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

  /* Inline, and with no name: the only heading this part has is inside the
     record it is waiting for, and the address is kept out of the code on
     purpose (PDL P28a), so there is no static string to name it with. */
  return (
    <Resource state={state} inline>
      {(pages) => {
        const page = pageOf(pages, ADDRESS_SLUG)

        return (
          <div className="card">
            {page.sections.map((section) => (
              <article className="address" key={section.heading}>
                <h2 className="card__title">{section.heading}</h2>
                <Markdown text={section.body} />
              </article>
            ))}
          </div>
        )
      }}
    </Resource>
  )
}
