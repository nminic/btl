package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.PasswordPolicy;
import com.btl.portal.domain.account.StoredPassword;
import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.member.ReferralCode;
import com.btl.portal.domain.registration.Guardianship;
import com.btl.portal.domain.registration.WhatRegistrationAsksFor;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.util.ServerSetupTest;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * REGISTERING, END TO END, AGAINST A REAL DATABASE AND A REAL MAIL SERVER.
 *
 * <p>GreenMail is an SMTP server and not a mock, the same arrangement
 * {@code PostmanTest} uses: the message is handed to Spring, Spring opens a socket,
 * and what is read back is what actually travelled. It is needed here rather than
 * optional, because this route sends its message INSIDE the transaction that writes
 * the rows - so with nothing listening, every registration would fail and every case
 * in this file would be about a relay rather than about registering.
 *
 * <p><b>The portal's own address is overridden for this class on purpose.</b>
 * {@code application.properties} carries the production one, and a case comparing the
 * link against that value would be just as green if the address were written into the
 * code. Overridden, a link pointing anywhere but at this setting fails
 * {@code theLinkIsBuiltFromTheSettingAndNotFromWhoeverAsked}; and
 * {@code theSettingItselfCarriesThePortal} reads the real file off the disk so that
 * the override cannot hide a production value that has gone wrong. That is the pair
 * {@code PostmanTest} keeps around the address the portal writes from.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = {
		"spring.mail.host=127.0.0.1",
		"spring.mail.port=3025",
		"spring.mail.properties.mail.smtp.auth=false",
		"btl.portal.address=https://probni-portal.primer.rs"})
@Transactional
class RegistrationApiTest {

	/** Port 3025 is GreenMail's own for SMTP, and the properties above name it. */
	@RegisterExtension
	static final GreenMailExtension SMTP = new GreenMailExtension(ServerSetupTest.SMTP);

	private static final String ADDRESS = "novi.clan@primer.rs";

	/** Twelve characters and not on the shipped list, which is what the policy asks for. */
	private static final String PASSWORD = "trcim.kroz.sumu.2027";

	/**
	 * The names {@link WhatRegistrationAsksFor} uses, where this route's request calls
	 * them something else.
	 *
	 * <p>Only one does. The form has a single control for the town - „Mesto se bira iz
	 * svetskog sifarnika i tada nosi svoju drzavu" (owner, 11.08.2026) - and over the wire
	 * that is a chosen row of the codebook OR a name typed by hand with its country, so
	 * the request carries three keys where the form has one. {@code placeId} is the one
	 * the cases below take away when they mean "he chose no town".
	 */
	private static final Map<String, String> ANSWERED_BY = Map.of("city", "placeId");

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Value("${btl.portal.address}")
	private String portal;

	/** A town of the codebook and the country it carries, read rather than written here. */
	private long aTownOfTheCodebook;

	private String theCountryThatTownIsIn;

	/** A country that is NOT that town's, so the two can never be mistaken for each other. */
	private String anotherCountry;

	private LocalDate today;

	@BeforeEach
	void twoTownsAndTwoCountriesThatAreNotEachOther() {
		today = LocalDate.now(SeasonClock.ZONE);

		Map<String, Object> town = db.sql("select p.geonames_id, c.code from place p"
						+ " join country c on c.id = p.country_id order by p.rank limit 1")
				.query().singleRow();

		aTownOfTheCodebook = ((Number) town.get("geonames_id")).longValue();
		theCountryThatTownIsIn = (String) town.get("code");

		/* A DIFFERENT COUNTRY, and it has to be different rather than merely a country:
		   asked with the town's own code, "the country came from the codebook" and "the
		   country came from the request" give the same answer and neither case says
		   anything. */
		anotherCountry = db.sql("select code from country where code <> ? order by code limit 1")
				.param(theCountryThatTownIsIn).query(String.class).single();
	}

	/**
	 * A COMPLETE REGISTRATION FOR SOMEBODY OF THIRTY, as a map so that a case can take
	 * one thing out of it.
	 *
	 * <p>Every value is deliberately distinct from every other, so that a column written
	 * from the wrong field is visible: the first name is not the last name, the father's
	 * name is neither, and the street is not a town.
	 */
	private Map<String, Object> aGrownUp() {
		Map<String, Object> form = new LinkedHashMap<>();

		form.put("firstName", "Petar");
		form.put("lastName", "Petrovic");
		form.put("fatherName", "Milorad");
		form.put("birthDate", today.minusYears(30).toString());
		form.put("gender", "M");
		form.put("firstSeason2027", true);
		form.put("email", ADDRESS);
		form.put("password", PASSWORD);
		form.put("passwordRepeat", PASSWORD);
		form.put("address", "Ulica slobode 15/4");
		form.put("placeId", aTownOfTheCodebook);
		form.put("idNumber", "AB1234567");
		form.put("phone", "+381601234567");
		form.put("shirtSize", "L");
		form.put("bio", "Trcim od 2019. godine, najvise po planinama.");
		form.put("healthStatement", true);

		return form;
	}

	/** The same person at ten, which is what makes the parent's signature required. */
	private Map<String, Object> aChild() {
		Map<String, Object> form = aGrownUp();

		form.put("birthDate", today.minusYears(10).toString());
		form.remove("idNumber");
		form.put("parentConsent", "Milorad Petrovic");
		form.put("parentRelation", Guardianship.Relation.FATHER.code());

		return form;
	}

	private MockHttpServletResponse register(Map<String, Object> form) throws Exception {
		return http.perform(post("/api/registration").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content(new ObjectMapper().writeValueAsString(form)))
				.andReturn().getResponse();
	}

	private Map<String, Object> theAccountAt(String email) {
		return db.sql("select * from account where lower(email) = lower(?)")
				.param(email).query().singleRow();
	}

	private Map<String, Object> theCompetitorBehind(String email) {
		return db.sql("select c.* from competitor c"
						+ " join account a on a.competitor_id = c.id"
						+ " where lower(a.email) = lower(?)")
				.param(email).query().singleRow();
	}

	private int howMany(String table) {
		return db.sql("select count(*) from " + table).query(Integer.class).single();
	}

