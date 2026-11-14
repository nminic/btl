package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * THE TWO DOORS OF THE RESULTS: {@code /api/results} serves every scored run and no other, and
 * {@code /api/unscored-results} every run of an unscored race and no other, in the same shape.
 *
 * <p>PDL, 14.11.2026, the technique written beside the owner's answers about the plan (my reasoning, in PDL):
 * „`/api/results` služi samo bodovane rezultate, a nebodovani imaju svoju rutu koju čitaju samo profil i
 * „Moji rezultati”; ... rezultat nebodovane trke čuva 0 bodova i prikazuje „–”."
 *
 * <p><b>The member is the same on both doors and holds a membership of the season</b>, so the only thing
 * that tells the two runs apart is the kind of the event of their race, and {@code inItsSeason} being false
 * on the second door is the door's and not the member's.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class UnscoredResultApiTest {

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private long scored;

	private long unscored;

	@BeforeEach
	void oneMemberWithARunAtAScoredAndAtAnUnscoredRace() {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
				+ " place_id, city, country_id, first_season, referral_code, referred_by, bio, profile_hidden,"
				+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
				+ " values ('000601', 'Ana', 'Prva', 'F', date '1990-05-05', (select id from place where rank = 1),"
				+ " null, null, 2027, '0011223344000601', null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
				+ " timestamptz '2026-09-01 10:00:00+00')").update();
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
				+ " values ((select id from competitor where member_number = '000601'), 2027, 'feeExempt',"
				+ " 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')").update();

		scored = runAt("trka-2027", "race", "12.34");
		unscored = runAt("plivanje-2027", "unscored", "0.00");
	}

	@Test
	void eachDoorServesItsOwnRunsAndNoneOfTheOthers() throws Exception {
		assertThat(idsIn(answer("/api/results"))).contains(scored).doesNotContain(unscored);
		assertThat(idsIn(answer("/api/unscored-results"))).containsExactly(unscored);
	}

	@Test
	void anUnscoredRunIsServedInTheSameShapeWithNoPointsAndCountedInNoSeason() throws Exception {
		JsonNode theScored = theOne(answer("/api/results"), scored);
		JsonNode theUnscored = theOne(answer("/api/unscored-results"), unscored);

		assertThat(fieldsOf(theUnscored)).as("the two doors serve a run in different shapes")
				.isEqualTo(fieldsOf(theScored));
		assertThat(theUnscored.path("points").decimalValue()).isEqualByComparingTo("0");
		assertThat(theUnscored.path("runner").path("firstName").asString()).isEqualTo("Ana");

		/* The member holds 2027, so the scored run counts in it and the unscored one does not: the door
		   decides, not the membership. */
		assertThat(theScored.path("inItsSeason").asBoolean()).isTrue();
		assertThat(theScored.path("inItsStanding").asBoolean()).isTrue();
		assertThat(theUnscored.path("inItsSeason").asBoolean()).isFalse();
		assertThat(theUnscored.path("inItsStanding").asBoolean()).isFalse();
	}

	@Test
	void aVisitorReadsTheUnscoredRunsAsHeReadsTheScoredOnes() throws Exception {
		MockHttpServletResponse answer = http.perform(get("/api/unscored-results")).andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(200);
	}

	private long runAt(String slug, String kind, String points) {
		long event = db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured,"
						+ " description, link) values (?, ?, date '2027-05-05', (select id from place where rank = 1),"
						+ " null, null, ?, false, '', '') returning id")
				.params(slug, "Dogadjaj " + slug, kind).query(Long.class).single();
		long race = db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km,"
						+ " ascent_m, descent_m) values (?, 'Trka', false, date '2027-05-05', 'free', 0, 0, 0, 0)"
						+ " returning id")
				.param(event).query(Long.class).single();

		return db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m,"
						+ " seconds, points) values ((select id from competitor where member_number = '000601'), ?,"
						+ " date '2027-05-05', 10, 0, 0, 3000, cast(? as numeric)) returning id")
				.params(race, points).query(Long.class).single();
	}

	private JsonNode answer(String path) throws Exception {
		MockHttpServletResponse answer = http.perform(get(path)).andReturn().getResponse();

		assertThat(answer.getStatus()).isEqualTo(200);

		return new ObjectMapper().readTree(answer.getContentAsString(StandardCharsets.UTF_8));
	}

	private static List<Long> idsIn(JsonNode answer) {
		return StreamSupport.stream(answer.spliterator(), false).map(one -> one.path("id").asLong()).toList();
	}

	private static JsonNode theOne(JsonNode answer, long id) {
		return StreamSupport.stream(answer.spliterator(), false).filter(one -> one.path("id").asLong() == id)
				.findFirst().orElseThrow();
	}

	private static List<String> fieldsOf(JsonNode one) {
		List<String> names = new ArrayList<>();

		for (String name : one.propertyNames()) {
			names.add(name);
		}

		names.sort(null);

		return names;
	}
}
