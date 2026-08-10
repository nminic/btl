import { useEffect, useRef, useState } from 'react'
import { countryName } from '../data/countryName'
import { placeName, placesLike, usePlaces, TYPED_BEFORE_GUESSING, type Place } from '../data/places'
import { useI18n } from '../i18n/useI18n'
import './PlaceField.css'

/**
 * A town, typed, with the codebook of the world offering the rest.
 *
 * The form used to ask for a town in a free text box and for a country in a
 * list of two hundred and fifty two. The owner asked for one field instead
 * (10.08.2026): from the second letter the codebook starts answering, each
 * answer says which country the town is in, and the country field goes away
 * because the answer already carries it. Entering a calendar is a hundred
 * events at a sitting, and that is two fields saved a hundred times.
 *
 * **Typing still wins.** A suggestion is an offer, never a requirement: the town
 * where a race is actually run may be a hamlet of two hundred people that no
 * codebook of the world has heard of, and it goes in as typed. What is lost by
 * typing it is the country, which is why the country of a town chosen from the
 * list is remembered and the country of a town typed over is cleared rather
 * than left saying something that is no longer true.
 *
 * Written to the combobox pattern (WAI-ARIA 1.2): the box says what it is and
 * whether it is open, the list is a listbox, and the highlighted row is named by
 * `aria-activedescendant` rather than focused, so what a screen reader reads is
 * the row while the keys still reach the box.
 */
export function PlaceField({
  id,
  name,
  value,
  invalid,
  describedBy,
  onChange,
  openAt = false,
}: {
  id: string
  name: string
  value: string
  invalid: boolean
  describedBy: string | undefined
  /** The town, and the country it came with. An empty country means the town
   *  was typed rather than chosen. */
  onChange: (place: string, country: string) => void
  openAt?: boolean
}) {
  const { locale, t } = useI18n()
  /* Asked for on the second letter and not before: the codebook is nine hundred
     kilobytes, and somebody who opened a form has not asked for it yet. */
  const places = usePlaces(value.trim().length >= TYPED_BEFORE_GUESSING)
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState(-1)
  const box = useRef<HTMLDivElement>(null)

  const offered = open ? placesLike(places, value) : []
  const listId = `${id}-places`

  useEffect(() => {
    if (!open) {
      return
    }

    function onPointerDown(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  function choose(place: Place) {
    onChange(placeName(place, locale), place[1])
    setOpen(false)
    setAt(-1)
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      setOpen(false)
      setAt(-1)

      return
    }

    if (offered.length === 0) {
      return
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      /* Wraps at both ends, so the last row is one press up from the box and
         the list can be walked in either direction without counting. The arrows
         would otherwise put the cursor at the ends of the text. */
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

    const picked = offered[at]

    if (event.key === 'Enter' && picked !== undefined) {
      /* Enter on a highlighted row picks it rather than submitting the form,
         which is the one place in a form where Enter means something else. */
      event.preventDefault()
      choose(picked)
    }
  }

  const highlighted = offered[at]

  return (
    <div className="place" ref={box}>
      <input
        id={id}
        name={name}
        className="field__control"
        type="text"
        role="combobox"
        autoComplete="off"
        aria-expanded={offered.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={highlighted === undefined ? undefined : `${listId}-${at}`}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        autoFocus={openAt}
        value={value}
        onChange={(event) => {
          /* The country goes with the town it belonged to. Left standing, a
             race in Beograd edited into Zagreb would be filed in Serbia. */
          onChange(event.target.value, '')
          setOpen(true)
          setAt(-1)
        }}
        onKeyDown={onKeyDown}
      />

      {offered.length > 0 && (
        <ul className="place__list" id={listId} role="listbox" aria-label={t('form.places')}>
          {offered.map((place, index) => (
            <li
              key={`${place[0]}-${place[1]}-${String(index)}`}
              id={`${listId}-${String(index)}`}
              className={index === at ? 'place__one place__one--at' : 'place__one'}
              role="option"
              aria-selected={index === at}
              /* Pointer down rather than click: the box loses focus first, and
                 the list is gone by the time a click lands. */
              onMouseDown={(event) => {
                event.preventDefault()
                choose(place)
              }}
            >
              <span className="place__name">{placeName(place, locale)}</span>{' '}
              <span className="place__country">({countryName(place[1])})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
