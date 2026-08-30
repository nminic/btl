import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { must } from '../test/at'
import { measurePicture, theMeasuringPicture } from '../test/picture'
import { renderWithI18n } from '../test/render'
import { setupUser } from '../test/user'
import { CropChooser } from './CropChooser'
import type { Chosen } from './CropChooser'
import type { Crop } from '../data/types'
import { CropWindow } from './CropWindow'
import { WHOLE } from './crop'

/**
 * Choosing a picture and saying which square of it counts.
 *
 * Owner, 12.08.2026: „Mogućnost kropovanja željene slike unutar sajta... Korisnik
 * treba da može da sačuva kropovan format ali da se nazire ispod u njegovim
 * podešavanjima i ono što se neće videti."
 *
 * Two things nothing else can check. That the cutting is reachable without a
 * mouse, which is the whole reason it is three sliders rather than a dragged
 * rectangle; and that the part being thrown away stays on screen, which is the
 * half of his sentence a cropping tool normally leaves out.
 */

function Choosing({ asked = true }: { asked?: boolean }) {
  const [chosen, setChosen] = useState<Chosen | null>(null)

  return (
    <>
      <CropChooser
        id="proba"
        label="Izaberi sliku"
        rule="Slika lica."
        alt="Slika koju si izabrao"
        asked={asked}
        chosen={chosen}
        onChange={setChosen}
      />
      {/* What the screen around it would send, so a test can read the three
          numbers as the record would carry them rather than off a style. */}
      <p data-testid="sent">{chosen === null ? 'nista' : JSON.stringify(chosen.crop)}</p>
    </>
  )
}

/**
 * A crop as it actually arrives: parsed out of text.
 *
 * Every record on this portal is read out of JSON, which is why nothing can
 * vouch for its shape and why there is a check to read one through
 * (components/crop.ts). Round tripping through text also drops a field that was
 * never set, which is the case that mattered: the missing key, not the wrong
 * value.
 */
function asRead(crop: unknown): Crop {
  return JSON.parse(JSON.stringify({ crop })).crop
}

const anImage = () => new File(['slika'], 'trka.jpg', { type: 'image/jpeg' })

/** The picture and its sliders, once the browser has read the file off the
 *  disc. Waited for rather than assumed: reading is a tick later than the
 *  choosing, and everything here happens after it. */
/**
 * The cropper, once the picture behind it has been measured.
 *
 * Nothing is offered over a file until the browser says how big it is: a picture
 * too small to draw the circle without loss is refused and the cropper is never
 * opened over it (owner, 23.08.2026), and one that passes decides how small its
 * own circle may be. jsdom decodes nothing, so the measurement has to be handed
 * to it, exactly as the tests below already hand the drawn picture its shape.
 *
 * Big enough by default, because most cases here are not about the boundary; the
 * one that is passes its own numbers.
 */
async function measured(width = 1200, height = 1200) {
  /* Waited for: the file is read off the disc a turn after the press, so at the
     moment this is called there may be nothing to measure yet. */
  const measuring = await waitFor(() =>
    theMeasuringPicture(),
  )

  Object.defineProperty(measuring, 'naturalWidth', { value: width, configurable: true })
  Object.defineProperty(measuring, 'naturalHeight', { value: height, configurable: true })
  fireEvent.load(measuring)

  return within(await screen.findByRole('group', { name: 'Isecanje slike' }))
}

const cropper = measured

const sent = () => must(screen.getByTestId('sent').textContent, 'what would be sent')

/** The same three numbers as numbers, for the cases that measure a boundary
 *  rather than a value. The arithmetic here is not rounded on its way to a
 *  record, so two thirds of a picture reaches the text as
 *  `0.3800000000000001`, and a case written against the text would be a case
 *  about binary fractions. */
const sentCrop = (): Crop => JSON.parse(sent())

/**
 * The picture as something to press on, with the box a browser would have
 * measured. jsdom lays nothing out (ADL A18), so the box is handed over: 200 by
 * 200 at the origin, which makes every share below a round number of pixels.
 *
 * One helper for the whole file, and it is here rather than inside a `describe`
 * for that reason: three groups of cases press on this element, and three copies
 * of the same lookup and the same box drifted the moment a fourth was written.
 *
 * Found by its class, which the rule about role and label queries in `CLAUDE.md`
 * is against and which nothing here can mend: this box carries no role, no label
 * and no text, because it is a picture in a frame and not a control. The class is
 * therefore the one handle it has, and the message says so, so that a rename
 * lands as „the class is gone" rather than as an unexplained null.
 */
function picture() {
  const box = must(
    document.querySelector<HTMLElement>('.crop__picture'),
    'the picture (is `.crop__picture` still what the box is called?)',
  )

  box.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => '' })

  return box
}

/** A pointer event at a share of that box, in the pixels the box is measured in. */
const at = (spot: { across: number; down: number }) =>
  ({ clientX: spot.across * 200, clientY: spot.down * 200, pointerId: 1 })

/**
 * The cropper open over a square picture, with the circle at half of it.
 *
 * Half rather than whole, because a circle as wide as the picture has no room to
 * move and no rim inside the box: at that size every spot on the picture is a
 * pull. Halved and centred, the rim stands at 0,75 of the box and the radius is a
 * quarter of it, so a share of the radius is a round number of pixels.
 */
async function halved() {
  const user = setupUser()

  renderWithI18n(<Choosing />)

  await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())

  const group = await measured(1000, 1000)
  const whole = must(document.querySelector('.crop__whole'), 'the picture drawn')

  Object.defineProperty(whole, 'naturalWidth', { value: 1000, configurable: true })
  Object.defineProperty(whole, 'naturalHeight', { value: 1000, configurable: true })
  fireEvent.load(whole)
  fireEvent.change(group.getByLabelText('Veličina isečka'), { target: { value: '0.5' } })

  return group
}

