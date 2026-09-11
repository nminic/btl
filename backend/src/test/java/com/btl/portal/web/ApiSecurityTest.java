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
