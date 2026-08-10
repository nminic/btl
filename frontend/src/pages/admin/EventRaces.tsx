import { useMemo } from 'react'
import { isoDate } from '../../forms/dateField'
import { formatNumber, formatShortDate } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import type { BtlEvent, Race } from '../../data/types'
import { EntityBar, EntityEditor, RowActions } from './EntityEditor'
import { racesOf, type Editing } from './entityForms'
import './Entity.css'

/**
 * The races of one event, on the event's own screen.
 *
 * A race is one length of one morning, so it is defined inside the event and
 * nowhere else (owner, 06.08.2026). It had a screen of its own, which meant a
 * list of one thousand one hundred and eighty-seven rows opened in order to
 * find the event somebody already had open, and a race made there could be
 * saved against the wrong one.
 *
 * Which event it belongs to is therefore not asked. The screen already answers
 * that, and a question whose answer is on the page above it is a question with
 * a wrong answer available (entityForms.ts, `racesOf`).
 */
export function EventRaces({
  event,
  races,
  editing,
  setEditing,
}: {
  event: BtlEvent
  races: Race[]
  /** Which race is open, held by the screen above rather than here: while one
   *  is open the event's own form is put away, and two forms with two save
   *  buttons on one screen is two questions asked at once. */
  editing: Editing | null
  setEditing: (editing: Editing | null) => void
}) {
  const { locale, t } = useI18n()
  const { editRecord } = useSession()
  /* Held across renders. Every other screen hands the renderer a definition made
     once at module level; this is the only one that builds its own, since the
     form is the races' form with the event taken out of it and put back as a
     derived field, which cannot be known before the screen knows its event.
     Nothing depends on that identity today, and the memo is here so that nothing
     has to: a definition rebuilt on every keystroke is the sort of prop a memo
     downstream is one day written against. */
  const entity = useMemo(
    () => racesOf(event.id, event.name, event.date),
    [event.id, event.name, event.date],
  )
  const mine = races
    .filter((race) => race.eventId === event.id)
    /* By the day first and the distance inside it, which is the order they are
       run in: an event over two mornings reads as two mornings. */
    .sort((left, right) => left.date.localeCompare(right.date) || left.distanceKm - right.distanceKm)

  if (editing !== null) {
    return (
      <section className="entity-races" aria-labelledby="races-of-event">
        <h2 id="races-of-event" className="profile__section">
          {t('admin.racesOf', { event: event.name })}
        </h2>

        <EntityEditor
          entity={entity}
          editing={editing}
          /* The event follows its first race (owner, 10.08.2026): its date is
             the day it begins, so a race entered or moved to an earlier day
             makes that day the event's. Written here rather than in the race's
             own form, because it is a fact about the event and the form knows
             only the race.

             The other way round is not done here: a race moved later leaves the
             event where it is, because some other race is still the first one,
             and where it was the only race the event moves with it. */
          alsoSave={(values) => {
            const day = isoDate(String(values.date))
            const others =
              editing.mode === 'new'
                ? mine
                : mine.filter((race) => race.id !== String(editing.record[entity.idField]))
            const first = [...others.map((race) => race.date), day].sort()[0]

            if (first !== undefined && first !== event.date) {
              editRecord(event.id, { date: first })
            }
          }}
          onDone={() => setEditing(null)}
        />
      </section>
    )
  }

  return (
    <section className="entity-races" aria-labelledby="races-of-event">
      <h2 id="races-of-event" className="profile__section">
        {t('admin.racesOf', { event: event.name })}
      </h2>

      {/* What opening a race costs, said before it is pressed. The event's own
          form is put away while a race is open (AdminEvents.tsx), and a form
          that is put away takes whatever was typed into it with it: an
          administrator who changed the town and then reached for a distance
          found the town back as it was. Said rather than solved, because
          keeping two forms open is two save buttons and two questions at
          once. */}
      <p className="profile__empty">{t('admin.racesPutFormAway')}</p>

      <EntityBar entity={entity} onNew={() => setEditing({ mode: 'new' })} />

      {mine.length === 0 ? (
        /* Said rather than left as an empty table. An event with no races yet is
           the ordinary state of one entered a fortnight before its distances are
           known (reportResult.test), not a fault. */
        <p className="profile__empty">{t('admin.noRaces')}</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <caption className="visually-hidden">
              {t('admin.racesOf', { event: event.name })}
            </caption>
            <thead>
              <tr>
                <th scope="col">{t('admin.raceName')}</th>
                {/* The day, because an event may run over more than one (owner,
                    10.08.2026). Beside the name rather than at the end: it is
                    the thing that differs between two races of one weekend. */}
                <th scope="col">{t('admin.field.raceDate')}</th>
                <th scope="col">{t('event.distance')}</th>
                <th scope="col">{t('event.ascent')}</th>
                <th scope="col">{t('event.descent')}</th>
                <th scope="col">{t('event.category')}</th>
                <th scope="col">{t('admin.form.record')}</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((race) => (
                <tr key={race.id}>
                  <td>{race.name}</td>
                  <td>{formatShortDate(race.date, locale)}</td>
                  {/* Written the way this language writes a number, like every
                      other table on the portal: read raw, a climb of 7120 metres
                      is printed as four digits and a distance of 42.2 km with a
                      full stop, neither of which is Serbian. */}
                  <td>{formatNumber(race.distanceKm, locale, 2)}</td>
                  <td>{formatNumber(race.ascentM, locale)}</td>
                  <td>{formatNumber(race.descentM, locale)}</td>
                  <td>{t(`category.${race.category}`)}</td>
                  <td>
                    <RowActions
                      entity={entity}
                      record={race}
                      name={race.name}
                      onOpen={() => setEditing({ mode: 'one', record: race })}
                      /* And the event follows what is left, the same way it
                         follows a race entered or moved: taking the first
                         morning away moves the event onto the next one, and an
                         event dated on a morning nothing runs on is the rule
                         broken from the other end (owner, 10.08.2026). */
                      alsoRemove={() => {
                        const left = mine
                          .filter((each) => each.id !== race.id)
                          .map((each) => each.date)
                          .sort()[0]

                        if (left !== undefined && left !== event.date) {
                          editRecord(event.id, { date: left })
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
