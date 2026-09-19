package com.btl.portal.web;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
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
 * <p><b>There are no twin addresses written down here any more.</b> Each comparison needs
 * an address of the same length that maps nothing, and those were counted by hand until
 * 13.09.2026 - a character miscounted would have loosened a comparison without failing
 * anything. {@code RightsOverRealHttpTest.twinOf} builds one from the address itself, so
 * it is the right length by construction - and since 14.09.2026 a SIBLING of it, so it is
 * behind the same {@code SecurityFilterChain} by construction too.
 */
@TestConfiguration
class ProbeRoutes {

	/** A route that needs a right. */
	static final String NEEDS_A_RIGHT = "/api/one-that-needs-a-right";

	static final String THE_RIGHT_IT_NEEDS = "entity:members";

	/** A second one, asking for a DIFFERENT right, so that no fixed code satisfies both. */
	static final String NEEDS_ANOTHER_RIGHT = "/api/another-that-needs-another-right";

	static final String THE_OTHER_RIGHT = "queue:results";

	/*
	 * THE TWO ROUTES "THAT TAKE ONLY ONE VERB" USED TO BE WRITTEN HERE, AND SINCE
	 * 19.09.2026 THEY ARE ASKED OF THE DISPATCHER INSTEAD.
	 *
	 * They were `/api/teams` and `/api/sign-in`, two facts about the portal in a file that
	 * declares probes - and both are facts with a date on them. `/api/teams` is mapped for
	 * `GET` alone until the increment that gives teams a `POST`, and on that day the case
	 * whose whole subject is "a verb this address does not take" would have gone on
	 * passing while measuring "a media type this address does not take", with nothing to
	 * say the subject had changed underneath it.
	 *
	 * `RightsOverRealHttpTest.takesOnly` reads it off `RequestMappingHandlerMapping`, which
	 * is where the answer already is, and says so out loud when there is no such route
	 * rather than settling for whichever one is nearest.
	 */

	/**
	 * The one route of the portal guarded by the SECOND kind of guard, and no probe can
	 * stand in for it.
	 *
	 * <p>{@link OnlyTheSuperadmin} asks the MODE, which V5 lets exactly one role carry, so
	 * a probe wearing it would be shut to exactly the same people and would measure the
	 * same line. What cannot be stood in for is the address: the shape of the refusal is
	 * what the wire case is about, and the address whose existence must not leak is
	 * {@code /api/moderators} and not a probe nobody can reach from outside a test.
	 */
	static final String NO_TICK_OPENS = "/api/moderators";

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
 * AND THE ROUTES ONLY THE WIRE NEEDS, in a configuration of its own.
 *
 * <p>Separate on purpose, twice over.
 *
 * <p>First, the floor that says every route either needs a right or is named looks at
 * everything the portal's controllers map, {@code /api} and outside it both - which is the
 * middling finding of 13.09.2026, because a route one character outside {@code /api} had no
 * interceptor, no chain and no floor over it. Probes that answer without a right would then
 * have to be written into that snapshot beside the portal's own routes, and a snapshot of
 * decisions is the wrong place to keep a test's scaffolding.
 *
 * <p>Second, what is here can only be seen on a socket. Each of these routes is one of the
 * ways the dispatcher says "the path is right and something else is wrong" - a media type
 * it will not produce, one it will not consume, a parameter it insists on - and each of
 * those sentences names something that exists. The last one simply falls over, and it is
 * here so that a case can hold the line the other way: a failure must STAY a failure.
 */
@TestConfiguration
class ProbeRoutesForTheWire {

	/** One outside {@code /api} altogether, so the reach of the rule is measured. */
	static final String OUTSIDE_THE_API = "/proba-van-api-ja";

	/** A guarded route that makes a spreadsheet, which is how this first becomes live. */
	static final String MAKES_ONLY_A_CSV = "/api/probe-makes-a-csv";

	/** A guarded route that accepts only a spreadsheet. */
	static final String TAKES_ONLY_A_CSV = "/api/probe-takes-a-csv";

	/** A guarded route that insists on a parameter. */
	static final String NEEDS_A_PARAMETER = "/api/probe-needs-a-param";

	static final String THE_PARAMETER = "sezona";

	/** And one that fails while answering, which must never be mistaken for a missing one. */
	static final String FALLS_OVER = "/api/probe-falls-over";

	@RestController
	static class Probe {

		@GetMapping(value = OUTSIDE_THE_API)
		String outside() {
			return "outside";
		}

		@GetMapping(value = MAKES_ONLY_A_CSV, produces = "text/csv")
		@RightIsNeeded(ProbeRoutes.THE_RIGHT_IT_NEEDS)
		String csv() {
			return "a;b;c";
		}

		@PostMapping(value = TAKES_ONLY_A_CSV, consumes = "text/csv")
		@RightIsNeeded(ProbeRoutes.THE_RIGHT_IT_NEEDS)
		String takesCsv() {
			return "taken";
		}

		@GetMapping(value = NEEDS_A_PARAMETER, params = THE_PARAMETER)
		@RightIsNeeded(ProbeRoutes.THE_RIGHT_IT_NEEDS)
		String withParameter(@RequestParam(THE_PARAMETER) String season) {
			return season;
		}

		/**
		 * Needs no right, because it has to be REACHED in order to fall over; a refusal
		 * at the door would answer 404 and the case would pass while measuring nothing.
		 */
		@GetMapping(FALLS_OVER)
		String fallsOver() {
			throw new IllegalStateException("a probe that fails on purpose");
		}
	}
}
