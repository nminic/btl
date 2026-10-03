package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.Future;

/**
 * HOW MANY REQUESTS ARE STOPPED BEHIND A ROW THIS TEST IS HOLDING, asked of the lock manager.
 *
 * <p><b>One home for a question three files ask.</b> {@code VerificationDecisionConcurrencyTest}
 * wrote it first, as two private methods, for its two forced cases; {@code ATextSentTwiceAtOnceTest}
 * and {@code FreeingTwiceAtOneInstantTest} ask exactly the same thing of different rows. The
 * precedent's own note said why there must not be copies: „they are one question - are both
 * requests now stopped inside the database by the row this connection is holding - and two copies
 * of it would be free to drift apart while both went on looking green". So the question moved here
 * whole, with its floors, and the precedent calls it like everybody else.
 *
 * <p><b>Asked on the HOLDING connection, and nowhere else.</b> Both methods take the
 * {@link JdbcClient} the case is holding its row through, and must be called from inside the
 * transaction that took the lock: {@code pg_backend_pid()} is the root of the count, so asked over
 * any other connection the answer is about somebody else's backend.
 *
 * <p><b>The floor under it is in the cases themselves, and every caller carries it</b>: each asserts
 * that {@link #count} answers {@code 0} with the row locked and nothing submitted yet, so a predicate
 * stuck at two fails before the race begins. Two mutations say the rest is load-bearing rather than
 * decorative: rooted at a pid that is not the holder's, and cut to a single level, the wait below
 * times out in every forced case.
 */
final class BlockedBehindThisHold {

	private BlockedBehindThisHold() {
	}

	/**
	 * HOW MANY BACKENDS ARE STOPPED BY THE LOCK <b>THIS CONNECTION</b> IS HOLDING, asked of the
	 * lock manager itself rather than read off anybody's state.
	 *
	 * <p><b>Of this connection, and that word is the whole of it.</b> One Testcontainers
	 * database is shared by the whole suite, so a count of every backend with {@code
	 * wait_event_type = 'Lock'} is satisfied by any other context blocked on anything at all -
	 * and the sentence the forced cases assert, that the two requests they submitted are stopped
	 * behind the row they locked, would then be true about somebody else's backends.
	 * {@code pg_blocking_pids} answers who is blocking whom, so rooting the set at {@code
	 * pg_backend_pid()} lets nothing in that this connection is not the reason for.
	 *
	 * <p><b>RECURSIVE, because Postgres queues the SECOND waiter behind the FIRST and not
	 * behind the holder.</b> Measured 21.09.2026 on this same container: of the two backends
	 * genuinely stopped behind a held row, one waits on a {@code transactionid} - this
	 * connection's - and the other on a {@code tuple} the first waiter already holds. Rooted at
	 * this pid and read one level deep the count is 1 and the wait below would time out on a
	 * pair that had arrived. The same closure counts a request that waits on ANOTHER REQUEST
	 * rather than on the held row, whatever statement makes it wait, so a case does not have to
	 * know which of its two requests stops on what. The closure is the shape of the queue rather
	 * than a guess at its depth: whatever chain leads back here is counted, and nothing else can.
	 *
	 * <p><b>THE VIEW IS TAKEN AFRESH ON EVERY ASK, and the first line of the method is what makes
	 * the rest of it true.</b> {@code pg_stat_activity} is read once per TRANSACTION: the first
	 * statement that touches it freezes the list of backends and what each one says about itself,
	 * and every later statement of that transaction is answered from the frozen copy. This count
	 * always runs inside the transaction that holds the row, so without {@code
	 * pg_stat_clear_snapshot()} it sees only the backends that already stood there at its FIRST
	 * call, the floor each caller asserts before anything is submitted. A request that needs a
	 * connection the pool has not opened yet is served by a backend born AFTER that call, which no
	 * later call can list, and the lock manager is asked about the frozen pids only, so it is
	 * never asked about that one. The count then stays short for as long as anybody waits.
	 * Measured 03.10.2026 on {@code postgres:18.6}: a transaction that reads the view, has a new
	 * connection opened beside it and reads again lists the same ten backends twice; after {@code
	 * pg_stat_clear_snapshot()} it lists eleven, and so does a statement outside any transaction.
	 *
	 * <p><b>That, and not a deadline that was too short, is what failed CI over and over on
	 * 03.10.2026</b>, every time in {@code FreeingTwiceAtOneInstantTest}: the one case whose
	 * context, and so whose pool, is built fresh, and which therefore starts its first race while
	 * the pool is still opening connections. Raising the ten seconds would have made the same
	 * failure last longer. Reproduced by emptying the pool before every round of the same race:
	 * without the line the first round never sees the second request, and with it forty rounds in
	 * a row take about 130 ms each. {@code BlockedBehindThisHoldTest} holds the line in place with
	 * two backends that cannot have existed at the first count.
	 *
	 * <p><b>Nothing is read off {@code state} or {@code query}, and the frozen copy is the reason,
	 * not a quirk of the driver.</b> A backend that was idle when the transaction first read the
	 * view and blocked on the row afterwards is listed as {@code idle}, with the text of its
	 * connection's setup statement as its {@code query} and {@code Lock} as its wait event, all in
	 * one row: the first two come from the copy and the third is current. Until 03.10.2026 that
	 * row was put down to PgJDBC's extended protocol. Measured that day, the same two backends
	 * read from outside any transaction say {@code active} and carry the statement they are
	 * blocked on. A condition written against {@code state} or {@code query} is therefore wrong
	 * in exactly the way the count was, and the lock manager is the one source with no frozen
	 * copy in front of it.
	 *
	 * <p><b>AND THE LIMIT, measured 22.09.2026 rather than argued.</b> Put the old seed back -
	 * every backend with {@code wait_event_type = 'Lock'} that is not this one - and the forced
	 * cases stay GREEN, because in a run of one class alone the only backends blocked anywhere
	 * are the two it submitted itself. So no case can tell the two predicates apart, and nothing
	 * here should be read as saying it can. What the rooted form buys is measured somewhere
	 * else and is worth writing down: with the root swapped for a pid that exists nowhere,
	 * {@code pg_stat_activity} at the moment of the timeout held two backends waiting on
	 * {@code Lock} whose pid was not this connection's. The old form counts exactly those two
	 * whoever they belong to, and in the full suite against one shared container they will one
	 * day belong to somebody else.
	 *
	 * @param holding the client the case took its lock through, called inside that transaction
	 */
	static int count(JdbcClient holding) {
		holding.sql("select pg_stat_clear_snapshot()::text").query(String.class).single();

		return holding.sql("with recursive behind_this_hold(pid) as ("
						+ " select a.pid from pg_stat_activity a"
						+ " where pg_backend_pid() = any(pg_blocking_pids(a.pid))"
						+ " union"
						+ " select a.pid from pg_stat_activity a, behind_this_hold b"
						+ " where b.pid = any(pg_blocking_pids(a.pid)))"
						+ " select count(*) from behind_this_hold")
				.query(Integer.class).single();
	}

