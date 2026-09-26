import { useState, type ReactNode } from 'react'
import { Resource } from '../../components/Resource'
import { clearResourceCache } from '../../data/client'
import type { Moderator } from '../../data/types'
import { useModerators } from '../../data/useResource'
import type { FormValues } from '../../forms/types'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import type { Rights } from '../../session/context'
import { useSession } from '../../session/useSession'
import { DeleteRecord, EntityBar, EntityEditor, NEW_RECORD_ID, type Saving } from './EntityEditor'
import { MODERATORS, recordsOf, type Editing, type Overlay } from './entityForms'
import { emailIn, identityIn, invitedFrom, ticksIn, WHEN_WRITING_A_MODERATOR } from './moderatorWrites'
import { allowed, grantedCount, RIGHTS } from './rights'
import { RightsMatrix } from './RightsMatrix'
import '../member/Member.css'
import './Rights.css'

/** An overlay holding nothing, which is what this screen starts every visit with
 *  (the name, the address and the existence of a row - see `rightsOverlay` below
 *  for the fourth thing this screen keeps, which this type does not cover). */
const NOTHING_YET: Overlay = { edits: {}, creations: {}, deletions: {} }

/** No right confirmed by the server yet, which is what the matrix starts every
 *  visit reading. */
const NO_RIGHTS_YET: Rights = {}

/**
 * Moderators, as an entity among the others, and the matrix that says what each
 * of them may do (PDL P28a, 30.07.2026).
 *
 * This is the one screen a moderator does not reach, and the door on it is
 * fitted by the route table like every other (needs.ts, Guard.tsx). What he
 * alone does is decide what the moderator may (PDL P21). Without that boundary
 * the difference between the two roles is a word in the code, and a moderator
 * standing in front of his own row of boxes is not a moderator being limited by
 * anything.
 *
 * **THIS SCREEN WRITES TO THE SERVER, SINCE B106** (PDL P28c point 2, owner
 * 24.09.2026: „Svi ekrani administracije prestaju da pisu u sesijski sloj i
 * pocinju da zovu rute"). `ModeratorApi`/`ModeratorWriteApi` answer three routes
 * and this screen now uses all three: `POST /api/moderators` makes one and sends
 * him his invitation, `PUT /api/moderators/{id}` replaces his whole row of ticks,
 * and `DELETE /api/moderators/{id}` takes his moderatorship away (never his
 * account - see that route's own javadoc). Reading the list already went to the
 * server before this: `useModerators()` has been `GET /api/moderators` since ADL
 * A50, and only the four writes below are what changes here.
 *
 * **A NAMED BOUNDARY: THIS SCREEN CANNOT CHANGE AN EXISTING MODERATOR'S NAME OR
 * ADDRESS, AND THAT IS NOT AN OVERSIGHT.** PDL P21 says the superadmin „menja"
 * moderators as well as their rights, and until B106 the session let him try:
 * `EditableCell` on all three columns, and the full form behind „Otvori". Both
 * wrote into the session overlay and neither ever reached the database - the
 * change was lost on the next refresh, which is a screen showing a control that
 * does nothing. `ModeratorWriteApi` says why there is no route for it yet, in its
 * own words: „`{@link #add}` WRITES a name and an address, once; `{@link
 * #change}` carries the row of boxes and nothing else, so the day an edit is
 * written it belongs in that same method rather than in a third one. Until then
 * a request naming them is refused by the shape of `{@link Ticks}`, which has no
 * field for either." So this screen shows an existing moderator's name and
 * address as plain text, and its only action on an existing row is the one the
 * server can carry out: deleting his moderatorship. Whether a moderator's name
 * or address should ever be editable through the portal, and what that would do
 * to an account whose address changes, is a question for the owner and is left
 * open in the PR rather than answered here.
 *
 * A moderator is entered the way the other six entities are, by the one
 * renderer reading one JSON definition - `EntityEditor` with `save` handed in,
 * the same shape `AdminLeagues.tsx` uses. The rights are not on that form on
 * purpose: they are the matrix, and a second place to set them would be a
 * second answer to the same question.
 *
 * **WHAT THIS VISIT HOLDS, ON TOP OF WHAT THE SERVER ANSWERED WITH**, and there
 * are two overlays rather than one: `written` for a made or removed row (the
 * same `Overlay` shape and the same reason `AdminLeagues.tsx` keeps one - a
 * screen that is still mounted never asks its resource again, so nothing here
 * re-reads the moment a write comes back), and `rightsOverlay` beside it for a
 * confirmed tick, because a tick is not a form field: `rights` is not on
 * `MODERATORS.form`, so it cannot travel through `edits`, and it is the same
 * `Rights` shape `RightsMatrix` used to read out of the session. Both are
 * written only inside the branch that ran because an answer said the write went
 * through, never on the strength of a click alone.
 *
 * **AND THE SESSION IS STILL WRITTEN TO, IN TWO NARROW PLACES, FOR A REASON THAT
 * HAS NOTHING TO DO WITH PERSISTING ANYTHING HERE.** `useMay()`
 * (`pages/admin/rights.ts`) answers what the person AT THE KEYBOARD may do, and
 * it reads `useSession().rights` on purpose: that is what lets the development
 * role switch (`roles/RoleSwitch.tsx`) simulate becoming a named moderator and
 * meet the very limits the superadmin just set, in the same visit, without a
 * server session of his own (`pages/admin/guard.test.tsx`, „carries a tick taken
 * away in the matrix through to the screen behind it"). The switch reads its own
 * list of moderators once and never again while it is mounted, so the record it
 * hands `become()` is not refreshed by a `PUT` here - what makes the simulation
 * see the change is `session.rights`, not a fresher record. So once a `PUT` is
 * confirmed, this screen also calls `setRight` for every right of that
 * moderator, matching the row the server just confirmed rather than only the one
 * box that was pressed (a full resync, not a single tick, so this screen and the
 * switch cannot read two different rows for the same moderator). The same is
 * true of a confirmed `DELETE`: the switch also reads `deletions.moderators` to
 * stop offering somebody who has been removed (`RoleSwitch.tsx`'s own comment,
 * „a control that reads as revoking access and does not is worse than none"),
 * so this screen calls `remove` once the server has confirmed it, never before
 * and never instead of the real `DELETE`.
 */
