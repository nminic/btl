package com.btl.portal.domain.account;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

/**
 * How long a session lives, and when its life is pushed forward.
 *
 * <p>V18 says the rule in one line: a session lasts THIRTY DAYS and renews on
 * use. The first half is a column default; the second is not in the schema at
 * all, because "renews" is something that happens on a request and a column
 * holds a moment.
 */
public final class SessionLife {

	/** Thirty days from the last time it was used (owner, 11.09.2026). */
	public static final Duration LASTS = Duration.ofDays(30);

	/**
	 * How stale the last use has to be before the row is written again.
	 *
	 * <p><b>Not zero, and that is a decision with a cost on both sides.</b>
	 * Renewing on every request means a write on every request: for a member
	 * clicking through the calendar that is a row rewritten twenty times a minute,
	 * and it turns every read of the portal into a write on the database.
	 *
	 * <p>Renewing once a day instead means a session can be at most one day older
	 * than it looks - somebody who last used the portal twenty-nine days and
	 * twenty-three hours ago is turned away an hour early. That is the whole cost,
	 * it falls on the rarest case there is, and it buys back one write per member
	 * per day instead of one per click.
	 */
	public static final Duration RENEW_AFTER = Duration.ofDays(1);

	private SessionLife() {
	}

	/** A session as this needs to see it. */
	public record Session(Instant lastUsedAt, Instant expiresAt) {

		public Session {
			Objects.requireNonNull(lastUsedAt, "lastUsedAt");
			Objects.requireNonNull(expiresAt, "expiresAt");
		}
	}

	/**
	 * Whether this session still opens anything.
	 *
	 * <p>The boundary belongs to the server: at the very moment it expires it is
	 * over. A session is not something somebody is waiting out, and one more moment
	 * of it buys nobody anything.
	 */
	public static boolean stillOpen(Session session, Instant now) {
		Objects.requireNonNull(session, "session");
		Objects.requireNonNull(now, "now");

		return now.isBefore(session.expiresAt());
	}

	/**
	 * Whether this use is worth writing down.
	 *
	 * <p>Asked of a session that is still open; a dead one is not renewed, it is
	 * taken away.
	 */
	public static boolean worthRenewing(Session session, Instant now) {
		Objects.requireNonNull(session, "session");
		Objects.requireNonNull(now, "now");

		return stillOpen(session, now)
				&& !now.isBefore(session.lastUsedAt().plus(RENEW_AFTER));
	}

	/**
	 * When a session renewed now would run out.
	 *
	 * <p>Thirty days from THIS moment and not from what the row held: renewing from
	 * the old end would let a session live for ever in thirty day steps only if it
	 * were used on the last day, and would shorten it otherwise. Counted from now,
	 * the rule is the one sentence it is meant to be.
	 */
	public static Instant renewedUntil(Instant now) {
		Objects.requireNonNull(now, "now");

		return now.plus(LASTS);
	}
}