	/**
	 * Polled rather than assumed, the same discipline {@code RegistrationOverRealHttpTest}
	 * already applies to {@code pg_stat_activity}: a fixed sleep would either run too short on
	 * a loaded machine and release the lock before both requests arrive - the very flakiness
	 * the forced cases exist to remove - or run so long it slows the suite for nothing.
	 *
	 * <p>On a timeout the whole of {@code pg_stat_activity} and the state of every future goes
	 * into the message, so a case that did not get its two requests queued says where they
	 * were instead of merely that they were not there.
	 *
	 * @param holding   the client the case took its lock through, called inside that transaction
	 * @param submitted the two requests, for the message a timeout writes
	 */
	static void untilBothArrive(JdbcClient holding, List<? extends Future<?>> submitted)
			throws InterruptedException {

		Instant deadline = Instant.now().plusSeconds(10);

		while (count(holding) < 2) {
			if (Instant.now().isAfter(deadline)) {
				List<String> snapshot = holding.sql("select pid || ' ' || state || ' ' || coalesce("
								+ "wait_event_type, '-') || ' ' || coalesce(wait_event, '-')"
								+ " || ' blocked_by=' || pg_blocking_pids(pid)::text || ' | '"
								+ " || coalesce(query, '-') from pg_stat_activity"
								+ " where datname = current_database()")
						.query(String.class).list();
				List<String> futureState = submitted.stream()
						.map(f -> "done=" + f.isDone() + " cancelled=" + f.isCancelled())
						.toList();

				throw new IllegalStateException(
						"both requests should have been queued behind the held row lock within"
								+ " ten seconds, and the lock manager never showed two behind this"
								+ " connection. Futures: " + futureState + " Snapshot: " + snapshot);
			}

			Thread.sleep(20);
		}
	}
}
