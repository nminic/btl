import { useRef, useState } from 'react'
import { Prompt } from '../../components/Prompt'
import type { Member } from '../../data/types'
import { money } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { askTheServer, type Answer } from '../account/askTheServer'
import { ServerSaid } from '../account/ServerSaid'
import { typedIn } from './activation'
import {
  paymentOnTheRow,
  recording,
  WHEN_RECORDING_ON_THE_ROW,
  type RowBooking,
  type RowPress,
} from './memberPayment'
import { membershipOnTheRow, overTheExemption, WHEN_PAYING_OVER_THE_EXEMPTION } from './memberMembership'
import './Activation.css'
import { SYMBOL } from '../../app/actionSymbol'
import { ActionButton } from '../../components/ActionButton'

/**
 * „UPIS UPLATE" ON ONE ROW OF THE MODERATION OF THE MEMBERS.
 *
 * The owner, 18.10.2026 (PDL P8): „Na redu člana u moderaciji: upis uplate za sezonu”, and „kaže se
 * „uplata” i koliko je dinara uplaćeno”. So the row carries one field, in his own money („Iznos uplate
 * na redu člana je u valuti člana (dinari ili evri), kao na ekranu Uplate”), and one button; the rest
 * comes off his book, and when even his book cannot cover it the row asks „Prihvatam umanjen ukupan
 * iznos?” before it sends anything.
 *
 * **The shape is the payments screen's row** (`Payments.tsx`), and so are its two guards: a ref set
 * before the request goes out and read at both doors, so a second press or a second „Da" cannot send
 * a second body while the first is in the air, and a sheet that is told it is working so it cannot be
 * put away while a request is out.
 *
 * Drawn only for a member who holds no season on sale: the screen beside it hides the option when the
 * row already carries a basis for that season, and the server answers a second press of a payment
 * already booked 200 and writes nothing.
 *
 * **AND OVER AN EXEMPTION, SINCE 19.10.2026, with `overTheExemption`.** The owner, 18.10.2026 (PDL P8):
 * „Oslobođenje se može povući (storno) i preko njega se može upisati uplata.” It is the same field, the
 * same money and the same question about a shortfall, because the route books it through the same
 * booking (`MemberMembershipApi`, which calls `BookingAPayment`), so it is this row with one difference
 * said once: the request is a change of basis, `PUT /api/members/{broj}/membership` naming the
 * exemption it replaces, and its refusals are that route's as well as the booking's.
 */
type Question = Extract<RowPress, { press: 'asksAboutTheShortfall' }>

export function RowPayment({
  one,
  onRecorded,
  overTheExemption: replacingTheExemption = false,
}: {
  one: Member
  onRecorded: () => void
  /** The season on sale stands on an exemption, and the payment replaces it. */
  overTheExemption?: boolean
}) {
  const { locale, t } = useI18n()
  const [typed, setTyped] = useState('')
  const [asking, setAsking] = useState<Question | null>(null)
  const [refused, setRefused] = useState<Exclude<Answer, { got: 'done' }> | null>(null)
  const outstanding = useRef(false)
  const [working, setWorking] = useState(false)

  const read = typedIn(typed)
  /* DECIDED ONCE, and the button's disabling, its press and the question all read this one answer,
     which is `Payments.tsx`'s arrangement and its reason: a second reading inside the press would be a
     branch nothing can reach, because the button is disabled in exactly the case it would catch. */
  const press = recording(one, read)
  const sendsAtOnce: RowBooking | null = press.press === 'sends' ? press.body : null
  const question: Question | null = press.press === 'asksAboutTheShortfall' ? press : null

  const amountId = `row-paid-${one.memberNumber}`
  const wrongId = `row-wrong-${one.memberNumber}`
  const whose = `${one.firstName} ${one.lastName}`
  const inHisCurrency = (amount: number): string => `${money(amount, locale)} ${one.currency}`

  /* A NOUGHT TYPED IS NOT A PAYMENT, and the row says so beside the field rather than leaving a
     button switched off with nothing to explain it. An empty field needs no sentence. */
  const wrong =
    read.got === 'refused'
      ? t('verification.amountNotRead')
      : read.got === 'nothing' && typed.trim() !== ''
        ? t('verification.activationRefused.theAmountIsNotMoney')
        : null

  async function send(body: RowBooking) {
    outstanding.current = true
    setWorking(true)

    try {
      /* ONE AWAIT, ON A REQUEST CHOSEN BEFORE IT, and not an await in each arm of the choice: V8 counts
         the code after an await inside a conditional as blocks of their own, and with the two arms
         run by two test files the merged count lost the refusal below although both files reach it
         (measured on the gate of PR 579, 19.10.2026). The behaviour is the same either way. */
      const asked = replacingTheExemption
        ? askTheServer(membershipOnTheRow(one.memberNumber), overTheExemption(body), 'PUT')
        : askTheServer(paymentOnTheRow(one.memberNumber), body)
      const answer = await asked

      setAsking(null)

      if (answer.got === 'done') {
        setRefused(null)
        setTyped('')
        onRecorded()

        return
      }

      setRefused(answer)
    } finally {
      outstanding.current = false
      setWorking(false)
    }
  }

  return (
    <div>
      <div className="rankings__field">
        <label htmlFor={amountId}>{t('verification.paidIn', { currency: one.currency })}</label>
        <span className="activate__amount">
          <input
            id={amountId}
            className="activate__field"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={typed}
            aria-describedby={wrong === null ? undefined : wrongId}
            aria-invalid={wrong === null ? undefined : true}
            onChange={(event) => setTyped(event.target.value)}
          />
          <span className="activate__mark" aria-hidden="true">
            {one.currency}
          </span>
        </span>
      </div>

      {wrong === null ? null : (
        <p className="activate__wrong" id={wrongId}>
          {wrong}
        </p>
      )}

      <ActionButton
        symbol={SYMBOL.plus}
        word={t('admin.recordPayment')}
        className="button"
        disabled={press.press === 'nothing'}
        aria-disabled={working ? true : undefined}
        onClick={() => {
          if (outstanding.current) {
            return
          }

          if (sendsAtOnce !== null) {
            void send(sendsAtOnce)

            return
          }

          setAsking(question)
        }}
      />

      <div className="activate__said" role="status">
        {refused === null ? null : (
          <ServerSaid
            answer={refused}
            refusals={replacingTheExemption ? WHEN_PAYING_OVER_THE_EXEMPTION : WHEN_RECORDING_ON_THE_ROW}
          />
        )}
      </div>

      {asking === null ? null : (
        <Prompt
          title={t('verification.askShortfall')}
          choices={[
            {
              label: t('admin.yes'),
              onChoose: () => {
                if (outstanding.current) {
                  return
                }

                void send(asking.body)
              },
            },
          ]}
          decline={t('admin.no')}
          onDecline={() => setAsking(null)}
          working={working ? t('results.sending') : undefined}
        >
          <p>{t('verification.askExemptionWhose', { whose, season: one.seasonOnSale })}</p>
          <p>{t('verification.askGroundExpected', { amount: inHisCurrency(one.expected) })}</p>
          <p>{t('verification.askShortfallShort', { amount: inHisCurrency(asking.short) })}</p>
        </Prompt>
      )}
    </div>
  )
}
