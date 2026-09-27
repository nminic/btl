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
 * <p><b>WHY THIS IS A CLASS AND NOT A QUERY IN EACH CALLER.</b> Five callers need the book: what a
 * member owes ({@link MembershipInvoice}, for {@link MyMembershipApi}), his activation out of it
 * ({@link MyMembershipWriteApi}), a moderator recognising a payment ({@link PaymentApi}, which
 * both spends the payer's balance and earns the referrer's) and the administration freeing him of
 * the fee ({@link MembershipWriteApi}, which spends nothing and still earns the referrer's). The
 * same reasoning {@link MemberOfAccount} is written with: one lookup asked in one place beats the
 * identical {@code select} in five controllers, free to drift the day one is edited.
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
	 * method being called from nowhere but where a membership row is actually written.
	 *
	 * <p><b>TWO OF THE THREE SUCH PLACES, AND THE THIRD IS NOT AN OMISSION.</b>
	 * {@link MyMembershipWriteApi} and {@link PaymentApi} call this;
	 * {@link MembershipWriteApi}, where the administration frees a member of the fee, does not and
	 * must not - he owes nothing, so there is nothing for his balance to pay, and spending it on a
	 * season he was going to get free would be the portal charging him for a gift. That is the same
	 * refusal {@link com.btl.portal.domain.balance.ActivatingFromBalance} states for
	 * {@code HE_OWES_NOTHING}, derived from PDL 11.08.2026 („Balans ne propada nikad i prenosi se iz
	 * sezone u sezonu"): it keeps, so it waits for a season in which he is no longer exempt. The
	 * REWARD is a different question and is paid at all three
	 * ({@link #aReferralWasActivated}).
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
	 * <p><b>WRITTEN ONCE PER SEASON AND NEVER REWRITTEN, and that is the answer to „two codes in one
	 * day".</b> The first look of a season fixes what that season's code promises; a second look is
	 * served the number that already stands ({@link Balance#asThePromiseStands}). An earlier draft of
	 * this branch made it an upsert, on the reasoning that „the member is looking at one screen
	 * showing one amount" - and that reasoning was measured false: a slip already printed is not on
	 * the screen, so a member whose balance moved between two looks holds two slips saying two
	 * numbers while only one row can be recorded, and whichever he pays, the book takes off the
	 * other one's amount. Rewriting it is exactly the outcome the owner refused on 27.09.2026.
	 *
	 * <p><b>WHAT ACTUALLY HOLDS „ONCE" IS THE CALLER'S ORDER AND NOT THIS CLAUSE, and that is
	 * measured rather than argued.</b> {@link MyMembershipApi} reads the promise BEFORE it writes and
	 * calls this only when none stands, so a second look never reaches this statement at all. The
	 * measurement: replacing {@code on conflict do nothing} below with the upsert this branch used to
	 * have leaves all 18 cases of {@code MyMembershipApiTest} green, because through one request after
	 * another the conflict path is unreachable. The clause is therefore <b>not the guard</b>; it is
	 * what makes a RACE safe, where two requests both read no promise before either writes: the
	 * earlier one stands instead of the later meeting {@code balance_promise_pk} and answering 500,
	 * and the loser reads back and serves what the winner wrote.
	 *
	 * <p><b>SO WHAT HAS NO GUARD, said rather than left to be found:</b> that race. Writing one costs
	 * a concurrency fixture of its own ({@code PaymentNumberConcurrencyTest} is the shape it would
	 * take) and nothing in the finding this was written for asks for it. What is known about the cost
	 * of getting it wrong is small: both racers compute from the same book and the same price list
	 * microseconds apart, so they promise the same amount and only {@code promised_at} would differ.
	 *
	 * <p><b>Nothing here refuses a promise of nothing</b>, and that is deliberate: a member whose
	 * book is empty, or whose balance covers the whole fee so that there is no code at all, has
	 * nought written down and it is that row which pins him for the season. Were it left out, his
	 * SECOND look would write the first real promise while his first slip - the one for the whole fee
	 * - was still live, and paying that slip would take a discount off his book he had already paid
	 * in cash.
	 */
	void promise(long competitorId, int season, Balance.Money amount) {
		db.sql("insert into balance_promise (competitor_id, season, eur, rsd, promised_at)"
						+ " values (?, ?, ?, ?, ?)"
						+ " on conflict (competitor_id, season) do nothing")
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
	 *
	 * <p><b>AND A ROW STANDING AT ALL IS THE SECOND THING THIS ANSWERS, which is what
	 * {@link MyMembershipApi} reads it for.</b> A promise is written once per season, so its mere
	 * presence says „this season's code has already been minted and its number is fixed". That is
	 * why a promise of nought is a row rather than an absent one: nought is a number this season's
	 * code was minted on, and the next look has to be held to it.
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
	 * <p><b>„EVERY PLACE" IS THREE, THEY ARE NAMED HERE, AND THE COUNT HAS A FLOOR UNDER IT RATHER
	 * THAN A PROMISE.</b> A {@code membership} row is written by {@link PaymentApi} (a moderator
	 * recognising money), by {@link MyMembershipWriteApi} (the member letting himself in on his own
	 * balance) and by {@link MembershipWriteApi} (the administration freeing him of the fee). Each of
	 * the three has a case that the referrer is paid through IT and not merely somewhere:
	 * {@code PaymentApiTest.whoeverBroughtThePayerInIsPaidOnce},
	 * {@code MyMembershipWriteApiTest.whoeverBroughtHimInIsPaidWhenHeLetsHimselfIn} and
	 * {@code MembershipWriteApiTest.whoeverBroughtHimInIsPaidWhenTheAdministrationFreesHimOfTheFee}.
	 *
	 * <p><b>The third was measured missing.</b> For a while this sentence said „every place" while two
	 * of the three called it, and a reward for bringing in a member freed of the fee was not late but
	 * LOST: he cannot come through the paying door afterwards, because that door answers 409 to a man
	 * who already holds the season.
	 *
	 * <p><b>WHAT STOPS A FOURTH DOOR ARRIVING SILENTLY is the basis, and it is already floored.</b> A
	 * membership stands on one of the words {@code membership_basis_known} (V36) names, and
	 * {@code MembershipConstraintsTest} reads those words out of {@code pg_constraint} and compares
	 * them with V7's - so a FOURTH basis turns a case red and asks for a decision once, rather than
	 * being waved through. <b>The limit of that, named rather than left to be found:</b> a fourth door
	 * reusing one of the three existing bases is caught by neither the schema nor the three cases
	 * above. What would catch it is a case at the door itself, which is why each door has one.
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
						/* AND THE REWARD IS WORTH SOMETHING. V4 lets a price row be ZERO and
						   `PUT /api/pricing/{key}` has no lower bound, while
						   `balance_entry_a_referral_adds` (V36) demands strictly more - so without
						   this the route would answer 500 for every member anybody brought in, on
						   the day an administrator sets the referral to nought through his own
						   screen. The migration's own carry carries the identical condition, and
						   the same sentence is why: a reward of nothing earns nobody a line. */
						+ " where c.id = ? and c.referred_by is not null"
						+ " and reward.eur > 0 and reward.rsd > 0"
						+ " on conflict (referred_competitor_id) do nothing")
				.params(Timestamp.from(clock.instant()), account, accountName, REFERRAL, newMember)
				.update();
	}
}
