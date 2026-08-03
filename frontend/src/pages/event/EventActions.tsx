import { useNavigate } from 'react-router'
import type { BtlEvent, Race } from '../../data/types'
import { fieldDate } from '../../forms/dateField'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { EVENTS, RACES } from '../admin/entityForms'
import { useMay } from '../admin/rights'
import './EventActions.css'

/**
 * What can be done with an event, from the event's own page.
 *
 * Three things by two kinds of person, and they are here rather than in the
 * administration because this is the screen anybody is already looking at when
 * they want them (owner, 03.08.2026). An administrator building next season's
 * calendar is reading last season's events; a competitor who has just run is
 * reading the event they ran.
 *
 * Who sees what follows the same rights as everything else (rights.ts): the
 * superadmin always, a moderator if they have been given the events, and a
 * member if they are signed in. Nobody sees a control they cannot use.
 */
export function EventActions({ event, races }: { event: BtlEvent; races: Race[] }) {
  const { locale, t } = useI18n()
  const may = useMay()
  const { memberNumber, create, remove } = useSession()
  const navigate = useNavigate()

  const mayEdit = may(`entity:${EVENTS.id}`)
  const mine = races.filter((race) => race.eventId === event.id)

  /**
   * The same event again, with its races, and the form open at the date.
   *
   * Next season's calendar is last season's calendar with the dates moved, and
   * entering an event and its five races again by hand is the work this exists
   * to remove. The date is the one thing that is certainly wrong on a copy, so
   * it is where the cursor lands.
   *
   * The copy is made here and not on the form, because a form cannot copy what
   * it was never given: the races belong to the event and no field on the event
   * form mentions them.
   */
  function copy() {
    const id = `${event.id}-kopija-${mine.length}`

    create(EVENTS.id, id, {
      name: event.name,
      /* The same day, and the form opens on it. Moving it a year forward here
         would be a guess: a race that ran on the last Sunday in April does not
         run on the same date next year, and a date nobody chose looks chosen.
       *
         In the shape the form speaks, dd/mm/gggg, because these are form values
         and everything downstream reads them as such: handing over the stored
         shape left the day empty and the copy answering at an address with no
         date in it. */
      date: fieldDate(event.date),
      city: event.city,
      country: event.country,
      organizer: event.organizer,
      status: event.status,
    })

    for (const race of mine) {
      create(RACES.id, `${race.id}-kopija`, {
        eventId: id,
        name: race.name,
        distanceKm: String(race.distanceKm),
        ascentM: String(race.ascentM),
        descentM: String(race.descentM),
      })
    }

    void navigate(`/${locale}/${EVENTS.path}?zapis=${id}`)
  }

  /**
   * The event and everything that belongs to it, gone.
   *
   * The decision it replaces was that an event is marked cancelled and kept
   * (PDL, 31.07.2026); the owner undid that on 03.08.2026 and asked for a
   * deletion that takes the races with it. It asks first, because nothing brings
   * any of it back, and because deleting an event of five races from a page that
   * shows one of them is easy to do by mistake.
   */
  function erase() {
    if (!window.confirm(t('event.deleteAsk', { name: event.name, count: mine.length }))) {
      return
    }

    for (const race of mine) {
      remove(RACES.id, race.id)
    }

    remove(EVENTS.id, event.id)
    void navigate(`/${locale}/kalendar?mesec=${event.date.slice(0, 7)}`)
  }

  if (!mayEdit && memberNumber === null) {
    return null
  }

  return (
    <div className="event__actions">
      {mayEdit && (
        <>
          <button type="button" className="button button--secondary" onClick={copy}>
            {t('event.copy')}
          </button>
          <button type="button" className="button button--secondary" onClick={erase}>
            {t('event.delete')}
          </button>
        </>
      )}

      {/* A member reports what they ran here, on the event they ran, rather than
          on a form that starts by asking which event it was (owner,
          03.08.2026). Offered to whoever is signed in, including an
          administrator, because an administrator runs too. */}
      {memberNumber !== null && (
        <button
          type="button"
          className="button button--primary"
          onClick={() => void navigate(`/${locale}/kalendar/${event.slug}/prijava`)}
        >
          {t('event.report')}
        </button>
      )}
    </div>
  )
}