describe('choosing which square of a picture counts', () => {
  it('offers nothing to cut until there is something to cut', () => {
    /* Three sliders over an empty box are three controls that do nothing, and a
       reader tabbing through the settings meets all of them before the field
       that would give them a picture. */
    renderWithI18n(<Choosing />)

    expect(screen.getByLabelText(/Izaberi sliku/)).toBeVisible()
    expect(screen.queryByRole('group', { name: 'Isecanje slike' })).not.toBeInTheDocument()
    expect(sent()).toBe('nista')
  })

  it('starts at the whole picture, and says so as a share rather than a number', async () => {
    /* The largest square there is, in the middle of what it cannot cover: a
       member who never touches a slider gets the middle of their photograph.
       And what a reader hears is „100%" and not „1", because the number on its
       own means nothing to anybody (WCAG 2.2 SC 4.1.2). */
    const user = setupUser()
    renderWithI18n(<Choosing />)

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())

    const crop = await cropper()

    expect(sent()).toBe(JSON.stringify({ x: 0.5, y: 0.5, size: 1 }))
    expect(crop.getByLabelText('Veličina isečka')).toHaveAttribute('aria-valuetext', '100%')
    expect(crop.getByLabelText('Pomeri levo i desno')).toHaveAttribute('aria-valuetext', '50%')
  })

  it('is cut with controls a keyboard can reach and a reader can hear', async () => {
    /* The reason this is three range controls and not a rectangle dragged with
       a mouse. A drag handle is unreachable: it takes no arrows without key
       handling nobody announces, it has no value to read out, and on a phone it
       fights the scroll of the page around it (WCAG 2.2 SC 2.1.1 and 4.1.2).

       What is asserted is what this file can honestly assert. Being in the tab
       order is proved by tabbing to it. Arrows are not pressed, because
       user-event refuses to simulate them on a range control and says so:
       „Not implemented. The result of this interaction is unreliable." Every
       browser steps a range on arrows, Home and End without a line of code from
       us, which is exactly why a native control was chosen, and there is
       nothing of ours between the key and the value for a test to catch. What
       there is of ours is the limit and the step, and those are read off the
       control here. */
    const user = setupUser()
    renderWithI18n(<Choosing />)

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())

    const crop = await cropper()

    /* Three stops from the field that took the file: across, down, and how
       close. */
    screen.getByLabelText(/Izaberi sliku/).focus()
    await user.tab()
    expect(crop.getByLabelText('Pomeri levo i desno')).toHaveFocus()
    await user.tab()
    await user.tab()

    const size = crop.getByLabelText('Veličina isečka')

    expect(size).toHaveFocus()
    /* The closest a member may cut down to is a limit and not nought: a square
       of no size is not a portrait, it is a handful of pixels blown up. */
    expect(size).toHaveAttribute('min', '0.2')
    expect(size).toHaveAttribute('max', '1')
    expect(size).toHaveAttribute('step', '0.01')

    fireEvent.change(size, { target: { value: '0.2' } })

    expect(sent()).toBe(JSON.stringify({ x: 0.5, y: 0.5, size: 0.2 }))
    expect(size).toHaveAttribute('aria-valuetext', '20%')
  })

  it('moves the square along whatever room the zoom leaves', async () => {
    /* Each slider moves its own axis and nothing else, which is worth pinning
       because all three are drawn by one piece of code: written out three times
       the zoom kept the label of the axis above it. */
    const user = setupUser()
    renderWithI18n(<Choosing />)

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())

    const crop = await cropper()

    fireEvent.change(crop.getByLabelText('Pomeri levo i desno'), { target: { value: '0' } })
    fireEvent.change(crop.getByLabelText('Pomeri gore i dole'), { target: { value: '1' } })

    expect(sent()).toBe(JSON.stringify({ x: 0, y: 1, size: 1 }))
  })

  it('shows the part that will be thrown away, rather than only the part kept', async () => {
    /* The half of the owner's sentence a cropping tool normally leaves out:
       „da se nazire ispod... i ono što se neće videti". The picture on screen
       is the whole file, and the square is a lit window over it, so a member
       can see what they cut off and a moderator can see what a face was cut out
       of. Drawn as one element with a shade spreading out of it
       (components/Crop.css), and said out loud as well, because dimming is a
       colour and a colour is nothing to a screen reader. */
    const user = setupUser()
    const { container } = renderWithI18n(<Choosing />)

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())
    await cropper()

    const whole = must(container.querySelector('.crop__whole'), 'the whole picture')
    const frame = must(container.querySelector('.crop__frame'), 'the lit circle')

    expect(whole).toHaveAttribute('alt', 'Slika koju si izabrao')
    expect(whole).toHaveAttribute('src', expect.stringContaining('data:image/jpeg'))
    expect(frame).toHaveTextContent(/Ostatak je zatamnjen/)
    /* And the sentence names the shape, because the shape is the whole of what
       changed on 27.08.2026 and a screen reader hears only these words: dimming
       is a colour and a circle is a curve, and neither is anything at all
       without being said. „Uokvireni deo" described a square and would go on
       describing one after the rule that draws it became round. */
    expect(frame).toHaveTextContent(/u krugu/)
  })

  it('draws the square over the picture the file turned out to be', async () => {
    /* A square is square in pixels and not in percentages, so the frame cannot
       be drawn without knowing the shape of the file. Before the browser has
       decoded it there is nothing to ask, and a box of no height would collapse
       to a line: it is treated as a square until the picture says otherwise,
       and then redrawn.

       jsdom decodes nothing, so the load is arranged here and the natural size
       given, which is the only way this branch can be reached at all. */
    const user = setupUser()
    const { container } = renderWithI18n(<Choosing />)

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())
    await cropper()

    const whole = must(container.querySelector('.crop__whole'), 'the whole picture')
    const box = must(container.querySelector('.crop__picture'), 'the box it stands in')
    const frame = must(container.querySelector('.crop__frame'), 'the lit square')

    // Square until the file says otherwise, and the whole of it.
    expect(box).toHaveStyle({ aspectRatio: '1 / 1' })
    expect(frame).toHaveStyle({ inlineSize: '100%', blockSize: '100%' })

    Object.defineProperty(whole, 'naturalWidth', { value: 800, configurable: true })
    Object.defineProperty(whole, 'naturalHeight', { value: 400, configurable: true })
    fireEvent.load(whole)

    await waitFor(() => {
      expect(box).toHaveStyle({ aspectRatio: '800 / 400' })
    })

    /* Half the width and all the height of a picture twice as wide as it is
       tall, a quarter of the way in: one square, said in two percentages. */
    expect(frame).toHaveStyle({ inlineSize: '50%', blockSize: '100%', insetInlineStart: '25%' })

    /* And the shade over it, with the hole the frame just described cut out of
       it. Asked for by the same two questions the frame is asked: that the
       element is there under the name the stylesheet defines, and that the value
       it carries is the value the arithmetic answered.

       Both were missing until 27.08.2026, and a review counted what that let
       through with the whole suite green: the class renamed by one letter, so
       there was no shade at all and nothing was dimmed; and the mask under a
       property name that does not exist, so the shade covered the picture whole
       and there was no lit circle. Each of those is the opposite of what this
       screen is for, and neither showed up anywhere. */
    const shade = must(container.querySelector('.crop__shade'), 'the shade over the picture')

    expect(shade).toHaveStyle({
      maskImage: 'radial-gradient(ellipse 25% 50% at 50% 50%, transparent 99.5%, #000 100%)',
    })
  })

  it('keeps a picture that decoded to nothing at the shape it can draw', async () => {
    /* A file the browser could not read reports nought for both, and a box of
       nought height is a line with a frame over it. Both are asked for, because
       one of them alone would let a picture through with a width and no
       height. */
    const user = setupUser()
    const { container } = renderWithI18n(<Choosing />)

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())
    await cropper()

    const whole = must(container.querySelector('.crop__whole'), 'the whole picture')

    Object.defineProperty(whole, 'naturalWidth', { value: 800, configurable: true })
    Object.defineProperty(whole, 'naturalHeight', { value: 0, configurable: true })
    fireEvent.load(whole)

    expect(must(container.querySelector('.crop__picture'), 'the box')).toHaveStyle({
      aspectRatio: '1 / 1',
    })
  })

  it('starts the next picture whole, rather than cut where the last one was', async () => {
    /* A member who cropped closely to a face and then chose a different
       photograph would otherwise have the new one cut at the same place, which
       is somewhere nobody looked. */
    const user = setupUser()
    renderWithI18n(<Choosing />)

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())

    const crop = await cropper()

    fireEvent.change(crop.getByLabelText('Veličina isečka'), { target: { value: '0.4' } })
    expect(sent()).toContain('0.4')

    await user.upload(
      screen.getByLabelText(/Izaberi sliku/),
      new File(['druga'], 'druga.jpg', { type: 'image/jpeg' }),
    )

    await waitFor(() => {
      expect(sent()).toBe(JSON.stringify({ x: 0.5, y: 0.5, size: 1 }))
    })
  })

  it('goes back to having nothing when the field is emptied', async () => {
    /* A file field can be cleared: the dialogue is opened and cancelled on some
       browsers, and a form reset does it on all of them. Left holding the last
       picture, the screen would go on offering to send something the member
       took back, and the field beside it would be empty while the cropper under
       it showed a face. */
    const user = setupUser()
    renderWithI18n(<Choosing />)

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())
    await cropper()

    fireEvent.change(screen.getByLabelText(/Izaberi sliku/), { target: { files: [] } })

    await waitFor(() => {
      expect(sent()).toBe('nista')
    })
    expect(screen.queryByRole('group', { name: 'Isecanje slike' })).not.toBeInTheDocument()
  })

  it('takes nothing at all rather than a name with no picture behind it', async () => {
    /* A browser that hands back no text for a file it accepted. It happens: a
       file that vanished between the dialogue and the read, a permission
       withdrawn, a decoder that gave up. Taken as half a choice, the send button
       would light up over a name with nothing behind it and the moderator would
       get an empty frame with a file name under it.

       The reader is replaced here because there is no file jsdom will fail on,
       and the branch is a real one: it is what the type of `result` says can
       happen. */
    const user = setupUser()
    const real = globalThis.FileReader

    class Silent {
      result: string | null = null
      onload: (() => void) | null = null

      readAsDataURL() {
        this.onload?.()
      }
    }

    try {
      Object.defineProperty(globalThis, 'FileReader', { value: Silent, configurable: true })

      renderWithI18n(<Choosing />)

      await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())

      expect(sent()).toBe('nista')
      expect(screen.queryByRole('group', { name: 'Isecanje slike' })).not.toBeInTheDocument()
    } finally {
      Object.defineProperty(globalThis, 'FileReader', { value: real, configurable: true })
    }
  })

  it('draws a waiting picture whose record says nothing sensible about the square', () => {
    /* The review view reads a crop off a record too, and a record is whatever
       the file, the session or F5 last said it was. Read straight off it, an
       item with no square at all threw on a field that was not there and took
       the moderator's whole queue with it; a size of nought divided into a
       frame of infinite width.

       Parsed out of text, which is how every record on this portal actually
       arrives, and which drops a key that was never set. */
    for (const crop of [undefined, { x: 5, y: -1, size: 0 }]) {
      const { container, unmount } = renderWithI18n(
        /* Named rather than spread. Spreading the parsed record would hand the
           element an `any`, which switches off the check on every one of its
           properties: a new one added to `CropWindow` would go unnoticed here,
           which is wider than the one field this is about. */
        <CropWindow picture="data:image/png;base64,x" alt="Slika koja čeka" crop={asRead(crop)} />,
      )

      /* The whole picture, which is what a record nobody understands means:
         showing the photograph somebody sent beats cutting it somewhere they
         never chose. */
      expect(must(container.querySelector('.crop__frame'), 'the lit square')).toHaveStyle({
        insetInlineStart: '0%',
        inlineSize: '100%',
      })

      unmount()
    }
  })

  it('asks for a picture where one is wanted, and does not where it is not', () => {
    /* Owner, 12.08.2026: fields that have to be answered carry a star. A team
       may be proposed with no logo at all and most are; a member changing
       their photograph has nothing to send without one. */
    const { unmount } = renderWithI18n(<Choosing />)

    expect(screen.getByLabelText(/Izaberi sliku/)).toHaveAttribute('aria-required', 'true')

    unmount()
    renderWithI18n(<Choosing asked={false} />)

    expect(screen.getByLabelText(/Izaberi sliku/)).toHaveAttribute('aria-required', 'false')
  })
})

