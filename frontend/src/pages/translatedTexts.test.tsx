import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { configure, getConfig, screen, within } from '@testing-library/react'
import type { Competitor, EventComment, League, Price, ShownText, Team } from '../data/types'
import { renderAt } from '../test/render'
import { SLOW } from '../test/slow'

/**
 * THE TEXTS V115 ADDS, AS THEIR READER IS SHOWN THEM (owner, PDL P18, 25.11.2026, „Automatski prevod sadržaja koji
 * posetilac vidi"): the rules and the prizes of a league, the name of a row of the price list, the biography of a member,
 * the description of a team, a comment under an event and the five words of a ducat. Each is what the server says
 * that reader is shown (`...Shown`), marked with the language it is really in, and said to be the machine's only where
 * it is.
 *
 * <p><b>Its own server in front, answering the languages differently</b>, for the reason `test/setup.ts` gives: the
 * served file is one answer whatever was asked, so a case that reads it cannot tell a translation from a fallback.
 * Every case patches ONE record and leaves another beside it as the file has it, so a screen that drew the first
 * record's words for every record, or the words as written for the one that was translated, fails.
 */
configure({ asyncUtilTimeout: SLOW / 2 })

function mock<T>(name: string): T[] {
  const rows: T[] = JSON.parse(readFileSync(join(process.cwd(), 'src/test/mock', `${name}.json`), 'utf-8'))

  return rows
}

const MACHINE_ENGLISH = (text: string): ShownText => ({ text, language: 'en', machine: true })
const WRITTEN_SERBIAN = (text: string): ShownText => ({ text, language: 'sr', machine: false })

/** Serves `/api/<name>?lang=<language>` from the file, each record through `patch`, and every other address as it was. */
function serving<T>(
  name: string,
  patch: (one: T, language: string, at: number) => T,
  real: typeof globalThis.fetch,
): typeof globalThis.fetch {
  const asked = new RegExp(`^/api/${name}\\?lang=([a-z]+)$`)

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const language = asked.exec(String(input))?.[1]

    if (language === undefined || (init?.method ?? 'GET') !== 'GET') {
      return real(input, init)
    }

    return new Response(JSON.stringify(mock<T>(name).map((one, at) => patch(one, language, at))), { status: 200 })
  }
}

