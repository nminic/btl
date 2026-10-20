import { createRef } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SYMBOL } from '../app/actionSymbol'
import { must } from '../test/at'
import { contrast } from '../test/contrast'
import { ruleFor, ruleInMedia, unremarked } from '../test/stylesheet'
import { ActionButton, ActionLink } from './ActionButton'

/**
 * A button that acts on one thing, drawn as a symbol (owner, 20.10.2026).
 *
 * The box with the word is found by its class and not by a role, because it has
 * none on purpose: it is hidden from the tree, since the button's name already
 * says the same word (ActionButton.tsx).
 */

const sheet = (path: string) => readFileSync(join(process.cwd(), 'src', path), 'utf-8')

function tip(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.action-tip')
}

function shown(): HTMLElement {
  return must(tip(), 'box with the word')
}

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * A focus the reader sees, whatever came before it in this file.
 *
 * jsdom does answer `:focus-visible` (the selector engine under it,
 * `@asamuzakjp/dom-selector`), and the first case of the keyboard below measures
 * it for real: Tab opens the box and a press of the pointer does not. But its
 * answer leans on the last focus it judged visible, which it keeps for the whole
 * document, so a later Tab in the same file can come back false after an earlier
 * case pressed something. Measured 20.10.2026: the same Tab gave true or false
 * depending only on the order of the cases. Where the kind of focus is not what a
 * case is about, it is said outright here instead of being left to that history.
 */
function aFocusTheReaderSees(element: HTMLElement) {
  const asked = Element.prototype.matches

  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (this: Element, selector: string) {
    return selector === ':focus-visible' ? this === document.activeElement : asked.call(this, selector)
  })
  act(() => {
    element.focus()
  })
}

describe('what a button that acts on one thing says', () => {
  it('is the word, carried as text beside a drawing a reader never meets', () => {
    render(<ActionButton symbol={SYMBOL.cross} word="Obriši" />)

    const button = screen.getByRole('button', { name: 'Obriši' })
    const drawing = must(button.querySelector('svg'), 'the drawing')

    /* The text of the button is the word it carried until now, so whatever found
       the button by its text finds it still. */
    expect(button.textContent).toBe('Obriši')
    expect(drawing.getAttribute('data-symbol')).toBe('cross')
    expect(drawing.getAttribute('aria-hidden')).toBe('true')
    expect(must(button.querySelector('span'), 'the word').className).toBe('visually-hidden')
    expect(button.getAttribute('type')).toBe('button')
  })

  it('is the whole name where the screen gives one, and the text is still the word', () => {
    render(<ActionButton symbol={SYMBOL.cross} word="Obriši" name="Obriši: Trka 1" />)

    const button = screen.getByRole('button', { name: 'Obriši: Trka 1' })

    expect(button.textContent).toBe('Obriši')
  })

  it('draws every symbol of the set, each under its own name', () => {
    const symbols = Object.values(SYMBOL)

    render(
      <>
        {symbols.map((one) => (
          <ActionButton key={one} symbol={one} word={one} />
        ))}
      </>,
    )

    expect(symbols).toHaveLength(11)

    for (const one of symbols) {
      const drawing = must(screen.getByRole('button', { name: one }).querySelector('svg'), one)

      expect(drawing.getAttribute('data-symbol')).toBe(one)
      expect(drawing.children.length, `${one} is drawn with something`).toBeGreaterThan(0)
    }

    /* And no two are drawn the same. */
    const drawings = symbols.map(
      (one) => must(screen.getByRole('button', { name: one }).querySelector('svg'), one).innerHTML,
    )

    expect(new Set(drawings).size).toBe(symbols.length)
  })
})

