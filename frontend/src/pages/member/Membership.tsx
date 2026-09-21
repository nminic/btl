import { addressOf } from '../../app/head'
import { countryName } from '../../data/countryName'
import { useToday } from '../../clock/useClock'
import { useSession } from '../../session/useSession'
import { QrCode } from '../../components/QrCode'
import { Resource } from '../../components/Resource'
import { bestOfficialSeason } from '../../data/derive'
import { firstSeasonAllowed, FIRST_SEASON_POINTS } from '../../data/categories'
import { inYearlyWindow, seasonRunning } from '../../data/season'
import { useResults } from '../../data/useResource'
import {
  ipsPayload,
  methodsFor,
  paysInDinars,
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
  priceOn,
  registrationOpen,
  seasonBeingRenewed,
} from '../../data/pricing'
import { combineResources, useCompetitors, useTeams } from '../../data/useResource'
import { money } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { applyChanges } from '../../forms/records'
import { PRICING } from '../admin/entityForms'
import { recordKey } from '../../session/context'
import { useOverlay } from '../admin/overlay'
import { useMemberScreen } from './memberScreen'
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
 * An amount in the currency this member pays and is credited in.
 *
 * Serbia in dinars, everyone else in euro, decided by the same country on the
 * profile that decides how the fee itself may be paid, and by the same predicate
 * rather than a second copy of it (data/paymentQr.ts). Two figures side by side
 * would have said „five euro, that is six hundred dinars", which is a
 * conversion, and this list holds no rate: the dinar figure is chosen, not
 * converted (data/pricing.ts).
 *
 * Used for what a referral brings and for what the fee itself comes to. Written
 * for the referral alone, the row of the payment slip that carries the amount
 * was spelled RSD by hand, so a member in North Macedonia read „Iznos 4.800 RSD"
 * for a debt of 40 EUR, four sections above the same screen saying „5 EUR". It
 * is the same rule twice, so it is the same function twice.
 */
function inTheirCurrency(
  country: string,
  /* The two amounts and nothing else, because that is all this needs. Asked for
     a whole `PriceRow`, the junior fee could not be handed to it: it is a price
     with no period, since it holds „bez obzira na datum". */
  row: { eur: number; rsd: number },
  locale: string,
  times = 1,
): string {
  return paysInDinars(country)
    ? `${money(row.rsd * times, locale)} RSD`
    : `${money(row.eur * times, locale)} EUR`
}

/* HOW MANY MEMBERS THIS ONE BROUGHT IN USED TO BE COUNTED HERE, AND SINCE
 * 21.09.2026 IT ARRIVES COUNTED.
 *
 * The rule has not moved and is the owner's, 12.08.2026 and 13.08.2026: the link
 * records who brought whom, the credit falls when that member's own membership is
 * first ACTIVATED rather than paid, so somebody who registered through a link and
 * never went active pays nobody, and somebody the league freed of the fee still
 * counts („OK je da se za preporuku dobije balans čak i ako je preporučen član
 * oslobođen članarine", PDL P16).
 *
 * What moved is where it can be worked out. It read
 * `everybody.filter((one) => one.referredBy === me.referralCode && one.active)`,
 * and `/api/competitors` answers NEITHER of those two fields to anybody:
 * `referred_by` is the KEY of whoever brought a member (V7) and never a code, and
 * a member whose fee has lapsed is not on the list at all (owner, 13.09.2026). So
 * both halves are known in one place, the database, and the answer carries the
 * number itself as `referredCount` - on the caller's own row and on no other.
 *
 * **Left as it stood it would have shown nought to everybody, with nothing
 * failing.** Every row would have answered `undefined === <code>` false, which is
 * the same screen a member with no referrals sees, and the tests would have gone
 * on reading a generated file that still carries both fields.
 */

