import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, waitFor, within } from '@testing-library/react'
import { clearResourceCache } from '../../data/client'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { answeringCategory, refused, serverThat, type Asked, type CategoryAnswered } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { neverPaidAsServed } from '../../test/neverPaid'
import { aCompetitor, asAnswered } from '../../test/theAnswer'
import { setupUser } from '../../test/user'

/**
 * A CATEGORY CHOSEN ON „MOJA ČLANARINA" IS THE CATEGORY EVERY SCREEN OF THE VISIT SHOWS, AT ONCE AND
 * IN BOTH DIRECTIONS.
 *
 * <p>PDL P7, owner, 18.10.2026 („Izbor kategorije se vidi odmah i svuda, u oba smera"): „to treba da
 * bude vidljivo ... i baš svuda svuda da ostane. Ako vratim na starosnu, treba svuda da se promeni
 * ponovo", and the list it names: „profil, kartica takmičara, tim, administracija, dugmad i kolona u
 * tabeli odmah pokazuju novu kategoriju, bez osvežavanja strane". Measured on QA before it: the choice
 * was written and no other screen of the visit said so, because `data/client.ts` asks for the list
 * of members once per visit.
 *
 * <p><b>The list served here never changes its mind</b>: it goes on carrying the wish the member had
 * before he pressed, however often it is asked. So a screen that shows the new category got it from
 * this visit's overlay (`member/useMyCategory.ts`) and from nowhere else, and the dropped cache is
 * counted separately, as requests. Two sources, two cases, and neither can stand in for the other.
 *
 * <p>The reader is 000013 Damjan Krstić, a man of 40-54 in Dunavski trkači, and never the first on
 * the list: 000002 Relja Momčilović is the same sex and band and comes before him, and 000019 Borivoje
 * Jovanović after, so a write that landed on the wrong row is a row that changes when it must not.
 */

const ME = '000013'
const HER = '000012'
const DAY = '2026-10-20'

type FileMember = Record<string, unknown> & { memberNumber: string; active: boolean }

const file: FileMember[] = JSON.parse(
  readFileSync(join(process.cwd(), 'src/test/mock/competitors.json'), 'utf-8'),
)

/** The list as the server serves it, with the wishes it holds. Fixed for the whole case. */
function theListWith(wishes: Record<string, boolean>): string {
  return JSON.stringify(
    file
      .filter((one) => one.active)
      .map((one) => ({
        ...asAnswered(one, aCompetitor),
        firstSeason2027: wishes[one.memberNumber] ?? one.firstSeason2027,
      })),
  )
}

const choice = (firstSeason: boolean, category: string, season = 2027): CategoryAnswered => ({
  season,
  firstSeason,
  firstSeasonAllowed: true,
  category,
  open: true,
})

/** A server holding the list fixed, and answering the choice as the case says. */
function theServer({
  wishes = {},
  before,
  written,
}: {
  wishes?: Record<string, boolean>
  before: CategoryAnswered
  written: () => Response
}): { asked: Asked[]; stop: () => void } {
  clearResourceCache()
  const list = theListWith(wishes)

  return serverThat((path, init) => {
    if (path === '/api/competitors') {
      return new Response(list, { status: 200, headers: { 'content-type': 'application/json' } })
    }

    if (path === '/api/me/category') {
      return init?.method === 'PUT' ? written() : answeringCategory(before)
    }

    return null
  })
}

const listsAsked = (asked: Asked[]): number => asked.filter((one) => one.path === '/api/competitors').length

/** The row of one member in the table on the screen, found by the name it carries. */
async function rowOf(name: string): Promise<HTMLElement> {
  /* Every table on the screen, because a team's page draws more than one. */
  const tables = await screen.findAllByRole('table', {}, { timeout: SLOW / 2 })

  return must(
    tables
      .flatMap((table) => within(table).getAllByRole('row'))
      .find((row) => row.textContent?.includes(name) === true && row.querySelector('.table__category') !== null),
    `the row of ${name}`,
  )
}

