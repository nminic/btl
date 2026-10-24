package com.btl.portal.web;

import com.btl.portal.domain.account.WhatAnAddressLooksLike;
import com.btl.portal.domain.mail.MailLanguage;
import com.btl.portal.domain.mail.WhatTheMessageSays;
import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.mail.WhatTheMessageSays.Portal;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.pricing.Currency;
import com.btl.portal.domain.pricing.MembershipPrice;
import com.btl.portal.domain.rights.TheNamedSuperadmin;
import com.btl.portal.domain.registration.Guardianship;
import com.btl.portal.domain.registration.WhatADataCorrectionSays;
import com.btl.portal.domain.registration.WhatADataCorrectionSays.Field;
import com.btl.portal.domain.registration.WhatAFieldMeans;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import com.btl.portal.mail.Postman;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.MailException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;

/**
 * THE ADMINISTRATION CORRECTING A MEMBER'S DATA, ALL OF THEM BAR THE PASSWORD.
 *
 * <p>Owner, 22.10.2026 (PDL, „Red člana, kartica Podaci i strana Podešavanja"): „Dugme Edit otvara
 * popunjenu formu sa svim podacima kao registracionu, samo bez lozinke. Tu admini i moderatori imaju
 * pravo da izmene sve podatke takmičara." That sentence struck the narrower one of M7 (10.10.2026,
 * „administracija ispravlja samo datum rođenja, pol i ime oca"), which PDL now carries crossed out
 * and dated; the rest of the M7 sentence still stands, and each part of it is a rule of this class:
 *
 * <ol>
 * <li><b>„pol člana koji je bio u paru se ne menja (odbijanje uz rečenicu)"</b> - {@link
 * #A_PAIR_HOLDS_THE_GENDER}. The schema says the same thing in its own way: V12 points
 * {@code racing_pair (man_id, man_gender)} at {@code competitor (id, gender)}, so the update would be
 * refused by the key anyway, as a 500. Asked first, it is a sentence.</li>
 * <li><b>„moderator ne ispravlja svoj zapis, superadmin sme"</b> - answered 404, ADL A8's number for
 * somebody who lacks a right, because over his own record that is what a moderator lacks. Asked of
 * the record the address names against the account that asks, and the superadmin is told apart by
 * {@link WhatHeMayDo#holdsEveryRightThereIs}, the mode V5 lets one role carry, never by a word.</li>
 * <li><b>„ispravka koja člana čini mlađim od 16 bez saglasnosti se odbija"</b> - {@link
 * #A_MINOR_NEEDS_A_CONSENT}. Sixteen is {@link Guardianship#ACCOUNT_IS_HELD_BY_A_GUARDIAN_UNDER},
 * the age to which a parent holds the account (PDL P23), on the day in Belgrade the request is
 * made, and the consent is a row of {@code parental_consent}.</li>
 * <li><b>„a izdat iznos uplatnice se zaboravlja kao kod promene zemlje"</b> - a code already minted
 * for a season is forgotten where the corrected date of birth moves the member across the junior
 * price for that season ({@link MembershipPrice#juniorFor}), and only there: P5 of the questions of
 * 09.10.2026, which the owner answered with the recommendation, says „izdat iznos uplatnice kad se
 * promeni juniorska cena se zaboravlja". A date corrected by a day changes nothing he pays.</li>
 * <li><b>„adresu pošte administracija menja samo dok nije potvrđena"</b> - {@link
 * #THE_ADDRESS_IS_CONFIRMED}. A confirmed address is how somebody signs in, and changing it for him
 * is taking his account (the reason the owner gave on 24.09.2026). It covers the superadmin's own
 * address too, which M7 says is never changed through the portal: he is named only once it is
 * confirmed ({@code TheNamedSuperadmin}).</li>
 * <li><b>„član dobija poruku u sanduče kad mu administracija promeni podatke"</b> - one message,
 * from the league, naming which data and not what they are ({@link WhatADataCorrectionSays}). Only
 * when something actually changed: a form saved as it was opened has changed nothing he needs to
 * hear about.</li>
 * </ol>
 *
 * <p><b>AND THE OWNER'S OTHER SENTENCE OF 22.10.2026</b>, „promena mesta u drugu državu menja i
 * valutu", is {@link ACountryMovesTheMoney}, the same object {@link MeWriteApi} calls, so a town
 * corrected here moves his balance and forgets his codes exactly as his own change would; the book
 * names the moderator or the superadmin who sent it.
 *
 * <p><b>TWO THINGS HERE ARE THE ASSISTANT'S REASONING AND NOT A DECISION, and they are named so:</b>
 *
 * <ul>
 * <li>A corrected address of post retires every link already sent to the old one - the
 * confirmation and the setting of a password, which is also how an invitation is taken over.
 * Left standing, whoever holds the mistyped address could confirm the account or set its password
 * after the administration has given it to somebody else. A new link goes to the new address at
 * once, which is the owner's decision and not this reasoning (PDL 22.10.2026, and 23.10.2026 for
 * which link): the link to confirm for an account that has a password, and the link to set one
 * for an account that has none.</li>
 * <li>A document number emptied is a removal only for a member under sixteen, by the same rule
 * the registration asks it by („Od člana mlađeg od 16 godina se traži ali nije obavezan", the
 * privacy policy); for anybody older it is {@link MeWriteApi#A_FIELD_IS_BLANK}.</li>
 * </ul>
 *
 * <p><b>EVERY NAME THE ROUTE DOES NOT TAKE IS REFUSED BY NAME</b> ({@link #NOT_TAKEN_HERE}), not
 * dropped: ADL A54, „kad se forma odbije, kaže se šta fali", and a field Jackson throws away is a
 * field the administrator believes he changed. That is the password, the statement of health, the
 * parent's consent, the beginners' category, the biography and anything else.
 *
 * <p><b>THE WORDS THIS ROUTE SHARES WITH THE MEMBER'S OWN ARE HIS</b>: a box too long, a box emptied,
 * a form not complete, a town not said once or not known are {@link MeWriteApi}'s constants, the
 * same sentences about the same boxes, so a screen reads them once. Only what is new is declared here.
 */
