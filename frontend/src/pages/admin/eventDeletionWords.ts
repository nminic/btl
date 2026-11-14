import type { Translate } from '../../i18n/context'

/**
 * WHAT THE SHEET OVER AN EVENT'S DELETION SAYS GOES WITH IT, IN ONE PLACE FOR BOTH SCREENS THAT ASK.
 *
 * <p>The owner, 25.10.2026 (PDL, „Rečenica u prozoru brisanja događaja imenuje i trke i rezultate koji odlaze"): the
 * sentence names the races AND the results, and says it the same on the event's own page (`event/EventActions.tsx`)
 * and on the list of events in the administration (`AdminEvents.tsx`). Each screen counts for itself, through the
 * records it already holds; what they share is the sentence, so the two cannot drift into two wordings of one fact.
 *
 * <p><b>Two plural keys and not one, because the dictionary chooses a form by one number.</b> „Ovim brišeš i 1 trku i
 * 2 rezultata" needs the form of each noun chosen by ITS number, so each is chosen on its own and the sentence puts
 * the two together. The race takes the accusative after „brišeš" (1 trku, 2 trke, 5 trka), which is why this is not
 * `units.raceCount`, whose one form is the nominative „1 trka".
 *
 * <p><b>The races are always known and the results are not.</b> The administration draws without waiting for the
 * results, the largest file the portal has (owner, 28.09.2026), and an approximate number or a nought is what that
 * decision refused. So with `results` absent the races are still named and the results are said to be unknown.
 *
 * <p><b>An event with no race says so in words of its own</b> (owner, 25.10.2026, PDL „Nova pozivnica od
 * administracije i rečenica o trkama: odgovori od 25.10.2026": „Događaj nema trka ni rezultata." in place of
 * „0 trka i 0 rezultata"), and in both states: a result hangs off a race, so an event with none has no
 * result to wait for.
 */
export function whatGoesWith(t: Translate, races: number, results: number | null): string {
  if (races === 0) {
    return t('admin.eventDeleteNothing')
  }

  const racesSaid = t('admin.eventDeleteRaces', { count: races })

  return results === null
    ? t('admin.eventDeleteCountUnknown', { races: racesSaid })
    : t('admin.eventDeleteTakes', { races: racesSaid, results: t('admin.eventDeleteResults', { count: results }) })
}

/**
 * WHAT THE SHEET BEFORE A SAVE SAYS GOES WITH IT, when the save takes the races of an event away (owner,
 * 07.11.2026, PDL „I čuvanje događaja koje briše njegove trke radi isto": „ne čeka da stignu rezultati, nego
 * pre čuvanja pita sa brojem rezultata koji odlaze").
 *
 * <p>The same two counts as the sentence over a deletion and the same two states of the second one, said in
 * a sentence of its own: that one says „i" because the event goes as well, and a save keeps the event. The
 * nouns are the deletion's (`admin.eventDeleteRaces`, `admin.eventDeleteResults`), so a race and a result are
 * the same words on both sheets. Always at least one race: a save that takes none asks nothing.
 *
 * <p>MY REASONING, not the owner's: the wording of the title and of this sentence.
 */
export function whatSaveTakes(t: Translate, races: number, results: number | null): string {
  const racesSaid = t('admin.eventDeleteRaces', { count: races })

  return results === null
    ? t('admin.eventSaveTakesCountUnknown', { races: racesSaid })
    : t('admin.eventSaveTakes', { races: racesSaid, results: t('admin.eventDeleteResults', { count: results }) })
}
