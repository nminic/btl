package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.datasource.DataSourceUtils;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.sql.Statement;
import java.util.SortedSet;
import java.util.TreeSet;
import java.util.function.Predicate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE CHARACTERS A {@code text} CANNOT HOLD ARE THE CHARACTERS THE READER OF A BODY REFUSES, and
 * PostgreSQL is the one asked.
 *
 * <p>{@code NoTextHoldsAZero} refuses a zero character where a body is read, and says in its
 * own words that it does so because {@code text} cannot hold one. A sentence about what a
 * database does is a sentence that can be wrong, and it can be wrong in two directions: the
 * database may refuse something more than the reader does (a request that reaches a statement and
 * comes back a 500, which is the fault this whole rule exists to prevent), or the reader may refuse
 * something more than the database (a person turned away for nothing). So the database is asked
 * about every character there is, and the reader is asked about the same, and the two answers are
 * compared as sets. The shape is {@code WhatAnAddressLooksLikeMatchesTheSchemaTest}'s and
 * {@code MemberNumberMatchesTheSchemaTest}'s, in this same package, and for the same reason:
 * comparing two written rules is reading, and asking is measuring.
 *
 * <p><b>Every code point, and not a list of suspects.</b> From {@code U+0000} to
 * {@code U+10FFFF}, less the 2,048 surrogates, which are not characters and have no text to ask
 * about. A character is asked about in a range, and a range the database takes is settled in one
 * statement; a range it refuses is halved until the characters that cause it are single. So the
 * cost is one statement when the answer is „none" and about forty when it is one character, and the
 * answer is the set of every character refused and not a verdict about a sample. A list of
 * characters written here would be a list whose floor is another list, and „a list written from
 * memory is a list that is short" is what {@code outsideLink.ts} says about the same kind of
 * sweep on the other side of the portal.
 *
 * <p><b>The database is asked the way the portal asks it.</b> An {@code insert} of a bound
 * parameter into a column of type {@code text}, on the connection of the test's own transaction,
 * and read back: a character the database takes but changes would be neither taken nor refused, and
 * is named as such. Each attempt runs behind a savepoint, because in PostgreSQL an error aborts the
 * whole transaction and the next attempt would otherwise be refused for that reason and not its
 * own. Only the error the server gives for a byte that is not text (SQLSTATE 22021) counts as a
 * refusal; a lost connection or a full disk is a failure of this test and is thrown as one.
 *
 * <p><b>The reader is asked the way the portal reads.</b> A body is read by the application's own
 * mapper, so that is the one asked, with the text as a JSON string - written by the same mapper,
 * which escapes a control character the way a browser does, so the zero reaches the reader as the
 * escape the portal's own forms would have produced and not as the raw byte, which is a syntax
 * error of its own and measures nothing.
 *
 * <p><b>What this does and does not say.</b> It pins that the set is exactly {@code {U+0000}}: the
 * day the database is upgraded to a version that refuses one more, or the reader is changed to
 * refuse one more, the two sets differ and this fails, and the failure names the character. It
 * does not say that a zero is the only way a text can fail to be stored - a text can also be too
 * long for an index, which is {@code NV-C}'s question and not this one's.
 */
class WhatTextCannotHoldIsWhatTheReaderRefusesTest extends DatabaseTest {

	@Autowired
	private ObjectMapper mapper;

	@Autowired
	private DataSource dataSource;

	private static final int FIRST_SURROGATE = Character.MIN_SURROGATE;

	private static final int LAST_SURROGATE = Character.MAX_SURROGATE;

	/** The name of the column the database is asked about, which exists for this test alone. */
	private static final String THE_TABLE = "the_text_this_test_asks_about";

	/** SQLSTATE 22021: the server refused the bytes because they are not characters of the encoding. */
	private static final String NOT_A_CHARACTER = "22021";

	/** The characters from {@code from} to {@code to}, both included, with the surrogates left out. */
	private static String textOf(int from, int to) {
		StringBuilder text = new StringBuilder();

		for (int point = from; point <= to; point++) {
			if (point < FIRST_SURROGATE || point > LAST_SURROGATE) {
				text.appendCodePoint(point);
			}
		}

		return text.toString();
	}

	/**
	 * EVERY CHARACTER A PREDICATE REFUSES, found by halving the range it refuses.
	 *
	 * <p>Relies on one property and states it: a text is refused exactly when one of its characters
	 * is, so a range that is taken contains no refused character and a range that is refused
	 * contains at least one. That is a fact about both sides here (the database checks the bytes of
	 * a text one character at a time, and the reader asks {@code indexOf}) and it is the reason a
	 * sweep of a million characters is a few dozen questions.
	 */
	private static SortedSet<Integer> refusedAmong(int from, int to, Predicate<String> refuses) {
		SortedSet<Integer> found = new TreeSet<>();
		String text = textOf(from, to);

		if (text.isEmpty() || !refuses.test(text)) {
			return found;
		}

		if (from == to) {
			found.add(from);

			return found;
		}

		int middle = from + (to - from) / 2;

		found.addAll(refusedAmong(from, middle, refuses));
		found.addAll(refusedAmong(middle + 1, to, refuses));

		return found;
	}

