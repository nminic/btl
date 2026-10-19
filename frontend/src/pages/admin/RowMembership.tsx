import { useRef, useState } from 'react'
import { Prompt } from '../../components/Prompt'
import type { Member, MembershipBasis } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import {
  askingToCancel,
  cancelling,
  membershipOnTheRow,
  offeredFor,
  TO_THE_EXEMPTION,
  WHEN_CANCELLING,
  WHEN_CHANGING_TO_THE_EXEMPTION,
} from './memberMembership'
import './Activation.css'

/** Which of the two questions is open: a cancellation, or the change of a payment to the exemption. */
type Asking = 'cancel' | 'toTheExemption'

/**
 * „STORNIRAJ” AND „PROMENI OSNOV U OSLOBOĐENJE” ON ONE ROW OF THE MODERATION OF THE MEMBERS.
 *
 * The owner, 18.10.2026 (PDL P8): „Osnov se menja i uplata stornira opcijama na redu člana u moderaciji
 * članova, ne posebnim ekranom.” Each act asks first, in his words: „Storno: prozor za potvrdu
 * („Storniraj uplatu za sezonu [godina]?”)”, worded by basis („Storniraj oslobođenje za sezonu
 * [godina]?”, „Storniraj aktivaciju iz balansa za sezonu [godina]?”), and „Promena osnova iz „uplata” u
 * oslobođenje traži prozor za potvrdu, jer briše zapis o uplati: „Promeni osnov u oslobođenje za sezonu
 * [godina]? Zapis o uplati se briše.””
 *
 * **What is offered is `memberMembership.ts#offeredFor`'s**, and the payment over an exemption is
 * `RowPayment`'s with `overTheExemption`, drawn beside this by the screen.
 *
 * **The shape is `RowPayment`'s**, and so are its two guards: a ref set before the request goes out and
 * read on „Da”, so a second „Da” cannot send a second request while the first is in the air, and a
 * sheet that is told it is working so it cannot be put away until the answer comes. Any answer closes
 * the sheet; a refusal stays beside the row, in the words of the act that met it.
 *
 * **The year is `membershipSeason`**, the season the basis on the row is the basis of, which is the
 * season on sale and the only one the route can act on.
 */
export function RowMembership({
  one,
  onCancelled,
  onChanged,
}: {
  one: Member
  onCancelled: () => void
  onChanged: () => void
}) {
  const { t } = useI18n()
  const [asking, setAsking] = useState<Asking | null>(null)
  const [refused, setRefused] = useState<{
    act: Asking
    answer: Exclude<Answer, { got: 'done' }>
  } | null>(null)
  const outstanding = useRef(false)
  const [working, setWorking] = useState(false)

  const basis: MembershipBasis | undefined = one.membershipBasis
  const season = one.membershipSeason

  /* NOTHING ON SALE IS HELD, so there is nothing to cancel or change: the row offers `RowPayment`
     alone. The two fields travel together on the answer (`MembersApi`). */
  if (basis === undefined || season === undefined) {
    return null
  }

  /* NARROWED ONCE AND NAMED, because `send` below is a declaration and a declaration does not keep
     the narrowing of the guard above it. */
  const held: MembershipBasis = basis
  const offered = offeredFor(held)
  const whose = `${one.firstName} ${one.lastName}`

  async function send(act: Asking) {
    outstanding.current = true
    setWorking(true)

    try {
      /* One await, on a request chosen before it, for the reason `RowPayment.send` gives. */
      const asked =
        act === 'cancel'
          ? askTheServer(membershipOnTheRow(one.memberNumber), cancelling(held), 'DELETE')
          : askTheServer(membershipOnTheRow(one.memberNumber), TO_THE_EXEMPTION, 'PUT')
      const answer = await asked

      setAsking(null)

      if (answer.got === 'done') {
        setRefused(null)

        if (act === 'cancel') {
          onCancelled()
        } else {
          onChanged()
        }

        return
      }

      setRefused({ act, answer })
    } finally {
      outstanding.current = false
      setWorking(false)
    }
  }

  return (
    <div>
      <button type="button" className="button" onClick={() => setAsking('cancel')}>
        {t('admin.cancelMembership')}
      </button>
      {offered.toTheExemption && (
        <button type="button" className="button" onClick={() => setAsking('toTheExemption')}>
          {t('admin.changeToExemption')}
        </button>
      )}

      <div className="activate__said" role="status">
        {refused === null ? null : (
          <ServerSaid
            answer={refused.answer}
            refusals={refused.act === 'cancel' ? WHEN_CANCELLING : WHEN_CHANGING_TO_THE_EXEMPTION}
          />
        )}
      </div>

      {asking === null ? null : (
        <Prompt
          title={
            asking === 'cancel'
              ? t(askingToCancel(held), { season })
              : t('admin.askChangeToExemption', { season })
          }
          choices={[
            {
              label: t('admin.yes'),
              onChoose: () => {
                if (outstanding.current) {
                  return
                }

                void send(asking)
              },
            },
          ]}
          decline={t('admin.no')}
          onDecline={() => setAsking(null)}
          working={working ? t('results.sending') : undefined}
        >
          <p>{t('verification.askExemptionWhose', { whose, season })}</p>
        </Prompt>
      )}
    </div>
  )
}
