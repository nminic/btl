import { useRef, useState } from 'react'
import { Prompt } from '../../components/Prompt'
import type { Member, MembershipBasis } from '../../data/types'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import {
  askingToCancel,
  cancelling,
  GRANTING,
  membershipOnTheRow,
  offeredFor,
  TO_THE_EXEMPTION,
  WHEN_CANCELLING,
  WHEN_CHANGING_TO_THE_EXEMPTION,
  WHEN_GRANTING_AN_EXEMPTION,
} from './memberMembership'
import './Activation.css'
import { SYMBOL } from '../../app/actionSymbol'
import { ActionButton } from '../../components/ActionButton'

/** Which act a question is about: a cancellation, the change of a payment to the exemption, or a grant. */
type Act = 'cancel' | 'toTheExemption' | 'grant'

/**
 * AN OPEN QUESTION AND THE REQUEST ITS „DA” SENDS, built together when the button is pressed, so the
 * words asked and the request sent are worked out once, from the row as it was drawn.
 */
type Asking = { act: Act; title: string; body: object; how: 'POST' | 'PUT' | 'DELETE' }

/** What each act's refusal is said in: the reasons its own request can meet. */
const REFUSED_IN: Record<Act, Record<string, string>> = {
  cancel: WHEN_CANCELLING,
  toTheExemption: WHEN_CHANGING_TO_THE_EXEMPTION,
  grant: WHEN_GRANTING_AN_EXEMPTION,
}

/**
 * „STORNIRAJ”, „PROMENI OSNOV U OSLOBOĐENJE” AND „ODOBRI OSLOBOĐENJE” ON ONE ROW OF THE MODERATION OF
 * THE MEMBERS.
 *
 * The owner, 18.10.2026 (PDL P8): „Osnov se menja i uplata stornira opcijama na redu člana u moderaciji
 * članova, ne posebnim ekranom.” Each act asks first, in his words: „Storno: prozor za potvrdu
 * („Storniraj uplatu za sezonu [godina]?”)”, worded by basis („Storniraj oslobođenje za sezonu
 * [godina]?”, „Storniraj aktivaciju iz balansa za sezonu [godina]?”), and „Promena osnova iz „uplata” u
 * oslobođenje traži prozor za potvrdu, jer briše zapis o uplati: „Promeni osnov u oslobođenje za sezonu
 * [godina]? Zapis o uplati se briše.”” And since 20.10.2026, on a row that holds no season on sale, the
 * exemption („Oslobođenje ostaje izbor na redu člana”, 18.10.2026), with the window the owner chose
 * that day between the outcomes put to him, with the recommendation: „Odobri oslobođenje od članarine za
 * sezonu [godina]?”.
 *
 * **What is offered is `memberMembership.ts#offeredFor`'s**, and the payment over an exemption is
 * `RowPayment`'s with `overTheExemption`, drawn beside this by the screen; so is the payment of a row
 * that holds nothing, beside „Odobri oslobođenje”.
 *
 * **The shape is `RowPayment`'s**, and so are its two guards: a ref set before the request goes out and
 * read on „Da”, so a second „Da” cannot send a second request while the first is in the air, and a
 * sheet that is told it is working so it cannot be put away until the answer comes. Any answer closes
 * the sheet; a refusal stays beside the row, in the words of the act that met it.
 *
 * **The year is `seasonOnSale`**, the season on sale and the only one the route can act on. It is the
 * season `membershipSeason` names whenever a basis is held, because `MembersApi` answers both from one
 * reading of the clock, and it is there on a row that holds none, which the grant asks about.
 */
export function RowMembership({
  one,
  onCancelled,
  onChanged,
  onGranted,
}: {
  one: Member
  onCancelled: () => void
  onChanged: () => void
  onGranted: () => void
}) {
  const { t } = useI18n()
  const [asking, setAsking] = useState<Asking | null>(null)
  const [refused, setRefused] = useState<{
    act: Act
    answer: Exclude<Answer, { got: 'done' }>
  } | null>(null)
  const outstanding = useRef(false)
  const [working, setWorking] = useState(false)

  const basis: MembershipBasis | undefined = one.membershipBasis
  const season = one.seasonOnSale
  const offered = offeredFor(basis)
  const whose = `${one.firstName} ${one.lastName}`
  const done: Record<Act, () => void> = { cancel: onCancelled, toTheExemption: onChanged, grant: onGranted }

  async function send(question: Asking) {
    outstanding.current = true
    setWorking(true)

    try {
      const answer = await askTheServer(membershipOnTheRow(one.memberNumber), question.body, question.how)

      setAsking(null)

      if (answer.got === 'done') {
        setRefused(null)
        done[question.act]()

        return
      }

      setRefused({ act: question.act, answer })
    } finally {
      outstanding.current = false
      setWorking(false)
    }
  }

  return (
    <div>
      {basis === undefined ? (
        <ActionButton
          symbol={SYMBOL.shieldCheck}
          word={t('admin.grantExemption')}
          className="button"
          onClick={() =>
            setAsking({
              act: 'grant',
              title: t('admin.askGrantExemption', { season }),
              body: GRANTING,
              how: 'POST',
            })
          }
        />
      ) : (
        <ActionButton
          symbol={SYMBOL.undo}
          word={t('admin.cancelMembership')}
          className="button"
          onClick={() =>
            setAsking({
              act: 'cancel',
              title: t(askingToCancel(basis), { season }),
              body: cancelling(basis),
              how: 'DELETE',
            })
          }
        />
      )}
      {offered.toTheExemption && (
        <button
          type="button"
          className="button"
          onClick={() =>
            setAsking({
              act: 'toTheExemption',
              title: t('admin.askChangeToExemption', { season }),
              body: TO_THE_EXEMPTION,
              how: 'PUT',
            })
          }
        >
          {t('admin.changeToExemption')}
        </button>
      )}

      <div className="activate__said" role="status">
        {refused === null ? null : (
          <ServerSaid answer={refused.answer} refusals={REFUSED_IN[refused.act]} />
        )}
      </div>

      {asking === null ? null : (
        <Prompt
          title={asking.title}
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
