import type { PageSection } from '../data/types'
import { DucatGallery } from './DucatGallery'
import { PriceTable } from './PriceTable'
import { Markdown } from './Markdown'

/**
 * What one section of a written page shows: its text, and the drawing it names.
 *
 * Every screen that draws a section of a written page goes through here, and
 * there are three: the rulebook, the written pages, and the card on the front
 * page that draws the address of the president. Without it the field was on
 * every section and honoured by one of the three, so a section moved onto
 * another page would have drawn its words and quietly dropped its wall of
 * ducats, with nothing on the screen saying why.
 *
 * The other half of that rule is where the sections come from: all three read
 * `sectionsOf` rather than `page.sections`, so a record that takes another one
 * in is drawn the same way wherever it is drawn.
 *
 * The list of drawings is closed and lives on the type (src/data/types.ts).
 */
export function PageSectionBody({ section }: { section: PageSection }) {
  return (
    <>
      <Markdown text={section.body} />
      {section.gallery === 'ducats' && <DucatGallery />}
      {section.gallery === 'prices' && <PriceTable />}
    </>
  )
}
