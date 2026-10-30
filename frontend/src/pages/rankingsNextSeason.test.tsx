import { screen, within } from '@testing-library/react'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { serverThat } from '../test/serverAnswers'
import { SLOW } from '../test/slow'
import { aCompetitor } from '../test/theAnswer'

/**
 * THE TABLE OFFERS THE SEASON THAT HAS NOT BEGUN, FROM THE DAY THE WINDOW OPENS, AND FILLS IT WITH THE
 * MEMBERS WHO STAND IN IT (PDL, owner, 26.09.2026 and 18.10.2026).
 *
 * Owner, 26.09.2026: „Dotle zavisno od toga sta izabere, on se prikazuje u adekvatnim porecima za
 * narednu sezonu", and 18.10.2026: „2028 ce tek od [11.11] moci da se izabere i da se puni
 * novoprijavljenim / uplacenim takmicarima. Pre 2027 NE POSTOJE SEZONE NI U FILTERU NITI BILO GDE!"
 *
 * **The days are of 2027 and 2028 and not of 2026, and that is the finding and not a choice.** In 2026
 * the season shown is already 2027 and 2027 is also the season a transfer lands in, so there is no
 * second season to offer until 11 November 2027. The days of 2026 are here as the control: nothing
 * appears on them.
 *
 * **Four members and four ways of holding the two seasons**, on answers written for this case
 * (`test/serverAnswers.ts`), because the generated files hold the imported history and nobody in them
 * has a category of 2028:
 * both seasons, 2027 alone, 2028 alone, and neither. The one who holds both has a different category in
 * each, so a column read from the wrong season shows the wrong word. And the day the page is READ on is
 * the clock while the day the result was RUN on is the date it carries (May of 2027), so the two never
 * share a value.
 */

const BOTH = '000301'
const ONLY_2027 = '000302'
const ONLY_2028 = '000303'
const NEITHER = '000304'

function aMember(memberNumber: string, categories: { season: number; beginner: boolean }[]) {
  return {
    ...aCompetitor,
    memberNumber,
    firstName: 'Ime',
    lastName: memberNumber,
    category: null,
    categories: categories.map((one) => ({ ...one, ageBand: '40-54' as const })),
    teamId: null,
    teamSince: null,
    photo: null,
    crop: null,
    smallPhoto: null,
  }
}

const MEMBERS = [
  aMember(BOTH, [
    { season: 2027, beginner: false },
    { season: 2028, beginner: true },
  ]),
  aMember(ONLY_2027, [{ season: 2027, beginner: false }]),
  aMember(ONLY_2028, [{ season: 2028, beginner: false }]),
  aMember(NEITHER, []),
]

/** The only result there is: one of the member who holds both, in May of the first season. */
const RESULTS = [
  {
    id: 710_001,
    memberNumber: BOTH,
    raceId: 275,
    raceName: 'Trka',
    eventName: 'Trka',
    eventSlug: 'trka',
    date: '2027-05-02',
    distanceKm: 10,
    ascentM: 100,
    descentM: 100,
    seconds: 3000,
    points: 10,
    category: 'short',
    inItsSeason: true,
    inItsStanding: true,
  },
]

function answering() {
  const answers = new Map<string, unknown[]>([
    ['/api/competitors', MEMBERS],
    ['/api/results', RESULTS],
  ])

  return serverThat((path) => {
    const answer = answers.get(path)

    return answer === undefined
      ? null
      : new Response(JSON.stringify(answer), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
  })
}

const HALF = SLOW / 2

async function control(): Promise<HTMLSelectElement> {
  const found = await screen.findByLabelText('Sezona', {}, { timeout: HALF })

  if (!(found instanceof HTMLSelectElement)) {
    throw new Error('the season control is not a select')
  }

  return found
}

function offered(select: HTMLSelectElement): string[] {
  return within(select)
    .getAllByRole('option')
    .map((one) => one.textContent ?? '')
}

type Drawn = { number: string; category: string; races: string; points: string; podium: boolean }

/** The rows of the standing as drawn: who, in which category, with what, and whether the row is gold. */
async function standing(): Promise<Drawn[]> {
  const table = await screen.findByRole('table', {}, { timeout: HALF })

  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => {
      const cells = within(row).getAllByRole('cell')

      return {
        number: (must(cells[1], 'the member cell').textContent ?? '').match(/\d{6}/)?.[0] ?? '',
        category: must(cells[2], 'the category cell').textContent ?? '',
        races: must(cells[3], 'the races cell').textContent ?? '',
        points: must(cells.at(-1), 'the points cell').textContent ?? '',
        podium: row.className.includes('podium'),
      }
    })
}

