package com.btl.portal.web;

import com.btl.portal.domain.balance.Balance;
import com.btl.portal.domain.pricing.Currency;
import com.btl.portal.domain.pricing.MembershipPrice;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * THE ONLY THING THAT READS OR WRITES THE BOOK OF BALANCE, so that the total on a screen and the
 * total a route spends cannot be two totals.
 *
 * <p>ADL, {@code Virtuelni balans}: „saldo koji se uvek izvodi iz knjige, nikad ne upisuje direktno."
 * That sentence is only true if there is one place the deriving happens, and this is it. Nothing else
 * in the portal names {@code balance_entry}.
 *
 * <p><b>WHY THIS IS A CLASS AND NOT A QUERY IN EACH CALLER.</b> Six callers need the book: what a
 * member owes ({@link MembershipInvoice}, for {@link MyMembershipApi}), his activation out of it
 * ({@link MyMembershipWriteApi}), a moderator recognising a payment ({@link PaymentApi}, which spends
 * the payer's balance, credits him a surplus and earns the referrer's), the administration activating
 * him without a fee ({@link MembershipWriteApi}), the screen that offers that activation
 * ({@link PaymentsDueApi}, which only READS and is the one caller asking about many members at once),
 * and the member editing his own record ({@link MeWriteApi}, which translates the whole book when he
 * changes country). The same reasoning {@link MemberOfAccount} is written with: one lookup asked in
 * one place beats the identical {@code select} in six controllers, free to drift the day one is
 * edited.
 *
 * <p><b>AND SINCE V42 EVERY LINE IS ONE AMOUNT IN ONE CURRENCY, WHICH CHANGES WHAT „THE BALANCE"
 * MEANS AND THEREFORE EVERY SIGNATURE HERE.</b> The owner, 27.09.2026 (PDL, section 25): „balans je
 * uvek u valuti zavisno od drzave ... Nema ni potrebe da cuva par, nego moze da cuva samo iznos i
 * valutu, to je bolje." So the balance is no longer „the sum of the table" but <b>the sum of his lines
 * in the currency he is billed in today</b>, and every method that reads or writes one has to be told
 * which currency that is. It is a parameter rather than something this class looks up, on purpose: the
 * caller has already read it ({@link CurrencyOfMember}, or the country it already has in hand), and a
 * second lookup here would be a second home for the one fact the whole change turns on.
 *
 * <p><b>THE FILTER BY CURRENCY IS LOAD-BEARING AND NOT BELT-AND-BRACES, which is worth saying because
 * a correct conversion makes it look redundant.</b> {@link #translated} takes the whole old balance
 * OUT of the old currency and puts the restated amount IN to the new one, so a member's lines in a
 * currency he has left sum to exactly nought and an unfiltered sum would come out right anyway. That
 * is precisely the trap: the two readings agree while the conversion is correct and part company the
 * moment it is not, which is the one moment anybody needs them to disagree. The case that proves the
 * filter is doing work therefore writes the credit WITHOUT the debit and requires the balance to
 * ignore what is left in the old money.
 *
 * <p><b>AND IT IS WHERE THE SIGN LIVES.</b> {@link Balance.Money} is money somebody HAS and is never
 * negative; the book records a movement and a spend moves down. Rather than letting five callers each
 * remember to put the minus in, they hand over what was earned or spent and this class turns it into a
 * line. The four sign constraints of V42 then refuse anything this class gets wrong, which is the
 * point of writing the sign into the schema as well as here.
 */
@Component
class BalanceBook {

	/**
	 * {@code price_row.key} of the row that says what one brought in member is worth (V4: five euro,
	 * six hundred dinars). The key is a literal here for the same reason V38's backfill writes it as
	 * one: it is the NAME of a row in a codebook, and a codebook key is exactly the kind of thing that
	 * is written down rather than derived.
	 */
	private static final String REFERRAL = "referral";

	private final JdbcClient db;

	private final Clock clock;

	private final PriceRows priceRows;

	BalanceBook(JdbcClient db, Clock clock, PriceRows priceRows) {
		this.db = db;
		this.clock = clock;
		this.priceRows = priceRows;
	}

	/**
	 * WHAT THE BOOK ADDS UP TO FOR ONE MEMBER, in the money he is billed in.
	 *
	 * <p>{@code coalesce}, because a member who has brought in nobody has no rows at all and
	 * {@code sum} over no rows is null rather than zero. That is the ordinary case - most members have
	 * an empty book - so it is answered here rather than left to each caller.
	 *
	 * @param currency his, from {@link CurrencyOfMember}; lines in any other money are not his balance
	 */
	Balance.Money of(long competitorId, Currency currency) {
		return new Balance.Money(db.sql("select coalesce(sum(amount), 0) from balance_entry"
						+ " where competitor_id = ? and currency = ?")
				.params(competitorId, currency.name())
				.query(BigDecimal.class)
				.single(), currency);
	}

	/**
	 * THE SAME SUM FOR A WHOLE LIST OF MEMBERS AT ONCE, for the one caller that draws a balance beside
	 * every row of a screen.
	 *
	 * <p><b>Grouped by member AND by currency, and the currency is matched in Java rather than in the
	 * statement.</b> Two members on one screen can be billed in two different monies, so a statement
	 * filtering on one currency would answer about half of them; one filtering per member would be a
	 * statement per row, which is the thing this method exists to avoid. So the database groups both
	 * ways and the caller's map says which group is each member's.
	 *
	 * <p><b>An empty list is answered without asking the database, and that is a refusal rather than a
	 * saving:</b> {@code in ()} is not valid SQL, so the statement below cannot be built for it. The
	 * screen this serves „starts empty and fills" ({@link PaymentsDueApi}), so the empty list is the
	 * state the portal opens in.
	 *
	 * <p><b>Every member asked about is in the answer, with an empty book for those who have no
	 * rows.</b> The statement underneath can only answer about members who HAVE lines, and a caller
	 * reading its map by key would get null for everybody else - which is most members - so the
	 * filling in happens here, once, rather than at each call site with a {@code getOrDefault}
	 * somebody has to remember. {@link Balance.Money#nothingIn} is the same answer
	 * {@link #of(long, Currency)} gives such a member, by its own {@code coalesce}, so the two readings
	 * agree about him too and not only about the members with money.
	 *
	 * @param whose every member the caller is about to serve, each with the money he is billed in;
	 *              an empty map is harmless
	 */
	Map<Long, Balance.Money> forEveryOneOf(Map<Long, Currency> whose) {
		Map<Long, Balance.Money> everyone = new HashMap<>();

		for (Map.Entry<Long, Currency> one : whose.entrySet()) {
			everyone.put(one.getKey(), Balance.Money.nothingIn(one.getValue()));
		}

		if (whose.isEmpty()) {
			return everyone;
		}

		Collection<Long> ids = whose.keySet();

		db.sql("select competitor_id, currency, coalesce(sum(amount), 0) from balance_entry"
						+ " where competitor_id in (:ids) group by competitor_id, currency")
				.param("ids", ids)
				.query((row, i) -> {
					long competitor = row.getLong(1);

					/* ONLY THE LINES IN HIS OWN MONEY. A member who has changed country has groups in
					   both, and the one he has left sums to nought by construction - see the note at
					   the head of this class about why that is not a reason to stop asking. */
					if (whose.get(competitor) == Currency.valueOf(row.getString(2))) {
						everyone.put(competitor,
								new Balance.Money(row.getBigDecimal(3), whose.get(competitor)));
					}

					return competitor;
				})
				.list();

		return everyone;
	}

	/**
	 * A MEMBERSHIP TAKES ITS PART OUT OF THE BOOK, and the entry names the season it went to.
	 *
	 * <p>Written the moment the membership becomes a fact and never a moment earlier: the owner,
	 * 26.09.2026, „balans se skida tek kad uplata bude proknjizena. Ako clan ne plati, balans mu
	 * ostaje." He was shown and accepted the cost of that, and the shape that refuses to deduct early
	 * is this method being called from nowhere but where a membership row is actually written.
	 *
	 * <p><b>TWO OF THE THREE SUCH PLACES, AND THE THIRD IS NOT AN OMISSION.</b>
	 * {@link MyMembershipWriteApi} and {@link PaymentApi} call this; {@link MembershipWriteApi} calls
	 * it only on the ground of a balance, and never where the administration frees a member of the fee
	 * - he owes nothing, so there is nothing for his balance to pay, and spending it on a season he was
	 * going to get free would be the portal charging him for a gift. That is the same refusal
	 * {@link com.btl.portal.domain.balance.ActivatingFromBalance} states for {@code HE_OWES_NOTHING},
	 * derived from PDL 11.08.2026 („Balans ne propada nikad i prenosi se iz sezone u sezonu"): it
	 * keeps, so it waits for a season in which he is no longer exempt. The REWARD is a different
	 * question and is paid at all three ({@link #aReferralWasActivated}).
	 *
	 * @param amount how much of the balance this membership uses, in his money
	 * @return {@code balance_entry.id}, which the membership row names when the basis is
	 *         {@code balance}
	 */
	long spentOnAMembership(long competitorId, int season, Balance.Money amount, Long account,
			String accountName) {

		return db.sql("insert into balance_entry (competitor_id, amount, currency, reason, season,"
						+ " occurred_at, recorded_by, recorded_by_name)"
						+ " values (?, ?, ?, 'membership', ?, ?, ?, ?) returning id")
				.params(competitorId, amount.amount().negate(), amount.currency().name(), season,
						Timestamp.from(clock.instant()), account, accountName)
				.query(Long.class)
				.single();
	}

	/**
	 * AND MONEY THAT ARRIVED OVER AND ABOVE WHAT WAS EXPECTED GOES ONTO THE BOOK AS A CREDIT.
	 *
	 * <p><b>Owner, 27.09.2026 (PDL, section 19, case 7):</b> „veci od ocekivanog ... aktivacija
	 * prolazi, visak ulazi u balans kao kredit." PDL records why that outcome was chosen over the two
	 * others offered: „balans vec postoji kao mesto gde stoji clanov novac kod nas, pa se visak ne
	 * izmislja nigde drugde i clan ne gubi ono sto je poslao."
	 *
	 * <p><b>It names the season, and V42's own note says why:</b> a surplus arises only while a payment
	 * for one season is being booked, and a credit with no season would be money whose origin nothing
	 * records. {@code balance_entry_what_names_the_season} is that sentence where it cannot be got
	 * around.
	 *
	 * <p><b>Called only when there IS a surplus</b>, because {@code balance_entry_an_overpayment_adds}
	 * refuses a line of nothing - and rightly: a member who sent exactly what he owed has no credit to
	 * record, and writing one would put a row in an immutable book saying something happened that did
	 * not.
	 */
	void creditedAnOverpayment(long competitorId, int season, Balance.Money surplus, Long account,
			String accountName) {

		db.sql("insert into balance_entry (competitor_id, amount, currency, reason, season,"
						+ " occurred_at, recorded_by, recorded_by_name)"
						+ " values (?, ?, ?, 'overpayment', ?, ?, ?, ?)")
				.params(competitorId, surplus.amount(), surplus.currency().name(), season,
						Timestamp.from(clock.instant()), account, accountName)
				.update();
	}

	/**
	 * AND WHEN A MEMBER CHANGES COUNTRY HIS BALANCE IS RESTATED IN THE MONEY HE IS NOW BILLED IN.
	 *
	 * <p><b>Owner, 27.09.2026 (PDL, section 26), chosen between three outcomes:</b> „Dvojka, 120 je
	 * kurs i tako ostaje do daljnjeg." He keeps exactly what he had; he neither earns nor spends
	 * anything by moving, and {@link Balance#translated} is the one place the rate is applied.
	 *
	 * <p><b>TWO LINES AND NOT ONE, and the reason is that a sum across two currencies is not a
	 * number.</b> Every line carries its own money now, so the whole of the old balance is taken OUT of
	 * the old currency and the restated amount is put IN to the new one. The old currency then sums to
	 * exactly nought, which is the honest statement that there is nothing left there, and every line
	 * still says truthfully what money it was written in. A single netting line would leave the old
	 * currency standing at a positive figure nobody ever cancelled.
	 *
	 * <p><b>AND THE OLD LINES ARE NOT REWRITTEN, WHICH IS NOT A PREFERENCE:</b>
	 * {@code a_balance_entry_is_written_once} (V38) refuses it outright, and ADL asks for
	 * „nepromenljive stavke". A book whose past can be restated in another money is not immutable, and
	 * a member is entitled to see THAT a translation happened and at what rate.
	 *
	 * <p><b>Both lines carry the same instant</b>, from the portal's clock, so the pair can be
	 * recognised as one act by anybody reading the book later.
	 *
	 * @param had what the book added up to in the money he was billed in until now, which the caller
	 *            has already established is not nothing
	 * @param now the same money restated, from {@link Balance#translated}
	 */
	void translated(long competitorId, Balance.Money had, Balance.Money now, Long account,
			String accountName) {

		Timestamp when = Timestamp.from(clock.instant());

		db.sql("insert into balance_entry (competitor_id, amount, currency, reason, occurred_at,"
						+ " recorded_by, recorded_by_name) values (?, ?, ?, 'conversion', ?, ?, ?)")
				.params(competitorId, had.amount().negate(), had.currency().name(), when, account,
						accountName)
				.update();

		db.sql("insert into balance_entry (competitor_id, amount, currency, reason, occurred_at,"
						+ " recorded_by, recorded_by_name) values (?, ?, ?, 'conversion', ?, ?, ?)")
				.params(competitorId, now.amount(), now.currency().name(), when, account, accountName)
				.update();
	}

	/**
	 * WHAT THE CODE THIS MEMBER IS BEING SHOWN PROMISES HIS BALANCE WILL COVER, written down at the
	 * moment it is shown to him.
	 *
	 * <p><b>This is „kovanje koda" and it moves nothing.</b> The owner refused deducting at minting on
	 * 26.09.2026 („Odbijen je ishod u kom se balans skida odmah pri kovanju koda"), which leaves
	 * exactly one shape: the amount is recorded when it is promised and acted on when the member
	 * activates. A member who never pays keeps his whole balance, because this row is a note and not a
	 * withdrawal.
	 *
	 * <p><b>WRITTEN ONCE PER SEASON AND NEVER REWRITTEN, and that is the answer to „two codes in one
	 * day".</b> The first look of a season fixes what that season's code promises; a second look is
	 * served the number that already stands ({@link Balance#asThePromiseStands}). An earlier draft made
	 * it an upsert, on the reasoning that „the member is looking at one screen showing one amount" - and
	 * that reasoning was measured false: a slip already printed is not on the screen, so a member whose
	 * balance moved between two looks holds two slips saying two numbers while only one row can be
	 * recorded, and whichever he pays, the book takes off the other one's amount.
	 *
	 * <p><b>WHAT ACTUALLY HOLDS „ONCE" IS THE CALLER'S ORDER AND NOT THIS CLAUSE, and that is measured
	 * rather than argued.</b> {@link MyMembershipApi} reads the promise BEFORE it writes and calls this
	 * only when none stands, so a second look never reaches this statement at all. The measurement:
	 * replacing {@code on conflict do nothing} below with an upsert leaves every case of
	 * {@code MyMembershipApiTest} green, because through one request after another the conflict path is
	 * unreachable. The clause is therefore <b>not the guard</b>; it is what makes a RACE safe, where
	 * two requests both read no promise before either writes: the earlier one stands instead of the
	 * later meeting {@code balance_promise_pk} and answering 500, and the loser reads back and serves
	 * what the winner wrote.
	 *
	 * <p><b>Nothing here refuses a promise of nothing</b>, and that is deliberate: a member whose book
	 * is empty was minted a code for the whole fee, so nought is what that code promised, and it is
	 * that row which pins him for the season. But a member whose balance covers the whole fee is NOT
	 * called with nought - for him there is no code at all, so there is nothing for a row to be about,
	 * and the rule this method's own reader relies on is that <b>a row stands exactly when a code
	 * stands</b> ({@link #promised}).
	 */
	void promise(long competitorId, int season, Balance.Money amount) {
		db.sql("insert into balance_promise (competitor_id, season, amount, currency, promised_at)"
						+ " values (?, ?, ?, ?, ?)"
						+ " on conflict (competitor_id, season) do nothing")
				.params(competitorId, season, amount.amount(), amount.currency().name(),
						Timestamp.from(clock.instant()))
				.update();
	}

	/**
	 * WHAT WAS PROMISED FOR THAT SEASON, or empty when no code was ever minted for it.
	 *
	 * <p><b>Empty is not zero and the difference is the whole rule.</b> A member nobody ever showed a
	 * reduced invoice to paid the full fee off the price list, so nothing comes off his book; a member
	 * promised nothing because his book was empty is the same outcome by a different road. Both are
	 * answered, and neither is guessed: {@link MyMembershipApi} is the only place a reduced amount is
	 * ever computed, and it records what it computed.
	 *
	 * <p><b>AND A ROW STANDING AT ALL IS THE SECOND THING THIS ANSWERS.</b> A promise is written once
	 * per season, so its mere presence says „this season's code has already been minted and its number
	 * is fixed". That is why a promise of nought is a row rather than an absent one.
	 *
	 * <p><b>It answers in the money the code was minted in, which need not be his money today</b>, and
	 * the caller is the one that has to notice: {@link MyMembershipApi} discards a promise in any other
	 * currency, because a slip minted before he moved country is not payable and holding him to its
	 * number would be holding him to another country's price.
	 */
	Optional<Balance.Money> promised(long competitorId, int season) {
		return db.sql("select amount, currency from balance_promise"
						+ " where competitor_id = ? and season = ?")
				.params(competitorId, season)
				.query((row, i) -> new Balance.Money(row.getBigDecimal(1),
						Currency.valueOf(row.getString(2))))
				.optional();
	}

	/**
	 * AND A PROMISE MINTED BEFORE A MEMBER CHANGED COUNTRY IS TAKEN AWAY RATHER THAN TRANSLATED.
	 *
	 * <p><b>Why this table may lose a row while the book may not.</b> V38 wrote, in as many words, that
	 * {@code balance_promise} deliberately carries NO immutability trigger, „because the day a decision
	 * does call for re-minting a code, that is a decision about a screen and not a schema migration".
	 * The book records what HAPPENED to money; this records what a code SAYS, and a code can stop being
	 * a thing anybody can pay.
	 *
	 * <p><b>And it has stopped, which is measured and not argued.</b>
	 * {@code frontend/src/data/paymentQr.ts} mints a member billed in dinars an IPS slip whose amount
	 * field is literally prefixed {@code RSD}, and a member billed in euro a PayPal link carrying
	 * {@code currency_code: 'EUR'}, and its own note says a euro account „would be a second account".
	 * Those are two different instruments on two different accounts, not one slip in two currencies. A
	 * member who has moved cannot pay the old one however much the portal remembers about it.
	 *
	 * <p><b>The cost, stated rather than hidden:</b> he loses the number his season's code was pinned
	 * to, and his next look at {@code GET /api/me/membership} mints a new one against his book as it
	 * now stands. That is the right outcome and not a loss - the pinning exists so that two slips he
	 * could be holding say one number, and after a change of country there is no old slip he could
	 * hold.
	 *
	 * <p><b>EVERY SEASON'S AND NOT JUST THE ONE ON SALE, AND THAT IS WHY THERE IS NO SEASON
	 * PARAMETER.</b> V38 names the state that makes the difference: „a promise for season S and a
	 * promise for S+1 can both stand, because minting one does not spend anything". A change of country
	 * happens at ONE instant, so every promise standing at that instant was minted in the money he has
	 * just left, and there is no promise of his that this should spare. Taking a season would leave the
	 * other row standing in a currency nothing can pay, and would leave a branch in this class for a
	 * state that cannot arise.
	 */
	void forgetEveryPromise(long competitorId) {
		db.sql("delete from balance_promise where competitor_id = ?")
				.param(competitorId)
				.update();
	}

	/**
	 * WHAT A MEMBERSHIP ALREADY TOOK OUT OF THE BOOK, as a positive amount, and nothing when it took
	 * nothing.
	 *
	 * <p>Read back rather than recomputed, and the difference matters exactly once: a route answering
	 * about a membership that was recorded EARLIER cannot work out what the balance paid for it from
	 * today's balance, because today's balance already has that spend taken out of it. The book is the
	 * record of what happened.
	 *
	 * <p><b>It answers in the money the SPEND was written in and not in his money today</b>, because
	 * that is what the association actually took off him. A member who has since changed country is
	 * told about the line that exists rather than about a restatement of it, and the restatement is its
	 * own pair of lines with its own reason.
	 *
	 * <p><b>Grouped by currency, and at most one group can ever come back.</b> One season has at most
	 * one {@code membership} row ({@code membership_pk}, V22) and therefore at most one spend, so the
	 * grouping is how the currency is read off the line rather than a way of adding several up. Empty
	 * is the ordinary case - most bookings take nothing off a book - and is answered in the currency
	 * the caller offers, because „nothing" still has to be said in some money.
	 *
	 * @param ifItTookNothing the currency to answer nothing in, which is his today
	 */
	Balance.Money whatAMembershipTook(long competitorId, int season, Currency ifItTookNothing) {
		List<Balance.Money> taken = db.sql("select currency, coalesce(sum(-amount), 0)"
						+ " from balance_entry where competitor_id = ? and season = ?"
						+ " and reason = 'membership' group by currency")
				.params(competitorId, season)
				.query((row, i) -> new Balance.Money(row.getBigDecimal(2),
						Currency.valueOf(row.getString(1))))
				.list();

		return taken.isEmpty() ? Balance.Money.nothingIn(ifItTookNothing) : taken.get(0);
	}

	/**
	 * AND WHOEVER BROUGHT HIM IN IS PAID, at the moment his membership is activated and not at the
	 * moment he registered.
	 *
	 * <p>PDL: „Iznos leže na balans automatski, u trenutku kad se novom članu aktivira članarina, ne u
	 * trenutku registracije", and the condition is activation and nothing about money - the owner,
	 * 13.08.2026, „OK je da se za preporuku dobije balans čak i ako je preporučen član dobio počasnu
	 * aktivaciju." So this is called from every place a membership is activated, and it asks nothing
	 * about how.
	 *
	 * <p><b>„EVERY PLACE" IS THREE, THEY ARE NAMED HERE, AND THE COUNT HAS A FLOOR UNDER IT RATHER THAN
	 * A PROMISE.</b> A {@code membership} row is written by {@link PaymentApi} (a moderator recognising
	 * money), by {@link MyMembershipWriteApi} (the member letting himself in on his own balance) and by
	 * {@link MembershipWriteApi} (the administration). Each of the three has a case that the referrer is
	 * paid through IT and not merely somewhere:
	 * {@code PaymentApiTest.whoeverBroughtThePayerInIsPaidOnce},
	 * {@code MyMembershipWriteApiTest.whoeverBroughtHimInIsPaidWhenHeLetsHimselfIn} and
	 * {@code MembershipWriteApiTest.whoeverBroughtHimInIsPaidWhenTheAdministrationFreesHimOfTheFee}.
	 * The third was once measured MISSING, and a reward for bringing in a member freed of the fee was
	 * not late but lost.
	 *
	 * <p><b>AND THE REWARD IS IN THE REFERRER'S MONEY, NEVER THE NEWCOMER'S, which is the one thing one
	 * amount made possible to get wrong.</b> Under the pair the question did not exist: a line carried
	 * both numbers and whoever read it took the column he needed. Now the line has to choose, and the
	 * man whose balance it is is the REFERRER - a Serbian member who brings in a friend from Germany
	 * earns 600 dinars and not 5 euro, because dinars are the money his own membership will be paid in.
	 * Paying him in the newcomer's currency would put a line on his book in money that is not his,
	 * where his own balance would never see it.
	 *
	 * <p><b>WHICH IS WHY THIS IS NOW A READ AND THEN A WRITE, AND WAS ONE STATEMENT BEFORE.</b> The
	 * currency has to be worked out from the referrer's country by the one rule that owns it
	 * ({@link Currency#of}), and a rule that lives in Java cannot be applied inside a single
	 * {@code insert ... select}. Writing the country test into the SQL instead would give that rule a
	 * second home, which is the thing this whole branch exists to remove. Both statements run inside
	 * the caller's transaction - all three callers open one - and „once per person brought in" is still
	 * held by {@code balance_entry_one_a_referral} through {@code on conflict do nothing}, so a race
	 * loses to the key rather than paying twice.
	 *
	 * <p><b>Nothing happens for a member nobody brought in</b>, which is most of them, and nothing
	 * happens when the reward is worth nothing: V4 lets a price row be ZERO and
	 * {@code PUT /api/pricing/{key}} has no lower bound, while
	 * {@code balance_entry_a_referral_adds} (V42) demands strictly more - so without that branch the
	 * route would answer 500 for every member anybody brought in, on the day an administrator sets the
	 * referral to nought through his own screen. V38's own backfill carries the identical condition and
	 * the same sentence is why: a reward of nothing earns nobody a line.
	 *
	 * @param newMember {@code competitor.id} of the member whose membership has just been activated
	 */
	void aReferralWasActivated(long newMember, Long account, String accountName) {
		record Referrer(long id, String countryCode) {
		}

		Optional<Referrer> referrer = db.sql("select referrer.id,"
						+ " coalesce(town_country.code, typed_country.code)"
						+ " from competitor c"
						+ " join competitor referrer on referrer.id = c.referred_by"
						+ " left join place town on town.id = referrer.place_id"
						+ " left join country town_country on town_country.id = town.country_id"
						+ " left join country typed_country on typed_country.id = referrer.country_id"
						+ " where c.id = ?")
				.param(newMember)
				.query((row, i) -> new Referrer(row.getLong(1), row.getString(2)))
				.optional();

		if (referrer.isEmpty()) {
			return;
		}

		Currency his = Currency.of(referrer.orElseThrow().countryCode());

		BigDecimal worth = MembershipPrice.amountIn(
				MembershipPrice.rowNamed(priceRows.all(), REFERRAL), his);

		Balance.Money reward = new Balance.Money(worth, his);

		if (!reward.isMoney()) {
			return;
		}

		db.sql("insert into balance_entry (competitor_id, amount, currency, reason,"
						+ " referred_competitor_id, occurred_at, recorded_by, recorded_by_name)"
						+ " values (?, ?, ?, 'referral', ?, ?, ?, ?)"
						+ " on conflict (referred_competitor_id) do nothing")
				.params(referrer.orElseThrow().id(), reward.amount(), his.name(), newMember,
						Timestamp.from(clock.instant()), account, accountName)
				.update();
	}
}
