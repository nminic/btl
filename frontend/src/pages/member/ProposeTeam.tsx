import { countryName } from '../../data/countryName'
import { useState } from 'react'
import { Link } from 'react-router'
import { useToday } from '../../clock/useClock'
import { Resource } from '../../components/Resource'
import { combinePair, useCompetitors, useTeams } from '../../data/useResource'
import { NO_RATING } from '../../data/types'
import { FormRenderer } from '../../forms/FormRenderer'
import predlogTima from '../../forms/definitions/predlog-tima.form.json'
import type { FieldError, FormDef, FormValues } from '../../forms/types'
import { useI18n } from '../../i18n/useI18n'
import { recordsOf, TEAMS } from '../admin/entityForms'
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
  const [sent, setSent] = useState<string | null>(null)

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
        <p className="member__actions">
          <Link className="button button--primary" to={`/${locale}/timovi`}>
            {t('teams.proposeBack')}
          </Link>
        </p>
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
          const me = competitors.find((one) => one.memberNumber === mine)
          const who = me === undefined ? '' : `${me.firstName} ${me.lastName}`

          function onSubmit(values: FormValues) {
            const name = String(values.name)

            propose({
              queue: 'teams',
      /* No sorts on this queue: one is only told apart where a queue holds two
         (data/types.ts, `kind`). */
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
            })

            setSent(name)
          }

          return (
            <>
              <p className="member__note">{t('teams.proposeNote2')}</p>
              <FormRenderer
                form={predlogTima as FormDef}
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
