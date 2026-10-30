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

/** The served list with Vladan held without the right to rank, or with it. */
const theList = (unranked: boolean) =>
  SERVED.map((one) => (one.memberNumber === VLADAN ? { ...one, unranked } : one))

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

describe('a member without the right to rank in the season shown, in the table of one before it', () => {
  it('stands where he ranked, and his category is drawn for nobody', async () => {
    /* 2028 is shown and he holds it without the right; in 2027 he ranked. The category the portal
       keeps is the one he chose for the season shown, so drawn beside his 2027 row it would be the
       choice the owner said is shown nowhere. */
    const server = serving(theList(true), [
      aRunOf2027(VLADAN, 60, true, 900001),
      aRunOf2027(HIS_TEAMMATE, 20, true, 900002),
    ])
    renderAt('/sr/tabela?sezona=2027', 'visitor', null, undefined, '2028-06-01')

    const his = must((await screen.findByText(VLADAN)).closest('tr'), 'his row')
    const theirs = must(screen.getByText(HIS_TEAMMATE).closest('tr'), 'his teammate row')

    expect(must(his.querySelector('.table__category'), 'his category cell').textContent).toBe('')
    expect(must(theirs.querySelector('.table__category'), 'a category cell').textContent).not.toBe('')

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
