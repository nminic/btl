import { useRef, useState } from 'react'
import { Navigate, useParams } from 'react-router'
import { Resource } from '../../components/Resource'
import { clearResourceCache } from '../../data/client'
import { combinePair, useCompetitors, useTeams } from '../../data/useResource'
import { readerAdministers } from '../../data/teamAdmin'
import { FormRenderer } from '../../forms/FormRenderer'
import { predlogTima } from '../../forms/definitions'
import type { FieldError, FormValues } from '../../forms/types'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { WHEN_CHANGING_A_TEAM } from '../account/refusals'
import { ServerSaid } from '../account/ServerSaid'
import { useSend, useSent } from '../sent'
import { MEMBERS, recordsOf, TEAMS } from '../admin/entityForms'
import { useOverlay } from '../admin/overlay'
import { addressesIn, addressOf, nameError } from '../admin/teamProposal'
import { useMemberScreen } from './memberScreen'
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
 * **SENT TO THE SERVER SINCE 23.11.2026, AT `POST /api/teams/{id}/changes`.** Until that day the
 * change was filed in the browser's session (`SessionProvider.propose`), so no moderator anywhere
 * but in this same tab ever saw it, and the team never changed. PDL P13, „[ODLUKE 23.11.2026 ...]",
 * point 3: the description and the link are changed here too, „ide na odobravanje, a dok čeka vidi
 * se stari opis". The route files the change in the queue of teams and nothing about the team moves
 * until a moderator approves it (`TeamWriteApi.askForAChange`, `VerificationWriteApi`).
 *
 * **The same form as a proposal, seeded.** A team is put forward the same way
 * whether it exists yet or not, and asking the questions twice in two shapes
 * would be two homes for one form. What differs is the title, the button, and
 * what an approval does at the other end: a proposal makes a record, a change
 * writes into the one that is already there.
 *
 * **So it changed with the proposal on 03.10.2026.** The owner named the page of
 * the proposal („Na strani Predlog tima, potrebno je da se Država automatski
 * popunjava kucanjem u mestu"), and the town became a place there
 * (`forms/PlaceField.tsx`); this form is that definition. What it costs, and it is
 * written here so that it is not found by a member: a team recorded in another
 * country than the one the codebook gives its town is opened with the record's
 * country standing and its select switched off, because the town is one the
 * codebook recognises, and the country moves only once the town has been typed
 * over (`pages/member/editTeam.test.tsx`).
 *
 * **Everything starts as the team says it today**, the description and the link
 * included, so the member changes a word rather than typing it all again.
 *
 * **What is not asked here.** The logo, and who administers the team. The first
 * because no route takes a picture with a change, and the second because it is
 * worked out rather than chosen (`data/teamAdmin.ts`).
 */
export function EditTeam() {
  const { locale, t } = useI18n()
  const { slug } = useParams()
  const who = useMemberScreen()
  const overlay = useOverlay()
  const state = combinePair(useCompetitors(), useTeams())
  /* Held by the address rather than by the screen, so the way back from this
     confirmation is the team itself and not the form already sent (PDL, 05.09.2026). */
  const said = useSent()
  const sent = typeof said === 'string' ? said : null
  const confirm = useSend()
  /* `ProposeTeam.tsx`'s own pair: the press is said out loud while it is out, and a second
     press while it is out sends nothing (the ref, because a state set in this tick is not
     read in it). */
  const outstanding = useRef(false)
  const [sending, setSending] = useState(false)
  const [refusal, setRefusal] = useState<Exclude<Answer, { got: 'done' }> | null>(null)

  if (who.memberNumber === null) {
    return who.instead
  }

  const { memberNumber } = who

  /* Narrowed once here, because the handler below is written inside a callback
     the compiler cannot see runs after the return above. */
  const mine = memberNumber

  return (
    <div className="member">
      <Resource state={state}>
        {([competitors, teams]) => {
          /* **Through the overlay, both of them**, as the ways into founding a team read
             them (review, 05.09.2026). Nothing writes a team into it any more since
             23.11.2026, so for a team the overlay adds nothing; the reading is kept so that
             one answer is not half read off the disc and half off the session. */
          const listed = recordsOf(TEAMS, teams, overlay)
          const members = recordsOf(MEMBERS, competitors, overlay)
          const team = listed.find((one) => one.slug === slug)

          if (team === undefined) {
            return <h1>{t('teams.notFound')}</h1>
          }

          /* Held once, for the same reason `mine` is: the handler below is a
             function declaration, and a declaration is hoisted past the guard
             above, so the compiler will not carry the narrowing into it. */
          const about = team

          /* **Not this member's address, so not a page.** Owner, 05.09.2026, of the
             way into founding a team and of this one with it: „Ako neko proba
             deeplink... treba da se preusmeri na homepage." Asked as a permission and
             not as a comparison (`readerAdministers`, since 21.09.2026), and the reader's
             own record first, because both arms of that permission require him to be in
             the team. The route asks the same question of the server's own record and
             answers 404 to everybody else (ADL A8). */
          const admin = members.find((one) => one.memberNumber === mine)

          if (admin === undefined || !readerAdministers(team, members, mine)) {
            return <Navigate to={`/${locale}`} replace />
          }

          if (sent !== null) {
            return (
              <div role="status">
                <h1>{t('teams.editDoneTitle')}</h1>
                <p>{t('teams.editDone', { name: sent })}</p>
              </div>
            )
          }

          async function submit(values: FormValues): Promise<void> {
            outstanding.current = true
            setSending(true)
            setRefusal(null)

            const name = String(values.name)
            const answer = await askTheServer(`/api/teams/${String(about.id)}/changes`, {
              name,
              /* The town by name and country, as the proposal sends it (`ProposeTeam.tsx`):
                 `PlaceField` writes the town's name and its country code and has no mark of
                 the codebook to give. */
              city: String(values.city),
              country: String(values.country),
              bio: String(values.bio),
              link: String(values.link),
            })

            outstanding.current = false
            setSending(false)

            if (answer.got === 'done') {
              /* So that a moderator who is also this member sees the change in the queue this
                 visit; dropped only on 201, because a refusal queued nothing. The team is not
                 dropped: nothing about it moved. */
              clearResourceCache('verification')
              confirm(`/${locale}/tim/${slug ?? ''}`, name)

              return
            }

            setRefusal(answer)
          }

          function onSubmit(values: FormValues) {
            if (outstanding.current) {
              return
            }

            void submit(values)
          }

          return (
            <>
              <FormRenderer
                form={IZMENA_TIMA}
                initial={{
                  name: team.name,
                  city: team.city,
                  /* Not a field of this form but the other half of the town: seeded from the
                     record, and left as the record says until the town is touched. Seeded empty,
                     the codebook would write its own country into a team nobody has been near
                     (`editTeam.test.tsx`, „is not rewritten by the codebook while nobody has
                     touched the town"). */
                  country: team.country,
                  bio: team.bio,
                  link: team.link ?? '',
                }}
                above={<p className="member__note">{t('teams.editNote')}</p>}
                /* Every other team's address, and not this one's: a change that
                   leaves the name alone must not be refused for clashing with the
                   team it is about. The route asks the same of every team but this
                   one (`TeamWriteApi.addressIsTaken`). */
                check={(values): Record<string, FieldError> =>
                  nameError(
                    String(values.name),
                    addressesIn(listed).filter((one) => one !== addressOf(team.name)),
                  )
                }
                onSubmit={onSubmit}
              />

              {sending && <p role="status">{t('teams.proposeSending')}</p>}

              {refusal !== null && <ServerSaid answer={refusal} refusals={WHEN_CHANGING_A_TEAM} />}
            </>
          )
        }}
      </Resource>
    </div>
  )
}
