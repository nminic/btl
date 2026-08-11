import { useEffect, useRef, useState } from 'react'
import countries from '../data/countries.json'
import { countryName } from '../data/countryName'
import {
  placeName,
  placesLike,
  plainly,
  usePlaces,
  TYPED_BEFORE_GUESSING,
  type Place,
} from '../data/places'
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
  country,
  onChange,
  openAt = false,
}: {
  id: string
  name: string
  value: string
  /** The country beside it, which this field writes as well as reads. */
  country: string
  invalid: boolean
  describedBy: string | undefined
  onChange: (place: string, country: string) => void
  openAt?: boolean
}) {
  const { locale, t } = useI18n()
  /* Asked for on the second letter and not before: the codebook is nine hundred
     kilobytes, and somebody who opened a form has not asked for it yet. */
  const places = usePlaces(value.trim().length >= TYPED_BEFORE_GUESSING)
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState(-1)
  /* The town picked off the list during this visit, if the box still holds it.
     A record opened for editing starts with nothing here, and is recognised by
     its name alone or not at all. */
  const [picked, setPicked] = useState<Place | null>(null)
  const box = useRef<HTMLDivElement>(null)

  const offered = open ? placesLike(places, value) : []
  const listId = `${id}-places`
  /* Whether the list of countries has a name for the one this record holds. */
  const unnamed = ![...countries.region, ...countries.rest].some((one) => one.code === country)
  /**
   * Which country this town is in, where the codebook answers that on its own.
   *
   * A recognised town cannot have its country changed (owner, 11.08.2026): the
   * country is then not an answer somebody gives but a fact about the town, and
   * a control that lets it be contradicted is a control that files a race in the
   * wrong country. Only a town entered by hand leaves the choice open.
   *
   * Recognised means the codebook holds this name **and holds it once**. Seven
   * hundred and thirty eight names in it stand in more than one country: London
   * is British and American, Lagos is Nigerian and Portuguese. For those the
   * name recognises nothing by itself, so the choice stays where it was.
   */
  const spelt = plainly(value.trim())
  const sameName = spelt === '' ? [] : places.filter(
    (one) => plainly(one[0]) === spelt || (one[2] !== undefined && plainly(one[2]) === spelt),
  )
  const only = [...new Set(sameName.map((one) => one[1]))]
  /* Picked off the list, or spelt out so that the codebook can only mean one
     place. Picking counts even for a name two countries share, because then the
     row that was pressed said which of them it was; typing „London" says
     nothing, and the choice stays open. */
  const known = picked?.[1] ?? (only.length === 1 ? only[0] : undefined)

  useEffect(() => {
    /* And a town typed out in full, letter by letter, ends in the same place as
       one picked off the list. Otherwise „Beograd" typed by somebody who never
       looked at the suggestions kept whatever country the field opened on, and
       the box beside it was locked on it. */
    if (known !== undefined && known !== country) {
      onChange(value, known)
    }
  }, [known, country, value, onChange])

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
    setPicked(place)
    setOpen(false)
    setAt(-1)
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      /* And stops here. Any ancestor listening for Escape would otherwise take
         it too, so one press both closed these suggestions and shut whatever
         they were standing inside. */
      event.stopPropagation()
      setOpen(false)
      setAt(-1)

      return
    }

    if (offered.length === 0) {
      /* Down opens the list again, which is the one way back to it from the
         keyboard: after Escape, or after a town was picked, there is nothing
         to walk and nothing but retyping would bring it back (WAI-ARIA 1.2,
         combobox: Down Arrow opens the listbox). */
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setOpen(true)
      }

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
      <div className="place__town">
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
          /* The country stays as it is, and is now on the screen to be changed
             (owner, 11.08.2026): a town the codebook does not have is entered by
             hand and its country chosen beside it. It used to be cleared here,
             because the country was written and never shown and the danger was a
             race in Beograd edited into Zagreb and filed in Serbia with nothing
             saying so. There is something saying so now. */
          onChange(event.target.value, country)
          /* Typed over, so what was picked is no longer what stands here: the
             country goes back to being a question. */
          setPicked(null)
          setOpen(true)
          /* And nothing is highlighted any more: the list is about to be a
             different list, and the third row of it is not the row somebody was
             standing on. Left where it was, Enter took a town nobody had
             looked at. */
          setAt(-1)
        }}
        onKeyDown={onKeyDown}
        /* Closed when the cursor leaves the town, which is what the pointer
           rule cannot answer: the country select is inside this field, so a
           press on it is a press inside the box and the list stayed open over
           it. On a telephone the two stack, and the list covered the country
           entirely. */
        onBlur={() => {
          setOpen(false)
          setAt(-1)
        }}
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
              /* Pointer down rather than click, and the press is kept off the
                 box: a click on a row is a press and a release, and anything
                 that closes the list on the press leaves the release landing on
                 whatever has moved under it. `preventDefault` keeps the focus
                 in the box, so the field is still the thing being typed in
                 after a town is picked with the mouse. */
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

      {/* The country, beside the town and not under it (owner, 11.08.2026).
          Filled by whoever picks a town out of the codebook and chosen by hand
          for a town it does not have, which is how a race in a hamlet stops
          being filed wherever the last chosen town was. */}
      <label className="place__country-pick">
        <span>{t('admin.field.country')}</span>
        <select
          className="field__control"
          value={country}
          /* Locked on a town the codebook knows, for the reason written where
             `known` is worked out. Disabled rather than hidden: the country is
             still the answer, and an answer that disappears reads as a question
             nobody asked. */
          disabled={known !== undefined}
          onChange={(event) => {
            onChange(value, event.target.value)
          }}
        >
          {/* The region first, because all but a handful of these races are run
              in it. No empty option: a race is run in some country, and the one
              this starts on is the one most of them are run in. */}
          <optgroup label={t('form.region')}>
            {countries.region.map((one) => (
              <option key={one.code} value={one.code}>
                {one.name}
              </option>
            ))}
          </optgroup>
          <optgroup label={t('form.restOfWorld')}>
            {countries.rest.map((one) => (
              <option key={one.code} value={one.code}>
                {one.name}
              </option>
            ))}
          </optgroup>

          {/* And whatever code this record actually holds, where the list has no
              name for it.
           *
              A select given a value it has no option for shows nothing at all:
              the box goes blank, `selectedIndex` is -1, and the country the
              record carries is invisible. Whoever is looking then sees a filled
              town beside an empty country, corrects what looks unanswered, and
              the event quietly moves to another country. The codebook of towns
              is the world's (ADL A16) and it carries codes the list of countries
              does not name, so this is not a case that can be ruled out by
              filling the list better.

              Named by `countryName`, which hands back the code itself where
              there is no name (data/countryName.ts). A code is not a country and
              is not meant to read like one; it is meant to be visible, so that
              what is unanswered is the list and not the record. */}
          {unnamed && <option value={country}>{countryName(country)}</option>}
        </select>
      </label>
    </div>
  )
}
