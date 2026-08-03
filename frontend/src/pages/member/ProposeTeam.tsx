import { useState } from 'react'
import { Link } from 'react-router'
import { useToday } from '../../clock/useClock'
import { Resource } from '../../components/Resource'
import { useCompetitors } from '../../data/useResource'
import { FormRenderer } from '../../forms/FormRenderer'
import predlogTima from '../../forms/definitions/predlog-tima.form.json'
import type { FormDef, FormValues } from '../../forms/types'
import { useI18n } from '../../i18n/useI18n'
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
  const state = useCompetitors()
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
        {(competitors) => {
          /* Who is proposing, by the name the rest of the portal knows them by.
             The queue shows a name beside every waiting item, and a member
             number on its own tells a moderator nothing about who to ask. */
          const me = competitors.find((one) => one.memberNumber === mine)
          const who = me === undefined ? '' : `${me.firstName} ${me.lastName}`

          function onSubmit(values: FormValues) {
            const name = String(values.name)

            propose({
              queue: 'teams',
              date: today,
              memberNumber: mine,
              who,
              subject: name,
              /* What the moderator reads before deciding. The town and the
                 country belong in it rather than in fields of their own: the
                 queue shows one piece of text per item, the same on all seven,
                 and a shape that grew a column for every queue is the thing that
                 one shape was chosen to avoid (src/data/types.ts). */
              body: t('teams.proposeBody', {
                city: String(values.city),
                country: t(`country.${String(values.country)}`),
                note: String(values.note),
              }),
              currentDate: '',
              proposedDate: '',
              email: '',
              city: '',
              country: '',
            })

            setSent(name)
          }

          return (
            <>
              <p className="member__note">{t('teams.proposeNote2')}</p>
              <FormRenderer form={predlogTima as FormDef} onSubmit={onSubmit} />
            </>
          )
        }}
      </Resource>
    </div>
  )
}
