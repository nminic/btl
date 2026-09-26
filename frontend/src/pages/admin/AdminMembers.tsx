import { ProfileLink } from '../profile/ProfileLink'
import { categoryLabel } from '../../data/categories'
import { useState } from 'react'
import { Resource } from '../../components/Resource'
import { clearResourceCache } from '../../data/client'
import { categoryOfMember } from '../../data/derive'
import type { Competitor } from '../../data/types'
import { useCompetitors } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { DeleteRecord } from './EntityEditor'
import { MEMBERS, recordsOf } from './entityForms'
import { DELETE_THE_ACCOUNT, WHEN_DELETING_A_MEMBER } from './memberWrites'
import { useOverlay } from './overlay'
import '../member/Member.css'

/** Where the focus goes once a row is gone, which on this screen is the one
 *  control that cannot be the row just deleted. The other six lists anchor on
 *  „Nov …" (`EntityEditor.NEW_RECORD_ID`); this one has no such button any
 *  more, so the search field is the anchor and carries an id for it. */
const SEARCH_ID = 'members-search'

/* The list of members, with the one thing that is not public about them: on what
 * basis their membership is active, which is kept off every public screen and
 * shown only here, to staff with rights over members (PDL P8, P11, P23).
 *
 * **It was two until 13.09.2026**, the other being the year each member was born.
 * That sentence was true about the screen and false about the portal, and the
 * difference is the whole reason the column is gone: this screen reads the same
 * `competitors` file as every public one, and that file is served to anybody who
 * asks for its address, signed in or not (ADL A8). Drawing a field only behind a
 * sign-in does not make it private when the record carrying it is public, so the
 * year has left the record and not merely this table (`data/types.ts`).
 *
 * ---
 *
 * **THIS SCREEN SENDS ONE VERB, AND THE OTHER TWO IT USED TO OFFER ARE GONE
 * RATHER THAN MOVED (26.09.2026).** It kept everything as a session overlay until
 * today. Of the three things it did, exactly one has a route to do it through, and
 * the boundary is written here rather than left for the next reader to rediscover
 * by pressing a button that lies to him.
 *
 * Measured over `backend/src/main/java`, which declares three (verb, address)
 * pairs for a member and no `PUT` among them:
 *
 * 1. **Deleting sends `DELETE /api/competitors/{memberNumber}`** and is the whole
 *    of what this file has anything to say about.
 *
 * 2. **„Nov član" is gone, because the route that looks like its home is a
 *    different act.** `POST /api/competitors` is the GROUP entry that sends
 *    invitations (PDL P8b, 25.09.2026, owner: „Dugme za unos clana u
 *    administraciji je **grupni unos koji salje pozivnice**"), and it refuses to
 *    make an account at all: the invited man sets his own password through a link
 *    and takes the account over himself. It is also not a shape this form could
 *    fill. `CompetitorWriteApi.Invited` takes eighteen fields and
 *    `admin-clan.form.json` has nine, six of which overlap; the form has **no
 *    email address at all**, which is the one field the invitation cannot be sent
 *    without, and it asks for `membershipBasis`, which the route refuses from a
 *    form and pins to `payment` because exemption is the owner's to grant. So the
 *    button did not lose a route, it never had one, and its replacement is a
 *    screen of its own.
 *
 * 3. **„Otvori" and the town cell are gone, because there is no `PUT`.** This is
 *    the boundary `admin/AdminModerators.tsx` already states in its own words and
 *    that `entityForms.test.tsx` already carries for a moderator: a row with
 *    nothing to write back has nothing to open. A cell that took a correction and
 *    kept it for the length of one visit is the exact fault this whole increment
 *    closes, one entity along.
 *
 * **The session overlay is still READ, and that is deliberate.** Six other places
 * write a member into it through `editRecord` and none of them has a route yet
 * (`AdminTeams.tsx:398`, `PendingQueue.tsx:419`, `InvitationAnswer.tsx:140`,
 * `Settings.tsx:140`, `TeamDetail.tsx:286,387`). A screen that stopped reading the
 * overlay would show a member the stale team he was just moved out of two screens
 * away, so the overlay stays where it is until those move too.
 *
 * **And the deletion is written to the session only once the server has confirmed
 * it**, never on the strength of a press: `session.remove` is what
 * `admin/memberNumbers.ts` reads to know which numbers are free again, so a
 * removal written early would hand the next activated membership a number the
 * database still holds.
 */
