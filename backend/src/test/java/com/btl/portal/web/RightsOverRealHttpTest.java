package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.util.ServletRequestPathUtils;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.servlet.mvc.method.RequestMappingInfoHandlerMapping;

import java.lang.reflect.Method;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.condition.PathPatternsRequestCondition;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT A REFUSAL LOOKS LIKE ON THE WIRE, read off a socket byte for byte.
 *
 * <p><b>This class exists because a number is not an answer.</b> The owner decided on
 * 13.09.2026 that somebody without the right is told 404, so that an address does not say
 * it is there. That was carried out as a status and nothing else, and a security round the
 * same day measured what a status alone is worth:
 *
 * <table>
 * <caption>what the two answers were before this class existed</caption>
 * <tr><th></th><th>refused (the address exists)</th><th>the address does not exist</th></tr>
 * <tr><td>status</td><td>404</td><td>404</td></tr>
 * <tr><td>body</td><td>empty</td><td>the error document, as JSON</td></tr>
 * <tr><td>Content-Type</td><td>absent</td><td>application/json</td></tr>
 * <tr><td>on the wire</td><td>262 bytes, Content-Length: 0</td><td>412 bytes, chunked</td></tr>
 * </table>
 *
 * <p>One request per guess, and a plain member is enough to run it. What closed it is not
 * a shape made to look like the other one: the refusal now goes down the SAME road, {@code
 * sendError}, which is where an address that is not there already ends up, so the body,
 * the headers and the length are written by the same code rather than kept equal by hand.
 *
 * <p><b>And it is here rather than beside the other cases because MockMvc cannot see any
 * of this.</b> It does not run the container's ERROR dispatch, so the error document is
 * never written and the two answers look alike to it whichever way the code is written.
 * Measured rather than asserted: the comparison below, run through MockMvc against the
 * code as it was before the fix, PASSES. The precedent for coming down here is
 * {@code SignInOverRealHttpTest}, which exists for the same kind of reason.
 *
 * <p><b>The two addresses in each comparison are the same number of characters long</b>,
 * because the error document carries the path that was asked for. Paths of different
 * lengths would differ by a length that says nothing about whether either exists, and the
 * comparison would have to be loosened until it stopped measuring.
 *
 * <p><b>Every request carries a CSRF token, chosen here and sent as both the cookie and
 * the header.</b> Not decoration: without it an unsafe method is refused 403 by the CSRF
 * filter before anything else looks at it, so both answers come back identical and every
 * case about a method would pass while measuring the CSRF filter. That a caller writing
 * his own request can pick both halves is what {@code ApiSecurity} says in as many words,
 * and it is what an attacker does.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import({TestcontainersConfiguration.class, ProbeRoutes.class,
		ProbeRoutesForTheWire.class})
class RightsOverRealHttpTest {

	private static final String HOLDS_THE_TICK = "sa-pravom-kroz-mrezu@primer.rs";

	private static final String WITHOUT_THE_TICK = "bez-prava-kroz-mrezu@primer.rs";

	/** Signed in and holding nothing whatever, which is every member of the league. */
	private static final String A_COMPETITOR = "takmicar-kroz-mrezu@primer.rs";

	/** And every box in the matrix ticked, which is the moderator who knows the most. */
	private static final String EVERY_TICK = "sve-kucice-kroz-mrezu@primer.rs";

	/** The one account {@code /api/moderators} answers, and the anchor of the case below. */
	private static final String THE_SUPERADMIN = "superadmin-kroz-mrezu@primer.rs";

	/**
	 * The one route of the portal whose refusal is written by the RESOURCE and not by the
	 * door, because the privilege is decided by the row.
	 *
	 * <p>No probe can stand in for it, for the reason {@link ProbeRoutes#NO_TICK_OPENS}
	 * gives about the other unguarded shape: what the comparison is about is the address,
	 * and the address whose existence must not leak is this one.
	 */
	private static final String THE_QUEUE = "/api/verification";

	/** The token is any value at all, which is the point of it being sent twice. */
	private static final String A_TOKEN = "11111111-2222-3333-4444-555555555555";

	@LocalServerPort
	private int port;

	@Autowired
	private JdbcClient db;

	/** Both of {@link ApiSecurity}'s chains, so a twin's can be compared with its own. */
	@Autowired
	private List<SecurityFilterChain> chains;

	/** The dispatcher, asked whether an address is mapped at all. */
	@Autowired
	@Qualifier("requestMappingHandlerMapping")
	private RequestMappingHandlerMapping mappings;

	private final Map<String, String> sessions = new HashMap<>();

	/**
	 * FIVE ACCOUNTS ACROSS THREE ROLES.
	 *
	 * <p>The two moderators are what the first kind of guard needs: one holding the tick a
	 * probe asks for and one holding two others, so that no fixed code satisfies both.
	 *
	 * <p>The other three are what the SECOND kind needs, and each of them is a different
	 * thing. {@link #A_COMPETITOR} is the ordinary attacker: signed in, which is all it
	 * takes to run the oracle. {@link #EVERY_TICK} is the one the guard is really about,
	 * because nothing the superadmin can tick opens that route and a moderator holding
	 * everything is refused exactly as one holding nothing is. {@link #THE_SUPERADMIN} is
	 * the anchor, and without him a route that was simply broken would satisfy every
	 * comparison below by being missing for everybody.
	 */
	@BeforeEach
	void fiveAccountsAcrossThreeRoles() {
		account(HOLDS_THE_TICK, "moderator");
		account(WITHOUT_THE_TICK, "moderator");
		account(A_COMPETITOR, "competitor");
		account(EVERY_TICK, "moderator");
		account(THE_SUPERADMIN, "superadmin");

		ticked(HOLDS_THE_TICK, ProbeRoutes.THE_RIGHT_IT_NEEDS);
		ticked(WITHOUT_THE_TICK, ProbeRoutes.THE_OTHER_RIGHT, "entity:events");
		ticked(EVERY_TICK, everyRightThereIs().toArray(String[]::new));
	}

