package com.btl.portal.web;

import com.btl.portal.domain.balance.Balance;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Clock;

/**
 * THE ONLY THING THAT READS OR WRITES THE BOOK OF BALANCE, so that the total on a screen and the
 * total a route spends cannot be two totals.
 *
 * <p>ADL, {@code Virtuelni balans}: „saldo koji se uvek izvodi iz knjige, nikad ne upisuje
 * direktno." That sentence is only true if there is one place the deriving happens, and this is
 * it. Nothing else in the portal names {@code balance_entry}.
 *
 * <p><b>WHY THIS IS A CLASS AND NOT A QUERY IN EACH CALLER.</b> Four routes need the book: the
 * member's own record ({@link MeApi}), his invoice ({@link MyMembershipApi}), his activation out
 * of it ({@link MyMembershipWriteApi}) and a moderator recognising a payment ({@link PaymentApi},
 * which both spends the payer's balance and earns the referrer's). The same reasoning
 * {@link MemberOfAccount} is written with: one lookup asked in one place beats the identical
 * {@code select} in four controllers, free to drift the day one is edited.
 *
 * <p><b>AND IT IS WHERE THE SIGN LIVES.</b> {@link Balance.Money} is money somebody HAS and is
 * never negative; the book records a movement and a spend moves down. Rather than letting four
 * callers each remember to put the minus in, they hand over what was earned or spent and this
 * class turns it into a line. {@code balance_entry_a_referral_adds} and
 * {@code balance_entry_a_membership_takes} (V36) then refuse anything this class gets wrong,
 * which is the point of writing the sign into the schema as well as here.
 */
@Component
class BalanceBook {

	/**
	 * {@code price_row.key} of the row that says what one brought in member is worth (V4: five
	 * euro, six hundred dinars). The key is a literal here for the same reason V36's backfill
	 * writes it as one: it is the NAME of a row in a codebook, and a codebook key is exactly the
	 * kind of thing that is written down rather than derived.
	 */
	private static final String REFERRAL = "referral";

	private final JdbcClient db;

	private final Clock clock;

	BalanceBook(JdbcClient db, Clock clock) {
		this.db = db;
		this.clock = clock;
	}

	/**
	 * WHAT THE BOOK ADDS UP TO FOR ONE MEMBER, in both currencies and never converted between
	 * them.
	 *
	 * <p>{@code coalesce}, because a member who has brought in nobody has no rows at all and
	 * {@code sum} over no rows is null rather than zero. That is the ordinary case - most members
	 * have an empty book - so it is answered here rather than left to each caller.
	 */
	Balance.Money of(long competitorId) {
		return db.sql("select coalesce(sum(eur), 0), coalesce(sum(rsd), 0)"
						+ " from balance_entry where competitor_id = ?")
				.param(competitorId)
				.query((row, i) -> new Balance.Money(row.getBigDecimal(1), row.getBigDecimal(2)))
				.single();
	}

	/**
	 * A MEMBERSHIP TAKES ITS PART OUT OF THE BOOK, and the entry names the season it went to.
	 *
	 * <p>Written the moment the membership becomes a fact and never a moment earlier: the owner,
	 * 26.09.2026, „balans se skida tek kad uplata bude proknjizena. Ako clan ne plati, balans mu
	 * ostaje." He was shown and accepted the cost of that - a code minted and not paid leaves the
	 * balance standing and promised twice - and the shape that refuses to deduct early is this
	 * method being called from nowhere but the two places a membership row is written.
	 *
	 * @param amount how much of the balance this membership uses, as
	 *               {@link Balance.Settlement#fromTheBalance()} worked it out - the whole balance
	 *               when it is short of the fee, and exactly the fee when it covers it
	 * @return {@code balance_entry.id}, which the membership row names when the basis is
	 *         {@code balance}
	 */
	long spentOnAMembership(long competitorId, int season, Balance.Money amount, Long account, String accountName) {
		return db.sql("insert into balance_entry (competitor_id, eur, rsd, reason, season,"
						+ " occurred_at, recorded_by, recorded_by_name)"
						+ " values (?, ?, ?, 'membership', ?, ?, ?, ?) returning id")
				.params(competitorId, amount.eur().negate(), amount.rsd().negate(), season,
						Timestamp.from(clock.instant()), account, accountName)
				.query(Long.class)
				.single();
	}

