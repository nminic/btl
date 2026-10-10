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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.util.ClassUtils;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerExecutionChain;
import org.springframework.web.servlet.mvc.condition.PathPatternsRequestCondition;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import org.springframework.web.util.ServletRequestPathUtils;

import java.io.ByteArrayOutputStream;
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
import java.util.Set;
import java.util.TreeSet;
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
 * a truncated one, none, an array, text, the word {@code null}, and one a byte longer than
 * {@link NoBodyIsLargerThan#BYTES}, declared and in chunks. Pinned to 404, so that two answers that
 * are both a fault are not "the same".
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
 * <p><b>THE BODY OVER THE LINE IS THERE BECAUSE IT IS THE ONLY TRACE OF A BODY READ TOO EARLY.</b> A
 * route that reads its body BEFORE it asks which member is asking, and judges it AFTER, leaves nothing
 * for a small body to show: the parse error is swallowed and the bytes are thrown away, so every body
 * above is answered as if the question had come first. What an early read leaves behind is the limit -
 * a body over the line is refused 413 by whoever reads it - so one is sent to the accounts that name
 * no member and has to be answered exactly like the others. Found by the independent review of PR 471
 * (02.10.2026): a read lifted above the question in one handler passed every case here, and the case
 * in {@code NoBodyIsLargerThanOverRealHttpTest} that should have seen it excused any caller who was
 * told 413.
 *
 * <p><b>AND THE ANCHOR, which is what keeps a route that was simply broken from satisfying all of
 * that.</b> A member is told 400, in the route's own words, for a body that cannot be read, and 413 for
 * one that is too long: so the route DOES read it, and the account that names no member is turned away
 * before it does.
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

	private static final String JSON = "application/json";

	/** Any text the parts of {@link #aPictureWithItsCircle} do not contain would do. */
	private static final String A_BOUNDARY = "b257-p8u-no-part-says-this";

	private static final String MULTIPART = "multipart/form-data; boundary=" + A_BOUNDARY;

	private static final Pattern A_VARIABLE = Pattern.compile("\\{[^/}]*\\}");

	private static final String A_MEMBER = "b205-clan@primer.rs";
	private static final String MODERATOR_WITH_NO_MEMBER = "b205-moderator-bez-clana@primer.rs";
	private static final String MODERATOR_WITH_EVERY_RIGHT = "b205-moderator-sva-prava@primer.rs";

	private static final String THE_MEMBERS_NUMBER = "990201";

	/**
	 * A MEMBER WHO REGISTERED AND HAS NEVER PAID: no number (V16) and not active. Since P8U every act of
	 * his own turns him away down the branch it turns away an account naming no member, so he is told
	 * exactly what that account is told (PDL P8, 10.10.2026, quoted on
	 * {@link ActiveMemberOrAdministration}).
	 * {@link #aMemberWhoHasNotPaidIsToldWhatAnAccountThatNamesNoMemberIsTold} asks it of every one of them.
	 */
	private static final String A_MEMBER_WHO_HAS_NOT_PAID = "b257-neplacen@primer.rs";

	/** {@code competitor.id} of the member who has not paid, who has no number to be found by. */
	private long theMemberWhoHasNotPaid;

	/**
	 * EVERY BODY THAT IS NOT THE ONE THE FORM ASKS FOR, and each is a different way of not being it:
	 * cut short, nothing, the wrong shape, not JSON at all, and JSON that says nothing.
	 */
	private static final List<String> BODIES_THAT_ARE_NOT_THE_FORM =
			List.of("{", "", "[]", "nije json", "null");

	/** One byte over the line. */
	private static final int OVER = (int) NoBodyIsLargerThan.BYTES + 1;

	/**
	 * A body one byte over the line that parses to a form with nothing in it, so that the only thing
	 * that can be said about it is its length.
	 */
	private static byte[] aBodyOverTheLine() {
		String start = "{\"p\":\"";
		String end = "\"}";

		return (start + "a".repeat(OVER - start.length() - end.length()) + end)
				.getBytes(StandardCharsets.ISO_8859_1);
	}

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

		theMemberWhoHasNotPaid = db.sql("insert into competitor (member_number, first_name, last_name,"
						+ " gender, birth_date, place_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (null, 'Neplacen', 'Neplacenic', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, false, 'payment', ?, '',"
						+ " false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')"
						+ " returning id")
				.param("b257000000000001").query(Long.class).single();

		account(A_MEMBER_WHO_HAS_NOT_PAID, "competitor");
		db.sql("update account set competitor_id = ? where email = ?")
				.params(theMemberWhoHasNotPaid, A_MEMBER_WHO_HAS_NOT_PAID).update();

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
		db.sql("delete from competitor where id = ?").param(theMemberWhoHasNotPaid).update();
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
		return answerTo(method, path, email, body.getBytes(StandardCharsets.ISO_8859_1), false);
	}

	/**
	 * @param chunked whether the body DECLARES no length and arrives in chunks, which is the shape a
	 *                limit written only against {@code Content-Length} never sees
	 */
	private String answerTo(String method, String path, String email, byte[] body, boolean chunked)
			throws Exception {
		return answerTo(method, path, email, JSON, body, chunked);
	}

	/**
	 * @param contentType what the body is declared to be, or {@code null} for a request that declares
	 *                    none, which is how a write with no body is really sent
	 */
	private String answerTo(String method, String path, String email, String contentType, byte[] body,
			boolean chunked) throws Exception {
		String cookies = "XSRF-TOKEN=" + A_TOKEN
				+ (email == null ? "" : "; " + SessionCookie.NAME + "=" + sessions.get(email));

		ByteArrayOutputStream asking = new ByteArrayOutputStream();

		asking.write((method + " " + path + " HTTP/1.1\r\n"
				+ "Host: localhost:" + port + "\r\n"
				+ "Cookie: " + cookies + "\r\n"
				+ "X-XSRF-TOKEN: " + A_TOKEN + "\r\n"
				+ (contentType == null ? "" : "Content-Type: " + contentType + "\r\n")
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
	 * list of classes, and answered in ONE place: {@link RightsAtTheDoorTest#asksWhichMember} says how,
	 * and since P8U that includes a class which asks through {@link ActiveMemberOrAdministration}.
	 */
	private static boolean asksWhichMember(Class<?> controller) {
		return RightsAtTheDoorTest.asksWhichMember(ClassUtils.getUserClass(controller));
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

	/** How the body of an act is sent, which is read off what its mapping consumes. */
	private enum Takes {
		JSON, A_PICTURE, NOTHING
	}

	/**
	 * ONE ACT OF HIS OWN, AS A REQUEST ITS ROUTE TAKES.
	 *
	 * @param what        its name: the key it has in {@code AN_ACT_OF_HIS_OWN}, or the field of
	 *                    {@code PUT /api/me} that it is
	 * @param handler     the handler the dispatcher maps the name to
	 * @param open        whether {@link ApiSecurity#READ_BY_ANYBODY} opens the ADDRESS for reading, which
	 *                    decides whether a twin is a comparison that is true of it
	 * @param contentType what the request declares, or {@code null} for a write that has no body
	 * @param form        the request the form sends
	 * @param everyBody   whether a member who has not paid is turned away BEFORE any of the body is read,
	 *                    so that a body which cannot be read, or one over the line, must be answered like
	 *                    the one that can. {@code PUT /api/me} is not such a route: it reads the body to
	 *                    see whether it names a field that makes him seen, which is what refuses him
	 */
	private record ActAsSent(String what, String verb, String pattern, boolean open, HandlerMethod handler,
			Takes takes, String contentType, byte[] form, boolean everyBody) {

		/** The address with every key a number that matches no row. */
		String address() {
			return A_VARIABLE.matcher(pattern).replaceAll(A_NUMBER_WITH_NO_ROW);
		}
	}

	/** Every path pattern a mapping answers, the way {@link #routes} reads them. */
	private static Set<String> patternsOf(RequestMappingInfo info) {
		PathPatternsRequestCondition patterns = info.getPathPatternsCondition();

		return patterns == null ? info.getDirectPaths() : patterns.getPatternValues();
	}

	/** The one handler the dispatcher maps a verb and a path to, and a failure where it maps none or two. */
	private Map.Entry<RequestMappingInfo, HandlerMethod> mappingOf(String verb, String pattern) {
		List<Map.Entry<RequestMappingInfo, HandlerMethod>> found = mappings.getHandlerMethods().entrySet()
				.stream()
				.filter(one -> one.getKey().getMethodsCondition().getMethods().stream()
						.anyMatch(method -> method.name().equals(verb)))
				.filter(one -> patternsOf(one.getKey()).contains(pattern))
				.toList();

		assertThat(found)
				.as("%s %s is mapped to %d handlers, and an act is sent to exactly one", verb, pattern,
						found.size())
				.hasSize(1);

		return found.get(0);
	}

	/**
	 * A WELL FORMED MULTIPART REQUEST WITH ONE FILE AND THREE FIELDS: a picture and the circle over it.
	 *
	 * <p>The names are the photo route's own and nothing here depends on them. What this request has to
	 * be is one the container parses and the dispatcher hands to that route, and the second is held by
	 * {@link #theDispatcherTakesIt}: a request the dispatcher hands to no route would be answered like an
	 * address that maps nothing by everybody, and every comparison would be about nothing.
	 */
	private static byte[] aPictureWithItsCircle() {
		ByteArrayOutputStream parts = new ByteArrayOutputStream();

		parts.writeBytes(("--" + A_BOUNDARY + "\r\n"
				+ "Content-Disposition: form-data; name=\"picture\"; filename=\"p.jpg\"\r\n"
				+ "Content-Type: image/jpeg\r\n\r\n").getBytes(StandardCharsets.ISO_8859_1));
		parts.writeBytes(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 'b', '2', '5', '7'});
		parts.writeBytes("\r\n".getBytes(StandardCharsets.ISO_8859_1));

		for (String field : List.of("cropX", "cropY", "cropSize")) {
			parts.writeBytes(("--" + A_BOUNDARY + "\r\n"
					+ "Content-Disposition: form-data; name=\"" + field + "\"\r\n\r\n"
					+ "0.5\r\n").getBytes(StandardCharsets.ISO_8859_1));
		}

		parts.writeBytes(("--" + A_BOUNDARY + "--\r\n").getBytes(StandardCharsets.ISO_8859_1));

		return parts.toByteArray();
	}

	/**
	 * THE DISPATCHER HANDS THE REQUEST THAT WILL BE SENT TO THE HANDLER OF THE ACT, and to no other.
	 *
	 * <p><b>This is the anchor, and nothing else in this class can be.</b> A refusal of a member who has
	 * not paid is a 404 with nothing in it, and so is the answer to a request the dispatcher takes for
	 * nothing: a verb the address does not take, or a body the mapping does not consume, is turned into
	 * the answer of an address that maps nothing ({@code NothingIsHereRatherThanAlmost}), on purpose. So
	 * a request that was simply wrongly built is answered like a refusal by EVERYBODY, the member, the
	 * moderator and the twin, and every comparison below would hold having measured nothing. The member
	 * whose fee stands cannot say it either: against a key that matches no row he is answered 404 by the
	 * route's own line, which is the same bytes. So the dispatcher is asked, with the verb, the address
	 * and the content type that go down the socket.
	 */
	private void theDispatcherTakesIt(ActAsSent act) throws Exception {
		MockHttpServletRequest asking = new MockHttpServletRequest(act.verb(), act.address());

		if (act.contentType() != null) {
			asking.setContentType(act.contentType());
		}

		ServletRequestPathUtils.parseAndCache(asking);

		HandlerExecutionChain chain = mappings.getHandler(asking);

		assertThat(chain)
				.as("%s: the dispatcher hands the request this class sends to no handler at all, so"
						+ " everybody is answered like an address that maps nothing", act.what())
				.isNotNull();
		assertThat(((HandlerMethod) chain.getHandler()).getMethod())
				.as("%s: the request this class sends is handed to another handler than the act's own",
						act.what())
				.isEqualTo(act.handler().getMethod());
	}

	/**
	 * EVERY ACT OF HIS OWN, AS A REQUEST ITS ROUTE TAKES.
	 *
	 * <p><b>The names are a list this class does not keep.</b> They are the keys of
	 * {@code NoWriteTakesAMemberWhoHasNotPaidTest.AN_ACT_OF_HIS_OWN}, which that class compares with the
	 * dispatcher exactly and in both directions ({@code everyWriteIsOnExactlyOneList}): a write mapped
	 * tomorrow fails THERE until it is on a list, and the day it goes onto this one it is compared HERE
	 * without anybody remembering that this class exists. Taking them from {@link #routes} instead is what
	 * this replaced, and it asked about nine of the twenty-two: that derivation takes a handler that binds
	 * its body, and so left out the eleven acts that take none, the picture, and the message that reads
	 * the request by hand (found by the independent review of PR 522).
	 *
	 * <p><b>How each is sent is read off its mapping and not written here</b>: JSON where the mapping
	 * consumes JSON, built from the type of the body where the handler declares one; a multipart request
	 * where it consumes that; nothing, with no content type, where it consumes nothing. A mapping that
	 * consumes anything else is a failure and not an act that is skipped.
	 */
	private List<ActAsSent> actsOfHisOwn() throws Exception {
		List<ActAsSent> found = new ArrayList<>();

		for (String name : new TreeSet<>(NoWriteTakesAMemberWhoHasNotPaidTest.AN_ACT_OF_HIS_OWN.keySet())) {
			String verb = name.substring(0, name.indexOf(' '));
			String pattern = name.substring(name.indexOf(' ') + 1);
			Map.Entry<RequestMappingInfo, HandlerMethod> mapped = mappingOf(verb, pattern);
			Set<MediaType> consumes = mapped.getKey().getConsumesCondition().getConsumableMediaTypes();
			boolean open = ApiSecurity.READ_BY_ANYBODY.contains(pattern);

			if (consumes.isEmpty()) {
				found.add(new ActAsSent(name, verb, pattern, open, mapped.getValue(), Takes.NOTHING, null,
						new byte[0], true));
			}
			else if (consumes.contains(MediaType.APPLICATION_JSON)) {
				String body = TheBodyOf.type(mapped.getValue())
						.map(ABodyIsReadAfterTheDoorOverRealHttpTest::validBodyOf).orElse("{}");

				found.add(new ActAsSent(name, verb, pattern, open, mapped.getValue(), Takes.JSON, JSON,
						body.getBytes(StandardCharsets.ISO_8859_1), true));
			}
			else if (consumes.contains(MediaType.MULTIPART_FORM_DATA)) {
				found.add(new ActAsSent(name, verb, pattern, open, mapped.getValue(), Takes.A_PICTURE,
						MULTIPART, aPictureWithItsCircle(), true));
			}
			else {
				throw new AssertionError(name + " consumes " + consumes + ", which this class does not know"
						+ " how to send, so the act would be compared without being asked");
			}
		}

		return found;
	}

	/**
	 * THE ONE ACT OF {@code PUT /api/me} A MEMBER WHO HAS NOT PAID IS REFUSED, once for each field that
	 * makes him seen.
	 *
	 * <p>PDL P8 gives him the rest of the route, „svoje podatke za evidenciju i majicu", so the route is
	 * on the list of what he MAY do and not on {@code AN_ACT_OF_HIS_OWN}; what he is refused is a body that
	 * NAMES one of the fields on {@link MeWriteApi#ONLY_A_MEMBER_WHOSE_FEE_STANDS_CHANGES}. That list is the
	 * production code's own, so the names are read from it, and the value each is sent with is built from
	 * the type {@link MeWriteApi.Change} declares for it. The route reads its body before it can know
	 * whether it names one, so a body that cannot be read is not turned away and is not asked about.
	 */
	private List<ActAsSent> theBiographyAndTheSwitch() {
		Map.Entry<RequestMappingInfo, HandlerMethod> mapped = mappingOf("PUT", "/api/me");
		List<ActAsSent> found = new ArrayList<>();

		assertThat(mapped.getKey().getConsumesCondition().getConsumableMediaTypes())
				.as("PUT /api/me does not consume JSON, so a body naming a field is sent as something it"
						+ " does not take")
				.contains(MediaType.APPLICATION_JSON);

		for (String name : MeWriteApi.ONLY_A_MEMBER_WHOSE_FEE_STANDS_CHANGES) {
			RecordComponent declared = Stream.of(MeWriteApi.Change.class.getRecordComponents())
					.filter(one -> one.getName().equals(name)).findFirst().orElse(null);
			String value = declared == null ? null : aValueFor(declared);

			assertThat(value)
					.as("MeWriteApi.Change declares no field %s that this class can write a value for, so"
							+ " the field that makes him seen would not be sent", name)
					.isNotNull();

			found.add(new ActAsSent("PUT /api/me naming " + name, "PUT", "/api/me",
					ApiSecurity.READ_BY_ANYBODY.contains("/api/me"), mapped.getValue(), Takes.JSON, JSON,
					("{" + value + "}").getBytes(StandardCharsets.ISO_8859_1), false));
		}

		return found;
	}

	/**
	 * EVERYTHING A MEMBER WHO HAS NOT PAID IS REFUSED, EACH ASKED OF THE DISPATCHER BEFORE IT IS SENT.
	 *
	 * <p>The acts of {@link #actsOfHisOwn} and the two fields of {@link #theBiographyAndTheSwitch}. The
	 * dispatcher is asked here and not in the case that compares, so that no comparison can be run on a
	 * request that was not checked.
	 */
	private List<ActAsSent> everyActHeIsRefused() throws Exception {
		List<ActAsSent> found = new ArrayList<>(actsOfHisOwn());

		found.addAll(theBiographyAndTheSwitch());

		for (ActAsSent one : found) {
			theDispatcherTakesIt(one);
		}

		return found;
	}

	/** The members this class asks about, each a different way of not having paid. */
	private static List<String> membersWhoHaveNotPaid() {
		return List.of(A_MEMBER_WHO_HAS_NOT_PAID);
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
		assertThat(db.sql("select c.member_number is null and not c.active from account a"
						+ " join competitor c on c.id = a.competitor_id where a.email = ?")
				.param(A_MEMBER_WHO_HAS_NOT_PAID).query(Boolean.class).single())
				.as("the member who has not paid names a member who carries a number or is active, so"
						+ " the case about him is about somebody else")
				.isTrue();
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

				/* AND A BODY ONE BYTE OVER THE LINE, the only thing a read that came BEFORE the question
				   leaves behind: it is refused 413 by whoever reads it, and nobody reads his. */
				for (boolean chunked : new boolean[] {false, true}) {
					wrong.addAll(differences(route + " as " + caller + ", a body one byte over the line, "
							+ (chunked ? "chunked" : "declared"),
							answerTo(route.verb(), address, caller, aBodyOverTheLine(), chunked), address,
							reference, address));
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

			/* A BODY OVER THE LINE TOO, declared and in chunks: 401 comes from the chain before anything
			   reads a byte, and a limit that refused it first, for everybody, would turn 401 into 413. */
			for (boolean chunked : new boolean[] {false, true}) {
				String toTheRoute = answerTo(route.verb(), address, null, aBodyOverTheLine(), chunked);
				String what = route + " with a body one byte over the line, "
						+ (chunked ? "chunked" : "declared") + ", and nobody signed in";

				if (!firstLine(toTheRoute).equals("HTTP/1.1 401 ")) {
					wrong.add(what + " was not told to sign in, but " + firstLine(toTheRoute).strip());
				}

				wrong.addAll(differences(what + " against its twin", toTheRoute, address,
						answerTo(route.verb(), twin, null, aBodyOverTheLine(), chunked), twin));
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

	/**
	 * THE OTHER HALF OF THE ANCHOR: THE BODY OVER THE LINE IS READ, AND REFUSED 413, WHEN IT IS A MEMBER'S.
	 *
	 * <p>The comparison above sends a body over the line to the accounts that name no member and requires
	 * it to be answered like any other. That says something only if the same body, sent by somebody the
	 * route does read, is refused: without this a limit that bounded nothing would leave the comparison
	 * true of every route, the one that reads early included. Declared and chunked, because the first
	 * is refused when the stream is first asked for and the second at the byte that crosses the line.
	 */
	@Test
	void aMemberWhoseBodyIsTooLongIsToldSoBecauseTheRouteReadsIt() throws Exception {
		List<String> wrong = new ArrayList<>();

		for (Route route : routes()) {
			for (boolean chunked : new boolean[] {false, true}) {
				String answer = answerTo(route.verb(), route.address(), A_MEMBER, aBodyOverTheLine(), chunked);

				if (!firstLine(answer).equals("HTTP/1.1 413 ")) {
					wrong.add(route + " with a body one byte over the line, " + (chunked ? "chunked" : "declared")
							+ ", as a member was answered " + firstLine(answer).strip() + " and not 413");
				}
			}
		}

		assertThat(wrong)
				.as("a member's body over the line was read and not refused, so a body that reaches nobody is"
						+ " compared above with a body that reaches nobody")
				.isEmpty();
	}

	/**
	 * ONLY THE ACCOUNT THAT NAMES NO MEMBER CHANGES: A MEMBER THE ROUTE SENDS AWAY IS STILL TOLD ABOUT HIS
	 * BODY FIRST.
	 *
	 * <p>{@code POST /api/teams} is the one route with a question about WHO between „has he a member" and
	 * the form: {@code JoiningATeam} sends away a member who is in a team already or who asks outside the
	 * window. Its body was bound before any of that, so such a member was told 400 for a body that cannot
	 * be read and is told 400 now, on the day the window is shut and on the day it is open. Folded into the
	 * form questions below the member question, as one more way for the form to be empty, the same body would
	 * be 404 for him - a change nobody asked for, in the one answer this increment is not about.
	 *
	 * <p>The member really is sent away, which is what the valid body proves: it is the 404 of the
	 * question about who, and the unreadable body is told something else. He stands in a team from the
	 * league's first season with no end, which refuses him on every day there is.
	 */
	@Test
	void aMemberTheRouteSendsAwayIsToldTheFormIsNotCompleteBeforeAnythingAboutWho() throws Exception {
		String slug = "b205-tim";

		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id) values (?, ?, '', '', (select id from place"
						+ " where rank = 1), null, null, null, 2027,"
						+ " (select id from competitor where member_number = ?))")
				.params(slug, slug, THE_MEMBERS_NUMBER).update();
		db.sql("insert into team_membership (competitor_id, team_id, season_from)"
						+ " values ((select id from competitor where member_number = ?),"
						+ " (select id from team where slug = ?), 2027)")
				.params(THE_MEMBERS_NUMBER, slug).update();

		try {
			Route proposing = routes().stream().filter(one -> one.toString().equals("POST /api/teams"))
					.findFirst().orElseThrow();

			assertThat(firstLine(answerTo(proposing.verb(), proposing.address(), A_MEMBER, proposing.body())))
					.as("a member who stands in a team was not sent away by the question about who, so"
							+ " the case below is about a member nothing turns away")
					.isEqualTo("HTTP/1.1 404 ");

			for (String body : BODIES_THAT_ARE_NOT_THE_FORM) {
				String answer = answerTo(proposing.verb(), proposing.address(), A_MEMBER, body);

				assertThat(answer)
						.as("body [%s] as a member the route sends away: the form is not told to be"
								+ " incomplete before anything about who, as it was when the body was an"
								+ " argument", body)
						.startsWith("HTTP/1.1 400 ")
						.contains("\"reason\":\"theFormIsNotComplete\"");
			}
		}
		finally {
			db.sql("delete from team where slug = ?").param(slug).update();
		}
	}

	/**
	 * EVERY ACT OF HIS OWN IS SENT, AND IN EVERY SHAPE THE PORTAL TAKES ONE.
	 *
	 * <p>Asserted before anything is compared, for the reason the floor above gives: a derivation that
	 * found fewer acts than the list holds, or found only the ones that take JSON, would make every
	 * comparison below true while asking about the rest. The three shapes are the ones a write can take
	 * here - a JSON body, a picture, no body at all - and each must be sent by at least one act, or the
	 * way that shape is sent is never asked about. Both kinds of address are asked about too, because
	 * the twin is the comparison for one of them and not for the other.
	 */
	@Test
	void everyActOfHisOwnIsSentAsItsRouteTakesIt() throws Exception {
		List<ActAsSent> acts = actsOfHisOwn();

		assertThat(acts.stream().map(ActAsSent::what).toList())
				.as("an act on AN_ACT_OF_HIS_OWN is not sent, or one is sent that is not on it")
				.containsExactlyInAnyOrderElementsOf(
						NoWriteTakesAMemberWhoHasNotPaidTest.AN_ACT_OF_HIS_OWN.keySet());
		assertThat(acts.stream().map(ActAsSent::takes).distinct().toList())
				.as("no act takes one of the shapes a write can take, so the way that shape is sent is"
						+ " never asked about")
				.containsExactlyInAnyOrder(Takes.values());
		assertThat(acts.stream().filter(ActAsSent::open).count())
				.as("no act is on an address opened for reading, so the comparison that is not with a twin"
						+ " is never asked about")
				.isPositive();
		assertThat(acts.stream().filter(one -> !one.open()).count())
				.as("every act is on an address opened for reading, so the comparison with a twin is never"
						+ " asked about")
				.isPositive();
		assertThat(theBiographyAndTheSwitch().stream().map(ActAsSent::what).toList())
				.as("a field that makes a member seen is not sent, or one is sent that is not on the list")
				.hasSameSizeAs(MeWriteApi.ONLY_A_MEMBER_WHOSE_FEE_STANDS_CHANGES);
	}

	/**
	 * A MEMBER WHO HAS NOT PAID IS TOLD, BYTE FOR BYTE, WHAT AN ACCOUNT THAT NAMES NO MEMBER IS TOLD, ON
	 * EVERY ACT OF HIS OWN AND ON THE TWO FIELDS OF {@code PUT /api/me} THAT MAKE HIM SEEN.
	 *
	 * <p>Since P8U every act on the second list of PDL P8 (10.10.2026) turns him away down the branch it
	 * turns away an account naming no member. What MockMvc cannot see is the road that answer takes: a
	 * status written onto the response and an error sent through the container are one number and
	 * different bytes, and the difference is an oracle for whether a write lives at the address (ADL A8,
	 * 13.09.2026). So his answer to the request the form sends is compared with the answer of the
	 * moderator who races for nobody to the same request, byte for byte; and on a route that takes JSON,
	 * every other body, the one over the line included, is compared the same way, which is what shows his
	 * body is not read before his fee is asked.
	 *
	 * <p><b>AND, WHERE THE ADDRESS IS NOT ONE {@link ApiSecurity#READ_BY_ANYBODY} OPENS, WITH AN ADDRESS
	 * THAT MAPS NOTHING.</b> Two answers that went down the SAME wrong road agree with each other and
	 * with nothing else: the member's refusal and the moderator's are written by the same handler, so a
	 * refusal turned into a status written onto the response for both of them is equal to itself and
	 * different from the container's error document. On an open address the twin is not the comparison
	 * (the decision of 18.09.2026 keeps the status written there, and {@code OPTIONS} already says that a
	 * write lives at it), so the two answers are compared with each other alone.
	 *
	 * <p><b>Which acts, and how each is sent, is {@link #actsOfHisOwn}'s</b>, and the dispatcher is asked
	 * about every request before it goes down the socket ({@link #theDispatcherTakesIt}). The two fields
	 * of {@code PUT /api/me} are sent as a body that names them and nothing else, and not as every kind
	 * of body: that route reads the body to find out whether it names one.
	 *
	 * <p>Every route this class derives is also one of his own acts. A route that asks which member and
	 * takes a body but is one he MAY use before he pays would be answered otherwise, and belongs out of
	 * this comparison by name - so it fails here first, with that sentence, rather than as a difference in
	 * bytes.
	 */
	@Test
	void aMemberWhoHasNotPaidIsToldWhatAnAccountThatNamesNoMemberIsTold() throws Exception {
		assertThat(routes().stream().map(Route::toString)
				.filter(route -> !NoWriteTakesAMemberWhoHasNotPaidTest.AN_ACT_OF_HIS_OWN.containsKey(route))
				.toList())
				.as("a route that asks which member and takes a body is not one of the acts a member who"
						+ " has not paid is refused, so comparing him with an account naming no member there"
						+ " compares two different answers")
				.isEmpty();

		List<String> wrong = new ArrayList<>();

		for (ActAsSent act : everyActHeIsRefused()) {
			for (String caller : membersWhoHaveNotPaid()) {
				wrong.addAll(howHeIsRefused(caller, act));
			}
		}

		assertThat(wrong)
				.as("a member who has not paid was told something an account naming no member is not"
						+ " told, which says that a write lives at the address and that it is shut to him")
				.isEmpty();
	}

	/**
	 * WHAT ONE CALLER IS TOLD FOR ONE ACT, against what nobody is told and against what an address that
	 * maps nothing tells him. Every difference is returned, so that one run names every act that is
	 * wrong and not only the first in alphabetical order.
	 */
	private List<String> howHeIsRefused(String caller, ActAsSent act) throws Exception {
		List<String> wrong = new ArrayList<>(refusedLikeNobody(caller, act, act.what(), act.form(), false));
		String address = act.address();

		if (!act.open()) {
			String twin = twinOf(address);

			wrong.addAll(differences(act.what() + " from " + caller + " against its twin",
					answerTo(act.verb(), address, caller, act.contentType(), act.form(), false), address,
					answerTo(act.verb(), twin, caller, act.contentType(), act.form(), false), twin));
		}

		if (act.everyBody() && act.takes() == Takes.JSON) {
			for (String body : BODIES_THAT_ARE_NOT_THE_FORM) {
				wrong.addAll(refusedLikeNobody(caller, act, act.what() + ", body [" + body + "]",
						body.getBytes(StandardCharsets.ISO_8859_1), false));
			}

			for (boolean chunked : new boolean[] {false, true}) {
				wrong.addAll(refusedLikeNobody(caller, act, act.what() + ", a body one byte over the line, "
						+ (chunked ? "chunked" : "declared"), aBodyOverTheLine(), chunked));
			}
		}

		return wrong;
	}

	/**
	 * ONE REQUEST, ASKED OF THE CALLER AND OF THE MODERATOR WHO RACES FOR NOBODY: pinned to 404, so that
	 * two answers that are both a fault are not "the same", and then compared byte for byte.
	 */
	private List<String> refusedLikeNobody(String caller, ActAsSent act, String what, byte[] body,
			boolean chunked) throws Exception {

		List<String> wrong = new ArrayList<>();
		String address = act.address();
		String his = answerTo(act.verb(), address, caller, act.contentType(), body, chunked);

		if (!firstLine(his).equals("HTTP/1.1 404 ")) {
			wrong.add(what + " from " + caller + " was not answered as nothing is, but "
					+ firstLine(his).strip());
		}

		wrong.addAll(differences(what + " from " + caller + " against an account that names no member",
				his, address,
				answerTo(act.verb(), address, MODERATOR_WITH_NO_MEMBER, act.contentType(), body, chunked),
				address));

		return wrong;
	}
}
