package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
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

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/** Who the portal decides is asking, worked out from the cookie on every request. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class WhoIsAskingTest {

	private static final String MINE = "kopita@primer.rs";

	private static final String SOMEBODY_ELSE = "drugikopita@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private SecretToken mine;

	@BeforeEach
	void anAccountAndASessionForIt() {
		member(MINE, "competitor");
		member(SOMEBODY_ELSE, "moderator");
		mine = openFor(MINE, Instant.now(), Instant.now().plus(SessionLife.LASTS));
	}

	private void member(String email, String role) {
		db.sql("insert into account (email, role_id) values (?, (select id from role where code = ?))")
				.params(email, role).update();
	}

	private SecretToken openFor(String email, Instant lastUsed, Instant ends) {
		SecretToken session = SecretToken.fresh();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at, expires_at)"
						+ " values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(lastUsed.minus(Duration.ofDays(1))),
						Timestamp.from(lastUsed), Timestamp.from(ends))
				.update();

		return session;
	}

	private MockHttpServletResponse me(SecretToken carrying) throws Exception {
		var asked = get("/api/me");

		if (carrying != null) {
			asked = asked.cookie(new Cookie(SessionCookie.NAME, carrying.secret()));
		}

		return http.perform(asked).andReturn().getResponse();
	}

	private Instant endsFor(SecretToken session) {
		return db.sql("select expires_at from account_session where token_hash = ?")
				.param(session.hash()).query(Timestamp.class).single().toInstant();
	}

	private Instant lastUsedFor(SecretToken session) {
		return db.sql("select last_used_at from account_session where token_hash = ?")
				.param(session.hash()).query(Timestamp.class).single().toInstant();
	}

	/**
	 * A LIVE COOKIE MAKES THE REQUEST THAT MEMBER'S, and the answer says which
	 * member.
	 *
	 * <p>The role is checked against a second account holding a different one, so
	 * an answer that always said "competitor" would pass this and nothing else.
	 */
	@Test
	void aLiveCookieSaysWhoIsAsking() throws Exception {
		MockHttpServletResponse answer = me(mine);

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(answer.getContentAsString())
				.as("the portal did not say which member is asking")
				.contains("\"role\":\"competitor\"");

		assertThat(me(openFor(SOMEBODY_ELSE, Instant.now(), Instant.now().plus(SessionLife.LASTS)))
				.getContentAsString())
				.as("two members with different roles were answered the same way")
				.contains("\"role\":\"moderator\"");
	}

	/**
	 * EVERY WAY OF NOT BEING SIGNED IN IS 401, and not one of them is an error.
	 *
	 * <p>No cookie at all, a cookie nobody has, and a session that ended: three
	 * different states inside the filter and one answer out of the chain. The third
	 * is the one that would be missed by a filter that only asked whether the row
	 * exists.
	 */
	@Test
	void nobodySignedInIsNobody() throws Exception {
		SecretToken ended = openFor(MINE, Instant.now().minus(Duration.ofDays(40)),
				Instant.now().minus(Duration.ofDays(10)));

		assertThat(me(null).getStatus()).as("no cookie at all").isEqualTo(401);
		assertThat(me(SecretToken.fresh()).getStatus()).as("a cookie nobody has").isEqualTo(401);
		assertThat(me(ended).getStatus()).as("a session that ended weeks ago still opened the portal")
				.isEqualTo(401);

		/* CARRYING COOKIES, JUST NOT OURS. A browser sends everything it holds for
		   the host, and the portal will one day set something else - a chosen
		   language, a dismissed notice. Read as "the first cookie there is", every
		   one of those members would be signed out by a preference. */
		assertThat(http.perform(get("/api/me").cookie(new Cookie("jezik", "sr"),
						new Cookie("__Host-nesto-drugo", mine.secret())))
				.andReturn().getResponse().getStatus())
				.as("a cookie that is not ours was read as a session")
				.isEqualTo(401);

		/* And ours, emptied. A browser that has been told to forget the session sends
		   exactly this until it drops it, and hashing an empty string is a lookup
		   nobody should be paying for. */
		assertThat(http.perform(get("/api/me").cookie(new Cookie(SessionCookie.NAME, "")))
				.andReturn().getResponse().getStatus())
				.as("an emptied cookie was taken for a session")
				.isEqualTo(401);
	}

	/**
	 * A SESSION THAT HAS NOT BEEN USED TODAY IS MOVED FORWARD.
	 *
	 * <p>Both halves, because either one alone is a different bug: the end moves so
	 * a member who keeps coming back is not shown the door on the calendar, and the
	 * day of last use moves so the next request knows it has been counted.
	 */
	@Test
	void aSessionUsedAgainAfterADayIsMovedForward() throws Exception {
		SecretToken old = openFor(MINE, Instant.now().minus(SessionLife.RENEW_AFTER.plusHours(1)),
				Instant.now().plus(Duration.ofDays(2)));
		Instant endedBefore = endsFor(old);

		assertThat(me(old).getStatus()).isEqualTo(200);

		assertThat(endsFor(old)).as("the session was not given its full life back").isAfter(endedBefore);
		assertThat(lastUsedFor(old))
				.as("the day of last use did not move, so every request would write again")
				.isAfter(Instant.now().minus(Duration.ofMinutes(1)));
	}

	/**
	 * AND ONE USED A MINUTE AGO IS NOT WRITTEN TO AGAIN.
	 *
	 * <p>A member reading ten pages in a minute must not cost ten writes. Measured
	 * on the row rather than on the answer, because the answer is the same either
	 * way and that is exactly what makes this easy to get wrong.
	 */
	@Test
	void aSessionUsedAMinuteAgoIsLeftAlone() throws Exception {
		Instant justNow = Instant.now().minus(Duration.ofMinutes(1));
		SecretToken fresh = openFor(MINE, justNow, Instant.now().plus(Duration.ofDays(2)));
		Instant endedBefore = endsFor(fresh);

		assertThat(me(fresh).getStatus()).isEqualTo(200);

		assertThat(endsFor(fresh)).as("a session used a minute ago was written to again")
				.isEqualTo(endedBefore);
		assertThat(lastUsedFor(fresh)).isCloseTo(justNow, within(Duration.ofSeconds(2)));
	}

	/**
	 * AND ONE MEMBER'S REQUEST DOES NOT MOVE ANOTHER MEMBER'S SESSION.
	 *
	 * <p>The renewal names the session by its own id. Written against the account
	 * it would move every device that member has, and written against nothing at
	 * all it would move everybody's; both pass a case with one row.
	 */
	@Test
	void renewingOneSessionLeavesTheOthersWhereTheyWere() throws Exception {
		SecretToken myOtherDevice = openFor(MINE, Instant.now().minus(Duration.ofDays(3)),
				Instant.now().plus(Duration.ofDays(2)));
		SecretToken hers = openFor(SOMEBODY_ELSE, Instant.now().minus(Duration.ofDays(3)),
				Instant.now().plus(Duration.ofDays(2)));
		SecretToken asking = openFor(MINE, Instant.now().minus(Duration.ofDays(3)),
				Instant.now().plus(Duration.ofDays(2)));

		Instant otherDeviceEnded = endsFor(myOtherDevice);
		Instant hersEnded = endsFor(hers);

		assertThat(me(asking).getStatus()).isEqualTo(200);

		assertThat(endsFor(myOtherDevice))
				.as("asking on one device moved the member's session on another")
				.isEqualTo(otherDeviceEnded);
		assertThat(endsFor(hers))
				.as("one member asking moved another member's session")
				.isEqualTo(hersEnded);
	}

	private static org.assertj.core.data.TemporalUnitOffset within(Duration slack) {
		return new org.assertj.core.data.TemporalUnitWithinOffset(slack.toSeconds(),
				java.time.temporal.ChronoUnit.SECONDS);
	}
}
