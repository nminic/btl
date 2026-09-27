package com.btl.portal.web;

import com.btl.portal.domain.balance.Balance;
import com.btl.portal.domain.member.MemberNumber;
import com.btl.portal.domain.membership.GrantingAMembership;
import com.btl.portal.domain.payment.RecordingAPayment;
import com.btl.portal.domain.season.SeasonClock;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.ZonedDateTime;
import java.util.Optional;

/**
 * THE ADMINISTRATION FREEING SOMEBODY OF THE FEE, WHICH UNTIL NOW IT COULD NOT DO AT ALL.
 *
 * <p><b>The gap this closes was named in the journal and in the schema long before it was
 * built.</b> PDL:3473 (B50, 13.09.2026), struck through and closed by this very PR: „ekrana
 * za dodelu [oslobodjenja] nema, pa [oslobodjen] clan danas nema zapis ni za jednu sezonu."
 * {@code V22} allowed the row from the day it was written and nothing could write one; this
 * is the route that does.
 *
 * <p><b>WHAT IT IS CALLED, AND THE WORD THAT MAY NOT BE USED.</b> PDL:5954, the new Statute
 * of 17.08.2026: „Nema vise 'pocasnog clanstva'. Nov Statut ima JEDNU vrstu clanstva (clan
 * 11) i dva statusa koja clanstvo nisu: pridruzeni ucesnik i pocasni prijatelj. Ko ne placa
 * clanarinu je REDOVNI CLAN OSLOBODJEN PLACANJA ODLUKOM UPRAVNOG ODBORA (clan 24 tacka
 * 10). Rec 'pocasni' se za takvog clana NE SME KORISTITI, jer u Statutu znaci nekog ko NIJE
 * clan." So this class, its route, its reasons and its cases speak of a member freed of the
 * fee, and the basis is {@code feeExempt} exactly as the type, the form and the dictionary
 * already spell it.
 *
 * <p><b>THE RIGHT IS {@code queue:payments} AND THAT IS READ OFF A DECISION, NOT OFF THE
 * SHAPE OF THE SCREEN.</b> PDL:760 divides „activation" into two acts that must never be
 * confused, and gives the second one its door: „Aktivacija clanstva - evidentirana uplata
 * ili [oslobodjenje], cime clan dobija clanski broj i postaje punopravan... Radi je vlasnik
 * ili moderator sa pravom nad redom 'Uplate i aktivacija clanova' (P28a)." Freeing somebody
 * of the fee is the second of the two grounds in that very sentence, so it is the same tick
 * that opens {@link PaymentApi}. The superadmin passes by holding every right there is.
 *
 * <p><b>WHAT THE ANSWER DELIBERATELY DOES NOT CARRY, AND THIS IS A PRIVACY RULE RATHER THAN
 * A PREFERENCE.</b> The basis of a membership is read under {@code entity:members}
 * ({@link CompetitorApi#OVER_THE_MEMBERS}; PDL:810, 28.07.2026: „Osnov clanstva se nikad ne
 * prikazuje javno... Vide ga samo Superadmin i moderatori sa pravom nad clanovima", widened
 * on 20.09.2026 to the member's own basis on his own screen). The tick that opens THIS route
 * is {@code queue:payments}, which is not that one - so a moderator may create a basis he
 * may not read, and the answer here must not hand it back to him. {@link Granted} carries
 * the season and the member number and never the basis, and the case that holds it reads the
 * whole body rather than one field.
 *
 * <p><b>THE SEASON IS COMPUTED AND NEVER TAKEN FROM THE FORM, the same choice
 * {@link PaymentApi} made and for a reason that is stronger here.</b>
 * {@link SeasonClock#seasonBeingPaidFor} is the season on sale: inside the renewal window it
 * is next year, outside it the year running, and never earlier than
 * {@link SeasonClock#FIRST_SEASON}. Three things pick it out of the four questions
 * {@code SeasonClock} answers:
 *
 * <ul>
 * <li>An exemption stands exactly where a payment would have stood. PDL:3417 puts the two
 * side by side in one sentence - „Vidi se u spisku takmicara odmah... Isto vazi i kad
 * clanstvo nastane ODLUKOM UDRUZENJA BEZ UPLATE, sto je osnov {@code feeExempt}" - so the
 * season it settles is the season the man would otherwise have been paying for.
 * <li>{@link SeasonClock#seasonBeingRun} is refused by the database, not by an opinion: in
 * the autumn of 2026 it answers 2026, and {@code membership_season_not_before_the_league}
 * (V22) takes nothing before 2027. That is the very window PDL:806 is about, when the owner
 * opens the first profiles and frees them of the fee for 2027.
 * <li>{@link SeasonClock#transfersTakeEffect} answers next year on every day of this one,
 * which would free a man of a fee he is being asked for right now.
 * </ul>
 *
 * <p><b>What is NOT read into this, because it is about a different thing.</b> PDL:6791
 * (06.09.2026) decides which season the sentence „you are free of the fee" NAMES on the
 * member's own „Stanje" panel. That is a decision about what a screen says, not about which
 * season a grant writes, and it is not the authority for the choice above. And PDL:3450
 * („[oslobodjen] clan nema uplatu, pa nema ni dan knjizenja iz kog bi se sezona izvela")
 * does not ask for a typed year either: its own answer is the decision above it, PDL:3427,
 * that an exemption is granted for each season separately.
 *
 * <p><b>HE IS NUMBERED AND ACTIVATED, exactly as a payer is, and both halves are decisions
 * rather than symmetry.</b> PDL:808: „Clan sa [oslobodjenjem] je punopravan, IMA CLANSKI
 * BROJ i pravo rangiranja, i razlikuje se u EVIDENCIJI, ne u pravima." The number comes from
 * {@link MemberNumbers} and only when he has none - PDL 11.08.2026, „Clanski broj ostaje
 * zauvek vezan za tu osobu", so somebody freed of the fee a second year keeps the one he
 * has, which is the same rule {@link RecordingAPayment} states for a renewal.
 *
 * <p><b>AND THE FACT IS WRITTEN IN BOTH OF ITS HOMES, WHICH IS A BOUNDARY AND NOT A
 * CHOICE.</b> {@code membership.basis} stands per person per SEASON (V22) and is the shape
 * the owner decided on 13.09.2026; {@code competitor.membership_basis} stands per PERSON
 * (V7) and is the one every reader on this portal actually reads -
 * {@link CompetitorApi#competitors} serves the column, {@link MeApi} serves the member his own,
 * and {@code frontend/src/data/types.ts} declares it. Writing only the table would free a
 * man in a table nothing reads while every screen still called him a payer. PDL:3476 records
 * the two homes as a boundary in as many words, and {@link CompetitorApi} names the
 * increment that ends it: the one that removes {@code competitor.active}, moving both homes
 * and all eight readers at once. Until then this route writes both, and the cases replace
 * one source with the other to prove neither is standing in for it.
 *
 * <p><b>AND WHOEVER BROUGHT HIM IN IS PAID HERE, which is an obligation this branch's own book
 * creates rather than anything this route wanted.</b> The owner, 13.08.2026: „OK je da se za
 * preporuku dobije balans cak i ako je preporucen clan dobio pocasnu aktivaciju." {@code V38} opens
 * the book and ties the reward to activation, and this is the third of the three places a
 * {@code membership} row is written - so leaving it out would make a reward depend on which door
 * the newcomer came through, which no decision says, and here it would be lost for good because
 * nothing may settle the same season twice. See {@link #freeHim}.
 *
 * <p><b>WHAT IS DELIBERATELY NOT BUILT HERE, NAMED RATHER THAN DISCOVERED:</b>
 *
 * <ul>
 * <li><b>Nothing takes an exemption back</b>, and that is the owner's decision of
 * 27.09.2026 with his reason: every season is granted separately (PDL:3427, „Ne jednom pa
 * dok se ne oduzme"), so one given by mistake lasts at most to the end of that season and is
 * never carried forward. A withdrawal is not refused here quietly - there is no route to
 * refuse.
 * <li><b>No season may be named, so a PAST season cannot be granted.</b> Filling the gap in
 * somebody's history retroactively is a different act with a different question - whether a
 * lapsed member becomes {@code active} again by being given a season he has already lived
 * through - and no decision answers it. {@link SeasonClock#seasonBeingPaidFor} cannot reach
 * a past season, so the question is shut rather than guessed at.
 * <li><b>The trail names who entered it on the portal, never the board's own decision.</b>
 * The owner refused a column for the number of that decision on 27.09.2026, with the cost
 * shown to him: the administration would have to type it at every exemption. {@code V35}
 * carries the reason.
 * </ul>
 */
