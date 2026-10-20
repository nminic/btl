import {
  useEffect,
  useLayoutEffect,
  useState,
  type ComponentProps,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import type { ActionSymbol } from '../app/actionSymbol'
import { ActionSymbolIcon } from '../app/icons'
import './ActionButton.css'

/**
 * A BUTTON THAT ACTS ON ONE THING, DRAWN AS A SYMBOL RATHER THAN A WORD (owner,
 * 20.10.2026: „Potrebno je da se uštedi prostor i da deluje modernije").
 *
 * What changes is what a sighted reader sees, and nothing else:
 *
 * - **The name is the one the button had.** `name` when the screen gives one (a
 *   column of these is one control said many times over, so a screen names each by
 *   its row, WCAG 2.2 SC 2.4.4), and otherwise the word itself, which stays in the
 *   button as text clipped to a pixel (`visually-hidden`, index.css). The text of
 *   the button is therefore the word it carried before, so whatever finds the
 *   button by its text, a reader's list of controls or a test, finds the same
 *   thing. The drawing is hidden from the tree: the symbol is something to look
 *   at, and a reader is given the word.
 * - **The word is shown in a small box on the pointer and on the keyboard**, not
 *   in the button (owner's choice the same day: a tooltip on hover and on focus,
 *   the screen reader saying the same word). On a telephone there is none, since
 *   nothing hovers there; the symbol and the name for a screen reader stay.
 *
 * The box answers WCAG 2.2 SC 1.4.13 the way `forms/FieldHint.tsx` does, and the
 * reasons are written there at length: the pointer and the keyboard are two
 * reasons to hold it open, counted apart; Escape puts it away without moving
 * either and is heard on the document and not stopped there; a press anywhere but
 * on the button puts it away; and the pointer can travel from the button into the
 * box without the box closing under it.
 *
 * **Where it differs from FieldHint, and why.** The words of a hint are read
 * through `aria-describedby`, so they stay in the document. These are not: the
 * name already says them, so the box is `aria-hidden` and is drawn only while it
 * is open. And it is drawn into `document.body` and placed against the window
 * (`position: fixed`), not inside the button's row: these buttons stand in cells
 * of tables whose box scrolls sideways, and a box drawn inside one is cut off by
 * it (`forms/DatePicker.tsx` measured exactly that on 23.08.2026).
 *
 * **Opened by the keyboard only when the focus is the kind a reader sees**
 * (`:focus-visible`). A button pressed with the pointer also takes the focus, and
 * a box opening on that would answer the pointer twice.
 *
 * **The button keeps the look it had, and only its shape changes.** `className` is
 * that look, the classes the button wore before it became a symbol: `entity-open`
 * in a row of administration, `button button--primary` for „Odobri", which keeps its
 * filled look (PDL 20.10.2026), `copyLink` for the copy button. Left out, it is the
 * portal's ordinary `button button--secondary`. So colours, the hover and the look
 * of a control that says it cannot act stay where they were written and are not
 * copied here; `action`, which is always added, only makes it a square
 * (ActionButton.css).
 */

type Says = {
  /** What is drawn in place of the word, one of the closed set in `app/actionSymbol.ts`,
   *  named through `SYMBOL` and never by a string of the screen's own. */
  symbol: ActionSymbol
  /** The word the button carried until now, already in the reader's language:
   *  the text of the button, and what the box shows. */
  word: string
  /** The whole name, where the screen names the button by more than the word
   *  („Obriši: Trka 1"). Left out, the word is the name. */
  name?: string
}

/** What this component answers itself and so does not take from the screen. */
type Answered = 'children' | 'aria-label' | 'onFocus' | 'onBlur' | 'onPointerOver' | 'onPointerOut'

/** How far from the edge of the window the box is held, as `forms/DatePicker.tsx`
 *  holds its calendar. */
const EDGE = 8

export function ActionButton({
  symbol,
  word,
  name,
  className,
  ...rest
}: Says & Omit<ComponentProps<'button'>, Answered | 'type'>) {
  const { held, tip } = useTip(word)

  return (
    <>
      <button
        {...rest}
        type="button"
        className={look(className)}
        aria-label={name}
        {...held}
      >
        <Face symbol={symbol} word={word} />
      </button>
      {tip}
    </>
  )
}

/** The same, for an action that is a link to another screen (the pencil that
 *  opens a record's own page). */
export function ActionLink({
  symbol,
  word,
  name,
  className,
  ...rest
}: Says & Omit<ComponentProps<typeof Link>, Answered>) {
  const { held, tip } = useTip(word)

  return (
    <>
      <Link {...rest} className={look(className)} aria-label={name} {...held}>
        <Face symbol={symbol} word={word} />
      </Link>
      {tip}
    </>
  )
}

/** The look the button had, and the square. */
function look(className: string | undefined): string {
  return `${className ?? 'button button--secondary'} action`
}

function Face({ symbol, word }: { symbol: ActionSymbol; word: string }) {
  return (
    <>
      <ActionSymbolIcon of={symbol} className="action__symbol" />
      <span className="visually-hidden">{word}</span>
    </>
  )
}

/**
 * The box and the two things that hold it open.
 *
 * Each reason is held as the element it arrived on rather than as a flag, so the
 * box is always placed against something that is really there: the button the
 * pointer is over, or the one the keyboard is on. With nothing held, nothing is
 * drawn.
 */
function useTip(word: string): {
  held: {
    onPointerOver: (coming: PointerEvent<HTMLElement>) => void
    onPointerOut: (going: PointerEvent<HTMLElement>) => void
    onFocus: (arrived: FocusEvent<HTMLElement>) => void
    onBlur: () => void
  }
  tip: ReactNode
} {
  const [hovered, setHovered] = useState<HTMLElement | null>(null)
  const [focused, setFocused] = useState<HTMLElement | null>(null)
  /* Put away by Escape or by a press elsewhere, and only until it is asked for
     again (forms/FieldHint.tsx). */
  const [dismissed, setDismissed] = useState(false)
  /* The box itself, once it is drawn, so the pointer can be asked whether it
     went into THIS box and not into any. */
  const [drawn, setDrawn] = useState<HTMLElement | null>(null)
  const anchor = dismissed ? null : (hovered ?? focused)

  useEffect(() => {
    if (anchor === null) {
      return
    }

    const on = anchor

    /* On the document and on the way down, so every box hears it, and NOT
       stopped: the calendar, the menus in the header and the list of towns wait
       for the same Escape further along (forms/FieldHint.tsx says why). */
    function onKeyDown(pressed: KeyboardEvent) {
      if (pressed.key === 'Escape') {
        setDismissed(true)
      }
    }

    /* Anywhere but the button. A press on the box puts it away too: the box is
       words and holds nothing to press, and it may stand over a control that a
       press was meant for. */
    function onPress(pressed: globalThis.PointerEvent) {
      if (!(pressed.target instanceof Node && on.contains(pressed.target))) {
        setDismissed(true)
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPress, true)

    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPress, true)
    }
  }, [anchor])

  /** Whether the pointer went somewhere that is still this button or this box. */
  function stillHere(going: EventTarget | null, from: HTMLElement): boolean {
    return going instanceof Node && (from.contains(going) || drawn?.contains(going) === true)
  }

  return {
    held: {
      onPointerOver(coming) {
        /* A finger hovers nothing: what reaches the button from a touch is the
           press itself, and a box opening on it would stand over the page until
           the next press somewhere else. */
        if (coming.pointerType === 'touch') {
          return
        }

        /* And what Escape put away comes back only on a new arrival, not on the
           pointer moving inside the button over the drawing in it. */
        if (!stillHere(coming.relatedTarget, coming.currentTarget)) {
          setDismissed(false)
        }

        setHovered(coming.currentTarget)
      },
      onPointerOut(going) {
        if (!stillHere(going.relatedTarget, going.currentTarget)) {
          setHovered(null)
        }
      },
      onFocus(arrived) {
        setDismissed(false)

        if (arrived.currentTarget.matches(':focus-visible')) {
          setFocused(arrived.currentTarget)
        }
      },
      onBlur() {
        setFocused(null)
      },
    },
    tip:
      anchor === null ? null : (
        <Tip
          anchor={anchor}
          word={word}
          drawn={drawn}
          draw={setDrawn}
          hold={() => setHovered(anchor)}
          release={() => setHovered(null)}
        />
      ),
  }
}

