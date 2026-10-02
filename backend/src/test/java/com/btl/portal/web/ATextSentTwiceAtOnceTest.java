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
import tools.jackson.databind.ObjectMapper;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * A MEMBER WHO PRESSES „POSALJI" TWICE LEAVES ONE TEXT WAITING, AND THE SECOND PRESS IS TOLD SO.
 *
 * <p><b>The owner's decision, PDL, „Nov tekst o sebi se ODBIJA dok prethodni ceka odluku
 * moderatora" (19.09.2026):</b> „Odgovor je 409, i prvi tekst ostaje u redu netaknut." Every
 * sequential case in {@code MeWriteApiTest} already held that, and none of them could see the hole
 * this file is about: {@code MeWriteApi} asked „does a text of his wait" and then wrote one, in two
 * statements under READ COMMITTED, so two requests that both asked before either wrote were both
 * told yes. The moderator then held two texts of one person and no question he could answer.
 *
 * <p><b>THE FLOOR IS THE DATABASE's, and the precedent is the portal's own:</b> „pita se jednom" is
 * an index or a key in four places already ({@code team_application_asked_once},
 * {@code team_invitation_sent_once}, {@code pair_invite_asked_once} and, on this very table,
 * {@code verification_team_proposal_unique}). V53 adds {@code verification_one_text_waits_per_member}
 * and the route meets it with {@code on conflict do nothing}, so the second press is refused with the
 * owner's 409 and not with a fault.
 *
 * <p><b>NOT {@code @Transactional}</b>, for the reason {@code VerificationDecisionConcurrencyTest}
 * sets out: a test managed transaction is bound to the calling thread, so the two requests below each
 * get a connection and a transaction of their own and really do overlap. The rows are real commits,
 * and {@link #andNothingOfItIsLeftBehind} takes them back out by key whether the case passed or not.
 *
 * <p><b>THE ORDER IS TAKEN AWAY FROM THE SCHEDULER, the same way the precedent takes it.</b> The case
 * holds the member's own row {@code FOR UPDATE} before either request is sent, so both stop inside the
 * database before either can commit, and only then is the row let go. Where they stop differs with
 * what they carry, and both shapes are here:
 *
 * <ul>
 * <li><b>Two texts alone</b>, which is the press of the same button twice: neither request writes
 * {@code competitor}, so the first stops on the {@code FOR KEY SHARE} its new row's foreign key takes,
 * and the second stops behind the first's uncommitted key - or, without the index, behind the held row
 * as well.
 * <li><b>A text with a field that takes effect at once</b>, which is the one shape where losing the
 * race could still leave something behind: both requests write {@code competitor} first and stop
 * there. The loser's name must go back with its text, or the member is renamed by a request he was
 * told did nothing.
 * </ul>
 *
 * <p><b>The assertions are INVARIANTS and never „the first thread wins"</b>, which is the precedent's
 * own rule: which request reaches the row first is not a thing a case may claim.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ATextSentTwiceAtOnceTest {

	/** Distinct from every other fixture's member, on purpose: these rows are committed. */
	private static final String ME = "000941";

	private static final String MY_ADDRESS = "dva-teksta-odjednom@primer.rs";

	/** What his row is called before either request, which neither request sends. */
	private static final String THE_NAME_HE_HAD = "Polazni";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	/** The row's own lock, held from this thread so both requests queue behind it. */
	@Autowired
	private TransactionTemplate holdingTheRow;

	private long me;

	private SecretToken session;

	@BeforeEach
	void oneMemberWithNothingWaiting() {
		me = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, ?, 'Dvoklikovic', 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " 'b2031000000000a1', 'Tekst koji je vec odobren.', false, 'none', 'Otac',"
						+ " 'Ulica 1', 'M', timestamptz '2026-01-01 10:00:00+00') returning id")
				.params(ME, THE_NAME_HE_HAD)
				.query(Long.class).single();

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Roditelj', 'Roditeljevic', ?, (select id from role where code = 'competitor'), ?)")
				.params(MY_ADDRESS, me).update();

		session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(MY_ADDRESS, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();
	}

	/**
	 * Real commits, so a real delete, children before parents - written out although every key here
	 * cascades, which is the precedent's sentence and its reason.
	 */
	@AfterEach
	void andNothingOfItIsLeftBehind() {
		db.sql("delete from verification where competitor_id = ?").param(me).update();
		db.sql("delete from account where email = ?").param(MY_ADDRESS).update();
		db.sql("delete from competitor where id = ?").param(me).update();
	}

	/**
	 * THE SAME BUTTON PRESSED TWICE: ONE TEXT WAITS, ONE PRESS IS TOLD IT ALREADY DOES.
	 *
	 * <p>Measured on the code before V53, with this case written first: both presses were answered
	 * 200 and two texts of one member stood in the queue.
	 */
	@Test
	void theSameTextSentTwiceAtOnceLeavesOneWaitingAndTheOtherPressIsTold() throws Exception {
		List<MockHttpServletResponse> both = atOnceBehindTheHeldRow(
				() -> change(Map.of("bio", "Trcim od 2019. i ovo saljem dvaput.")),
				() -> change(Map.of("bio", "Trcim od 2019. i ovo saljem dvaput.")));

		assertThat(statusesOf(both))
				.as("both presses were told their text went to a moderator")
				.containsExactly(200, 409);

		assertThat(reasonOfTheRefusalIn(both))
				.as("the second press was refused with something other than the owner's answer")
				.isEqualTo(MeWriteApi.A_TEXT_ALREADY_WAITS);

		assertThat(textsWaiting())
				.as("a moderator now holds two texts of one member and no question he can answer")
				.containsExactly("Trcim od 2019. i ovo saljem dvaput.");
	}

	/**
	 * TWO DIFFERENT REQUESTS, EACH WITH A TEXT AND A NAME: THE NAME THAT STANDS CAME WITH THE TEXT
	 * THAT WAITS.
	 *
	 * <p>The name takes effect at once (PDL P28b, 1) and is written BEFORE the text, so the request
	 * that loses the race at the text has already renamed the member by the time it loses. The owner's
	 * „prvi tekst ostaje u redu netaknut" is about the queue; that the loser's other half goes back
	 * with it is the route's own rule that a refusal commits nothing, met here for the one refusal the
	 * database decides.
	 *
	 * <p><b>Two names and neither is the one he had</b>, so „nothing was rolled back" (the loser's
	 * name), „everything was rolled back" (his old name) and the right answer are three different
	 * strings.
	 */
	@Test
	void whatTheLosingRequestWroteBeforeItsTextGoesBackWithIt() throws Exception {
		Map<String, Object> first = new LinkedHashMap<>();
		first.put("bio", "Prvi tekst, poslat sa imenom Prvoslava.");
		first.put("firstName", "Prvoslav");

		Map<String, Object> second = new LinkedHashMap<>();
		second.put("bio", "Drugi tekst, poslat sa imenom Drugoslava.");
		second.put("firstName", "Drugoslav");

		List<MockHttpServletResponse> both = atOnceBehindTheHeldRow(
				() -> change(first), () -> change(second));

		assertThat(statusesOf(both))
				.as("both requests were told they went through")
				.containsExactly(200, 409);

		List<String> waiting = textsWaiting();

		assertThat(waiting).hasSize(1);

		String expectedName = waiting.getFirst().startsWith("Prvi") ? "Prvoslav" : "Drugoslav";

		assertThat(db.sql("select first_name from competitor where id = ?").param(me)
				.query(String.class).single())
				.as("the name that stands did not come with the text that waits, so the request"
						+ " that was refused renamed the member anyway")
				.isEqualTo(expectedName);
	}

	/**
	 * BOTH REQUESTS STOPPED INSIDE THE DATABASE BEFORE EITHER COULD COMMIT, AND ONLY THEN RELEASED.
	 *
	 * <p>The shape is {@code VerificationDecisionConcurrencyTest}'s: wait for the two WHILE the lock
	 * is held, require that neither has been answered, and read the futures only once the lock is
	 * let go - read inside, the requests could never finish and the case would hang rather than fail.
	 */
	private List<MockHttpServletResponse> atOnceBehindTheHeldRow(Callable<MockHttpServletResponse> one,
			Callable<MockHttpServletResponse> other) throws Exception {

		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from competitor where id = ? for update")
						.param(me).query(Integer.class).single();

				assertThat(BlockedBehindThisHold.count(db))
						.as("the row is locked and nothing has been submitted yet, so a count that is"
								+ " not nought is counting something other than the two requests")
						.isZero();

				submitted.add(pool.submit(one));
				submitted.add(pool.submit(other));

				try {
					BlockedBehindThisHold.untilBothArrive(db, submitted);
				} catch (InterruptedException e) {
					throw new IllegalStateException(e);
				}

				assertThat(submitted)
						.as("a request was answered before it reached the database, so the two did"
								+ " not meet where this case is written to make them meet")
						.hasSize(2).noneMatch(Future::isDone);

				return null;
			});

			return List.of(submitted.get(0).get(30, TimeUnit.SECONDS),
					submitted.get(1).get(30, TimeUnit.SECONDS));
		} finally {
			pool.shutdownNow();
		}
	}

	private MockHttpServletResponse change(Map<String, Object> body) throws Exception {
		return http.perform(put("/api/me").with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, session.secret()))
						.contentType(MediaType.APPLICATION_JSON)
						.content(mapper.writeValueAsString(body)))
				.andReturn().getResponse();
	}

	private static List<Integer> statusesOf(List<MockHttpServletResponse> both) {
		return both.stream().map(MockHttpServletResponse::getStatus).sorted().toList();
	}

	private String reasonOfTheRefusalIn(List<MockHttpServletResponse> both) throws Exception {
		MockHttpServletResponse refused = both.get(0).getStatus() == 409 ? both.get(0) : both.get(1);

		return mapper.readTree(refused.getContentAsString()).path("reason").asString();
	}

	private List<String> textsWaiting() {
		return db.sql("select body from verification where competitor_id = ? and queue = 'profiles'"
						+ " and state = 'waiting' and photo_id is null order by id")
				.param(me).query(String.class).list();
	}
}
