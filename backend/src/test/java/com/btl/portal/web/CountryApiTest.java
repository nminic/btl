package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * THE SERVER'S ANSWER IS THE LIST THE PORTAL ALREADY CARRIES.
 *
 * <p>The portal bundles its countries rather than fetching them, so this is not a
 * resource waiting to be replaced the way `/mock` is. It is the same catalogue
 * held twice, and two copies of one list move apart. Comparing the answer to the
 * bundled file is what keeps them from doing so, and it is the day one of them
 * moves that this says which.
 *
 * <p><b>Compared as parsed JSON and not as text</b>, which is the difference from
 * the places case. That file is written on one line by a generator, so its bytes
 * are the answer's bytes; this one is written by hand and pretty printed over
 * nine hundred lines, and demanding identical whitespace would be demanding
 * something nobody decided. What is compared is the two groups, their order
 * within each, and every code and name.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class CountryApiTest {

	private static final Path CARRIED = Path.of("..", "frontend", "src", "data", "countries.json");

	@Autowired
	private MockMvc http;

	private static String flatten(JsonNode countries) {
		StringBuilder said = new StringBuilder();

		countries.propertyStream().forEach(group -> {
			said.append(group.getKey()).append(':');

			group.getValue().forEach(one ->
					said.append(one.get("code").asString()).append('=')
							.append(one.get("name").asString()).append(' '));

			said.append('\n');
		});

		return said.toString();
	}

	@Test
	void theCountriesAreTheOnesThePortalCarries() throws Exception {
		assertThat(CARRIED)
				.as("the portal's own list is not where this expects it, so nothing is being compared")
				.exists();

		ObjectMapper json = new ObjectMapper();

		String theirs = flatten(json.readTree(Files.readString(CARRIED, StandardCharsets.UTF_8)));
		String ours = flatten(json.readTree(http.perform(get("/api/countries"))
				.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8)));

		assertThat(theirs)
				.as("the portal's list is empty, so this measures nothing")
				.contains("region:")
				.hasSizeGreaterThan(1000);
		assertThat(ours)
				.as("the server's catalogue of countries is not the one the portal carries")
				.isEqualTo(theirs);
	}

	/** And it is readable without signing in, because a list of states belongs to
	 *  nobody - which is what its name was opened on. */
	@Test
	void aCatalogueIsReadableWithoutSigningIn() throws Exception {
		assertThat(http.perform(get("/api/countries")).andReturn().getResponse().getStatus())
				.isEqualTo(200);
	}
}