@RestController
class MemberDataWriteApi {

	private static final Logger LOG = LoggerFactory.getLogger(MemberDataWriteApi.class);

	/** A name in the body this route does not take, and the answer says which. */
	static final String NOT_TAKEN_HERE = "notTakenHere";

	/** The member was in a racing pair, so his gender is held by it (V12, M7). */
	static final String A_PAIR_HOLDS_THE_GENDER = "aPairHoldsTheGender";

	/** The corrected date makes him younger than sixteen and no parent ever consented. */
	static final String A_MINOR_NEEDS_A_CONSENT = "aMinorNeedsAConsent";

	/** His address of post is confirmed, so it is his to change and nobody else's. */
	static final String THE_ADDRESS_IS_CONFIRMED = "theAddressIsConfirmed";

	/** He has no account, so there is no address of post to correct. */
	static final String THERE_IS_NO_ACCOUNT = "thereIsNoAccount";

	/** Another account already signs in with that address. */
	static final String THE_ADDRESS_IS_TAKEN = "theAddressIsTaken";

	/**
	 * The address is one the settings name as the superadmin's (owner, 23.10.2026, PDL „Administracija
	 * ne sme da ispravi adresu pošte člana na adresu imenovanog superadmina"). The sentence the screen
	 * says for it is the assistant's and the owner changes it on QA: „Ova adresa pripada administraciji
	 * portala i ne može biti adresa člana."
	 */
	static final String THE_ADDRESS_IS_THE_SUPERADMINS = "theAddressIsTheSuperadmins";

	/** Every name the body may carry, spelt as the registration's form spells them. */
	static final List<String> WHAT_THIS_ROUTE_TAKES = List.of("firstName", "lastName", "fatherName",
			"gender", "birthDate", "idNumber", "email", "address", "phone", "placeId", "city", "country",
			"shirtSize");

