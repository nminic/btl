import type { PageSection } from '../data/types'
import { BadgeGallery } from './BadgeGallery'
import { Markdown } from './Markdown'

/**
 * What one section of a written page shows: its text, and the drawing it names.
 *
 * Both screens that draw written pages go through here. Without it the field
 * existed on every section and was honoured by one of the two: a section moved
 * from the rulebook onto the terms would have drawn its words and quietly
 * dropped its wall of badges, with nothing on the screen saying why. Two screens
 * over one record must not disagree about what the record says, which is the
 * same reason both of them read `sectionsOf` rather than `page.sections`.
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
