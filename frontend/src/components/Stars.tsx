import { useId } from 'react'
import { RequiredMark } from '../forms/AskedLabel'
import { formatNumber } from '../i18n/format'
import { useI18n } from '../i18n/useI18n'
import './Stars.css'

/** How many points a rating can carry. Five, and the same five everywhere. Not
 *  exported: nothing outside asks how many there are, and a number exported for
 *  nobody is a number two files can start disagreeing about. */
const STARS = 5

/** The star itself, and where it begins and ends across the box it is drawn in.
 *  Measured off the path rather than assumed: the box is 24 wide and the star
 *  inside it is not, so a third of the box is not a third of the star. */
const STAR = 'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5-4.7-4.6 6.5-.9z'
const LEFT = 2.6
const ACROSS = 18.8

/**
 * A five pointed star, filled as far across as it is worth.
 *
 * Drawn rather than written as a character: the star in a font is a different
 * shape on every system, and half of them draw it in colour whatever the page
 * asks for. Two paths of the same outline, so the outline and the ink are the
 * same star and only the ink is cut.
 *
 * Cut with a straight upright edge, at a fraction of the star's own width
 * (owner, 11.08.2026): an average of 3,33 is three whole stars and a fourth
 * filled a third of the way across. Not half a star and not rounded, because
 * both of those say something the number does not.
 */
function Star({ fill }: { fill: number }) {
  const cut = useId()
  const outline = (
    <path d={STAR} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  )

  return (
    <svg className="stars__mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {fill < 1 && outline}
      {fill > 0 && (
        <>
          {/* No clip at all where the star is whole: a clip that cuts nothing
              is an id in the document for nothing, and there are five of these
              on every rating on the screen. */}
          {fill < 1 && (
            <clipPath id={cut}>
              <rect x="0" y="0" width={LEFT + ACROSS * fill} height="24" />
            </clipPath>
          )}
          <path
            d={STAR}
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
            clipPath={fill < 1 ? `url(#${cut})` : undefined}
          />
        </>
      )}
    </svg>
  )
}

/**
 * How much of one star is worth filling, for a rating of `value` out of five.
 *
 * Nought below it, and the remainder on the star the number falls inside.
 * Anything above one is left as it is rather than capped: everything from one
 * upwards is drawn as a whole star, so a cap would be a branch nothing could
 * ever take (`fill < 1` answers the same either way).
 *
 * Not exported: nothing outside asks, and this file exports components.
 */
function fillOf(value: number, mark: number): number {
  return Math.max(0, value - mark + 1)
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
type Reading = {
  label: string
  /** How many of the five are filled, and 0 for a rating nobody has given. */
  value: number
  onChange?: undefined
  name?: undefined
}

type Asking = {
  label: string
  value: number
  onChange: (value: number) => void
  /**
   * What ties the five radios into one group, and therefore has to be unique on
   * the screen: two groups of one name are ten radios that are one choice.
   *
   * Only on the shape that asks. It was required on both at first, on the
   * reasoning that a prop meaning something in one shape and nothing in the
   * other is worse; what that produced was three callers computing a string and
   * throwing it away. A shape that has no radios has no group to name.
   */
  name: string
}

export function Stars({ name, label, value, onChange }: Reading | Asking) {
  const { locale, t } = useI18n()
  const marks = Array.from({ length: STARS }, (_, index) => index + 1)
  /* The name of the group, by id: a role written by hand does not inherit the
     browser's own pairing of a fieldset with its legend. */
  const nameId = useId()

  if (onChange === undefined) {
    return (
      <span className="stars" role="img" aria-label={`${label}: ${said(t, locale, value)}`}>
        {marks.map((mark) => (
          <Star key={mark} fill={fillOf(value, mark)} />
        ))}
      </span>
    )
  }

  return (
    /* All three ratings have to be given before a comment can be sent
       (event.commentNeedsMarks), so all three say so the way every field on the
       portal says it since 12.08.2026: a star for the eye and `aria-required`
       for a reader (forms/AskedLabel.tsx). On the group and not on each of the
       five, because it is the rating that is asked for and not any one star.
     *
       `role="radiogroup"` and not a bare fieldset, which is a plain `group`:
       ARIA gives `group` no `aria-required` at all, so the word went to a place
       no reader looks and the half of the decision meant for readers was not
       delivered. The renderer says the same of its own groups of buttons
       (forms/FormRenderer.tsx). With the role written out the name has to be
       written out too, since it is no longer the browser pairing a legend with
       its fieldset.

       And the star stands outside the legend, because the legend is the name of
       the group: inside it, „Organizacija" becomes „Organizacija*" for anything
       that goes looking by the words. */
    <fieldset
      className="stars stars--asking"
      role="radiogroup"
      aria-labelledby={nameId}
      aria-required="true"
    >
      <legend id={nameId}>{label}</legend>
      <RequiredMark />
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
          <span className="visually-hidden">{t('event.rating.stars', { count: mark, of: STARS })}</span>
          {/* Whole stars, because this is a choice of one of five and not a
              measurement: nobody gives three and a third. */}
          <Star fill={mark <= value ? 1 : 0} />
        </label>
      ))}
    </fieldset>
  )
}

/**
 * What a rating reads as when there is nobody to hear the stars.
 *
 * The number as it is written everywhere else on the portal, to one decimal:
 * an average is 4,7 and not 4.7, and it stopped being a whole number the day
 * the last star began to be cut across (owner, 11.08.2026).
 */
function said(
  t: (key: string, values?: Record<string, string | number>) => string,
  locale: string,
  value: number,
) {
  if (value === 0) {
    return t('event.rating.unrated')
  }

  const written = Number.isInteger(value) ? String(value) : formatNumber(value, locale, 1)

  return t('event.rating.stars', { count: written, of: STARS })
}
