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
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A PROPOSAL AND THE QUEUE ROW THAT CARRIES IT ARE ONE THING: BOTH ARE WRITTEN OR NEITHER
 * IS.
 *
 * <p><b>NOT {@code @Transactional}, AND THAT IS THE WHOLE REASON THIS FILE IS SEPARATE
 * FROM {@code TeamWriteApiTest}.</b> A test-managed transaction swallows the question it
 * is asked: {@code TransactionTemplate} joins whatever transaction is already open, so a
 * route that had no transaction of its own would still be inside the test's, and both
 * halves of a half-finished write would disappear at the end of the case whatever the
 * route did. Measured on 19.09.2026 - taking the transaction out of {@code TeamWriteApi}
 * altogether left {@code TeamWriteApiTest} at 37 cases, none failing, which is why that
 * file's bold sentence about one transaction was a claim nothing held. Here the rows are
 * really committed and the {@code finally} below takes them away again, which is
 * {@code PaymentNumberConcurrencyTest}'s arrangement and its reason.
 *
 * <p><b>WHY IT MATTERS, AND IT IS NOT TIDINESS.</b> A {@code team_proposal} with no row in
 * {@code verification} reaches nobody: {@link VerificationApi} serves the queue out of the
 * rights matrix joined to {@code verification} and never sees it, and
 * {@link MyApplicationsApi} joins the two with an INNER join and says in as many words why
 * - „a proposal with no queue row is not a state this schema is written to produce". So
 * the member is told 201, sees nothing waiting, and the moderator is never asked. There is
 * no state in this schema from which anybody could repair it, because nothing anywhere
 * looks for a proposal that has no queue row.
 *
 * <p><b>HOW THE SECOND WRITE IS MADE TO FAIL, without a line of production code knowing
 * about this case.</b> The note is the one field that goes ONLY into {@code verification},
 * so a note that table refuses is a request whose first statement succeeds and whose
 * second does not. The refusal is a trigger this case makes on {@code verification.body}
 * and takes away again ({@link AFailureOnlyTheDatabaseCanCause}): a row whose body is the
 * marker below is refused by the database and by nothing in the route, with a message that
 * names that trigger. Nothing is stubbed, and the route is asked the way a member asks it.
 *
 * <p><b>It used to be a zero character, and that road is closed on purpose.</b> {@code text}
 * cannot hold {@code U+0000}, which made a note carrying one fail exactly here; but a zero is
 * now refused where a body is read ({@code NoTextHoldsAZero}), before any statement is
 * attempted, so the same request answers 400 and this case would have measured a route that
 * never got started. The case said so itself - „nothing is being measured" - and the
 * replacement has to say the same thing in the other direction: the failure it asks for must
 * be the failure that ended the request, which is why the assertion reads the cause of what
 * was thrown and not only that something was.
 *
 * <p><b>What the caller is told is deliberately NOT asserted.</b> The answer to a write
 * that failed halfway is a 500 however it is arranged, and a 500 is not what this case is
 * about; asserting it would also tie this file to whether MockMvc rethrows or records the
 * failure, which is a fact about MockMvc. What is asserted is the database, which is where
 * the question lives.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class TeamProposalAndItsQueueRowAreOneThingTest {

	/** 11:00 in Belgrade on 3 October 2027, inside the transfer window. */
	private static final Instant INSIDE_THE_WINDOW = Instant.parse("2027-10-20T09:00:00Z");

	/**
	 * Distinct from every other fixture's example member, on purpose.
	 *
	 * <p>The rows this file writes are COMMITTED, so a number another file also uses would
	 * be a row standing in the register while that file ran.
	 */
	private static final String ME = "000910";

	private static final String MY_ADDRESS = "predlog-u-celini@primer.rs";

	/**
	 * A note the database refuses and the route does not, which is what makes the SECOND write
	 * fail. Ordinary words: not blank, nowhere near any length, and not a shape any check of the
	 * route looks at.
	 */
	private static final String A_NOTE_ONLY_THE_DATABASE_REFUSES = "Razlog koji baza odbija";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private SecretToken session;

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisFileUses {

		@Bean
		@Primary
		Clock aClockInsideTheTransferWindow() {
			return Clock.fixed(INSIDE_THE_WINDOW, ZoneOffset.UTC);
		}
	}

	/**
	 * One member, in no team, who may propose.
	 *
	 * <p>{@code active} is true, a member whose fee stands: since P8U proposing a team turns away
	 * a member whose fee does not stand before anything is written
	 * ({@code NoWriteTakesAMemberWhoHasNotPaidTest}), and what this case is about is a write that
	 * IS made. The row is taken out after every case, so nothing that runs after this file meets
	 * it on a public list.
	 */
	@BeforeEach
	void oneMemberWhoMayPropose() {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Probic', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " 'a91b7c5d0e3f2401', '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00')")
				.param(ME).update();

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Probni', 'Probic', ?, (select id from role where code = 'competitor'),"
						+ " (select id from competitor where member_number = ?))")
				.params(MY_ADDRESS, ME).update();

		session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(MY_ADDRESS, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();
	}

	/**
	 * Everything this file made, whether or not the case got that far.
	 *
	 * <p>The account goes first because {@code account_competitor_fk} is
	 * {@code on delete restrict} (V23): a member is not deleted by deleting the account
	 * that names him, so the pointer has to go before he can.
	 */
	@AfterEach
	void andNothingOfItIsLeftBehind() {
		db.sql("delete from account where email = ?").param(MY_ADDRESS).update();
		db.sql("delete from competitor where member_number = ?").param(ME).update();
	}

	@Test
	void aSecondWriteThatFailsTakesTheFirstWithIt() throws Exception {
		assertThat(howManyProposalsAreMine())
				.as("this member already has a proposal, so nothing below is about the one this"
						+ " case sends")
				.isZero();

		try (AFailureOnlyTheDatabaseCanCause theNote = AFailureOnlyTheDatabaseCanCause.on(db,
				"verification", "body", A_NOTE_ONLY_THE_DATABASE_REFUSES)) {

			/* THE FIRST WRITE REALLY DOES SUCCEED ON ITS OWN, which is what makes the rollback
			   below a claim about a rollback rather than about a request that never got started.
			   A different name, so the two rows could stand side by side if both stuck. It is
			   sent with the trigger already standing, so it also shows that the trigger refuses
			   the marker and nothing else. */
			assertThat(proposing("Predlog koji prolazi", "obican razlog").getStatus()).isEqualTo(201);
			assertThat(howManyProposalsAreMine())
					.as("a request this route accepts wrote no proposal, so the comparison below has"
							+ " no other side")
					.isOne();

			Throwable halfWay = catchThrowable(
					() -> proposing("Predlog koji puca", A_NOTE_ONLY_THE_DATABASE_REFUSES));

			assertThat(theNote.wentOffIn(halfWay))
					.as("the second statement of this route did not fail because of the trigger this"
							+ " case made, so it did not fail, or it failed for a reason of its own,"
							+ " and nothing is being measured. What was thrown: %s", halfWay)
					.isTrue();

			assertThat(howManyProposalsAreMine())
					.as("the proposal survived a write whose queue row failed, so the member holds a"
							+ " proposal that reaches no moderator and shows on no screen of his own")
					.isOne();

			assertThat(db.sql("select count(*) from team_proposal where name = ?")
					.param("Predlog koji puca").query(Long.class).single())
					.as("the proposal whose queue row failed is still in the table")
					.isZero();
		}
	}

	private long howManyProposalsAreMine() {
		return db.sql("select count(*) from team_proposal where competitor_id ="
				+ " (select id from competitor where member_number = ?)")
				.param(ME).query(Long.class).single();
	}

	private org.springframework.mock.web.MockHttpServletResponse proposing(String name,
			String note) throws Exception {

		return http.perform(post("/api/teams").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"name\": \"" + name + "\", \"city\": \"Novi Sad\","
								+ " \"country\": \"RS\", \"note\": \"" + note + "\"}")
						.cookie(new Cookie(SessionCookie.NAME, session.secret())))
				.andReturn().getResponse();
	}
}