	/**
	 * The boxes that are typed, with the most each may hold, which is the number on
	 * {@code registracija.form.json}; {@code MemberDataWriteApiTest} reads that file and requires
	 * every one of these to be exactly it.
	 */
	static final Map<String, Box> EACH_BOX_ON_THE_FORM = Map.of(
			"firstName", new Box(60, Correction::firstName),
			"lastName", new Box(60, Correction::lastName),
			"fatherName", new Box(60, Correction::fatherName),
			"address", new Box(120, Correction::address),
			"city", new Box(80, Correction::city),
			"phone", new Box(30, Correction::phone));

	/** The boxes V7 and V8 hold NOT NULL, so emptying one is refused rather than written. */
	static final List<String> NEVER_EMPTIED = List.of("firstName", "lastName", "fatherName", "address");

	record Box(int longest, Function<Correction, String> in) {
	}

	/**
	 * What the administration sent. A field left out is left alone, which is ADL A54's reading of a
	 * form, and the phone is the one field whose blank is a removal.
	 */
	record Correction(String firstName, String lastName, String fatherName, String gender,
			String birthDate, String idNumber, String email, String address, String phone, Long placeId,
			String city, String country, String shirtSize) {
	}

	private final JdbcClient db;

	private final MemberDataApi data;

	private final MemberOfAccount memberOfAccount;

	private final WhatHeMayDo mayHe;

	private final TownNamed towns;

	private final ACountryMovesTheMoney money;

	private final BalanceBook book;

	private final ObjectMapper json;

	private final TransactionTemplate inOneTransaction;

	private final Clock clock;

	private final Postman postman;

	private final Portal portal;

	private final TheNamedSuperadmin superadmin;

	MemberDataWriteApi(JdbcClient db, MemberDataApi data, MemberOfAccount memberOfAccount,
			WhatHeMayDo mayHe, TownNamed towns, ACountryMovesTheMoney money, BalanceBook book,
			ObjectMapper json, TransactionTemplate inOneTransaction, Clock clock, Postman postman,
			@Value("${btl.portal.address}") String portalAddress, TheNamedSuperadmin superadmin) {

		this.db = db;
		this.data = data;
		this.memberOfAccount = memberOfAccount;
		this.mayHe = mayHe;
		this.towns = towns;
		this.money = money;
		this.book = book;
		this.json = json;
		this.inOneTransaction = inOneTransaction;
		this.clock = clock;
		this.postman = postman;
		this.portal = new Portal(portalAddress);
		this.superadmin = superadmin;
	}

	/**
	 * THE BODY ARRIVES AS BYTES AND IS READ ONLY AFTER „IS THERE A MEMBER HERE, AND IS HE YOURS TO
	 * CORRECT" IS ANSWERED, for the reason {@link MeWriteApi} gives at length: bound as an argument,
	 * a body nobody can parse would be answered 400 before the method ran, while the same body sent
	 * to a number nobody has, or by a moderator about himself, is answered 404.
	 */
	@PutMapping(path = "/api/members/{memberNumber}/data", consumes = MediaType.APPLICATION_JSON_VALUE)
	@RightIsNeeded(CompetitorApi.OVER_THE_MEMBERS)
	ResponseEntity<?> correct(@PathVariable String memberNumber,
			@AuthenticationPrincipal WhoIsAsking.Member asking, HttpServletRequest request,
			HttpServletResponse response) throws IOException {

		Optional<Long> member = db.sql("select id from competitor where member_number = ?")
				.param(memberNumber).query(Long.class).optional();

		if (member.isEmpty() || hisOwnAndHeIsNotTheSuperadmin(member.get(), asking)) {
			response.sendError(HttpStatus.NOT_FOUND.value());
			return null;
		}

		JsonNode sent = read(request.getInputStream().readAllBytes());

		if (sent == null || !sent.isObject()) {
			return notComplete(WHAT_THIS_ROUTE_TAKES);
		}

		List<String> foreign = new ArrayList<>();

		for (String name : sent.propertyNames()) {
			if (!WHAT_THIS_ROUTE_TAKES.contains(name)) {
				foreign.add(name);
			}
		}

		if (!foreign.isEmpty()) {
			return ResponseEntity.badRequest().body(new MeWriteApi.NotAllowed(NOT_TAKEN_HERE, foreign));
		}

		Correction typed = typedFrom(sent);

		if (typed == null || nothingWasNamed(typed)) {
			return notComplete(WHAT_THIS_ROUTE_TAKES);
		}

		ResponseEntity<?> refused = refusedBeforeTheRowIsRead(typed);

		if (refused != null) {
			return refused;
		}

		Optional<TownNamed.Town> town = towns.named(typed.placeId(), typed.city(), typed.country());

		if (town.isPresent() && town.orElseThrow().refused() != null) {
			return ResponseEntity.badRequest().body(new MeWriteApi.Refused(town.orElseThrow().refused()));
		}

		LocalDate today = LocalDate.ofInstant(clock.instant(), SeasonClock.ZONE);

		Corrected done = inOneTransaction.execute(committing ->
				write(member.get(), asking.account(), typed, town.orElse(null), today));

		/* THE NEW LINK GOES OUT ONLY ONCE THE CORRECTION IS COMMITTED, the order
		   `EmailConfirmationApi.resend` keeps: a letter sent from inside the transaction would be a
		   link to a row that a rollback could still take back. */
		if (done.link() != null) {
			send(done.link());
		}

		return done.answer();
	}

