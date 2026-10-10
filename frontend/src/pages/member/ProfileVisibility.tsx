import { useEffect, useRef, useState } from 'react'
import { clearResourceCache } from '../../data/client'
import type { Competitor } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import { recordKey } from '../../session/context'
import { useSession } from '../../session/useSession'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { MEMBERS } from '../admin/entityForms'
import { THE_ACCOUNT_GOES_TO, WHEN_CHANGING_MY_DATA, hiddenIn } from './myAccount'

/**
 * HIDING A PROFILE FROM READERS WHO ARE NEITHER ACTIVE MEMBERS NOR THE ADMINISTRATION, AND
 * SINCE 28.09.2026 THE CHOICE REACHES THE SERVER.
 *
 * <p>PDL P23 (owner, 06.09.2026): „Profil je vidljiv i neprijavljenom posetiocu. Član sme da
 * sakrije profil od posetilaca koji nisu članovi; od drugih članova ne sme." The published
 * privacy policy has promised the control since it was written („U podešavanjima možete
 * sakriti profil od posetilaca koji nisu prijavljeni"), and the owner chose the control
 * rather than striking the sentence. Since 03.10.2026 the readers it hides from are every one
 * who is neither an active member nor the administration, a free account and a member whose fee
 * has lapsed among them (PDL P23, 03.10.2026, „Skrivanje deluje prema svakome ko nije aktivan
 * član ni administracija, nikad prema aktivnom članu"). The words next to the box say so since
 * 10.10.2026: the label names the rule and the note names who falls under it, in the words of
 * the policy sentence the owner approved that day („od svakoga ko nije aktivan član ni
 * administracija, dakle od posetilaca koji nisu prijavljeni i od prijavljenih naloga bez
 * aktivne članarine"), split between the two. Until then they named only the visitors who are
 * not signed in, which understated it and was a boundary written down rather than a decision
 * to leave it so.
 *
 * <p><b>WHAT WAS WRONG WITH IT UNTIL TODAY, and it is the worst shape a control can have.</b>
 * The box wrote into the session overlay and stopped there ({@code Settings.tsx}, {@code
 * editRecord}), so every screen of the visit obeyed it and nothing survived a reload. A member
 * ticked it, the portal agreed with him on every page, he came back the next day and his
 * profile was public again with the box empty. {@code PUT /api/me} has taken {@code
 * profileHidden} the whole time ({@code MeWriteApi.Change}).
 *
 * <p><b>ITS OWN COMPONENT AND NOT A BLOCK INSIDE {@code Settings.tsx}, AND THAT IS A
 * CONSEQUENCE RATHER THAN TIDINESS.</b> The panel now holds state of its own - a request in
 * flight, and what came back - and the block it used to be was the body of a render prop
 * handed to {@code <Resource>}, where a hook would belong to {@code Resource} rather than to
 * the panel. The three panels beside it ({@code PersonalData}, {@code ProfilePicture},
 * {@code ProfileBio}) are each their own component for the same reason.
 *
 * <h2>THE ORDER IS THE WHOLE OF IT</h2>
 *
 * <p>{@code ProfilePicture.tsx} writes it out at length and this copies it: „The request goes
 * first and the session overlay is written only inside the arm an answer authorised." Written
 * the other way round, a member would be told the portal had hidden him over a refusal, and
 * every screen of the visit would act on a choice the server never took.
 *
 * <p><b>The overlay is still written, and it is still what the rest of the visit reads.</b>
 * {@code profile/useProfileLink.ts} lays it over whatever record a screen is holding, so
 * eleven screens obey a choice made here without being told about it. What changed is that it
 * is written because the server agreed, never because a box was pressed. That is the
 * arrangement {@code admin/AdminModerators.tsx} already keeps for its own ticks.
 *
 * <h2>WHAT THE BOX SHOWS IS WHAT THE ANSWER SAID, NEVER WHAT WAS PRESSED</h2>
 *
 * <p>{@code MeWriteApi.Changed} calls this field „the flag as the row now holds it", and it is
 * read back out of the database after the writing. So the tick is moved by {@link hiddenIn} of
 * the ANSWER, through the overlay the box already reads. Folded in from {@code
 * event.target.checked}, the panel would agree with the table on every request that worked and
 * would claim something on every request that did not - which is the identical reason {@code
 * AdminModerators.tsx} gives for reading its own ticks back out of the answer.
 *
 * <p><b>There is no state of this panel's own holding „what stands", deliberately.</b> The box
 * reads the record it is handed, which {@code Settings.tsx} merges through the overlay, so a
 * choice made earlier in the visit is still on the screen after walking away and back - and
 * there is one home for „what this visit has chosen" rather than two that can part.
 *
 * <h2>WHILE THE REQUEST IS OUT</h2>
 *
 * <p>The box is {@code disabled}, which is {@code admin/RightsMatrix.tsx}'s own shape for the
 * identical situation - a checkbox that writes to the server with no save button beside it -
 * rather than the portal's usual „told off rather than switched off". The reason the usual
 * shape does not apply: {@code aria-disabled} is a thing said to a reader and not a thing the
 * browser enforces, and a browser toggles a checkbox whatever is said about it, so a second
 * press would send a second request naming the opposite state and the two answers would land
 * in an order nobody chose.
 *
 * <p><b>What that costs and how it is paid.</b> A control disabled under a reader's own finger
 * loses the focus, and a screen reader is then told nothing at all. So the confirmation takes
 * the focus when it appears, which is the same thing {@code PersonalData.tsx} does after a
 * save and for the same rule (WCAG 2.2 SC 4.1.3, and the order of focus in 2.4.3).
 *
 * <p><b>AND THE WINDOW IS NOT ONE ANYBODY ELSE CAN READ, which was measured rather than
 * assumed.</b> Nothing outside this panel moves until the answer lands: the overlay is written
 * in the success arm, so the eleven screens that read it cannot show a half-done state, and
 * the member's own profile is the one page that never hides from him anyway
 * ({@code profile/visible.ts}). What moves before the answer is nothing at all - not even the
 * tick.
 */
