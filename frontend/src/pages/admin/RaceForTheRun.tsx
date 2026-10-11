import { useMemo } from 'react'
import { useToday } from '../../clock/useClock'
import { raceKind } from '../../data/raceKind'
import { combinePair, useEvents, useRaces } from '../../data/useResource'
import { AskedLabel, RequiredNote } from '../../forms/AskedLabel'
import { dogadjaj, unosRezultata } from '../../forms/definitions'
import { limitOf, optionsFor } from '../../forms/records'
import { Suggesting } from '../../forms/Suggesting'
import { useI18n } from '../../i18n/useI18n'
import { racesToOffer } from '../member/racesToOffer'
import {
  EVENT_NAME,
  figuresFor,
  RACE_KIND,
  RACE_NAME,
  theApproval,
  timeIsNought,
  whatIsWrong,
  type Placing,
} from './placingTheRace'
import type { Answered } from './verificationWrites'

/**
 * THE PANEL THAT NAMES THE RACE OF A RUN THE CALENDAR DOES NOT HOLD, AND APPROVES IT ON THAT RACE
 * (R3b of the results flows).
 *
 * <p>The owner's answer of 10.10.2026, in the record's wording: „red NOVO se odobrava samo kroz
 * panel u kom se upisuje ili bira trka". Typed into the race's name, the list of races the
 * calendar holds opens, the list the member's own form offers; a race chosen from it is the race
 * the run is counted on, and it answers for what it fixes, so only what it leaves to the runner
 * is asked. With none chosen, the race is the one the approval makes: its event's name and its
 * kind are asked as well, and all four figures, because the race is made of them. What `decide`
 * decides is in `placingTheRace.ts`; this draws it.
 *
 * <p><b>The day and the town are the member's and are not asked</b>: the decision of 30.08.2026
 * names what verification changes, „naziv događaja, naziv trke, vrstu i vreme", and they are not
 * among it (the derivation recorded for the owner with R3, item 13). The town stands on the row,
 * which is where the owner asked the moderator to see it.
 *
 * <p><b>„Odustani" answers nothing while the approval is out</b>, and the portal's own sentence for
 * a request that is out stands under the buttons: the owner's decision of 02.10.2026 for every box
 * that sends something, which the panel beside it keeps for the same reason (`AmendPanel` in
 * `ReviewQueue.tsx`). The caller closes the panel when the answer arrives, whichever it is.
 */
