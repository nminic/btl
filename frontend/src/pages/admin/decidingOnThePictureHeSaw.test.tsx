import { screen, waitFor, within } from '@testing-library/react'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { did, refused, serverThat } from '../../test/serverAnswers'
import { setupUser } from '../../test/user'
import { decisionPath } from './verificationWrites'
import { QUEUE } from './queues'

/**
 * A DECISION ABOUT A PICTURE IS ABOUT THE PICTURE THE CARD DREW, AND THE CARD DRAWS WHAT IT NAMES.
 *
 * <p>PDL, the owner's answers of 10.10.2026. About approving: „Odobrava se samo slika koju je
 * moderator video (odluka nosi otisak; promenjena slika se odbija rečenicom)." About refusing,
 * which he chose between the outcomes offered: „I odbijanje slike traži viđenu sliku. Obe odluke
 * o profilnoj slici, odobravanje i odbijanje, važe samo za sliku koju je moderator video; ako je
 * slika u međuvremenu promenjena, odluka se odbija istom rečenicom „Slika je promenjena, pogledaj
 * je ponovo." i red ostaje."
 *
 * <p><b>Four things have to hold on this side of the wire, and each has a case that fails when it
 * does not.</b>
 *
 * <ul>
 * <li><b>What a decision names is the picture the card drew</b> (`photoId`), for all three doors
 * that decide: the card's own Odobri, the box that hands a card back, and the sweep. And it names
 * THAT card's own: two cards side by side, so a screen that sent the first card's key for the
 * second is a different request.
 * <li><b>A card that drew no picture names none</b>, because the route answers 400 to a key
 * beside a biography.
 * <li><b>The refusal is said on the card and the list is read again</b>, so that the card holds
 * what the row holds now (`readTheQueueAgain`; the review of T5).
 * <li><b>And the card DRAWS what it holds</b>: the address of the picture moves with the number,
 * because the row's address does not. This is the case that matters most and the one nothing
 * else could see: with the old address a card read again with a new `photoId` keeps its element
 * and its pixels, and the next press names a picture the moderator never saw.
 * </ul>
 *
 * <p>Every case serves the list itself (`serverThat`) and never the disc's, because the disc's
 * `verification.json` carries no `photoId` on any row (`moderatorSeesThePicture.test.tsx` says so)
 * and a card that draws no picture is exactly what these cases are not about.
 */

/** The owner's sentence, said whole and with its full stop, and written here rather than read
 *  off the route so that a reworded route fails the case instead of agreeing with itself. */
const THE_PICTURE_WAS_CHANGED = 'Slika je promenjena, pogledaj je ponovo.'

const SOMEBODY_ANSWERED_IT_ALREADY = 'O stavci je već odlučeno.'

const RATING = { organisation: 0, value: 0, ambience: 0 }

/** A row the schema really produces for an uploaded photograph, as `moderatorSeesThePicture`
 *  builds one, with the key of the picture it holds the thing the cases below vary. */
function aPictureOf(id: number, who: string, memberNumber: string, photoId: number) {
  return {
    queue: 'profiles' as const,
    id,
    date: '2026-09-20',
    memberNumber,
    who,
    subject: who,
    subjectId: '',
    body: '',
    kind: 'photo' as const,
    city: '',
    country: '',
    photoId,
    rating: RATING,
  }
}

/** The other sort of row on the same tab, which holds no picture at all. */
const aBiography = {
  ...aPictureOf(22, 'Petar Petrović', '000012', 0),
  body: 'Trčim od malena, najviše volim brdske staze.',
  kind: 'bio' as const,
  photoId: null,
}

const neda = (photoId = 9) => aPictureOf(21, 'Neda Nedić', '000011', photoId)

const mira = (photoId = 12) => aPictureOf(23, 'Mira Mirić', '000013', photoId)

