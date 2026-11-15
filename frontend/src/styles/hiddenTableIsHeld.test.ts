import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ruleFor } from '../test/stylesheet'

/* A TABLE WRITTEN FOR THE READER ONLY IS HELD BY A BOX, because the recipe that hides it does not hold it.
 *
 * `visually-hidden` (index.css) gives its element one pixel of width, and a table does not obey: it is as
 * wide as its longest row. Positioned with `position: absolute` and with no positioned box around it, it is
 * measured against the page, so a row longer than the column took the page sideways with nothing on the
 * screen to say why. Measured in Chrome on review of PR 728, 14.11.2026: the ring of a member with
 * unscored races, 360px and 200% text, `scrollWidth` 373 against `clientWidth` 360, the element over the
 * edge `TABLE.visually-hidden`; the same build with no unscored races gave no scroll at all, which is how
 * a screen can be right on every sample and wrong on the first long name.
 *
 * jsdom lays nothing out, so the width cannot be asked of it. What can be asked is what makes the width
 * not count: the box around the table is positioned and clips. The width itself is asked of Chrome
 * (`geometry/donutHiddenTable.geometry.ts`).
 *
 * And the set of tables this holds for is derived, so a second one written for the reader alone lands
 * here on the day it is written, with a box to find, rather than on the day it widens a page. */

const SRC = join(process.cwd(), 'src')

function sources(dir = SRC): { path: string; code: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const at = join(dir, entry.name)

    if (entry.isDirectory()) {
      return entry.name === 'test' ? [] : sources(at)
    }

    return /\.tsx$/.test(entry.name) && !entry.name.includes('.test.')
      ? [{ path: at.slice(SRC.length + 1).replaceAll('\\', '/'), code: readFileSync(at, 'utf-8') }]
      : []
  })
}

/** A table that wears the recipe, written in any order of its classes. */
const HIDDEN_TABLE = /<table\b[^>]*className="[^"]*\bvisually-hidden\b[^"]*"/

describe('a table drawn for the reader alone', () => {
  const drawing = sources().filter((one) => HIDDEN_TABLE.test(one.code))

  it('is drawn by the ring of categories and by nothing else, so the box below is the only one to find', () => {
    expect(drawing.map((one) => one.path)).toEqual(['components/CategoryDonut.tsx'])
  })

  it('stands in a box that is positioned and clips, so what is wider than the box is not the page', () => {
    const css = readFileSync(join(SRC, 'components', 'CategoryDonut.css'), 'utf-8')
    const box = ruleFor(css, '.donut-block', 'CategoryDonut.css')

    expect(box.getPropertyValue('position')).toBe('relative')
    expect(box.getPropertyValue('overflow')).toBe('clip')
  })

  it('stands directly in that box, not in a box further out that something else is also in', () => {
    const code = readFileSync(join(SRC, 'components', 'CategoryDonut.tsx'), 'utf-8')

    expect(code).toMatch(/<div className="donut-block">[\s\S]*<table className="visually-hidden">/)
    expect(code.match(/<div className="donut-block">/g)).toHaveLength(1)
  })
})
