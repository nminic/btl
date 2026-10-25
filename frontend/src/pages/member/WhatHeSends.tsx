import { useLayoutEffect, useRef } from 'react'
import { CopyField } from '../../components/CopyField'
import { QrCode } from '../../components/QrCode'
import { Unreadable } from '../../components/Unreadable'
import {
  ipsPayload,
  PAYPAL_ADDRESS,
  RECIPIENT_ACCOUNT,
  RECIPIENT_ADDRESS,
  RECIPIENT_NAME,
  type PaymentMethod,
} from '../../data/paymentQr'
import { formatNumber, money } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import type { MyBalance } from './myBalance'
import { PaySlip } from './PaySlip'
import { useMyMembership } from './useMyMembership'

/* The account, the name and the seat are the association's own and live with the
 * payload (owner, 31.07.2026).
 *
 * The name alone goes into the code. The seat went in for a while, on a second
 * line, and the field it sits in has a length limit the two together were
 * pushing at. It is on the screen beside the code, in writing, which is where it
 * is read anyway. */
const RECIPIENT = RECIPIENT_NAME

/** An amount as the server keeps it: the figure and the money it is in, never a conversion. */
function written(amount: MyBalance, locale: string): string {
  return `${money(amount.amount, locale)} ${amount.currency}`
}

/**
 * WHAT HE SENDS, AND HOW: the sentences that point at the payment data, the slip with its code,
 * and PayPal, all off `GET /api/me/membership` (PDL, 26.09.2026: „QR se kuje na iznos minus
 * balans").
 *
 * <p><b>The amount used to be the price list's</b>: the row of the period in force, for an adult,
 * with no balance and no promise, and the code was minted on it. The letter a member is sent after
 * his address is confirmed (owner, 23.10.2026) asks the server, so a junior, or a member with six
 * hundred dinars on his book, was sent one figure and shown another. The server's answer is the one
 * `TheLetterAfterTheAddress` builds from (`MembershipInvoice.asTheSlipPromises`), so the two now say
 * one number: the slip and the code ask for `toTransfer`, PayPal for `toTransfer` plus
 * `processingFeeEur`, exactly as letter C does.
 *
 * <p><b>MOUNTED ONLY WHERE A SLIP IS ABOUT TO BE DRAWN, AND THAT IS MY REASONING over the owner's
 * decision of 27.09.2026 rather than a decision of its own.</b> That decision made the first look of
 * a season fix what the code promises, and `MyMembershipApi` records the promise on the read itself.
 * Asked for a member who holds the season, is freed of it, or meets a shut panel, the read would
 * record a promise about a slip nobody was shown. So the parent draws this inside the one branch of
 * the panel that offers a payment, and never anywhere else.
 *
 * <p><b>A list of none or one, as every amount on this screen.</b> An answer about another season
 * than the one this panel sells, an answer saying a membership already stands, an amount in a money
 * that is not this way to pay, and nothing left to transfer all draw no slip and no PayPal amount,
 * and the sentence that says the data follows goes with them. Nothing left to transfer is the
 * balance covering the whole fee: no code then (PDL, 26.09.2026, „Balans veći ili jednak članarini
 * aktivira članstvo bez uplate"; owner, 25.10.2026, no slip, no QR and no PayPal amount for it). The
 * press that activates it is a separate piece of work and not here.
 */
