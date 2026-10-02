package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.util.ClassUtils;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.condition.PathPatternsRequestCondition;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.lang.reflect.Method;
import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT A SIGNED IN ACCOUNT THAT NAMES NO MEMBER IS TOLD FOR EVERY KIND OF BODY, ON EVERY ROUTE THAT
 * ASKS WHICH MEMBER IT IS, read off a socket byte for byte.
 *
 * <p><b>The owner's sentence is ADL A8, 13.09.2026: the server need not give away even that an
 * address exists.</b> A route that binds its body as an argument reads it BEFORE the first line of
 * the handler, so the question „has this account a member" is asked after the body has already
 * been refused or accepted. Measured on a real socket on 02.10.2026 (PR 466, register 166): a
 * moderator who races for nobody was told 400 for a body that is not JSON or none at all, and 404
 * for a body that reads; the address that maps nothing says 404 to both. One request with a broken
 * body, and he knows that a write lives there.
 *
 * <p><b>Which routes is read off the dispatcher and is not a list.</b> A handler no right decides at
 * the door, whose class holds a {@link MemberOfAccount} - which is the type system saying the class
 * asks the question - and which takes a body. {@code PUT /api/me/password} is not one of them and is
 * not named: its class asks no such question, because a password belongs to the account and not to a
 * member, so every signed in account is entitled to be told 400 there.
 *
 * <p><b>Three comparisons, because there are three things a refusal can give away.</b>
 *
 * <ul>
 * <li>An account that names no member is answered the same for every body: the one the form accepts,
 * a truncated one, none, an array, text, and the word {@code null}. Pinned to 404, so that two answers
 * that are both a fault are not "the same".
 * <li>Where the address is NOT one {@link ApiSecurity#READ_BY_ANYBODY} opens, that answer is exactly
 * the twin's, byte for byte: the status, the length and the document. A status written onto the
 * response comes back as 262 bytes with {@code Content-Length: 0} and an address that maps nothing
 * comes back chunked with the container's error document, so the difference is an oracle for whether a
 * route lives there. The three addresses that ARE open for reading keep the 262 bytes by the decision
 * of 18.09.2026 ({@code ApiSecurity}: {@code OPTIONS} there already says a write lives at the address),
 * and for those the comparison is with the same account's answer to the body the form accepts.
 * <li>Somebody who is not signed in is answered 401 for every body, which says „sign in" and nothing
 * about what is behind the address.
 * </ul>
 *
 * <p><b>AND THE ANCHOR, which is what keeps a route that was simply broken from satisfying all of
 * that.</b> A member is told 400, in the route's own words, for a body that cannot be read: so the
 * route DOES read it, and the account that names no member is turned away before it does.
 *
 * <p><b>The twin is an address of the same length that maps nothing</b>, built from the address
 * itself, because the error document carries the path that was asked for.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class ABodyIsReadAfterTheDoorOverRealHttpTest {

	private static final String A_TOKEN = "11111111-2222-3333-4444-555555555555";

	/** Ten characters, shaped like a key, and a key no sequence has ever reached. */
	private static final String A_NUMBER_WITH_NO_ROW = "9999999999";

	private static final String JSON = "Content-Type: application/json\r\n";

	private static final Pattern A_VARIABLE = Pattern.compile("\\{[^/}]*\\}");

	private static final String A_MEMBER = "b205-clan@primer.rs";
	private static final String MODERATOR_WITH_NO_MEMBER = "b205-moderator-bez-clana@primer.rs";
	private static final String MODERATOR_WITH_EVERY_RIGHT = "b205-moderator-sva-prava@primer.rs";

	private static final String THE_MEMBERS_NUMBER = "990201";

	/**
	 * EVERY BODY THAT IS NOT THE ONE THE FORM ASKS FOR, and each is a different way of not being it:
	 * cut short, nothing, the wrong shape, not JSON at all, and JSON that says nothing.
	 */
	private static final List<String> BODIES_THAT_ARE_NOT_THE_FORM =
			List.of("{", "", "[]", "nije json", "null");

	@LocalServerPort
	private int port;

	@Autowired
	private JdbcClient db;

	/** The dispatcher, asked which routes exist rather than told. */
	@Autowired
	@Qualifier("requestMappingHandlerMapping")
	private RequestMappingHandlerMapping mappings;

	private final Map<String, String> sessions = new LinkedHashMap<>();

	/**
	 * THREE KINDS OF CALLER, AND THE FOURTH IS NOBODY.
	 *
	 * <p>The member is the anchor. The moderator who races for nobody is the account the member-less
	 * answers are for, and the one holding every box is the one who knows the most: a right does not
	 * make a member, so he must be told exactly what the other is.
	 */
	@BeforeEach
	void threeKindsOfCaller() {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Probic', 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment', ?, '',"
						+ " false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')")
				.params(THE_MEMBERS_NUMBER, String.format("%016x", Long.parseLong(THE_MEMBERS_NUMBER)))
				.update();

		account(A_MEMBER, "competitor");
		db.sql("update account set competitor_id = (select id from competitor where member_number = ?)"
				+ " where email = ?").params(THE_MEMBERS_NUMBER, A_MEMBER).update();

		account(MODERATOR_WITH_NO_MEMBER, "moderator");
		account(MODERATOR_WITH_EVERY_RIGHT, "moderator");

		for (String right : db.sql("select code from admin_right").query(String.class).list()) {
			db.sql("insert into account_admin_right (account_id, right_code)"
							+ " values ((select id from account where email = ?), ?)")
					.params(MODERATOR_WITH_EVERY_RIGHT, right).update();
		}
	}

	/** Cleaned up by hand, because a real server answers on its own connection. */
	@AfterEach
	void takeThemBackOut() {
		for (String email : sessions.keySet()) {
			db.sql("delete from account where email = ?").param(email).update();
		}

		db.sql("delete from competitor where member_number = ?").param(THE_MEMBERS_NUMBER).update();
	}

	private void account(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Probni', 'Probic', ?, (select id from role where code = ?))")
				.params(email, role).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session.secret());
	}

	/** The two accounts that name no member, which is who the answers below are for. */
	private static List<String> accountsThatNameNoMember() {
		return List.of(MODERATOR_WITH_NO_MEMBER, MODERATOR_WITH_EVERY_RIGHT);
	}

	/** The whole answer, headers and body and chunk sizes, as it came off the wire. */
	private String answerTo(String method, String path, String email, String body) throws Exception {
		String cookies = "XSRF-TOKEN=" + A_TOKEN
				+ (email == null ? "" : "; " + SessionCookie.NAME + "=" + sessions.get(email));

		String asking = method + " " + path + " HTTP/1.1\r\n"
				+ "Host: localhost:" + port + "\r\n"
				+ "Cookie: " + cookies + "\r\n"
				+ "X-XSRF-TOKEN: " + A_TOKEN + "\r\n"
				+ JSON
				+ "Content-Length: " + body.getBytes(StandardCharsets.ISO_8859_1).length + "\r\n"
				+ "Connection: close\r\n\r\n"
				+ body;

		try (Socket socket = new Socket("localhost", port)) {
			socket.getOutputStream().write(asking.getBytes(StandardCharsets.ISO_8859_1));
			socket.getOutputStream().flush();
			return new String(socket.getInputStream().readAllBytes(), StandardCharsets.ISO_8859_1);
		}
	}

	/** The two lines that must differ between any two requests: the moment and a fresh token. */
	private static String withoutTheClock(String answer) {
		return answer.replaceAll("(?m)^Date:.*\r\n", "").replaceAll("(?m)^Set-Cookie:.*\r\n", "");
	}

	private static List<String> setCookiesIn(String answer) {
		return answer.lines().filter(line -> line.startsWith("Set-Cookie:"))
				.map(line -> line.substring("Set-Cookie:".length()).trim().split("=")[0])
				.sorted().toList();
	}

	private static String withoutTheMomentOrTheAddress(String answer, String path) {
		return withoutTheClock(answer)
				.replaceAll("\"timestamp\":\"[^\"]*\"", "\"timestamp\":\"AT SOME MOMENT\"")
				.replace(path, "THE ADDRESS THAT WAS ASKED FOR");
	}

	/**
	 * WHAT IS DIFFERENT BETWEEN TWO ANSWERS THAT MUST BE ONE, compared the way
	 * {@code RightsOverRealHttpTest} compares them: the same cookies by name, the same length, and then
	 * the same bytes.
	 *
	 * <p>It RETURNS what differs instead of failing on the first thing, so that one run names every route
	 * that is wrong and not only the first in alphabetical order: a floor derived from the dispatcher is
	 * asked about the whole portal, and the number of routes it fails on is the finding.
	 */
	private static List<String> differences(String what, String first, String pathOfTheFirst,
			String second, String pathOfTheSecond) {

		List<String> found = new ArrayList<>();

		if (pathOfTheFirst.length() != pathOfTheSecond.length()) {
			found.add(what + ": the two addresses are not the same length, so the error document each of"
					+ " them carries makes the answers differ by a length that means nothing");

			return found;
		}

		if (!setCookiesIn(second).equals(setCookiesIn(first))) {
			found.add(what + ": one answer set a cookie the other did not");
		}

		int lengthOfTheFirst = withoutTheClock(first).length();
		int lengthOfTheSecond = withoutTheClock(second).length();

		if (lengthOfTheFirst != lengthOfTheSecond) {
			found.add(what + ": " + firstLine(first).strip() + " in " + lengthOfTheFirst + " bytes against "
					+ firstLine(second).strip() + " in " + lengthOfTheSecond + " - different LENGTHS, which is an"
					+ " oracle for whether the address exists even when both say 404");
		}
		else if (!withoutTheMomentOrTheAddress(second, pathOfTheSecond)
				.equals(withoutTheMomentOrTheAddress(first, pathOfTheFirst))) {
			found.add(what + ": the two answers are as long as each other and differ in their bytes");
		}

		return found;
	}

	private static String firstLine(String answer) {
		return answer.lines().findFirst().orElse("(nothing came back)");
	}

	/** An address of the same length behind the same chain that maps nothing. */
	private static String twinOf(String path) {
		int from = "/api/".length();
		int to = path.indexOf('/', from);
		String literal = path.substring(from, to < 0 ? path.length() : to);

		return path.substring(0, from) + "z".repeat(literal.length()) + (to < 0 ? "" : path.substring(to));
	}

	/**
	 * A ROUTE THAT ASKS WHICH MEMBER IT IS AND TAKES A BODY.
	 *
	 * @param open whether {@link ApiSecurity#READ_BY_ANYBODY} opens the ADDRESS for reading, which is
	 *             what decides whether the 404 for an account naming no member may keep the shape of
	 *             a status written onto the response
	 * @param body what to send so that nothing about the FORM is what is measured: built from the type
	 *             the handler declares for its body, never written here
	 */
	private record Route(String verb, String pattern, boolean open, String body) {

		/** The address with every key a number that matches no row. */
		String address() {
			return A_VARIABLE.matcher(pattern).replaceAll(A_NUMBER_WITH_NO_ROW);
		}

		@Override
		public String toString() {
			return verb + " " + pattern;
		}
	}

	private List<Route> routes() {
		List<Route> found = new ArrayList<>();

		for (Map.Entry<RequestMappingInfo, HandlerMethod> one : mappings.getHandlerMethods().entrySet()) {
			HandlerMethod method = one.getValue();

			if (decidedAtTheDoor(method.getMethod()) || !asksWhichMember(method.getBeanType())) {
				continue;
			}

			Optional<Class<?>> body = TheBodyOf.type(method);

			if (body.isEmpty()) {
				continue;
			}

			PathPatternsRequestCondition patterns = one.getKey().getPathPatternsCondition();

			for (String pattern : patterns == null ? one.getKey().getDirectPaths()
					: patterns.getPatternValues()) {
				for (String verb : one.getKey().getMethodsCondition().getMethods().stream()
						.map(Enum::name).toList()) {
					found.add(new Route(verb, pattern, ApiSecurity.READ_BY_ANYBODY.contains(pattern),
							validBodyOf(body.get())));
				}
			}
		}

		found.sort(Comparator.comparing(Route::pattern).thenComparing(Route::verb));

		return found;
	}

	/** The very question {@code RightsAtTheDoorTest} asks, of the annotations themselves. */
	private static boolean decidedAtTheDoor(Method method) {
		return Stream.of(method.getAnnotations())
				.anyMatch(one -> one.annotationType().isAnnotationPresent(AskedAtTheDoor.class));
	}

	/**
	 * WHETHER A CLASS ASKS WHICH MEMBER IS BEHIND AN ACCOUNT, answered by the type system and not by a
	 * list of classes: {@link MemberOfAccount} is the one home of that question, so a class that holds
	 * one is a class that asks it.
	 */
	private static boolean asksWhichMember(Class<?> controller) {
		return Stream.of(ClassUtils.getUserClass(controller).getDeclaredFields())
				.anyMatch(field -> field.getType() == MemberOfAccount.class);
	}

	/**
	 * A BODY THE HANDLER'S OWN FORM WOULD ACCEPT, written out of the components of the record it
	 * declares and never out of a list of forms.
	 */
	private static String validBodyOf(Class<?> type) {
		return Stream.of(type.getRecordComponents())
				.map(ABodyIsReadAfterTheDoorOverRealHttpTest::aValueFor).filter(v -> v != null)
				.collect(Collectors.joining(",", "{", "}"));
	}

	private static String aValueFor(RecordComponent component) {
		Class<?> type = component.getType();
		String name = "\"" + component.getName() + "\":";

		if (type == Boolean.class || type == boolean.class) {
			return name + "true";
		}
		if (type == String.class) {
			return name + "\"x\"";
		}
		if (type == LocalDate.class) {
			return name + "\"2026-01-01\"";
		}
		if (Number.class.isAssignableFrom(type) || type == long.class || type == int.class
				|| type == BigDecimal.class) {
			return name + "1";
		}

		return null;
	}

	/**
	 * THE FLOOR IS NOT EMPTY, and what it asks about is the routes of a portal and not a handful.
	 *
	 * <p>Asserted before anything is compared, because a derivation that found nothing would make every
	 * comparison below true while asking about no route at all. Both halves of the open list are asked
	 * about, because the comparison with the twin is not the one that is true of an address opened for
	 * reading.
	 */
	@Test
	void theDispatcherMapsRoutesThatAskWhichMemberItIsAndTakeABody() {
		List<Route> routes = routes();

		assertThat(routes)
				.as("no route asks which member it is and takes a body, so every comparison in this"
						+ " class is empty")
				.isNotEmpty();
		assertThat(routes.stream().filter(Route::open).count())
				.as("no such route is on an address opened for reading, so the 262 bytes the owner"
						+ " decided to keep on 18.09.2026 are never asked about")
				.isPositive();
		assertThat(routes.stream().filter(one -> !one.open()).count())
				.as("every such route is on an open address, so the comparison with the twin is never"
						+ " asked about")
				.isPositive();
		assertThat(routes.stream().filter(one -> one.pattern().contains("{")).count())
				.as("no such route takes a key, so a body is never asked about beside a number that"
						+ " matches no row")
				.isPositive();
		assertThat(accountsThatNameNoMember())
				.as("an account that names no member really names none, or the sentence this class is"
						+ " about is about nobody")
				.allSatisfy(email -> assertThat(db.sql("select competitor_id is null from account"
								+ " where email = ?").param(email).query(Boolean.class).single())
						.isTrue());
	}

	/**
	 * AN ACCOUNT THAT NAMES NO MEMBER IS ANSWERED THE SAME FOR EVERY BODY.
	 *
	 * <p>For every route, both kinds of account and every body. The reference is the body the form
	 * accepts, so that what is compared is the body and nothing else; it is pinned to 404, and where the
	 * address is not an open one it is the twin's answer too. Every route that is wrong is named, not
	 * only the first.
	 */
	@Test
	void anAccountThatNamesNoMemberIsAnsweredTheSameForEveryBody() throws Exception {
		List<String> wrong = new ArrayList<>();

		for (Route route : routes()) {
			String address = route.address();

			for (String caller : accountsThatNameNoMember()) {
				String reference = answerTo(route.verb(), address, caller, route.body());

				if (!firstLine(reference).equals("HTTP/1.1 404 ")) {
					wrong.add(route + " as " + caller + ": the body the form accepts was not answered as"
							+ " nothing is, but " + firstLine(reference).strip());
				}

				for (String body : BODIES_THAT_ARE_NOT_THE_FORM) {
					wrong.addAll(differences(route + " as " + caller + ", body [" + body + "]",
							answerTo(route.verb(), address, caller, body), address, reference, address));
				}

				if (!route.open()) {
					String twin = twinOf(address);

					wrong.addAll(differences(route + " as " + caller + " against its twin", reference, address,
							answerTo(route.verb(), twin, caller, route.body()), twin));
				}
			}
		}

		assertThat(wrong)
				.as("an account that names no member was told something about the BODY, which says that a write"
						+ " lives at the address - the sentence ADL A8 forbids")
				.isEmpty();
	}

	/**
	 * AND SOMEBODY WHO IS NOT SIGNED IN IS TOLD TO SIGN IN, WHATEVER HE SENT.
	 *
	 * <p>401 says „sign in" and nothing about what is behind the address, so it is the one answer ADL A8
	 * keeps a number for. It is asked for every body and compared with the twin's, so that a body which
	 * changes it would be a body that says the route exists.
	 */
	@Test
	void nobodySignedInIsToldToSignInWhateverHeSent() throws Exception {
		List<String> wrong = new ArrayList<>();

		for (Route route : routes()) {
			String address = route.address();
			String twin = twinOf(address);

			for (String body : Stream.concat(Stream.of(route.body()),
					BODIES_THAT_ARE_NOT_THE_FORM.stream()).toList()) {
				String toTheRoute = answerTo(route.verb(), address, null, body);

				if (!firstLine(toTheRoute).equals("HTTP/1.1 401 ")) {
					wrong.add(route + " with body [" + body + "] and nobody signed in was not told to sign in,"
							+ " but " + firstLine(toTheRoute).strip());
				}

				wrong.addAll(differences(route + " with body [" + body + "] and nobody signed in against its"
						+ " twin", toTheRoute, address, answerTo(route.verb(), twin, null, body), twin));
			}
		}

		assertThat(wrong)
				.as("somebody who is not signed in was told something other than what an address that maps"
						+ " nothing tells him")
				.isEmpty();
	}

	/**
	 * THE ANCHOR: A MEMBER IS TOLD 400, IN THE ROUTE'S OWN WORDS, FOR A BODY THAT CANNOT BE READ.
	 *
	 * <p>Without this a route that answered every account 404 would satisfy everything above, and so
	 * would one that never read a body at all. A member is the one caller every one of these routes is
	 * for, and what he is told is the route's own sentence and not the container's error document: the
	 * body arrives as bytes, is read only once the account is known to name a member, and a body that
	 * cannot be read is the form not being filled in. It is asked before anything else about the route
	 * that depends on the day or on the rows, so it is the same on every day of the year.
	 */
	@Test
	void aMemberIsToldTheFormIsNotCompleteForABodyThatCannotBeRead() throws Exception {
		List<String> wrong = new ArrayList<>();

		for (Route route : routes()) {
			for (String body : BODIES_THAT_ARE_NOT_THE_FORM) {
				String answer = answerTo(route.verb(), route.address(), A_MEMBER, body);

				if (!firstLine(answer).equals("HTTP/1.1 400 ")) {
					wrong.add(route + " with body [" + body + "] as a member: a body that cannot be read was"
							+ " answered " + firstLine(answer).strip() + " and not 400");
				}
				else if (!answer.contains("\"reason\":\"theFormIsNotComplete\"")) {
					wrong.add(route + " with body [" + body + "] as a member: the refusal is the container's"
							+ " error document and not the route's own sentence");
				}
			}
		}

		assertThat(wrong)
				.as("a member was not told that the form is not complete for a body that cannot be read")
				.isEmpty();
	}
}
