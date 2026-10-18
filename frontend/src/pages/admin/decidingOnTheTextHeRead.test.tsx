import { configure, getConfig, screen, waitFor, within } from '@testing-library/react'
import { vi } from 'vitest'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { did, refused, serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { decisionPath } from './verificationWrites'
import { QUEUE } from './queues'

/**
 * A DECISION ABOUT A TEXT IS ABOUT THE WORDS THE CARD DREW, AND THE CARD DRAWS WHAT IT NAMES.
 *
 * <p>PDL P11, 18.10.2026 (derived from „isto kao za sliku" and from the owner's answer of 10.10.2026
 * about the picture, recorded as derived and told to him): „Odluka moderatora o tekstu važi samo za tekst
 * koji je video. Ako je član u međuvremenu poslao nov tekst, odluka se odbija rečenicom da je tekst
 * promenjen i da ga pogleda ponovo." This is `decidingOnThePictureHeSaw.test.tsx` for a biography, and
 * for the same four things on this side of the wire:
 *
 * <ul>
 * <li><b>What a decision names is the words the card drew</b> (`body`), for all three doors that
 * decide - the card's own Odobri, the box that hands a card back, and the sweep - and THAT card's own:
 * two cards side by side with two different texts, so a screen that sent the first card's words for the
 * second is a different request.
 * <li><b>Empty words are words</b>: a card whose text is empty names the empty string, never nothing.
 * <li><b>The refusal is said on the card and the list is read again</b>, so that the card holds what the
 * row holds now: a member overwrites the row that waits, and the card read before it still draws the
 * old words.
 * <li><b>And the next press names the words the card holds after it was read again</b>, not the ones it
 * first drew.
 * </ul>
 *
 * <p>Every case serves the list itself (`serverThat`), for the reason the picture's file gives.
 */

/* EVERY WAIT OF THIS FILE IS GIVEN HALF OF THE TIME A CASE HAS, for the reason the picture's file gives. */
configure({ asyncUtilTimeout: SLOW / 2 })

/** The sentence the route answers with, said whole and with its full stop, and written here rather than
 *  read off the route so that a reworded route fails the case instead of agreeing with itself. */
const THE_TEXT_WAS_CHANGED = 'Tekst je promenjen, pogledaj ga ponovo.'

const RATING = { organisation: 0, value: 0, ambience: 0 }

/** A row the schema really produces for a biography waiting in the profiles tab: no picture, no circle. */
function aBiographyOf(id: number, who: string, memberNumber: string, body: string) {
  return {
    queue: 'profiles' as const,
    id,
    date: '2026-09-20',
    memberNumber,
    who,
    subject: who,
    subjectId: '',
    body,
    kind: 'bio' as const,
    city: '',
    country: '',
    photoId: null,
    crop: null,
    rating: RATING,
  }
}

/** The words of the cards below. Different on purpose, and none a prefix of another. */
const NEDA_WORDS = 'Trčim od 2021. godine.'

const NEDA_CORRECTED = 'Trčim planinske trke već deset godina.'

const MIRA_WORDS = 'Volim duge staze i društvo.'

const neda = (body = NEDA_WORDS) => aBiographyOf(21, 'Neda Nedić', '000011', body)

const mira = (body = MIRA_WORDS) => aBiographyOf(23, 'Mira Mirić', '000013', body)

const asTheList = (rows: unknown[]): Response =>
  new Response(JSON.stringify(rows), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

const cardOf = (name: string) =>
  within(must(screen.getByRole('heading', { name }).closest('li'), `the card of ${name}`))

const openQueue = () => renderAt(`/sr/${QUEUE.profiles.path}`, 'superadmin')

describe('what a decision about a text names', () => {
  it("is the words the card drew, on the card whose Odobri was pressed and on no other", async () => {
    const { asked, stop } = serverThat((path) =>
      path === '/api/verification'
        ? asTheList([neda(), mira()])
        : path === decisionPath('23')
          ? did()
          : null,
    )

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(cardOf('Mira Mirić').getByRole('button', { name: 'Odobri' }))

      const bodies = asked
        .filter((one) => one.path.endsWith('/decision'))
        .map((one) => ({ path: one.path, body: JSON.parse(String(one.init?.body)) }))

      expect(bodies).toEqual([
        { path: decisionPath('23'), body: { approved: true, reason: '', seenText: MIRA_WORDS } },
      ])
    } finally {
      stop()
    }
  }, SLOW)

  it('is the words the card drew when it is the box that hands the card back', async () => {
    const { asked, stop } = serverThat((path) =>
      path === '/api/verification'
        ? asTheList([neda(), mira()])
        : path === decisionPath('21')
          ? did()
          : null,
    )

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(cardOf('Neda Nedić').getByRole('button', { name: 'Odbij' }))
      await user.type(screen.getByLabelText('Razlog odbijanja'), 'Prekratko.')
      await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

      const sent = asked.find((one) => one.path === decisionPath('21'))

      expect(JSON.parse(String(sent?.init?.body))).toEqual({
        approved: false,
        reason: 'Prekratko.',
        seenText: NEDA_WORDS,
      })
    } finally {
      stop()
    }
  }, SLOW)

  it("is each card's own words in a sweep", async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { asked, stop } = serverThat((path) =>
      path === '/api/verification'
        ? asTheList([neda(), mira()])
        : [decisionPath('21'), decisionPath('23')].includes(path)
          ? did()
          : null,
    )

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      await waitFor(() => {
        expect(screen.getByText(/^Rešen/)).toBeVisible()
      })

      const bodyOf = (path: string): unknown =>
        JSON.parse(String(asked.find((one) => one.path === path)?.init?.body))

      expect(bodyOf(decisionPath('21'))).toEqual({ approved: true, reason: '', seenText: NEDA_WORDS })
      expect(bodyOf(decisionPath('23'))).toEqual({ approved: true, reason: '', seenText: MIRA_WORDS })
    } finally {
      confirm.mockRestore()
      stop()
    }
  }, SLOW)

  it('is the empty string for a card whose words are empty, and never nothing', async () => {
    /* Empty words are words (`VerificationWriteApi.Answered.seenText`): a screen that sent the field
       only when it was truthy would send nothing here, and the route answers 400 to a biography that
       names none. */
    const { asked, stop } = serverThat((path) =>
      path === '/api/verification'
        ? asTheList([neda('')])
        : path === decisionPath('21')
          ? did()
          : null,
    )

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(cardOf('Neda Nedić').getByRole('button', { name: 'Odobri' }))

      const sent = asked.find((one) => one.path === decisionPath('21'))

      expect(JSON.parse(String(sent?.init?.body))).toEqual({
        approved: true,
        reason: '',
        seenText: '',
      })
    } finally {
      stop()
    }
  }, SLOW)
})