describe('a picture the portal cannot draw the circle from', () => {
  it('is refused when it is chosen, and the cropper never opens over it', async () => {
    /* Owner, 23.08.2026: „slika manja od te granice se odbija pri podizanju, uz
       poruku koja kaže zašto i koliko treba; kroper se nad njom i ne otvara." The
       boundary is 240 pixels on the shorter edge (owner, 27.08.2026: „Poslušaću
       preporuku 240"), which is the largest size a face is drawn at on a screen of
       three device pixels to one.

       Wide and short, so what is refused is plainly the shorter edge and not the
       area: a picture 1600 across is not big enough if it is 239 tall. */
    const user = setupUser()

    renderWithI18n(<Choosing />)

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())
    await measurePicture(1600, 239)

    /* And in the words that belong to this refusal and not to the other one. The
       two are told apart nowhere else: both take the picture away and leave the
       same screen behind, so the sentence is the only thing a member has to go
       on. */
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Slika je premala. Najkraća strana mora da ima bar 240 piksela, da bi krug ostao oštar svuda gde se prikazuje.',
    )
    expect(screen.queryByRole('group', { name: 'Isecanje slike' })).toBeNull()
    /* And the file goes with the refusal: a member left holding a picture they
       cannot use would have to work out for themselves that it is gone. */
    expect(sent()).toBe('nista')
  })

  it('is taken at exactly the boundary, which is a boundary and not a suggestion', async () => {
    const user = setupUser()

    renderWithI18n(<Choosing />)

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())
    await measured(240, 240)

    expect(await screen.findByRole('group', { name: 'Isecanje slike' })).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('is refused when it arrives measuring nothing, the same as one that fails', async () => {
    /* Nought is not a size to judge against, so nothing can be offered over it,
       and until 28.08.2026 that ended in silence: no cropper, no message, and a
       live send button, which is exactly the state `onError` was added to close.
       One decision reached by two roads had two different endings, and a review
       counted them: the file that fails outright was answered and the file that
       arrives measuring nothing was not. */
    const user = setupUser()

    renderWithI18n(<Choosing />)

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())
    await measurePicture(0, 0)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ova slika se ne može otvoriti. Izaberi drugu, na primer u JPG ili PNG obliku.',
    )
    expect(screen.queryByRole('group', { name: 'Isecanje slike' })).toBeNull()
    expect(sent()).toBe('nista')
  })

  it('lets the next file try again after one was refused', async () => {
    /* The message is about the choosing and goes the moment another file is
       chosen, or a member who fixed their picture reads a complaint about the one
       before it. */
    const user = setupUser()

    renderWithI18n(<Choosing />)

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())
    await measurePicture(100, 100)

    expect(await screen.findByRole('alert')).toBeVisible()

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())
    await measured(1200, 1200)

    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('group', { name: 'Isecanje slike' })).toBeVisible()
  })

  it('offers no closer crop than the picture can carry', async () => {
    /* The other rule out of the same number. A picture of 480 pixels may be cut
       to half of itself and no closer, because half of 480 is the 240 the portal
       draws; a picture of 1200 may be cut to a fifth. Read off the control rather
       than off the arithmetic, because the control is what a member meets. */
    const user = setupUser()

    renderWithI18n(<Choosing />)

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())
    const wide = await measured(1200, 1600)

    expect(wide.getByLabelText('Veličina isečka')).toHaveAttribute('min', '0.2')

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())
    const small = await measured(480, 640)

    expect(small.getByLabelText('Veličina isečka')).toHaveAttribute('min', '0.5')
  })
})

