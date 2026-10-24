package com.btl.portal.web;

import com.btl.portal.domain.balance.Balance;
import com.btl.portal.domain.member.MemberNumber;
import com.btl.portal.domain.membership.Basis;
import com.btl.portal.domain.pricing.Currency;
import com.btl.portal.domain.pricing.MembershipPrice;
import com.btl.portal.domain.season.SeasonClock;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.MonthDay;
import java.time.ZonedDateTime;

/**
 * WHAT ONE MEMBER OWES FOR THE SEASON ON SALE, worked out in ONE place because two routes act on
 * it and one of them spends money.
 *
 * <p><b>This class exists to stop the invoice and the deduction being two numbers.</b>
 * {@link MyMembershipApi} serves this to the screen that mints the payment code, and
 * {@link MyMembershipWriteApi} activates a membership out of it. Had each asked the database its
 * own questions, the answer a member was shown and the amount taken out of his book would be two
 * computations free to disagree - which is exactly the fault the owner's question of 26.09.2026
 * uncovered on the screen itself, where the page promised the balance would pay and the slip asked
 * for the full fee.
 *
 * <p><b>WHAT IT READS, and each is a fact the season turns on:</b> the day (which row of the price
 * list applies), the member's year of birth (whether the junior level applies), the book (what he
 * has), and the {@code membership} row for the season on sale - both whether one stands at all and
 * what basis it stands on, which is whether he owes anything.
 *
 * <p><b>AND EVERY ONE OF THOSE IS ASKED OF THE SEASON ON SALE, INCLUDING BEING FREED OF THE
 * FEE.</b> The owner, 27.09.2026: „BESPLATNI CLANOVI NISU BESPLATNI DOZIVOTNO." An exemption is
 * granted one year at a time and lives in {@code membership.basis}, its one home since V62. The
 * per-person column {@code competitor.membership_basis} that stood beside it until then was written
 * once and never taken back, so reading it here freed a man of every season that followed the one
 * he was given.
 */
@Component
class MembershipInvoice {

	/**
	 * The basis of a membership the Managing Board has freed of the fee, as
	 * {@code membership_basis_known} (V22, widened by V38) names it - never „pocasni", which PDL
	 * forbids for such a member because in the Statute that word means somebody who is NOT a member
	 * at all. Written here
	 * as a literal because it IS a literal in the schema; what stops it drifting is
	 * {@code MembershipConstraintsTest}, which asks PostgreSQL what that constraint actually says
	 * rather than comparing one written word against another.
	 */
	private static final String FEE_EXEMPT = "feeExempt";

	private final JdbcClient db;

	private final Clock clock;

	private final PriceRows priceRows;

	private final BalanceBook book;

	/**
	 * <p><b>Read here and not in each of the two routes, for the reason this whole class exists.</b>
	 * The currency decides which column of the price list is the fee AND which lines of the book are
	 * his balance, so a route that read it for one and let this class read it for the other would have
	 * the two halves of one comparison answered by two lookups.
	 */
	private final CurrencyOfMember currencyOf;

	MembershipInvoice(JdbcClient db, Clock clock, PriceRows priceRows, BalanceBook book,
			CurrencyOfMember currencyOf) {
		this.db = db;
		this.clock = clock;
		this.priceRows = priceRows;
		this.book = book;
		this.currencyOf = currencyOf;
	}

	/**
	 * @param season             the one on sale today ({@link SeasonClock#seasonBeingPaidFor}),
	 *                           never one anybody asked for
	 * @param priceKey           the row of the price list that applies to him
	 * @param settled            the fee, his balance, and what the one does to the other
	 * @param processingFeeEurIfHeTransfers V16's fee for the row that applies to him, charged on a
	 *                           euro transfer only. <b>Carried raw, and whether it is charged is not
	 *                           decided here</b>: only the route knows what it is finally serving as
	 *                           the amount to transfer, because a promise already standing for the
	 *                           season fixes that number rather than today's balance
	 *                           ({@link Balance#asThePromiseStands}). Deciding it here would answer
	 *                           „is there a transfer" off today's arithmetic and then contradict the
	 *                           transfer actually served.
	 * @param alreadyAMember     a {@code membership} row already stands for him and this season,
	 *                           on any basis
	 * @param exemptFromTheFee   that row stands on {@code feeExempt}: the Managing Board freed him
	 *                           of THIS season's fee, so there is nothing for a balance to pay.
	 *                           <b>Implied by {@code alreadyAMember} and that is the owner's model
	 *                           rather than a redundancy</b>: an exemption IS a membership, granted
	 *                           one season at a time
	 * @param numberHeAlreadyHas his member number, or {@code null} if he has never had one
	 * @param holds              the basis of that row, or {@code null} where there is none: the
	 *                           letter after a confirmed address says HOW the season is his (owner,
	 *                           23.10.2026 and 24.10.2026: freed, on his balance, or paid), which the
	 *                           two booleans before it cannot tell apart. Read off the same row in the
	 *                           same statement, so the three cannot disagree
	 */
	record Invoice(int season, String priceKey, Balance.Settlement settled,
			BigDecimal processingFeeEurIfHeTransfers, boolean alreadyAMember, boolean exemptFromTheFee,
			MemberNumber numberHeAlreadyHas, Basis holds) {
	}

	private record TheMember(LocalDate birthDate, String memberNumber) {
	}

