import { act, configure, fireEvent, getConfig, screen, waitFor, within } from '@testing-library/react'
import { must } from '../../test/at'
import { renderAt } from '../../test/render'
import { answeredWith, did, refused, serverThat, type Asked } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { pictureOn, thePictureArrives, thePictureFails } from '../../test/waitingPicture'
import { decisionPath } from './verificationWrites'
import { QUEUE } from './queues'

/**
 * THE TWO BUTTONS OF A CARD WAIT FOR THE PICTURE THE MODERATOR IS TO LOOK AT.
 *
 * <p>PDL, 11.10.2026, under „I odbijanje slike traži viđenu sliku" (the owner chose between the outcomes he
 * was offered, against the recommendation for the first): „„Odobri" i „Odbij" čekaju da se slika učita, već
 * za release. Dok se slika učitava, oba dugmeta su neaktivna; kad se učita, oba rade." And, with the
 * recommendation: „Slika koja se nije učitala sme da se odbije, i odbijanje nosi ključ i krug, pa član čiji
 * je fajl nestao može da se odbije." Approving such a picture stays shut, as it has since PDL 27.09.2026.
 *
 * <p><b>Four states, and the cases that press put several cards in different ones at once.</b> A picture on
 * its way, one that arrived, one that could not be drawn, and a card that draws none (a biography). One card
 * in one state is satisfied by a screen that answers every card the same way, and by one that reads the state
 * of the card next to it: the owner's sentence is about WHICH card's picture, so the cases look at what each
 * of several cards does. Where a case needs all four the list is `[Neda, Mira, Zora, Petar]`: Neda's picture
 * never says anything, Mira's arrives, Zora's fails, and Petar has none. The cases about a picture that is
 * replaced, and the one about two rows that hold the same number, use two cards.
 *
 * <p><b>Told off, not switched off</b> (`aria-disabled`, and not `disabled`): the same shape every control
 * on this screen that cannot act has (`PendingQueue.tsx`; `SendBack.tsx`), so the keyboard still lands on
 * it. `aria-disabled` stops nothing by itself, so each case that says a button is told off also presses it.
 *
 * <p>`decidingOnThePictureHeSaw.test.tsx` says first that the picture arrived before every press of its own;
 * this file is where what a card does BEFORE that, and when it never does, is held.
 *
 * <p>The sweep is held here too, and in two places: which cards it takes when it is pressed (the group over
 * cards in different states), and what it does with a picture that arrives AFTER the press, while the walk is
 * out (the group at the foot of it). The second is the owner's „Moderator mora da vidi sliku koju odobrava"
 * read at the instant he decides: the set is taken once, at the press.
 */

/* EVERY WAIT OF THIS FILE IS GIVEN HALF OF THE TIME A CASE HAS, which is what `saveWhileSaving.test.tsx`
   and `decidingOnThePictureHeSaw.test.tsx` do for the same reason: the global is `SLOW` for a wait
   (`test/setup.ts`), and a wait that never succeeds would otherwise be ended by the clock of its case
   (`Test timed out`) and not by an assertion, which a series of mutations that does not tell the two apart
   counts as caught. The last case holds that the half is still half. */
configure({ asyncUtilTimeout: SLOW / 2 })

const THE_PICTURE_WAS_CHANGED = 'Slika je promenjena, pogledaj je ponovo.'

const SOMEBODY_ANSWERED_IT_ALREADY = 'O stavci je već odlučeno.'

const THE_PICTURE_IS_NOT_AVAILABLE =
  'Slika nije dostupna: fajl se ne može učitati, pa se ovaj red ne može odobriti dok se slika ne vidi. Odbijanje i dalje radi.'

const RATING = { organisation: 0, value: 0, ambience: 0 }

/** Three circles, none of them the whole picture and no number of one repeated in another, so a request
 *  that carries the wrong card's circle, or the placeholder, is another request. */
const NEDA_CROP = { x: 0.3, y: 0.7, size: 0.45 }

const MIRA_CROP = { x: 0.125, y: 0.2, size: 0.8 }

const ZORA_CROP = { x: 0.55, y: 0.15, size: 0.35 }

/** A row the schema really produces for an uploaded photograph, with the key of the picture it holds and
 *  the circle over it. */
function aPictureOf(
  id: number,
  who: string,
  memberNumber: string,
  photoId: number,
  crop: { x: number; y: number; size: number },
) {
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
    crop,
    rating: RATING,
  }
}

const neda = (photoId = 9) => aPictureOf(21, 'Neda Nedić', '000011', photoId, NEDA_CROP)

const mira = (photoId = 12) => aPictureOf(23, 'Mira Mirić', '000013', photoId, MIRA_CROP)

const zora = (photoId = 14) => aPictureOf(25, 'Zora Zorić', '000014', photoId, ZORA_CROP)

/** The other sort of row on the same tab, which holds no picture at all: a card that waits for nothing. */
const petar = {
  ...aPictureOf(22, 'Petar Petrović', '000012', 0, NEDA_CROP),
  body: 'Trčim od malena, najviše volim brdske staze.',
  kind: 'bio' as const,
  photoId: null,
  crop: null,
}

/** The words of that row as the list serves them, written out here and never read off the row: a
 *  decision about a biography names the words its card drew (`seenText`, PDL P11, 18.10.2026). */
const THE_BIOGRAPHYS_WORDS = 'Trčim od malena, najviše volim brdske staze.'

