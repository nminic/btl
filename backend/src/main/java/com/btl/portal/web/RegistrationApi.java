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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.MailException;
import org.springframework.transaction.support.TransactionTemplate;
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
 * is anything to undo, and every row after it is inside the same transaction. The
 * MESSAGE is not, and {@link #writeThenSend} is where that boundary is drawn and what
 * it was measured to cost when it was drawn the other way.
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
 *     is what keeps the omission visible. A picture is a file (ADL A36 O8, A12a), and
 *     what is missing under {@code backend/src/main} is the half that RECEIVES one: no
 *     signature under {@code backend/src/main/java} carries a {@code MultipartFile} or a
 *     {@code @RequestPart}, so nothing here is written to be handed a file. <b>That is
 *     read off the signatures, and it is deliberately NOT widened into „a file could not
 *     arrive", which would be a claim about every road into a handler and is not what was
 *     counted here.</b> Three routes do take the {@code HttpServletRequest} itself and read
 *     the whole body - {@link InboxWriteApi}, {@link MeWriteApi} and
 *     {@link NotificationWriteApi} - and what keeps a {@code multipart/form-data} body
 *     from reaching them is the {@code consumes = MediaType.APPLICATION_JSON_VALUE} each
 *     of those three declares, which {@link InboxWriteApi} measured and wrote up beside
 *     its own mapping („{@code consumes} goes on refusing before anything is dispatched").
 *     <b>The three things this
 *     sentence used to deny alongside it are no longer missing, so it is reversed here
 *     rather than left for a reader to trip over.</b> {@link PhotoApi} finds a row by
 *     {@code photo.digest} and opens its file under {@code String.valueOf} of that row's
 *     key (20.09.2026, ADL A60), and {@link TeamApi} answers a digest beside the three
 *     fractions of a crop (21.09.2026): the digest, the crop and the name the database
 *     issues are all read under {@code backend/src/main} today.
 *     {@code competitor.photo_id} is nullable, so the row is
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
 *     spama ide bot provera na prijavi takmicara." There is none, here or anywhere, and
 *     this route is an anonymous write that costs a full bcrypt and an SMTP round trip.
 *     What it does now have is a rate limit: {@code frontend/nginx.conf} gives
 *     {@code /api/registration} its own {@code limit_req}, in the shape signing in
 *     already had eight lines above it and for the same reason. A limit is not the bot
 *     check and does not pretend to be one - it slows a machine down, it does not tell
 *     one from a person - so the sentence above stays open and stays its own increment.
 * <li><b>THE PERSON WHOSE MESSAGE NEVER WENT OUT.</b> Since the message is sent after
 *     the commit (see {@link #write}), a relay that is down leaves a real account, a
 *     real member and a real token, and answers 204. He is told to look in his unwanted
 *     mail and sees nothing, because nothing was sent - and this route cannot tell him
 *     so, because by the time it knows, the answer is already true: he IS registered.
 *     <p><b>What gets him out is asking for the link again, and that is B59.</b> The
 *     screen after registering has carried the control since PDL of 29.07.2026 - „plus
 *     dugme za ponovno slanje potvrde" - and it does nothing yet; the token is already
 *     in {@code email_verification_token} for it to act on. Until B59 writes it, the way
 *     out is the owner's own hand, and that is the cost of this arrangement, named here
 *     rather than discovered by the first member it happens to.
 *     <p><b>What is NOT the cost is the thing this replaced.</b> Sent inside the
 *     transaction, the same relay left him with nothing, which reads kinder and is
 *     worse: no account, no token, nothing to resend, and one connection to the database
 *     held for the whole five seconds the relay took to not answer - measured at 5,15 s
 *     a request, ten of them enough to take every connection in the pool, and 202 other
 *     people's requests answered 500 during one such minute. A person waiting for a
 *     letter is a person the portal can still help; a portal with no connections left
 *     helps nobody at all.
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
	 * The one thing on this server that writes a line to a file, and it writes exactly
	 * one: a confirmation message the relay would not take.
	 *
	 * <p>Nothing else under {@code backend/src/main} logs anything, which is deliberate
	 * and stays that way - a portal that logs what it does is a portal whose disk holds
	 * what its members did. This is the single place where something fails, nobody is
	 * told, and the failure would otherwise leave no trace at all.
	 */
	private static final Logger LOG = LoggerFactory.getLogger(RegistrationApi.class);

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

	/**
	 * THE TRANSACTION, ASKED FOR BY HAND RATHER THAN PUT ON THE METHOD.
	 *
	 * <p>{@code @Transactional} on {@link #register} would make the whole request one
	 * transaction, and the message goes out AFTER it - which is the whole of the fix
	 * {@link #write} describes. Written by hand, the boundary is a pair of braces
	 * somebody has to open and close on purpose, and what is outside them is outside
	 * them visibly, in the same method, rather than by the absence of an annotation.
	 */
	private final TransactionTemplate inOneTransaction;

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
			TransactionTemplate inOneTransaction,
			@Value("${btl.portal.address}") String address) {

		this.db = db;
		this.postman = postman;
		this.clock = clock;
		this.inOneTransaction = inOneTransaction;
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
	 * @param referredBy who brought this member, which is the ONE field here that does
	 *                not come from the form at all. {@code Registration.tsx} reads it out
	 *                of the address the visitor arrived by ({@code ?preporuka=}), which
	 *                is why {@link WhatRegistrationAsksFor} has never heard of it and why
	 *                the floor that holds every other field to being collected does not
	 *                reach it - measured, and it is the reason this arrived late. Over
	 *                the wire it is the CODE, sixteen lowercase hexadecimal characters;
	 *                in the row it is a key, which is V7's own distinction: „the code is
	 *                the public half and lives in its own column; who it belongs to is a
	 *                row, and a row is what a foreign key points at"
	 */
	record Typed(String firstName, String lastName, String fatherName, String birthDate,
			String gender, Boolean firstSeason2027, String email, String password,
			String passwordRepeat, String address, Long placeId, String city, String country,
			String idNumber, String phone, String shirtSize, String bio, Boolean healthStatement,
			String parentConsent, String parentRelation, String referredBy) {
	}

	/** Why a registration was refused, and never which field. */
	record Refused(String reason) {
	}

	/** A town, once it is one: the codebook's row, or a name typed with its country. */
	private record Town(Long placeId, String city, Long countryId) {
	}

	@PostMapping("/api/registration")
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
		/* AS THE ROW WILL CARRY IT, which is folded and not merely stripped.
		   `WhatAnAddressLooksLike.asItIsStored` says at length why, and what it cost
		   while it was only stripped: signing in looked for the address literally, so
		   `Novi.Clan@primer.rs` registered and `novi.clan@primer.rs` typed back was 401,
		   and registering again was 409. The fold is judged by `itDoes` below, like every
		   other address, so nothing reaches a column that the shape would refuse. */
		String address = WhatAnAddressLooksLike.asItIsStored(
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
			case FINE -> writeThenSend(typed, born, town, address, today, asking);
		};
	}

	/**
	 * THE TWO HALVES, IN THIS ORDER, AND THE ORDER IS THE WHOLE OF IT: everything that
	 * touches the database inside one transaction, and the message to the relay after it
	 * has committed.
	 *
	 * <p><b>What the other order cost, measured against a real relay on 14.09.2026.</b>
	 * Sent inside, one registration held ONE CONNECTION OF THE POOL for 5,15 seconds
	 * while the relay did not answer - not because the portal was busy, but because it
	 * was waiting for somebody else's machine with a transaction open. The pool is
	 * HikariCP's default of ten. Ten such requests take all ten; at twenty, three
	 * unrelated routes ({@code /api/competitors}, {@code /api/sign-in},
	 * {@code /api/places}) were blocked about 4,4 seconds each; and a steady twelve
	 * requests every two seconds answered a member's legitimate sign in with HTTP 500
	 * after 30,02 seconds, the server saying {@code Connection is not available, request
	 * timed out after 30011ms (total=10, active=10, idle=0, waiting=147)}. 202 other
	 * people's requests were answered with a hard error during that one test. The
	 * attacker is anybody on the network, signed in to nothing, and the precondition is
	 * not an attack at all - it is a slow relay, which is an ordinary Tuesday for
	 * somebody else's SMTP service.
	 *
	 * <p><b>And it is the arrangement ADL O14 already decided for the other route that
	 * does this.</b> The transactional boundaries of verifying a result: „U transakciji
	 * su rezultat, trka i dogadjaj ako nastaju, i dodela dukata. Van nje su obavestenje i
	 * sve sto ide spolja." Registering is the same sentence with different rows. The
	 * portal had one place that wrote it down and one place that did the opposite; this
	 * makes them agree.
	 *
	 * <p><b>What the author's arrangement was protecting is kept, and it is worth saying
	 * exactly what it is.</b> A person must never end up holding an address that is taken
	 * and an account that is no use - and that is still true, by a different road: the
	 * token is written in the same transaction as the account, so the account he holds is
	 * one a resend can rescue. What is given up is the other direction, and it is small:
	 * a message that goes out for a registration whose commit then fails cannot happen
	 * here, because the commit happens FIRST.
	 *
	 * @return what the answer is, and what is left to be sent
	 */
	private ResponseEntity<Refused> writeThenSend(Typed typed, LocalDate born, Town town,
			String address, LocalDate today, HttpServletRequest asking) {

		Made made = inOneTransaction.execute(
				committing -> write(typed, born, town, address, today, asking));

		if (made.link() != null) {
			send(made);
		}

		return made.answer();
	}

	/**
	 * THE MESSAGE, SENT AFTER THE COMMIT AND THEREFORE UNABLE TO UNDO IT.
	 *
	 * <p><b>A relay that does not take it is not an error the person can act on, so he is
	 * not told about one.</b> He has an account, he has a member, and he has a token; the
	 * only thing missing is a letter, and nothing he can do at this screen produces one.
	 * Answering 500 would say the opposite of what is true - „nothing happened" - to
	 * somebody for whom everything happened, and would send him to register again at an
	 * address that would now answer 409.
	 *
	 * <p><b>{@link Postman} throws rather than swallowing precisely so that this decision
	 * is taken here</b>, by the route that knows what a member should see, and it is a
	 * different answer for a confirmation link than it would be for a reminder. This is
	 * that answer. The boundary it leaves - a person waiting for a letter that is not
	 * coming, and B59 being what gets him out - is written out in the class's own list of
	 * boundaries rather than left here as a shrug.
	 *
	 * <p><b>What is logged is the account and never the address.</b> An address of
	 * electronic mail is a personal datum and a log is read by whoever can read the disk;
	 * the number is enough to find the row, and ADL A12 is why it is not the address.
	 */
	private void send(Made made) {
		try {
			postman.send(
					WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, portal, made.link()),
					made.address());
		} catch (MailException theRelayDidNotTakeIt) {
			LOG.warn("the confirmation message for account {} did not go out, so nobody has"
					+ " told him his address; the token is written and asking for the link"
					+ " again is what gets him out of it (B59)",
					made.account(), theRelayDidNotTakeIt);
		}
	}

	/**
	 * THE WRITING, AND IT IS ONE TRANSACTION FROM THE FIRST ROW TO THE LAST - WHICH IS
	 * THE TOKEN, AND NOT THE MESSAGE.
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
	 * <p><b>And NOTHING HERE SPEAKS TO THE OUTSIDE WORLD.</b> ~~The message goes out
	 * inside the transaction~~ was the shape until 14.09.2026, on the reasoning that a
	 * relay which is down should roll the whole registration back rather than leave a
	 * person with an account he cannot use. The reasoning was right about the person and
	 * wrong about the price: a request that waits on somebody else's SMTP server with a
	 * transaction open holds a connection of a pool of ten, and {@link #writeThenSend}
	 * carries what that was measured to do to everybody else. What this method builds
	 * instead is {@link Made} - the answer, and what the message will need - and the
	 * sending happens after the commit.
	 */
	private Made write(Typed typed, LocalDate born, Town town, String address,
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
						   once its address is confirmed.

						   THAT IS NOW WRITTEN, and it is still nothing this route does:
						   `TheNamedSuperadmin` answers it and `WhoIsAsking` asks it once per
						   request, off the settings, so no row anywhere - this one included -
						   ever carries the superadmin's role. What this statement writes stays
						   `competitor` for him too, and that is not a gap: the role he holds
						   is not in the row at all. */
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
			return new Made(ResponseEntity.status(409).body(new Refused(THE_ADDRESS_IS_TAKEN)),
					0, null, null);
		}

		Timestamp now = Timestamp.from(clock.instant());
		long competitor = db.sql("insert into competitor"
						+ " (first_name, last_name, gender, place_id, city, country_id,"
						+ "  first_season, first_season_2027, active, membership_basis,"
						+ "  referral_code, referred_by, bio, profile_hidden, birth_date,"
						+ "  father_name, address, phone, shirt_size, health_statement_at)"
						/* `member_number` IS NOT WRITTEN AND `member_number_seq` IS NOT ASKED.
						   `active` is false and `membership_basis` is 'payment': the basis says
						   HOW this membership will be held, and 'feeExempt' is honorary
						   membership, which is the owner's to grant and not a thing a form can
						   claim. `profile_hidden` is false because hiding a profile is the
						   member's own later choice, and `birthday_shown` is left out
						   altogether so that V7's default - none unless he chooses otherwise,
						   which is what the privacy policy and article 74 already say - is what
						   decides it.

						   `referred_by` IS A KEY THIS ROUTE LOOKED UP, never the code that
						   arrived. `whoBrought` is where the looking up is, and why an
						   unknown code is not a refusal. */
						+ " values (?, ?, ?, ?, ?, ?, ?, ?, false, 'payment', ?, ?, ?, false, ?,"
						+ "  ?, ?, ?, ?, ?)"
						+ " returning id")
				.params(typed.firstName().strip(), typed.lastName().strip(), typed.gender(),
						town.placeId(), town.city(), town.countryId(),
						SeasonClock.seasonBeingPaidFor(ZonedDateTime.now(clock)),
						typed.firstSeason2027(), ReferralCode.fresh().written(),
						whoBrought(typed), theBio(typed),
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

		return theLinkToSend(account.orElseThrow());
	}

	/**
	 * WHO BROUGHT THIS MEMBER, as a key, or nothing when the answer is nothing.
	 *
	 * <p><b>An unknown code is not a refusal, and that is the decision here.</b> Three
	 * things arrive at this line and only one of them is a referral: a code somebody
	 * really holds, a code that is the right shape and belongs to nobody, and rubbish. The
	 * last two are one answer - no credit - because the query answers them with one
	 * answer, and that is honest as well as short: „who does this belong to" has no row.
	 *
	 * <p><b>Refusing the registration instead would be the loud shape, and it is the
	 * wrong one for two separate reasons.</b> The first is the person: a link that lost
	 * its code on the way through somebody's chat application is not his fault, and being
	 * told his registration is incomplete over it is a door shut for nothing. The second
	 * is the code: it is a secret of the kind ADL of 13.08.2026 decided must be handed
	 * out and never derived, „jer bi svako mogao da sastavi tudji link" - and a route that
	 * answered differently for a code that exists would be a machine for finding out
	 * which codes exist, one anonymous request at a time.
	 *
	 * <p><b>What is NOT checked here, and why there is nothing to check.</b> That the
	 * code is not this member's own: his own is drawn one statement later and has never
	 * left this machine, so there is nothing he could have typed. {@code
	 * competitor_not_referred_by_itself} is the floor under the day that stops being
	 * true.
	 *
	 * <p><b>Why the credit matters more than the size of this method suggests.</b> The
	 * programme pays when this member's own membership is first activated (owner,
	 * 12.08.2026), registration opens 01.10.2026 and the programme works from the same
	 * day - so every registration between those two events with this column left empty is
	 * a payment nobody can ever be made, and it cannot be repaired afterwards, because
	 * who brought whom is not written down anywhere else. {@code Registration.tsx} has
	 * been reading the code out of the address and telling the visitor „Prijava je
	 * zabelezena kao preporuka" since before this route existed.
	 */
	private Long whoBrought(Typed typed) {
		if (isNothing(typed.referredBy())) {
			return null;
		}

		return db.sql("select id from competitor where referral_code = ?")
				.param(typed.referredBy().strip()).query(Long.class).optional().orElse(null);
	}

	/**
	 * THE TOKEN THAT MAKES THE ADDRESS WORTH ANYTHING, WRITTEN HERE AND SENT LATER.
	 *
	 * <p><b>The row goes in inside the transaction and the message does not, which is the
	 * point of the split.</b> A token written beside the account is a token a resend can
	 * use, so the person whose message did not go out is holding something rather than
	 * nothing. What this returns is the secret half, which exists nowhere else - not in
	 * the row, which holds only its hash - and it exists only long enough for
	 * {@link #send} to put it in a letter.
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
	private Made theLinkToSend(long account) {
		SecretToken link = SecretToken.fresh();

		db.sql("insert into email_verification_token (account_id, token_hash) values (?, ?)")
				.params(account, link.hash()).update();

		String stored = db.sql("select email from account where id = ?")
				.param(account).query(String.class).single();

		return new Made(ResponseEntity.noContent().build(), account, stored, link.secret());
	}

	/**
	 * WHAT ONE COMMITTED REGISTRATION LEAVES BEHIND FOR THE MESSAGE TO BE BUILT FROM.
	 *
	 * <p>It exists so that the sending can happen OUTSIDE the transaction without the
	 * sending having to ask the database anything: everything the relay needs is read
	 * while the rows are being written, and afterwards this route touches no connection
	 * at all. That is the difference the whole arrangement turns on - a request waiting
	 * on a relay must be a request holding nothing.
	 *
	 * @param answer  what goes back to whoever asked, which is decided before the message
	 *                is attempted and is not changed by how the attempt goes
	 * @param account the row the message is about, for the one line written when it does
	 *                not go out. The account and never the address: a log is read by
	 *                whoever can read the disk, and an address is a personal datum
	 * @param address where the message goes, READ BACK OFF THE ROW rather than carried
	 *                along from what was typed. The two differ on purpose - the address
	 *                is stripped and folded on the way in - and a message sent to what
	 *                was typed would go somewhere the account does not live
	 * @param link    the secret half of the token, which exists only in this object and
	 *                in the message; the row holds what it hashes to and nothing else.
	 *                Null when there is nothing to send, which is the refused
	 *                registration, and that null is what {@link #writeThenSend} asks
	 */
	private record Made(ResponseEntity<Refused> answer, long account, String address,
			String link) {
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
