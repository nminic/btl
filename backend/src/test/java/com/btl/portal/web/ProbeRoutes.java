package com.btl.portal.web;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * ROUTES THAT EXIST ONLY WHILE A CASE IS ASKING, registered by whoever imports this.
 *
 * <p>The same shape {@code ApiSecurityTest} uses for its route with a variable in it, and
 * for the same reason: this increment adds no resource of the portal's own, and a layer
 * with nothing in front of it is a layer no case can measure. Being a
 * {@code @TestConfiguration} of its own, it is never component scanned - it reaches a
 * context only where it is imported by name.
 *
 * <p><b>It is a file of its own rather than a nested class because two suites need the
 * same routes.</b> {@code RightsAtTheDoorTest} asks through MockMvc, which is cheap and
 * says what the layer decides; {@code RightsOverRealHttpTest} asks over a socket, which
 * is the only place the container's ERROR dispatch runs and therefore the only place the
 * shape of a refusal can be compared with the shape of an address that is not there. Two
 * copies of these routes would be two things to keep equal.
 *
 * <p><b>THE ADDRESSES ARE THE LENGTH THEY ARE ON PURPOSE.</b> Each one has a twin that
 * maps nothing and is the same number of characters long, so that two answers can be
 * compared byte for byte: the error body carries the path that was asked for, and paths of
 * different lengths would make two answers differ by a length that says nothing about
 * whether the address exists.
 */
@TestConfiguration
class ProbeRoutes {

	/** A route that needs a right, and the address of the same length that maps nothing. */
	static final String NEEDS_A_RIGHT = "/api/one-that-needs-a-right";

	static final String NEEDS_A_RIGHT_TWIN = "/api/one-that-isnt-here-xyz";

	static final String THE_RIGHT_IT_NEEDS = "entity:members";

	/** A second one, asking for a DIFFERENT right, so that no fixed code satisfies both. */
	static final String NEEDS_ANOTHER_RIGHT = "/api/another-that-needs-another-right";

	static final String THE_OTHER_RIGHT = "queue:results";

	/**
	 * A route of the portal's own that takes only GET, with a twin of the same length.
	 *
	 * <p>Used where a case is about a method an address does not take: {@code /api/teams}
	 * is a real route, it is ten characters long, and {@code /api/nemax} maps nothing and
	 * is ten characters long.
	 */
	static final String TAKES_ONLY_GET = "/api/teams";

	static final String TAKES_ONLY_GET_TWIN = "/api/nemax";

	/**
	 * And one of the portal's own that takes only a WRITE, with its twin.
	 *
	 * <p>Signing in is the only route today mapped for {@code POST} and nothing else, which
	 * makes it the one place a plain read can be refused for the method alone - and a read
	 * never meets the CSRF filter, so it is also where a case can show that no token is
	 * needed to run the oracle. Twelve characters, and so is {@code /api/nemanem}.
	 */
	static final String TAKES_ONLY_POST = "/api/sign-in";

	static final String TAKES_ONLY_POST_TWIN = "/api/nemanem";

	@RestController
	static class Probe {

		/** Never reached by anybody who may not, so its body is one no refusal may carry. */
		@GetMapping(NEEDS_A_RIGHT)
		@RightIsNeeded(THE_RIGHT_IT_NEEDS)
		String one() {
			return "through";
		}

		@GetMapping(NEEDS_ANOTHER_RIGHT)
		@RightIsNeeded(THE_OTHER_RIGHT)
		String two() {
			return "through";
		}

	}
}

/**
 * AND ONE ROUTE OUTSIDE {@code /api}, in a configuration of its own.
 *
 * <p>It is separate on purpose. The floor that says every route either needs a right or is
 * named looks at everything the portal's controllers map, {@code /api} included and not
 * only that - which is the whole of the middling finding of 13.09.2026, because a route one
 * character outside {@code /api} had no interceptor, no chain and no floor over it. A probe
 * living outside {@code /api} would then have to be written into that snapshot beside the
 * portal's own routes, and a snapshot of decisions is the wrong place to keep a test's
 * scaffolding.
 *
 * <p>So only the suite that needs it imports it: the one that asks a real server what a
 * verb an address does not take answers with, outside {@code /api} as well as inside.
 */
@TestConfiguration
class ProbeRouteOutsideTheApi {

	static final String OUTSIDE_THE_API = "/proba-van-api-ja";

	static final String OUTSIDE_THE_API_TWIN = "/proba-van-api-xx";

	@RestController
	static class Probe {

		@GetMapping(OUTSIDE_THE_API)
		String outside() {
			return "outside";
		}
	}
}
