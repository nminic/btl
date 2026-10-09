package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.WhatAnAddressLooksLike;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.transaction.annotation.Transactional;

import java.sql.SQLException;
import java.util.List;
import java.util.Random;
import java.util.function.IntFunction;
import java.util.function.ToLongFunction;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * HOW MUCH TEXT A UNIQUE INDEX HOLDS, ASKED OF POSTGRESQL, AND THE REQUIREMENT THAT NO ROUTE
 * REFUSES AT A NUMBER ABOVE IT.
 *
 * <p>A unique index is a B-tree, and a B-tree page takes a key only up to about a third of its
 * size. A longer key is not truncated and not skipped: PostgreSQL answers {@code index row size
 * ... exceeds btree version 4 maximum ... for index "..."} (SQLSTATE 54000) and, being an
 * error, it aborts the transaction. Nothing in a shape rule says so, because a shape rule is
 * about what a text is made of, so a text of three thousand letters walks through
 * {@code league_slug_shape}, {@code account_email_shape} and {@code payment_reference_shape}
 * and meets the index at the {@code INSERT}. What the person typing it gets is a 500.
 *
 * <p>{@code WhatAnAddressLooksLike.MOST_AN_ADDRESS_CAN_BE},
 * {@code LeagueWriteApi.MOST_AN_ADDRESS_CAN_BE} and {@code PaymentApi.MOST_A_REFERENCE_CAN_BE}
 * are the three numbers that turn that 500 into the sentence each route already has for a value
 * that is not the right shape. This file is what keeps them honest, in the way ADL A45 asks for:
 * it does not compare the numbers with a number written down, it asks the database. For each of
 * the three indexes it inserts a real row, through the real table and the real constraints, and
 * finds by halving the interval the longest text the index keeps; it then requires the route's
 * number not to be above that.
 *
 * <p><b>The text that is measured cannot be compressed, and that is asserted rather than
 * hoped.</b> PostgreSQL compresses a long index key when that makes it markedly smaller (the
 * default of pglz asks for a saving of a quarter), so a repeated text goes in at a length that a
 * random one never reaches (see
 * {@link #aRepeatedTextIsKeptFarBeyondThatLimitWhichIsWhyTheBoundDoesNotFollowTheDatabase}). The
 * limit that matters for a bound is the worst case, the text no compression helps; the text here
 * is noise drawn from a fixed seed, so the measurement is the same on every run, and the row at
 * the limit is asked whether PostgreSQL compressed it ({@code pg_column_compression}). A probe
 * that came back compressed would be measuring a limit that depends on what was typed, and fails.
 *
 * <p><b>Measured 10.10.2026 on PostgreSQL 18.6 with an 8192 byte page:</b> 2692 characters of such
 * text go into each of the three, and 2693 do not (the message is {@code row size 2712 exceeds ...
 * maximum 2704}). The number is not written in any assertion below; it is what the search finds.
 *
 * <p><b>The probe is rolled back to a savepoint after every attempt</b>, whether the row went in or
 * not. A failed statement leaves a PostgreSQL transaction unable to answer anything else, and a
 * row that went in would collide with the next attempt (a payment is unique for a member and a
 * season). Only the refusal for the index's reason (SQLSTATE 54000) counts as "does not fit"; any
 * other failure is the probe being wrong and is thrown, because a search that read a check
 * constraint's refusal as the limit would report a limit that is not there.
 *
 * <p><b>WHAT THIS DOES NOT HOLD, and it is said here rather than left for a review to find.</b>
 * The list of keys is the keys that HAVE a bound and not the keys that NEED one, and the second
 * list is not in the catalogue: which unique indexes over text a route writes from typed input is
 * not something PostgreSQL can be asked, so there is no query that proves this list complete. It
 * was surveyed on 10.10.2026 by reading every statement in {@code main} that inserts into or
 * updates a table with a unique text key. Five are written from typed input: the three here, and
 * {@code team_slug_unique} and {@code btl_event_slug_unique}, which had no bound on that day. The
 * others hold a hash, a code or a number the portal generates, or reference data no route writes.
 * A key a route writes that is not on this list is a 500 waiting for a long enough text, and is
 * found by whoever writes the route; this class is where its number goes.
 *
 * <p>This class lives in {@code com.btl.portal.web} and not beside the rest of the schema floors in
 * {@code com.btl.portal.db}, for the reason {@code PaymentMethodsMatchTheSchemaTest} gives: two of the
 * numbers are package private, and moving them into the domain to reach them from there would be
 * moving production logic to suit a test.
 *
 * <p>The noise generators and {@link #answered} are package private because the route cases of this
 * package use them too, and they are here so that the one place which explains why the text must be
 * noise is also the one place that makes it.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class WhatAnIndexHoldsTest {

	/**
	 * The farthest a search looks for the limit. A text of noise this long must be refused by
	 * every key, and the search asserts that it is before it starts to halve.
	 */
	private static final int THE_FARTHEST_LOOKED = 8000;

	/**
	 * How many characters of one letter the repeated case writes: far beyond any limit, and small
	 * enough to be a request a person could make.
	 */
	private static final int A_HUNDRED_THOUSAND = 100_000;

	/** Fixed, so that the noise, and therefore the limit found with it, is the same on every run. */
	private static final long THE_SEED = 20261010L;

	static final String LETTERS_AND_DIGITS = "abcdefghijklmnopqrstuvwxyz0123456789";

	static final String DIGITS = "0123456789";

	/**
	 * EVERY CHARACTER AN ADDRESS MAY HAVE, in lower case. The widest alphabet is the hardest to
	 * compress, so it is the one the limit is measured with; the route cases use the narrower
	 * {@link #LETTERS_AND_DIGITS}, which only has to be long enough to reach the bound.
	 */
	private static final String EVERY_CHARACTER_OF_AN_ADDRESS =
			"abcdefghijklmnopqrstuvwxyz0123456789!#$%&'*+-/=?^_`{|}~.";

	@Autowired
	private JdbcClient db;

	/** The member a probe payment is booked for, written before any savepoint is taken. */
	private long payer;

	/**
	 * ONE INDEX, THE COLUMN IT IS OVER, THE NUMBER THE CODE REFUSES AT, AND THE WAY TO PUT A ROW
	 * IN THE TABLE WITH A GIVEN VALUE IN THAT COLUMN.
	 *
	 * @param shortest the shortest value the shape allows, which the search starts from and which
	 *                 must go in
	 * @param ofLength a value of exactly that many characters that the shape accepts and that
	 *                 cannot be compressed
	 * @param repeated a value of exactly that many characters that the shape accepts and that is
	 *                 one character repeated, which compresses to almost nothing
	 * @param keptBy   writes one row carrying the value and returns its key
	 */
	private record Key(String index, String table, String column, int bound, int shortest,
			IntFunction<String> ofLength, IntFunction<String> repeated,
			ToLongFunction<String> keptBy) {
	}

	/** What one attempt came to. */
	private record Attempt(boolean kept, String compression, String refusal) {
	}

	private List<Key> keys() {
		return List.of(
				new Key("account_email_unique", "account", "email",
						WhatAnAddressLooksLike.MOST_AN_ADDRESS_CAN_BE, 3,
						length -> "a@" + noise(EVERY_CHARACTER_OF_AN_ADDRESS, length - 2),
						length -> "a@" + "a".repeat(length - 2), this::anAccountAt),
				new Key("league_slug_unique", "league", "slug",
						LeagueWriteApi.MOST_AN_ADDRESS_CAN_BE, 1,
						WhatAnIndexHoldsTest::aSlugOf, length -> "a".repeat(length),
						this::aLeagueAt),
				new Key("payment_reference_unique", "payment", "reference",
						PaymentApi.MOST_A_REFERENCE_CAN_BE, 7,
						WhatAnIndexHoldsTest::aReferenceOf, length -> "7".repeat(length),
						this::aPaymentReferencedBy));
	}

	/* ------------------------------------------------------------------------ the noise */

	/**
	 * A TEXT OF THE LENGTH ASKED FOR THAT NO COMPRESSION HELPS, drawn from the alphabet given.
	 *
	 * <p>Every call starts the generator from the same seed, so a shorter text is the beginning of
	 * a longer one: the attempts of a search then differ in length and in nothing else.
	 */
	static String noise(String alphabet, int length) {
		Random random = new Random(THE_SEED);
		StringBuilder text = new StringBuilder(length);

		for (int at = 0; at < length; at++) {
			text.append(alphabet.charAt(random.nextInt(alphabet.length())));
		}

		return text.toString();
	}

	/** An address of electronic mail of exactly that many characters, made of letters and digits. */
	static String aMailAddressOf(int length) {
		return "a@" + noise(LETTERS_AND_DIGITS, length - 2);
	}

	/** A league's typed address of exactly that many characters, the shape its CHECK asks for. */
	static String aSlugOf(int length) {
		return noise(LETTERS_AND_DIGITS, length);
	}

	/** A payment reference of exactly that many digits. */
	static String aReferenceOf(int length) {
		return noise(DIGITS, length);
	}

	/** One request, in the shape a case can pass without having to catch what it throws. */
	@FunctionalInterface
	interface ARequest {

		MockHttpServletResponse send() throws Exception;
	}

	/**
	 * THE ANSWER TO A REQUEST, OR A FAILED ASSERTION IF THE ROUTE DID NOT ANSWER AT ALL.
	 *
	 * <p>A route that meets a database error it did not expect has no answer to give: under
	 * {@code MockMvc} the exception comes out of {@code perform} instead of becoming a 500. A case
	 * that let it through would end in an error with a stack trace, which says that something
	 * threw and not what was being claimed. This turns it into the claim: the route answered with
	 * a fault where a sentence was owed, and the message says what the database said.
	 */
	static MockHttpServletResponse answered(ARequest request) {
		try {
			return request.send();
		} catch (Exception fault) {
			Throwable root = fault;

			while (root.getCause() != null && root.getCause() != root) {
				root = root.getCause();
			}

			throw new AssertionError("the route answered with a fault and not with a sentence, "
					+ "which is what a value the index cannot hold becomes: " + root.getMessage(),
					fault);
		}
	}

	/* ----------------------------------------------------------------- the rows to probe with */

	private long anAccountAt(String address) {
		return db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Probni', 'Probic', ?,"
						+ " (select id from role where code = 'competitor')) returning id")
				.param(address).query(Long.class).single();
	}

	private long aLeagueAt(String address) {
		return db.sql("insert into league (slug, name, season, rules, prizes)"
						+ " values (?, 'Probna liga', 2027, '', '') returning id")
				.param(address).query(Long.class).single();
	}

	private long aPaymentReferencedBy(String reference) {
		return db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount,"
						+ " currency, fee, method, state) values"
						+ " (?, 2028, ?, (select id from price_row where key = 'early'),"
						+ " 35.00, 'EUR', 3.00, 'paypal', 'awaited') returning id")
				.params(payer, reference).query(Long.class).single();
	}

	@BeforeEach
	void aMemberWhoCanPay() {
		payer = db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season, first_season_2027, active,"
						+ " membership_basis, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (null, 'Probni', 'Platisa', 'M', date '1985-01-01',"
						+ " (select id from place order by rank limit 1), 2027, false, false,"
						+ " 'payment', '00112233445566aa', '', false, 'none', 'Otac', 'Ulica 9', 'L',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.query(Long.class).single();
	}

	/* ------------------------------------------------------------------------- the probing */

	/**
	 * WHETHER THE INDEX TAKES A TEXT OF THIS LENGTH, asked by writing it.
	 *
	 * <p>Rolled back to a savepoint whatever happens (see the head of this class), and the
	 * refusal is only the index's: SQLSTATE 54000 and a message that names the row size.
	 */
	private Attempt tryToKeep(Key key, String value) {
		db.sql("savepoint a_probe").update();

		try {
			long row = key.keptBy().applyAsLong(value);
			String compression = db.sql("select coalesce(pg_column_compression(" + key.column()
							+ ")::text, 'none') from " + key.table() + " where id = ?")
					.param(row).query(String.class).single();

			return new Attempt(true, compression, null);
		} catch (DataAccessException refused) {
			Throwable cause = refused.getMostSpecificCause();

			if (cause instanceof SQLException sql && "54000".equals(sql.getSQLState())
					&& sql.getMessage() != null && sql.getMessage().contains("index row size")) {

				return new Attempt(false, null, sql.getMessage());
			}

			throw refused;
		} finally {
			db.sql("rollback to savepoint a_probe").update();
		}
	}

	private Attempt tryToKeep(Key key, int length) {
		return tryToKeep(key, key.ofLength().apply(length));
	}

	/**
	 * THE LONGEST TEXT THE INDEX KEEPS, by halving the interval between one that goes in and one
	 * that does not.
	 *
	 * <p>Both ends are asserted before the search starts. If the shortest value the shape allows
	 * did not go in, the probe is writing a row the table refuses for another reason; if the
	 * farthest one did, either the index has no limit at all or the noise got compressed. In both
	 * cases the number below would be a number about something else.
	 */
	private int theMostItKeeps(Key key) {
		int kept = key.shortest();
		int refused = THE_FARTHEST_LOOKED;

		assertThat(tryToKeep(key, kept).kept())
				.as("%s did not take even the shortest value its shape allows (%d), so the probe"
						+ " writes a row the table refuses for another reason", key.index(), kept)
				.isTrue();
		assertThat(tryToKeep(key, refused).kept())
				.as("%s took %d characters of noise, so it has no limit that this search can find"
						+ " or the noise was compressed, and the number it would report is about"
						+ " something else", key.index(), refused)
				.isFalse();

		while (refused - kept > 1) {
			int middle = (kept + refused) / 2;

			if (tryToKeep(key, middle).kept()) {
				kept = middle;
			} else {
				refused = middle;
			}
		}

		return kept;
	}

	/* ---------------------------------------------------------------------------- the cases */

	/**
	 * THE INDEX IS STILL THE KIND OF INDEX THE LIMIT WAS MEASURED ON.
	 *
	 * <p>What is measured below is a unique B-tree over one text key, with nothing included and
	 * nothing left out of it. A second key column, an {@code INCLUDE}, or a partial predicate
	 * would each change how much of the third of a page is left for the text, and the number found
	 * for the old index would be a number about an index that is not there. Asked of the catalogue
	 * by the index's name, so that a migration that changes it fails this case before anything
	 * measured here is believed.
	 */
	@Test
	void everyIndexBoundedHereIsStillAUniqueBTreeOverOneTextKey() {
		for (Key key : keys()) {
			List<Object> found = db.sql("select ix.indisunique, am.amname, ix.indnkeyatts,"
							+ " ix.indnatts, ix.indpred is null, format_type(a.atttypid, a.atttypmod)"
							+ " from pg_index ix"
							+ " join pg_class i on i.oid = ix.indexrelid"
							+ " join pg_am am on am.oid = i.relam"
							+ " join pg_attribute a on a.attrelid = ix.indexrelid and a.attnum = 1"
							+ " where i.relname = ? and i.relnamespace ="
							+ " (select oid from pg_namespace where nspname = current_schema())")
					.param(key.index())
					.query((row, one) -> List.<Object>of(row.getBoolean(1), row.getString(2),
							row.getInt(3), row.getInt(4), row.getBoolean(5), row.getString(6)))
					.single();

			assertThat(found)
					.as("%s is no longer a unique btree over exactly one text key with no included"
							+ " column and no predicate, so the limit this file measures is not its"
							+ " limit any more", key.index())
					.containsExactly(true, "btree", 1, 1, true, "text");
		}
	}

	/**
	 * THE NUMBER EACH ROUTE REFUSES AT IS NOT ABOVE WHAT ITS INDEX KEEPS.
	 *
	 * <p>The limit is found for each index by writing rows, and three things are asserted about it
	 * beyond the comparison itself. The row at the limit was not compressed (a limit measured on
	 * text that compresses is a limit about the text), the first text above it is refused for the
	 * index's reason and not another, and the number of the route is positive, because a number of
	 * nought would satisfy a comparison with the limit and refuse every address there is.
	 *
	 * <p>The comparison is {@code <=} and not {@code <}: a route that refuses at exactly what the
	 * index holds is not wrong, it is only without a margin, and the margin is a decision written in
	 * the javadoc of each constant and not something this file can derive.
	 */
	@Test
	void theNumberEachRouteRefusesAtIsNotAboveWhatItsIndexKeeps() {
		for (Key key : keys()) {
			int holds = theMostItKeeps(key);

			Attempt atTheLimit = tryToKeep(key, holds);
			Attempt justAbove = tryToKeep(key, holds + 1);

			assertThat(atTheLimit.compression())
					.as("%s: the text at its limit was compressed by PostgreSQL, so the limit found"
							+ " belongs to this noise and not to every text", key.index())
					.isEqualTo("none");
			assertThat(justAbove.kept())
					.as("%s: one character past the limit it found went in, so the search is not"
							+ " measuring a limit", key.index())
					.isFalse();
			assertThat(justAbove.refusal())
					.as("%s: the refusal one past the limit does not name the size of an index row",
							key.index())
					.contains("index row size");

			assertThat(key.bound())
					.as("%s keeps %d characters of text that cannot be compressed and the route refuses"
							+ " at %d, which is above it: a value between the two would reach the"
							+ " INSERT and come back to the person as a 500", key.index(), holds,
							key.bound())
					.isPositive()
					.isLessThanOrEqualTo(holds);
		}
	}

	/**
	 * A REPEATED TEXT IS KEPT FAR BEYOND THAT LIMIT, WHICH IS WHY THE BOUND DOES NOT FOLLOW WHAT
	 * THE DATABASE REFUSES.
	 *
	 * <p>A hundred thousand copies of one character go into each of the three indexes, because
	 * PostgreSQL compresses an index key that long and a run of one letter compresses to almost
	 * nothing. The limit that the case above finds is therefore the limit for text that cannot be
	 * compressed, and a bound written as "what the database refuses" would admit a text of any
	 * length as long as it was repetitive, and refuse a shorter one that was not.
	 *
	 * <p><b>So the routes refuse a repeated text too, deliberately, and it is stricter than the
	 * database.</b> Each route case that sends one over the bound says so, and this is the
	 * measurement behind the sentence: the database would have kept it. The day PostgreSQL stops
	 * doing this, the case fails and the sentence in the javadoc of the three constants about
	 * "the same bound for a text that could be compressed" is no longer a choice but a fact about
	 * every text, which is a reason to read it again and not a reason to change a number.
	 */
	@Test
	void aRepeatedTextIsKeptFarBeyondThatLimitWhichIsWhyTheBoundDoesNotFollowTheDatabase() {
		for (Key key : keys()) {
			String text = key.repeated().apply(A_HUNDRED_THOUSAND);

			assertThat(text).hasSize(A_HUNDRED_THOUSAND);
			assertThat(text.length())
					.as("%s: the repeated text is not above the bound, so it proves nothing about it",
							key.index())
					.isGreaterThan(key.bound());
			assertThat(tryToKeep(key, text).kept())
					.as("%s refused %d copies of one character, so PostgreSQL no longer keeps a"
							+ " repeated text beyond what it keeps of noise and the routes are"
							+ " no longer stricter than the database in this respect",
							key.index(), A_HUNDRED_THOUSAND)
					.isTrue();
		}
	}
}