export function WhatHeSends({
  asked,
  season,
  methods,
  neverPaid,
  purpose,
  reference,
}: {
  /** Whose read this is: his number, or the account of somebody who has not paid. */
  asked: number | string
  /** The season this panel sells, off the same clock as the rest of the screen. */
  season: number
  methods: PaymentMethod[]
  neverPaid: boolean
  purpose: string
  reference: string
}) {
  const { locale, t } = useI18n()
  const owed = useMyMembership(asked)
  const anchor = useRef<HTMLSpanElement>(null)
  const keptTheFocus = useRef(false)
  const failedOnce = useRef(false)

  /* THE FOCUS COMES BACK HERE when the button that asked again leaves with it, the shape
     `components/Resource.tsx` has for a part, copied with its guards (WCAG 2.2 SC 2.4.3): only if
     it left with the focus on it, only if nobody has taken the focus since, and onto a node of its
     own drawn only once this has failed, so a read that never failed is the markup it always was. */
  useLayoutEffect(() => {
    if (owed.status === 'error') {
      failedOnce.current = true
      keptTheFocus.current = false
    } else if (owed.status === 'ready' && keptTheFocus.current) {
      keptTheFocus.current = false

      if (document.activeElement === document.body) {
        anchor.current?.focus({ preventScroll: true })
      }
    }
  })

  if (owed.status === 'loading') {
    return null
  }

  if (owed.status === 'error') {
    return (
      <Unreadable
        said={t('membership.amountNotArrived')}
        reading={owed.reading}
        onRetry={owed.readAgain}
        onLeaveWithFocus={() => {
          keptTheFocus.current = true
        }}
      />
    )
  }

  const about = owed.data.season === season && !owed.data.alreadyAMember ? [owed.data] : []
  const inDinars = about.filter((one) => one.toTransfer.currency === 'RSD' && one.toTransfer.amount > 0)
  const inEuro = about.filter((one) => one.toTransfer.currency === 'EUR' && one.toTransfer.amount > 0)
  const slip = methods.includes('ips') ? inDinars : []
  const paypal = methods.includes('paypal') ? inEuro : []
  const drawn = [...slip, ...paypal]

  return (
    <>
      {failedOnce.current && (
        <span className="visually-hidden" tabIndex={-1} ref={anchor}>
          {t('membership.details')}
        </span>
      )}
      {/* „Podatke za uplatu vidiš u nastavku." ONLY WHERE THE DATA IT POINTS AT REALLY FOLLOWS
          (review of PR 385, three rounds, one per axis): read off `drawn`, which is exactly what the
          slip and the PayPal amount below are drawn from, so the sentence cannot drift from them. A
          control or a sentence pointing at data that is not there is worse than none (PDL.md,
          owner: „Kontrola koja ništa ne radi je gora nego da je nema"). */}
      {drawn.length > 0 && (
        <p className="member__note">{t(neverPaid ? 'membership.firstRenew' : 'membership.renew')}</p>
      )}
      {/* How the payment is known without a number (PDL P8, 10.10.2026), on the same condition. */}
      {neverPaid && drawn.length > 0 && (
        <p className="member__note">{t('membership.recognisedByName')}</p>
      )}
      {/* WHY THE SLIP ASKS LESS THAN THE PRICE ABOVE IT, said where the balance takes part (owner,
          25.10.2026, the sentence chosen as offered). Both figures are the answer's, so they add
          back up to the fee whichever slip he is holding. */}
      {drawn
        .filter((one) => one.fromTheBalance.amount > 0)
        .map((one) => (
          <p className="member__note" key="fromTheBalance">
            {t('membership.fromTheBalance', {
              fromTheBalance: written(one.fromTheBalance, locale),
              toTransfer: written(one.toTransfer, locale),
            })}
          </p>
        ))}
      {/* The slip itself, and only where it can be paid (PDL P8, owner 31.07.2026: „QR kod postoji
          samo za uplate iz Srbije"). One walk and not two, so the written half and the code are the
          same answer and cannot come apart. */}
      {slip.map((one) => (
        <PaySlip
          key="slip"
          heading={t('membership.payNow')}
          details={
            <dl className="pay__details">
              <dt>{t('membership.toWhom')}</dt>
              <dd>
                {RECIPIENT_NAME}
                <span className="pay__seat">{RECIPIENT_ADDRESS}</span>
              </dd>
              <dt>{t('membership.account')}</dt>
              <dd>{RECIPIENT_ACCOUNT}</dd>
              {/* NO ROW FOR SOMEBODY WITH NO REFERENCE: a „Poziv na broj" with nothing after it
                  would be a field he is told to fill in and cannot. */}
              {!neverPaid && (
                <>
                  <dt>{t('membership.reference')}</dt>
                  <dd>
                    <strong>{reference}</strong>
                  </dd>
                </>
              )}
              <dt>{t('membership.purposeLabel')}</dt>
              <dd>{purpose}</dd>
              <dt>{t('membership.amountLabel')}</dt>
              <dd>
                <strong>{written(one.toTransfer, locale)}</strong>
              </dd>
            </dl>
          }
          code={
            <QrCode
              text={ipsPayload({
                account: RECIPIENT_ACCOUNT,
                recipient: RECIPIENT,
                amountRsd: one.toTransfer.amount,
                purpose,
                reference,
              })}
              label={t('membership.ipsQrLabel')}
            />
          }
        />
      ))}
      {methods.includes('paypal') && (
        <div className="pay">
          <h4>{t('membership.paypal')}</h4>
          <p className="member__note">{t('membership.paypalNote')}</p>
          {/* What a member abroad sends through PayPal, fee included (owner, 27.09.2026: „cena
              ostaje 35, clan salje 38, a taksa se vidi kao svoj red"), less what his balance pays:
              the answer's transfer plus the answer's fee, as letter C adds them. */}
          {paypal.map((one) => (
            <div className="pay__slipText" key="paypal">
              <dl className="pay__details">
                <dt>{t('membership.toWhom')}</dt>
                <dd>{RECIPIENT_NAME}</dd>
              </dl>
              <CopyField
                label={t('membership.paypalAddressLabel')}
                value={PAYPAL_ADDRESS}
                copyButtonLabel={t('membership.paypalCopyAddress')}
                copiedMessage={t('membership.paypalAddressCopied')}
                failedMessage={t('membership.paypalAddressCopyFailed')}
              />
              {/* Two decimals always: this figure is typed into a PayPal amount field. */}
              <CopyField
                label={t('membership.paypalAmountLabel')}
                value={formatNumber(
                  Math.round((one.toTransfer.amount + one.processingFeeEur) * 100) / 100,
                  locale,
                  2,
                )}
                copyButtonLabel={t('membership.paypalCopyAmount')}
                copiedMessage={t('membership.paypalAmountCopied')}
                failedMessage={t('membership.paypalAmountCopyFailed')}
              />
              {/* AND NOT AT ALL FOR SOMEBODY WHO HAS NO REFERENCE (PDL P8, 10.10.2026): the note is
                  made of the reference and of nothing else. */}
              {!neverPaid && (
                <CopyField
                  label={t('membership.paypalNoteLabel')}
                  value={reference}
                  copyButtonLabel={t('membership.paypalCopyNote')}
                  copiedMessage={t('membership.paypalNoteCopied')}
                  failedMessage={t('membership.paypalNoteCopyFailed')}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
