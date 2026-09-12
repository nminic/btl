package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * THE SERVER'S ANSWER IS THE FILE THE PORTAL SERVES TODAY.
 *
 * <p>The portal fetches fifteen resources out of {@code /mock} and one constant
 * decides where from; the whole of replacing them is that constant becoming
 * {@code /api} and nothing else in the application changing. That promise is
 * only worth as much as the answers being the same, and this is the one kind of
 * case that can say so: not "the shape looks right", but the bytes, all
 * forty-seven thousand rows of them, in the same order.
 *
 * <p>It also measures more than it looks like it does. The order is the answer
 * for this resource, the compact array shape is a decision about its size, and
 * the country belongs to the place through a join - a row out of order, an
 * object instead of an array, or a country read off the wrong row all fail here
 * without a separate case for any of them.
 *
 * <p><b>The boundary, written down rather than left to be found.</b> The portal's
 * copy is read off the working tree, the same move {@code DucatConstraintsTest}
 * already makes, because it belongs to the other half of the repository. The day
 * the portal stops serving its own copy this case has nothing to compare against
 * and must be replaced by a snapshot - which is the day it has done its job.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class PlaceApiTest {

	private static final Path SERVED_TODAY = Path.of("..", "frontend", "public", "mock", "places.json");

	@Autowired
	private MockMvc http;

	@Test
	void theCatalogueOfTownsIsWhatThePortalAlreadyServes() throws Exception {
		assertThat(SERVED_TODAY)
				.as("the portal's own copy is not where this expects it, so nothing is being compared")
				.exists();

		String theirs = Files.readString(SERVED_TODAY, StandardCharsets.UTF_8).trim();
		String ours = http.perform(get("/api/places"))
				.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);

		assertThat(theirs).as("the portal's copy is empty, so this measures nothing").hasSizeGreaterThan(1000);
		assertThat(ours)
				.as("the server's answer is not the file the portal serves, so /mock cannot be replaced by /api")
				.isEqualTo(theirs);
	}

	/** And it is readable without signing in, because a list of towns belongs to
	 *  nobody. */
	@Test
	void aCatalogueIsReadableWithoutSigningIn() throws Exception {
		assertThat(http.perform(get("/api/places")).andReturn().getResponse().getStatus()).isEqualTo(200);
	}
}
