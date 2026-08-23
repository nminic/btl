import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { outsideOf } from '../components/outsideOf'
import { useToday } from '../clock/useClock'
import { monthGrid, monthNumbers, shiftMonth } from '../data/derive'
import { formatMonth } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import { maskDate, parseDate } from './dateField'
import './DatePicker.css'

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

/** Which month to open on: the one in the field, or the one it is now. */
function monthOf(value: string, today: string): string {
  const parsed = parseDate(value)

  if (parsed === null) {
    return today.slice(0, 7)
  }

  return `${parsed.getUTCFullYear()}-${String(parsed.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * A date is typed as dd/mm/gggg, and can also be picked out of a month.
 *
 * Typing stays the main way in, because a date of birth is forty years back and
 * nobody wants to click through four hundred months to reach it. The calendar
 * is for dates near today, which is what a race date usually is.
 *
 * The native date input is not used: it follows the browser's locale, so an
 * English browser shows mm/dd/yyyy and 04/03 means two different days to two
 * members.
 */
export function DatePicker({
  id,
  name,
  value,
  invalid,
  required,
  describedBy,
  onChange,
  openAt = false,
  locked = false,
  label,
}: {
  id: string
  name: string
  value: string
  invalid: boolean
  /** Whether the form asks for this one. Read out on the box, since the star
      beside the name is drawn for the eye alone (FormRenderer.tsx). */
  required?: boolean
  describedBy: string | undefined
  onChange: (value: string) => void
  /** Whether the cursor starts in the box. The one caller that asks is a copied
   *  event, whose date is the one thing certainly wrong (FormRenderer). */
  openAt?: boolean
  /** Whether the date came off a record rather than from this reader, in which
   *  case neither the box nor the calendar takes anything (FormRenderer.tsx). */
  locked?: boolean
  /**
   * What to call this box, where nothing else does.
   *
   * A field of a form is named by its label and needs nothing here. A cell of a
   * table has no label: the column heading names the column and a screen reader
   * reads it with the cell, but the box inside the cell is unnamed, and twenty of
   * them are twenty controls nothing tells apart (admin/EventRaces.tsx).
   */
  label?: string
}) {
  const { locale, t } = useI18n()
  const today = useToday()
  const [open, setOpen] = useState(false)
  /* The calendar itself, so it can be placed once it is drawn and its height is
     known. */
  const pop = useRef<HTMLDivElement | null>(null)

  /**
   * Where the calendar stands: against the window, under the box or over it.
   *
   * Against the window and not inside the field, because a calendar drawn inside
   * its own field is cut off by whatever scrolls around that field. Since
   * 23.08.2026 one of them stands in a cell of a table whose box scrolls sideways,
   * and `overflow-x: auto` makes the other axis `auto` too by the rule of the
   * property itself: measured that day, 20 pixels of 245 were left of it.
   *
   * Placed after it is drawn rather than while it is: the side it goes on depends
   * on how tall it came out, and pressing the button may itself move the page, so a
   * measurement taken before the draw is a measurement of where things used to be.
   *
   * Nothing follows it afterwards. The calendar closes on a choice, on Escape and
   * on the way out, so there is no state in which it is open and the page has moved
   * under it.
   */
  useLayoutEffect(() => {
    const drawn = pop.current
    const field = box.current

    if (drawn === null || field === null) {
      return
    }

    const at = field.getBoundingClientRect()
    /* The window as the reader sees it, which is not `window.innerWidth`: that
       counts the scrollbar, and a sheet placed against it sits under the bar by
       whatever the bar is wide. Measured 23.08.2026 on this machine, 19px. */
    const room = {
      across: document.documentElement.clientWidth,
      down: document.documentElement.clientHeight,
    }
    /* Never wider than that, whatever the letters are: seven columns of `2rem` are
       448px of grid at 200% text, and the columns give way under a cap
       (`.datepicker__grid`). Written before the box is measured, so what is
       measured is the box as it will be drawn. A `fixed` box that hangs over the
       edge cannot be scrolled to, and ten days of the month came back `null` from
       `elementFromPoint` on a 360px telephone: the whole weekend column, on every
       date field on the portal. WCAG 2.2 SC 1.4.4 asks that nothing be lost up to
       200%. */
    /* Both written **before** the box is measured, because both change how wide it
       is. Left in the sheet's own `absolute`, the box is as wide as the column of
       the form allows and measures 320px where it will be drawn 344; the clamp
       then reads a width that is not the width and places the sheet 16px under the
       right edge. Measured 23.08.2026. */
    drawn.style.position = 'fixed'
    drawn.style.maxInlineSize = `${String(room.across - 16)}px`

    const its = drawn.getBoundingClientRect()
    /* Under the field where it fits under, over it otherwise, and then held inside
       the window whatever came of that: on a short window neither side has room,
       and a calendar half above the top edge is as unusable as one below the
       bottom. Both ends are written every time, and `top` alone decides; leaving
       one empty lets the rule in the sheet take over (`.datepicker__pop` carries
       `top: calc(100% + …)`, which on a `fixed` element is the height of the
       window), and with both ends set the height resolved to nought. Measured on
       23.08.2026 at five sizes: 22 pixels tall, under the bottom edge, and
       `elementFromPoint` over a day answered `null`. */
    const wanted = at.bottom + its.height <= room.down ? at.bottom + 8 : at.top - its.height - 8
    const top = Math.max(8, Math.min(wanted, room.down - its.height - 8))
    /* And never out of the window sideways either. A calendar is wider than a cell
       of a table, and at 150% text on a 360px screen it stood 42px past the right
       edge with nothing to scroll it back: `fixed` does not move with the page. */
    const across = Math.max(8, Math.min(at.left, room.across - its.width - 8))

    drawn.style.insetInlineStart = `${String(across)}px`
    drawn.style.top = `${String(top)}px`
    drawn.style.bottom = 'auto'
  }, [open])
  const [month, setMonth] = useState(() => monthOf(value, today))
  const box = useRef<HTMLDivElement>(null)

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
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const { year, index } = monthNumbers(month)
  const chosen = parseDate(value)

  function pick(day: number) {
    onChange(`${String(day).padStart(2, '0')}/${String(index).padStart(2, '0')}/${year}`)
    setOpen(false)
  }

  return (
    <div className="datepicker" ref={box}>
      <input
        id={id}
        name={name}
        className="field__control"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/gggg"
        aria-label={label}
        aria-required={required}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        autoFocus={openAt}
        /* Held rather than switched off, for the reason written in
           `FormRenderer.tsx` beside `aria-disabled`: the portal filled this in from
           the race, so it is not refused, it is not the reader's to change. */
        aria-disabled={locked ? true : undefined}
        readOnly={locked ? true : undefined}
        value={value}
        onChange={(event) => onChange(maskDate(event.target.value))}
      />

      <button
        type="button"
        className="datepicker__open"
        aria-disabled={locked ? true : undefined}
        aria-expanded={open}
        aria-label={t('form.openCalendar')}
        onClick={() => {
          /* The clock is read when the calendar is opened, never when the field
             last drew. A field draws again only when something about that field
             changed (src/forms/FormRenderer.tsx), so a form filled in across
             midnight would otherwise open the calendar on yesterday's month. */
          setMonth(monthOf(value, today))
          setOpen((was) => !was)
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>

      {open && (
        /**
         * Placed against the window and not against the box above it.
         *
         * A calendar drawn inside its own field is cut off by whatever scrolls
         * around that field, and since 23.08.2026 one of them stands in a cell of a
         * table whose box scrolls sideways: `overflow-x: auto` makes the other axis
         * `auto` too, by the rule of the property itself, so the calendar was cut
         * to a strip of 20 pixels out of 245 and could only be reached by scrolling
         * inside the table. Measured that day, at four sizes.
         *
         * Read at the moment it opens, off the box it belongs to, which is where it
         * has to stand. Nothing follows it afterwards: the calendar closes on a
         * choice, on Escape and on the way out, so there is no state in which it is
         * open and the page has moved under it.
         */
        <div className="datepicker__pop" ref={pop}>
          <div className="datepicker__bar">
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, -1))}
              aria-label={t('calendar.previousMonth')}
            >
              {'‹'}
            </button>
            <strong>{formatMonth(month, locale)}</strong>
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, 1))}
              aria-label={t('calendar.nextMonth')}
            >
              {'›'}
            </button>
          </div>

          <div className="datepicker__grid">
            {WEEKDAYS.map((weekday) => (
              <span key={weekday} className="datepicker__weekday">
                {t(`calendar.weekdays.${weekday}`)}
              </span>
            ))}

            {monthGrid(year, index).map((day, cell) =>
              day === null ? (
                <span key={cell} />
              ) : (
                <button
                  key={cell}
                  type="button"
                  className={
                    chosen !== null &&
                    chosen.getUTCDate() === day &&
                    chosen.getUTCMonth() === index - 1 &&
                    chosen.getUTCFullYear() === year
                      ? 'datepicker__day datepicker__day--on'
                      : 'datepicker__day'
                  }
                  onClick={() => pick(day)}
                >
                  {day}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  )
}