describe('what a reader is shown of the texts a machine translates', () => {
  const real = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = real
  })

  it('waits for half of the time a case has, so a wait that fails is a failure and not the clock', () => {
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })

  it('shows the rules of a league in English and the prizes as written, each marked, the machine said once', async () => {
    const leagues = mock<League>('leagues')
    const newest = Math.max(...leagues.map((one) => one.season))
    const mine = leagues.find((one) => one.season === newest && one.rules !== '' && one.prizes !== '')

    expect(mine).toBeDefined()

    globalThis.fetch = serving<League>(
      'leagues',
      (one, language) =>
        one.id === mine?.id
          ? {
              ...one,
              rulesShown: language === 'en' ? MACHINE_ENGLISH('THE RULES IN ENGLISH') : WRITTEN_SERBIAN(one.rules),
              prizesShown: WRITTEN_SERBIAN('THE PRIZES AS WRITTEN'),
            }
          : one,
      real,
    )
    renderAt('/en/lige', 'visitor', null)

    const rules = await screen.findByText('THE RULES IN ENGLISH')
    const prizes = await screen.findByText('THE PRIZES AS WRITTEN')

    expect(rules.closest('.markdown')).toHaveAttribute('lang', 'en')
    expect(prizes.closest('.markdown')).toHaveAttribute('lang', 'sr')
    expect(screen.getAllByText('Automatic translation')).toHaveLength(1)
    const rulesBox = rules.closest<HTMLElement>('.profile__text')
    const prizesBox = prizes.closest<HTMLElement>('.profile__text')

    expect(rulesBox).not.toBeNull()
    expect(prizesBox).not.toBeNull()
    expect(within(rulesBox ?? rules).getByText('Automatic translation')).toBeVisible()
    expect(within(prizesBox ?? prizes).queryByText('Automatic translation')).toBeNull()
  }, SLOW)

  it('shows the name of a row of the price list in English, in the cell of its own row', async () => {
    const rows = mock<Price>('pricing')
    const periods = rows.filter((one) => one.kind === 'period')
    const second = periods[1]

    expect(second).toBeDefined()

    globalThis.fetch = serving<Price>(
      'pricing',
      (one) => (one.key === second?.key ? { ...one, labelShown: MACHINE_ENGLISH('SECOND PERIOD IN ENGLISH') } : one),
      real,
    )
    renderAt('/en/pravilnik', 'visitor', null)

    const label = await screen.findByText('SECOND PERIOD IN ENGLISH')
    const cell = label.closest<HTMLElement>('td')

    expect(cell).not.toBeNull()
    expect(label).toHaveAttribute('lang', 'en')
    expect(within(cell ?? label).getByText('Automatic translation')).toBeVisible()
    /* The first period beside it is drawn as it was written, with no note. */
    expect(await screen.findByText(periods[0]?.label ?? '')).toBeVisible()
    expect(screen.getAllByText('Automatic translation')).toHaveLength(1)
  }, SLOW)

  it('shows the biography of a member in English, marked and said to be the machine, on his own page', async () => {
    const people = mock<Competitor>('competitors')
    const mine = people.find((one) => (one.bio ?? '') !== '' && !one.profileHidden)

    expect(mine).toBeDefined()

    globalThis.fetch = serving<Competitor>(
      'competitors',
      (one, language) =>
        one.memberNumber === mine?.memberNumber && language === 'en'
          ? { ...one, bioShown: MACHINE_ENGLISH('HIS BIOGRAPHY IN ENGLISH') }
          : one,
      real,
    )
    renderAt(`/en/takmicar/${mine?.memberNumber ?? ''}`, 'visitor', null)

    const words = await screen.findByText('HIS BIOGRAPHY IN ENGLISH')

    expect(words).toHaveAttribute('lang', 'en')
    expect(screen.getByText('Automatic translation')).toBeVisible()
    expect(screen.queryByText(mine?.bio ?? '')).toBeNull()
  }, SLOW)

  it('draws the biography as written on /sr, with no note', async () => {
    const people = mock<Competitor>('competitors')
    const mine = people.find((one) => (one.bio ?? '') !== '' && !one.profileHidden)

    globalThis.fetch = serving<Competitor>(
      'competitors',
      (one) =>
        one.memberNumber === mine?.memberNumber ? { ...one, bioShown: WRITTEN_SERBIAN(one.bio ?? '') } : one,
      real,
    )
    renderAt(`/sr/takmicar/${mine?.memberNumber ?? ''}`, 'visitor', null)

    const words = await screen.findByText(mine?.bio?.split(/\n{2,}/)[0] ?? '')

    expect(words).toHaveAttribute('lang', 'sr')
    expect(screen.queryByText('Automatski prevod')).toBeNull()
  }, SLOW)

  it('shows the description of a team in English, marked and said to be the machine, on its own page', async () => {
    const teams = mock<Team>('teams')
    const mine = teams.find((one) => one.bio !== '')

    expect(mine).toBeDefined()

    globalThis.fetch = serving<Team>(
      'teams',
      (one, language) =>
        one.slug === mine?.slug && language === 'en'
          ? { ...one, bioShown: MACHINE_ENGLISH('THE TEAM IN ENGLISH') }
          : one,
      real,
    )
    renderAt(`/en/tim/${mine?.slug ?? ''}`, 'visitor', null)

    const words = await screen.findByText('THE TEAM IN ENGLISH')

    expect(words).toHaveAttribute('lang', 'en')
    expect(screen.getByText('Automatic translation')).toBeVisible()
  }, SLOW)

  it('shows a comment under an event in English to a member, and the one beside it as written', async () => {
    const comments = mock<EventComment>('comments').filter((one) => one.body !== '')
    const events = mock<{ id: number; slug: string }>('events')
    const mine = comments[0]
    const slug = events.find((one) => one.id === mine?.eventId)?.slug

    expect(slug).toBeDefined()

    globalThis.fetch = serving<EventComment>(
      'comments',
      (one, language) =>
        one.id === mine?.id && language === 'en' ? { ...one, bodyShown: MACHINE_ENGLISH('THE COMMENT IN ENGLISH') } : one,
      real,
    )
    renderAt(`/en/kalendar/${slug ?? ''}`, 'competitor', '000001')

    const words = await screen.findByText('THE COMMENT IN ENGLISH')

    expect(words).toHaveAttribute('lang', 'en')
    expect(screen.getByText('Automatic translation')).toBeVisible()
    expect(screen.queryByText(mine?.body ?? '')).toBeNull()
  }, SLOW)

  it('draws the ducats with the English words the server says, name and legends', async () => {
    type Ducat = { id: string; name: string; top: string; bottom: string }

    globalThis.fetch = serving<Ducat>(
      'ducats',
      (one, language) =>
        language === 'en' && one.id === 'duk-sve-trke'
          ? {
              ...one,
              nameShown: { text: 'ALL THE RACES', language: 'en', machine: false },
              bottomShown: { text: 'RACES IN ENGLISH', language: 'en', machine: false },
            }
          : one,
      real,
    )
    renderAt('/en/pravilnik', 'visitor', null)

    expect(await screen.findByText('ALL THE RACES')).toBeVisible()
    /* A hand translation is never the machine's. */
    expect(screen.queryByText('Automatic translation')).toBeNull()
  }, SLOW)
})