const asTheList = (rows: unknown[]): Response =>
  new Response(JSON.stringify(rows), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

/** A server that answers the list, and every decision about the rows it is told of with `did()`. */
function aServerThatTakesTheDecisions(rows: unknown[], decided: string[] = []) {
  return serverThat((path) =>
    path === '/api/verification' ? asTheList(rows) : decided.includes(path) ? did() : null,
  )
}

const cardOf = (name: string) =>
  within(must(screen.getByRole('heading', { name }).closest('li'), `the card of ${name}`))

const approveOf = (name: string) => cardOf(name).getByRole('button', { name: 'Odobri' })

const refuseOf = (name: string) => cardOf(name).getByRole('button', { name: 'Odbij' })

const openQueue = () => renderAt(`/sr/${QUEUE.profiles.path}`, 'superadmin')

const bodyOf = (init: RequestInit | undefined): unknown => JSON.parse(String(init?.body))

/** The decisions that have been asked, with the body each carried, in the order they were asked. */
const decisionsIn = (asked: Asked[]) =>
  asked
    .filter((one) => one.path.endsWith('/decision'))
    .map((one) => ({ path: one.path, body: bodyOf(one.init) }))

/** The queue with all four states, which is the setup the cases of the first two groups start from: Mira's
 *  picture has arrived, Zora's could not be drawn, Neda's has not said anything, and Petar draws none. */
async function inTheFourStates() {
  openQueue()
  await screen.findByRole('list', { name: /Čeka/ })
  thePictureArrives(cardOf('Mira Mirić'))
  thePictureFails(cardOf('Zora Zorić'))
}

/** A decision the route answers only when the case lets it, so that a walk is PARKED on that card for as
 *  long as the case wants and a picture can arrive while it is. */
function aDecisionThatWaits(path: string): { path: string; answer: Promise<Response>; release: () => void } {
  let release = (): void => {}
  const answer = new Promise<Response>((resolve) => {
    release = () => resolve(did())
  })

  return { path, answer, release }
}

/** A server that answers the list, holds the decision it is told of until the case lets it go, and takes the
 *  decisions about `taken` at once. */
function aServerThatHolds(
  rows: unknown[],
  held: ReturnType<typeof aDecisionThatWaits>,
  taken: string[],
) {
  return serverThat((path) =>
    path === '/api/verification'
      ? asTheList(rows)
      : path === held.path
        ? held.answer
        : taken.includes(path)
          ? did()
          : null,
  )
}

/** The walk is PARKED on the held card: the route has been asked about that card and about nothing else. */
const parkedOn = (asked: Asked[], path: string) =>
  waitFor(() => {
    expect(decisionsIn(asked).map((one) => one.path)).toEqual([path])
  })

/** The sweep has said how many it settled, which is the last thing it does. */
const sweepIsOver = () =>
  waitFor(() => {
    expect(screen.getByText(/^Rešen/)).toBeVisible()
  })

describe('the two buttons of a card, by what has become of the picture on it', () => {
  it('are told off or live by the state of the picture on each card, four cards at once', async () => {
    const { stop } = aServerThatTakesTheDecisions([neda(), mira(), zora(), petar])

    try {
      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      /* BEFORE ANYTHING IS SAID about any picture the three that draw one are on their way: neither of
         their buttons answers. Told off and not switched off, so the keyboard still lands on them. */
      for (const name of ['Neda Nedić', 'Mira Mirić', 'Zora Zorić']) {
        expect(approveOf(name), `Odobri of ${name} while its picture is on its way`).toHaveAttribute(
          'aria-disabled',
          'true',
        )
        expect(refuseOf(name), `Odbij of ${name} while its picture is on its way`).toHaveAttribute(
          'aria-disabled',
          'true',
        )
        expect(approveOf(name)).not.toBeDisabled()
        expect(refuseOf(name)).not.toBeDisabled()
        /* And nothing to point at while it waits: the dictionary has no sentence for it, and an
           `aria-describedby` that named one would name an element that is not there. */
        expect(approveOf(name)).not.toHaveAttribute('aria-describedby')
      }

      /* The card that draws no picture waits for nothing, from the first render. */
      expect(approveOf('Petar Petrović')).toHaveAttribute('aria-disabled', 'false')
      expect(refuseOf('Petar Petrović')).not.toHaveAttribute('aria-disabled')

      thePictureArrives(cardOf('Mira Mirić'))
      thePictureFails(cardOf('Zora Zorić'))

      /* ARRIVED: both. Odbij carries no attribute at all while it is live, the way a control that is not
         held does everywhere else on the portal; Odobri says `false`, as it always has. */
      expect(approveOf('Mira Mirić')).toHaveAttribute('aria-disabled', 'false')
      expect(refuseOf('Mira Mirić')).not.toHaveAttribute('aria-disabled')

      /* FAILED: the refusal only, and the approval points at the sentence that says why. */
      expect(approveOf('Zora Zorić')).toHaveAttribute('aria-disabled', 'true')
      expect(approveOf('Zora Zorić')).toHaveAccessibleDescription(THE_PICTURE_IS_NOT_AVAILABLE)
      expect(refuseOf('Zora Zorić')).not.toHaveAttribute('aria-disabled')

      /* AND THE ONE THAT SAID NOTHING STILL WAITS, after the two beside it have each said theirs: what
         a card does follows its own picture, not the last one to report and not the first card. */
      expect(approveOf('Neda Nedić')).toHaveAttribute('aria-disabled', 'true')
      expect(refuseOf('Neda Nedić')).toHaveAttribute('aria-disabled', 'true')
      expect(approveOf('Petar Petrović')).toHaveAttribute('aria-disabled', 'false')
      expect(refuseOf('Petar Petrović')).not.toHaveAttribute('aria-disabled')
    } finally {
      stop()
    }
  }, SLOW)

  it('answers no press of Odobri while the picture is on its way, and the press after it has arrived names the picture and the circle', async () => {
    const { asked, stop } = aServerThatTakesTheDecisions([neda(), mira(), zora(), petar], [decisionPath('21')])

    try {
      const user = setupUser()

      await inTheFourStates()

      await user.click(approveOf('Neda Nedić'))

      expect(decisionsIn(asked), 'a press on the card whose picture is on its way asks the route nothing').toEqual([])

      thePictureArrives(cardOf('Neda Nedić'))
      await user.click(approveOf('Neda Nedić'))

      /* The card that was pressed and no other, and its own key and its own circle: Mira's and Zora's
         pictures have both reported, and neither of them is asked about. */
      expect(decisionsIn(asked)).toEqual([
        {
          path: decisionPath('21'),
          body: { approved: true, reason: '', seenPhotoId: 9, seenCrop: NEDA_CROP },
        },
      ])
    } finally {
      stop()
    }
  }, SLOW)

  it('opens no box under Odbij while the picture is on its way, and opens it, naming the picture and the circle, once it has arrived', async () => {
    const { asked, stop } = aServerThatTakesTheDecisions([neda(), mira(), zora(), petar], [decisionPath('21')])

    try {
      const user = setupUser()

      await inTheFourStates()

      await user.click(refuseOf('Neda Nedić'))

      expect(
        screen.queryByLabelText('Razlog odbijanja'),
        'a press on the card whose picture is on its way opens no box for a reason',
      ).toBeNull()

      thePictureArrives(cardOf('Neda Nedić'))
      await user.click(refuseOf('Neda Nedić'))
      await user.type(screen.getByLabelText('Razlog odbijanja'), 'Slika je mutna.')
      await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

      expect(decisionsIn(asked)).toEqual([
        {
          path: decisionPath('21'),
          body: { approved: false, reason: 'Slika je mutna.', seenPhotoId: 9, seenCrop: NEDA_CROP },
        },
      ])
    } finally {
      stop()
    }
  }, SLOW)

  it('lets a picture that never came be refused, naming its own key and circle, and does not let it be approved', async () => {
    const { asked, stop } = aServerThatTakesTheDecisions([neda(), mira(), zora(), petar], [decisionPath('25')])

    try {
      const user = setupUser()

      await inTheFourStates()

      await user.click(approveOf('Zora Zorić'))

      expect(decisionsIn(asked), 'the approval of a picture that could not be drawn asks the route nothing').toEqual([])

      await user.click(refuseOf('Zora Zorić'))
      await user.type(screen.getByLabelText('Razlog odbijanja'), 'Fajl je nestao.')
      await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

      /* Zora's own key and circle, and neither Mira's (the picture that arrived) nor Neda's (the one
         that did not report): the refusal of a picture nobody could see names the one it was about. */
      expect(decisionsIn(asked)).toEqual([
        {
          path: decisionPath('25'),
          body: { approved: false, reason: 'Fajl je nestao.', seenPhotoId: 14, seenCrop: ZORA_CROP },
        },
      ])
    } finally {
      stop()
    }
  }, SLOW)

  it('makes a card that draws no picture wait for nothing, whatever the pictures beside it are doing', async () => {
    const { asked, stop } = aServerThatTakesTheDecisions(
      [neda(), mira(), zora(), petar],
      [decisionPath('22')],
    )

    try {
      const user = setupUser()

      /* NOTHING IS SAID about any picture on the screen: all three are on their way, and the biography
         between them is decided all the same. */
      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(approveOf('Petar Petrović'))
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Petar Petrović' })).toBeNull()
      })

      /* Named nothing: the route answers 400 to a key or a circle beside a row that holds no picture. */
      expect(decisionsIn(asked)).toEqual([
        { path: decisionPath('22'), body: { approved: true, reason: '', seenText: THE_BIOGRAPHYS_WORDS } },
      ])
    } finally {
      stop()
    }
  }, SLOW)

  it('refuses a card that draws no picture without waiting for one, naming none', async () => {
    const { asked, stop } = aServerThatTakesTheDecisions(
      [neda(), mira(), zora(), petar],
      [decisionPath('22')],
    )

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(refuseOf('Petar Petrović'))
      await user.type(screen.getByLabelText('Razlog odbijanja'), 'Prekratko.')
      await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

      expect(decisionsIn(asked)).toEqual([
        { path: decisionPath('22'),
          body: { approved: false, reason: 'Prekratko.', seenText: THE_BIOGRAPHYS_WORDS },
        },
      ])
    } finally {
      stop()
    }
  }, SLOW)

  it('is told off to the keyboard as well: the focus lands on a button that waits, and a key does what a click does', async () => {
    const { asked, stop } = aServerThatTakesTheDecisions([neda(), mira(), zora(), petar], [decisionPath('21')])

    try {
      const user = setupUser()

      await inTheFourStates()

      /* Reachable: `aria-disabled` and not `disabled`, which would take it out of the order of focus
         and the reason with it. */
      refuseOf('Neda Nedić').focus()
      expect(refuseOf('Neda Nedić')).toHaveFocus()
      await user.keyboard('{Enter}')

      expect(screen.queryByLabelText('Razlog odbijanja')).toBeNull()

      approveOf('Neda Nedić').focus()
      expect(approveOf('Neda Nedić')).toHaveFocus()
      await user.keyboard('{Enter}')
      await user.keyboard(' ')

      expect(decisionsIn(asked)).toEqual([])

      /* And once the picture has arrived the same key does the thing. */
      thePictureArrives(cardOf('Neda Nedić'))
      refuseOf('Neda Nedić').focus()
      await user.keyboard('{Enter}')

      expect(screen.getByLabelText('Razlog odbijanja')).toBeVisible()
    } finally {
      stop()
    }
  }, SLOW)

  it('keeps every picture that arrived in the same tick, and not only the last one to say so', async () => {
    /* TWO REPORTS BEFORE THE RENDER THE FIRST ONE ASKED FOR, which is what a burst of pictures arriving is:
       the page handles the second `load` with the closure of the render it has, so a report written over
       the STATE that closure holds would lose the first one, and a card whose picture did arrive would
       wait for it for ever. Written over the ref (`settlePicture`) it keeps both. Inside one `act` nothing
       is drawn between the two events, so the two are the burst. */
    const { stop } = aServerThatTakesTheDecisions([neda(), mira(), zora(), petar])

    try {
      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      act(() => {
        thePictureArrives(cardOf('Neda Nedić'))
        thePictureArrives(cardOf('Mira Mirić'))
      })

      expect(approveOf('Neda Nedić')).toHaveAttribute('aria-disabled', 'false')
      expect(approveOf('Mira Mirić')).toHaveAttribute('aria-disabled', 'false')
      /* And the one that has said nothing is still waiting: the burst opened two cards and not three. */
      expect(approveOf('Zora Zorić')).toHaveAttribute('aria-disabled', 'true')
    } finally {
      stop()
    }
  }, SLOW)
})

