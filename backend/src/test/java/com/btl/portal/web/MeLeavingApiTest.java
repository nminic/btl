package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Map;
import java.util.function.BiConsumer;
import java.util.stream.Stream;

import static java.util.Map.entry;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * {@code DELETE /api/me} AND {@code mayLeave} ON {@code GET /api/me}: an account that never became a
 * member deletes itself, and nobody else does (the owner, 20.11.2026, „jednostavno da se obriše član kao
 * da nikad nije ni registrovan i to je to, ionako nema njegovih podataka u sistemu niti rezultata").
 *
 * <p><b>THE AXES, EACH WITH BOTH STATES.</b>
 * <ul>
 * <li><b>Each clause of {@link LeavingBeforeBecomingAMember#NEVER_A_MEMBER}</b>: {@link #BLOCKERS} gives
 * him exactly one row that breaks exactly one clause, and he is refused for it; with none of them he
 * goes. Removing any one clause from the condition turns its case from 404 into 204.
 * <li><b>Whose account</b>: he is never the only account in the database. Somebody else who also never
 * became a member, with a session of his own, stands beside him in every case and must stand after
 * he goes, so a deletion that took the wrong row, or every such row, is caught.
 * <li><b>Which session</b>: he has two, as on two devices, and both must end when his account goes,
 * while the request carried only one.
 * <li><b>Whether he administers the portal</b>: the role and a ticked right, the two things {@link
 * CompetitorWriteApi#hisAccountAdministers} reads off the row.
 * <li><b>Whether the account names a member at all</b>: a moderator who does not race is refused.
 * <li><b>The door</b>: nobody signed in is 401, a request without the token is 403, neither deletes.
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MeLeavingApiTest {

	private static final String A_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	private int issued;

	/** Who presses: a member who never became one. */
	private long him;

	private SecretToken hisSession;

	private SecretToken hisOtherDevice;

	/** Somebody else who never became a member either, and must not go with him. */
	private long someoneElse;

	private SecretToken theirSession;

	private long aTeam;

	private long anEvent;

	private long aRace;

	/**
	 * ONE ROW EACH, AND EACH BREAKS ONE CLAUSE AND NO OTHER: a team, an event and a race stand in the
	 * fixture for everybody, so the row that makes him a team's member does not also make him its
	 * administrator, and a result does not also carry an announcement.
	 */
	static final Map<String, BiConsumer<MeLeavingApiTest, Long>> BLOCKERS = Map.ofEntries(
			entry("a member number", (f, m) -> f.db.sql("update competitor set member_number = '099901'"
					+ " where id = ?").param(m).update()),
			entry("a season freed of the fee", (f, m) -> HeldOn.season(f.db, m, 2028, "feeExempt")),
			entry("the trail of a cancelled season", (f, m) -> f.db.sql("insert into membership_change"
					+ " (competitor_id, season, action, basis_before, basis_after, decided_by, decided_by_name,"
					+ " decided_at) values (?, 2028, 'cancelled', 'payment', null, null, 'Blagajnik Probni',"
					+ " timestamptz '2027-03-01 10:00:00+00')").param(m).update()),
			entry("a payment that awaits its booking", (f, m) -> f.db.sql("insert into payment (competitor_id,"
					+ " season, reference, price_row_id, amount, currency, fee, method, state) values (?, 2028,"
					+ " null, (select id from price_row order by sort_order limit 1), 35.00, 'EUR', 3.00,"
					+ " 'paypal', 'awaited')").param(m).update()),
			entry("an entry of his balance", (f, m) -> f.db.sql("insert into balance_entry (competitor_id,"
					+ " amount, currency, reason, referred_competitor_id, occurred_at, recorded_by_name)"
					+ " values (?, 600.00, 'RSD', 'referral', ?, timestamptz '2027-03-01 10:00:00+00',"
					+ " 'Blagajnik Probni')").params(m, f.someoneElse).update()),
			entry("a result", (f, m) -> f.db.sql("insert into result (competitor_id, race_id, race_date,"
					+ " distance_km, ascent_m, descent_m, seconds, points) values (?, ?, date '2027-05-01',"
					+ " 10.00, 0, 0, 3000, 10.00)").params(m, f.aRace).update()),
			entry("a result that waits for a moderator", (f, m) -> f.db.sql("insert into result_submission"
					+ " (competitor_id, race_date, race_name, race_kind, event_kind, place_id, city, country_id,"
					+ " distance_km, ascent_m, descent_m, seconds, link, comment) values (?, date '2027-06-06',"
					+ " 'Trka kroz sumu', 'free', 'race', " + A_TOWN_IN_SERBIA + ", null, null, 10.00, 100,"
					+ " 100, 3600, '', '')").param(m).update()),
			entry("an announcement", (f, m) -> f.db.sql("insert into attending (event_id, competitor_id)"
					+ " values (?, ?)").params(f.anEvent, m).update()),
			entry("a place in a team", (f, m) -> f.db.sql("insert into team_membership (competitor_id, team_id,"
					+ " season_from, season_to, left_reason) values (?, ?, 2027, null, null)")
					.params(m, f.aTeam).update()),
			entry("a proposal of a team", (f, m) -> f.db.sql("insert into team_proposal (competitor_id, team_id,"
					+ " name, bio, link, place_id, city, country_id, logo_id) values (?, null, 'Predlozen tim',"
					+ " '', '', " + A_TOWN_IN_SERBIA + ", null, null, null)").param(m).update()),
			entry("an application to a team", (f, m) -> f.db.sql("insert into team_application (competitor_id,"
					+ " team_id, season) values (?, ?, 2028)").params(m, f.aTeam).update()),
			entry("an invitation into a team", (f, m) -> f.db.sql("insert into team_invitation (team_id,"
					+ " competitor_id, season) values (?, ?, 2028)").params(f.aTeam, m).update()),
			entry("the administration of a team", (f, m) -> f.db.sql("update team set admin_id = ? where id = ?")
					.params(m, f.aTeam).update()),
			entry("the role of a moderator", (f, m) -> f.db.sql("update account set role_id = (select id from"
					+ " role where code = 'moderator') where competitor_id = ?").param(m).update()),
			entry("a right of the administration", (f, m) -> f.db.sql("insert into account_admin_right"
					+ " (account_id, right_code) values ((select id from account where competitor_id = ?),"
					+ " 'queue:profiles')").param(m).update()));

	@BeforeEach
	void heAndSomebodyElseNeitherOfThemAMember() {
		him = neverAMember();
		hisSession = sessionOf(him);
		hisOtherDevice = sessionOf(him);

		someoneElse = neverAMember();
		theirSession = sessionOf(someoneElse);

		aTeam = db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id) values ('tim-odlaska', 'Tim odlaska', '', '', "
						+ A_TOWN_IN_SERBIA + ", null, null, null, 2027, null) returning id")
				.query(Long.class).single();
		anEvent = db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
						+ " values ('dogadjaj-odlaska', 'Dogadjaj odlaska', date '2027-05-01', "
						+ A_TOWN_IN_SERBIA + ", 'race', false, '', '') returning id")
				.query(Long.class).single();
		aRace = db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km,"
						+ " ascent_m, descent_m) values (?, 'Trka odlaska', false, date '2027-05-01', 'length', 0,"
						+ " 10.00, 0, 0) returning id")
				.param(anEvent).query(Long.class).single();
	}

	private long neverAMember() {
		long member = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (null, 'Probni', 'Odlazak', 'M', date '1990-01-01', " + A_TOWN_IN_SERBIA
						+ ", 2027, ?, '', false, 'none', 'Otac', 'Ulica 1', 'M', now()) returning id")
				.param(String.format("%016x", 0x0d1aL * 1000 + ++issued))
				.query(Long.class).single();

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id, password_hash,"
						+ " email_confirmed_at, created_at) values ('Probni', 'Odlazak', ?,"
						+ " (select id from role where code = 'competitor'), ?, '{bcrypt}$2a$10$abcdefghijklmnopqrstuv',"
						+ " now(), now())")
				.params("odlazak-" + issued + "@primer.rs", member).update();

		return member;
	}

	private SecretToken sessionOf(long member) {
		return sessionOfTheAccount(db.sql("select id from account where competitor_id = ?").param(member)
				.query(Long.class).single());
	}

	private SecretToken sessionOfTheAccount(long account) {
		SecretToken token = SecretToken.fresh();

		db.sql("insert into account_session (account_id, token_hash) values (?, ?)")
				.params(account, token.hash()).update();

		return token;
	}

	private MockHttpServletResponse leaving(SecretToken session) throws Exception {
		return http.perform(delete("/api/me").with(csrf()).cookie(new Cookie(SessionCookie.NAME, session.secret())))
				.andReturn().getResponse();
	}

	private boolean mayLeave(SecretToken session) throws Exception {
		MockHttpServletResponse answer = http.perform(get("/api/me")
						.cookie(new Cookie(SessionCookie.NAME, session.secret())))
				.andReturn().getResponse();

		assertThat(answer.getStatus()).as("GET /api/me").isEqualTo(200);

		return mapper.readTree(answer.getContentAsString()).path("mayLeave").asBoolean();
	}

	private boolean stands(long member) {
		return db.sql("select count(*) from competitor where id = ?").param(member).query(Long.class).single() == 1
				&& db.sql("select count(*) from account where competitor_id = ?").param(member)
						.query(Long.class).single() == 1;
	}

	private boolean open(SecretToken session) {
		return db.sql("select count(*) from account_session where token_hash = ?")
				.param(session.hash()).query(Long.class).single() == 1;
	}

	@Test
	void heMayLeaveAndHeGoesWithEverySessionAndNobodyElseDoes() throws Exception {
		assertThat(mayLeave(hisSession)).as("the server does not draw him the button").isTrue();
		assertThat(mayLeave(theirSession)).as("nor the other, who is in the same state").isTrue();

		MockHttpServletResponse answer = leaving(hisSession);

		assertThat(answer.getStatus()).isEqualTo(204);
		assertThat(answer.getContentAsString()).isEmpty();
		assertThat(answer.getHeaders("Set-Cookie"))
				.as("the cookie of a session that is gone was left in his browser")
				.singleElement().satisfies(one -> assertThat(one).startsWith(SessionCookie.NAME + "=;")
						.contains("Max-Age=0"));

		assertThat(stands(him)).as("he is still there").isFalse();
		assertThat(db.sql("select count(*) from competitor where id = ?").param(him).query(Long.class).single())
				.as("his profile outlived his account").isZero();
		assertThat(open(hisSession)).as("the session he pressed with is still open").isFalse();
		assertThat(open(hisOtherDevice)).as("his session on another device is still open").isFalse();

		assertThat(stands(someoneElse)).as("somebody else went with him").isTrue();
		assertThat(open(theirSession)).as("somebody else's session ended with his").isTrue();

		assertThat(http.perform(get("/api/me").cookie(new Cookie(SessionCookie.NAME, hisOtherDevice.secret())))
				.andReturn().getResponse().getStatus())
				.as("his other device still opens the portal").isEqualTo(401);
	}

	static Stream<String> blockers() {
		return BLOCKERS.keySet().stream().sorted();
	}

	@ParameterizedTest
	@MethodSource("blockers")
	void oneThingOfTheLeagueBehindHimAndHeIsRefused(String what) throws Exception {
		BLOCKERS.get(what).accept(this, him);

		assertThat(mayLeave(hisSession)).as("%s, and the button is drawn to him", what).isFalse();

		MockHttpServletResponse answer = leaving(hisSession);

		assertThat(answer.getStatus()).as("%s, and he was not answered as an address that is not there", what)
				.isEqualTo(404);
		assertThat(answer.getContentAsString()).as("%s: a refusal that says anything says the act exists", what)
				.isEmpty();
		assertThat(answer.getHeaders("Set-Cookie")).as("%s: refused, and his cookie was put out anyway", what)
				.noneMatch(one -> one.contains("Max-Age=0"));
		assertThat(stands(him)).as("%s, and he was deleted", what).isTrue();
		assertThat(open(hisSession)).isTrue();
		assertThat(open(hisOtherDevice)).isTrue();

		assertThat(mayLeave(theirSession)).as("%s of his took the button from somebody else", what).isTrue();
	}

	@Test
	void anAccountThatRacesForNobodyHasNothingToDelete() throws Exception {
		SecretToken moderator = sessionOfTheAccount(db.sql("insert into account (first_name, last_name, email,"
						+ " role_id) values ('Probni', 'Moderator', 'bez-clana-odlazak@primer.rs',"
						+ " (select id from role where code = 'moderator')) returning id")
				.query(Long.class).single());

		assertThat(mayLeave(moderator)).isFalse();

		MockHttpServletResponse answer = leaving(moderator);

		assertThat(answer.getStatus()).isEqualTo(404);
		assertThat(answer.getContentAsString()).isEmpty();
		assertThat(db.sql("select count(*) from account where email = 'bez-clana-odlazak@primer.rs'")
				.query(Long.class).single()).isEqualTo(1);
	}

	@Test
	void theDoorIsTheChainsAndTheTokenStays() throws Exception {
		assertThat(http.perform(delete("/api/me").with(csrf())).andReturn().getResponse().getStatus())
				.as("nobody signed in").isEqualTo(401);
		assertThat(http.perform(delete("/api/me").cookie(new Cookie(SessionCookie.NAME, hisSession.secret())))
				.andReturn().getResponse().getStatus())
				.as("without the token").isEqualTo(403);

		assertThat(stands(him)).isTrue();
		assertThat(List.of(open(hisSession), open(hisOtherDevice))).containsOnly(true);
	}
}
