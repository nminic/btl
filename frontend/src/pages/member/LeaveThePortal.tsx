import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Prompt } from '../../components/Prompt'
import { useI18n } from '../../i18n/useI18n'
import { useRole } from '../../roles/useRole'
import { leaveThePortal, whatTheServerSaysOfMyLeaving } from '../../session/theServer'
import { useSession } from '../../session/useSession'
import { ACCOUNT_DELETED } from '../accountDeleted'
import type { Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'

/**
 * „OBRIŠI NALOG", AT THE END OF „MOJA ČLANARINA", FOR AN ACCOUNT THAT NEVER BECAME A MEMBER.
 *
 * <p>The owner, 20.11.2026: „Moze li na kraju strane Moja Članarina da bude Obriši nalog. … jednostavno da
 * se obriše član kao da nikad nije ni registrovan i to je to". The button alone, with no heading and no
 * sentence beside it („To dugme samo stoji dole kao opcija", and „Ipak bez bilo kakvih tekstova na ovu
 * temu"), and a question before anything is deleted: the window „Obriši / Odustani", chosen with my
 * recommendation. No mail follows, also chosen with it.
 *
 * <p><b>THE SERVER SAYS WHO SEES IT</b>, through `mayLeave` on `GET /api/me`, which is the condition
 * `DELETE /api/me` asks again under its holds. So the button is drawn only to somebody the route would let
 * through, and only on a plain yes: while the answer is on its way, when it fails and when it is no, there
 * is nothing here. `account` keys the answer to whoever it was asked for, as `useMyMailLanguage` does, so
 * a second person signing in on the same laptop is never shown the first man's yes.
 *
 * <p><b>WHEN HE IS GONE</b> the portal forgets him and goes back to a visitor, as „Odjavi se" does
 * (`app/AccountMenu.tsx`), and opens the front page with „Vaš nalog je obrisan." The server has already put
 * his cookie out (`MeLeavingApi`), so nothing is asked of it again.
 */
export function LeaveThePortal({ account }: { account: number }) {
  const { locale, t } = useI18n()
  const { signOut } = useSession()
  const { become } = useRole()
  const navigate = useNavigate()
  const [heard, setHeard] = useState<{ asked: number; may: boolean } | null>(null)
  const [asking, setAsking] = useState(false)
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState<Exclude<Answer, { got: 'done' }> | null>(null)

  useEffect(() => {
    let stillHere = true

    void whatTheServerSaysOfMyLeaving().then((may) => {
      if (stillHere) {
        setHeard({ asked: account, may })
      }
    })

    return () => {
      stillHere = false
    }
  }, [account])

  if (heard === null || heard.asked !== account || !heard.may) {
    return null
  }

  async function leave() {
    setSending(true)

    const answer = await leaveThePortal()

    if (answer.got === 'done') {
      signOut()
      become('visitor')
      void navigate(`/${locale}`, { state: ACCOUNT_DELETED })

      return
    }

    setSending(false)
    setAsking(false)
    setFailure(answer)
  }

  return (
    <div className="member__leave">
      <button
        type="button"
        className="button button--secondary"
        onClick={() => {
          setFailure(null)
          setAsking(true)
        }}
      >
        {t('membership.deleteAccount')}
      </button>

      {failure !== null && <ServerSaid answer={failure} refusals={{}} />}

      {asking && (
        <Prompt
          title={t('membership.deleteAccountAsk')}
          choices={[{ label: t('membership.deleteAccount'), onChoose: () => void leave() }]}
          decline={t('membership.deleteAccountKeep')}
          onDecline={() => setAsking(false)}
          /* BUSY WHILE THE REQUEST IS OUT, in the portal's own words for one (`results.sending`, the leaving
             of a team on this same page): a second press, or Escape, then does nothing. */
          working={sending ? t('results.sending') : undefined}
        >
          <p>{t('membership.deleteAccountFinal')}</p>
        </Prompt>
      )}
    </div>
  )
}
