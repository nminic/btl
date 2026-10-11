package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

/**
 * A FAILURE THAT ONLY THE DATABASE CAN CAUSE, MADE ON PURPOSE, AND MADE TO SAY THAT IT WENT OFF.
 *
 * <p><b>Why three cases need one.</b> {@code TeamProposalAndItsQueueRowAreOneThingTest} and
 * {@code TheSwitchAndTheTextAreOneThingTest} ask whether a write whose SECOND statement fails
 * takes the first with it, and {@code MeWriteApiTest} asks whether a conflict is answered before a
 * field the database would refuse is written. Each needs a request that passes everything the
 * route itself checks and then makes PostgreSQL fail. Until 10.10.2026 that request carried a zero
 * character, which {@code text} cannot hold; {@code NoTextHoldsAZero} now refuses a zero where a
 * body is read, so the second statement of a route can no longer be reached with one, and the
 * three cases would have been measuring a route that answers 400 at the door. They said so
 * themselves - „nothing is being measured" - which is the reason they were left to fail rather
 * than be skipped.
 *
 * <p><b>What replaces it is a trigger the case makes and takes away again.</b> A row whose chosen
 * column holds the marker is refused by the database, with a message that names this failure and no
 * other. Nothing in the route knows about it, and nothing about the route is stubbed: the request is
 * the one a member sends. The marker is an ordinary text, not blank and well under every length a
 * route allows, so it is never refused on the way in.
 *
 * <p><b>It proves that it went off, and the proof is the message and not the number of the answer.</b>
 * A lever that is set and never pulled is the commonest way for a case about a failure to measure
 * nothing: the write is then simply a success, or the route fails for a reason of its own and the
 * case is green about the wrong failure. {@link #wentOffIn} looks for this lever's own message among
 * the causes of what was thrown, so a case that asserts it is asserting that THIS failure, in THIS
 * statement, is what ended the request. It does not ask what the caller was told, for the reason
 * the three cases already give: that is a fact about MockMvc.
 *
 * <p><b>Taken away in a {@code finally}, and left alone where a transaction will do it.</b> A case
 * that commits its rows (the first two) must drop the trigger or the next class in the same
 * database meets it; a case inside a test-managed transaction made it inside that transaction, so
 * the end of the transaction takes it away, and a {@code drop} issued after the route's own failure
 * would be refused by a transaction that PostgreSQL has already aborted. {@link #close} tells the
 * two apart by asking whether a transaction is open.
 *
 * <p><b>The names it builds statements from are checked,</b> because they are put into DDL, which
 * takes no parameters: a table or a column that is not plain lower case, or a marker that is not
 * letters, digits and spaces, is refused before anything is sent. Every caller is a test; the check
 * is for the next one written in a hurry.
 */
final class AFailureOnlyTheDatabaseCanCause implements AutoCloseable {

	private static final AtomicInteger MADE = new AtomicInteger();

	private static final Pattern AN_IDENTIFIER = Pattern.compile("[a-z][a-z_]*");

	private static final Pattern A_PLAIN_MARKER = Pattern.compile("[A-Za-z0-9 ]+");

	private final JdbcClient db;

	private final String table;

	private final String function;

	private final String trigger;

	private final String says;

	private AFailureOnlyTheDatabaseCanCause(JdbcClient db, String table, String function,
			String trigger, String says) {
		this.db = db;
		this.table = table;
		this.function = function;
		this.trigger = trigger;
		this.says = says;
	}

	/**
	 * Makes the database refuse any row of {@code table} whose {@code column} holds exactly
	 * {@code marker}, on insert and on update.
	 */
	static AFailureOnlyTheDatabaseCanCause on(JdbcClient db, String table, String column,
			String marker) {

		if (!AN_IDENTIFIER.matcher(table).matches() || !AN_IDENTIFIER.matcher(column).matches()) {
			throw new IllegalArgumentException("only a plain lower case table and column may be"
					+ " put into a statement that takes no parameters: " + table + "." + column);
		}

		if (!A_PLAIN_MARKER.matcher(marker).matches()) {
			throw new IllegalArgumentException("a marker is letters, digits and spaces, and '"
					+ marker + "' is not");
		}

		int number = MADE.incrementAndGet();
		String suffix = number + "_" + Long.toString(System.nanoTime(), 36);
		String function = "a_failure_only_the_database_can_cause_" + suffix;
		String trigger = "a_failure_only_the_database_can_cause_on_" + table + "_" + suffix;
		String says = "A failure only the database can cause, number " + suffix;

		db.sql("create function " + function + "() returns trigger language plpgsql as $body$"
				+ " begin raise exception '" + says + "'; end $body$").update();
		db.sql("create trigger " + trigger + " before insert or update on " + table
				+ " for each row when (new." + column + " = '" + marker + "')"
				+ " execute function " + function + "()").update();

		return new AFailureOnlyTheDatabaseCanCause(db, table, function, trigger, says);
	}

	/**
	 * Whether this failure, and not some other, is among the causes of what was thrown.
	 *
	 * @param thrown what a request threw, or nothing where it threw nothing
	 */
	boolean wentOffIn(Throwable thrown) {
		for (Throwable cause = thrown; cause != null; cause = cause.getCause()) {
			if (cause.getMessage() != null && cause.getMessage().contains(says)) {
				return true;
			}
		}

		return false;
	}

	@Override
	public void close() {
		if (TransactionSynchronizationManager.isActualTransactionActive()) {
			return;
		}

		db.sql("drop trigger if exists " + trigger + " on " + table).update();
		db.sql("drop function if exists " + function + "()").update();
	}
}
