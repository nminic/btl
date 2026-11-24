import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { must } from '../../test/at'
import { moderatorWith, renderAt } from '../../test/render'
import { serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { myOwnRecordFromMe, whoIAm } from '../../test/theAnswer'

/**
 * THE WAY TO REPORT A RESULT, WHILE THE SERVER NAMES NO SEASON OPEN FOR IT AND ONCE IT DOES.
 *
 * <p>PDL P9, owner, 24.11.2026, chosen among the outcomes offered: „Onemoguci clanovima prijave
 * rezultata individualno do 1.1!", and of what exactly, „Sakrij i formu članovima"; corrected the same
 * day, „Marko treba da ostane jedini koji moze", so a tester keeps the form; and chosen the same day,
 * the correction of a counted result („Izmeni", `?ispravka=`) stays as it was. Moderators and
 * administrators enter results as before.
 *
 * <p><b>The clock and the list of testers are the server's</b> (`reportingOpen.ts`): what this file
 * varies is what `GET /api/me` answers, which is what the server's clock and `ReportTesters` make of
 * the moment. The two moments of the axis are named by what the server answers at each of them:
 * `SeasonClockTest.aTesterMaySendARunOf2026UntilMidnightOfNewYearsEveInTheLeaguesHour` holds that a
 * member who is not a tester is answered nothing at 23:59:59 on 31.12.2026 in Belgrade, a tester 2026,
 * and both 2027 at 00:00 on 1.1.2027.
 *
 * <p><b>The tester here is NOT 000002</b>, the number on the server's list in production, and 000002 is
 * a case of its own that the server answers as nobody's tester: a screen that asked its own number
 * instead of the server's answer would pass a case where the two agree, so they never agree here.
 */

const MEMBER = '000007'
const PRODUCTION_TESTER = '000002'
const EVENT = '/sr/kalendar/maraton-maratona-2015'
const NEW = '/sr/rezultat/novi'
const SOON = { timeout: SLOW / 2 }

/** What the server answers at 23:59 on 31.12.2026 to a member who is not a tester. */
const BEFORE_THE_LEAGUE: number[] = []
/** What it answers a tester at the same moment. */
const A_TESTERS_YEAR = [2026]
/** What it answers everybody from 00:00 on 1.1.2027. */
const THE_FIRST_SEASON = [2027]

let server: { asked: { path: string }[]; stop: () => void } | null = null

afterEach(() => {
  server?.stop()
  server = null
})

/** `GET /api/me` answering the member with the seasons the server would name for him, and a run sent back. */
function theServerSays(memberNumber: string, seasons: number[]): void {
  server = serverThat((path) => {
    if (path === '/api/me') {
      return new Response(
        JSON.stringify({ ...whoIAm, member: { ...myOwnRecordFromMe, memberNumber }, seasonsOpenForAReport: seasons }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    if (path === '/api/me/result-submissions') {
      return new Response(JSON.stringify([SENT_BACK]), { status: 200, headers: { 'content-type': 'application/json' } })
    }

    return null
  })
}

/** A run a moderator sent back, which is where „Ispravi i pošalji ponovo" stands. */
const SENT_BACK = {
  id: 77,
  state: 'rejected',
  raceId: null,
  raceName: 'Trka za proveru',
  raceDate: '2027-05-10',
  raceKind: 'length',
  city: 'Niš',
  country: 'RS',
  distanceKm: 21.1,
  ascentM: 540,
  descentM: 540,
  seconds: 6730,
  link: 'https://primer.rs/rezultati',
  comment: 'Moj komentar.',
  reason: 'Link ne otvara rezultate.',
  amendsResultId: null,
}

/** A counted result of the member, out of the file the portal ships. */
function aCountedResult(memberNumber: string): number {
  const shipped: { id: number; memberNumber: string }[] = JSON.parse(
    readFileSync(join(process.cwd(), 'src', 'test', 'mock', 'results.json'), 'utf-8'),
  )

  return must(shipped.find((one) => one.memberNumber === memberNumber), 'a counted result of the member').id
}

/**
 * Until the screen has heard the server's answer about the seasons: asked, answered, and drawn. A case
 * that asks for something to be ABSENT asks this first, or it would pass on a screen that has not heard
 * the answer yet.
 */
async function theAnswerHasArrived(): Promise<void> {
  await waitFor(() => {
    expect(server?.asked.some((one) => one.path === '/api/me')).toBe(true)
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50))
  })
}

const theWaysInOnTheEvent = () => screen.queryAllByRole('link', { name: /^Unesi rezultat: / })
const theNewResult = () => screen.queryByRole('link', { name: 'Unesi rezultat' })
const theSendingAgain = () => screen.queryByRole('link', { name: /^Ispravi i pošalji ponovo/ })
const theCorrections = () => screen.queryAllByRole('link', { name: /^Izmeni rezultat: / })

describe('a member who is not a tester, at 23:59 on 31.12.2026', () => {
  it('is offered no way in from the event, from his results, or to send a run again; „Izmeni" stays', async () => {
    theServerSays(MEMBER, BEFORE_THE_LEAGUE)
    renderAt('/sr/moji-rezultati', 'competitor', MEMBER)

    expect((await screen.findAllByRole('link', { name: /^Izmeni rezultat: / }, SOON)).length).toBeGreaterThan(0)
    await screen.findByText('Link ne otvara rezultate.', { exact: false }, SOON)
    await theAnswerHasArrived()

    expect(theNewResult(), 'the way to a new result from his results').toBeNull()
    expect(theSendingAgain(), 'the way to send a run again').toBeNull()
    expect(theCorrections().length, 'the correction of a counted result went with it').toBeGreaterThan(0)
  }, SLOW)

  it('is offered no way in on the event page', async () => {
    theServerSays(MEMBER, BEFORE_THE_LEAGUE)
    renderAt(EVENT, 'competitor', MEMBER)

    await screen.findByRole('table', { name: 'Trke' }, SOON)
    await theAnswerHasArrived()

    expect(theWaysInOnTheEvent()).toEqual([])
  }, SLOW)

  it.each([
    ['the form for a new result', NEW],
    ['a run sent again', `${NEW}?ponovo=77`],
    ['the form on the event', `${EVENT}/prijava?trka=683`],
    ['a correction naming nothing of his', `${NEW}?ispravka=1`],
  ])('is not drawn %s when the address is typed', async (_what, address) => {
    theServerSays(MEMBER, BEFORE_THE_LEAGUE)
    renderAt(address, 'competitor', MEMBER)

    expect(await screen.findByRole('heading', { level: 1 }, SOON)).toHaveTextContent(
      'Prijava rezultata još nije otvorena',
    )
    expect(screen.getByText(/od 1\. januara 2027/)).toBeVisible()
    expect(screen.queryByRole('form')).toBeNull()
  }, SLOW)

  it('is drawn the form that corrects a counted result of his, as before', async () => {
    theServerSays(MEMBER, BEFORE_THE_LEAGUE)
    renderAt(`${NEW}?ispravka=${String(aCountedResult(MEMBER))}`, 'competitor', MEMBER)

    expect(await screen.findByText(/Menjaš rezultat koji je već uračunat/, undefined, SOON)).toBeVisible()
    expect(screen.getByRole('form')).toBeVisible()
  }, SLOW)

  it('is the number on the production list too, when the server does not name him a tester', async () => {
    /* The list is the server's (`ReportTesters`), and here it names nobody: 000002 is answered as
       everybody else, so a screen that knew the number for itself would draw the form. */
    theServerSays(PRODUCTION_TESTER, BEFORE_THE_LEAGUE)
    renderAt(NEW, 'competitor', PRODUCTION_TESTER)

    expect(await screen.findByRole('heading', { level: 1 }, SOON)).toHaveTextContent(
      'Prijava rezultata još nije otvorena',
    )
  }, SLOW)
})

describe('a tester, at 23:59 on 31.12.2026', () => {
  it('is offered every way in, and the form, as before', async () => {
    theServerSays(MEMBER, A_TESTERS_YEAR)
    renderAt('/sr/moji-rezultati', 'competitor', MEMBER)

    expect(await screen.findByRole('link', { name: 'Unesi rezultat' }, SOON)).toBeVisible()
    expect(await screen.findByRole('link', { name: /^Ispravi i pošalji ponovo/ }, SOON)).toBeVisible()
  }, SLOW)

  it('is offered the way in on the event page', async () => {
    theServerSays(MEMBER, A_TESTERS_YEAR)
    renderAt(EVENT, 'competitor', MEMBER)

    const table = await screen.findByRole('table', { name: 'Trke' }, SOON)

    expect((await within(table).findAllByRole('link', { name: /^Unesi rezultat: / }, SOON)).length).toBeGreaterThan(0)
  }, SLOW)

  it.each([
    ['the form for a new result', NEW],
    ['the form on the event', `${EVENT}/prijava?trka=683`],
  ])('is drawn %s', async (_what, address) => {
    theServerSays(MEMBER, A_TESTERS_YEAR)
    renderAt(address, 'competitor', MEMBER)

    expect(await screen.findByRole('form', undefined, SOON)).toBeVisible()
    expect(screen.queryByText('Prijava rezultata još nije otvorena')).toBeNull()
  }, SLOW)
})

describe('a member who is not a tester, at 00:00 on 1.1.2027', () => {
  it('is offered the ways in again by itself', async () => {
    theServerSays(MEMBER, THE_FIRST_SEASON)
    renderAt('/sr/moji-rezultati', 'competitor', MEMBER)

    expect(await screen.findByRole('link', { name: 'Unesi rezultat' }, SOON)).toBeVisible()
    expect(await screen.findByRole('link', { name: /^Ispravi i pošalji ponovo/ }, SOON)).toBeVisible()
  }, SLOW)

  it('is drawn the form when the address is typed', async () => {
    theServerSays(MEMBER, THE_FIRST_SEASON)
    renderAt(NEW, 'competitor', MEMBER)

    expect(await screen.findByRole('form', undefined, SOON)).toBeVisible()
  }, SLOW)
})

describe('a moderator who enters results, before the league', () => {
  it('is offered his way in on the event page as before', async () => {
    /* His own way, to „Unos rezultata za događaj", which no season the server names closes. */
    server = serverThat(() => null)
    renderAt(EVENT, 'moderator', null, moderatorWith(['queue:results']))

    const table = await screen.findByRole('table', { name: 'Trke' }, SOON)
    const ways = await within(table).findAllByRole('link', { name: /^Unesi rezultat: / }, SOON)

    expect(ways.length).toBeGreaterThan(0)
    expect(must(ways[0], 'his way in').getAttribute('href')).toMatch(/\/rezultati\?trka=/)
  }, SLOW)
})