/**
 * The box, drawn into `document.body` and placed against the window.
 *
 * Over the button where there is room above it and under it otherwise, centred
 * on it, and then held `EDGE` pixels inside the window whatever came of that, as
 * the calendar is (`forms/DatePicker.tsx`): `fixed` does not move with the page, so
 * a box hanging past an edge cannot be scrolled to. Placed again when the page
 * scrolls or the window changes size, since a box held open by the keyboard
 * stays open through both.
 */
function Tip({
  anchor,
  word,
  drawn,
  draw,
  hold,
  release,
}: {
  anchor: HTMLElement
  word: string
  drawn: HTMLElement | null
  draw: (box: HTMLElement | null) => void
  hold: () => void
  release: () => void
}) {
  useLayoutEffect(() => {
    /* The first pass after the box is drawn comes before the box has been handed
       up; the second one places it, still before anything is painted. */
    if (drawn === null) {
      return
    }

    const box = drawn

    function place() {
      /* The window as the reader sees it, without the scrollbar
         (forms/DatePicker.tsx, measured 23.08.2026). */
      const across = document.documentElement.clientWidth
      const down = document.documentElement.clientHeight

      /* Never wider than the window, written before the box is measured so that
         what is measured is the box as it will be drawn. */
      box.style.maxInlineSize = `${String(across - 2 * EDGE)}px`

      const at = anchor.getBoundingClientRect()
      const its = box.getBoundingClientRect()
      const above = at.top - its.height >= EDGE
      const wanted = above ? at.top - its.height : at.bottom
      const top = Math.max(EDGE, Math.min(wanted, down - its.height - EDGE))
      const left = Math.max(EDGE, Math.min(at.left + (at.width - its.width) / 2, across - its.width - EDGE))

      box.style.top = `${String(top)}px`
      box.style.left = `${String(left)}px`
    }

    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)

    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [anchor, drawn, word])

  /** Whether the pointer left the box for the button or for somewhere inside it. */
  function stillHere(going: EventTarget | null, box: HTMLElement): boolean {
    return going instanceof Node && (anchor.contains(going) || box.contains(going))
  }

  return createPortal(
    /* Hidden from the tree: the button's name already says these words, and said
       twice they would be said once too often. */
    <span
      className="action-tip"
      aria-hidden="true"
      ref={draw}
      /* Held open under the pointer, so the words can be read to the end (SC
         1.4.13, hoverable). */
      onPointerOver={(coming) => {
        if (coming.pointerType !== 'touch') {
          hold()
        }
      }}
      onPointerOut={(going) => {
        if (!stillHere(going.relatedTarget, going.currentTarget)) {
          release()
        }
      }}
    >
      {/* The word is drawn by the sheet out of this attribute and is not text in
          the document: the button already holds the same word as its text, and a
          second copy in the body is a second thing every search by text finds
          while the pointer happens to rest on the button. */}
      <span className="action-tip__words" data-word={word} />
    </span>,
    document.body,
  )
}
