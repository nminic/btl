package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import org.springframework.web.util.ServletRequestPathUtils;

import java.util.EnumSet;
import java.util.Set;

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

	/**
	 * And everything that is not reading, derived rather than listed, so a method
	 * added to {@code RequestMethod} tomorrow is asked about without anybody
	 * remembering to add it here.
	 */
	private static final Set<RequestMethod> BESIDE_READING =
			EnumSet.complementOf(EnumSet.copyOf(READING));

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
	void everyOpenRouteAnswersOnlyToReading() throws Exception {
		assertThat(ApiSecurity.READ_BY_ANYBODY)
				.as("the open list is empty, so this checks nothing")
				.isNotEmpty();

		for (String open : ApiSecurity.READ_BY_ANYBODY) {
			assertThat(answeredAt(open, READING))
					.as("%s is on the open list but the dispatcher resolves nothing there, so asking"
							+ " what it answers beside reading measures nothing", open)
					.isNotEmpty();

			assertThat(answeredAt(open, BESIDE_READING))
					.as("%s is open to anybody to read and the dispatcher also finishes %s there, so"
							+ " a write with a self-chosen CSRF cookie and header, no session at"
							+ " all, finishes there", open, answeredAt(open, BESIDE_READING))
					.isEmpty();
		}
	}

	/**
	 * WHICH OF THESE METHODS ACTUALLY FINISH AT THIS ADDRESS, asked by handing the
	 * dispatcher a request and letting it RESOLVE, never by reading a pattern.
	 *
	 * <p><b>The first draft of this file compared the text of each mapping's pattern
	 * with the entry on the open list, and that was a high finding on its own
	 * review.</b> A pattern is a spelling, and one address has many: a write mapped as
	 * {@code /api/pricing/&#42;&#42;} or as {@code /api/&#123;whatever&#125;} answers
	 * {@code POST /api/pricing} just as surely as a write mapped on the literal string,
	 * and neither one equals it as text. Both were measured: a probe deleting a row of
	 * {@code price_row} answered 200 to a caller with no session, and this case stayed
	 * green. Worse, with a right declared on the probe the other two guards went green
	 * too, so nothing in the suite was holding the line.
	 *
	 * <p><b>The repository already knew how to ask.</b> {@code ApiSecurityTest.reallyMapped}
	 * builds a request, calls {@code ServletRequestPathUtils.parseAndCache} and asks
	 * {@code getHandler}. That is the half of the precedent this file had to copy; it
	 * had copied the other half. The number of ways to WRITE a mapping is not finite
	 * from a guard's point of view, and is exactly one from the dispatcher's.
	 *
	 * <p>A path that is answered but not under this method raises
	 * {@code HttpRequestMethodNotSupportedException}, and that is the answer „no",
	 * not an error: it means the address exists and the dispatcher refuses this verb
	 * before any handler is reached.
	 */
	private Set<RequestMethod> answeredAt(String path, Set<RequestMethod> asking) throws Exception {
		Set<RequestMethod> found = EnumSet.noneOf(RequestMethod.class);

		for (RequestMethod method : asking) {
			MockHttpServletRequest request = new MockHttpServletRequest(method.name(), path);
			ServletRequestPathUtils.parseAndCache(request);
			try {
				if (mappings.getHandler(request) != null) {
					found.add(method);
				}
			} catch (HttpRequestMethodNotSupportedException refusedBeforeAnyHandler) {
				// The address is answered, just not under this verb. That is the answer.
			}
		}

		return found;
	}
}