@RestController
class MembershipWriteApi {

	/** {@code membership_basis_known} and {@code competitor_membership_basis_known}, one word. */
	private static final String FEE_EXEMPT = "feeExempt";

	/**
	 * {@code membership_basis_known} (V38), AND NOT {@code competitor_membership_basis_known},
	 * which is the whole reason the two grounds do not write the same columns.
	 *
	 * <p><b>Measured rather than assumed:</b> V38 widened the per-SEASON constraint to
	 * {@code ('payment', 'feeExempt', 'balance')} and left the per-PERSON one at V7:281,
	 * {@code check (membership_basis in ('payment', 'feeExempt'))}. So this word can be written to
	 * {@code membership.basis} and CANNOT be written to {@code competitor.membership_basis} - the
	 * row would be refused outright. See {@link #grant}.
	 */
	private static final String ON_A_BALANCE = "balance";

	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/**
	 * The ground named in the form is not one this route grants.
	 *
	 * <p>Two prompts, two words, and anything else is refused rather than defaulted. A default
	 * would mean a misspelled field handing out a season free of the fee, against the owner's rule
	 * over the whole of section 19 that an exemption is granted deliberately and one year at a
	 * time. <b>My reasoning rather than his sentence</b>, and its cost is that a caller has to name
	 * which button was pressed.
	 *
	 * <p>It says nothing about which words ARE known, because the set is the schema's and this
	 * caller may not read a basis at all ({@link GrantingAMembership.Outcome#THE_SEASON_IS_ALREADY_HELD}).
	 */
	static final String THE_GROUND_IS_NOT_KNOWN = "theGroundIsNotKnown";