export function ProfileVisibility({ me }: { me: Competitor }) {
  const { t } = useI18n()
  const { editRecord } = useSession()
  const [saving, setSaving] = useState(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const said = useRef<HTMLParagraphElement>(null)

  const saved = answer !== null && answer.got === 'done'
  const refusal = answer !== null && answer.got !== 'done' ? answer : null

  useEffect(() => {
    if (saved) {
      said.current?.focus()
    }
  }, [saved])

  async function choose(wanted: boolean): Promise<void> {
    setSaving(true)
    /* The old answer goes the moment a new request starts: „Sačuvano." left standing over a
       box being pressed again says the thing on the screen is what the server holds. */
    setAnswer(null)

    const answered = await askTheServer(THE_ACCOUNT_GOES_TO, { profileHidden: wanted }, 'PUT')

    setSaving(false)

    if (answered.got !== 'done') {
      setAnswer(answered)

      return
    }

    const confirmed = hiddenIn(answered.body)

    /* A 200 THIS SCREEN CANNOT READ, which is a portal one release behind its server rather
       than anything a member did. Nothing is written anywhere and the box does not move, so
       what the reader sees is the choice as it was before he pressed.
     *
       `server.wrong` is what says so, and the one thing it says that this branch cannot know
       is its second clause, „i ništa nije promenjeno" - true of this SCREEN, which wrote
       nothing, and unknown of the row. It is said this way rather than with a sentence of its
       own because a new sentence is a new line in both dictionaries and in both snapshots, and
       those four files are held by another branch this week. Written down rather than left to
       be found: the day that branch lands, this is where a sentence of its own belongs. */
    if (confirmed === null) {
      setAnswer({ got: 'wrong', status: 200 })

      return
    }

    /* „true" and „false" as words, because the overlay keeps every value as text and
       `forms/records.ts` turns them back into the shape the record holds (`like`). */
    editRecord(recordKey(MEMBERS.id, me.memberNumber), { profileHidden: String(confirmed) })

    /* SO THAT THE NEXT SCREEN READS THE ROW AND NOT THE ANSWER THIS VISIT ALREADY HAD.
       `data/client.ts` fetches a resource once per visit, and `/api/competitors` carries
       `profileHidden` on every row (`CompetitorApi`), so without this the list a visit is
       holding goes on saying what it said before the member changed his mind. Narrowed to the
       one resource: nothing else about this visit went stale. */
    clearResourceCache('competitors')
    setAnswer(answered)
  }

  return (
    <section className="member__panel" aria-labelledby="settings-privacy">
      <h2 className="profile__section" id="settings-privacy">
        {t('settings.privacy')}
      </h2>
      <p className="member__note">{t('settings.hideProfileNote')}</p>

      <div className="field field--checkbox">
        <div className="field__confirm">
          <input
            className="field__control"
            type="checkbox"
            id="hide-profile"
            checked={me.profileHidden}
            disabled={saving}
            onChange={(event) => {
              void choose(event.target.checked)
            }}
          />
          <label className="field__label" htmlFor="hide-profile">
            {t('settings.hideProfile')}
          </label>
        </div>
      </div>

      {saved && (
        <p className="member__note" ref={said} tabIndex={-1} role="status">
          {t('account.saved')}
        </p>
      )}

      {/* What the server said, in its own reason's words, under the control it answers.
          `WHEN_CHANGING_MY_DATA` is the table of `PUT /api/me`'s own refusals, held to the
          Java source by `myAccount.test.ts`; this panel can reach none of the eight through
          the box it draws, and answers all eight because the route names them and a request
          that goes round the screen meets the route with nothing in between. */}
      {refusal !== null && <ServerSaid answer={refusal} refusals={WHEN_CHANGING_MY_DATA} />}
    </section>
  )
}
