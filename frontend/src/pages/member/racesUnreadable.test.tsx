import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useEffect, useRef } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import en from '../../i18n/en.json'
import sr from '../../i18n/sr.json'
import { useSession } from '../../session/useSession'
import { htmlElement, inputElement, must } from '../../test/at'
import { renderAt } from '../../test/render'
import { answeredWith, did, serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'

/**
 * THE LIST OF RACES UNDER THE NAME OF A RACE SAYS SO WHEN IT CANNOT BE READ, WITH THE WAY TO ASK
 * AGAIN (decision of 03.10.2026, chosen between the outcomes offered, in the words of the PDL's
 * record of it and not the owner's: „Kad spisak trka na formi za rezultat ne može da se učita, uz
 * polje stoji da ne može, uz „Pokušaj ponovo"." Places are the boundary: „kad šifarnik mesta ne
 * stigne, polje ostaje obično polje za tekst koje i dalje prima ukucano mesto, pa član nije
 * zaglavljen.").
 *
 * <p>The general decision of 02.10.2026 (`data/aFailedReadIsSaid.test.ts`) made a list that cannot
 * be read say so, and left one question open: whether the list of suggestions in a field of a form
 * is such a list. The owner answered yes for the races and no for the places. This file holds both
 * halves on the screens they are on.
 *
 * <p><b>The forms that send a result are counted, and counted by tools and not by memory</b>, on
 * 09.10.2026: the compiler (`ts.createProgram` over the 277 production sources, resolved symbols)
 * finds two files that send one (`pages/member/NewResult.tsx`, `pages/event/ReportResult.tsx`) and one
 * that hands a list of races to type against to a `FormRenderer` (`NewResult`); the words found the
 * same one (`suggests=`, `racesToOffer`). The second count is HELD, in both directions, by the syntax
 * tree in `data/aFailedReadIsSaid.test.ts`, so a second form with a list is a decision the day it is
 * written. The first is a measurement and is only dated here.
 *
 * <p>That form has three roads in and the list is of use on one: a new result, where the name is free.
 * A waiting result opened again (`?ponovo=`) and a counted one being corrected (`?ispravka=`) hold the
 * name, so nothing is typed into it and a list is not drawn. The event-page form offers no list at
 * all: its race is the row pressed, and its read of the races goes through `Resource`, which already
 * says it. Each of the four is a case below.
 *
 * <p><b>The axes</b> (each with both of its states): whether the list arrived or not; which of the
 * two files it is made from failed (the races, the events, both); whether the asking again works,
 * fails again, or is still out; which road the form is on; whether the codebook of towns arrived;
 * whether the button had the keyboard on it; the language.
 *
 * <p><b>Every count is of what the portal ASKED the server and not of what it drew</b>, and every
 * sentence is looked for INSIDE the field it is about, so a sentence drawn above the form, or by a
 * different box, or by the whole screen failing, is not taken for it.
 */

const ME = '000007'
const NEW = '/sr/rezultat/novi'
/** A day inside the data, so what the list offers is the same list every time this runs. */
const TODAY = '2026-08-23'
const THE_EVENT_PAGE_FORM = '/sr/kalendar/maraton-maratona-2015/prijava?trka=683'

/**
 * A CLOCK SHORTER THAN THE CASE'S OWN, so an assertion that fails says WHAT it was looking for
 * (`resultToTheServer.test.tsx` has the measurement: Testing Library's wait and the case's own are
 * both `SLOW`, and the two run out in the same instant).
 */
const SOON = { timeout: 6_000 }

type Answer = () => Response | Promise<Response> | null

let answers = new Map<string, Answer>()
let server: { asked: Asked[]; stop: () => void } | null = null

/** What these addresses answer; everything else, and every other file, comes off the disc. A write
 *  to the result route is answered with the 204 the route gives, so a case can send. */
function theServerAnswers(who: Record<string, Answer>) {
  answers = new Map(Object.entries(who))
  server = serverThat((path, init) =>
    path.startsWith('/api/results') && init?.method !== undefined
      ? did()
      : (answers.get(path)?.() ?? null),
  )
}

const failing: Answer = () => answeredWith(500)
const read: Answer = () => null

/** How many times the portal asked for an address. */
const timesAsked = (path: string) => (server?.asked ?? []).filter((one) => one.path === path).length

/** Every write to the result route, with its body read back. */
function writes(): Record<string, unknown>[] {
  return (server?.asked ?? [])
    .filter((one) => one.path === '/api/results' && one.init?.method === 'POST')
    .map((one) => {
      const said: unknown = JSON.parse(String(one.init?.body))

      return typeof said === 'object' && said !== null ? { ...said } : {}
    })
}

/** An answer that stays out until the case lets it go, and goes as the status the case says. */
function held(): { answer: Answer; letGo: (status: number) => void } {
  let letGo: (status: number) => void = () => undefined

  return {
    answer: () =>
      new Promise<Response>((resolve) => {
        letGo = (status) => {
          resolve(answeredWith(status))
        }
      }),
    letGo: (status) => {
      letGo(status)
    },
  }
}

afterEach(() => {
  server?.stop()
  server = null
})

/** The box the name of the race is typed into, and the field around it. */
const nameBox = () => inputElement(screen.getByLabelText(/^Naziv trke/))
const fieldOf = (box: HTMLElement) => htmlElement(must(box.closest('.field'), 'the field around the box'))

/** What the list under the name offers: a button for every race that answers what was typed. */
const offeredRaces = () => screen.queryAllByRole('button', { name: /Maraton maratona/ })

const RETRY = `${sr.data.retry}: ${sr.event.races}`
const retryButtons = () => screen.queryAllByRole('button', { name: new RegExp(sr.data.retry) })

/** The statuses that say the word of a wait. The form says nothing else in that role while it is not
 *  sending, and the hidden count of the list is empty. */
const loadingWords = () =>
  screen.queryAllByRole('status').filter((one) => one.textContent === sr.data.loading)

describe('the list of races under the name of a race, on the form a result is entered on', () => {
  it.each([
    ['the races', { '/api/races': failing }],
    ['the events', { '/api/events': failing }],
    ['both of them', { '/api/races': failing, '/api/events': failing }],
  ])(
    'says it cannot be read, beside the name and after it, with a button named after the list, when %s could not be read',
    async (_which, who) => {
      theServerAnswers(who)
      renderAt(NEW, 'competitor', ME, undefined, TODAY)

      const box = nameBox()
      const field = within(fieldOf(box))
      const said = await field.findByRole('alert', undefined, SOON)

      expect(said).toHaveTextContent(sr.data.error)
      expect(field.getByRole('button', { name: RETRY })).toBeVisible()
      /* Beside the box and after it, and not the box or anything inside it: a sentence drawn above
         the form would be in the document before the box, and one drawn by the whole screen
         failing would not be in this field at all. */
      expect(box.contains(said)).toBe(false)
      expect(box.compareDocumentPosition(said) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
      /* One sentence and one button on the whole page: the places and every other box are quiet. */
      expect(screen.getAllByRole('alert')).toHaveLength(1)
      expect(retryButtons()).toHaveLength(1)
    },
    SLOW,
  )

  it('says nothing, and offers nothing to ask again, when both files were read, and the list works', async () => {
    theServerAnswers({})
    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    const user = setupUser()

    await user.type(await screen.findByLabelText(/^Naziv trke/), 'Maraton maratona')

    expect((await screen.findAllByRole('button', { name: /Maraton maratona/ })).length).toBeGreaterThan(0)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(retryButtons()).toHaveLength(0)
  }, SLOW)

  it('goes on taking what is typed, offers no race, and sends the name as a race the calendar does not hold', async () => {
    theServerAnswers({ '/api/races': failing })
    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    const user = setupUser()
    const box = nameBox()

    await screen.findByRole('alert', undefined, SOON)
    /* A box that can be typed into, and not one held: held is readOnly and says aria-disabled. */
    expect(box).not.toHaveAttribute('readonly')
    expect(box).not.toHaveAttribute('aria-disabled')

    await user.type(box, 'Maraton maratona')

    expect(box).toHaveValue('Maraton maratona')
    expect(offeredRaces(), 'a race was offered by a list that could not be read').toHaveLength(0)

    await user.type(screen.getByLabelText(/Datum trke/), '10052026')
    await user.type(screen.getByLabelText('Mesto'), 'Niš')
    await user.selectOptions(screen.getByLabelText(/^Država/), 'RS')
    await user.type(screen.getByLabelText(/Dužina/), '21.1')
    await user.type(screen.getByLabelText(/Uspon/), '540')
    await user.type(screen.getByLabelText(/Spust/), '540')
    await user.type(screen.getByLabelText('Sati'), '1')
    await user.type(screen.getByLabelText('Minuta'), '52')
    await user.type(screen.getByLabelText('Sekundi'), '10')
    await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

    await waitFor(() => {
      expect(writes()).toHaveLength(1)
    }, SOON)

    const body = must(writes()[0], 'the request')

    /* The name as it was typed and no race: the absence of `raceId` is what tells verification it
       has to make the race (owner, 31.08.2026). */
    expect(body.raceName).toBe('Maraton maratona')
    expect(Object.hasOwn(body, 'raceId')).toBe(false)
  }, SLOW)
})

describe('the list of races, asked for again', () => {
  it('asks again for the file that failed and not for the one that was read, and offers the races when it comes', async () => {
    theServerAnswers({ '/api/races': failing })
    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    const user = setupUser()
    const field = within(fieldOf(nameBox()))

    await field.findByRole('alert', undefined, SOON)

    const events = timesAsked('/api/events')

    expect(timesAsked('/api/races')).toBe(1)
    answers.set('/api/races', read)
    await user.click(field.getByRole('button', { name: RETRY }))

    /* The button is what goes when the asking has worked: the sentence is also gone while the
       request is out, and it is not the end of the wait. */
    await waitFor(() => {
      expect(retryButtons()).toHaveLength(0)
    }, SOON)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(timesAsked('/api/races')).toBe(2)
    expect(timesAsked('/api/events'), 'the file that had been read was asked for again').toBe(events)

    await user.type(nameBox(), 'Maraton maratona')

    expect((await screen.findAllByRole('button', { name: /Maraton maratona/ })).length).toBeGreaterThan(0)
  }, SLOW)

  it('asks again for every file that failed with ONE press', async () => {
    theServerAnswers({ '/api/races': failing, '/api/events': failing })
    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    const field = within(fieldOf(nameBox()))

    await field.findByRole('alert', undefined, SOON)
    answers.set('/api/races', read)
    answers.set('/api/events', read)
    await setupUser().click(field.getByRole('button', { name: RETRY }))

    await waitFor(() => {
      expect(retryButtons(), 'one press left the second file saying it could not be read').toHaveLength(0)
    }, SOON)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(timesAsked('/api/races')).toBe(2)
    expect(timesAsked('/api/events')).toBe(2)
  }, SLOW)

  it('says it is asking while the request is out, and says it again as a NEW alert if it still cannot be read', async () => {
    theServerAnswers({ '/api/races': failing })
    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    const user = setupUser()
    const field = within(fieldOf(nameBox()))
    const first = await field.findByRole('alert', undefined, SOON)
    const button = field.getByRole('button', { name: RETRY })
    const out = held()

    answers.set('/api/races', out.answer)
    await user.click(button)

    await waitFor(() => {
      expect(loadingWords()).toHaveLength(1)
    }, SOON)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(first.isConnected, 'the sentence that said it could not be read is still there while it asks').toBe(false)
    expect(button).toHaveAttribute('aria-disabled', 'true')

    const asked = timesAsked('/api/races')

    await user.click(button)
    expect(timesAsked('/api/races'), 'a press went through while the request was out').toBe(asked)

    act(() => {
      out.letGo(500)
    })

    const second = await field.findByRole('alert', undefined, SOON)

    expect(second).toHaveTextContent(sr.data.error)
    expect(second, 'the second failure is the first alert with its role turned back').not.toBe(first)
    expect(field.getByRole('button', { name: RETRY }), 'the button was replaced by the second failure').toBe(button)

    /* A button that failed again can be pressed again, and the second press is answered. */
    answers.set('/api/races', read)
    await user.click(button)

    await waitFor(() => {
      expect(retryButtons()).toHaveLength(0)
    }, SOON)
    expect(screen.queryByRole('alert')).toBeNull()
  }, SLOW)

  it('says the same in English', async () => {
    theServerAnswers({ '/api/races': failing })
    renderAt('/en/rezultat/novi', 'competitor', ME, undefined, TODAY)

    const field = within(fieldOf(inputElement(await screen.findByLabelText(/^Race name/))))

    expect(await field.findByRole('alert', undefined, SOON)).toHaveTextContent(en.data.error)
    expect(field.getByRole('button', { name: `${en.data.retry}: ${en.event.races}` })).toBeVisible()
  }, SLOW)
})

describe('where the keyboard is when the list that could not be read has been read again', () => {
  it('goes back to the name box when the button had it, which is where the reader was working', async () => {
    theServerAnswers({ '/api/races': failing })
    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    const user = setupUser()
    const field = within(fieldOf(nameBox()))
    const button = await field.findByRole('button', { name: RETRY }, SOON)

    answers.set('/api/races', read)
    button.focus()
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(retryButtons()).toHaveLength(0)
    }, SOON)
    expect(nameBox(), 'the keyboard was left on the body when the button went').toHaveFocus()
  }, SLOW)

  it('does not take it from a reader who had moved on to another box', async () => {
    theServerAnswers({ '/api/races': failing })
    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    const field = within(fieldOf(nameBox()))
    const button = await field.findByRole('button', { name: RETRY }, SOON)
    const elsewhere = inputElement(screen.getByLabelText(/Link/))

    answers.set('/api/races', read)
    elsewhere.focus()
    fireEvent.click(button)

    await waitFor(() => {
      expect(retryButtons()).toHaveLength(0)
    }, SOON)
    expect(elsewhere).toHaveFocus()
  }, SLOW)

  it('does not take it for a press that never had the keyboard on the button', async () => {
    theServerAnswers({ '/api/races': failing })
    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    const field = within(fieldOf(nameBox()))
    const button = await field.findByRole('button', { name: RETRY }, SOON)

    answers.set('/api/races', read)
    /* A click that moves the focus nowhere, which is what a pointer in a browser that does not focus
       a button does. */
    fireEvent.click(button)

    await waitFor(() => {
      expect(retryButtons()).toHaveLength(0)
    }, SOON)
    expect(document.body).toHaveFocus()
  }, SLOW)
})

