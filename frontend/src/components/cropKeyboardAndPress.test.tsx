import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { must } from '../test/at'
import { theMeasuringPicture } from '../test/picture'
import { renderWithI18n } from '../test/render'
import { setupUser } from '../test/user'
import { CropChooser } from './CropChooser'
import type { Chosen } from './CropChooser'
import type { Crop } from '../data/types'

/**
 * TWO THINGS OF THE KEYBOARD AND THE MOUSE ON THE SLIDERS OF A CIRCLE (owner, 24.11.2026, PDL „Sitnice iz recenzije
 * PR-a 815 i 811 i panela tima"): „klik mišem posle tastature ne sme da se izgubi (dugme ne skače)" and „taster End na
 * klizaču veličine daje celu sliku".
 *
 * <p>jsdom lays nothing out (ADL A18), so a button that JUMPS is not what is measured here: what is asked is the
 * thing that makes it jump, which is the strip of sliders being folded away at the button-down. The strip is folded by
 * the stylesheet where nothing in the group has focus and the class `crop--held` is not on it (`Crop.css`), so the
 * class is what is read, and the stylesheet's half is held by `cropStyle.test.ts`.
 */

function Choosing() {
  const [chosen, setChosen] = useState<Chosen | null>(null)

  return (
    <>
      <CropChooser id="proba" label="Izaberi sliku" alt="Slika koju si izabrao" chosen={chosen} onChange={setChosen} />
      <button type="button">Sačuvaj</button>
      <p data-testid="sent">{chosen === null ? 'nista' : JSON.stringify(chosen.crop)}</p>
    </>
  )
}

const anImage = () => new File(['slika'], 'trka.jpg', { type: 'image/jpeg' })

/** The cropper, once the browser has said how big the file is. 1125 wide, so the floor of the size slider is 240 / 1125:
 *  not a round number, and the one a step of a hundredth cannot reach the end from. */
async function opened(width = 1125, height = 1125) {
  const measuring = await waitFor(() => theMeasuringPicture())

  Object.defineProperty(measuring, 'naturalWidth', { value: width, configurable: true })
  Object.defineProperty(measuring, 'naturalHeight', { value: height, configurable: true })
  fireEvent.load(measuring)

  return within(await screen.findByRole('group', { name: 'Isecanje slike' }))
}

const sentCrop = (): Crop => JSON.parse(must(screen.getByTestId('sent').textContent, 'what would be sent'))

/** The box the sliders are folded or kept by, which is the first thing inside the group. */
const theBox = () =>
  must(screen.getByRole('group', { name: 'Isecanje slike' }).firstElementChild, 'the box of the circle')

describe('the key End on a slider', () => {
  it('gives the whole picture on the size slider, whose floor is not a round number', async () => {
    const user = setupUser()

    renderWithI18n(<Choosing />)
    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())

    const size = (await opened()).getByLabelText('Veličina isečka')

    /* THE STEP DOES NOT REACH THE END FROM THIS FLOOR, which is what makes this measure something: from 0,2133 in
       steps of a hundredth the last value is 0,9933, and a browser that is only asked for the end of the range stops
       there (the 99 % the owner saw). jsdom steps nothing, so it is the control that has to say it. */
    expect(Number(size.getAttribute('min'))).toBeCloseTo(240 / 1125, 5)
    expect((1 - Number(size.getAttribute('min'))) / 0.01 % 1, 'the floor is on the step, so this measures nothing').not.toBeCloseTo(0, 3)

    fireEvent.change(size, { target: { value: '0.5' } })
    expect(sentCrop().size).toBe(0.5)

    size.focus()
    /* `fireEvent` answers whether the default was left standing: it is not, because the browser's own step would
       otherwise come after ours and land on the value below the end. */
    expect(fireEvent.keyDown(size, { key: 'End' })).toBe(false)

    expect(sentCrop().size, 'End gave something other than the whole').toBe(1)
  })

  it('gives the end of each of the two others the same way, and leaves the position it does not move alone', async () => {
    const user = setupUser()

    renderWithI18n(<Choosing />)
    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())

    const crop = await opened()

    fireEvent.change(crop.getByLabelText('Pomeri levo i desno'), { target: { value: '0.1' } })
    fireEvent.change(crop.getByLabelText('Pomeri gore i dole'), { target: { value: '0.2' } })
    fireEvent.keyDown(crop.getByLabelText('Pomeri levo i desno'), { key: 'End' })

    expect(sentCrop()).toEqual({ x: 1, y: 0.2, size: 1 })
  })

  it('leaves every other key to the slider itself', async () => {
    const user = setupUser()

    renderWithI18n(<Choosing />)
    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())

    const size = (await opened()).getByLabelText('Veličina isečka')

    fireEvent.change(size, { target: { value: '0.5' } })

    for (const key of ['Home', 'ArrowRight', 'PageUp', 'Enter']) {
      expect(fireEvent.keyDown(size, { key }), key).toBe(true)
    }

    expect(sentCrop().size).toBe(0.5)
  })
})

