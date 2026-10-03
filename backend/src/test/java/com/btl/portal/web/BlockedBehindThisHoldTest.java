package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE COUNT SEES A BACKEND THAT DID NOT EXIST WHEN IT WAS FIRST ASKED.
 *
 * <p>{@link BlockedBehindThisHold#count} reads {@code pg_stat_activity} from inside the
 * transaction that holds a row, and that view is frozen at the first read of a transaction. The
 * cases that ask the question assert that the answer is nought and only then submit their
 * requests, so every backend a request is served by must have existed at that first read, which
 * is true while the pool is full and false on the run where it is not: the CI attempts of
 * 03.10.2026 that failed lost ten seconds each to it, in the one case whose context is built
 * fresh. No case that goes through the pool can make that run happen on purpose, because it does
 * not decide how many connections the pool has opened. This one does, by giving its two waiters
 * connections of their own.
 *
 * <p><b>THE PREMISE IS ASSERTED AND NOT LEFT TO THE ORDER OF THE LINES.</b> The pids of the two
 * waiters are read and compared with the ones the view held at the first count, so a later change
 * that handed the waiters connections that already stood there would fail here instead of
 * leaving a case that measures nothing.
 *
 * <p><b>Shares the context of the cases that call the helper</b>, with the same three annotations
 * and nothing of its own, so it costs no container. The row it holds is one the migrations seed
 * and no case changes; the waiters only read it {@code FOR UPDATE} and commit nothing.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class BlockedBehindThisHoldTest {

	private static final String THE_HELD_ROW = "select 1 from role where code = 'moderator' for update";

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate holdingTheRow;

	@Autowired
	private PostgreSQLContainer postgres;

	@Test
	void twoBackendsBornAfterTheFirstCountAreCountedAllTheSame() throws Exception {
		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<Long>> submitted = new ArrayList<>();
		List<Long> theirPids = new CopyOnWriteArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql(THE_HELD_ROW).query(Integer.class).single();

				assertThat(BlockedBehindThisHold.count(db))
						.as("the row is locked and nobody has been sent after it yet, so a count that is"
								+ " not nought is counting something other than the two backends below")
						.isZero();

				/* THE VIEW THE COUNT ABOVE JUST TOOK, read from the copy it froze: nothing between
				   the two statements clears it. */
				List<Long> standingAtTheFirstCount = db.sql("select pid from pg_stat_activity"
								+ " where datname = current_database()")
						.query(Long.class).list();

				Callable<Long> aBackendOfItsOwn = () -> waitingOnTheRowFromANewConnection(theirPids);

				submitted.add(pool.submit(aBackendOfItsOwn));
				submitted.add(pool.submit(aBackendOfItsOwn));

				try {
					BlockedBehindThisHold.untilBothArrive(db, submitted);
				} catch (InterruptedException e) {
					throw new IllegalStateException(e);
				}

				assertThat(theirPids)
						.as("the two waiters were already in the view the first count took, so this case"
								+ " no longer measures a backend that did not exist when it was first asked")
						.hasSize(2)
						.doesNotContainAnyElementsOf(standingAtTheFirstCount);

				return null;
			});

			assertThat(List.of(submitted.get(0).get(30, TimeUnit.SECONDS),
					submitted.get(1).get(30, TimeUnit.SECONDS)))
					.as("both waiters were let through once the row was released")
					.containsExactlyInAnyOrderElementsOf(theirPids);
		} finally {
			pool.shutdownNow();
		}
	}

	/**
	 * A CONNECTION OPENED BY HAND, which is the only way to be sure the backend behind it is new:
	 * the pool hands out whatever it already has and opens another only when it must.
	 *
	 * @param pids where it writes its own pid before it blocks, so the case can say which backends
	 *             it was waiting for
	 */
	private Long waitingOnTheRowFromANewConnection(List<Long> pids) throws SQLException {
		try (Connection own = DriverManager.getConnection(postgres.getJdbcUrl(), postgres.getUsername(),
				postgres.getPassword());
				Statement statement = own.createStatement()) {

			long pid;

			try (ResultSet asked = statement.executeQuery("select pg_backend_pid()")) {
				asked.next();
				pid = asked.getLong(1);
			}

			pids.add(pid);

			statement.execute(THE_HELD_ROW);

			return pid;
		}
	}
}
