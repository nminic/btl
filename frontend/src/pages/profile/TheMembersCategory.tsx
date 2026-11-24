import { FIRST_SEASON_POINTS, categoryLabel } from '../../data/categories'
import { useI18n } from '../../i18n/useI18n'
import { ServerSaid } from '../account/ServerSaid'
import { addressOfTheCategory } from '../member/myCategory'
import { useTheCategoryAt } from '../member/useMyCategory'

/**
 * THE CHOICE OF A MEMBER'S CATEGORY ON HIS CARD „PODACI", AS THE ADMINISTRATION OVER THE MEMBERS SEES IT.
 *
 * <p>Owner, 24.11.2026 (PDL, „Administracija bira kategoriju članu u njegovim podacima, a u prijavi je
 * starosna podrazumevana"): „Ma hocu da imam izbor u podacima clana koje vidim sa njegove strane (edit, ili
 * kad sa profila kliknem na podaci)". Both roads lead to this card (`CompetitorData.tsx`). The rule beside it
 * is the assistant's derivation: the same rules as the member's own choice on „Moja članarina". So:
 *
 * <ul>
 * <li><b>The box is the member's own box, wired the same way</b> (`member/Membership.tsx`): the same hook
 * (`useTheCategoryAt`), the same two options, the beginners' one held where the server says it is closed to
 * him, both held once the deadline has passed, and the press saves at once, with every failure said
 * (owner, 25.10.2026, „Izbor kategorije kaže svaki neuspeh").</li>
 * <li><b>What differs is only who is addressed.</b> The member's sentences say „ti" to the reader, and here
 * the reader is the administration, so the legend, the sentence about the closed category and the one about
 * the category he runs in are said about him. Those three are the assistant's words, for the owner to change
 * on QA. The options are the registration's own words („Starosna", „Početnička"), because this card is the
 * registration's form.</li>
 * <li><b>A section of its own under the form, and not a field of it</b>: the form saves with „Sačuvaj"
 * through `PUT /api/members/{memberNumber}/data`, and this choice has a deadline and a route of its own
 * (`MemberCategoryApi`), the shape of the picture and the words on the same card.</li>
 * </ul>
 *
 * <p>Drawn only where the server answers it, which is the administration over the members, exactly as the
 * member's box is drawn only where his read comes back.
 */
export function TheMembersCategory({ memberNumber }: { memberNumber: string }) {
  const { t } = useI18n()
  const { standing, choosing, refusal, failure, choose } = useTheCategoryAt(
    addressOfTheCategory(memberNumber),
    memberNumber,
  )

  if (standing === null) {
    return null
  }

  return (
    <section className="member__panel">
      <fieldset className="renewal">
        <legend>{t('memberData.categoryFor', { season: standing.season })}</legend>

        <div className="field field--checkbox">
          <div className="field__confirm">
            <input
              className="field__control"
              type="radio"
              id="members-cat-age"
              name="members-category"
              checked={!standing.firstSeason}
              disabled={!standing.open || choosing}
              onChange={() => void choose(false)}
            />
            <label className="field__label" htmlFor="members-cat-age">
              {t('registration.categoryByAge')}
            </label>
          </div>
        </div>

        <div className="field field--checkbox">
          <div className="field__confirm">
            <input
              className="field__control"
              type="radio"
              id="members-cat-first"
              name="members-category"
              checked={standing.firstSeason}
              disabled={!standing.firstSeasonAllowed || !standing.open || choosing}
              onChange={() => void choose(true)}
            />
            <label className="field__label" htmlFor="members-cat-first">
              {t('registration.categoryFirstSeason')}
            </label>
          </div>
        </div>

        {/* WHY THE BEGINNERS' OPTION IS HELD, the member's own sentence said about him (`firstSeasonClosed`). */}
        {!standing.firstSeasonAllowed && (
          <p className="member__note">{t('memberData.categoryClosed', { points: FIRST_SEASON_POINTS })}</p>
        )}

        {/* WHAT HE ACTUALLY RUNS IN, the wish AND the right (`category`), as on his own page. */}
        <p className="member__note">
          {t('memberData.categoryHeRunsIn', {
            season: standing.season,
            category: categoryLabel(standing.category, t),
          })}
        </p>

        {refusal !== null && (
          <p className="member__note" role="status">
            {t('membership.choiceRefused')}
          </p>
        )}

        {failure !== null && <ServerSaid answer={failure} refusals={{}} />}
      </fieldset>
    </section>
  )
}
