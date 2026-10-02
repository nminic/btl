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
import org.springframework.boot.tomcat.TomcatWebServer;
import org.springframework.boot.web.server.servlet.context.ServletWebServerApplicationContext;
import org.springframework.boot.web.servlet.DelegatingFilterProxyRegistrationBean;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.core.Ordered;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.filter.FormContentFilter;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.condition.PathPatternsRequestCondition;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT THE SERVER SAYS TO A BODY THAT IS TOO LONG, ON EVERY ROUTE THAT TAKES ONE, read off a socket.
 *
 * <p><b>The finding is ADL A56, 19.09.2026:</b> a signed in member sent 19,088,910 bytes and was answered
 * an orderly 400, because the whole body had been read and held before anything looked at it.
 * {@code NoBodyIsLargerThan} is the one place that bounds it. This class asks what that costs and where it
 * reaches, over a real socket, because a refusal is only measured by the bytes that come back.
 *
 * <p><b>Four things are asked, and the first is the one the owner's rule is about.</b>
 *
 * <ul>
 * <li><b>The limit holds wherever a body is READ, and it is asked of every route the dispatcher maps that
 * takes one</b> - a body bound as an argument, one read after the member question, one read by hand - with
 * four kinds of caller, for a body that DECLARES its length and for one that does not. Where somebody
 * reads it the answer is 413. Where nobody does - somebody who is not signed in, an account that names no
 * member, a moderator without the right - the answer is exactly the answer the same caller gets for an
 * empty object, and exactly the twin's: the limit takes nothing from ADL A8 (the server need not give away
 * even that an address exists) and changes no answer anybody was given before it existed. <b>Who is
 * read is told by what a caller is told for two small bodies and not by who got a 413</b>: a 413 that
 * excused itself would excuse a body read before the door, which is the only thing such a read leaves
 * behind.
 * <li><b>The line is where it says it is, in both directions</b>, for a declared and for a chunked body:
 * exactly the limit is read, one byte over is refused.
 * <li><b>What it does not bound is left alone</b>: a photograph is the container's and the picture's, and
 * the {@code Content-Type} that exempts it is the one Spring itself looks at, so a type that only
 * MENTIONS multipart is not exempt.
 * <li><b>The filter sits in front</b>, because {@code FormContentFilter} reads the body of a {@code PUT},
 * {@code PATCH} or {@code DELETE} that carries a form before the security chain does, for everybody and
 * for every address.
 * </ul>
 *
 * <p><b>Why the bodies are {@code {}} and padded objects and never a valid form.</b> A caller who passes
 * every door and reads a valid body would WRITE: this class sends every route of the portal a body as a
 * superadmin, and nothing it sends may make a row. An empty object is refused as an incomplete form
 * everywhere, and a padded object parses to one.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class NoBodyIsLargerThanOverRealHttpTest {

	private static final String A_TOKEN = "11111111-2222-3333-4444-555555555555";

	/** Ten characters, shaped like a key, and a key no sequence has ever reached. */
	private static final String A_NUMBER_WITH_NO_ROW = "9999999999";

	private static final Pattern A_VARIABLE = Pattern.compile("\\{[^/}]*\\}");

	private static final String JSON = "Content-Type: application/json\r\n";

	private static final String A_MEMBER = "b205-limit-clan@primer.rs";
	private static final String MODERATOR_WITH_NO_MEMBER = "b205-limit-moderator@primer.rs";
	private static final String SUPERADMIN = "b205-limit-superadmin@primer.rs";

	private static final String THE_MEMBERS_NUMBER = "990202";

	/** One byte over the line, and a body that is exactly on it. */
	private static final int OVER = (int) NoBodyIsLargerThan.BYTES + 1;
	private static final int ON_THE_LINE = (int) NoBodyIsLargerThan.BYTES;

	@LocalServerPort
	private int port;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ApplicationContext context;

	/** The dispatcher, asked which routes exist rather than told. */
	@Autowired
	@Qualifier("requestMappingHandlerMapping")
	private RequestMappingHandlerMapping mappings;

	private final Map<String, String> sessions = new LinkedHashMap<>();

	/** The queue row the decision on the verification queue is asked about. */
	private long waitingItem;

	/**
	 * THREE KINDS OF CALLER, AND THE FOURTH IS NOBODY.
	 *
	 * <p>A member is who the routes that ask which member it is are for. A moderator who races for nobody
	 * is turned away by them. The superadmin passes every door the portal has, which is what makes every
	 * route that reads a body one that is READ in this class - but he names no member, so the routes
	 * that need one are read by the member.
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
		account(SUPERADMIN, "superadmin");

		/* ONE ITEM STANDING IN THE PROFILES TAB, ABOUT NOBODY IN THE RECORD: V9 makes `competitor_id`
		   nullable on purpose, and that road needs no competitor of its own to clean up. */
		waitingItem = db.sql("insert into verification (queue, competitor_id, subject, body)"
						+ " values ('profiles', null, 'Granica', 'Tekst') returning id")
				.query(Long.class).single();
	}

	/** Cleaned up by hand, because a real server answers on its own connection. */
	@AfterEach
	void takeThemBackOut() {
		db.sql("delete from verification where id = ?").param(waitingItem).update();

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

	/** Everybody who can sign in, and then nobody, which is a caller of its own. */
	private List<String> everyCaller() {
		List<String> callers = new ArrayList<>(sessions.keySet());
		callers.add(null);
		return callers;
	}

	/** A JSON object of exactly this many bytes, which parses to a form with nothing in it. */
	private static byte[] anObjectOf(int bytes) {
		String start = "{\"p\":\"";
		String end = "\"}";

		return (start + "a".repeat(bytes - start.length() - end.length()) + end)
				.getBytes(StandardCharsets.ISO_8859_1);
	}

	/**
	 * THE WHOLE ANSWER, as it came off the wire, to a body the caller chooses.
	 *
	 * @param headers whole header lines, each ending in CRLF
	 * @param chunked whether the body DECLARES no length and arrives in chunks, which is the shape that
	 *                a limit written only against {@code Content-Length} never sees
	 */
	private String answerTo(String method, String path, String email, String headers, byte[] body,
			boolean chunked) throws IOException {
		return answerTo(method, path, email, headers, body, chunked, true);
	}

	/**
	 * @param withTheToken whether the CSRF value is sent as a header as well as a cookie. Left out, the
	 *                     filter that checks it asks for the value as a PARAMETER, which is what makes
	 *                     the container parse a form body on its own.
	 */
	private String answerTo(String method, String path, String email, String headers, byte[] body,
			boolean chunked, boolean withTheToken) throws IOException {

		String cookies = "XSRF-TOKEN=" + A_TOKEN
				+ (email == null ? "" : "; " + SessionCookie.NAME + "=" + sessions.get(email));

		ByteArrayOutputStream asking = new ByteArrayOutputStream();

		asking.write((method + " " + path + " HTTP/1.1\r\n"
				+ "Host: localhost:" + port + "\r\n"
				+ "Cookie: " + cookies + "\r\n"
				+ (withTheToken ? "X-XSRF-TOKEN: " + A_TOKEN + "\r\n" : "")
				+ headers
				+ (chunked ? "Transfer-Encoding: chunked\r\n" : "Content-Length: " + body.length + "\r\n")
				+ "Connection: close\r\n\r\n").getBytes(StandardCharsets.ISO_8859_1));

		if (chunked) {
			for (int from = 0; from < body.length; from += 8192) {
				int length = Math.min(8192, body.length - from);

				asking.write((Integer.toHexString(length) + "\r\n").getBytes(StandardCharsets.ISO_8859_1));
				asking.write(body, from, length);
				asking.write("\r\n".getBytes(StandardCharsets.ISO_8859_1));
			}

			asking.write("0\r\n\r\n".getBytes(StandardCharsets.ISO_8859_1));
		}
		else {
			asking.write(body);
		}

		try (Socket socket = new Socket("localhost", port)) {
			socket.setSoTimeout(30_000);
			socket.getOutputStream().write(asking.toByteArray());
			socket.getOutputStream().flush();

			return new String(socket.getInputStream().readAllBytes(), StandardCharsets.ISO_8859_1);
		}
	}

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

	private static String firstLine(String answer) {
		return answer.lines().findFirst().orElse("(nothing came back)");
	}

	/**
	 * WHAT IS DIFFERENT BETWEEN TWO ANSWERS THAT MUST BE ONE: the cookies by name, the length, then the
	 * bytes. It returns what differs so that one run names every route that is wrong.
	 */
	private static List<String> differences(String what, String first, String pathOfTheFirst,
			String second, String pathOfTheSecond) {

		List<String> found = new ArrayList<>();

		if (pathOfTheFirst.length() != pathOfTheSecond.length()) {
			found.add(what + ": the two addresses are not the same length");

			return found;
		}

		if (!setCookiesIn(second).equals(setCookiesIn(first))) {
			found.add(what + ": one answer set a cookie the other did not");
		}

		int lengthOfTheFirst = withoutTheClock(first).length();
		int lengthOfTheSecond = withoutTheClock(second).length();

		if (lengthOfTheFirst != lengthOfTheSecond) {
			found.add(what + ": " + firstLine(first).strip() + " in " + lengthOfTheFirst
					+ " bytes against " + firstLine(second).strip() + " in " + lengthOfTheSecond);
		}
		else if (!withoutTheMomentOrTheAddress(second, pathOfTheSecond)
				.equals(withoutTheMomentOrTheAddress(first, pathOfTheFirst))) {
			found.add(what + ": as long as each other and different in their bytes");
		}

		return found;
	}

	/** An address of the same length behind the same chain that maps nothing. */
	private static String twinOf(String path) {
		int from = "/api/".length();
		int to = path.indexOf('/', from);
		String literal = path.substring(from, to < 0 ? path.length() : to);

		return path.substring(0, from) + "z".repeat(literal.length()) + (to < 0 ? "" : path.substring(to));
	}

	/**
	 * A ROUTE THAT TAKES A BODY, read off the dispatcher and not a list: a handler that declares its body
	 * as an argument or as a {@link WhatWasSent}, or one whose mapping says it consumes JSON, which is how
	 * the routes that read their bytes by hand say it.
	 *
	 * @param open whether {@link ApiSecurity#READ_BY_ANYBODY} opens the ADDRESS for reading, where the
	 *             owner decided on 18.09.2026 that a refusal keeps the shape of a status written onto the
	 *             response, so the twin is not what it is compared with
	 */
	private record Route(String verb, String pattern, boolean open) {

		/**
		 * The address with every key a number that matches no row - and the one row there is for the
		 * routes whose door looks at a row before it reads: the decision on the verification queue
		 * answers 404 to a key nobody has before it has read a byte, to everybody, the superadmin too.
		 */
		String address(long theItemWaiting) {
			String key = pattern.startsWith("/api/verification/{id}/") ? Long.toString(theItemWaiting)
					: A_NUMBER_WITH_NO_ROW;

			return A_VARIABLE.matcher(pattern).replaceAll(key);
		}

		@Override
		public String toString() {
			return verb + " " + pattern;
		}
	}

	private List<Route> routes() {
		List<Route> found = new ArrayList<>();

		for (Map.Entry<RequestMappingInfo, HandlerMethod> one : mappings.getHandlerMethods().entrySet()) {
			boolean consumesJson = one.getKey().getConsumesCondition().getConsumableMediaTypes().stream()
					.anyMatch(type -> type.getSubtype().equals("json"));

			if (TheBodyOf.type(one.getValue()).isEmpty() && !consumesJson) {
				continue;
			}

			PathPatternsRequestCondition patterns = one.getKey().getPathPatternsCondition();

			for (String pattern : patterns == null ? one.getKey().getDirectPaths()
					: patterns.getPatternValues()) {
				for (String verb : one.getKey().getMethodsCondition().getMethods().stream()
						.map(Enum::name).toList()) {
					found.add(new Route(verb, pattern, ApiSecurity.READ_BY_ANYBODY.contains(pattern)));
				}
			}
		}

		found.sort(Comparator.comparing(Route::pattern).thenComparing(Route::verb));

		return found;
	}

	/**
	 * THE FLOOR IS NOT EMPTY, and it is the routes of a portal and not a handful.
	 *
	 * <p>Every kind of reader is among them, because a limit measured against one kind says nothing about
	 * the others: a body bound as an argument, one read after the member question, and one read by hand.
	 */
	@Test
	void theDispatcherMapsRoutesThatTakeABodyOfEveryKind() {
		List<Route> routes = routes();
		List<HandlerMethod> handlers = mappings.getHandlerMethods().values().stream().toList();

		assertThat(routes.size())
				.as("the dispatcher maps hardly any route that takes a body, so every comparison below is"
						+ " about a handful")
				.isGreaterThan(20);
		assertThat(handlers.stream().filter(one -> TheBodyOf.type(one).isPresent()).count())
				.as("no handler declares its body, so the routes below are only the ones that say JSON")
				.isPositive();
		assertThat(handlers.stream().anyMatch(one -> one.getMethodParameters().length > 0
				&& java.util.Arrays.stream(one.getMethodParameters())
						.anyMatch(p -> p.getParameterType() == WhatWasSent.class)))
				.as("no handler reads its body after the member question, so that kind is never asked about")
				.isTrue();
		assertThat(routes.stream().filter(one -> TheBodyOf.type(handlerOf(one)).isEmpty()).count())
				.as("every route declares its body, so the ones that read their bytes by hand are never"
						+ " asked about")
				.isPositive();
		assertThat(routes.stream().filter(Route::open).count())
				.as("no route that takes a body is on an open address, so the 262 bytes are never asked"
						+ " about")
				.isPositive();
	}

	private HandlerMethod handlerOf(Route route) {
		return mappings.getHandlerMethods().entrySet().stream()
				.filter(one -> {
					PathPatternsRequestCondition patterns = one.getKey().getPathPatternsCondition();

					return (patterns == null ? one.getKey().getDirectPaths() : patterns.getPatternValues())
							.contains(route.pattern())
							&& one.getKey().getMethodsCondition().getMethods().stream()
									.anyMatch(verb -> verb.name().equals(route.verb()));
				})
				.map(Map.Entry::getValue).findFirst().orElseThrow();
	}

	/**
	 * WHETHER A CALLER IS TURNED AWAY BEFORE HIS BODY IS LOOKED AT, told by what he is told for two small
	 * bodies and not by whether a 413 came back.
	 *
	 * <p>The same 401 or 404 for an empty object and for a truncated one: a route that read the body first
	 * could not say it, because the truncated one cannot be parsed and is answered 400 - or, where the
	 * empty one is stopped by a row that is not there, the two differ. Asked of the answers and of nothing
	 * else, so that it needs no list of who is refused where.
	 */
	private static boolean isTurnedAwayBeforeHisBody(String empty, String broken, String address) {
		return (firstLine(empty).equals("HTTP/1.1 401 ") || firstLine(empty).equals("HTTP/1.1 404 "))
				&& differences("", empty, address, broken, address).isEmpty();
	}

	/**
	 * THE LIMIT HOLDS WHEREVER A BODY IS READ, AND CHANGES NO ANSWER WHERE IT IS NOT.
	 *
	 * <p>For every route, every caller and both ways of arriving - a body that declares its length and
	 * one that arrives in chunks and declares none. Either the body is READ, and the answer is 413, or it
	 * is not, and the answer is the one the same caller gets for an empty object, byte for byte, and the
	 * twin's. That is the whole of what ADL A8 asks: nobody who may not be told that a route exists is
	 * told it by how long his body is.
	 *
	 * <p><b>WHO IS READ IS NOT DECIDED BY WHO WAS TOLD 413, which is what this case did until the
	 * independent review of PR 471 (02.10.2026).</b> It accepted a 413 from anybody and compared with the
	 * empty object and the twin only where none came back, so the 413 that gives a body read too early
	 * away excused itself: a read lifted above the member question in one handler, a byte array hoisted
	 * above it in {@code InboxWriteApi}, and a filter that refused a declared JSON body before the chain
	 * - for everybody, so that somebody not signed in was told 413 and not 401 - all passed. A body read
	 * early leaves no other trace, because for a small one the parse error is swallowed and the bytes are
	 * thrown away. Who is read is derived from what the caller is told for two SMALL bodies instead
	 * ({@link #isTurnedAwayBeforeHisBody}): somebody told the same 401 or 404 for an empty object and for
	 * a truncated one is turned away before the route looks at what he sent, and a body over the line
	 * must be answered exactly like the empty object and exactly like the twin - never 413. Everybody
	 * else is somebody whose body the route reads, and is answered 413.
	 *
	 * <p><b>And a route nobody could read is a route this class would be silent about</b>, so every route
	 * has to be read by somebody. The superadmin passes every door there is and the member passes the
	 * ones that ask which member it is; if neither reaches the read, the comparison above is true of a
	 * route that was never measured.
	 *
	 * <p><b>The routes that read their bytes by hand are the ones the comparison in
	 * {@code ABodyIsReadAfterTheDoorOverRealHttpTest} cannot see</b>, because the type of their body is
	 * not in their signature: the one that asks which member, the one that changes the category and the
	 * decision on the verification queue. Each of them must have a caller who is SIGNED IN and turned
	 * away, since somebody who is not is refused by the security chain before any handler runs and
	 * would not feel a read lifted above the door.
	 */
	@Test
	void aBodyThatIsTooLongIsRefusedWhereItIsReadAndChangesNothingWhereItIsNot() throws Exception {
		List<String> wrong = new ArrayList<>();
		Set<String> routesNobodyRead = new TreeSet<>();
		Set<String> readByHand = new TreeSet<>();
		Set<String> readByHandAndTurnedAwayWhenSignedIn = new TreeSet<>();
		byte[] tooLong = anObjectOf(OVER);

		for (Route route : routes()) {
			String address = route.address(waitingItem);
			String twin = twinOf(address);
			boolean someoneRead = false;
			boolean byHand = TheBodyOf.type(handlerOf(route)).isEmpty();

			if (byHand) {
				readByHand.add(route.toString());
			}

			for (String caller : everyCaller()) {
				String empty = answerTo(route.verb(), address, caller, JSON, "{}".getBytes(), false);
				String broken = answerTo(route.verb(), address, caller, JSON, "{".getBytes(), false);
				boolean turnedAway = isTurnedAwayBeforeHisBody(empty, broken, address);

				if (turnedAway && byHand && caller != null) {
					readByHandAndTurnedAwayWhenSignedIn.add(route.toString());
				}

				for (boolean chunked : new boolean[] {false, true}) {
					String what = route + " as " + caller + (chunked ? ", chunked" : ", declared");
					String answer = answerTo(route.verb(), address, caller, JSON, tooLong, chunked);

					if (!turnedAway) {
						if (firstLine(answer).equals("HTTP/1.1 413 ")) {
							someoneRead = true;
						}
						else {
							wrong.add(what + ": the route reads this caller's body, and a body over the line"
									+ " was answered " + firstLine(answer).strip() + " and not 413");
						}

						continue;
					}

					wrong.addAll(differences(what + ": the caller is turned away before his body is looked"
							+ " at, and a body over the line was not answered like an empty object", answer,
							address, empty, address));

					if (!route.open()) {
						wrong.addAll(differences(what + ": the caller is turned away before his body is looked"
								+ " at, and a body over the line was not answered like the twin", answer, address,
								answerTo(route.verb(), twin, caller, JSON, tooLong, chunked), twin));
					}
				}
			}

			if (!someoneRead) {
				routesNobodyRead.add(route.toString());
			}
		}

		assertThat(wrong)
				.as("a body that is too long was answered 413 to somebody whose body is not read, or something"
						+ " other than 413 to somebody whose body is, or differently from the empty object and the"
						+ " twin where it was not read")
				.isEmpty();
		assertThat(routesNobodyRead)
				.as("no caller in this class reaches the read on these routes, so the limit is not measured"
						+ " on them")
				.isEmpty();
		assertThat(readByHand)
				.as("every route declares its body, so the ones that read their bytes by hand are never asked"
						+ " about")
				.isNotEmpty();
		assertThat(readByHandAndTurnedAwayWhenSignedIn)
				.as("a route that reads its bytes by hand has no caller who is signed in and turned away, so a"
						+ " read lifted above its question changes nothing this class can see")
				.containsExactlyInAnyOrderElementsOf(readByHand);
	}

	/**
	 * THE LINE IS WHERE IT SAYS IT IS, IN BOTH DIRECTIONS.
	 *
	 * <p>A body of exactly the limit is read - and is read to the end, because it is answered exactly as
	 * the empty object it parses to is - and one byte more is refused. Asked of one reader of each kind
	 * (a body read after the member question, one read by hand, and one bound as an argument on an address
	 * that is open) and of both ways of arriving, so that a limit written against {@code Content-Length}
	 * alone, or against the stream alone, or one byte to either side, fails here and nowhere else.
	 */
	@Test
	void theLineIsWhereItSaysItIsInBothDirections() throws Exception {
		List<String> wrong = new ArrayList<>();

		for (String[] reader : new String[][] {
				{"POST", "/api/comments", A_MEMBER},
				{"POST", "/api/inbox", A_MEMBER},
				{"POST", "/api/sign-in", null}}) {

			String ordinary = answerTo(reader[0], reader[1], reader[2], JSON, "{}".getBytes(), false);

			assertThat(firstLine(ordinary))
					.as("%s %s is not a route that reads an empty object and refuses it as a form, so"
							+ " everything below it is compared with nothing in particular",
							reader[0], reader[1])
					.isNotEqualTo("HTTP/1.1 413 ");

			for (boolean chunked : new boolean[] {false, true}) {
				String what = reader[0] + " " + reader[1] + (chunked ? ", chunked" : ", declared");

				wrong.addAll(differences(what + ", exactly " + ON_THE_LINE + " bytes was not read as the"
						+ " empty object it is", answerTo(reader[0], reader[1], reader[2], JSON,
						anObjectOf(ON_THE_LINE), chunked), reader[1], ordinary, reader[1]));

				String over = answerTo(reader[0], reader[1], reader[2], JSON, anObjectOf(OVER), chunked);

				if (!firstLine(over).equals("HTTP/1.1 413 ")) {
					wrong.add(what + ", " + OVER + " bytes was answered " + firstLine(over).strip()
							+ " and not 413");
				}
			}
		}

		assertThat(wrong).as("the line is not where NoBodyIsLargerThan.BYTES says it is").isEmpty();
	}

	/**
	 * A PHOTOGRAPH IS THE CONTAINER'S AND THE PICTURE'S, AND IS LEFT ALONE.
	 *
	 * <p>A part of 600 KiB is over the limit for a JSON body and under the six megabytes the container
	 * takes, and the picture route answers it exactly as it answers a part of one kilobyte: with its own
	 * sentence about what was sent, whatever that is, and never with 413. The route is asked as a black
	 * box on purpose - what it says about a part that is not a picture is the picture's to decide.
	 */
	@Test
	void aPhotographIsNotBoundByTheLimitForAJsonBody() throws Exception {
		String boundary = "----b205";
		String type = "Content-Type: multipart/form-data; boundary=" + boundary + "\r\n";

		String small = answerTo("POST", "/api/me/photo", A_MEMBER, type, aPartOf(boundary, 1024), false);
		String big = answerTo("POST", "/api/me/photo", A_MEMBER, type, aPartOf(boundary, 600 * 1024), false);

		assertThat(firstLine(small))
				.as("the picture route does not answer a part of one kilobyte with a sentence of its own,"
						+ " so the comparison below is between two faults")
				.isNotEqualTo("HTTP/1.1 413 ")
				.startsWith("HTTP/1.1 4");
		assertThat(differences("a part of 600 KiB against a part of 1 KiB", big, "/api/me/photo", small,
				"/api/me/photo")).isEmpty();
	}

	private static byte[] aPartOf(String boundary, int bytes) {
		return ("--" + boundary + "\r\n"
				+ "Content-Disposition: form-data; name=\"picture\"; filename=\"x.png\"\r\n"
				+ "Content-Type: image/png\r\n\r\n"
				+ "a".repeat(bytes) + "\r\n"
				+ "--" + boundary + "--\r\n").getBytes(StandardCharsets.ISO_8859_1);
	}

	/**
	 * AND A TYPE THAT ONLY MENTIONS MULTIPART IS NOT EXEMPT.
	 *
	 * <p>The exemption is the test Spring itself applies before it parses a multipart body: the type
	 * STARTS with {@code multipart/}. A caller who wrote the word somewhere else in the header, so that
	 * his JSON would be let through whole, is bounded like anybody else.
	 */
	@Test
	void aTypeThatOnlyMentionsMultipartIsBoundLikeAnyOther() throws Exception {
		/* A QUOTED PARAMETER, because Spring refuses a slash in a bare one before anything is read and
		   the answer is a 404 that measures the mapping and not the limit - found the first time this
		   case ran. Quoted, it is a type the route accepts as JSON that has the word in it. */
		String mentions = "Content-Type: application/json; x=\"multipart/form-data\"\r\n";

		assertThat(answerTo("POST", "/api/comments", A_MEMBER, mentions, "{}".getBytes(), false))
				.as("the type that mentions multipart is not one the route takes as JSON, so the answers"
						+ " below say nothing about the limit")
				.startsWith("HTTP/1.1 400 ");
		assertThat(firstLine(answerTo("POST", "/api/comments", A_MEMBER, mentions, anObjectOf(OVER), false)))
				.as("a body that only MENTIONS multipart was let through at any length")
				.isEqualTo("HTTP/1.1 413 ");
		assertThat(firstLine(answerTo("POST", "/api/comments", A_MEMBER, mentions, anObjectOf(OVER), true)))
				.as("a chunked body that only MENTIONS multipart was let through at any length")
				.isEqualTo("HTTP/1.1 413 ");
	}

	/**
	 * A FORM THAT A FILTER READS BEFORE THE DOOR IS REFUSED THE SAME FOR EVERYBODY AND EVERY ADDRESS.
	 *
	 * <p>{@code FormContentFilter} parses the body of a {@code PUT}, {@code PATCH} or {@code DELETE}
	 * that carries form content, and it does so ahead of the security chain and without asking whether
	 * the address exists. Behind it, this limit would never see that body and a stranger could make the
	 * server read as much of it as he liked. In front of it, the read goes through the bounded stream, and
	 * what is refused is refused for everybody and every address alike - the address that exists and its
	 * twin, somebody signed in and nobody - which is the one body the limit refuses before the door,
	 * because the filter that reads it has no door. A form UNDER the limit is untouched: it is told what
	 * it was told before this class existed.
	 */
	@Test
	void aFormAFilterReadsBeforeTheDoorIsRefusedTheSameForEveryAddress() throws Exception {
		String form = "Content-Type: application/x-www-form-urlencoded\r\n";
		String address = "/api/me";
		List<String> wrong = new ArrayList<>();

		for (String caller : everyCaller()) {
			for (boolean chunked : new boolean[] {false, true}) {
				String what = "PUT " + address + " as " + caller + (chunked ? ", chunked" : ", declared");
				String refused = answerTo("PUT", address, caller, form, anObjectOf(OVER), chunked);

				if (!firstLine(refused).equals("HTTP/1.1 413 ")) {
					wrong.add(what + ": a form over the limit was answered " + firstLine(refused).strip()
							+ " and not 413, so the filter that reads it is not behind the limit");
				}

				wrong.addAll(differences(what + " against its twin", refused, address,
						answerTo("PUT", twinOf(address), caller, form, anObjectOf(OVER), chunked),
						twinOf(address)));
			}

			String untouched = answerTo("PUT", address, caller, form, anObjectOf(ON_THE_LINE), false);

			if (firstLine(untouched).equals("HTTP/1.1 413 ")) {
				wrong.add("PUT " + address + " as " + caller + ": a form exactly on the line was refused");
			}
		}

		assertThat(wrong).as("a form a filter reads before the door is not bound the way every body is")
				.isEmpty();
		assertThat(firstLine(answerTo("PUT", address, null, form, anObjectOf(ON_THE_LINE), false)))
				.as("a form under the limit and nobody signed in is not told to sign in")
				.isEqualTo("HTTP/1.1 401 ");
	}

	/**
	 * THE FILTER SITS IN FRONT OF THE ONES THAT READ A BODY, asked of the context and not trusted.
	 *
	 * <p>The two that do are {@code FormContentFilter} and the security chain, whose {@code CsrfFilter}
	 * may ask for a parameter. Behind either, a body read there would never have passed through the
	 * counted stream. Both are found in the context, so a Spring release that moves one cannot leave
	 * this asking about nothing.
	 */
	@Test
	void theFilterSitsInFrontOfTheOnesThatReadABody() {
		Map<String, FormContentFilter> forms = context.getBeansOfType(FormContentFilter.class);
		Map<String, DelegatingFilterProxyRegistrationBean> security =
				context.getBeansOfType(DelegatingFilterProxyRegistrationBean.class);

		assertThat(forms).as("no FormContentFilter is registered, so whether this filter sits ahead of"
				+ " it is a question about nothing").isNotEmpty();
		assertThat(security).as("no security chain is registered, so whether this filter sits ahead of"
				+ " it is a question about nothing").isNotEmpty();
		assertThat(context.getBean(NoBodyIsLargerThan.class).getOrder()).isEqualTo(NoBodyIsLargerThan.ORDER);

		for (FormContentFilter one : forms.values()) {
			assertThat(NoBodyIsLargerThan.ORDER)
					.as("FormContentFilter is ahead of the limit, so a form is read whole before it sees it")
					.isLessThan(((Ordered) one).getOrder());
		}

		for (DelegatingFilterProxyRegistrationBean one : security.values()) {
			assertThat(NoBodyIsLargerThan.ORDER)
					.as("the security chain is ahead of the limit, so whatever it reads is not counted")
					.isLessThan(one.getOrder());
		}
	}

	/**
	 * WHAT THE LIMIT DOES NOT REACH, MEASURED AND WRITTEN DOWN: A FORM THE CONTAINER PARSES ITSELF.
	 *
	 * <p>A {@code POST} of form content with no CSRF header is asked by {@code CsrfFilter} for its
	 * {@code _csrf} as a PARAMETER, and the container answers that by parsing the whole body on its own,
	 * not through any stream this class wraps. It is refused by the CSRF filter's 403 for the missing
	 * token and not by this class's 413, at a length over the limit, and it is bounded by the
	 * connector's own {@code maxPostSize}, which is read off the running server below. No route of this
	 * portal declares a form as what it takes, so nothing legitimate is in that gap - and it is written
	 * here as a boundary and not patched, because it is not this class's to patch.
	 */
	@Test
	void aFormTheContainerParsesItselfIsLeftToTheContainer() throws Exception {
		String form = "Content-Type: application/x-www-form-urlencoded\r\n";

		String small = answerTo("POST", "/api/sign-in", null, form, "a=b".getBytes(), false, false);
		String over = answerTo("POST", "/api/sign-in", null, form, anObjectOf(OVER), false, false);

		assertThat(firstLine(small))
				.as("a small form with no CSRF header is not refused by the CSRF filter, so what the"
						+ " comparison below measures is something else")
				.isEqualTo("HTTP/1.1 403 ");
		assertThat(differences("a form of " + OVER + " bytes against a form of three, neither with the"
				+ " token", over, "/api/sign-in", small, "/api/sign-in"))
				.as("the container's own parsing is bounded by this class after all, which is a boundary"
						+ " that moved and has to be written down again")
				.isEmpty();

		int theContainersOwn = ((TomcatWebServer) ((ServletWebServerApplicationContext) context)
				.getWebServer()).getTomcat().getConnector().getMaxPostSize();

		assertThat(theContainersOwn)
				.as("the container's own bound on a form it parses itself moved from two mebibytes, and"
						+ " the note in NoBodyIsLargerThan has to say what it is now")
				.isEqualTo(2 * 1024 * 1024);
	}
}
