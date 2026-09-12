package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

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

	private int statusOf(String path) throws Exception {
		return http.perform(get(path)).andReturn().getResponse().getStatus();
	}

	/**
	 * A ROUTE NOBODY OPENED IS A ROUTE NOBODY CAN READ, even one that does not
	 * exist.
	 *
	 * <p>This is the whole of the configuration in one case, and it is written
	 * against a path that was never mapped on purpose: 401 rather than 404 is what
	 * says the rule is "shut unless opened by name". Were it the other way round,
	 * an endpoint added without a line in the configuration would be readable by
	 * anybody, and it would be found by whoever read it.
	 *
	 * <p>It is also the case that would fail first the day somebody writes
	 * {@code permitAll()} across {@code /api/**} to make a test pass.
	 */
	@Test
	void aRouteNobodyOpenedIsARouteNobodyCanRead() throws Exception {
		assertThat(statusOf("/api/competitors"))
				.as("a route with no rule of its own answered somebody who is not signed in")
				.isEqualTo(401);
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