	/**
	 * Nothing would come off his book, so there is no line to write and no membership to hang on
	 * one.
	 *
	 * <p>Reachable only on the ground of a balance, by the two roads
	 * {@link GrantingAMembership.Outcome#NOTHING_WOULD_COME_OFF_THE_BOOK} names: an empty book,
	 * which is most members, or a price list edited to nought. Guarded here so the route answers
	 * this rather than meeting {@code balance_entry_a_membership_takes} (V38) and answering 500.
	 */
	static final String NOTHING_WOULD_COME_OFF_THE_BOOK = "nothingWouldComeOffTheBalance";

	/**
	 * The season is held on some other ground, and this says NO MORE THAN THAT.
	 *
	 * <p>The same word {@link PaymentApi#THE_MEMBERSHIP_IS_ALREADY_HELD} carries, because it is the
	 * same fact reported from the other door, and silent about WHICH ground for the reason
	 * {@link GrantingAMembership.Outcome#THE_SEASON_IS_ALREADY_HELD} sets out: the basis is read
	 * under {@code entity:members} and this route is opened by {@code queue:payments}.
	 */
	static final String THE_MEMBERSHIP_IS_ALREADY_HELD = "theMembershipIsAlreadyHeld";

	static final String THE_COMPETITOR_DOES_NOT_EXIST = "theCompetitorDoesNotExist";

	/**
	 * The season is already held by a fee somebody recorded.
	 *
	 * <p>Not „already free of it", which is {@link Granted} answered again: this is the case
	 * where the man PAID, and forgiving a fee that has arrived is not a thing this route may
	 * do quietly. It is the mirror of {@code PaymentApi.THE_MEMBERSHIP_IS_ALREADY_HELD} and
	 * the two exist for one reason between them: whichever act comes second is refused, so
	 * {@code membership_pk} is never met and neither act silently replaces the other.
	 */
	static final String THE_FEE_IS_ALREADY_RECORDED = "theFeeIsAlreadyRecorded";

	/**
	 * A payment for this season was reversed, so this route will not settle it either.
	 *
	 * <p>PDL 11.08.2026: „Stornirana uplata: clanski broj propada, clan postaje neaktivan za
	 * tu sezonu." An exemption entered over that would make the reversal stop having
	 * happened, in one click and with nothing left saying so - which is the same refusal
	 * {@link RecordingAPayment} gives in its own words, „a reversal is turned back by a
	 * person, not by an import". The name is deliberately the one {@link PaymentApi} uses,
	 * because it is the same fact being reported.
	 */
	static final String THE_PAYMENT_WAS_REVERSED = "thePaymentWasReversed";