describe('choosing with a finger or a mouse instead of the sliders', () => {
  /** A pointer passing over the picture with nothing held, and what the picture
   *  answers it with. Read off the element's own style, which is where the state
   *  in `CropWindow.tsx` lands. */
  function over(at: { across: number; down: number }) {
    const box = picture()

    fireEvent.pointerMove(box, { clientX: at.across * 200, clientY: at.down * 200, pointerId: 1 })

    return box.style.cursor
  }

  /** A press, a drag and a release at shares of the drawn picture. */
  function dragTo(from: { across: number; down: number }, to?: { across: number; down: number }) {
    const box = picture()

    fireEvent.pointerDown(box, { clientX: from.across * 200, clientY: from.down * 200, pointerId: 1 })

    if (to !== undefined) {
      fireEvent.pointerMove(box, { clientX: to.across * 200, clientY: to.down * 200, pointerId: 1 })
    }

    fireEvent.pointerUp(box, { pointerId: 1 })
  }

  async function ready() {
    const user = setupUser()

    renderWithI18n(<Choosing />)

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())

    const group = await measured(1000, 1000)
    const whole = must(document.querySelector('.crop__whole'), 'the picture drawn')

    Object.defineProperty(whole, 'naturalWidth', { value: 1000, configurable: true })
    Object.defineProperty(whole, 'naturalHeight', { value: 1000, configurable: true })
    fireEvent.load(whole)

    return group
  }

  it('moves the circle to where the pointer is', async () => {
    /* Owner, 23.08.2026: „krug se pomera prstom na telefonu i tabletu, mišem na
       velikom ekranu, i time se bira drugi deo slike." Pressed inside the circle,
       so this is a move; the whole picture is the circle to begin with, so it is
       first made smaller with the slider it shares its numbers with. */
    const group = await ready()

    fireEvent.change(group.getByLabelText('Veličina isečka'), { target: { value: '0.5' } })
    dragTo({ across: 0.5, down: 0.5 }, { across: 0.25, down: 0.25 })

    expect(sent()).toContain('"x":0')
    expect(sent()).toContain('"y":0')
    /* And the sliders say the same thing, because both write the same numbers. */
    expect(group.getByLabelText('Pomeri levo i desno')).toHaveValue('0')
  })

  it('grows and shrinks the circle when the press lands on its rim', async () => {
    /* Owner, same day: „povlačenjem ivice krug se širi ili sužava", and
       27.08.2026: „centralna pozicija bude nepokretna". Pressed well outside the
       circle's own radius, which is what tells a resize from a move. */
    const group = await ready()

    fireEvent.change(group.getByLabelText('Veličina isečka'), { target: { value: '0.4' } })
    /* Pressed on the rim and then pulled outwards, because the press alone does
       nothing (owner, 29.08.2026: „krug ne mrdne dok ja ne počnem da ga
       resizeujem"). The circle is four tenths across, so its rim is at seven
       tenths of the box; the hand travels two tenths further out, and the diameter
       grows by twice that. */
    dragTo({ across: 0.7, down: 0.5 }, { across: 0.9, down: 0.5 })

    expect(sentCrop().size, 'the diameter did not grow by twice the pull').toBeCloseTo(0.8, 6)

    /* Shrinking is the same gesture the other way, and it has to begin on the rim
       as well: a press inside the circle is a move, whichever way the finger then
       goes. The circle is now eight tenths across, so its rim is at nine tenths.

       Dragged past the floor on purpose: „skuplja dok ne udari o minimum koji je
       potreban za dobar prikaz po portalu" (owner, 27.08.2026), and on a picture
       of a thousand pixels that floor is 240 of them, which is 0,24. */
    dragTo({ across: 0.9, down: 0.5 }, { across: 0.51, down: 0.5 })

    /* Read off what would be sent and not off the control. A range input clamps
       its own `.value` to its `min`, so a crop that fell straight through the
       floor still reads 0,24 on the slider: measured by a review on 27.08.2026,
       with the floor taken out the record said `"size":0.02` while the slider
       went on saying 0,24 and the whole suite stayed green. */
    expect(sent()).toContain('"size":0.24')
    expect(group.getByLabelText('Veličina isečka')).toHaveValue('0.24')
  })

  it('stops following the pointer once it is let go', async () => {
    /* A press decides which of the two it is and a release ends it. Without the
       release the picture would go on answering every pass of a mouse over it,
       which is a circle that moves when nobody is touching anything. */
    const group = await ready()

    fireEvent.change(group.getByLabelText('Veličina isečka'), { target: { value: '0.5' } })
    dragTo({ across: 0.5, down: 0.5 }, { across: 0.25, down: 0.25 })

    const box = picture()

    fireEvent.pointerMove(box, { clientX: 190, clientY: 190, pointerId: 1 })

    expect(group.getByLabelText('Pomeri levo i desno'), 'the circle moved with nothing held').toHaveValue('0')
  })

  it('holds the pointer where the browser lets it, so a finger may wander off', async () => {
    /* A drag that leaves the picture goes on moving the circle rather than being
       handed to whatever it wandered onto. jsdom has no pointer capture at all,
       so the branch that uses it is only reachable by giving the element one;
       what is measured is that it is asked for and used where it exists. */
    const group = await ready()
    const box = picture()
    const held: number[] = []

    Object.defineProperty(box, 'setPointerCapture', {
      value: (id: number) => held.push(id),
      configurable: true,
    })

    fireEvent.change(group.getByLabelText('Veličina isečka'), { target: { value: '0.5' } })
    dragTo({ across: 0.5, down: 0.5 }, { across: 0.25, down: 0.25 })

    expect(held, 'the press was not held by the picture').toEqual([1])
    expect(group.getByLabelText('Pomeri levo i desno')).toHaveValue('0')
  })

  it('lets go when the browser takes the press away', async () => {
    /* A pointer can be cancelled rather than released: a telephone taking the
       gesture for something of its own, or a window losing focus mid-drag. Left
       out, the drag would still be running the next time a finger passed over. */
    const group = await ready()

    fireEvent.change(group.getByLabelText('Veličina isečka'), { target: { value: '0.5' } })

    const box = picture()

    fireEvent.pointerDown(box, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerCancel(box, { pointerId: 1 })
    fireEvent.pointerMove(box, { clientX: 20, clientY: 20, pointerId: 1 })

    expect(group.getByLabelText('Pomeri levo i desno')).toHaveValue('0.5')
  })

  it('changes nothing at all while a pointer merely passes over the picture', async () => {
    /* The one line that separates a picture answering a press from a picture
       answering a mouse: with nothing held the move handler leaves the crop
       exactly as it was and only redresses the pointer.

       Measured at the middle of the circle, which is where losing that line shows
       up worst: nothing is held, so the crop would be resized rather than moved,
       and a circle pulled in to its own middle falls straight through to the
       smallest the picture allows. Half the picture becomes 0,24 of it, without
       anybody pressing anything. */
    const group = await ready()

    fireEvent.change(group.getByLabelText('Veličina isečka'), { target: { value: '0.5' } })

    const before = sent()

    over({ across: 0.5, down: 0.5 })
    over({ across: 0.9, down: 0.5 })

    expect(sent(), 'the crop moved with nothing held').toBe(before)
  })
})

