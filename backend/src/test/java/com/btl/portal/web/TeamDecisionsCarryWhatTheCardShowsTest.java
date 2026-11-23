package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * WHAT THE QUEUE OF TEAMS DECIDES SINCE 23.11.2026: A CHANGE TO A TEAM, AND A TEAM AS THE
 * MODERATOR CORRECTED IT, AND THE CARD THAT SHOWS BOTH.
 *
 * <p>Its own class rather than more cases in {@code VerificationWriteApiTest}, which another branch
 * is changing at the same time; the fixture here is the least either question needs.
 *
 * <ul>
 * <li>PDL P13 (04.09.2026), owner: „Izmeni tim ulazi u podatke tima koji se menjaju i ponovo
 * prolaze verifikaciju, dok na strani timova ostaju postojeći podaci dok se novi ne verifikuju".
 * An approved change writes into the team it names and makes no other.
 * <li>PDL P13 (03.08.2026 and 11.08.2026): the moderator „sme da ispravi podatke", „odobriti,
 * editovati i odobriti ili odbiti". What he corrected is what the team carries.
 * <li>PDL P13, „[ODLUKE 23.11.2026 ...]": the card shows the description and the link.
 * </ul>
 *
 * <p><b>Two sources of one value are kept apart on purpose</b>: the team being changed is neither
 * the first nor the last team, the member's proposal and the moderator's correction differ in every
 * field, and the member who asked a change and the one who proposed a team are two people.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class TeamDecisionsCarryWhatTheCardShowsTest {

	private static final Instant INSIDE_THE_WINDOW = Instant.parse("2027-11-30T10:00:00Z");

	private static final String THE_MODERATOR = "red-timova@primer.rs";

	private static final String THE_LEADER = "000210";

	private static final String THE_FOUNDER = "000220";

	private static final String THE_TEAM = "dunavski-trkaci";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	private SecretToken session;

	private int issued;

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockTheseCasesUse {

		@Bean
		@Primary
		Clock aFixedClock() {
			return Clock.fixed(INSIDE_THE_WINDOW, ZoneOffset.UTC);
		}
	}

	@BeforeEach
	void threeTeamsALeaderAndAFounder() {
		team("prvi-tim", "Prvi tim");
		team(THE_TEAM, "Dunavski trkači");
		team("savski-trkaci", "Savski trkači");

		competitor(THE_LEADER);
		competitor(THE_FOUNDER);

		db.sql("insert into team_membership (competitor_id, team_id, season_from)"
						+ " values (?, (select id from team where slug = ?), 2027)")
				.params(id(THE_LEADER), THE_TEAM).update();
		db.sql("update team set admin_id = ? where slug = ?").params(id(THE_LEADER), THE_TEAM)
				.update();

		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Moderator', 'Bezimeni', ?, (select id from role where code = 'moderator'))")
				.param(THE_MODERATOR).update();
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'queue:teams')")
				.param(THE_MODERATOR).update();

		session = SecretToken.fresh();
		Instant now = Instant.now();
		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(THE_MODERATOR, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();
	}

	@Test
	void theFixtureSeparatesWhatItSaysItSeparates() {
		long theTeam = teamKey(THE_TEAM);

		assertThat(theTeam)
				.as("the team a change is about is the first or the last, so a statement that wrote"
						+ " into either would write into the right one")
				.isNotEqualTo(db.sql("select min(id) from team").query(Long.class).single())
				.isNotEqualTo(db.sql("select max(id) from team").query(Long.class).single());
		assertThat(SeasonClock.transferWindowOpen(INSIDE_THE_WINDOW.atZone(SeasonClock.ZONE))).isTrue();
	}

	@Test
	void anApprovedChangeWritesIntoTheTeamItNamesAndMakesNoOther() throws Exception {
		long item = aChangeWaiting("Dunavski trkači Zemun", "Novi opis", "https://novi.example");
		long teams = count("team");
		long memberships = count("team_membership");

		assertThat(decide(item, "{\"approved\":true}").getStatus()).isEqualTo(200);

		assertThat(theTeam())
				.as("the change did not write into the team it names, address included")
				.containsExactly("dunavski-trkaci-zemun", "Dunavski trkači Zemun", "Novi opis",
						"https://novi.example", "Zemun", String.valueOf(id(THE_LEADER)));
		assertThat(count("team")).as("an approved change made a team").isEqualTo(teams);
		assertThat(count("team_membership")).as("an approved change moved somebody").isEqualTo(memberships);
		assertThat(db.sql("select subject from message where to_id = ?").param(id(THE_LEADER))
				.query(String.class).list())
				.containsExactly("Izmena tima \"Dunavski trkači Zemun\" je prihvaćena");
		assertThat(db.sql("select slug from team where id <> ? order by id").param(teamKey("dunavski-trkaci-zemun"))
				.query(String.class).list())
				.as("a team the change did not name was written into")
				.containsExactly("prvi-tim", "savski-trkaci");
	}

	@Test
	void aChangeOntoTheAddressOfAnotherTeamWaitsAndTheTeamStays() throws Exception {
		long item = aChangeWaiting("  SAVSKI TRKAČI  ", "Novi opis", "");
		List<String> before = theTeam();

		assertThat(decide(item, "{\"approved\":true}").getStatus()).isEqualTo(409);
		assertThat(theTeam()).isEqualTo(before);
		assertThat(stateOf(item)).isEqualTo("waiting");
	}

	@Test
	void anApprovalMakesTheTeamAsTheModeratorCorrectedItAndLeavesTheProposalAsSent() throws Exception {
		long item = aProposalWaiting();

		assertThat(decide(item, "{\"approved\":true,\"team\":{\"name\":\"  Ispravljen naziv  \","
				+ "\"city\":\"  Pančevo  \",\"country\":\"RS\",\"bio\":\"  Ispravljen opis  \","
				+ "\"link\":\"  https://ispravljen.example  \"}}").getStatus()).isEqualTo(200);

		assertThat(db.sql("select slug || '|' || name || '|' || city || '|' || bio || '|' || link"
						+ " || '|' || (place_id is null) || '|' || admin_id from team where name = ?")
				.param("Ispravljen naziv").query(String.class).single())
				.as("the team does not carry what the moderator left on the card")
				.isEqualTo("ispravljen-naziv|Ispravljen naziv|Pančevo|Ispravljen opis|"
						+ "https://ispravljen.example|true|"
						+ id(THE_FOUNDER));
		assertThat(db.sql("select count(*) from team where name = ?").param("Poslat naziv")
				.query(Long.class).single())
				.as("the name the member sent became a team beside the corrected one")
				.isZero();
		assertThat(db.sql("select name || '|' || bio from team_proposal where id ="
						+ " (select team_proposal_id from verification where id = ?)")
				.param(item).query(String.class).single())
				.as("the correction was written back over what the member asked for")
				.isEqualTo("Poslat naziv|Poslat opis");
	}

	@Test
	void anApprovalWithNoCorrectionMakesTheTeamAsTheMemberSentIt() throws Exception {
		long item = aProposalWaiting();

		assertThat(decide(item, "{\"approved\":true}").getStatus()).isEqualTo(200);
		assertThat(db.sql("select bio || '|' || link from team where name = ?").param("Poslat naziv")
				.query(String.class).single())
				.isEqualTo("Poslat opis|https://poslat.example");
	}

	@Test
	void aCorrectionThatIsNotATeamMakesNothingAndTheItemWaits() throws Exception {
		long item = aProposalWaiting();
		long teams = count("team");

		for (String team : List.of(
				"{\"name\":\"Ispravljen\",\"city\":\"Zemun\",\"country\":\"RS\",\"bio\":\""
						+ "a".repeat(361) + "\",\"link\":\"\"}",
				"{\"name\":\"Ispravljen\",\"city\":\"Zemun\",\"country\":\"RS\",\"bio\":\"\","
						+ "\"link\":\"ispravljen.example\"}",
				"{\"name\":\"   \",\"city\":\"Zemun\",\"country\":\"RS\"}",
				"{\"name\":\"Ispravljen\",\"city\":\"Zemun\",\"country\":\"QQ\"}")) {
			assertThat(decide(item, "{\"approved\":true,\"team\":" + team + "}").getStatus())
					.as("%s was taken as a team", team)
					.isEqualTo(400);
		}

		assertThat(count("team")).isEqualTo(teams);
		assertThat(stateOf(item)).isEqualTo("waiting");
	}

	@Test
	void aDescriptionOfThreeHundredAndSixtyIsACorrectionTheTeamCarries() throws Exception {
		long item = aProposalWaiting();

		assertThat(decide(item, "{\"approved\":true,\"team\":{\"name\":\"Ispravljen\","
				+ "\"city\":\"Zemun\",\"country\":\"RS\",\"bio\":\"" + "a".repeat(360) + "\"}}")
				.getStatus()).isEqualTo(200);
	}

	@Test
	void theCardShowsTheDescriptionAndTheLinkOfWhatWaits() throws Exception {
		long proposal = aProposalWaiting();
		long change = aChangeWaiting("Dunavski trkači Zemun", "Opis izmene", "https://izmena.example");

		JsonNode served = mapper.readTree(http.perform(get("/api/verification")
						.cookie(new Cookie(SessionCookie.NAME, session.secret())))
				.andReturn().getResponse().getContentAsString());

		assertThat(List.of(card(served, proposal).path("body").asString(),
				card(served, proposal).path("link").asString(),
				card(served, change).path("body").asString(),
				card(served, change).path("link").asString(),
				card(served, change).path("kind").asString()))
				.as("the card does not show what each of the two waiting items would write")
				.containsExactly("Poslat opis", "https://poslat.example", "Opis izmene",
						"https://izmena.example", "teamEdit");
	}

	private JsonNode card(JsonNode served, long item) {
		List<JsonNode> all = new java.util.ArrayList<>();
		served.forEach(all::add);

		return all.stream().filter(one -> one.path("id").asLong() == item).findFirst()
				.orElseThrow(() -> new AssertionError("item " + item + " is not served: " + served));
	}

	private long aChangeWaiting(String name, String bio, String link) {
		long proposal = db.sql("insert into team_proposal (competitor_id, team_id, name, bio, link,"
						+ " city, country_id) values (?, ?, ?, ?, ?, 'Zemun',"
						+ " (select id from country where code = 'RS')) returning id")
				.params(id(THE_LEADER), teamKey(THE_TEAM), name, bio, link)
				.query(Long.class).single();

		return queued(THE_LEADER, name, proposal);
	}

	private long aProposalWaiting() {
		int onSale = AMembershipOfTheSeasonHeWouldJoin.season(INSIDE_THE_WINDOW.atZone(SeasonClock.ZONE));

		if (db.sql("select count(*) from membership where competitor_id = ? and season = ?")
				.params(id(THE_FOUNDER), onSale).query(Long.class).single() == 0) {
			HeldOn.season(db, id(THE_FOUNDER), onSale, "payment");
		}

		long proposal = db.sql("insert into team_proposal (competitor_id, name, bio, link, city,"
						+ " country_id) values (?, 'Poslat naziv', 'Poslat opis', 'https://poslat.example',"
						+ " 'Bor', (select id from country where code = 'RS')) returning id")
				.param(id(THE_FOUNDER))
				.query(Long.class).single();

		return queued(THE_FOUNDER, "Poslat naziv", proposal);
	}

	private long queued(String memberNumber, String name, long proposal) {
		return db.sql("insert into verification (queue, competitor_id, subject, body, team_proposal_id)"
						+ " values ('teams', ?, ?, '', ?) returning id")
				.params(id(memberNumber), name, proposal)
				.query(Long.class).single();
	}

	private MockHttpServletResponse decide(long item, String body) throws Exception {
		return http.perform(post("/api/verification/" + item + "/decision").with(csrf())
						.contentType(MediaType.APPLICATION_JSON).content(TheTeamHeSaw.beside(db, item, body))
						.cookie(new Cookie(SessionCookie.NAME, session.secret())))
				.andReturn().getResponse();
	}

	private List<String> theTeam() {
		return db.sql("select slug, name, bio, link, coalesce(city, '-'), admin_id from team"
						+ " where id = ?")
				.param(teamKey(db.sql("select slug from team where admin_id = ?").param(id(THE_LEADER))
						.query(String.class).single()))
				.query((row, one) -> List.of(row.getString(1), row.getString(2), row.getString(3),
						row.getString(4), row.getString(5), String.valueOf(row.getLong(6))))
				.single();
	}

	private String stateOf(long item) {
		return db.sql("select state from verification where id = ?").param(item)
				.query(String.class).single();
	}

	private long count(String table) {
		return db.sql("select count(*) from " + table).query(Long.class).single();
	}

	private long teamKey(String slug) {
		return db.sql("select id from team where slug = ?").param(slug).query(Long.class).single();
	}

	private long id(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?").param(memberNumber)
				.query(Long.class).single();
	}

	private void team(String slug, String name) {
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id) values (?, ?, 'Stari opis', '',"
						+ " (select id from place where rank = 1), null, null, null, 2027, null)")
				.params(slug, name).update();
	}

	private void competitor(String number) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Probic', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, ?, '', false, 'none', 'Otac',"
						+ " 'Ulica 1', 'M', timestamptz '2026-01-01 10:00:00+00')")
				.params(number, String.format("%016x", ++issued))
				.update();
		HeldOn.activeAt(db, number, INSIDE_THE_WINDOW.atZone(SeasonClock.ZONE));
	}
}
