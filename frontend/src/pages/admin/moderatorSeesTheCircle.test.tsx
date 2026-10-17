import { configure, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { CropWindow } from '../../components/CropWindow'
import { must } from '../../test/at'
import { renderAt, renderWithI18n } from '../../test/render'
import { did, refused, serverThat } from '../../test/serverAnswers'
import { SLOW } from '../../test/slow'
import { setupUser } from '../../test/user'
import { pictureOn, thePictureArrives, thePictureFails } from '../../test/waitingPicture'
import { decisionPath } from './verificationWrites'
import { QUEUE } from './queues'

/**
 * THE MODERATOR SEES THE CIRCLE THE MEMBER CHOSE, WITH THE REST DIMMED AND STILL THERE.
 *
 * <p>PDL.md, „Odobravanje slike" (owner, 27.09.2026): „Isecak sa zatamnjenim ostatkom ali tako da
 * se i tu nazire slika, kako sam odlucio." The card used to draw the whole original
 * (`moderatorSeesThePicture.test.tsx` holds the picture, the address and the waiting; this file
 * holds what is drawn OVER it).
 *
 * <ul>
 * <li><b>Each card draws its own circle over its own picture</b>, with two circles that are
 * neither each other nor the whole picture, over two pictures of different shapes. A circle taken
 * from the first card, from the placeholder (`WHOLE`) or from anywhere but the row is a different
 * frame.
 * <li><b>The rest is dimmed and still there</b>: the sheet that dims it is over the picture and
 * has the circle cut out of it, and the picture under it is still drawn.
 * <li><b>A circle moved and the list read again is drawn where it now is</b>, in the element that
 * was already there: the picture did not change, so nothing about it is waited for a second time.
 * <li><b>The window is given nothing to drag</b>, so the height is not capped (PDL.md, 28.08.2026:
 * „Moderatoru se ne ograničava").
 * <li><b>A picture that never came has no circle</b>, only the sentence; a biography has neither.
 * </ul>
 *
 * <p>The shade's own number (55 per cent black, held between 35 and 70) is `styles/circle.test.ts`'s,
 * and the member's screen draws it with the same component, so this card departs from it nowhere.
 */

/* EVERY WAIT OF THIS FILE IS GIVEN HALF OF THE TIME A CASE HAS, as `saveWhileSaving.test.tsx` and
   `decidingOnThePictureHeSaw.test.tsx` do and for the same measured reason: a wait that never succeeds
   is otherwise ended by the clock of its case (`Test timed out in 20000ms`) and not by its own
   assertion, and a series of mutations that does not tell the two apart counts it as caught. Measured
   on this file: a window keyed by the circle as well as the picture was "caught" only by that clock. */
configure({ asyncUtilTimeout: SLOW / 2 })

const RATING = { organisation: 0, value: 0, ambience: 0 }

/** The circles of the two pictures below: neither is the other, neither is the whole picture
 *  (`WHOLE`), and none of the three numbers of one repeats in the other. */
const NEDA_CROP = { x: 0.3, y: 0.7, size: 0.45 }

const MIRA_CROP = { x: 0.125, y: 0.2, size: 0.8 }

/** What Neda's circle becomes when she drags it over the SAME picture. */
const NEDA_DRAGGED = { x: 0.35, y: 0.6, size: 0.5 }

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

const neda = (photoId = 9, crop = NEDA_CROP) => aPictureOf(21, 'Neda Nedić', '000011', photoId, crop)

const mira = (photoId = 12, crop = MIRA_CROP) => aPictureOf(23, 'Mira Mirić', '000013', photoId, crop)

const aBiography = {
  ...aPictureOf(22, 'Petar Petrović', '000012', 0, NEDA_CROP),
  body: 'Trčim od malena, najviše volim brdske staze.',
  kind: 'bio' as const,
  photoId: null,
  crop: null,
}

const asTheList = (rows: unknown[]): Response =>
  new Response(JSON.stringify(rows), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

const cardOf = (name: string) =>
  within(must(screen.getByRole('heading', { name }).closest('li'), `the card of ${name}`))

const openQueue = () => renderAt(`/sr/${QUEUE.profiles.path}`, 'superadmin')

/** The sentence the lit circle says out loud, which is the one way a reader finds the frame
 *  without a class: the frame is the element that holds it. */
const FRAMED = /Ostatak je zatamnjen/

type Card = ReturnType<typeof within>

/** The browser tells the page the file arrived, and how big it turned out to be: jsdom decodes
 *  nothing, so the shape of the file is given, which is the only way a frame in percentages can
 *  be asked for at all. */
function theFileArrives(card: Card, width: number, height: number): void {
  const picture = pictureOn(card)

  Object.defineProperty(picture, 'naturalWidth', { value: width, configurable: true })
  Object.defineProperty(picture, 'naturalHeight', { value: height, configurable: true })
  fireEvent.load(picture)
}

const frameOf = (card: Card) => must(card.getByText(FRAMED).parentElement, 'the lit circle')

/** The sheet that dims what is thrown away, found from the box the picture stands in by the name
 *  the stylesheet defines it under, which is the only name it has: it is aria-hidden and holds no
 *  words, so a role or a label cannot reach it (`cropChooser.test.tsx` finds it the same way, and
 *  for the reason it gives: a class renamed by one letter left a screen with nothing dimmed and
 *  every other case green). */
const shadeOf = (card: Card) =>
  must(
    must(pictureOn(card).parentElement, 'the box').querySelector('.crop__shade'),
    'the shade over the picture',
  )

const theHoleOf = (x: string, y: string, across: string, down: string) =>
  `radial-gradient(ellipse ${across} ${down} at ${x} ${y}, transparent 99.5%, #000 100%)`

describe('the circle on a card the moderator is deciding about', () => {
  it('is the circle that card was served, over that card’s own picture, and not the other card’s and not the whole picture', async () => {
    /* TWO CARDS, TWO SHAPES, TWO CIRCLES. Neda's file is wide (400 by 200) and Mira's is tall
       (200 by 400); the side of the square is a share of the SHORTER edge, so the same circle
       drawn over the other card's shape, or over the placeholder, is a different frame. The
       numbers are worked by hand from `frameOf`'s rule and not read off it:

       Neda, 400 by 200, side 0.45 * 200 = 90: left 0.3 * (400 - 90) = 93 of 400 = 23.25 %, top
       0.7 * (200 - 90) = 77 of 200 = 38.5 %, 22.5 % across and 45 % down; the hole is centred
       on the middle of that, 34.5 % and 61 %, half as wide and as high.

       Mira, 200 by 400, side 0.8 * 200 = 160: left 0.125 * (200 - 160) = 5 of 200 = 2.5 %, top
       0.2 * (400 - 160) = 48 of 400 = 12 %, 80 % across and 40 % down; the hole 42.5 % and
       32 %, 40 % by 20 %. */
    const { stop } = serverThat((path) =>
      path === '/api/verification' ? asTheList([neda(), mira()]) : null,
    )

    try {
      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      theFileArrives(cardOf('Neda Nedić'), 400, 200)
      theFileArrives(cardOf('Mira Mirić'), 200, 400)

      expect(frameOf(cardOf('Neda Nedić'))).toHaveStyle({
        insetInlineStart: '23.25%',
        insetBlockStart: '38.5%',
        inlineSize: '22.5%',
        blockSize: '45%',
      })
      expect(shadeOf(cardOf('Neda Nedić'))).toHaveStyle({
        maskImage: theHoleOf('34.5%', '61%', '11.25%', '22.5%'),
      })

      expect(frameOf(cardOf('Mira Mirić'))).toHaveStyle({
        insetInlineStart: '2.5%',
        insetBlockStart: '12%',
        inlineSize: '80%',
        blockSize: '40%',
      })
      expect(shadeOf(cardOf('Mira Mirić'))).toHaveStyle({
        maskImage: theHoleOf('42.5%', '32%', '40%', '20%'),
      })

      /* And each over its own picture: the address names the card and the picture it holds. */
      expect(pictureOn(cardOf('Neda Nedić')).getAttribute('src')).toBe(
        '/api/verification/21/photo?photo=9',
      )
      expect(pictureOn(cardOf('Mira Mirić')).getAttribute('src')).toBe(
        '/api/verification/23/photo?photo=12',
      )
    } finally {
      stop()
    }
  }, SLOW)

  it('dims the rest and leaves it there: the sheet is over the picture, the picture is still drawn, and the circle is said aloud', async () => {
    /* „Zatamnjen ali dovoljno vidljiv ostatak": the picture is not removed from under the sheet
       and the sheet is not what a reader meets. Dimming is a colour and a curve is a curve, and
       neither is anything to a screen reader, so the sentence says it (`crop.framed`). What the
       sheet is made of (a veil of 55 per cent, covering the box to its corners) is the
       stylesheet's, held as text by `styles/circle.test.ts` because jsdom applies none. */
    const { stop } = serverThat((path) => (path === '/api/verification' ? asTheList([neda()]) : null))

    try {
      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })
      theFileArrives(cardOf('Neda Nedić'), 400, 200)

      const picture = pictureOn(cardOf('Neda Nedić'))

      expect(picture).toBeVisible()
      expect(picture).toHaveAccessibleName(
        'Slika koju je poslao Neda Nedić, sa uokvirenim delom koji će se videti',
      )
      expect(shadeOf(cardOf('Neda Nedić')).parentElement).toBe(picture.parentElement)
      expect(shadeOf(cardOf('Neda Nedić'))).toBeVisible()
      expect(shadeOf(cardOf('Neda Nedić'))).toHaveAttribute('aria-hidden', 'true')
      expect(cardOf('Neda Nedić').getByText(FRAMED)).toHaveTextContent(
        'Deo slike u krugu je ono što će se videti. Ostatak je zatamnjen, ali se i dalje nazire.',
      )
    } finally {
      stop()
    }
  }, SLOW)

  it('is drawn where the circle now is after it was moved and the list read again, in the element that was already there and with nothing waited for twice', async () => {
    /* THE PICTURE IS THE SAME (key 9 both times) AND ONLY THE CIRCLE MOVED, which is the one
       story no address can show (`decidingOnThePictureHeSaw.test.tsx`). The first press is
       refused with the owner's sentence, the list is read again and holds the same key with
       another circle.

       Three things at once, because each is only true in this order: the frame is at the new
       place; it is the SAME `<img>`, since the pixels did not change and a key that carried the
       circle would throw the loaded picture away; and so the buttons still answer, since an
       outcome belongs to the picture and not to where the circle is over it (`pictureKey`).
       The next press names the new circle. */
    let read = 0
    const { asked, stop } = serverThat((path) => {
      if (path === '/api/verification') {
        read += 1

        return asTheList([read === 1 ? neda(9, NEDA_CROP) : neda(9, NEDA_DRAGGED)])
      }

      return path === decisionPath('21')
        ? read === 1
          ? refused('Slika je promenjena, pogledaj je ponovo.', 409)
          : did()
        : null
    })

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })
      theFileArrives(cardOf('Neda Nedić'), 400, 200)

      const theElement = pictureOn(cardOf('Neda Nedić'))

      /* x 0.3 of the 310 free across: 93 of 400. */
      expect(frameOf(cardOf('Neda Nedić'))).toHaveStyle({ insetInlineStart: '23.25%' })

      await user.click(cardOf('Neda Nedić').getByRole('button', { name: 'Odobri' }))
      expect(await cardOf('Neda Nedić').findByRole('alert')).toHaveTextContent(
        'Slika je promenjena, pogledaj je ponovo.',
      )

      /* x 0.35, y 0.6, size 0.5 over 400 by 200: side 100, left 0.35 * 300 = 105 of 400 =
         26.25 %, top 0.6 * 100 = 60 of 200 = 30 %, 25 % across and 50 % down. */
      await waitFor(() => {
        expect(frameOf(cardOf('Neda Nedić'))).toHaveStyle({
          insetInlineStart: '26.25%',
          insetBlockStart: '30%',
          inlineSize: '25%',
          blockSize: '50%',
        })
      })
      expect(pictureOn(cardOf('Neda Nedić')), 'the same element draws the new circle').toBe(theElement)
      expect(cardOf('Neda Nedić').getByRole('button', { name: 'Odobri' })).toHaveAttribute(
        'aria-disabled',
        'false',
      )

      await user.click(cardOf('Neda Nedić').getByRole('button', { name: 'Odobri' }))

      const sent = asked.filter((one) => one.path === decisionPath('21'))

      expect(JSON.parse(String(sent[1]?.init?.body))).toEqual({
        approved: true,
        reason: '',
        seenPhotoId: 9,
        seenCrop: NEDA_DRAGGED,
      })
    } finally {
      stop()
    }
  }, SLOW)

  it('is given nothing to drag and no cap on its height, because he has nothing to move and his job is to see all of what is thrown away', async () => {
    /* PDL.md, 28.08.2026: „Moderatoru se ne ograničava". The cap is `CropWindow`'s own and it
       applies only where there is an `onChange`, so a window handed one here would answer a
       pointer (a press on the picture would move the circle of a decision) and would cap a
       tall photograph at 60 per cent of the screen. A 1080 by 2400 file is the one the member's
       screen was measured with. */
    const { stop } = serverThat((path) => (path === '/api/verification' ? asTheList([neda()]) : null))

    try {
      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })
      theFileArrives(cardOf('Neda Nedić'), 1080, 2400)

      const box = must(pictureOn(cardOf('Neda Nedić')).parentElement, 'the box')

      expect(box.style.maxBlockSize).toBe('')
      expect(box.style.inlineSize).toBe('')
      expect(box).not.toHaveClass('crop__picture--dragged')
      expect(box.style.cursor).toBe('')
    } finally {
      stop()
    }
  }, SLOW)

  it('draws no circle over a picture that did not come, only the sentence, and draws none for a biography', async () => {
    /* A circle over nothing is a frame drawn over a line, and a biography never had a picture:
       its `crop` is the placeholder (`WHOLE`) and a window handed that would draw a lit circle
       as big as the picture over a picture that is not there. */
    const { stop } = serverThat((path) =>
      path === '/api/verification' ? asTheList([neda(), aBiography]) : null,
    )

    try {
      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })

      expect(cardOf('Neda Nedić').getByText(FRAMED)).toBeInTheDocument()
      expect(within(screen.getByRole('list', { name: /Čeka/ })).getAllByText(FRAMED)).toHaveLength(1)
      expect(cardOf('Petar Petrović').queryByText(FRAMED)).not.toBeInTheDocument()

      thePictureFails(cardOf('Neda Nedić'))

      expect(cardOf('Neda Nedić').queryByText(FRAMED)).not.toBeInTheDocument()
      expect(cardOf('Neda Nedić').getByText(/^Slika nije dostupna/)).toBeVisible()
    } finally {
      stop()
    }
  }, SLOW)

  it('starts a picture that is replaced over: a new element, no circle taken over from the old one, and the buttons wait for it', async () => {
    /* THE OTHER HALF OF „the circle is not in the key": the KEY is. A card read again with
       another picture draws it in a window of its own, whose shape is not known until the new
       file says so, so the old file's shape is not carried over to it. */
    let read = 0
    const { stop } = serverThat((path) => {
      if (path === '/api/verification') {
        read += 1

        return asTheList([read === 1 ? neda(9) : neda(10, NEDA_DRAGGED)])
      }

      return path === decisionPath('21') ? refused('Slika je promenjena, pogledaj je ponovo.', 409) : null
    })

    try {
      const user = setupUser()

      openQueue()
      await screen.findByRole('list', { name: /Čeka/ })
      theFileArrives(cardOf('Neda Nedić'), 400, 200)
      expect(must(pictureOn(cardOf('Neda Nedić')).parentElement, 'the box').style.aspectRatio).toBe(
        '400 / 200',
      )

      await user.click(cardOf('Neda Nedić').getByRole('button', { name: 'Odobri' }))
      await cardOf('Neda Nedić').findByRole('alert')

      await waitFor(() => {
        expect(pictureOn(cardOf('Neda Nedić')).getAttribute('src')).toBe(
          '/api/verification/21/photo?photo=10',
        )
      })
      expect(must(pictureOn(cardOf('Neda Nedić')).parentElement, 'the box').style.aspectRatio).toBe(
        '1 / 1',
      )
      expect(cardOf('Neda Nedić').getByRole('button', { name: 'Odobri' })).toHaveAttribute(
        'aria-disabled',
        'true',
      )
      thePictureArrives(cardOf('Neda Nedić'))
    } finally {
      stop()
    }
  }, SLOW)
})