export function AdminMembers() {
  const { t } = useI18n()
  const overlay = useOverlay()
  const { remove } = useSession()
  const [search, setSearch] = useState('')
  const state = useCompetitors()

  /** What just happened, for whoever is not watching the list. */
  const [said, setSaid] = useState('')

  /** Why a deletion did not happen, beside the row it was pressed on. */
  const [refused, setRefused] = useState<{
    memberNumber: string
    answer: Exclude<Answer, { got: 'done' }>
  } | null>(null)

  /**
   * TAKING A MEMBER AWAY, ACCOUNT AND ALL.
   *
   * PDL P23, 14.09.2026: „Prvo se odluci sta sa nalogom (anonimizuje se ili se
   * brise), pa tek onda clan moze da ode." The word is always
   * {@link DELETE_THE_ACCOUNT}: the route accepts the other one and refuses it by
   * name, so offering a choice here would be offering a 409.
   *
   * Nothing on this screen asks whether he administers the portal or whether his
   * team is left empty. The route decides both - the first by refusing
   * (`THE_ACCOUNT_ADMINISTERS`), the second by taking the team with him when he
   * was its last member - and a screen that refused first would be a second rule
   * over a decision already taken.
   */
  async function deleteOne(one: Competitor): Promise<void> {
    const answer = await askTheServer(
      `/api/competitors/${one.memberNumber}?account=${DELETE_THE_ACCOUNT}`,
      {},
      'DELETE',
    )

    if (answer.got !== 'done') {
      setRefused({ memberNumber: one.memberNumber, answer })

      return
    }

    /* BOTH, AND THE SECOND IS NOT DECORATION. A member who was the last of his
       team takes the team with him (`CompetitorWriteApi`, and PR 367), so a
       screen of teams remounted after this would otherwise draw a team the
       server has already forgotten. Counted rather than copied off another
       screen: the moderators clear one and the teams clear two. */
    clearResourceCache('competitors')
    clearResourceCache('teams')
    setRefused(null)
    setSaid(t('admin.memberGone'))

    /* ONLY HERE, INSIDE THE BRANCH THE ANSWER APPROVED. `memberNumbers.ts` reads
       `deletions[MEMBERS.id]` to work out which numbers are free, so this written
       early would free a number the database still holds and hand it to the next
       activated membership. */
    remove(MEMBERS.id, one.memberNumber)
  }

  return (
    <div className="member">
      {/* The name of the screen is in the navigation beside it and in the
          browser tab (owner, 30.07.2026). It stays in the markup so the page
          has a name for anyone who cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t('admin.members')}</h1>

      <Resource state={state}>
        {(competitors) => {
          const all = recordsOf(MEMBERS, competitors, overlay)
          const needle = search.trim().toLowerCase()
          const rows = all.filter((one) =>
            `${one.firstName} ${one.lastName} ${one.memberNumber} ${one.city}`
              .toLowerCase()
              .includes(needle),
          )

          return (
            <>
              {/* Not `EntityBar`, which always draws a „Nov …" button beside the
                  filter and there is nothing behind one here - the same reason
                  `AdminModerators.tsx` cannot use `RowActions`. */}
              <div className="entity-bar">
                <div className="entity-bar__filters">
                  <div className="rankings__filters">
                    <label className="rankings__field rankings__field--wide" htmlFor={SEARCH_ID}>
                      <span>{t('competitors.search')}</span>
                      <input
                        id={SEARCH_ID}
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <p className="rankings__count">{t('competitors.count', { count: rows.length })}</p>

              <div className="table-scroll">
                <table className="table">
                  <caption className="visually-hidden">{t('admin.members')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('competitors.columns.member')}</th>
                      {/* The category, and no column of years beside it. This table
                          printed the year of birth of every member until 13.09.2026,
                          and it was drawn from the same public file every other screen
                          reads (ADL A8): administration was where it was shown, not
                          where it was kept. Član 74 allows the category and nothing
                          finer, so the category is the whole of what stands here. */}
                      <th scope="col">{t('competitors.columns.category')}</th>
                      <th scope="col">{t('competitors.columns.city')}</th>
                      <th scope="col">{t('admin.basis')}</th>
                      <th scope="col">{t('admin.form.record')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((one) => (
                      <tr key={one.memberNumber}>
                        <td>
                          <ProfileLink competitor={one}>
                            {one.firstName} {one.lastName}
                          </ProfileLink>{' '}
                          <span className="table__member-number">{one.memberNumber}</span>
                        </td>
                        <td>{categoryLabel(categoryOfMember(one), t)}</td>
                        {/* Read, not edited in place - see the note at the top of
                            this file for why there is no route to write it back. */}
                        <td>{one.city}</td>
                        <td>
                          <span className={`tag tag--${one.membershipBasis}`}>
                            {t(`admin.basisValue.${one.membershipBasis}`)}
                          </span>
                        </td>
                        <td>
                          <span className="entity-row-actions">
                            <DeleteRecord
                              name={`${one.firstName} ${one.lastName}`}
                              onDelete={() => {
                                /* The row about to go is where the focus is, moved
                                   before the answer is back exactly as
                                   `RowActions.deleteRow` moves it for the entities
                                   that still use it. A refusal is said in a live
                                   region rather than by putting the focus back
                                   somewhere it has already left. */
                                document.getElementById(SEARCH_ID)?.focus()
                                void deleteOne(one)
                              }}
                            />
                          </span>
                          {refused !== null && refused.memberNumber === one.memberNumber && (
                            <ServerSaid
                              answer={refused.answer}
                              refusals={WHEN_DELETING_A_MEMBER}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Said once and politely, the same shape `AdminLeagues.tsx` uses: the
                  focus has already moved, so a reader who is not looking at the list
                  gets the one sentence that says what just left it. */}
              <p aria-live="polite" className="visually-hidden">
                {said}
              </p>
            </>
          )
        }}
      </Resource>
    </div>
  )
}
