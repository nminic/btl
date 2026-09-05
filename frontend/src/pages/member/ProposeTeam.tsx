import { countryName } from '../../data/countryName'
import { useState } from 'react'
import { Navigate } from 'react-router'
import { useToday } from '../../clock/useClock'
import { teamOf } from '../../data/derive'
import { inYearlyWindow } from '../../data/season'
import { useSend, useSent } from '../sent'
import { CropChooser } from '../../components/CropChooser'
import type { Chosen } from '../../components/CropChooser'
import { WHOLE } from '../../components/crop'
import { Resource } from '../../components/Resource'
import { combinePair, useCompetitors, useTeams } from '../../data/useResource'
import { NO_RATING } from '../../data/types'
import { FormRenderer } from '../../forms/FormRenderer'
import { predlogTima } from '../../forms/definitions'
import type { FieldError, FormValues } from '../../forms/types'
import { useI18n } from '../../i18n/useI18n'
import { MEMBERS, recordsOf, TEAMS } from '../admin/entityForms'
import { useOverlay } from '../admin/overlay'
import { addressesIn, nameError } from '../admin/teamProposal'
import { useSession } from '../../session/useSession'
import { SignedOut } from './SignedOut'
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
  const { memberNumber, propose } = useSession()
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
  /** The logo, if the member has one to hand. Held here and not in the form
   *  definition: a form field is a value typed into a box, and this is a file
   *  read off a disc with three sliders over it. */
  const [logo, setLogo] = useState<Chosen | null>(null)

  if (memberNumber === null) {
    return <SignedOut />
  }

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
          /* Who is proposing, by the name the rest of the portal knows them by.
             The queue shows a name beside every waiting item, and a member
             number on its own tells a moderator nothing about who to ask. */
          /* Through the overlay, and that is the whole of whether this door shuts:
             approving a proposal writes the team onto the member's record in the
             session (`admin/PendingQueue.tsx`), and the file on the disc knows
             nothing of it. Read straight from the file, the door let the founder of
             a team walk back in and found a second one the same minute — measured in
             review, 05.09.2026, two teams and one organiser. `Membership.tsx` reads
             a member the same way for the same reason. */
          const me = recordsOf(MEMBERS, competitors, overlay).find(
            (one) => one.memberNumber === mine,
          )
          const who = me === undefined ? '' : `${me.firstName} ${me.lastName}`

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

          function onSubmit(values: FormValues) {
            const name = String(values.name)

            propose({
              queue: 'teams',
              /* No sorts on this queue: one is only told apart where a queue
                 holds two (data/types.ts, `kind`). */
              kind: '',
              date: today,
              memberNumber: mine,
              who,
              subject: name,
              /* A team does not exist yet, so there is no id to file it under. */
              subjectId: '',
              /* What the moderator reads before deciding. The town and the
                 country belong in it rather than in fields of their own: the
                 queue shows one piece of text per item, the same on all seven,
                 and a shape that grew a column for every queue is the thing that
                 one shape was chosen to avoid (src/data/types.ts). */
              body: t('teams.proposeBody', {
                city: String(values.city),
                country: countryName(String(values.country)),
                note: String(values.note),
              }),
              currentDate: '',
              proposedDate: '',
              /* Nothing to rate: a team is not an event. */
              rating: NO_RATING,
              email: '',
              /* In their own fields as well as in the words above, because
                 approving the proposal makes the team out of them (PDL P13):
                 the words are for the moderator to read, these are what the
                 record is built from. */
              city: String(values.city),
              country: String(values.country),
              /* The logo and the square of it the member chose, which the
                 approval turns into the team's own (PendingQueue.tsx). Empty
                 where they proposed without one, and the whole picture with
                 it: a crop over nothing is nothing to draw. */
              picture: logo === null ? '' : logo.picture,
              crop: logo === null ? WHOLE : logo.crop,
            })

            confirm(`/${locale}/timovi`, name)
          }

          return (
            <>
              <FormRenderer
                form={predlogTima}
                /* Above the fields and under the heading, so the heading is the
                   first thing on the page. Drawn here before, the file field
                   stood ahead of it and the page began without a heading at all
                   (owner, 01.09.2026). */
                above={
                  <>
                    <p className="member__note">{t('teams.proposeNote2')}</p>
                    <CropChooser
                      id="team-logo"
                      label={t('teams.proposeLogo')}
                      alt={t('teams.proposeLogoAlt')}
                      /* A team may be proposed without a logo, and most are: the
                         league has four teams and one logo between them. */
                      asked={false}
                      chosen={logo}
                      onChange={setLogo}
                    />
                  </>
                }
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
            </>
          )
        }}
      </Resource>
    </div>
  )
}
