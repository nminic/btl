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
 * language and before the words. On a desktop they stand where they always stood, before the language.
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

  it('stand before the language on a desktop, as they always did', async () => {
    renderAt('/sr')

    const role = await screen.findByRole('combobox', { name: 'Uloga' })
    const language = screen.getByRole('button', { name: 'Jezik, SR' })

    expect(before(role, language)).toBe(true)
  }, SLOW)
})
