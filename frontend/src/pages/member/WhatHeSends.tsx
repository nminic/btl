import { Fragment, useEffect, useLayoutEffect, useRef } from 'react'
import { CopyField } from '../../components/CopyField'
import { QrCode } from '../../components/QrCode'
import { Unreadable } from '../../components/Unreadable'
import {
  ipsPayload,
  methodFor,
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
 * <p><b>A list of none or one, as every amount on this screen.</b> An answer saying a membership
 * already stands and nothing left to transfer draw no slip and no part „PayPal" at all, its heading
 * and its note about the business address included, and the sentence that says the data follows
 * goes with them (PDL, decision of 25.10.2026, „ne crta se ni deo „PayPal""). Nothing left to transfer
 * is the balance covering the whole fee: no code then (PDL, 26.09.2026, „Balans veći ili jednak
 * članarini aktivira članstvo bez uplate"; owner, 25.10.2026, no slip, no QR and no PayPal amount for
 * it).
 *
 * <p><b>An answer about another season than the one this panel sells, or asking in a money that is not
 * his way to pay, is not one of those</b>: it says the sentence of an amount that did not arrive, with
 * „Pokušaj ponovo" (PDL, decision of 25.10.2026, „ista rečenica kao kad iznos ne stigne"). The read
 * itself turns it into one that did not answer (`useMyMembership`), so it reaches this part as the
 * failure it is drawn as, and everything below is drawn off an answer already held to this panel.
 *
 * <p><b>AND THE BUTTON THAT LETS HIM IN ON HIS BALANCE, read off `coveredByTheBalance` and never off a
 * transfer of nought</b> (owner, 25.10.2026, PDL „Dugme „Aktiviraj članstvo" na „Mojoj članarini""). The
 * two are different facts: the first is today's book against the fee, the second what the slip of the
 * season promised. A member whose balance grew past the fee after his slip was minted has both - „vidi i
 * dugme i uplatnicu, pa bira" - so the button and the slip are each drawn off their own field, and either
 * may stand without the other. Drawn whatever way he pays: the balance is not a way to pay a transfer.
 * The press itself, and what stands after it, are the parent's (`useLetMeIn`), because the answer moves
 * the season he holds, and that takes this whole part off the page.
 */
export function WhatHeSends({
  asked,
  season,
  methods,
  neverPaid,
  purpose,
  reference,
  sending,
  onLetMeIn,
  onCovered,
}: {
  /** Whose read this is: his number, or the account of somebody who has not paid. */
  asked: number | string
  /** The season this panel sells, off the same clock as the rest of the screen. */
  season: number
  methods: PaymentMethod[]
  neverPaid: boolean
  purpose: string
  reference: string
  /** A press of „Aktiviraj članstvo" is out, so the button says it is busy and the sentence says why. */
  sending: boolean
  /** The press. */
  onLetMeIn: () => void
  /** Told whether the button is drawn, for the one sentence about him that stands outside this part:
   *  how somebody who has not paid gets his number (PDL, 25.10.2026). */
  onCovered: (covered: boolean) => void
}) {
  const { locale, t } = useI18n()
  const owed = useMyMembership(asked, season, methods)
  const anchor = useRef<HTMLSpanElement>(null)
  const keptTheFocus = useRef(false)
  const failedOnce = useRef(false)

  /* Only where no membership of the season stands: a list of none or one, and everything below is drawn
     off it. The read has already held the answer to this panel's season and to his way to pay. Worked
     out before the answer is looked at in any other way, because the sentence outside this part has to
     be told about it in an effect. */
  const about = owed.status === 'ready' && !owed.data.alreadyAMember ? [owed.data] : []
  const covered = about.filter((one) => one.coveredByTheBalance)
  const coveredAtAll = covered.length > 0

  /* NO CLEAN-UP THAT TELLS IT `false` ON THE WAY OUT, and that is measured rather than forgotten: the
     sentence it feeds is drawn only to somebody who has not paid, and this part leaves the page for him
     only when he is let in (and the sentence goes with his standing) or is read again (and the new one
     says `false` while it reads). No case could see such a clean-up, so it would be a line nothing holds. */
  useEffect(() => {
    onCovered(coveredAtAll)
  }, [coveredAtAll, onCovered])

  /* THE FOCUS COMES BACK HERE when the button that asked again leaves with it, the shape
     `components/Resource.tsx` has for a part (WCAG 2.2 SC 2.4.3): only if it left with the focus on
     it (`Unreadable` says so, and says nothing for a reader who moved on while it asked), and onto a
     node of its own drawn only once this has failed, so a read that never failed is the markup it
     always was. `Resource` also asks whether a screen took the focus for itself while it drew; nothing
     drawn here takes it, so that question has no case that could reach it and is not asked. */
  useLayoutEffect(() => {
    if (owed.status === 'error') {
      failedOnce.current = true
      keptTheFocus.current = false
    } else if (owed.status === 'ready' && keptTheFocus.current) {
      keptTheFocus.current = false
      anchor.current?.focus({ preventScroll: true })
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

  /* Split by the money of the answer, which the read has already held to a way he pays. */
  const owing = about.filter((one) => one.toTransfer.amount > 0)
  const slip = owing.filter((one) => methodFor(one.toTransfer.currency) === 'ips')
  const paypal = owing.filter((one) => methodFor(one.toTransfer.currency) === 'paypal')
  const drawn = [...slip, ...paypal]

  return (
    <>
      {failedOnce.current && (
        <span className="visually-hidden" tabIndex={-1} ref={anchor}>
          {t('membership.details')}
        </span>
      )}
      {/* HIS BALANCE COVERS THE FEE, SO HE MAY LET HIMSELF IN (owner, 25.10.2026: „Aktiviraj članstvo",
          the sentence above it as offered, no window asking him to confirm, because letter G promises
          „jednim klikom"). First on the panel, above any slip, for the member who has both. The season
          is the answer's, which the list already requires to be this panel's. */}
      {covered.map((one) => (
        <Fragment key="letMeIn">
          <p className="member__note">{t('membership.coveredByTheBalance', { season: one.season })}</p>
          <div className="member__links">
            <button
              type="button"
              className="button button--primary"
              aria-disabled={sending ? true : undefined}
              onClick={onLetMeIn}
            >
              {t('membership.letMeIn')}
            </button>
          </div>
          {/* Said in words while it is true (WCAG 2.2 AA, 4.1.3), in the portal's sentence for a request
              that is out, as „Potvrdi izlazak" says it on the same screen. */}
          {sending && (
            <p className="member__note" role="status">
              {t('results.sending')}
            </p>
          )}
        </Fragment>
      ))}
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
      {/* THE WHOLE PART, HEADING AND NOTE INCLUDED, ONLY WHERE THERE IS AN AMOUNT TO SEND (PDL, decision
          of 25.10.2026, „ne crta se ni deo „PayPal""): a heading and a note about an address with no
          address and no amount under them point at a payment that is not there. */}
      {paypal.map((one) => (
        <div className="pay" key="paypal">
          <h4>{t('membership.paypal')}</h4>
          <p className="member__note">{t('membership.paypalNote')}</p>
          {/* What a member abroad sends through PayPal, fee included (owner, 27.09.2026: „cena
              ostaje 35, clan salje 38, a taksa se vidi kao svoj red"), less what his balance pays:
              the answer's transfer plus the answer's fee, as letter C adds them. */}
          <div className="pay__slipText">
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
        </div>
      ))}
    </>
  )
}
