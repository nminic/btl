import { ProfileLink } from '../profile/ProfileLink'
import { categoryCodeFor, categoryLabel } from '../../data/categories'
import { useState } from 'react'
import { Resource } from '../../components/Resource'
import { clearResourceCache } from '../../data/client'
import type { Member } from '../../data/types'
import { combinePair, theInboxHasChanged, useCompetitors, useMembers } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { DeleteRecord } from './EntityEditor'
import { MEMBERS, recordsOf } from './entityForms'
import { DELETE_THE_ACCOUNT, WHEN_DELETING_A_MEMBER } from './memberWrites'
import { useOverlay } from './overlay'
import { offeredFor } from './memberMembership'
import { RowMembership } from './RowMembership'
import { RowPayment } from './RowPayment'
import '../member/Member.css'
import './AdminMembers.css'

/** Where the focus goes once a row is gone, which on this screen is the one
 *  control that cannot be the row just deleted. The other six lists anchor on
 *  „Nov …" (`EntityEditor.NEW_RECORD_ID`); this one has no such button any
 *  more, so the search field is the anchor and carries an id for it. */
const SEARCH_ID = 'members-search'

/**
 * THE THREE VALUES OF THE FILTER, and the first is what the screen opens on.
 *
 * Owner, 21.09.2026 (PDL, „Spisak članova u administraciji”): „Po defaultu je ukljucena Aktivne
 * clanove, ali moze da se promeni u Neaktivne i Sve.” And 18.10.2026 (PDL P8): „Aktivni default
 * filter, mogu ukljuciti i neaktivne ako tako izaberem”. „Svi" is everybody ever given a member
 * number, which is exactly what `GET /api/members` answers, so the filter narrows that list and
 * never widens it; an account never given a number is under none of the three.
 */
const MEMBER_FILTERS = ['active', 'inactive', 'all'] as const

type MemberFilter = (typeof MEMBER_FILTERS)[number]