	private MimeMessage waitForOne() {
		assertThat(SMTP.waitForIncomingEmail(5000, 1))
				.as("no message reached the mail server in five seconds, so the member has no"
						+ " way of confirming the address he just registered")
				.isTrue();

		return SMTP.getReceivedMessages()[0];
	}

	/**
	 * ONE REGISTRATION MAKES ONE ACCOUNT AND ONE COMPETITOR, AND THE TWO KNOW EACH OTHER.
	 *
	 * <p>The answer carries nothing at all, which is the whole of what goes back: no
	 * identifier, no member number, no session. A registration is not a way in - the
	 * address has not been confirmed - so a cookie here would be a session for an account
	 * that may not have one.
	 */
	@Test
	void oneRegistrationMakesAnAccountAndACompetitorAndNothingElse() throws Exception {
		MockHttpServletResponse answer = register(aGrownUp());

		assertThat(answer.getStatus()).isEqualTo(204);
		assertThat(answer.getContentAsString())
				.as("the answer said something about the person who just registered").isEmpty();
		assertThat(answer.getCookie(SessionCookie.NAME))
				.as("registering handed out a session, at an address nobody has confirmed")
				.isNull();

		Map<String, Object> account = theAccountAt(ADDRESS);
		Map<String, Object> competitor = theCompetitorBehind(ADDRESS);

		assertThat(account.get("first_name")).isEqualTo("Petar");
		assertThat(account.get("last_name")).isEqualTo("Petrovic");
		/* AND THE ROLE IS AN ORDINARY ONE. The request carries no role and must never be
		   able to: a form that could name its own would be a form anybody could register a
		   superadmin with. The owner settled on 14.09.2026 how that account is made instead
		   - named by its address in `deploy/.env`, taking the role once the address is
		   confirmed - which is a different increment and nothing this route does. */
		assertThat(db.sql("select r.code from role r join account a on a.role_id = r.id"
						+ " where a.id = ?").param(account.get("id")).query(String.class).single())
				.as("registering handed out a role other than the ordinary one")
				.isEqualTo("competitor");
		assertThat(account.get("competitor_id"))
				.as("the account was written without the member it belongs to")
				.isEqualTo(competitor.get("id"));

		assertThat(competitor.get("first_name")).isEqualTo("Petar");
		assertThat(competitor.get("last_name")).isEqualTo("Petrovic");
		assertThat(competitor.get("father_name")).isEqualTo("Milorad");
		assertThat(competitor.get("gender")).isEqualTo("M");
		assertThat(competitor.get("address")).isEqualTo("Ulica slobode 15/4");
		assertThat(competitor.get("shirt_size")).isEqualTo("L");
		assertThat(competitor.get("phone")).isEqualTo("+381601234567");
		assertThat(competitor.get("bio")).isEqualTo("Trcim od 2019. godine, najvise po planinama.");
		assertThat(competitor.get("first_season_2027")).isEqualTo(true);
		assertThat(((java.sql.Date) competitor.get("birth_date")).toLocalDate())
				.isEqualTo(today.minusYears(30));
		assertThat(competitor.get("health_statement_at"))
				.as("nothing recorded when he said he was fit to run")
				.isNotNull();

		/* The basis is how the membership will be held and not that it is held: 'feeExempt'
		   is honorary membership, which is the owner's to grant, and a form must never be
		   able to claim it. */
		assertThat(competitor.get("membership_basis")).isEqualTo("payment");
		assertThat(competitor.get("profile_hidden")).isEqualTo(false);
		/* V7's only default, which is O17's decision: none unless the member chooses
		   otherwise. Left out of the INSERT so that the default is what decides. */
		assertThat(competitor.get("birthday_shown")).isEqualTo("none");
		assertThat((String) competitor.get("referral_code"))
				.as("the code that a referral link carries is not one this portal issues")
				.matches("^[0-9a-f]{" + ReferralCode.WIDTH + "}$");

		assertThat(howMany("account")).isOne();
		assertThat(howMany("competitor")).isOne();
	}

	/**
	 * THE MEMBERSHIP IS NOT ACTIVE AND THERE IS NO MEMBER NUMBER.
	 *
	 * <p>PDL, owner of 30.07.2026: „Clanski broj se dodeljuje automatski u trenutku
	 * evidentiranja uplate... Ne dodeljuje se pri registraciji", with the consequence in
	 * the same line: „registrovan a neplacen clan nema clanski broj".
	 *
	 * <p><b>And the sequence has not moved either, which the column alone does not
	 * say.</b> A sequence advances even when the statement that asked it fails, so a route
	 * that drew a number and then chose not to store it would leave this column empty and
	 * still burn one. PDL of 13.09.2026 is what that costs: on production the owner's own
	 * account has to come out as {@code 000001}, and „sekvenca se pomera i kad upis ne
	 * uspe, pa slucajan neuspeo pokusaj pre toga znaci da vlasnik dobija 000002".
	 */
	@Test
	void registrationHandsOutNoMemberNumberAndDoesNotEvenAskForOne() throws Exception {
		boolean askedBefore = db.sql("select is_called from member_number_seq")
				.query(Boolean.class).single();

		assertThat(register(aGrownUp()).getStatus()).isEqualTo(204);

		assertThat(theCompetitorBehind(ADDRESS).get("member_number"))
				.as("registering handed out a member number, which is the payment's to hand out")
				.isNull();
		assertThat(theCompetitorBehind(ADDRESS).get("active"))
				.as("registering activated the membership, so he is on the public list before"
						+ " anybody has recorded a payment")
				.isEqualTo(false);
		assertThat(db.sql("select is_called from member_number_seq").query(Boolean.class).single())
				.as("the sequence of member numbers moved during a registration, so the next"
						+ " member to pay would get a number with a gap before it")
				.isEqualTo(askedBefore);
	}

