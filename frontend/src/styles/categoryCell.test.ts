import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ruleFor } from '../test/stylesheet'

/* The sheet half of one guard in two halves. The category is written `M 25-39` (owner,
   18.10.2026, PDL P7), and with the space in it the label can break after the letter and after
   the hyphen: measured at 360px on the standing, ten rows of twenty-two stood on two lines. The
   rule keeps it on one; the other half, that the cells of the standing, of the page of a team
   and of the members in administration carry the class, is held where each is drawn
   (`pages/publicScreens.test.tsx`, `pages/details.test.tsx`, `pages/admin/adminMemberWrites.test.tsx`).
   Neither half says anything without the other: the rule on a class nothing wears, and the class
   on a cell the sheet does not know. */
describe('the category cell of a table', () => {
  it('is kept on one line', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/table.css'), 'utf-8')

    expect(ruleFor(css, '.table__category', 'table.css').getPropertyValue('white-space')).toBe('nowrap')
  })
})
