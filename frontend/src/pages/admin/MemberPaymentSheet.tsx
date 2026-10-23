import { useId, useState } from 'react'
import { Prompt } from '../../components/Prompt'
import type { Member } from '../../data/types'
import { money } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { typedIn } from './activation'
import { recording, type RowBooking, type RowPress } from './memberPayment'

type Shortfall = Extract<RowPress, { press: 'asksAboutTheShortfall' }>

/**
 * „UPIŠI UPLATU" ON A MEMBER'S ROW, AS A SHEET OVER THE PAGE (owner, 22.10.2026, PDL „Red na ekranu
 * članova ima pet kolona": „ne postoji više polje za unos iznosa uplate u tabeli, što znači da kad
 * kliknem na plus želim da se otvori popup za koji upišem iznos za tu sezonu").
 *
 * **What it asks is what the row asked until that day, and nothing more** (PDL P8, [IZVEDENO 18.10.2026]
 * „Na redu člana balans se uvek koristi za ostatak; nema kućice kao na ekranu Uplate."): one field in
 * his own money, the rest off his book, and „Prihvatam umanjen ukupan iznos?" before anything is sent
 * when even his book cannot cover it. That is his cases 1, 2, 3 and 7 of the payments screen; the
 * decision is `memberPayment.ts#recording`, asked here and not copied. Over it, so the moderator knows
 * what he is booking against, the expected amount and the balance (PDL P8, 18.10.2026, „Moderator sa
 * pravom nad članovima vidi balans i očekivani iznos svakog člana na redu u moderaciji").
 *
 * **Two steps, one sheet at a time.** The question about the shortfall REPLACES the sheet with the field
 * rather than standing over it: its „Ne" puts the whole thing away, which is the payments screen's rule
 * over every question (PDL 19, rule 1: „NE ... samo odlaže odluku"), and the moderator who wants another
 * amount presses „Upiši uplatu" again. Each step is its own `Prompt`, keyed, so each takes the focus to
 * its own question as it opens; the second puts it back where the first found it, on the row's button.
 *
 * **Nothing is sent from here.** `onSend` is the row's, which holds the one guard against a second
 * request (`MemberRow.tsx`), and `working` is how the row says one is out.
 */
export function MemberPaymentSheet({
  one,
  working,
  onSend,
  onClose,
}: {
  one: Member
  /** The words that say a request is out, or nothing while none is (`Prompt`'s `working`). */
  working: string | undefined
  onSend: (body: RowBooking) => void
  onClose: () => void
}) {
  const { locale, t } = useI18n()
  const [typed, setTyped] = useState('')
  const [shortfall, setShortfall] = useState<Shortfall | null>(null)
  /* Raised by a press with nothing in the field: an empty field and a nought are one state (PDL 19,
     point 5), and the row's button used to be switched off for it; a sheet's answer cannot be, so the
     same sentence is said instead. Lowered by typing. */
  const [pressedEmpty, setPressedEmpty] = useState(false)
  const fieldId = useId()
  const wrongId = useId()

  const whose = `${one.firstName} ${one.lastName}`
  const inHisCurrency = (amount: number): string => `${money(amount, locale)} ${one.currency}`
  const read = typedIn(typed)
  const wrong =
    read.got === 'refused'
      ? t('verification.amountNotRead')
      : read.got === 'nothing' && (typed.trim() !== '' || pressedEmpty)
        ? t('verification.activationRefused.theAmountIsNotMoney')
        : null

  if (shortfall !== null) {
    return (
      <Prompt
        key="shortfall"
        title={t('verification.askShortfall')}
        choices={[{ label: t('admin.yes'), onChoose: () => onSend(shortfall.body) }]}
        decline={t('admin.no')}
        onDecline={onClose}
        working={working}
      >
        <p>{t('verification.askExemptionWhose', { whose, season: one.seasonOnSale })}</p>
        <p>{t('verification.askGroundExpected', { amount: inHisCurrency(one.expected) })}</p>
        <p>{t('verification.askShortfallShort', { amount: inHisCurrency(shortfall.short) })}</p>
      </Prompt>
    )
  }

  return (
    <Prompt
      key="amount"
      title={t('admin.recordPayment')}
      choices={[
        {
          label: t('admin.recordPayment'),
          onChoose: () => {
            const press = recording(one, read)

            if (press.press === 'sends') {
              onSend(press.body)

              return
            }

            if (press.press === 'asksAboutTheShortfall') {
              setShortfall(press)

              return
            }

            setPressedEmpty(true)
          },
        },
      ]}
      decline={t('admin.form.keep')}
      onDecline={onClose}
      working={working}
    >
      <p>{t('verification.askExemptionWhose', { whose, season: one.seasonOnSale })}</p>
      <p>{t('verification.askGroundExpected', { amount: inHisCurrency(one.expected) })}</p>
      <p>{t('verification.askGroundBalance', { amount: inHisCurrency(one.balance) })}</p>
      <div className="rankings__field">
        <label htmlFor={fieldId}>{t('verification.paidIn', { currency: one.currency })}</label>
        <span className="activate__amount">
          <input
            id={fieldId}
            className="activate__field"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={typed}
            aria-describedby={wrong === null ? undefined : wrongId}
            aria-invalid={wrong === null ? undefined : true}
            onChange={(event) => {
              setTyped(event.target.value)
              setPressedEmpty(false)
            }}
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
    </Prompt>
  )
}