	private final JdbcClient db;

	private final Clock clock;

	private final MemberNumbers numbers;

	/**
	 * Written by hand for the reason {@link PaymentApi} and {@link RegistrationApi} both
	 * give: what happens to the competitor and to the membership is one thing that must all
	 * happen or none of it, and a boundary somebody opens and closes on purpose cannot be
	 * widened by accident.
	 */
	private final TransactionTemplate inOneTransaction;

	/**
	 * The book, for the one thing this route owes it: whoever brought this member in is paid the
	 * moment his membership becomes a fact, and an exemption is one of the three ways that happens.
	 * See {@link #grant} for the decision and for what was measured before it was written.
	 */
	private final BalanceBook book;

	/**
	 * What one member owes for the season, asked ONLY on the ground of a balance.
	 *
	 * <p>It is the one place in the portal that reads the fee in both currencies off one row of the
	 * price list, and it says so of itself („ASKED TWICE, ONCE PER CURRENCY, because that is what
	 * „dva zasebna cenovnika, ne jedan sa konverzijom" leaves as the only way to have both
	 * numbers"). Working the pair out in this route instead would be a second home for that rule.
	 */
	private final MembershipInvoice invoice;

	MembershipWriteApi(JdbcClient db, Clock clock, MemberNumbers numbers,
			TransactionTemplate inOneTransaction, BalanceBook book, MembershipInvoice invoice) {
		this.db = db;
		this.clock = clock;
		this.numbers = numbers;
		this.inOneTransaction = inOneTransaction;
		this.book = book;
		this.invoice = invoice;
	}

	/**
	 * @param competitorId {@code competitor.id} and never the member number, for the reason
	 *                     {@link PaymentApi} gives about its own form: the population this
	 *                     route exists for is exactly the one that may not have a number yet
	 * @param ground       which of the two prompts the moderator pressed, as
	 *                     {@code membership.basis} spells it: {@code feeExempt} for „Odobri
	 *                     oslobodjenje od clanarine" and {@code balance} for „Odobri iz balansa"
	 *                     and „Odobri umanjen iznos iz balansa", which are one ground and two
	 *                     labels. <b>Required, with no default</b>, for the reason
	 *                     {@link #THE_GROUND_IS_NOT_KNOWN} gives
	 */
	record Grant(Long competitorId, String ground) {
	}

	/** Why it was refused. */
	record Refused(String reason) {
	}

	/**
	 * @param season       the season he has been freed of, so the screen names a year rather
	 *                     than working one out a second time
	 * @param memberNumber his, new or old. Never null: this route either finds one or draws
	 *                     one, which is what „punopravan" in PDL:808 means
	 */
	record Granted(long competitorId, int season, String memberNumber) {
	}

	private record CompetitorRow(long id, String memberNumber) {
	}

	@PostMapping("/api/memberships")
	@RightIsNeeded("queue:payments")
	ResponseEntity<?> free(@RequestBody Grant typed,
			@AuthenticationPrincipal WhoIsAsking.Member asking) {

		if (typed.competitorId() == null || typed.ground() == null || typed.ground().isBlank()) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		/* THE WORD IS TURNED INTO THE BUTTON IT NAMES HERE, ONCE, and the domain decides in terms
		   of buttons rather than of the schema's words. `GrantingAMembership.Ground` carries the
		   reason: the three words `membership_basis_known` knows belong to the database and
		   `MembershipConstraintsTest` reads them out of `pg_constraint` rather than believing a
		   copy, so carrying them into `domain` would give one word a second home for no gain. */
		GrantingAMembership.Ground ground = switch (typed.ground()) {
			case FEE_EXEMPT -> GrantingAMembership.Ground.FREE_OF_THE_FEE;
			case ON_A_BALANCE -> GrantingAMembership.Ground.THE_BALANCE;
			default -> null;
		};

		if (ground == null) {
			return no(HttpStatus.BAD_REQUEST, THE_GROUND_IS_NOT_KNOWN);
		}

		return inOneTransaction.execute(committing -> write(typed, ground, asking));
	}

