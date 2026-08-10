import { screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ruleSentence, type DucatFamily } from '../data/ducatRule'
import { loadResource } from '../data/client'
import sr from '../i18n/sr.json'
import { translate, type Dictionary } from '../i18n/translate'
import { at, first, must } from '../test/at'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'

const dictionary = sr as Dictionary
const t = (key: string, params?: Record<string, string | number>) =>
  translate(dictionary, 'sr', key, params)

const familiesOf = () => loadResource<DucatFamily[]>('ducats')

const css = readFileSync(join(__dirname, 'DucatGallery.css'), 'utf8')

/** The wall of ducats, once it has arrived. It is drawn inside the rulebook,
 *  near the end of it, since the owner made it a section of that page rather
 *  than a screen of its own (04.08.2026). */
const wall = () => screen.findByRole('list', { name: 'Dukati' })

/** What the card describes itself with: the sentence saying how the ducat is
 *  earned. It is the accessible description at all times, drawn or not, because
 *  a fact only a mouse can reach is a fact most people do not have. */
function hintOf(item: HTMLElement): HTMLElement {
  const face = within(item).getByRole('button')
  const id = must(face.getAttribute('aria-describedby'), 'a description on the card')

  return must(document.getElementById(id), 'the element the card describes itself with')
}

describe('the wall of ducats in the rulebook', () => {
  it('stands in a section of its own, near the end and before the closing provisions', async () => {
    /* The owner asked for a described section with a good deal of drawing in
       it, towards the end of the rulebook (04.08.2026). Towards the end and not
       at it: what closes a rulebook is its closing provisions. */
    renderAt('/sr/pravilnik')

    const headings = (await screen.findAllByRole('heading', { level: 2 })).map(
      (heading) => heading.textContent ?? '',
    )

    expect(headings.at(-2)).toBe('19. Dukati')
    expect(headings.at(-1)).toBe('20. Izmene pravilnika i završne odredbe')
  })

  it('draws one coin per family, fifteen of them, three to a row and five rows', async () => {
    /* One per family and not one per ducat. Four families give a ducat every
       season and two give one every month, so the ducats that exist are
       fifty-five in the first season and grow by twenty-eight a year
       (ADL A12, 7). The rulebook describes the rule; the profile holds the
       ducats. */
    const families = await familiesOf()
    renderAt('/sr/pravilnik')

    const items = within(await wall()).getAllByRole('listitem')

    expect(families).toHaveLength(15)
    expect(items).toHaveLength(15)
    expect(css).toContain('grid-template-columns: repeat(3, 1fr)')
  })

  it('names each one in a couple of words, and never in a number', async () => {
    /* The owner asked for two or three words that say what a ducat is about and
       say nothing about how much (10.08.2026). The threshold is on the coin and
       in the sentence; a name that repeated it would say one number three
       times. */
    const families = await familiesOf()

    families.forEach((family) => {
      expect(family.name).not.toMatch(/\d/)
      expect(family.name.split(' ').length).toBeLessThanOrEqual(2)
    })
  })

  it('keeps a name on one line, however narrow the card is', async () => {
    // Also the owner's, the same day: the words under a coin do not wrap.
    expect(css).toContain('white-space: nowrap')

    const families = await familiesOf()
    renderAt('/sr/pravilnik')

    const items = within(await wall()).getAllByRole('listitem')
    expect(first(items)).toHaveTextContent(first(families).name)
  })

  it('runs from the one most people will win to the one nobody is expected to', async () => {
    /* The order is the owner's ranking of how hard they are to win, and it is
       the order of the file, because a judgement about difficulty is not a
       property of the data and nothing here can sort it back. */
    const families = await familiesOf()
    const values = families.map((family) => family.tier)

    expect(values).toEqual([...values].sort((one, other) => one - other))
    expect(first(families).tier).toBe(1)
    expect(at(families, families.length - 1).tier).toBe(5)
  })

  it('says how a ducat is earned, to a screen reader as well as to a mouse', async () => {
    const families = await familiesOf()
    renderAt('/sr/pravilnik')

    const items = within(await wall()).getAllByRole('listitem')

    families.forEach((family, index) => {
      const hint = hintOf(at(items, index))

      expect(hint).toHaveTextContent(ruleSentence(family, t, 'sr'))
      // And what it is worth, in words, because the metal says it in colour.
      expect(hint).toHaveTextContent(t(`ducats.tier${family.tier}`))
    })
  })

  it('shows the league both halves of itself where the wording has two', async () => {
    /* Three families read differently for a woman. With no member to read them
       for, the rulebook alternates the examples, so the wall does not silently
       address one half of the league (the owner, 10.08.2026: combine the two). */
    const families = await familiesOf()
    renderAt('/sr/pravilnik')

    const wallText = must((await wall()).textContent, 'a wall with words on it')
    const gendered = families.filter((family) => family.topFemale !== '')

    expect(gendered.length).toBeGreaterThan(1)
    expect(gendered.some((family) => wallText.includes(family.topFemale))).toBe(true)
    expect(gendered.some((family) => wallText.includes(family.top))).toBe(true)
  })

  it('opens a hint on a tap and closes it again without hunting for the spot', async () => {
    const user = setupUser()
    renderAt('/sr/pravilnik')

    const face = within(first(within(await wall()).getAllByRole('listitem'))).getByRole('button')

    await user.click(face)
    expect(face).toHaveAttribute('aria-expanded', 'true')

    // Every other key leaves it as it was: only Escape closes it.
    await user.keyboard('a')
    expect(face).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')
    expect(face).toHaveAttribute('aria-expanded', 'false')

    // And the same spot closes it too, for the hand that opened it there.
    await user.click(face)
    await user.click(face)
    expect(face).toHaveAttribute('aria-expanded', 'false')
  })

  it('says so in the section when the file yields nothing at all', async () => {
    /* The section of the rulebook is drawn whether or not the list arrives.
       Nothing in the data is an empty list, so the file is emptied here: without
       it the branch exists and nothing ever walks it. */
    const real = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/ducats.json')
        ? new Response('[]', { status: 200 })
        : real(input)) as typeof fetch

    try {
      renderAt('/sr/pravilnik')

      expect(await screen.findByText('Liga još nije uvela nijedan dukat.')).toBeVisible()
      expect(screen.queryByRole('list', { name: 'Dukati' })).not.toBeInTheDocument()
    } finally {
      globalThis.fetch = real
    }
  })
})
