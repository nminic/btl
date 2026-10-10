import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { addressOf } from '../../app/head'
import { useToday } from '../../clock/useClock'
import { useSession } from '../../session/useSession'
import { whoTheServerSaysIAm } from '../../session/theServer'
import { CopyField } from '../../components/CopyField'
import { QrCode } from '../../components/QrCode'
import { Resource } from '../../components/Resource'
import { FIRST_SEASON_POINTS } from '../../data/categories'
import { inYearlyWindow, seasonRunning } from '../../data/season'
import { useResults } from '../../data/useResource'
import {
  ipsPayload,
  methodsFor,
  PAYPAL_ADDRESS,
  paysInDinars,
  paymentPurpose,
  paymentReference,
  RECIPIENT_ACCOUNT,
  RECIPIENT_ADDRESS,
  RECIPIENT_NAME,
} from '../../data/paymentQr'
import { registrationOpen, seasonBeingRenewed } from '../../data/pricing'
import {
  A_FEE,
  A_LEVEL,
  A_REFERRAL,
  inForceOn,
  ofKind,
  pricedInBoth,
} from '../../data/priceList'
import { combineResources, usePricing, useTeams } from '../../data/useResource'
import { formatNumber, money } from '../../i18n/format'
import { useI18n } from '../../i18n/useI18n'
import { type Answer } from '../account/askTheServer'
import { WHEN_LEAVING_A_TEAM } from '../account/refusals'
import { ServerSaid } from '../account/ServerSaid'
import { useMemberScreen } from './memberScreen'
import { useMyCategory } from './useMyCategory'
import { theServerWasToldILeft } from './teamExit'
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
 * both halves are known in one place, the database, and the answer carried the
 * number itself as `referredCount` - on the caller's own row and on no other.
 *
 * **Left as it stood it would have shown nought to everybody, with nothing
 * failing.** Every row would have answered `undefined === <code>` false, which is
 * the same screen a member with no referrals sees, and the tests would have gone
 * on reading a generated file that still carries both fields.
 *
 * AND ON 25.09.2026 BOTH LEFT THE PUBLIC LIST ALTOGETHER, WHICH IS THE SAME FAULT
 * ONE STEP FURTHER ALONG.
 *
 * Owner, PDL P26a: „Licni link za preporuku se sklanja sa javne liste takmicara" i
 * ostaje samo na strani „Moja clanarina". The `where c.active` that had broken the
 * COUNTING broke the ANSWERING too: a member whose fee has lapsed has no row on that
 * list, so he reached neither field - and he is the one man V24 section 6 promises
 * the link to, on exactly this page, which is the page he opens to renew.
 *
 * **Both come off `GET /api/me` now, through the session** (`session/theServer.ts`,
 * `session/context.ts`), which answers ONE row and that row is his whether or not his
 * fee is standing. It is the road `membershipBasis` already takes, for a reason of
 * the same shape, and this screen therefore reads all three the same way.
 *
 * **AND THE RECORD ITSELF FOLLOWED THEM THE SAME DAY, WHICH IS THE DECISION THIS
 * PARAGRAPH USED TO SAY NOBODY HAD TAKEN.**
 *
 * It said: „What is still read off the public list is his RECORD, and that is a boundary
 * rather than an oversight... Moving the record is a decision nobody has taken and it is
 * not this one." The owner took it on 25.09.2026 (PDL P8a, „Strana za obnovu cita svoj
 * zapis sa `/api/me`"), choosing it over writing the boundary down and over leaving it
 * for another day. The old sentence is corrected here rather than deleted, because a
 * sentence saying „this is a boundary" is an instruction to the next reader to leave it
 * alone.
 *
 * **What it was costing, measured before the decision rather than after:** this screen
 * looked the caller up in `/api/competitors`, that query ends `where c.active`, so the
 * member whose fee had LAPSED found no row, and the screen he opens **in order to renew**
 * answered him „Ovog profila nema." He is not an edge of this page; he is what it is for.
 *
 * **So the five facts it needs about him all come off `GET /api/me` now** - his number,
 * his country, his first season, his team and how his membership is held - and all five
 * are components `MeApi.MyOwnRecord` already declared, so nothing was added to the server
 * for this. The public list is not read here at all any more: the resources below are
 * the results, the teams and the price list, and none of them is the list of members.
 */

