import type { FormDef } from '../../forms/types'

/**
 * THE TWO KINDS OF EVENT THAT CANNOT BE SWAPPED FOR ONE ANOTHER WHILE THE EVENT HAS A RESULT.
 *
 * <p>Owner, 14.11.2026 (PDL, „Ostale discipline kao lična evidencija", second round of questions on the
 * plan, decision 6): „Vrsta događaja koji ima ijedan rezultat ne može da se promeni između Bodovane i
 * Nebodovane trke dok rezultati stoje; greška se ispravlja brisanjem i ponovnim unosom." Chosen against
 * the coordinator's recommendation, which was to allow it with a question that carries the number of
 * results. A result of a scored race carries points and an unscored one carries none, so a swap would
 * have to compute them or throw them away, and the owner chose to refuse it.
 *
 * <p>**Not a decision about a training or a gathering.** Changing to either still deletes the races with
 * a question that carries the number of results (owner, 07.11.2026, PR 724), and both stay on the list.
 * Said as the two words and nothing else, so an event of any other kind is never touched by this.
 */
const SWAPPING = ['race', 'unscored']

/**
 * WHETHER THE KIND OF AN EVENT IS HELD: it is a scored or an unscored race and a result stands at it.
 *
 * <p>Asked in one place for the two things that follow from it, the list the form offers
 * (`formWithTheKindHeld`) and the sentence the screen says beside it (`admin.kindHeldNote`), so the two cannot
 * disagree about whether it is held.
 *
 * @param stored the kind the event has on the server
 * @param results how many results stand at the races of the event
 */
export function kindIsHeld(stored: string, results: number): boolean {
  return results > 0 && SWAPPING.includes(stored)
}

/**
 * THE EVENT FORM WITH ITS KIND HELD BETWEEN A SCORED AND AN UNSCORED RACE, where the event has a
 * result.
 *
 * <p>**The other of the two is taken out of the list and not left in to be refused.** The server refuses
 * it all the same (`aKindWithResultsDoesNotChange`, and `eventWrites.ts` has the sentence for it), so a
 * screen one release behind still says something true; this is the half that stops the reader before he
 * presses. What he is told is a sentence of the screen (`admin.kindHeldNote`) and not a rule carried by the
 * field (`hintKey`): the owner kept the rules the portal carries at a closed list of them on 31.08.2026, and
 * `forms/fieldHint.test.tsx` refuses a new one, so this is not asked to be one.
 *
 * <p>**Handed the form and not built from the entity**, so a copy's form (which asks no kind at all,
 * `AdminEvents.tsx`) goes through the same road and comes back as it was: a form without a field of the
 * kind has nothing to hold. The SAME object comes back wherever nothing is held, which is what lets the
 * screen hand it on without a form that is a new object at every drawing.
 *
 * @param form the form the screen is about to draw
 * @param stored the kind the event has on the server, and not the one typed into the form: what is
 *        typed may be a training the reader has not saved yet, and a result stands under the stored one
 * @param results how many results stand at the races of the event
 */
export function formWithTheKindHeld(form: FormDef, stored: string, results: number): FormDef {
  if (!kindIsHeld(stored, results)) {
    return form
  }

  return {
    ...form,
    fields: form.fields.map((field) =>
      field.name === 'kind'
        ? {
            ...field,
            options: field.options?.filter(
              (option) => option.value === stored || !SWAPPING.includes(option.value),
            ),
          }
        : field,
    ),
  }
}
