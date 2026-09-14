package com.btl.portal.web;

import com.btl.portal.domain.account.BreachedPasswords;
import com.btl.portal.domain.account.PasswordPolicy;
import com.btl.portal.domain.account.StoredPassword;
import com.btl.portal.domain.account.WhatAnAddressLooksLike;
import com.btl.portal.domain.mail.WhatTheMessageSays;
import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.mail.WhatTheMessageSays.Portal;
import com.btl.portal.domain.member.ReferralCode;
import com.btl.portal.domain.registration.Guardianship;
import com.btl.portal.domain.registration.WhatRegistrationAsksFor;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import com.btl.portal.mail.Postman;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * REGISTERING, WHICH IS THE FIRST PATH ON THIS PORTAL THAT WRITES A PERSON DOWN.
 *
 * <p>Before it there were two writing routes and neither made anything: signing in
 * opens a session, signing out ends one. {@code account} held nought rows and no line
 * under {@code backend/src/main} put one there, which V23 measured in as many words
 * on 14.09.2026 - so everything behind the sign in form was unreachable, by anybody,
 * for want of a way to become somebody. This is that way, and the shape it takes is
 * the shape every writing route after it will copy.
 *
 * <p><b>WHAT ONE REGISTRATION MAKES: A ROW IN {@code account} AND A ROW IN
 * {@code competitor}, BOTH OR NEITHER.</b> They are two tables because they are two
 * things - V6 and V7 each say so from their own side - and they are one transaction
 * because a person is not half registered. An account with no competitor behind it is
 * a login belonging to nobody, invisible to every screen and impossible to pay for;
 * a competitor with no account is a person in the register of members who cannot
 * reach the portal and whose address of electronic mail nothing holds. Neither is a
 * state anybody could repair from outside, and neither is a state this route can
 * leave behind: the account is written FIRST, so that the one thing that can
 * legitimately stop a registration - the address being taken - stops it before there
 * is anything to undo, and everything after it is inside the same transaction.
 *
 * <p><b>THE ADDRESS IS NOT CONFIRMED, AND THE ACCOUNT IS THEREFORE NOT A WAY IN.</b>
 * PDL, owner, 31.07.2026: „Potvrda adrese elektronske poste je prva, i uslov za sve
 * ostalo. Dok adresa nije potvrdjena, nema pristupa portalu ni placanja; uputstvo za
 * placanje stize na tu adresu." {@code email_confirmed_at} is left empty here - V6
 * gives the column no default precisely so that an account is born unconfirmed - and
 * {@link com.btl.portal.domain.account.SignIn} refuses such an account in the same
 * breath as one that is locked. The half of that sentence this route carries is that
 * it never fills the column in; the half {@code SignIn} carries is that an empty one
 * is a no. B59 is the increment that fills it, by way of the link in the message.
 *
 * <p><b>AND NO MEMBER NUMBER, WHICH IS A DECISION AND NOT AN OMISSION.</b> PDL, owner
 * of 30.07.2026: „Clanski broj se dodeljuje automatski u trenutku evidentiranja
 * uplate... Ne dodeljuje se pri registraciji", with the consequence spelt out in the
 * same line - „registrovan a neplacen clan nema clanski broj". V16 made the column
 * nullable for exactly this row, and {@code member_number_seq} is not touched here:
 * a sequence moves even when the statement that asked it fails, so drawing a number
 * at registration would burn one for every abandoned form, and PDL of 13.09.2026 says
 * what that costs - the owner's own account has to come out as {@code 000001}. The
 * number is handed out where the payment is recorded, and that is not this increment.
 *
 * <p><b>THE MEMBERSHIP IS NOT ACTIVE EITHER.</b> {@code active} is false, so PDL's
 * „Pre placanja clan sme da otvori nalog, ali nigde nije vidljiv i ne moze nista da
 * radi u sistemu" is true by construction rather than by a rule somebody has to
 * remember: {@link CompetitorApi} serves {@code where c.active}, so a registration
 * puts nobody on the public list of who runs in the league. That was measured before
 * this was written, not argued from the column's name.
 *
 * <p><b>WHAT AN ALREADY REGISTERED ADDRESS IS TOLD, AND WHY IT IS NOT THE SAME
 * ANSWER SIGNING IN GIVES.</b> This is the one place where this route deliberately
 * does the opposite of {@link SignInApi}, and it is the owner's own decision, taken
 * on two offered outcomes with the cost of each written down beside it (ADL,
 * 08.09.2026): „Registracija na vec zauzetu adresu kaze da je zauzeta. Vlasnik je
 * birao izmedju toga i tihog slanja nove veze vlasniku sanduceta, i izabrao izricitu
 * poruku. Cena je izlozena pre izbora i prihvacena: bilo ko time moze da proveri da
 * li je data adresa clan lige, a to je vrsta podatka koju politika privatnosti inace
 * krije." So the answer is 409 and it says {@link #THE_ADDRESS_IS_TAKEN}.
 *
 * <p>The two routes differ because the two questions differ. Signing in is asked a
 * thousand times a day by anybody at all and every answer it gives is a free reading
 * of the register; registering is a thing a person does once, and told nothing he is
 * stuck - he cannot get in, he cannot register, and no screen can say which. The
 * owner weighed exactly that and chose. Should he ever change his mind, the ADL entry
 * says what it costs: „obrnuti oblik je jedan ekran i nijedna migracija", and on this
 * side it is one line - answering 204 here instead of 409, with nothing else moved.
 *
 * <p><b>WHAT IS DELIBERATELY NOT COLLECTED, EACH ONE A BOUNDARY.</b>
 *
 * <ul>
 * <li><b>The photograph.</b> {@link WhatRegistrationAsksFor#OF_EVERYBODY} asks for it
 *     and the owner made it compulsory on 11.08.2026, so it is not optional and this
 *     route does not pretend it is: it is named in {@link #NOT_COLLECTED_YET}, which
 *     is what keeps the omission visible. A picture is a file, and a file is
 *     multipart, a digest, a crop and a name the database issues (ADL A36 O8, A12a) -
 *     none of which exists anywhere under {@code backend/src/main} today, measured
 *     before this was written. {@code competitor.photo_id} is nullable, so the row is
 *     legitimate without one, and a member without a picture is a state the portal has
 *     to be able to draw in any case.
 * <li><b>The day registration opens, which is the one rule here that is NOT
 *     enforced.</b> The owner moved that window on 14.09.2026, on three offered
 *     outcomes, and his decision in his own words is „Prozor se pomera: portal je
 *     vidljiv od 30.09.2026, registracija se otvara 01.10.2026." Nothing in this class
 *     asks what day it is before it writes, and that is written down here rather than
 *     left to be found.
 *     <p>The sentence this replaces is worth naming because it is the shape the lock
 *     must NOT be built to: an earlier decision made 15 to 30 September a period of
 *     insight in which registration could not be begun at all, and it was overturned
 *     on 14.09.2026 for a reason that is about this code - in that window the public
 *     site is still the OLD portal, so a lock written to those dates would have shut
 *     nothing but QA, which is the one installation the owner tests on.
 *     <p>When the lock is written it is its own increment and it needs a switch, so
 *     that the same build can be shut on production and open on QA. The dates above
 *     are cited by their decision and by the words the owner used, and never by a line
 *     number: a journal is appended to and its line numbers move on the next
 *     dictation, while a date and the opening words of a decision are what finds it in
 *     five years. V23 says the same thing about itself.
 * <li><b>The check against false registrations.</b> PDL: „Protiv laznih registracija i
 *     spama ide bot provera na prijavi takmicara." There is none, here or anywhere,
 *     and this route is an anonymous write that costs a full bcrypt and an SMTP round
 *     trip. {@code frontend/nginx.conf} is where signing in got its rate limit, for the
 *     reason written beside it, and this route has no such line - which is its own
 *     increment and is recorded as one rather than done in passing here.
 * </ul>
 *
 * <p><b>THE RULES ARE ASKED OF THE TYPES THAT HOLD THEM, never written again.</b>
 * Which fields are required at which age is {@link WhatRegistrationAsksFor} and
 * {@link Guardianship}; what a password has to be is {@link PasswordPolicy}; how one
 * is kept is {@link StoredPassword}; what the link in the message says is
 * {@link WhatTheMessageSays}; what a token is made of is {@link SecretToken}; which
 * season somebody is joining for is {@link SeasonClock}. This class is the writing,
 * and every rule in it belongs to somebody else.
 */
@RestController
class RegistrationApi {

	/**
	 * Everything the form asks for that could not have come through it.
	 *
	 * <p>ONE ANSWER FOR ALL OF THEM, and that is the decision rather than laziness. The
	 * form is the first copy of every one of these rules and the copy a person actually
	 * meets - {@link WhatRegistrationAsksFor} says in as many words that the rule lives
	 * twice on purpose and that the server's copy is the one that DECIDES. A request
	 * that fails any of them did not come through the form, which means the thing on the
	 * other end is a script; telling a script which of fourteen fields to fix is telling
	 * it how to write a registration that gets through.
	 *
	 * <p>It covers a required field left empty, a value that is not on a closed list the
	 * form offers (a gender, a size of shirt, a relation), a day of birth that is not a
	 * day, a town that is neither one of the codebook's nor one typed with its country,
	 * an identity number that is not letters and digits, an address that is not the shape
	 * the portal stores, two passwords that differ, and a password shorter than
	 * {@link PasswordPolicy#SHORTEST}.
	 */
	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/**
	 * The one rule of the form the member cannot see for himself, so it is the one
	 * refusal told apart.
	 *
	 * <p>{@link PasswordPolicy} says why in the decision that shaped it: three answers
	 * and not a boolean, „because the screen says something different for each: too
	 * short is the member's to fix by typing more, and a leaked one is the member's to
	 * fix by choosing another. Telling him only 'no' makes him try the same thing with a
	 * digit on the end."
	 *
	 * <p><b>Only that one, and the length is not told apart here.</b> The length is a
	 * rule the form carries and can apply as he types; the list of leaked passwords
	 * lives on this server and nowhere else, so this is the only one of the two he could
	 * not have been told before he pressed the button. Saying it gives nothing away -
	 * the lists that circulate are public, and what it says is about the password he has
	 * this second typed, not about anybody's account.
	 */
	static final String THE_PASSWORD_HAS_LEAKED = "thePasswordHasLeaked";

	/** One address is one account (V6), and the owner decided this is said out loud. */
	static final String THE_ADDRESS_IS_TAKEN = "theAddressIsTaken";

	/**
	 * WHAT THE FORM ASKS FOR AND THIS ROUTE DOES NOT COLLECT, named rather than silent.
	 *
	 * <p>A field left out on purpose and a field that went missing look exactly alike
	 * from inside a handler, which is the reason this is a constant and not a sentence.
	 * {@code RegistrationApiTest} asks {@link WhatRegistrationAsksFor} what is required
	 * at both ages and demands that every name be either collected here or on this list,
	 * and that every name on this list really is one the form asks for - so a field
	 * added to the registration tomorrow fails the build until somebody decides, and a
	 * name that stops being asked for cannot sit here excusing nothing.
	 */
	static final Set<String> NOT_COLLECTED_YET = Set.of("photo");

	/** Letters and digits, at most twenty, which is {@code competitor_document_number_shape}. */
	private static final Pattern A_DOCUMENT_NUMBER = Pattern.compile("^[0-9A-Za-z]{1,20}$");

	/** The seven the form offers, which is {@code competitor_shirt_size_known}. */
	private static final Set<String> SHIRT_SIZES =
			Set.of("XS", "S", "M", "L", "XL", "XXL", "XXXL");

	/** The two the form offers, which is {@code competitor_gender_known}. */
	private static final Set<String> GENDERS = Set.of("M", "F");

	private final JdbcClient db;

	private final Postman postman;

	private final Clock clock;

	private final PasswordPolicy passwords;

	private final StoredPassword keeping;

	private final Portal portal;

	/**
	 * @param address where the portal lives, which is what the link in the message hangs
	 *                off. {@link WhatTheMessageSays} says at length why it may never be
	 *                taken off the incoming request: a host is written by whoever sent
	 *                it, so a registration asking for a stranger's address with a host of
	 *                its own would have the portal mail that stranger a link to the
	 *                attacker's machine. This is the single place the address enters, and
	 *                {@link Portal} refuses everything that is not the shape of one - in
	 *                the CONSTRUCTOR, so an installation configured with rubbish does not
	 *                start at all, which is the loudest a mistake can be and the cheapest
	 *                to find. That is the same arrangement {@link Postman} uses for the
	 *                relay's key.
	 */
	RegistrationApi(JdbcClient db, Postman postman, Clock clock,
			@Value("${btl.portal.address}") String address) {

		this.db = db;
		this.postman = postman;
		this.clock = clock;
		this.portal = new Portal(address);

		/* READ ONCE, HERE, AND NOT ON EVERY REGISTRATION. The controller is a singleton,
		   so the list of leaked passwords is opened once at start up; read per request it
		   would be a file opened and parsed while somebody waits. `BreachedPasswords`
		   refuses to load an empty or missing list rather than quietly checking nothing,
		   so an installation whose resource went astray fails to start instead of
		   accepting every leaked password in the world. */
		this.passwords = new PasswordPolicy(BreachedPasswords.fromResource());
		this.keeping = new StoredPassword();
	}

	/**
	 * What the form sends.
	 *
	 * <p><b>The day of birth arrives as text and is parsed here</b>, rather than as a
	 * {@code LocalDate} Jackson would parse on the way in. Left to Jackson, a day that is
	 * not a day comes back as Spring's own 400 with Spring's own body, which is a second
	 * shape of refusal for this route to have - and the one shape somebody writing the
	 * screen would not have been told about. Parsed here it is
	 * {@link #THE_FORM_IS_NOT_COMPLETE} like every other thing the form should have
	 * caught.
	 *
	 * <p><b>The town is three fields and exactly one arrangement of them is a town.</b>
	 * PDL, owner of 11.08.2026: „Mesto se bira iz svetskog sifarnika i tada nosi svoju
	 * drzavu, koja se ne menja; drzava se bira samo uz mesto upisano rukom." That is
	 * {@code competitor_town_is_from_the_codebook_or_typed} and
	 * {@code competitor_typed_town_names_its_country} in the schema, and it is one
	 * control on the form. {@code placeId} is the number {@code /api/places} serves,
	 * which is GeoNames' own and NOT {@code place.id} - the portal has never seen the
	 * latter and must not start to.
	 *
	 * @param country the two letter code {@code /api/countries} serves, with a town typed
	 *                by hand and never with one from the codebook
	 * @param phone   optional, and the only optional field of the thirteen V8 added. It
	 *                is collected „po pristanku" - the decision of 11.08.2026 that took
	 *                it off the portal was itself overturned on 20.08.2026 and the form
	 *                has carried it ever since
	 * @param bio     optional too. It was compulsory in the form by mistake and
	 *                registration was refused without it, which collided with the
	 *                portal's own privacy policy; corrected 12.08.2026, and PDL says in
	 *                as many words that „prijava prolazi i bez njega"
	 */
	record Typed(String firstName, String lastName, String fatherName, String birthDate,
			String gender, Boolean firstSeason2027, String email, String password,
			String passwordRepeat, String address, Long placeId, String city, String country,
			String idNumber, String phone, String shirtSize, String bio, Boolean healthStatement,
			String parentConsent, String parentRelation) {
	}

	/** Why a registration was refused, and never which field. */
	record Refused(String reason) {
	}

	/** A town, once it is one: the codebook's row, or a name typed with its country. */
	private record Town(Long placeId, String city, Long countryId) {
	}

	@PostMapping("/api/registration")
	@Transactional
	ResponseEntity<Refused> register(@RequestBody Typed typed, HttpServletRequest asking) {
		/* No check for the whole form being absent, for the reason `SignInApi` gives at
		   the same point: `@RequestBody` is required, so a request with no body is turned
		   away with 400 before this method runs. `aRequestWithNoFormAtAllNeverReachesUs`
		   is what holds that guarantee. */
		LocalDate today = LocalDate.ofInstant(clock.instant(), SeasonClock.ZONE);
		LocalDate born = theDay(typed.birthDate(), today);

		if (born == null) {
			return no(THE_FORM_IS_NOT_COMPLETE);
		}

		/* THE TOWN IS RESOLVED BEFORE ANYTHING IS ASKED ABOUT IT, because "is there a
		   town" is a question about the codebook and not about the form: a number nothing
		   maps and a name with no country are both "no town", and both have to be refused
		   before the INSERT rather than by it. */
		Town town = theTown(typed);
		String address = WhatAnAddressLooksLike.withoutTheSpacesAround(
				typed.email() == null ? "" : typed.email());

		/* WHICH FIELDS THIS PERSON HAS TO HAVE FILLED IN, ASKED OF THE TYPE THAT DECIDES
		   IT rather than listed here. `WhatRegistrationAsksFor` moves the identity card
		   and the parent's signature across the same boundary in opposite directions, and
		   `Guardianship` is where that boundary is; a list written out here would be a
		   second copy of both, free to disagree with the form. */
		Set<String> asked = WhatRegistrationAsksFor.from(born, today);
		Map<String, String> filledIn = whatHeFilledIn(typed, town, address);

		for (String field : asked) {
			if (!NOT_COLLECTED_YET.contains(field) && isNothing(filledIn.get(field))) {
				return no(THE_FORM_IS_NOT_COMPLETE);
			}
		}

		/* AND A DOCUMENT NUMBER THAT IS NOT ONE IS REFUSED AT EVERY AGE, which the loop
		   above cannot say. `WhatRegistrationAsksFor` stops asking a child under sixteen
		   for one, because a card is issued at sixteen and asking for its number earlier is
		   asking for something that does not exist - so for him the name is not in `asked`
		   and nothing above looks at it. Sent one anyway, and it would go into
		   `competitor_document` unlooked at, where `competitor_document_number_shape` would
		   refuse it as an error in the middle of a transaction rather than as an answer to
		   the person. Asked here, both ages get the same refusal. */
		if (!isNothing(typed.idNumber()) && theDocument(typed) == null) {
			return no(THE_FORM_IS_NOT_COMPLETE);
		}

		if (!typed.password().equals(typed.passwordRepeat())) {
			return no(THE_FORM_IS_NOT_COMPLETE);
		}

		/* THE ONE REFUSAL TOLD APART, and the constant above says why it is this one and
		   not the length beside it. */
		return switch (passwords.judge(typed.password())) {
			case BREACHED -> no(THE_PASSWORD_HAS_LEAKED);
			case TOO_SHORT -> no(THE_FORM_IS_NOT_COMPLETE);
			case FINE -> write(typed, born, town, address, today, asking);
		};
	}

	/**
	 * THE WRITING, AND IT IS ONE TRANSACTION FROM THE FIRST ROW TO THE MESSAGE.
	 *
	 * <p><b>The account is written first and the address is decided by the unique index
	 * rather than by a question asked beforehand.</b> {@code select ... where email = ?}
	 * followed by {@code insert} is two moments, and between them a second registration
	 * at the same address fits: both read nothing, both insert, and the second one fails
	 * on {@code account_email_unique} with an error the request cannot recover from,
	 * because PostgreSQL aborts a transaction on any error at all. {@code on conflict do
	 * nothing} is the same question asked ONCE, by the index itself: either a row comes
	 * back or the address was taken, nothing is written either way, and the transaction
	 * is untouched and still usable.
	 *
	 * <p><b>Which is also why this order and not the other.</b> Written after the
	 * competitor, a taken address would leave a competitor already inserted and the
	 * handler would have to undo it - and the only honest way to undo work inside a
	 * transaction is to roll the whole thing back, which cannot be done while still
	 * answering 409 with a body. Written first, the one refusal that can arrive this late
	 * arrives before anything exists.
	 *
	 * <p><b>And the message goes out INSIDE the transaction, which is the deliberate half
	 * of a choice with two bad halves.</b> Sent after the commit, a relay that is down
	 * leaves a person holding an account he can neither confirm nor sign in to, whose
	 * address is now taken, so registering again is refused and no screen can help him -
	 * an end from which nothing but the owner's hand recovers. Sent inside, a relay that
	 * is down throws, everything rolls back, nothing is taken and he tries again in a
	 * minute. What it costs is the other direction: a message that leaves and a commit
	 * that then fails is a link to a token nobody holds, and that costs him one more
	 * registration. {@link Postman} throws rather than swallowing precisely so that
	 * whoever asked can make this choice, and this is the choice.
	 */
	private ResponseEntity<Refused> write(Typed typed, LocalDate born, Town town, String address,
			LocalDate today, HttpServletRequest asking) {

		Optional<Long> account = db.sql("insert into account"
						+ " (first_name, last_name, email, role_id, password_hash)"
						/* `competitor` and not `visitor`: the front end's own roles say
						   „'registered but unpaid' is a state of a competitor, not a role"
						   (frontend/src/roles/context.ts). Both hold `rights_mode = 'none'`
						   in V5, so nothing about permission turns on the choice; what turns
						   on it is what `/api/me` calls him.

						   AND THE ROLE IS WRITTEN HERE, NEVER TAKEN OFF THE REQUEST. `Typed`
						   carries no role and must never be given one: a form that could name
						   its own role would be a form anybody could register a superadmin
						   with. The owner settled on 14.09.2026 how that account is made
						   instead - it is named by its address of electronic mail in
						   `deploy/.env`, and the account carrying that address takes the role
						   once its address is confirmed - which is its own increment and is
						   nothing this route does. */
						+ " values (?, ?, ?, (select id from role where code = 'competitor'), ?)"
						/* AND `email_confirmed_at` IS NOT IN THAT LIST. V6 gives the column no
						   default so that an account is born unconfirmed, and being born is
						   not being confirmed. */
						+ " on conflict ((lower(email))) do nothing"
						+ " returning id")
				.params(typed.firstName().strip(), typed.lastName().strip(), address,
						keeping.of(typed.password()))
				.query(Long.class)
				.optional();

		if (account.isEmpty()) {
			return ResponseEntity.status(409).body(new Refused(THE_ADDRESS_IS_TAKEN));
		}

		Timestamp now = Timestamp.from(clock.instant());
		long competitor = db.sql("insert into competitor"
						+ " (first_name, last_name, gender, place_id, city, country_id,"
						+ "  first_season, first_season_2027, active, membership_basis,"
						+ "  referral_code, bio, profile_hidden, birth_date, father_name,"
						+ "  address, phone, shirt_size, health_statement_at)"
						/* `member_number` IS NOT WRITTEN AND `member_number_seq` IS NOT ASKED.
						   `active` is false and `membership_basis` is 'payment': the basis says
						   HOW this membership will be held, and 'feeExempt' is honorary
						   membership, which is the owner's to grant and not a thing a form can
						   claim. `profile_hidden` is false because hiding a profile is the
						   member's own later choice, and `birthday_shown` is left out
						   altogether so that V7's default - none unless he chooses otherwise,
						   which is what the privacy policy and article 74 already say - is what
						   decides it. */
						+ " values (?, ?, ?, ?, ?, ?, ?, ?, false, 'payment', ?, ?, false, ?, ?,"
						+ "  ?, ?, ?, ?)"
						+ " returning id")
				.params(typed.firstName().strip(), typed.lastName().strip(), typed.gender(),
						town.placeId(), town.city(), town.countryId(),
						SeasonClock.seasonBeingPaidFor(ZonedDateTime.now(clock)),
						typed.firstSeason2027(), ReferralCode.fresh().written(), theBio(typed),
						java.sql.Date.valueOf(born), typed.fatherName().strip(),
						typed.address().strip(), thePhone(typed), typed.shirtSize(), now)
				.query(Long.class)
				.single();

		/* THE LINK IS WRITTEN ON THE ACCOUNT AND IN ONE DIRECTION ONLY, which is V23's
		   decision of 14.09.2026 and its reason: „Jedan nalog je tacno jedan clan", with
		   the pointer on the side that is created first and lives longest. Nothing points
		   back, because a second home for one fact is free to disagree with the first. */
		db.sql("update account set competitor_id = ? where id = ?")
				.params(competitor, account.orElseThrow()).update();

		String document = theDocument(typed);

		if (document != null) {
			/* IN ITS OWN TABLE AND NOT ON THE MEMBER. ADL A12 and A41: the number of the
			   identity document is the most sensitive item in the register and the
			   competition needs it for nothing at all, so it must not sit in the table the
			   portal's screens read. Written here for anybody who sent one, which is
			   everybody of sixteen and over; a child under sixteen has no card to have a
			   number from, which is why `WhatRegistrationAsksFor` stops asking. */
			db.sql("insert into competitor_document (competitor_id, document_number)"
							+ " values (?, ?)")
					.params(competitor, document).update();
		}

		if (Guardianship.accountIsHeldByAGuardian(born, today)) {
			/* FOUR THINGS AND NOT ONE, and V8 says none of the four is decoration: „the
			   name and surname, the relation from a fixed list, the date and time, and the
			   address it was given from. ... together they are the evidence that it was
			   given, which is what the policy promises to keep."

			   THE ADDRESS IS THE ONE THIS SERVER SAW, and what that is behind the portal's
			   own nginx is written down here rather than left to be discovered: nginx works
			   the visitor's address out for itself (`real_ip_header`, `frontend/nginx.conf`)
			   and passes it on in `X-Forwarded-For`, but this application trusts no proxy
			   header - `server.forward-headers-strategy` is not set anywhere - so what
			   arrives here is the address of the proxy. Making it the visitor's is a change
			   to how EVERY request on this server is seen and is a security decision of its
			   own; until it is taken, this column holds what the server saw, which is the
			   only thing it can honestly hold. */
			db.sql("insert into parental_consent"
							+ " (competitor_id, guardian_name, relation, given_at, given_from)"
							+ " values (?, ?, ?, ?, cast(? as inet))")
					.params(competitor, typed.parentConsent().strip(),
							Guardianship.Relation.named(typed.parentRelation()).code(), now,
							asking.getRemoteAddr())
					.update();
		}

		sendTheLink(account.orElseThrow());

		return ResponseEntity.noContent().build();
	}

	/**
	 * THE MESSAGE THAT MAKES THE ADDRESS WORTH ANYTHING, and it goes to the address in the
	 * ROW.
	 *
	 * <p><b>Read back rather than carried along, and that is not ceremony.</b> What was
	 * typed and what was stored are two values, and this route makes them differ on
	 * purpose: the address is stripped of the spaces around it on the way in. Sent to what
	 * was typed, a member who pasted his address with a trailing space would get a message
	 * at an address that is not the one his account carries - and every later message, sent
	 * from the row like this one, would go somewhere else. Reading the row is also what
	 * makes the account the message is about unambiguous: it is the row that was just
	 * written, by its own key, and not "an account with this address".
	 *
	 * <p><b>The link carries a secret the database never holds.</b> {@link SecretToken}
	 * draws 256 bits and stores what they hash to, for the reason V6 gives: a column holding
	 * the token as it appears in the link is a column of ready made keys, and a backup, a
	 * dump or a line in a log opens every account that has an unspent one. How long it lasts
	 * is not written here either - {@code expires_at} carries V6's default of twenty four
	 * hours, which is the owner's decision of 08.09.2026 and the number
	 * {@code HowLongALinkLastsMatchesTheSchemaTest} ties the message's own wording to.
	 */
	private void sendTheLink(long account) {
		SecretToken link = SecretToken.fresh();

		db.sql("insert into email_verification_token (account_id, token_hash) values (?, ?)")
				.params(account, link.hash()).update();

		String stored = db.sql("select email from account where id = ?")
				.param(account).query(String.class).single();

		postman.send(WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, portal, link.secret()),
				stored);
	}

	/**
	 * Every field the form asks for, under the name {@link WhatRegistrationAsksFor} knows
	 * it by, and empty when this request does not carry it.
	 *
	 * <p><b>The names are the domain's and not this file's</b>, so a field added to the
	 * registration tomorrow is one this map does not answer for - and a name nothing
	 * answers for reads as empty, so every registration is refused until somebody collects
	 * it. Loud in the right direction: the alternative is a required field this route
	 * silently ignores.
	 *
	 * <p>The three that are not text answer with a word when they are there and with
	 * nothing when they are not, so that one loop can ask the same question of all of them:
	 * a category nobody chose, a town that is not one, and a health statement left unticked
	 * are each a field not filled in.
	 */
	private Map<String, String> whatHeFilledIn(Typed typed, Town town, String address) {
		Map<String, String> filledIn = new LinkedHashMap<>();

		filledIn.put("firstName", typed.firstName());
		filledIn.put("lastName", typed.lastName());
		filledIn.put("fatherName", typed.fatherName());
		filledIn.put("birthDate", typed.birthDate());
		filledIn.put("gender", chosenFrom(GENDERS, typed.gender()));
		filledIn.put("firstSeason2027", typed.firstSeason2027() == null ? null : "izabrano");
		filledIn.put("email", WhatAnAddressLooksLike.itDoes(address) ? address : null);
		filledIn.put("password", typed.password());
		filledIn.put("passwordRepeat", typed.passwordRepeat());
		filledIn.put("address", typed.address());
		filledIn.put("city", town == null ? null : "izabrano");
		filledIn.put("shirtSize", chosenFrom(SHIRT_SIZES, typed.shirtSize()));
		filledIn.put("healthStatement", Boolean.TRUE.equals(typed.healthStatement()) ? "da" : null);
		filledIn.put("idNumber", theDocument(typed));
		filledIn.put("parentConsent", typed.parentConsent());
		filledIn.put("parentRelation", theRelation(typed));

		return filledIn;
	}

	/**
	 * The day somebody was born, or nothing when what arrived is not a day.
	 *
	 * <p><b>A day in the future is not one either</b>, and it is refused here rather than
	 * left to {@link Guardianship}: that class throws for a date after the day it is asked
	 * about, in as many words - „nobody is a given age before he is born" - and a request
	 * carrying tomorrow would otherwise be a 500 rather than a form the portal will not
	 * take. Today itself is allowed: a registration for somebody born this morning is
	 * nonsense a person will notice and is not a shape the server has to have an opinion
	 * about.
	 */
	private static LocalDate theDay(String written, LocalDate today) {
		if (written == null) {
			return null;
		}

		try {
			LocalDate born = LocalDate.parse(written.strip());

			return born.isAfter(today) ? null : born;
		} catch (DateTimeException notADay) {
			return null;
		}
	}

	/**
	 * The town, or nothing when what arrived is not one.
	 *
	 * <p>Exactly one of the two shapes, which is the schema's own pair of checks read as a
	 * question instead of as a refusal: a row of the codebook, whose country is the
	 * codebook's and is not asked for, or a name typed by hand with the country of whoever
	 * typed it. A number nothing maps and a country code nothing maps are both no town,
	 * because a foreign key that cannot be resolved would otherwise be an error inside the
	 * INSERT rather than an answer to the person.
	 */
	private Town theTown(Typed typed) {
		boolean fromTheCodebook = typed.placeId() != null;
		boolean typedByHand = !isNothing(typed.city()) && !isNothing(typed.country());

		if (fromTheCodebook == typedByHand) {
			return null;
		}

		if (fromTheCodebook) {
			/* AND THE COUNTRY IS NOT TAKEN FROM THE REQUEST, which is the owner's decision
			   of 11.08.2026: a town of the codebook „nosi svoju drzavu, koja se ne menja".
			   Accepting one alongside would be the portal letting somebody put Belgrade in
			   France. The schema says the same thing as
			   `competitor_typed_town_names_its_country`. */
			if (!isNothing(typed.city()) || !isNothing(typed.country())) {
				return null;
			}

			return db.sql("select id from place where geonames_id = ?")
					.param(typed.placeId()).query(Long.class).optional()
					.map(one -> new Town(one, null, null)).orElse(null);
		}

		return db.sql("select id from country where code = ?")
				.param(typed.country().strip()).query(Long.class).optional()
				.map(one -> new Town(null, typed.city().strip(), one)).orElse(null);
	}

	/**
	 * The value when it is one of the ones the form offers, and nothing otherwise.
	 *
	 * <p><b>The null is tested here and not left to the set</b>, and that is a fault this
	 * route had until it was measured: {@code Set.of(...)} is an immutable set, and
	 * immutable sets throw {@link NullPointerException} when they are ASKED whether they
	 * hold null - they do not answer false. So a form that left the gender out altogether
	 * came back a 500 instead of "the form is not complete", and only because a case took
	 * every field away one at a time did it show. A field left out and a field carrying a
	 * value nobody could have chosen are the same answer here, which is the whole reason
	 * this returns the value or nothing rather than a boolean.
	 */
	private static String chosenFrom(Set<String> offered, String value) {
		return value != null && offered.contains(value) ? value : null;
	}

	/** The identity number when it is one, and nothing when it is not. */
	private static String theDocument(Typed typed) {
		if (isNothing(typed.idNumber())) {
			return null;
		}

		String written = typed.idNumber().strip();

		return A_DOCUMENT_NUMBER.matcher(written).matches() ? written : null;
	}

	/**
	 * The relation when it is one the form offers, and nothing otherwise.
	 *
	 * <p><b>The enum is read rather than its three values written out here.</b>
	 * {@link Guardianship.Relation} is the list, {@code parental_consent_relation_known}
	 * is the same list in SQL, and {@code GuardianshipMatchesTheSchemaTest} is what keeps
	 * those two from drifting; a third copy in this file would be a list nothing holds to
	 * the other two, and a fourth relation added tomorrow would be one this route went on
	 * refusing.
	 */
	private static String theRelation(Typed typed) {
		for (Guardianship.Relation relation : Guardianship.Relation.values()) {
			if (relation.code().equals(typed.parentRelation())) {
				return relation.code();
			}
		}

		return null;
	}

	/**
	 * The biography, which is never null in the row and may be empty.
	 *
	 * <p>V7: „`bio` is NOT NULL and may be empty, and that is the difference between it
	 * and a name: twenty of the thirty two members in the shipped data have written none,
	 * and an empty biography is a state the profile has to look right in."
	 */
	private static String theBio(Typed typed) {
		return isNothing(typed.bio()) ? "" : typed.bio().strip();
	}

	/**
	 * The telephone number, which is null when there is none and never an empty string.
	 *
	 * <p>V8, beside the column: „Optional, and the only optional field of the thirteen, so
	 * an empty string would be a second way of saying the same absence. There is one way:
	 * no phone is NULL." {@code competitor_phone_not_blank} is what refuses the other.
	 */
	private static String thePhone(Typed typed) {
		return isNothing(typed.phone()) ? null : typed.phone().strip();
	}

	/**
	 * Whether a field was filled in at all.
	 *
	 * <p>Absent, empty, and a run of spaces are one answer and not three: JSON has a null,
	 * a form has an empty box, and a person has a space bar, and a guard written against
	 * one of the three lets the other two through to a column whose {@code btrim(...) <> ''}
	 * would then refuse them as an error. That is the same list of shapes
	 * {@code SignInApiTest.aFormWithNothingInItIsRefusedBeforeAnythingIsCompared} keeps.
	 */
	private static boolean isNothing(String value) {
		return value == null || value.isBlank();
	}

	private static ResponseEntity<Refused> no(String reason) {
		return ResponseEntity.badRequest().body(new Refused(reason));
	}
}
