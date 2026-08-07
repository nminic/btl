import { screen, within } from '@testing-library/react'
import { ruleSentence, thresholdOf, type Ducat } from '../data/ducatRule'
import { loadResource } from '../data/client'
import sr from '../i18n/sr.json'
import { translate, type Dictionary } from '../i18n/translate'
import { at, first } from '../test/at'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'

const dictionary = sr as Dictionary
const t = (key: string, params?: Record<string, string | number>) =>
  translate(dictionary, 'sr', key, params)

const ducatsOf = () => loadResource<Ducat[]>('ducats')

/** The wall of ducats, once it has arrived. It is drawn inside the rulebook,
 *  near the end of it, since the owner made it a section of that page rather
 *  than a screen of its own (04.08.2026). */
const wall = () => screen.findByRole('list', { name: 'Dukati' })

/** What the ducat on that card describes itself with, which is the sentence
 *  saying how it is earned. It is the accessible description at all times,
 *  drawn or not, because a fact only a mouse can reach is a fact most people do
 *  not have (WCAG 2.2 AA). */
function hintOf(item: HTMLElement): HTMLElement {
  const face = within(item).getByRole('button')
  const id = face.getAttribute('aria-describedby') ?? ''
  const hint = document.getElementById(id)

  if (hint === null) {
    throw new Error('the ducat describes itself with an element that is not there')
  }

  return hint
}

describe('the wall of ducats in the rulebook', () => {
  it('stands in a section of its own, near the end and before the closing provisions', async () => {
    /* Owner, 04.08.2026: "Značke treba da bude opisna sekcija (sa dosta grafike)
       pred kraj Pravilnika." Near the end and not at it: what closes a rulebook
       is its closing provisions. */
    renderAt('/sr/pravilnik')

    const headings = (await screen.findAllByRole('heading', { level: 2 })).map(
      (heading) => heading.textContent ?? '',
    )

    expect(headings.at(-2)).toBe('19. Dukati')
    expect(headings.at(-1)).toBe('20. Izmene pravilnika i završne odredbe')
  })

  it('lists every ducat with its threshold and how it is earned', async () => {
    const ducats = await ducatsOf()
    renderAt('/sr/pravilnik')

    const items = within(await wall()).getAllByRole('listitem')
    expect(items).toHaveLength(ducats.length)
    expect(ducats.length).toBeGreaterThan(10)

    /* Walked over the ducats rather than the cards, so the ducat each assertion
       is about is held rather than looked up, and the card facing it is asked
       for by position because the position is what pairs the two. */
    ducats.forEach((ducat, index) => {
      const item = at(items, index)

      expect(item).toHaveTextContent(ducat.name)
      // The threshold is on the mark itself, written for this language.
      expect(item).toHaveTextContent(thresholdOf(ducat, 'sr'))
      // And the one thing a member came for.
      expect(hintOf(item)).toHaveTextContent(ruleSentence(ducat, t, 'sr'))
    })
  })

  it('shows all of them, since nothing here filters any more', async () => {
    /* The screen this replaced had two filters, by kind and by the period a
       ducat is valid for. What they answered was "which of these can I still
       win", which is a question about a member and not about the rules; the
       section of a rulebook shows the rules, all of them. */
    const ducats = await ducatsOf()
    renderAt('/sr/pravilnik')

    await wall()

    expect(screen.queryByLabelText('Vrsta dukata')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Period važenja')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Obriši filtere' })).not.toBeInTheDocument()
    expect(within(await wall()).getAllByRole('listitem')).toHaveLength(ducats.length)
  })

  it('says how a ducat with no description of its own is earned all the same', async () => {
    const ducats = await ducatsOf()
    const bare = ducats.findIndex((ducat) => ducat.description === '')
    renderAt('/sr/pravilnik')

    expect(bare).toBeGreaterThan(-1)

    const item = at(within(await wall()).getAllByRole('listitem'), bare)
    expect(hintOf(item)).toHaveTextContent(ruleSentence(at(ducats, bare), t, 'sr'))
  })

  it('carries the label of a ducat that has one, and nothing in its place where there is none', async () => {
    const ducats = await ducatsOf()
    const withLabel = ducats.findIndex((ducat) => ducat.label !== '')
    const without = ducats.findIndex((ducat) => ducat.label === '')
    renderAt('/sr/pravilnik')

    const items = within(await wall()).getAllByRole('listitem')

    expect(at(items, withLabel)).toHaveTextContent(at(ducats, withLabel).label)

    /* And the card with none says nothing where one would have stood. This used
       to assert that the card contains the name of its ducat, which is true of
       every card there is and would go on passing while something quietly
       appeared under the mark: a period worked out from the rule is exactly the
       sort of thing somebody adds as a kindness (ducatRule.ts). Everything the
       card is allowed to say is listed, and whatever is left over is the thing
       that should not be there. */
    const bare = at(ducats, without)
    const said = [thresholdOf(bare, 'sr'), bare.name, ruleSentence(bare, t, 'sr'), bare.description]
    const left = said.reduce(
      (text, part) => text.replace(part, ''),
      at(items, without).textContent ?? '',
    )

    expect(left.trim()).toBe('')
  })

  it('writes every period the way this language writes one, never as it is stored', async () => {
    const ducats = await ducatsOf()
    renderAt('/sr/pravilnik')

    const list = await wall()

    /* The rule of a ducat carries a range of dates, and the sentence used to
       drop both of them in as they are stored: "računato od 2027-07-01 do
       2027-07-31" on a public page (PDL P28a, 30.07.2026). Where the two ends
       are a whole period, the sentence names the period. */
    expect(list.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(list).toHaveTextContent('računato za jul 2027.')
    expect(list).toHaveTextContent('računato za 2027.')

    /* And it ends there. Every Serbian date already carries the full stop that
       makes it an ordinal, so an ending that adds one of its own reads
       "računato za jul 2027..", which is the sort of thing a test using
       toContain never sees and a reader sees at once. */
    expect(list.textContent).not.toMatch(/\.\./)

    // And the two ducats those sentences belong to are still in the data.
    expect(ducats.some((ducat) => ducat.from === '2027-07-01' && ducat.to === '2027-07-31')).toBe(
      true,
    )
    expect(ducats.some((ducat) => ducat.from === '2027-01-01' && ducat.to === '2027-12-31')).toBe(
      true,
    )
  })
})