	Invoice forMember(long me) {
		LocalDate today = LocalDate.ofInstant(clock.instant(), SeasonClock.ZONE);
		int season = SeasonClock.seasonBeingPaidFor(ZonedDateTime.now(clock));

		TheMember member = db.sql("select birth_date, member_number from competitor where id = ?")
				.param(me)
				.query((row, i) -> new TheMember(row.getDate(1).toLocalDate(), row.getString(2)))
				.single();

		/* ASKED ONCE, IN HIS MONEY, AND IT USED TO BE ASKED TWICE.

		   Until V42 this read the price list in BOTH currencies and handed the pair to `Balance`,
		   because a balance was a pair and „dva zasebna cenovnika, ne jedan sa konverzijom" left no
		   other way to have both numbers. Since the owner's decision of 27.09.2026 (PDL 25) a member
		   has ONE balance in ONE money, decided by his country, so the only price that is ever
		   compared with it is the one in that same money. The second reading answered a question
		   nobody asks. */
		Currency his = currencyOf.of(me);

		MembershipPrice.Price price = MembershipPrice.on(priceRows.all(), MonthDay.from(today),
				member.birthDate().getYear(), season, his);

		Balance.Settlement settled = Balance.against(
				new Balance.Money(price.amount(), his), book.of(me, his));

		/* BEING FREED OF THE FEE IS ASKED OF THE SEASON AND NEVER OF THE PERSON, and that is the
		   owner's decision of 27.09.2026 in his own capital letters: „BESPLATNI CLANOVI NISU
		   BESPLATNI DOZIVOTNO. Admin moze da odobri (jednu po jednu) godinu clanarine, ne postaju
		   ljudi besplatni zauvek!" And in the same entry, the shape: „red u `membership` postoji za
		   svaku sezonu posebno, a `feeExempt` je osnov TOG reda, ne svojstvo coveka."

		   WHAT THIS WAS BEFORE, said out loud because it charged the wrong people and freed the
		   wrong people: this read `competitor.membership_basis`, which stands per PERSON (V7). The
		   only thing that ever writes it to `feeExempt` is `MembershipWriteApi`, and NOTHING ever
		   writes it back - so one season granted to a man freed him of every season after it. He
		   was answered 404 here and 409 at the writing door for every year he actually owed, and
		   the portal had no way to bill him again. The reverse was live too: a member freed of the
		   fee for a PAST season, whose column still said so, was refused the invoice for the season
		   he does owe.

		   ONE QUERY FOR BOTH FACTS, WHICH IS THE POINT AND NOT A SAVING. „Is he in for this season"
		   and „is he in FREE for this season" are two readings of one row, and asked as two
		   statements they are two places that can disagree - which is the fault this whole class
		   exists to refuse. So the row is read once and both answers come off it. The corollary is
		   named rather than left to be found: `exemptFromTheFee` implies `alreadyAMember`, because
		   an exemption IS a membership.

		   AND SINCE V62 THIS IS THE ONLY HOME THERE IS. The column is gone (owner, 18.10.2026, PDL
		   P8, „Osnov clanstva ima jedan dom"), and `MeApi` and `CompetitorApi` answer the basis off
		   this same row for this same season, so the panel „Stanje" and the panel for renewal
		   cannot name two different bases for one season. */
		String basisForTheSeason = db.sql(
						"select basis from membership where competitor_id = ? and season = ?")
				.params(me, season).query(String.class).optional().orElse(null);

		return new Invoice(season, price.key(), settled, price.fee(), basisForTheSeason != null,
				FEE_EXEMPT.equals(basisForTheSeason),
				member.memberNumber() == null ? null : new MemberNumber(member.memberNumber()),
				basisForTheSeason == null ? null : Basis.of(basisForTheSeason));
	}

	/**
	 * WHAT A SLIP FOR THIS SEASON ASKS HIM TO SEND, AS THE FIRST ONE HE WAS SHOWN FIXED IT.
	 *
	 * <p>The owner chose with my recommendation, on 26.09.2026, that the code is minted on the amount
	 * less the balance, and on 27.09.2026 that a booking takes what the code promised and not what the
	 * balance stands at on the day of the booking. So the first time an
	 * amount is put in front of him for a season, what his balance takes off it is recorded as a
	 * promise, and every later slip for that season is the same number. {@link MyMembershipApi}
	 * gives the whole of the reasoning beside its call, and it is its own: this is the code it used to
	 * hold, moved here unchanged because a SECOND place now puts an amount in front of him - the
	 * letter after his address is confirmed (owner, 23.10.2026) - and two copies of the rule would be
	 * two places for the promise to be written differently.
	 *
	 * <p><b>It writes the promise only when there is something to transfer</b>; a balance that
	 * covers the whole fee mints no code, so there is nothing to promise about.
	 */
	Balance.Settlement asTheSlipPromises(long me, Invoice owed) {
		return book.promised(me, owed.season())
				.map(standing -> Balance.asThePromiseStands(owed.settled(), standing))
				.orElseGet(() -> {
					if (!owed.settled().coveredByTheBalance()) {
						book.promise(me, owed.season(), owed.settled().fromTheBalance());
					}

					return owed.settled();
				});
	}

	/**
	 * The processing fee on what that slip asks for: V16's euro fee where there is a transfer to
	 * process, and nothing where there is none. Asked of the transfer the slip carries, not of
	 * today's arithmetic, for the reason {@link MyMembershipApi} gives beside its call.
	 */
	static BigDecimal processingOn(Balance.Settlement slip, Invoice owed) {
		return slip.toTransfer().isNothing() ? BigDecimal.ZERO : owed.processingFeeEurIfHeTransfers();
	}
}