	/**
	 * Cleaned up by hand, because a real server answers on its own connection and a
	 * transaction around this thread would roll back nothing it can see.
	 *
	 * <p><b>Taken from what was really made rather than from a list written here.</b> A
	 * list is a second place the fixture is spelt, and an account added above and forgotten
	 * here would stay in the database for every suite that runs after this one.
	 */
	@AfterEach
	void takeThemBackOut() {
		for (String email : sessions.keySet()) {
			db.sql("delete from account where email = ?").param(email).update();
		}
	}

	private void account(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id) values ('Probni', 'Probic', ?, (select id from role where code = ?))")
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

	private void ticked(String email, String... rights) {
		for (String right : rights) {
			db.sql("insert into account_admin_right (account_id, right_code)"
							+ " values ((select id from account where email = ?), ?)")
					.params(email, right).update();
		}
	}

	/** Every box the matrix holds, read off the schema rather than written out here. */
	private List<String> everyRightThereIs() {
		return db.sql("select code from admin_right order by code").query(String.class).list();
	}

	private int ticksOf(String email) {
		return db.sql("select count(*) from account_admin_right where account_id ="
						+ " (select id from account where email = ?)")
				.param(email).query(Integer.class).single();
	}

	private String roleOf(String email) {
		return db.sql("select r.code from account a join role r on r.id = a.role_id"
						+ " where a.email = ?")
				.param(email).query(String.class).single();
	}

	/** The whole answer, headers and body and chunk sizes, exactly as it came off the wire. */
	private String answerTo(String method, String path, String email) throws Exception {
		return answerTo(method, path, email, A_TOKEN);
	}

	/**
	 * @param token the CSRF value to send as both the cookie and the header, or null to send
	 *              none - which is a setting of its own, because half of what the reviews
	 *              measured needed no token at all
	 */
	private String answerTo(String method, String path, String email, String token)
			throws Exception {
		return answerTo(method, path, email, token, "");
	}

	/**
	 * @param extra whole header lines, each ending in CRLF, for the cases whose whole point
	 *              is a header the mapping will not match
	 */
	private String answerTo(String method, String path, String email, String token, String extra)
			throws Exception {
		return answerTo(method, path, email, token, extra, "");
	}

