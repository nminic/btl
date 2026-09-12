package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** The calendar, against a real database and against the file the portal serves. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class CalendarApiTest {

	private static final Path MOCK = Path.of("..", "frontend", "public", "mock");

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	/**
	 * Three events over three days, and deliberately not in date order.
	 *
	 * <p>Written in the order middle, last, first, so that "whatever order the rows
	 * came out in" cannot pass for "in date order". One takes its town from the
	 * codebook and one has it typed, which are the two shapes V7 allows and the
	 * only two the answer has to be right about.
	 */
	@BeforeEach
	void aCalendarOutOfOrder() {
		event("drugi", "2027-06-02", "(select id from place where rank = 1)", "null", "null", true);
		event("treci", "2027-09-03", "null", "'Kruševac'",
				"(select id from country where code = 'RS')", false);
		event("prvi", "2027-03-01", "(select id from place where rank = 2)", "null", "null", false);

		race("drugi", "2027-06-02", 21.10, "half");
		race("prvi", "2027-03-01", 42.20, "marathon");

		/* And one of them is a copy of another, because that is how a calendar is
		   built: the year before it is copied and the link back says which. Set after
		   the three are in, since the one it points at is written last on purpose. */
		db.sql("update btl_event set copied_from = (select id from btl_event where slug = 'prvi')"
				+ " where slug = 'treci'").update();
	}

	private void event(String slug, String day, String place, String city, String country, boolean featured) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, ?, date '" + day + "', " + place + ", " + city + ", " + country
						+ ", 'race', ?, '', '')")
				.params(slug, "Trka " + slug, featured).update();
	}

	private void race(String eventSlug, String day, double km, String expected) {
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values ((select id from btl_event where slug = ?), ?, false,"
						+ " date '" + day + "', 'length', 0, ?, 0, 0)")
				.params(eventSlug, "Trka na " + expected, km).update();
	}

	private JsonNode answer(String path) throws Exception {
		return new ObjectMapper().readTree(
				http.perform(get(path)).andReturn().getResponse().getContentAsString());
	}

	/** The names in one record of what the portal serves today. */
	private static Set<String> servedFields(String file) {
		try {
			JsonNode all = new ObjectMapper()
					.readTree(Files.readString(MOCK.resolve(file), StandardCharsets.UTF_8));

			assertThat(all.isArray() && !all.isEmpty())
					.as("%s is not a list of records, so there is nothing to compare", file)
					.isTrue();

			return all.get(0).properties().stream()
					.map(Map.Entry::getKey).collect(Collectors.toSet());
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	/**
	 * THE FIELDS ARE THE ONES THE PORTAL READS, and that is the floor for this
	 * resource rather than the whole answer.
	 *
	 * <p>A46 says an endpoint is measured by comparing its whole answer with the
	 * file the portal serves, and for the two codebooks it is: a migration fills
	 * them from the source the file came from. This is not one of those. The served
	 * calendar carries text identifiers and the strings "no" and "yes", both
	 * artefacts of one import, and the schema says bigserial and boolean; the
	 * server answers with what the schema says (12.09.2026).
	 *
	 * <p>What must not move is the NAMES, because that is what every screen reads
	 * by. Neither side is typed out here: one comes off the record, the other off
	 * the file.
	 */
	@ParameterizedTest
	@CsvSource({"/api/events, events.json", "/api/races, races.json"})
	void everyFieldThePortalReadsIsOneTheServerAnswersWith(String path, String file) throws Exception {
		JsonNode answered = answer(path);

		assertThat(answered.isArray() && !answered.isEmpty())
				.as("%s answered with nothing, so there are no fields to compare", path)
				.isTrue();

		assertThat(answered.get(0).properties().stream()
				.map(Map.Entry::getKey).collect(Collectors.toSet()))
				.as("%s and %s no longer name the same fields", path, file)
				.isEqualTo(servedFields(file));
	}

	/**
	 * AND THE CALENDAR COMES BACK IN DATE ORDER.
	 *
	 * <p>The rows were written middle, last, first, so an answer in the order they
	 * were inserted is a different list from an answer in date order, and only one
	 * of the two passes.
	 */
	@Test
	void theCalendarIsInDateOrder() throws Exception {
		assertThat(StreamSupport.stream(answer("/api/events").spliterator(), false)
				.map(one -> one.path("slug").asString()).toList())
				.as("the calendar came back in the order the rows were written")
				.containsExactly("prvi", "drugi", "treci");
	}

	/**
	 * A TOWN FROM THE CODEBOOK AND A TOWN TYPED BY HAND BOTH COME BACK AS A TOWN.
	 *
	 * <p>The two are different columns and the answer must not be able to tell
	 * anybody which. The typed one is the case that catches a query reading only
	 * the codebook, and the codebook one catches the reverse; either alone would
	 * leave half the calendar with an empty town.
	 */
	@Test
	void bothWaysOfNamingATownAnswerWithOne() throws Exception {
		for (JsonNode event : answer("/api/events")) {
			assertThat(event.path("city").asString(""))
					.as("the event %s came back without a town", event.path("slug").asString())
					.isNotBlank();
			assertThat(event.path("country").asString(""))
					.as("the event %s came back without a country", event.path("slug").asString())
					.isNotBlank();
		}

		assertThat(StreamSupport.stream(answer("/api/events").spliterator(), false)
				.map(one -> one.path("city").asString()).toList())
				.as("a town typed by hand did not reach the answer")
				.contains("Kruševac");
	}

	/**
	 * AN EVENT COPIED FROM ANOTHER SAYS SO, AND ONE THAT WAS NOT SAYS NOTHING.
	 *
	 * <p>A calendar is built by copying the year before it, and the link back is
	 * what lets the portal say where a date came from. Both halves are here: the
	 * copy carries the key of what it was copied from, and the two that were not
	 * copied carry nothing rather than a key pointing at themselves or at nought.
	 */
	@Test
	void anEventCopiedFromAnotherCarriesTheOneItCameFrom() throws Exception {
		java.util.Map<String, JsonNode> bySlug = new java.util.HashMap<>();

		answer("/api/events").forEach(one -> bySlug.put(one.path("slug").asString(), one));

		assertThat(bySlug.get("treci").path("copiedFrom").asLong(0))
				.as("the copy lost the event it was copied from")
				.isEqualTo(bySlug.get("prvi").path("id").asLong());
		assertThat(bySlug.get("prvi").path("copiedFrom").isNull())
				.as("an event nobody copied came back pointing at something")
				.isTrue();
		assertThat(bySlug.get("drugi").path("copiedFrom").isNull()).isTrue();
	}

	/**
	 * AND A RACE CARRIES THE CATEGORY THE DATABASE WORKED OUT, not one the server
	 * invented.
	 *
	 * <p>The column is generated, so the only way this can be wrong is by not
	 * reading it. Two distances that fall either side of a boundary, so a constant
	 * would answer one of them wrongly.
	 */
	@ParameterizedTest
	@CsvSource({"42.20, marathon", "21.10, half"})
	void aRaceCarriesTheCategoryTheDatabaseWorkedOut(String km, String expected) throws Exception {
		assertThat(StreamSupport.stream(answer("/api/races").spliterator(), false)
				.filter(one -> one.path("distanceKm").asString().startsWith(km.substring(0, 4)))
				.map(one -> one.path("category").asString())
				.toList())
				.as("a race of %s km did not come back as %s", km, expected)
				.containsExactly(expected);
	}

	/**
	 * AND A VISITOR SEES IT, because the calendar is what he came for.
	 *
	 * <p>Both routes, and both without a cookie of any kind.
	 */
	@ParameterizedTest
	@CsvSource({"/api/events", "/api/races"})
	void nobodyHasToSignInToSeeTheCalendar(String path) throws Exception {
		assertThat(http.perform(get(path)).andReturn().getResponse().getStatus())
				.as("%s asked a visitor to sign in", path)
				.isEqualTo(200);
	}

}
