import { screen, within } from '@testing-library/react'
import { ruleSentence, thresholdOf, type Badge } from '../data/badgeRule'
import { loadResource } from '../data/client'
import sr from '../i18n/sr.json'
import { translate, type Dictionary } from '../i18n/translate'
import { at, first } from '../test/at'
import { renderAt } from '../test/render'
import { setupUser } from '../test/user'

const dictionary = sr as Dictionary
const t = (key: string, params?: Record<string, string | number>) =>
  translate(dictionary, 'sr', key, params)

const badgesOf = () => loadResource<Badge[]>('badges')

/** The list of badges, once it has arrived. */
const wall = () => screen.findByRole('list', { name: 'Značke' })

/** What the badge on that card describes itself with, which is the sentence
 *  saying how it is earned. It is the accessible description at all times,
 *  drawn or not, because a fact only a mouse can reach is a fact most people do
 *  not have (WCAG 2.2 AA). */
function hintOf(item: HTMLElement): HTMLElement {
  const face = within(item).getByRole('button')
  const id = face.getAttribute('aria-describedby') ?? ''
  const hint = document.getElementById(id)

  if (hint === null) {
    throw new Error('the badge describes itself with an element that is not there')
  }

  return hint
}

describe('the badges screen', () => {
  it('lists every badge with its threshold and how it is earned', async () => {
    const badges = await badgesOf()
    renderAt('/sr/znacke')

    const items = within(await wall()).getAllByRole('listitem')
    expect(items).toHaveLength(badges.length)
    expect(badges.length).toBeGreaterThan(10)

    /* Walked over the badges rather than the cards, so the badge each assertion
       is about is held rather than looked up, and the card facing it is asked
       for by position because the position is what pairs the two. */
    badges.forEach((badge, index) => {
      const item = at(items, index)

      expect(item).toHaveTextContent(badge.name)
      // The threshold is on the mark itself, written for this language.
      expect(item).toHaveTextContent(thresholdOf(badge, 'sr'))
      // And the one thing a member came for.
      expect(hintOf(item)).toHaveTextContent(ruleSentence(badge, t, 'sr'))
    })
  })

  it('says how a badge with no description of its own is earned all the same', async () => {
    const badges = await badgesOf()
    const bare = badges.findIndex((badge) => badge.description === '')
    renderAt('/sr/znacke')

    expect(bare).toBeGreaterThan(-1)

    const item = at(within(await wall()).getAllByRole('listitem'), bare)
    expect(hintOf(item)).toHaveTextContent(ruleSentence(at(badges, bare), t, 'sr'))
  })

  it('carries the label of a badge that has one, and nothing in its place where there is none', async () => {
    const badges = await badgesOf()
    const withLabel = badges.findIndex((badge) => badge.label !== '')
    const without = badges.findIndex((badge) => badge.label === '')
    renderAt('/sr/znacke')

    const items = within(await wall()).getAllByRole('listitem')

    expect(at(items, withLabel)).toHaveTextContent(at(badges, withLabel).label)

    /* And the card with none says nothing where one would have stood. This used
       to assert that the card contains the name of its badge, which is true of
       every card there is and would go on passing while something quietly
       appeared under the mark: a period worked out from the rule is exactly the
       sort of thing somebody adds as a kindness (badgeRule.ts). Everything the
       card is allowed to say is listed, and whatever is left over is the thing
       that should not be there. */
    const bare = at(badges, without)
    const said = [thresholdOf(bare, 'sr'), bare.name, ruleSentence(bare, t, 'sr'), bare.description]
    const left = said.reduce(
      (text, part) => text.replace(part, ''),
      at(items, without).textContent ?? '',
    )

    expect(left.trim()).toBe('')
  })

  it('writes every period the way this language writes one, never as it is stored', async () => {
    const badges = await badgesOf()
    renderAt('/sr/znacke')

    const wall = await screen.findByRole('list', { name: 'Značke' })

    /* The rule of a badge carries a range of dates, and the sentence used to
       drop both of them in as they are stored: "računato od 2027-07-01 do
       2027-07-31" on a public page (PDL P28a, 30.07.2026). Where the two ends
       are a whole period, the sentence names the period. */
    expect(wall.textContent).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(wall).toHaveTextContent('računato za jul 2027.')
    expect(wall).toHaveTextContent('računato za 2027.')

    /* And it ends there. Every Serbian date already carries the full stop that
       makes it an ordinal, so an ending that adds one of its own reads
       "računato za jul 2027..", which is the sort of thing a test using
       toContain never sees and a reader sees at once. */
    expect(wall.textContent).not.toMatch(/\.\./)

    // And the two badges those sentences belong to are still in the data.
    expect(badges.some((badge) => badge.from === '2027-07-01' && badge.to === '2027-07-31')).toBe(
      true,
    )
    expect(badges.some((badge) => badge.from === '2027-01-01' && badge.to === '2027-12-31')).toBe(
      true,
    )
  })
})

describe('the badges the administrator has defined', () => {
  it('never label a badge with a year its rule does not cover', async () => {
    const badges = await badgesOf()

    /* The label is free text and the rule is data, so nothing but this holds
       them together. A badge read "Sezona 2027/2028" over a rule that ran from
       1 January to 31 December 2027: the coin said one thing and the sentence
       under it another, and neither said which was right. A BTL season is a
       calendar year (PDL P8, P12), so a label naming two of them names one the
       badge cannot be won in. */
    const wrong = badges.filter((badge) => {
      const years = [...badge.label.matchAll(/\d{4}/g)].map((match) => Number(match[0]))
      const fromYear = badge.from === '' ? -Infinity : Number(badge.from.slice(0, 4))
      const toYear = badge.to === '' ? Infinity : Number(badge.to.slice(0, 4))

      return years.some((year) => year < fromYear || year > toYear)
    })

    expect(wrong.map((badge) => badge.id)).toEqual([])
    // And the labels carrying a year are really in the data, so this cannot pass
    // by having nothing to check.
    expect(badges.filter((badge) => /\d{4}/.test(badge.label)).length).toBeGreaterThan(3)
  })
})

