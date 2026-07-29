import { Resource } from '../../components/Resource'
import { epcPayload, ipsPayload, methodsFor } from '../../data/paymentQr'
import { JUNIOR, SEASON, priceOn, registrationOpen } from '../../data/pricing'
import { useCompetitors } from '../../data/useResource'
import { useI18n } from '../../i18n/useI18n'
import { useSession } from '../../session/useSession'
import { SignedOut } from './SignedOut'
import './Member.css'

/* Placeholders until the association's real details exist. They are marked so
 * nobody mistakes them for the real account. */
const ACCOUNT = '000000000000000000'
const IBAN = 'RS00000000000000000000'
const BIC = 'XXXXRSBG'
const RECIPIENT = 'Sportsko udruzenje BTL'

/** Eight euros per member brought in, credited when their fee is activated. */
const REFERRAL_EUR = 8

export function Membership({
  today = new Date().toISOString().slice(0, 10),
}: { today?: string } = {}) {
  const { locale, t } = useI18n()
  const { memberNumber } = useSession()
  const state = useCompetitors()

  if (memberNumber === null) {
    return <SignedOut />
  }

  return (
    <Resource state={state}>
      {(competitors) => {
        const me = competitors.find((one) => one.memberNumber === memberNumber)

        if (me === undefined) {
          return <h1>{t('profile.notFound')}</h1>
        }

        const price = priceOn(today)
        const methods = methodsFor(me.country)
        const purpose = `Clanarina BTL ${SEASON} ${me.memberNumber}`

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
              <p className="member__note">
                {registrationOpen(today) && price !== null
                  ? t('membership.priceNow', { eur: price.eur, rsd: price.rsd })
                  : t('membership.notYetSold')}
              </p>
              <p className="member__note">{t('membership.junior', { eur: JUNIOR.eur })}</p>
            </section>

            <section className="member__panel" aria-labelledby="membership-pay">
              <h2 className="profile__section" id="membership-pay">
                {t('membership.howToPay')}
              </h2>
              <p className="member__note">{t('membership.byCountry', { country: me.country })}</p>

              {methods.includes('ips') && (
                <div className="pay">
                  <h3>{t('membership.ips')}</h3>
                  <p className="member__note">{t('membership.ipsNote')}</p>
                  <pre className="pay__payload">
                    {ipsPayload({
                      account: ACCOUNT,
                      recipient: RECIPIENT,
                      amountRsd: price?.rsd ?? 0,
                      purpose,
                      reference: '',
                    })}
                  </pre>
                </div>
              )}

              {methods.includes('epc') && (
                <div className="pay">
                  <h3>{t('membership.epc')}</h3>
                  <p className="member__note">{t('membership.epcNote')}</p>
                  <pre className="pay__payload">
                    {epcPayload({
                      iban: IBAN,
                      bic: BIC,
                      recipient: RECIPIENT,
                      amountEur: price?.eur ?? 0,
                      purpose,
                    })}
                  </pre>
                </div>
              )}

              {methods.includes('card') && (
                <div className="pay">
                  <h3>{t('membership.card')}</h3>
                  <p className="member__note">{t('membership.cardNote')}</p>
                </div>
              )}

              {methods.includes('paypal') && (
                <div className="pay">
                  <h3>{t('membership.paypal')}</h3>
                  <p className="member__note">{t('membership.paypalNote')}</p>
                </div>
              )}

              <p className="member__note">{t('membership.feesOnPayer')}</p>
            </section>

            <section className="member__panel" aria-labelledby="membership-referral">
              <h2 className="profile__section" id="membership-referral">
                {t('membership.referral')}
              </h2>
              <p className="member__note">{t('membership.referralNote', { eur: REFERRAL_EUR })}</p>
              <p className="pay__payload">{`https://balkanskatrkackaliga.net/${locale}/registracija?preporuka=${me.memberNumber}`}</p>
              <p className="membership__balance">
                <strong>0 EUR</strong> <span>{t('membership.balance')}</span>
              </p>
              <p className="member__note">{t('membership.balanceNote')}</p>
            </section>
          </div>
        )
      }}
    </Resource>
  )
}
