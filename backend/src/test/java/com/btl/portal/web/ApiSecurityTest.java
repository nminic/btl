package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.util.ServletRequestPathUtils;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.condition.PathPatternsRequestCondition;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Who may ask the server for what, and what somebody who may not is told. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ApiSecurityTest {

	@Autowired
	private MockMvc http;

	/**
	 * The dispatcher itself, asked which paths it answers, rather than a list written
	 * again. Named, because the actuator registers a second mapping of this type and
	 * the portal's own controllers live in the first.
	 */
	@Autowired
	@Qualifier("requestMappingHandlerMapping")
	private RequestMappingHandlerMapping mappings;

	private int statusOf(String path) throws Exception {
		return http.perform(get(path)).andReturn().getResponse().getStatus();
	}

	/**
	 * A ROUTE WITH A VARIABLE IN IT, registered for this test and nowhere else.
	 *
	 * <p>It is here because the case below cannot otherwise measure what it says. The
	 * portal maps no such route today and the next one it writes will be a profile by
	 * member number, so without this the first draft of that case would ship green and
	 * go on being green while saying it had asked about every mapped route.
	 *
	 * <p>It is deliberately NOT on the open list and its method is never reached, so
	 * what it measures is the rule and not the handler.
	 */
	@TestConfiguration
	static class ARouteWithAVariableInIt {

		static final String PATTERN = "/api/one-with-a-variable/{id}";
		static final String ASKED_AS = "/api/one-with-a-variable/1";

		@RestController
		static class Probe {
			@GetMapping(PATTERN)
			String read(@PathVariable String id) {
				return id;
			}
		}
	}

	/**
	 * EVERY ROUTE NOBODY OPENED IS A ROUTE NOBODY CAN READ.
	 *
	 * <p>This is the whole of the configuration in one case: 401 rather than 404 is
	 * what says the rule is "shut unless opened by name". Were it the other way
	 * round, an endpoint added without a line in the configuration would be readable
	 * by anybody, and it would be found by whoever read it. It is also the case that
	 * would fail first the day somebody writes {@code permitAll()} across
	 * {@code /api/**} to make a test pass.
	 *
	 * <p><b>The route is not named here, it is asked of the dispatcher.</b> Until
	 * 13.09.2026 this case named {@code /api/competitors}, which was shut. The day
	 * that resource was opened the case went red, and had it instead been written
	 * against a path that was about to be opened tomorrow, it would have gone green
	 * and stopped measuring anything without a word. Naming a shut route is naming
	 * something that changes; the thing that does not change is "mapped, and not on
	 * the open list", and Spring already answers that question.
	 *
	 * <p>Today that leaves {@code /api/me}. Every resource opened from here on adds
	 * itself to the list above, and every one added WITHOUT a rule adds itself here.
	 *
	 * <p><b>Patterns count too, and that is not an afterthought.</b> A first draft read
	 * {@code getDirectPaths()}, which is empty for a mapping with a variable in it, so a
	 * route like {@code /api/members/{number}} was in neither list and nothing asked
	 * about it at all. The very next resource to be written is a profile by member
	 * number. So the patterns are taken from the mapping itself and each variable is
	 * asked with a sample value in its place.
	 */
	@Test
	void everyRouteNobodyOpenedIsARouteNobodyCanRead() throws Exception {
		List<String> shut = mappings.getHandlerMethods().keySet().stream()
				.filter(this::answersAGet)
				.flatMap(this::pathsOf)
				.filter(path -> path.startsWith("/api/"))
				.filter(path -> !ApiSecurity.READ_BY_ANYBODY.contains(path))
				.map(ApiSecurityTest::withASampleValue)
				.distinct().sorted().toList();

		assertThat(shut)
				.as("every route the portal maps is on the open list, so this compares nothing")
				.isNotEmpty();
		assertThat(shut)
				.as("a route with a variable in it was not asked about at all, which is how the"
						+ " first draft of this case managed to say nothing and stay green")
				.contains(ARouteWithAVariableInIt.ASKED_AS);

		for (String path : shut) {
			assertThat(reallyMapped(path))
					.as("%s is not a path this server maps at all, so asking it about a rule measures"
							+ " nothing; the pattern it was made from needs a sample value that fits", path)
					.isTrue();
			assertThat(statusOf(path))
					.as("%s has no rule of its own and answered somebody who is not signed in", path)
					.isEqualTo(401);
		}
	}

	/** A mapping that names no method at all answers every one of them, GET included. */
	private boolean answersAGet(RequestMappingInfo info) {
		Set<RequestMethod> methods = info.getMethodsCondition().getMethods();
		return methods.isEmpty() || methods.contains(RequestMethod.GET);
	}

	/** Every spelling the mapping answers to, variables and all, asked of the mapping itself. */
	private Stream<String> pathsOf(RequestMappingInfo info) {
		PathPatternsRequestCondition patterns = info.getPathPatternsCondition();
		return patterns == null ? info.getDirectPaths().stream()
				: patterns.getPatternValues().stream();
	}

	/**
	 * A path is asked of the server, so a variable has to become something. Anything
	 * does: the question is whether a rule lets it through, and no rule here is about
	 * the value.
	 */
	private static String withASampleValue(String pattern) {
		return pattern.replaceAll("\\{[^/}]*\\}", "1").replace("**", "1").replace("*", "1");
	}

	/**
	 * AND THE PATH MADE THAT WAY IS ONE THE SERVER REALLY ANSWERS TO, asked of the
	 * dispatcher rather than assumed.
	 *
	 * <p>Without this the case had a silent way to say nothing. A variable may carry a
	 * pattern of its own, and a member number does: `{number:[0-9]{6}}`. Substituting
	 * there produced `/api/members/1}`, which nothing maps, so the server answered 401
	 * because the path did not exist and the case went green over a route that was in
	 * fact wide open. A review measured exactly that, to a 200, on 13.09.2026.
	 *
	 * <p>So the sample value is still made the simple way, and then the dispatcher is
	 * asked whether what came out is a path it handles. If it is not, the case fails and
	 * says which pattern needs a value that fits, which is a question for whoever adds
	 * the route and not for whoever reads this later.
	 */
	private boolean reallyMapped(String path) throws Exception {
		MockHttpServletRequest asking = new MockHttpServletRequest("GET", path);
		ServletRequestPathUtils.parseAndCache(asking);
		return mappings.getHandler(asking) != null;
	}

	/**
	 * And that holds for a route that was never mapped at all, which is where a
	 * rule written per endpoint leaks.
	 *
	 * <p>The third of them is the one worth naming: a rule matching a path is a
	 * rule about that spelling, and a server that answers `/api/PLACES` the same
	 * way it answers `/api/places` has a second door beside every one it guards.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"/api/nema-ovoga", "/api/places/2", "/api/PLACES", "/api/places/"})
	void nothingUnderTheApiIsOpenByAccident(String path) throws Exception {
		assertThat(statusOf(path)).as("%s was answered without a rule opening it", path).isEqualTo(401);
	}

	/**
	 * AND THAT HOLDS FOR EVERY OPEN ROUTE, not for the one somebody thought of.
	 *
	 * <p>The cases above name `/api/places` because it was the first. A review on
	 * 12.09.2026 measured what naming costs: two routes had been opened and added to
	 * nothing else, so widening one of them to `/api/events/**` passed the whole
	 * suite without a word.
	 *
	 * <p>So the list is read off {@code ApiSecurity} itself rather than written
	 * again. Every route opened from now on arrives here with it, and the three
	 * spellings that are NOT it - a sub-path, a different case, a trailing slash -
	 * stay shut without anybody remembering to say so.
	 */
	@Test
	void noOpenRouteOpensAnythingBesideIt() throws Exception {
		assertThat(ApiSecurity.READ_BY_ANYBODY)
				.as("nothing is open at all, so this compares nothing")
				.isNotEmpty();

		for (String open : ApiSecurity.READ_BY_ANYBODY) {
			assertThat(statusOf(open))
					.as("%s is on the open list and is not open", open).isEqualTo(200);

			/* Only the LAST segment is respelled, not the whole path. Upper-casing
			   `/api` itself leaves the chain that guards `/api/**` altogether, and the
			   answer is 404 from a dispatcher that has no such mapping - which reveals
			   nothing, but is a different sentence from the one being asserted here. */
			String resource = open.substring(open.lastIndexOf('/') + 1);
			String respelt = open.substring(0, open.lastIndexOf('/') + 1)
					+ resource.toUpperCase(java.util.Locale.ROOT);

			for (String beside : new String[] {open + "/2", open + "/", respelt}) {
				assertThat(statusOf(beside))
						.as("%s was answered, and only %s is open", beside, open)
						.isEqualTo(401);
			}
		}
	}

	/**
	 * AND NOTHING ON THAT LIST MAY BE WRITTEN TO.
	 *
	 * <p>Open for reading is the whole of what was decided. A catalogue of towns
	 * anybody could post to is a catalogue anybody could edit, and the same goes for
	 * the calendar.
	 */
	@Test
	void nothingOpenForReadingIsOpenForWriting() throws Exception {
		for (String open : ApiSecurity.READ_BY_ANYBODY) {
			assertThat(http.perform(post(open)).andReturn().getResponse().getStatus())
					.as("%s could be written to by anybody", open)
					.isNotEqualTo(200);
		}
	}

	/**
	 * And a path that climbs out of the catalogue is refused before it is anything.
	 *
	 * <p>Its own case because the answer is 400 and not 401: the servlet container
	 * refuses a path with a `..` segment in it outright, before any rule here is
	 * consulted. Folded into the list above it would have read as "and this one is
	 * 401 too", which is not what was measured.
	 */
	@Test
	void aPathThatClimbsOutOfTheCatalogueIsRefusedOutright() throws Exception {
		assertThat(statusOf("/api/places/../results"))
				.as("a path with a climbing segment in it was served")
				.isEqualTo(400);
	}

	/**
	 * Writing is shut too, and on a path that is otherwise open.
	 *
	 * <p>Opening a resource for reading is not opening it for writing, and a rule
	 * written by path rather than by path and method would do exactly that. The
	 * catalogue of towns is the one path this configuration opens, so it is the
	 * one place that mistake could hide.
	 */
	@Test
	void anOpenPathIsOpenForReadingAndNotForWriting() throws Exception {
		assertThat(http.perform(post("/api/places")).andReturn().getResponse().getStatus())
				.as("the catalogue of towns could be written to by anybody")
				.isNotEqualTo(200);
	}

	/**
	 * NOTHING HANDS OUT A SESSION: measured over a real socket, not here.
	 *
	 * <p>That guard used to stand in this file and ask MockMvc. On 12.09.2026 it
	 * turned out MockMvc was answering about itself: {@code .with(csrf())} reaches
	 * into the shared filter chain of the cached context and swaps the token
	 * repository for a test one that keeps the token in a session, and the swap
	 * outlives the class that made it. Run after {@code SignInApiTest} in one JVM,
	 * the guard went red on a plain read of the codebook, on a server that had done
	 * nothing of the sort. It stayed green here and went red on CI for no reason
	 * other than the order the two run their classes in.
	 *
	 * <p>It now lives in {@code SignInOverRealHttpTest}, where a real container
	 * answers the question itself through an {@code HttpSessionListener}. Measured
	 * before this one was removed: putting back the leak of 11.09.2026 - the second
	 * chain carrying the default session backed CSRF repository again - turns the
	 * new guard red, and so do two other ways of leaking one.
	 */

	/**
	 * The health check stays reachable, because the container's own probe calls it.
	 *
	 * <p>It lives outside {@code /api} and is what the second chain exists for.
	 * Without that chain Spring's default one applies and asks a machine-to-machine
	 * probe to log in, at which point the container never turns healthy and QA
	 * never starts.
	 */
	@Test
	void theHealthCheckIsStillReachableByTheProbeThatWatchesIt() throws Exception {
		assertThat(statusOf("/actuator/health"))
				.as("the probe that decides whether QA is up was asked to sign in")
				.isEqualTo(200);
	}
}