	/** The column the database is asked about, on the connection of the test, so the end of the test takes it away. */
	private static void theColumnTheDatabaseIsAskedAbout(Connection connection) throws SQLException {
		try (Statement make = connection.createStatement()) {
			make.execute("create temporary table " + THE_TABLE + " (t text not null)");
		}
	}

	/** Whether the reader of a body refuses this text, written to it as a JSON string. */
	private boolean theReaderRefuses(String text) {
		String document = mapper.writeValueAsString(text);

		try {
			String read = mapper.readValue(document, String.class);

			assertThat(read)
					.as("the reader took a text and handed back another, which is neither taking nor"
							+ " refusing it")
					.isEqualTo(text);

			return false;
		}
		catch (JacksonException refused) {
			return true;
		}
	}

	/** Whether a column of type text refuses this text, asked on the connection of the test. */
	private boolean theDatabaseRefuses(Connection connection, String text) throws SQLException {
		Savepoint before = connection.setSavepoint();

		try (PreparedStatement insert = connection.prepareStatement(
				"insert into " + THE_TABLE + " (t) values (?)")) {

			insert.setString(1, text);
			insert.executeUpdate();

			try (PreparedStatement read = connection.prepareStatement("select t from " + THE_TABLE);
					ResultSet rows = read.executeQuery()) {

				assertThat(rows.next()).as("the database took a text and kept no row").isTrue();
				assertThat(rows.getString(1))
						.as("the database took a text and handed back another, which is neither taking"
								+ " nor refusing it")
						.isEqualTo(text);
			}

			return false;
		}
		catch (SQLException refused) {
			if (!NOT_A_CHARACTER.equals(refused.getSQLState())) {
				throw refused;
			}

			return true;
		}
		finally {
			connection.rollback(before);
		}
	}

	/**
	 * THE SET OF CHARACTERS EACH SIDE REFUSES, AND THEY ARE THE SAME SET, AND IT IS THE ZERO.
	 *
	 * <p>Two assertions, and the second is the one that makes the first mean something: that the two
	 * sets agree could be true of two sets that are both empty (a database upgraded to hold a zero
	 * and a reader that no longer asks), or both wrong in the same way (a sweep that asked about the
	 * wrong range), so the database's set is also pinned to the one character the reader's Javadoc
	 * says it is.
	 */
	@Test
	void theDatabaseRefusesTheCharactersTheReaderRefusesAndThatIsTheZero() throws SQLException {
		Connection connection = DataSourceUtils.getConnection(dataSource);

		try {
			theColumnTheDatabaseIsAskedAbout(connection);

			SortedSet<Integer> refusedByTheDatabase = refusedAmong(0, Character.MAX_CODE_POINT, text -> {
				try {
					return theDatabaseRefuses(connection, text);
				}
				catch (SQLException lost) {
					throw new IllegalStateException("the database could not be asked: " + lost.getMessage(), lost);
				}
			});
			SortedSet<Integer> refusedByTheReader =
					refusedAmong(0, Character.MAX_CODE_POINT, this::theReaderRefuses);

			assertThat(refusedByTheDatabase)
					.as("the characters PostgreSQL refuses in a column of type text, by number. The"
							+ " reader of a body and its Javadoc say the zero and nothing else")
					.containsExactly(0);
			assertThat(refusedByTheReader)
					.as("the characters the reader of a body refuses are not the ones the database refuses"
							+ " (database: %s). A character in the first set and not the second is a person"
							+ " turned away for nothing; one in the second and not the first is a request that"
							+ " reaches a statement and comes back a 500", refusedByTheDatabase)
					.isEqualTo(refusedByTheDatabase);
		}
		finally {
			DataSourceUtils.releaseConnection(connection, dataSource);
		}
	}

	/**
	 * THE SWEEP CAN TELL: a text it must refuse and a text it must not, each asked of both sides on
	 * its own.
	 *
	 * <p>The case above would pass for two sides that refused everything or refused nothing if the
	 * halving were broken, and the pin to {@code {0}} would catch the first but not tell a broken
	 * halving from a database that really refuses only the zero. These four statements are the
	 * ones the sweep is built out of, asked directly.
	 */
	@Test
	void bothSidesRefuseTheZeroAloneAndInsideAnOrdinaryTextAndNeitherRefusesAnOrdinaryText()
			throws SQLException {

		Connection connection = DataSourceUtils.getConnection(dataSource);

		try {
			theColumnTheDatabaseIsAskedAbout(connection);

			String zero = String.valueOf((char) 0);

			assertThat(theDatabaseRefuses(connection, zero)).as("the database, the zero alone").isTrue();
			assertThat(theDatabaseRefuses(connection, "ab" + zero + "cd"))
					.as("the database, the zero inside ordinary words").isTrue();
			assertThat(theDatabaseRefuses(connection, "Ordinary words, a tab\t, a line\n and \u0110or\u0111e"))
					.as("the database, ordinary text").isFalse();

			assertThat(theReaderRefuses(zero)).as("the reader, the zero alone").isTrue();
			assertThat(theReaderRefuses("ab" + zero + "cd")).as("the reader, the zero inside ordinary words")
					.isTrue();
			assertThat(theReaderRefuses("Ordinary words, a tab\t, a line\n and \u0110or\u0111e"))
					.as("the reader, ordinary text").isFalse();
		}
		finally {
			DataSourceUtils.releaseConnection(connection, dataSource);
		}
	}
}