function passes(one: Member, filter: MemberFilter): boolean {
  return filter === 'all' || one.active === (filter === 'active')
}

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
 * 1. **Deleting sends `DELETE /api/competitors/{memberNumber}`**, and was the whole
 *    of what this file had anything to say about until 18.10.2026. Since that day a
 *    row also records a payment, `POST /api/members/{memberNumber}/payment`
 *    (`RowPayment.tsx`; PDL P8, „Na redu člana u moderaciji: upis uplate za sezonu”),
 *    so the screen sends two verbs and the heading above is about the day it was
 *    written.
 *
 * 2. **„Nov član" is gone, because the route that looks like its home is a
 *    different act.** `POST /api/competitors` is the GROUP entry that sends
 *    invitations (PDL P8b, 25.09.2026, owner: „Dugme za unos clana u
 *    administraciji je **grupni unos koji salje pozivnice**"), and it refuses to
 *    make an account at all: the invited man sets his own password through a link
 *    and takes the account over himself. It is also not a shape this form could
 *    fill. `CompetitorWriteApi.Invited` takes eighteen fields and
 *    `admin-clan.form.json` has eight, six of which overlap; the form has **no
 *    email address at all**, which is the one field the invitation cannot be sent
 *    without, and it asked for `membershipBasis`, which the route never took from a
 *    form because exemption is the administration's to grant (and since V62 a basis
 *    is a membership of a season, which no entry of a person writes; the field is
 *    gone from the form). So the button did not lose a route, it never had one, and
 *    its replacement is a screen of its own.
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
  const { remove, memberNumber: mine } = useSession()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<MemberFilter>('active')
  /* TWO ANSWERS, AND EACH IS READ FOR ONE THING. The rows are `members`, everybody ever given a
     number with his seasons (`MembersApi`). The link to a profile is `competitors`, the public list:
     a member is linked exactly when that list has him, which is the one place the portal says a
     profile can be opened, so a lapsed member's name is plain text here. That last part is MY
     REASONING, by analogy with the owner's rule for the tables of past years („Ime neaktivnog člana
     ostaje vidljivo u istorijskim tabelama te godine, ali kao običan tekst, bez linka”): his profile
     is shown to nobody, so a link to it would open „Ovog profila nema". */
  /* HOW MANY PAYMENTS THIS VISIT HAS RECORDED ON A ROW, and nothing else moves it: a recorded
     payment changes what both answers say about the member it was for, and `useResource` reads once
     as it mounts, so the count is what asks again (`HowToRead.revision`). A remount would do the
     same and would take the filter and the search with it. */
  const [recorded, setRecorded] = useState(0)
  const state = combinePair(useMembers(recorded), useCompetitors(recorded))

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
  async function deleteOne(one: Member): Promise<void> {
    const answer = await askTheServer(
      `/api/competitors/${one.memberNumber}?account=${DELETE_THE_ACCOUNT}`,
      {},
      'DELETE',
    )

    if (answer.got !== 'done') {
      setRefused({ memberNumber: one.memberNumber, answer })

      return
    }

    /* EIGHT, NOT TWO, AND COUNTED AGAINST THE SCHEMA RATHER THAN AGAINST WHAT THIS
       SCREEN HAPPENS TO DRAW. A member who was the last of his team takes the team
       with him (`CompetitorWriteApi`, and PR 367) - that is the two this used to clear -
       but `competitor` has five more foreign keys pointing at it, and every one of them
       is a resource this portal caches for the length of a visit:
       `result.competitor_id` cascades (V7:557), both `racing_pair.man_id` and
       `.woman_id` cascade (V12:114-118), `attending.competitor_id` cascades (V7:594),
       `event_comment.competitor_id` sets null while V33's trigger rewrites `who` to
       `<Obrisani član>`/`<Obrisana članica>` in the same statement (V7:646, V33:89), and
       `verification.competitor_id` cascades (V9:67).

       Left uncleared, none of the five is asked for again this visit - `useResource`
       reads `arrivedResource` once, on mount - so an administrator who deletes a member
       and then opens the standing, a team's pairs, the attendance list, an event's
       comments or the verification queue would go on reading a row for somebody the
       server has already forgotten, and a decision on a verification row would then aim
       at a queue entry the server no longer holds. That is the exact fault PR 367
       closed for `teams`, five resources wide.

       THE EIGHTH IS NOT A FOREIGN KEY (PR 397's review, 27.09.2026). `payments` is a
       DERIVED list rather than a cascade - `PaymentsDueApi.due()` answers an INNER JOIN
       of `membership` onto `competitor` for the season being paid for, so a deleted
       competitor drops out of a fresh answer with nothing in the schema needing to
       cascade. Left cached here, the row would still be drawn, and its `competitorId`
       would be sent to `POST /api/payments` on a press of „Aktiviraj" against a man the
       server no longer has. `payments` was not yet a resource earlier the same day this
       note was written (#382, then #393's PDL section 15), which is the whole reason it
       was left off here.

       `ducats` is the one resource this deletion does NOT touch, and that is measured
       rather than an oversight: `GET /api/ducats` serves the catalogue of tiers
       (`DucatApi:152`, `from ducat`), never `ducat_award`, so nothing a competitor's
       deletion changes is in it. */
    clearResourceCache('members')
    clearResourceCache('competitors')
    clearResourceCache('teams')
    clearResourceCache('results')
    clearResourceCache('pairs')
    clearResourceCache('attendance')
    clearResourceCache('comments')
    clearResourceCache('verification')
    clearResourceCache('payments')
    setRefused(null)
    setSaid(t('admin.memberGone'))

    /* ONLY HERE, INSIDE THE BRANCH THE ANSWER APPROVED. `memberNumbers.ts` reads
       `deletions[MEMBERS.id]` to work out which numbers are free, so this written
       early would free a number the database still holds and hand it to the next
       activated membership. */
    remove(MEMBERS.id, one.memberNumber)
  }

  /**
   * A PAYMENT WAS RECORDED ON A ROW, and every answer that says something different about him now
   * is dropped. The three names are `Payments.tsx#onActivated`'s, for its reason: the booking writes
   * his season, his payment and his `active`, so the payments screen must no longer list him for that
   * season, and this list and the public one must read him again. And his inbox, because the member
   * is told there (PDL P8, „Upis uplate ... stižu članu kao poruka u portalskom sandučetu”) and the
   * row may be the moderator's own (PDL P8, „smeju da rade na sopstvenom redu”).
   */
  function paymentRecorded(): void {
    clearResourceCache('payments')
    clearResourceCache('members')
    clearResourceCache('competitors')
    theInboxHasChanged()
    setRecorded((was) => was + 1)
    setSaid(t('admin.paymentRecorded'))
  }

  /**
   * A SEASON WAS CANCELLED, ITS BASIS CHANGED OR AN EXEMPTION GRANTED ON A ROW (PDL P8, 18.10.2026),
   * and every answer that says something different about him now is dropped.
   *
   * <p>`paymentRecorded`'s three, for its reason, and three more, because a cancellation can make him
   * inactive: `MemberMembershipApi` writes `active` from the rows that remain, and a member whose fee no
   * longer stands leaves the public list, the results of the season being run, his team's roster and
   * his pair (`where c.active` on each of them). `results` also carries `inItsSeason`, which a cancelled
   * season stops being. A change of basis keeps him a member of the season, and the same six are dropped
   * for it all the same: one road for both is one road to keep right. A grant makes him a member of the
   * season, active again if he had lapsed, and off the payments screen: the same six, for the same
   * reasons the other way round.
   *
   * <p>**His inbox only when the row is the moderator's own**, which is when the inbox this visit holds
   * is the member's („Moderator i superadmin smeju da rade na sopstvenom redu”). The message goes to the
   * member, so on any other row nothing this visit holds about the inbox has changed.
   */
  function seasonChanged(one: Member, said: string): void {
    clearResourceCache('payments')
    clearResourceCache('members')
    clearResourceCache('competitors')
    clearResourceCache('results')
    clearResourceCache('teams')
    clearResourceCache('pairs')

    if (one.memberNumber === mine) {
      theInboxHasChanged()
    }

    setRecorded((was) => was + 1)
    setSaid(said)
  }

  return (
    <div className="member">
      {/* The name of the screen is in the navigation beside it and in the
          browser tab (owner, 30.07.2026). It stays in the markup so the page
          has a name for anyone who cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t('admin.members')}</h1>

      <Resource state={state}>
        {([members, competitors]) => {
          const all = recordsOf(MEMBERS, members, overlay)
          const onTheList = new Map(
            recordsOf(MEMBERS, competitors, overlay).map((one) => [one.memberNumber, one]),
          )
          const needle = search.trim().toLowerCase()
          const rows = all.filter(
            (one) =>
              passes(one, filter) &&
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
                    <label className="rankings__field">
                      <span>{t('admin.memberFilter')}</span>
                      <select
                        value={filter}
                        onChange={(event) => {
                          const chosen = MEMBER_FILTERS.find((one) => one === event.target.value)

                          if (chosen !== undefined) {
                            setFilter(chosen)
                          }
                        }}
                      >
                        {MEMBER_FILTERS.map((one) => (
                          <option key={one} value={one}>
                            {t(`admin.memberFilterValue.${one}`)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="rankings__field rankings__field--wide members__search" htmlFor={SEARCH_ID}>
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

              {/* NO SIDEWAYS SCROLL OF THE TABLE AT ANY WIDTH (PDL P24, „Tabele na telefonu nemaju
                  horizontalni skrol"; owner, 20.10.2026: the table that scrolled at every width is fixed
                  before release). Until that day the box scrolled 608px at 360, 200 at 768 and 140 at 1280.
                  What makes it fit is in `AdminMembers.css`: the heads and the pills break between words,
                  on a telephone the table keeps the member and the record and carries the basis and the
                  seasons under the name, Kategorija and Mesto are drawn from 1000px and „Poslednja sezona"
                  from 1100px (owner, 20.10.2026, each chosen with my recommendation). */}
              <div className="table-scroll">
                <table className="table members-table">
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
                      <th scope="col" className="members-table__wide">
                        {t('competitors.columns.category')}
                      </th>
                      <th scope="col" className="members-table__wide">
                        {t('competitors.columns.city')}
                      </th>
                      <th scope="col" className="table__hide-phone">
                        {t('admin.basis')}
                      </th>
                      <th scope="col" className="table__hide-phone">
                        {t('admin.seasons')}
                      </th>
                      <th scope="col" className="members-table__last">
                        {t('admin.lastSeason')}
                      </th>
                      <th scope="col">{t('admin.form.record')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((one) => {
                      const listed = onTheList.get(one.memberNumber)
                      /* THE LAST SEASON IS THE LAST OF HIS SEASONS, whatever its basis (PDL P8,
                         18.10.2026, „Kolona sa poslednjom sezonom u moderaciji broji svaki osnov”),
                         and NOT the season on sale beside the basis: a member of 2027 who has not
                         renewed by November has a last season and no basis of 2028. */
                      const last = one.seasons.at(-1)
                      /* THE BASIS AND THE SEASONS ARE DRAWN IN TWO PLACES, and only one of them at any
                         width: their columns from 700px, and the box under the name below it
                         (`table__hide-phone` and `table__phone-only`, the two halves of one query in
                         `styles/table.css`). One pill each, so both places draw the same thing. */
                      const basisTag =
                        one.membershipBasis !== undefined && one.membershipSeason !== undefined ? (
                          <span className={`tag tag--${one.membershipBasis}`}>
                            {t('admin.basisOfTheSeason', {
                              basis: t(`admin.basisValue.${one.membershipBasis}`),
                              season: one.membershipSeason,
                            })}
                          </span>
                        ) : null
                      const seasonTags = one.seasons.map((held) => (
                        <span key={held.season} className={`tag tag--${held.basis}`}>
                          {t('admin.basisOfTheSeason', {
                            basis: t(`admin.basisValue.${held.basis}`),
                            season: held.season,
                          })}
                        </span>
                      ))

                      return (
                        <tr key={one.memberNumber}>
                          <td>
                            {listed === undefined ? (
                              <span>
                                {one.firstName} {one.lastName}
                              </span>
                            ) : (
                              <ProfileLink competitor={listed}>
                                {one.firstName} {one.lastName}
                              </ProfileLink>
                            )}{' '}
                            <span className="table__member-number">{one.memberNumber}</span>
                            {/* THE BASIS AND THE SEASONS UNDER THE NAME, ON A TELEPHONE ONLY (owner,
                                20.10.2026, chosen with my recommendation): the two columns that carry
                                them on a wider screen do not fit beside the name and the record in
                                328px, and the seasons are what the owner named as needed on the row
                                (18.10.2026, „kojih sve godina je on bio clan"). Each under the name of
                                its column, the shape of the figures under a race's name in the queue of
                                results (`ReviewQueue.tsx`). The category and the town are not drawn
                                below 1000px at all (owner, 20.10.2026). */}
                            <div className="table__phone-only">
                              <dl className="members-table__held">
                                {basisTag !== null && (
                                  <div>
                                    <dt>{t('admin.basis')}</dt>
                                    <dd>{basisTag}</dd>
                                  </div>
                                )}
                                {seasonTags.length > 0 && (
                                  <div>
                                    <dt>{t('admin.seasons')}</dt>
                                    <dd>{seasonTags}</dd>
                                  </div>
                                )}
                              </dl>
                            </div>
                          </td>
                          <td className="table__category members-table__wide">
                            {categoryLabel(
                              categoryCodeFor(one.gender, one.ageBand, one.firstSeason2027),
                              t,
                            )}
                          </td>
                          {/* Read, not edited in place - see the note at the top of
                              this file for why there is no route to write it back. */}
                          <td className="members-table__wide">{one.city}</td>
                          {/* THE BASIS OF THE SEASON ON SALE, WITH ITS YEAR, and nothing for a
                              member who holds no membership of it (owner, 18.10.2026, PDL P8:
                              „do 14.10. je osnova 2027, od 15.10 je osnova 2028"). Until that day
                              this drew the per-person column, so a member freed of 2027 was
                              tagged „Uplata" and one let in on his balance was drawn with a
                              word the screen did not know. The two fields travel together on
                              the answer (`CompetitorApi`), and the tag is drawn only when both
                              are there. */}
                          <td className="table__hide-phone">{basisTag}</td>
                          {/* EVERY SEASON HE WAS A MEMBER OF, oldest first, each on its own basis
                              (owner, 18.10.2026: „bitno mi je da kao admin / moderator vidim na nivou
                              clana kojih sve godina je on bio clan"). Read only: this screen writes
                              no season. */}
                          <td className="table__hide-phone">{seasonTags}</td>
                          <td className="members-table__last">{last?.season}</td>
                          <td>
                            {/* „UPIS UPLATE" FOR A MEMBER WHO HOLDS NO SEASON ON SALE. A row that
                                already carries a basis for it has nothing to book this way: a season
                                held on a payment is the harmless repeat, and one held on an exemption or
                                a balance is refused. */}
                            {one.membershipBasis === undefined && (
                              <RowPayment one={one} onRecorded={paymentRecorded} />
                            )}
                            {/* AND OVER AN EXEMPTION, as a change of basis: „preko njega se može upisati
                                uplata" (PDL P8, 18.10.2026). Never over a balance: „storno ..., pa nova
                                radnja". */}
                            {offeredFor(one.membershipBasis).paymentOverTheExemption && (
                              <RowPayment
                                one={one}
                                overTheExemption
                                onRecorded={() => seasonChanged(one, t('admin.basisChanged'))}
                              />
                            )}
                            {/* „STORNIRAJ" ON EVERY SEASON ON SALE THAT IS HELD, „Promeni osnov u oslobođenje" on one
                                held on a payment, and „Odobri oslobođenje" on a row that holds none
                                (PDL P8, 18.10.2026, „Oslobođenje ostaje izbor na redu člana"). */}
                            <RowMembership
                              one={one}
                              onCancelled={() => seasonChanged(one, t('admin.membershipCancelled'))}
                              onChanged={() => seasonChanged(one, t('admin.basisChanged'))}
                              onGranted={() => seasonChanged(one, t('admin.exemptionGranted'))}
                            />
                            <span className="entity-row-actions">
                              <DeleteRecord
                                name={`${one.firstName} ${one.lastName}`}
                                onDelete={() => {
                                  /* The row about to go is where the focus is, moved
                                     before the answer is back exactly as
                                     `RowActions.deleteRow` moves it for the entities
                                     that still use it. A refusal is said in the row
                                     and closes the question, and the row's own
                                     „Obriši" takes the focus back from where it was
                                     moved (`DeleteRecord`, owner 02.10.2026).

                                     HANDED BACK, so the question can wait for the answer
                                     (`DeleteRecord`, owner 02.10.2026): it tells „Odustani" off
                                     for as long as the promise is pending. */
                                  document.getElementById(SEARCH_ID)?.focus()

                                  return deleteOne(one)
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
                      )
                    })}
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
