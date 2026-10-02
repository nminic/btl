import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { theInboxHasChanged } from '../data/useResource'
import en from '../i18n/en.json'
import sr from '../i18n/sr.json'
import { must } from '../test/at'
import { renderAt } from '../test/render'
import { answeredWith, serverThat } from '../test/serverAnswers'
import { SLOW } from '../test/slow'
import { setupUser } from '../test/user'

/**
 * A SCREEN WHOSE READ FAILED SAYS SO AND OFFERS TO ASK AGAIN, ON SCREENS THAT GO THROUGH `Resource`
 * (decision of 02.10.2026, PENDING stavka 368, in the words of the PDL's record of it and not the
 * owner's: „Spisak koji ne moze da se ucita KAZE to, umesto da izgleda prazan, uz dugme „Pokusaj
 * ponovo". Vazi za sve ekrane sa spiskom.").
 *
 * <p>The first half of that decision went into the team's page and the panel under the envelope
 * (`app/messagesUnreadable.test.tsx`, `pages/teamQueueOnTheServer.test.tsx`); this is the second,
 * for every screen that reads its data through one component. Three layers hold it and
 * this is the third: `components/Resource.test.tsx` holds what the button does with a state it is
 * handed, `data/askingAgain.test.tsx` holds who is asked and how many times the server is, and the
 * cases below hold that real screens, with real readers and a real route table, say it and do it.
 *
 * <p><b>The axes are the answer</b> (a failure by a number, a server that cannot be reached, a read
 * that came back with nothing in it), <b>the moment</b> (the first read, a read that failed after
 * one that worked, and the asking again that comes back, comes back the same, or is still out),
 * <b>how many files the screen waits on</b> (one, several, and one that failed beside one that is
 * still on its way), <b>the shape of the screen</b> (a whole screen, a part that has a name, parts
 * that have none) and <b>who else is showing the same failure</b> (the panel under the envelope).
 *
 * <p><b>Every count below is of what the portal ASKED the server and not of what it drew</b>, so a
 * screen that drew the right words out of something it already held would pass a case about the words
 * and fail the one about the count.
 */

/** What an address answers right now; `null` leaves it to the disc reader, which is the answer
 *  every case that does not say otherwise gets. A case may change it while it runs. */
type Answer = () => Response | Promise<Response> | null

let answers = new Map<string, Answer>()
let server: { asked: { path: string }[]; stop: () => void } | null = null

function theServerAnswers(who: Record<string, Answer>) {
  answers = new Map(Object.entries(who))
  server = serverThat((path) => answers.get(path)?.() ?? null)
}

/** How many times the portal asked for an address. */
const timesAsked = (path: string) => (server?.asked ?? []).filter((one) => one.path === path).length

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })

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

const MEMBER = '000007'
const INBOX = '/api/inbox'
/** What the harness's own inbox opens with (`test/mock/inbox.json`). */
const A_MESSAGE = /Fotografija je prihvaćena/

/** The statuses that say the word of a wait, whether it is an asking again that is out or a sheet
 *  over a screen that is still waiting: both are that word, and a case that wants to tell them apart
 *  says what ELSE is on the screen. Found among the statuses by what they say, because the shell
 *  announces the page too, and a panel that is shut says the same words where nobody can read
 *  them. */
const loadingWords = () =>
  screen.queryAllByRole('status').filter((one) => one.textContent === sr.data.loading)

/** The button of a screen that failed whole: named by its own word, which is what tells it from the
 *  panel's, whose name carries the list as well. */
const retryOnTheScreen = () => screen.getByRole('button', { name: sr.data.retry })

