import { useCallback, useEffect, useRef, useState } from 'react'
import { Resource } from '../../components/Resource'
import { FormRenderer } from '../../forms/FormRenderer'
import { valuesFor } from '../../forms/records'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { useHeldRead } from '../member/useHeldRead'
import {
  SHARED_WITH_THE_MEMBERS_OWN,
  WHEN_CORRECTING_A_MEMBER,
  membersDataIn,
  theMembersForm,
  whatTheAdministrationChanged,
  type MembersData,
} from './memberData'

/** Where a member's data are read and corrected by the administration (PR 633). */
function addressOfTheData(memberNumber: string | undefined): string {
  return `/api/members/${memberNumber}/data`
}

/**
 * WHAT THE SERVER SAYS OF ONE MEMBER, or nothing where it said nothing a form can be opened with: a
 * read that could not be made, an answer other than 200 (the door answers 404 to anybody without the
 * right, ADL A8), or a body this portal does not know.
 */
async function whatTheServerSaysOf(memberNumber: string | undefined): Promise<MembersData | null> {
  let answer: Response

  try {
    answer = await fetch(addressOfTheData(memberNumber))
  } catch {
    return null
  }

  if (!answer.ok) {
    return null
  }

  try {
    return membersDataIn(await answer.json())
  } catch {
    return null
  }
}

/**
 * THE CARD „PODACI" AS THE ADMINISTRATION OVER THE MEMBERS SEES IT: the form of the registration,
 * filled with what the server holds, without the password (owner, 22.10.2026: „Dugme Edit otvara
 * popunjenu formu sa svim podacima kao registracionu, samo bez lozinke. Tu admini i moderatori imaju
 * pravo da izmene sve podatke takmičara.").
 *
 * <p><b>Read from the administration's own read and never from the public list</b> (the coordinator's
 * P4, the assistant's reasoning, 22.10.2026): the screen of the members shows a member whose fee has
 * lapsed under „Neaktivni" with the button on his row, and the public list does not carry him.
 *
 * <p><b>The address of post is held where the server would refuse it</b>, which is where it is confirmed
 * (PDL, M7: „adresu pošte administracija menja samo dok nije potvrđena"); a member with no account has
 * no box for it at all (`theMembersForm`).
 */
export function TheMembersData({ memberNumber }: { memberNumber: string | undefined }) {
  const read = useCallback(() => whatTheServerSaysOf(memberNumber), [memberNumber])
  const state = useHeldRead(read, String(memberNumber), "A member's data could not be read")

  return (
    <Resource state={state} inline>
      {(data) => <TheForm key={data.memberNumber} opened={data} />}
    </Resource>
  )
}

function TheForm({ opened }: { opened: MembersData }) {
  const { t } = useI18n()
  /* WHAT THE SERVER HOLDS, moved by the server's own answer to a save and by nothing else: the route
     answers with the member as he now stands (`MemberDataWriteApi`), which is what the next save is
     compared with. */
  const [standing, setStanding] = useState<MembersData>(opened)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [nothing, setNothing] = useState(false)
  const [asking, setAsking] = useState(false)
  const out = useRef(false)
  const said = useRef<HTMLParagraphElement>(null)
  const form = theMembersForm(opened.emailConfirmed !== null)
  const saved = answer !== null && answer.got === 'done'

  /* Said out loud, because the answer to the press appears somewhere else on the screen (WCAG 2.2
     SC 4.1.3), the shape the member's own panel keeps (`PersonalData.tsx`). */
  useEffect(() => {
    if (saved || nothing) {
      said.current?.focus()
    }
  }, [saved, nothing])

  async function send(values: Record<string, string | boolean>): Promise<void> {
    const changed = whatTheAdministrationChanged(standing, values)

    setAnswer(null)

    if (Object.keys(changed).length === 0) {
      setNothing(true)

      return
    }

    setNothing(false)
    out.current = true
    setAsking(true)

    const answered = await askTheServer(addressOfTheData(standing.memberNumber), changed, 'PUT')
    const now = answered.got === 'done' ? membersDataIn(answered.body) : null

    /* AN ANSWER THAT SAYS DONE BUT CANNOT BE READ is the number of a reply this portal does not know,
       and not a save to be claimed: what stands is then unknown, so nothing is moved. */
    if (answered.got === 'done' && now === null) {
      setAnswer({ got: 'wrong', status: 200 })
    } else {
      if (now !== null) {
        setStanding(now)
      }

      setAnswer(answered)
    }

    out.current = false
    setAsking(false)
  }

  return (
    <section className="member__panel profile__data" aria-labelledby="form-podaci-clana-title">
      <FormRenderer
        form={form}
        title={t('account.personalTitle')}
        initial={valuesFor(form, opened)}
        fixed={opened.emailConfirmed === true ? ['email'] : undefined}
        sendIsHeld={asking ? true : undefined}
        sendIsOut={out}
        onSubmit={(values) => {
          void send(values)
        }}
      />

      {(saved || nothing) && (
        <p className="member__note" ref={said} tabIndex={-1} role="status">
          {t(saved ? 'account.saved' : 'memberData.nothingChanged')}
        </p>
      )}

      {answer !== null && answer.got !== 'done' && (
        <ServerSaid answer={answer} refusals={{ ...SHARED_WITH_THE_MEMBERS_OWN, ...WHEN_CORRECTING_A_MEMBER }} />
      )}
    </section>
  )
}