/** The members the table answers for the category asked for, by member number. */
async function numbersUnder(router: { navigate: (to: string) => Promise<void> }, code: string): Promise<string[]> {
  await router.navigate(`/sr/tabela?kategorija=${encodeURIComponent(code)}`)
  await screen.findByRole('button', { name: 'Početnici', pressed: true }, { timeout: SLOW / 2 })

  return within(await screen.findByRole('table', {}, { timeout: SLOW / 2 }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.textContent?.match(/\d{6}/)?.[0] ?? '')
}

const categoryIn = (row: HTMLElement): string =>
  must(row.querySelector('.table__category'), 'the category cell').textContent ?? ''

async function choose(user: ReturnType<typeof setupUser>, band: 'U početničkoj kategoriji' | 'U svojoj starosnoj kategoriji') {
  await user.click(await screen.findByRole('radio', { name: band }, { timeout: SLOW / 2 }))
}

describe('a category chosen on „Moja članarina"', () => {
  it('is the category of his row in the table and of the buttons over it at once, though the list still says the age band', async () => {
    const user = setupUser()
    const server = theServer({ before: choice(false, 'M40-54'), written: () => answeringCategory(choice(true, 'M R')) })

    try {
      const { router } = renderAt('/sr/moja-clanarina', 'competitor', ME, undefined, DAY)

      await choose(user, 'U početničkoj kategoriji')
      expect(await screen.findByText('U sezoni 2027 takmičiš se u kategoriji: Početnici')).toBeVisible()

      await router.navigate('/sr/tabela')

      expect(categoryIn(await rowOf('Damjan Krstić'))).toBe('Početnici')
      /* Nobody else's: the one before him on the list and the one after keep their band. */
      expect(categoryIn(await rowOf('Relja Momčilović'))).toBe('M 40-54')
      expect(categoryIn(await rowOf('Borivoje Jovanović'))).toBe('M 40-54')
      /* And the button for the category takes him in: pressed, it answers him among the beginners. */
      expect(await numbersUnder(router, 'M R')).toContain(ME)
    } finally {
      server.stop()
    }
  }, SLOW)

  it('is what his card, his profile and his team say, in the same visit', async () => {
    const user = setupUser()
    const server = theServer({ before: choice(false, 'M40-54'), written: () => answeringCategory(choice(true, 'M R')) })

    try {
      const { router } = renderAt('/sr/moja-clanarina', 'competitor', ME, undefined, DAY)

      await choose(user, 'U početničkoj kategoriji')
      await screen.findByText('U sezoni 2027 takmičiš se u kategoriji: Početnici')

      await router.navigate('/sr/takmicari')
      const card = must(
        (await screen.findByRole('link', { name: /Damjan Krstić/ }, { timeout: SLOW / 2 })).closest('li'),
        'his card',
      )

      expect(within(card).getByText('Početnici')).toBeVisible()

      await router.navigate(`/sr/takmicar/${ME}`)
      await screen.findByRole('heading', { level: 1, name: /Damjan Krstić/ }, { timeout: SLOW / 2 })
      expect(must(document.querySelector('.profile__meta'), 'the line under the name').textContent).toContain(
        '· Početnici ·',
      )

      await router.navigate('/sr/tim/dunavski-trkaci')
      await waitFor(
        async () => {
          expect(categoryIn(await rowOf('Damjan Krstić'))).toBe('Početnici')
        },
        { timeout: SLOW / 2 },
      )
      /* His own data on „Podešavanja" is not measured here: from PR 558 it is read off `GET /api/me`
         at every opening, so it is the server's row and not this visit's overlay. */
    } finally {
      server.stop()
    }
  }, SLOW * 2)

  it('goes back to the age band everywhere when he goes back to it', async () => {
    const user = setupUser()
    /* The list holds the beginners' wish this time, so the way back is the only thing that can turn
       the row into an age band. */
    const server = theServer({
      wishes: { [ME]: true },
      before: choice(true, 'M R'),
      written: () => answeringCategory(choice(false, 'M40-54')),
    })

    try {
      const { router } = renderAt('/sr/moja-clanarina', 'competitor', ME, undefined, DAY)

      await choose(user, 'U svojoj starosnoj kategoriji')
      expect(await screen.findByText('U sezoni 2027 takmičiš se u kategoriji: M 40-54')).toBeVisible()

      await router.navigate('/sr/tabela')

      expect(categoryIn(await rowOf('Damjan Krstić'))).toBe('M 40-54')
      expect(await numbersUnder(router, 'M R')).not.toContain(ME)
    } finally {
      server.stop()
    }
  }, SLOW)

  it('asks for the list of members again, so the next screen reads the row and not the old answer', async () => {
    const user = setupUser()
    const server = theServer({ before: choice(false, 'M40-54'), written: () => answeringCategory(choice(true, 'M R')) })

    try {
      const { router } = renderAt('/sr/moja-clanarina', 'competitor', ME, undefined, DAY)

      await router.navigate('/sr/takmicari')
      await screen.findByRole('link', { name: /Damjan Krstić/ }, { timeout: SLOW / 2 })
      await router.navigate('/sr/moja-clanarina')

      const before = listsAsked(server.asked)

      await choose(user, 'U početničkoj kategoriji')
      await screen.findByText('U sezoni 2027 takmičiš se u kategoriji: Početnici')
      await router.navigate('/sr/takmicari')
      await screen.findByRole('link', { name: /Damjan Krstić/ }, { timeout: SLOW / 2 })

      await waitFor(() => {
        expect(listsAsked(server.asked)).toBeGreaterThan(before)
      }, { timeout: SLOW / 2 })
    } finally {
      server.stop()
    }
  }, SLOW * 2)

  it('follows what the route answered and not what was sent', async () => {
    const user = setupUser()
    /* Sent the beginners' wish, answered the age band: what stands is the answer, which is the rule
       `useMyCategory` already keeps for its own box. */
    const server = theServer({ before: choice(false, 'M40-54'), written: () => answeringCategory(choice(false, 'M40-54')) })

    try {
      const { router } = renderAt('/sr/moja-clanarina', 'competitor', ME, undefined, DAY)

      await choose(user, 'U početničkoj kategoriji')
      await waitFor(() => {
        expect(server.asked.some((one) => one.init?.method === 'PUT')).toBe(true)
      }, { timeout: SLOW / 2 })
      await screen.findByText('U sezoni 2027 takmičiš se u kategoriji: M 40-54')

      await router.navigate('/sr/tabela')

      expect(categoryIn(await rowOf('Damjan Krstić'))).toBe('M 40-54')
    } finally {
      server.stop()
    }
  }, SLOW)

  it('changes nothing anywhere when the route refuses it', async () => {
    const user = setupUser()
    const server = theServer({ before: choice(false, 'M40-54'), written: () => refused('theChoiceIsShut', 409) })

    try {
      const { router } = renderAt('/sr/moja-clanarina', 'competitor', ME, undefined, DAY)

      await router.navigate('/sr/takmicari')
      await screen.findByRole('link', { name: /Damjan Krstić/ }, { timeout: SLOW / 2 })
      await router.navigate('/sr/moja-clanarina')

      const before = listsAsked(server.asked)

      await choose(user, 'U početničkoj kategoriji')
      expect(await screen.findByText(/Izbor nije sačuvan, jer je rok istekao/, {}, { timeout: SLOW / 2 })).toHaveAttribute(
        'role',
        'status',
      )

      await router.navigate('/sr/tabela')

      expect(categoryIn(await rowOf('Damjan Krstić'))).toBe('M 40-54')
      expect(listsAsked(server.asked)).toBe(before)
    } finally {
      server.stop()
    }
  }, SLOW)

  it('is a woman’s too, in her own word', async () => {
    const user = setupUser()
    const server = theServer({ before: choice(false, 'Ž40-54'), written: () => answeringCategory(choice(true, 'Ž R')) })

    try {
      const { router } = renderAt('/sr/moja-clanarina', 'competitor', HER, undefined, DAY)

      await choose(user, 'U početničkoj kategoriji')
      expect(await screen.findByText('U sezoni 2027 takmičiš se u kategoriji: Početnice')).toBeVisible()

      await router.navigate('/sr/tabela?pol=z')

      expect(categoryIn(await rowOf('Jovana Tomašević'))).toBe('Početnice')
      expect(categoryIn(await rowOf('Milica Bogdanović'))).toBe('Ž 40-54')
      /* And the women's table of the running season is women, the unraced among them: a man with
         no race is not put on it for having none. */
      const rows = within(await screen.findByRole('table')).getAllByRole('row').slice(1)

      expect(rows.length).toBe(file.filter((one) => one.active && one.gender === 'F').length)
      expect(rows.filter((row) => !/^(Ž |Početnice)/.test(categoryIn(row)))).toEqual([])
    } finally {
      server.stop()
    }
  }, SLOW)
})

describe('a category chosen by somebody who has never paid', () => {
  /* PDL P8, 10.10.2026: he may choose a category before he pays, and he is on no list - so there is
     no row of his for the overlay to change, and what is left is that the choice is said back to him
     and the list is asked for again, the next screen reading the row the server holds. */
  it('is said back to him, and the list is asked for again', async () => {
    const user = setupUser()
    const server = theServer({ before: choice(false, 'M25-39'), written: () => answeringCategory(choice(true, 'M R')) })
    const unpaid = neverPaidAsServed()

    try {
      /* A visitor and no number, the way `neverPaid.test.tsx` opens his page: the answer above is
         what makes this a session. */
      const { router } = renderAt('/sr/moja-clanarina', 'visitor', null, undefined, DAY)

      await router.navigate('/sr/takmicari')
      await screen.findByRole('link', { name: /Damjan Krstić/ }, { timeout: SLOW / 2 })
      await router.navigate('/sr/moja-clanarina')

      const before = listsAsked(server.asked)

      await choose(user, 'U početničkoj kategoriji')
      expect(await screen.findByText('U sezoni 2027 takmičiš se u kategoriji: Početnici')).toBeVisible()

      await router.navigate('/sr/takmicari')
      await screen.findByRole('link', { name: /Damjan Krstić/ }, { timeout: SLOW / 2 })
      await waitFor(() => {
        expect(listsAsked(server.asked)).toBeGreaterThan(before)
      }, { timeout: SLOW / 2 })
    } finally {
      unpaid.stop()
      server.stop()
    }
  }, SLOW * 2)
})

describe('the table of the season shown as the running one', () => {
  /* PDL P7, owner, 18.10.2026: „tabela sezone prikazuje svakog člana sa važećom članarinom za tu
     sezonu, i bez ijedne trke, ispod onih koji imaju bodove, sa 0 bodova i 0 trka, uvek". The
     filters still hold: a category is a category for the unraced too, and a woman is not on the
     men's table. */
  it('carries the unraced of the category asked for and of no other, and of the sex asked for', async () => {
    const server = theServer({ before: choice(false, 'M40-54'), written: () => answeringCategory(choice(false, 'M40-54')) })

    try {
      renderAt(`/sr/tabela?kategorija=${encodeURIComponent('M40-54')}`, 'visitor', null, undefined, DAY)

      const table = await screen.findByRole('table', {}, { timeout: SLOW / 2 })
      const rows = within(table).getAllByRole('row').slice(1)
      const men4054 = file.filter((one) => one.active && one.gender === 'M' && one.ageBand === '40-54')

      expect(rows.map(categoryIn)).toEqual(men4054.map(() => 'M 40-54'))
      expect(rows.map((row) => row.textContent?.match(/\d{6}/)?.[0])).toEqual(men4054.map((one) => one.memberNumber))
      expect(screen.queryByText(/Jovana Tomašević/)).not.toBeInTheDocument()
    } finally {
      server.stop()
    }
  }, SLOW)
})
