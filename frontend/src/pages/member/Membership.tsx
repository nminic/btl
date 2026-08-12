import { countryName } from '../../data/countryName'
import { useToday } from '../../clock/useClock'
import { QrCode } from '../../components/QrCode'
import { Resource } from '../../components/Resource'
import { totalsByMember, EMPTY_TOTALS } from '../../data/derive'
import { firstSeasonAllowed, FIRST_SEASON_POINTS } from '../../data/categories'
import { inYearlyWindow } from '../../data/season'
import { useResults } from '../../data/useResource'
import {
  ipsPayload,
  methodsFor,
  paymentPurpose,
  paymentReference,
  RECIPIENT_ACCOUNT,
  RECIPIENT_ADDRESS,
  RECIPIENT_NAME,
} from '../../data/paymentQr'
import {
  JUNIOR,
  PROCESSING_FEE_EUR,
  REFERRAL,
  REFERRAL_ROW,
  type PriceRow,
  priceOn,
  registrationOpen,
  seasonBeingRenewed,
} from '../../data/pricing'
import { combineResources, useCompetitors, useTeams } from '../../data/useResource'
import { formatNumber } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { PRICING, recordsOf } from '../admin/entityForms'
import { useOverlay } from '../admin/overlay'
import { SignedOut } from './SignedOut'
import './Member.css'

/* The account, the name and the seat are the association's own and live with the
 * payload (owner, 31.07.2026).
 *
 * The name alone goes into the code. The seat went in for a while, on a second
 * line, and the field it sits in has a length limit the two together were
 * pushing at. It is on the screen beside the code, in writing, which is where it
 * is read anyway. */
const RECIPIENT = RECIPIENT_NAME

/**
 * What one member brought in is worth, in the currency that member pays in.
 *
 * Serbia pays and is credited in dinars, everyone else in euro, decided by the
 * same country on the profile that decides how the fee itself may be paid
 * (data/paymentQr.ts). Two figures side by side would have said „five euro, that
 * is six hundred dinars", which is a conversion, and this list holds no rate:
 * the dinar figure is chosen, not converted (data/pricing.ts).
 */
function creditOf(country: string, credited: PriceRow, locale: string): string {
  return country === 'RS'
    ? `${formatNumber(credited.rsd, locale)} RSD`
    : `${formatNumber(credited.eur, locale)} EUR`
}

/** And nothing on that balance, in the same currency. Written „0 EUR" for
 *  everybody, it stood under a sentence that had just promised dinars. */
function emptyBalance(country: string): string {
  return country === 'RS' ? '0 RSD' : '0 EUR'
}