describe('the sweep over cards whose pictures are in different states', () => {
  it('settles the card whose picture arrived and the one that draws none, and leaves the other two, which come alive and are taken by the next sweep', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { asked, stop } = aServerThatTakesTheDecisions(
      [neda(), mira(), zora(), petar],
      [decisionPath('21'), decisionPath('22'), decisionPath('23')],
    )

    try {
      const user = setupUser()

      await inTheFourStates()

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      await waitFor(() => {
        expect(screen.getByText('Rešene su 2 stavke.')).toBeVisible()
      })

      /* EXACTLY THE TWO, and in the order of the list: Neda's picture is on its way and Zora's could not
         be drawn, and the sweep sends an approval in the name of neither (PDL.md "29." for the one
         that failed; the owner's sentence of 11.10.2026 for the one that has not arrived). Each names
         its own key and circle, and the biography names none. */
      expect(decisionsIn(asked)).toEqual([
        {
          path: decisionPath('23'),
          body: { approved: true, reason: '', seenPhotoId: 12, seenCrop: MIRA_CROP },
        },
        { path: decisionPath('22'), body: { approved: true, reason: '', seenText: THE_BIOGRAPHYS_WORDS } },
      ])

      /* The two it left are still in the queue, not hidden. */
      expect(screen.getByRole('heading', { name: 'Neda Nedić' })).toBeVisible()
      expect(screen.getByRole('heading', { name: 'Zora Zorić' })).toBeVisible()
      expect(screen.queryByRole('heading', { name: 'Mira Mirić' })).toBeNull()
      expect(screen.queryByRole('heading', { name: 'Petar Petrović' })).toBeNull()

      /* The card that was waiting comes alive the moment its picture arrives, and the next sweep takes it
         and still leaves the one that could not be drawn. */
      thePictureArrives(cardOf('Neda Nedić'))
      expect(approveOf('Neda Nedić')).toHaveAttribute('aria-disabled', 'false')

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      await waitFor(() => {
        expect(screen.getByText('Rešena je 1 stavka.')).toBeVisible()
      })
      expect(decisionsIn(asked).map((one) => one.path)).toEqual([
        decisionPath('23'),
        decisionPath('22'),
        decisionPath('21'),
      ])
      expect(screen.getByRole('heading', { name: 'Zora Zorić' })).toBeVisible()
    } finally {
      confirm.mockRestore()
      stop()
    }
  }, SLOW)

  it('settles nothing and says so when every picture it was given is still on its way', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { asked, stop } = aServerThatTakesTheDecisions([neda(), mira(), zora()])

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      await waitFor(() => {
        expect(screen.getByText('Rešeno je 0 stavki.')).toBeVisible()
      })
      expect(decisionsIn(asked)).toEqual([])
    } finally {
      confirm.mockRestore()
      stop()
    }
  }, SLOW)

  it('does not clear the sentence of a refusal on another card when Odobri is pressed on a card whose picture is on its way', async () => {
    /* `approveAll` reports what it settled through `sayIt` unconditionally, "nothing" included, so a
       press that STARTED a walk over a card it then skipped would take another card's refusal off the
       screen. The press does not start one (`PendingQueue.tsx`, the `onClick` of Odobri), which is the
       same division the picture that failed already has. Petar is first in the list so his refusal is
       the sentence on screen when the other press happens. */
    const { stop } = serverThat((path) =>
      path === '/api/verification'
        ? asTheList([petar, neda()])
        : path === decisionPath('22')
          ? refused(SOMEBODY_ANSWERED_IT_ALREADY, 409)
          : null,
    )

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(approveOf('Petar Petrović'))

      expect(await cardOf('Petar Petrović').findByRole('alert')).toHaveTextContent(
        SOMEBODY_ANSWERED_IT_ALREADY,
      )

      await user.click(approveOf('Neda Nedić'))

      expect(
        cardOf('Petar Petrović').getByRole('alert'),
        "Petar Petrović's refusal must survive a press on a card whose picture has not arrived",
      ).toHaveTextContent(SOMEBODY_ANSWERED_IT_ALREADY)
    } finally {
      stop()
    }
  }, SLOW)
})

