import { useState } from 'react'
import { Resource } from '../../components/Resource'
import { clearResourceCache } from '../../data/client'
import type { Member } from '../../data/types'
import { combinePair, theInboxHasChanged, useCompetitors, useMembers } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { askTheServer, type Answer } from '../account/askTheServer'
import { MEMBERS, recordsOf } from './entityForms'
import { MemberRow } from './MemberRow'
import { DELETE_THE_ACCOUNT } from './memberWrites'
import { useOverlay } from './overlay'
import { dropWhatActiveMoves } from './whatActiveMoves'
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
 *    row also records a payment, `POST /api/members/{memberNumber}/payment` (PDL P8,
 *    „Na redu člana u moderaciji: upis uplate za sezonu”), and grants, cancels and
 *    changes the season on sale through `/api/members/{memberNumber}/membership`, so
 *    the heading above is about the day it was written. Since 22.10.2026 every one of
 *    them is put to the moderator by the row itself (`MemberRow.tsx`), the deletion
 *    included, and this screen sends the deletion it is asked to.
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

  /**
   * What just happened, for whoever is not watching the list, and whether it is also DRAWN.
   *
   * <p>The deletion's „Član je obrisan." is drawn on the screen (owner, 22.10.2026, PDL „Brisanje člana na
   * ekranu članova": „posle brisanja se na ekranu vidi poruka"). Until that day it went only to the hidden
   * live region below, so a reader who looks at the list saw the row go and was told nothing: the focus has
   * moved to the search field and the row he pressed on is gone with the member. The other sentences of
   * this screen stay for a reader who does not look, as the owner's decision names the deletion only.
   *
   * <p><b>One state for both, so the next thing that happens takes the sentence back.</b> Every writer
   * of `said` replaces the whole of it, and `shown` is true only for the deletion's, so a payment or a
   * cancellation after it cannot leave a drawn „Član je obrisan." standing over a list it is no longer
   * about, and no writer has a second place to remember.
   */
  const [saidNow, setSaidNow] = useState({ words: '', shown: false })
  const said = saidNow.shown ? '' : saidNow.words
  const shown = saidNow.shown ? saidNow.words : ''

  function setSaid(words: string): void {
    setSaidNow({ words, shown: false })
  }

  /**
   * EVERY SUCCESS THIS VISIT HAS HAD ON A ROW, one entry per success and the member number in it, and
   * nothing else is kept. What a row reads from it is how many are its own (`useRowRefusal`), so the
   * success of one row moves that row's count and no other. A list of numbers and not a record of
   * counts, so that a row nothing has succeeded on needs no „or nought" to be read.
   */
  const [succeededOn, setSucceededOn] = useState<string[]>([])

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
  async function deleteOne(one: Member): Promise<Answer> {
    const answer = await askTheServer(
      `/api/competitors/${one.memberNumber}?account=${DELETE_THE_ACCOUNT}`,
      {},
      'DELETE',
    )

    /* A refusal is the row's to say, beside the row, in the route's own words (`MemberRow.tsx`). */
    if (answer.got !== 'done') {
      return answer
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
    setSaidNow({ words: t('admin.memberGone'), shown: true })

    /* ONLY HERE, INSIDE THE BRANCH THE ANSWER APPROVED. `memberNumbers.ts` reads
       `deletions[MEMBERS.id]` to work out which numbers are free, so this written
       early would free a number the database still holds and hand it to the next
       activated membership. */
    remove(MEMBERS.id, one.memberNumber)

    /* THE FOCUS GOES TO THE SEARCH ONCE THE ROW IS GONE, and not before the answer, which is when it
       moved until 22.10.2026: the question is a sheet over the page now, and a sheet that is still
       standing keeps the focus inside it. Moved while the sheet is still drawn, in the same turn as the
       removal above, so the sheet that closes with its row finds its button gone and gives nothing back
       (`Prompt.tsx`), and the reader lands on the one control that cannot be the row just deleted. */
    document.getElementById(SEARCH_ID)?.focus()

    return answer
  }

  /**
   * AN ACTION ON A ROW WENT THROUGH (PENDING 29660), and the sentence of an earlier refusal beside that
   * row is no longer true of it: every refusal is said by the row (`MemberRow.tsx`), the deletion's
   * included since 22.10.2026, and the count handed to it moves with this call. <b>Only this row's</b>: a
   * refusal beside another row says something nothing here has changed.
   */
  function settle(one: Member): void {
    setSucceededOn((were) => [...were, one.memberNumber])
  }

  /**
   * A PAYMENT WAS RECORDED ON A ROW, and every answer that says something different about him now
   * is dropped. The names are `whatActiveMoves.ts`'s, the one list that `Payments.tsx#onActivated` and
   * `seasonChanged` below drop as well: the booking writes his season, his payment and his `active`
   * (a payment can make a lapsed member active), so the payments screen must no longer list him for
   * that season, and this list, the public one, his team, his pair, the results, the list of who is
   * going and the comments must read him again. And his inbox, because the member
   * is told there (PDL P8, „Upis uplate ... stižu članu kao poruka u portalskom sandučetu”) and the
   * row may be the moderator's own (PDL P8, „smeju da rade na sopstvenom redu”).
   */
  function paymentRecorded(one: Member): void {
    settle(one)
    dropWhatActiveMoves()
    theInboxHasChanged()
    setRecorded((was) => was + 1)
    setSaid(t('admin.paymentRecorded'))
  }

  /**
   * A SEASON WAS CANCELLED, ITS BASIS CHANGED OR AN EXEMPTION GRANTED ON A ROW (PDL P8, 18.10.2026),
   * and every answer that says something different about him now is dropped.
   *
   * <p>`paymentRecorded`'s names (one list, `whatActiveMoves.ts`), because a cancellation can make him
   * inactive: `MemberMembershipApi` writes `active` from the rows that remain, and a member whose fee no
   * longer stands leaves the public list, the results of the season being run, his team's roster, his
   * pair, the list of who is going to an event and the author's number on a comment (`where c.active` or
   * `author.active` on each of them). `results` also carries `inItsSeason`, which a cancelled
   * season stops being. A change of basis keeps him a member of the season, and the same eight are dropped
   * for it all the same: one road for both is one road to keep right. A grant makes him a member of the
   * season, active again if he had lapsed, and off the payments screen: the same eight, for the same
   * reasons the other way round.
   *
   * <p><b>`attendance` AND `comments` WERE LEFT OFF UNTIL 20.10.2026</b> (PENDING 29656, review of PR 579,
   * measured), although the sentence above this one said that every answer is dropped: `deleteOne`, in
   * this same file, drops both for the same member, and a cancellation that makes him inactive takes him
   * off the one (`AttendanceApi`, `and c.active`) and his number off the other (`CommentApi`,
   * `case when author.active then author.member_number end`). Which cached names read the flag is not
   * this file's to remember: `rowMembership.test.tsx` reads it out of the backend's own SQL and holds
   * the list to it, with `me/applications` the one exception and its reason written there. Since the
   * list is shared with `paymentRecorded` and `Payments.tsx#onActivated`, so is the floor.
   *
   * <p>**His inbox only when the row is the moderator's own**, which is when the inbox this visit holds
   * is the member's („Moderator i superadmin smeju da rade na sopstvenom redu”). The message goes to the
   * member, so on any other row nothing this visit holds about the inbox has changed.
   */
  function seasonChanged(one: Member, said: string): void {
    settle(one)
    dropWhatActiveMoves()

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

              {/* DRAWN ALWAYS AND FILLED WHEN IT IS TRUE: a live region that appears with its words in it
                  is often not read, one that is already on the page and then gets them is. Nothing is
                  drawn of it while it is empty (`AdminMembers.css`). */}
              <p role="status" className="members__gone">
                {shown}
              </p>

              {/* NO SIDEWAYS SCROLL OF THE TABLE AT ANY WIDTH (PDL P24, „Tabele na telefonu nemaju
                  horizontalni skrol"). FIVE COLUMNS since 22.10.2026 (owner, „Red na ekranu članova ima pet
                  kolona"), folded under the name where they do not fit (the coordinator's answer of
                  22.10.2026, P2): from 1000px all five; from 700px the name, the basis, the seasons and the
                  actions, with the town under the name; below it the name and the actions, with the town,
                  the basis and the seasons under the name. What does it is in `AdminMembers.css` and in the
                  two queries of `styles/table.css`, and the row is `MemberRow.tsx`. */}
              <div className="table-scroll">
                <table className="table members-table">
                  <caption className="visually-hidden">{t('admin.members')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('admin.memberColumns.name')}</th>
                      <th scope="col" className="members-table__wide">
                        {t('admin.memberColumns.town')}
                      </th>
                      <th scope="col" className="table__hide-phone">
                        {t('admin.memberColumns.basis')}
                      </th>
                      <th scope="col" className="table__hide-phone">
                        {t('admin.memberColumns.seasons')}
                      </th>
                      <th scope="col">{t('admin.memberColumns.options')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((one) => (
                      <MemberRow
                        key={one.memberNumber}
                        one={one}
                        listed={onTheList.get(one.memberNumber)}
                        /* HOW MANY ACTIONS ON THIS ROW HAVE GONE THROUGH, which is what ends a
                           refusal beside it (`useRowRefusal`) and counts no other row's. */
                        settled={succeededOn.filter((number) => number === one.memberNumber).length}
                        onPaid={() => paymentRecorded(one)}
                        onChanged={(words) => seasonChanged(one, words)}
                        onDelete={() => deleteOne(one)}
                      />
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
