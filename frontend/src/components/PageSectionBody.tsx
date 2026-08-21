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

/**
 * Whether a half of the body has anything in it to draw.
 *
 * Asked of the words and not of the characters. The body is split on the
 * newline, so a document written with CRLF leaves the carriage return on the end
 * of every line: a half that is one blank line is `''` written with LF and
 * `'\r'` written with CRLF, and `!== ''` called the second one words and drew an
 * empty block with a full gap beside the drawing, above it or below it depending
 * on which half it was. Measured, and the day the body comes out of a `textarea`
 * is the day it is written with CRLF, because that is what a browser sends.
 */
function hasWords(half: string): boolean {
  return half.trim() !== ''
}

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
 * and a test holds the two together (writtenPages.test.tsx).
 *
 * What that test is for, said exactly: a drawing whose place is not marked is
 * **not** dropped. `drawing()` is called whatever the body says, so it stands
 * under all of the words, which is where the fee schedule used to stand and
 * where the owner moved it from. That is the quiet failure worth a guard: not a
 * blank on the screen, which somebody would report, but the old arrangement
 * back with nothing saying so. The mark can be lost without being deleted,
 * because a mark is only a mark while it is a line of its own: `[[gallery]]`
 * with a zero width space in front of it reads as ordinary text, and in an
 * editor and in a diff it looks exactly like the good line.
 *
 */
export function PageSectionBody({ section }: { section: PageSection }) {
  const { before, after } = around(section.body)

  return (
    <div className="section-body">
      {hasWords(before) && <Markdown text={before} />}
      {drawing(section.gallery)}
      {hasWords(after) && <Markdown text={after} />}
    </div>
  )
}