/**
 * THE SWEEP TAKES WHAT IT MAY APPROVE AT THE PRESS, AND A PICTURE THAT ARRIVES WHILE IT IS OUT IS FOR THE
 * NEXT PRESS.
 *
 * <p>PDL, 11.10.2026, derived from the owner's „Moderator mora da vidi sliku koju odobrava" (27.09.2026):
 * „„Odobri sve" ne šalje odobravanje za red čija slika nije stigla DO TRENUTKA PRITISKA, kao ni za onaj čija
 * nije uspela; red ostaje i ne broji se, i kad slika stigne dok obilazak traje". The moderator decides on
 * what he is looking at when he presses, and a walk is one round trip per card, so pictures go on arriving
 * while it is out: one that arrives then is one he has not looked at.
 *
 * <p><b>The four probes of the review of PR 524, which had one cause between them</b> (the walk asked the ref
 * again on every turn) <b>and are cases here:</b>
 *
 * <ul>
 * <li>a biography and then the picture, which the walk approved, and the picture and then a biography, which
 * it left alone: the same screen at the same press, two outcomes by the order of the cards, so one case
 * takes both orders and asks for the same outcome;</li>
 * <li>a card whose picture arrived BEFORE the press and one behind it whose picture arrives AFTER it: the
 * walk took both, and takes the first;</li>
 * <li>the picture arrives mid-walk and the moderator opens „Odbij" over it and writes a reason: the walk
 * approved it afterwards, over the reason he was writing.</li>
 * </ul>
 *
 * <p><b>And the one the probes do not reach: the press is the instant the ref says it is.</b> A report can
 * come in the tick of the press, before the render it asked for; the sweep takes that picture as the card's
 * own Odobri does (`PendingQueue.tsx`, `pictureOutcomesRef`), and a set read off the render the press was
 * made in does not.
 *
 * <p>Every card the walk is to be parked on is held by the case (`aDecisionThatWaits`) and not by a timer, so
 * what a case measures is the order of events and not how fast the machine is.
 */
