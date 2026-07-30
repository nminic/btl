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