describe('a whole screen whose read failed', () => {
  it.each([
    ['a 500', () => answeredWith(500)],
    ['a 401', () => answeredWith(401)],
    ['a server that cannot be reached', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('says it cannot be read, offers to ask again, and does not call the inbox empty, on %s', async (_how, how) => {
    theServerAnswers({ [INBOX]: how })
    renderAt('/sr/poruke', 'competitor', MEMBER)

    expect(await screen.findByRole('alert')).toHaveTextContent(sr.data.error)
    expect(retryOnTheScreen()).toBeVisible()
    expect(screen.queryByText(sr.messages.empty), 'a failed read was drawn as an empty inbox').toBeNull()
  }, SLOW)

  it('says the inbox is empty, and offers nothing to ask again, when the read came back with nothing in it', async () => {
    theServerAnswers({ [INBOX]: () => json([]) })
    renderAt('/sr/poruke', 'competitor', MEMBER)

    expect(await screen.findByText(sr.messages.empty)).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: new RegExp(sr.data.retry) })).toBeNull()
  }, SLOW)

  it('says the standing of teams is empty, not unread, when the teams came back with none', async () => {
    theServerAnswers({ '/api/teams': () => json([]) })
    renderAt('/sr/timovi')

    expect(await screen.findByText(sr.teams.empty)).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: new RegExp(sr.data.retry) })).toBeNull()
  }, SLOW)

  it('keeps what stands outside the read, says it cannot be read, and draws the table when asked again', async () => {
    theServerAnswers({ '/api/teams': () => answeredWith(500) })
    renderAt('/sr/timovi')

    expect(await screen.findByRole('alert')).toHaveTextContent(sr.data.error)
    expect(screen.getByRole('heading', { level: 1, name: sr.teams.title })).toBeVisible()
    expect(screen.queryByText(sr.teams.empty), 'a failed read of the teams was drawn as a standing with no team').toBeNull()

    answers.set('/api/teams', () => null)
    await setupUser().click(retryOnTheScreen())

    expect(await screen.findByRole('table', { name: sr.teams.title })).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
  }, SLOW)

  it('draws what arrives when it is asked again and the server answers, and asks the server once for it', async () => {
    theServerAnswers({ [INBOX]: () => answeredWith(500) })
    renderAt('/sr/poruke', 'competitor', MEMBER)

    await screen.findByRole('alert')
    answers.set(INBOX, () => null)
    await setupUser().click(retryOnTheScreen())

    expect(await screen.findByRole('link', { name: A_MESSAGE })).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(timesAsked(INBOX), 'the screen and the panel in the header read one file, once, each time').toBe(2)
  }, SLOW)

  it('says it is asking while the request is out, and says it cannot be read again, as a NEW alert, if it still cannot', async () => {
    theServerAnswers({ [INBOX]: () => answeredWith(500) })
    renderAt('/sr/poruke', 'competitor', MEMBER)

    const first = await screen.findByRole('alert')
    const out = held()

    answers.set(INBOX, out.answer)

    const user = setupUser()

    await user.click(retryOnTheScreen())

    await waitFor(() => expect(loadingWords()).toHaveLength(1))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(retryOnTheScreen()).toHaveAttribute('aria-disabled', 'true')
    expect(first.isConnected, 'the sentence that said it could not be read is still there while it asks').toBe(false)

    const asked = timesAsked(INBOX)

    await user.click(retryOnTheScreen())
    expect(timesAsked(INBOX), 'a press went through while the request was out').toBe(asked)

    act(() => {
      out.letGo(500)
    })

    const second = await screen.findByRole('alert')

    expect(second).toHaveTextContent(sr.data.error)
    expect(second, 'the second failure is the first alert with its role turned back').not.toBe(first)
    expect(loadingWords()).toHaveLength(0)
    expect(retryOnTheScreen()).not.toHaveAttribute('aria-disabled', 'true')

    /* A button that failed again can be pressed again, and the second press is answered. */
    answers.set(INBOX, () => null)
    await user.click(retryOnTheScreen())

    expect(await screen.findByRole('link', { name: A_MESSAGE })).toBeVisible()
  }, SLOW)

  it('keeps the focus on the same button through asking and through a second failure, and answers Enter and Space', async () => {
    theServerAnswers({ [INBOX]: () => answeredWith(500) })
    renderAt('/sr/poruke', 'competitor', MEMBER)

    const button = await screen.findByRole('button', { name: sr.data.retry })
    const out = held()
    const user = setupUser()

    answers.set(INBOX, out.answer)
    button.focus()
    await user.keyboard('{Enter}')

    await waitFor(() => expect(loadingWords()).toHaveLength(1))
    expect(retryOnTheScreen(), 'the button was replaced while it asked').toBe(button)
    expect(button).toHaveFocus()

    act(() => {
      out.letGo(500)
    })
    await screen.findByRole('alert')

    expect(retryOnTheScreen(), 'the button was replaced by a second failure').toBe(button)
    expect(button).toHaveFocus()

    answers.set(INBOX, () => null)
    await user.keyboard(' ')

    expect(await screen.findByRole('link', { name: A_MESSAGE })).toBeVisible()
  }, SLOW)

  it('says the same in English', async () => {
    theServerAnswers({ [INBOX]: () => answeredWith(500) })
    renderAt('/en/poruke', 'competitor', MEMBER)

    expect(await screen.findByRole('alert')).toHaveTextContent(en.data.error)
    expect(screen.getByRole('button', { name: en.data.retry })).toBeVisible()
  }, SLOW)

  it('says it cannot be read when the language changes under a screen that had read the other one, and asks again for the address it is on now', async () => {
    const { router } = renderAt('/sr/uslovi-koriscenja')

    expect(await screen.findByRole('heading', { level: 1, name: 'Uslovi korišćenja' })).toBeVisible()

    theServerAnswers({ '/api/pages?lang=en': () => answeredWith(500) })
    await act(async () => {
      await router.navigate('/en/uslovi-koriscenja')
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(en.data.error)
    expect(timesAsked('/api/pages?lang=en')).toBe(1)

    answers.set('/api/pages?lang=en', () => null)
    await setupUser().click(screen.getByRole('button', { name: en.data.retry }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Uslovi korišćenja' })).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(timesAsked('/api/pages?lang=en'), 'it asked for the language it had left').toBe(2)
    expect(timesAsked('/api/pages?lang=sr')).toBe(0)
  }, SLOW)

  it('draws nothing late for a screen the reader has left while the request was out', async () => {
    theServerAnswers({ [INBOX]: () => answeredWith(500) })

    const { router } = renderAt('/sr/poruke', 'competitor', MEMBER)

    await screen.findByRole('alert')

    const out = held()

    answers.set(INBOX, out.answer)
    await setupUser().click(retryOnTheScreen())
    await waitFor(() => expect(loadingWords()).toHaveLength(1))

    await act(async () => {
      await router.navigate('/sr')
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'Balkanska trkačka liga' })).toBeVisible()

    act(() => {
      out.letGo(500)
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.queryByRole('alert'), 'an answer for a screen that was gone drew a sentence on the one that came after').toBeNull()
    expect(screen.getByRole('heading', { level: 1, name: 'Balkanska trkačka liga' })).toBeVisible()
  }, SLOW)
})

describe('a read that failed after one that had worked', () => {
  it('says so, and is asked again, when the inbox is read once more and the server cannot answer', async () => {
    theServerAnswers({ [INBOX]: () => null })
    renderAt('/sr/poruke', 'competitor', MEMBER)

    expect(await screen.findByRole('link', { name: A_MESSAGE })).toBeVisible()

    /* What happens after a message is read: the portal says the inbox is out of date, and every
       reader of it asks again. The server is not there for that second asking. */
    answers.set(INBOX, () => answeredWith(500))
    act(() => {
      theInboxHasChanged()
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(sr.data.error)
    expect(retryOnTheScreen()).toBeVisible()

    answers.set(INBOX, () => null)
    await setupUser().click(retryOnTheScreen())

    expect(await screen.findByRole('link', { name: A_MESSAGE })).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
  }, SLOW)
})

describe('a screen that waits on more than one file', () => {
  it('asks again for the one that failed and not for the one that was read, and draws the calendar', async () => {
    theServerAnswers({ '/api/races': () => answeredWith(500) })
    renderAt('/sr/kalendar')

    expect(await screen.findByRole('alert')).toHaveTextContent(sr.data.error)

    const events = timesAsked('/api/events')

    answers.set('/api/races', () => null)
    await setupUser().click(retryOnTheScreen())

    expect(await screen.findByLabelText(sr.calendar.nextMonth)).toBeVisible()
    expect(timesAsked('/api/races')).toBe(2)
    expect(timesAsked('/api/events'), 'the file that had been read was asked for again').toBe(events)
  }, SLOW)

  it('asks again for every file that failed with ONE press, and draws the calendar', async () => {
    theServerAnswers({ '/api/races': () => answeredWith(500), '/api/events': () => answeredWith(500) })
    renderAt('/sr/kalendar')

    expect(await screen.findByRole('alert')).toHaveTextContent(sr.data.error)

    answers.set('/api/races', () => null)
    answers.set('/api/events', () => null)
    await setupUser().click(retryOnTheScreen())

    expect(await screen.findByLabelText(sr.calendar.nextMonth)).toBeVisible()
    expect(screen.queryByRole('alert'), 'one press left the second file saying it could not be read').toBeNull()
    expect(timesAsked('/api/races')).toBe(2)
    expect(timesAsked('/api/events')).toBe(2)
  }, SLOW)

  it('says what is still on its way, and no sentence about a failure, once the one that failed has been read', async () => {
    const stillOut = held()

    theServerAnswers({ '/api/races': () => answeredWith(500), '/api/events': stillOut.answer })
    renderAt('/sr/kalendar')

    /* An error wins over a wait, as it always did: a screen that is partly broken is broken. */
    expect(await screen.findByRole('alert')).toHaveTextContent(sr.data.error)

    answers.set('/api/races', () => null)
    await setupUser().click(retryOnTheScreen())

    /* The button goes when what failed has been read, and not before: while the asking is out it
       is still there, told off. What is left is the file that is still on its way. */
    await waitFor(() => expect(screen.queryByRole('button', { name: sr.data.retry })).toBeNull())
    expect(screen.queryByRole('alert')).toBeNull()
    expect(timesAsked('/api/races')).toBe(2)
    expect(loadingWords().length).toBeGreaterThan(0)
  }, SLOW)
})

describe('a part of a screen whose read failed', () => {
  it('names the button after the part, and leaves the screen it stands on readable', async () => {
    theServerAnswers({ '/api/races': () => answeredWith(500) })
    renderAt('/sr/kalendar/podgoricka-desetka-2027', 'visitor', null, undefined, '2026-12-31')

    expect(
      await screen.findByRole('button', { name: `${sr.data.retry}: ${sr.event.races}` }),
    ).toBeVisible()
    /* The event itself is still there: the part was loaded separately for exactly this. */
    expect(screen.getByRole('heading', { level: 1, name: /Podgorička desetka/ })).toBeVisible()
  }, SLOW)

  it('draws the part when it is asked again, and asks the server once for it', async () => {
    /* The wall of ducats stands in the rulebook and is read by nothing else on that screen, so the
       press is on the one reader there is: a part that several readers mount at different moments
       would make the count below a measurement of the moments. */
    theServerAnswers({ '/api/ducats': () => answeredWith(500) })
    renderAt('/sr/pravilnik')

    const name = `${sr.data.retry}: ${sr.ducats.title}`

    await screen.findByRole('button', { name })
    expect(screen.queryByRole('list', { name: sr.ducats.title })).toBeNull()

    answers.set('/api/ducats', () => null)
    await setupUser().click(screen.getByRole('button', { name }))

    expect(await screen.findByRole('list', { name: sr.ducats.title })).toBeVisible()
    expect(screen.queryByRole('button', { name })).toBeNull()
    expect(timesAsked('/api/ducats')).toBe(2)
  }, SLOW)

  it('names the button by its own word where the part has no name, and says that two such parts are two buttons with one name', async () => {
    theServerAnswers({ '/api/competitors': () => answeredWith(500) })
    renderAt('/sr/podesavanja', 'competitor', MEMBER)

    /* `Settings` draws two parts from one read and neither has a `label`. They say the same
       sentence, as they did before the button, and offer the same word twice: that is the
       boundary written in `components/Resource.tsx`, and it is held here so that a third part
       with no name is a decision somebody takes and not a thing that happens. */
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
    expect(screen.getAllByRole('button', { name: sr.data.retry })).toHaveLength(2)

    answers.set('/api/competitors', () => null)

    const first = must(screen.getAllByRole('button', { name: sr.data.retry })[0], 'the first button')

    await setupUser().click(first)

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.queryByRole('button', { name: sr.data.retry }), 'a press on one asked for the other no more').toBeNull()
    expect(timesAsked('/api/competitors')).toBe(2)
  }, SLOW)
})

describe('a failure that two readers of one address are both showing', () => {
  /** Opens the panel under the envelope, and hands back the button that opens it too: a press
   *  anywhere outside the panel shuts it, as it does for a reader. */
  async function openThePanel(user: ReturnType<typeof setupUser>) {
    const opener = await screen.findByRole('button', { name: /Otvori poruke/ })

    await user.click(opener)

    return {
      opener,
      panel: within(
        must(
          document.getElementById(must(opener.getAttribute('aria-controls'), 'what the button controls')),
          'the panel the button controls',
        ),
      ),
    }
  }

  it('is asked again for the panel under the envelope when the screen of messages is pressed', async () => {
    theServerAnswers({ [INBOX]: () => answeredWith(500) })
    renderAt('/sr/poruke', 'competitor', MEMBER)

    const user = setupUser()

    /* The screen first, while the panel is shut and says nothing anybody can read; then the panel,
       and both sentences are on the page. */
    await screen.findByRole('alert')

    const { opener, panel } = await openThePanel(user)

    expect(await panel.findByText(sr.shell.messagesUnreadable)).toBeVisible()
    expect(await screen.findAllByRole('alert')).toHaveLength(2)

    answers.set(INBOX, () => null)
    await user.click(retryOnTheScreen())

    /* The press was outside the panel, so it shut; a reader opens it again to look. What he finds
       is what the screen read: a sentence about a list that could not be read, left standing beside
       a screen that has just read it, is the sentence the decision is about. */
    expect(await screen.findByRole('link', { name: A_MESSAGE })).toBeVisible()
    await user.click(opener)
    expect(await panel.findByRole('link', { name: A_MESSAGE })).toBeVisible()
    expect(panel.queryByText(sr.shell.messagesUnreadable)).toBeNull()
    expect(timesAsked(INBOX), 'one asking again for the two of them').toBe(2)
  }, SLOW)

  it('is asked again for the screen of messages when the panel under the envelope is pressed', async () => {
    theServerAnswers({ [INBOX]: () => answeredWith(500) })
    renderAt('/sr/poruke', 'competitor', MEMBER)

    const user = setupUser()

    await screen.findByRole('alert')

    const { panel } = await openThePanel(user)

    expect(await screen.findAllByRole('alert')).toHaveLength(2)

    answers.set(INBOX, () => null)
    await user.click(await panel.findByRole('button', { name: `${sr.data.retry}: ${sr.shell.messages}` }))

    expect(await panel.findByRole('link', { name: A_MESSAGE })).toBeVisible()
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(timesAsked(INBOX)).toBe(2)
  }, SLOW)
})

/**
 * THE KEYBOARD, WHEN WHAT FAILED IS READ AGAIN AND WORKS (review of PR 476, round 2: a press with Enter
 * that worked left `document.activeElement` on `<body>`, on a whole screen and in the panel under the
 * envelope alike, 4 runs of 4, and the part was the same by construction; WCAG 2.2 SC 2.4.3).
 *
 * <p>The button the reader was standing on is taken out of the document when what failed is replaced
 * by what was read. `components/Resource.test.tsx` holds what `Resource` does with the news that it
 * left with the focus on it, one shape and one step at a time; these hold the three shapes on real
 * screens, with the press made the way a keyboard makes it (the focus put on the button, and Enter)
 * and the answer coming from a server.
 *
 * <p><b>The axes are the shape</b> (a whole screen, a part with a name, the panel under the envelope),
 * <b>whose the focus is when the answer arrives</b> (the button's; somebody else's because the reader
 * moved on while it asked; nobody's because the button never held it) <b>and who was pressed</b> (the
 * screen's own button with the panel under the envelope told as well, and the panel's own).
 *
 * <p>Held by what the answer is and not by a count: a reader who is put on the wrong element, or on
 * the right one when he should not have been moved, is told by `document.activeElement`.
 */
describe('the keyboard, when what failed is read again and works', () => {
  /** Opens the panel under the envelope with the keyboard's own button, and hands it back. */
  async function openThePanelOfTheEnvelope(user: ReturnType<typeof setupUser>) {
    const opener = await screen.findByRole('button', { name: /Otvori poruke/ })

    await user.click(opener)

    return {
      opener,
      panel: within(
        must(
          document.getElementById(must(opener.getAttribute('aria-controls'), 'what the button controls')),
          'the panel the button controls',
        ),
      ),
    }
  }

  it('is put on the main landmark of a whole screen that was read again', async () => {
    theServerAnswers({ '/api/teams': () => answeredWith(500) })
    renderAt('/sr/timovi')

    const button = await screen.findByRole('button', { name: sr.data.retry })

    answers.set('/api/teams', () => null)
    button.focus()
    await setupUser().keyboard('{Enter}')

    expect(await screen.findByRole('table', { name: sr.teams.title })).toBeVisible()
    expect(screen.getByRole('main'), 'a press that worked dropped the focus out of the screen').toHaveFocus()
  }, SLOW)

  it('is put in front of a part that was read again, on a node that says its name', async () => {
    /* The wall of ducats, read by nothing else on its screen, so the press is on the one reader there is. */
    theServerAnswers({ '/api/ducats': () => answeredWith(500) })
    renderAt('/sr/pravilnik')

    const name = `${sr.data.retry}: ${sr.ducats.title}`
    const button = await screen.findByRole('button', { name })

    answers.set('/api/ducats', () => null)
    button.focus()
    await setupUser().keyboard('{Enter}')

    const wall = await screen.findByRole('list', { name: sr.ducats.title })
    const kept = document.activeElement

    expect(kept, 'a press that worked dropped the focus out of the part').not.toBe(document.body)
    expect(kept).toHaveTextContent(sr.ducats.title)
    /* In front of the wall and in the same place, so the next thing read is the wall. */
    expect(kept?.parentElement?.contains(wall)).toBe(true)
    expect(kept?.compareDocumentPosition(wall)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  }, SLOW)

  it('is put on the title of the panel under the envelope, and the panel stays open', async () => {
    theServerAnswers({ [INBOX]: () => answeredWith(500) })
    renderAt('/sr', 'competitor', MEMBER)

    const user = setupUser()
    const { opener, panel } = await openThePanelOfTheEnvelope(user)
    const button = await panel.findByRole('button', { name: `${sr.data.retry}: ${sr.shell.messages}` })

    answers.set(INBOX, () => null)
    button.focus()

    const focus = vi.spyOn(HTMLElement.prototype, 'focus')

    try {
      await user.keyboard('{Enter}')

      expect(await panel.findByRole('link', { name: A_MESSAGE })).toBeVisible()

      const title = panel.getByText(sr.shell.messages)

      expect(
        document.activeElement,
        'a press that worked in the panel dropped the focus out of it',
      ).toBe(title)
      expect(opener).toHaveAttribute('aria-expanded', 'true')
      /* Not scrolled, as on a screen: the panel hangs from the bar and the page under it is where the
         reader left it. */
      expect(focus.mock.calls.filter((_call, at) => focus.mock.contexts[at] === title)).toEqual([
        [{ preventScroll: true }],
      ])
    } finally {
      focus.mockRestore()
    }
  }, SLOW)

  it('is not taken from a reader who moved the focus on while it asked', async () => {
    /* What the disc reader answers, kept before the server is put in front of it: the answer that is
       held below is the REAL one, let go when the case says so. */
    const disc = globalThis.fetch
    let letGo: () => void = () => undefined

    theServerAnswers({ '/api/teams': () => answeredWith(500) })
    renderAt('/sr/timovi')

    const button = await screen.findByRole('button', { name: sr.data.retry })

    answers.set(
      '/api/teams',
      () =>
        new Promise<Response>((resolve) => {
          letGo = () => {
            resolve(disc('/api/teams'))
          }
        }),
    )
    button.focus()
    await setupUser().keyboard('{Enter}')
    await waitFor(() => expect(loadingWords()).toHaveLength(1))

    /* The reader goes to the language button in the header while the screen is still asking. */
    const elsewhere = screen.getByRole('button', { name: /Jezik/ })

    elsewhere.focus()
    act(() => {
      letGo()
    })

    expect(await screen.findByRole('table', { name: sr.teams.title })).toBeVisible()
    expect(elsewhere, 'the focus was taken from where the reader had put it').toHaveFocus()
  }, SLOW)

  it('is not moved for a press that never had the focus on the button', async () => {
    theServerAnswers({ '/api/teams': () => answeredWith(500) })
    renderAt('/sr/timovi')

    const button = await screen.findByRole('button', { name: sr.data.retry })

    answers.set('/api/teams', () => null)
    fireEvent.click(button)

    expect(await screen.findByRole('table', { name: sr.teams.title })).toBeVisible()
    expect(document.body, 'the focus was given to a reader who was not standing on anything').toHaveFocus()
  }, SLOW)

  it('is put on the screen, and not on the panel, when it is the screen that was pressed', async () => {
    theServerAnswers({ [INBOX]: () => answeredWith(500) })
    renderAt('/sr/poruke', 'competitor', MEMBER)

    const button = await screen.findByRole('button', { name: sr.data.retry })

    answers.set(INBOX, () => null)
    button.focus()
    await setupUser().keyboard('{Enter}')

    expect(await screen.findByRole('link', { name: A_MESSAGE })).toBeVisible()
    /* The panel under the envelope was told as well and read what the screen read, and it did not take
       the keyboard: it was not the one that was pressed. */
    expect(screen.getByRole('main')).toHaveFocus()
  }, SLOW)

  it('is not taken from a reader who left the button of the panel while it asked', async () => {
    /* What the disc reader answers, kept before the server is put in front of it, as in the case of
       the whole screen above: the answer that is held is the REAL one. */
    const disc = globalThis.fetch
    let letGo: () => void = () => undefined

    theServerAnswers({ [INBOX]: () => answeredWith(500) })
    renderAt('/sr', 'competitor', MEMBER)

    const user = setupUser()
    const { panel } = await openThePanelOfTheEnvelope(user)
    const button = await panel.findByRole('button', { name: `${sr.data.retry}: ${sr.shell.messages}` })

    answers.set(
      INBOX,
      () =>
        new Promise<Response>((resolve) => {
          letGo = () => {
            resolve(disc(INBOX))
          }
        }),
    )
    button.focus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(loadingWords()).toHaveLength(1))

    /* The reader goes on to the link at the foot of the panel while it is still asking. */
    const elsewhere = panel.getByRole('link', { name: sr.shell.allMessages })

    elsewhere.focus()
    act(() => {
      letGo()
    })

    expect(await panel.findByRole('link', { name: A_MESSAGE })).toBeVisible()
    expect(elsewhere, 'the focus was taken from where the reader had put it').toHaveFocus()
  }, SLOW)
})