	/**
	 * @param body what to send after the headers; its length is measured rather than written,
	 *             and it matters because a mapping that declares what it CONSUMES is only
	 *             asked about the type when something was really sent
	 */
	private String answerTo(String method, String path, String email, String token, String extra,
			String body) throws Exception {
		String cookies = (token == null ? "" : "XSRF-TOKEN=" + token)
				+ (email == null ? ""
						: (token == null ? "" : "; ") + SessionCookie.NAME + "="
								+ sessions.get(email));

		String asking = method + " " + path + " HTTP/1.1\r\n"
				+ "Host: localhost:" + port + "\r\n"
				+ (cookies.isEmpty() ? "" : "Cookie: " + cookies + "\r\n")
				+ (token == null ? "" : "X-XSRF-TOKEN: " + token + "\r\n")
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

	/**
	 * The answer without the two lines that must differ between any two requests.
	 *
	 * <p>{@code Date} moves with the clock and {@code Set-Cookie} carries a fresh CSRF
	 * token. Nothing else is allowed to differ, and in particular the length is kept: the
	 * chunk sizes and the body stay in, because the length was half of what gave the two
	 * answers away.
	 *
	 * <p><b>WHY {@code Set-Cookie} STILL GOES, measured on 14.09.2026 rather than carried
	 * over.</b> The twin used to be built outside {@code /api} and this line was throwing
	 * away the 69 bytes by which the two chains differed - so it was hiding the fault in
	 * the comparison itself, and the note here called that a blind spot and left it. With
	 * the twin a sibling ({@link #twinOf}) that reason is gone, and what is left was
	 * measured on a running server, both addresses of each pair asked in turn:
	 *
	 * <ul>
	 * <li>with the token sent, NOTHING under {@code /api} sets a cookie at all - zero
	 * {@code Set-Cookie} lines on both answers, 375 bytes against 375;
	 * <li>with no token sent, every answer under {@code /api} sets exactly one and it is
	 * 69 bytes long (444 against 375), because the repository mints a fresh one when the
	 * request carries none;
	 * <li>outside {@code /api} the CSRF filter is not in the chain and none is ever set.
	 * </ul>
	 *
	 * <p>So the line stays for one reason and it is the VALUE: a fresh {@code XSRF-TOKEN}
	 * is a different random string on every request, and two cases here send no token at
	 * all. Throwing the value away is not throwing the cookie away, and the difference is
	 * no longer left to a sentence - {@link #answersTheSameWay} compares the NAMES of the
	 * cookies each answer sets before this runs, so an answer that sets one the other does
	 * not is a failure rather than a blind spot.
	 */
	private static String withoutTheClock(String answer) {
		return answer.replaceAll("(?m)^Date:.*\r\n", "")
				.replaceAll("(?m)^Set-Cookie:.*\r\n", "");
	}

	/** The NAMES of the cookies an answer sets, which is what is NOT thrown away above. */
	private static List<String> setCookiesIn(String answer) {
		return answer.lines().filter(line -> line.startsWith("Set-Cookie:"))
				.map(line -> line.substring("Set-Cookie:".length()).trim().split("=")[0])
				.sorted().toList();
	}

	/**
	 * WHICH OF {@link ApiSecurity}'s CHAINS WOULD CONSIDER AN ADDRESS, asked of the chains
	 * themselves rather than worked out from the path.
	 *
	 * <p>The shape is {@code ApiSecurityTest.reallyMapped}'s, for the same reason: a
	 * question about what the server does with a path is asked of the thing that decides
	 * it. The positions rather than the chains are answered because a chain prints every
	 * filter in it, and a failure here has to be readable.
	 *
	 * <p>Asked with the METHOD the case is really asking with, and not with a {@code GET}
	 * written here. Neither chain looks at the method today, and a question that quietly
	 * answered about a different request than the one being compared would be the same kind
	 * of fault as the twin this floor exists to catch.
	 */
	private List<Integer> chainsConsidering(String method, String path) {
		MockHttpServletRequest asking = new MockHttpServletRequest(method, path);
		ServletRequestPathUtils.parseAndCache(asking);

		return IntStream.range(0, chains.size())
				.filter(at -> chains.get(at).matches(asking)).boxed().toList();
	}

	/** And without the two values inside the body that name the moment and the address. */
	private static String withoutTheMomentOrTheAddress(String answer, String path) {
		return withoutTheClock(answer)
				.replaceAll("\"timestamp\":\"[^\"]*\"", "\"timestamp\":\"AT SOME MOMENT\"")
				.replace(path, "THE ADDRESS THAT WAS ASKED FOR");
	}

	/**
	 * AN ADDRESS OF THE SAME LENGTH, BEHIND THE SAME CHAIN, THAT MAPS NOTHING - built
	 * rather than counted.
	 *
	 * <p>The error document carries the path that was asked for, so two addresses of
	 * different lengths differ by a length that says nothing about whether either exists.
	 * These twins were written out by hand until 13.09.2026, and a character miscounted
	 * there would have loosened a comparison without failing anything.
	 *
	 * <p><b>A SIBLING, which is the half that was wrong until 14.09.2026.</b> The twin used
	 * to be built at the root, so the twin of {@code /api/one-that-needs-a-right} was
	 * {@code /zzz...} - an address behind the OTHER chain {@link ApiSecurity} declares,
	 * where CSRF is disabled and no {@code XSRF-TOKEN} cookie is ever set. Measured on a
	 * running server: a {@code GET} under {@code /api} carried 353 bytes of headers and one
	 * of the same length outside carried 284, and all 69 bytes of the difference were the
	 * {@code Set-Cookie} line that {@link #withoutTheClock} throws away. The comparisons
	 * passed, and what they compared was an answer written by one chain against an answer
	 * written by another.
	 *
	 * <p>A sibling is matched by whatever matched the original - both chains here are
	 * decided on a path prefix, and a sibling changes nothing before the last {@code /} -
	 * so it needs no list of prefixes and no condition naming {@code /api}. The one case
	 * whose address really is outside {@code /api} gets a twin outside it too, by the same
	 * line and without asking for an exception.
	 */
	/** Every address the dispatcher maps, asked of it rather than assumed. */
	private Set<String> mapped() {
		Set<String> out = new HashSet<>();
		for (RequestMappingInfo info : mappings.getHandlerMethods().keySet()) {
			PathPatternsRequestCondition patterns = info.getPathPatternsCondition();
			if (patterns != null) {
				out.addAll(patterns.getPatternValues());
			}
		}
		return out;
	}

	/**
	 * THE MAPPING FOR ONE VERB AT ONE ADDRESS, asked of the dispatcher as a PAIR rather than
	 * of the path alone.
	 *
	 * <p><b>Found on review, and {@code mapped()} above cannot answer it.</b> Since the merge
	 * that gave three of the portal's addresses a second class - a read beside a write,
	 * {@code MeApi} beside {@code MeWriteApi}, {@code InboxApi} beside {@code InboxWriteApi},
	 * {@code NotificationApi} beside {@code NotificationWriteApi} - a path stays mapped
	 * whether or not the ONE VERB a case is about is the one answering it. {@code mapped()}
	 * would say {@code /api/me} exists even the day its {@code PUT} does not, because the
	 * {@code GET} still would.
	 *
	 * <p>Built the way {@link #takesOnly} reads the dispatcher: off
	 * {@code mappings.getHandlerMethods()}, matching the path condition and the method
	 * condition on the same {@link RequestMappingInfo} rather than two lists compared by
	 * hand.
	 */
	private RequestMappingInfo mappingFor(String method, String path) {
		for (Map.Entry<RequestMappingInfo, HandlerMethod> entry
				: mappings.getHandlerMethods().entrySet()) {
			RequestMappingInfo info = entry.getKey();
			PathPatternsRequestCondition patterns = info.getPathPatternsCondition();

			boolean answersThisPath = patterns != null && patterns.getPatternValues().contains(path);
			boolean answersThisMethod = info.getMethodsCondition().getMethods().stream()
					.anyMatch(one -> one.name().equals(method));

			if (answersThisPath && answersThisMethod) {
				return info;
			}
		}
		return null;
	}

	/**
	 * THE PORTAL'S OWN ADDRESSES THAT ANSWER THIS VERB AND NO OTHER, in one order, asked of
	 * the dispatcher.
	 *
	 * <p><b>Written down by hand until 19.09.2026, and each of them was a fact with a date
	 * on it.</b> {@code ProbeRoutes} named {@code /api/teams} as the address that takes only
	 * a {@code GET}; teams get a {@code POST} in the increment beside this one, and on that
	 * day the case below would have gone on passing while its subject changed underneath it -
	 * from "a verb this address does not take" to "a media type this address does not take",
	 * which is a different sentence with the same green tick. Nothing would have said so.
	 *
	 * <p><b>The methods are read off the mapping and not off the annotation</b>, the way
	 * {@code RightsAtTheDoorTest} reads them, so a route written with
	 * {@code @RequestMapping(method = ...)} counts exactly as one written with
	 * {@code @GetMapping}. A mapping that limits no verb has an empty condition and matches
	 * no single verb here, which is right: it answers all of them.
	 *
	 * <p><b>And probes are left out, asked of the annotation rather than of a list of their
	 * addresses.</b> Both probe configurations are imported into this context and both map
	 * routes nobody outside a test can reach; a case that says "one of the portal's own
	 * routes" must not quietly move onto one of them the day it happens to sort first. What
	 * marks them is that their controller is nested inside a {@code @TestConfiguration},
	 * which is what being a probe IS - there is nothing else to recognise and no name to
	 * keep.
	 */
	private List<String> takesOnly(String verb) {
		Map<String, Set<String>> verbs = new TreeMap<>();

		mappings.getHandlerMethods().forEach((info, handler) -> {
			if (!isAProbe(handler)) {
				PathPatternsRequestCondition patterns = info.getPathPatternsCondition();
				Set<String> answers = info.getMethodsCondition().getMethods().stream()
						.map(Enum::name).collect(Collectors.toSet());

				for (String path : patterns == null ? info.getDirectPaths()
						: patterns.getPatternValues()) {
					verbs.computeIfAbsent(path, any -> new HashSet<>()).addAll(answers);
				}
			}
		});

		return verbs.entrySet().stream()
				.filter(one -> one.getValue().equals(Set.of(verb)))
				.map(Map.Entry::getKey).toList();
	}

	/**
	 * A route registered only while a case is asking, which is what a probe is.
	 *
	 * <p><b>It changes nothing today, and that is measured rather than hoped.</b> Taking it
	 * out on 19.09.2026 left both cases green: the {@code GET} order is narrowed to the open
	 * list, which holds no probe, and the first address in the {@code POST} order is
	 * {@code /api/email-confirmation}, which sorts ahead of the one probe that takes only a
	 * {@code POST}. So this is a precaution and not a repair, written down as one - it is
	 * here for the day a probe does sort first, which is the day the case would stop being
	 * about the portal and start being about the test's own scaffolding, with nothing to say
	 * so. What DOES fall when the derivation finds nothing is measured beside it: asked for a
	 * verb no address takes alone, both methods below fail on their own sentence rather than
	 * settling for the nearest address.
	 */
	private static boolean isAProbe(HandlerMethod handler) {
		Class<?> nestedIn = handler.getBeanType().getEnclosingClass();

		return nestedIn != null && nestedIn.isAnnotationPresent(TestConfiguration.class);
	}

	/**
	 * AND THE ONE THE CASES BELOW USE, which is the first in that order and is asserted to
	 * exist rather than assumed.
	 *
	 * <p>The anchor of the {@code GET} case is that a stranger reading the address is
	 * answered 200, so the address has to be one anybody may read - {@code ApiSecurity}'s own
	 * open list, and not a guess. Without that condition the first address in the order would
	 * be one the chain refuses, the anchor would fail, and the case would be reporting a
	 * broken fixture instead of a rule.
	 */
	private String takesOnlyGet() {
		List<String> only = takesOnly("GET").stream()
				.filter(ApiSecurity.READ_BY_ANYBODY::contains).toList();

		assertThat(only)
				.as("the portal maps no open address for GET alone, so there is nothing to ask"
						+ " about a verb an address does not take; this needs a decision rather"
						+ " than the nearest address")
				.isNotEmpty();

		return only.getFirst();
	}

	/**
	 * AND THE SAME QUESTION FOR THE ONE THAT TAKES ONLY A WRITE.
	 *
	 * <p>No condition about the open list here, and there could not be one: the open list is
	 * about reading, and an address that answers nothing but a {@code POST} is on it by
	 * accident or not at all. What the case below needs of it is only that a {@code POST}
	 * reaches something - anything but a 404 - which every mapped address satisfies.
	 */
	private String takesOnlyPost() {
		List<String> only = takesOnly("POST");

		assertThat(only)
				.as("the portal maps no address for POST alone, so there is nothing to ask about"
						+ " a read of a route that only takes a write")
				.isNotEmpty();

		return only.getFirst();
	}

	private static String twinOf(String path) {
		String sameParent = path.substring(0, path.lastIndexOf('/') + 1);

		return sameParent + "z".repeat(path.length() - sameParent.length());
	}

	private void answersTheSameWay(String method, String real, String notThere, String email)
			throws Exception {
		answersTheSameWay(method, real, notThere, email, A_TOKEN);
	}

	private void answersTheSameWay(String method, String real, String notThere, String email,
			String token) throws Exception {
		answersTheSameWay(method, real, notThere, email, token, "");
	}

	private void answersTheSameWay(String method, String real, String notThere, String email,
			String token, String extra) throws Exception {
		answersTheSameWay(method, real, notThere, email, token, extra, "");
	}

	private void answersTheSameWay(String method, String real, String notThere, String email,
			String token, String extra, String body) throws Exception {
		String toTheReal = answerTo(method, real, email, token, extra, body);
		String toTheOther = answerTo(method, notThere, email, token, extra, body);

		assertThat(real)
				.as("the two addresses in this comparison are ONE address, so everything below is"
						+ " satisfied by an answer being equal to itself and measures nothing")
				.isNotEqualTo(notThere);

		assertThat(real.length())
				.as("the two addresses are not the same length, so the error document each of"
						+ " them carries makes them differ by a length that means nothing")
				.isEqualTo(notThere.length());

		assertThat(chains)
				.as("there is one SecurityFilterChain, so every address is considered by the same"
						+ " one and the floor below cannot fail whatever the twin is")
				.hasSizeGreaterThan(1);
		assertThat(chainsConsidering(method, notThere))
				.as("%s and %s are considered by DIFFERENT SecurityFilterChains, so this compares"
						+ " an answer one chain wrote against an answer another wrote - which is"
						+ " what a twin built at the root did until 14.09.2026", real, notThere)
				.isEqualTo(chainsConsidering(method, real));

		assertThat(setCookiesIn(toTheOther))
				.as("one answer set a cookie the other did not, and every Set-Cookie line is"
						+ " thrown away below - so that difference would go unseen")
				.isEqualTo(setCookiesIn(toTheReal));

		assertThat(withoutTheClock(toTheReal).length())
				.as("%s %s and %s %s came back different LENGTHS, which is an oracle for whether"
						+ " an address exists even when both say 404", method, real, method, notThere)
				.isEqualTo(withoutTheClock(toTheOther).length());

		assertThat(withoutTheMomentOrTheAddress(toTheReal, real))
				.as("%s on an address that exists and %s on one that does not came back"
						+ " different, so the answer says which is which", method, method)
				.isEqualTo(withoutTheMomentOrTheAddress(toTheOther, notThere));
	}

	/**
	 * A ROUTE HE MAY NOT READ ANSWERS EXACTLY LIKE AN ADDRESS THAT IS NOT THERE.
	 *
	 * <p>Whole answer, both ways: the same number of bytes, and the same bytes. {@code
	 * HEAD} as well as {@code GET}, because the measurement of 13.09.2026 found the two
	 * differed on both (243 against 275 bytes on {@code HEAD}).
	 */
	@ParameterizedTest
	@ValueSource(strings = {"GET", "HEAD"})
	void aRouteHeMayNotReadAnswersExactlyLikeAnAddressThatIsNotThere(String method)
			throws Exception {
		assertThat(answerTo("GET", ProbeRoutes.NEEDS_A_RIGHT, HOLDS_THE_TICK))
				.as("the guarded route does not answer the moderator who HOLDS its tick, so both"
						+ " addresses in this comparison are simply missing and it measures nothing")
				.startsWith("HTTP/1.1 200");

		answersTheSameWay(method, ProbeRoutes.NEEDS_A_RIGHT, twinOf(ProbeRoutes.NEEDS_A_RIGHT),
				WITHOUT_THE_TICK);
	}

	/**
	 * AND SO DOES THE ROUTE NO TICK OPENS, WHICH IS THE OTHER KIND OF GUARD.
	 *
	 * <p><b>This had no case at all until 14.09.2026, and what that cost was measured
	 * rather than supposed.</b> {@link RightIsNeeded} and {@link OnlyTheSuperadmin} end in
	 * one {@code sendError} today, and the case above measures the first of them - so a
	 * line put in front of that call for the second kind alone was invisible: the whole
	 * suite stayed green at 1660 cases while, on a socket, {@code /api/moderators} came
	 * back with {@code Content-Length: 0} and no {@code Content-Type} and an address that
	 * maps nothing came back chunked with 98 bytes of JSON. That is the finding of
	 * 13.09.2026 returned for another door: an oracle saying „this address is there", one
	 * request per guess, and the map it enumerates is the administrative one.
	 *
	 * <p><b>Asked by two people, because „may not" has two shapes here.</b> A plain
	 * competitor is all it takes to run the oracle. A moderator with every one of the ticks
	 * is the one the guard is really about - no box opens this route (PDL P28a, 13.08.2026,
	 * „Moderatori nemaju kolonu"), so he is refused exactly as one holding none is, and he is the
	 * attacker who already knows the most about the portal. The superadmin answering 200 is the
	 * anchor: without it a route that was simply broken would be missing for everybody and both
	 * comparisons would hold while measuring nothing.
	 */
	@ParameterizedTest
	@ValueSource(strings = {A_COMPETITOR, EVERY_TICK})
	void aRouteNoTickOpensAnswersExactlyLikeAnAddressThatIsNotThere(String asking)
			throws Exception {
		assertThat(answerTo("GET", ProbeRoutes.NO_TICK_OPENS, THE_SUPERADMIN))
				.as("%s does not answer the superadmin either, so both addresses in this"
						+ " comparison are simply missing and it measures nothing",
						ProbeRoutes.NO_TICK_OPENS)
				.startsWith("HTTP/1.1 200");

		assertThat(everyRightThereIs()).as("the matrix holds no ticks at all, so holding every"
				+ " tick is holding none and one of the two askers is not a setting").isNotEmpty();
		assertThat(ticksOf(EVERY_TICK))
				.as("this moderator does not really hold every tick there is, so his refusal says"
						+ " nothing about a tick not opening this route")
				.isEqualTo(everyRightThereIs().size());
		assertThat(List.of(roleOf(A_COMPETITOR), roleOf(EVERY_TICK)))
				.as("the two askers are not the two kinds this case is about, so it runs one"
						+ " setting twice")
				.containsExactly("competitor", "moderator");

		answersTheSameWay("GET", ProbeRoutes.NO_TICK_OPENS, twinOf(ProbeRoutes.NO_TICK_OPENS),
				asking);
	}

	/**
	 * AND SO DOES THE QUEUE, WHOSE REFUSAL IS DECIDED BY NO GUARD AT THE DOOR AT ALL.
	 *
	 * <p><b>A third shape of the same thing, and the first that {@link RightsAtTheDoor} does
	 * not write.</b> {@code /api/verification} carries neither {@link RightIsNeeded} nor
	 * {@link OnlyTheSuperadmin}, because the verification screen has SIX queues with one right
	 * apiece (PDL P28a, 24.08.2026, „Verifikacija ima šest redova") and the question it answers is
	 * „which of the six may he" rather than „may he" - so the refusal is written by the resource
	 * itself, and every sentence the long note in {@code RightsAtTheDoor} makes about the SHAPE of a
	 * refusal has to be true of a second caller of {@code sendError}, measured rather than trusted.
	 *
	 * <p><b>What a status alone would cost here is exactly what it cost there</b>: an oracle
	 * saying „this address is there", one request per guess, and the address it names is the
	 * administrative one the owner decided must not say so (ADL A8, 13.09.2026, „Server
	 * odbija moderatora bez privilegije sa 404"). MockMvc cannot see it - no ERROR dispatch - so
	 * {@code VerificationApiTest} can compare the numbers and nothing else.
	 *
	 * <p><b>Asked by two people who are refused for different reasons.</b>
	 * {@link #A_COMPETITOR} holds nothing at all, which is every member of the league.
	 * {@link #HOLDS_THE_TICK} is a MODERATOR holding {@code entity:members} - a right, just
	 * not a queue - and he is the one who separates „holds a queue" from „holds anything":
	 * a resource written the second way serves him every queue there is.
	 *
	 * <p><b>And {@link #WITHOUT_THE_TICK} is the anchor</b>, because he holds
	 * {@code queue:results}. Without him a route that was simply broken would be missing for
	 * everybody and both comparisons would hold while measuring nothing.
	 */
	@ParameterizedTest
	@ValueSource(strings = {A_COMPETITOR, HOLDS_THE_TICK})
	void theQueueSaysNothingToSomebodyWithNoQueueOfHisOwn(String asking) throws Exception {
		assertThat(answerTo("GET", THE_QUEUE, WITHOUT_THE_TICK))
				.as("%s does not answer the moderator who holds a queue tick, so both addresses in"
						+ " this comparison are simply missing and it measures nothing", THE_QUEUE)
				.startsWith("HTTP/1.1 200");

		assertThat(ticksOf(HOLDS_THE_TICK))
				.as("the moderator who is meant to hold a right that is not a queue holds none, so"
						+ " his refusal says nothing about entity rights")
				.isEqualTo(1);
		assertThat(List.of(roleOf(A_COMPETITOR), roleOf(HOLDS_THE_TICK)))
				.as("the two askers are not the two kinds this case is about, so it runs one"
						+ " setting twice")
				.containsExactly("competitor", "moderator");

		answersTheSameWay("GET", THE_QUEUE, twinOf(THE_QUEUE), asking);
	}

	/**
	 * AND A RESOURCE THAT REFUSES AN ACCOUNT WITH NO MEMBER ANSWERS LIKE AN ADDRESS THAT
	 * IS NOT THERE.
	 *
	 * <p><b>Why this is measured here and not where the three routes live.</b> All three of
	 * them already carry a case asserting the refusal has an empty body, and all three of
	 * those cases run through {@code MockMvc}, which - as {@code VerificationApi} writes down in
	 * as many words - never runs the container's ERROR dispatch and so cannot see what an
	 * address that is not there actually sends. Measured 17.09.2026: swapping
	 * {@code sendError} for {@code setStatus} on both routes left 48 cases green, while
	 * over a real socket the two answers then differ in LENGTH - and a length that differs
	 * is an oracle for whether an address exists, even when both say 404.
	 *
	 * <p>The twin is a sibling of the real address by {@link #twinOf}, so no list of
	 * prefixes is needed and nothing has to be kept equal by hand.
	 *
	 * <p><b>The four pairs below are written by hand, and that boundary is a decision and
	 * not an oversight (found on review, recorded rather than left for the next reader to
	 * question).</b> A floor over WHICH pairs belong on this list would have to track a
	 * value through the code to answer "does this route refuse a member-less account", the
	 * exact shape that has failed here before; nobody writes that floor by reading a
	 * dispatcher. What a floor CAN hold is narrower and it holds it: since
	 * {@link #mappingFor}, every pair named here is asked of the dispatcher and fails loudly
	 * if it is not really mapped, so a typo or a renamed route cannot pass in silence even
	 * though the choice of which pairs to list stays a human one.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"GET /api/inbox", "POST /api/inbox", "GET /api/me/notifications",
			"PUT /api/me"})
	void aResourceWithNoMemberBehindTheAccountAnswersLikeAnAddressThatIsNotThere(String pair)
			throws Exception {
		/* KEYED BY THE PAIR SINCE THIS BRANCH, not the bare path, the way
		   RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT has been since 19.09.2026: a write
		   added to an address already named here for a read must arrive as its own name
		   rather than borrow the verb the first entry happened to use. */
		String method = pair.substring(0, pair.indexOf(' '));
		String path = pair.substring(pair.indexOf(' ') + 1);

		/* AND THE ROUTE IS REALLY THERE, which the three cases beside this one all assert
		   first and for the reason they each write down: a route that was simply broken
		   would be missing for everybody, the twin and the original would be two absent
		   places, and the comparison would hold having measured nothing. Measured on
		   review - renaming both mappings to addresses nobody maps left this case green.

		   The anchor is the ANONYMOUS answer rather than a 200, because this resource
		   refuses even a signed-in account that names no member, which is the very thing
		   being compared below. `/api/...` answers 401 to somebody not signed in and the
		   twin does too, so that pair says nothing; what says something is that the
		   dispatcher maps the real path at all, and a path it maps refuses a WRITE with
		   405 while a path it does not map answers 404. */
		/* AND THE ROUTE IS REALLY THERE, which the three cases beside this one all assert
		   first, each writing down why: a route that was simply broken would be missing
		   for everybody, the twin and the original would be two absent places, and the
		   comparison would hold having measured nothing. Measured on review - renaming
		   both mappings to addresses nobody maps left this case green.

		   The anchor cannot be an answer, and that is worth writing down. Everything
		   under `/api` that is not open answers 401 to somebody not signed in, mapped or
		   not - measured: DELETE, OPTIONS and GET all give 401 on both the real path and
		   the twin. And this resource refuses even a signed-in account that names no
		   member, which is the very thing compared below. So the anchor asks the
		   DISPATCHER whether it maps the address at all, which is a question about the
		   route rather than about any one answer.

		   AND ASKED AS THE PAIR, NOT THE PATH ALONE, since the merge that gave /api/me,
		   /api/inbox and /api/me/notifications a second class apiece (found on review): a
		   path stays mapped on the strength of its GET whether or not the verb this case
		   is actually about still answers there. */
		RequestMappingInfo mapping = mappingFor(method, path);

		assertThat(mapping)
				.as("%s %s is not mapped at all, so this comparison is between two addresses"
						+ " that are both missing and it measures nothing", method, path)
				.isNotNull();
		assertThat(mapped())
				.as("%s is mapped, so this comparison is between two addresses that are both"
						+ " there and it measures nothing", twinOf(path))
				.doesNotContain(twinOf(path));

		/* THE MEDIA TYPE IS READ OFF THIS ROUTE rather than written here by hand (found on
		   review): a hand-written "application/json" agreed with every route that happened
		   to ask for exactly that and would have stayed green the day one asked for another
		   type, or none. The consumable types of the very mapping the anchor just confirmed
		   cannot disagree with the route, because they ARE the route.

		   AND WHY THIS DERIVATION DOES NOT MAKE THE GUARD BELOW CATCH A WRONG VALUE, written
		   down rather than left for the next reader to reach for the same wrong reason this
		   round did. The paragraph this replaced claimed a missing type would be measured
		   as a 415 the framework answers on its own; measured instead: for a WRITE THAT
		   CARRIES NO BODY, dropping the header changes nothing at all, because
		   {@link NothingIsHereRatherThanAlmost} turns every near miss the dispatcher can
		   raise at mapping time - a wrong method, a wrong media type - into the same "no
		   handler" answer a nonexistent address gets, on purpose, so that neither can be
		   told apart from an address that is not there. That is the class this route's own
		   404 already belongs to, not a gap beside it: the derivation above is correct
		   because it agrees with the route, not because disagreeing would be caught here. */
		Set<MediaType> consumes = mapping.getConsumesCondition().getConsumableMediaTypes();
		String extra = consumes.isEmpty() ? ""
				: "Content-Type: " + consumes.iterator().next() + "\r\n";

		answersTheSameWay(method, path, twinOf(path), A_COMPETITOR, A_TOKEN, extra);
	}

