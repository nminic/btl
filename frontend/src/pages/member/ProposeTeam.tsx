import { useRef, useState } from 'react'
import { Navigate } from 'react-router'
import { useToday } from '../../clock/useClock'
import { teamOf } from '../../data/derive'
import { inYearlyWindow } from '../../data/season'
import { useSend, useSent } from '../sent'
import { Resource } from '../../components/Resource'
import { combinePair, useCompetitors, useTeams } from '../../data/useResource'
import { FormRenderer } from '../../forms/FormRenderer'
import { predlogTima } from '../../forms/definitions'
import type { FieldError, FormValues } from '../../forms/types'
import { useI18n } from '../../i18n/useI18n'
import { MEMBERS, recordsOf, TEAMS } from '../admin/entityForms'
import { useOverlay } from '../admin/overlay'
import { addressesIn, nameError } from '../admin/teamProposal'
import { useMemberScreen } from './memberScreen'
import { askTheServer, type Answer } from '../account/askTheServer'
import { WHEN_PROPOSING_A_TEAM } from '../account/refusals'
import { ServerSaid } from '../account/ServerSaid'
import './Member.css'

/**
 * A team put forward by the member who wants to run in it.
 *
 * Teams used to arrive one way only, entered by an administrator, and the queue
 * that decides on them was already there and already called "new teams" (PDL
 * P22): what was missing was anybody able to fill it. A member proposes, a
 * moderator decides, and nothing exists in the league until they do.
 *
 * A moderator and not only the superadmin. P21 has said so since 30.07.2026,
 * and P13 went on reading "the superadmin approves", which is why the screen
 * said neither for a while; the owner brought P13 into line on 03.08.2026.
 *
 * What this screen does not promise is a sight of the proposal while it waits.
 * There is no list of what a member has put forward, so it says the team is not
 * visible anywhere rather than that only they can see it.
 *
 * The decision itself does reach them: approving writes to the inbox
 * (PendingQueue, PDL P13). A refusal still reaches nobody, which is what is left
 * of R9.
 *
 * The words say "moderator" and stop there, as the other two do. Naming the
 * superadmin beside him is accurate and useless to a member: it is the internal
 * vocabulary of the rights matrix, and P21 already settles the shorthand, since
 * granular rights describe what a moderator may do rather than what the
 * superadmin may. The screens facing the administration say it in full
 * (`verification.fromTeams`), because there it names who may press the button.
 *
 * A proposal and nothing more. It is deliberately not the administration's team
 * form: that one asks who organises the team, out of a list of every member,
 * which is a question for whoever approves it and not for whoever asks. What is
 * asked here is what a member knows, the name, the town and the country, plus
 * room to say why in their own words.
 */