describe('the filters on the badges screen', () => {
  it('narrows the list by kind', async () => {
    const user = setupUser()
    const badges = await badgesOf()
    renderAt('/sr/znacke')

    await wall()
    await user.selectOptions(screen.getByLabelText('Vrsta značke'), 'marathonCount')

    const marathons = badges.filter((badge) => badge.kind === 'marathonCount')
    expect(marathons.length).toBeGreaterThan(0)
    expect(within(await wall()).getAllByRole('listitem')).toHaveLength(marathons.length)
  })

  /* The second filter is the period a badge is valid for, in the place where the
     screen this was modelled on filters by points. Badges here carry no points at
     all (PDL P16), and the period is the half of a rule that decides whether a
     badge can still be won. */
  it('narrows the list by the period a badge is valid for', async () => {
    const user = setupUser()
    const badges = await badgesOf()
    renderAt('/sr/znacke')

    await wall()
    await user.selectOptions(screen.getByLabelText('Period važenja'), 'period')

    const limited = badges.filter((badge) => badge.from !== '' || badge.to !== '')
    expect(limited.length).toBeGreaterThan(0)
    expect(within(await wall()).getAllByRole('listitem')).toHaveLength(limited.length)

    await user.selectOptions(screen.getByLabelText('Period važenja'), 'trajne')

    expect(within(await wall()).getAllByRole('listitem')).toHaveLength(
      badges.length - limited.length,
    )
  })

  it('says so when the two filters together leave nothing', async () => {
    const user = setupUser()
    renderAt('/sr/znacke')

    await wall()
    await user.selectOptions(screen.getByLabelText('Vrsta značke'), 'marathonCount')
    await user.selectOptions(screen.getByLabelText('Period važenja'), 'period')

    expect(screen.getByText('Nijedna značka ne odgovara izabranim filterima.')).toBeVisible()
    expect(screen.queryByRole('list', { name: 'Značke' })).not.toBeInTheDocument()
  })

  it('clears every filter at once and brings all of them back', async () => {
    const user = setupUser()
    const badges = await badgesOf()
    renderAt('/sr/znacke')

    await wall()
    await user.selectOptions(screen.getByLabelText('Vrsta značke'), 'totalKm')
    await user.selectOptions(screen.getByLabelText('Period važenja'), 'trajne')
    expect(within(await wall()).getAllByRole('listitem').length).toBeLessThan(badges.length)

    await user.click(screen.getByRole('button', { name: 'Obriši filtere' }))

    expect(within(await wall()).getAllByRole('listitem')).toHaveLength(badges.length)
    expect(screen.getByLabelText('Vrsta značke')).toHaveValue('')
    expect(screen.getByLabelText('Period važenja')).toHaveValue('')
  })

  it('puts one filter back to all without disturbing the other', async () => {
    const user = setupUser()
    const badges = await badgesOf()
    renderAt('/sr/znacke')

    await wall()
    await user.selectOptions(screen.getByLabelText('Period važenja'), 'trajne')
    await user.selectOptions(screen.getByLabelText('Vrsta značke'), 'totalKm')
    await user.selectOptions(screen.getByLabelText('Vrsta značke'), '')

    // Choosing "all kinds" is the absence of that filter, not a filter for
    // nothing, and the period the reader chose before it stays where it was.
    const forever = badges.filter((badge) => badge.from === '' && badge.to === '')
    expect(within(await wall()).getAllByRole('listitem')).toHaveLength(forever.length)
    expect(screen.getByLabelText('Period važenja')).toHaveValue('trajne')
  })

  it('offers only the kinds something has been defined for', async () => {
    const badges = await badgesOf()
    renderAt('/sr/znacke')

    await wall()
    const options = within(screen.getByLabelText('Vrsta značke')).getAllByRole('option')

    // Every kind in the data, and the entry that stands for all of them.
    expect(options).toHaveLength(new Set(badges.map((badge) => badge.kind)).size + 1)
    expect(options[0]).toHaveTextContent('Sve vrste')
  })
})

describe('the hint that says how a badge is earned', () => {
  it('opens on a tap and closes on the next one', async () => {
    const user = setupUser()
    renderAt('/sr/znacke')

    const face = first(within(await wall()).getAllByRole('button'))

    expect(face).toHaveAttribute('aria-expanded', 'false')

    await user.click(face)
    expect(face).toHaveAttribute('aria-expanded', 'true')

    await user.click(face)
    expect(face).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes with the escape key, and stays open under any other', async () => {
    const user = setupUser()
    renderAt('/sr/znacke')

    const face = first(within(await wall()).getAllByRole('button'))

    await user.click(face)
    await user.keyboard('{ArrowDown}')
    expect(face).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')
    expect(face).toHaveAttribute('aria-expanded', 'false')
  })

  it('sits on a control the keyboard can reach, which a hover alone is not', async () => {
    renderAt('/sr/znacke')

    const face = first(within(await wall()).getAllByRole('button'))
    face.focus()

    expect(face).toHaveFocus()
    expect(face.tagName).toBe('BUTTON')
  })
})