describe('the sweep, and a picture that arrives while it is out', () => {
  it.each([
    { order: 'a biography and then the picture', rows: () => [petar, neda()] },
    { order: 'the picture and then a biography', rows: () => [neda(), petar] },
  ])(
    'leaves the card whose picture arrives while the walk is parked, with the cards as $order',
    async ({ rows }) => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
      const held = aDecisionThatWaits(decisionPath('22'))
      const { asked, stop } = aServerThatHolds(rows(), held, [decisionPath('21')])

      try {
        const user = setupUser()

        openQueue()
        await screen.findByRole('list', { name: /Čeka/ })

        await user.click(screen.getByRole('button', { name: 'Odobri sve' }))
        await parkedOn(asked, decisionPath('22'))

        thePictureArrives(cardOf('Neda Nedić'))

        /* THE PICTURE HAS REACHED THE SCREEN: her Odbij answers. Without it a card left alone would be a card
           whose picture never arrived, and the case would say nothing about the walk. (Her Odobri is told off
           by the walk itself, `deciding`, so it cannot say.) */
        expect(refuseOf('Neda Nedić')).not.toHaveAttribute('aria-disabled')

        held.release()
        await sweepIsOver()

        /* The biography alone, in either order: no request for Neda, and the one number that tells „left
           her" from „took her". */
        expect(decisionsIn(asked)).toEqual([
          { path: decisionPath('22'), body: { approved: true, reason: '', seenText: THE_BIOGRAPHYS_WORDS } },
        ])
        expect(screen.getByText('Rešena je 1 stavka.')).toBeVisible()
        expect(screen.getByRole('heading', { name: 'Neda Nedić' })).toBeVisible()
        expect(screen.queryByRole('heading', { name: 'Petar Petrović' })).toBeNull()
      } finally {
        confirm.mockRestore()
        stop()
      }
    },
    SLOW,
  )

  it('does not approve a picture that arrives after the press behind a card whose picture arrived before it, and takes it with the next press', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const held = aDecisionThatWaits(decisionPath('23'))
    const { asked, stop } = aServerThatHolds([mira(), neda()], held, [decisionPath('21')])

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })
      /* Mira's picture arrived BEFORE the press, so she is in the walk; Neda's has not said anything. */
      thePictureArrives(cardOf('Mira Mirić'))

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))
      await parkedOn(asked, decisionPath('23'))

      /* The press is over: it asked its question, was answered yes, and the walk is out. What comes now comes
         after it. */
      expect(confirm).toHaveBeenCalledTimes(1)
      thePictureArrives(cardOf('Neda Nedić'))
      expect(refuseOf('Neda Nedić')).not.toHaveAttribute('aria-disabled')

      held.release()
      await sweepIsOver()

      expect(decisionsIn(asked)).toEqual([
        {
          path: decisionPath('23'),
          body: { approved: true, reason: '', seenPhotoId: 12, seenCrop: MIRA_CROP },
        },
      ])
      expect(screen.getByText('Rešena je 1 stavka.')).toBeVisible()
      expect(screen.getByRole('heading', { name: 'Neda Nedić' })).toBeVisible()
      expect(screen.queryByRole('heading', { name: 'Mira Mirić' })).toBeNull()

      /* THE NEXT PRESS TAKES HER: the row was left and not lost, and its picture has arrived by then. */
      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Neda Nedić' })).toBeNull()
      })
      expect(decisionsIn(asked)).toEqual([
        {
          path: decisionPath('23'),
          body: { approved: true, reason: '', seenPhotoId: 12, seenCrop: MIRA_CROP },
        },
        {
          path: decisionPath('21'),
          body: { approved: true, reason: '', seenPhotoId: 9, seenCrop: NEDA_CROP },
        },
      ])
    } finally {
      confirm.mockRestore()
      stop()
    }
  }, SLOW)

  it('does not approve a picture the moderator opened „Odbij" over while the walk was out, and keeps the reason he wrote', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const held = aDecisionThatWaits(decisionPath('22'))
    const { asked, stop } = aServerThatHolds([petar, neda()], held, [decisionPath('21')])

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))
      await parkedOn(asked, decisionPath('22'))

      /* The picture arrives while the walk is out, and the moderator, who has now seen it, opens the box
         and begins a reason. */
      thePictureArrives(cardOf('Neda Nedić'))
      await user.click(refuseOf('Neda Nedić'))
      await user.type(screen.getByLabelText('Razlog odbijanja'), 'Slika je mutna.')

      held.release()
      await sweepIsOver()

      expect(
        decisionsIn(asked).filter((one) => one.path === decisionPath('21')),
        'the walk sends nothing in the name of a card the moderator is refusing',
      ).toEqual([])
      /* The walk did reach the end and settled the biography, so the silence about her is not a walk that
         stopped. */
      expect(screen.getByText('Rešena je 1 stavka.')).toBeVisible()
      expect(screen.getByRole('heading', { name: 'Neda Nedić' })).toBeVisible()
      expect(screen.getByLabelText('Razlog odbijanja')).toHaveValue('Slika je mutna.')

      /* And the refusal he was writing goes out as he wrote it, naming the picture he saw, and is the only
         thing the route is ever asked about her. */
      await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))
      await waitFor(() => {
        expect(decisionsIn(asked)).toEqual([
          { path: decisionPath('22'), body: { approved: true, reason: '', seenText: THE_BIOGRAPHYS_WORDS } },
          {
            path: decisionPath('21'),
            body: { approved: false, reason: 'Slika je mutna.', seenPhotoId: 9, seenCrop: NEDA_CROP },
          },
        ])
      })
    } finally {
      confirm.mockRestore()
      stop()
    }
  }, SLOW)

  it('takes a card whose picture arrived in the very tick of the press, which the screen has not drawn yet', async () => {
    /* THE REPORT AND THE PRESS INSIDE ONE `act`, so that nothing is drawn between them: the closure of the
       render the press is made in still says the picture is on its way, and only the ref says it arrived
       (the way „keeps every picture that arrived in the same tick" above puts two reports in one tick). The
       card's own Odobri reads the ref for the same reason; the sweep does the same, and a set read off
       `pictureOutcomes` would leave her. */
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { asked, stop } = aServerThatTakesTheDecisions([neda()], [decisionPath('21')])

    try {
      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      const sweep = screen.getByRole('button', { name: 'Odobri sve' })

      act(() => {
        thePictureArrives(cardOf('Neda Nedić'))
        fireEvent.click(sweep)
      })
      await sweepIsOver()

      expect(decisionsIn(asked)).toEqual([
        {
          path: decisionPath('21'),
          body: { approved: true, reason: '', seenPhotoId: 9, seenCrop: NEDA_CROP },
        },
      ])
      expect(screen.getByText('Rešena je 1 stavka.')).toBeVisible()
    } finally {
      confirm.mockRestore()
      stop()
    }
  }, SLOW)
})