describe('what the pointer says a press would do, before anybody presses', () => {
  /* Owner, 29.08.2026: „Kad je miš unutar kruga, pointer se pretvara u ruku i
     klikom i vučenjem se taj krug pomera po slici", and „Kad je miš na samoj
     ivici kruga, pointer se pretvara u strelice za razvlačenje."

     Read off the element's inline style, because that is where it is written:
     which of the nine answers applies depends on where the pointer is and on how
     big the circle is at that moment, so `Crop.css` says nothing about the cursor
     at all (`cropStyle.test.ts` holds that absence).

     The circle here is half the picture across, centred, so its rim is at 0,75 of
     the box and its radius a quarter of it (`halved` at the head of this file). */

  it('turns into an open hand inside the circle', async () => {
    /* „Pointer se pretvara u ruku", and an open hand rather than `move`: the
       picture does not move, the circle over it does.

       Measured six tenths of the way out from the middle, which is inside the
       band and outside a half of it: at the very middle the distance is nought
       and a band of nought would still answer „hand", so the middle measures the
       word and not the number. */
    await halved()

    const box = picture()

    fireEvent.pointerMove(box, at({ across: 0.65, down: 0.5 }))

    expect(box.style.cursor).toBe('grab')
  })

  it('turns into arrows for pulling once the pointer reaches the rim', async () => {
    /* „Kad je miš na samoj ivici kruga, pointer se pretvara u strelice za
       razvlačenje." Nine tenths of the way out from the middle, which is past the
       rim of the circle: a band of two would call this a hand and there would be
       nowhere on the picture the arrows ever appeared. */
    await halved()

    const box = picture()

    fireEvent.pointerMove(box, at({ across: 0.9, down: 0.5 }))

    expect(box.style.cursor).toBe('ew-resize')
  })

  it('does with a press exactly what it promised with the pointer', async () => {
    /* The whole reason the answer has one home (ADL A31). A cursor promising
       „razvuci me" over a spot that moves the circle is worse than no cursor at
       all: it is the portal saying one thing and doing another, and nothing but a
       case that presses where the pointer pointed can tell the two apart.

       So the same spot is asked twice, once of the pointer and once of a press,
       and what the press did is read off the record rather than off a slider: a
       resize about a middle that stands still changes the size and neither of the
       two positions. */
    await halved()

    const box = picture()
    const spot = { across: 0.9, down: 0.5 }

    fireEvent.pointerMove(box, at(spot))

    expect(box.style.cursor, 'the pointer did not promise a pull').toBe('ew-resize')

    const before = sent()

    fireEvent.pointerDown(box, at(spot))

    /* And the press by itself has done nothing at all, which is the owner's first
       correction of 29.08.2026: „krug ne mrdne dok ja ne počnem da ga
       resizeujem". Before it, this very press moved the rim to meet the pointer,
       and the record read `{"size":0.8,...}` without the hand having moved. */
    expect(sent(), 'the press alone changed the crop').toBe(before)

    fireEvent.pointerMove(box, at({ across: 0.95, down: 0.5 }))

    /* Then the hand moves a twentieth of the box outwards and the diameter grows
       by twice that, about a middle that stands still: a pull and not a move. */
    const pulled = sentCrop()

    expect(pulled.size, 'the diameter did not follow the hand').toBeCloseTo(0.6, 6)
    expect({ x: pulled.x, y: pulled.y }, 'the middle moved during a pull').toEqual({ x: 0.5, y: 0.5 })
  })

  it('closes the hand while the circle is being carried, and keeps it closed', async () => {
    /* A press decides once and the pointer is locked to what it decided: without
       that, a drag that carries the circle out from under the pointer would
       flicker between a hand and the arrows as the rim overtook the finger.

       Pressed in the middle and dragged out past the rim, which is exactly that
       case. */
    await halved()

    const box = picture()

    fireEvent.pointerDown(box, at({ across: 0.5, down: 0.5 }))

    expect(box.style.cursor).toBe('grabbing')

    fireEvent.pointerMove(box, at({ across: 0.95, down: 0.5 }))

    expect(box.style.cursor, 'the hand opened in the middle of a drag').toBe('grabbing')
  })

  it('wears the arrows for as long as the circle is being pulled', async () => {
    /* The other half of „strelice za razvlačenje" (owner, 29.08.2026), and the
       half nothing measured: every case above reads the pointer either before a
       press or during a carry, so a window that dressed the pointer only for
       carrying passed all of them. Measured as a mutation on 29.08.2026: with the
       press written `setCursor(aim.doing === 'moving' ? 'grabbing' : '')` every
       other case in the suite stayed green while a member pulling the rim watched
       the ordinary arrow for the whole gesture. This one is the only thing that
       falls on it.

       Asked at the press and again during the drag, because the two are different
       lines: the press decides the cursor and the move is what must leave it
       alone. Pulled inwards past the rim on the way, which is where the answer
       would change if it were still being read off where the pointer is. */
    await halved()

    const box = picture()

    fireEvent.pointerDown(box, at({ across: 0.9, down: 0.5 }))

    expect(box.style.cursor, 'the press did not dress the pointer for pulling').toBe('ew-resize')

    fireEvent.pointerMove(box, at({ across: 0.6, down: 0.5 }))

    expect(box.style.cursor, 'the arrows went away in the middle of a pull').toBe('ew-resize')
  })

  it('promises nothing once the pointer has left the picture', async () => {
    /* Off the picture there is nothing to promise, and a cursor left behind would
       be a promise about a picture the pointer is no longer over. */
    await halved()

    const box = picture()

    fireEvent.pointerMove(box, at({ across: 0.9, down: 0.5 }))

    expect(box.style.cursor).toBe('ew-resize')

    fireEvent.pointerLeave(box)

    expect(box.style.cursor).toBe('')
  })

  it('promises nothing after a gesture somebody else took away', async () => {
    /* A press can be cancelled rather than released, by a telephone taking the
       gesture for something of its own or by a window losing focus. Where the
       pointer ended up is then not this picture's to say, so it says nothing and
       waits for the next move over it. */
    await halved()

    const box = picture()

    fireEvent.pointerDown(box, at({ across: 0.5, down: 0.5 }))
    fireEvent.pointerCancel(box, { pointerId: 1 })

    expect(box.style.cursor).toBe('')
  })

  it('goes back to promising the moment the press is let go', async () => {
    /* Read off where the pointer was released and off the circle as it now is.
       Waiting for the next move instead would leave a closed hand under a pointer
       holding nothing, for as long as it stayed still. */
    await halved()

    const box = picture()

    fireEvent.pointerDown(box, at({ across: 0.5, down: 0.5 }))
    fireEvent.pointerUp(box, at({ across: 0.9, down: 0.5 }))

    /* The circle followed the press to the middle it was pressed at, so it is
       still half the picture centred on it, and 0,9 is outside its rim. */
    expect(box.style.cursor).toBe('ew-resize')
  })
})