describe('how it is laid out', () => {
  it('wears the classes of the portal button and the square, and the filled look on asking', () => {
    render(
      <>
        <ActionButton symbol={SYMBOL.pencil} word="Izmeni" />
        <ActionButton symbol={SYMBOL.check} word="Odobri" tone="filled" className="queue__go" />
      </>,
    )

    expect(screen.getByRole('button', { name: 'Izmeni' }).className).toBe(
      'button button--secondary action',
    )
    expect(screen.getByRole('button', { name: 'Odobri' }).className).toBe(
      'button button--primary action queue__go',
    )
    /* THE JOIN with the sheet below: the size is written for `.button.action`, and
       the button is held to match that selector, so a class swept off one side
       fails here rather than leaving the rule painting nothing. */
    expect(screen.getByRole('button', { name: 'Izmeni' }).matches('.button.action')).toBe(true)
  })

  it('passes on what the screen hands it', async () => {
    const user = userEvent.setup()
    const pressed = vi.fn()
    const held = createRef<HTMLButtonElement>()

    render(
      <>
        <p id="why">Ne može dok čeka.</p>
        <ActionButton
          ref={held}
          symbol={SYMBOL.check}
          word="Odobri"
          aria-disabled="true"
          aria-describedby="why"
          onClick={pressed}
        />
      </>,
    )

    const button = screen.getByRole('button', { name: 'Odobri' })

    await user.click(button)

    expect(pressed).toHaveBeenCalledTimes(1)
    expect(held.current).toBe(button)
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(button).toHaveAccessibleDescription('Ne može dok čeka.')
  })

  it('is a square of two rem, never under the 24 pixels a finger is owed', () => {
    /* jsdom lays nothing out, so the size is held where it is written, as the
       stars are (styles/goldBand.test.ts, `.stars__pick`). */
    const rule = ruleFor(sheet('components/ActionButton.css'), '.button.action', 'ActionButton.css')

    expect(rule.getPropertyValue('inline-size')).toBe('2rem')
    expect(rule.getPropertyValue('block-size')).toBe('2rem')
    expect(rule.getPropertyValue('padding')).toBe('0px')
  })

  it('stands the box over the page, against the window', () => {
    const rule = ruleFor(sheet('components/ActionButton.css'), '.action-tip', 'ActionButton.css')

    expect(rule.getPropertyValue('position')).toBe('fixed')
  })

  it('never lets a pointer pass through the box', () => {
    /* `pointer-events: none` anywhere in this sheet is a box the pointer cannot
       be over, so it closes the moment the pointer leaves the button for it (WCAG
       2.2 SC 1.4.13, hoverable). jsdom does not apply it, so it is held here. */
    expect(unremarked(sheet('components/ActionButton.css'))).not.toMatch(/pointer-events/)
  })
})

