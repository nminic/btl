package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ONE OPEN TRANSACTION OF ITS OWN, FOR A CASE THAT NEEDS SEVERAL AT ONCE.
 *
 * <p>{@code ARatingSentTwiceAtOnceTest} and its kin hold ONE row through a {@code TransactionTemplate},
 * whose connection is bound to the test's thread, so a second hold on the same thread would be the same
 * transaction. A case that must stop a request at one lock, let it on to the next and stop it there
 * again needs a holder per lock, each with a connection that is its own and commits when the case says.
 * That is all this class is: a connection with auto-commit off, a client on it, and the two moments the
 * case controls ({@link #commit()} and, if the case ends first, the rollback of {@link #close()}).
 *
 * <p><b>The client is the holding connection, and that is the point.</b> {@link BlockedBehindThisHold}
 * roots its count at {@code pg_backend_pid()}, so it has to be asked over the connection that holds the
 * row: {@link #behind()} does, and {@link #untilBehind} polls it.
 */
final class AHeldTransaction implements AutoCloseable {

	private final Connection connection;

	private final JdbcClient db;

	private boolean open = true;

	AHeldTransaction(DataSource pool) throws SQLException {
		this.connection = pool.getConnection();
		this.connection.setAutoCommit(false);
		this.db = JdbcClient.create(new SingleConnectionDataSource(connection, true));
	}

	/** The client whose statements are this transaction's: the lock is taken and held through it. */
	JdbcClient db() {
		return db;
	}

	/** Everything this transaction did becomes visible, and every lock it held is let go. */
	void commit() throws SQLException {
		connection.commit();
		open = false;
	}

	/** How many backends stand behind what this transaction holds, the whole queue and not one level. */
	int behind() {
		return BlockedBehindThisHold.count(db);
	}

	/**
	 * Waits until at least this many requests stand behind this transaction, or fails the case saying how
	 * many did and where the others were. Polled and not slept: a fixed wait is either too short on a
	 * loaded machine or too long for nothing.
	 *
	 * @param requests the requests the case has sent, for the message a timeout writes
	 */
	void untilBehind(int expected, List<? extends Future<?>> requests) throws InterruptedException {
		Instant deadline = Instant.now().plusSeconds(15);

		while (behind() < expected && Instant.now().isBefore(deadline)
				&& requests.stream().noneMatch(Future::isDone)) {
			Thread.sleep(20);
		}

		assertThat(behind())
				.as("requests stopped behind the lock this transaction holds (futures done: "
						+ requests.stream().map(Future::isDone).toList() + ")")
				.isGreaterThanOrEqualTo(expected);
	}

	@Override
	public void close() throws SQLException {
		try {
			if (open) {
				connection.rollback();
			}
		} finally {
			connection.close();
		}
	}
}