export function Membership() {
  const { locale, t } = useI18n()
  const who = useMemberScreen()
  /* ALL SIX OFF THE ONE ANSWER THAT KNOWS WHO IS ASKING, and it was three until
     25.09.2026 and one until the day before that.

     **The six are here for two different reasons and the difference is worth keeping.**
     The basis, the link and the count are here because they have NO OTHER DOOR: P26a
     took the last two off the public list outright, and the basis was never on it for a
     member. The country, the season and the team DO have another door, and are read here
     anyway because that door answers `where c.active` - which is to say it answers
     everybody except the one man this screen exists for (P8a). */
  const {
    myMembershipBasis,
    myCountry,
    myFirstSeason,
    myTeamId,
    myReferralCode,
    myReferredCount,
    theServerSignedMeIn,
  } = useSession()
  /* THE PRICE LIST AS THE SERVER HAS IT, SINCE 26.09.2026, AND UNTIL THAT DAY AS THE
     BUNDLE HAD IT.
   *
     Every amount on this screen was read off `data/pricing.ts` with the session's overlay
     laid over it, and that overlay never reached a server: a price the administration
     changed lasted exactly as long as one visit in one browser. What that cost once
     `PUT /api/pricing/{key}` existed is named in `PricingWriteApi`'s own heading, and this
     screen is the sharpest end of it - the amount here goes into the IPS QR CODE A MEMBER
     SCANS, so an administrator who raised the fee raised what the next payment was booked
     at while the code still asked for the old figure.
   *
     THREE RESOURCES AND NOT FOUR: the list of members was the fourth and is gone since
     25.09.2026 (P8a) - the caller's own row comes off `GET /api/me` through the session
     above, and it answers him whether or not his fee is standing, which `/api/competitors`
     (`where c.active`) never did. `combineResources` is the same three-argument combiner
     this screen read the members list through until today, now pointed at the price list
     instead (`data/useResource.ts`). */
  const state = combineResources(useResults(), useTeams(), usePricing())
  /* Renewal only opens inside its window and the price changes three times
     inside it, so this screen is the one that changes most with the date. It
     reads the same clock as everything else (src/clock). */
  const today = useToday()

  /* THE CATEGORY BOX READS THE SERVER AND NOTHING ELSE, since 27.09.2026.
   *
     It is not one of the three resources above and must not be: those are public
     collections with a mock behind them, and this is one member's own answer on
     `/api/me/category`. It is also why this box no longer waits on anything the three
     carry - it draws as soon as its own read comes back, or not at all.
   *
     WHAT MOVED TO THE SERVER AND WHY EACH HALF HAD TO. `firstSeasonAllowed` was worked
     out here off `bestOfficialSeason(results, memberNumber)`, and PDL P7 (owner,
     11.08.2026) says whose question it is: „Ko sme da bude u pocetnickoj kategoriji
     proverava portal, ne clan." And `open` could never have been answered here at all:
     the deadline is 10:00 on 1 January (`SeasonClock.categoryMayBeChosenFor`) and this
     portal's clock reads whole days with no notion of an hour (`data/season.ts`). Drawn
     under `inYearlyWindow` the box vanished at midnight on 1 January and took the last
     ten hours of the member's own deadline with it. */
  const { standing, choosing, refusal, choose } = useMyCategory()

  /**
   * LEAVING THE TEAM: THE QUESTION, THE REASON IT WAS REFUSED, AND WHETHER ONE IS OUT.
   *
   * <p><b>Asked twice before it is sent, and that is MY REASONING over what the portal does
   * rather than a decision of the owner's.</b> No entry in the journal asks for a
   * confirmation here; the one that asks for „Da li ste sigurni?" is about DELETING a team
   * (PDL, 04.09.2026) and is a different act. What is measured is that a member cannot undo
   * this by himself: since T5 (10.10.2026) he may ask to be let back in from the team's page,
   * but whether he is taken is the team's to decide (PDL, 05.09.2026, „prijavu odobrava
   * administrator tima"), and the question itself says so (`membership.leaveTeamAsk`, the agent's
   * wording the owner chose on 10.10.2026: „Nazad se vraćaš samo ako tim prihvati tvoju prijavu
   * ili te ponovo pozove").
   * Until that day joining was not a member's action on this portal at all, and the reasoning
   * was stronger. So a mis-press costs him his team until somebody else agrees, and the
   * question is what stands between the two. <b>It is written down as my reasoning so that the
   * next reader can overturn it without looking for an owner's sentence that is not there.</b>
   *
   * <p><b>And it is asked with this screen's own words rather than through
   * `admin/EntityEditor.tsx`'s `DeleteRecord`.</b> That component asks the same way and its
   * three labels are about deleting a RECORD („Obriši", „Potvrdi brisanje: {name}") - which
   * is not what happens here, since nothing of his is deleted and the team goes on standing.
   * Widening it to a third set of words would reach every administrative screen that draws
   * it, which is a change to the administration in a branch about one member's own page.
   */
  const [asking, setAsking] = useState(false)
  /** Why the leaving did not happen, for the one person who pressed it. */
  const [refusedTheExit, setRefusedTheExit] = useState<Exclude<Answer, { got: 'done' }> | null>(
    null,
  )
  /**
   * WHETHER A LEAVING IS STILL OUT WITH THE SERVER, so a second press before the first has
   * answered cannot send a second one.
   *
   * <p><b>A ref and not the state beside it</b>, which is `admin/Payments.tsx`'s own
   * `outstanding` and the finding that put it there (VISOK 1, review of PR 411): a value set
   * inside this handler is not visible to a second click fired before the render it would
   * cause, and two clicks fired without waiting are exactly what a double press is.
   *
   * <p><b>What the second request would really cost, which is smaller here than there and is
   * still worth the guard.</b> `TeamWriteApi.leaving` answers the second one 404 - he is no
   * longer in a team it could be about - so nothing on the server is spent. What it costs is
   * on the screen: `ServerSaid` would draw „ništa nije promenjeno" over an act that had just
   * succeeded, which is the portal telling a member his leaving failed when it did not.
   */
  const outstanding = useRef(false)
  /** The same fact as a render can see, so the button can say out loud that it cannot act
   *  while its own request is out (`aria-disabled` below, told off rather than switched off:
   *  a control that goes away takes the keyboard focus with it). */
  const [leaving, setLeaving] = useState(false)
  /**
   * WHETHER THE QUESTION WAS LAST CLOSED BY AN ANSWER, so the button that asks it takes the focus the
   * confirming button had (owner, 02.10.2026, after a refusal: `admin/Payments.tsx` does the same
   * after a 409). Raised by an answer and lowered by asking again, so „Odustani" - the member's own
   * act, which moved nothing before this branch either - still moves nothing, and nothing is focused
   * when the page first draws. The effect below depends on the flag, so it runs when the flag CHANGES:
   * lowering it when the question is asked again is what lets the next refusal raise it again and run
   * the effect again (`leaveTeam.test.tsx`, „puts the focus on the button again after a second refusal").
   *
   * <p><b>A ref and an effect, and NOT `autoFocus`</b>, for the reason `admin/EntityEditor.tsx`'s
   * `DeleteRecord` gives at the same state: React reuses the confirming button's element for the
   * button that asks, so an attribute that acts when an element is created acts on neither road.
   */
  const [afterAnAnswer, setAfterAnAnswer] = useState(false)
  const opener = useRef<HTMLButtonElement>(null)

  /* A LAYOUT EFFECT, for the reason `DeleteRecord` gives: the focus is on the button in the very
     commit that draws it, and not a task later. */
  useLayoutEffect(() => {
    if (afterAnAnswer) {
      opener.current?.focus()
    }
  }, [afterAnAnswer])

  /**
   * LEAVES THE TEAM, AND THEN ASKS THE SERVER WHO IT NOW THINKS THIS MEMBER IS.
   *
   * <p><b>The second half is not optional and is not a refresh for tidiness.</b> The route
   * answers 204, so it answers NOTHING about what stands afterwards, and the fact this
   * section draws - `myTeamId` - is not a resource at all: it comes off `GET /api/me` through
   * the session, and `data/useResource.ts` says in as many words that dropping a resource
   * cache „says nothing to anybody holding a state that came out of it". This screen does not
   * go anywhere when the button is pressed, so nothing would ask again on its own and the
   * member would go on reading „Trenutno si u timu X" over a team he had just left.
   *
   * <p><b>Both steps are `member/SignIn.tsx`'s, in its order</b>, and the role is deliberately
   * not touched: `become` is the other half of what that screen does and leaving a team
   * changes nobody's role.
   *
   * <p><b>An answer that never came writes nothing at all</b>, which is
   * `session/useTheServersSession.ts`'s rule in its own words. A `null` here is no server to
   * reach, so the session keeps what it had rather than being cleared by a question that
   * failed - and the caches are already dropped, so the next mount asks again anyway.
   */
  async function leaveTheTeam(team: number): Promise<void> {
    outstanding.current = true
    setLeaving(true)
    setRefusedTheExit(null)

    try {
      const answer = await theServerWasToldILeft(team)

      if (answer.got !== 'done') {
        setRefusedTheExit(answer)

        return
      }

      const who = await whoTheServerSaysIAm()

      if (who !== null) {
        theServerSignedMeIn(who)
      }
    } finally {
      /* In a `finally`, so a route that rejects outright still lets the next press in - the
         same correction `admin/Payments.tsx` carries for the same reason.

         THE QUESTION CLOSES HERE, ON ANY ANSWER AND NOT BEFORE: with the request out „Odustani"
         does nothing (below), so this is the one road by which the question goes once „Potvrdi
         izlazak" has been pressed - which is the owner's „list se zatvara sam kad stigne odgovor"
         (02.10.2026), and since the same day it holds for a refusal as well (PDL, „Odbijanje
         zatvara pitanje kao i uspeh"). The reason returned above stands under the row, beside the
         button that asked, and the focus goes to that button. */
      outstanding.current = false
      setLeaving(false)
      setAsking(false)
      setAfterAnAnswer(true)
    }
  }

  /* The referral link, built here rather than where it is drawn: it needs only the
     locale and the session's own code, neither of which waits on the resources below,
     and the copy button needs the exact same string the paragraph prints. Built twice
     it could say two different things; built once, both read the one variable. */
  const referralLink = `${addressOf(locale, 'registracija')}?preporuka=${myReferralCode ?? ''}`

  if (who.memberNumber === null) {
    return who.instead
  }

  const { memberNumber } = who

  /**
   * THE ANSWER NAMED A MEMBER AND DID NOT CARRY HIS RECORD, which after 25.09.2026 is
   * the only way to be standing here.
   *
   * **Who this used to be, and it is the whole reason P8a exists.** It read
   * `competitors.find(...)` over `/api/competitors`, that query ends `where c.active`,
   * so the man it turned away was the member WHOSE FEE HAD LAPSED - on the one page he
   * opens in order to pay it. First he met a bare `h1`; from 25.09.2026 a heading with a
   * way home; and neither is what he wanted, which was to renew. He does not reach this
   * branch at all any more: `GET /api/me` answers one row and that row is his, standing
   * fee or not.
   *
   * **Who reaches it now, said exactly, because the sentence on the screen had to be
   * rewritten for him.** Somebody the answer gave a member number but no country or no
   * first season: a server one release ahead, a proxy answering something else, an
   * address that is not ours. It cannot happen against this backend - {@code MeApi}
   * writes „never absent" against both, and the schema behind each one is why (V7) - and
   * that is exactly the reason it is drawn rather than asserted (ADL A14). „Ovog profila
   * nema." was the old sentence and it would be a lie here: his profile is fine, and the
   * portal is the one that cannot read it.
   *
   * **Both fields and not one**, because they are two facts and either can be the one
   * missing. The country decides the currency of every figure on the page and whether
   * there is a payment slip at all, so a fallback would put a member abroad on a dinar
   * slip; the season is the sentence „Član od {season}. sezone."
   *
   * **The team is deliberately NOT in this condition.** Null there means „in no team",
   * which is sixteen of the thirty two members in the data and is drawn in as many words
   * further down. Putting it here would have turned the commonest ordinary state on this
   * screen into an error.
   *
   * Asked before the resources rather than inside them: nothing below can be drawn
   * without these two, so there is no reason to wait for a fetch first.
   */
  if (myCountry === null || myFirstSeason === null) {
    return (
      <div className="member">
        {/* **A HEADING OF ITS OWN AND NOT „Moja članarina", WHICH IS A MEASUREMENT AND
            NOT A PREFERENCE.** It was the page's own name for one draft. Every screen
            in this portal is mounted before `GET /api/me` has answered - the question
            is asked in an effect (`session/useTheServersSession.ts`) - so for one tick
            the session holds no record and this branch is what is on screen. Sharing
            the heading made „the answer did not carry my record" and „the answer is
            still on its way" the same screen, and it was measured the hard way: four
            cases resolved `findByRole('heading', { name: 'Moja članarina' })` against
            THIS h1 and then failed, because React had replaced the node underneath them
            by the time the assertion ran.

            So the two states say two different things, which is what they are. */}
        <h1>{t('membership.noRecordTitle')}</h1>
        <p className="member__note">{t('membership.noRecord')}</p>
        {/* The way out, in the portal's own words (`shell.home`), which is the shape
            `SignedOut` and `NotRacing` already use for a screen somebody cannot be
            given. */}
        <Link className="button button--primary" to={`/${locale}`}>
          {t('shell.home')}
        </Link>
      </div>
    )
  }

  return (
    <Resource state={state}>
      {/* THE FIRST RESOURCE IS FETCHED AND NO LONGER READ, and that is a boundary rather
          than an oversight. The list of results was here for one line - the sum that
          decided the beginners' category - and that question is the server's since
          27.09.2026 (see `useMyCategory` above). Dropping the resource itself needs a
          two-resource combiner and `data/useResource.ts` has only three and four
          (`combineResources`, `combineFour`), so it would be a change to a module every
          screen reads. Left as a hole here, named, and worth its own increment. */}
      {([, teams, prices]) => {
        /* The season the renewal is for, which is never the one already
           running: in August 2027 the renewal that opens in October is for
           2028, and the heading said 2027. */
        const nextSeason = seasonBeingRenewed(today)
        const windowOpen = inYearlyWindow(today)
        const team = teams.find((one) => one.id === myTeamId)
        /* THE FOUR AMOUNTS THIS SCREEN QUOTES, EACH AS A LIST OF NONE OR ONE.
         *
           A list even where exactly one row is expected, which is the portal's own idiom
           for a row that might not be there (`admin/AdminPricing.tsx`, on the referral):
           „Walked as a list, the case where it is missing is the empty list and needs no
           guard at all." Read off a constant, all four were always there and none of them
           could be absent; read off an answer, what arrives is whatever the table holds.
         *
           **Which is a boundary rather than a fear, and it is named where it is drawn.**
           The four periods tile the year with no gap and no overlap, and the side that can
           hold them to it does (`PriceListRowsTest` on the server). This side cannot, so a
           sentence with no amount to put in it is not drawn at all rather than drawn around
           a figure nobody sent. */
        const inBoth = pricedInBoth(prices)
        const due = inForceOn(inBoth, today)
        const junior = ofKind(inBoth, A_LEVEL)
        /* What a member is credited for everyone they bring in. Nobody pays it, so it is
           not a price of membership at all, and it is set on the price list because the
           owner asked for it there (12.08.2026: „ovo admin treba da konfiguriše na strani
           cenovnika takođe"). */
        const credited = ofKind(inBoth, A_REFERRAL)
        /* And what a payment from abroad costs to process, which is the one row with no
           dinar side - there is no intermediary there to pay (PDL, owner 04.08.2026) - so
           it is read off the whole answer and never off `inBoth`. */
        const processing = ofKind(prices, A_FEE)
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
           everything and not only from a list). Since 21.09.2026 the count arrives
           WORKED OUT by the one place that still knows both halves of the rule, so
           there is no list here to lay an overlay over. It arrived on the caller's own
           row of that very list until 25.09.2026, and P26a moved it to `/api/me` with
           the link beside it; the sentence above is about the LIST and is untouched by
           that, because the list stopped being counted either way.

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
        const methods = methodsFor(myCountry)
        /* What the member scans and what the association books. It named the
           first season for ever, so from October 2027 the heading would have
           said 2028 while the reference said 2027.

           The purpose says what the money is for and the reference says whose it
           is, which is the split a bank statement is reconciled by (owner,
           31.07.2026). */
        const purpose = paymentPurpose(nextSeason)
        const reference = paymentReference(nextSeason, memberNumber)
        /* WHAT A MEMBER ABROAD ACTUALLY SENDS THROUGH PAYPAL, fee included (owner,
           27.09.2026: „cena ostaje 35, clan salje 38, a taksa se vidi kao svoj red").
           The same `due` row the slip above already quotes, plus the same processing
           fee the sentence above the slip already quotes to everybody - never the
           junior row: nothing on the record can tell this member apart from an adult
           (the 13.09.2026 boundary the slip already lives with, `juniorInSeason`
           comment above), so PayPal reads the one price this screen can actually
           stand behind, exactly as the slip does.

           A list of none or one, like every other amount on this screen: `due` is
           empty where the served price list has a gap, so an answer with a hole in it
           draws no PayPal amount rather than one built around a figure nobody sent -
           the same rule `membership.renew` above is now held to as well. */
        const paypalTotal = due.flatMap((row) => processing.map((fee) => row.eur + fee.eur))

        /* WHAT ACTUALLY FOLLOWS THE PROMISE BELOW, READ OFF THE SAME TWO THINGS THE SLIP
           AND THE PAYPAL BLOCK THEMSELVES DRAW FROM - not off `due` alone, which is the
           fault found three rounds running on PR 385, once per axis: the country (round
           one), an empty period (round two), and now a served list missing only the fee
           row (round three).

           `slipDrawn` is exactly the condition the slip's own walk is nested inside
           below (`slipDrawn && due.map(...)`), read here once rather than re-derived a
           second time at the sentence above it, so the two cannot drift.

           `paypalAmountDrawn` mirrors what the PayPal block's own `paypalTotal.map`
           needs in order to put anything under the "PayPal" heading - the method has to
           apply to this country AND the total has to hold a value. It is deliberately
           NOT what gates the block itself: the heading and its note stay keyed on
           `methods.includes('paypal')` alone, further down, so a member abroad still
           reads them even on a day the total is empty - only the sentence above needs to
           know whether an amount is coming. `paypalTotal` is empty whenever EITHER `due`
           OR `processing` is (it is built from both, just above), which is exactly the
           gap this round closes: a list with every period intact and no fee row leaves
           `due` non-empty and `processing` empty, so the amount never arrives although
           the old, `due`-only gate could not tell. */
        const slipDrawn = methods.includes('ips') && due.length > 0
        const paypalAmountDrawn = methods.includes('paypal') && paypalTotal.length > 0

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
                  : t('membership.active', { season: myFirstSeason })}
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
              {registrationOpen(today) ? (
                /* One walk of the list of none or one. The sentence carries two amounts
                   and there is no honest sentence with only one of them, so where the
                   answer holds no period in force this says nothing rather than quoting
                   a figure nobody sent. */
                due.map((row) => (
                  <p className="member__note" key={row.key}>
                    {t('membership.priceNow', {
                      eur: money(row.eur, locale),
                      rsd: money(row.rsd, locale),
                    })}
                  </p>
                ))
              ) : (
                <p className="member__note">{t('membership.notYetSold')}</p>
              )}
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
              {registrationOpen(today) &&
                processing.map((fee) => (
                  <p className="member__note" key={fee.key}>
                    {t('membership.costs', { fee: money(fee.eur, locale) })}
                  </p>
                ))}
              {junior.map((row) => (
                <p className="member__note" key={row.key}>
                  {t('membership.junior', {
                    eur: money(row.eur, locale),
                    rsd: money(row.rsd, locale),
                  })}
                </p>
              ))}
              </>
              )}
            </section>

            {/* THE CHOICE OF CATEGORY IS A SECTION OF ITS OWN, AND NOT PART OF RENEWING.
                PDL §12, owner 27.09.2026: „Clanove radnje na strani clanarine su tacno dve:
                uplata (izvan portala) i izbor kategorije." Two acts, so two sections - and
                nested inside the renewal's own conditions it was gated on both of them by
                accident:

                - `feeExempt` hid it from a member freed of the fee, which is TWENTY NINE of
                  the thirty two members in the shipped data. The owner's sentence of
                  26.09.2026 names payment and dismisses it in the same breath: „Clan je nov,
                  uplatio je clanarinu (ili nije), ali moze da bira u koju ce kategoriju."
                - `windowOpen` is `inYearlyWindow`, which shuts at the end of 31 December,
                  while the member's own deadline is 10:00 on 1 January. Ten hours of it were
                  unreachable, on the one morning of the year every input arrives at once.

                Now it is drawn exactly when the server says there is a choice to draw, which
                is the only side that can answer either question. */}
            {standing !== null && (
              <section className="member__panel">
                {/* THE LEGEND IS THE BOX'S NAME, EXACTLY AS IT WAS, and the first draft of
                    this change got that wrong in a way jsdom could never see (ADL A18).
                    It moved the question into an `<h2 className="profile__section">` and
                    pointed the fieldset at it with `aria-labelledby` - which reads fine and
                    left `.renewal legend` in `Member.css` matching NOTHING in the portal,
                    seven declarations of it, with `.renewal` having exactly one user. The
                    box lost the only styling its own name had and every case stayed green,
                    which is the fault A18 is written about arriving through the markup
                    instead of through the sheet.

                    So the appearance is not redesigned here at all. What this increment
                    changes is WHERE the box stands and that it is wired; the question is
                    still the legend, styled by the rule written for it. A heading for the
                    section was considered and dropped for the same reason: it would have
                    said the question a second time. */}
                <fieldset className="renewal">
                  <legend>{t('membership.chooseCategory', { season: standing.season })}</legend>

                  {/* CHECKED OFF THE ANSWER AND NOT `defaultChecked`, which is the whole of
                      what wiring these changed. PDL §13, owner 27.09.2026: the age category
                      „svakako treba da bude automatski izabrana od pocetka, a korisnik uvek
                      moze da prebaci na ovu drugu opciju" - so the default is the age band
                      and it is the SERVER's default, written down in the column at
                      registration. Left on `defaultChecked` the box opened on the age band
                      every visit, and a member who chose the beginners' category in October
                      came back in November to find his own screen disagreeing with the
                      portal. */}
                  <div className="field field--checkbox">
                    <div className="field__confirm">
                      <input
                        className="field__control"
                        type="radio"
                        id="cat-age"
                        name="category"
                        checked={!standing.firstSeason}
                        disabled={!standing.open || choosing}
                        onChange={() => void choose(false)}
                      />
                      <label className="field__label" htmlFor="cat-age">
                        {t('membership.ageBand')}
                      </label>
                    </div>
                  </div>

                  {/* DISABLED FOR TWO DIFFERENT REASONS AND BOTH COME FROM THE SERVER: he has
                      left the beginners' category for good (PDL P7, „izlazak je nepovratan"),
                      or his deadline has passed. Kept as one condition because a disabled
                      control says only „not now" either way, and the sentence underneath is
                      what says which. */}
                  <div className="field field--checkbox">
                    <div className="field__confirm">
                      <input
                        className="field__control"
                        type="radio"
                        id="cat-first"
                        name="category"
                        checked={standing.firstSeason}
                        disabled={!standing.firstSeasonAllowed || !standing.open || choosing}
                        onChange={() => void choose(true)}
                      />
                      <label className="field__label" htmlFor="cat-first">
                        {t('membership.firstSeasonBand')}
                      </label>
                    </div>
                  </div>

                  <p className="member__note">
                    {standing.firstSeasonAllowed
                      ? t('membership.firstSeasonOpen', { points: FIRST_SEASON_POINTS })
                      : t('membership.firstSeasonClosed', { points: FIRST_SEASON_POINTS })}
                  </p>

                  {/* WHAT THE SERVER REFUSED, SAID OUT LOUD. The one refusal this route makes
                      that a reader can meet is `theChoiceIsShut`: his deadline passed between
                      the box being drawn and his pressing it. Swallowed, the radio would move
                      back on its own and nothing would say why, which PDL.md:1659 calls worse
                      than no control at all.

                      `role="status"` rather than an alert: it answers something he did, and
                      the focus stays where he put it (WCAG 2.2 SC 4.1.3, the same shape
                      `PersonalData.tsx` uses for its own saved sentence). */}
                  {refusal !== null && (
                    <p className="member__note" role="status">
                      {t('membership.choiceRefused')}
                    </p>
                  )}
                </fieldset>
              </section>
            )}

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

                  {/* A SENTENCE WHERE A BUTTON USED TO BE, since 26.09.2026. The button had
                      no `onClick`, no enclosing `<form>` and no route to reach: renewing has
                      never been the member's own action on this portal, paying is, and a
                      moderator is the one who records that a payment arrived
                      (`PaymentApi`, `@RightIsNeeded("queue:payments")`) - the member is never
                      signed in to do it himself. A control promising an action that does not
                      exist here is worse than none (PDL.md:1659, owner: „Kontrola koja ništa
                      ne radi je gora nego da je nema"), so this says what actually happens
                      next instead of offering a press that went nowhere.

                      ONLY WHERE THE DATA IT POINTS AT REALLY FOLLOWS, since 27.09.2026
                      (review, PR 385). It read unconditionally until then, and it promises in
                      words: „Podatke za uplatu vidiš u nastavku." What follows two screens down
                      used to be the slip alone, drawn only for `methods.includes('ips')`, so a
                      member abroad met this sentence and then a PayPal heading with no
                      recipient, no account, no amount and no reference under it.

                      GATED ON WHAT IS ACTUALLY DRAWN BELOW, since round three of this same
                      review (27.09.2026) - and not on `due.length > 0` alone, which is what
                      round two left it on. Whichever of the two ways to pay this member has,
                      real data was meant to follow the sentence either way - the slip for
                      `methods.includes('ips')`, the PayPal address/amount/note for
                      `methods.includes('paypal')` - and `methodsFor` never answers with neither
                      (`data/paymentQr.ts`). But `due` alone only ever asked the slip's half of
                      that question: the PayPal amount is built from `due` AND `processing`
                      together (`paypalTotal`, above), so a served list with every period intact
                      and no fee row left `due` non-empty, the sentence drawn, and PayPal's own
                      amount, address and reference empty underneath it - the same fault the
                      first two rounds found (country, then an empty period), on a third axis
                      neither of them measured. This is still the one fault the comment above
                      already names for a control that does nothing (PDL.md:1659): a sentence
                      pointing at data that is not there is worse than no sentence. `slipDrawn`
                      and `paypalAmountDrawn` (above) are read off the exact values the slip and
                      the PayPal block themselves draw from, not a fourth copy of the question,
                      so the sentence cannot drift from what actually follows it on whatever
                      axis comes next either. */}
                  {(slipDrawn || paypalAmountDrawn) && (
                    <p className="member__note">{t('membership.renew')}</p>
                  )}

                  {/* The slip belongs to renewing, not to a screen of its own: the
                      member has just chosen a category and the next thing they need
                      is the code to pay with (owner, 29.07.2026).

                      It needs an amount, and there is always one: the four periods
                      of the price list repeat every year, so it cannot run out
                      (owner, 30.07.2026). The line above about membership not
                      being on sale is the one September before the launch, and
                      not the day the list ran out. */}

                  {/* The slip itself, and only where it can be paid. PDL P8,
                      owner 31.07.2026: „QR kod postoji samo za uplate iz Srbije.
                      Član van Srbije ga ne vidi uopšte, ni u kom obliku."
                      Only the drawn code was hidden, so a member abroad still got
                      the heading, the association's dinar account, the reference
                      and an amount, which is the whole of the slip and the very
                      route that decision removed. The sentence that used to say so in
                      writing (byCountry) is gone since 26.09.2026, owner: „Načini plaćanja
                      zavise od države na tvom profilu (Srbija). obriši ovu liniju" - what
                      abroad gets instead is said beside PayPal further down. */}
                  {/* AND ONLY WHERE THERE IS AN AMOUNT TO PUT ON IT, which is the walk
                      of the list of none or one. A slip is four facts and a sum, and the
                      one thing a bank cannot do without is the sum, so an answer holding
                      no period in force draws no slip rather than a slip with a hole in
                      it. Nested inside the question about the country rather than folded
                      into it: „a member abroad sees no slip" and „there is no price to
                      put on one" are two different reasons, and one condition covering
                      both would let a case pass for the wrong one. */}
                  {/* ONE WALK AND NOT TWO, since 26.09.2026 - the written slip and the QR
                      code used to be two separate `due.map` calls back to back, paired only
                      by DOM position, which holds while `due` never carries more than one
                      row (it does not: `PriceListRowsTest` on the server) but would put row
                      one's text beside row two's code the day it ever did. A single `.map`
                      over `row` makes the written half and the drawn half of the SAME row
                      one unit, so the pairing cannot come apart. It is also what „sa desne
                      strane u nivou detalja za uplatu" (owner, 26.09.2026) asks for: the two
                      are one slip in two forms, laid out as a pair rather than a stack
                      (Member.css, `.pay__slip`, two columns from `51.25em`, one below
                      `700px`... one column). */}
                  {slipDrawn &&
                    due.map((row) => (
                    <div className="pay__slip" key={row.key}>
                      <div className="pay__slipText">
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
                            <strong>{inTheirCurrency(myCountry, row, locale)}</strong>
                          </dd>
                        </dl>

                        <p className="member__note">{t('membership.referenceNote')}</p>
                      </div>

                      {/* THE AMOUNT INSIDE THE CODE IS THE ONE THE SERVER SENT, and this is
                          the sharpest end of the whole increment. `PricingWriteApi` names it
                          in its own heading: while this read the bundled constant, an
                          administrator who raised the fee raised what the next payment was
                          BOOKED at and left the code asking for the old figure - so a member
                          scanned a request for one sum and was recorded as owing another. */}
                      <div className="pay">
                        <h4>{t('membership.ips')}</h4>
                        <p className="member__note">{t('membership.ipsNote')}</p>
                        <div className="pay__code">
                          <QrCode
                            text={ipsPayload({
                              account: RECIPIENT_ACCOUNT,
                              recipient: RECIPIENT,
                              amountRsd: row.rsd,
                              purpose,
                              reference,
                            })}
                            label={t('membership.ipsQrLabel')}
                          />
                        </div>
                      </div>
                    </div>
                    ))}

                  {/* CARD LEFT, since 26.09.2026 (PDL.md:1659). No provider was ever chosen
                      (`membership.cardNote` said so in as many words), so this was a heading
                      and a note and nothing a member could act on - the owner is sending a
                      real PayPal account for payment from abroad instead. `methodsFor`
                      (data/paymentQr.ts) no longer offers `'card'` to anybody, Serbia
                      included, where it sat beside the slip for the same reason: a way to
                      pay that was never actually built. */}
                  {methods.includes('paypal') && (
                    <div className="pay">
                      <h4>{t('membership.paypal')}</h4>
                      <p className="member__note">{t('membership.paypalNote')}</p>

                      {/* LAYER 1 OF „PLAĆANJE IZ INOSTRANSTVA: PAYPAL" (owner, 27.09.2026):
                          the address, the fee-inclusive amount and the note, written out to
                          be copied - it needs nothing PayPal might refuse, and works from the
                          first day. Layer 2 is a link that would carry these three as one
                          press (`paypalPaymentLink`, data/paymentQr.ts); it is prepared and
                          not drawn here, because whether the owner's own account still takes
                          PayPal's classic hosted button is a fact about PayPal's side this
                          portal cannot measure, and he is trying it on his own account first.

                          AND ONLY WHERE THERE IS AN AMOUNT TO PUT ON IT, the same walk of the
                          list of none or one the slip above is held to, for the same reason:
                          a gap in the served price list is a state this side cannot rule out,
                          and an address with no amount beside it is an instruction with a
                          hole in it. */}
                      {paypalTotal.map((amount) => (
                        <div className="pay__slipText" key={amount}>
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

                          {/* Two decimals always, the way a currency amount is written and
                              not the way `inTheirCurrency` rounds a whole number for
                              reading: this figure is typed into a PayPal amount field
                              rather than read off a sentence, so it is the same shape the
                              QR payload already forces on the Serbian figure
                              (`ipsAmount`, data/paymentQr.ts). */}
                          <CopyField
                            label={t('membership.paypalAmountLabel')}
                            value={formatNumber(amount, locale, 2)}
                            copyButtonLabel={t('membership.paypalCopyAmount')}
                            copiedMessage={t('membership.paypalAmountCopied')}
                            failedMessage={t('membership.paypalAmountCopyFailed')}
                          />

                          {/* The same reference the Serbian slip uses (`paymentReference`,
                              data/paymentQr.ts) and not a second computation of it: the
                              owner's own words for this decision were „isti oblik kao poziv
                              na broj za Srbiju", and reading the one variable both screens
                              already hold is what keeps the two from drifting apart. */}
                          <CopyField
                            label={t('membership.paypalNoteLabel')}
                            value={reference}
                            copyButtonLabel={t('membership.paypalCopyNote')}
                            copiedMessage={t('membership.paypalNoteCopied')}
                            failedMessage={t('membership.paypalNoteCopyFailed')}
                          />
                        </div>
                      ))}
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
              {/* HOW A MEMBER GETS INTO A TEAM, in the words the owner chose on 10.10.2026 (T5,
                  between offered outcomes, the agent's wording): „U tim ulaziš prijavom na
                  strani tima ili prihvatanjem poziva koji ti stigne u sanduče." A sentence and
                  not a button, because both ways in are pressed elsewhere: „Prijavi se u tim"
                  on the team's own page (`pages/AskingThisTeam.tsx`) and „Prihvati" in the
                  inbox (`member/ServedTeamInvite.tsx`).

                  It said until that day that moving to another team „se dogovara van portala"
                  and that the administration enrols the member, which was written on
                  26.09.2026 while neither way in had a route a screen called. From T5 on that
                  was the opposite of PDL P13, „Učlanjenje ide u oba smera kroz portal". */}
              {windowOpen && <p className="member__note">{t('membership.askToJoin')}</p>}

              {/* AND THE ONE THING A MEMBER MAY REALLY DO TO HIS OWN MEMBERSHIP OF A TEAM,
                  since this branch: `DELETE /api/teams/{id}/membership` has existed since
                  24.09.2026 and no screen called it (`member/teamExit.ts`).

                  DRAWN ONLY INSIDE THE WINDOW, WHICH IS THE DECISION AND NOT THIS SCREEN'S
                  CAUTION. Owner, 24.09.2026: „Iz tima se izlazi u ISTOM PROZORU u kom se i
                  ulazi (1.10-31.12)", and the shape a shut window takes is the one PDL of
                  05.09.2026 already fixed for the other direction: „Van tog roka dugmeta
                  „Predloži tim" NEMA, a na njegovom mestu stoji rečenica kad se rok otvara."
                  That sentence is `membership.transferShut` two paragraphs up, which the
                  portal has drawn here since before this button existed, and it is the same
                  condition `membership.askToJoin` right above is drawn under. So there is
                  nothing to add for the shut case and nothing here invents a second one.

                  WHICH IS A DIFFERENT ANSWER FROM `pages/TeamDetail.tsx`, AND THE DIFFERENCE
                  IS RECORDED RATHER THAN LEFT TO LOOK LIKE A SLIP. That screen offers its
                  „Obriši" on every day of the year and lets the route refuse it, because the
                  same act is the administration's (PDL P13b: „ista radnja") and the
                  administration's screen has no sentence about the window to put in its
                  place. This one has, and it is already on the page.

                  AND THE REFUSAL STILL COMES OFF THE ANSWER, because the condition above is
                  not the window's second home but the same predicate the route reads
                  (`data/season.ts#inYearlyWindow` and `SeasonClock.transferWindowOpen` are
                  one pair of constants, which `SeasonClock` states on its own side). What is
                  left is the race the condition cannot close: the window shuts at midnight on
                  31 December, and a member who drew this button at 23.59 and pressed it a
                  minute later meets a route that has changed its mind. `useMyCategory`
                  answers exactly that case for the category box and gives the reason - being
                  told why beats watching a control do nothing (PDL.md:1659).

                  ONLY WHERE THERE IS A TEAM TO LEAVE. `myTeamId` is null for sixteen of the
                  thirty two members in the data, and „Trenutno nisi ni u jednom timu." is
                  what they read above instead. */}
              {windowOpen && team !== undefined && (
                <>
                  {/* THE QUESTION STANDS ABOVE THE ROW AND NOT INSIDE IT, WHICH IS MEASURED
                      RATHER THAN A PREFERENCE. `member__links` is a flex row with `wrap`, so
                      a paragraph put among the buttons is a flex item: at 360 it took a line
                      of its own and the two buttons dropped under it, and at 1280 it sat on
                      ONE line with „Potvrdi izlazak" jammed against the full stop after
                      „administracija." Two widths, two different things being read. Outside
                      the row it is a paragraph at every width and the row underneath holds
                      buttons only, which is the arrangement `pages/TeamDetail.tsx` states the
                      reason for on its own refusal sentence.

                      It carries the name of the team, so the two buttons under it need no
                      name of their own: `aria-describedby` hands a screen reader the whole
                      sentence when „Potvrdi izlazak" takes focus. There is one of these on
                      the page, so there is no second question it could be confused with -
                      which is why `admin/EntityEditor.tsx` puts the name on all three of ITS
                      buttons and this does not. */}
                  {asking && (
                    <p className="member__note" id="leave-team-ask">
                      {t('membership.leaveTeamAsk', { team: team.name })}
                    </p>
                  )}
                  <div className="member__links">
                    {asking ? (
                      <>
                        <button
                          type="button"
                          className="button button--primary"
                          aria-describedby="leave-team-ask"
                          aria-disabled={leaving ? true : undefined}
                          onClick={() => {
                            /* Reachable means pressable, as everywhere else on this portal:
                               `aria-disabled` does not stop a click by itself, so the refusal
                               lives here as well as on the attribute. */
                            if (outstanding.current) {
                              return
                            }

                            void leaveTheTeam(team.id)
                          }}
                        >
                          {t('membership.leaveTeamSure')}
                        </button>
                        <button
                          type="button"
                          className="button"
                          /* TOLD OFF WHILE THE LEAVING IS OUT, which is what „Potvrdi izlazak"
                             beside it already is and for the same reason: a control that goes
                             away takes the keyboard focus with it. Owner, 02.10.2026, choosing
                             between three outcomes he was priced: „Ne", „Odustani" and Escape do
                             nothing while a request is out, and the question closes itself when
                             the answer arrives, whichever answer it is (`leaveTheTeam`). */
                          aria-disabled={leaving ? true : undefined}
                          onClick={() => {
                            /* Reachable means pressable, so the refusal lives here as well as
                               on the attribute - and it reads the REF, as „Potvrdi izlazak"
                               does, so a press that arrives before the render the state would
                               cause finds the same answer. Put away with the request out, the
                               question would say „I took it back" over a leaving that goes on:
                               a 409 was then drawn under „Izađi iz tima" and a 204 took him out
                               of the team without the screen having said so. */
                            if (outstanding.current) {
                              return
                            }

                            setAsking(false)
                            /* The reason of the last attempt goes when the member, having
                               asked again, puts the question away. Left standing,
                               „Prelazni rok je zatvoren..." would sit under a button that
                               asks nothing and read as a refusal of the NEXT thing
                               pressed. (After a refusal itself it stands: it is the
                               answer, and it stands beside the button that asked.) */
                            setRefusedTheExit(null)
                          }}
                        >
                          {t('membership.leaveTeamKeep')}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="button"
                        ref={opener}
                        onClick={() => {
                          setAfterAnAnswer(false)
                          setAsking(true)
                        }}
                      >
                        {t('membership.leaveTeam')}
                      </button>
                    )}
                  </div>
                  {/* SAID IN WORDS, ONLY WHILE IT IS TRUE (WCAG 2.2 AA, 4.1.3), and in the
                      portal's own sentence for a request that is out: `results.sending` is read
                      by the two forms that send a result and four other keys carry the same
                      words, so nothing new was written. Under the row rather than inside it,
                      which is where the refusal that replaces it is drawn, for the reason that
                      note gives. */}
                  {leaving && (
                    <p className="member__note" role="status">
                      {t('results.sending')}
                    </p>
                  )}
                </>
              )}
              {/* WHY A LEAVING DID NOT HAPPEN, under the row it was pressed in rather than
                  inside it, which is `pages/TeamDetail.tsx`'s own arrangement: `member__links`
                  is a flex row, so a sentence of this length put among the buttons would be a
                  flex item stretching the row. `ServerSaid` draws it as an alert, so the
                  reader hears it as it appears; the question has closed with the answer and
                  the focus is on „Izađi iz tima", the button the sentence stands beside. */}
              {refusedTheExit !== null && (
                <ServerSaid answer={refusedTheExit} refusals={WHEN_LEAVING_A_TEAM} />
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

                Read off `GET /api/pricing` since 26.09.2026, because that is where an
                administrator sets it (owner, 12.08.2026) and what is typed there has to
                be what is promised here. It used to be the bundled row with the
                session's overlay on top, which meant the promise a member read was
                whatever THIS build shipped: a figure the administration had raised
                reached the price table in his own browser and nowhere else.

                It says when the credit lands, and that is not a detail: it lands
                when the new member's fee is activated, never at registration, so
                nobody is paid for an account that was opened and left. */}
            <section className="member__panel" aria-labelledby="membership-referral">
              <h2 className="profile__section" id="membership-referral">
                {t('membership.referral')}
              </h2>
              {/* The list of none or one again. Walked twice rather than once around the
                  whole section, which is measured rather than tidy: the LINK between the
                  two is this member's own and has nothing to do with what a referral is
                  worth, so an answer that carried no referral row would have taken his
                  personal link off the screen with it - and the link is the one thing on
                  this section he is meant to copy and send. */}
              {credited.map((row) => (
              <p className="member__note" key={row.key}>
                {t('membership.referralNote', { amount: inTheirCurrency(myCountry, row, locale) })}
              </p>
              ))}
              {/* The code and not the member number. That number is public and
                  consecutive: it is the address of a profile and the sign in
                  list prints it beside every name, so anybody could assemble
                  somebody else's link, or credit themselves with a member they
                  never brought. The origin comes from the one place that holds
                  it, so a change of domain does not leave this link behind.

                  AND THE CODE ITSELF COMES OFF THE SESSION, never off a list. It
                  was on the caller's own row of `/api/competitors` until P26a;
                  the owner took it off that list so that a list anybody may read
                  carries nobody's link under any condition, and so that the
                  member whose fee has lapsed - who has no row there at all - is
                  told what V24 section 6 promises him. */}
              {/* Nothing where the answer carried no code. Until 25.09.2026 that meant
                  „every row but the caller's own" on the public list; it now means the
                  one road there is left, `GET /api/me`, saying nothing - a visitor, an
                  account that races for nobody, or a value the portal does not read.
                  Written out because a `${undefined}` in an address is a link a reader
                  would copy and send on, and the empty string is a link that plainly
                  does not work rather than one that looks as if it might. */}
              {/* The copy button and its confirmation, in the one shape the whole portal
                  now uses for a value a member copies by hand (`components/CopyField.tsx`,
                  pulled out of this exact spot on 27.09.2026 when the PayPal fields below
                  needed the same shape). No label: the heading and the sentence above
                  already say what the box holds, and a label repeating that would be the
                  same fact said twice. */}
              <CopyField
                value={referralLink}
                copyButtonLabel={t('membership.copyReferralLink')}
                copiedMessage={t('membership.linkCopied')}
                failedMessage={t('membership.copyFailed')}
              />
              {credited.map((row) => (
                <p className="membership__balance" key={row.key}>
                  <strong>
                    {inTheirCurrency(myCountry, row, locale, myReferredCount ?? 0)}
                  </strong>{' '}
                  <span>{t('membership.balance')}</span>
                </p>
              ))}
              <p className="member__note">{t('membership.balanceNote')}</p>
            </section>
          </div>
        )
      }}
    </Resource>
  )
}