export function Membership() {
  const { locale, t } = useI18n()
  const who = useMemberScreen()
  const { myMembershipBasis } = useSession()
  /* The referral amount as administration has it, not as the file has it: it is
     a row of the price list and is changed there (AdminPricing).
   *
     The changes laid over the row directly rather than the row read out of a
     list of one. The price list is fixed: nothing is added to it and nothing is
     taken away (owner, 30.07.2026), so of the three things administration can do
     to a record only one can happen here, and asking for the other two left a
     list that could be empty and a default that could never be reached. */
  const overlay = useOverlay()
  const { edits } = overlay
  const credited = applyChanges(REFERRAL_ROW, edits[recordKey(PRICING.id, REFERRAL.key)])
  const state = combineResources(useCompetitors(), useResults(), useTeams())
  /* Renewal only opens inside its window and the price changes three times
     inside it, so this screen is the one that changes most with the date. It
     reads the same clock as everything else (src/clock). */
  const today = useToday()

  if (who.memberNumber === null) {
    return who.instead
  }

  const { memberNumber } = who

  return (
    <Resource state={state}>
      {([competitors, results, teams]) => {
        const me = competitors.find((one) => one.memberNumber === memberNumber)

        if (me === undefined) {
          return <h1>{t('profile.notFound')}</h1>
        }

        /* What the beginners' category is decided by, and it is not what this
           member has taken altogether.

           It was: the sum of every result they have, which in this portal means
           the history imported from 2010 to 2026. Measured against the data,
           that closed the category to thirty of the thirty two members over
           races run before the league existed, while the owner's decision
           (11.08.2026) closes it to nobody until an official season has been
           finished with twelve points. Both halves of the rule live in
           `bestOfficialSeason`. */
        const points = bestOfficialSeason(results, me.memberNumber)
        /* The season the renewal is for, which is never the one already
           running: in August 2027 the renewal that opens in October is for
           2028, and the heading said 2027. */
        const nextSeason = seasonBeingRenewed(today)
        const windowOpen = inYearlyWindow(today)
        const team = teams.find((one) => one.id === me.teamId)
        /* The prices as administration has them, not as the file has them.
           The referral row was already read through the price list while the fee
           itself was read off a constant, so an administrator could put 22,50 on
           the price list, see the table show it, and a member would still read 20
           and scan a code for the old figure. One screen sets these; one screen
           has to be enough. */
        const price = applyChanges(priceOn(today), edits[recordKey(PRICING.id, priceOn(today).key)])
        const junior = applyChanges(JUNIOR, edits[recordKey(PRICING.id, JUNIOR.key)])
        /* A member freed of the fee owes nothing at all (Pravilnik član 15, PDL P16),
           and twenty nine of the thirty two members in the data are freed of the fee. */
        /* **OFF THE ANSWER THAT CARRIES IT TO HIM, AND NOT OFF THE PUBLIC LIST**
           (21.09.2026). This read `me.membershipBasis`, and `/api/competitors` decides
           that field by asking whether the CALLER is the administration rather than
           whether the row is his (`CompetitorApi`), so a member is not given it even on
           his own row. Read there it came back nothing for every member, „freed of the
           fee" was false, and this screen opened the renewal with a payment slip on it:
           a member who owes the league nothing, asked for money.

           The owner's decision has both halves in one sentence, 20.09.2026: „Clan vidi
           SVOJ osnov clanstva; tudj ne vidi niko osim administracije." `/api/me` is
           where the first half lives, and the session remembers what it said
           (`session/context.ts`). */
        const feeExempt = myMembershipBasis === 'feeExempt'
        /* THE LIST OF MEMBERS USED TO BE READ HERE AND IS NOT ANY MORE, and the
           reason it was is worth keeping: the credit was counted off it, and counted
           straight off the FILE somebody an administrator had deleted went on earning
           their referrer six hundred dinars (ADL A8, a deleted record is freed from
           everything and not only from a list). Since 21.09.2026 the count arrives on
           the caller's own row as `referredCount`, worked out by the one place that
           still knows both halves of the rule, so there is no list here to lay an
           overlay over.

           **What that costs, said rather than left to be found:** a member an
           administrator deletes during THIS VISIT is still in the server's count until
           the deletion reaches the server, because the overlay cannot reach a number
           that was added up before it was handed over. The overlay is a stand-in for a
           database that does not take writes yet (ADL A8); the day it does, this is one
           of the places that stops having a gap rather than one that needs a fix. */
        /* What this member actually owes.

           **The junior fee is no longer applied here, and this is a boundary
           rather than an oversight** (13.09.2026). It used to be: the record
           carried a year of birth, `juniorInSeason` read it, and the code a
           member scanned matched the sentence above it. Before that it did not,
           and somebody born in 2014 read „Do 14 godina članarina je 20 EUR" and
           then scanned a request for 4.200 RSD.

           That fault is back, for whoever is a junior, and it is back on purpose.
           The year of birth has left the record because this record is served
           publicly and Član 74 forbids it (`data/types.ts`). What the record now
           carries is the age band, and a band cannot answer this: `24-` runs from
           a newborn to somebody of twenty four, and the junior fee stops at
           fifteen. Nothing else on the record narrows it.

           The two ways out both cost something and neither is mine to choose, so
           the question is the owner's and it is written down rather than guessed
           at. Putting a junior mark on the record would publish, of the one member
           it applies to, that they are a child — on a file anybody may read, and
           the very thing ADL A8 names as the sharpest edge of serving this file at
           all. Leaving it as it is means one member of thirty two is quoted the
           adult figure until the backend knows who they are.

           `juniorInSeason` is left standing in `data/pricing.ts` with nothing
           calling it. It is the rule, it is measured through the season rather
           than on the day, and it is deliberately not the sixteen of a parental
           signature (PDL P23) — a distinction the owner corrected by hand once
           already. It takes two numbers and not a record, so it asks nobody to put
           a year of birth back where one may not be. */
        const due = price
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
                {feeExempt
                  ? /* **The season they are in, not the one being sold.** This line stands in
                       „Stanje", which says what is true of a member now, and the panel below it
                       is the one that talks about renewal. Handed the renewal season it named
                       2028 from January to September of 2027 while the season the member was
                       actually running had no mention anywhere on the screen (review,
                       06.09.2026, measured on four days).

                       Before the league's first season there is none running, and then it is
                       the one being prepared: that is the whole of 2026, where the sentence
                       used to carry a typed 2027 and was right. Read from the clock either way,
                       never from the constant (ADL, 31.07.2026). */
                    t('membership.feeExempt', { season: seasonRunning(today) ?? nextSeason })
                  : t('membership.active', { season: me.firstSeason })}
              </p>
              {/* Both amounts, side by side, and no choice between them (PDL
                  P8, owner 31.07.2026): the price follows from where a member
                  lives, the portal works it out, and what the older rule
                  forbade was reading one as a conversion of the other. The ban
                  on showing them together was replaced by a ban on picking. */}
              {/* Nothing about a price to somebody who owes none. The slip was
                  taken away from a member freed of the fee and these three sentences
                  were not, so the screen still quoted the fee, the processing
                  charge and the junior rate to somebody it had just told they
                  pay nothing. */}
              {!feeExempt && (
              <>
              <p className="member__note">
                {registrationOpen(today)
                  ? t('membership.priceNow', {
                      eur: money(due.eur, locale),
                      rsd: money(due.rsd, locale),
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
                  eur: money(junior.eur, locale),
                  rsd: money(junior.rsd, locale),
                })}
              </p>
              </>
              )}
            </section>

            <section className="member__panel" aria-labelledby="membership-renewal">
              <h2 className="profile__section" id="membership-renewal">
                {t('membership.renewal', { season: nextSeason })}
              </h2>

              {/* A member freed of the fee owes nothing, ever (Pravilnik član 15, PDL
                  P16). Only the line about their status said so, while the
                  whole of the renewal underneath went on being drawn: a price,
                  „Uplati sada", the recipient, a reference number and a QR code
                  for 4.800 RSD they do not owe. Twenty nine of the thirty
                  members in the data are freed of the fee, so that was very nearly the
                  only thing this screen ever showed. */}
              {feeExempt ? (
                <p className="member__note">{t('membership.feeExemptNoRenewal')}</p>
              ) : windowOpen ? (
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
                  {/* Which ways of paying this member is offered, and why. It
                      belongs to the ways and not to the slip: a member abroad
                      sees no slip at all and still needs to know that PayPal and
                      a card are what their country gets. */}
                  <p className="member__note">
                    {t('membership.byCountry', { country: countryName(me.country) })}
                  </p>

                  {/* The slip itself, and only where it can be paid. PDL P8,
                      owner 31.07.2026: „QR kod postoji samo za uplate iz Srbije.
                      Član van Srbije ga ne vidi uopšte, ni u kom obliku."
                      Only the drawn code was hidden, so a member abroad still got
                      the heading, the association's dinar account, the reference
                      and an amount, which is the whole of the slip and the very
                      route that decision removed. The terms say the same in
                      writing: outside Serbia it is PayPal or a card. */}
                  {methods.includes('ips') && (
                    <>
                  <h3 className="profile__section">{t('membership.payNow')}</h3>

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
                    {/* The amount, which this list did not have at all. It exists
                        for somebody typing the payment into their bank by hand,
                        and the one thing a bank cannot do without is the sum. A
                        junior member had it worse than nobody: the only figure
                        they could read on this screen was the grown one, and the
                        right one was inside the code, where only a camera
                        reaches. */}
                    <dt>{t('membership.amountLabel')}</dt>
                    <dd>
                      <strong>{inTheirCurrency(me.country, due, locale)}</strong>
                    </dd>
                  </dl>

                  <p className="member__note">{t('membership.referenceNote')}</p>
                    </>
                  )}

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
                            amountRsd: due.rsd,
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
                              amountRsd: due.rsd,
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
                {t('membership.referralNote', { amount: inTheirCurrency(me.country, credited, locale) })}
              </p>
              {/* The code and not the member number. That number is public and
                  consecutive: it is the address of a profile and the sign in
                  list prints it beside every name, so anybody could assemble
                  somebody else's link, or credit themselves with a member they
                  never brought. The origin comes from the one place that holds
                  it, so a change of domain does not leave this link behind. */}
              {/* Nothing where the answer carried no code, which is every row but the
                  caller's own (`/api/competitors`). This screen is the caller's own row,
                  so it does not happen; written out because a `${undefined}` in an address
                  is a link a reader would copy and send, and the empty string is a link
                  that plainly does not work rather than one that looks as if it might. */}
              <p className="pay__payload">{`${addressOf(locale, 'registracija')}?preporuka=${me.referralCode ?? ''}`}</p>
              <p className="membership__balance">
                <strong>{inTheirCurrency(me.country, credited, locale, me.referredCount ?? 0)}</strong>{' '}
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
