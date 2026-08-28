import { useEffect, useMemo, useRef, useState } from 'react'
import { AskedLabel } from './AskedLabel'
import { outsideOf } from '../components/outsideOf'
import { CountryOptions } from './CountryOptions'
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
  required,
  describedBy,
  country,
  countryInvalid = false,
  withoutError,
  errorOnly,
  onChange,
  openAt = false,
  locked = false,
}: {
  id: string
  name: string
  value: string
  /** The country beside it, which this field writes as well as reads. */
  country: string
  invalid: boolean
  /** Whether the form asks for this one. Both halves carry it: a town without
      its country is half an answer, and the two are two controls
      (FormRenderer.tsx). */
  required?: boolean
  /** Whether it is the country that is unanswered, rather than the town. */
  countryInvalid?: boolean
  /** What describes the town when the error belongs to the country: everything
   *  the field says about itself, minus the error. */
  withoutError?: string
  /** The error alone, for the country to carry when the error is about it. */
  errorOnly?: string
  describedBy: string | undefined
  onChange: (place: string, country: string) => void
  openAt?: boolean
  /** Whether both halves came off a record rather than from this reader, in which
   *  case neither takes anything (FormRenderer.tsx). */
  locked?: boolean
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
  /* Whether the town has been typed into or picked at during this visit. A ref
     and not state: nothing on the screen changes with it, and it must not cause
     a redraw of its own. */
  const touched = useRef(false)
  const box = useRef<HTMLDivElement>(null)

  const offered = open ? placesLike(places, value) : []
  const listId = `${id}-places`
  /**
   * Which country this town is in, where the codebook answers that on its own.
   *
   * A recognised town cannot have its country changed (owner, 11.08.2026): the
   * country is then not an answer somebody gives but a fact about the town, and
   * a control that lets it be contradicted is a control that files a race in the
   * wrong country. Only a town entered by hand leaves the choice open.
   *
   * Recognised means the codebook holds this name **and holds it once**. Eight
   * hundred and fifty four names in it stand in more than one country, counted
   * the way this counts them, which is folded (`plainly`) rather than letter for
   * letter: London is British and American, Lagos is Nigerian and Portuguese.
   * For those the name recognises nothing by itself, so the choice stays where
   * it was.
   */
  const spelt = plainly(value.trim())
  /* The codebook folded once, into a name and the countries that answer to it.
   *
     Recognising a town by walking the whole codebook and folding two names for
     each was 24 milliseconds a pass over forty seven thousand towns, and it ran
     on every keystroke: 170 milliseconds to type „beograd". Memoising the walk
     kept it off the redraws but not off the keys, since what is typed is what
     changes. Folded once per codebook, recognising is a lookup.
   *
     A map of names to countries and not to towns, because that is the whole
     question here: whether the codebook can mean only one place by this name. */
  const byName = useMemo(() => {
    const found = new Map<string, Set<string>>()

    for (const one of places) {
      for (const written of one[2] === undefined ? [one[0]] : [one[0], one[2]]) {
        const folded = plainly(written)
        const already = found.get(folded)

        if (already === undefined) {
          found.set(folded, new Set([one[1]]))
        } else {
          already.add(one[1])
        }
      }
    }

    return found
  }, [places])
  const only = [...(byName.get(spelt) ?? [])]
  /* Picked off the list, or spelt out so that the codebook can only mean one
     place. Picking counts even for a name two countries share, because then the
     row that was pressed said which of them it was; typing „London" says
     nothing, and the choice stays open. */
  const known = picked?.[1] ?? (only.length === 1 ? only[0] : undefined)

  useEffect(() => {
    /* And a town typed out in full, letter by letter, ends in the same place as
       one picked off the list. Otherwise „Beograd" typed by somebody who never
       looked at the suggestions kept whatever country the field opened on, and
       the box beside it was locked on it.
     *
       Only once the town has been touched during this visit. A record opened for
       editing is left exactly as it was written: a form that quietly rewrites a
       field nobody has been near is a form that saves something other than what
       it was opened on, and the confirmation of the save does not even list the
       country, since it is not a field (admin/EntityEditor.tsx). Where the
       codebook disagrees with what was saved, what was saved stands, and it is a
       question for whoever is looking at the record, not for this field. */
    /* A record that carries no country at all is a hole rather than an answer,
       and filling a hole from the codebook is not rewriting anything: left
       alone, such a record opened with the country held shut on nothing, marked
       as the thing to fix, and refusing every press. */
    if (!touched.current && country !== '') {
      return
    }

    if (known !== undefined && known !== country) {
      onChange(value, known)
    }
  }, [known, country, value, onChange])

  useEffect(() => {
    if (!open) {
      return
    }

    function onPointerDown(event: MouseEvent) {
      if (outsideOf(box.current, event)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open])

  function choose(place: Place) {
    /* The fourth road into a locked field, and the only one a pointer takes.
       Three were shut on 28.08.2026 and this was left open, which is the same
       fault in miniature: the lock was counted rather than the ways past it.
       Measured by a review the same day: turn the lock while the list is standing
       and press a row, and the field wearing `aria-disabled="true"` takes
       „Beocin“ in place of „Be“. */
    if (locked === true) {
      return
    }

    touched.current = true
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

    /* Nothing else at all while the field is held, and Escape above this rather
       than below it on purpose. `readOnly` stops typing and stops nothing else:
       ArrowDown opened the list again and Enter took a town out of it, so a
       control the portal says cannot be answered answered anyway. Measured by a
       review on 23.08.2026 with the keyboard alone: the value went from „Be“ to
       „Beocin“ on a field that was locked.
     *
       Escape is the one press here that writes nothing, and the first version of
       this refused it along with the rest. Measured by a review on 28.08.2026: a
       list left standing over a field locked under it then had no keyboard
       dismissal at all, which WAI-ARIA 1.2 asks every combobox for, and the press
       went on to whatever ancestor was listening, of which the portal has four. */
    if (locked === true) {
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
        /* And it looks held as well as being held. The portal has one dress for a
           control that is reachable and will not answer, and until 28.08.2026
           four locked fields wore nothing at all: measured by comparing computed
           styles, the one visible difference `disabled` used to make (the cursor)
           went when `disabled` did, and nothing took its place. */
        className={locked === true ? 'field__control field__control--held' : 'field__control'}
        type="text"
        role="combobox"
        aria-disabled={locked ? true : undefined}
        readOnly={locked ? true : undefined}
        autoComplete="off"
        aria-expanded={offered.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={highlighted === undefined ? undefined : `${listId}-${at}`}
        aria-required={required}
        aria-invalid={invalid}
        /* Its own rule always, and the error only where the error is about it.
         *
           The two arrive as one string, so dropping the error dropped the rule
           with it and the town stopped saying how it works; keeping both, the
           town was read out as „Mesto, Izaberi državu uz mesto." while holding
           a perfectly good town. The country carries the error instead
           (below). */
        aria-describedby={countryInvalid ? withoutError : describedBy}
        autoFocus={openAt}
        value={value}
        onChange={(event) => {
          /* The country stays as it is, and is now on the screen to be changed
             (owner, 11.08.2026): a town the codebook does not have is entered by
             hand and its country chosen beside it. It used to be cleared here,
             because the country was written and never shown and the danger was a
             race in Beograd edited into Zagreb and filed in Serbia with nothing
             saying so. There is something saying so now. */
          /* And the same refusal beneath the lock, because a lock is a courtesy
             to whoever is filling the form in: `readOnly` is what a browser
             honours, and this is what holds whatever else reaches the component.
             Written as its own guard rather than trusted to the attribute, which
             is the shape the portal uses wherever a field is held
             (`forms/FormRenderer.tsx`). */
          if (locked === true) {
            return
          }

          touched.current = true
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
      {/* Its own name, and the same mark every other name on the portal carries:
          the country is a second control with its own error and its own line in
          the summary, so „Država" standing bare under a legend that says fields
          with a star are obligatory said neither of the two things (owner,
          12.08.2026; forms/AskedLabel.tsx). Outside the label, as everywhere. */}
      <span className="place__country-pick">
        <AskedLabel id={`${id}-country`} asked={required === true}>
          {t('form.country')}
        </AskedLabel>
        <select
          /* An id of its own, because it is a control of its own: the summary of
             errors leads here when the country is what is unanswered. */
          id={`${id}-country`}
          className={
            known === undefined && locked !== true
              ? 'field__control'
              : 'field__control field__control--held'
          }
          value={country}
          /* Locked on a town the codebook knows, for the reason written where
             `known` is worked out. Held rather than switched off: `disabled`
             takes the control out of the keyboard's path, so whoever is reading
             by keyboard never reaches it and is never told why it cannot be
             answered. `aria-disabled` leaves it reachable and says the same
             thing, which is the shape the portal uses wherever a control is held
             back (admin/PendingQueue.tsx). Hidden it is not: the country is
             still the answer, and an answer that disappears reads as a question
             nobody asked.

             **Switched off where the town decided it, and merely held where the
             form is locked.** Two rules meet here and they are not the same one.

             The town from the codebook switches it off, and that is the owner's
             own exception (23.08.2026: „Ukoliko se upari država prepoznavanjem
             mesta, ne mogu da kliknem i otvorim dropdown, postaje potpuno
             disabled"). The rule everywhere else is „odbijeno, ne ugašeno", and
             the cost is the ordinary one: a reader working by keyboard walks past
             the country without being told why.

             The form being locked because a race was chosen from the list is the
             other rule, and there the country stays reachable: `disabled` takes
             the control out of the keyboard's path, so a reader tabbing through
             went from the name of the event straight to the hours and never saw
             the four fields the portal had filled in for them. `aria-disabled`
             says the same thing and leaves it readable, which is the shape the
             portal uses wherever a control is held back
             (admin/PendingQueue.tsx). */
          disabled={known !== undefined}
          /* `undefined` and not `false`, so a control that is not held carries no
             such attribute at all. Written as a bare boolean it put
             `aria-disabled="false"` on every live country select on the portal,
             against the rule this very file's renderer spells out
             (`forms/FormRenderer.tsx`) and against ADL, where that same attribute
             is recorded as having once made five live buttons of the price list
             read as refused. */
          aria-disabled={known !== undefined || locked === true ? true : undefined}
          aria-required={required}
          aria-invalid={countryInvalid}
          /* What is wrong with it, or why it is held, and never the rule that
             belongs to the town beside it: given the whole of that, the country
             was read out as „Država, od drugog slova portal nudi mesta iz
             svetskog šifarnika...", which is a rule about the other control. */
          /* Nothing to describe while it is switched off: the sentence that
             stood here went on 23.08.2026 with the control it explained (owner:
             „Ne ispisuje se poruka Mesto je iz šifarnika, pa državu nosi sa
             sobom."), because it was drawn under the box and pushed it out of
             line with the town beside it. */
          aria-describedby={countryInvalid ? errorOnly : undefined}
          /* Nothing here refuses the change any more, because the control is
             switched off and a switched-off select is handed neither a change nor
             a keypress. Two guards stood here while it was merely told off, one
             against the pointer and one against the arrow keys; with `disabled`
             they became branches nothing could reach, and an unreachable branch is
             a claim nothing checks. */
          onChange={(event) => {
            /* Refused where the form is locked, and there the control is not
               switched off: `disabled` covers only the town from the codebook, so
               a locked form left this reachable, told off in words and writing
               straight through. Measured by a review on 23.08.2026: the country
               of a locked form changed by keyboard alone.

               The one that is switched off needs no guard here and gets one all
               the same by standing in the same condition, because a browser that
               hands a `disabled` control no event is a courtesy and not a rule.
               */
            if (locked === true) {
              return
            }

            onChange(value, event.target.value)
          }}
        >
          <CountryOptions holding={country} />
        </select>
      </span>

    </div>
  )
}