/**
 * THE WALK ASKS ONCE MORE AT THE MOMENT OF SENDING WHETHER THE PICTURE HAS FAILED.
 *
 * <p>PDL, 16.10.2026 (owner, between the outcomes he was offered, with the recommendation): „„Odobri sve"
 * preskače sliku koja je stigla pa usred obilaska javi grešku: u trenutku slanja još jednom se pita da li je
 * slika pala." Rejected there: to measure the instant of the press only, because a card that says „ne može se
 * odobriti" would then be approved.
 *
 * <p><b>The road to it is the reviewer's, measured on PR 524 (probe P2), and every step of it is a thing a
 * moderator does.</b> The sweep is parked on a card; he refuses ANOTHER card whose picture could not be
 * drawn, the route answers that the picture was changed, and the list is read again; the read fails and
 * he asks again with „Pokušaj ponovo"; the cards come back as NEW elements, and the one whose picture had
 * arrived before the press now says its file cannot be drawn. The walk, released, reaches that card.
 *
 * <p>The cards are different on purpose. The one that fails again is Neda, behind the parked card; Mira
 * stands behind Neda with her picture arrived and unchanged, so a walk that stopped at Neda instead of
 * leaving her would be seen; and the card refused is Zora, whose picture had failed before the press and so
 * is not in the walk at all. A card that is refused and in the walk is the other finding of the same review
 * (PENDING), and this case does not ask about it.
 */
describe('the sweep, and a picture that fails while it is out', () => {
  it('sends nothing in the name of a card whose picture had arrived at the press and has failed since, and settles the rest', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const held = aDecisionThatWaits(decisionPath('22'))
    let read = 0
    const { asked, stop } = serverThat((path) => {
      if (path === '/api/verification') {
        read += 1

        /* The first read is the screen's own, the second is the one after the refusal and it fails, the
           third is the one „Pokušaj ponovo" asks. */
        return read === 2 ? answeredWith(500) : asTheList([petar, zora(), neda(), mira()])
      }

      return path === held.path
        ? held.answer
        : path === decisionPath('25')
          ? refused(THE_PICTURE_WAS_CHANGED, 409)
          : [decisionPath('21'), decisionPath('23')].includes(path)
            ? did()
            : null
    })

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })
      /* Neda's and Mira's pictures arrived BEFORE the press, so they are in the walk; Zora's had failed,
         so she is not. */
      thePictureArrives(cardOf('Neda Nedić'))
      thePictureArrives(cardOf('Mira Mirić'))
      thePictureFails(cardOf('Zora Zorić'))

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))
      await parkedOn(asked, decisionPath('22'))

      await user.click(refuseOf('Zora Zorić'))
      await user.type(screen.getByLabelText('Razlog odbijanja'), 'Fajl je nestao.')
      await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))

      await user.click(await screen.findByRole('button', { name: /^Pokušaj ponovo/ }))
      await screen.findByRole('list', { name: /Čeka/ })

      /* THE CARDS ARE NEW ELEMENTS: Mira's picture arrives again and Neda's says her file cannot be
         drawn. The sentence on her card is what the moderator reads; without it the case would say
         nothing about the walk. */
      thePictureArrives(cardOf('Mira Mirić'))
      thePictureFails(cardOf('Neda Nedić'))
      expect(cardOf('Neda Nedić').getByText(THE_PICTURE_IS_NOT_AVAILABLE)).toBeVisible()

      held.release()
      await sweepIsOver()

      /* The biography, which the walk was parked on, the refusal he sent, and Mira, who stands behind
         the card that failed; and NOTHING for Neda: the route would have taken it (`did()`), which is
         why the count below is 2 and not 3. */
      expect(decisionsIn(asked)).toEqual([
        { path: decisionPath('22'), body: { approved: true, reason: '', seenText: THE_BIOGRAPHYS_WORDS } },
        {
          path: decisionPath('25'),
          body: { approved: false, reason: 'Fajl je nestao.', seenPhotoId: 14, seenCrop: ZORA_CROP },
        },
        {
          path: decisionPath('23'),
          body: { approved: true, reason: '', seenPhotoId: 12, seenCrop: MIRA_CROP },
        },
      ])
      expect(screen.getByText('Rešene su 2 stavke.')).toBeVisible()
      /* Left standing, visible, with the sentence that says why. */
      expect(screen.getByRole('heading', { name: 'Neda Nedić' })).toBeVisible()
      expect(cardOf('Neda Nedić').getByText(THE_PICTURE_IS_NOT_AVAILABLE)).toBeVisible()
    } finally {
      confirm.mockRestore()
      stop()
    }
  }, SLOW)
})

