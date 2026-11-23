import { useState, type KeyboardEvent } from 'react'
import { heldControl } from '../../forms/held'
import { matching } from '../../forms/matching'
import type { Suggestion } from '../../forms/types'
import { useI18n } from '../../i18n/useI18n'
import './MemberChoice.css'

/**
 * THE BOX OF A MEMBER ON A ROW OF RESULTS: A LIST TO CHOOSE FROM THAT TAKES TYPING, OPENED OVER THE BOXES BELOW.
 *
 * <p>Owner, 23.11.2026 (PDL, „Tri brze izmene administracije"): „Želim da za unos rezultata kao Admin sa
 * Kalendara polje za člana bude dropdown koji prima kucanje slova, a ne edit koji povuče imena i pomeri donje
 * bokseve", and the decision recorded on it: „polje za člana postaje padajući izbor u koji se kuca. Spisak
 * predloga se otvara preko sadržaja ispod, ne gura ga nadole." It was a `forms/Suggesting.tsx` box, whose list
 * stands in the flow on purpose and pushes the figures under it down while it is open.
 *
 * <p><b>Written to the combobox pattern (WAI-ARIA 1.2), and the portal's own one is the precedent</b>
 * (`forms/PlaceField.tsx`, with the guards it carries): the box says what it is and whether it is open, the list
 * is a listbox, and the highlighted row is named by `aria-activedescendant` rather than focused, so a screen
 * reader reads the row while the keys still reach the box. Down opens it and walks it, Up walks it back, both
 * wrap; Enter on a highlighted row chooses it rather than saving the form; Escape closes it and goes no further;
 * leaving the box closes it. A row is chosen on pointer down with the press kept off the box, so the cursor stays
 * where the reader left it and nothing has moved under the release.
 *
 * <p><b>Over the boxes and not in the flow, at every width</b>, which is where it parts from `PlaceField`, whose
 * list goes into the flow on a telephone so as not to cover the country beside the town. Here what it covers is
 * the next figures of the same row, and the owner's decision is that it covers them. What `Suggesting.css` gave
 * as the reason for the flow (a box under the list whose focus ring could not be seen, WCAG 2.2 SC 2.4.11) does
 * not arise: the list is open only while the cursor is in this box, and the press that takes the cursor to the
 * next box closes it.
 *
 * <p><b>What it offers is what the box offered before</b>, by the same rule (`forms/matching.ts`): from the second
 * letter, the members whose label holds what was typed, at most eight of those only partly named. A name typed
 * and not chosen is nobody (`whatIsWrongWith`), as before.
 */
export function MemberChoice({
  id,
  name,
  value,
  suggestions,
  invalid,
  describedBy,
  onType,
  onChoose,
}: {
  id: string
  name: string
  value: string
  suggestions: readonly Suggestion[]
  invalid: boolean
  describedBy: string | undefined
  onType: (next: string) => void
  onChoose: (one: Suggestion) => void
}) {
  const { t } = useI18n()
  /* Shut is where it starts, as `Suggesting` starts, and opened by typing or by Down. */
  const [open, setOpen] = useState(false)
  /* Which row is highlighted, or -1 for none: what Enter would choose. */
  const [at, setAt] = useState(-1)
  const offered = open ? matching(value, suggestions) : []
  const listId = `${id}-list`
  const highlighted = offered[at]

  function choose(one: Suggestion) {
    onChoose(one)
    setOpen(false)
    setAt(-1)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      /* And stops here, so one press does not also close whatever the form stands inside (`PlaceField`). */
      event.stopPropagation()
      setOpen(false)
      setAt(-1)

      return
    }

    if (offered.length === 0) {
      /* Down opens the list again, the one way back to it from the keyboard after Escape or a choice. */
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setOpen(true)
      }

      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const last = offered.length - 1

      event.preventDefault()
      setAt((was) => {
        if (event.key === 'ArrowDown') {
          return was >= last ? 0 : was + 1
        }

        return was <= 0 ? last : was - 1
      })

      return
    }

    if (event.key === 'Enter' && highlighted !== undefined) {
      /* Enter on a highlighted row chooses it rather than saving the form. */
      event.preventDefault()
      choose(highlighted)
    }
  }

  return (
    <div className="member-choice">
      <input
        id={id}
        name={name}
        /* The dress of every box of a form (`forms/held.ts`). */
        className={heldControl(false)}
        type="text"
        role="combobox"
        /* The browser's own list of what was typed here before would stand over this one. */
        autoComplete="off"
        aria-expanded={offered.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={highlighted === undefined ? undefined : `${listId}-${String(at)}`}
        aria-required
        aria-invalid={invalid}
        aria-describedby={describedBy}
        value={value}
        onChange={(event) => {
          onType(event.target.value)
          setOpen(true)
          /* The list is about to be another list, and its third row is not the row somebody stood on. */
          setAt(-1)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => {
          setOpen(false)
          setAt(-1)
        }}
      />

      {/* NO LIVE COUNT BESIDE IT, as `PlaceField` has none: a combobox says it opened by `aria-expanded`, and a
          reader walking the list hears each row as an option of a list of so many. The `Suggesting` box it
          replaced said „N trka iz kalendara odgovara" over a list of members (`form.suggested`), which was a
          sentence about another list. */}
      {offered.length > 0 && (
        <ul className="member-choice__list" id={listId} role="listbox" aria-label={t('form.members')}>
          {offered.map((one, index) => (
            <li
              key={one.id}
              id={`${listId}-${String(index)}`}
              className={index === at ? 'member-choice__one member-choice__one--at' : 'member-choice__one'}
              role="option"
              aria-selected={index === at}
              /* Pointer down rather than click, with the press kept off the box (`PlaceField`). */
              onMouseDown={(event) => {
                event.preventDefault()
                choose(one)
              }}
            >
              {one.said}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