describe('a press that takes the focus off a slider', () => {
  it('keeps the sliders where they are until it is over, so the click is not lost', async () => {
    const user = setupUser()

    renderWithI18n(<Choosing />)
    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())

    const crop = await opened()

    crop.getByLabelText('Pomeri levo i desno').focus()
    expect(theBox()).not.toHaveClass('crop--held')

    /* THE MOUSE DOWN ON THE BUTTON, in the order a browser does it: the press, then the focus leaves. */
    const button = screen.getByRole('button', { name: 'Sačuvaj' })

    fireEvent.pointerDown(button)
    act(() => {
      button.focus()
    })
    expect(theBox(), 'the strip folded at the button-down, and the button went up under the pointer').toHaveClass(
      'crop--held',
    )

    /* AND LET GO OF A MOMENT AFTER THE RELEASE, which is after the click was delivered. */
    fireEvent.pointerUp(button)
    expect(theBox(), 'let go in the very turn of the release, before the click was dispatched').toHaveClass('crop--held')
    await waitFor(() => expect(theBox()).not.toHaveClass('crop--held'))
  })

  it('is kept for a finger, whose focus moves after the release and not before it', async () => {
    /* Owner, 24.11.2026, the second decision. A touch is `pointerdown`, `pointerup`, and THEN the mouse events the
       browser imitates, the focus leaving the slider with the imitated mouse-down. A press that ended at
       `pointerup` is over by then and the strip is not kept: measured by a review on a card of verification at 360px,
       the button went from y 459,9 to 422,5 and no tap of two reached it. */
    const user = setupUser()

    renderWithI18n(<Choosing />)
    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())
    ;(await opened()).getByLabelText('Veličina isečka').focus()

    const button = screen.getByRole('button', { name: 'Sačuvaj' })

    fireEvent.pointerDown(button)
    fireEvent.pointerUp(button)
    /* A turn of the loop between the release and the focus, as a browser has (independent review of PR 825, round 2,
       24.11.2026): the focus of a finger does not arrive in the very call of the release, so a delay of nothing
       before the press is let go of passes a case that has no such turn. */
    await new Promise((resolve) => setTimeout(resolve, 20))
    act(() => {
      button.focus()
    })
    expect(theBox(), 'the focus came after the release and the strip was not kept').toHaveClass('crop--held')
    await waitFor(() => expect(theBox()).not.toHaveClass('crop--held'))
  })

  /* The two `clearTimeout`s of the press (independent review of PR 825, round 2, 24.11.2026, low B): a second press
     inside the room of the first must not be let go of by the first one's timer, and a second end must not be cut
     short by it either. Held by what the reader of the page sees, the strip still kept when the old timer has run. */
  it('is not let go of by the timer of an earlier release while another press is down', async () => {
    const user = setupUser()

    renderWithI18n(<Choosing />)
    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())
    ;(await opened()).getByLabelText('Veličina isečka').focus()

    const button = screen.getByRole('button', { name: 'Sačuvaj' })

    fireEvent.pointerDown(button)
    fireEvent.pointerUp(button)
    await new Promise((resolve) => setTimeout(resolve, 150))
    fireEvent.pointerDown(button)
    /* Past 300 ms from the FIRST release, inside the second press. */
    await new Promise((resolve) => setTimeout(resolve, 250))
    act(() => {
      button.focus()
    })
    expect(theBox(), 'the timer of the first release let go of the second press').toHaveClass('crop--held')
    fireEvent.pointerUp(button)
    await waitFor(() => expect(theBox()).not.toHaveClass('crop--held'))
  })

  it('is not let go of early by the timer of a first end when a second end follows it', async () => {
    const user = setupUser()

    renderWithI18n(<Choosing />)
    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())
    ;(await opened()).getByLabelText('Veličina isečka').focus()

    const button = screen.getByRole('button', { name: 'Sačuvaj' })

    fireEvent.pointerDown(button)
    fireEvent.pointerUp(button)
    await new Promise((resolve) => setTimeout(resolve, 150))
    fireEvent.pointerCancel(button)
    /* 400 ms from the first end and 250 from the second: only the second one's timer is still running. */
    await new Promise((resolve) => setTimeout(resolve, 250))
    act(() => {
      button.focus()
    })
    expect(theBox(), 'the first end cut short the room of the second').toHaveClass('crop--held')
    await waitFor(() => expect(theBox()).not.toHaveClass('crop--held'))
  })

  it('takes its timer away with it when the window is gone', async () => {
    const user = setupUser()
    const cleared = vi.spyOn(globalThis, 'clearTimeout')

    const { unmount } = renderWithI18n(<Choosing />)
    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())
    await opened()

    const button = screen.getByRole('button', { name: 'Sačuvaj' })

    fireEvent.pointerDown(button)
    fireEvent.pointerUp(button)

    const before = cleared.mock.calls.length

    unmount()

    /* The cleanup of the effect asks for the timer it left running to be cleared; a timer left running past the
       window would fold a strip that is not there. */
    expect(cleared.mock.calls.length).toBeGreaterThan(before)
    cleared.mockRestore()
  })

  it('is let go of by a press that is taken away, as by one that ends', async () => {
    const user = setupUser()

    renderWithI18n(<Choosing />)
    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())
    ;(await opened()).getByLabelText('Veličina isečka').focus()

    const button = screen.getByRole('button', { name: 'Sačuvaj' })

    fireEvent.pointerDown(button)
    act(() => {
      button.focus()
    })
    expect(theBox()).toHaveClass('crop--held')

    fireEvent.pointerCancel(button)
    await waitFor(() => expect(theBox()).not.toHaveClass('crop--held'))
  })

  it('does not hold the sliders for a keyboard that tabs away, where no click is waiting', async () => {
    const user = setupUser()

    renderWithI18n(<Choosing />)
    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())

    const size = (await opened()).getByLabelText('Veličina isečka')

    size.focus()
    await user.tab()

    expect(screen.getByRole('button', { name: 'Sačuvaj' })).toHaveFocus()
    expect(theBox()).not.toHaveClass('crop--held')
  })

  it('does not hold them for a press that only moves the focus from one slider to another', async () => {
    const user = setupUser()

    renderWithI18n(<Choosing />)
    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())

    const crop = await opened()
    const across = crop.getByLabelText('Pomeri levo i desno')
    const down = crop.getByLabelText('Pomeri gore i dole')

    across.focus()
    fireEvent.pointerDown(down)
    act(() => {
      down.focus()
    })

    expect(theBox(), 'the focus never left the group, so nothing is folding').not.toHaveClass('crop--held')
    fireEvent.pointerUp(down)
  })

  it('holds them for a press on the picture itself, which takes the focus to nothing', async () => {
    const user = setupUser()

    renderWithI18n(<Choosing />)
    await user.upload(screen.getByLabelText(/Izaberi sliku/), anImage())

    const crop = await opened()
    const across = crop.getByLabelText('Pomeri levo i desno')

    across.focus()
    fireEvent.pointerDown(crop.getByRole('img', { name: 'Slika koju si izabrao' }))
    act(() => {
      across.blur()
    })

    expect(theBox()).toHaveClass('crop--held')
    fireEvent.pointerUp(crop.getByRole('img', { name: 'Slika koju si izabrao' }))
    await waitFor(() => expect(theBox()).not.toHaveClass('crop--held'))
  })
})
