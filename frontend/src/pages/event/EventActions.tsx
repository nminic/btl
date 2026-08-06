import { Link, useNavigate } from 'react-router'
import { useToday } from '../../clock/useClock'
import type { BtlEvent, Race, Result } from '../../data/types'
import { fieldDate } from '../../forms/dateField'
import { RESULTS } from '../../data/useResource'
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
export function EventActions({
  event,
  races,
  results,
}: {
  event: BtlEvent
  races: Race[]
  results: Result[]
}) {
  const { locale, t } = useI18n()
  const may = useMay()
  const { memberNumber, creations, create, remove } = useSession()
  const navigate = useNavigate()
  const today = useToday()

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
    /* Counted against the copies of this event and not against its races, which
       is what it was: the number of races does not change when a copy is made,
       so pressing the button twice made two records under one id. Two records
       under one id is the fault the whole numbering module exists to prevent
       (entityForms.ts): the list draws them under one key, a lookup finds only
       the first, and an edit to either changes both. */
    const made = (creations[EVENTS.id] ?? []).filter((one) => one.id.startsWith(`${event.id}-kopija`))
    const id = `${event.id}-kopija-${made.length + 1}`

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
      /* Counted against the copies of this race, not against the copies of the
         event. Deleting a copied event from the list of events takes it out of
         the events it was created in and leaves its races where they are, so a
         count of event copies goes back down while the races do not: copy,
         delete the copy, copy again, and every race lands on an id that is
         already taken. */
      const before = (creations[RACES.id] ?? []).filter((one) =>
        one.id.startsWith(`${race.id}-kopija`),
      ).length

      create(RACES.id, `${race.id}-kopija-${before + 1}`, {
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

    /* And what hangs off it. A result carries the address of its event, so
       without this the event left the calendar and its results went on counting
       in the standing, in the Top 10 boards and in the team totals, each of them
       still linking to a page that now says the event does not exist. */
    for (const result of results.filter((one) => one.eventSlug === event.slug)) {
      remove(RESULTS, result.id)
    }

    remove(EVENTS.id, event.id)
    void navigate(`/${locale}/kalendar?mesec=${event.date.slice(0, 7)}`)
  }

  if (!mayEdit && memberNumber === null) {
    return null
  }

  return (
    /* The row's own second child, so a visitor with nothing to press leaves the
       row with one child rather than an empty box centred against the name
       (Rankings.css). The component already knows whether it draws anything;
       wrapping it outside meant the wrapper was drawn either way. */
    <div className="event__actions rankings__head-tool">
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
      {/* Nothing to report on a race that has not been run. PDL P9 is plain
          about it: a date in the future is refused, and the date here is the
          event's own, so the only way to keep that rule is not to offer the
          form at all. */}
      {memberNumber !== null && event.date <= today && (
        /* A link and not a button, like everything else on the portal that
           leads somewhere: a button has no middle click, no "open in a new
           tab", no address in the status bar, and is announced as a button by
           a screen reader when it is a way to another screen. */
        <Link className="button button--primary" to={`/${locale}/kalendar/${event.slug}/prijava`}>
          {t('event.report')}
        </Link>
      )}
    </div>
  )
}