describe('what the picture is dressed as while it can be dragged', () => {
  it('takes every touch, so a drag moves the circle rather than the page', async () => {
    /* The class is the only thing that carries `touch-action: none` to the
       element, and without it a drag on a telephone is read as a scroll: the page
       moves under the finger and the circle stays where it was. Nothing on a
       desktop would ever show it, because a mouse does not care.

       Measured by a review on 27.08.2026: with the class taken off, 2236 tests
       stayed green. */
    const user = setupUser()

    renderWithI18n(<Choosing />)

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())
    await measured()

    expect(must(document.querySelector('.crop__picture'), 'the picture')).toHaveClass(
      'crop__picture--dragged',
    )
  })

  it('refuses the browser its own dragging of the photograph', async () => {
    /* The other thing a gesture on a picture has to be protected from, and it is
       the browser rather than the page this time: a picture is draggable by
       default, so the moment the circle shrinks past the pointer and leaves it
       standing over bare photograph, Chrome starts dragging the file and takes
       the gesture away.

       Measured in Chrome over the built `dist` on 29.08.2026, on a picture 1000
       by 2000 pressed at 0,97 of the box across and dragged to 0,90, 0,70, 0,55
       and 0,50 of it: without this attribute the log reads `dragstart` on
       `IMG.crop__whole`, then `pointercancel`, `lostpointercapture`, `pointerout`
       and `pointerleave`, and the size goes 1 to 0,94 to 0,80 and then stands
       still for the rest of the press while the cursor falls back to nothing with
       the button down. With it there is no `dragstart` at all, the cursor stays
       `ew-resize` throughout, and the same press runs 1 to 0,94 to 0,80 to 0,40
       to 0,24, which is the floor for that picture. Owner, 29.08.2026, point 4:
       „krug se skuplja ili širi do mogućih granica", and shrinking is half of it.

       Asserted as an attribute and not as an outcome, exactly as `touch-action`
       above is: jsdom has no native dragging to take a gesture away with and no
       pointer capture to lose, so this is the whole of what a test here can see,
       and the browser is where the fault was measured. */
    const user = setupUser()

    renderWithI18n(<Choosing />)

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())
    await measured()

    expect(screen.getByRole('img', { name: 'Slika koju si izabrao' })).toHaveAttribute(
      'draggable',
      'false',
    )
  })

  it('takes none of them where there is nothing to drag', async () => {
    /* A moderator reading a member's choice has nothing to move, so the picture
       must not swallow their scrolling either. The window is the same component
       on both screens and this is the one thing that differs. */
    const { container } = renderWithI18n(
      <CropWindow picture="data:image/jpeg;base64,x" crop={WHOLE} alt="Proba" />,
    )

    const box = must(container.querySelector<HTMLElement>('.crop__picture'), 'the picture')

    expect(box).not.toHaveClass('crop__picture--dragged')

    /* And it keeps its whole height there, which is the other half of the same
       decision. The cap exists because a picture that takes every touch is a wall
       between the member and the send button; a moderator has nothing to drag and
       scrolls past a tall picture like any other. Measured by a review on
       28.08.2026 in a window 805 pixels high: capped, a 1080 by 2400 photograph
       drew 217 by 483 instead of 320 by 711, so the part being thrown away, which
       is the whole of what a moderator is looking at (owner, 12.08.2026:
       „zatamnjen ali dovoljno vidljiv ostatak"), stood at 68 per cent of its
       linear size. */
    expect(box.style.maxBlockSize).toBe('')
    expect(box.style.inlineSize).toBe('')
  })
})

