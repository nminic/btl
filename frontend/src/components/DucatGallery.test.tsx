import { screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ruleSentence, type DucatFamily } from '../data/ducatRule'
import { loadResource } from '../data/client'
import sr from '../i18n/sr.json'
import { translate } from '../i18n/translate'
import { at, first, must } from '../test/at'
import { renderAt } from '../test/render'

const dictionary = sr
const t = (key: string, params?: Record<string, string | number>) =>
  translate(dictionary, 'sr', key, params)

const familiesOf = () => loadResource<DucatFamily[]>('ducats')

const css = readFileSync(join(__dirname, 'DucatGallery.css'), 'utf8')

/** The wall of ducats, once it has arrived. It is drawn inside the rulebook,
 *  near the end of it, since the owner made it a section of that page rather
 *  than a screen of its own (04.08.2026). */
const wall = () => screen.findByRole('list', { name: 'Dukati' })

describe('the wall of ducats in the rulebook', () => {
  it('stands in a section of its own, near the end and before the closing provisions', async () => {
    /* The owner asked for a described section with a good deal of drawing in
       it, towards the end of the rulebook (04.08.2026). Towards the end and not
       at it: what closes a rulebook is its closing provisions. */
    renderAt('/sr/pravilnik')

    const headings = (await screen.findAllByRole('heading', { level: 2 })).map(
      (heading) => heading.textContent ?? '',
    )

    expect(headings.at(-2)).toBe('18. Dukati')
    expect(headings.at(-1)).toBe('19. Izmene pravilnika i završne odredbe')
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
      expect(family.name.split(' ').length).toBeLessThanOrEqual(3)
    })
  })

  it('keeps a name on one line, however narrow the card is', async () => {
    /* Also the owner's, the same day: the words under a coin do not wrap. Read
       through its own selector, because `nowrap` appears elsewhere in this file
       and a search over the whole of it passes while the name wraps. */
    expect(css).toMatch(/\.ducat__name\s*\{[^}]*white-space:\s*nowrap/)

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

  it('gives every coin a name, since nothing beside it says what it is', async () => {
    /* The card carried a hint until 11.08.2026, when the owner asked for the
       coins to stand still and for the words to be said once above them. The
       hint was what a screen reader was given, so each coin now carries its own
       name: what it is, how it is earned, and what it is worth. */
    const families = await familiesOf()
    renderAt('/sr/pravilnik')

    const items = within(await wall()).getAllByRole('listitem')

    families.forEach((family, index) => {
      const named = within(at(items, index)).getByRole('img')

      expect(named).toHaveAccessibleName(
        `${family.name}. ${ruleSentence(family, t, 'sr')} ${t(`ducats.tier.${family.tier}`)}`,
      )
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
    /* Alternating from the first, so which family speaks to whom is settled here
       and not by the order two of them happen to be in. */
    expect(wallText).toContain(first(gendered).topFemale)
    expect(wallText).toContain(at(gendered, 1).top)
    expect(wallText).not.toContain(first(gendered).top)
  })

  it('has nothing to press, and nothing that opens', async () => {
    /* The owner's instruction of 11.08.2026, in one assertion: the coins stand
       still. No control, no hover, no state, and no explanation under a coin. */
    renderAt('/sr/pravilnik')

    const inside = within(await wall())

    expect(inside.queryAllByRole('button')).toEqual([])
    expect(inside.queryAllByRole('link')).toEqual([])
  })

  it('says so in the section when the file yields nothing at all', async () => {
    /* The section of the rulebook is drawn whether or not the list arrives.
       Nothing in the data is an empty list, so the file is emptied here: without
       it the branch exists and nothing ever walks it. */
    const real = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      String(input).endsWith('/ducats.json')
        ? new Response('[]', { status: 200 })
        : real(input))

    try {
      renderAt('/sr/pravilnik')

      expect(await screen.findByText('Liga još nije uvela nijedan dukat.')).toBeVisible()
      expect(screen.queryByRole('list', { name: 'Dukati' })).not.toBeInTheDocument()
    } finally {
      globalThis.fetch = real
    }
  })

  it('is the fifteen the owner named, each with the rule he gave it', async () => {
    /* The list is closed and nobody may add to it (PDL P16), so the file is the
       specification and this is the only thing holding the two together. Without
       it a threshold, a period or a value could be edited and every other test
       here would stay green: they count the families, read their order and read
       their names, and none of them reads a rule. */
    const families = await familiesOf()
    const said = families.map((one) => [
      one.id,
      one.kind,
      one.value,
      one.period,
      one.tier,
      one.step,
      one.last,
      one.tierUpFrom,
      one.counted,
    ])

    expect(said).toEqual([
      ['duk-mesecni-km', 'totalKm', 125, 'month', 1, 0, 0, 0, ''],
      ['duk-mesecni-sati', 'totalTime', 20, 'month', 1, 0, 0, 0, ''],
      ['duk-sezonski-km', 'totalKm', 1000, 'season', 2, 0, 0, 0, ''],
      ['duk-sezonski-bodovi', 'points', 1000, 'season', 2, 0, 0, 0, ''],
      ['duk-sezonski-sati', 'totalTime', 200, 'season', 2, 0, 0, 0, ''],
      ['duk-sezonske-trke', 'raceCount', 50, 'season', 2, 0, 0, 0, ''],
      ['duk-drzave', 'countryCount', 10, 'always', 3, 10, 100, 50, 'država'],
      ['duk-sve-trke', 'raceCount', 100, 'always', 3, 100, 1000, 500, 'trka'],
      ['duk-krace-trke', 'shortCount', 100, 'always', 3, 0, 0, 0, ''],
      ['duk-polumaratoni', 'halfCount', 100, 'always', 3, 0, 0, 0, ''],
      ['duk-duze-trke', 'longCount', 100, 'always', 4, 0, 0, 0, ''],
      ['duk-maratoni', 'marathonCount', 100, 'always', 4, 0, 0, 0, ''],
      ['duk-uspon', 'totalAscent', 100000, 'always', 4, 0, 0, 0, ''],
      ['duk-ultramaratoni', 'ultraCount', 100, 'always', 4, 0, 0, 0, ''],
      ['duk-obim-planete', 'totalKm', 40075, 'always', 5, 0, 0, 0, ''],
    ])
  })
})
