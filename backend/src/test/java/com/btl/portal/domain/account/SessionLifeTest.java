package com.btl.portal.domain.account;

import com.btl.portal.domain.account.SessionLife.Session;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** How long a session lives, and when its life is pushed forward. */
class SessionLifeTest {

	private static final Instant NOW = Instant.parse("2027-06-15T10:00:00Z");

	/**
	 * A session used a moment ago and good for another month.
	 *
	 * <p>The two moments are deliberately unrelated to each other: the end is not
	 * thirty days from the last use here, so a rule reading one where it means the
	 * other answers differently.
	 */
	private static Session fresh() {
		return new Session(NOW.minusSeconds(60), NOW.plus(SessionLife.LASTS).minusSeconds(600));
	}

	@Test
	void aSessionWithTimeLeftStillOpensThings() {
		assertThat(SessionLife.stillOpen(fresh(), NOW)).isTrue();
	}

	/**
	 * And the moment it runs out, it is over.
	 *
	 * <p>The boundary belongs to the server: unlike a lock somebody is waiting out,
	 * one more moment of a session buys nobody anything. Both sides, because a
	 * comparison written the other way round is right on one of them.
	 */
	@Test
	void theMomentItRunsOutItIsOver() {
		assertThat(SessionLife.stillOpen(new Session(NOW.minusSeconds(60), NOW.plusMillis(1)), NOW))
				.isTrue();
		assertThat(SessionLife.stillOpen(new Session(NOW.minusSeconds(60), NOW), NOW))
				.as("a session went on opening things past its own end")
				.isFalse();
	}

	/**
	 * A USE IS WRITTEN DOWN ONCE A DAY, NOT ONCE A CLICK.
	 *
	 * <p>Both sides of the boundary. Renewing on every request turns every read of
	 * the portal into a write; renewing once a day costs a session at most one day
	 * of the thirty, and only for somebody who comes back on the very last day.
	 */
	@Test
	void aUseIsWrittenDownOnceADayNotOnceAClick() {
		assertThat(SessionLife.worthRenewing(
				new Session(NOW.minus(SessionLife.RENEW_AFTER).plusMillis(1), NOW.plusSeconds(600)), NOW))
				.as("a session was written again for a click a moment after the last one")
				.isFalse();

		assertThat(SessionLife.worthRenewing(
				new Session(NOW.minus(SessionLife.RENEW_AFTER), NOW.plusSeconds(600)), NOW))
				.isTrue();
	}

	/**
	 * A session that is over is not renewed.
	 *
	 * <p>It is taken away instead, and the difference matters: a dead session whose
	 * last use is old enough answers yes to "has it been a day" and must still
	 * answer no here, or a request made a year late would bring it back to life.
	 */
	@Test
	void aSessionThatIsOverIsNotRenewed() {
		assertThat(SessionLife.worthRenewing(
				new Session(NOW.minusSeconds(31_536_000L), NOW.minusSeconds(1)), NOW))
				.as("a request a year late brought a dead session back")
				.isFalse();
	}

	/**
	 * RENEWING COUNTS FROM NOW, NOT FROM WHERE THE SESSION ENDED.
	 *
	 * <p>The fixture's end is deliberately not thirty days from its last use, so the
	 * two readings give different answers. Counted from the old end a session used
	 * on its last day would live for ever in thirty day steps and a session used
	 * early would be cut short; counted from now, the rule is the one sentence it is
	 * meant to be.
	 */
	@Test
	void renewingCountsFromNow() {
		assertThat(SessionLife.renewedUntil(NOW))
				.isEqualTo(NOW.plus(SessionLife.LASTS))
				.as("renewing counted from the old end rather than from this moment")
				.isNotEqualTo(fresh().expiresAt().plus(SessionLife.LASTS));
	}

	@Test
	void whatIsNotThereIsRefusedByName() {
		assertThatThrownBy(() -> SessionLife.stillOpen(null, NOW))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("session");
		assertThatThrownBy(() -> SessionLife.stillOpen(fresh(), null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("now");
		assertThatThrownBy(() -> SessionLife.worthRenewing(null, NOW))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("session");
		assertThatThrownBy(() -> SessionLife.worthRenewing(fresh(), null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("now");
		assertThatThrownBy(() -> SessionLife.renewedUntil(null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("now");
		assertThatThrownBy(() -> new Session(null, NOW))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("lastUsedAt");
		assertThatThrownBy(() -> new Session(NOW, null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("expiresAt");
	}

	/** Thirty days is what the schema's own default says, and the two are written in
	 *  one place each, so this is where they are put beside each other. */
	@Test
	void thirtyDaysIsWhatTheSchemaSays() {
		assertThat(SessionLife.LASTS.toDays()).isEqualTo(30);
		assertThat(SessionLife.RENEW_AFTER).isLessThan(SessionLife.LASTS);
	}
}