describe('the window that draws it, told apart from the member’s screen', () => {
  const CROP = { x: 0.5, y: 0.5, size: 0.5 }

  it('tells whoever asked that the file arrived, after it has taken its shape, and that it did not', () => {
    const arrived = vi.fn()
    const failed = vi.fn()

    renderWithI18n(
      <CropWindow picture="/a.jpg" crop={CROP} alt="Slika" onLoaded={arrived} onFailed={failed} />,
    )

    const picture = screen.getByRole('img', { name: 'Slika' })

    expect(arrived).not.toHaveBeenCalled()
    expect(failed).not.toHaveBeenCalled()

    Object.defineProperty(picture, 'naturalWidth', { value: 300, configurable: true })
    Object.defineProperty(picture, 'naturalHeight', { value: 150, configurable: true })
    fireEvent.load(picture)

    expect(arrived).toHaveBeenCalledTimes(1)
    expect(failed).not.toHaveBeenCalled()
    expect(must(picture.parentElement, 'the box').style.aspectRatio).toBe('300 / 150')

    fireEvent.error(picture)

    expect(failed).toHaveBeenCalledTimes(1)
    expect(arrived).toHaveBeenCalledTimes(1)
  })

  it('says nothing to nobody: on the member’s screen the same events go nowhere and break nothing', () => {
    renderWithI18n(<CropWindow picture="/a.jpg" crop={CROP} alt="Slika" />)

    const picture = screen.getByRole('img', { name: 'Slika' })

    fireEvent.load(picture)
    fireEvent.error(picture)

    expect(picture).toBeVisible()
  })
})
