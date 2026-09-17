package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.condition.PathPatternsRequestCondition;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.EnumSet;
import java.util.Set;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * NOTHING ON THE OPEN LIST MAY FINISH A WRITE, asked of the dispatcher and not of
 * whether a particular annotation was typed onto a method.
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

	/** The dispatcher, asked which methods it maps, rather than a pattern read off a spelling. */
	@Autowired
	@Qualifier("requestMappingHandlerMapping")
	private RequestMappingHandlerMapping mappings;

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

		for (String open : ApiSecurity.READ_BY_ANYBODY) {
			Set<RequestMethod> answered = methodsMappedTo(open);

			assertThat(answered)
					.as("%s is on the open list but the dispatcher maps nothing to it, so asking"
							+ " what it answers beside reading measures nothing", open)
					.isNotEmpty();

			Set<RequestMethod> besideReading = EnumSet.copyOf(answered);
			besideReading.removeAll(READING);

			assertThat(besideReading)
					.as("%s is open to anybody to read and the dispatcher also maps %s onto it, so a"
							+ " write with a self-chosen CSRF cookie and header, no session at all,"
							+ " finishes there", open, besideReading)
					.isEmpty();
		}
	}

	/**
	 * EVERY METHOD THE DISPATCHER MAPS TO THIS PATH, gathered across every mapping that
	 * answers to it - a second controller mapping the same address would add an entry
	 * here rather than silently winning or losing against the first.
	 *
	 * <p>A mapping that names no method at all answers every one there is, POST
	 * included, the same reading {@code ApiSecurityTest.answersAGet} gives that
	 * condition for GET.
	 */
	private Set<RequestMethod> methodsMappedTo(String path) {
		Set<RequestMethod> found = EnumSet.noneOf(RequestMethod.class);

		for (RequestMappingInfo info : mappings.getHandlerMethods().keySet()) {
			if (pathsOf(info).noneMatch(path::equals)) {
				continue;
			}

			Set<RequestMethod> declared = info.getMethodsCondition().getMethods();
			found.addAll(declared.isEmpty() ? EnumSet.allOf(RequestMethod.class) : declared);
		}

		return found;
	}

	/** Every spelling a mapping answers to, asked of the mapping itself. */
	private static Stream<String> pathsOf(RequestMappingInfo info) {
		PathPatternsRequestCondition patterns = info.getPathPatternsCondition();
		return patterns == null ? info.getDirectPaths().stream()
				: patterns.getPatternValues().stream();
	}
}
