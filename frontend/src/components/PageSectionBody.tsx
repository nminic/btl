import type { PageSection } from '../data/types'
import { BadgeGallery } from './BadgeGallery'
import { Markdown } from './Markdown'

/**
 * What one section of a written page shows: its text, and the drawing it names.
 *
 * Every screen that draws a section of a written page goes through here, and
 * there are three: the rulebook, the written pages, and the card on the front
 * page that draws the address of the president. Without it the field was on
 * every section and honoured by one of the three, so a section moved onto
 * another page would have drawn its words and quietly dropped its wall of
 * badges, with nothing on the screen saying why.
 *
 * The list of drawings is closed and lives on the type (src/data/types.ts).
 */
export function PageSectionBody({ section }: { section: PageSection }) {
  return (
    <>
      <Markdown text={section.body} />
      {section.gallery === 'badges' && <BadgeGallery />}
    </>
  )
}
