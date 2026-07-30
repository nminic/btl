import { screen, within } from '@testing-library/react'
import { ruleSentence, thresholdOf, type Badge } from '../data/badgeRule'
import { loadResource } from '../data/client'
import sr from '../i18n/sr.json'
import { translate, type Dictionary } from '../i18n/translate'
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

    items.forEach((item, index) => {
      const badge = badges[index]

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

    const item = within(await wall()).getAllByRole('listitem')[bare]
    expect(hintOf(item)).toHaveTextContent(ruleSentence(badges[bare], t, 'sr'))
  })

  it('carries the label of a badge that has one, and nothing where there is none', async () => {
    const badges = await badgesOf()
    const withLabel = badges.findIndex((badge) => badge.label !== '')
    const without = badges.findIndex((badge) => badge.label === '')
    renderAt('/sr/znacke')

    const items = within(await wall()).getAllByRole('listitem')

    expect(items[withLabel]).toHaveTextContent(badges[withLabel].label)
    expect(items[without]).toHaveTextContent(badges[without].name)
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

    const face = within(await wall()).getAllByRole('button')[0]

    expect(face).toHaveAttribute('aria-expanded', 'false')

    await user.click(face)
    expect(face).toHaveAttribute('aria-expanded', 'true')

    await user.click(face)
    expect(face).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes with the escape key, and stays open under any other', async () => {
    const user = setupUser()
    renderAt('/sr/znacke')

    const face = within(await wall()).getAllByRole('button')[0]

    await user.click(face)
    await user.keyboard('{ArrowDown}')
    expect(face).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')
    expect(face).toHaveAttribute('aria-expanded', 'false')
  })

  it('sits on a control the keyboard can reach, which a hover alone is not', async () => {
    renderAt('/sr/znacke')

    const face = within(await wall()).getAllByRole('button')[0]
    face.focus()

    expect(face).toHaveFocus()
    expect(face.tagName).toBe('BUTTON')
  })
})
