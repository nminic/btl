import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { must } from '../test/at'
import { renderWithI18n } from '../test/render'
import { setupUser } from '../test/user'
import { CropChooser } from './CropChooser'
import type { Chosen } from './CropChooser'

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

const anImage = () => new File(['slika'], 'trka.jpg', { type: 'image/jpeg' })

/** The picture and its sliders, once the browser has read the file off the
 *  disc. Waited for rather than assumed: reading is a tick later than the
 *  choosing, and everything here happens after it. */
const cropper = async () => within(await screen.findByRole('group', { name: 'Isecanje slike' }))

const sent = () => must(screen.getByTestId('sent').textContent, 'what would be sent')

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
    const frame = must(container.querySelector('.crop__frame'), 'the lit square')

    expect(whole).toHaveAttribute('alt', 'Slika koju si izabrao')
    expect(whole).toHaveAttribute('src', expect.stringContaining('data:image/jpeg'))
    expect(frame).toHaveTextContent(/Ostatak je zatamnjen/)
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