/** A waiting result of this member, written into the store the way the form opens it again from. */
function Waiting() {
  const session = useSession()
  const done = useRef(false)

  useEffect(() => {
    if (!done.current) {
      done.current = true
      session.submit({
        memberNumber: ME,
        raceName: 'Probna trka',
        raceKind: 'length',
        city: 'Niš',
        country: 'RS',
        date: '2026-05-10',
        distanceKm: 21.1,
        ascentM: 540,
        descentM: 540,
        photo: '',
        seconds: 6730,
        points: 12.34,
        category: 'half',
        link: 'https://primer.rs/rezultati',
        comment: '',
      })
    }
  }, [session])

  return null
}

describe('the other forms that send a result, when the races could not be read', () => {
  it('does not offer the list on a waiting result opened again, because the name is held there', async () => {
    theServerAnswers({ '/api/races': failing })
    renderAt('/sr/rezultat/novi?ponovo=sub-1', 'competitor', ME, undefined, TODAY, <Waiting />)

    /* The road that holds the name, which is what is drawn once the store has the result. */
    await screen.findByText(/Menjaš rezultat koji još čeka proveru/, undefined, SOON)

    const box = nameBox()

    expect(box).toHaveAttribute('aria-disabled', 'true')
    /* Nothing is typed into a held box, so a list is of no use to it and a sentence about one would
       offer a button for something that cannot be used. */
    await waitFor(() => {
      expect(timesAsked('/api/races')).toBeGreaterThan(0)
    }, SOON)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(retryButtons()).toHaveLength(0)
  }, SLOW)

  it('does not offer it on the correction of a counted result either', async () => {
    theServerAnswers({ '/api/races': failing })
    renderAt('/sr/moji-rezultati', 'competitor', ME, undefined, TODAY)

    const user = setupUser()
    const table = within(await screen.findByRole('table', { name: 'Uračunato' }, SOON))
    const row = within(must(table.getAllByRole('row')[1], 'the first counted result'))

    await user.click(row.getByRole('link', { name: /^Izmeni rezultat/ }))
    await screen.findByText(/Menjaš rezultat koji je već uračunat/, undefined, SOON)

    expect(nameBox()).toHaveAttribute('aria-disabled', 'true')
    await waitFor(() => {
      expect(timesAsked('/api/races')).toBeGreaterThan(0)
    }, SOON)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(retryButtons()).toHaveLength(0)
  }, SLOW)

  it('says it on the form reached from the page of an event, which has no list and says it as a whole screen', async () => {
    theServerAnswers({ '/api/races': failing })
    renderAt(THE_EVENT_PAGE_FORM, 'competitor', ME)

    expect(await screen.findByRole('alert', undefined, SOON)).toHaveTextContent(sr.data.error)

    answers.set('/api/races', read)
    await setupUser().click(screen.getByRole('button', { name: sr.data.retry }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Prijava rezultata' }, SOON)).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
  }, SLOW)
})

describe('the town on the form a result is entered on, which is the boundary of the decision', () => {
  it('stays a plain box that takes the town typed into it, and says nothing, when the codebook cannot be fetched', async () => {
    theServerAnswers({ '/api/places': failing })
    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    const user = setupUser()

    await user.type(await screen.findByLabelText(/^Naziv trke/), 'Trka kroz šumu')
    await user.type(screen.getByLabelText(/Datum trke/), '10052026')
    await user.type(screen.getByLabelText('Mesto'), 'Ča')
    /* The request goes out on the second letter, so seeing it asked for is seeing the refusal on its
       way. The rest of the name is typed AFTER that, so there is a drawing once the refusal has
       landed, and a screen that said it would have said it by the time the next line looks. */
    await waitFor(() => {
      expect(timesAsked('/api/places')).toBeGreaterThan(0)
    }, SOON)
    await user.type(screen.getByLabelText('Mesto'), 'čak')

    /* Nothing is said and nothing is offered: no sentence, no button, no list of towns. */
    expect(screen.queryByRole('alert')).toBeNull()
    expect(retryButtons()).toHaveLength(0)
    expect(screen.queryByRole('listbox', { name: sr.form.places })).toBeNull()
    expect(screen.getByLabelText('Mesto')).toHaveValue('Čačak')

    /* And the member is not stuck: the country is the hand's, and the result goes with the town as
       it was typed. */
    const country = screen.getByLabelText(/^Država/)

    expect(country).toBeEnabled()
    await user.selectOptions(country, 'RS')
    await user.type(screen.getByLabelText(/Dužina/), '21.1')
    await user.type(screen.getByLabelText(/Uspon/), '540')
    await user.type(screen.getByLabelText(/Spust/), '540')
    await user.type(screen.getByLabelText('Sati'), '1')
    await user.type(screen.getByLabelText('Minuta'), '52')
    await user.type(screen.getByLabelText('Sekundi'), '10')
    await user.type(screen.getByLabelText(/Link/), 'https://primer.rs/rezultati')
    await user.click(screen.getByRole('button', { name: 'Pošalji na proveru' }))

    await waitFor(() => {
      expect(writes()).toHaveLength(1)
    }, SOON)
    expect(must(writes()[0], 'the request')).toMatchObject({ city: 'Čačak', country: 'RS' })
  }, SLOW)

  it('is not given the sentence of the races when both could not be read: one sentence, in the field of the name', async () => {
    theServerAnswers({ '/api/places': failing, '/api/races': failing })
    renderAt(NEW, 'competitor', ME, undefined, TODAY)

    const user = setupUser()
    const nameField = within(fieldOf(nameBox()))

    await nameField.findByRole('alert', undefined, SOON)
    await user.type(screen.getByLabelText('Mesto'), 'Ča')
    await waitFor(() => {
      expect(timesAsked('/api/places')).toBeGreaterThan(0)
    }, SOON)
    await user.type(screen.getByLabelText('Mesto'), 'čak')

    const townField = within(fieldOf(htmlElement(screen.getByLabelText('Mesto'))))

    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(retryButtons()).toHaveLength(1)
    expect(townField.queryByRole('alert')).toBeNull()
    expect(townField.queryByRole('button', { name: new RegExp(sr.data.retry) })).toBeNull()
  }, SLOW)
})