export function ProposeTeam() {
  const { locale, t } = useI18n()
  const who = useMemberScreen()
  const today = useToday()
  const overlay = useOverlay()
  /* The teams as well, for one rule: a name already in the league cannot be
     proposed again (PDL). Checked on the form rather than left to a moderator,
     because a member who is told at the door can change the name; a member told
     a fortnight later by a refusal has to start again. */
  const state = combinePair(useCompetitors(), useTeams())
  /** The name of the team once it has been sent, so the screen can say which. */
  /* Held by the address rather than by the screen, so the way back from this
     confirmation is the list of teams and not the form already sent (PDL, 05.09.2026). */
  const said = useSent()
  const sent = typeof said === 'string' ? said : null
  const confirm = useSend()
  /* What the server answered, where it has answered anything that is not „done" -
     `RateEvent.tsx`'s own shape, for the identical reason: a proposal that succeeded
     leaves this screen altogether. */
  const [refusal, setRefusal] = useState<Exclude<Answer, { got: 'done' }> | null>(null)
  const [sending, setSending] = useState(false)
  /* A second press while the first is still out would propose the same team twice;
     `Registration.tsx`'s own guard, a ref rather than the state beside it. */
  const outstanding = useRef(false)

  if (who.memberNumber === null) {
    return who.instead
  }

  const { memberNumber } = who

  /* Narrowed once, here, rather than at the call: the early return above has
     already settled it, but the handler below is written inside a callback that
     the compiler cannot see runs after it. */
  const mine = memberNumber

  if (sent !== null) {
    return (
      <div className="member" role="status">
        <h1>{t('teams.proposeDoneTitle')}</h1>
        <p>{t('teams.proposeDone', { name: sent })}</p>
      </div>
    )
  }

  return (
    <div className="member">
      <Resource state={state}>
        {([competitors, teams]) => {
          /* Whether THIS member already has a team, which is the one thing `me` is
             still read for since 22.09.2026: `TeamWriteApi` writes `competitor_id` off the
             session and never off a value this screen sends („never a value the caller
             supplies"), and the name a moderator reads beside a waiting proposal comes
             from that pointer, live, at `VerificationApi`'s own join - never a copy this
             screen builds and carries in the request.
             Through the overlay, and that is the whole of whether this door shuts:
             approving a proposal writes the team onto the member's record in the
             session (`admin/PendingQueue.tsx`), and the file on the disc knows
             nothing of it. Read straight from the file, the door let the founder of
             a team walk back in and found a second one the same minute — measured in
             review, 05.09.2026, two teams and one organiser. `Membership.tsx` reads
             a member the same way for the same reason. */
          const me = recordsOf(MEMBERS, competitors, overlay).find(
            (one) => one.memberNumber === mine,
          )

          /* **An address that is not for this member is not a page, it is a
             redirect.** Owner, 05.09.2026: „Ukoliko neko već ima tim, dugme za
             dodavanje tima ne treba da se prikazuje! Ako neko proba deeplink za
             pravljenje tima iako ima tim, treba da se preusmeri na homepage." A
             screen explaining the refusal stood here for one day and is gone with
             the sentence it drew.

             Two reasons to send them away, and they are the same rule read twice.
             **A team already** (`teamOf`, the one reading, because an empty string is
             how the session takes somebody out of a team and it is not a team): founding
             a second one is what PDL P13
             forbids, and the reading is off the record rather than off the season,
             because a member who joined a team for next season is not in one today
             but would be in two on 1 January. **Outside the transfer window**: a
             team is founded from 1 October to 31 December (owner, 05.09.2026), the
             same window in which every other change of team is asked for and the
             same one the membership screen already speaks of. */
          if (teamOf(me) !== null || !inYearlyWindow(today)) {
            return <Navigate to={`/${locale}`} replace />
          }

          /**
           * Sends the proposal, and decides what the reader sees by what came back -
           * `RateEvent.tsx`'s own shape, which is `Registration.tsx`'s before it.
           *
           * <p><b>THE FORM ASKS FOR NO LOGO, AND THAT IS A BOUNDARY RATHER THAN AN
           * OMISSION HERE.</b> `TeamWriteApi` carries no field for one: its own javadoc
           * says so at length - no signature under the backend reads a picture from this
           * route. A `CropChooser` stood above these fields until 22.09.2026, so a member
           * could choose one, cut it, read „Predlog je poslat" - and nobody ever saw what
           * they chose. Owner, 22.09.2026: „Skloni polje dok put ne postoji", the cost
           * named and accepted: a screen with no such option is a better answer than one
           * that quietly keeps a false promise. The same boundary `EditTeam.tsx` has
           * drawn round its own form from the start („What is not asked here. The
           * logo..."). It returns the day a route exists to receive one.
           */
          async function submit(body: object, name: string): Promise<void> {
            outstanding.current = true
            setSending(true)
            setRefusal(null)

            const answer = await askTheServer('/api/teams', body)

            outstanding.current = false
            setSending(false)

            if (answer.got === 'done') {
              confirm(`/${locale}/timovi`, name)

              return
            }

            setRefusal(answer)
          }

          function onSubmit(values: FormValues) {
            if (outstanding.current) {
              return
            }

            const name = String(values.name)

            void submit(
              {
                name,
                note: String(values.note),
                /* Asked for before the form does (`TeamWriteApi.ASKED_FOR_BEFORE_THE_FORM_ASKS`):
                   the form has neither field yet, so both go in empty rather than
                   missing from the body at all. */
                bio: '',
                link: '',
                city: String(values.city),
                country: String(values.country),
              },
              name,
            )
          }

          return (
            <>
              <FormRenderer
                form={predlogTima}
                /* Above the note and under the heading, so the heading is the first
                   thing on the page (owner, 01.09.2026). A `CropChooser` stood beside
                   the note here too until 22.09.2026; see `submit`'s own note on why
                   it does not any more. */
                above={<p className="member__note">{t('teams.proposeNote2')}</p>}
                /* By the address the name makes, which is what has to be
                   unique and is what the queue compares (teamProposal.ts).
                   Comparing names let "Dunavski Trkaci" through to sit in the
                   queue for ever: the moderator could not approve it and the
                   member was never told why. The same function also refuses a
                   name that makes no address at all. */
                check={(values): Record<string, FieldError> =>
                  /* Through the overlay, like the two screens that decide.
                     Read straight from the file this form did not know about a
                     team approved a minute ago in this same visit, so it took a
                     proposal the queue was then bound to refuse. */
                  nameError(String(values.name), addressesIn(recordsOf(TEAMS, teams, overlay)))
                }
                onSubmit={onSubmit}
              />

              {/* `Registration.tsx`'s own pair: said out loud rather than left to a
                  button that looks unpressed (WCAG 2.2, 4.1.3), and a refusal named
                  by the route rather than a sentence of ours built on top of it. */}
              {sending && <p role="status">{t('teams.proposeSending')}</p>}

              {refusal !== null && (
                <ServerSaid answer={refusal} refusals={WHEN_PROPOSING_A_TEAM} />
              )}
            </>
          )
        }}
      </Resource>
    </div>
  )
}
