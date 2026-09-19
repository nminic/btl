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

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * THE SWITCH AND THE TEXT ARE ONE REQUEST: BOTH HAPPEN OR NEITHER DOES.
 *
 * <p><b>NOT {@code @Transactional}, AND THAT IS THE WHOLE REASON THIS FILE IS SEPARATE FROM
 * {@code MeWriteApiTest}.</b> A test-managed transaction swallows the question it is asked:
 * {@code TransactionTemplate} joins whatever transaction is already open, so a route with
 * no transaction of its own would still be inside the test's, and both halves of a
 * half-finished write would disappear at the end of the case whatever the route did.
 * Measured on {@code TeamWriteApi} on 19.09.2026 - taking its transaction out left its whole
 * file green at 37 cases. Here the rows are really committed and the {@code finally} of the
 * {@code AfterEach} below takes them away again, which is
 * {@code TeamProposalAndItsQueueRowAreOneThingTest}'s arrangement and its reason.
 *
 * <p><b>WHY IT MATTERS, AND IT IS NOT TIDINESS.</b> {@code PUT /api/me} carries two things
 * down two different roads: the switch is written onto the member at once and the text is
 * put in front of a moderator. Without one transaction around them, a request whose second
 * statement fails leaves a member whose profile has been hidden, whose words never left,
 * and who is answered with a fault that says nothing about which half happened. Nothing on
 * this portal looks for that state and nothing could repair it, because a member cannot see
 * that his text is missing - he can only see that his switch moved.
 *
 * <p><b>HOW THE SECOND WRITE IS MADE TO FAIL, without a line of production code knowing
 * about this case.</b> The text is the one value that goes only into {@code verification},
 * so a text PostgreSQL cannot hold is a request whose first statement succeeds and whose
 * second does not. A string carrying {@code U+0000} is exactly that: {@code text} cannot
 * hold a zero byte, which is a property of the type and not of any constraint somebody
 * could drop. It is not blank and it is well under the length this route allows, so it
 * reaches the writing rather than being refused on the way in. Nothing is stubbed, no
 * trigger is created, and the route is asked the same way a member asks it.
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
class TheSwitchAndTheTextAreOneThingTest {

	/**
	 * Distinct from every other fixture's example member, on purpose.
	 *
	 * <p>The rows this file writes are COMMITTED, so a number another file also uses would
	 * be a row standing in the register while that file ran.
	 */
	private static final String ME = "000920";

	private static final String MY_ADDRESS = "prekidac-i-tekst@primer.rs";

	/** What stands on the profile before anything below runs, and it is not empty. */
	private static final String THE_TEXT_ON_MY_PROFILE = "Tekst koji je vec odobren.";

	/** A text {@code text} cannot hold, which is what makes the SECOND write fail. */
	private static final String A_TEXT_POSTGRES_CANNOT_HOLD = "pre posle";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private SecretToken session;

	/** One member, visible, with words already standing on his profile. */
	@BeforeEach
	void oneMemberWhoIsNotHidden() {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Probic', 'M', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, false, 'payment',"
						+ " 'b91b7c5d0e3f2402', ?, false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00')")
				.params(ME, THE_TEXT_ON_MY_PROFILE).update();

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Roditelj', 'Roditeljevic', ?,"
						+ " (select id from role where code = 'competitor'),"
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
	 * {@code on delete restrict} (V23): a member is not deleted by deleting the account that
	 * names him, so the pointer has to go before he can. The queue rows go with the member,
	 * which is {@code verification_competitor_fk}'s {@code on delete cascade}.
	 */
	@AfterEach
	void andNothingOfItIsLeftBehind() {
		db.sql("delete from account where email = ?").param(MY_ADDRESS).update();
		db.sql("delete from competitor where member_number = ?").param(ME).update();
	}

	@Test
	void aTextThatCannotBeWrittenTakesTheSwitchWithIt() throws Exception {
		assertThat(amIHidden())
				.as("this member is already hidden, so nothing below is about the switch this"
						+ " case sends")
				.isFalse();

		/* THE SWITCH REALLY DOES MOVE ON ITS OWN, which is what makes the rollback below a
		   claim about a rollback rather than about a request that never got started. */
		assertThat(changing(plainly("Tekst koji prolazi."), true).getStatus()).isEqualTo(200);
		assertThat(amIHidden())
				.as("a request this route accepts did not hide the profile, so the comparison"
						+ " below has no other side")
				.isTrue();

		assertThat(howManyTextsWait())
				.as("the accepted request wrote no queue row either, so this file is measuring a"
						+ " route that does nothing")
				.isOne();

		/* AND BACK, so the second request below is one that would really change the column. */
		assertThat(changing("null", false).getStatus()).isEqualTo(200);
		assertThat(amIHidden()).isFalse();

		/* THE ONE TEXT ALREADY WAITING WOULD REFUSE A SECOND, so it goes before the request
		   whose second statement must be the one that fails. Taken away here rather than
		   never written, because the case above is what proves the route writes one. */
		db.sql("delete from verification where competitor_id ="
				+ " (select id from competitor where member_number = ?)").param(ME).update();

		Throwable halfWay =
				catchThrowable(() -> changing(withZeroBytes(A_TEXT_POSTGRES_CANNOT_HOLD), true));

		assertThat(halfWay)
				.as("a text PostgreSQL cannot hold was written down without complaint, so the"
						+ " second statement of this route did not fail and nothing is being"
						+ " measured")
				.isNotNull();

		assertThat(amIHidden())
				.as("the switch survived a request whose queue row failed, so the member is"
						+ " hidden by a request he was told nothing about and his words never"
						+ " left")
				.isFalse();

		assertThat(howManyTextsWait())
				.as("something of that request is standing in the queue")
				.isZero();
	}

	private boolean amIHidden() {
		return Boolean.TRUE.equals(db.sql("select profile_hidden from competitor"
				+ " where member_number = ?").param(ME).query(Boolean.class).single());
	}

	private long howManyTextsWait() {
		return db.sql("select count(*) from verification where queue = 'profiles'"
						+ " and competitor_id = (select id from competitor where member_number = ?)")
				.param(ME).query(Long.class).single();
	}

	/** The text as a JSON value, quoted, with every space turned into a zero byte. */
	private static String withZeroBytes(String text) {
		return "\"" + text.replace(" ", "\\u0000") + "\"";
	}

	/** The same as a plain quoted string, which is what an ordinary request carries. */
	private static String plainly(String text) {
		return "\"" + text + "\"";
	}

	/**
	 * @param jsonBio the value for {@code bio} AS JSON, written out rather than built from
	 *                {@code MeWriteApi.Change}: the zero byte has to reach the body as an
	 *                escape a reader decodes, and a writer would escape it again. {@code
	 *                "null"} is the member sending no text at all
	 */
	private MockHttpServletResponse changing(String jsonBio, boolean hidden) throws Exception {
		return http.perform(put("/api/me").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"bio\": " + jsonBio + ", \"profileHidden\": " + hidden + "}")
						.cookie(new Cookie(SessionCookie.NAME, session.secret())))
				.andReturn().getResponse();
	}
}
