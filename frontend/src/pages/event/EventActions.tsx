import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useToday } from '../../clock/useClock'
import { clearResourceCache } from '../../data/client'
import type { BtlEvent, Race, Result } from '../../data/types'
import { RESULTS } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { WHEN_WRITING_AN_EVENT } from '../admin/eventWrites'
import { EVENTS } from '../admin/entityForms'
import { ran } from './ran'
import { useMay } from '../admin/rights'

/**
 * What can be done with an event, from the event's own page.
 *
 * Four things by two kinds of person: whoever has the events changes, copies and
 * deletes, and a competitor who has run the event rates it. They are here rather
 * than in the administration because this is the screen anybody is already looking
 * at when they want them (owner, 03.08.2026). An administrator building next
 * season's calendar is reading last season's events; a competitor who has just run
 * is reading the event they ran.
 *
 * <p><b>Changing is the one of the four that is not done here</b>, and that is
 * written down rather than left to be found. The form lives in the administration
 * and nowhere else, and what this row holds is the way to it (`change`). Owner,
 * 29.09.2026, after „I DALJE NEMAM DUGME ZA IZMENU NA NIVOU DOGADJAJA": he chose,
 * out of three outcomes he was offered, that the form the administration already
 * has is the one that opens, and not a second one drawn on this page. The outcome
 * with a form on this page was put off and not refused, and by the decision of
 * 06.08.2026 (the name and the buttons on one row) it has to stay on the row with
 * the name if it is ever built.
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
  const { memberNumber } = useSession()
  const navigate = useNavigate()
  const today = useToday()
  /** Why the deletion did not happen, where the route refused it. */
  const [refused, setRefused] = useState<Exclude<Answer, { got: 'done' }> | null>(null)

  const mayEdit = may(`entity:${EVENTS.id}`)
  const mine = races.filter((race) => race.eventId === event.id)

  /**
   * THE WAY TO THE FORM THAT CHANGES THIS EVENT, WHICH IS THE ADMINISTRATION'S OWN.
   *
   * <p>Nothing is written here and nothing is copied. The address names the event by its
   * identity, as `copy` below names the one being copied, and `admin/AdminEvents.tsx`
   * finds it in the WHOLE list and opens it for change with its own races beneath it,
   * exactly as if its row had been opened there (`?izmena=`). That is the whole of the
   * decision of 29.09.2026: the form is not drawn a second time.
   *
   * <p><b>A button that navigates and not a link, and that was measured rather than
   * preferred.</b> The two beside it are buttons, and `.button` (`pages/Home.css`) does
   * not reset the font of a `<button>`, so an `a.button` in this row is drawn about ten
   * pixels taller and in type of 16 pixels against 13,3 (Chrome, 29.09.2026). A link is
   * the better element for going somewhere; here it made the three controls uneven, on
   * every event, for everybody who has the events. `copy` below goes to the same screen
   * the same way.
   *
   * <p><b>Two things about it are the implementation's and not the owner's words.</b> The
   * label reads „Izmena", in step with „Kopiranje" and „Brisanje" beside it, which the
   * decision log keeps in step on purpose (its note on the name of the copy button: the
   * name does not change „da bi ostalo u paru sa „Brisanje" pored njega"); the label is
   * derived from that. And it stands first, where the team's page puts Izmeni before
   * Obriši. The decision says the button stands beside the other two and says nothing
   * about its name or its place.
   */
  function change() {
    void navigate(`/${locale}/${EVENTS.path}?izmena=${String(event.id)}`)
  }

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
    /**
     * NOTHING IS WRITTEN HERE ANY MORE, AND THAT IS THE WHOLE CHANGE.
     *
     * <p>This press used to MAKE the copy: an event and a race apiece, filed into the
     * session overlay under identities counted down from nought (`admin/raceIds.ts`),
     * and then the form opened on a record that already existed. None of it was ever on
     * the server, so none of it survived an F5 - the reader filled a whole calendar in
     * and reloaded to find it gone.
     *
     * <p><b>So the address carries the QUESTION now, not the answer.</b> „Copy this
     * event" is all that travels, and `admin/AdminEvents.tsx` opens a NEW form holding
     * what a copy holds (`copyOf`) with this event's mornings beneath it, moved by the
     * same number of days. The record is made by the route when Sačuvaj is pressed, and
     * it is the only thing that makes one.
     *
     * <p><b>The identity in the address is this event's and not the copy's</b>, which is
     * also what tells the screen it is copying at all. A copy is edited again like any
     * other event a season later, and neither the shape of its id nor its `copiedFrom`
     * would still say „copy" then (owner, 23.08.2026, the title at the top).
     */
    void navigate(`/${locale}/${EVENTS.path}?kopija=${String(event.id)}`)
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
  /**
   * THE EVENT AND EVERYTHING THAT BELONGS TO IT, GONE, THROUGH THE ROUTE.
   *
   * <p>One request, because `DELETE /api/events/{id}` is one statement and the schema
   * cascades the rest: `race_event_fk`, `attending_event_fk` and `event_comment_event_fk`
   * from the event, and `result_race_fk` from the race. The three loops that used to stand
   * here filed session deletions instead, and `useLive` reads those
   * (`data/useResource.ts`), so this button took the event off the calendar for the rest of
   * the visit and left the row standing in the database for everybody else.
   *
   * <p><b>It asks first, and that is unchanged</b>: nothing brings any of it back, and
   * deleting an event of five races from a page that shows one of them is easy to do by
   * mistake. What is new is that the answer is now the truth.
   */
  async function erase() {
    if (!window.confirm(t('event.deleteAsk', { name: event.name, count: mine.length }))) {
      return
    }

    const answer = await askTheServer(`/api/events/${String(event.id)}`, {}, 'DELETE')

    if (answer.got !== 'done') {
      setRefused(answer)

      return
    }

    /* All three names, because one statement moved all three. The reader is carried to
       the calendar next, which reads `events` and `races`, and the standings read the
       results; left in the cache, every one of them would go on drawing what this press
       has just taken away. */
    clearResourceCache('events')
    clearResourceCache('races')
    clearResourceCache(RESULTS)
    void navigate(`/${locale}/kalendar?mesec=${event.date.slice(0, 7)}`)
  }

  /* What a member may do here, and half of whether there is a row at all. PDL P9
     refuses a date in the future, and the date here is the event's own: nothing
     to report on a race nobody has run. The day of the race itself counts. */
  const mayAct = memberNumber !== null && event.date <= today

  /* And rating asks for one thing more: a result of their own on this event
     (owner, 11.08.2026), which the form asks again for itself (ran.ts).
     Whoever is signed in comes first, so the number handed to `ran` is a
     number: written the other way round it needed a stand-in for nobody that
     nothing could ever pass. */
  const mayRate =
    memberNumber !== null && mayAct && ran(results, races, event.id, memberNumber)

  /* Nothing here for somebody with nothing to press. Since the report went into
     the table of races, being signed in is no longer enough on its own: the two
     things this row can still hold are the administrator's pair and the rating,
     and the rating asks for more than a session. */
  if (!mayEdit && !mayRate) {
    return null
  }

  return (
    /* The row's own second child, so a visitor with nothing to press leaves the
       row with one child rather than an empty box centred against the name
       (Rankings.css). The component already knows whether it draws anything;
       wrapping it outside meant the wrapper was drawn either way.

       It wears the shared row's control box and nothing of its own. A sheet
       stood here setting flex, wrap and a gap, all three of which
       `.rankings__head-tool` already sets on this same element (Rankings.css);
       the one difference was a smaller gap, written at the same weight as the
       shared one and so settled by whichever sheet the bundle put last, which
       is not a decision anybody made. */
    <div className="rankings__head-tool">
      {mayEdit && (
        <>
          <button type="button" className="button button--secondary" onClick={change}>
            {t('event.edit')}
          </button>
          <button type="button" className="button button--secondary" onClick={copy}>
            {t('event.copy')}
          </button>
          <button type="button" className="button button--secondary" onClick={() => void erase()}>
            {t('event.delete')}
          </button>
          {/* What the route said instead of doing it. The reader is still on the
              event's own page when a deletion is refused - nothing navigated - so
              the sentence belongs here, beside the button he pressed. */}
          {refused !== null && <ServerSaid answer={refused} refusals={WHEN_WRITING_AN_EVENT} />}
        </>
      )}

      {/* „Prijavi rezultat" stood here from 03.08.2026 until 23.08.2026, and it
          asked which race afterwards, in a field at the top of the form. The
          owner had it replaced by a button in every row of the table of races,
          where the race is already decided: „ne treba onda ni dropdown na vrhu
          za izbor trke nego se to zavisi od reda iz kog je kliknuto". One way in,
          and it knows what it is about (EventDetail.tsx). */}

      {/* And what they thought of it (owner, 06.08.2026), where they were there:
          the rating asks about the organisation and the surroundings, which are
          things a member saw on the day, and only somebody with a result on the
          event saw them (owner, 11.08.2026). */}
      {mayRate && (
        <Link className="button button--secondary" to={`/${locale}/kalendar/${event.slug}/ocena`}>
          {t('event.addComment')}
        </Link>
      )}
    </div>
  )
}
