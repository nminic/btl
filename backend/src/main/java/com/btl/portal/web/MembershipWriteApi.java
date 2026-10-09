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
 * carries the reason. It is written for the second act that forgives money as well, since
 * 03.10.2026: a balance that fell short of the fee (see {@code grant}).
 * <li><b>The button that was pressed is not on the wire, so a balance that moved between the
 * screen and the press is read as it stands NOW.</b> „Odobri iz balansa" and „Odobri umanjen
 * iznos iz balansa" are one ground and two labels, and the label tells the moderator what the
 * screen worked out from the balance it was served. This route works the same thing out again
 * from the book, inside the transaction, and acts on THAT. If a referral landed, or a spend was
 * written, between the two, he can press a button that read „the whole fee" and find the balance
 * short: it is spent to the last, the trail is written and the answer is 201. Nothing is forgiven
 * in silence - the trail names him and the moment - but he did not choose it with his eyes open.
 * The other direction, a button that read „reduced" over a book that now covers the fee, forgives
 * nothing: the book pays the whole fee, which is what the member owes, and no trail is written.
 * <b>Whether the request should carry the intent, and the route refuse a press whose intent the
 * book no longer matches, is a question put to the owner (09.10.2026, PENDING, question 23).</b>
 * Until he answers, the route reads the book, which is the first of the outcomes put to him, and
 * this paragraph is the boundary written down rather than found.
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

	/**
	 * <p>Asked for one thing only: the money a NOTHING has to be said in on the ground that spends
	 * nothing. On the ground that does spend, the invoice has already read it.
	 */
	private final CurrencyOfMember currencyOf;

	MembershipWriteApi(JdbcClient db, Clock clock, MemberNumbers numbers,
			TransactionTemplate inOneTransaction, BalanceBook book, MembershipInvoice invoice,
			CurrencyOfMember currencyOf) {
		this.db = db;
		this.clock = clock;
		this.numbers = numbers;
		this.inOneTransaction = inOneTransaction;
		this.book = book;
		this.invoice = invoice;
		this.currencyOf = currencyOf;
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

		/* FOR UPDATE, AND IT IS WHAT MAKES THE HARMLESS REPEAT HARMLESS WHEN THE TWO PRESSES ARRIVE
		   TOGETHER. `ALREADY_GRANTED_ON_THIS_GROUND` answers a second press 200 and writes nothing,
		   and it can only do that if the second press SEES the first one's row. Without the lock two
		   presses that arrived at once both read that no membership stood, both decided to grant,
		   and the second lost to `membership_pk`: a 500 for the very press the repeat was written for
		   (measured, `FreeingTwiceAtOneInstantTest`, before this line existed). Held here, the second
		   press waits for the first to commit and then reads its membership and its number.

		   THE MEMBER'S OWN ROW, the shape `SignInApi` and `MePasswordApi` already put on the account
		   they decide about. And it reaches past this route: every other door that writes a season
		   for him - a payment, a line in his book, his own activation - names this row by a foreign
		   key, and inserting such a row takes `FOR KEY SHARE` on it, which `FOR UPDATE` stops. That
		   is the mechanism `VerificationDecisionConcurrencyTest` measured on 22.09.2026 for
		   `verification_lock` and its parent; here it is read off the same rule rather than measured
		   again, and nothing in this route depends on it. */
		Optional<CompetitorRow> competitor = db.sql(
						"select id, member_number from competitor where id = ? for update")
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

		   THE INVOICE IS ASKED ONLY ON THE GROUND THAT SPENDS, and that is not a saving: it is the one
		   place in the portal that reads the member's country, picks the column of the price list that
		   money applies to, and sums the lines of his book in it. Working that out here instead would
		   be a second home for the one fact this branch turns on.

		   AND NOTHING AT ALL STILL HAS TO NAME A CURRENCY, which is what changed with V42: a
		   `Balance.Money` is an amount AND a money, so there is no currency-free NOTHING to hand over
		   any more. His own is what is named, because it is the money the line would have been written
		   in had there been one - and `GrantingAMembership` asks nothing of it beyond whether it is
		   money at all. */
		Balance.Settlement settled = ground == GrantingAMembership.Ground.THE_BALANCE
				? hisBalanceAgainstTheFee(competitor.get().id())
				: null;

		Balance.Money offTheBook = settled != null
				? settled.fromTheBalance()
				: Balance.Money.nothingIn(currencyOf.of(competitor.get().id()));

		/* WHETHER THIS ACT FORGIVES MONEY, which is what decides whether a trail is written, and it is
		   worked out from the SAME settlement the amount comes off the book from, so that the two
		   cannot be two readings of one balance. The owner's decision of 03.10.2026 (PDL P8): the trail
		   goes with every act that forgives money - „Odobri umanjen iznos iz balansa" and the
		   exemption - and „Odobri iz balansa" for the whole fee forgives nothing and goes without one.

		   AN EXEMPTION forgives the whole fee by definition. A BALANCE forgives what it falls short
		   of, and `coveredByTheBalance` is true at EQUALITY (`Balance` says why: a man whose balance is
		   exactly the fee owes nothing more), so a balance of exactly the fee is a whole fee and
		   leaves no trail, and one para less is a reduced amount and leaves one.

		   IT IS THE FEE THE BALANCE IS MEASURED AGAINST, NEVER THE FEE AND THE PROCESSING TAX
		   TOGETHER: a membership paid out of a balance moves no money through an intermediary, so it
		   carries no tax (PDL, „Clanarina placena iz balansa ne nosi taksu"). A balance of 41 against a
		   fee of 40 and a tax of 3 is therefore a whole fee: it takes 40 and writes no trail. */
		boolean forgivesMoney = ground == GrantingAMembership.Ground.FREE_OF_THE_FEE
				|| !settled.coveredByTheBalance();

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
			   this route numbers him in the same transaction. The two clicks may also arrive
			   TOGETHER, and the `for update` at the top of this method is what still brings the
			   second one here: it waits for the first to commit and then reads its row. */
			case ALREADY_GRANTED_ON_THIS_GROUND -> ResponseEntity.ok(new Granted(competitor.get().id(),
					season, competitor.get().memberNumber()));
			case THE_FEE_IS_ALREADY_RECORDED -> no(HttpStatus.CONFLICT, THE_FEE_IS_ALREADY_RECORDED);
			case THE_SEASON_IS_ALREADY_HELD -> no(HttpStatus.CONFLICT, THE_MEMBERSHIP_IS_ALREADY_HELD);
			case THE_PAYMENT_WAS_REVERSED -> no(HttpStatus.CONFLICT, THE_PAYMENT_WAS_REVERSED);
			case NOTHING_WOULD_COME_OFF_THE_BOOK ->
					no(HttpStatus.CONFLICT, NOTHING_WOULD_COME_OFF_THE_BOOK);
			case GRANT, GRANT_AND_NUMBER_HIM -> grant(season, competitor.get(), asking,
					GrantingAMembership.groundIsWrittenAs(question), offTheBook, forgivesMoney);
		};
	}

	/**
	 * HIS BALANCE AGAINST THE FEE FOR THIS SEASON, and the arithmetic is NOT here.
	 *
	 * <p>{@link Balance.Settlement#fromTheBalance()} owns it, which is {@code min(balance, fee)} - and
	 * since V42 that is the answer on BOTH doors rather than only on the member's own.
	 *
	 * <p><b>The whole settlement is returned and not the amount that comes off</b>, because the route
	 * needs two answers out of one reading: how much comes off the book, and whether the balance
	 * covered the fee, which is what decides whether the act leaves a trail
	 * ({@link Balance.Settlement#coveredByTheBalance()}, true at equality). Read twice they would be
	 * two readings of one balance.
	 *
	 * <p><b>It was a rule of its own until then, and the reason it is worth recording is that the rule
	 * was right.</b> While a balance was a PAIR, {@code min} taken per currency answered „40 EUR and
	 * 600 RSD" for a book of 50/600 against a fee of 40/4.800 - leaving ten euro of his book standing
	 * while taking every dinar of it, at a rate of fifteen to one that the portal is forbidden to
	 * apply. So {@code GrantingAMembership.whatComesOffTheBook} carried a binary rule instead: covered
	 * in both currencies, take the fee; otherwise take the WHOLE book. Case 5 („Odobri umanjen iznos iz
	 * balansa") is what made that state reachable, because this door lets a SHORT balance through on
	 * purpose where the member's own door refuses it.
	 *
	 * <p><b>One amount has no such state, so the rule collapsed into the ordinary one and the method
	 * holding it was deleted rather than shortened.</b> The owner decided that on 27.09.2026 (PDL 25);
	 * a short balance is now simply spent to the end, which is exactly what case 5 asks for.
	 */
	private Balance.Settlement hisBalanceAgainstTheFee(long competitorId) {
		return invoice.forMember(competitorId).settled();
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
	 * <p><b>2. THE TRAIL OF WHO DECIDED IT IS WRITTEN FOR EVERY ACT THAT FORGIVES MONEY, AND ON A
	 * SHORT BALANCE IT STANDS IN TWO PLACES.</b> The owner's decision of 03.10.2026, chosen among the
	 * options put to him (PDL P8, the entry „Trag (ko je odobrio i kada) ide uz svaku radnju koja
	 * prasta novac"): an exemption from the fee, and „Odobri umanjen iznos iz balansa"; „Odobri iz
	 * balansa" for the whole fee forgives nothing and goes without one. So the three columns
	 * {@code V35} added ({@code decided_by}, {@code decided_by_name},
	 * {@code decided_at}) are written when the ground is the fee being waived AND when the ground is
	 * the balance and it did not cover the fee ({@code forgivesMoney}, worked out in {@code write}),
	 * and are left empty otherwise. {@code membership_on_a_balance_carries_its_trail_whole_or_not_at_all}
	 * (V56) holds the three together on a balance. It cannot hold „a trail exactly when the balance
	 * fell short", because a row carries no price: deciding which of the two a row gets is this
	 * method's work, and {@code MembershipWriteApiTest}'s to hold, on both sides of the fee.
	 * <p><b>The book is the other place, and it is kept.</b> {@code balance_entry.recorded_by},
	 * {@code recorded_by_name} and {@code occurred_at} (V38) name whoever spent the balance and when.
	 * That is the record of the money, and it is written on a whole fee too, where the membership
	 * carries nothing. On a short balance the same account, name and moment stand on the membership
	 * as well, so „on which memberships was money forgiven, and by whom" is one question on one table
	 * for an exemption and for a short balance alike (ADL, the entry of 09.10.2026 under the decision
	 * of 03.10.2026).
	 * <p><b>WHAT THIS PARAGRAPH SAID UNTIL 09.10.2026, written out because it was the premise and it
	 * is overturned.</b> It said that for a balance the trail was {@code balance_entry.recorded_by} and
	 * {@code recorded_by_name} and nothing else, „so the trail has one home per ground and the same act
	 * is never recorded twice", and that filling the membership columns on a balance would make „who
	 * activated this" answerable from two tables with nothing saying which is right. The owner's
	 * decision of 03.10.2026 overturned it, and the fact is now recorded twice on purpose. What keeps
	 * two homes one answer is not a sentence but a case: {@code theTrailOnTheRowIsTheTrailInTheBook}
	 * reads both for one press and requires the same account, the same name and the same moment. Both
	 * are written in this transaction, from this request's account and from this clock (two readings
	 * of it, microseconds apart in production and one instant under the fixed clock of the cases).
	 * <p><b>The member's own door writes no trail, and that is right rather than missing.</b>
	 * {@link MyMembershipWriteApi} only ever spends a balance that covers the fee, so the act forgives
	 * nothing there, exactly as a whole fee forgives nothing here.
	 *
	 * <p><b>3. THE BOOK IS WRITTEN FIRST, AND ONLY ON THE GROUND THAT SPENDS.</b> V38 gives
	 * {@code membership} a {@code balance_entry_id} and
	 * {@code membership_basis_says_whether_a_book_entry_is_named} refuses a {@code balance}
	 * membership naming none, so the order is not a preference. An exemption takes nothing off
	 * anybody: {@link BalanceBook} carries the reason and PDL 11.08.2026 is where it comes from.
	 *
	 * @param basis         the word {@code membership.basis} is to carry, as
	 *                      {@link GrantingAMembership#groundIsWrittenAs} spells it
	 * @param offTheBook    what this activation takes out of his book, already worked out and already
	 *                      known not to be nothing on the ground that spends
	 * @param forgivesMoney whether this act forgives money, which is what decides whether the trail
	 *                      is written: an exemption always, a balance when it fell short of the fee.
	 *                      Worked out once in {@code write}, from the settlement the amount came from
	 */
	private ResponseEntity<?> grant(int season, CompetitorRow competitor, WhoIsAsking.Member asking,
			String basis, Balance.Money offTheBook, boolean forgivesMoney) {

		String enteredByName = db.sql("select first_name || ' ' || last_name from account where id = ?")
				.param(asking.account()).query(String.class).single();

		boolean freeOfTheFee = FEE_EXEMPT.equals(basis);

		/* THE LINE IN THE BOOK BEFORE THE MEMBERSHIP THAT NAMES IT, for the reason point 3 gives.
		   `spentOnAMembership` is where the sign lives, so what is handed over is money he HAS and
		   the minus is the book's business rather than this route's. */
		Long entry = freeOfTheFee ? null
				: book.spentOnAMembership(competitor.id(), season, offTheBook, asking.account(),
						enteredByName);

		/* THE TRAIL, THREE COLUMNS OR NONE, which is what V56 asks of a balance and V35 of an
		   exemption: the account that is asking, the name it carries now (copied, because the name is
		   what outlives the account), and this clock's instant. All three come from the request's own
		   principal and never from the body or from the member being activated, so a moderator who
		   activates himself is named, and is named because he asked. */
		db.sql("insert into membership (competitor_id, season, basis, payment_id, balance_entry_id,"
						+ " decided_by, decided_by_name, decided_at) values (?, ?, ?, null, ?, ?, ?, ?)")
				.params(competitor.id(), season, basis, entry,
						forgivesMoney ? asking.account() : null,
						forgivesMoney ? enteredByName : null,
						forgivesMoney ? Timestamp.from(clock.instant()) : null)
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

		/* AND ONLY NOW IS A NUMBER DRAWN, AFTER EVERY ROW THE DATABASE COULD STILL REFUSE, which is
		   the order the two other doors to the same fact already keep: `PaymentApi.recordIt` draws
		   last and `MyMembershipWriteApi.letHimIn` draws after its own `insert into membership`.
		   `member_number_seq` is not transactional, so a number drawn ahead of a booking the
		   database then refuses is spent for good, and the owner's rule is „Clanski broj se nikad ne
		   dodeljuje dvaput" (PDL 31.07.2026). `MemberNumbers` used to record why this route alone
		   drew first, and the reason it gave - that no case could fail on the move - is answered by
		   `FreeingTwiceAtOneInstantTest.aBookingTheDatabaseRefusesDrawsNoNumber`.

		   THE NUMBER AND THE FLAG, AND THE SECOND HOME OF THE BASIS ONLY WHERE IT CAN HOLD THE WORD.
		   `active` is what every public reader ends on (`where c.active`, ten of them), and PDL:3417
		   says an activation shows „odmah" exactly as a booked payment does. Both are written whether
		   or not a number was drawn, so the facts cannot come apart. See point 1 on this method for
		   why the third column is written on one ground and not the other. Nothing written above
		   reads any of the three: the book and the referral touch `balance_entry`, and the only
		   column of `competitor` they read is `referred_by`. */
		MemberNumber number = competitor.memberNumber() == null
				? numbers.draw()
				: new MemberNumber(competitor.memberNumber());

		if (freeOfTheFee) {
			db.sql("update competitor set member_number = ?, active = true, membership_basis = ?"
							+ " where id = ?")
					.params(number.written(), FEE_EXEMPT, competitor.id()).update();
		}
		else {
			db.sql("update competitor set member_number = ?, active = true where id = ?")
					.params(number.written(), competitor.id()).update();
		}

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