describe('the band that tells a move from a resize', () => {
  /* Where the number lives is measured in `crop.test.ts`. What is measured here
     is that **the press asks it**, at the one pair of spots where a second copy
     of the same comparison would answer differently.

     The circle is half the picture across and centred, so its radius is a quarter
     of the box: a press at 0,685 is 0,74 of a radius out and one at 0,69 is 0,76,
     a hundredth of a radius either side of the band. A press decided anywhere
     other than `aimAt` therefore has to agree with it to within that hundredth,
     and a copy carrying 0,70 or 0,80 does not.

     Measured on 29.08.2026, and this is why the two spots are this close: with
     `onPointerDown` given its own 0,70 while `aimAt` kept 0,75, every other case
     in the gate passed. A press at 0,68 across then showed the open hand and
     resized the circle anyway, `{"size":0.5}` becoming
     `{"size":0.36,"x":0.5,"y":0.5}`, which is the very fault this window was
     written to close. The first case below is the only thing that falls on that
     mutation, and the second is the only thing that falls when the copy carries
     0,80 instead.

     Each spot is asked twice over, of the pointer and of the press, because the
     fault is exactly the two disagreeing: a size that changes says the press
     resized, and a cursor that says „grab" over it says the picture promised
     otherwise. */

  it('reads a press a hundredth inside the band as a move, and says so first', async () => {
    /* A member who takes hold of the circle a little inside its rim to shift it
       must shift it. Carried, so the size is untouched and the circle has gone as
       far as the hand did and no further: a press that landed a hundredth inside
       the band and then travelled a tenth of the box moves the circle a tenth of
       the box, not to wherever the finger happens to be. */
    await halved()

    const box = picture()
    const spot = { across: 0.685, down: 0.5 }

    fireEvent.pointerMove(box, at(spot))

    expect(box.style.cursor, 'the pointer did not promise a move').toBe('grab')

    fireEvent.pointerDown(box, at(spot))
    fireEvent.pointerMove(box, at({ across: 0.785, down: 0.5 }))
    fireEvent.pointerUp(box, at({ across: 0.785, down: 0.5 }))

    /* Half the picture wide, so the room left over is half of it: a tenth of the
       box is a fifth of that room, and the share goes from a half to seven tenths. */
    expect(sentCrop().size, 'the press resized instead of moving').toBe(0.5)
    expect(sentCrop().x).toBeCloseTo(0.7, 10)
    expect(sentCrop().y).toBe(0.5)
  })

  it('reads a press a hundredth outside it as a pull, and says so first', async () => {
    /* And the rim has to answer while the pointer is still on the circle, or
       „povlačenjem ivice krug se širi ili sužava" (owner, 23.08.2026) has nowhere
       to be done from. Resized about a middle that stands still, so the size
       changes and neither of the two positions does. */
    await halved()

    const box = picture()
    const spot = { across: 0.69, down: 0.5 }

    fireEvent.pointerMove(box, at(spot))

    expect(box.style.cursor, 'the pointer did not promise a pull').toBe('ew-resize')

    fireEvent.pointerDown(box, at(spot))
    fireEvent.pointerMove(box, at({ across: 0.59, down: 0.5 }))
    fireEvent.pointerUp(box, at({ across: 0.59, down: 0.5 }))

    /* Pulled a tenth of the box inwards, so the diameter loses twice that about a
       middle that stands still: a half becomes three tenths. */
    expect(sentCrop().size, 'the press moved instead of resizing').toBeCloseTo(0.3, 10)
    expect(sentCrop().x).toBeCloseTo(0.5, 10)
    expect(sentCrop().y).toBeCloseTo(0.5, 10)
  })
})