	/**
	 * WHAT THE CODE THIS MEMBER IS BEING SHOWN PROMISES HIS BALANCE WILL COVER, written down at the
	 * moment it is shown to him.
	 *
	 * <p><b>This is „kovanje koda" and it moves nothing.</b> The owner refused deducting at minting
	 * on 26.09.2026 („Odbijen je ishod u kom se balans skida odmah pri kovanju koda") and refused
	 * deducting today's balance at booking on 27.09.2026, which together leave exactly one shape: the
	 * amount is recorded when it is promised and acted on when the money arrives. A member who never
	 * pays keeps his whole balance, because this row is a note and not a withdrawal.
	 *
	 * <p><b>An upsert, and that is the answer to „two codes in one day".</b> A second code for the
	 * same season replaces the first: the member is looking at one screen showing one amount, and
	 * that amount is what he will transfer. {@code balance_promise_pk} is what makes it one row
	 * rather than a history nobody could choose between.
	 */
	void promise(long competitorId, int season, Balance.Money amount) {
		db.sql("insert into balance_promise (competitor_id, season, eur, rsd, promised_at)"
						+ " values (?, ?, ?, ?, ?)"
						+ " on conflict (competitor_id, season) do update"
						+ " set eur = excluded.eur, rsd = excluded.rsd, promised_at = excluded.promised_at")
				.params(competitorId, season, amount.eur(), amount.rsd(), Timestamp.from(clock.instant()))
				.update();
	}

	/**
	 * WHAT WAS PROMISED FOR THAT SEASON, or empty when no code was ever minted for it.
	 *
	 * <p><b>Empty is not zero and the difference is the whole rule.</b> A member nobody ever showed
	 * a reduced invoice to paid the full fee off the price list, so nothing comes off his book; a
	 * member promised nothing because his book was empty is the same outcome by a different road.
	 * Both are answered, and neither is guessed: {@link MyMembershipApi} is the only place a reduced
	 * amount is ever computed, and it records what it computed.
	 */
	java.util.Optional<Balance.Money> promised(long competitorId, int season) {
		return db.sql("select eur, rsd from balance_promise where competitor_id = ? and season = ?")
				.params(competitorId, season)
				.query((row, i) -> new Balance.Money(row.getBigDecimal(1), row.getBigDecimal(2)))
				.optional();
	}

	/**
	 * WHAT A MEMBERSHIP ALREADY TOOK OUT OF THE BOOK, as a positive amount, and nothing when it
	 * took nothing.
	 *
	 * <p>Read back rather than recomputed, and the difference matters exactly once: a route
	 * answering about a membership that was recorded EARLIER cannot work out what the balance paid
	 * for it from today's balance, because today's balance already has that spend taken out of it.
	 * The book is the record of what happened.
	 *
	 * <p>{@code sum}, not a single row, because one season is allowed to have taken more than one
	 * line the day anything ever spends a balance twice for one season; today nothing does, and a
	 * sum is the reading that stays correct either way rather than the one that throws.
	 */
	Balance.Money whatAMembershipTook(long competitorId, int season) {
		return db.sql("select coalesce(sum(-eur), 0), coalesce(sum(-rsd), 0) from balance_entry"
						+ " where competitor_id = ? and season = ? and reason = 'membership'")
				.params(competitorId, season)
				.query((row, i) -> new Balance.Money(row.getBigDecimal(1), row.getBigDecimal(2)))
				.single();
	}

	/**
	 * AND WHOEVER BROUGHT HIM IN IS PAID, at the moment his membership is activated and not at
	 * the moment he registered.
	 *
	 * <p>PDL: „Iznos leže na balans automatski, u trenutku kad se novom članu aktivira članarina,
	 * ne u trenutku registracije", and the condition is activation and nothing about money - the
	 * owner, 13.08.2026, „OK je da se za preporuku dobije balans čak i ako je preporučen član
	 * dobio počasnu aktivaciju." So this is called from every place a membership is activated, and
	 * it asks nothing about how.
	 *
	 * <p><b>ONCE PER MEMBER BROUGHT IN, AND THE SCHEMA IS WHAT SAYS SO.</b> A member who pays for
	 * a second season does not earn his referrer a second reward, and rather than each caller
	 * checking, {@code balance_entry_one_a_referral} (V36) holds it: the insert below is written
	 * {@code on conflict do nothing}, so the second season is silent instead of an error, and the
	 * rule cannot be got around by any future caller that forgets it.
	 *
	 * <p><b>Nothing happens for a member nobody brought in</b>, which is most of them.
	 *
	 * @param newMember {@code competitor.id} of the member whose membership has just been
	 *                  activated
	 */
	void aReferralWasActivated(long newMember, Long account, String accountName) {
		db.sql("insert into balance_entry (competitor_id, eur, rsd, reason, referred_competitor_id,"
						+ " occurred_at, recorded_by, recorded_by_name)"
						+ " select c.referred_by, reward.eur, reward.rsd, 'referral', c.id, ?, ?, ?"
						+ " from competitor c"
						+ " cross join (select eur, rsd from price_row where key = ?) reward"
						+ " where c.id = ? and c.referred_by is not null"
						+ " on conflict (referred_competitor_id) do nothing")
				.params(Timestamp.from(clock.instant()), account, accountName, REFERRAL, newMember)
				.update();
	}
}