const asTheList = (rows: unknown[]): Response =>
  new Response(JSON.stringify(rows), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

const cardOf = (name: string) =>
  within(must(screen.getByRole('heading', { name }).closest('li'), `the card of ${name}`))

const openQueue = () => renderAt(`/sr/${QUEUE.profiles.path}`, 'superadmin')

const pictureOf = (name: string) =>
  cardOf(name).getByRole('img', { name: /Slika koju je poslao/ }).getAttribute('src')

describe('what a decision about a picture names', () => {
  it('is the picture the card drew, on the card whose Odobri was pressed and on no other', async () => {
    /* TWO PICTURES SIDE BY SIDE, and the second one pressed: a screen that named the first
       card's key, the last card's, or the number of a card instead of its picture is a different
       request from the one asserted. Nine and twelve are neither the card numbers (21, 23) nor
       each other. */
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

      const sent = asked.filter((one) => one.path.startsWith('/api/verification/') && one.path.endsWith('/decision'))

      expect(sent.map((one) => one.path)).toEqual([decisionPath('23')])
      expect(JSON.parse(String(sent[0]?.init?.body))).toEqual({
        approved: true,
        reason: '',
        seenPhotoId: 12,
      })
    } finally {
      stop()
    }
  })

  it('is the picture the card drew when the box hands the card back, with the reason beside it', async () => {
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

      await user.click(cardOf('Mira Mirić').getByRole('button', { name: 'Odbij' }))
      await user.type(screen.getByLabelText('Razlog odbijanja'), 'Lice se ne vidi.')
      await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

      const sent = asked.find((one) => one.path === decisionPath('23'))

      expect(sent, 'a request to the decision route').toBeDefined()
      expect(JSON.parse(String(sent?.init?.body))).toEqual({
        approved: false,
        reason: 'Lice se ne vidi.',
        seenPhotoId: 12,
      })
    } finally {
      stop()
    }
  })

  it("is each card's own picture in a sweep, and nothing for the biography between them", async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { asked, stop } = serverThat((path) =>
      path === '/api/verification'
        ? asTheList([neda(), aBiography, mira()])
        : [decisionPath('21'), decisionPath('22'), decisionPath('23')].includes(path)
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

      expect(bodyOf(decisionPath('21'))).toEqual({ approved: true, reason: '', seenPhotoId: 9 })
      expect(bodyOf(decisionPath('23'))).toEqual({ approved: true, reason: '', seenPhotoId: 12 })
      /* NOTHING NAMED beside the biography: the route answers 400 to a key where the row holds
         no picture, so a sweep that named one for every card would settle two of the three. */
      expect(bodyOf(decisionPath('22'))).toEqual({ approved: true, reason: '' })
    } finally {
      confirm.mockRestore()
      stop()
    }
  })

  it('is nothing at all for a card that drew no picture, whichever answer', async () => {
    const { asked, stop } = serverThat((path) =>
      path === '/api/verification'
        ? asTheList([aBiography])
        : path === decisionPath('22')
          ? did()
          : null,
    )

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(cardOf('Petar Petrović').getByRole('button', { name: 'Odbij' }))
      await user.type(screen.getByLabelText('Razlog odbijanja'), 'Prekratko.')
      await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

      const sent = asked.find((one) => one.path === decisionPath('22'))

      expect(JSON.parse(String(sent?.init?.body))).toEqual({
        approved: false,
        reason: 'Prekratko.',
      })
    } finally {
      stop()
    }
  })
})

