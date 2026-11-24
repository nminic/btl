import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { must } from '../../test/at'
import { moderatorWith, renderAt } from '../../test/render'
import { setupUser } from '../../test/user'
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
function theServerSays(
  memberNumber: string,
  seasons: number[] | null,
  sentBack: object[] = [SENT_BACK],
  held: Promise<void> = Promise.resolve(),
): void {
  server = serverThat((path, init) => {
    if (path === '/api/me') {
      /* `null` is an answer that does not carry the list at all, which is a read that could not be believed
         (`whatTheServerSaysOfTheSeasonsOpenForAReport`), and `held` is an answer still on its way. */
      const { seasonsOpenForAReport: _dropped, ...withoutTheList } = whoIAm as Record<string, unknown>
      const carried = seasons === null ? withoutTheList : { ...whoIAm, seasonsOpenForAReport: seasons }

      return held.then(
        () =>
          new Response(JSON.stringify({ ...carried, member: { ...myOwnRecordFromMe, memberNumber } }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      )
    }

    if (path === '/api/me/result-submissions') {
      return new Response(JSON.stringify(sentBack), { status: 200, headers: { 'content-type': 'application/json' } })
    }

    /* A write to the result routes, agreed to: the correction of a counted result is one of them. */
    if (path.startsWith('/api/results') && init?.method !== undefined) {
      return new Response(null, { status: 204 })
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
    expect(screen.getByText('Prijava rezultata se otvara sa prvom sezonom lige.')).toBeVisible()
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

/**
 * THE CONFIRMATION AFTER A CORRECTION OF A COUNTED RESULT, which a member keeps while no season is open for him
 * (independent review of PR 828, 24.11.2026): it is the one road to the confirmation that a member who is not a tester
 * has, and „Unesi još jedan" on it leads to the form for a NEW result, which says „Prijava rezultata još nije otvorena".
 */
describe('the confirmation after a correction of a counted result', () => {
  async function correctedAndConfirmed(memberNumber: string, seasons: number[]): Promise<void> {
    const user = setupUser()

    theServerSays(memberNumber, seasons)
    renderAt(`${NEW}?ispravka=${String(aCountedResult(memberNumber))}`, 'competitor', memberNumber)

    await screen.findByText(/Menjaš rezultat koji je već uračunat/, undefined, SOON)
    await theAnswerHasArrived()
    await user.type(screen.getByLabelText(/^Link/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: /^Pošalji/ }))
    await screen.findByText('Rezultat je ponovo poslat.', undefined, SOON)
  }

  it('does not offer „Unesi još jedan" to a member for whom no season is open, and keeps the way to his results', async () => {
    await correctedAndConfirmed(MEMBER, BEFORE_THE_LEAGUE)

    expect(screen.getByRole('link', { name: 'Moji rezultati' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Unesi još jedan' })).toBeNull()
  }, SLOW)

  it('offers it to a tester, where the form for a new result opens', async () => {
    await correctedAndConfirmed(MEMBER, A_TESTERS_YEAR)

    expect(screen.getByRole('link', { name: 'Unesi još jedan' })).toBeVisible()
  }, SLOW)
})

/**
 * A RUN SENT BACK THAT WAS A CORRECTION of a counted result (independent review of PR 828, 24.11.2026): „Ispravi i pošalji
 * ponovo" is a way to the form for a result like any other, so it is closed with the rest while no season is open, though
 * the server asks no season of a correction. Every case before this one sent back a run that amended nothing
 * (`amendsResultId: null`), so a screen that opened the form for a sent-back correction passed them all.
 */
describe('a run sent back that corrected a counted result, for a member who is not a tester', () => {
  const A_SENT_BACK_CORRECTION = { ...SENT_BACK, amendsResultId: aCountedResult(MEMBER) }

  it('is offered no way to send it again', async () => {
    theServerSays(MEMBER, BEFORE_THE_LEAGUE, [A_SENT_BACK_CORRECTION])
    renderAt('/sr/moji-rezultati', 'competitor', MEMBER)

    await screen.findByText('Link ne otvara rezultate.', { exact: false }, SOON)
    await theAnswerHasArrived()

    expect(theSendingAgain()).toBeNull()
  }, SLOW)

  it('is told the report is not open when the address of sending it again is typed', async () => {
    theServerSays(MEMBER, BEFORE_THE_LEAGUE, [A_SENT_BACK_CORRECTION])
    renderAt(`${NEW}?ponovo=77`, 'competitor', MEMBER)

    expect(await screen.findByRole('heading', { level: 1 }, SOON)).toHaveTextContent('Prijava rezultata još nije otvorena')
    expect(screen.queryByRole('form')).toBeNull()
  }, SLOW)

  it('is offered the way to send it again once a season is open for him', async () => {
    theServerSays(MEMBER, THE_FIRST_SEASON, [A_SENT_BACK_CORRECTION])
    renderAt('/sr/moji-rezultati', 'competitor', MEMBER)

    expect(await screen.findByRole('link', { name: /^Ispravi i pošalji ponovo/ }, SOON)).toBeVisible()
  }, SLOW)
})

/**
 * WHILE THE ANSWER IS ON ITS WAY, AND WHEN IT COULD NOT BE READ, no way in is drawn either (independent review of PR 828,
 * 24.11.2026): a link is offered only for an answer that names a season, and a screen that drew it for the two states
 * that name nothing passed every case above, which all wait for a ready answer.
 */
describe('the ways in while the answer about the seasons is not known', () => {
  it('draws none while it is still on its way, and draws them when it arrives', async () => {
    let arrive: () => void = () => {}
    const onItsWay = new Promise<void>((resolve) => {
      arrive = resolve
    })

    theServerSays(MEMBER, THE_FIRST_SEASON, [SENT_BACK], onItsWay)
    renderAt('/sr/moji-rezultati', 'competitor', MEMBER)

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })
    expect(theNewResult(), 'a way in was drawn before the server had answered').toBeNull()
    expect(theSendingAgain()).toBeNull()

    arrive()
    expect(await screen.findByRole('link', { name: 'Unesi rezultat' }, SOON)).toBeVisible()
  }, SLOW)

  it('draws none when the answer did not carry the list', async () => {
    theServerSays(MEMBER, null)
    renderAt('/sr/moji-rezultati', 'competitor', MEMBER)

    await screen.findByText('Link ne otvara rezultate.', { exact: false }, SOON)
    await theAnswerHasArrived()

    expect(theNewResult()).toBeNull()
    expect(theSendingAgain()).toBeNull()
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
