package com.btl.portal.web;

import com.btl.portal.domain.balance.Balance;
import com.btl.portal.domain.member.MemberNumber;
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
 * granted one year at a time and lives in {@code membership.basis}, never in the per-person column
 * {@code competitor.membership_basis} - which is written once and never taken back, so reading it
 * here freed a man of every season that followed the one he was given.
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

	MembershipInvoice(JdbcClient db, Clock clock, PriceRows priceRows, BalanceBook book) {
		this.db = db;
		this.clock = clock;
		this.priceRows = priceRows;
		this.book = book;
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
	 */
	record Invoice(int season, String priceKey, Balance.Settlement settled,
			BigDecimal processingFeeEurIfHeTransfers, boolean alreadyAMember, boolean exemptFromTheFee,
			MemberNumber numberHeAlreadyHas) {
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

		var rows = priceRows.all();

		/* ASKED TWICE, ONCE PER CURRENCY, because that is what „dva zasebna cenovnika, ne jedan sa
		   konverzijom" leaves as the only way to have both numbers: the row that applies is the
		   same row either way and each call reads its own column off it. Computing one from the
		   other is the conversion ADL forbids. */
		MembershipPrice.Price inEuro = MembershipPrice.on(rows, MonthDay.from(today),
				member.birthDate().getYear(), season, true);
		MembershipPrice.Price inDinars = MembershipPrice.on(rows, MonthDay.from(today),
				member.birthDate().getYear(), season, false);

		Balance.Settlement settled = Balance.against(
				new Balance.Money(inEuro.amount(), inDinars.amount()), book.of(me));

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

		   THE COLUMN IS NOT TOUCHED, and that is deliberate. It has two homes by a boundary PDL
		   records (`CompetitorApi`, `MembershipWriteApi`), it is what every SCREEN reads, and
		   moving it is the increment that removes `competitor.active`. What this changes is which
		   home answers the question about MONEY, and money is per season. */
		String basisForTheSeason = db.sql(
						"select basis from membership where competitor_id = ? and season = ?")
				.params(me, season).query(String.class).optional().orElse(null);

		return new Invoice(season, inEuro.key(), settled, inEuro.fee(), basisForTheSeason != null,
				FEE_EXEMPT.equals(basisForTheSeason),
				member.memberNumber() == null ? null : new MemberNumber(member.memberNumber()));
	}
}
