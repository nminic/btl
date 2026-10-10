package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.account.StoredPassword;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.web.access.WebInvocationPrivilegeEvaluator;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.condition.PathPatternsRequestCondition;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static java.util.Map.entry;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * NO WRITE THAT IS A MEMBER'S OWN TAKES A MEMBER WHO HAS NOT PAID, AND EVERY WRITE THE PORTAL MAPS
 * IS ON ONE OF FOUR NAMED LISTS, READ OFF THE DISPATCHER (P8U).
 *
 * <p><b>The decision, as PDL P8 records the owner's choice of 10.10.2026 between offered
 * outcomes</b> (sidro „Šta sme neplaćen član: registracija, plaćanje i nalog"): „Sme: izbor
 * kategorije i plaćanje, lozinku, adresu pošte i svoje podatke za evidenciju i majicu. Ne sme ništa
 * što ga čini vidljivim ili ga uključuje u ligu: sliku, biografiju, skrivanje profila, timove,
 * parove, komentare, najave i rezultate." It sits under the older line „Pre plaćanja član sme da
 * otvori nalog, ali nigde nije vidljiv i ne može ništa da radi u sistemu". The refusal is ADL A8's:
 * „prijavljen kome pravo nedostaje dobija 404", the answer of an address that maps nothing.
 *
 * <p><b>THE FOUR LISTS, and a write the dispatcher maps tomorrow fails here until it is on one of
 * them</b>, compared exactly and in both directions, so a name on a list that is not a route fails
 * as loudly as a route on no list:
 *
 * <ul>
 * <li>{@link #AN_ACT_OF_HIS_OWN}: what a member who has not paid may not do, each with the request a
 * member sends about his OWN row - his team, his result, his pair, the question addressed to him.
 * <li>{@link #MAY_BEFORE_PAYING}: what he may, each with the words of the decision it comes from.
 * <li>{@link #THE_ADMINISTRATIONS_ON_THE_ROW}: what no member does as a member, whose right is read
 * off the row it acts on (ADL A8, 18.09.2026), so the fee has nothing to say about it.
 * <li>{@link #NOT_A_WRITE_OF_THE_PORTAL}: Spring's own error document.
 * </ul>
 *
 * <p>The routes a right decides at the door are not asked about: a member as such never opens them,
 * and {@code RightsAtTheDoorTest} holds that a competitor is answered 404 by every one of them.
 *
 * <p><b>EVERY ACT IS ASKED OF FIVE CALLERS, AND THE AXES ARE NAMED SO THAT A SOURCE CANNOT STAND IN
 * FOR ANOTHER.</b>
 *
 * <ul>
 * <li><b>Who is asking:</b> a member who never paid (no number, V16), one whose fee has lapsed and who
 * holds a {@code membership} row for 2027 anyway (so a gate reading „has a membership row" instead of
 * the fee lets him through), a moderator whose own member has not paid (being the administration
 * opens no member's act), an account that names no member, and a member whose fee stands.
 * <li><b>Whose activity:</b> on every act that names somebody else - the half asked, the addressee,
 * the team's leader, the applicant, the invited - that somebody is a member whose fee stands, so a
 * gate that read HIS fee instead of the caller's would let the caller through and fail here.
 * <li><b>The body:</b> the request the form sends, and on every route that takes JSON, a body that
 * cannot be read. The second must be refused exactly like the first, which is what shows the fee is
 * asked before the body is read.
 * <li><b>The anchor:</b> the member whose fee stands sends the same request about his own row and is
 * NOT turned away, and something is written - so the refusals above are the fee and not a request
 * that was simply broken.
 * </ul>
 *
 * <p><b>„Nothing is written" is asked of the database and not of a table somebody remembered.</b>
 * {@code pg_stat_xact_user_tables} counts every row this transaction inserted, updated or deleted in
 * every table there is; a refusal must leave every count where it was, and the anchor must move one.
 *
 * <p><b>What this cannot see, and where it is held instead.</b> MockMvc runs no ERROR dispatch, so a
 * refusal written as a status on the response and one sent through the container look alike here;
 * that a member who has not paid is answered byte for byte what an account naming no member is
 * answered is measured over a real socket in {@code ABodyIsReadAfterTheDoorOverRealHttpTest}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class NoWriteTakesAMemberWhoHasNotPaidTest {

	/** Inside the transfer window (it opens on 15 October), so the season being formed is 2027. */
	private static final Instant NOW = Instant.parse("2026-11-02T10:00:00Z");

	private static final String PASSWORD = "lozinka-koja-je-dovoljno-duga";

	/* THE CALLERS, by the tag every message below names them with. */

	static final String PAID = "placen";

	static final String NEVER_PAID = "nikad-placen";

	static final String LAPSED = "istekao";

	static final String A_MODERATOR_WHO_HAS_NOT_PAID = "moderator-neplacen";

	static final String NAMES_NO_MEMBER = "bez-clana";

	/** A number of a member whose fee stands, written to by {@code POST /api/inbox}. */
	private static final String ADDRESSEE = "993030";

	/** A member whose fee stands and who is in no team, invited by every team that invites here. */
	private static final String INVITED = "993060";

	/** A member whose fee stands, invited by each caller's own team before the case begins. */
	private static final String INVITED_EARLIER = "993061";

	/** Each a different way of being a member whose fee does not stand. */
	private static final List<String> TURNED_AWAY = List.of(NEVER_PAID, LAPSED,
			A_MODERATOR_WHO_HAS_NOT_PAID);

	/** Who an act is sent about, and the request a member sends about his own row. */
	@FunctionalInterface
	interface Act {

		AbstractMockHttpServletRequestBuilder<?> about(NoWriteTakesAMemberWhoHasNotPaidTest fixture,
				String owner);
	}

	/**
	 * WHAT A MEMBER WHO HAS NOT PAID MAY NOT DO, AND HOW A MEMBER ASKS FOR EACH ABOUT WHAT IS HIS.
	 *
	 * <p>Every route here is on the second list of PDL P8 (10.10.2026), by the word in the comment
	 * beside it. Two are reached by derivation rather than by a word, and say so.
	 */
	static final Map<String, Act> AN_ACT_OF_HIS_OWN = Map.ofEntries(
			/* „komentare" */
			entry("POST /api/comments", (f, owner) -> json(post("/api/comments"), "{\"eventId\":"
					+ f.pastEvent + ",\"organisation\":5,\"value\":4,\"ambience\":3,\"body\":\"Lepo\"}")),
			/* „najave" */
			entry("PUT /api/attendance/{id}", (f, owner) -> put("/api/attendance/" + f.futureEvent)),
			entry("DELETE /api/attendance/{id}", (f, owner) -> delete("/api/attendance/"
					+ f.goingToTheFutureEvent(owner))),
			/* „rezultate" */
			entry("POST /api/results", (f, owner) -> json(post("/api/results"), "{\"raceId\":"
					+ f.pastRace + ",\"seconds\":3600,\"link\":\"https://rezultati.rs/b257\"}")),
			entry("PUT /api/results/{id}", (f, owner) -> json(put("/api/results/" + f.ownResult(owner)),
					"{\"seconds\":3500,\"link\":\"https://rezultati.rs/b257-ispravka\"}")),
			entry("DELETE /api/results/{id}", (f, owner) -> delete("/api/results/" + f.ownResult(owner))),
			/* „parove" - and answering „Odbij", which is where a member who had not paid got through */
			entry("POST /api/pairs", (f, owner) -> json(post("/api/pairs"),
					"{\"memberNumber\":\"" + f.numberOf(f.womanOf(owner)) + "\"}")),
			entry("PUT /api/pairs/{id}", (f, owner) -> json(put("/api/pairs/" + f.questionToHim(owner)),
					"{\"accepted\":false}")),
			entry("DELETE /api/pairs/{id}", (f, owner) -> delete("/api/pairs/" + f.ownPair(owner))),
			/* „timove" */
			entry("POST /api/teams", (f, owner) -> json(post("/api/teams"), "{\"name\":\"Tim b257 "
					+ owner + "\",\"city\":\"Beograd\",\"country\":\"RS\"}")),
			entry("DELETE /api/teams/{id}/membership", (f, owner) -> delete("/api/teams/"
					+ f.ownTeam(owner) + "/membership")),
			entry("DELETE /api/teams/{id}", (f, owner) -> delete("/api/teams/" + f.ownTeam(owner))),
			entry("POST /api/teams/{id}/applications", (f, owner) -> post("/api/teams/"
					+ f.anotherTeam() + "/applications")),
			entry("PUT /api/teams/{id}/applications/{application}", (f, owner) -> json(
					put("/api/teams/" + f.ownTeam(owner) + "/applications/"
							+ f.applicationToHisTeam(owner)), "{\"accepted\":true}")),
			entry("DELETE /api/teams/{id}/applications/{application}", (f, owner) -> delete(
					"/api/teams/" + f.anotherTeam() + "/applications/" + f.ownApplication(owner))),
			entry("POST /api/teams/{id}/invitations", (f, owner) -> json(post("/api/teams/"
					+ f.ownTeam(owner) + "/invitations"), "{\"memberNumber\":\"" + INVITED + "\"}")),
			entry("PUT /api/teams/{id}/invitations/{invitation}", (f, owner) -> json(
					put("/api/teams/" + f.anotherTeam() + "/invitations/" + f.invitationToHim(owner)),
					"{\"accepted\":true}")),
			entry("DELETE /api/teams/{id}/invitations/{invitation}", (f, owner) -> delete("/api/teams/"
					+ f.ownTeam(owner) + "/invitations/" + f.invitationFromHisTeam(owner))),
			/* „sliku": sending one, and taking his own down, which is on the list by its subject */
			entry("POST /api/me/photo", (f, owner) -> multipart("/api/me/photo")
					.file(new MockMultipartFile("picture", "p.jpg", MediaType.IMAGE_JPEG_VALUE,
							new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 'b', '2', '5', '7'}))
					.param("cropX", "0.5").param("cropY", "0.5").param("cropSize", "0.5")),
			entry("DELETE /api/me/photo", (f, owner) -> {
				f.ownPhoto(owner);
				return delete("/api/me/photo");
			}),
			/* a message names its sender to the member who reads it, and PDL P8 of 19.09.2026 calls
			   this exact road „kvar a ne rupa u odluci" */
			entry("POST /api/inbox", (f, owner) -> json(post("/api/inbox"),
					"{\"to\":\"" + ADDRESSEE + "\",\"subject\":\"Pozdrav\",\"body\":\"Tekst\"}")),
			/* derived: not on the list of what he may, so the older line holds, „ne može ništa da
			   radi u sistemu"; and of the lapsed PDL P13 says the mailbox is one „koje ne može da
			   otvori" */
			entry("POST /api/inbox/{id}/read", (f, owner) -> post("/api/inbox/" + f.messageToHim(owner)
					+ "/read")));

	/** How a member asks for something he MAY do before he pays, or {@code null} for a route that
	 *  reads no session at all and is open by name. */
	record Before(String reason, Act act) {
	}

	/**
	 * WHAT A MEMBER WHO HAS NOT PAID MAY DO, EACH WITH THE WORDS OF PDL P8 (10.10.2026) IT STANDS ON.
	 */
	static final Map<String, Before> MAY_BEFORE_PAYING = Map.ofEntries(
			entry("PUT /api/me", new Before("„svoje podatke za evidenciju i majicu\"; the biography and"
					+ " the switch are refused field by field, see MeWriteApiTest",
					(f, owner) -> json(put("/api/me"), "{\"phone\":\"0601234567\"}"))),
			entry("PUT /api/me/category", new Before("„izbor kategorije\"",
					(f, owner) -> json(put("/api/me/category"), "{\"firstSeason\":false}"))),
			entry("POST /api/me/membership", new Before("„plaćanje\": his own membership, out of his"
					+ " balance", (f, owner) -> post("/api/me/membership"))),
			entry("PUT /api/me/password", new Before("„lozinku\"", (f, owner) -> json(
					put("/api/me/password"), "{\"oldPassword\":\"" + PASSWORD + "\",\"password\":"
							+ "\"nova-lozinka-koja-je-duga\",\"passwordRepeat\":\"nova-lozinka-koja-je-duga\"}"))),
			entry("POST /api/sign-in", new Before("„nalog\", the heading of the decision; and „Prijava"
					+ " ostaje netaknuta: ona ne čita članarinu\" (PDL P13, 19.09.2026)",
					(f, owner) -> json(post("/api/sign-in"), "{\"email\":\"" + emailOf(owner)
							+ "\",\"password\":\"" + PASSWORD + "\"}"))),
			entry("POST /api/sign-out", new Before("„nalog\", the heading of the decision; derived, and"
					+ " open by name in ApiSecurity", (f, owner) -> post("/api/sign-out"))),
			entry("POST /api/registration", new Before("„registracija\", the heading of the decision;"
					+ " open by name, reads no session", null)),
			entry("POST /api/email-confirmation", new Before("„adresu pošte\"; open by name", null)),
			entry("POST /api/email-confirmation/resend", new Before("„adresu pošte\"; open by name",
					null)),
			entry("POST /api/password-reset", new Before("„lozinku\"; open by name", null)),
			entry("POST /api/password-reset/request", new Before("„lozinku\"; open by name", null)));

	/** What no member does as a member: the right is read off the row (ADL A8, 18.09.2026). */
	static final Map<String, String> THE_ADMINISTRATIONS_ON_THE_ROW = Map.of(
			"POST /api/verification/{id}/hold", "a moderator holding a queue row while he reads it",
			"DELETE /api/verification/{id}/hold", "and letting it go",
			"POST /api/verification/{id}/decision", "and deciding it");

	static final Map<String, String> NOT_A_WRITE_OF_THE_PORTAL = Map.of("ANY /error",
			"Spring's own error document, which the container dispatches to and which writes nothing");

	private static final Path PHOTOS = aFolderOfThisRunsOwn();

	private static Path aFolderOfThisRunsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-p8u-");
		}
		catch (IOException none) {
			throw new UncheckedIOException(none);
		}
	}

	@DynamicPropertySource
	static void thePortalKeepsItsPicturesHere(DynamicPropertyRegistry registry) {
		registry.add("btl.photos.folder", PHOTOS::toString);
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	@Qualifier("requestMappingHandlerMapping")
	private RequestMappingHandlerMapping mappings;

	@Autowired
	private WebInvocationPrivilegeEvaluator privileges;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	/** {@code competitor.id} of each caller that names a member. */
	private final Map<String, Long> memberOf = new HashMap<>();

	/** Rows written for one owner once, however many times an act is built about him. */
	private final Map<String, Long> made = new HashMap<>();

	private int issued;

	private long pastEvent;

	private long pastRace;

	private long futureEvent;

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisFileUses {

		@Bean
		@Primary
		Clock aClockInsideTheTransferWindow() {
			return Clock.fixed(NOW, ZoneOffset.UTC);
		}
	}

	/**
	 * FIVE CALLERS, FOUR MEMBERS WHO STAND BESIDE THEM, AND A CALENDAR.
	 *
	 * <p>The member whose fee lapsed holds a {@code membership} row for 2027, given free of the fee:
	 * a gate that read „he has a membership row" would let him through. The moderator's own member
	 * has not paid either, and the moderator holds no right: being the administration opens nothing a
	 * member does.
	 */
	@BeforeEach
	void fiveCallersAndTheMembersBesideThem() {
		memberOf.put(PAID, member("993010", "M", true));
		memberOf.put(NEVER_PAID, member(null, "M", false));
		memberOf.put(LAPSED, member("993040", "M", false));
		memberOf.put(A_MODERATOR_WHO_HAS_NOT_PAID, member("993070", "M", false));

		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values (?, 2027, 'feeExempt', 'Probni Probic',"
						+ " timestamptz '2026-10-20 10:00:00+00')")
				.param(memberOf.get(LAPSED)).update();

		member(ADDRESSEE, "M", true);
		member(INVITED, "M", true);
		member(INVITED_EARLIER, "M", true);

		account(PAID, "competitor", memberOf.get(PAID));
		account(NEVER_PAID, "competitor", memberOf.get(NEVER_PAID));
		account(LAPSED, "competitor", memberOf.get(LAPSED));
		account(A_MODERATOR_WHO_HAS_NOT_PAID, "moderator", memberOf.get(A_MODERATOR_WHO_HAS_NOT_PAID));
		account(NAMES_NO_MEMBER, "moderator", null);

		pastEvent = event("p8u-prosli", "2026-05-01");
		pastRace = db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m) values (?, 'Prosla trka', false,"
						+ " date '2026-05-01', 'length', 0, 10.00, 50, 50) returning id")
				.param(pastEvent).query(Long.class).single();
		futureEvent = event("p8u-buduci", "2027-06-06");
	}

	/* ------------------------------------------------------------------------------------
	   THE LISTS ARE THE WHOLE PORTAL, AND NOTHING ELSE
	   ------------------------------------------------------------------------------------ */

	/**
	 * EVERY WRITE THE DISPATCHER MAPS, THAT NO RIGHT DECIDES AT THE DOOR, IS ON EXACTLY ONE LIST.
	 *
	 * <p>Read off {@link RequestMappingHandlerMapping}, every verb that is not a read and a mapping
	 * that limits no verb at all, so a write added tomorrow is asked about on the day it is mapped.
	 */
	@Test
	void everyWriteIsOnExactlyOneList() {
		List<String> derived = writesNoRightDecides();

		assertThat(derived)
				.as("the dispatcher maps no write at all, so the comparison below is about nothing")
				.hasSizeGreaterThan(20);

		List<String> named = new ArrayList<>();
		named.addAll(AN_ACT_OF_HIS_OWN.keySet());
		named.addAll(MAY_BEFORE_PAYING.keySet());
		named.addAll(THE_ADMINISTRATIONS_ON_THE_ROW.keySet());
		named.addAll(NOT_A_WRITE_OF_THE_PORTAL.keySet());

		assertThat(new HashSet<>(named))
				.as("a route is on two lists at once, so which answer it owes is not decided")
				.hasSameSizeAs(named);

		assertThat(named)
				.as("a write is on no list, or a list names a write the dispatcher does not map. A new"
						+ " write by a member is on PDL P8's second list unless it is on the first, and"
						+ " goes into AN_ACT_OF_HIS_OWN with the request a member sends about his own row")
				.containsExactlyInAnyOrderElementsOf(derived);
	}

	/**
	 * AND WHAT A MEMBER MAY DO BEFORE HE PAYS WITHOUT A SESSION IS OPEN TO EVERYBODY, so it cannot
	 * ask about the fee at all - the structure keeps the decision rather than a branch.
	 */
	@Test
	void whatHeMayDoWithoutASessionIsOpenToEverybody() {
		List<String> withoutASession = MAY_BEFORE_PAYING.entrySet().stream()
				.filter(one -> one.getValue().act() == null).map(Map.Entry::getKey).toList();

		assertThat(withoutASession).as("no route is open by name, so this asks about nothing")
				.isNotEmpty();

		for (String route : withoutASession) {
			String[] verbAndPath = route.split(" ", 2);

			assertThat(privileges.isAllowed(null, verbAndPath[1], verbAndPath[0], null))
					.as("%s is said to be open to anybody and reads no session, and the chain asks for"
							+ " one", route)
					.isTrue();
		}
	}

	/* ------------------------------------------------------------------------------------
	   WHAT HE MAY NOT DO
	   ------------------------------------------------------------------------------------ */

	static Stream<String> actsOfHisOwn() {
		return AN_ACT_OF_HIS_OWN.keySet().stream().sorted();
	}

	/**
	 * A MEMBER WHO HAS NOT PAID IS ANSWERED AS AN ADDRESS THAT IS NOT THERE, AND NOTHING IS WRITTEN;
	 * A MEMBER WHOSE FEE STANDS IS NOT, WITH THE SAME REQUEST ABOUT HIS OWN ROW.
	 */
	@ParameterizedTest
	@MethodSource("actsOfHisOwn")
	void aMemberWhoHasNotPaidIsToldTheAddressIsNotThere(String route) throws Exception {
		Act act = AN_ACT_OF_HIS_OWN.get(route);

		for (String caller : TURNED_AWAY) {
			assertTurnedAway(route + " as " + caller, () -> act.about(this, caller), caller);
		}

		assertTurnedAway(route + " from an account that names no member",
				() -> act.about(this, PAID), NAMES_NO_MEMBER);

		AbstractMockHttpServletRequestBuilder<?> paidAsks = act.about(this, PAID);
		Map<String, Long> before = writesSoFar();
		MockHttpServletResponse anchor = sent(paidAsks, PAID);

		assertThat(anchor.getStatus())
				.as("%s: the member whose fee stands sent the same request about his own row and was"
						+ " turned away too, so the refusals above may be a broken request and not his"
						+ " fee - %s", route, anchor.getContentAsString())
				.isBetween(200, 299);
		assertThat(writesSoFar())
				.as("%s: the member whose fee stands was answered %d and nothing was written, so"
						+ " „nothing was written\" above measures nothing", route, anchor.getStatus())
				.isNotEqualTo(before);
	}

	/**
	 * AND A BODY THAT CANNOT BE READ IS REFUSED EXACTLY THE SAME, ON EVERY ROUTE THAT TAKES JSON:
	 * the fee is asked before a byte of the body is read.
	 */
	@ParameterizedTest
	@MethodSource("actsOfHisOwn")
	void hisBodyIsNotReadBeforeHisFeeIsAsked(String route) throws Exception {
		if (!takesJson(route)) {
			return;
		}

		Act act = AN_ACT_OF_HIS_OWN.get(route);

		for (String caller : TURNED_AWAY) {
			assertTurnedAway(route + " with a body that cannot be read, as " + caller,
					() -> act.about(this, caller).content("{"), caller);
		}

		assertThat(sent(act.about(this, PAID).content("{"), PAID).getStatus())
				.as("%s: the member whose fee stands was not told 400 for a body that cannot be read,"
						+ " so this route does not read one and the case above asks about nothing", route)
				.isEqualTo(400);
	}

	/** Every write this case asks about takes JSON on at least six routes, or it measures little. */
	@Test
	void theRoutesThatTakeJsonAreAskedAboutTheirBody() {
		assertThat(AN_ACT_OF_HIS_OWN.keySet().stream().filter(this::takesJson).count())
				.as("hardly any act of his own takes JSON, so the body is barely asked about")
				.isGreaterThanOrEqualTo(6);
	}

	/* ------------------------------------------------------------------------------------
	   WHAT HE MAY DO
	   ------------------------------------------------------------------------------------ */

	static Stream<String> whatHeMayDoWithASession() {
		return MAY_BEFORE_PAYING.entrySet().stream().filter(one -> one.getValue().act() != null)
				.map(Map.Entry::getKey).sorted();
	}

	/**
	 * A MEMBER WHO HAS NOT PAID IS ANSWERED WHAT A MEMBER WHOSE FEE STANDS IS ANSWERED, ON EVERY
	 * ROUTE PDL P8 GIVES HIM BEFORE HE PAYS.
	 */
	@ParameterizedTest
	@MethodSource("whatHeMayDoWithASession")
	void aMemberWhoHasNotPaidMayDoWhatTheDecisionGivesHim(String route) throws Exception {
		Act act = MAY_BEFORE_PAYING.get(route).act();

		int whatAPaidMemberIsTold = sent(act.about(this, PAID), PAID).getStatus();

		assertThat(whatAPaidMemberIsTold)
				.as("%s: the member whose fee stands is answered as though the address were not there",
						route)
				.isNotEqualTo(404);

		for (String caller : List.of(NEVER_PAID, LAPSED)) {
			MockHttpServletResponse answer = sent(act.about(this, caller), caller);

			assertThat(answer.getStatus())
					.as("%s as %s: PDL P8 gives him this before he pays (%s), and he was answered"
							+ " otherwise than a member whose fee stands - %s", route, caller,
							MAY_BEFORE_PAYING.get(route).reason(), answer.getContentAsString())
					.isEqualTo(whatAPaidMemberIsTold);
		}
	}

	/** And the administration's routes turn away every member, paid or not: no member acts there. */
	@Test
	void theAdministrationsRoutesAreNoMembersAtAll() throws Exception {
		long row = db.sql("insert into verification (queue, competitor_id, subject, body)"
						+ " values ('teams', ?, 'Tim koji ceka', '') returning id")
				.param(memberOf.get(PAID)).query(Long.class).single();

		for (String route : THE_ADMINISTRATIONS_ON_THE_ROW.keySet()) {
			String[] verbAndPath = route.split(" ", 2);
			String address = verbAndPath[1].replace("{id}", String.valueOf(row));

			for (String caller : List.of(PAID, NEVER_PAID)) {
				AbstractMockHttpServletRequestBuilder<?> asking = switch (verbAndPath[0]) {
					case "POST" -> json(post(address), "{\"decision\":\"approved\"}");
					default -> delete(address);
				};

				assertThat(sent(asking, caller).getStatus())
						.as("%s as %s: a member holds no right over a queue row", route, caller)
						.isEqualTo(404);
			}
		}
	}

	/* ------------------------------------------------------------------------------------
	   THE FIXTURE SAYS WHAT IT CLAIMS
	   ------------------------------------------------------------------------------------ */

	/**
	 * EACH CALLER IS WHAT HIS TAG SAYS, AND EVERY MEMBER AN ACT NAMES BESIDE HIM IS ONE WHOSE FEE
	 * STANDS - asked of the database, because each is a way this file could measure nothing.
	 */
	@Test
	void theFixtureIsWhatItSays() {
		assertThat(activeOf(memberOf.get(PAID))).isTrue();
		assertThat(activeOf(memberOf.get(NEVER_PAID))).isFalse();
		assertThat(db.sql("select member_number is null from competitor where id = ?")
				.param(memberOf.get(NEVER_PAID)).query(Boolean.class).single())
				.as("the member who never paid carries a number, which V16 says only a payment gives")
				.isTrue();
		assertThat(activeOf(memberOf.get(LAPSED))).isFalse();
		assertThat(db.sql("select count(*) from membership where competitor_id = ?")
				.param(memberOf.get(LAPSED)).query(Long.class).single())
				.as("the lapsed member holds no membership row, so „a row\" and „the fee\" never differ")
				.isPositive();
		assertThat(activeOf(memberOf.get(A_MODERATOR_WHO_HAS_NOT_PAID))).isFalse();
		assertThat(db.sql("select count(*) from account_admin_right r join account a"
						+ " on a.id = r.account_id where a.email = ?")
				.param(emailOf(A_MODERATOR_WHO_HAS_NOT_PAID)).query(Long.class).single())
				.as("the moderator who has not paid holds a right, so a refusal could be his right's")
				.isZero();
		assertThat(db.sql("select competitor_id is null from account where email = ?")
				.param(emailOf(NAMES_NO_MEMBER)).query(Boolean.class).single()).isTrue();

		for (long beside : List.of(womanOf(NEVER_PAID), applicantOf(NEVER_PAID), idOf(ADDRESSEE),
				idOf(INVITED), adminOfAnotherTeam())) {
			assertThat(activeOf(beside))
					.as("a member an act names beside the caller has not paid, so a gate reading HIS fee"
							+ " instead of the caller's would turn the caller away for the wrong reason")
					.isTrue();
		}
	}

	/* ------------------------------------------------------------------------------------
	   SENDING AND MEASURING
	   ------------------------------------------------------------------------------------ */

	private void assertTurnedAway(String what,
			Supplier<AbstractMockHttpServletRequestBuilder<?>> request, String caller) throws Exception {

		AbstractMockHttpServletRequestBuilder<?> built = request.get();
		Map<String, Long> before = writesSoFar();
		MockHttpServletResponse answer = sent(built, caller);

		assertThat(answer.getStatus())
				.as("%s: a member who has not paid was not answered as an address that is not there"
						+ " - %s", what, answer.getContentAsString())
				.isEqualTo(404);
		assertThat(answer.getContentAsString())
				.as("%s: a refusal that says anything says that a write lives here", what)
				.isEmpty();
		assertThat(writesSoFar())
				.as("%s: turned away, and a row was written, changed or deleted anyway", what)
				.isEqualTo(before);
	}

	private MockHttpServletResponse sent(AbstractMockHttpServletRequestBuilder<?> request, String caller)
			throws Exception {

		return http.perform(request.with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(caller).secret())))
				.andReturn().getResponse();
	}

	private static AbstractMockHttpServletRequestBuilder<?> json(
			AbstractMockHttpServletRequestBuilder<?> request, String body) {
		return request.contentType(MediaType.APPLICATION_JSON).content(body);
	}

	/**
	 * Every row this transaction has inserted, updated or deleted, by table, so far.
	 *
	 * <p>{@code pg_stat_xact_user_tables} is the transaction's own count and covers every table there
	 * is, so „nothing was written" names no table and cannot miss one.
	 */
	private Map<String, Long> writesSoFar() {
		return db.sql("select relname, n_tup_ins + n_tup_upd + n_tup_del from pg_stat_xact_user_tables")
				.query((row, one) -> entry(row.getString(1), row.getLong(2)))
				.list().stream()
				.collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
	}

	/** Whether the route this name stands for takes JSON, read off its mapping. */
	private boolean takesJson(String route) {
		return mappings.getHandlerMethods().keySet().stream()
				.filter(info -> namesOf(info).contains(route))
				.anyMatch(info -> info.getConsumesCondition().getConsumableMediaTypes()
						.contains(MediaType.APPLICATION_JSON));
	}

	/** Every write no right decides at the door, as „VERB /path", a mapping with no verb as ANY. */
	private List<String> writesNoRightDecides() {
		List<String> found = new ArrayList<>();

		for (Map.Entry<RequestMappingInfo, HandlerMethod> one : mappings.getHandlerMethods().entrySet()) {
			if (Stream.of(one.getValue().getMethod().getAnnotations())
					.anyMatch(it -> it.annotationType().isAnnotationPresent(AskedAtTheDoor.class))) {
				continue;
			}

			namesOf(one.getKey()).stream()
					.filter(name -> !name.startsWith("GET ") && !name.startsWith("HEAD ")
							&& !name.startsWith("OPTIONS "))
					.forEach(found::add);
		}

		return found.stream().distinct().toList();
	}

	private static List<String> namesOf(RequestMappingInfo info) {
		Set<RequestMethod> verbs = info.getMethodsCondition().getMethods();
		PathPatternsRequestCondition patterns = info.getPathPatternsCondition();
		Set<String> paths = patterns == null ? info.getDirectPaths() : patterns.getPatternValues();

		List<String> names = new ArrayList<>();

		for (String path : paths) {
			if (verbs.isEmpty()) {
				names.add("ANY " + path);
			}

			for (RequestMethod verb : verbs) {
				names.add(verb.name() + " " + path);
			}
		}

		return names;
	}

	/* ------------------------------------------------------------------------------------
	   THE ROWS AN ACT IS ABOUT, WRITTEN ONCE PER OWNER
	   ------------------------------------------------------------------------------------ */

	/**
	 * Not {@code computeIfAbsent}: a row is often written out of another one written once
	 * (a question needs the woman who asks it), and a map changed from inside its own
	 * {@code computeIfAbsent} throws.
	 */
	private long once(String what, String owner, Supplier<Long> writing) {
		String key = what + "/" + owner;
		Long already = made.get(key);

		if (already != null) {
			return already;
		}

		long written = writing.get();
		made.put(key, written);

		return written;
	}

	long goingToTheFutureEvent(String owner) {
		once("going", owner, () -> {
			db.sql("insert into attending (event_id, competitor_id) values (?, ?)")
					.params(futureEvent, memberOf.get(owner)).update();
			return futureEvent;
		});
		return futureEvent;
	}

	long ownResult(String owner) {
		return once("result", owner, () -> db.sql("insert into result (competitor_id, race_id,"
						+ " race_date, distance_km, ascent_m, descent_m, seconds, points) values (?, ?,"
						+ " date '2026-05-01', 10.00, 50, 50, 3700, 12.34) returning id")
				.params(memberOf.get(owner), pastRace).query(Long.class).single());
	}

	/** A woman whose fee stands, one for each owner, so no two owners' pairs meet. */
	long womanOf(String owner) {
		return once("woman", owner, () -> member(String.format("9932%02d", ++issued % 100), "F", true));
	}

	long questionToHim(String owner) {
		return once("question", owner, () -> db.sql("insert into pair_invite (from_id, to_id)"
						+ " values (?, ?) returning id")
				.params(womanOf(owner), memberOf.get(owner)).query(Long.class).single());
	}

	long ownPair(String owner) {
		return once("pair", owner, () -> db.sql("insert into racing_pair (season, man_id, woman_id,"
						+ " made_at) values (2027, ?, ?, timestamptz '2026-10-20 10:00:00+00') returning id")
				.params(memberOf.get(owner), womanOf(owner)).query(Long.class).single());
	}

	long ownTeam(String owner) {
		return once("team", owner, () -> team("p8u-tim-" + owner, memberOf.get(owner)));
	}

	long anotherTeam() {
		return once("team", "another", () -> team("p8u-tim-drugi", adminOfAnotherTeam()));
	}

	long adminOfAnotherTeam() {
		return once("admin", "another", () -> member("993031", "M", true));
	}

	/** A member whose fee stands, one for each owner, asking into that owner's team. */
	long applicantOf(String owner) {
		return once("applicant", owner, () -> member(String.format("9934%02d", ++issued % 100), "M",
				true));
	}

	long applicationToHisTeam(String owner) {
		return once("application-in", owner, () -> db.sql("insert into team_application"
						+ " (competitor_id, team_id, season) values (?, ?, 2027) returning id")
				.params(applicantOf(owner), ownTeam(owner)).query(Long.class).single());
	}

	long ownApplication(String owner) {
		return once("application-out", owner, () -> db.sql("insert into team_application"
						+ " (competitor_id, team_id, season) values (?, ?, 2027) returning id")
				.params(memberOf.get(owner), anotherTeam()).query(Long.class).single());
	}

	long invitationToHim(String owner) {
		return once("invitation-in", owner, () -> db.sql("insert into team_invitation"
						+ " (team_id, competitor_id, season) values (?, ?, 2027) returning id")
				.params(anotherTeam(), memberOf.get(owner)).query(Long.class).single());
	}

	long invitationFromHisTeam(String owner) {
		return once("invitation-out", owner, () -> db.sql("insert into team_invitation"
						+ " (team_id, competitor_id, season) values (?, ?, 2027) returning id")
				.params(ownTeam(owner), idOf(INVITED_EARLIER)).query(Long.class).single());
	}

	long messageToHim(String owner) {
		return once("message", owner, () -> db.sql("insert into message (to_id, from_id, from_name,"
						+ " subject, body) values (?, null, 'Liga', 'Za tebe', 'Tekst') returning id")
				.param(memberOf.get(owner)).query(Long.class).single());
	}

	long ownPhoto(String owner) {
		return once("photo", owner, () -> {
			long photo = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
							+ " crop_diameter) values ('image/jpeg', 40960, ?, 0.3, 0.7, 0.45) returning id")
					.param(String.format("%064x", 0xb257L * 1000 + ++issued)).query(Long.class).single();

			db.sql("update competitor set photo_id = ? where id = ?").params(photo, memberOf.get(owner))
					.update();

			return photo;
		});
	}

	String numberOf(long competitor) {
		return db.sql("select member_number from competitor where id = ?").param(competitor)
				.query(String.class).single();
	}

	private long idOf(String number) {
		return db.sql("select id from competitor where member_number = ?").param(number)
				.query(Long.class).single();
	}

	private boolean activeOf(long competitor) {
		return db.sql("select active from competitor where id = ?").param(competitor)
				.query(Boolean.class).single();
	}

	private long team(String slug, long admin) {
		long team = db.sql("insert into team (slug, name, bio, link, place_id, city, country_id,"
						+ " logo_id, first_season, admin_id) values (?, ?, '', '',"
						+ " (select id from place where rank = 1), null, null, null, 2027, ?) returning id")
				.params(slug, "Tim " + slug, admin).query(Long.class).single();

		db.sql("insert into team_membership (competitor_id, team_id, season_from) values (?, ?, 2027)")
				.params(admin, team).update();

		return team;
	}

	private long member(String number, String gender, boolean active) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Probic', ?, date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, ?, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, gender, active, String.format("8b%014x", ++issued))
				.query(Long.class).single();
	}

	private static String emailOf(String caller) {
		return "p8u-" + caller + "@primer.rs";
	}

	private void account(String caller, String role, Long competitor) {
		db.sql("insert into account (first_name, last_name, email, role_id, password_hash,"
						+ " email_confirmed_at, competitor_id) values ('Probni', 'Probic', ?,"
						+ " (select id from role where code = ?), ?, now(), ?)")
				.params(emailOf(caller), role, new StoredPassword().of(PASSWORD), competitor).update();

		SecretToken session = SecretToken.fresh();
		Instant issuedAt = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(emailOf(caller), session.hash(), Timestamp.from(issuedAt.minus(Duration.ofDays(1))),
						Timestamp.from(issuedAt), Timestamp.from(issuedAt.plus(SessionLife.LASTS)))
				.update();

		sessions.put(caller, session);
	}

	private long event(String slug, String day) {
		return db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link) values (?, ?, date '" + day + "',"
						+ " (select id from place where rank = 1), null, null, 'race', false, '', '')"
						+ " returning id")
				.params(slug, "Dogadjaj " + slug).query(Long.class).single();
	}
}