describe('when the route says the text is not the one the card drew', () => {
  /**
   * A SERVER THAT CHANGES ITS MIND BETWEEN TWO READS OF THE LIST, which is the whole of what „the member
   * wrote the text over while the moderator looked" is on the wire: the first list holds the card with
   * one text, the first decision about it is refused with the sentence of the route, and the list read
   * after that holds the same row with another text.
   */
  function aServerThatSaysItChanged(lists: unknown[][], decision: Array<() => Response>) {
    let read = 0
    let pressed = 0

    const server = serverThat((path) => {
      if (path === '/api/verification') {
        const list = lists[Math.min(read, lists.length - 1)] ?? []

        read += 1

        return asTheList(list)
      }

      if (path === decisionPath('21')) {
        const answer = decision[Math.min(pressed, decision.length - 1)] ?? did

        pressed += 1

        return answer()
      }

      return null
    })

    return { ...server, reads: () => read }
  }

  const changed = () => refused(THE_TEXT_WAS_CHANGED, 409)

  it('says so on the card, reads the list again, draws the new words and names them on the next press', async () => {
    const { asked, reads, stop } = aServerThatSaysItChanged(
      [[neda()], [neda(NEDA_CORRECTED)]],
      [changed, did],
    )

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      expect(cardOf('Neda Nedić').getByText(NEDA_WORDS)).toBeVisible()

      await user.click(cardOf('Neda Nedić').getByRole('button', { name: 'Odobri' }))

      /* THE SENTENCE, ON THE CARD IT IS ABOUT. */
      expect(await cardOf('Neda Nedić').findByRole('alert')).toHaveTextContent(THE_TEXT_WAS_CHANGED)

      /* THE LIST WAS READ AGAIN, and the card draws the words the row holds now. */
      await waitFor(() => {
        expect(cardOf('Neda Nedić').getByText(NEDA_CORRECTED)).toBeVisible()
      })
      expect(reads()).toBe(2)
      expect(cardOf('Neda Nedić').queryByText(NEDA_WORDS)).toBeNull()

      /* AND THE SENTENCE IS STILL THERE after the read: it is about a card that is still standing, and
         it tells the moderator why the text under him is another one. */
      expect(cardOf('Neda Nedić').getByRole('alert')).toHaveTextContent(THE_TEXT_WAS_CHANGED)

      await user.click(cardOf('Neda Nedić').getByRole('button', { name: 'Odobri' }))

      const bodies = asked
        .filter((one) => one.path === decisionPath('21'))
        .map((one) => JSON.parse(String(one.init?.body)))

      expect(bodies).toEqual([
        { approved: true, reason: '', seenText: NEDA_WORDS },
        { approved: true, reason: '', seenText: NEDA_CORRECTED },
      ])

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Neda Nedić' })).toBeNull()
      })
    } finally {
      stop()
    }
  }, SLOW)

  it('does the same when it is the box that hands the card back, and the reason he typed goes with the box', async () => {
    const { asked, reads, stop } = aServerThatSaysItChanged(
      [[neda()], [neda(NEDA_CORRECTED)]],
      [changed, did],
    )

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(cardOf('Neda Nedić').getByRole('button', { name: 'Odbij' }))
      await user.type(screen.getByLabelText('Razlog odbijanja'), 'Prekratko.')
      await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

      expect(await cardOf('Neda Nedić').findByRole('alert')).toHaveTextContent(THE_TEXT_WAS_CHANGED)
      /* The box closed over the reason, as it closes over every answer (owner, 02.10.2026): a reason
         typed about one text is not carried over to the next. */
      expect(screen.queryByLabelText('Razlog odbijanja')).toBeNull()

      await waitFor(() => {
        expect(cardOf('Neda Nedić').getByText(NEDA_CORRECTED)).toBeVisible()
      })
      expect(reads()).toBe(2)

      await user.click(cardOf('Neda Nedić').getByRole('button', { name: 'Odbij' }))
      await user.type(screen.getByLabelText('Razlog odbijanja'), 'Još uvek prekratko.')
      await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

      const bodies = asked
        .filter((one) => one.path === decisionPath('21'))
        .map((one) => JSON.parse(String(one.init?.body)))

      expect(bodies).toEqual([
        { approved: false, reason: 'Prekratko.', seenText: NEDA_WORDS },
        { approved: false, reason: 'Još uvek prekratko.', seenText: NEDA_CORRECTED },
      ])
    } finally {
      stop()
    }
  }, SLOW)

  it('reads the list again once for a whole sweep, however many texts were refused', async () => {
    /* THREE CARDS, TWO REFUSED: a read per refusal would be a third read. */
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    let reads = 0
    const { stop } = serverThat((path) => {
      if (path === '/api/verification') {
        reads += 1

        return asTheList(
          reads === 1
            ? [neda(), mira(), aBiographyOf(25, 'Zora Zorić', '000014', 'Trčim sporo.')]
            : [
                neda(NEDA_CORRECTED),
                mira('Volim kratke staze.'),
                aBiographyOf(25, 'Zora Zorić', '000014', 'Trčim sporo.'),
              ],
        )
      }

      return path === decisionPath('25')
        ? did()
        : path === decisionPath('21') || path === decisionPath('23')
          ? changed()
          : null
    })

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      await waitFor(() => {
        expect(cardOf('Neda Nedić').getByText(NEDA_CORRECTED)).toBeVisible()
      })
      expect(cardOf('Mira Mirić').getByText('Volim kratke staze.')).toBeVisible()
      expect(reads).toBe(2)
    } finally {
      confirm.mockRestore()
      stop()
    }
  }, SLOW)
})

describe('what a case of this file may end in', () => {
  it('is an assertion and never its own clock: every wait is given less time than a case has', () => {
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})