	private ResponseEntity<?> write(Grant typed, GrantingAMembership.Ground ground,
			WhoIsAsking.Member asking) {

		Optional<CompetitorRow> competitor = db.sql(
						"select id, member_number from competitor where id = ?")
				.param(typed.competitorId())
				.query((row, i) -> new CompetitorRow(row.getLong(1), row.getString(2)))
				.optional();

		/* ASKED BEFORE ANYTHING ELSE, because what follows reads the price list and the book for
		   this person and `MembershipInvoice` answers about him with `.single()` - so a competitor
		   who is not there has to be refused here rather than throwing two statements later. */
		if (competitor.isEmpty()) {
			return no(HttpStatus.BAD_REQUEST, THE_COMPETITOR_DOES_NOT_EXIST);
		}

		int season = SeasonClock.seasonBeingPaidFor(ZonedDateTime.now(clock));

		/* THE BASIS OF THE SEASON IS READ HERE AND IN ONE PLACE, which is worth saying because
		   `MembershipInvoice` reads the same row for its own two booleans. Those two are not
		   consulted anywhere in this route: the decision below turns on the WORD, because it has to
		   tell „the ground you asked for" from „some other ground", which a boolean cannot. One
		   read feeds the decision, so there is one home for it and not two. */
		String held = db.sql("select basis from membership where competitor_id = ? and season = ?")
				.params(competitor.get().id(), season).query(String.class).optional().orElse(null);

		/* WHAT WOULD COME OFF THE BOOK, and NOTHING AT ALL for a man being freed of the fee.
		   `BalanceBook` says why in its own words: he owes nothing, so there is nothing for his
		   balance to pay, and spending it on a season he was going to get free „would be the portal
		   charging him for a gift". PDL 11.08.2026 is where that is derived from - „Balans ne
		   propada nikad i prenosi se iz sezone u sezonu" - so it keeps, and waits for a season in
		   which he is no longer exempt.

		   THE INVOICE IS ASKED ONLY ON THE GROUND THAT SPENDS, and that is not a saving: it is the
		   one place in the portal that reads the fee in BOTH currencies off ONE row of the price
		   list, a rule it holds in as many words („ASKED TWICE, ONCE PER CURRENCY"). Working the
		   pair out here instead would be a second home for it. */
		Balance.Money offTheBook = ground == GrantingAMembership.Ground.THE_BALANCE
				? whatHisBalanceWouldPay(competitor.get().id())
				: Balance.Money.NOTHING;

		GrantingAMembership.Asking question = new GrantingAMembership.Asking(ground, held,
				aPaymentWasReversed(competitor.get().id(), season), offTheBook,
				competitor.get().memberNumber() == null ? null
						: new MemberNumber(competitor.get().memberNumber()));

		return switch (GrantingAMembership.decide(question)) {
			/* 200 AND NOTHING WRITTEN, for the reason `RecordingAPayment` gives about its own
			   repeat: „Recording the same payment twice must be harmless." A moderator working a
			   list somebody reads to him clicks the same row twice, and a second write would draw a
			   second member number - the sequence only counts up, so the first would be gone for
			   good. The number answered is the one he already has, which on this branch is never
			   null: a season held on either of these two grounds was granted by this route, and
			   this route numbers him in the same transaction. */
			case ALREADY_GRANTED_ON_THIS_GROUND -> ResponseEntity.ok(new Granted(competitor.get().id(),
					season, competitor.get().memberNumber()));
			case THE_FEE_IS_ALREADY_RECORDED -> no(HttpStatus.CONFLICT, THE_FEE_IS_ALREADY_RECORDED);
			case THE_SEASON_IS_ALREADY_HELD -> no(HttpStatus.CONFLICT, THE_MEMBERSHIP_IS_ALREADY_HELD);
			case THE_PAYMENT_WAS_REVERSED -> no(HttpStatus.CONFLICT, THE_PAYMENT_WAS_REVERSED);
			case NOTHING_WOULD_COME_OFF_THE_BOOK ->
					no(HttpStatus.CONFLICT, NOTHING_WOULD_COME_OFF_THE_BOOK);
			case GRANT, GRANT_AND_NUMBER_HIM -> grant(season, competitor.get(), asking,
					GrantingAMembership.groundIsWrittenAs(question), offTheBook);
		};
	}

