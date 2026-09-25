package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.registration.WhatRegistrationAsksFor;
import com.btl.portal.domain.token.SecretToken;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import jakarta.mail.Address;
import jakarta.mail.internet.MimeMessage;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * THE ADMINISTRATION ENTERING MEMBERS IN A GROUP, AND WHAT EACH OF THEM IS UNTIL HE SETS
 * HIS OWN PASSWORD.
 *
 * <p>The owner, PDL P8b, 25.09.2026: the button for entering a member in the
 * administration is „grupni unos koji salje pozivnice". What that is in rows is
 * {@link CompetitorWriteApi#enter}; what it has to be TRUE of is here.
 *
 * <p><b>A class of its own rather than more cases in {@code CompetitorWriteApiTest},
 * and the reason is a socket.</b> Every class that sends mail binds a server of its own
 * and the JUnit extension binds and unbinds it around EVERY method
 * ({@link MailServerForACase} carries what sharing one cost on 14.09.2026). Folded into
 * the hundred-odd cases of the deleting class, that is a hundred binds bought for the
 * dozen that read a letter.
 *
 * <p><b>NOTHING IN THIS FIXTURE IS THE ONLY ONE OF ITS KIND, on every axis an assertion
 * reads a value along.</b> The rule is the one measured on 06.09.2026 - „Imenuj drugi
 * izvor iste vrednosti: odakle bi ova ista vrednost mogla da stigne da je kod pogresan?"
 *
 * <ul>
 * <li><b>Every group is THREE rows and the one a case is about is the SECOND.</b> A group
 * of one cannot tell „this row" from „the group", and a bad row written first or last
 * cannot tell „it stopped before the bad row" from „it stopped after it".
 * <li><b>Three different addresses, and a message is found BY the address of the row it
 * belongs to</b>, never by being the only letter or the first one. A message to the whole
 * league satisfies „he was told" exactly as well as one to him, which is the rule of
 * 06.09.2026 about a recipient.
 * <li><b>Two accounts already hold addresses</b>, and one of them is what a group row
 * collides with. It is written FIRST, so „the account in the way" is never „the first
 * account" or „the only account".
 * <li><b>One member of the fixture is ACTIVE and holds a member number</b>, so
 * {@code member_number_seq} has already been drawn from and „nobody entered here got a
 * number" is a different sentence from „nobody in the table has one".
 * <li><b>Two moderators, and only one of them holds the right.</b> So „the superadmin may"
 * is never the whole of who may, and a route that read the role instead of the tick would
 * be caught.
 * <li><b>The clock is fixed to a chosen day</b> ({@link #NOW}), which is neither today nor
 * a moment any row of the fixture carries. Without it „the moment he was entered" and „the
 * moment this case ran" are the same value to the nearest anything, and the column that
 * records the health statement is measured by nothing.
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = {
		"spring.mail.host=127.0.0.1",
		/* A PORT OF THIS CLASS'S OWN. 3325 to 3332 are taken by the eight classes that
		   send mail; this extends the run without a gap. All of them are FIXED numbers, so
		   two full gates started on one machine in the same second still collide - which
		   is `MailServerForACase`'s own written boundary and not this class's to fix. */
		"spring.mail.port=3333",
		"spring.mail.properties.mail.smtp.auth=false",
		"btl.portal.address=https://probni-portal.primer.rs"})
class GroupEntryTest {

	@RegisterExtension
	static final GreenMailExtension SMTP = new GreenMailExtension(MailServerForACase.on(3333));

	/**
	 * A day in March, so that {@code SeasonClock.seasonBeingPaidFor} answers the year it
	 * is in rather than the next one.
	 *
	 * <p>Chosen so the two answers differ: in October it would be 2028 and a route reading
	 * the wrong one of {@code SeasonClock}'s two questions would pass. It is also not
	 * today, which is what makes every column recording „when" measurable at all.
	 */
	private static final Instant NOW = Instant.parse("2027-03-15T09:00:00Z");

	private static final int THE_SEASON = 2027;

	/** Old enough to sign for himself and to hold an identity card. */
	private static final String A_GROWN_UP = "1990-04-02";

	/** Thirteen on {@link #NOW}, so his account is held by a guardian. */
	private static final String A_CHILD = "2013-06-01";

	/** Held from the start, and it is the address one group row collides with. */
	private static final String ALREADY_HERE = "vec.ovde@primer.rs";

	/** A second account that is in nobody's way, so „taken" is never „the only account". */
	private static final String ALSO_HERE = "takodje.ovde@primer.rs";

	private static final String EVERYTHING = "superadmin@primer.rs";

	/** A moderator who HOLDS the tick, so the superadmin is never the only one who may. */
	private static final String OVER_THE_MEMBERS = "clanovi@primer.rs";

	/** A moderator who holds a DIFFERENT tick, which is the refusal this route is about. */
	private static final String ANOTHER_RIGHT = "uplate@primer.rs";

	/** Signed in and holding nothing, which is most of the portal. */
	private static final String A_MEMBER = "takmicar@primer.rs";

	/**
	 * The three addresses of a group, typed in mixed case on purpose.
	 *
	 * <p>One address is one account whatever case it is typed in (owner, 08.09.2026) and
	 * the row is written folded, so „what was typed" and „what the row carries" are two
	 * different strings here. Every assertion about a row or about a letter is therefore
	 * an assertion about the fold and not only about the address.
	 */
	private static final String FIRST_TYPED = "Prva.Unesena@Primer.rs";

	private static final String SECOND_TYPED = "Druga.Unesena@Primer.rs";

	private static final String THIRD_TYPED = "Treca.Unesena@Primer.rs";

	private static final String PASSWORD = "trcim.kroz.sumu.2027";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	/** The sender the container built, so one case can point it at a dead socket. */
	@Autowired
	private JavaMailSenderImpl mailer;

	private final ObjectMapper json = new ObjectMapper();

	private final Map<String, SecretToken> sessions = new HashMap<>();

	/** A town of the codebook, read rather than written here, and the country it carries. */
	private long aTownOfTheCodebook;

	private String anotherCountry;

	@BeforeEach
	void aPortalWithPeopleAlreadyInIt() {
		account(ALREADY_HERE, "competitor", "Vec", "Ovdic");
		account(EVERYTHING, "superadmin", "Nikola", "Minic");
		account(OVER_THE_MEMBERS, "moderator", "Milica", "Clanska");
		account(ANOTHER_RIGHT, "moderator", "Marko", "Blagajnic");
		account(A_MEMBER, "competitor", "Takmicar", "Trkacki");
		account(ALSO_HERE, "competitor", "Takodje", "Ovdic");

		ticked(OVER_THE_MEMBERS, "entity:members");
		ticked(ANOTHER_RIGHT, "queue:payments");

		/* A MEMBER WHO IS ACTIVE AND HOLDS A NUMBER, so „nobody entered in a group got a
		   number" is not the same sentence as „the table holds no numbers", and so the
		   public list has somebody on it before this route runs. */
		long paid = competitor("000042", "00112233445566aa", true);
		db.sql("update account set competitor_id = ? where email = ?")
				.params(paid, ALREADY_HERE).update();

		/* And one who registered and has not paid, so „not on the public list" is not the
		   same sentence as „entered by this route". */
		long unpaid = competitor(null, "00112233445566bb", false);
		db.sql("update account set competitor_id = ? where email = ?")
				.params(unpaid, A_MEMBER).update();

		aTownOfTheCodebook = db.sql("select geonames_id from place order by rank limit 1")
				.query(Long.class).single();
		anotherCountry = db.sql("select code from country where code <> ("
						+ "select c.code from country c join place p on p.country_id = c.id"
						+ " where p.geonames_id = ?) order by code limit 1")
				.param(aTownOfTheCodebook).query(String.class).single();
	}

	/**
	 * EVERY ROW THIS CLASS WROTE, TAKEN AWAY BY HAND.
	 *
	 * <p>The accounts go FIRST and the members after them, which is not tidiness:
	 * {@code account_competitor_fk} is the one {@code on delete restrict} in this schema
	 * (V23, owner, 14.09.2026), so a member cannot leave while an account still names
	 * him. Everything else - his sessions, his tokens, his document, his guardian's
	 * consent - goes by cascade.
	 */
	@AfterEach
	void nothingThisCaseWroteOutlivesIt() {
		db.sql("delete from account").update();
		db.sql("delete from competitor").update();
	}

	/* ---------------------------------------------------------------- the happy path */

	/**
	 * THREE PEOPLE GO IN, AND WHAT EACH OF THEM IS AFTERWARDS IS READ OFF HIS OWN ROW.
	 *
	 * <p>Everything asserted here is about the SECOND of the three, whose address is
	 * {@link #SECOND_TYPED}: an assertion that read „the account this route made" would
	 * pass just as well against the first one, and PDL's own sentence is about each man.
	 */
	@Test
	void aGroupOfThreeIsEnteredAndEachManGetsHisOwnRowAndHisOwnLetter() throws Exception {
		MockHttpServletResponse answered = enter(aGroupOfThree(), EVERYTHING);

		assertThat(answered.getStatus()).as("the group was not entered: %s",
				answered.getContentAsString()).isEqualTo(201);

		String stored = folded(SECOND_TYPED);

		assertThat(accountNamed(stored)).as("no account carries the second row's address")
				.isPresent();
		assertThat(passwordOf(stored)).as("an entered member was given a password by somebody"
				+ " other than himself, which is what PDL forbids in as many words").isNull();
		assertThat(confirmedAt(stored)).as("the portal recorded a proof that nobody gave:"
				+ " his address is marked confirmed before he has read anything").isNull();
		assertThat(tokensOf(stored)).as("he was entered without an invitation, so nothing can"
				+ " ever reach him").isEqualTo(1);

		Map<String, Object> member = memberBehind(stored);

		assertThat(member.get("active")).as("an entered member is active before anybody"
				+ " recorded a fee").isEqualTo(false);
		assertThat(member.get("member_number")).as("a member number was handed out by this"
				+ " route; PDL says it is drawn when a payment is recorded and that the"
				+ " administrator never types it").isNull();
		assertThat(member.get("membership_basis")).as("the form claimed honorary membership,"
				+ " which is the owner's to grant").isEqualTo("payment");
		assertThat(member.get("referred_by")).as("somebody was credited with a referral,"
				+ " and nobody opened a link here").isNull();
		assertThat(member.get("first_season")).isEqualTo(THE_SEASON);

		assertThat(theLetterTo(stored)).as("no letter reached the second man's own address")
				.isNotNull();
	}

	/**
	 * THE MOMENT THE HEALTH STATEMENT WAS TICKED IS WRITTEN, AND IT IS THE SERVER'S CLOCK.
	 *
	 * <p>The owner, 25.09.2026: „Potrebno je da covek to poseduje i dovoljno je da kaze da
	 * ima. Ako je slagao, to je njegov problem." So the tick is the whole of it - and what
	 * the column then holds is the moment somebody said so, which is {@link #NOW} and not
	 * the moment this case runs. Without a fixed clock the two are one value and this
	 * measures nothing.
	 */
	@Test
	void theHealthStatementIsATickAndTheMomentOfItIsWritten() throws Exception {
		enter(aGroupOfThree(), EVERYTHING);

		assertThat(((Timestamp) memberBehind(folded(SECOND_TYPED)).get("health_statement_at"))
				.toInstant())
				.as("the health statement was recorded at the wall clock rather than at the"
						+ " server's own, so nothing measures which moment it is")
				.isEqualTo(NOW);
	}

	/** And without the tick the row is refused, naming the field rather than the group. */
	@Test
	void aRowWithNoHealthStatementIsRefusedAndNamesThatField() throws Exception {
		List<Map<String, Object>> group = aGroupOfThree();
		group.get(1).remove("healthStatement");

		MockHttpServletResponse answered = enter(group, EVERYTHING);

		assertThat(answered.getStatus()).isEqualTo(400);
		assertThat(rowsRefusedIn(answered))
				.containsExactly(Map.of("row", 1, "reason", "theFormIsNotComplete",
						"missing", List.of("healthStatement")));
		assertThat(howManyAccounts()).as("a row was written although the group was refused")
				.isEqualTo(6);
	}

	/* ------------------------------------------------- what the invitation opens, and whose */

	/**
	 * EVERY MAN'S LINK OPENS HIS OWN ACCOUNT AND NOT THE ACCOUNT OF ANYBODY ELSE IN THE
	 * GROUP.
	 *
	 * <p><b>The token is taken from the letter addressed to the THIRD man</b>, read by his
	 * address rather than by its place in the mailbox, and it is spent. What that must
	 * leave is a password on his account and none on the other two: a route that minted one
	 * token and mailed it three times, or that mailed every letter to the first address,
	 * would satisfy „a letter arrived" and „a password was set" and fail exactly here.
	 */
	@Test
	void theLinkInOneMansLetterOpensHisOwnAccountAndNobodyElses() throws Exception {
		enter(aGroupOfThree(), EVERYTHING);

		String his = folded(THIRD_TYPED);

		spend(theTokenInside(theLetterTo(his)));

		assertThat(passwordOf(his)).as("spending his own link did not set his password")
				.isNotNull();
		assertThat(passwordOf(folded(FIRST_TYPED))).as("one man's link set another man's"
				+ " password, so every invitation in the group is the same link").isNull();
		assertThat(passwordOf(folded(SECOND_TYPED))).isNull();
	}

	/**
	 * SPENDING THE LINK IS WHAT CONFIRMS THE ADDRESS, and not the entering.
	 *
	 * <p>The owner, 19.09.2026, on three offered outcomes: „Potvrda adrese se upisuje u
	 * trenutku kad se TOKEN POTROSI... tog trenutka je dokazao da cita tu postu." The route
	 * that spends it is {@code PasswordResetApi} and this is the same road with a third
	 * occasion on it, which is why nothing about it was written for this increment.
	 */
	@Test
	void spendingTheInvitationConfirmsTheAddressThatWasNotConfirmedBefore() throws Exception {
		enter(aGroupOfThree(), EVERYTHING);

		String his = folded(SECOND_TYPED);

		assertThat(confirmedAt(his)).isNull();

		spend(theTokenInside(theLetterTo(his)));

		assertThat(confirmedAt(his)).as("he proved he reads that mailbox and the portal did"
				+ " not write it down").isNotNull();
	}

	/**
	 * UNTIL HE SPENDS IT HE CANNOT SIGN IN, AND AFTERWARDS HE CAN.
	 *
	 * <p>„Do tada je vidljiv u ligi ALI SE NE MOZE PRIJAVITI" (PDL, owner, 31.07.2026),
	 * measured in both directions so that „he cannot sign in" is not merely „nobody knows
	 * his password".
	 */
	@Test
	void heCannotSignInUntilHeHasSpentHisInvitationAndCanAfterwards() throws Exception {
		enter(aGroupOfThree(), EVERYTHING);

		String his = folded(SECOND_TYPED);

		assertThat(signInAs(his, PASSWORD)).as("an account with no password let somebody in")
				.isNotEqualTo(204);

		spend(theTokenInside(theLetterTo(his)));

		assertThat(signInAs(his, PASSWORD)).as("he set his own password and still cannot"
				+ " sign in").isEqualTo(204);
	}

	/**
	 * AND THE TWO THINGS THAT SHUT HIM OUT ARE TWO, EITHER ONE OF WHICH IS ENOUGH.
	 *
	 * <p>This is the axis the fixture exists for. An entered account carries NO confirmed
	 * address and NO password, so a case that only ever sees both missing cannot tell a
	 * portal that checks one from a portal that checks both. Each half is put back on its
	 * own, by hand, and the answer must not change.
	 */
	@Test
	void neitherHalfAloneLetsAnEnteredManIn() throws Exception {
		enter(aGroupOfThree(), EVERYTHING);

		String his = folded(SECOND_TYPED);

		db.sql("update account set email_confirmed_at = now() where email = ?")
				.param(his).update();

		assertThat(signInAs(his, PASSWORD)).as("a confirmed address alone let an account"
				+ " with no password in").isNotEqualTo(204);

		db.sql("update account set email_confirmed_at = null where email = ?")
				.param(his).update();
		spend(theTokenInside(theLetterTo(his)));
		db.sql("update account set email_confirmed_at = null where email = ?")
				.param(his).update();

		assertThat(signInAs(his, PASSWORD)).as("a password alone let an account whose address"
				+ " nobody confirmed in").isNotEqualTo(204);
	}

	/**
	 * AN INVITATION THAT HAS RUN OUT IS NO WAY IN, AND THE ROAD BACK IS THE ONE THE OWNER
	 * WAS TOLD ABOUT WHEN HE CHOSE THE HOUR.
	 *
	 * <p>He chose one hour on 25.09.2026 between exactly two outcomes, and the price of the
	 * short one was named: somebody who opens his post that evening finds the link dead.
	 * What rescues him is {@code POST /api/password-reset/request}, which asks nothing about
	 * a role, a password or a confirmed address - <b>and that last part is what makes this
	 * case different from the ordinary reset already measured one resource along</b>, where
	 * the man asking has a password and has confirmed his address. Here he has neither.
	 */
	@Test
	void anExpiredInvitationIsDeadAndAskingAgainGetsHimAnotherThatWorks() throws Exception {
		enter(aGroupOfThree(), EVERYTHING);

		String his = folded(SECOND_TYPED);
		String dead = theTokenInside(theLetterTo(his));

		db.sql("update password_reset_token set created_at = now() - interval '2 hours',"
						+ " expires_at = now() - interval '1 hour'"
						+ " where account_id = (select id from account where email = ?)")
				.param(his).update();

		assertThat(spend(dead)).as("a link the schema had already ended still set a password")
				.isNotEqualTo(204);
		assertThat(passwordOf(his)).isNull();

		assertThat(http.perform(post("/api/password-reset/request").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content(json.writeValueAsString(Map.of("email", his))))
				.andReturn().getResponse().getStatus())
				.as("a man who was entered in a group and has neither a password nor a"
						+ " confirmed address could not ask for a link")
				.isEqualTo(204);

		spend(theTokenInside(theLastLetterTo(his)));

		assertThat(passwordOf(his)).as("the link he asked for himself did not let him set a"
				+ " password, so an expired invitation is a dead end").isNotNull();
	}

	/* ----------------------------------------------------- visible in the league, or not */

	/**
	 * „VIDLJIV U LIGI" AND „NA JAVNOM SPISKU" ARE TWO THINGS, AND THIS ROUTE MAKES THE
	 * FIRST AND NOT THE SECOND.
	 *
	 * <p>{@link CompetitorApi} serves {@code where c.active}, so an entered member is not
	 * on it until somebody records his fee - exactly as for a man who registered himself.
	 * The active member of the fixture is what makes this a statement about the FLAG rather
	 * than about the list being empty.
	 */
	@Test
	void anEnteredMemberHasARowAtOnceAndReachesThePublicListOnlyWhenHisFeeIsRecorded()
			throws Exception {

		enter(aGroupOfThree(), EVERYTHING);

		String his = folded(SECOND_TYPED);

		assertThat(memberBehind(his)).as("he was entered and the league has no row for him")
				.isNotNull();

		String list = http.perform(get("/api/competitors")).andReturn().getResponse()
				.getContentAsString();

		assertThat(list).as("the public list already carries somebody whose fee nobody has"
				+ " recorded").doesNotContain("Druga");
		assertThat(list).as("the public list carries nobody at all, so the sentence above"
				+ " would hold however this route behaved").contains("000042");

		db.sql("update competitor set active = true where id ="
						+ " (select competitor_id from account where email = ?)")
				.param(his).update();

		assertThat(http.perform(get("/api/competitors")).andReturn().getResponse()
				.getContentAsString())
				.as("his fee was recorded and he is still not on the list")
				.contains("Druga");
	}

	/* --------------------------------------------------------- one bad row, whole group */

	/**
	 * AN ADDRESS SOMEBODY ALREADY HOLDS REFUSES THE WHOLE GROUP, AND NOT ONE ROW OF IT IS
	 * WRITTEN OR SENT.
	 *
	 * <p>The bad row is the SECOND of three, which is what tells „it stopped at the bad
	 * row" apart from „it stopped before it" and from „it stopped after it": the first row
	 * is good and must not survive, and the third is good and must not be reached.
	 */
	@Test
	void oneAddressAlreadyHeldRefusesTheWholeGroupAndNothingAtAllIsWritten() throws Exception {
		List<Map<String, Object>> group = aGroupOfThree();
		group.get(1).put("email", ALREADY_HERE.toUpperCase(java.util.Locale.ROOT));

		MockHttpServletResponse answered = enter(group, EVERYTHING);

		assertThat(answered.getStatus()).isEqualTo(409);
		assertThat(rowsRefusedIn(answered)).containsExactly(
				Map.of("row", 1, "reason", "theAddressIsTaken", "missing", List.of()));

		assertThat(howManyAccounts()).as("the good rows of a refused group were left behind,"
				+ " so trying the list again answers „the address is taken" + " for them too")
				.isEqualTo(6);
		assertThat(howManyMembers()).isEqualTo(2);
		assertThat(howManyTokens()).isEqualTo(0);
		assertThat(SMTP.getReceivedMessages()).as("a letter went out for a group that was"
				+ " refused, and an invitation cannot be taken back").isEmpty();
	}

	/**
	 * THE SAME ADDRESS TWICE IN ONE GROUP IS ITS OWN SENTENCE AND NOT „SOMEBODY HOLDS IT".
	 *
	 * <p>Nobody holds it: the administration typed one person in twice, and the fix is to
	 * take a row out. Told apart by the index alone, the second row would collide with the
	 * FIRST ROW OF THIS SAME GROUP and the portal would report an account that did not
	 * exist a moment ago as somebody else's.
	 */
	@Test
	void theSameAddressTwiceInOneGroupIsSaidToBeThatAndNotAnAddressSomebodyHolds()
			throws Exception {

		List<Map<String, Object>> group = aGroupOfThree();
		group.get(2).put("email", FIRST_TYPED.toLowerCase(java.util.Locale.ROOT));

		MockHttpServletResponse answered = enter(group, EVERYTHING);

		assertThat(answered.getStatus()).isEqualTo(400);
		assertThat(rowsRefusedIn(answered)).containsExactly(
				Map.of("row", 2, "reason", "theAddressIsTwiceInTheGroup", "missing", List.of()));
		assertThat(howManyAccounts()).isEqualTo(6);
	}

	/**
	 * A ROW THAT LEFT FIELDS OUT NAMES THEM, WHICH IS THE SECOND HALF OF ADL A54.
	 *
	 * <p>„`PUT` koji ne posalje neko polje odbija se sa 400, I KAZE SE STA FALI" (owner,
	 * 19.09.2026). Two fields rather than one, so „it names what is missing" is not „it
	 * names the first thing it noticed".
	 */
	@Test
	void aRowThatLeftTwoFieldsOutNamesBothOfThem() throws Exception {
		List<Map<String, Object>> group = aGroupOfThree();
		group.get(1).remove("shirtSize");
		group.get(1).remove("gender");

		MockHttpServletResponse answered = enter(group, EVERYTHING);

		assertThat(answered.getStatus()).isEqualTo(400);
		assertThat(rowsRefusedIn(answered)).containsExactly(
				Map.of("row", 1, "reason", "theFormIsNotComplete",
						"missing", List.of("gender", "shirtSize")));
	}

	/** And an address that is not one is a different sentence from a field left out. */
	@Test
	void anAddressThatIsNotAnAddressIsToldApartFromAFieldLeftOut() throws Exception {
		List<Map<String, Object>> group = aGroupOfThree();
		group.get(1).put("email", "ovo nije adresa");

		assertThat(rowsRefusedIn(enter(group, EVERYTHING))).containsExactly(
				Map.of("row", 1, "reason", "theAddressIsNotShaped", "missing", List.of()));
	}

	/** Every bad row is named, not only the first one the route met. */
	@Test
	void twoBadRowsAreBothNamed() throws Exception {
		List<Map<String, Object>> group = aGroupOfThree();
		group.get(0).remove("fatherName");
		group.get(2).put("birthDate", "31.02.2000");

		assertThat(rowsRefusedIn(enter(group, EVERYTHING))).containsExactly(
				Map.of("row", 0, "reason", "theFormIsNotComplete",
						"missing", List.of("fatherName")),
				Map.of("row", 2, "reason", "theFormIsNotComplete",
						"missing", List.of("birthDate")));
	}

	/** A day that has not happened is not a day somebody was born on. */
	@Test
	void aDayInTheFutureIsNotADayOfBirth() throws Exception {
		List<Map<String, Object>> group = aGroupOfThree();
		group.get(1).put("birthDate", "2027-03-16");

		assertThat(rowsRefusedIn(enter(group, EVERYTHING))).containsExactly(
				Map.of("row", 1, "reason", "theFormIsNotComplete",
						"missing", List.of("birthDate")));
	}

	/* ------------------------------------------------------------- the group as a whole */

	@Test
	void aGroupWithNoRowsIsRefusedAsAGroupAndNotAsARow() throws Exception {
		assertThat(reasonIn(enter(List.of(), EVERYTHING))).isEqualTo("theGroupIsEmpty");
	}

	@Test
	void aBodyThatCarriesNoListAtAllIsTheSameAnswerAsAnEmptyOne() throws Exception {
		MockHttpServletResponse answered = http.perform(post("/api/competitors").with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content("{}")
						.cookie(new Cookie(SessionCookie.NAME,
								sessions.get(EVERYTHING).secret())))
				.andReturn().getResponse();

		assertThat(answered.getStatus()).isEqualTo(400);
		assertThat(reasonIn(answered)).isEqualTo("theGroupIsEmpty");
	}

	/**
	 * A GROUP LARGER THAN THE ROUTE TAKES IS REFUSED, AND THE ONE BELOW IT IS NOT.
	 *
	 * <p>Both sides of the boundary, because a case on one side alone cannot tell a limit
	 * of a hundred from a limit of one. The number is {@link CompetitorWriteApi} 's own and
	 * is read from there rather than written here.
	 */
	@Test
	void aGroupLargerThanTheRouteTakesIsRefusedAndTheOneBelowIsNot() throws Exception {
		assertThat(reasonIn(enter(aGroupOf(CompetitorWriteApi.THE_MOST_IN_ONE_GROUP + 1),
				EVERYTHING))).isEqualTo("theGroupIsTooBig");

		assertThat(enter(aGroupOf(CompetitorWriteApi.THE_MOST_IN_ONE_GROUP), EVERYTHING)
				.getStatus()).as("a group of exactly the largest size was refused")
				.isEqualTo(201);
	}

	/* ------------------------------------------------------------------- age and papers */

	/**
	 * A CHILD NEEDS A GUARDIAN'S SIGNATURE AND NOT AN IDENTITY NUMBER, AND A GROWN-UP THE
	 * OTHER WAY ROUND.
	 *
	 * <p>The two conditional groups move in opposite directions across one boundary, which
	 * is what {@link WhatRegistrationAsksFor} exists to say once. This route asks that
	 * class rather than carrying a list, so both directions are measured here on one group.
	 */
	@Test
	void aChildIsAskedForHisGuardianAndAGrownUpForHisIdentityNumber() throws Exception {
		List<Map<String, Object>> group = aGroupOfThree();
		group.get(1).put("birthDate", A_CHILD);
		group.get(1).remove("idNumber");
		group.get(1).remove("parentConsent");

		assertThat(rowsRefusedIn(enter(group, EVERYTHING))).containsExactly(
				Map.of("row", 1, "reason", "theFormIsNotComplete",
						"missing", List.of("parentConsent", "parentRelation")));

		group.get(2).remove("idNumber");

		assertThat(rowsRefusedIn(enter(group, EVERYTHING))).as("a grown-up was entered with"
						+ " no identity number, which the privacy policy carries as a legal"
						+ " obligation")
				.contains(Map.of("row", 2, "reason", "theFormIsNotComplete",
						"missing", List.of("idNumber")));
	}

	/** And the consent that is given is written, with the name, the relation and the moment. */
	@Test
	void aChildsConsentIsWrittenWithTheNameTheRelationAndTheMoment() throws Exception {
		List<Map<String, Object>> group = aGroupOfThree();
		group.get(1).put("birthDate", A_CHILD);
		group.get(1).remove("idNumber");
		group.get(1).put("parentConsent", "Jovana Roditeljka");
		group.get(1).put("parentRelation", "mother");

		assertThat(enter(group, EVERYTHING).getStatus()).isEqualTo(201);

		Map<String, Object> consent = db.sql("select guardian_name, relation, given_at,"
						+ " host(given_from) as given_from from parental_consent"
						+ " where competitor_id = (select competitor_id from account"
						+ " where email = ?)")
				.param(folded(SECOND_TYPED)).query().singleRow();

		assertThat(consent.get("guardian_name")).isEqualTo("Jovana Roditeljka");
		assertThat(consent.get("relation")).isEqualTo("mother");
		assertThat(((Timestamp) consent.get("given_at")).toInstant()).isEqualTo(NOW);
		assertThat(consent.get("given_from")).as("the column is `inet not null`, so a row"
				+ " with nothing in it is not a state this table has").isNotNull();

		assertThat(howManyDocumentsOf(folded(SECOND_TYPED))).as("a child of thirteen was"
				+ " given a document row, and a card is issued at sixteen").isEqualTo(0);
	}

	/** A grown-up's identity number goes into its own table and never onto the member. */
	@Test
	void aGrownUpsIdentityNumberGoesIntoItsOwnTable() throws Exception {
		enter(aGroupOfThree(), EVERYTHING);

		assertThat(howManyDocumentsOf(folded(SECOND_TYPED))).isEqualTo(1);
	}

	/** A document number that is not one is refused at every age, and before the INSERT. */
	@Test
	void aDocumentNumberThatIsNotOneIsRefused() throws Exception {
		List<Map<String, Object>> group = aGroupOfThree();
		group.get(1).put("idNumber", "ovo nije broj!");

		assertThat(rowsRefusedIn(enter(group, EVERYTHING))).containsExactly(
				Map.of("row", 1, "reason", "theFormIsNotComplete",
						"missing", List.of("idNumber")));
	}

	/* ------------------------------------------------------------------------ the town */

	/** A town typed by hand names its country, and the row carries both. */
	@Test
	void aTownTypedByHandNamesItsCountry() throws Exception {
		List<Map<String, Object>> group = aGroupOfThree();
		group.get(1).remove("placeId");
		group.get(1).put("city", "Zaselak");
		group.get(1).put("country", anotherCountry);

		assertThat(enter(group, EVERYTHING).getStatus()).isEqualTo(201);

		Map<String, Object> member = memberBehind(folded(SECOND_TYPED));

		assertThat(member.get("city")).isEqualTo("Zaselak");
		assertThat(member.get("place_id")).as("a typed town was matched against the codebook")
				.isNull();
		assertThat(member.get("country_id")).isNotNull();
	}

	/** Both shapes at once is no town at all, which is what the schema says in two checks. */
	@Test
	void aTownFromTheCodebookMayNotAlsoNameACountry() throws Exception {
		List<Map<String, Object>> group = aGroupOfThree();
		group.get(1).put("country", anotherCountry);

		assertThat(rowsRefusedIn(enter(group, EVERYTHING))).containsExactly(
				Map.of("row", 1, "reason", "theFormIsNotComplete", "missing", List.of("city")));
	}

	/** And neither shape is no town either. */
	@Test
	void aRowWithNoTownAtAllIsRefused() throws Exception {
		List<Map<String, Object>> group = aGroupOfThree();
		group.get(1).remove("placeId");

		assertThat(rowsRefusedIn(enter(group, EVERYTHING))).containsExactly(
				Map.of("row", 1, "reason", "theFormIsNotComplete", "missing", List.of("city")));
	}

	/* ------------------------------------------------------------------ who may ask */

	/**
	 * THE TICK DECIDES AND NOT THE ROLE, AND A REFUSED CALLER LEFT NOTHING BEHIND.
	 *
	 * <p>{@code RightsAtTheDoorTest} sweeps every route the door decides and asks it of a
	 * stranger and of a plain member, so that is not repeated here. What is asked here is
	 * what the sweep cannot see: that a moderator who holds a DIFFERENT tick is refused,
	 * that one who holds this one is NOT, and that the refusals wrote nothing.
	 */
	@Test
	void aModeratorWhoHoldsTheTickMayEnterAGroupAndOneWhoHoldsAnotherMayNot() throws Exception {
		assertThat(enter(aGroupOfThree(), ANOTHER_RIGHT).getStatus())
				.as("a moderator with the wrong box ticked entered members").isEqualTo(404);
		assertThat(enter(aGroupOfThree(), A_MEMBER).getStatus())
				.as("a plain member entered members").isEqualTo(404);
		assertThat(howManyAccounts()).as("a refused caller wrote rows anyway").isEqualTo(6);

		assertThat(enter(aGroupOfThree(), OVER_THE_MEMBERS).getStatus())
				.as("the one moderator who holds `entity:members` was refused, so this route"
						+ " reads the role rather than the box").isEqualTo(201);
	}

	/** Nobody at all is 401 and never 404, which is the chain rather than the route. */
	@Test
	void aStrangerIsTurnedAwayBeforeTheRouteIsReached() throws Exception {
		assertThat(http.perform(post("/api/competitors").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content(json.writeValueAsString(Map.of("members", aGroupOfThree()))))
				.andReturn().getResponse().getStatus()).isEqualTo(401);
	}

	/* ------------------------------------------------------------------------ the relay */

	/**
	 * A RELAY THAT WILL NOT TAKE THE LETTERS STOPS NEITHER THE GROUP NOR THE ROWS.
	 *
	 * <p>The rows are committed before the first letter is attempted, so answering 500
	 * would tell the administration nothing happened when everything did - and send it to
	 * type the same list again at a route that would now answer „the address is taken" for
	 * every row. The server is stopped rather than a message being made to fail, because a
	 * relay that is gone is the shape this actually takes.
	 */
	@Test
	void aRelayThatIsGoneStopsNeitherTheGroupNorTheRows() throws Exception {
		int real = mailer.getPort();
		MockHttpServletResponse answered;

		try {
			/* A socket nothing is listening on, which is what „the relay is gone" is from
			   inside this server. Put back in `finally`, so a failure here cannot leave the
			   next case sending its letters into the dark and passing for the wrong reason. */
			mailer.setPort(1);
			answered = enter(aGroupOfThree(), EVERYTHING);
		} finally {
			mailer.setPort(real);
		}

		assertThat(answered.getStatus()).as("a relay that is down turned a committed group"
				+ " into a failure the administration cannot act on").isEqualTo(201);
		assertThat(howManyMembers()).as("the rows were rolled back because of a relay")
				.isEqualTo(5);
		assertThat(howManyTokens()).as("the invitations were not written, so nothing can"
				+ " rescue these three").isEqualTo(3);
	}

	/* ------------------------------------------------------------------------- the floor */

	/**
	 * WHAT THIS ROUTE DOES NOT ASK FOR IS A SUBSET OF WHAT THE REGISTRATION ASKS, AND
	 * EVERYTHING ELSE IT ASKS IS COLLECTED.
	 *
	 * <p><b>This is the floor under a hand written list</b>, and the rule it keeps is the
	 * one of 05.09.2026: „Rucno pisan spisak nije greska. Greska je spisak bez poda." The
	 * list is {@code CompetitorWriteApi.NOT_ASKED_OF_A_GROUP}; the floor is
	 * {@link WhatRegistrationAsksFor} itself, asked at both ages, so a field added to the
	 * registration tomorrow either arrives in this route's own record or fails here - it
	 * cannot be quietly skipped.
	 */
	@Test
	void everyFieldTheRegistrationAsksForIsEitherCollectedHereOrNamedAsNotAsked() {
		Set<String> asked = new HashSet<>(
				WhatRegistrationAsksFor.from(LocalDate.parse(A_GROWN_UP), LocalDate.now()));
		asked.addAll(WhatRegistrationAsksFor.from(LocalDate.parse(A_CHILD), LocalDate.now()));

		assertThat(CompetitorWriteApi.NOT_ASKED_OF_A_GROUP)
				.as("this route excuses itself from a field the registration does not ask"
						+ " for at all, so the list is excusing nothing")
				.isSubsetOf(asked);

		Set<String> carried = new HashSet<>();

		for (java.lang.reflect.RecordComponent one
				: CompetitorWriteApi.Invited.class.getRecordComponents()) {
			carried.add(one.getName());
		}

		/* The form has ONE control for the town and the request carries three keys for it,
		   which is the same difference `RegistrationApiTest` names: `city` is answered by
		   `placeId` as much as by `city`. */
		carried.add("city");

		for (String field : asked) {
			if (!CompetitorWriteApi.NOT_ASKED_OF_A_GROUP.contains(field)) {
				assertThat(carried).as("the registration asks for `%s` and this route neither"
						+ " carries it nor names it as one it does not ask for", field)
						.contains(field);
			}
		}
	}

	/* --------------------------------------------------------------------- the fixture */

	private List<Map<String, Object>> aGroupOfThree() {
		List<Map<String, Object>> group = new ArrayList<>();

		group.add(aRow("Prva", "Prvic", "F", FIRST_TYPED, "1122334455"));
		group.add(aRow("Druga", "Drugic", "M", SECOND_TYPED, "2233445566"));
		group.add(aRow("Treca", "Trecic", "F", THIRD_TYPED, "3344556677"));

		return group;
	}

	/** A group of any size, for the two cases that are about the size and nothing else. */
	private List<Map<String, Object>> aGroupOf(int many) {
		List<Map<String, Object>> group = new ArrayList<>();

		for (int one = 0; one < many; one++) {
			group.add(aRow("Ime" + one, "Prezime" + one, one % 2 == 0 ? "M" : "F",
					"clan" + one + "@primer.rs", "90000" + one));
		}

		return group;
	}

	private Map<String, Object> aRow(String first, String last, String gender, String email,
			String idNumber) {

		Map<String, Object> row = new LinkedHashMap<>();

		row.put("firstName", first);
		row.put("lastName", last);
		row.put("fatherName", "Otac " + first);
		row.put("birthDate", A_GROWN_UP);
		row.put("gender", gender);
		row.put("firstSeason2027", true);
		row.put("email", email);
		row.put("address", "Ulica " + first + " 1");
		row.put("placeId", aTownOfTheCodebook);
		row.put("idNumber", idNumber);
		row.put("shirtSize", "M");
		row.put("healthStatement", true);

		return row;
	}

	private MockHttpServletResponse enter(List<Map<String, Object>> group, String asking)
			throws Exception {

		return http.perform(post("/api/competitors").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content(json.writeValueAsString(Map.of("members", group)))
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(asking).secret())))
				.andReturn().getResponse();
	}

	private void account(String email, String role, String first, String last) {
		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values (?, ?, ?, (select id from role where code = ?))")
				.params(first, last, email, role).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?,"
						+ " ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code) values"
						+ " ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	private long competitor(String number, String referral, boolean active) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size,"
						+ " health_statement_at)"
						+ " values (?, 'Zatecen', 'Zatecenic', 'M', date '1985-01-01',"
						+ " (select id from place order by rank limit 1), 2027, false, ?,"
						+ " 'payment', ?, '', false, 'none', 'Otac', 'Ulica 9', 'L',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, active, referral).query(Long.class).single();
	}

	/* ---------------------------------------------------------------------- what it left */

	private static String folded(String typed) {
		return typed.toLowerCase(java.util.Locale.ROOT);
	}

	private java.util.Optional<Long> accountNamed(String email) {
		return db.sql("select id from account where email = ?").param(email)
				.query(Long.class).optional();
	}

	private String passwordOf(String email) {
		return db.sql("select password_hash from account where email = ?").param(email)
				.query(String.class).optional().orElse(null);
	}

	private Instant confirmedAt(String email) {
		return db.sql("select email_confirmed_at from account where email = ?").param(email)
				.query(Instant.class).optional().orElse(null);
	}

	private int tokensOf(String email) {
		return db.sql("select count(*) from password_reset_token where account_id ="
						+ " (select id from account where email = ?)")
				.param(email).query(Integer.class).single();
	}

	private Map<String, Object> memberBehind(String email) {
		return db.sql("select c.* from competitor c join account a on a.competitor_id = c.id"
				+ " where a.email = ?").param(email).query().singleRow();
	}

	private int howManyDocumentsOf(String email) {
		return db.sql("select count(*) from competitor_document where competitor_id ="
						+ " (select competitor_id from account where email = ?)")
				.param(email).query(Integer.class).single();
	}

	private int howManyAccounts() {
		return db.sql("select count(*) from account").query(Integer.class).single();
	}

	private int howManyMembers() {
		return db.sql("select count(*) from competitor").query(Integer.class).single();
	}

	private int howManyTokens() {
		return db.sql("select count(*) from password_reset_token").query(Integer.class).single();
	}

	/* ------------------------------------------------------------------------ the post */

	/**
	 * The letter addressed to ONE man, found by his address and never by its place in the
	 * mailbox.
	 *
	 * <p>A message to the whole league satisfies „he was told" exactly as well as one to
	 * him, and the first letter in the box satisfies it for whoever happens to be first.
	 */
	private String theLetterTo(String address) {
		assertThat(SMTP.waitForIncomingEmail(5000, 3))
				.as("the three invitations did not reach the mail server in five seconds")
				.isTrue();

		return bodyOfTheLetterTo(address, false);
	}

	/** The LAST letter to one man, for the case that makes the portal send him two. */
	private String theLastLetterTo(String address) {
		assertThat(SMTP.waitForIncomingEmail(5000, 4)).isTrue();

		return bodyOfTheLetterTo(address, true);
	}

	private String bodyOfTheLetterTo(String address, boolean last) {
		String found = null;

		for (MimeMessage message : SMTP.getReceivedMessages()) {
			try {
				Address[] to = message.getAllRecipients();

				assertThat(to).as("a letter went to more than one mailbox, or to none")
						.hasSize(1);

				if (to[0].toString().equals(address)) {
					found = message.getContent().toString();

					if (!last) {
						return found;
					}
				}
			} catch (Exception unreadable) {
				throw new IllegalStateException(unreadable);
			}
		}

		assertThat(found).as("no letter at all was addressed to %s", address).isNotNull();

		return found;
	}

	/** Kept local for the same reason {@code PasswordResetApiTest} keeps its own copy. */
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

	private int spend(String token) throws Exception {
		return http.perform(post("/api/password-reset").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content(json.writeValueAsString(Map.of("token", token,
								"password", PASSWORD, "passwordRepeat", PASSWORD))))
				.andReturn().getResponse().getStatus();
	}

	private int signInAs(String email, String password) throws Exception {
		return http.perform(post("/api/sign-in").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content(json.writeValueAsString(
								Map.of("email", email, "password", password))))
				.andReturn().getResponse().getStatus();
	}

	/* --------------------------------------------------------------- reading the refusal */

	private String reasonIn(MockHttpServletResponse answered) throws Exception {
		return (String) json.readValue(answered.getContentAsString(), Map.class).get("reason");
	}

	@SuppressWarnings("unchecked")
	private List<Map<String, Object>> rowsRefusedIn(MockHttpServletResponse answered)
			throws Exception {

		return (List<Map<String, Object>>) json
				.readValue(answered.getContentAsString(), Map.class).get("rows");
	}

	/**
	 * THE CLOCK THIS FILE USES, fixed to a day in March 2027.
	 *
	 * <p>It reports {@link ZoneOffset#UTC} on purpose: whoever asks what season it is has
	 * to re-read the instant in the league's own zone, and a server that reads this one
	 * instead gets a different answer at the turn of a year.
	 */
	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisFileUses {

		@Bean
		@Primary
		Clock aClockFixedInMarch() {
			return Clock.fixed(NOW, ZoneOffset.UTC);
		}
	}
}
