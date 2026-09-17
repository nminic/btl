package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.server.PathContainer;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.servlet.function.support.RouterFunctionMapping;
import org.springframework.web.servlet.handler.AbstractUrlHandlerMapping;
import org.springframework.web.servlet.mvc.condition.PathPatternsRequestCondition;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.RequestMappingInfoHandlerMapping;
import org.springframework.web.util.pattern.PathPattern;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * NO MAPPING PUTS A WRITE ON THE OPEN LIST, asked of the mapping and not of whether a
 * particular annotation was typed onto a method.
 *
 * <p><b>The title says „no mapping" and not „nothing", and the difference was paid
 * for.</b> An earlier draft of this file promised that nothing on the open list can
 * finish a write. That promise has no floor in a case built on mappings: a servlet
 * filter can do the write and answer 200 without the request ever reaching one.
 * Measured 17.09.2026 - a filter deleting a row of {@code price_row} on
 * {@code POST /api/pricing} left this case and all of {@code ApiSecurityTest},
 * {@code RightsAtTheDoorTest}, {@code RightsOverRealHttpTest}, {@code PricingApiTest}
 * and {@code WhoIsAskingTest} green, 56 cases in all. The portal already holds a filter
 * over {@code /api/**} ({@code WhoIsAsking}), so the shape is not hypothetical. **That
 * is a real gap and this is where it is written down**; what this case does hold is
 * every route that goes through a mapping, which is every route the portal has.
 *
 * <p><b>The finding, 17.09.2026.</b> {@link ApiSecurity#READ_BY_ANYBODY} opens a path
 * for reading, and nothing in the repository asked the dispatcher what ELSE that same
 * path answers to. Proved with a probe added straight onto {@code /api/pricing}: a
 * {@code @PostMapping} doing {@code delete from price_row where key = 'referral'},
 * reached over a real socket with no session at all, a {@code XSRF-TOKEN} cookie and an
 * {@code X-XSRF-TOKEN} header carrying one value the caller invented, the same value in
 * both places. One request, 200, and the whole suite - {@code ApiSecurityTest} and
 * {@code RightsAtTheDoorTest} included - stayed green throughout.
 *
 * <p><b>Why the two existing floors did not see it, and neither is repaired here.</b>
 * {@code ApiSecurityTest.nothingOpenForReadingIsOpenForWriting} posts with no CSRF
 * token, so it is refused before the dispatcher is ever asked whether a handler exists;
 * the answer is 403 whether or not one does, and the case cannot tell the two apart.
 * {@code RightsAtTheDoorTest.everyRouteTheControllersMapEitherNeedsARightOrIsNamedHere}
 * filters every path on the open list OUT before asking its question, on purpose - that
 * is the shape a list meant to be left alone takes. A write on an open path is exactly
 * the case neither one stands in front of.
 *
 * <p><b>So the question here is not whether a {@code @PostMapping} was written.</b> The
 * number of ways to spell a write handler is not closed - {@code @PostMapping},
 * {@code @RequestMapping(method = POST)}, a second controller answering the same
 * address - and a floor built to recognise one spelling would be one draft away from
 * missing the next. What is closed is what every spelling resolves INTO, so the
 * question is put to {@link RequestMappingHandlerMapping} itself: which methods does it
 * map onto this path, read through {@link RequestMappingInfo#getMethodsCondition()} the
 * same way {@code ApiSecurityTest.answersAGet} already reads that condition for GET.
 *
 * <p><b>The pod is the constant itself, not a list copied out of it.</b> Every path this
 * case checks comes from {@code ApiSecurity.READ_BY_ANYBODY} at the moment the test
 * runs. Nothing here spells out {@code "/api/places"} or counts how many there are, so a
 * resource opened tomorrow arrives at this case already covered.
 *
 * <p><b>And the count is asserted before the loop that would otherwise hide losing
 * it.</b> A source read as an empty list runs its loop zero times, and every assertion
 * inside the loop along with it - a guard that passes by having measured nothing. So the
 * non-emptiness of {@code ApiSecurity.READ_BY_ANYBODY} is its own assertion, ahead of
 * anything that iterates it; and for each path in it, that the dispatcher maps anything
 * there at all is asserted before asking what it maps beside reading, for the identical
 * reason one level down.
 *
 * <p><b>What reading is allowed to mean: {@code GET}, {@code HEAD} and {@code OPTIONS},
 * checked against what is mapped today rather than assumed.</b> Every controller behind
 * every path on the open list carries exactly one {@code @GetMapping} and nothing else;
 * {@code HEAD} and {@code OPTIONS} are never a method this case finds DECLARED anywhere
 * - they are Spring answering a {@code GET}-only mapping on its own, which is what
 * {@code ApiSecurity}'s own comment on {@code requestMatchers(HttpMethod.OPTIONS, ...)}
 * already says: the dispatcher answers {@code OPTIONS} itself, out of the methods a path
 * maps, without ever reaching a handler. A fourth method appearing on the open list
 * tomorrow is not something this case widens itself to allow; it is a decision for
 * whoever opens it, reported rather than absorbed.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class OpenRoutesStayReadOnlyTest {

	/** Reading, and nothing beside it, is what an address on the open list may answer. */
	private static final Set<RequestMethod> READING =
			EnumSet.of(RequestMethod.GET, RequestMethod.HEAD, RequestMethod.OPTIONS);

	/**
	 * And everything that is not reading, derived rather than listed, so a method
	 * added to {@code RequestMethod} tomorrow is asked about without anybody
	 * remembering to add it here.
	 */
	private static final Set<RequestMethod> BESIDE_READING =
			EnumSet.complementOf(EnumSet.copyOf(READING));

	/** What the dispatcher registers by URL today, as a snapshot rather than as a rule. */
	private static final List<String> SNIMAK_ADRESA_PO_IMENU = List.of(
			"SimpleUrlHandlerMapping /**",
			"SimpleUrlHandlerMapping /webjars/**");

	/**
	 * EVERY handler mapping the dispatcher holds, not the one this file happens to know.
	 *
	 * <p><b>The second draft asked a single {@code RequestMappingHandlerMapping} and that
	 * was a high finding.</b> The dispatcher walks its mappings in order, and a route
	 * registered in any other one - a {@code RouterFunction} bean is the cheap example -
	 * simply does not exist for a case that asks only the first. Measured: a router
	 * function answering {@code POST /api/pricing} deleted a row of {@code price_row} for
	 * a caller with no session, and the case stayed green.
	 */
	@Autowired
	private List<HandlerMapping> everyMapping;

	/**
	 * NOTHING ON THE OPEN LIST ANSWERS TO ANYTHING BESIDE READING.
	 *
	 * <p>Two assertions per path and neither one skippable: first that the dispatcher
	 * maps SOMETHING there at all, because a path on the open list that nothing answers
	 * would let the second assertion pass having asked nothing; then that whatever it
	 * maps is a subset of {@link #READING}.
	 */
	@Test
	void everyOpenRouteAnswersOnlyToReading() {
		assertThat(ApiSecurity.READ_BY_ANYBODY)
				.as("the open list is empty, so this checks nothing")
				.isNotEmpty();

		/* AND THE DISPATCHER HOLDS NOTHING THIS CASE CANNOT READ, compared as a WHOLE
		   SNAPSHOT rather than one kind at a time.

		   The draft before this one named the class and then closed a single instance of
		   it: it had one assertion about `RouterFunctionMapping` and skipped every other
		   kind in silence. Measured - the dispatcher holds NINE mappings, this case read
		   two of them, and `@Bean("/api/pricing")` of type `HttpRequestHandler` answered
		   POST through `BeanNameUrlHandlerMapping`, deleted a row of `price_row` and
		   returned 200 to a caller with no session, with the case green.

		   A list of kinds cannot be finished by thinking about kinds - that is measured on
		   this project and written down. A snapshot can: it converges in one round, and
		   the tenth kind that appears tomorrow fails here and gets decided once, instead
		   of waiting for somebody to notice it is missing. The floor under the snapshot is
		   the live context, not memory. */
		assertThat(everyMapping.stream().map(m -> m.getClass().getSimpleName()).sorted().toList())
				.as("the dispatcher holds a kind of mapping this case has never been told about;"
						+ " read it, decide whether it can carry a route, then move this snapshot")
				.containsExactly(
						"AdditionalHealthEndpointPathsWebMvcHandlerMapping",
						"BeanNameUrlHandlerMapping",
						"ControllerEndpointHandlerMapping",
						"Lookup",
						"RouterFunctionMapping",
						"SimpleUrlHandlerMapping",
						"WebMvcEndpointHandlerMapping",
						"WelcomePageHandlerMapping",
						"WelcomePageNotAcceptableHandlerMapping");

		/* AND WHAT CAN CARRY A ROUTE WITHOUT BEING WALKED BELOW CARRIES ONLY WHAT IT
		   ALWAYS HAS. A route registered by URL - `@Bean("/api/pricing")` of type
		   `HttpRequestHandler` is the cheap way - answers every verb and is not a
		   mapping, so the walk below cannot see it. Measured: exactly that bean deleted a
		   row of `price_row` and returned 200 to a caller with no session, with this case
		   green. The two Spring registers by itself serve static files and answer reading
		   only; they are here as a snapshot so a tenth entry has to be looked at. */
		List<String> registeredByUrl = new ArrayList<>();

		for (HandlerMapping mapping : everyMapping) {
			if (mapping instanceof RouterFunctionMapping router) {
				assertThat(router.getRouterFunction())
						.as("the portal now registers routes as router functions, which this case"
								+ " does not walk; it measures mapping-held routes only")
						.isNull();
			}

			if (mapping instanceof AbstractUrlHandlerMapping byUrl) {
				byUrl.getHandlerMap().keySet().forEach(
						one -> registeredByUrl.add(mapping.getClass().getSimpleName() + " " + one));
			}
		}

		assertThat(registeredByUrl.stream().sorted().toList())
				.as("a route is registered by URL rather than by mapping; it answers every verb"
						+ " and nothing below walks it, so read it and decide before moving this")
				.isEqualTo(SNIMAK_ADRESA_PO_IMENU);

		for (String open : ApiSecurity.READ_BY_ANYBODY) {
			Set<RequestMethod> mapped = verbsMappedOnto(open);

			assertThat(mapped)
					.as("%s is on the open list but no mapping puts any verb on it, so asking what"
							+ " it answers beside reading measures nothing", open)
					.isNotEmpty();

			Set<RequestMethod> beside = EnumSet.copyOf(mapped);
			beside.retainAll(BESIDE_READING);

			assertThat(beside)
					.as("%s is open to anybody to read and a mapping also puts %s on it, so a write"
							+ " with a self-chosen CSRF cookie and header, no session at all,"
							+ " finishes there", open, beside)
					.isEmpty();
		}
	}

	/**
	 * WHICH VERBS ANY MAPPING PUTS ON THIS ADDRESS, and the address is matched by the
	 * same pattern resolver the dispatcher uses.
	 *
	 * <p><b>Two drafts died here and both died of the same thing: a question whose answer
	 * depended on something the case had to guess.</b> The first compared the TEXT of a
	 * mapping's pattern with the entry on the open list, so a write mapped as
	 * {@code /api/pricing/&#42;&#42;} was invisible - a pattern is a spelling and one
	 * address has many. The second built a request and asked the dispatcher to resolve
	 * it, so a write mapped with {@code consumes}, {@code headers} or {@code params} was
	 * invisible - resolution answers about THAT request, and the case would have had to
	 * guess every header somebody might require. Both were measured with a probe that
	 * deleted a row of {@code price_row} for a caller with no session at all.
	 *
	 * <p><b>The question that has a floor is about the MAPPING, not about a request.</b>
	 * Does any {@code RequestMappingInfo} the dispatcher holds put a verb that is not
	 * reading onto this address? A mapping's own patterns answer whether it covers the
	 * address, asked through {@link PathPattern#matches} rather than through string
	 * equality, and its method condition answers which verbs it carries. Neither depends
	 * on a header, a content type or a parameter, so there is nothing left to guess.
	 *
	 * <p>A mapping that names no verb at all carries every one there is, POST included.
	 */
	private Set<RequestMethod> verbsMappedOnto(String path) {
		PathContainer address = PathContainer.parsePath(path);
		Set<RequestMethod> found = EnumSet.noneOf(RequestMethod.class);

		for (HandlerMapping mapping : everyMapping) {
			if (!(mapping instanceof RequestMappingInfoHandlerMapping annotated)) {
				continue;
			}

			for (RequestMappingInfo info : annotated.getHandlerMethods().keySet()) {
				if (!covers(info, address)) {
					continue;
				}

				Set<RequestMethod> declared = info.getMethodsCondition().getMethods();
				found.addAll(declared.isEmpty() ? EnumSet.allOf(RequestMethod.class) : declared);
			}
		}

		return found;
	}

	/**
	 * Whether this mapping covers the address, decided by the pattern and not by its
	 * spelling.
	 *
	 * <p><b>There is no fallback to string comparison, and that is deliberate.</b> The
	 * draft before this one fell back on {@code getDirectPaths()} when the pattern
	 * condition was absent, which is a comparison of text - the very thing that killed
	 * the first draft, and weaker still: {@code getDirectPaths()} is EMPTY for any
	 * pattern with a wildcard. Measured: one line,
	 * {@code spring.mvc.pathmatch.matching-strategy=ant-path-matcher}, makes that branch
	 * the only one that runs, and a write on {@code /api/pricing/&#42;&#42;} goes
	 * invisible again. So the condition is asserted instead: the day the strategy moves,
	 * this case fails and says so.
	 */
	private static boolean covers(RequestMappingInfo info, PathContainer address) {
		PathPatternsRequestCondition patterns = info.getPathPatternsCondition();

		assertThat(patterns)
				.as("%s is matched by the old ant strategy, where this case would compare text"
						+ " instead of patterns and a wildcard write would go unseen", info)
				.isNotNull();

		for (PathPattern pattern : patterns.getPatterns()) {
			if (pattern.matches(address)) {
				return true;
			}
		}

		return false;
	}
}
