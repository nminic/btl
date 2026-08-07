import { useI18n } from '../i18n/useI18n'
import './Stars.css'

/** How many points a rating can carry. Five, and the same five everywhere. Not
 *  exported: nothing outside asks how many there are, and a number exported for
 *  nobody is a number two files can start disagreeing about. */
const STARS = 5

/**
 * A five pointed star, empty or filled.
 *
 * Drawn rather than written as a character: the star in a font is a different
 * shape on every system, and half of them draw it in colour whatever the page
 * asks for. Two paths of the same outline, so the filled one and the empty one
 * are the same star and only the ink differs.
 */
function Star({ filled }: { filled: boolean }) {
  return (
    <svg className="stars__mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * A rating, either to read or to give (owner, 06.08.2026).
 *
 * Empty stars that fill on a click, which is what the owner asked for, and that
 * is a group of radio buttons and not five buttons: a rating is one choice out
 * of five, the arrow keys move through it, and a screen reader announces which
 * of the five is chosen. Five buttons would be five separate things to press
 * with nothing saying they are one answer.
 *
 * Given no `onChange` it is a reading rather than a choice, and then it is not a
 * control at all: no radios, nothing to focus, and the number said in words for
 * anybody who cannot see the stars. That is the shape the queue and the list of
 * comments use, where a rating is a fact and not a question.
 */
export function Stars({
  name,
  label,
  value,
  onChange,
}: {
  /** Unique on the screen: it is what ties the five radios into one group. */
  name: string
  label: string
  /** How many of the five are filled, and 0 for a rating nobody has given. */
  value: number
  onChange?: (value: number) => void
}) {
  const { t } = useI18n()
  const marks = Array.from({ length: STARS }, (_, index) => index + 1)

  if (onChange === undefined) {
    return (
      <span className="stars" role="img" aria-label={`${label}: ${said(t, value)}`}>
        {marks.map((mark) => (
          <Star key={mark} filled={mark <= value} />
        ))}
      </span>
    )
  }

  return (
    <fieldset className="stars stars--asking">
      <legend>{label}</legend>
      {marks.map((mark) => (
        /* The label is what is clicked and the radio inside it is what carries
           the state, so the star is as big as a finger without anything being
           told to have a size (WCAG 2.2 SC 2.5.8). The radio itself is off the
           screen rather than out of the page: it is the thing a keyboard moves
           through and a screen reader reads. */
        <label key={mark} className="stars__pick">
          <input
            type="radio"
            className="visually-hidden"
            name={name}
            value={mark}
            checked={mark === value}
            onChange={() => onChange(mark)}
          />
          <span className="visually-hidden">{t('event.rating.stars', { count: mark })}</span>
          <Star filled={mark <= value} />
        </label>
      ))}
    </fieldset>
  )
}

/** What a rating reads as when there is nobody to hear the stars. */
function said(t: (key: string, values?: Record<string, string | number>) => string, value: number) {
  return value === 0 ? t('event.rating.unrated') : t('event.rating.stars', { count: value })
}