/**
 * THE QUESTION BEFORE „ODOBRI SVE" PROMISES NO NUMBER WHEN THE SWEEP WILL LEAVE A CARD STANDING.
 *
 * <p>PDL, 16.10.2026 (owner, between the outcomes he was offered, against the recommendation): the question
 * on the queue of profiles „nema broj kad ijedna kartica ima sliku koja nije stigla: tada glasi „Odobriti
 * sve što se može odobriti?" (rečenica već postoji za timove)". Rejected: „Odobriti N stavki?" with the
 * number of all of them. It is the sentence the queue of teams already asks (`verification.approveAllAskTeams`),
 * word for word, because the owner priced reusing it.
 *
 * <p>Three states of the picture make a card the sweep will not take (on its way, could not be drawn) or will
 * (arrived, none), and the cases put them in different mixes: one card in one state is satisfied by a screen
 * that asks about the first card only, or about the last one to report. The press is the instant the ref says
 * it is, as it is for the walk (the last case).
 *
 * <p>The question is answered „no" in every case, so nothing is decided and what is held is the sentence.
 */
describe('the question before „Odobri sve" on the queue of profiles', () => {
  const HEDGED_FOR_TWO =
    'U redu čekaju 2 stavke. Odobriti sve što se može odobriti? Ovo se ne može opozvati.'

  const HEDGED_FOR_THREE =
    'U redu čekaju 3 stavke. Odobriti sve što se može odobriti? Ovo se ne može opozvati.'

  async function questionAskedFor(
    rows: unknown[],
    saysWhatBecameOfThePictures: () => void,
  ): Promise<{ question: string; decisions: unknown[] }> {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { asked, stop } = aServerThatTakesTheDecisions(rows)

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })
      saysWhatBecameOfThePictures()

      await user.click(screen.getByRole('button', { name: 'Odobri sve' }))

      expect(confirm).toHaveBeenCalledTimes(1)

      return { question: String(confirm.mock.calls[0]?.[0]), decisions: decisionsIn(asked) }
    } finally {
      confirm.mockRestore()
      stop()
    }
  }

  it.each([
    {
      state: 'a picture on its way beside a card that draws none',
      rows: () => [neda(), petar],
      say: (): void => {},
      question: HEDGED_FOR_TWO,
    },
    {
      state: 'a picture that could not be drawn beside a card that draws none',
      rows: () => [zora(), petar],
      say: (): void => thePictureFails(cardOf('Zora Zorić')),
      question: HEDGED_FOR_TWO,
    },
    {
      state: 'one picture that arrived and one still on its way, beside a card that draws none',
      rows: () => [mira(), neda(), petar],
      say: (): void => thePictureArrives(cardOf('Mira Mirić')),
      question: HEDGED_FOR_THREE,
    },
    {
      state: 'one picture that arrived and one that could not be drawn, beside a card that draws none',
      rows: () => [mira(), zora(), petar],
      say: (): void => {
        thePictureArrives(cardOf('Mira Mirić'))
        thePictureFails(cardOf('Zora Zorić'))
      },
      question: HEDGED_FOR_THREE,
    },
  ])('says no number of approvals with $state', async ({ rows, say, question }) => {
    const asking = await questionAskedFor(rows(), say)

    expect(asking.question).toBe(question)
    expect(asking.decisions).toEqual([])
  }, SLOW)

  it.each([
    {
      state: 'every picture has arrived, beside a card that draws none',
      rows: () => [mira(), neda(), petar],
      say: (): void => {
        thePictureArrives(cardOf('Mira Mirić'))
        thePictureArrives(cardOf('Neda Nedić'))
      },
      question: 'Odobriti 3 stavke? Ovo se ne može opozvati.',
    },
    {
      state: 'no card draws a picture',
      rows: () => [petar],
      say: (): void => {},
      question: 'Odobriti 1 stavku? Ovo se ne može opozvati.',
    },
  ])('says the number when $state', async ({ rows, say, question }) => {
    const asking = await questionAskedFor(rows(), say)

    expect(asking.question).toBe(question)
    expect(asking.decisions).toEqual([])
  }, SLOW)

  it('asks about the pictures as they stand at the press, in the very tick a picture arrived', async () => {
    /* THE REPORT AND THE PRESS INSIDE ONE `act`, as the sweep's own case does it: the render the press is
       made in still says the picture is on its way, and only the ref says it arrived. A question asked
       of the render would hedge over a set the walk then takes whole. */
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { stop } = aServerThatTakesTheDecisions([neda(), petar])

    try {
      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      const sweep = screen.getByRole('button', { name: 'Odobri sve' })

      act(() => {
        thePictureArrives(cardOf('Neda Nedić'))
        fireEvent.click(sweep)
      })

      expect(confirm).toHaveBeenCalledWith('Odobriti 2 stavke? Ovo se ne može opozvati.')
    } finally {
      confirm.mockRestore()
      stop()
    }
  }, SLOW)
})

