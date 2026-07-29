import { useEffect, useRef, useState, type ReactNode } from 'react'

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

  useEffect(() => {
    if (!open) {
      return
    }

    function onPointerDown(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
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
    <div className={open ? `${className} is-open` : className} ref={box}>
      <button
        type="button"
        className={`${className}__btn`}
        aria-haspopup="true"
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