describe('when the route says the picture is not the one the card drew', () => {
  /**
   * A SERVER THAT CHANGES ITS MIND BETWEEN TWO READS OF THE LIST, which is the whole of what
   * „the member sent another picture while the moderator looked" is on the wire: the first list
   * holds the card with one key, the first decision about it is refused with the owner's
   * sentence, and the list read after that holds the same row with another key.
   *
   * @param lists the lists, in the order they are read; the last one is served to every read after
   * @param decision what the route answers to each decision about the card, in order; the last is
   *                 served to every decision after
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

  const changed = () => refused(THE_PICTURE_WAS_CHANGED, 409)

  it('says so on the card, reads the list again, draws the new picture and names it on the next press', async () => {
    /* ONE CASE FOR THE FOUR THINGS because they are one story and each is only true in the
       order they happen: the sentence stays through the second read, the second read is what
       moves the address, and the address is what the next press has to agree with. */
    const { asked, reads, stop } = aServerThatSaysItChanged(
      [[neda(9)], [neda(10)]],
      [changed, did],
    )

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      expect(pictureOf('Neda Nedić')).toBe('/api/verification/21/photo?photo=9')

      await user.click(cardOf('Neda Nedić').getByRole('button', { name: 'Odobri' }))

      /* THE SENTENCE, ON THE CARD IT IS ABOUT, in the owner's words. */
      expect(await cardOf('Neda Nedić').findByRole('alert')).toHaveTextContent(
        THE_PICTURE_WAS_CHANGED,
      )

      /* THE LIST WAS READ AGAIN, and the card draws the picture the row holds now. The address
         is asserted and not only the count of reads: the row's own address is the same character
         for character, so a card that was read again and kept its `src` would have drawn the old
         pixels beside a decision that names the new picture. */
      await waitFor(() => {
        expect(pictureOf('Neda Nedić')).toBe('/api/verification/21/photo?photo=10')
      })
      expect(reads()).toBe(2)

      /* AND THE SENTENCE IS STILL THERE after the read: it is about a card that is still standing,
         and it tells the moderator why the picture under him is another one. */
      expect(cardOf('Neda Nedić').getByRole('alert')).toHaveTextContent(THE_PICTURE_WAS_CHANGED)

      await user.click(cardOf('Neda Nedić').getByRole('button', { name: 'Odobri' }))

      const bodies = asked
        .filter((one) => one.path === decisionPath('21'))
        .map((one) => JSON.parse(String(one.init?.body)))

      expect(bodies).toEqual([
        { approved: true, reason: '', seenPhotoId: 9 },
        { approved: true, reason: '', seenPhotoId: 10 },
      ])

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Neda Nedić' })).toBeNull()
      })
    } finally {
      stop()
    }
  })

  it('does the same when it is the box that hands the card back, and the reason he typed goes with the box', async () => {
    const { asked, reads, stop } = aServerThatSaysItChanged(
      [[neda(9)], [neda(10)]],
      [changed, did],
    )

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(cardOf('Neda Nedić').getByRole('button', { name: 'Odbij' }))
      await user.type(screen.getByLabelText('Razlog odbijanja'), 'Slika je mutna.')
      await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

      expect(await cardOf('Neda Nedić').findByRole('alert')).toHaveTextContent(
        THE_PICTURE_WAS_CHANGED,
      )
      /* The box closed over the reason, as it closes over every answer (owner, 02.10.2026): a
         reason typed about one picture is not carried over to the next. */
      expect(screen.queryByLabelText('Razlog odbijanja')).toBeNull()

      await waitFor(() => {
        expect(pictureOf('Neda Nedić')).toBe('/api/verification/21/photo?photo=10')
      })
      expect(reads()).toBe(2)

      await user.click(cardOf('Neda Nedić').getByRole('button', { name: 'Odbij' }))
      await user.type(screen.getByLabelText('Razlog odbijanja'), 'Slika je i dalje mutna.')
      await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

      const bodies = asked
        .filter((one) => one.path === decisionPath('21'))
        .map((one) => JSON.parse(String(one.init?.body)))

      expect(bodies).toEqual([
        { approved: false, reason: 'Slika je mutna.', seenPhotoId: 9 },
        { approved: false, reason: 'Slika je i dalje mutna.', seenPhotoId: 10 },
      ])
    } finally {
      stop()
    }
  })

  it('reads the list again once for a whole sweep, however many pictures were refused', async () => {
    /* THREE PICTURES, TWO REFUSED: a read per refusal would be a third read, and the sentence
       says once for the whole walk. */
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    let reads = 0
    const { stop } = serverThat((path) => {
      if (path === '/api/verification') {
        reads += 1

        return asTheList(
          reads === 1
            ? [neda(9), mira(12), aPictureOf(25, 'Zora Zorić', '000014', 14)]
            : [neda(10), mira(13), aPictureOf(25, 'Zora Zorić', '000014', 14)],
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
        expect(pictureOf('Neda Nedić')).toBe('/api/verification/21/photo?photo=10')
      })
      expect(pictureOf('Mira Mirić')).toBe('/api/verification/23/photo?photo=13')
      expect(reads).toBe(2)
    } finally {
      confirm.mockRestore()
      stop()
    }
  })

  it('says it over the list and not on a card when the card went with the list it was read in', async () => {
    /* ANOTHER MODERATOR GOT THERE FIRST: the route says the row was decided, the list read after
       it no longer holds the card, and the sentence that was about it has nowhere to stand. It is
       said over the list where the card was, the shape `ReviewQueue.tsx` gives the same case. */
    const { stop } = aServerThatSaysItChanged(
      [[neda(9)], []],
      [() => refused(SOMEBODY_ANSWERED_IT_ALREADY, 409)],
    )

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(cardOf('Neda Nedić').getByRole('button', { name: 'Odobri' }))

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Neda Nedić' })).toBeNull()
      })

      expect(screen.getByRole('alert')).toHaveTextContent(SOMEBODY_ANSWERED_IT_ALREADY)
    } finally {
      stop()
    }
  })

  it('does not say it over another queue the moderator goes to afterwards', async () => {
    /* WHAT THE FALLBACK ABOVE RELIES ON, and holds rather than writes: the screen is mounted afresh
       for each queue, so a sentence about a card the list no longer holds is gone with the screen it
       was said on and is never, to the next queue, a sentence about a card that is not in ITS list
       either. Measured on 10.10.2026 by taking the guard `said` once had for this (its queue)
       away: nothing went red, and the guard was removed as the code nothing could fail. If this
       case ever goes red, the screen has started to outlive a change of queue, and the fallback
       has to remember which queue it spoke in. */
    const { stop } = aServerThatSaysItChanged(
      [[neda(9)], []],
      [() => refused(SOMEBODY_ANSWERED_IT_ALREADY, 409)],
    )

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(cardOf('Neda Nedić').getByRole('button', { name: 'Odobri' }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(SOMEBODY_ANSWERED_IT_ALREADY)
      })

      await user.click(screen.getByRole('link', { name: /Komentari/ }))

      /* The other queue's own heading, so the assertion below is made on the other queue and not
         on the one just left, which also says „Nema nijedne stavke na čekanju." */
      await screen.findByRole('heading', { level: 1, name: 'Komentari' })
      expect(screen.queryByRole('alert')).toBeNull()
    } finally {
      stop()
    }
  })

  it('leaves the list as it was when the refusal is about a card that drew no picture', async () => {
    /* THE EXTENT OF WHAT WAS ASKED: a refusal about a biography says what it says over a card that
       stays where it was, and nothing is read again. Asserted by waiting for the sentence and then
       for the macrotask a read would have taken, since „no second read" cannot be waited for. */
    let reads = 0
    const { stop } = serverThat((path) => {
      if (path === '/api/verification') {
        reads += 1

        return asTheList([aBiography])
      }

      return path === decisionPath('22') ? refused(SOMEBODY_ANSWERED_IT_ALREADY, 409) : null
    })

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(cardOf('Petar Petrović').getByRole('button', { name: 'Odobri' }))

      expect(await cardOf('Petar Petrović').findByRole('alert')).toHaveTextContent(
        SOMEBODY_ANSWERED_IT_ALREADY,
      )
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(reads).toBe(1)
    } finally {
      stop()
    }
  })
})
