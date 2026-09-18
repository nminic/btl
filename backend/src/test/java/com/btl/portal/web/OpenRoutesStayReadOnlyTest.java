package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.server.PathContainer;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.HandlerExecutionChain;
import org.springframework.web.servlet.HandlerMapping;
import org.springframework.web.servlet.mvc.condition.PathPatternsRequestCondition;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.RequestMappingInfoHandlerMapping;
import org.springframework.web.servlet.resource.ResourceHttpRequestHandler;
import org.springframework.web.util.ServletRequestPathUtils;
import org.springframework.web.util.pattern.PathPattern;

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
 * <p><b>And a second thing beside the filter, written down for the same reason: a
 * {@code @GetMapping} that writes.</b> „Reading" in this file is a question about which
 * VERB a method is annotated with, asked before any handler is ever invoked; it is not
 * a question about what the method's body then does. A controller answering
 * {@code @GetMapping("/api/places")} by also running an {@code update} against
 * {@code price_row} would pass every assertion below, because every one of them stops
 * at "which verbs are mapped" and none of them calls the method to see. What this case
 * holds is that no SEPARATE verb is mapped beside reading; that a route mapped as
 * reading is honestly read-only inside is trusted to review and to that handler's own
 * tests, the same place the portal already trusts it for the routes that carry a right
 * instead of appearing here at all.
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
 *
 * <p><b>Four drafts asked what a mapping carries by looking at where a mapping keeps
 * things, and all four shared the same blind spot: a mapping keeps things in more than
 * one place, and the list of places is not closed either.</b> The first compared the
 * TEXT of a pattern with the open list; the second built a request and asked for
 * resolution, guessing at headers a real write handler need not carry; the third walked
 * a single {@code RequestMappingHandlerMapping} and missed every route held by any other
 * kind of mapping, {@code RouterFunctionMapping} among them; the fourth walked every
 * mapping's {@code getHandlerMap()} plus a snapshot of which kinds of mapping exist, and
 * was defeated by {@code @Bean("/*")} of type {@code HttpRequestHandler} - measured
 * 18.09.2026, that bean deletes a row of {@code price_row} on {@code POST /api/pricing}
 * while the fourth draft's walk of {@code getHandlerMap()} sees nothing, because Spring
 * keeps a bean named {@code "/*"} in a different field, documented in
 * {@code AbstractUrlHandlerMapping} as checked "after all other handlers... within
 * {@code getHandlerInternal}" and never returned by {@code getHandlerMap()} at all.
 *
 * <p><b>So this fifth shape stops asking a mapping where it keeps a registration and
 * asks it what it answers, through {@link HandlerMapping#getHandler} itself - the one
 * method every mapping must answer and the one method the dispatcher actually calls,
 * regardless of which private field a registration happens to sit in.</b> The full
 * reasoning, what it catches and what it costs, is on
 * {@link #noOtherMappingAnswersBesideReading} rather than repeated here; in short, it is
 * asked only of mappings {@link #verbsMappedOnto} does not already cover - a
 * {@link RequestMappingInfoHandlerMapping} stays with that method, for the reason
 * {@link #covers} already gives - and what it accepts back is narrower than "nothing",
 * because Spring's own static file server answers {@code getHandler} for every path
 * there is, open or not, and a case demanding silence would be red today over a fault
 * that does not exist.
 *
 * <p><b>Which is also why the snapshot of mapping kinds and the snapshot of
 * URL-registered addresses are gone rather than carried forward.</b> Both used to exist
 * so that a kind of mapping, or an address registered by name, arriving tomorrow would
 * not pass unnoticed. Asking {@code getHandler} makes that unnecessary rather than
 * unsafe to remove: every object in {@code everyMapping} either is a
 * {@code RequestMappingInfoHandlerMapping}, asked by the first half above, or is not,
 * asked by the second - a split Java's own type system makes complete, with no third
 * case a tenth kind of mapping could fall into unseen. Naming the nine kinds that exist
 * today bought nothing this draft still needs, and it was blind to
 * {@code wildcardHandler} regardless of how many kinds it named; naming the two
 * addresses {@code /**} and {@code /webjars/**} bought less still, since it never asked
 * whether either one stayed a file server, only whether it kept the same name.
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
	 * maps is a subset of {@link #READING}. A third question follows for the same path,
	 * put to every mapping the first two never touch.
	 */
	@Test
	void everyOpenRouteAnswersOnlyToReading() throws Exception {
		assertThat(ApiSecurity.READ_BY_ANYBODY)
				.as("the open list is empty, so this checks nothing")
				.isNotEmpty();

		for (String open : ApiSecurity.READ_BY_ANYBODY) {
			Set<RequestMethod> mapped = verbsMappedOnto(open);

			assertThat(mapped)
					.as("%s is on the open list but no mapping puts any verb on it, so asking what"
							+ " it answers beside reading measures nothing", open)
					.isNotEmpty();

			Set<RequestMethod> beside = EnumSet.copyOf(mapped);
			beside.retainAll(BESIDE_READING);

			assertThat(beside)
					.as("%s is open to anybody to read and an annotated mapping also puts %s on"
							+ " it, so a write with a self-chosen CSRF cookie and header, no"
							+ " session at all, finishes there", open, beside)
					.isEmpty();

			noOtherMappingAnswersBesideReading(open);
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

	/**
	 * AND NOTHING OUTSIDE THE ANNOTATED MAPPINGS ANSWERS BESIDE READING EITHER, asked the
	 * way that costs nothing to keep complete: {@link HandlerMapping#getHandler}, the one
	 * method the dispatcher itself calls, on every mapping {@link #verbsMappedOnto} does
	 * not already cover.
	 *
	 * <p><b>The draft before this one asked this by walking a field instead, and a field
	 * is not where the answer always lives.</b> {@code AbstractUrlHandlerMapping.
	 * getHandlerMap()} returns exactly one of the places such a mapping keeps a
	 * registration. Spring's own comment on a second one says so in as many words - the
	 * field is called {@code wildcardHandler}, and it is documented as "Handler for
	 * \"/*\", to be checked after all other handlers... processed at our level, within
	 * {@code getHandlerInternal} where the request is available." Measured 18.09.2026:
	 * {@code @Bean("/*")} of type {@code HttpRequestHandler} answers
	 * {@code POST /api/pricing} and deletes a row of {@code price_row}, while a walk of
	 * {@code getHandlerMap()} sees nothing at all - not because it looked and found
	 * nothing, but because the registration was never in that map to begin with, by the
	 * framework's own design.
	 *
	 * <p><b>So this stops asking a mapping where it keeps a registration and asks it
	 * what it answers.</b> Inside {@code AbstractUrlHandlerMapping}, one call to
	 * {@code getHandler} already consults its pattern map, its root handler, its wildcard
	 * handler and its default handler, in that order, before saying no - all four places
	 * this draft's predecessor had to be told about individually, asked here through a
	 * method that needs none of their names. A fifth place to keep a registration, if one
	 * is ever added, is asked by this same line the day it is written.
	 *
	 * <p><b>The annotated mappings are excluded here on purpose, for the reason
	 * {@link #covers} already gives.</b> Calling {@code getHandler} on a
	 * {@code RequestMappingInfoHandlerMapping} means building a request that satisfies
	 * whatever {@code consumes}, {@code headers} or {@code params} condition it carries,
	 * which is the exact guess that killed the second draft. A mapping that is not
	 * annotated carries none of those conditions - there is nothing case-specific left to
	 * guess for it - so {@code getHandler} costs nothing here that {@link #verbsMappedOnto}
	 * did not already pay for the annotated half.
	 *
	 * <p><b>And the answer accepted here is not "nothing", because measurably something
	 * always answers, on a portal with nothing wrong with it.</b> Measured 18.09.2026:
	 * {@code getHandler} for {@code POST /api/places} against
	 * {@code SimpleUrlHandlerMapping} - the mapping Spring Boot itself registers for
	 * {@code /**}, to serve whatever sits under {@code classpath:/static/} and its
	 * neighbours - returns a handler rather than null, and it returns the same kind of
	 * answer for a path nothing maps at all. That is not a fact about
	 * {@code /api/places}; it is a fact about {@code /**}, which matches every path on
	 * every method, because {@code AbstractUrlHandlerMapping} matches a pattern against a
	 * path and never once reads {@code request.getMethod()} anywhere in its own source.
	 * Asserting plain absence here would be red today, against an address that has never
	 * served anything but a file from disk.
	 *
	 * <p><b>So what is asserted is narrower than "absent", and it has a floor "absent"
	 * does not: whatever answers is Spring's own file server and nothing else.</b>
	 * {@link ResourceHttpRequestHandler} is asked for by class, because a class is what
	 * {@code getHandler} actually hands back, and because that one class's whole
	 * contract - stated in the framework's own documentation and unchanged across its
	 * history - stops at serving bytes from a location fixed in configuration, nowhere
	 * near a row of {@code price_row} and nowhere a request body could reach even if the
	 * class wanted it to. Anything else this loop finds is, by definition, not that.
	 *
	 * <p><b>Nothing here asks in which order the mappings run.</b> Every non-annotated
	 * mapping is asked the same question regardless of what would have answered first in
	 * a real dispatch, which is stricter than the dispatcher itself needs to be: a
	 * mapping nothing can reach today because something earlier always answers first is
	 * one reordering away from being reachable tomorrow, and this does not wait for that
	 * day before it starts asking.
	 */
	private void noOtherMappingAnswersBesideReading(String path) throws Exception {
		for (RequestMethod verb : BESIDE_READING) {
			MockHttpServletRequest asking = new MockHttpServletRequest(verb.name(), path);
			ServletRequestPathUtils.parseAndCache(asking);

			for (HandlerMapping mapping : everyMapping) {
				if (mapping instanceof RequestMappingInfoHandlerMapping) {
					continue;
				}

				HandlerExecutionChain chain = mapping.getHandler(asking);

				if (chain == null) {
					continue;
				}

				assertThat(chain.getHandler())
						.as("%s %s is answered by %s through %s, which is not the portal's own"
										+ " static file server and is free to do anything at all with"
										+ " the request",
								verb, path, mapping.getClass().getSimpleName(), chain.getHandler())
						.isInstanceOf(ResourceHttpRequestHandler.class);
			}
		}
	}
}