const NUMBERS = (rows: Drawn[]) => rows.map((row) => row.number)

describe('the table, in the transfer window of the first season', () => {
  it.each(['2027-11-11', '2027-12-31'])('offers 2028 above 2027 on %s and opens on 2027', async (day) => {
    const { stop } = answering()

    try {
      renderAt('/sr/tabela', 'visitor', null, undefined, day)

      const select = await control()

      expect(offered(select)).toEqual(['2028', '2027'])
      expect(select.value).toBe('2027')
    } finally {
      stop()
    }
  }, SLOW)

  it('draws 2027 as it was: the member who raced first, then the one who holds 2027 and has not raced', async () => {
    const { stop } = answering()

    try {
      renderAt('/sr/tabela', 'visitor', null, undefined, '2027-11-11')

      const rows = await standing()

      expect(NUMBERS(rows)).toEqual([BOTH, ONLY_2027])
      /* The category of THIS season, which for the member who holds both is the age one. */
      expect(rows.map((row) => row.category)).toEqual(['M 40-54', 'M 40-54'])
      expect(rows.map((row) => row.points)).toEqual(['10,00', '0,00'])
      expect(rows.map((row) => row.podium)).toEqual([true, false])
    } finally {
      stop()
    }
  }, SLOW)

  it('draws 2028 with everybody who holds it, none of them placed on a result and none of them gold', async () => {
    const { stop } = answering()

    try {
      renderAt('/sr/tabela?sezona=2028', 'visitor', null, undefined, '2027-11-11')

      const select = await control()
      const rows = await standing()

      expect(select.value).toBe('2028')
      /* Who holds 2028 and nobody else: not the one who holds 2027 alone, not the one who holds neither,
         and not a row for a result the member who holds both ran in 2027. */
      expect(NUMBERS(rows)).toEqual([BOTH, ONLY_2028])
      /* The category of THAT season: the beginners' one the member chose for it, not the age one he has
         in the season shown. */
      expect(rows.map((row) => row.category)).toEqual(['Početnici', 'M 40-54'])
      expect(rows.map((row) => row.races)).toEqual(['0', '0'])
      expect(rows.map((row) => row.points)).toEqual(['0,00', '0,00'])
      expect(rows.map((row) => row.podium)).toEqual([false, false])
    } finally {
      stop()
    }
  }, SLOW)

  it('narrows 2028 by the categories of 2028, and by none of 2027', async () => {
    const { stop } = answering()

    try {
      renderAt('/sr/tabela?sezona=2028&kategorija=M%20R', 'visitor', null, undefined, '2027-11-11')

      expect(NUMBERS(await standing())).toEqual([BOTH])
    } finally {
      stop()
    }
  }, SLOW)
})

describe('the table, before the window and in 2026', () => {
  it.each(['2027-11-10', '2027-03-01', '2026-11-10', '2026-11-11', '2026-12-31'])(
    'offers 2027 alone on %s, and an address that names 2028 shows 2027',
    async (day) => {
      const { stop } = answering()

      try {
        renderAt('/sr/tabela?sezona=2028', 'visitor', null, undefined, day)

        const select = await control()
        const rows = await standing()

        expect(offered(select)).toEqual(['2027'])
        expect(select.value).toBe('2027')
        expect(NUMBERS(rows)).toEqual([BOTH, ONLY_2027])
      } finally {
        stop()
      }
    },
    SLOW,
  )
})

describe('the table, once 2028 has begun', () => {
  it('opens on 2028 with the members who hold it, and 2027 is frozen with the member who raced alone', async () => {
    const { stop } = answering()

    try {
      renderAt('/sr/tabela', 'visitor', null, undefined, '2028-01-01')

      const select = await control()

      expect(offered(select)).toEqual(['2028', '2027'])
      expect(select.value).toBe('2028')
      expect(NUMBERS(await standing())).toEqual([BOTH, ONLY_2028])
    } finally {
      stop()
    }
  }, SLOW)

  it('draws the season that has been run as it was run: a member who did not race is not placed in it', async () => {
    const { stop } = answering()

    try {
      renderAt('/sr/tabela?sezona=2027', 'visitor', null, undefined, '2028-01-01')

      expect(NUMBERS(await standing())).toEqual([BOTH])
    } finally {
      stop()
    }
  }, SLOW)
})
