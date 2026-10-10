package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.net.URI;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * A TEXT WITH A ZERO IN IT IS ANSWERED 400 ON EVERY KIND OF ROUTE THAT READS ONE, AND NOTHING IS
 * WRITTEN, AND A CALLER WHO WAS TURNED AWAY AT THE DOOR IS TOLD WHAT HE WAS ALWAYS TOLD.
 *
 * <p><b>The floor under „every" is {@code NoTextHoldsAZeroTest}'s</b>: the reader is asked about
 * every text of every body the dispatcher knows, without a server. What that cannot see is the
 * road a body takes to the reader, and the answer a refusal turns into, and those differ by kind
 * of route. This class sends one request of each kind through the whole chain - the security
 * filters, the dispatcher, the argument resolvers and the handler - and reads the answer.
 *
 * <p><b>Six kinds, and each has a way to be wrong that no other kind has.</b>
 *
 * <ul>
 * <li><b>A body bound as an argument, on a route anybody may call</b> (sign-in, the request for a
 * new password). The message converter has to be reading with the mapper the module is on; a
 * converter built with its own would read the zero and the statement behind it would answer 500.
 * <li><b>A body bound as an argument, behind a right</b> (a league, a group of members).
 * <li><b>A body read by {@link WhatWasSent}</b> (a proposal for a team): it has to be handed the
 * same mapper, and a refusal has to become the route's own {@code theFormIsNotComplete} and not
 * a server fault.
 * <li><b>A body the route reads by hand</b> (the profile, the inbox, the decision on the queue).
 * Three controllers hold the mapper themselves and each could just as well have made its own:
 * that is the mutation, and each of the three is asked.
 * <li><b>A row of a group.</b> The reader has to look inside a list of records, and the route that
 * takes one is a different route from the one that takes a flat form.
 * <li><b>A parameter that reaches a statement</b> ({@code search}), which no reader of a body
 * sees and the route asks itself.
 * </ul>
 *
 * <p><b>The control is part of every case.</b> A zero refused proves nothing about the zero unless
 * the same request without it was not turned away: for a route that answers with its own sentence
 * the control is its own success, and for one whose refusal is the container's, the control is
 * anything but that refusal - which is an empty 400, where a route's own is a sentence. So each
 * case sends the zero in every text of its form, one at a time, and then the ordinary words.
 *
 * <p><b>The door is asked first, and the order is the owner's.</b> ADL A8 (13.09.2026): the
 * server need not give away even that an address exists. A caller who is not signed in, one who
 * holds no right and one whose account names no member are each told one answer for a request
 * that is a plain failure of the form, and a zero must not change it: a body is read only
 * for somebody who is entitled to be told what is wrong with it. Asked of seven callers on six
 * routes, each with the zero and without.
 *
 * <p><b>The one thing that is not a 500 turned into a 400, and why it is said here.</b> A zero in
 * a password was accepted until now and is turned away like every other text. This reads
 * {@code btl/CLAUDE.md}, „Sav korisnicki unos se validira na backendu", and it is my reading and not a
 * decision of the owner: a password is the one text where „bez ostalih uslova" is the owner's own
 * sentence (ADL A62c), and no keyboard types a zero. If he reads it the other way the exception is
 * one place, {@link NoTextHoldsAZero}, and the password fields named in
 * {@link #aPasswordWithAZeroIsRefusedLikeEveryOtherText}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class ATextWithAZeroIsRefusedOnEveryKindOfRouteTest {

	/** The character itself, never written as an escape in this source. */
	private static final String ZERO = String.valueOf((char) 0);

	/** 11:00 in Belgrade on 20 October 2027, inside the transfer window and in the season 2027. */
	private static final Instant INSIDE_THE_WINDOW = Instant.parse("2027-10-20T09:00:00Z");

	private static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/**
	 * The same refusal on the decision on the queue, which spells every refusal as a whole sentence
	 * and not as a word ({@code VerificationWriteApi} keeps it private, so it is written out here).
	 */
	private static final String THE_DECISIONS_OWN_SENTENCE = "Forma nije popunjena.";

	/** Asks, belongs to no team, may propose one, and is written to by nobody. */
	private static final String THE_MEMBER = "991001";

	/** Visible and active, so that a message to him is written. */
	private static final String THE_ADDRESSEE = "991002";

	/** The member behind the moderator's account, and he decides about somebody else. */
	private static final String THE_MODERATORS_OWN = "991003";

	private static final String MEMBER = "nula-clan@primer.rs";

	/** Reads the list of who owes, holds nothing else, and names no member. */
	private static final String BOOKS = "nula-uplate@primer.rs";

	/** May make a league, holds nothing else, and names no member. */
	private static final String LEAGUES = "nula-lige@primer.rs";

	/** May enter members, holds nothing else, and names no member. */
	private static final String MEMBERS = "nula-clanovi@primer.rs";

	/** Decides about the profiles queue, and has a member behind his account. */
	private static final String PROFILES = "nula-profili@primer.rs";

	/** Signed in, holds no right whatever, and names no member: the account A8 is about. */
	private static final String NAMING_NO_MEMBER = "nula-bez-clana@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	/** The application's own mapper, so a request is written out the way a browser would. */
	@Autowired
	private ObjectMapper mapper;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	private int issued;

	private long theItem;

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisFileUses {

		@Bean
		@Primary
		Clock aClockInsideTheTransferWindow() {
			return Clock.fixed(INSIDE_THE_WINDOW, ZoneOffset.UTC);
		}
	}

	@BeforeEach
	void sixAccountsThreeMembersAndOneItemWaiting() {
		competitor(THE_MEMBER, "Marija", "Maric", true);
		competitor(THE_ADDRESSEE, "Jovana", "Jovic", true);
		competitor(THE_MODERATORS_OWN, "Petar", "Petrovic", true);

		account(MEMBER, "competitor", THE_MEMBER);
		account(BOOKS, "moderator", null);
		account(LEAGUES, "moderator", null);
		account(MEMBERS, "moderator", null);
		account(PROFILES, "moderator", THE_MODERATORS_OWN);
		account(NAMING_NO_MEMBER, "moderator", null);

		ticked(BOOKS, "queue:payments");
		ticked(LEAGUES, "entity:leagues");
		ticked(MEMBERS, CompetitorApi.OVER_THE_MEMBERS);
		ticked(PROFILES, "queue:profiles");

		theItem = db.sql("insert into verification (queue, competitor_id, subject, body)"
						+ " values ('profiles', (select id from competitor where member_number = ?),"
						+ " 'Biografija Jovane', 'Tekst koji ceka odluku.') returning id")
				.param(THE_ADDRESSEE).query(Long.class).single();
	}

	private void competitor(String number, String first, String last, boolean active) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, ?, 'payment',"
						+ " ?, 'Biografija koja vec stoji.', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, active, String.format("7b%014x", ++issued))
				.update();
	}

	private void account(String email, String role, String memberNumber) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values ('Roditelj', 'Roditeljevic', ?, (select id from role where code = ?),"
						+ " (select id from competitor where member_number = ?))")
				.params(email, role, memberNumber).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	/* ------------------------------------------------------------------------------------------
	   HOW A REQUEST IS SENT AND HOW AN ANSWER IS READ
	   ------------------------------------------------------------------------------------------ */

	/** Every request carries a CSRF token, or the chain answers 403 before the case is reached. */
	private MockHttpServletResponse send(MockHttpServletRequestBuilder what, String email, String body)
			throws Exception {

		MockHttpServletRequestBuilder asking = what.with(csrf());

		if (body != null) {
			asking = asking.contentType(MediaType.APPLICATION_JSON).content(body);
		}

		if (email != null) {
			asking = asking.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret()));
		}

		return http.perform(asking).andReturn().getResponse();
	}

	/** A body made of the names and values given, in that order, written by the portal's own mapper. */
	private String body(Object... namesAndValues) {
		Map<String, Object> typed = new LinkedHashMap<>();

		for (int at = 0; at < namesAndValues.length; at += 2) {
			typed.put(String.valueOf(namesAndValues[at]), namesAndValues[at + 1]);
		}

		return mapper.writeValueAsString(typed);
	}

	/** The words that carry a zero: in the middle of ordinary ones, which no rule about an end would see. */
	private static String withAZero(String text) {
		return text.substring(0, text.length() / 2) + ZERO + text.substring(text.length() / 2);
	}

	/**
	 * THE CONTAINER'S REFUSAL OF A BODY IT COULD NOT READ: 400 and nothing said. A route that
	 * refuses has a sentence and puts it in the answer, so an empty 400 is what the message
	 * converter gives and the route never saw.
	 */
	private static boolean theReadersOwnRefusal(MockHttpServletResponse answer) throws Exception {
		return answer.getStatus() == 400 && answer.getContentAsString().isEmpty();
	}

	private String reasonIn(MockHttpServletResponse answer) throws Exception {
		return answer.getContentAsString().isEmpty() ? ""
				: mapper.readTree(answer.getContentAsString()).path("reason").asString();
	}

	private long count(String sql, Object... params) {
		return db.sql(sql).params(params).query(Long.class).single();
	}

	/* ------------------------------------------------------------------------------------------
	   A BODY BOUND AS AN ARGUMENT, ON A ROUTE ANYBODY MAY CALL
	   ------------------------------------------------------------------------------------------ */

	/**
	 * SIGNING IN AND ASKING FOR A NEW PASSWORD: A ZERO IN THE ADDRESS IS A 400, AND NOT THE 500 IT
	 * WAS.
	 *
	 * <p>Measured on 09.10.2026 over a running server: {@code lower(email) = lower(?)} met a zero
	 * and the driver refused the byte. The control is each route's own answer to an address nobody
	 * has - 401 and 204 - so the zero is what changed, and nothing is written for the caller who
	 * has no session: no account is touched and no session is made.
	 */
	@Test
	void aZeroInTheAddressOfAnOpenRouteIsA400AndNotAServerFault() throws Exception {
		long sessionsBefore = count("select count(*) from account_session");

		assertThat(send(post("/api/sign-in"), null, body("email", "nepoznat@primer.rs", "password", "lozinka"))
				.getStatus())
				.as("signing in as somebody nobody has is not the 401 every no is, so the control is not"
						+ " the request it should be")
				.isEqualTo(401);
		assertThat(theReadersOwnRefusal(send(post("/api/sign-in"), null,
				body("email", withAZero("nepoznat@primer.rs"), "password", "lozinka"))))
				.as("a zero in the address of a sign-in was not refused where the body is read")
				.isTrue();

		assertThat(send(post("/api/password-reset/request"), null, body("email", "nepoznat@primer.rs"))
				.getStatus())
				.as("asking for a link for an address nobody has is not the 204 it always is")
				.isEqualTo(204);
		assertThat(theReadersOwnRefusal(send(post("/api/password-reset/request"), null,
				body("email", withAZero("nepoznat@primer.rs")))))
				.as("a zero in the address of a request for a link was not refused where the body is read")
				.isTrue();

		assertThat(count("select count(*) from account_session"))
				.as("something was written for a caller who has no session and sent texts nobody reads")
				.isEqualTo(sessionsBefore);
	}

	/**
	 * A ZERO IN A PASSWORD IS REFUSED LIKE EVERY OTHER TEXT, ON EVERY ROUTE THAT TAKES ONE.
	 *
	 * <p>This is the one place where the rule changes what a caller was told before and not only a
	 * 500 into a 400: a password with a zero in it was accepted on the three routes that set one and
	 * was a wrong password on the one that checks. The control on each is that the same request with
	 * ordinary words is not turned away by the reader (the route has its own opinion of it: an old
	 * password nobody set, a link nobody was sent).
	 */
	@Test
	void aPasswordWithAZeroIsRefusedLikeEveryOtherText() throws Exception {
		assertThat(theReadersOwnRefusal(send(post("/api/sign-in"), null,
				body("email", "nepoznat@primer.rs", "password", withAZero("lozinka")))))
				.as("a zero in the password of a sign-in was not refused where the body is read")
				.isTrue();

		assertThat(theReadersOwnRefusal(send(put("/api/me/password"), MEMBER, body("oldPassword",
				"stara lozinka", "password", "nova lozinka 1", "passwordRepeat", "nova lozinka 1"))))
				.as("the form with ordinary words was refused by the reader, so a zero is not the reason"
						+ " in the cases below")
				.isFalse();

		for (String field : List.of("oldPassword", "password", "passwordRepeat")) {
			Map<String, Object> form = new LinkedHashMap<>(Map.of("oldPassword", "stara lozinka",
					"password", "nova lozinka 1", "passwordRepeat", "nova lozinka 1"));

			form.put(field, withAZero(String.valueOf(form.get(field))));

			assertThat(theReadersOwnRefusal(send(put("/api/me/password"), MEMBER,
					mapper.writeValueAsString(form))))
					.as("a zero in %s of the change of a password was not refused where the body is read",
							field)
					.isTrue();
		}

		for (String field : List.of("password", "passwordRepeat")) {
			Map<String, Object> form = new LinkedHashMap<>(Map.of("token", "nijedan-token",
					"password", "nova lozinka 1", "passwordRepeat", "nova lozinka 1"));

			form.put(field, withAZero(String.valueOf(form.get(field))));

			assertThat(theReadersOwnRefusal(send(post("/api/password-reset"), null,
					mapper.writeValueAsString(form))))
					.as("a zero in %s of the setting of a password was not refused where the body is read",
							field)
					.isTrue();
		}
	}

	/* ------------------------------------------------------------------------------------------
	   A BODY BOUND AS AN ARGUMENT, BEHIND A RIGHT
	   ------------------------------------------------------------------------------------------ */

	/**
	 * A LEAGUE WITH A ZERO IN ANY OF ITS TEXTS IS A 400 FROM THE READER, AND NOTHING IS MADE.
	 *
	 * <p>The control is the league itself: made, 201, with the season of the day this file is pinned
	 * to. Each of the three texts a league has is asked on its own, so a rule about the name alone
	 * would not satisfy it.
	 */
	@Test
	void aLeagueWithAZeroInAnyOfItsTextsIsRefusedByTheReaderAndNothingIsMade() throws Exception {
		long leagues = count("select count(*) from league");

		for (String field : List.of("name", "rules", "prizes")) {
			Map<String, Object> form = new LinkedHashMap<>();

			form.put("name", "Nulta liga");
			form.put("slug", "nulta-liga");
			form.put("season", 2027);
			form.put("rules", "Pravila lige.");
			form.put("prizes", "Nagrade lige.");
			form.put(field, withAZero(String.valueOf(form.get(field))));

			assertThat(theReadersOwnRefusal(send(post("/api/leagues"), LEAGUES, mapper.writeValueAsString(form))))
					.as("a zero in %s of a league was not refused where the body is read", field)
					.isTrue();
		}

		assertThat(count("select count(*) from league"))
				.as("a league was made out of a body the reader turned away")
				.isEqualTo(leagues);

		MockHttpServletResponse made = send(post("/api/leagues"), LEAGUES, body("name", "Nulta liga",
				"slug", "nulta-liga", "season", 2027, "rules", "Pravila lige.", "prizes", "Nagrade lige."));

		assertThat(made.getStatus())
				.as("the same league without a zero was not made, so the cases above refused a body for"
						+ " some other reason: %s", made.getContentAsString())
				.isEqualTo(201);
	}

	/**
	 * A ROW OF A GROUP: THE READER LOOKS INSIDE A LIST OF RECORDS.
	 *
	 * <p>A group is a list of the same form the registration is, and a zero in the second of two rows
	 * is the case a reader that looked only at the top of a body would miss. The control is the same
	 * two rows without it: the route turns them away for being incomplete, with its own sentence in the
	 * answer, and that sentence is how the two refusals are told apart.
	 */
	@Test
	void aZeroInTheSecondRowOfAGroupIsRefusedByTheReader() throws Exception {
		assertThat(theReadersOwnRefusal(send(post("/api/competitors"), MEMBERS, group("Ana", withAZero("Mira")))))
				.as("a zero in a row of a group, the second of two, was not refused where the body is read")
				.isTrue();

		MockHttpServletResponse withoutIt = send(post("/api/competitors"), MEMBERS, group("Ana", "Mira"));

		assertThat(theReadersOwnRefusal(withoutIt))
				.as("the same two rows without a zero were refused by the reader, so the zero is not the"
						+ " reason: %s", withoutIt.getContentAsString())
				.isFalse();
		assertThat(withoutIt.getStatus())
				.as("two rows that name only a first name are the route's to refuse")
				.isEqualTo(400);
		assertThat(withoutIt.getContentAsString())
				.as("the route's own refusal says something; the reader's does not")
				.isNotEmpty();
	}

	private String group(String first, String second) {
		ObjectNode group = mapper.createObjectNode();
		ArrayNode members = group.putArray("members");

		members.add(mapper.createObjectNode().put("firstName", first));
		members.add(mapper.createObjectNode().put("firstName", second));

		return mapper.writeValueAsString(group);
	}

	/* ------------------------------------------------------------------------------------------
	   A BODY READ BY WhatWasSent
	   ------------------------------------------------------------------------------------------ */

	/**
	 * A PROPOSAL FOR A TEAM WITH A ZERO IN ANY OF ITS SIX TEXTS IS THE ROUTE'S OWN
	 * {@code theFormIsNotComplete}, AND NOTHING IS PROPOSED.
	 *
	 * <p>{@link WhatWasSent} is handed the application's mapper by {@code WhatWasSent.Reading} and
	 * turns a {@code JacksonException} into „nothing", which the route answers in its own words. A
	 * mapper of its own would read the zero, and the insert behind it would be a 500. The control is
	 * the proposal itself: 201, and a row.
	 */
	@Test
	void aProposalWithAZeroInAnyOfItsTextsIsTheRoutesOwnRefusalAndNothingIsProposed() throws Exception {
		for (String field : List.of("name", "note", "bio", "link", "city", "country")) {
			Map<String, Object> form = new LinkedHashMap<>();

			form.put("name", "Nulti tim");
			form.put("note", "Zasto ovaj tim.");
			form.put("bio", "Opis tima.");
			form.put("link", "https://primer.rs/tim");
			form.put("city", "Novi Sad");
			form.put("country", "RS");
			form.put(field, withAZero(String.valueOf(form.get(field))));

			MockHttpServletResponse answer = send(post("/api/teams"), MEMBER, mapper.writeValueAsString(form));

			assertThat(answer.getStatus())
					.as("a zero in %s of a proposal was not turned away", field)
					.isEqualTo(400);
			assertThat(reasonIn(answer))
					.as("a zero in %s of a proposal was refused, but not in the route's own words", field)
					.isEqualTo(THE_FORM_IS_NOT_COMPLETE);
		}

		assertThat(count("select count(*) from team_proposal"))
				.as("a proposal was written out of a body the route could not read")
				.isZero();

		MockHttpServletResponse made = send(post("/api/teams"), MEMBER, body("name", "Nulti tim", "note",
				"Zasto ovaj tim.", "bio", "Opis tima.", "link", "https://primer.rs/tim", "city", "Novi Sad",
				"country", "RS"));

		assertThat(made.getStatus())
				.as("the same proposal without a zero was not accepted, so the cases above refused a body for"
						+ " some other reason: %s", made.getContentAsString())
				.isEqualTo(201);
	}

	/* ------------------------------------------------------------------------------------------
	   THE ROUTES THAT READ THEIR BODY BY HAND
	   ------------------------------------------------------------------------------------------ */

	/**
	 * THE PROFILE: A ZERO IN ANY OF ITS EIGHT TEXTS IS {@code theFormIsNotComplete}, AND THE MEMBER IS
	 * AS HE WAS.
	 *
	 * <p>This route reads the body into a tree and then turns the tree into a record, so it is the one
	 * that needs the module on the second step and not only the first. Nothing of it may move: the
	 * member's row is read before and after, whole, and no text is put in front of a moderator.
	 */
	@Test
	void aProfileWithAZeroInAnyOfItsTextsIsRefusedInTheRoutesOwnWordsAndTheMemberIsAsHeWas()
			throws Exception {

		List<Object> row = theRowOfTheMember();

		for (String field : List.of("bio", "firstName", "lastName", "address", "phone", "city", "country",
				"shirtSize")) {

			Map<String, Object> form = new LinkedHashMap<>();

			form.put("bio", "Nova biografija.");
			form.put("firstName", "Marijana");
			form.put("lastName", "Maricic");
			form.put("address", "Ulica 2");
			form.put("phone", "+381 60 1234567");
			form.put("city", "Beograd");
			form.put("country", "RS");
			form.put("shirtSize", "M");
			form.put(field, withAZero(String.valueOf(form.get(field))));

			MockHttpServletResponse answer = send(put("/api/me"), MEMBER, mapper.writeValueAsString(form));

			assertThat(answer.getStatus())
					.as("a zero in %s of a profile was not turned away", field)
					.isEqualTo(400);
			assertThat(reasonIn(answer))
					.as("a zero in %s of a profile was refused, but not in the route's own words", field)
					.isEqualTo(THE_FORM_IS_NOT_COMPLETE);
			assertThat(theRowOfTheMember())
					.as("a zero in %s of a profile moved something on the member", field)
					.isEqualTo(row);
		}

		assertThat(count("select count(*) from verification where queue = 'profiles' and competitor_id ="
				+ " (select id from competitor where member_number = ?)", THE_MEMBER))
				.as("a text was put in front of a moderator out of a body the route could not read")
				.isZero();

		assertThat(send(put("/api/me"), MEMBER, body("bio", "Nova biografija.", "firstName", "Marijana"))
				.getStatus())
				.as("the same profile without a zero was not accepted, so the cases above refused a body"
						+ " for some other reason")
				.isEqualTo(200);
	}

	private List<Object> theRowOfTheMember() {
		return db.sql("select bio, first_name, last_name, address, phone, city, shirt_size, place_id"
						+ " from competitor where member_number = ?")
				.param(THE_MEMBER)
				.query((rows, at) -> List.<Object>of(String.valueOf(rows.getString(1)),
						String.valueOf(rows.getString(2)), String.valueOf(rows.getString(3)),
						String.valueOf(rows.getString(4)), String.valueOf(rows.getString(5)),
						String.valueOf(rows.getString(6)), String.valueOf(rows.getString(7)),
						String.valueOf(rows.getObject(8))))
				.single();
	}

	/**
	 * THE INBOX: A ZERO IN THE ADDRESSEE, THE SUBJECT OR THE TEXT IS {@code theFormIsNotComplete},
	 * AND NO MESSAGE IS WRITTEN.
	 */
	@Test
	void aMessageWithAZeroInAnyOfItsTextsIsRefusedInTheRoutesOwnWordsAndNoneIsWritten() throws Exception {
		long messages = count("select count(*) from message");

		for (String field : List.of("to", "subject", "body")) {
			Map<String, Object> form = new LinkedHashMap<>();

			form.put("to", THE_ADDRESSEE);
			form.put("subject", "Prevoz do Zlatibora");
			form.put("body", "Krecem u petak u sest.");
			form.put(field, withAZero(String.valueOf(form.get(field))));

			MockHttpServletResponse answer = send(post("/api/inbox"), MEMBER, mapper.writeValueAsString(form));

			assertThat(answer.getStatus())
					.as("a zero in %s of a message was not turned away", field)
					.isEqualTo(400);
			assertThat(reasonIn(answer))
					.as("a zero in %s of a message was refused, but not in the route's own words", field)
					.isEqualTo(THE_FORM_IS_NOT_COMPLETE);
		}

		assertThat(count("select count(*) from message"))
				.as("a message was written out of a body the route could not read")
				.isEqualTo(messages);

		assertThat(send(post("/api/inbox"), MEMBER, body("to", THE_ADDRESSEE, "subject", "Prevoz do Zlatibora",
				"body", "Krecem u petak u sest.")).getStatus())
				.as("the same message without a zero was not written, so the cases above refused a body for"
						+ " some other reason")
				.isEqualTo(201);
	}

	/**
	 * THE DECISION ON THE QUEUE: A ZERO IN THE REASON IS ITS OWN „FORMA NIJE POPUNJENA", AND THE ITEM
	 * IS STILL WAITING.
	 *
	 * <p>The zero goes first and the control after it, because the control decides the item: the case
	 * would otherwise be asking about an item somebody had already answered.
	 */
	@Test
	void aDecisionWithAZeroInTheReasonIsRefusedInTheRoutesOwnWordsAndTheItemWaits() throws Exception {
		String where = "/api/verification/" + theItem + "/decision";

		MockHttpServletResponse answer = send(post(where), PROFILES,
				body("approved", false, "reason", withAZero("Slika je mutna")));

		assertThat(answer.getStatus()).as("a zero in the reason of a decision was not turned away").isEqualTo(400);
		assertThat(reasonIn(answer))
				.as("a zero in the reason of a decision was refused, but not in the route's own words")
				.isEqualTo(THE_DECISIONS_OWN_SENTENCE);
		assertThat(db.sql("select state from verification where id = ?").param(theItem)
				.query(String.class).single())
				.as("an item was answered out of a body the route could not read")
				.isEqualTo("waiting");

		assertThat(send(post(where), PROFILES, body("approved", false, "reason", "Slika je mutna")).getStatus())
				.as("the same decision without a zero was not carried out, so the case above refused a body"
						+ " for some other reason")
				.isEqualTo(200);
		assertThat(db.sql("select state from verification where id = ?").param(theItem)
				.query(String.class).single())
				.isEqualTo("rejected");
	}

	/* ------------------------------------------------------------------------------------------
	   A PARAMETER THAT REACHES A STATEMENT, AND A PATH
	   ------------------------------------------------------------------------------------------ */

	/**
	 * THE LIST OF WHO OWES, NARROWED BY A TERM WITH A ZERO IN IT, IS A 400.
	 *
	 * <p>The one parameter of this portal that is put into a statement as it was typed. Measured on
	 * 09.10.2026 as a 500 for {@code search=%00}. The request parameter is built as the container
	 * hands it over, the decoded character, because that is what {@code %00} becomes before any
	 * handler sees it. The control is the same list narrowed by ordinary words, and not narrowed at
	 * all.
	 */
	@Test
	void aSearchTermWithAZeroInItIsA400AndNotAServerFault() throws Exception {
		assertThat(send(get("/api/payments").param("search", ZERO), BOOKS, null).getStatus())
				.as("a term that is a zero was put into a statement")
				.isEqualTo(400);
		assertThat(send(get("/api/payments").param("search", withAZero("Marko")), BOOKS, null).getStatus())
				.as("a term with a zero inside it was put into a statement")
				.isEqualTo(400);

		assertThat(send(get("/api/payments").param("search", "Marko"), BOOKS, null).getStatus())
				.as("the same list narrowed by ordinary words was refused")
				.isEqualTo(200);
		assertThat(send(get("/api/payments"), BOOKS, null).getStatus())
				.as("the list asked for with no term at all was refused")
				.isEqualTo(200);
	}

	/**
	 * A ZERO IN A PATH NEVER REACHES A HANDLER.
	 *
	 * <p>{@code %00} in a path is refused before any route is chosen: the container answered 400
	 * over a socket (measured on 09.10.2026) and the filter chain answers the same here. It matters
	 * because four routes put a path variable into a statement or a comparison as a text, and
	 * nothing in them asks about a zero.
	 */
	@Test
	void aZeroInAPathIsRefusedBeforeAnyRouteIsChosen() throws Exception {
		assertThat(http.perform(get(URI.create("/api/photos/%00"))).andReturn().getResponse().getStatus())
				.as("a zero in a path reached the routes of the portal")
				.isEqualTo(400);
	}

	/* ------------------------------------------------------------------------------------------
	   THE DOOR IS ASKED FIRST
	   ------------------------------------------------------------------------------------------ */

	/** One caller on one route, and how the request is made once the text it carries is chosen. */
	private record AtTheDoor(String what, Function<String, MockHttpServletRequestBuilder> asking,
			String caller, int told) {
	}

	private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder what, String body) {
		return what.contentType(MediaType.APPLICATION_JSON).content(body);
	}

	/**
	 * A CALLER WHO IS TURNED AWAY AT THE DOOR IS TOLD THE SAME THING WHETHER HIS BODY HOLDS A ZERO OR
	 * NOT.
	 *
	 * <p>ADL A8: the server need not give away even that an address exists, and a body is read only
	 * for somebody who is entitled to be told what is wrong with it. A reader that refused a zero
	 * before the door was asked would answer 400 here and 401 or 404 there, and that difference is a
	 * route that exists. Each caller is pinned to the number he is told, so that two answers that are
	 * both a fault are not "the same", and the answer to the zero is compared to the answer to ordinary
	 * words byte for byte.
	 *
	 * <p>Seven doors: nobody signed in on a route that needs a right; a member holding nothing on that
	 * route and on the list of who owes (where the term is a parameter); and an account that names no
	 * member on the three routes that ask which member it is before they read a word, plus the
	 * decision, where the right to the item is the door.
	 */
	@Test
	void aCallerTurnedAwayAtTheDoorIsToldTheSameWhateverTheBodyHolds() throws Exception {
		String decision = "/api/verification/" + theItem + "/decision";
		List<AtTheDoor> doors = List.of(
				new AtTheDoor("nobody signed in, a league",
						text -> json(post("/api/leagues"), body("name", text, "slug", "nulta-liga",
								"season", 2027, "rules", "", "prizes", "")),
						null, 401),
				new AtTheDoor("a member holding nothing, a league",
						text -> json(post("/api/leagues"), body("name", text, "slug", "nulta-liga",
								"season", 2027, "rules", "", "prizes", "")),
						MEMBER, 404),
				new AtTheDoor("an account naming no member, the profile",
						text -> json(put("/api/me"), body("bio", text)), NAMING_NO_MEMBER, 404),
				new AtTheDoor("an account naming no member, the inbox",
						text -> json(post("/api/inbox"), body("to", THE_ADDRESSEE, "subject", text,
								"body", "Telo.")),
						NAMING_NO_MEMBER, 404),
				new AtTheDoor("an account naming no member, a proposal",
						text -> json(post("/api/teams"), body("name", text, "note", "Zasto.",
								"city", "Novi Sad", "country", "RS")),
						NAMING_NO_MEMBER, 404),
				new AtTheDoor("a moderator with no right to the queue, the decision",
						text -> json(post(decision), body("approved", false, "reason", text)),
						NAMING_NO_MEMBER, 404),
				new AtTheDoor("a member holding nothing, the list of who owes",
						text -> get("/api/payments").param("search", text), MEMBER, 404));

		List<String> wrong = new ArrayList<>();

		for (AtTheDoor door : doors) {
			MockHttpServletResponse withIt =
					send(door.asking().apply(withAZero("Ordinarne reci")), door.caller(), null);
			MockHttpServletResponse without =
					send(door.asking().apply("Ordinarne reci"), door.caller(), null);

			if (without.getStatus() != door.told()) {
				wrong.add(door.what() + ": the control was told " + without.getStatus() + " and not "
						+ door.told());
			}
			if (withIt.getStatus() != without.getStatus()) {
				wrong.add(door.what() + ": with a zero he was told " + withIt.getStatus() + ", without it "
						+ without.getStatus());
			}
			if (!withIt.getContentAsString().equals(without.getContentAsString())) {
				wrong.add(door.what() + ": the two answers have the same number and say different things");
			}
		}

		assertThat(wrong)
				.as("a caller turned away at the door learnt something from a zero in a text of his body")
				.isEmpty();
	}
}
