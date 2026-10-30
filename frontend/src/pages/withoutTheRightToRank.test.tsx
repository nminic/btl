import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { screen, within } from '@testing-library/react'
import { clearResourceCache } from '../data/client'
import type { Competitor, Member, Result } from '../data/types'
import { must } from '../test/at'
import { memberRowOf, seasonsOf } from '../test/memberRow'
import { asMember, person } from '../test/plate'
import { renderAt } from '../test/render'
import { serverThat } from '../test/serverAnswers'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'

/**
 * „BEZ PRAVA RANGIRANJA" ON THE SCREENS: what a member without the right to rank is shown on, what he
 * is not, and the one place the administration is told.
 *
 * The owner, 28.10.2026: such a member „ima profil, unosi rezultate i vidi svoje bodove i statistiku
 * na profilu; ne pojavljuje se u tabelama lige, rang listama ni u kategoriji, a bodovi mu ne ulaze u
 * zbir tima ni para"; „Da je član bez prava rangiranja ne vidi se nigde javno ... vidi ga samo
 * administracija, uz osnov." And 30.10.2026: he „stoji na spisku rezultata trke na strani događaja,
 * kao i svi"; his category „ne prikazuje se javno nigde"; and the administration sees it „u redu
 * člana, na spisku sezona, pored osnova članstva, i nigde drugde".
 *
 * Every case stands on the served list of members with ONE of them, Vladan (000001), held without
 * the right, and his teammates as they are, so a screen that reads the wrong member, or nobody, gives
 * a different answer.
 */

const MOCK = join(process.cwd(), 'src', 'test', 'mock')
const SERVED: Competitor[] = JSON.parse(readFileSync(join(MOCK, 'competitors.json'), 'utf-8'))
const VLADAN = '000001'
const HIS_TEAMMATE = '000013'

/**
 * The served list with Vladan holding the season shown (2027) without the right to rank, or with it. Held
 * without it, the server answers no category of that season for him, on his card or in his seasons, and
 * no mark of why (PDL, 30.10.2026; `CompetitorApi`, V81).
 */
const theList = (unranked: boolean): Competitor[] =>
  SERVED.map((one) => (one.memberNumber === VLADAN && unranked ? { ...one, category: null, categories: [] } : one))

/** A run of 2027 on the race of an event the calendar has. */
const aRunOf2027 = (memberNumber: string, points: number, inItsStanding: boolean, id: number): Result => ({
  id,
  memberNumber,
  raceId: 799,
  raceName: 'Novogodišnja trka Mrsać',
  eventName: 'Novogodišnja trka Mrsać',
  eventSlug: 'novogodisnja-trka-mrsac-2017',
  date: '2027-05-01',
  distanceKm: 3.3,
  ascentM: 8,
  descentM: 8,
  seconds: 1032,
  points,
  category: 'short',
  inItsSeason: true,
  inItsStanding,
})

function serving(list: Competitor[], results: Result[] | null = null) {
  clearResourceCache()

  return serverThat((path, init) => {
    if ((init?.method ?? 'GET') !== 'GET') {
      return null
    }

    const bare = path.replace(/\?.*$/, '')
    const body = bare === '/api/competitors' ? list : bare === '/api/results' ? results : null

    return body === null ? null : Response.json(body)
  })
}

