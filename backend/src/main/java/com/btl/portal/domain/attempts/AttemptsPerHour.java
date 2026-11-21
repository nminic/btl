package com.btl.portal.domain.attempts;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

/**
 * HOW MANY TIMES ONE KEY MAY KNOCK IN AN HOUR, and how long it waits when it has knocked too often.
 *
 * <p>Owner, 21.11.2026 (ADL, „Ograničenje broja pokušaja: najviše 5 registracija sa jedne IP adrese na
 * sat, i najviše 3 ponovna slanja poruke za potvrdu po jednoj adresi na sat."), and the same three an
 * hour for asking for a new password, decided the same day. The key is whatever the route counts by:
 * a network for registering, an e-mail address for the two letters. This class does not know which;
 * it only counts.
 *
 * <p><b>A sliding hour, not a clock hour.</b> An attempt counts for exactly one hour from the moment it
 * was let in and not a moment longer: at {@code at + 1h} it no longer counts. So the wait a refused
 * caller is told is the time until the OLDEST attempt still counting runs out, which is at most an
 * hour and usually less. A clock hour would let ten through in two minutes across a full hour.
 *
 * <p><b>Only an attempt that was let in is remembered.</b> A refused one is not, so somebody who keeps
 * pressing while refused does not push his own wait further out; the hour runs from what got through.
 *
 * <p><b>IT LIVES IN MEMORY, AND A RESTART FORGETS IT.</b> Owner's choice, 21.11.2026: no new personal
 * datum in the database and no change to the published privacy policy. The price is written here and
 * in the pull request: every deploy of the backend starts every count from nought, so somebody who
 * knows when the portal is deployed gets a fresh allowance each time. One backend process serves the
 * portal, so one map is the whole truth while it runs.
 *
 * <p><b>And it remembers at most {@code mostRemembered} keys</b>, the one touched longest ago leaving
 * first. Without a ceiling a loop of letters to made-up addresses would grow the map for an hour
 * without bound; with it, the price is that a caller who brings that many fresh keys within the hour
 * pushes the oldest counts out. That is a hundred thousand requests in an hour, which the relay and
 * the proxy notice long before this map does.
 *
 * <p>Thread safe by being synchronized as a whole: every call is a few operations on one small deque.
 */
public final class AttemptsPerHour {

	/** How long one attempt counts. */
	public static final Duration THE_WINDOW = Duration.ofHours(1);

	private final int most;

	private final Map<String, Deque<Instant>> letIn;

	/**
	 * @param most           how many attempts one key is let in within an hour
	 * @param mostRemembered how many keys are kept at once, the one touched longest ago leaving first
	 */
	public AttemptsPerHour(int most, int mostRemembered) {
		if (most < 1) {
			throw new IllegalArgumentException("an allowance of " + most + " lets nobody in at all");
		}

		if (mostRemembered < 1) {
			throw new IllegalArgumentException("remembering " + mostRemembered + " keys counts nothing");
		}

		this.most = most;
		this.letIn = new LinkedHashMap<>(16, 0.75f, true) {
			@Override
			protected boolean removeEldestEntry(Map.Entry<String, Deque<Instant>> eldest) {
				return size() > mostRemembered;
			}
		};
	}

	/**
	 * One attempt by {@code key} at {@code now}.
	 *
	 * @return empty when it is let in, and then it is counted; otherwise how long until the oldest
	 *         attempt still counting runs out, and then nothing is counted
	 */
	public synchronized Optional<Duration> knock(String key, Instant now) {
		Deque<Instant> attempts = letIn.computeIfAbsent(key, nobody -> new ArrayDeque<>());

		while (!attempts.isEmpty() && !now.isBefore(attempts.peekFirst().plus(THE_WINDOW))) {
			attempts.removeFirst();
		}

		if (attempts.size() >= most) {
			return Optional.of(Duration.between(now, attempts.peekFirst().plus(THE_WINDOW)));
		}

		attempts.addLast(now);

		return Optional.empty();
	}

}