	/**
	 * AND A METHOD AN ADDRESS DOES NOT TAKE ANSWERS THE SAME WAY TOO.
	 *
	 * <p>Shutting {@code OPTIONS} shut one door of five. Spring works out from the mapped
	 * methods that a path exists but does not take this verb, before any handler runs, so
	 * nothing in the rights layer is consulted: {@code DELETE /api/teams} answered 405 with
	 * {@code Allow: GET} and {@code DELETE /api/sign-in} answered 405 with {@code Allow:
	 * POST}, while {@code DELETE} on an address mapping nothing answered 404.
	 *
	 * <p>Asked of one of the portal's own routes rather than a probe, and with the token, so
	 * that the CSRF filter is not what is being measured. WHICH route is asked of the
	 * dispatcher by {@link #takesOnlyGet()} rather than written here, and that changed on
	 * 19.09.2026: it used to be the word {@code /api/teams}, which is mapped for {@code GET}
	 * alone only until the increment that gives teams a {@code POST}.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"DELETE", "PUT", "PATCH", "POST"})
	void aMethodAnAddressDoesNotTakeAnswersLikeAnAddressThatIsNotThere(String method)
			throws Exception {
		String onlyGet = takesOnlyGet();

		assertThat(answerTo("GET", onlyGet, null))
				.as("%s is not a route that answers a plain read, so this comparison is between"
						+ " two addresses that are both missing", onlyGet)
				.startsWith("HTTP/1.1 200");

		assertThat(answerTo(method, onlyGet, WITHOUT_THE_TICK))
				.as("the answer listed which methods the address takes, which is the same"
						+ " sentence as saying it is there")
				.doesNotContain("Allow:");

		/* SIGNED IN, and that is part of the setting rather than a detail. An address the
		   portal does not open is refused 401 before anything is dispatched, so a stranger
		   gets 401 for the twin and 404 for the real one and the two would differ for a
		   reason that has nothing to do with this rule. The oracle belongs to somebody who
		   is signed in, which is every member of the league. */
		answersTheSameWay(method, onlyGet, twinOf(onlyGet), WITHOUT_THE_TICK);
	}

	/**
	 * AND SO DOES A PLAIN READ OF A ROUTE THAT ONLY TAKES A WRITE, WITH NO TOKEN AT ALL.
	 *
	 * <p>The other half of the finding, measured independently by the second review, and it
	 * is the half that says the CSRF token is no obstacle to any of this: a safe method
	 * never meets that filter, so a {@code GET} of a route mapped only for {@code POST}
	 * answered 405 with {@code Allow: POST} to somebody carrying nothing but a session.
	 *
	 * <p>Asked here without a token on purpose, so that nothing but the rule about methods
	 * can be what makes the two answers alike. WHICH route it is asked of comes off the
	 * dispatcher by {@link #takesOnlyPost()}, for the reason written over that method: the
	 * portal has several addresses that take nothing but a {@code POST}, the one that was
	 * written down here was signing in, and a name in a case is a fact with a date on it.
	 */
	@Test
	void aReadOfARouteThatOnlyTakesAWriteAnswersLikeAnAddressThatIsNotThere() throws Exception {
		String onlyPost = takesOnlyPost();

		assertThat(answerTo("POST", onlyPost, null))
				.as("%s does not take a POST at all, so this compares two addresses that are"
						+ " both missing", onlyPost)
				.doesNotStartWith("HTTP/1.1 404");

		assertThat(answerTo("GET", onlyPost, WITHOUT_THE_TICK, null))
				.as("a plain read, carrying no token whatsoever, was told which methods the"
						+ " address takes")
				.doesNotContain("Allow:");

		answersTheSameWay("GET", onlyPost, twinOf(onlyPost), WITHOUT_THE_TICK, null);
	}

	/**
	 * AND A METHOD AN ADDRESS DOES TAKE IS UNTOUCHED.
	 *
	 * <p>The other direction, and the one that matters for everything still to be written:
	 * every route that writes is a {@code POST} yet to come, and a rule that shut verbs by
	 * name rather than by what the address maps would shut them before they were written.
	 * Signing in is the one route in the portal today that takes a {@code POST}.
	 */
	@Test
	void aMethodAnAddressDoesTakeIsUntouched() throws Exception {
		assertThat(answerTo("POST", "/api/sign-in", null))
				.as("signing in was answered as though the address did not exist, so the rule"
						+ " about methods is shutting ones that ARE mapped")
				.doesNotStartWith("HTTP/1.1 404");
	}

	/**
	 * AND THE RULE ABOUT METHODS REACHES PAST {@code /api}, which is measured rather than
	 * claimed.
	 *
	 * <p>It is not narrowed to {@code /api} because a test of the path would be a branch
	 * that nothing could take: outside {@code /api} this application serves the health
	 * probe and nothing else. A branch nothing reaches is a branch nothing measures, so the
	 * rule is the whole application's - and where it reaches is a fact, so a case asks
	 * about it instead of a comment claiming it.
	 */
	@Test
	void aMethodAnAddressOutsideTheApiDoesNotTakeAnswersTheSameWay() throws Exception {
		assertThat(answerTo("GET", ProbeRoutesForTheWire.OUTSIDE_THE_API, null))
				.as("the route outside the api does not answer a plain read, so this compares two"
						+ " addresses that are both missing")
				.startsWith("HTTP/1.1 200");

		answersTheSameWay("DELETE", ProbeRoutesForTheWire.OUTSIDE_THE_API, twinOf(ProbeRoutesForTheWire.OUTSIDE_THE_API),
				null);
	}

	/**
	 * A GUARDED ROUTE THAT MAKES A SPREADSHEET SAYS NOTHING TO SOMEBODY ASKING FOR JSON.
	 *
	 * <p>The third round shut the verb. The dispatcher has three more ways of saying the same
	 * thing, and they all run in the same place, before any interceptor: a media type it will
	 * not PRODUCE, one it will not CONSUME, and a parameter it insists on. Each of them names
	 * something that exists - 406 came back carrying {@code Accept: text/csv}, which says
	 * there is a route here and it makes spreadsheets - while an address mapping nothing
	 * answered 404.
	 *
	 * <p>Not live in the portal today, because no route declares any of the three. It becomes
	 * live on the first day one exports a spreadsheet, and nothing in the rights layer would
	 * have noticed, because every case and every floor there reads {@code RightIsNeeded} and
	 * not the conditions of a mapping.
	 *
	 * <p><b>Asked by the moderator who DOES hold the tick, and that is the setting rather
	 * than a detail.</b> Asked by one who does not, the door refuses him 404 anyway, so a
	 * working rule and a broken one come back as the same number and the case passes while
	 * measuring nothing. That is not a worry, it happened: the first draft of these three
	 * built the header and never sent it, and two of them stayed green on the door's refusal.
	 * Asked by the holder, the only thing left that can refuse him is the mapping - and the
	 * assertion above, that he really is answered 200, is what says the header arrived.
	 */
	@Test
	void aGuardedRouteThatMakesASpreadsheetSaysNothingToSomebodyAskingForJson() throws Exception {
		assertThat(answerTo("GET", ProbeRoutesForTheWire.MAKES_ONLY_A_CSV, HOLDS_THE_TICK,
						A_TOKEN, "Accept: text/csv\r\n"))
				.as("the route does not answer the moderator who holds its tick even when he asks"
						+ " for what it makes, so this compares two addresses that are both missing")
				.startsWith("HTTP/1.1 200");

		answersTheSameWay("GET", ProbeRoutesForTheWire.MAKES_ONLY_A_CSV,
				twinOf(ProbeRoutesForTheWire.MAKES_ONLY_A_CSV), HOLDS_THE_TICK, A_TOKEN,
				"Accept: application/json\r\n");
	}

	/** AND ONE THAT ACCEPTS ONLY A SPREADSHEET SAYS NOTHING TO SOMEBODY SENDING JSON. */
	@Test
	void aGuardedRouteThatTakesOnlyASpreadsheetSaysNothingToSomebodySendingJson() throws Exception {
		assertThat(answerTo("POST", ProbeRoutesForTheWire.TAKES_ONLY_A_CSV, HOLDS_THE_TICK,
						A_TOKEN, "Content-Type: text/csv\r\n", "a;b;c"))
				.as("the route does not accept a spreadsheet from the moderator who holds its"
						+ " tick, so this compares two addresses that are both missing")
				.startsWith("HTTP/1.1 200");

		answersTheSameWay("POST", ProbeRoutesForTheWire.TAKES_ONLY_A_CSV,
				twinOf(ProbeRoutesForTheWire.TAKES_ONLY_A_CSV), HOLDS_THE_TICK, A_TOKEN,
				"Content-Type: application/json\r\n", "{}");
	}

	/** AND ONE THAT INSISTS ON A PARAMETER SAYS NOTHING WHEN IT IS MISSING. */
	@Test
	void aGuardedRouteThatInsistsOnAParameterSaysNothingWithoutIt() throws Exception {
		assertThat(answerTo("GET", ProbeRoutesForTheWire.NEEDS_A_PARAMETER + "?"
						+ ProbeRoutesForTheWire.THE_PARAMETER + "=2027", HOLDS_THE_TICK, A_TOKEN))
				.as("the route does not answer the moderator who holds its tick even with the"
						+ " parameter, so this compares two addresses that are both missing")
				.startsWith("HTTP/1.1 200");

		answersTheSameWay("GET", ProbeRoutesForTheWire.NEEDS_A_PARAMETER,
				twinOf(ProbeRoutesForTheWire.NEEDS_A_PARAMETER), HOLDS_THE_TICK);
	}

	/**
	 * AND AN ERROR IN WHAT WAS SENT IS STILL ANSWERED AS ONE.
	 *
	 * <p><b>This is the line in the other direction, and it had no case at all.</b> The
	 * javadoc of the advice that used to do this work named its own mutation - widen the
	 * catch and every failure in the portal becomes a bare 404 - and a review ran exactly
	 * that: the whole suite stayed green. The cost is not today's exposure but tomorrow's
	 * blindness: a portal that answers 404 to a malformed request cannot tell a member what
	 * is wrong with it, and one that answers 404 to its own faults cannot be operated.
	 *
	 * <p>Signing in with nothing in the body is a request the portal must go on refusing with
	 * 400, because that is a sentence about what was SENT and not about what exists.
	 *
	 * <p><b>Signing in BY NAME, and it is the one place here that names an address on
	 * purpose.</b> The two cases above want any address that takes a write and ask the
	 * dispatcher for one; this one is about signing in - the request with a body the portal
	 * must read, sent by somebody who is not signed in and so has nothing else to try. Any
	 * other write would be a different sentence that happened to answer 400 as well, which is
	 * a case measuring a number rather than a route.
	 */
	@Test
	void anErrorInWhatWasSentIsStillAnsweredAsOne() throws Exception {
		assertThat(answerTo("POST", "/api/sign-in", null, A_TOKEN,
						"Content-Type: application/json\r\n"))
				.as("a request the portal cannot read was answered as though the address did not"
						+ " exist, so nothing can tell the sender what is wrong with it")
				.startsWith("HTTP/1.1 400");
	}

	/** AND A FAILURE WHILE ANSWERING IS STILL A FAILURE. */
	@Test
	void aFailureWhileAnsweringIsStillAFailure() throws Exception {
		assertThat(answerTo("GET", ProbeRoutesForTheWire.FALLS_OVER, WITHOUT_THE_TICK))
				.as("a route that fell over answered as though it were not there, so an outage"
						+ " reads as a typo and nobody watching the portal can see it")
				.startsWith("HTTP/1.1 500");
	}

	/**
	 * EVERY WAY THE LOOKUP CAN REFUSE COMES OUT OF ONE DOOR, and that is why no branch is
	 * named anywhere.
	 *
	 * <p>{@code NothingIsHereRatherThanAlmost} does not list the four reasons the dispatcher
	 * can give; it takes whatever {@code handleNoMatch} throws. That is only complete while
	 * the signature of that method allows nothing else, so the signature is read off the
	 * class rather than believed - and the day a Spring release widens it, this goes red and
	 * asks for a decision once, instead of a fifth round finding a fifth branch.
	 */
	@Test
	void everyWayTheLookupCanRefuseComesOutOfOneDoor() throws Exception {
		Method lookup = RequestMappingInfoHandlerMapping.class.getDeclaredMethod("handleNoMatch",
				Set.class, String.class, HttpServletRequest.class);

		List<Class<?>> waysOut = List.of(lookup.getExceptionTypes());

		assertThat(waysOut)
				.as("the dispatcher's lookup declares nothing it can throw, so catching what it"
						+ " throws catches nothing and this floor is satisfied by itself")
				.isNotEmpty();

		assertThat(waysOut)
				.as("the lookup can refuse in a way that is not a ServletException, so the"
						+ " conversion no longer covers every branch of it and the reasons have"
						+ " to be named again")
				.containsExactly(ServletException.class);
	}
}
