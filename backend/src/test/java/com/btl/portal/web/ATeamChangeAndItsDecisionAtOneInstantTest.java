package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A SECOND CHANGE OF A TEAM AND THE DECISION ABOUT THE FIRST, AT ONE INSTANT, IN BOTH ORDERS (PDL P13,
 * [ODLUKA 23.11.2026]: „nova zamenjuje staru").
 *
 * <p>The sequential cases ({@code TeamWriteApiTest}, {@code TeamDecisionsCarryWhatTheCardShowsTest}) pass
 * whatever the order of the two statements is, because nothing in them is between a reading and its
 * writing. This is the second channel the review of PR 807 named: the replacement reads the card that
 * waits and writes over it, a decision reads the card and claims it, and each is a check-then-act against
 * the other. {@link BlockedBehindThisHold} is the arrangement {@code VerificationDecisionConcurrencyTest}
 * measures with: the row's lock is held here, the request is let in, and the lock manager is asked
 * whether it has arrived before the hold is let go, so a request that was refused or finished before it
 * reached the lock does not pass for one that waited.
 *
 * <p><b>Committed rows</b>, as that class's, because a held lock is a thing between connections; each is
 * taken out again below. The names are this file's own.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ATeamChangeAndItsDecisionAtOneInstantTest {

	private static final String THE_MODERATOR = "promena-i-odluka-moderator@primer.rs";

	private static final String THE_ADMINISTRATOR = "promena-i-odluka-admin@primer.rs";

	private static final String HIS_NUMBER = "000951";

	private static final String THE_TEAM = "promena-i-odluka-tim";

	private static final String THE_SENTENCE = "Izmena tima je promenjena, pogledaj je ponovo.";

	private static final String COMPETITOR_COLUMNS = "member_number, first_name, last_name, gender,"
			+ " birth_date, place_id, first_season, referral_code, bio, profile_hidden, birthday_shown,"
			+ " father_name, address, shirt_size, health_statement_at";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate holdingTheRow;

	private final java.util.Map<String, String> sessions = new java.util.HashMap<>();

	private long administrator;

	private long team;

	/** The change that waits, and the key of the proposal behind it. */
	private long card;

	private long proposal;

	@BeforeEach
	void aTeamItsAdministratorAModeratorAndOneChangeWaiting() {
		administrator = db.sql("insert into competitor (" + COMPETITOR_COLUMNS + ") values (?, 'Probni',"
						+ " 'Upravnik', 'M', date '1990-05-05', (select id from place where rank = 1), 2027,"
						+ " '00112233445599b1', '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.param(HIS_NUMBER).query(Long.class).single();
		HeldOn.activeAt(db, HIS_NUMBER, ZonedDateTime.now(com.btl.portal.domain.season.SeasonClock.ZONE));

		team = db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id) values (?, 'Tim promena i odluka', '', '',"
						+ " (select id from place where rank = 1), null, null, null, 2027, null) returning id")
				.params(THE_TEAM).query(Long.class).single();
		db.sql("insert into team_membership (competitor_id, team_id, season_from) values (?, ?, 2027)")
				.params(administrator, team).update();
		db.sql("update team set admin_id = ? where id = ?").params(administrator, team).update();

		account(THE_ADMINISTRATOR, administrator);
		moderator(THE_MODERATOR);

		proposal = db.sql("insert into team_proposal (competitor_id, team_id, name, bio, link, city,"
						+ " country_id) values (?, ?, 'Prva izmena', 'Prvi opis', '', 'Zemun',"
						+ " (select id from country where code = 'RS')) returning id")
				.params(administrator, team).query(Long.class).single();
		card = db.sql("insert into verification (queue, competitor_id, subject, body, team_proposal_id)"
						+ " values ('teams', ?, 'Prva izmena', '', ?) returning id")
				.params(administrator, proposal).query(Long.class).single();
	}

	@AfterEach
	void takeThemBackOut() {
		db.sql("delete from verification_lock where verification_id in"
				+ " (select v.id from verification v join team_proposal p on p.id = v.team_proposal_id"
				+ " where p.team_id = ?)").param(team).update();
		db.sql("delete from team_proposal where team_id = ?").param(team).update();
		db.sql("delete from team_membership where team_id = ?").param(team).update();
		db.sql("delete from team where id = ?").param(team).update();

		for (String email : sessions.keySet()) {
			db.sql("delete from account where email = ?").param(email).update();
		}

		db.sql("delete from competitor where id = ?").param(administrator).update();
	}

	/**
	 * THE REPLACEMENT MEETS A DECISION THAT IS IN THE MIDDLE OF BEING TAKEN: it waits for it, finds the card
	 * decided, and opens a second card beside it. The decided one keeps its words.
	 *
	 * <p>Two things are measured and each has its own mutation. That the request WAITS (the lock is the
	 * card's own, {@code for update of v}): without it the request does not appear behind this hold at all
	 * and the wait below fails. And that what it finds AFTER the wait is re-asked against {@code state =
	 * 'waiting'}: a card decided meanwhile is not repointed, so the member's new words are not written over a
	 * decision that was taken about the old ones.
	 */
	@Test
	void aChangeSentWhileTheFirstIsBeingDecidedOpensAnotherAndLeavesTheDecidedOneAlone() throws Exception {
		ExecutorService pool = Executors.newFixedThreadPool(1);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			Callable<MockHttpServletResponse> second = () -> change("Druga izmena", "Drugi opis");

			holdingTheRow.execute(held -> {
				db.sql("select 1 from verification where id = ? for update").param(card)
						.query(Integer.class).single();

				submitted.add(pool.submit(second));
				untilItIsHeldUp(submitted);

				assertThat(submitted.get(0).isDone())
						.as("the change was not held up by the card's lock, so it reads the card without"
								+ " taking it and can write over a decision that is being taken")
						.isFalse();

				/* THE DECISION THE HOLDER WAS TAKING, committed when the hold is let go. */
				db.sql("update verification set state = 'approved', decided_at = now(),"
								+ " decided_by_name = 'Moderator Probni' where id = ?")
						.param(card).update();

				return null;
			});

			assertThat(submitted.get(0).get(30, TimeUnit.SECONDS).getStatus()).isEqualTo(201);
			assertThat(db.sql("select v.state || '|' || p.name || '|' || p.bio from verification v"
							+ " join team_proposal p on p.id = v.team_proposal_id where v.id = ?")
					.param(card).query(String.class).single())
					.as("the decision that was being taken was written over by the words that came after it")
					.isEqualTo("approved|Prva izmena|Prvi opis");
			assertThat(db.sql("select v.state || '|' || p.name from verification v"
							+ " join team_proposal p on p.id = v.team_proposal_id"
							+ " where p.team_id = ? and v.id <> ?")
					.params(team, card).query(String.class).list())
					.as("the second change did not wait as a card of its own beside the decided one")
					.containsExactly("waiting|Druga izmena");
		} finally {
			pool.shutdownNow();
		}
	}

	/**
	 * THE DECISION MEETS A REPLACEMENT THAT IS IN THE MIDDLE OF BEING WRITTEN: it waits for it, reads the words
	 * AFTER the wait, and refuses with the sentence. Nothing is decided and the team has not moved.
	 *
	 * <p>The words are on {@code team_proposal}, which is not the table that was locked, and a statement that
	 * waited does not re-read another table: that is why the check is two statements and why this case is
	 * written at all. Compared with the words read before the wait, the decision would go through on a change
	 * the moderator never saw.
	 */
	@Test
	void aDecisionTakenWhileTheChangeIsBeingWrittenOverIsRefusedForWhatItFindsAfterTheWait()
			throws Exception {
		ExecutorService pool = Executors.newFixedThreadPool(1);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			Callable<MockHttpServletResponse> deciding = () -> decide("{\"approved\":true,\"seenTeam\":"
					+ "{\"name\":\"Prva izmena\",\"city\":\"Zemun\",\"country\":\"RS\","
					+ "\"bio\":\"Prvi opis\",\"link\":\"\"}}");

			holdingTheRow.execute(held -> {
				db.sql("select 1 from verification where id = ? for update").param(card)
						.query(Integer.class).single();

				submitted.add(pool.submit(deciding));
				untilItIsHeldUp(submitted);

				assertThat(submitted.get(0).isDone())
						.as("the decision was not held up by the card's lock, so it compares words read"
								+ " before anybody could write over them")
						.isFalse();

				/* THE SECOND CHANGE, WRITTEN OVER THE CARD, committed when the hold is let go. */
				db.sql("update team_proposal set name = 'Druga izmena', bio = 'Drugi opis' where id = ?")
						.param(proposal).update();

				return null;
			});

			MockHttpServletResponse answer = submitted.get(0).get(30, TimeUnit.SECONDS);

			assertThat(answer.getStatus()).isEqualTo(409);
			assertThat(answer.getContentAsString()).contains(THE_SENTENCE);
			assertThat(db.sql("select state from verification where id = ?").param(card)
					.query(String.class).single()).as("the card was decided over words nobody had shown")
					.isEqualTo("waiting");
			assertThat(db.sql("select name from team where id = ?").param(team).query(String.class).single())
					.as("the team took words the moderator never saw").isEqualTo("Tim promena i odluka");
		} finally {
			pool.shutdownNow();
		}
	}

	/** Until the one request is behind this connection's lock, as the lock manager says. */
	private void untilItIsHeldUp(List<Future<MockHttpServletResponse>> submitted) {
		Instant deadline = Instant.now().plusSeconds(10);

		while (BlockedBehindThisHold.count(db) < 1) {
			if (Instant.now().isAfter(deadline) || submitted.get(0).isDone()) {
				throw new IllegalStateException("the request never showed up behind the held card, done="
						+ submitted.get(0).isDone());
			}

			try {
				Thread.sleep(25);
			} catch (InterruptedException e) {
				throw new IllegalStateException(e);
			}
		}
	}

	private MockHttpServletResponse change(String name, String bio) throws Exception {
		return http.perform(post("/api/teams/" + team + "/changes").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(THE_ADMINISTRATOR)))
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"name\":\"" + name + "\",\"bio\":\"" + bio
								+ "\",\"link\":\"\",\"city\":\"Zemun\",\"country\":\"RS\"}"))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse decide(String body) throws Exception {
		return http.perform(post("/api/verification/" + card + "/decision").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, sessions.get(THE_MODERATOR)))
						.contentType(MediaType.APPLICATION_JSON).content(body))
				.andReturn().getResponse();
	}

	private void account(String email, long competitor) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Probni', 'Probic', ?, (select id from role where code = 'competitor'), ?)")
				.params(email, competitor).update();
		openSession(email);
	}

	private void moderator(String email) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Probni', 'Moderator', ?, (select id from role where code = 'moderator'))")
				.param(email).update();
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'queue:teams')")
				.param(email).update();
		openSession(email);
	}

	private void openSession(String email) {
		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session.secret());
	}
}