	/**
	 * AND HE IS ON NO PUBLIC LIST, measured through the resource that draws one.
	 *
	 * <p>PDL: „Pre placanja clan sme da otvori nalog, ali nigde nije vidljiv i ne moze
	 * nista da radi u sistemu." {@link CompetitorApi} serves {@code where c.active}, so the
	 * sentence is true by construction - but only as long as this route writes
	 * {@code active} false, which is exactly what this asks. The list is read before and
	 * after, so a portal that already had members would still measure the difference.
	 */
	@Test
	void nobodyWhoHasJustRegisteredIsOnThePublicList() throws Exception {
		String before = http.perform(get("/api/competitors")).andReturn().getResponse()
				.getContentAsString();

		assertThat(register(aGrownUp()).getStatus()).isEqualTo(204);

		assertThat(http.perform(get("/api/competitors")).andReturn().getResponse()
				.getContentAsString())
				.as("somebody who has registered and not paid is on the public list of who runs"
						+ " in the league")
				.isEqualTo(before)
				.doesNotContain("Petrovic");
	}

	/**
	 * THE PASSWORD IS KEPT AS WHAT IT HASHES TO AND NEVER AS ITSELF.
	 *
	 * <p>Three things, and each is a separate way of getting this wrong: what is stored is
	 * not what was typed, it names the algorithm it was made with - which is what
	 * {@code account_password_hash_shape} pins and what lets a later move to Argon2 be one
	 * line - and it really is this password's hash rather than some other value of the
	 * right shape.
	 */
	@Test
	void thePasswordIsKeptAsAHashAndNeverAsItself() throws Exception {
		assertThat(register(aGrownUp()).getStatus()).isEqualTo(204);

		String stored = (String) theAccountAt(ADDRESS).get("password_hash");

		assertThat(stored).as("the password itself was written into the database")
				.isNotEqualTo(PASSWORD);
		assertThat(stored).startsWith("{bcrypt}");
		assertThat(new StoredPassword().matches(PASSWORD, stored))
				.as("what was stored is not this password's hash, so he can never sign in")
				.isTrue();
	}

	/**
	 * THE ACCOUNT IS NO WAY IN UNTIL THE ADDRESS IS CONFIRMED, AND IS ONE AFTERWARDS.
	 *
	 * <p>Owner, 31.07.2026: „Potvrda adrese elektronske poste je prva, i uslov za sve
	 * ostalo. Dok adresa nije potvrdjena, nema pristupa portalu ni placanja."
	 *
	 * <p><b>Both halves, and the second is what makes the first mean anything.</b> Without
	 * it, a registration that wrote no password at all, or wrote it wrongly, would pass
	 * the refusal just as happily. So the same person with the same password is refused
	 * before the confirmation and let in after it, and the only thing that changed between
	 * the two is the column B59 will fill in.
	 */
	@Test
	void theAccountIsNoWayInUntilTheAddressIsConfirmed() throws Exception {
		assertThat(register(aGrownUp()).getStatus()).isEqualTo(204);
		assertThat(theAccountAt(ADDRESS).get("email_confirmed_at"))
				.as("registering confirmed the address by itself, so the message means nothing"
						+ " and anybody can register at somebody else's address and use it")
				.isNull();

		MockHttpServletResponse refused = signIn();

		assertThat(refused.getStatus()).isEqualTo(401);
		assertThat(refused.getCookie(SessionCookie.NAME)).isNull();

		db.sql("update account set email_confirmed_at = now() where lower(email) = lower(?)")
				.param(ADDRESS).update();

		MockHttpServletResponse welcomed = signIn();

		assertThat(welcomed.getStatus())
				.as("confirming the address did not make the account usable, so what refused it"
						+ " before was something else entirely")
				.isEqualTo(204);
		assertThat(welcomed.getCookie(SessionCookie.NAME)).isNotNull();
	}

