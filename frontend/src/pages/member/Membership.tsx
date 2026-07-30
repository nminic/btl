import { QrCode } from '../../components/QrCode'
import { Resource } from '../../components/Resource'
import { totalsByMember, EMPTY_TOTALS } from '../../data/derive'
import { firstSeasonAllowed, FIRST_SEASON_POINTS } from '../../data/categories'
import { inYearlyWindow, seasonOnSale } from '../../data/season'
import { useResults } from '../../data/useResource'
import { epcPayload, ipsPayload, methodsFor } from '../../data/paymentQr'
import { JUNIOR, SEASON, priceOn, registrationOpen } from '../../data/pricing'
import { combineResources, useCompetitors, useTeams } from '../../data/useResource'
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
  const state = combineResources(useCompetitors(), useResults(), useTeams())

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
        const nextSeason = seasonOnSale(today)
        const windowOpen = inYearlyWindow(today)
        const team = teams.find((one) => one.id === me.teamId)
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

                      It needs an amount, so it hangs off the price row rather than
                      off the window. The window opens every October; a season whose
                      price list is not published yet has nothing to put on a slip. */}
                  <h3 className="profile__section">{t('membership.payNow')}</h3>

                  {price === null ? (
                    <p className="member__note">{t('membership.notYetSold')}</p>
                  ) : (
                    <>
                      <p className="member__note">
                        {t('membership.byCountry', { country: me.country })}
                      </p>

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
                                account: ACCOUNT,
                                recipient: RECIPIENT,
                                amountRsd: price.rsd,
                                purpose,
                                reference: '',
                              })}
                              label={t('membership.ipsQrLabel')}
                            />
                            <details>
                              <summary>{t('membership.showPayload')}</summary>
                              <pre className="pay__payload">
                                {ipsPayload({
                                  account: ACCOUNT,
                                  recipient: RECIPIENT,
                                  amountRsd: price.rsd,
                                  purpose,
                                  reference: '',
                                })}
                              </pre>
                            </details>
                          </div>
                        </div>
                      )}

                      {methods.includes('epc') && (
                        <div className="pay">
                          <h4>{t('membership.epc')}</h4>
                          <p className="member__note">{t('membership.epcNote')}</p>
                          <div className="pay__code">
                            <QrCode
                              text={epcPayload({
                                iban: IBAN,
                                bic: BIC,
                                recipient: RECIPIENT,
                                amountEur: price.eur,
                                purpose,
                              })}
                              label={t('membership.epcQrLabel')}
                            />
                            <details>
                              <summary>{t('membership.showPayload')}</summary>
                              <pre className="pay__payload">
                                {epcPayload({
                                  iban: IBAN,
                                  bic: BIC,
                                  recipient: RECIPIENT,
                                  amountEur: price.eur,
                                  purpose,
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

                      <p className="member__note">{t('membership.feesOnPayer')}</p>
                    </>
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