describe('a league that has defined no ducat at all', () => {
  it('says so in the section rather than leaving it with a heading and nothing under it', async () => {
    /* The ducats are records an administrator maintains, and the section of the
       rulebook is drawn whether or not there are any. Nothing in the generated
       data is an empty list, so the file is emptied here: without it the branch
       exists and nothing ever walks it. */
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

describe('the ducats the administrator has defined', () => {
  it('never label a ducat with a year its rule does not cover', async () => {
    const ducats = await ducatsOf()

    /* The label is free text and the rule is data, so nothing but this holds
       them together. A ducat read "Sezona 2027/2028" over a rule that ran from
       1 January to 31 December 2027: the coin said one thing and the sentence
       under it another, and neither said which was right. A BTL season is a
       calendar year (PDL P8, P12), so a label naming two of them names one the
       ducat cannot be won in. */
    const wrong = ducats.filter((ducat) => {
      const years = [...ducat.label.matchAll(/\d{4}/g)].map((match) => Number(match[0]))
      const fromYear = ducat.from === '' ? -Infinity : Number(ducat.from.slice(0, 4))
      const toYear = ducat.to === '' ? Infinity : Number(ducat.to.slice(0, 4))

      return years.some((year) => year < fromYear || year > toYear)
    })

    expect(wrong.map((ducat) => ducat.id)).toEqual([])
    // And the labels carrying a year are really in the data, so this cannot pass
    // by having nothing to check.
    expect(ducats.filter((ducat) => /\d{4}/.test(ducat.label)).length).toBeGreaterThan(3)
  })
})

describe('the hint that says how a ducat is earned', () => {
  it('opens on a tap and closes on the next one', async () => {
    const user = setupUser()
    renderAt('/sr/pravilnik')

    const face = first(within(await wall()).getAllByRole('button'))

    expect(face).toHaveAttribute('aria-expanded', 'false')

    await user.click(face)
    expect(face).toHaveAttribute('aria-expanded', 'true')

    await user.click(face)
    expect(face).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes with the escape key, and stays open under any other', async () => {
    const user = setupUser()
    renderAt('/sr/pravilnik')

    const face = first(within(await wall()).getAllByRole('button'))

    await user.click(face)
    await user.keyboard('{ArrowDown}')
    expect(face).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')
    expect(face).toHaveAttribute('aria-expanded', 'false')
  })

  it('sits on a control the keyboard can reach, which a hover alone is not', async () => {
    renderAt('/sr/pravilnik')

    const face = first(within(await wall()).getAllByRole('button'))
    face.focus()

    expect(face).toHaveFocus()
    expect(face.tagName).toBe('BUTTON')
  })
})
