import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { outsideOf } from '../components/outsideOf'

/* WHAT A PANEL HAD WHEN THE HEADER IS DRAWN AGAIN IN THE OTHER SHAPE (PENDING, review of PR 755, 17.11.2026:
 * „pri promeni širine preko 700 px u hodu (rotacija telefona) fokus pada na BODY, a otvoren panel naloga se
 * zatvara"). The envelope and the picture stand after the words on a telephone and after the language on a
 * desktop, two orders of the document and not one moved by a stylesheet (`app/phoneHeader.ts`), so turning the
 * window across 700px takes the old panel down and draws a new one somewhere else, and a reader who had it open,
 * or had the focus on it, met a page that had forgotten both.
 *
 * Said by the panel itself and kept here, in one home, by the id the two shapes give it: whether it is open, which
 * every instance writes as it changes, and where the focus was, which the one that goes writes as it goes. How often
 * it was opened is not kept: what a panel holds asks again when it is drawn, which a redraw is. The one drawn in its place takes both before it is painted. It is read while it is being
 * DRAWN, which is before the old one is taken down, so what is kept is deleted only when the old one goes, and
 * nobody who signs out inherits an open panel: nothing is left to read once the header is gone.
 *
 * Where the focus was is a position, not an element: the button, or the n-th control inside the panel. */
const keptOpenness = new Map<string, boolean>()
const keptFocus = new Map<string, 'button' | number>()

/* One panel that opens under a button, used by the navigation groups, the
 * account picture and the inbox. Written once because closing on a click
 * outside and on Escape is exactly the part that gets forgotten when the same
 * behaviour is typed out three times.
 *
 * This is a disclosure, not a menu widget: the panel holds ordinary links, and
 * a screen reader announces them as links, which is what they are. */
export function Dropdown({
  id,
  label,
  className,
  trigger,
  children,
}: {
  id: string
  label: string
  className: string
  trigger: ReactNode
  /**
   * What the panel holds, given the way to shut it and HOW MANY TIMES IT HAS BEEN OPENED. The panel is
   * drawn while it is shut as well, so what it holds stays mounted for the whole visit; the count is how
   * something in it that has to be asked again asks it each time a reader opens it (`AccountMenu.tsx`).
   */
  children: (close: () => void, opens: number) => ReactNode
}) {
  const [open, setOpen] = useState(() => keptOpenness.get(id) ?? false)
  const [opens, setOpens] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    keptOpenness.set(id, open)
  }, [id, open])

  useLayoutEffect(() => {
    const theButton = button.current
    const thePanel = panel.current
    const controls = () => {
      const found: HTMLElement[] = []

      thePanel?.querySelectorAll<HTMLElement>('a, button').forEach((one) => found.push(one))

      return found
    }
    const to = keptFocus.get(id)

    keptFocus.delete(id)

    if (to === 'button') {
      theButton?.focus()
    } else if (to !== undefined) {
      controls()[to]?.focus()
    }

    return () => {
      keptOpenness.delete(id)

      const now = document.activeElement

      if (theButton?.contains(now)) {
        keptFocus.set(id, 'button')
      } else if (thePanel?.contains(now)) {
        keptFocus.set(id, controls().findIndex((one) => one === now))
      }

      /* Taken by the panel that replaces this one within the same commit, and by nobody when the header is
         gone (somebody signed out), in which case it must not wait for the next reader to sign in. */
      queueMicrotask(() => keptFocus.delete(id))
    }
    /* Once, for the life of this instance: `id` is a constant of the caller. */
  }, [id])

  useEffect(() => {
    if (!open) {
      return
    }

    function onPointerDown(event: MouseEvent) {
      if (outsideOf(box.current, event)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        /* Escape has to put the focus back on the button that opened the panel.
         * The panel it was in has just been hidden, so without this the focus
         * falls to the body and the next Tab starts the page from the top. */
        button.current?.focus()
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div
      className={open ? `${className} is-open` : className}
      ref={box}
      /* Shut when the focus goes somewhere outside the box. Escape and a press elsewhere
         were the only ways out, so Tab past the last link, or Shift+Tab off the button,
         left the panel open over whatever the focus had gone to (WCAG 2.2 SC 2.4.11).
         The whole box is the question, the panel included, so Tab from one link to the
         next is not leaving. The shape is the one `forms/Suggesting.tsx` uses for its list.
         `relatedTarget` is where the focus is going. It is null when it goes nowhere an
         element can be named: a press on text inside the panel, which cannot take focus,
         blurs the button that opened it with a null `relatedTarget`, and the window losing
         the focus does the same. Neither is the reader leaving the box, and a press outside
         is the mousedown listener's. So null leaves it open. The focus is never put back:
         it went where the reader sent it. */
      onBlur={(event) => {
        const to = event.relatedTarget

        if (to !== null && !event.currentTarget.contains(to)) {
          setOpen(false)
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className={`${className}__btn`}
        /* No aria-haspopup: it announces a menu widget, and what opens here is a
         * panel of ordinary links. aria-expanded and aria-controls say all there
         * is to say about a disclosure. */
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => {
          if (!open) {
            setOpens((times) => times + 1)
          }

          setOpen(!open)
        }}
      >
        {trigger}
      </button>

      <div className={`${className}__panel`} id={id} hidden={!open} ref={panel}>
        {children(() => setOpen(false), opens)}
      </div>
    </div>
  )
}
