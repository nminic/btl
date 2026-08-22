import { useState } from 'react'
import { useI18n } from '../i18n/useI18n'
import type { Suggestion } from './types'
import './Suggesting.css'

/** How many letters before the list opens (owner, 23.08.2026: „posle dva slova
 *  treba da krene autocomplete"). */
const FROM_LETTERS = 2

/**
 * How many entries stand at once.
 *
 * The list is a list of buttons and every one of them is a stop on the way
 * through the form with a keyboard, so an unbounded list is a form somebody has
 * to tab through a hundred times to reach the next field. Eight is what fits
 * under the box without covering the field below it, and the list is the newest
 * eight, so typing a third letter is how the older ones are reached.
 */
const AT_MOST = 8

/**
 * What is offered for what has been typed.
 *
 * Case is folded on both sides, because somebody typing a race name types it the
 * way they say it and not the way it was entered. The order is the order it was
 * handed in, which is by date, newest first (owner).
 */
function matching(value: string, all: readonly Suggestion[]): Suggestion[] {
  const asked = value.trim().toLocaleLowerCase()

  return asked.length < FROM_LETTERS
    ? []
    : all.filter((one) => one.value.toLocaleLowerCase().includes(asked)).slice(0, AT_MOST)
}

/**
 * A box to type in, with what the portal already knows underneath it.
 *
 * A list of buttons and not the ARIA combobox pattern, deliberately. A combobox
 * is `aria-activedescendant`, an owned listbox, arrow keys, Home and End, and a
 * contract about what Enter does when nothing is highlighted; every one of those
 * is a branch, and a half-built combobox lies to a screen reader about what it
 * can do. A list of buttons under a text box promises nothing it does not do:
 * Tab reaches each entry, Enter and Space press it, Escape closes the list, and
 * the count is said out loud the moment the list opens.
 *
 * Escape closes it and typing opens it again, so a reader who wants the box and
 * not the list is never trapped between the two.
 */
export function Suggesting({
  value,
  shared,
  suggestions,
  onType,
  onChoose,
}: {
  value: string
  /** Everything the form puts on every control of its own: the id, the name, the
   *  rule and what describes it (FormRenderer.tsx). */
  shared: Record<string, unknown>
  suggestions: readonly Suggestion[]
  onType: (next: string) => void
  onChoose: (one: Suggestion) => void
}) {
  const { t } = useI18n()
  /* Shut by Escape and by choosing, and opened again by the next letter typed.
     Not a copy of what is in the box: the list itself is worked out from the
     value every time, so there is nothing here that can disagree with it. */
  const [shut, setShut] = useState(false)
  const found = matching(value, suggestions)
  const showing = shut ? [] : found

  return (
    <div className="suggests">
      <input
        {...shared}
        type="text"
        value={value}
        /* The browser's own list of what was typed here before would stand over
           this one, and this one is the portal's own data. */
        autoComplete="off"
        onChange={(event) => {
          setShut(false)
          onType(event.target.value)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setShut(true)
          }
        }}
      />

      {/* That the list opened, and how long it is, for a reader who cannot see it
          appear. The region stands whether or not it has anything to say, because
          a live region added to the page at the moment it speaks is a region a
          screen reader has not been watching (WCAG 2.2 SC 4.1.3). */}
      <p className="visually-hidden" role="status">
        {showing.length === 0 ? '' : t('form.suggested', { count: showing.length })}
      </p>

      {showing.length > 0 && (
        <ul className="suggests__list">
          {showing.map((one) => (
            <li key={one.id}>
              <button
                type="button"
                className="suggests__one"
                onClick={() => {
                  setShut(true)
                  onChoose(one)
                }}
              >
                {one.said}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
