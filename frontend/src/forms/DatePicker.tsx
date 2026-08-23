import { useEffect, useRef, useState } from 'react'
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
        disabled={locked}
        value={value}
        onChange={(event) => onChange(maskDate(event.target.value))}
      />

      <button
        type="button"
        className="datepicker__open"
        disabled={locked}
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
        <div className="datepicker__pop">
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
