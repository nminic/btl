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
import org.springframework.core.DefaultParameterNameDiscoverer;
import org.springframework.core.MethodParameter;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.condition.PathPatternsRequestCondition;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

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
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT THE SERVER SAYS TO A KEY THAT IS NOT A KEY, ON EVERY ROUTE THAT TAKES ONE, read off a
 * socket byte for byte.
 *
 * <p><b>The owner's sentence is ADL A8, 13.09.2026: the server need not give away even that an
 * address exists.</b> A word where a key goes is the cheapest probe there is, and until this
 * class existed it was answered 400 by Spring before the handler ran, to every signed in asker,
 * while a number that matches no row was answered 404. The difference says "an action lives
 * here". {@code RightsOverRealHttpTest} closed it for the three writes on the verification queue
 * (02.10.2026); this class is the same question asked of every route the dispatcher maps, so a
 * route that arrives tomorrow is asked on the day it is mapped.
 *
 * <p><b>"A route that takes a typed key" is read off the dispatcher and is not a list:</b> a
 * handler no right guards at the door and one of whose path variables is not a plain
 * {@code String}. The routes a right guards are left out on purpose and for a reason that is
 * written once, in {@code RightsAtTheDoorTest}: its sweep reads a 400 for a word as the proof that
 * the door was what answered.
 *
 * <p><b>Three comparisons, because there are three things a refusal can give away.</b>
 *
 * <ul>
 * <li>A word is answered exactly as a number that matches no row, for every kind of caller, every
 * body and every position of the key. They travel the same road, so a handler that asks about the
 * FORM before it asks about the row answers the form first for both.
 * <li>A number that matches no row is answered exactly as an address that maps nothing: the same
 * status, the same length, the same bytes. A status written onto the response and an error sent
 * through the container differ by about a hundred and fifty bytes, and over MockMvc they are
 * indistinguishable.
 * <li>Somebody who is not signed in is answered 401 in every one of those cases, the number
 * included. 401 says "sign in" and nothing about what is behind the address.
 * </ul>
 *
 * <p><b>The twin is an address of the same length that maps nothing</b>, built from the address
 * itself by turning its first literal segment into letters that name no route. The error
 * document carries the path that was asked for, so addresses of different lengths would differ
 * by a length that says nothing.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class AWordInAKeyOverRealHttpTest {

	private static final String A_TOKEN = "11111111-2222-3333-4444-555555555555";

	/** Ten characters, shaped like a key, and a key no sequence has ever reached. */
	private static final String A_NUMBER_WITH_NO_ROW = "9999999999";

	/**
	 * As long as {@link #A_NUMBER_WITH_NO_ROW}, so the two are compared byte for byte. A plus sign and
	 * a hexadecimal number are not asked about here: spelt round a number that matches no row they
	 * are answered as it is whatever reads them, so only a row that EXISTS tells them from digits,
	 * and {@link #aKeySpeltAnyOtherWayThanInDigitsIsNoItemEvenToTheOneWhoMayOpenIt} has one.
	 */
	private static final String A_WORD = "nije-kljuc";

	/** Nineteen digits: larger than the largest {@code long}, so a bound one digit too wide fails. */
	private static final String NINETEEN_DIGITS = "9999999999999999999";

	private static final String JSON = "Content-Type: application/json\r\n";

	private static final Pattern A_VARIABLE = Pattern.compile("\\{[^/}]*\\}");

	private static final String COMPETITOR = "b200-takmicar@primer.rs";
	private static final String TEAM_MEMBER = "b200-clan-tima@primer.rs";
	private static final String TEAM_ADMIN = "b200-administrator-tima@primer.rs";
	private static final String MODERATOR_WITH_NO_MEMBER = "b200-moderator-bez-clana@primer.rs";
	private static final String MODERATOR_WITH_EVERY_RIGHT = "b200-moderator-sva-prava@primer.rs";
	private static final String SUPERADMIN = "b200-superadmin@primer.rs";

	private static final String THE_COMPETITORS_NUMBER = "990101";
	private static final String THE_TEAM_MEMBERS_NUMBER = "990102";
	private static final String THE_ADMINISTRATORS_NUMBER = "990103";

	private static final String THE_TEAM = "b200-tim";

	private static final String THE_SUBJECT = "b200-poruka";

	@LocalServerPort
	private int port;

	@Autowired
	private JdbcClient db;

	/** The dispatcher, asked which routes exist rather than told. */
	@Autowired
	@Qualifier("requestMappingHandlerMapping")
	private RequestMappingHandlerMapping mappings;

	private final Map<String, String> sessions = new LinkedHashMap<>();

	private long team;

	private long message;

	/**
	 * SIX KINDS OF CALLER, AND THE SEVENTH IS NOBODY.
	 *
	 * <p>A competitor who holds nothing is the ordinary attacker. A member who stands in a team
	 * but does not lead it, and the one who does, are who a team's own routes tell apart. A
	 * moderator who races for nobody is the account the member-less answers are for, and one
	 * holding every box is the one who knows the most. The superadmin is the anchor: without him
	 * a route that was simply broken would be missing for everybody and every comparison would
	 * hold having measured nothing.
	 */
	@BeforeEach
	void sixKindsOfCaller() {
		member(COMPETITOR, THE_COMPETITORS_NUMBER);
		member(TEAM_MEMBER, THE_TEAM_MEMBERS_NUMBER);
		member(TEAM_ADMIN, THE_ADMINISTRATORS_NUMBER);
		account(MODERATOR_WITH_NO_MEMBER, "moderator");
		account(MODERATOR_WITH_EVERY_RIGHT, "moderator");
		account(SUPERADMIN, "superadmin");

		for (String right : db.sql("select code from admin_right").query(String.class).list()) {
			db.sql("insert into account_admin_right (account_id, right_code)"
							+ " values ((select id from account where email = ?), ?)")
					.params(MODERATOR_WITH_EVERY_RIGHT, right).update();
		}

		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id) values (?, ?, '', '', (select id from place"
						+ " where rank = 1), null, null, null, 2027,"
						+ " (select id from competitor where member_number = ?))")
				.params(THE_TEAM, THE_TEAM, THE_ADMINISTRATORS_NUMBER).update();

		team = db.sql("select id from team where slug = ?").param(THE_TEAM)
				.query(Long.class).single();

		for (String number : List.of(THE_TEAM_MEMBERS_NUMBER, THE_ADMINISTRATORS_NUMBER)) {
			db.sql("insert into team_membership (competitor_id, team_id, season_from)"
							+ " values ((select id from competitor where member_number = ?), ?, 2027)")
					.params(number, team).update();
		}

		message = db.sql("insert into message (to_id, from_id, from_name, subject, body) values"
						+ " ((select id from competitor where member_number = ?), null, 'Portal', ?,"
						+ " 'Telo') returning id")
				.params(THE_COMPETITORS_NUMBER, THE_SUBJECT).query(Long.class).single();
	}

	/** Cleaned up by hand, because a real server answers on its own connection. */
	@AfterEach
	void takeThemBackOut() {
		db.sql("delete from message where subject = ?").param(THE_SUBJECT).update();
		db.sql("delete from team where slug = ?").param(THE_TEAM).update();

		for (String email : sessions.keySet()) {
			db.sql("delete from account where email = ?").param(email).update();
		}

		db.sql("delete from competitor where member_number in (?, ?, ?)")
				.params(THE_COMPETITORS_NUMBER, THE_TEAM_MEMBERS_NUMBER, THE_ADMINISTRATORS_NUMBER)
				.update();
	}

	private void member(String email, String number) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Probic', 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment', ?, '',"
						+ " false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')")
				.params(number, String.format("%016x", Long.parseLong(number))).update();

		account(email, "competitor");

		db.sql("update account set competitor_id = (select id from competitor where member_number = ?)"
				+ " where email = ?").params(number, email).update();
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

	/** Everybody who can sign in, and then nobody, which is a caller of its own. */
	private List<String> everyCaller() {
		List<String> callers = new ArrayList<>(sessions.keySet());
		callers.add(null);
		return callers;
	}

	/** The whole answer, headers and body and chunk sizes, as it came off the wire. */
	private String answerTo(String method, String path, String email, String extra, String body)
			throws Exception {
		String cookies = "XSRF-TOKEN=" + A_TOKEN
				+ (email == null ? "" : "; " + SessionCookie.NAME + "=" + sessions.get(email));

		String asking = method + " " + path + " HTTP/1.1\r\n"
				+ "Host: localhost:" + port + "\r\n"
				+ "Cookie: " + cookies + "\r\n"
				+ "X-XSRF-TOKEN: " + A_TOKEN + "\r\n"
				+ extra
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
	 * TWO ANSWERS THAT MUST BE ONE, compared the way {@code RightsOverRealHttpTest} compares
	 * them: the same cookies by name, the same length, and then the same bytes.
	 */
	private static void oneAnswer(String what, String first, String pathOfTheFirst, String second,
			String pathOfTheSecond) {

		assertThat(pathOfTheFirst.length())
				.as("%s: the two addresses are not the same length, so the error document each of"
						+ " them carries makes the answers differ by a length that means nothing", what)
				.isEqualTo(pathOfTheSecond.length());
		assertThat(setCookiesIn(second)).as("%s: one answer set a cookie the other did not", what)
				.isEqualTo(setCookiesIn(first));
		assertThat(withoutTheClock(second).length())
				.as("%s: %s came back %s and %s came back %s - different LENGTHS, which says which of"
						+ " the two addresses is the one that exists", what, pathOfTheFirst,
						firstLine(first), pathOfTheSecond, firstLine(second))
				.isEqualTo(withoutTheClock(first).length());
		assertThat(withoutTheMomentOrTheAddress(second, pathOfTheSecond))
				.as("%s: the two answers differ", what)
				.isEqualTo(withoutTheMomentOrTheAddress(first, pathOfTheFirst));
	}

	private static String firstLine(String answer) {
		return answer.lines().findFirst().orElse("(nothing came back)");
	}

	/** An address of the same length behind the same chain that maps nothing. */
	private static String twinOf(String path) {
		int from = "/api/".length();
		int to = path.indexOf('/', from);
		String literal = path.substring(from, to < 0 ? path.length() : to);

		return path.substring(0, from) + "z".repeat(literal.length())
				+ (to < 0 ? "" : path.substring(to));
	}

	/**
	 * A ROUTE THE DISPATCHER MAPS WHOSE KEY IS TYPED AND WHOSE ANSWER NO RIGHT DECIDES AT THE DOOR.
	 *
	 * @param body what to send so that a refusal about the FORM is not what is measured: built from
	 *             the type the handler declares for its body, never written here
	 */
	private record Route(String verb, String pattern, int keys, boolean json, String body) {

		/** The address with one key spelt as asked and every other key a number that matches no row. */
		String addressWith(int position, String spelt) {
			Matcher variables = A_VARIABLE.matcher(pattern);
			StringBuilder out = new StringBuilder();
			int seen = 0;

			while (variables.find()) {
				variables.appendReplacement(out, Matcher.quoteReplacement(
						seen++ == position ? spelt : A_NUMBER_WITH_NO_ROW));
			}

			variables.appendTail(out);

			return out.toString();
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

			if (decidedAtTheDoor(method)) {
				continue;
			}

			int keys = (int) Stream.of(method.getMethodParameters())
					.filter(p -> p.hasParameterAnnotation(PathVariable.class))
					.filter(p -> p.getParameterType() != String.class).count();

			if (keys == 0) {
				continue;
			}

			PathPatternsRequestCondition patterns = one.getKey().getPathPatternsCondition();
			boolean json = !one.getKey().getConsumesCondition().getConsumableMediaTypes().isEmpty();

			for (String pattern : patterns == null ? one.getKey().getDirectPaths()
					: patterns.getPatternValues()) {
				for (String verb : one.getKey().getMethodsCondition().getMethods().stream()
						.map(Enum::name).toList()) {
					found.add(new Route(verb, pattern, keys, json, validBodyOf(method, json)));
				}
			}
		}

		found.sort(Comparator.comparing(Route::pattern).thenComparing(Route::verb));

		return found;
	}

	/** The very question {@code RightsAtTheDoorTest} asks, of the annotations themselves. */
	private static boolean decidedAtTheDoor(HandlerMethod method) {
		return Stream.of(method.getMethod().getAnnotations())
				.anyMatch(one -> one.annotationType().isAnnotationPresent(AskedAtTheDoor.class));
	}

	/**
	 * A BODY THE HANDLER'S OWN FORM WOULD ACCEPT, written out of the components of the record it
	 * declares and never out of a list of forms.
	 *
	 * <p>A route that asks about the form before it asks about the row answers a member who sent
	 * nothing useful with a 400 about the form, which is a different answer from the one a number
	 * that matches no row gets and has nothing to do with the key. Sending a body the form accepts
	 * is what keeps the comparisons about the key.
	 */
	private static String validBodyOf(HandlerMethod method, boolean json) {
		if (!json) {
			return "";
		}

		for (MethodParameter p : method.getMethodParameters()) {
			if (p.hasParameterAnnotation(RequestBody.class)) {
				return Stream.of(p.getParameterType().getRecordComponents())
						.map(AWordInAKeyOverRealHttpTest::aValueFor).filter(v -> v != null)
						.collect(Collectors.joining(",", "{", "}"));
			}
		}

		return "{}";
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

	/** What the body of a request is, for the three bodies a route that takes one can be sent. */
	private static List<String> bodiesFor(Route route) {
		return route.json() ? List.of(route.body(), "{", "") : List.of("");
	}

	private String extraFor(Route route) {
		return route.json() ? JSON : "";
	}

	/**
	 * THE FLOOR IS NOT EMPTY, and what it asks about is the routes of a portal and not a handful.
	 *
	 * <p>Asserted before anything is compared, because a derivation that found nothing would make
	 * every comparison below true while asking about no route at all.
	 */
	@Test
	void theDispatcherMapsRoutesThatTakeATypedKey() {
		List<Route> routes = routes();

		assertThat(routes)
				.as("no route takes a typed key, so every comparison in this class is empty")
				.isNotEmpty();
		assertThat(routes.stream().map(Route::pattern).distinct().count())
				.as("every typed key is on one address, so this asks about one resource")
				.isGreaterThan(1);
		assertThat(routes.stream().filter(Route::json).count())
				.as("no route that takes a typed key takes a body, so the three bodies are never"
						+ " asked about and a handler that reads its form first is never found")
				.isPositive();
		assertThat(routes.stream().filter(one -> one.keys() > 1).count())
				.as("no route takes two keys, so the position of a key is never asked about")
				.isPositive();
	}

	/**
	 * A WORD IS A NUMBER THAT MATCHES NO ROW.
	 *
	 * <p>For every route, every kind of caller, every position of the key and every body. The two
	 * addresses are as long as each other and differ only in the key; if the answers differ, the
	 * server has told a signed in caller which of the two is a key.
	 */
	@Test
	void aKeyThatIsNotOneIsAnItemThatIsNotThereToEveryCaller() throws Exception {
		for (Route route : routes()) {
			for (String caller : everyCaller()) {
				for (int position = 0; position < route.keys(); position++) {
					String reference = route.addressWith(position, A_NUMBER_WITH_NO_ROW);

					for (String body : bodiesFor(route)) {
						String toTheNumber = answerTo(route.verb(), reference, caller,
								extraFor(route), body);

						String asked = route.addressWith(position, A_WORD);

						oneAnswer(route + " as " + caller + ", key " + position + " a word, body ["
								+ body + "]", answerTo(route.verb(), asked, caller, extraFor(route),
								body), asked, toTheNumber, reference);
					}
				}
			}
		}
	}

	/**
	 * A NUMBER THAT MATCHES NO ROW IS AN ADDRESS THAT MAPS NOTHING, AND SO ARE NINETEEN DIGITS.
	 *
	 * <p>The status is 404 in both, and that is not what is measured: a refusal written onto the
	 * response comes back as 262 bytes with {@code Content-Length: 0}, an address that maps nothing
	 * comes back as the container's error document, chunked, and the difference is an oracle for
	 * whether a route lives here that costs one request per guess. MockMvc runs no ERROR dispatch
	 * and cannot see it. Nobody signed in is answered 401 in all of them.
	 */
	@Test
	void anItemThatIsNotThereIsAnAddressThatIsNotThereToEveryCaller() throws Exception {
		for (Route route : routes()) {
			for (String caller : everyCaller()) {
				for (int position = 0; position < route.keys(); position++) {
					for (String key : List.of(A_NUMBER_WITH_NO_ROW, NINETEEN_DIGITS)) {
						String asked = route.addressWith(position, key);
						String twin = twinOf(asked);

						oneAnswer(route + " as " + caller + ", key " + position + " = " + key,
								answerTo(route.verb(), asked, caller, extraFor(route), route.body()),
								asked, answerTo(route.verb(), twin, caller, extraFor(route),
										route.body()), twin);
					}
				}
			}
		}
	}

	/**
	 * AND WHERE THE ADDRESS EXISTS THE SPELLING OF THE KEY STILL DECIDES.
	 *
	 * <p>The comparisons above are about numbers that match no row, and a plus sign or a
	 * hexadecimal number in front of a number that DOES match one is the case they cannot reach:
	 * Spring used to read {@code +7} and {@code 0x7} as 7, so the one who may read team 7 read it
	 * by either. The anchor is the team's own administrator reading his own applications - 200 - so
	 * that the answers below are between an address that is really there for him and spellings of
	 * its key that are not.
	 */
	@Test
	void aKeySpeltAnyOtherWayThanInDigitsIsNoItemEvenToTheOneWhoMayOpenIt() throws Exception {
		String applications = "/api/teams/" + team + "/applications";

		assertThat(answerTo("GET", applications, TEAM_ADMIN, "", ""))
				.as("the administrator of the team cannot read its applications either, so every"
						+ " comparison below is between addresses that are simply missing")
				.startsWith("HTTP/1.1 200");

		for (String spelt : List.of("+" + team, "0x" + Long.toHexString(team))) {
			String asked = "/api/teams/" + spelt + "/applications";

			oneAnswer("the administrator reading the applications of team " + spelt,
					answerTo("GET", asked, TEAM_ADMIN, "", ""), asked,
					answerTo("GET", twinOf(asked), TEAM_ADMIN, "", ""), twinOf(asked));
		}

		String opening = "/api/inbox/" + message + "/read";

		assertThat(answerTo("POST", opening, COMPETITOR, "", ""))
				.as("the member the message is for cannot open it either")
				.startsWith("HTTP/1.1 204");

		for (String spelt : List.of("+" + message, "0x" + Long.toHexString(message))) {
			String asked = "/api/inbox/" + spelt + "/read";

			oneAnswer("the addressee opening message " + spelt,
					answerTo("POST", asked, COMPETITOR, "", ""), asked,
					answerTo("POST", twinOf(asked), COMPETITOR, "", ""), twinOf(asked));
		}
	}

	/**
	 * A TEAM THAT EXISTS AND IS NOT HIS IS ANSWERED EXACTLY LIKE A TEAM THAT IS NOT THERE.
	 *
	 * <p>The member who stands in the team without leading it and the competitor who has nothing
	 * to do with it read the same nothing the twin reads, and the administrator reads a list. That
	 * is the pair that tells "may he" from "is it there".
	 */
	@Test
	void anItemThatExistsAndIsNotHisIsAnAddressThatIsNotThere() throws Exception {
		String applications = "/api/teams/" + team + "/applications";

		for (String caller : List.of(TEAM_MEMBER, COMPETITOR)) {
			oneAnswer(caller + " reading the applications of a team that is not his",
					answerTo("GET", applications, caller, "", ""), applications,
					answerTo("GET", twinOf(applications), caller, "", ""), twinOf(applications));
		}

		assertThat(answerTo("GET", applications, TEAM_ADMIN, "", ""))
				.as("the one who leads the team is answered a list, which is what makes the two above"
						+ " a refusal and not a broken route")
				.startsWith("HTTP/1.1 200");
	}
}
