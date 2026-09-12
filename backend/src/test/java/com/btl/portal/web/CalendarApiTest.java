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

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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

	/** Every literal in a rule, which is what an enumerated rule is made of. */
	private static final Pattern SPELLED_OUT = Pattern.compile("'([^']*)'");

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
	 *
	 * <p><b>And no two of them are of the same kind.</b> A calendar serving only
	 * races has silently dropped every training and every gathering, and one added
	 * word in the query is all that takes. The kinds are not typed out here: they
	 * come off the rule that decides them, so a fourth kind is either served or
	 * {@link #everyKindTheSchemaAllowsReachesTheCalendar} fails and somebody says
	 * what the calendar should do with it.
	 */
	@BeforeEach
	void aCalendarOutOfOrder() {
		List<String> kinds = kindsAllowedBy("btl_event_kind_known");

		event("drugi", "2027-06-02", "(select id from place where rank = 1)", "null", "null",
				true, kinds.get(0));
		event("treci", "2027-09-03", "null", "'Kruševac'",
				"(select id from country where code = 'RS')", false, kinds.get(1 % kinds.size()));
		event("prvi", "2027-03-01", "(select id from place where rank = 2)", "null", "null",
				false, kinds.get(2 % kinds.size()));

		race("drugi", "2027-06-02", 21.10, "half");
		race("prvi", "2027-03-01", 42.20, "marathon");

		for (String kind : kindsAllowedBy("race_kind_known")) {
			raceOfKind("drugi", "2027-06-02", kind);
		}

		/* And one of them is a copy of another, because that is how a calendar is
		   built: the year before it is copied and the link back says which. Set after
		   the three are in, since the one it points at is written last on purpose. */
		db.sql("update btl_event set copied_from = (select id from btl_event where slug = 'prvi')"
				+ " where slug = 'treci'").update();

		/* And one event carries words and an address, and one race a climb and a
		   fall, which the rest leave empty. Without that they would be the same in
		   every record, and a server answering such a field with a constant would
		   read here exactly like one reading the column: the floor under all of this
		   is noFieldOfTheAnswerIsTheSameInEveryRecord. */
		db.sql("update btl_event set description = 'Kroz grad i nazad',"
				+ " link = 'https://btl.rs/prvi' where slug = 'prvi'").update();
		db.sql("update race set ascent_m = 350, descent_m = 410 where distance_km = 42.20").update();
	}

	private void event(String slug, String day, String place, String city, String country,
			boolean featured, String kind) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, ?, date '" + day + "', " + place + ", " + city + ", " + country
						+ ", ?, ?, '', '')")
				.params(slug, "Trka " + slug, kind, featured).update();
	}

	private void race(String eventSlug, String day, double km, String expected) {
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values ((select id from btl_event where slug = ?), ?, false,"
						+ " date '" + day + "', 'length', 0, ?, 0, 0)")
				.params(eventSlug, "Trka na " + expected, km).update();
	}

	/**
	 * One race of a given kind, carrying the numbers the schema ties to that kind.
	 *
	 * <p>Only a timed race has a limit and only a race over a length fixes a
	 * distance (V7, {@code race_only_a_timed_race_has_a_limit} and
	 * {@code race_only_a_length_race_fixes_a_distance}). Which number belongs with
	 * which kind is written as SQL rather than worked out here, so the pairing is
	 * one PostgreSQL judges: paired wrongly, the insert is refused.
	 */
	private void raceOfKind(String eventSlug, String day, String kind) {
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values ((select id from btl_event where slug = ?), ?, true,"
						+ " date '" + day + "', ?, case when ?::text = 'time' then 3600 else 0 end,"
						+ " case when ?::text = 'length' then 10.00 else 0 end, 0, 0)")
				.params(eventSlug, "Trka vrste " + kind, kind, kind, kind).update();
	}

	/**
	 * The kinds a named rule of the schema allows, in the schema's own words.
	 *
	 * <p>Written out here the list would be a second copy of something the schema
	 * already says, and the copy is the one that goes stale: a kind added to the
	 * rule would reach the calendar with nothing measuring that it does. This is the
	 * shape {@code PaymentStatesMatchTheSchemaTest} uses and A45's reason for it,
	 * that a floor asks the tool instead of keeping a record of its own.
	 */
	private List<String> kindsAllowedBy(String constraint) {
		String rule = db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema() and con.conname = ?")
				.param(constraint).query(String.class).single();

		List<String> allowed = new ArrayList<>();
		Matcher spelled = SPELLED_OUT.matcher(rule);

		while (spelled.find()) {
			allowed.add(spelled.group(1));
		}

		assertThat(allowed)
				.as("%s no longer spells out what it allows (%s), so nothing here is swept",
						constraint, rule)
				.hasSizeGreaterThan(1);
		return allowed;
	}

	private JsonNode answer(String path) throws Exception {
		return new ObjectMapper().readTree(
				http.perform(get(path)).andReturn().getResponse().getContentAsString());
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
		Answers.everyFieldThePortalReadsIsAnswered(path, answer(path), file);
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

	/**
	 * AND EVERY KIND THE SCHEMA ALLOWS REACHES THE CALENDAR.
	 *
	 * <p>A training and a gathering are on it beside a race, and a race may be over
	 * a length, against the clock, or neither. One word added to either query
	 * ({@code where e.kind = 'race'}) empties the public calendar of everything
	 * that is not a race, and until this case there was nothing in the repository
	 * that answered differently for it.
	 *
	 * <p>Neither side of this is typed out: the kinds come off the rule in the
	 * schema and the answer comes off the server, so it holds for a kind nobody has
	 * thought of yet.
	 */
	@ParameterizedTest
	@CsvSource({"/api/events, btl_event_kind_known", "/api/races, race_kind_known"})
	void everyKindTheSchemaAllowsReachesTheCalendar(String path, String rule) throws Exception {
		assertThat(StreamSupport.stream(answer(path).spliterator(), false)
				.map(one -> one.path("kind").asString()).collect(Collectors.toSet()))
				.as("%s answered with fewer kinds than %s allows", path, rule)
				.containsExactlyInAnyOrderElementsOf(new LinkedHashSet<>(kindsAllowedBy(rule)));
	}

	/**
	 * AND NOTHING THE ANSWER CARRIES IS THE SAME IN EVERY RECORD.
	 *
	 * <p>This is the floor under every case above rather than one more case. A
	 * field this fixture never varies is a field the server could answer with a
	 * constant, and the two would read alike here: that is how a calendar of one
	 * kind of event went unmeasured. It names no field, it reads them off the
	 * answer, so a field added tomorrow is either varied here or this fails.
	 */
	@ParameterizedTest
	@CsvSource({"/api/events", "/api/races"})
	void noFieldOfTheAnswerIsTheSameInEveryRecord(String path) throws Exception {
		Answers.noFieldIsTheSameInEveryRecord(path, answer(path));
	}

}