	/** What the transaction answers, and the link to send once it has committed, if there is one. */
	private record Corrected(ResponseEntity<?> answer, ToSend link) {

		static Corrected refused(ResponseEntity<?> answer) {
			return new Corrected(answer, null);
		}
	}

	/**
	 * A new link to an address the administration corrected, the address it goes to, which letter it
	 * is and the language its reader chose.
	 *
	 * @param message {@link Message#CONFIRM_THE_ADDRESS} for an account that has a password, and
	 *                {@link Message#INVITED_AS_A_MEMBER} for one that has none (see {@link #write})
	 */
	private record ToSend(long account, String address, String link, MailLanguage language, Message message) {
	}

	private void send(ToSend made) {
		try {
			/* THE INVITATION IS ALWAYS SERBIAN and has no language to be given (owner, 10.10.2026,
			   Q4, `Message#followsTheReader`); the confirmation follows its reader. */
			postman.send(made.message().followsTheReader()
					? WhatTheMessageSays.about(made.message(), made.language(), portal, made.link())
					: WhatTheMessageSays.about(made.message(), portal, made.link()), made.address());
		} catch (MailException theRelayDidNotTakeIt) {
			LOG.warn("a link for account {} after the administration corrected its address did not go out;"
					+ " the token is written and asking again is what gets him out of it",
					made.account(), theRelayDidNotTakeIt);
		}
	}

	/**
	 * Whether this is a moderator asking about the member his own account names. The superadmin may
	 * („superadmin sme"), so he is asked about first and the question ends there for him.
	 */
	private boolean hisOwnAndHeIsNotTheSuperadmin(long member, WhoIsAsking.Member asking) {
		return !mayHe.holdsEveryRightThereIs()
				&& Objects.equals(memberOfAccount.competitorId(asking.account()), member);
	}

