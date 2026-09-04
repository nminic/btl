import { countryName } from '../../data/countryName'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { useToday } from '../../clock/useClock'
import { WHOLE } from '../../components/crop'
import { Resource } from '../../components/Resource'
import { combinePair, useCompetitors, useTeams } from '../../data/useResource'
import { NO_RATING } from '../../data/types'
import { teamAdminOf } from '../../data/teamAdmin'
import { FormRenderer } from '../../forms/FormRenderer'
import { predlogTima } from '../../forms/definitions'
import type { FieldError, FormValues } from '../../forms/types'
import { useI18n } from '../../i18n/useI18n'
import { recordsOf, TEAMS } from '../admin/entityForms'
import { useOverlay } from '../admin/overlay'
import { addressesIn, addressOf, nameError } from '../admin/teamProposal'
import { useSession } from '../../session/useSession'
import { SignedOut } from './SignedOut'
import './Member.css'

/* The proposal form under another name, built once at module load rather than per
   render: it is handed to `FormRenderer` as a prop, and a fresh object every render
   is a changed prop every render. The precedent is `ISPRAVKA_PREBROJANOG` in
   `NewResult.tsx`, which narrows the same form for the same reason. */
const IZMENA_TIMA = {
  ...predlogTima,
  titleKey: 'teams.editTitle',
  submitKey: 'teams.editSubmit',
}

/**
 * A team changed by the member who administers it, decided on like a new one.
 *
 * Owner, 04.09.2026: „Izmeni tim ulazi u podatke tima koji se menjaju i ponovo
 * prolaze verifikaciju, dok na strani timova ostaju postojeći podaci dok se novi
 * ne verifikuju."
 *
 * **The same form as a proposal, seeded.** A team is put forward the same way
 * whether it exists yet or not, and asking the four questions twice in two shapes
 * would be two homes for one form. What differs is the title, the button, and
 * what an approval does at the other end: a proposal makes a record, a change
 * writes into the one that is already there (`admin/PendingQueue.tsx`).
 *
 * **The note starts empty on purpose.** Everything else is what the team says
 * about itself today, so the member changes a word rather than typing it all
 * again; the note is why *this* change should be allowed, and last time's reason
 * is not this time's.
 *
 * **What is not asked here.** The logo, and who administers the team. The first
 * because an approval cannot carry a picture into a record until there is a
 * database to put it in (`PendingQueue.tsx` says so where it happens), and the
 * second because it is worked out rather than chosen (`data/teamAdmin.ts`).
 */
export function EditTeam() {
  const { locale, t } = useI18n()
  const { slug } = useParams()
  const { memberNumber, propose } = useSession()
  const today = useToday()
  const overlay = useOverlay()
  const state = combinePair(useCompetitors(), useTeams())
  /** The name it was sent under, so the screen can say which team is waiting. */
  const [sent, setSent] = useState<string | null>(null)

  if (memberNumber === null) {
    return <SignedOut />
  }

  /* Narrowed once here, because the handler below is written inside a callback
     the compiler cannot see runs after the return above. */
  const mine = memberNumber

  return (
    <div className="member">
      <Resource state={state}>
        {([competitors, teams]) => {
          const team = teams.find((one) => one.slug === slug)

          if (team === undefined) {
            return <h1>{t('teams.notFound')}</h1>
          }

          /* Held once, for the same reason `mine` is: the handler below is a
             function declaration, and a declaration is hoisted past the guard
             above, so the compiler will not carry the narrowing into it. */
          const about = team

          /* **Not this member's address, so not a page.** Owner, 05.09.2026, of the
             way into founding a team and of this one with it: „Ako neko proba
             deeplink... treba da se preusmeri na homepage." A screen explaining the
             refusal is a screen that argues with somebody who cannot do anything
             about it; the button is not drawn for them either. */
          /* Who administers it, as a record rather than as a number, because the same
             answer is two things here: whether this reader may be on the page at all,
             and the name the queue shows beside what they send. A team nobody is in
             answers nobody, and then this address is not a page for anyone. */
          const admin = competitors.find(
            (one) => one.memberNumber === teamAdminOf(team, competitors),
          )

          if (admin === undefined || admin.memberNumber !== mine) {
            return <Navigate to={`/${locale}`} replace />
          }

          if (sent !== null) {
            return (
              <div role="status">
                <h1>{t('teams.editDoneTitle')}</h1>
                <p>{t('teams.editDone', { name: sent })}</p>
                <p className="member__actions">
                  <Link className="button button--primary" to={`/${locale}/tim/${team.slug}`}>
                    {t('teams.editBack')}
                  </Link>
                </p>
              </div>
            )
          }

          /* By the name the rest of the portal knows them by. Read off the record
             above rather than looked up again: whoever passed that guard is in the
             roster, so there is no „or nothing" here to write a branch for. */
          const who = `${admin.firstName} ${admin.lastName}`

          function onSubmit(values: FormValues) {
            const name = String(values.name)

            propose({
              queue: 'teams',
              /* The mark that tells the two decisions apart on one queue (owner,
                 04.09.2026, „uz oznaku šta je šta"). */
              kind: 'teamEdit',
              date: today,
              memberNumber: mine,
              who,
              subject: name,
              /* And which team it is about, which is the whole difference at the
                 far end: an approval writes into this record rather than making
                 one. A name cannot say it — the change may be a change of name. */
              subjectId: about.id,
              body: t('teams.proposeBody', {
                city: String(values.city),
                country: countryName(String(values.country)),
                note: String(values.note),
              }),
              currentDate: '',
              proposedDate: '',
              rating: NO_RATING,
              email: '',
              city: String(values.city),
              country: String(values.country),
              picture: '',
              crop: WHOLE,
            })

            setSent(name)
          }

          return (
            <FormRenderer
              form={IZMENA_TIMA}
              initial={{
                name: team.name,
                city: team.city,
                country: team.country,
                note: '',
              }}
              above={<p className="member__note">{t('teams.editNote')}</p>}
              /* Every other team's address, and not this one's: a change that
                 leaves the name alone must not be refused for clashing with the
                 team it is about. Read through the overlay for the same reason
                 the proposal does, so a team approved a minute ago in this visit
                 is counted. */
              check={(values): Record<string, FieldError> =>
                nameError(
                  String(values.name),
                  addressesIn(recordsOf(TEAMS, teams, overlay)).filter(
                    (one) => one !== addressOf(team.name),
                  ),
                )
              }
              onSubmit={onSubmit}
            />
          )
        }}
      </Resource>
    </div>
  )
}