describe('a member without the right to rank, in public', () => {
  it('has no category on his card in the list of competitors, and his neighbours keep theirs', async () => {
    const server = serving(theList(true))
    renderAt('/sr/takmicari', 'visitor', null, undefined, '2027-06-01')

    const his = must((await screen.findByText(VLADAN)).closest('li'), 'his card')
    const theirs = must(screen.getByText(HIS_TEAMMATE).closest('li'), 'a teammate card')

    expect(his.querySelector('.card__chip')).toBeNull()
    expect(theirs.querySelector('.card__chip')).not.toBeNull()

    server.stop()
  }, SLOW)

  it('has no category on his profile', async () => {
    let server = serving(theList(false))
    const ranked = renderAt(`/sr/takmicar/${VLADAN}`, 'visitor', null, undefined, '2027-06-01')
    await screen.findByRole('heading', { level: 1, name: /Vladan/ })
    const withIt = must(document.querySelector('.profile__meta'), 'the line under the name').textContent
    ranked.unmount()
    server.stop()

    server = serving(theList(true))
    renderAt(`/sr/takmicar/${VLADAN}`, 'visitor', null, undefined, '2027-06-01')
    await screen.findByRole('heading', { level: 1, name: /Vladan/ })
    const without = must(document.querySelector('.profile__meta'), 'the line under the name').textContent

    /* His category and its dot are gone, and nothing else of the line. */
    expect(withIt).toContain('55+')
    expect(withIt.replace(/M 55\+ · /, '')).toEqual(without)
    expect(without).not.toContain('55+')

    server.stop()
  }, SLOW)

  it('stands on the list of results of the race, like everybody', async () => {
    const server = serving(theList(true), [aRunOf2027(VLADAN, 77.77, false, 900001)])
    renderAt('/sr/kalendar/novogodisnja-trka-mrsac-2017', 'visitor', null, undefined, '2027-06-01')

    /* The page first, then his name, each on half the clock of the case, so a run that is not drawn
       fails on this sentence and never on the clock (CLAUDE.md §25). */
    await screen.findByRole('heading', { level: 1 }, { timeout: SLOW / 2 })
    expect(await screen.findByText(/Đurišić/, undefined, { timeout: SLOW / 4 })).toBeInTheDocument()

    server.stop()
  }, SLOW)

  it('is not among the members of his team, and brings it no points', async () => {
    const server = serving(theList(true), [
      aRunOf2027(VLADAN, 77.77, false, 900001),
      aRunOf2027(HIS_TEAMMATE, 11.11, true, 900002),
    ])
    renderAt('/sr/tim/dunavski-trkaci', 'visitor', null, undefined, '2027-06-01')

    const members = await screen.findByRole('table', { name: 'Članovi' })

    expect(within(members).queryByText(VLADAN)).toBeNull()
    expect(within(members).getByText(HIS_TEAMMATE)).toBeInTheDocument()
    /* The team's figures are his teammate's run and nothing of his. */
    expect(screen.getAllByText(/11,11/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/88,88/)).toBeNull()

    server.stop()
  }, SLOW)
})

describe('the members of a team placed in a season', () => {
  /* Owner, 30.10.2026, PDL „Na strani tima plasman sezone nose samo članovi tima sa članarinom za tu
     sezonu i sa pravom rangiranja u njoj". Three members of one team, none of whom has run: Damjan holds
     2027 with the right; Strahinja holds no membership of 2027 (his card still speaks of 2027, the
     running season, because he holds neither season); Vladan holds 2027 without the right, so his card
     names nothing. A page that asked the card instead of the season of its own table would place
     Strahinja; one that asked nothing would place all three. */
  const STRAHINJA = '000007'
  const threeStates = (): Competitor[] =>
    SERVED.map((one) =>
      one.memberNumber === VLADAN
        ? { ...one, category: null, categories: [] }
        : one.memberNumber === STRAHINJA
          ? { ...one, categories: [] }
          : one,
    )

  it('places the member with a fee for the season and the right in it, and nobody else of the team', async () => {
    const server = serving(threeStates(), [])
    renderAt('/sr/tim/dunavski-trkaci', 'visitor', null, undefined, '2027-06-01')

    const members = await screen.findByRole('table', { name: 'Članovi' }, { timeout: SLOW / 2 })

    expect(within(members).getByText(HIS_TEAMMATE)).toBeInTheDocument()
    expect(within(members).queryByText(STRAHINJA), 'a member of the team with no fee for 2027').toBeNull()
    expect(within(members).queryByText(VLADAN), 'a member of the team without the right in 2027').toBeNull()

    server.stop()
  }, SLOW)
})