	private MockHttpServletResponse signIn() throws Exception {
		return http.perform(post("/api/sign-in").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"" + ADDRESS + "\",\"password\":\"" + PASSWORD + "\"}"))
				.andReturn().getResponse();
	}

	/**
	 * THE SAME ADDRESS TWICE IS TOLD THAT IT IS TAKEN, AND LEAVES NOTHING BEHIND.
	 *
	 * <p><b>This is the one place this route deliberately answers differently from signing
	 * in, and it is the owner's decision rather than this file's.</b> ADL, 08.09.2026:
	 * „Registracija na vec zauzetu adresu kaze da je zauzeta. Vlasnik je birao izmedju toga
	 * i tihog slanja nove veze vlasniku sanduceta, i izabrao izricitu poruku. Cena je
	 * izlozena pre izbora i prihvacena: bilo ko time moze da proveri da li je data adresa
	 * clan lige."
	 *
	 * <p><b>And the second half is the one that would survive a bad ordering.</b> The
	 * second registration carries a different name, so a competitor written before the
	 * address was tested would be visible as a row - and the count is over the whole table
	 * rather than over rows matching anything, so a competitor left behind under any name
	 * fails this. No second message goes out either: sending one would tell whoever holds
	 * the mailbox nothing useful and would make this route a way of posting mail to
	 * somebody at will.
	 */
	@Test
	void theSameAddressTwiceIsToldThatItIsTakenAndLeavesNothingBehind() throws Exception {
		assertThat(register(aGrownUp()).getStatus()).isEqualTo(204);
		waitForOne();

		Map<String, Object> again = aGrownUp();

		again.put("firstName", "Jovan");
		again.put("lastName", "Jovanovic");

		MockHttpServletResponse answer = register(again);

		assertThat(answer.getStatus()).isEqualTo(409);
		assertThat(answer.getContentAsString())
				.isEqualTo("{\"reason\":\"" + RegistrationApi.THE_ADDRESS_IS_TAKEN + "\"}");

		assertThat(howMany("account")).isOne();
		assertThat(howMany("competitor"))
				.as("a competitor was written before the address was tested, so a refused"
						+ " registration left a person in the register of members")
				.isOne();
		assertThat(theAccountAt(ADDRESS).get("first_name"))
				.as("the second registration overwrote the first one's account")
				.isEqualTo("Petar");
		assertThat(SMTP.getReceivedMessages())
				.as("a second message went out for a registration that was refused")
				.hasSize(1);
	}

	/** And the case it is typed in makes no difference, which is what V6's index says. */
	@Test
	void theAddressIsTakenWhateverCaseItIsTypedIn() throws Exception {
		assertThat(register(aGrownUp()).getStatus()).isEqualTo(204);

		Map<String, Object> shouting = aGrownUp();

		shouting.put("email", ADDRESS.toUpperCase(java.util.Locale.ROOT));

		assertThat(register(shouting).getStatus())
				.as("the same address in capitals was let in as a second account of one person")
				.isEqualTo(409);
		assertThat(howMany("account")).isOne();
	}

	/**
	 * THE ADDRESS IS STORED WITH THE SPACES TAKEN OFF, which is the one thing done to it.
	 *
	 * <p>A space is refused by {@code account_email_shape}, so an address pasted out of a
	 * mail client with one on the end would otherwise be a 500 the person cannot act on.
	 * Stored stripped, it is also the value every later message is addressed to.
	 */
	@Test
	void theAddressIsStoredWithoutTheSpacesAround() throws Exception {
		Map<String, Object> pasted = aGrownUp();

		pasted.put("email", "  " + ADDRESS + "  ");

		assertThat(register(pasted).getStatus()).isEqualTo(204);
		assertThat(theAccountAt(ADDRESS).get("email")).isEqualTo(ADDRESS);
	}

	/**
	 * EVERY FIELD THE FORM ASKS FOR IS ONE THIS ROUTE REFUSES TO DO WITHOUT.
	 *
	 * <p><b>The list is asked of {@link WhatRegistrationAsksFor} rather than written
	 * here</b>, which is what makes it a floor and not a second list: a field added to the
	 * registration tomorrow is one this case immediately demands, and it demands it of the
	 * route rather than of a copy. {@link RegistrationApi#NOT_COLLECTED_YET} is the only
	 * way out, and the case below holds that name to being a real one.
	 *
	 * <p>Each field is taken away on its own, from an otherwise complete form, so nothing
	 * here can be satisfied by a request that was going to be refused anyway. Nothing is
	 * written by any of them, which is asked at the end over the whole table.
	 */
	@Test
	void everyFieldTheFormAsksForIsOneThisRouteRefusesToDoWithout() throws Exception {
		LocalDate born = today.minusYears(30);
		List<String> measured = new ArrayList<>();

		for (String field : WhatRegistrationAsksFor.from(born, today)) {
			if (RegistrationApi.NOT_COLLECTED_YET.contains(field)) {
				continue;
			}

			Map<String, Object> without = aGrownUp();

			without.remove(ANSWERED_BY.getOrDefault(field, field));
			measured.add(field);

			assertThat(register(without).getContentAsString())
					.as("a registration with no %s was accepted", field)
					.isEqualTo("{\"reason\":\"" + RegistrationApi.THE_FORM_IS_NOT_COMPLETE + "\"}");
		}

		assertThat(measured)
				.as("the form asks for nothing at all, so this case measured nothing")
				.isNotEmpty();
		assertThat(howMany("account")).isZero();
		assertThat(howMany("competitor")).isZero();
	}

	/**
	 * AND WHAT THE FORM ASKS FOR IS EITHER COLLECTED OR NAMED AS NOT COLLECTED.
	 *
	 * <p>The other direction of the same floor, and the one that keeps
	 * {@link RegistrationApi#NOT_COLLECTED_YET} honest. Both halves: every name on that
	 * list really is a field the form asks for, so a name that stopped being asked for
	 * cannot sit there excusing nothing; and the photograph really is refused - measured
	 * by sending one, which this route ignores rather than stores.
	 */
	@Test
	void whatTheFormAsksForIsEitherCollectedOrNamedAsNotCollected() throws Exception {
		Set<String> everAsked = new HashSet<>(WhatRegistrationAsksFor.from(today.minusYears(30), today));

		everAsked.addAll(WhatRegistrationAsksFor.from(today.minusYears(10), today));

		assertThat(everAsked)
				.as("a name is listed as not collected which the form does not ask for at any"
						+ " age, so it excuses nothing")
				.containsAll(RegistrationApi.NOT_COLLECTED_YET);

		/* AND THE PHOTOGRAPH REALLY IS ABSENT rather than quietly accepted: a registration
		   goes through without one and the member's row carries no picture. A file is
		   multipart, a digest and a crop (ADL A36 O8), and none of that exists on this
		   server yet. */
		assertThat(register(aGrownUp()).getStatus()).isEqualTo(204);
		assertThat(theCompetitorBehind(ADDRESS).get("photo_id")).isNull();
		assertThat(howMany("photo")).isZero();
	}

	/**
	 * A VALUE THE FORM COULD NOT HAVE PRODUCED IS REFUSED, and told apart from nothing.
	 *
	 * <p>Each of these is a closed list or a shape the schema itself carries, so a request
	 * carrying one of them would reach {@code INSERT} and fall over - which on PostgreSQL
	 * aborts the transaction and comes back as a 500 rather than as an answer. Both ages
	 * are here, because the relation and the identity number are asked of different people.
	 */
	@Test
	void aValueTheFormCouldNotHaveProducedIsRefused() throws Exception {
		Map<String, String> wrong = new LinkedHashMap<>();

		wrong.put("gender", "X");
		wrong.put("shirtSize", "XXXXL");
		wrong.put("birthDate", "15.09.1996");
		wrong.put("idNumber", "AB-123/4567");
		wrong.put("email", "petar.primer.rs");
		wrong.put("address", "   ");

		for (Map.Entry<String, String> one : wrong.entrySet()) {
			Map<String, Object> form = aGrownUp();

			form.put(one.getKey(), one.getValue());

			assertThat(register(form).getContentAsString())
					.as("%s was accepted as '%s'", one.getKey(), one.getValue())
					.isEqualTo("{\"reason\":\"" + RegistrationApi.THE_FORM_IS_NOT_COMPLETE + "\"}");
		}

		Map<String, Object> tomorrow = aGrownUp();

		tomorrow.put("birthDate", today.plusDays(1).toString());

		assertThat(register(tomorrow).getStatus())
				.as("somebody born tomorrow was registered, and asking how old he is throws")
				.isEqualTo(400);

		Map<String, Object> aunt = aChild();

		aunt.put("parentRelation", "tetka");

		assertThat(register(aunt).getContentAsString())
				.as("a relation nobody could have chosen was accepted")
				.isEqualTo("{\"reason\":\"" + RegistrationApi.THE_FORM_IS_NOT_COMPLETE + "\"}");

		/* AND A CHILD'S IDENTITY NUMBER IS JUDGED TOO, although nothing asks him for one.
		   `WhatRegistrationAsksFor` stops asking under sixteen, so the loop above never
		   looks at his; sent anyway and unlooked at, it would go into `competitor_document`
		   where the schema refuses it as an error in the middle of a transaction. */
		Map<String, Object> child = aChild();

		child.put("idNumber", "AB-123/4567");

		assertThat(register(child).getContentAsString())
				.as("a child's document number was written unlooked at")
				.isEqualTo("{\"reason\":\"" + RegistrationApi.THE_FORM_IS_NOT_COMPLETE + "\"}");

		assertThat(howMany("account")).isZero();
		assertThat(howMany("competitor")).isZero();
	}

	/** And the two passwords have to be the same one, which is what the second box is for. */
	@Test
	void theTwoPasswordsHaveToBeTheSameOne() throws Exception {
		Map<String, Object> mistyped = aGrownUp();

		mistyped.put("passwordRepeat", PASSWORD + "8");

		assertThat(register(mistyped).getContentAsString())
				.isEqualTo("{\"reason\":\"" + RegistrationApi.THE_FORM_IS_NOT_COMPLETE + "\"}");
		assertThat(howMany("account")).isZero();
	}

	/**
	 * A LEAKED PASSWORD IS TOLD APART AND A SHORT ONE IS NOT, which is the decision rather
	 * than an inconsistency.
	 *
	 * <p>{@link PasswordPolicy} asks for the difference to reach the screen - „too short is
	 * the member's to fix by typing more, and a leaked one is the member's to fix by
	 * choosing another" - and only one of the two is a rule the form could not have applied
	 * as he typed. The list lives on this server; the length does not.
	 *
	 * <p>The leaked one is read out of the shipped list rather than written here, so the
	 * case cannot go quietly green the day somebody edits the file.
	 */
	@Test
	void aLeakedPasswordIsToldApartAndAShortOneIsNot() throws Exception {
		String leaked = theFirstLeakedPasswordTheListHolds();
		Map<String, Object> reused = aGrownUp();

		reused.put("password", leaked);
		reused.put("passwordRepeat", leaked);

		MockHttpServletResponse answer = register(reused);

		assertThat(answer.getStatus()).isEqualTo(400);
		assertThat(answer.getContentAsString())
				.as("a password that has already leaked was accepted, or was refused with the"
						+ " one answer that tells him nothing he can act on")
				.isEqualTo("{\"reason\":\"" + RegistrationApi.THE_PASSWORD_HAS_LEAKED + "\"}");

		Map<String, Object> tooShort = aGrownUp();
		String eleven = "a".repeat(PasswordPolicy.SHORTEST - 1);

		tooShort.put("password", eleven);
		tooShort.put("passwordRepeat", eleven);

		assertThat(register(tooShort).getContentAsString())
				.as("a password of %d characters was accepted", PasswordPolicy.SHORTEST - 1)
				.isEqualTo("{\"reason\":\"" + RegistrationApi.THE_FORM_IS_NOT_COMPLETE + "\"}");

		assertThat(howMany("account")).isZero();
	}

	/** One entry of the shipped list, read off the resource the policy really uses. */
	private static String theFirstLeakedPasswordTheListHolds() throws Exception {
		try (var lines = new java.io.BufferedReader(new java.io.InputStreamReader(
				RegistrationApiTest.class.getResourceAsStream(
						com.btl.portal.domain.account.BreachedPasswords.RESOURCE),
				StandardCharsets.UTF_8))) {

			String entry = lines.lines()
					.map(String::strip)
					.filter(one -> !one.isEmpty() && !one.startsWith("#"))
					.findFirst()
					.orElseThrow(() -> new AssertionError("the shipped list of leaked passwords"
							+ " holds nothing, so this case measures nothing"));

			assertThat(entry.length())
					.as("the entry read out of the list is shorter than the policy's own minimum,"
							+ " so the length would refuse it before the list was ever asked")
					.isGreaterThanOrEqualTo(PasswordPolicy.SHORTEST);

			return entry;
		}
	}

	/**
	 * A CHILD NEEDS A PARENT AND AN ADULT NEEDS HIS CARD, and neither needs the other's.
	 *
	 * <p>{@link Guardianship} puts both boundaries at sixteen and they move in opposite
	 * directions across it: „at sixteen the identity card becomes required and the parent's
	 * signature stops being". All four corners are here, because a rule written about one
	 * of the two would pass a case that only looked at its own side.
	 */
	@Test
	void aChildNeedsAParentAndAnAdultNeedsHisCard() throws Exception {
		Map<String, Object> childWithNoParent = aChild();

		childWithNoParent.remove("parentConsent");

		assertThat(register(childWithNoParent).getStatus())
				.as("a ten year old was registered with nobody standing behind him")
				.isEqualTo(400);

		Map<String, Object> adultWithNoCard = aGrownUp();

		adultWithNoCard.remove("idNumber");

		assertThat(register(adultWithNoCard).getStatus())
				.as("a grown man was registered without the number the law on sport asks for")
				.isEqualTo(400);

		/* AND A CHILD GOES THROUGH WITHOUT ONE, because a card is issued at sixteen and
		   asking a ten year old for its number is asking for something that does not
		   exist. */
		assertThat(register(aChild()).getStatus()).isEqualTo(204);
		assertThat(howMany("competitor_document"))
				.as("a document was written for somebody who has no card to have one from")
				.isZero();
	}

	/**
	 * AND THE PARENT'S CONSENT IS FOUR THINGS, kept as evidence.
	 *
	 * <p>V8, out of PDL and the published privacy policy: „the name and surname, the
	 * relation from a fixed list, the date and time, and the address it was given from.
	 * Not one of the four is decoration - together they are the evidence that it was given,
	 * which is what the policy promises to keep."
	 *
	 * <p><b>And the name on it is the PARENT'S and not the child's</b>, which is a
	 * separation a fixture sharing one name could not make: the signature says who stood
	 * behind the registration, and written from the wrong field it would say the child
	 * stood behind himself.
	 */
	@Test
	void theParentsConsentIsKeptAsFourThings() throws Exception {
		assertThat(register(aChild()).getStatus()).isEqualTo(204);

		Map<String, Object> consent = db.sql("select * from parental_consent").query().singleRow();

		assertThat(consent.get("guardian_name"))
				.as("the signature carries the child's own name")
				.isEqualTo("Milorad Petrovic");
		assertThat(consent.get("relation")).isEqualTo(Guardianship.Relation.FATHER.code());
		assertThat(consent.get("given_at")).isNotNull();
		assertThat(consent.get("given_from")).isNotNull();
		assertThat(consent.get("competitor_id"))
				.isEqualTo(theCompetitorBehind(ADDRESS).get("id"));
	}

	/** And nobody of sixteen and over gets one, however much his form carries. */
	@Test
	void nobodyOldEnoughToHoldHisOwnAccountGetsAParentsConsent() throws Exception {
		Map<String, Object> grownUpWithAParent = aGrownUp();

		grownUpWithAParent.put("parentConsent", "Milorad Petrovic");
		grownUpWithAParent.put("parentRelation", Guardianship.Relation.FATHER.code());

		assertThat(register(grownUpWithAParent).getStatus()).isEqualTo(204);
		assertThat(howMany("parental_consent"))
				.as("a thirty year old's account was recorded as held by his father")
				.isZero();
	}

	/** The identity number goes into its own table and never onto the member. */
	@Test
	void theIdentityNumberGoesIntoItsOwnTable() throws Exception {
		assertThat(register(aGrownUp()).getStatus()).isEqualTo(204);

		assertThat(db.sql("select document_number from competitor_document where competitor_id = ?")
				.param(theCompetitorBehind(ADDRESS).get("id")).query(String.class).single())
				.isEqualTo("AB1234567");
		assertThat(theCompetitorBehind(ADDRESS))
				.as("the most sensitive item in the register sits in the table the portal's"
						+ " screens read")
				.doesNotContainKey("document_number");
	}

	/**
	 * A TOWN OF THE CODEBOOK CARRIES ITS OWN COUNTRY, AND A TYPED ONE CARRIES THE
	 * COUNTRY OF WHOEVER TYPED IT.
	 *
	 * <p>Owner, 11.08.2026: „Mesto se bira iz svetskog sifarnika i tada nosi svoju drzavu,
	 * koja se ne menja; drzava se bira samo uz mesto upisano rukom." The schema says it as
	 * a pair of checks and this route has to refuse the arrangements that break them
	 * BEFORE the INSERT, or they arrive as an error rather than as an answer.
	 *
	 * <p><b>The country sent alongside a codebook town is deliberately not that town's
	 * own.</b> Sent the same one, "the country was taken from the codebook" and "the
	 * country was taken from the request" would produce the same row and the case would
	 * say nothing.
	 */
	@Test
	void aTownOfTheCodebookCarriesItsOwnCountryAndATypedOneDoesNot() throws Exception {
		assertThat(register(aGrownUp()).getStatus()).isEqualTo(204);

		Map<String, Object> chosen = theCompetitorBehind(ADDRESS);

		assertThat(chosen.get("place_id")).isNotNull();
		assertThat(chosen.get("city"))
				.as("a town chosen from the codebook was also written out as text")
				.isNull();
		assertThat(chosen.get("country_id"))
				.as("a town chosen from the codebook was given a country of its own, which is"
						+ " a second home for a fact the codebook already holds")
				.isNull();
		assertThat(db.sql("select c.code from place p join country c on c.id = p.country_id"
						+ " where p.id = ?").param(chosen.get("place_id")).query(String.class).single())
				.isEqualTo(theCountryThatTownIsIn);
	}

	@Test
	void aTownTypedByHandCarriesTheCountryOfWhoeverTypedIt() throws Exception {
		Map<String, Object> typedTown = aGrownUp();

		typedTown.remove("placeId");
		typedTown.put("city", "Malo selo");
		typedTown.put("country", anotherCountry);

		assertThat(register(typedTown).getStatus()).isEqualTo(204);

		Map<String, Object> stored = theCompetitorBehind(ADDRESS);

		assertThat(stored.get("place_id")).isNull();
		assertThat(stored.get("city")).isEqualTo("Malo selo");
		assertThat(db.sql("select code from country where id = ?").param(stored.get("country_id"))
				.query(String.class).single())
				.as("the country of a typed town was not the one whoever typed it chose")
				.isEqualTo(anotherCountry);
	}

	/**
	 * AND EVERY OTHER ARRANGEMENT OF THE THREE IS NOT A TOWN.
	 *
	 * <p>Both at once, neither, half a typed one, and a number or a code the codebook does
	 * not have. The last two are the ones that would otherwise be a foreign key falling
	 * over inside the transaction.
	 */
	@Test
	void everyOtherArrangementOfTheThreeIsNotATown() throws Exception {
		List<Map<String, Object>> notTowns = new ArrayList<>();

		Map<String, Object> both = aGrownUp();

		both.put("city", "Malo selo");
		both.put("country", anotherCountry);
		notTowns.add(both);

		Map<String, Object> codebookWithACountry = aGrownUp();

		codebookWithACountry.put("country", anotherCountry);
		notTowns.add(codebookWithACountry);

		/* A CHOSEN TOWN AND A TYPED NAME, WITH NO COUNTRY. Its own arrangement rather than
		   a variation of the first: with a country beside them the two halves are both
		   complete and the request says two towns, which is refused by counting. With the
		   country left out, nothing is complete except the chosen one - so a route that
		   only counted would take it and write the codebook's row while silently dropping
		   the name the person typed. Found by coverage rather than by thinking of it. */
		Map<String, Object> codebookAndAName = aGrownUp();

		codebookAndAName.put("city", "Malo selo");
		notTowns.add(codebookAndAName);

		Map<String, Object> typedWithNoCountry = aGrownUp();

		typedWithNoCountry.remove("placeId");
		typedWithNoCountry.put("city", "Malo selo");
		notTowns.add(typedWithNoCountry);

		Map<String, Object> countryWithNoTown = aGrownUp();

		countryWithNoTown.remove("placeId");
		countryWithNoTown.put("country", anotherCountry);
		notTowns.add(countryWithNoTown);

		Map<String, Object> aTownNothingMaps = aGrownUp();

		aTownNothingMaps.put("placeId", -1L);
		notTowns.add(aTownNothingMaps);

		Map<String, Object> aCountryNothingMaps = aGrownUp();

		aCountryNothingMaps.remove("placeId");
		aCountryNothingMaps.put("city", "Malo selo");
		aCountryNothingMaps.put("country", "ZZ");
		notTowns.add(aCountryNothingMaps);

		for (Map<String, Object> notATown : notTowns) {
			assertThat(register(notATown).getContentAsString())
					.as("a town was made out of %s, %s and %s", notATown.get("placeId"),
							notATown.get("city"), notATown.get("country"))
					.isEqualTo("{\"reason\":\"" + RegistrationApi.THE_FORM_IS_NOT_COMPLETE + "\"}");
		}

		assertThat(howMany("competitor")).isZero();
	}

	/** The health statement is not optional, and unticked is not a form that was filled in. */
	@Test
	void theHealthStatementIsNotOptional() throws Exception {
		Map<String, Object> unticked = aGrownUp();

		unticked.put("healthStatement", false);

		assertThat(register(unticked).getContentAsString())
				.as("a registration with the health statement unticked was accepted")
				.isEqualTo("{\"reason\":\"" + RegistrationApi.THE_FORM_IS_NOT_COMPLETE + "\"}");
		assertThat(howMany("competitor")).isZero();
	}

	/**
	 * THE BIOGRAPHY AND THE TELEPHONE ARE OPTIONAL, and they are the only two that are.
	 *
	 * <p>„Svojim recima" was compulsory in the form by mistake and registration was refused
	 * without it, which collided with the portal's own privacy policy; corrected
	 * 12.08.2026, and PDL says „prijava prolazi i bez njega". The telephone is collected on
	 * consent since 20.08.2026, which overturned the decision of 11.08.2026 that had taken
	 * it off the portal altogether.
	 *
	 * <p><b>The two are stored differently and V7 and V8 each say why</b>: an empty
	 * biography is a state a profile has to look right in, so the column is NOT NULL and
	 * may be empty; no telephone is NULL, because an empty string would be a second way of
	 * saying the same absence.
	 */
	@Test
	void theBiographyAndTheTelephoneAreTheOnlyTwoThatAreOptional() throws Exception {
		Map<String, Object> neither = aGrownUp();

		neither.remove("bio");
		neither.remove("phone");

		assertThat(register(neither).getStatus())
				.as("a registration was refused for want of a field nothing asks for")
				.isEqualTo(204);

		Map<String, Object> stored = theCompetitorBehind(ADDRESS);

		assertThat(stored.get("bio"))
				.as("an absent biography was stored as nothing rather than as an empty one")
				.isEqualTo("");
		assertThat(stored.get("phone"))
				.as("an absent telephone was stored as an empty string, which is a second way"
						+ " of saying the same absence")
				.isNull();
	}

	/**
	 * THE MESSAGE GOES TO THE ADDRESS ON THE ROW, AND TO THAT PERSON'S ROW.
	 *
	 * <p><b>Two registrations and not one, which is what makes this measure anything.</b>
	 * With a single person in the fixture, "the address of the account just written" and
	 * "an address somewhere in the table" produce the same message, and so does "the
	 * address out of the request". Two of them, each with its own address, and each has to
	 * get its own: a route reading the first row, or the last, or the wrong request would
	 * send both to one place.
	 *
	 * <p>And the link really opens THAT account: what travels is hashed and looked for in
	 * {@code email_verification_token}, which is the only way this portal ever asks about a
	 * token.
	 */
	@Test
	void eachPersonGetsHisOwnMessageAtHisOwnAddress() throws Exception {
		Map<String, Object> second = aGrownUp();

		second.put("email", "druga.osoba@primer.rs");
		second.put("firstName", "Jovan");
		second.put("lastName", "Jovanovic");

		assertThat(register(aGrownUp()).getStatus()).isEqualTo(204);
		assertThat(register(second).getStatus()).isEqualTo(204);

		assertThat(SMTP.waitForIncomingEmail(5000, 2)).isTrue();

		Map<String, String> arrived = new LinkedHashMap<>();

		for (MimeMessage message : SMTP.getReceivedMessages()) {
			arrived.put(message.getAllRecipients()[0].toString(), message.getContent().toString());
		}

		assertThat(arrived.keySet())
				.as("the two registrations did not each get their own message")
				.containsExactlyInAnyOrder(ADDRESS, "druga.osoba@primer.rs");

		for (Map.Entry<String, String> one : arrived.entrySet()) {
			String secret = theTokenInside(one.getValue());
			long opens = db.sql("select account_id from email_verification_token where token_hash = ?")
					.param(SecretToken.hashOf(secret)).query(Long.class).single();

			assertThat(opens)
					.as("the link sent to %s opens somebody else's account", one.getKey())
					.isEqualTo(((Number) theAccountAt(one.getKey()).get("id")).longValue());
		}
	}

	/** And the row holds only what the link hashes to, never the link itself. */
	@Test
	void theRowHoldsOnlyWhatTheLinkHashesTo() throws Exception {
		assertThat(register(aGrownUp()).getStatus()).isEqualTo(204);

		String secret = theTokenInside(waitForOne().getContent().toString());
		String stored = db.sql("select token_hash from email_verification_token")
				.query(String.class).single();

		assertThat(stored).as("the secret itself was written into the database")
				.isNotEqualTo(secret);
		assertThat(SecretToken.matches(secret, stored))
				.as("the row is not what the link hashes to, so the link opens nothing")
				.isTrue();
		assertThat(db.sql("select expires_at > now() from email_verification_token")
				.query(Boolean.class).single())
				.as("the link was born already expired")
				.isTrue();
	}

	/**
	 * THE LINK IS BUILT FROM THE SETTING AND NOT FROM WHOEVER ASKED.
	 *
	 * <p>{@code WhatTheMessageSays} names this as the way in it exists to close: a
	 * request's host is written by whoever sent it, so a registration arriving with a host
	 * of its own would have the portal mail a link to the attacker's machine, and whoever
	 * clicks it hands him the token. The request below carries exactly that, in both of
	 * the headers a container reads a host from.
	 */
	@Test
	void theLinkIsBuiltFromTheSettingAndNotFromWhoeverAsked() throws Exception {
		MockHttpServletResponse answer = http.perform(post("/api/registration").with(csrf())
						.header("Host", "zlo.rs")
						.header("X-Forwarded-Host", "zlo.rs")
						.contentType(MediaType.APPLICATION_JSON)
						.content(new ObjectMapper().writeValueAsString(aGrownUp())))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(204);

		String body = waitForOne().getContent().toString();

		assertThat(body)
				.as("the link in the message points at a host that came in with the request")
				.doesNotContain("zlo.rs")
				.contains(portal + Message.CONFIRM_THE_ADDRESS.path() + "?token=");
	}

	/**
	 * AND THE SETTING ITSELF CARRIES THE PORTAL, read off the file this class overrides.
	 *
	 * <p>Every case above is measured against the overridden value, so none of them can see
	 * a production address that has gone wrong. This reads
	 * {@code application.properties} from the disk, parsed rather than searched for the
	 * reason {@code PostmanTest} gives about the same file: a search for the text would be
	 * satisfied by a line somebody commented out.
	 */
	@Test
	void theSettingItselfCarriesThePortal() throws Exception {
		Properties settings = new Properties();

		try (Reader file = Files.newBufferedReader(
				Path.of("src", "main", "resources", "application.properties"),
				StandardCharsets.UTF_8)) {
			settings.load(file);
		}

		assertThat(settings.getProperty("btl.portal.address"))
				.as("the portal has no address of its own, so no link it mails can point at it")
				.isEqualTo("https://balkanskatrkackaliga.net");
	}

	/** The token out of the link in a message, so a case can ask the database about it. */
	private static String theTokenInside(String body) {
		int at = body.indexOf("?token=");

		assertThat(at).as("the message carries no link at all:%n%s", body).isNotNegative();

		String rest = body.substring(at + "?token=".length());
		int ends = 0;

		while (ends < rest.length() && (Character.isLetterOrDigit(rest.charAt(ends))
				|| rest.charAt(ends) == '-' || rest.charAt(ends) == '_')) {
			ends++;
		}

		return rest.substring(0, ends);
	}

	/**
	 * A REQUEST WITH NO FORM AT ALL NEVER REACHES US.
	 *
	 * <p>{@code @RequestBody} is required, so Spring turns such a request away with 400
	 * before the method runs. That is what lets the method not check for it, and this is
	 * the case that holds the guarantee - the same one {@code SignInApiTest} keeps over the
	 * other open writing route.
	 */
	@Test
	void aRequestWithNoFormAtAllNeverReachesUs() throws Exception {
		assertThat(http.perform(post("/api/registration").with(csrf())
						.contentType(MediaType.APPLICATION_JSON))
				.andReturn().getResponse().getStatus())
				.isEqualTo(400);
		assertThat(howMany("account")).isZero();
	}

	/**
	 * WITHOUT THE TOKEN THE FORM IS REFUSED, which is the CSRF guard measured rather than
	 * assumed.
	 *
	 * <p>Every other case here carries one. This one does not, and must be turned away
	 * before it writes anything at all: another site could otherwise make a visitor's
	 * browser register an account in his name, and the portal would mail him a link he
	 * never asked for.
	 */
	@Test
	void withoutTheTokenTheFormIsRefused() throws Exception {
		assertThat(http.perform(post("/api/registration")
						.contentType(MediaType.APPLICATION_JSON)
						.content(new ObjectMapper().writeValueAsString(aGrownUp())))
				.andReturn().getResponse().getStatus())
				.isEqualTo(403);
		assertThat(howMany("account")).isZero();
		assertThat(SMTP.waitForIncomingEmail(200, 1))
				.as("a request nobody proved came from the portal made the portal send mail")
				.isFalse();
	}

	/**
	 * THE SEASON HE IS JOINING FOR IS THE ONE THE LEAGUE IS SELLING, not the year on the
	 * calendar.
	 *
	 * <p>{@link SeasonClock#seasonBeingPaidFor} is the answer and it is never before the
	 * first season there is: „Sezona u ponudi ne moze biti pre prve. Kalendarski odgovor
	 * kroz leto 2026. je 2026, a sezone 2026. nema (P2), pa je odgovor 2027."
	 *
	 * <p><b>THE BOUNDARY, WRITTEN DOWN BECAUSE THIS CASE CANNOT SEE IT.</b> Outside the
	 * transfer window the season being sold and the calendar year floored at the first
	 * season are the same number, so on any day before 1 October this case cannot tell a
	 * route that asks {@code SeasonClock} from one that asks the calendar. Telling them
	 * apart needs the clock bean replaced with one fixed inside the window, which is what
	 * {@code WhatTimeItIs} exists for and is a fixture of its own; until somebody writes
	 * it, what is held here is that the season is the league's answer and never before
	 * 2027.
	 */
	@Test
	void theSeasonHeIsJoiningForIsTheOneTheLeagueIsSelling() throws Exception {
		assertThat(register(aGrownUp()).getStatus()).isEqualTo(204);

		assertThat(theCompetitorBehind(ADDRESS).get("first_season"))
				.isEqualTo(SeasonClock.seasonBeingPaidFor(ZonedDateTime.now(SeasonClock.ZONE)));
		assertThat((Integer) theCompetitorBehind(ADDRESS).get("first_season"))
				.isGreaterThanOrEqualTo(SeasonClock.FIRST_SEASON);
	}
}