	/**
	 * WHAT HIS BALANCE WOULD PAY FOR THIS SEASON, and the arithmetic is NOT here.
	 *
	 * <p>{@link GrantingAMembership#whatComesOffTheBook} owns it, and owns at length the reason it
	 * is not {@link Balance.Settlement#fromTheBalance()}: on this door a SHORT balance is let
	 * through on purpose („Odobri umanjen iznos iz balansa"), and per-currency {@code min} answers
	 * a pair that stands in no single ratio the moment his book covers the fee in one currency and
	 * not the other.
	 */
	private Balance.Money whatHisBalanceWouldPay(long competitorId) {
		MembershipInvoice.Invoice owed = invoice.forMember(competitorId);

		return GrantingAMembership.whatComesOffTheBook(owed.settled().fee(), owed.settled().balance());
	}

	/**
	 * WRITES THE MEMBERSHIP, AND THE TWO GROUNDS DIFFER IN THREE PLACES RATHER THAN BEING TWO
	 * METHODS.
	 *
	 * <p>Everything that is the same is the same by construction - the number, {@code active}, the
	 * referrer being paid, the one transaction around all of it - and what differs is named below
	 * with what decided it. Two methods would let one of the four common things be edited in one of
	 * them.
	 *
	 * <p><b>1. THE SECOND HOME OF THE BASIS IS WRITTEN FOR AN EXEMPTION AND CANNOT BE FOR A
	 * BALANCE, and that is measured rather than a choice.</b> {@code competitor.membership_basis}
	 * stands per PERSON (V7) and is what every SCREEN reads. V38 widened the per-SEASON constraint
	 * {@code membership_basis_known} to three words and left the per-person one exactly where V7:281
	 * put it: {@code check (membership_basis in ('payment', 'feeExempt'))}. So {@code 'balance'} has
	 * no second home to be written to - the row would be refused outright - and this route does what
	 * {@link MyMembershipWriteApi} already does at the other door onto the same ground: it writes
	 * {@code active} and leaves that column alone.
	 * <p><b>What is given up by that, said rather than left to be found:</b> a man activated on his
	 * balance goes on being called a payer by every screen that reads the per-person column, exactly
	 * as he already is when he lets himself in. That is the boundary PDL:3476 records and
	 * {@link CompetitorApi} names the increment that ends it - the one that removes
	 * {@code competitor.active} and moves both homes and all their readers at once.
	 *
	 * <p><b>2. THE TRAIL OF WHO DECIDED IT GOES WHERE THE SCHEMA ASKS FOR IT, WHICH IS TWO
	 * DIFFERENT TABLES.</b> For an exemption it is {@code membership.decided_by_name} and
	 * {@code decided_at}, because {@code membership_free_of_the_fee_says_who} and
	 * {@code ..._says_when} (V35) demand them of exactly that basis. For a balance it is
	 * {@code balance_entry.recorded_by} and {@code recorded_by_name}, which V38 makes
	 * {@code not null} on the name and which is where the OTHER door already puts it - „the
	 * moderator who recognised the payment that activated the newcomer, or the member himself when
	 * he spends his own balance", in the migration's own words. So the trail has one home per
	 * ground and the same act is never recorded twice.
	 * <p><b>Why the three membership columns are left empty on a balance rather than filled in
	 * too.</b> They are nullable and nothing forbids it, so this is a decision: filling them would
	 * make „who activated this" answerable from two tables for one row, with nothing saying which is
	 * right, and the answer would be MISSING for the member's own door - which writes no trail on
	 * {@code membership} at all and cannot be made to without a constraint that tells the two doors
	 * apart, and {@code basis} is the same word at both.
	 *
	 * <p><b>3. THE BOOK IS WRITTEN FIRST, AND ONLY ON THE GROUND THAT SPENDS.</b> V38 gives
	 * {@code membership} a {@code balance_entry_id} and
	 * {@code membership_basis_says_whether_a_book_entry_is_named} refuses a {@code balance}
	 * membership naming none, so the order is not a preference. An exemption takes nothing off
	 * anybody: {@link BalanceBook} carries the reason and PDL 11.08.2026 is where it comes from.
	 *
	 * @param basis      the word {@code membership.basis} is to carry, as
	 *                   {@link GrantingAMembership#groundIsWrittenAs} spells it
	 * @param offTheBook what this activation takes out of his book, already worked out and already
	 *                   known not to be nothing on the ground that spends
	 */
	private ResponseEntity<?> grant(int season, CompetitorRow competitor, WhoIsAsking.Member asking,
			String basis, Balance.Money offTheBook) {

		MemberNumber number = competitor.memberNumber() == null
				? numbers.draw()
				: new MemberNumber(competitor.memberNumber());

		String enteredByName = db.sql("select first_name || ' ' || last_name from account where id = ?")
				.param(asking.account()).query(String.class).single();

		boolean freeOfTheFee = FEE_EXEMPT.equals(basis);

		/* THE NUMBER AND THE FLAG, AND THE SECOND HOME OF THE BASIS ONLY WHERE IT CAN HOLD THE
		   WORD. `active` is what every public reader ends on (`where c.active`, ten of them), and
		   PDL:3417 says an activation shows „odmah" exactly as a booked payment does. Both are
		   written whether or not a number was drawn, so the facts cannot come apart. See point 1 on
		   this method for why the third column is written on one ground and not the other. */
		if (freeOfTheFee) {
			db.sql("update competitor set member_number = ?, active = true, membership_basis = ?"
							+ " where id = ?")
					.params(number.written(), FEE_EXEMPT, competitor.id()).update();
		}
		else {
			db.sql("update competitor set member_number = ?, active = true where id = ?")
					.params(number.written(), competitor.id()).update();
		}

		/* THE LINE IN THE BOOK BEFORE THE MEMBERSHIP THAT NAMES IT, for the reason point 3 gives.
		   `spentOnAMembership` is where the sign lives, so what is handed over is money he HAS and
		   the minus is the book's business rather than this route's. */
		Long entry = freeOfTheFee ? null
				: book.spentOnAMembership(competitor.id(), season, offTheBook, asking.account(),
						enteredByName);

		db.sql("insert into membership (competitor_id, season, basis, payment_id, balance_entry_id,"
						+ " decided_by, decided_by_name, decided_at) values (?, ?, ?, null, ?, ?, ?, ?)")
				.params(competitor.id(), season, basis, entry,
						freeOfTheFee ? asking.account() : null,
						freeOfTheFee ? enteredByName : null,
						freeOfTheFee ? Timestamp.from(clock.instant()) : null)
				.update();

		/* AND WHOEVER BROUGHT HIM IN IS PAID, HERE TOO, because the owner said so in as many words on
		   13.08.2026: „OK je da se za preporuku dobije balans cak i ako je preporucen clan dobio
		   pocasnu aktivaciju." PDL ties the reward to ACTIVATION („Iznos leze na balans automatski, u
		   trenutku kad se novom clanu aktivira clanarina") and says nothing about how it was paid
		   for, and an exemption is one of the three ways a `membership` row comes to exist.

		   WHY THIS IS NOT A CONVENIENCE BUT THE ONLY MOMENT THERE IS. A member freed of the fee can
		   never afterwards come through the paying door - `THE_FEE_IS_ALREADY_RECORDED` refuses a
		   second act on a season already held, and `PaymentApi` refuses him likewise - so a reward
		   not written here is a reward LOST FOR GOOD. Measured on this branch before it was written:
		   the grant answered 201, the referrer's book stayed empty, and the same man through the
		   payments door answered 409.

		   V38's carry says of this exact case that it leaves such a referral „rewarded by whatever
		   route records that exemption, the day it exists". This is that route and that day.

		   `on conflict (referred_competitor_id) do nothing` inside `aReferralWasActivated` is what
		   keeps it once per member brought in, so a man freed of the fee for a second season earns
		   his referrer nothing further, and it is silent rather than an error. Inside the one
		   transaction this route already opens, so the entry and the membership stand or fall
		   together. */
		book.aReferralWasActivated(competitor.id(), asking.account(), enteredByName);

		return ResponseEntity.status(HttpStatus.CREATED)
				.body(new Granted(competitor.id(), season, number.written()));
	}

	/**
	 * Whether a payment for this season went back.
	 *
	 * <p>{@code payment_one_a_season} means there is at most one row to ask about, and
	 * {@link RecordingAPayment#REVERSED} is asked for by name rather than by „not recorded":
	 * a payment still {@code awaited} is the ordinary state of the man this route exists for,
	 * sitting in the queue with nobody having said the money came.
	 */
	private boolean aPaymentWasReversed(long competitorId, int season) {
		return Boolean.TRUE.equals(db.sql("select exists(select 1 from payment"
						+ " where competitor_id = ? and season = ? and state = ?)")
				.params(competitorId, season, RecordingAPayment.REVERSED)
				.query(Boolean.class).single());
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}
}