describe('a picture that replaces another', () => {
  /**
   * A SERVER THAT CHANGES ITS MIND BETWEEN TWO READS OF THE LIST, which is what „the member sent another
   * picture while the moderator looked" is on the wire: the first list holds Neda's card with the key 9,
   * the first decision about it is refused with the owner's sentence, and the list read after that holds
   * her row with the key 10. Mira's card is the same in both reads, with the key 12.
   */
  function aServerWhoseListChanges() {
    let read = 0

    return serverThat((path) => {
      if (path === '/api/verification') {
        read += 1

        return asTheList(read === 1 ? [neda(9), mira()] : [neda(10), mira()])
      }

      return path === decisionPath('21') ? refused(THE_PICTURE_WAS_CHANGED, 409) : null
    })
  }

  it.each([
    {
      first: 'arrived',
      saysItsOutcome: (): void => thePictureArrives(cardOf('Neda Nedić')),
      decide: async (user: ReturnType<typeof setupUser>): Promise<void> => {
        await user.click(approveOf('Neda Nedić'))
      },
    },
    {
      first: 'could not be drawn',
      saysItsOutcome: (): void => thePictureFails(cardOf('Neda Nedić')),
      decide: async (user: ReturnType<typeof setupUser>): Promise<void> => {
        await user.click(refuseOf('Neda Nedić'))
        await user.type(screen.getByLabelText('Razlog odbijanja'), 'Slika je mutna.')
        await user.click(screen.getByRole('button', { name: 'Odbij uz ovaj razlog' }))
      },
    },
  ])(
    'starts over at waiting when the first picture $first, and is looked at again before either button answers',
    async ({ saysItsOutcome, decide }) => {
      const { stop } = aServerWhoseListChanges()

      try {
        const user = setupUser()

        openQueue()
        await screen.findByRole('list', { name: /Čeka/ })
        thePictureArrives(cardOf('Mira Mirić'))
        saysItsOutcome()

        await decide(user)

        expect(await cardOf('Neda Nedić').findByRole('alert')).toHaveTextContent(THE_PICTURE_WAS_CHANGED)
        await waitFor(() => {
          expect(pictureOn(cardOf('Neda Nedić')).getAttribute('src')).toBe(
            '/api/verification/21/photo?photo=10',
          )
        })

        /* THE NEW PICTURE IS DRAWN AND NOBODY HAS LOOKED AT IT: whatever became of the first, this one
           starts over, so the sentence for a picture that could not be drawn is gone with it and neither
           button of the card answers. A card whose outcome was kept under its ROW would be live here
           (the first arrived) or would never try the new picture (the first failed). */
        expect(screen.queryByText(THE_PICTURE_IS_NOT_AVAILABLE)).toBeNull()
        expect(approveOf('Neda Nedić')).toHaveAttribute('aria-disabled', 'true')
        expect(refuseOf('Neda Nedić')).toHaveAttribute('aria-disabled', 'true')

        /* AND THE CARD BESIDE IT, whose picture did not change, is not made to wait again: the list
           was read again and hers is the same picture in the same element. */
        expect(approveOf('Mira Mirić')).toHaveAttribute('aria-disabled', 'false')
        expect(refuseOf('Mira Mirić')).not.toHaveAttribute('aria-disabled')

        thePictureArrives(cardOf('Neda Nedić'))

        expect(approveOf('Neda Nedić')).toHaveAttribute('aria-disabled', 'false')
        expect(refuseOf('Neda Nedić')).not.toHaveAttribute('aria-disabled')
      } finally {
        stop()
      }
    },
    SLOW,
  )

  it('holds the box that hands a card back while the picture under it is another one nobody has looked at, and answers again once that one has arrived', async () => {
    /* THE BOX THAT STAYS OPEN. Neda's reason is half written when a decision about ANOTHER card (Mira's) is
       refused with the owner's sentence and the list is read again; Neda's member has sent another picture in
       the meantime. The box is still open over what he typed, the card now names the new key, and a press on
       „Odbij uz ovaj razlog" would refuse a picture nobody has looked at: the owner's sentence names the card's
       two buttons, and this is the third door to the refusal (DERIVED, as the sweep is the third door to the
       approval). Held until that picture arrives, with the reason kept and „Odustani" still working. */
    let read = 0
    const { asked, stop } = serverThat((path) => {
      if (path === '/api/verification') {
        read += 1

        return asTheList(read === 1 ? [neda(9), mira(12)] : [neda(10), mira(13)])
      }

      return path === decisionPath('23')
        ? refused(THE_PICTURE_WAS_CHANGED, 409)
        : path === decisionPath('21')
          ? did()
          : null
    })

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })
      thePictureArrives(cardOf('Neda Nedić'))
      thePictureArrives(cardOf('Mira Mirić'))

      await user.click(refuseOf('Neda Nedić'))
      await user.type(screen.getByLabelText('Razlog odbijanja'), 'Slika je mutna.')

      await user.click(approveOf('Mira Mirić'))
      expect(await cardOf('Mira Mirić').findByRole('alert')).toHaveTextContent(THE_PICTURE_WAS_CHANGED)
      await waitFor(() => {
        expect(pictureOn(cardOf('Neda Nedić')).getAttribute('src')).toBe(
          '/api/verification/21/photo?photo=10',
        )
      })

      /* The box is still there with what he typed, over a picture that has not arrived. */
      expect(screen.getByLabelText('Razlog odbijanja')).toHaveValue('Slika je mutna.')

      const send = screen.getByRole('button', { name: 'Odbij uz ovaj razlog' })

      expect(send).toHaveAttribute('aria-disabled', 'true')
      expect(send).not.toBeDisabled()
      expect(screen.getByRole('button', { name: 'Odustani' })).not.toHaveAttribute('aria-disabled')

      await user.click(send)

      expect(
        decisionsIn(asked).filter((one) => one.path === decisionPath('21')),
        'a press on the box over a picture nobody has looked at asks the route nothing',
      ).toEqual([])

      thePictureArrives(cardOf('Neda Nedić'))

      expect(send).toHaveAttribute('aria-disabled', 'false')

      await user.click(send)

      expect(decisionsIn(asked).filter((one) => one.path === decisionPath('21'))).toEqual([
        {
          path: decisionPath('21'),
          body: { approved: false, reason: 'Slika je mutna.', seenPhotoId: 10, seenCrop: NEDA_CROP },
        },
      ])
    } finally {
      stop()
    }
  }, SLOW)

  it('reads the outcome of the card whose picture reported and of no other, even where two cards hold a picture of the same number', async () => {
    /* THE SOURCE SWAP, in its narrowest form: two rows that hold the same key (9), so a state kept by the
       key of the picture alone, without the row, would be one state for two cards. Mira's picture arrives
       and Neda's does not. */
    const { stop } = aServerThatTakesTheDecisions([neda(9), mira(9)])

    try {
      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })
      thePictureArrives(cardOf('Mira Mirić'))

      expect(approveOf('Mira Mirić')).toHaveAttribute('aria-disabled', 'false')
      expect(approveOf('Neda Nedić')).toHaveAttribute('aria-disabled', 'true')
      expect(refuseOf('Neda Nedić')).toHaveAttribute('aria-disabled', 'true')
    } finally {
      stop()
    }
  }, SLOW)
})

describe('what a case of this file may end in', () => {
  it('is an assertion and never its own clock: every wait is given less time than a case has', () => {
    /* The floor under the paragraph over `configure`. Take it away and a wait is `SLOW` again, the same
       twenty seconds as the case that is waiting for it. Asked of the number that decides and not of the
       text of the file. */
    expect(getConfig().asyncUtilTimeout).toBeLessThan(SLOW)
  })
})
