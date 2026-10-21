import { useEffect, useRef, useState, type ReactNode } from 'react'
import { outsideOf } from '../components/outsideOf'

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
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)

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
        onClick={() => setOpen((was) => !was)}
      >
        {trigger}
      </button>

      <div className={`${className}__panel`} id={id} hidden={!open}>
        {children(() => setOpen(false))}
      </div>
    </div>
  )
}