	/**
	 * Everything about the form that can be answered without reading his row, in the order a reader
	 * would want to be told: what is too long, what was emptied, and what is not one of the things
	 * the form offers.
	 */
	private static ResponseEntity<?> refusedBeforeTheRowIsRead(Correction typed) {
		List<String> tooLong = new ArrayList<>();

		for (String name : WHAT_THIS_ROUTE_TAKES) {
			Box box = EACH_BOX_ON_THE_FORM.get(name);
			String value = box == null ? null : box.in().apply(typed);

			if (value != null && value.strip().length() > box.longest()) {
				tooLong.add(name);
			}
		}

		if (!tooLong.isEmpty()) {
			return ResponseEntity.badRequest().body(new MeWriteApi.NotAllowed(MeWriteApi.A_FIELD_IS_TOO_LONG, tooLong));
		}

		List<String> emptied = new ArrayList<>();

		for (String name : NEVER_EMPTIED) {
			String value = EACH_BOX_ON_THE_FORM.get(name).in().apply(typed);

			if (value != null && value.isBlank()) {
				emptied.add(name);
			}
		}

		/* AND THE FOUR THAT ARE CHOSEN OR SPELT RATHER THAN TYPED FREELY, which may not be emptied
		   either: a gender, a day, a size and an address of post are each NOT NULL somewhere. */
		Map<String, String> chosen = new LinkedHashMap<>();
		chosen.put("gender", typed.gender());
		chosen.put("birthDate", typed.birthDate());
		chosen.put("email", typed.email());
		chosen.put("shirtSize", typed.shirtSize());

		chosen.forEach((name, value) -> {
			if (value != null && value.isBlank()) {
				emptied.add(name);
			}
		});

		if (!emptied.isEmpty()) {
			return ResponseEntity.badRequest().body(new MeWriteApi.NotAllowed(MeWriteApi.A_FIELD_IS_BLANK, emptied));
		}

		/* WHAT IS NOT ONE OF THE THINGS THE FORM OFFERS, named the way MeWriteApi names a size that
		   is not one of the seven: the form was not filled in as the form fills itself in. The date
		   is asked against no day here, only whether it is one; that it is not in the future is
		   asked with the day below. */
		List<String> notOffered = new ArrayList<>();

		if (typed.gender() != null && WhatAFieldMeans.theGender(typed.gender()) == null) {
			notOffered.add("gender");
		}

		if (typed.birthDate() != null && WhatAFieldMeans.theDay(typed.birthDate(), LocalDate.MAX) == null) {
			notOffered.add("birthDate");
		}

		if (typed.idNumber() != null && !typed.idNumber().isBlank()
				&& WhatAFieldMeans.theDocument(typed.idNumber()) == null) {
			notOffered.add("idNumber");
		}

		if (typed.email() != null && !WhatAnAddressLooksLike.itDoes(WhatAnAddressLooksLike.asItIsStored(typed.email()))) {
			notOffered.add("email");
		}

		if (typed.shirtSize() != null && WhatAFieldMeans.theShirtSize(typed.shirtSize()) == null) {
			notOffered.add("shirtSize");
		}

		return notOffered.isEmpty() ? null : notComplete(notOffered);
	}