export function AdminModerators() {
  const { t } = useI18n()
  const { remove, setRight } = useSession()
  const [editing, setEditing] = useState<Editing | null>(null)
  const state = useModerators()

  const [written, setWritten] = useState<Overlay>(NOTHING_YET)
  const [rightsOverlay, setRightsOverlay] = useState<Rights>(NO_RIGHTS_YET)

  /** Which moderators have a rights `PUT` still out, so their row of boxes is
   *  held rather than pressed a second time before the first answer is back. */
  const [savingRights, setSavingRights] = useState<ReadonlySet<number>>(new Set())

  /** What just happened, for whoever is not watching the list. */
  const [said, setSaid] = useState('')

  /** Why a deletion did not happen, beside the row it was pressed on. */
  const [refused, setRefused] = useState<{
    id: number
    answer: Exclude<Answer, { got: 'done' }>
  } | null>(null)

  /** Why the last tick of one row did not save, beside that row's own name. */
  const [rightsRefused, setRightsRefused] = useState<{ id: number; node: ReactNode } | null>(null)

  /** The words for an answer that was not „it was done". */
  function saying(answer: Exclude<Answer, { got: 'done' }>) {
    return <ServerSaid answer={answer} refusals={WHEN_WRITING_A_MODERATOR} />
  }

  /**
   * MAKING ONE, WHO SETS HIS OWN PASSWORD THROUGH A LINK THE ROUTE SENDS HIM.
   *
   * `POST` answers 201 with `{id, email}` (`ModeratorWriteApi.Made`) and never
   * with a row he can be drawn from otherwise; the two other fields for this
   * visit's own row come off what was typed, exactly as `AdminLeagues.saveOne`
   * reads `text` rather than the answer for everything the answer does not
   * carry. The address is the one exception: read back off the answer rather
   * than off what was typed, because the row folds it to lower case
   * (`WhatAnAddressLooksLike.asItIsStored`) and a screen that echoed the typed
   * spelling would show one the database does not hold the moment the two
   * differ by case.
   */
  async function saveOne(values: FormValues, text: Record<string, string>): Promise<Saving> {
    /* Kept rather than re-read off `text`: `Invited.email` is a plain `string`
       (built once, in `invitedFrom`, with its own fallback for a field the form
       left out), where `text.email` is `string | undefined` under
       `noUncheckedIndexedAccess` and would need a second fallback for a branch
       that can never be taken - `text` always carries every field the form
       declares by the time a submit reaches here (`forms/records.ts`,
       `textFrom`). */
    const typed = invitedFrom(values)
    const answer = await askTheServer('/api/moderators', typed, 'POST')

    if (answer.got !== 'done') {
      return { said: saying(answer) }
    }

    /* THE NEXT MOUNT READS THE SERVER, not this visit's first answer - the same
       reason `AdminLeagues.saveOne` clears its own cache in the same branch. */
    clearResourceCache('moderators')

    const made = identityIn(answer.body)

    if (made === null) {
      return {
        said: (
          <p className="field__error" role="alert">
            {t('admin.moderatorSavedUnseen')}
          </p>
        ),
      }
    }

    setWritten((was) => ({
      ...was,
      creations: {
        ...was.creations,
        [MODERATORS.id]: [
          ...(was.creations[MODERATORS.id] ?? []),
          { id: String(made), values: { ...text, email: emailIn(answer.body) ?? typed.email } },
        ],
      },
    }))

    return { written: String(made) }
  }

  /**
   * AND TAKING HIS MODERATORSHIP AWAY, WHICH IS NOT TAKING HIS ACCOUNT AWAY
   * (`ModeratorWriteApi.remove`). Nothing on this screen asks whether he also
   * races: the route decides what he becomes instead, off `competitor_id`.
   */
  async function deleteOne(moderator: Moderator): Promise<void> {
    const answer = await askTheServer(`/api/moderators/${moderator.id}`, {}, 'DELETE')

    if (answer.got !== 'done') {
      setRefused({ id: moderator.id, answer })

      return
    }

    clearResourceCache('moderators')
    setRefused(null)
    setSaid(t('admin.moderatorGone'))
    setWritten((was) => ({
      ...was,
      /* Out of both stores, for the same reason `AdminLeagues.deleteOne` reads:
         a moderator made during this visit is held as a CREATION, and one that
         was served is filtered out by a DELETION. Written into the second only,
         a just-made row would go on standing and could be pressed again against
         a moderator the server has already forgotten. */
      creations: {
        ...was.creations,
        [MODERATORS.id]: (was.creations[MODERATORS.id] ?? []).filter(
          (one) => one.id !== String(moderator.id),
        ),
      },
      deletions: {
        ...was.deletions,
        [MODERATORS.id]: [...(was.deletions[MODERATORS.id] ?? []), String(moderator.id)],
      },
    }))

    /* SEE THE CLASS COMMENT: the role switch stops offering him only because of
       this, never because the DELETE above happened. */
    remove(MODERATORS.id, String(moderator.id))
  }

  /**
   * CHANGING WHAT ONE MODERATOR MAY DO, ONE BOX AT A TIME BUT THE WHOLE ROW SENT
   * (`ModeratorWriteApi.change`, `PUT`).
   *
   * There is no save button on the matrix (`rights.intro`), so a box writes the
   * moment it is pressed - but the route takes the whole set a moderator should
   * hold, not the one box that changed (`Ticks.rights`), so what is sent is every
   * right this screen already believes he holds, with the pressed one flipped.
   * Read off `RIGHTS` and `allowed()` rather than off a set kept on the side, so
   * a moderator holding two different rights (the ordinary case the matrix
   * exists for) keeps the one that was not pressed: a version of this that
   * tracked only the pressed box would satisfy „rights are kept" while quietly
   * dropping every other one on the next press.
   */
  async function toggleRight(moderator: Moderator, right: string, granted: boolean): Promise<void> {
    const nextRights = RIGHTS.map((one) => one.key).filter((key) =>
      key === right ? granted : allowed(moderator, key, rightsOverlay),
    )

    setSavingRights((was) => new Set(was).add(moderator.id))

    const answer = await askTheServer(
      `/api/moderators/${moderator.id}`,
      { rights: nextRights },
      'PUT',
    )

    setSavingRights((was) => {
      const next = new Set(was)

      next.delete(moderator.id)

      return next
    })

    if (answer.got !== 'done') {
      setRightsRefused({ id: moderator.id, node: saying(answer) })

      return
    }

    /* READ BACK OUT OF THE ANSWER, NOT OUT OF WHAT WAS SENT - the same reason
       `Ticked.rights` gives: the two agree whenever the write worked, and an
       overlay that echoed the request would draw a row nobody had written the
       moment the database refused something this screen thought it asked for. */
    const confirmed = ticksIn(answer.body)

    if (confirmed === null) {
      setRightsRefused({
        id: moderator.id,
        node: (
          <p className="field__error" role="alert">
            {t('admin.moderatorRightsSavedUnseen')}
          </p>
        ),
      })

      return
    }

    clearResourceCache('moderators')
    setRightsRefused(null)
    setRightsOverlay((was) => ({
      ...was,
      [moderator.id]: Object.fromEntries(
        RIGHTS.map((one) => [one.key, confirmed.includes(one.key)]),
      ),
    }))

    /* SEE THE CLASS COMMENT: every right of this moderator, not only the one
       pressed, so the role switch's own simulation cannot read a different row
       than this screen just drew. */
    for (const one of RIGHTS) {
      setRight(String(moderator.id), one.key, confirmed.includes(one.key))
    }
  }

  return (
    <div className="member">
      {/* The name of the screen is in the navigation beside it and in the
          browser tab (owner, 30.07.2026). It stays in the markup so the page
          has a name for anyone who cannot see which entry is marked. */}
      <h1 className="visually-hidden">{t('admin.moderators')}</h1>

      <Resource state={state}>
        {(moderators) => {
          const rows = recordsOf(MODERATORS, moderators, written)

          if (editing !== null) {
            return (
              <EntityEditor
                entity={MODERATORS}
                editing={editing}
                save={saveOne}
                onDone={() => setEditing(null)}
              />
            )
          }

          return (
            <>
              <EntityBar entity={MODERATORS} onNew={() => setEditing({ mode: 'new' })} />

              <div className="table-scroll">
                <table className="table moderators">
                  <caption className="visually-hidden">{t('admin.moderators')}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t('admin.field.firstName')}</th>
                      <th scope="col">{t('admin.field.lastName')}</th>
                      <th scope="col">{t('admin.field.email')}</th>
                      {/* Off the telephone, where four columns are what fits and
                          the number is on every row of the matrix below anyway. */}
                      <th scope="col" className="table__hide-phone">
                        {t('rights.given')}
                      </th>
                      <th scope="col">{t('admin.form.record')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((one) => (
                      <tr key={one.id}>
                        {/* Read, not edited in place - see the class comment for
                            why there is no route to write either back to. */}
                        <td>{one.firstName}</td>
                        <td>{one.lastName}</td>
                        <td className="moderators__email">{one.email}</td>
                        <td className="table__hide-phone">
                          {grantedCount(one, rightsOverlay) === 0
                            ? t('rights.none')
                            : t('rights.granted', { count: grantedCount(one, rightsOverlay) })}
                        </td>
                        <td>
                          <span className="entity-row-actions">
                            <DeleteRecord
                              name={`${one.firstName} ${one.lastName}`}
                              onDelete={() => {
                                /* The row about to go is where the focus is,
                                   moved here exactly as `RowActions.deleteRow`
                                   moves it for the other six entities - this
                                   screen cannot use that component because it
                                   always draws an „Otvori" as well, and there is
                                   nothing behind one here (see the class
                                   comment). */
                                document.getElementById(NEW_RECORD_ID)?.focus()
                                void deleteOne(one)
                              }}
                            />
                          </span>
                          {refused !== null && refused.id === one.id && saying(refused.answer)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Said once and politely, the same shape `AdminLeagues.tsx` uses:
                  the focus has already moved to the control that starts a new
                  record, so a reader who is not looking at the list gets the one
                  sentence that says what just left it. */}
              <p aria-live="polite" className="visually-hidden">
                {said}
              </p>

              <h2 className="entity-heading">{t('rights.title')}</h2>
              <p className="member__note">{t('rights.intro')}</p>
              <p className="member__note">{t('rights.superadminNote')}</p>

              <RightsMatrix
                moderators={rows}
                rights={rightsOverlay}
                busy={savingRights}
                onToggle={(moderator, right, granted) => void toggleRight(moderator, right, granted)}
                refusal={rightsRefused}
              />
            </>
          )
        }}
      </Resource>
    </div>
  )
}