describe('a member without the right to rank in the season shown, in the table of one before it', () => {
  /* 2028 is shown and he holds it without the right; in 2027 he ranked, in his band of 2027. The card
     names nothing (the season it speaks of is 2028), and 2027 is on his list of seasons with its own
     category. Owner, 30.10.2026: „Prikazuj u proslim, svakako se to zamrzava", which turned over what
     PR 664 drew here (nothing beside his 2027 row). */
  const heRankedIn2027 = (): Competitor[] =>
    SERVED.map((one) =>
      one.memberNumber === VLADAN
        ? { ...one, category: null, categories: [{ season: 2027, ageBand: '55+', beginner: false }] }
        : one,
    )

  it('stands where he ranked, with the category of that season', async () => {
    const server = serving(heRankedIn2027(), [
      aRunOf2027(VLADAN, 60, true, 900001),
      aRunOf2027(HIS_TEAMMATE, 20, true, 900002),
    ])
    renderAt('/sr/tabela?sezona=2027', 'visitor', null, undefined, '2028-06-01')

    const his = must((await screen.findByText(VLADAN)).closest('tr'), 'his row')

    expect(must(his.querySelector('.table__category'), 'his category cell').textContent).toBe('M 55+')
    /* And the filter of that season finds him under it. */
    server.stop()
  }, SLOW)

  it('is found under the category of that season by the filter of that season', async () => {
    const server = serving(heRankedIn2027(), [
      aRunOf2027(VLADAN, 60, true, 900001),
      aRunOf2027(HIS_TEAMMATE, 20, true, 900002),
    ])
    renderAt(`/sr/tabela?sezona=2027&kategorija=${encodeURIComponent('M55+')}`, 'visitor', null, undefined, '2028-06-01')

    await screen.findByRole('button', { name: 'M 55+', pressed: true }, { timeout: SLOW / 2 })
    expect(must(screen.getByRole('table').querySelector('tbody'), 'the rows').textContent).toContain(VLADAN)

    server.stop()
  }, SLOW)
})

describe('the administration', () => {
  const ana = person('000009', 'Ana', 'Aktivna', { membershipBasis: 'balance', membershipSeason: 2028 })
  const MEMBERS: Member[] = [
    asMember(ana, {
      seasonOnSale: 2028,
      seasons: [
        { season: 2027, basis: 'payment', ranked: false },
        { season: 2028, basis: 'balance', ranked: true },
      ],
    }),
  ]

  it('is told beside the season, and nowhere else on the row', async () => {
    clearResourceCache()
    const server = serverThat((path, init) =>
      (init?.method ?? 'GET') !== 'GET'
        ? null
        : path === '/api/members'
          ? Response.json(MEMBERS)
          : path === '/api/competitors'
            ? Response.json([ana])
            : null,
    )
    const user = setupUser()
    renderAt('/sr/administracija/clanovi', 'superadmin')

    const row = await memberRowOf('000009')
    const list = await seasonsOf(user, row)
    const of = (season: number) =>
      must(within(list).getByRole('checkbox', { name: String(season) }).closest('li'), `the season ${String(season)}`)

    expect(of(2027)).toHaveTextContent('bez prava rangiranja')
    expect(of(2028)).not.toHaveTextContent('bez prava rangiranja')
    /* The row draws its list of seasons in more than one place (`memberRow.ts` takes the first),
       and every one of the words is in such a list, beside a season, and in none of the row's
       other cells. */
    const said = within(row).getAllByText(/bez prava rangiranja/)

    expect(said.length).toBeGreaterThan(0)
    expect(said.every((one) => one.closest('.members-seasons__list') !== null)).toBe(true)

    server.stop()
  }, SLOW)
})