	private Corrected write(long member, long account, Correction typed, TownNamed.Town town,
			LocalDate today) {

		/* HIS ROW IS LOCKED FIRST, so two corrections at one instant are one after the other, and
		   what stood before is read under that lock: it is what every rule below compares with,
		   and what decides which data the message names. */
		db.sql("select id from competitor where id = ? for update").param(member).query(Long.class).single();

		MemberDataApi.Data before = data.of(member).orElseThrow();

		LocalDate born = typed.birthDate() == null
				? LocalDate.parse(before.birthDate())
				: WhatAFieldMeans.theDay(typed.birthDate(), today);

		/* A DAY AFTER TODAY IS NOT A DAY OF BIRTH, and it is the one question about the form that
		   needs the day. */
		if (born == null) {
			return Corrected.refused(notComplete(List.of("birthDate")));
		}

		/* THE ADDRESS OF POST: only an account's, and only while it is not confirmed. Whether it is
		   confirmed is NOT asked here, off a read that nothing holds: it is the condition of the
		   statement that moves it, below, and that statement is what holds the row. */
		String address = typed.email() == null ? null : WhatAnAddressLooksLike.asItIsStored(typed.email());
		boolean readdressed = address != null && !address.equals(before.email());

		if (readdressed && before.emailConfirmed() == null) {
			return Corrected.refused(conflict(THERE_IS_NO_ACCOUNT));
		}

		/* NOT AN ADDRESS THE SETTINGS NAME AS THE SUPERADMIN'S (owner, 23.10.2026). Asked of what was
		   typed, and `names` folds it the way it folds the settings, so the comparison is the one the
		   taken address below makes, small letters on both sides. Left to stand, a correction to a
		   named address that nobody holds yet would send that address the link the correction mails,
		   and confirming it would make the member the superadmin (`TheNamedSuperadmin.covers`). */
		if (readdressed && superadmin.names(typed.email())) {
			return Corrected.refused(conflict(THE_ADDRESS_IS_THE_SUPERADMINS));
		}

		if (readdressed && db.sql("select count(*) from account where lower(email) = lower(?)"
						+ " and competitor_id is distinct from ?")
				.params(address, member).query(Long.class).single() > 0) {

			return Corrected.refused(conflict(THE_ADDRESS_IS_TAKEN));
		}

		/* THE GENDER, which a racing pair holds. „Bio u paru" is read as the schema reads it: a row
		   of `racing_pair` naming him, whatever its season, because that is the row whose key
		   would refuse the update. */
		if (typed.gender() != null && !typed.gender().equals(before.gender())
				&& db.sql("select count(*) from racing_pair where man_id = ? or woman_id = ?")
				.params(member, member).query(Long.class).single() > 0) {

			return Corrected.refused(conflict(A_PAIR_HOLDS_THE_GENDER));
		}

		LocalDate wasBorn = LocalDate.parse(before.birthDate());
		boolean underSixteen = Guardianship.accountIsHeldByAGuardian(born, today);

		/* „ČINI mlađim od 16": a date the request moved, not one it sent back as it stood. */
		if (underSixteen && !born.equals(wasBorn)
				&& db.sql("select count(*) from parental_consent where competitor_id = ?")
				.param(member).query(Long.class).single() == 0) {

			return Corrected.refused(conflict(A_MINOR_NEEDS_A_CONSENT));
		}

		boolean documentEmptied = typed.idNumber() != null && typed.idNumber().isBlank();

		if (documentEmptied && !underSixteen) {
			return Corrected.refused(ResponseEntity.badRequest()
					.body(new MeWriteApi.NotAllowed(MeWriteApi.A_FIELD_IS_BLANK, List.of("idNumber"))));
		}

		/* EVERY REFUSAL IS BEHIND US BUT ONE, and nothing has been written yet.

		   THE ADDRESS MOVES ONLY WHILE IT IS NOT CONFIRMED, AND THAT IS ASKED BY THE STATEMENT THAT
		   MOVES IT (22.10.2026, the security review of PR 633). A confirmation opened in the same
		   instant (`EmailConfirmationApi.confirm`) holds the same row before it reads its link, so the
		   two are one after the other and never interleaved: if it got there first, the row is
		   confirmed and this moves nothing, and the answer is that the address is his; if this got
		   there first, the link it opened is gone by the time it reads it. Exactly one row or none,
		   because `account_competitor_unique` (V23) gives a member at most one account. Nothing was
		   written before this line, so a refusal here leaves nothing behind.

		   FROM THIS STATEMENT ON THE ROW IS HELD, and everything about the account's links is done
		   under it: every link sent to the old address is retired, and a request for a new one at the
		   old address (`resend`, `PasswordResetApi.request`) waits and then finds nothing. */
		ToSend link = null;

		if (readdressed) {
			/* WHETHER HE HAS A PASSWORD IS ANSWERED BY THIS SAME STATEMENT, under the hold it takes
			   (PDL, owner, 23.10.2026: an account with none is sent a link to set one, which confirms
			   the address too, and one with a password is sent the link to confirm). A password set in
			   the same instant (`PasswordReset.confirm`) spends a token this correction deletes below,
			   after it has waited for the row, so what is read here is what the link is written for. */
			Optional<Boolean> hasNoPassword = db.sql("update account set email = ? where competitor_id = ?"
							+ " and email_confirmed_at is null returning password_hash is null")
					.params(address, member).query(Boolean.class).optional();

			if (hasNoPassword.isEmpty()) {
				return Corrected.refused(conflict(THE_ADDRESS_IS_CONFIRMED));
			}

			db.sql("delete from email_verification_token where account_id ="
							+ " (select id from account where competitor_id = ?)")
					.param(member).update();
			db.sql("delete from password_reset_token where account_id ="
							+ " (select id from account where competitor_id = ?)")
					.param(member).update();

			/* AND A NEW LINK, AT ONCE, TO THE CORRECTED ADDRESS (owner, PDL 22.10.2026: „portal odmah
			   šalje novu vezu za potvrdu na ispravljenu adresu"). Written under the same hold, so no
			   request at the old address can come between the retiring and the new one, and the
			   address is the one the row now carries.

			   WHICH LINK IS THE ACCOUNT'S OWN STATE (owner, PDL 23.10.2026, „Kad administracija ispravi
			   adresu pošte člana koji NEMA lozinku, portal mu šalje vezu za postavljanje lozinke (ona
			   potvrđuje i adresu), umesto veze za potvrdu. Član koji ima lozinku i dalje dobija vezu za
			   potvrdu"). An account with no password is one the administration entered and that nobody
			   has taken over (V18), and the link that gets him in is the invitation's own road:
			   `password_reset_token`, the seven days the owner gave it on 23.10.2026, the words of
			   `Message#INVITED_AS_A_MEMBER`, and spending it sets the password and confirms the address in
			   the same statement (`PasswordReset`). An account with a password is sent the link to
			   confirm, in its language, as `resend` sends it. */
			SecretToken fresh = SecretToken.fresh();
			boolean noPassword = hasNoPassword.orElseThrow();

			/* THE INVITATION'S ROW IS WRITTEN WHERE THE GROUP ENTRY WRITES ITS OWN, so it lasts the
			   seven days the owner gave it on 23.10.2026 and not the hour of the column's default. */
			if (noPassword) {
				AnInvitationOfAMember.mint(db, db.sql("select id from account where competitor_id = ?")
						.param(member).query(Long.class).single(), fresh);
			} else {
				db.sql("insert into email_verification_token (account_id, token_hash)"
								+ " select id, ? from account where competitor_id = ?")
						.params(fresh.hash(), member).update();
			}

			link = db.sql("select id, email, mail_language from account where competitor_id = ?")
					.param(member)
					.query((row, i) -> new ToSend(row.getLong(1), row.getString(2), fresh.secret(),
							MailLanguage.ofTheColumn(row.getString(3)),
							noPassword ? Message.INVITED_AS_A_MEMBER : Message.CONFIRM_THE_ADDRESS))
					.single();
		}

		Currency was = town == null ? null : money.before(member);
		boolean phoneNamed = typed.phone() != null;

		db.sql("update competitor set first_name = coalesce(cast(? as text), first_name),"
						+ " last_name = coalesce(cast(? as text), last_name),"
						+ " father_name = coalesce(cast(? as text), father_name),"
						+ " gender = coalesce(cast(? as text), gender),"
						+ " birth_date = cast(? as date),"
						+ " address = coalesce(cast(? as text), address),"
						+ " shirt_size = coalesce(cast(? as text), shirt_size),"
						+ " phone = case when cast(? as boolean) then cast(? as text) else phone end,"
						+ " place_id = case when cast(? as boolean) then cast(? as bigint) else place_id end,"
						+ " city = case when cast(? as boolean) then cast(? as text) else city end,"
						+ " country_id = case when cast(? as boolean) then cast(? as bigint) else country_id end"
						+ " where id = ?")
				.params(strippedOrNull(typed.firstName()), strippedOrNull(typed.lastName()),
						strippedOrNull(typed.fatherName()), typed.gender(), born.toString(),
						strippedOrNull(typed.address()), typed.shirtSize(),
						phoneNamed, WhatAFieldMeans.thePhone(typed.phone()),
						town != null, town == null ? null : town.placeKey(),
						town != null, town == null ? null : town.city(),
						town != null, town == null ? null : town.countryId(),
						member)
				.update();

		if (documentEmptied) {
			db.sql("delete from competitor_document where competitor_id = ?").param(member).update();
		} else if (typed.idNumber() != null) {
			db.sql("insert into competitor_document (competitor_id, document_number) values (?, ?)"
							+ " on conflict (competitor_id) do update set document_number = excluded.document_number,"
							+ " written_at = now()")
					.params(member, WhatAFieldMeans.theDocument(typed.idNumber()))
					.update();
		}

		forgetWhatTheJuniorPriceMoved(member, wasBorn.getYear(), born.getYear());

		if (was != null) {
			money.after(member, was, account);
		}

		MemberDataApi.Data after = data.of(member).orElseThrow();
		List<Field> moved = whatMoved(before, after);

		if (!moved.isEmpty()) {
			tell(member, WhatADataCorrectionSays.corrected(moved));
		}

		return new Corrected(ResponseEntity.ok(after), link);
	}

