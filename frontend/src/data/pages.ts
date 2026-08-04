import type { PageSection, StaticPage } from './types'

/* Written pages, read out of the record the administrator maintains.
 *
 * One text can belong on two screens without being written twice. The address of
 * the president stands on the front page and inside "O ligi" (PDL P28a), and both
 * read the same record: a page names the pages it takes in, and they are drawn
 * above its own sections. Copying the text into both records would work until the
 * first correction, after which one of the two would be wrong and nothing would
 * say which.
 */

const MISSING: StaticPage = { title: '', sections: [] }

/** The address of the president, which the front page draws inside itself. */
export const PRESIDENT_PAGE = 'rec-predsednika'

/**
 * Written pages that have no address of their own, because something else draws
 * them.
 *
 * Two ways a page can be one, and both count. `includes` is the first: another
 * written page takes it in. A screen that draws a record itself is the second,
 * and it is the one that had no name until now. The address of the president
 * stood on the front page and inside "O ligi", so `includes` said everything
 * there was to say; "O ligi" was deleted on 04.08.2026 and the record went on
 * being drawn on the front page while nothing declared it taken in, which offered
 * /rec-predsednika on the list of pages as an address that answers. It does not.
 */
const DRAWN_BY_A_SCREEN = [PRESIDENT_PAGE]

export function withoutOwnAddress(pages: Record<string, StaticPage>): Set<string> {
  return new Set([
    ...Object.values(pages).flatMap((page) => page.includes ?? []),
    ...DRAWN_BY_A_SCREEN,
  ])
}

/** The page under that address, or an empty one. A slug that answers nothing is
 *  not an error here: the screen that has to say "no such page" checks for it
 *  itself, and a widget that takes in a page simply has nothing to draw. */
export function pageOf(pages: Record<string, StaticPage>, slug: string): StaticPage {
  return pages[slug] ?? MISSING
}

/** Everything a page shows, its own sections and the ones it takes in, in the
 *  order they are read: what is taken in stands first, because a foreword is a
 *  foreword. */
export function sectionsOf(pages: Record<string, StaticPage>, page: StaticPage): PageSection[] {
  const taken = (page.includes ?? []).flatMap((slug) => pageOf(pages, slug).sections)

  return [...taken, ...page.sections]
}

/**
 * A written page by its address, or nothing where administration has removed it.
 *
 * Both screens that draw a written page go through here. Without it the row went
 * off the list of pages and the page went on being served: `/sr/pravilnik`
 * answered exactly as before, which makes the delete button on that screen a
 * control that reads as removing a page and does not.
 */
export function livePage(
  pages: Record<string, StaticPage>,
  slug: string,
  deleted: string[],
): StaticPage | undefined {
  return deleted.includes(slug) ? undefined : pages[slug]
}