export function RaceForTheRun({
  placing,
  deciding,
  working,
  onChange,
  onApprove,
  onCancel,
}: {
  placing: Placing
  deciding: boolean
  /** Whether the decision about the run this panel is open over is out with the route. */
  working: boolean
  onChange: (next: Placing) => void
  onApprove: (answered: Answered) => void
  onCancel: () => void
}) {
  const { locale, t } = useI18n()
  const today = useToday()
  const events = useEvents()
  const races = useRaces()
  /* The list as the member's form builds it, once for the data and not on every letter typed,
     and empty until both files are here (`member/NewResult.tsx` says why both). */
  const offered = useMemo(
    () =>
      events.status === 'ready' && races.status === 'ready'
        ? racesToOffer(events.data, races.data, today, locale)
        : [],
    [events, races, today, locale],
  )
  /* The two files as one read, so a list that could not be read SAYS so under the box, with the
     way to ask again, rather than passing for a calendar with no race in it (decision of
     03.10.2026, `forms/types.ts`, `UnreadableList`). */
  const offering = combinePair(events, races)
  const known = races.status === 'ready' ? races.data : []
  const asked = figuresFor(placing, known)
  const errors = whatIsWrong(placing, known)
  const wrong = [...errors.values()][0] ?? null
  /* The box before the sum, for the reason the panel beside this gives: a box holding a word
     makes the sum say „no time" about a problem nobody has. */
  const waits = wrong !== null || timeIsNought(placing, known)

  return (
    <div className="review__reason" role="group" aria-label={t('review.placeTitle')}>
      <p className="profile__empty">{t('review.placeNote')}</p>

      <RequiredNote />

      {RACE_NAME.map((field) => (
        <div className="rankings__field" key={field.name}>
          <AskedLabel id="place-raceName">{t(field.labelKey)}</AskedLabel>
          <Suggesting
            shared={{
              id: 'place-raceName',
              name: field.name,
              maxLength: limitOf(unosRezultata, field.name),
              'aria-required': true,
              'aria-invalid': errors.has(field.name),
            }}
            value={placing.raceName}
            suggestions={offered}
            unreadable={
              offering.status === 'error' ? { said: t('data.error'), named: t('event.races'), read: offering } : undefined
            }
            /* Typing over a chosen race lets go of it (owner, 23.08.2026, for the member's form):
               a name typed freely is a race the approval makes, not the one that was chosen. */
            onType={(next) => onChange({ ...placing, raceName: next, chosen: null })}
            onChoose={(one) =>
              onChange({ ...placing, raceName: one.value, chosen: { raceId: Number(one.id), said: one.said } })
            }
          />
        </div>
      ))}

      {/* Which race it is, said in the words the list chose it by: its day and its measure, which
          is what tells one race of a name from another and what the run is counted on. */}
      {placing.chosen !== null && <p className="rate__hint">{t('review.chosenRace', { race: placing.chosen.said })}</p>}

      {placing.chosen === null &&
        EVENT_NAME.map((field) => (
          <div className="rankings__field" key={field.name}>
            <AskedLabel id="place-eventName">{t(field.labelKey)}</AskedLabel>
            <input
              id="place-eventName"
              type="text"
              maxLength={limitOf(dogadjaj, field.name)}
              aria-required="true"
              aria-invalid={errors.has('eventName')}
              value={placing.eventName}
              onChange={(event) => onChange({ ...placing, eventName: event.target.value })}
            />
          </div>
        ))}

      {placing.chosen === null &&
        RACE_KIND.map((field) => (
          <div className="rankings__field" key={field.name}>
            <AskedLabel id="place-raceKind">{t(field.labelKey)}</AskedLabel>
            <select
              id="place-raceKind"
              aria-required="true"
              value={placing.kind}
              onChange={(event) => onChange({ ...placing, kind: raceKind(event.target.value) })}
            >
              {optionsFor(field, {}).map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>
        ))}

      {/* On a race to a limit the time is the race's limit and not the runner's (PDL P9, 30.08.2026,
          in the record's wording: „polja za vreme znače ograničenje trke, ne vreme koje je član
          istrčao"), said where the boxes are, because nothing else about them changes. */}
      {placing.chosen === null && placing.kind === 'time' && <p className="rate__hint">{t('review.limitNote')}</p>}

      {asked.map(({ name, field }) => (
        <div className="rankings__field" key={name}>
          <AskedLabel id={`place-${name}`}>{t(field.labelKey)}</AskedLabel>
          <input
            id={`place-${name}`}
            type="text"
            inputMode={field.integer === true ? 'numeric' : 'decimal'}
            aria-required="true"
            aria-invalid={errors.has(name)}
            value={placing.written[name]}
            onChange={(event) => onChange({ ...placing, written: { ...placing.written, [name]: event.target.value } })}
          />
        </div>
      ))}

      <div className="member__links">
        <button
          type="button"
          className="button button--primary"
          aria-disabled={waits || deciding}
          aria-describedby={waits ? 'place-waits' : undefined}
          onClick={() => {
            /* Reachable means pressable, so the refusal lives here as well as on the attribute;
               a decision already out is held back by `decide`, as for every button of the queue. */
            if (waits) {
              return
            }

            onApprove(theApproval(placing, known))
          }}
        >
          {t('review.placeSave')}
        </button>
        <button
          type="button"
          className="button button--secondary"
          aria-disabled={working ? true : undefined}
          onClick={() => {
            /* PUT AWAY ONLY WHEN NOTHING IS OUT, for the reason `working` gives. */
            if (working) {
              return
            }

            onCancel()
          }}
        >
          {t('review.cancel')}
        </button>
      </div>

      {working && (
        <p className="rate__hint" role="status">
          {t('results.sending')}
        </p>
      )}

      {waits && (
        <p className="field__error" id="place-waits">
          {wrong === null ? t('newResult.needsTime') : `${t(wrong.label)}: ${t(wrong.said.key, wrong.said.params)}`}
        </p>
      )}
    </div>
  )
}