	/**
	 * A CODE MINTED FOR A SEASON IS FORGOTTEN WHERE THE CORRECTED YEAR OF BIRTH MOVES HIM ACROSS THE
	 * JUNIOR PRICE OF THAT SEASON, and nowhere else (M7, see the head of this class). One season at a
	 * time, because V38 lets a promise for one season and one for the next both stand, and a year
	 * that crosses the line for one of them need not cross it for the other.
	 */
	private void forgetWhatTheJuniorPriceMoved(long member, int wasBorn, int isBorn) {
		for (int season : db.sql("select season from balance_promise where competitor_id = ?")
				.param(member).query(Integer.class).list()) {

			if (MembershipPrice.juniorFor(wasBorn, season) != MembershipPrice.juniorFor(isBorn, season)) {
				book.forgetThePromise(member, season);
			}
		}
	}

	/** Which of the facts the message can name are different after the request than before it. */
	private static List<Field> whatMoved(MemberDataApi.Data before, MemberDataApi.Data after) {
		List<Field> moved = new ArrayList<>();

		movedIf(moved, Field.FIRST_NAME, before.firstName(), after.firstName());
		movedIf(moved, Field.LAST_NAME, before.lastName(), after.lastName());
		movedIf(moved, Field.FATHER_NAME, before.fatherName(), after.fatherName());
		movedIf(moved, Field.GENDER, before.gender(), after.gender());
		movedIf(moved, Field.BIRTH_DATE, before.birthDate(), after.birthDate());
		movedIf(moved, Field.ID_NUMBER, before.idNumber(), after.idNumber());
		movedIf(moved, Field.EMAIL, before.email(), after.email());
		movedIf(moved, Field.ADDRESS, before.address(), after.address());
		movedIf(moved, Field.PHONE, before.phone(), after.phone());
		movedIf(moved, Field.TOWN, List.of(Objects.toString(before.placeId()), Objects.toString(before.city()),
				Objects.toString(before.country())), List.of(Objects.toString(after.placeId()),
				Objects.toString(after.city()), Objects.toString(after.country())));
		movedIf(moved, Field.SHIRT_SIZE, before.shirtSize(), after.shirtSize());

		return moved;
	}