export function Membership() {
  const { locale, t } = useI18n()
  const { memberNumber } = useSession()
  /* The referral amount as administration has it, not as the file has it: it is
     a row of the price list and is changed there (AdminPricing). Read the way
     every entity on the portal is read, and defaulted to the row itself, so a
     list that comes back empty leaves the promise standing rather than blank. */
  const [credited = REFERRAL_ROW] = recordsOf(PRICING, [REFERRAL_ROW], useOverlay()).filter(
    (row) => row.key === REFERRAL.key,
  )
  const state = combineResources(useCompetitors(), useResults(), useTeams())
  /* Renewal only opens inside its window and the price changes three times
     inside it, so this screen is the one that changes most with the date. It
     reads the same clock as everything else (src/clock). */
  const today = useToday()

  if (memberNumber === null) {
    return <SignedOut />
  }

  return (
    <Resource state={state}>
      {([competitors, results, teams]) => {
        const me = competitors.find((one) => one.memberNumber === memberNumber)

        if (me === undefined) {
          return <h1>{t('profile.notFound')}</h1>
        }

        const points = (totalsByMember(results).get(me.memberNumber) ?? EMPTY_TOTALS).points
        /* The season the renewal is for, which is never the one already
           running: in August 2027 the renewal that opens in October is for
           2028, and the heading said 2027. */
        const nextSeason = seasonBeingRenewed(today)
        const windowOpen = inYearlyWindow(today)
        const team = teams.find((one) => one.id === me.teamId)
        const price = priceOn(today)
        const methods = methodsFor(me.country)
        /* What the member scans and what the association books. It named the
           first season for ever, so from October 2027 the heading would have
           said 2028 while the reference said 2027.

           The purpose says what the money is for and the reference says whose it
           is, which is the split a bank statement is reconciled by (owner,
           31.07.2026). */
        const purpose = paymentPurpose(nextSeason)
        const reference = paymentReference(nextSeason, me.memberNumber)

        return (
          <div className="member">
            <h1>{t('membership.title')}</h1>

            <section className="member__panel" aria-labelledby="membership-status">
              <h2 className="profile__section" id="membership-status">
                {t('membership.status')}
              </h2>
              <p className="membership__state">
                {me.membershipBasis === 'honorary'
                  ? t('membership.honorary')
                  : t('membership.active', { season: me.firstSeason })}
              </p>
              {/* Both amounts, side by side, and no choice between them (PDL
                  P8, owner 31.07.2026): the price follows from where a member
                  lives, the portal works it out, and what the older rule
                  forbade was reading one as a conversion of the other. The ban
                  on showing them together was replaced by a ban on picking. */}
              <p className="member__note">
                {registrationOpen(today)
                  ? t('membership.priceNow', {
                      eur: price.eur,
                      rsd: formatNumber(price.rsd, locale),
                    })
                  : t('membership.notYetSold')}
              </p>
              {/* What a payment carries besides the fee, said to everybody and
                  not only to whoever pays it (owner, 04.08.2026): the fee is
                  something a member should be able to look up, the same way
                  both prices are shown to everybody and only the choice between
                  them is not offered. What differs is who pays it, and the
                  sentence says that.

                  Beside the price rather than inside the renewal window: for
                  the nine months a season is running the price is quoted and
                  the window is shut, and the sentence was missing exactly
                  then. */}
              {registrationOpen(today) && (
                <p className="member__note">{t('membership.costs', { fee: PROCESSING_FEE_EUR })}</p>
              )}
              <p className="member__note">
                {t('membership.junior', {
                  eur: JUNIOR.eur,
                  rsd: formatNumber(JUNIOR.rsd, locale),
                })}
              </p>
            </section>

            <section className="member__panel" aria-labelledby="membership-renewal">
              <h2 className="profile__section" id="membership-renewal">
                {t('membership.renewal', { season: nextSeason })}
              </h2>

              {windowOpen ? (
                <>
                  <p className="member__note">{t('membership.renewalOpen')}</p>

                  <fieldset className="renewal">
                    <legend>{t('membership.chooseCategory', { season: nextSeason })}</legend>

                    <div className="field field--checkbox">
                      <div className="field__confirm">
                        <input
                          className="field__control"
                          type="radio"
                          id="cat-age"
                          name="category"
                          defaultChecked
                        />
                        <label className="field__label" htmlFor="cat-age">
                          {t('membership.ageBand')}
                        </label>
                      </div>
                    </div>

                    <div className="field field--checkbox">
                      <div className="field__confirm">
                        <input
                          className="field__control"
                          type="radio"
                          id="cat-first"
                          name="category"
                          disabled={!firstSeasonAllowed(points)}
                        />
                        <label className="field__label" htmlFor="cat-first">
                          {t('membership.firstSeasonBand')}
                        </label>
                      </div>
                    </div>

                    <p className="member__note">
                      {firstSeasonAllowed(points)
                        ? t('membership.firstSeasonOpen', { points: FIRST_SEASON_POINTS })
                        : t('membership.firstSeasonClosed', { points: FIRST_SEASON_POINTS })}
                    </p>
                  </fieldset>

                  <button type="button" className="button button--primary">
                    {t('membership.renew', { season: nextSeason })}
                  </button>

                  {/* The slip belongs to renewing, not to a screen of its own: the
                      member has just chosen a category and the next thing they need
                      is the code to pay with (owner, 29.07.2026).

                      It needs an amount, and there is always one: the four periods
                      of the price list repeat every year, so it cannot run out
                      (owner, 30.07.2026). The line above about membership not
                      being on sale is the one September before the launch, and
                      not the day the list ran out. */}
                  <h3 className="profile__section">{t('membership.payNow')}</h3>

                  <p className="member__note">
                    {t('membership.byCountry', { country: countryName(me.country) })}
                  </p>

                  {/* The same four facts the code carries, in writing, because a
                      code is no use to somebody typing a payment into their bank
                      on a telephone they are also holding the code on (owner,
                      31.07.2026). The reference is what the statement is
                      reconciled by, so it is called out under them. */}
                  <dl className="pay__details">
                    <dt>{t('membership.toWhom')}</dt>
                    <dd>
                      {RECIPIENT_NAME}
                      <span className="pay__seat">{RECIPIENT_ADDRESS}</span>
                    </dd>
                    <dt>{t('membership.account')}</dt>
                    <dd>{RECIPIENT_ACCOUNT}</dd>
                    <dt>{t('membership.reference')}</dt>
                    <dd>
                      <strong>{reference}</strong>
                    </dd>
                    <dt>{t('membership.purposeLabel')}</dt>
                    <dd>{purpose}</dd>
                  </dl>

                  <p className="member__note">{t('membership.referenceNote')}</p>

                  {/* Every way of paying is one way of doing what the slip
                      above is for, so they sit under it rather than beside
                      it. As third level headings they read as four more
                      sections of the renewal, which they are not. */}
                  {methods.includes('ips') && (
                    <div className="pay">
                      <h4>{t('membership.ips')}</h4>
                      <p className="member__note">{t('membership.ipsNote')}</p>
                      <div className="pay__code">
                        <QrCode
                          text={ipsPayload({
                            account: RECIPIENT_ACCOUNT,
                            recipient: RECIPIENT,
                            amountRsd: price.rsd,
                            purpose,
                            reference,
                          })}
                          label={t('membership.ipsQrLabel')}
                        />
                        <details>
                          <summary>{t('membership.showPayload')}</summary>
                          <pre className="pay__payload">
                            {ipsPayload({
                              account: RECIPIENT_ACCOUNT,
                              recipient: RECIPIENT,
                              amountRsd: price.rsd,
                              purpose,
                              reference,
                            })}
                          </pre>
                        </details>
                      </div>
                    </div>
                  )}

                  {methods.includes('card') && (
                    <div className="pay">
                      <h4>{t('membership.card')}</h4>
                      <p className="member__note">{t('membership.cardNote')}</p>
                    </div>
                  )}

                  {methods.includes('paypal') && (
                    <div className="pay">
                      <h4>{t('membership.paypal')}</h4>
                      <p className="member__note">{t('membership.paypalNote')}</p>
                    </div>
                  )}

                </>
              ) : (
                <p className="member__note">{t('membership.renewalShut')}</p>
              )}
            </section>

            <section className="member__panel" aria-labelledby="membership-transfer">
              <h2 className="profile__section" id="membership-transfer">
                {t('membership.transferWindow')}
              </h2>
              <p className="member__note">
                {team === undefined
                  ? t('membership.noTeam')
                  : t('membership.inTeam', { team: team.name })}
              </p>
              <p className="member__note">
                {windowOpen
                  ? t('membership.transferOpen', { season: nextSeason })
                  : t('membership.transferShut')}
              </p>
              {windowOpen && (
                <button type="button" className="button button--secondary">
                  {t('membership.askToJoin')}
                </button>
              )}
            </section>

            {/* The referral programme, and the balance it pays into.
             *
                One amount and not two, and it is the one this member is
                credited in: whoever pays in dinars is credited in dinars
                (data/paymentQr.ts decides that by the country on the profile,
                and it decides it here too, so the two can never disagree). The
                balance underneath used to be „0 EUR" for everybody, under a
                sentence promising dinars.

                Read through the price list rather than off the constant, because
                that is where an administrator sets it (owner, 12.08.2026) and
                what is typed there has to be what is promised here. The same
                read as every entity on the portal: the generated record with
                whatever administration has changed laid over it.

                It says when the credit lands, and that is not a detail: it lands
                when the new member's fee is activated, never at registration, so
                nobody is paid for an account that was opened and left. */}
            <section className="member__panel" aria-labelledby="membership-referral">
              <h2 className="profile__section" id="membership-referral">
                {t('membership.referral')}
              </h2>
              <p className="member__note">
                {t('membership.referralNote', { amount: creditOf(me.country, credited, locale) })}
              </p>
              <p className="pay__payload">{`https://balkanskatrkackaliga.net/${locale}/registracija?preporuka=${me.memberNumber}`}</p>
              <p className="membership__balance">
                <strong>{emptyBalance(me.country)}</strong>{' '}
                <span>{t('membership.balance')}</span>
              </p>
              <p className="member__note">{t('membership.balanceNote')}</p>
            </section>
          </div>
        )
      }}
    </Resource>
  )
}
