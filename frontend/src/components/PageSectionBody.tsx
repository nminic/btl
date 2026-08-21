import type { ReactNode } from 'react'
import type { PageSection } from '../data/types'
import { DucatGallery } from './DucatGallery'
import { PriceTable } from './PriceTable'
import { Markdown } from './Markdown'
import './PageSectionBody.css'

/* Where in the text the drawing stands. A line holding nothing but this is taken
 * out of the words and the drawing takes its place.
 *
 * The mark says only "here". Which drawing it is stays on the section, in the
 * closed list the type carries, so neither fact is written twice and a written
 * page cannot name an element of its own. */
const MARKER = '[[gallery]]'

/** The words before the drawing and the words after it. */
function around(body: string): { before: string; after: string } {
  const lines = body.split('\n')
  const at = lines.findIndex((line) => line.trim() === MARKER)

  /* A section with no mark is a section with no drawing to place, and all of it
     is words. Written out rather than left to the arithmetic: `findIndex`
     answers -1, and -1 read as a position cuts the last line off the words and
     then prints the whole body over again after it. Measured, twice on screen. */
  if (at === -1) {
    return { before: body, after: '' }
  }

  return {
    before: lines.slice(0, at).join('\n'),
    after: lines.slice(at + 1).join('\n'),
  }
}

/**
 * The drawing a section names, or nothing where it names none.
 *
 * The list is closed and lives on the type (src/data/types.ts).
 */
function drawing(gallery: PageSection['gallery']): ReactNode {
  if (gallery === 'ducats') {
    return <DucatGallery />
  }

  if (gallery === 'prices') {
    return <PriceTable />
  }

  return undefined
}

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
 * Where the drawing stands is the section's own to say, since 21.08.2026: the
 * fee schedule belongs under the sentence naming the decision that sets it
 * (Član 14 of the rulebook, owner) and not at the foot of the whole section,
 * three articles below it. A section that names a drawing marks a place for it,
 * and a test holds the two together (writtenPages.test.tsx): a drawing with
 * nowhere to go would otherwise be dropped in silence, which is the fault the
 * paragraph above describes arriving by the other door.
 *
 */
export function PageSectionBody({ section }: { section: PageSection }) {
  const { before, after } = around(section.body)

  return (
    <div className="section-body">
      {before !== '' && <Markdown text={before} />}
      {drawing(section.gallery)}
      {after !== '' && <Markdown text={after} />}
    </div>
  )
}