	private static void movedIf(List<Field> moved, Field field, Object was, Object is) {
		if (!Objects.equals(was, is)) {
			moved.add(field);
		}
	}

	private void tell(long member, Said said) {
		db.sql("insert into message (to_id, from_id, from_name, subject, body) values (?, null, ?, ?, ?)")
				.params(member, PairWriteApi.THE_LEAGUE, said.subject(), said.body())
				.update();
	}

	private JsonNode read(byte[] sent) {
		try {
			return json.readTree(sent);
		}
		catch (JacksonException cannot) {
			return null;
		}
	}

	private Correction typedFrom(JsonNode sent) {
		try {
			return json.treeToValue(sent, Correction.class);
		}
		catch (JacksonException cannot) {
			/* A field of the right NAME carrying the wrong SORT - `placeId: "Beograd"` - which the
			   tree held and the record cannot. */
			return null;
		}
	}

	private static boolean nothingWasNamed(Correction typed) {
		return typed.firstName() == null && typed.lastName() == null && typed.fatherName() == null
				&& typed.gender() == null && typed.birthDate() == null && typed.idNumber() == null
				&& typed.email() == null && typed.address() == null && typed.phone() == null
				&& typed.placeId() == null && typed.city() == null && typed.country() == null
				&& typed.shirtSize() == null;
	}

	private static String strippedOrNull(String value) {
		return value == null ? null : value.strip();
	}

	private static ResponseEntity<?> notComplete(List<String> which) {
		return ResponseEntity.badRequest()
				.body(new MeWriteApi.NotComplete(MeWriteApi.THE_FORM_IS_NOT_COMPLETE, which));
	}

	private static ResponseEntity<?> conflict(String reason) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(new MeWriteApi.Refused(reason));
	}
}