describe('a file the browser cannot read at all', () => {
  it('is refused, and nothing is offered over it', async () => {
    /* `accept="image/*"` lets through more than a browser can decode: a `.heic`
       straight off a telephone is the ordinary case and a truncated JPEG the
       other one. Nothing is measured then, so without an answer to that the
       member is left with no cropper, no message and a live send button, and
       pressing it really does put the file in front of a moderator.

       Measured by a review on 27.08.2026, in the flow: „alert: [], cropper open:
       false, send aria-disabled: false, sent through: true". */
    const user = setupUser()

    renderWithI18n(<Choosing />)

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())

    const measuring = await waitFor(() =>
      theMeasuringPicture(),
    )

    fireEvent.error(measuring)

    /* The words themselves, and not merely that something was said. Measured by a
       review on 28.08.2026: this answered a 4032 by 3024 photograph off an iPhone
       with „Slika je premala. Najkraća strana mora da ima bar 240 piksela", which
       is untrue of that file and asks for something that cannot help, and every
       following `.heic` said the same. A guard that only asks whether an alert
       exists cannot tell the two answers apart. */
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ova slika se ne može otvoriti. Izaberi drugu, na primer u JPG ili PNG obliku.',
    )
    expect(screen.queryByRole('group', { name: 'Isecanje slike' })).toBeNull()
    expect(sent()).toBe('nista')
  })
})

describe('the picture while it is being chosen', () => {
  it('is never taller than most of the screen', async () => {
    /* It takes every touch, so a picture taller than the window is a wall: on a
       360 by 640 telephone an ordinary portrait photograph drew a box 320 by 711
       with the send button 533 pixels below it, and the only way past was a strip
       of 40 pixels beside it (measured by a review, 27.08.2026).

       Both halves are written, because a height cap alone would leave the box a
       different shape from the picture, and the frame and the hole are drawn in
       percentages **of the box**: the circle would then sit over the wrong part
       of the photograph. */
    const user = setupUser()

    renderWithI18n(<Choosing />)

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())
    await measured(1080, 2400)

    /* The window keeps its own reading of the shape, off the picture it draws:
       the measurement above decides whether anything is offered at all, and this
       one decides what it looks like. Both are handed over, because jsdom decodes
       neither. */
    const whole = must(document.querySelector('.crop__whole'), 'the picture drawn')

    Object.defineProperty(whole, 'naturalWidth', { value: 1080, configurable: true })
    Object.defineProperty(whole, 'naturalHeight', { value: 2400, configurable: true })
    fireEvent.load(whole)

    const box = must(document.querySelector<HTMLElement>('.crop__picture'), 'the picture')

    expect(box).toHaveStyle({ maxBlockSize: '60svh' })
    /* The whole declaration and not a piece of it. Measured by a review on
       28.08.2026: with `min(` written as `max(` the piece is still there and the
       box stops being the shape of the picture, which is what the width is for.
       In a window 805 pixels high the box came out 320 by 483 against a picture
       of 1080 by 2400, so `object-fit: contain` left grey bands 51 pixels wide
       down each side and the circle was drawn as an ellipse across them. */
    expect(box.style.inlineSize).toBe('min(100%, calc(60svh * 1080 / 2400))')
    /* And centred, which is the third of the three and was measured by nothing:
       a box narrower than the panel with no margin sits against one edge. */
    expect(box.style.marginInline).toBe('auto')
  })
})

describe('the copy of the picture that is only there to be measured', () => {
  it('is never read out, and never counted as a picture on the page', async () => {
    /* It exists because the browser is the only one who can say how big a file
       turned out to be, and it is the second copy of a photograph the member is
       already looking at. Announced, it would be „slika" twice over with nothing
       to tell them apart, and any tally of images on the screen would be one out.

       Both halves are asserted because either alone is not enough: an empty `alt`
       keeps it out of a reader's picture list, and `aria-hidden` keeps it out of
       the tree entirely. It also has no class of its own to be found by, which is
       why the tests reach for it exactly the way this one does. */
    const user = setupUser()

    renderWithI18n(<Choosing />)

    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())

    /* Found by the one thing that is not being asserted, which is the class that
       puts it off the screen. Measured by a review on 28.08.2026: with the
       element looked for by `[aria-hidden="true"][alt=""]`, taking `aria-hidden`
       off failed in the helper saying the picture was not there, rather than on
       the assertion about it, and the third line passed regardless because an
       `<img alt="">` carries no `img` role to begin with. */
    const measuring = await waitFor(() =>
      must(document.querySelector('img.visually-hidden'), 'the picture being measured'),
    )

    expect(measuring).toHaveAttribute('aria-hidden', 'true')
    expect(measuring).toHaveAttribute('alt', '')
  })
})
