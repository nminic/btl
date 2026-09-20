package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** The ducats, what each of them is earned for, and what a recognition never says. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class DucatApiTest {

	/** What the portal draws today, read off the working tree the same way
	 *  {@code CountryApiTest} and {@code DucatConstraintsTest} read theirs. */
	private static final Path DRAWN = Path.of("..", "frontend", "public", "mock", "ducats.json");

	/**
	 * Fifteen families, and sixteen fields of each: the condition, what it is worth,
	 * and the coin it is struck on.
	 *
	 * <p><b>Seven of the sixteen were named here as deliberate omissions until
	 * 20.09.2026</b>, with V15's own sentence for a reason - the mark, the artwork and
	 * the words on the two arcs „is the portal's and stays in the portal". V27
	 * overturns that sentence and the seven are columns; the omissions are gone from
	 * the call below rather than reworded, because an omission that omits nothing is
	 * the kind of stale line {@code Answers} was written to refuse.
	 */
	private static final int FAMILIES = 15;
	private static final int FIELDS_OF_A_DUCAT = 16;

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private String whole() throws Exception {
		return http.perform(get("/api/ducats")).andReturn().getResponse()
				.getContentAsString(StandardCharsets.UTF_8);
	}

	private JsonNode answer() throws Exception {
		return new ObjectMapper().readTree(whole());
	}

	private static List<String> idsOf(JsonNode records) {
		return StreamSupport.stream(records.spliterator(), false)
				.map(one -> one.path("id").asString()).toList();
	}

	/**
	 * One value as text, whatever JSON type carries it.
	 *
	 * <p>A threshold is {@code numeric(12,2)} and comes back as {@code 125.00}; the
	 * portal's own file writes {@code 125}. The two are one number and the difference
	 * is a scale nobody decided, so it is normalised away rather than demanded of
	 * either side - which is the same move {@code CountryApiTest} makes over
	 * whitespace, and for the same reason.
	 */
	private static String saidAs(JsonNode value) {
		return value.isNumber() ? value.decimalValue().stripTrailingZeros().toPlainString()
				: value.asString();
	}

	/**
	 * EVERY FIELD THE PORTAL READS IS ANSWERED, AND NOTHING IS LEFT OUT ANY MORE.
	 *
	 * <p>Nothing is named as deliberately withheld and nothing as deliberately added:
	 * the sixteen the portal serves are the sixteen this answers with, exactly. Who
	 * holds which ducat has a table in V15 and no screen that reads it, so it does not
	 * leave through this route at all - which is the case at the bottom of this file
	 * rather than a name on this line.
	 */
	@Test
	void everyFieldThePortalReadsIsOneTheServerAnswersWith() throws Exception {
		Answers.everyFieldThePortalReadsIsAnswered("/api/ducats", answer(), "ducats.json");
	}

	@Test
	void noFieldOfTheAnswerIsTheSameInEveryRecord() throws Exception {
		Answers.noFieldIsTheSameInEveryRecord("/api/ducats", answer());
	}

	/**
	 * THE ANSWER IS THE CATALOGUE THE PORTAL ALREADY CARRIES, value by value and in
	 * order.
	 *
	 * <p>The fifteen are a codebook written by hand in both places - V15 says so
	 * itself, „fifteen rows fit on a screen and a reader can check them against what he
	 * sees on the portal" - and two copies of one list move apart. {@code CountryApiTest}
	 * is the precedent and this is the same move: compared as parsed JSON rather than
	 * as text, because the served file is pretty printed and identical whitespace is
	 * something nobody decided.
	 *
	 * <p><b>What this measures that the schema's own case does not.</b>
	 * {@code DucatConstraintsTest} ties the ROWS to the file. This ties the ANSWER to
	 * it: a SELECT that reads one column for another, or drops a record, or sorts by
	 * something else, leaves the rows untouched and would walk straight past that case.
	 * The two are not one case with two homes - sixteen columns and sixteen components
	 * of a record are sixteen chances to line them up wrongly, and only one of the two
	 * cases is looking at that.
	 *
	 * <p><b>Which column swaps it can see is not assumed</b>, it is the case below:
	 * no two fields of this answer carry the same value in all fifteen records, so
	 * every pair of them is told apart by at least one record here.
	 *
	 * <p><b>And that the answer comes from the database rather than from this very
	 * file</b> is the case after that, which puts a sixteenth ducat in the schema and
	 * finds it in the answer.
	 */
	@Test
	void theAnswerIsTheFifteenThePortalDraws() throws Exception {
		assertThat(DRAWN)
				.as("the portal's own copy is not where this expects it, so the two are no longer tied")
				.exists();

		JsonNode ours = answer();
		JsonNode theirs = new ObjectMapper()
				.readTree(Files.readString(DRAWN, StandardCharsets.UTF_8));

		assertThat(theirs.size()).as("the portal serves no ducats at all, so this compares nothing")
				.isEqualTo(FAMILIES);
		assertThat(idsOf(ours))
				.as("the answer is not the ducats the portal draws, or is not in the order it draws"
						+ " them in: from bronze to gold, and within one metal as the catalogue was"
						+ " written")
				.isEqualTo(idsOf(theirs));

		int compared = 0;

		for (int at = 0; at < ours.size(); at++) {
			JsonNode one = ours.get(at);
			JsonNode drawn = theirs.get(at);

			for (String field : Answers.fieldsOf(one)) {
				assertThat(drawn.has(field))
						.as("%s answers with %s, which the portal does not serve at all", "/api/ducats",
								field)
						.isTrue();
				assertThat(saidAs(one.get(field)))
						.as("the %s of %s is not what the portal draws", field, one.path("id").asString())
						.isEqualTo(saidAs(drawn.get(field)));
				compared++;
			}
		}

		assertThat(compared)
				.as("fifteen ducats times the sixteen fields of one were not compared, so this case is"
						+ " measuring less than it says")
				.isEqualTo(FAMILIES * FIELDS_OF_A_DUCAT);
	}

	/**
	 * AND NO TWO FIELDS OF THE ANSWER CARRY THE SAME VALUE IN EVERY RECORD, which is
	 * what makes the comparison above able to see a column read for another one.
	 *
	 * <p>The floor under a golden comparison is not that it compares everything - it is
	 * that the two sides can disagree. Sixteen fields is a hundred and twenty pairs, and
	 * a pair that said the same thing in all fifteen records would be a pair the
	 * catalogue cannot tell apart: a query answering {@code last} out of
	 * {@code tierUpFrom} would then produce this very list and nothing would be red.
	 *
	 * <p>It is worth its own case rather than a sentence in a comment because the
	 * fifteen are real data and the pairs are nearly alike: thirteen of them carry
	 * nought in all three fields of a run, and both of the two that carry a run have a
	 * step exactly equal to their first threshold. Seven of the sixteen columns V27
	 * added are empty on the same row more often than not - {@code topFemale} on seven
	 * ducats, {@code counted} on thirteen, one of the two arcs on six - so the pairs
	 * among THEM are the tightest in the answer. Measured on 20.09.2026 over the file
	 * itself: not one of the hundred and twenty agrees in all fifteen records.
	 *
	 * <p>Read off the answer's own fields rather than from a list written here, so a
	 * field answered tomorrow is either told apart from the fifteen beside it or it is
	 * measured by nothing and says so.
	 */
	@Test
	void noTwoFieldsOfTheAnswerCarryTheSameValueInEveryRecord() throws Exception {
		JsonNode ours = answer();
		List<String> fields = List.copyOf(Answers.fieldsOf(ours.get(0)));

		assertThat(ours.size()).as("one record cannot tell two fields apart, so this compares nothing")
				.isGreaterThan(1);
		assertThat(fields).as("the answer carries fewer fields than a ducat has, so some pair below"
				+ " was never formed").hasSize(FIELDS_OF_A_DUCAT);

		for (int a = 0; a < fields.size(); a++) {
			for (int b = a + 1; b < fields.size(); b++) {
				String left = fields.get(a);
				String right = fields.get(b);

				assertThat(StreamSupport.stream(ours.spliterator(), false)
						.allMatch(one -> saidAs(one.get(left)).equals(saidAs(one.get(right)))))
						.as("every ducat answers %s and %s with the same value, so a query reading one"
								+ " of those columns for the other would answer exactly this list",
								left, right)
						.isFalse();
			}
		}
	}

	/**
	 * A DUCAT THE SCHEMA HOLDS COMES BACK, WHATEVER THE PORTAL'S FILE SAYS, AND IT
	 * COMES BACK IN ITS METAL'S PLACE.
	 *
	 * <p>Two things at once, and both are about where the answer comes from:
	 *
	 * <ul>
	 * <li><b>From the database, not from the file it is compared against.</b> Without
	 * this, a resource that read {@code ducats.json} and echoed it would pass the
	 * golden comparison above with nothing behind it. The sixteenth ducat is in the
	 * schema and in no file.</li>
	 * <li><b>From bronze to gold, and not simply in the order the rows were
	 * written.</b> The catalogue was written in tier order, so the fifteen alone cannot
	 * tell {@code order by tier, id} from {@code order by id} - the two answer the same
	 * list. This one is of the LOWEST tier and has the HIGHEST key, so the two orders
	 * put it in opposite ends: third, or last.</li>
	 * </ul>
	 *
	 * <p>Its every value is unlike anything in the catalogue - a run of three from
	 * seven to twenty-two rising at thirteen, and legends nobody has struck on a coin -
	 * and no two of its sixteen values are alike either, so each field is told apart
	 * from the other fifteen on this row alone and the whole record is compared rather
	 * than the field this case is named for.
	 *
	 * <p><b>AND THE SIXTEEN EXPECTED VALUES BELOW COME FROM THE INSERT ABOVE THEM,
	 * NEVER FROM {@code ducats.json}</b>, which is the one thing that makes this case
	 * about the database at all. The seven legends V27 added are the easy place to lose
	 * that: {@code duk-probni} says „PROBAO" where every ducat in the file says
	 * something else, so an expectation quietly taken off the file instead - „ISTRČANIH"
	 * on the first row of it - would be an assertion about the portal's own copy
	 * dressed as one about the schema. Swapping any of the sixteen for the matching
	 * value of the file is a red case, and was measured to be one.
	 *
	 * <p>What it cannot separate is {@code order by tier, id} from {@code order by
	 * tier, code}, because {@code duk-probni} sorts after the two ducats of the first
	 * tier either way. The case above does that: within the third tier the catalogue is
	 * written {@code duk-drzave, duk-sve-trke, duk-krace-trke, duk-polumaratoni}, which
	 * is neither the alphabet of the codes nor of the names.
	 */
	@Test
	void aDucatTheSchemaHoldsComesBackInItsMetalsPlace() throws Exception {
		assertThat(db.sql("insert into ducat (code, name, kind, threshold, period, tier, step, last,"
						+ " tier_up_from, top, top_female, bottom, period_at, mark, art, counted)"
						+ " values ('duk-probni', 'Probni dukat', 'points', 7, 'season', 1, 3, 22, 13,"
						+ " 'PROBAO', 'PROBALA', 'PROBNIH POENA', 'none', 'races', 'globe', 'poena')")
						.update())
				.as("the sixteenth ducat was not written, so this case measures the fifteen again")
				.isOne();

		JsonNode ours = answer();

		assertThat(idsOf(ours))
				.as("a ducat the schema holds and the portal's file does not is not in the answer, or"
						+ " the answer is ordered by the key rather than from bronze to gold: the"
						+ " sixteenth is of the first tier and was written last")
				.hasSize(FAMILIES + 1)
				.startsWith("duk-mesecni-km", "duk-mesecni-sati", "duk-probni");

		Map<String, String> said = new LinkedHashMap<>();
		StreamSupport.stream(ours.spliterator(), false)
				.filter(one -> one.path("id").asString().equals("duk-probni"))
				.forEach(one -> one.properties()
						.forEach(field -> said.put(field.getKey(), saidAs(field.getValue()))));

		assertThat(said)
				.as("a column of the sixteenth ducat did not land in the field that names it")
				.isEqualTo(Map.ofEntries(Map.entry("id", "duk-probni"),
						Map.entry("name", "Probni dukat"), Map.entry("kind", "points"),
						Map.entry("value", "7"), Map.entry("period", "season"),
						Map.entry("top", "PROBAO"), Map.entry("topFemale", "PROBALA"),
						Map.entry("bottom", "PROBNIH POENA"), Map.entry("periodAt", "none"),
						Map.entry("mark", "races"), Map.entry("art", "globe"),
						Map.entry("tier", "1"), Map.entry("step", "3"), Map.entry("last", "22"),
						Map.entry("tierUpFrom", "13"), Map.entry("counted", "poena")));
	}

	/**
	 * AND NOTHING ABOUT WHO HOLDS A DUCAT LEAVES THROUGH THIS ROUTE.
	 *
	 * <p>V15 has the recognitions - {@code ducat_award}, with the snapshot of what the
	 * member had when he won it - and Article 73 does make „dukati i priznanja" public.
	 * They are left out because no screen reads them, and „on the chance it will be
	 * wanted" is the one reason that is never enough.
	 *
	 * <p><b>Asked of the whole answer as text rather than of a field name</b>, because a
	 * member could arrive under any name at all: a count of holders, a list of numbers, a
	 * first holder's name folded into a legend. Everything about the holder here is unlike
	 * anything the catalogue carries - the number, both his names, and the figure he
	 * reached - so finding one is finding him and not something else.
	 *
	 * <p>The day a screen reads recognitions this case is what has to be decided against
	 * rather than deleted: the holder is named by his MEMBER NUMBER, which is what
	 * Article 73 publishes, and never by a name beside anything else off his row.
	 */
	@Test
	void nothingAboutWhoHoldsADucatLeavesTheServer() throws Exception {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
				+ " place_id, city, country_id, first_season, first_season_2027, active,"
				+ " membership_basis, referral_code, referred_by, bio, profile_hidden, birthday_shown,"
				+ " father_name, address, shirt_size, health_statement_at) values ('000777', 'Zlatibor',"
				+ " 'Dukatovic', 'M', date '1988-04-19', (select id from place where rank = 1), null,"
				+ " null, 2027, false, true, 'payment', 'aa11bb22cc33dd44', null, '', false, 'none',"
				+ " 'Otac', 'Ulica 1', 'M', timestamptz '2026-09-01 10:00:00+00')").update();

		assertThat(db.sql("insert into ducat_award (competitor_id, ducat_id, kind, threshold, reached,"
						+ " period, season, month) values"
						+ " ((select id from competitor where member_number = '000777'),"
						+ " (select id from ducat where code = 'duk-sezonski-km'), 'totalKm', 1000,"
						+ " 1777.77, 'season', 2027, null)").update())
				.as("nobody holds a ducat in this fixture, so the answer below could not name anybody")
				.isOne();

		String whole = whole();

		assertThat(whole).as("the answer carries nothing at all, so it says nothing about what it"
				+ " leaves out").contains("duk-sezonski-km", "duk-obim-planete");

		assertThat(whole).as("the member number of somebody who holds a ducat left the server")
				.doesNotContain("000777");
		assertThat(whole).as("the name of somebody who holds a ducat left the server")
				.doesNotContain("Zlatibor").doesNotContain("Dukatovic");
		assertThat(whole).as("what a holder had reached when he won his ducat left the server")
				.doesNotContain("1777.77");
	}

	/**
	 * And a visitor who is not signed in may read it, which is the whole reason it was
	 * opened: a threshold nobody can read is a rule nobody can meet.
	 */
	@Test
	void nobodyHasToSignInToSeeWhatADucatIsEarnedFor() throws Exception {
		assertThat(http.perform(get("/api/ducats")).andReturn().getResponse().getStatus())
				.as("/api/ducats asked a visitor to sign in")
				.isEqualTo(200);
	}
}
