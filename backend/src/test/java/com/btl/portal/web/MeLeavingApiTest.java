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
 * <li><b>Each clause of {@link LeavingBeforeBecomingAMember#NEVER_A_MEMBER}</b>: {@link ThingsOfTheLeague#BLOCKERS} gives
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

	private static final String A_TOWN_IN_SERBIA = ThingsOfTheLeague.A_TOWN_IN_SERBIA;

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

	/** Somebody else, a team, an event and a race, for the rows that break one clause each. */
	private ThingsOfTheLeague.Around around;

	@BeforeEach
	void heAndSomebodyElseNeitherOfThemAMember() {
		him = neverAMember();
		hisSession = sessionOf(him);
		hisOtherDevice = sessionOf(him);

		someoneElse = neverAMember();
		theirSession = sessionOf(someoneElse);

		around = ThingsOfTheLeague.Around.in(db, someoneElse);
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

	@ParameterizedTest
	@MethodSource("com.btl.portal.web.ThingsOfTheLeague#blockers")
	void oneThingOfTheLeagueBehindHimAndHeIsRefused(String what) throws Exception {
		ThingsOfTheLeague.BLOCKERS.get(what).accept(around, him);

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