describe('the colours it is drawn in', () => {
  const tokens = sheet('styles/tokens.css')
  const light = ruleFor(tokens, ':root', 'tokens.css')
  const themes = [
    { where: 'the light theme', style: light },
    {
      where: 'the dark theme, behind the media query',
      style: ruleInMedia(
        tokens,
        '(prefers-color-scheme: dark)',
        ":root:not([data-theme='light'])",
        'tokens.css',
      ),
    },
    {
      where: 'the dark theme, behind the switch',
      style: ruleFor(tokens, ":root[data-theme='dark']", 'tokens.css'),
    },
  ]

  /** A value down to its colour, in the theme first and in the light root after,
   *  since a dark theme only writes what it changes. */
  function colour(value: string, theme: CSSStyleDeclaration): string {
    const named = /^var\((--[\w-]+)\)$/.exec(value.trim())

    if (named === null) {
      expect(value, 'a colour written as #rrggbb').toMatch(/^#[0-9a-f]{6}$/i)

      return value.trim()
    }

    const name = must(named[1], 'the name of the property')
    const own = theme.getPropertyValue(name)

    return colour(own === '' ? light.getPropertyValue(name) : own, theme)
  }

  /** What a rule of a sheet paints with, read from the sheet that paints it. */
  function painted(path: string, selector: string, property: string): string {
    return ruleFor(sheet(path), selector, path).getPropertyValue(property)
  }

  it('puts the drawing at 3:1 against everything it stands on, in every theme', () => {
    const ink = painted('pages/Home.css', '.button--secondary', 'color')
    const filledInk = painted('pages/Home.css', '.button--primary', 'color')
    const filled = painted('pages/Home.css', '.button--primary', 'background')
    const filledHover = painted('pages/Home.css', '.button--primary:hover', 'background')

    for (const { where, style } of themes) {
      /* The square is see-through, so it stands on the page, on a card, or on
         its own hover. */
      for (const ground of ['var(--bg)', 'var(--surface)', 'var(--surface-hover)']) {
        expect(contrast(colour(ink, style), colour(ground, style)), `${ground} in ${where}`).toBeGreaterThanOrEqual(3)
      }

      for (const ground of [filled, filledHover]) {
        expect(
          contrast(colour(filledInk, style), colour(ground, style)),
          `filled on ${ground} in ${where}`,
        ).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('puts the word in the box at 4.5:1, in every theme', () => {
    const ink = painted('components/ActionButton.css', '.action-tip__words', 'color')
    const ground = painted('components/ActionButton.css', '.action-tip__words', 'background')

    for (const { where, style } of themes) {
      expect(contrast(colour(ink, style), colour(ground, style)), where).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('the box with the word', () => {
  it('opens under the pointer, with the word and not the whole name, drawn into the body', () => {
    render(<ActionButton symbol={SYMBOL.cross} word="Obriši" name="Obriši: Trka 1" />)

    const button = screen.getByRole('button', { name: 'Obriši: Trka 1' })

    expect(tip()).toBeNull()

    fireEvent.pointerOver(button, { pointerType: 'mouse' })

    expect(shown().textContent).toBe('Obriši')
    expect(shown().getAttribute('aria-hidden')).toBe('true')
    /* Into the body and not into the row: a box drawn inside a cell of a table
       that scrolls sideways is cut off by it. */
    expect(shown().parentElement).toBe(document.body)

    fireEvent.pointerOut(button, { pointerType: 'mouse', relatedTarget: document.body })

    expect(tip()).toBeNull()
  })

  it('opens on a keyboard reaching it, and not on a pointer pressing it', async () => {
    const user = userEvent.setup()

    render(
      <>
        <button type="button">Pre</button>
        <ActionButton symbol={SYMBOL.pencil} word="Izmeni" />
      </>,
    )

    const button = screen.getByRole('button', { name: 'Izmeni' })

    await user.tab()
    expect(tip()).toBeNull()

    await user.tab()
    expect(button).toHaveFocus()
    expect(shown().textContent).toBe('Izmeni')

    await user.tab({ shift: true })
    expect(tip()).toBeNull()

    /* Pressed with the pointer it takes the focus as well, and that focus is not
       one a reader sees: with the pointer gone, nothing holds the box. */
    await user.click(button)
    expect(button).toHaveFocus()
    fireEvent.pointerOut(button, { pointerType: 'mouse', relatedTarget: document.body })
    expect(tip()).toBeNull()
  })

  it('opens on a button that says it cannot act, on the pointer and on the keyboard', () => {
    /* The owner's answer of 20.10.2026: a control that cannot act still shows
       its word on the pointer and on the keyboard. */
    render(<ActionButton symbol={SYMBOL.check} word="Odobri" aria-disabled="true" />)

    const button = screen.getByRole('button', { name: 'Odobri' })

    fireEvent.pointerOver(button, { pointerType: 'mouse' })
    expect(shown().textContent).toBe('Odobri')

    fireEvent.pointerOut(button, { pointerType: 'mouse', relatedTarget: document.body })
    expect(tip()).toBeNull()

    aFocusTheReaderSees(button)
    expect(shown().textContent).toBe('Odobri')
  })

  it('does not open for a finger', () => {
    render(<ActionButton symbol={SYMBOL.cross} word="Obriši" />)

    fireEvent.pointerOver(screen.getByRole('button', { name: 'Obriši' }), { pointerType: 'touch' })

    expect(tip()).toBeNull()
  })

  it('is put away by Escape, which goes on to everything else that waits for it', async () => {
    const user = userEvent.setup()
    const heardAfter = vi.fn()

    document.addEventListener('keydown', heardAfter)

    try {
      render(<ActionButton symbol={SYMBOL.cross} word="Obriši" />)

      const button = screen.getByRole('button', { name: 'Obriši' })
      const drawing = must(button.querySelector('svg'), 'the drawing')

      aFocusTheReaderSees(button)
      expect(tip()).not.toBeNull()

      await user.keyboard('{Escape}')

      expect(tip()).toBeNull()
      expect(button).toHaveFocus()
      /* Not stopped: the calendar, the menus and the list of towns wait for the
         same Escape further along (forms/FieldHint.tsx). */
      expect(heardAfter).toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }))

      /* A pointer moving inside the button, over its drawing, is not a new
         arrival and does not bring back what Escape put away. */
      fireEvent.pointerOver(drawing, { pointerType: 'mouse', relatedTarget: button })
      expect(tip()).toBeNull()

      /* Leaving with nothing drawn, and coming back, does. */
      fireEvent.pointerOut(button, { pointerType: 'mouse', relatedTarget: document.body })
      fireEvent.pointerOver(button, { pointerType: 'mouse', relatedTarget: document.body })
      expect(tip()).not.toBeNull()

      /* Any other key leaves it. */
      await user.keyboard('a')
      expect(tip()).not.toBeNull()
    } finally {
      document.removeEventListener('keydown', heardAfter)
    }
  })

  it('is put away by a press anywhere but the button, the box itself included', () => {
    render(
      <>
        <p>Strana</p>
        <ActionButton symbol={SYMBOL.cross} word="Obriši" />
      </>,
    )

    const button = screen.getByRole('button', { name: 'Obriši' })

    fireEvent.pointerOver(button, { pointerType: 'mouse' })
    fireEvent.pointerDown(must(button.querySelector('svg'), 'the drawing'))
    expect(tip(), 'a press on the button is not a press elsewhere').not.toBeNull()

    fireEvent.pointerDown(screen.getByText('Strana'))
    expect(tip()).toBeNull()

    fireEvent.pointerOut(button, { pointerType: 'mouse', relatedTarget: document.body })
    fireEvent.pointerOver(button, { pointerType: 'mouse', relatedTarget: document.body })
    fireEvent.pointerDown(shown())
    expect(tip()).toBeNull()
  })

  it('holds open while the pointer travels into the words, and only for its own button', () => {
    render(
      <>
        <ActionButton symbol={SYMBOL.pencil} word="Izmeni" />
        <ActionButton symbol={SYMBOL.cross} word="Obriši" />
      </>,
    )

    const edit = screen.getByRole('button', { name: 'Izmeni' })
    const drop = screen.getByRole('button', { name: 'Obriši' })

    fireEvent.pointerOver(edit, { pointerType: 'mouse' })
    const box = shown()
    const words = must(box.firstElementChild, 'the words')

    fireEvent.pointerOut(edit, { pointerType: 'mouse', relatedTarget: box })
    fireEvent.pointerOver(box, { pointerType: 'mouse', relatedTarget: edit })
    expect(tip()).toBe(box)

    /* From the box into the words inside it, and back to the button. */
    fireEvent.pointerOut(box, { pointerType: 'mouse', relatedTarget: words })
    fireEvent.pointerOut(words, { pointerType: 'mouse', relatedTarget: edit })
    fireEvent.pointerOver(edit, { pointerType: 'mouse', relatedTarget: words })
    expect(tip()).toBe(box)

    fireEvent.pointerOut(edit, { pointerType: 'mouse', relatedTarget: box })

    /* Out of this box and into the neighbour: this one has nothing left holding
       it, and the neighbour opens its own. */
    fireEvent.pointerOut(box, { pointerType: 'mouse', relatedTarget: drop })
    fireEvent.pointerOver(drop, { pointerType: 'mouse', relatedTarget: box })

    const boxes = document.querySelectorAll('.action-tip')

    expect(boxes).toHaveLength(1)
    expect(must(boxes[0], 'the one box').textContent).toBe('Obriši')
  })

  it('lets go when the pointer leaves for the box of another button', () => {
    /* Two boxes can be open at once, one on the keyboard and one on the pointer.
       Asked about boxes in general, the pointer going from the second button into
       the first box was still "here", and the second box stayed with nothing
       holding it. */
    render(
      <>
        <ActionButton symbol={SYMBOL.pencil} word="Izmeni" />
        <ActionButton symbol={SYMBOL.cross} word="Obriši" />
      </>,
    )

    aFocusTheReaderSees(screen.getByRole('button', { name: 'Izmeni' }))
    const first = shown()
    const drop = screen.getByRole('button', { name: 'Obriši' })

    fireEvent.pointerOver(drop, { pointerType: 'mouse' })
    expect(document.querySelectorAll('.action-tip')).toHaveLength(2)

    fireEvent.pointerOut(drop, { pointerType: 'mouse', relatedTarget: first })

    expect([...document.querySelectorAll('.action-tip')].map((one) => one.textContent)).toEqual(['Izmeni'])
  })

  it('is not held open by a finger touching it', async () => {
    const user = userEvent.setup()

    render(
      <>
        <ActionButton symbol={SYMBOL.pencil} word="Izmeni" />
        <button type="button">Posle</button>
      </>,
    )

    aFocusTheReaderSees(screen.getByRole('button', { name: 'Izmeni' }))
    fireEvent.pointerOver(shown(), { pointerType: 'touch' })
    await user.tab()

    expect(tip()).toBeNull()
  })

  it('works the same on a link', () => {
    render(
      <MemoryRouter>
        <ActionLink symbol={SYMBOL.pencil} word="Izmeni" name="Izmeni: Tim 1" to="/sr/timovi/1" />
        <ActionLink symbol={SYMBOL.pencil} word="Izmeni" to="/sr/timovi/2" className="row__go" tone="filled" />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: 'Izmeni: Tim 1' })

    expect(link.getAttribute('href')).toBe('/sr/timovi/1')
    expect(link.textContent).toBe('Izmeni')
    expect(screen.getByRole('link', { name: 'Izmeni' }).className).toBe(
      'button button--primary action row__go',
    )

    fireEvent.pointerOver(link, { pointerType: 'mouse' })
    expect(shown().textContent).toBe('Izmeni')
  })
})

describe('where the box stands', () => {
  /** A window, a button and a box of the given sizes, as a browser would lay
   *  them out; jsdom lays out nothing. */
  function laidOut({
    room,
    button,
    box = { width: 60, height: 24 },
  }: {
    room: { across: number; down: number }
    button: { left: number; top: number }
    box?: { width: number; height: number }
  }) {
    const at = { ...button }

    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(room.across)
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(room.down)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      const isBox = this.classList.contains('action-tip')
      const [left, top, width, height] = isBox
        ? [0, 0, box.width, box.height]
        : [at.left, at.top, 32, 32]

      return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }
    })

    render(<ActionButton symbol={SYMBOL.cross} word="Obriši" />)
    fireEvent.pointerOver(screen.getByRole('button', { name: 'Obriši' }), { pointerType: 'mouse' })

    return {
      at,
      where: () => ({ top: shown().style.top, left: shown().style.left }),
    }
  }

  it('stands over the button, centred on it, where there is room above', () => {
    const { where } = laidOut({ room: { across: 360, down: 640 }, button: { left: 100, top: 200 } })

    expect(where()).toEqual({ top: '176px', left: '86px' })
    /* Never wider than the window, and written before it is measured. */
    expect(shown().style.maxInlineSize).toBe('344px')
  })

  it('stands under it where there is not', () => {
    const { where } = laidOut({ room: { across: 360, down: 640 }, button: { left: 100, top: 20 } })

    expect(where()).toEqual({ top: '52px', left: '86px' })
  })

  it.each([
    { edge: 'the right', room: { across: 360, down: 640 }, button: { left: 340, top: 200 }, left: '292px', top: '176px' },
    { edge: 'the left', room: { across: 360, down: 640 }, button: { left: 0, top: 200 }, left: '8px', top: '176px' },
    /* A window too short for either side: held inside it all the same. */
    { edge: 'the bottom', room: { across: 360, down: 40 }, button: { left: 100, top: 20 }, left: '86px', top: '8px' },
  ])('is held eight pixels inside the window at $edge edge', ({ room, button, left, top }) => {
    const { where } = laidOut({ room, button })

    expect(where()).toEqual({ top, left })
  })

  it('follows the button when the page scrolls or the window changes', () => {
    const { at, where } = laidOut({ room: { across: 360, down: 640 }, button: { left: 100, top: 200 } })

    at.top = 300
    fireEvent.scroll(document)
    expect(where().top).toBe('276px')

    at.left = 200
    fireEvent(window, new Event('resize'))
    expect(where().left).toBe('186px')
  })
})
