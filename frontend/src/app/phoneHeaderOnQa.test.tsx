import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { matchingMedia } from '../test/media'
import { renderAt } from '../test/render'
import { SLOW } from '../test/slow'
import { PHONE_HEADER } from './phoneHeader'

/**
 * THE TWO DEVELOPMENT CONTROLS OF QA IN THE HEADER OF A TELEPHONE. Only QA draws them, and QA is where the
 * owner reads the portal on his telephone, so where they stand is asked as well: in a row of their own
 * under the mark and the language, which keep the first row to themselves (owner, 16.11.2026: „u prvom
 * redu ide logo BTL sa tekstom i motoom, a pored izbor jezika”), and read in that order, after the
 * language and before the words. On a desktop as well since 17.11.2026, in a row of their own under the
 * first one.
 */

const realMatchMedia = window.matchMedia

afterEach(() => {
  window.matchMedia = realMatchMedia
})

/** Whether `one` comes before `other` in the document, and is not inside it or around it. */
function before(one: Element, other: Element): boolean {
  return !one.contains(other) && !other.contains(one) && Boolean(one.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING)
}

describe('the development controls of QA', () => {
  it('stand after the language and before the words on a telephone', async () => {
    window.matchMedia = matchingMedia((query) => query === PHONE_HEADER)
    renderAt('/sr')

    const role = await screen.findByRole('combobox', { name: 'Uloga' })
    const language = screen.getByRole('button', { name: 'Jezik, SR' })
    const first = screen.getByRole('link', { name: 'Takmičari' })

    expect(before(language, role)).toBe(true)
    expect(before(role, first)).toBe(true)
  }, SLOW)

  /* ON A DESKTOP TOO, IN A ROW OF THEIR OWN (owner, 17.11.2026: „na tablet verziji izbor jezika, koverta i
     profilna slicica treba da ostanu u redu gde je logo, posto se dole reci ispisuju cele za navigaciju.”).
     They stood before the language until that day and, being 278px wide, took it and the two links of a
     visitor down into a second row on QA from 700 to 1024px. Asked of what holds the language and the two
     links together, which is the first row's end: the controls are not in it, and they come after it and
     before the words. That the row is where the mark is, is the geometry's (`phoneHeader.geometry.ts`). */
  it('stand in a row of their own on a desktop, after the language and the links of a visitor and before the words', async () => {
    renderAt('/sr')

    const role = await screen.findByRole('combobox', { name: 'Uloga' })
    const language = screen.getByRole('button', { name: 'Jezik, SR' })
    const join = await screen.findByRole('link', { name: 'Učlani se' })
    const first = screen.getByRole('link', { name: 'Takmičari' })
    let tools = language.parentElement

    while (tools !== null && !tools.contains(join)) {
      tools = tools.parentElement
    }

    expect(tools?.contains(role)).toBe(false)
    expect(before(join, role)).toBe(true)
    expect(before(role, first)).toBe(true)
  }, SLOW)
})
