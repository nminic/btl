package com.btl.portal.web;

import com.btl.portal.domain.member.MemberNumber;
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
 * preporuku dobije balans cak i ako je preporucen clan dobio pocasnu aktivaciju." {@code V36} opens
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

	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

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
	 * See {@link #freeHim} for the decision and for what was measured before it was written.
	 */
	private final BalanceBook book;

	MembershipWriteApi(JdbcClient db, Clock clock, MemberNumbers numbers,
			TransactionTemplate inOneTransaction, BalanceBook book) {
		this.db = db;
		this.clock = clock;
		this.numbers = numbers;
		this.inOneTransaction = inOneTransaction;
		this.book = book;
	}

	/**
	 * @param competitorId {@code competitor.id} and never the member number, for the reason
	 *                     {@link PaymentApi} gives about its own form: the population this
	 *                     route exists for is exactly the one that may not have a number yet
	 */
	record Grant(Long competitorId) {
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

		if (typed.competitorId() == null) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		return inOneTransaction.execute(committing -> write(typed, asking));
	}

	private ResponseEntity<?> write(Grant typed, WhoIsAsking.Member asking) {
		Optional<CompetitorRow> competitor = db.sql(
						"select id, member_number from competitor where id = ?")
				.param(typed.competitorId())
				.query((row, i) -> new CompetitorRow(row.getLong(1), row.getString(2)))
				.optional();

		if (competitor.isEmpty()) {
			return no(HttpStatus.BAD_REQUEST, THE_COMPETITOR_DOES_NOT_EXIST);
		}

		int season = SeasonClock.seasonBeingPaidFor(ZonedDateTime.now(clock));

		/* THE MEMBERSHIP IS ASKED ABOUT BEFORE THE PAYMENT, and the order is the reason
		   rather than the habit: a row here means `membership_pk` is taken, which is the
		   harder fact and the one that would end in a 500. A reversed payment with a row
		   beside it is therefore reported as the fee it is, and a reversed payment with no
		   row is reported as the reversal it is, which is the only case where nothing else
		   has settled the season. */
		Optional<String> held = db.sql("select basis from membership where competitor_id = ? and season = ?")
				.params(competitor.get().id(), season).query(String.class).optional();

		if (held.isPresent()) {
			/* ALREADY FREE OF IT IS 200 AND WRITES NOTHING, for the reason
			   `RecordingAPayment` gives about its own repeat: „Recording the same payment
			   twice must be harmless." A moderator working a list the owner reads to him
			   clicks the same row twice, and the second click must not draw a second number -
			   the sequence only counts up, so the first would be gone for good. */
			if (FEE_EXEMPT.equals(held.get())) {
				return ResponseEntity.ok(new Granted(competitor.get().id(), season,
						competitor.get().memberNumber()));
			}

			return no(HttpStatus.CONFLICT, THE_FEE_IS_ALREADY_RECORDED);
		}

		if (aPaymentWasReversed(competitor.get().id(), season)) {
			return no(HttpStatus.CONFLICT, THE_PAYMENT_WAS_REVERSED);
		}

		return freeHim(season, competitor.get(), asking);
	}

	private ResponseEntity<?> freeHim(int season, CompetitorRow competitor, WhoIsAsking.Member asking) {
		MemberNumber number = competitor.memberNumber() == null
				? numbers.draw()
				: new MemberNumber(competitor.memberNumber());

		String enteredByName = db.sql("select first_name || ' ' || last_name from account where id = ?")
				.param(asking.account()).query(String.class).single();

		/* BOTH HOMES OF THE BASIS, AND THE NUMBER AND THE FLAG BESIDE THEM. `active` is what
		   every public reader ends on (`where c.active`, ten of them), and PDL:3417 says an
		   exemption shows „odmah" exactly as a booked payment does. The column is written
		   whether or not a number was drawn, so the two facts cannot come apart. */
		db.sql("update competitor set member_number = ?, active = true, membership_basis = ? where id = ?")
				.params(number.written(), FEE_EXEMPT, competitor.id()).update();

		db.sql("insert into membership (competitor_id, season, basis, payment_id,"
						+ " decided_by, decided_by_name, decided_at) values (?, ?, ?, null, ?, ?, ?)")
				.params(competitor.id(), season, FEE_EXEMPT, asking.account(), enteredByName,
						Timestamp.from(clock.instant()))
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

		   V36's carry says of this exact case that it leaves such a referral „rewarded by whatever
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
