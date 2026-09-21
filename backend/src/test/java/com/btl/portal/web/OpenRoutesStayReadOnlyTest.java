package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatusCode;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * NOTHING ON THE OPEN LIST MAY FINISH A WRITE: one is sent, then one schema measured.
 *
 * <p><b>What it asks.</b> For every path in {@link ApiSecurity#READ_BY_ANYBODY}, over a
 * real socket, with no session and with a CSRF cookie and header the caller invents - one
 * value in both halves, which {@code ApiSecurity}'s note says any caller may pick:
 * {@code POST}, {@code PUT}, {@code PATCH}, {@code DELETE}. Each must be answered outside
 * 2xx, and the fingerprint of the ONE SCHEMA {@code current_schema()} names cannot move.
 *
 * <p><b>Behaviour and not registration.</b> Six drafts asked WHERE a handler is
 * registered and WHAT TYPE it is, each broken by a shape the last missed; a write that
 * finished is a fact about the database, where every shape arrives. Socket and not
 * MockMvc is ADL A46; no floor on main asks it, {@code ApiSecurityTest} posting without a
 * CSRF token and {@code RightsAtTheDoorTest} filtering the open list OUT.
 *
 * <p><b>WHAT IT DOES NOT SEE</b>, measured on 18.09.2026 and written down rather than
 * patched over: none is reachable without a change of our own code, and this is draft 7.
 *
 * <ul>
 * <li>A {@code GET} that writes: an {@code update} inside {@code PricingApi.pricing}
 * leaves this green, because no {@code GET} is sent.
 * <li>A write needing a body of its own parsed first: every request carries an empty JSON
 * object, reaching a handler taking no body and one consuming JSON, and no further.
 * <li>A WRITE INTO ANY OTHER SCHEMA, the mark asking {@code current_schema()} alone: a
 * filter making {@code schema shadow} per non-GET and writing there leaves this green
 * twice over, 44 writes unseen on the day the open list held 11 paths; and with
 * {@code search_path} = {@code "$user", public}, a schema named for the user moves it.
 * <li>A WRITE LANDING AFTER THE ANSWER, the mark taken with the status in hand: a
 * filter's thread writing four seconds later leaves 0 rows right after the answer and 1
 * ten seconds later. Dead, not open: in 70 files {@code backend/src/main} has ZERO
 * {@code @Async}, {@code CompletableFuture}, {@code new Thread}, {@code TaskExecutor} or
 * {@code TransactionSynchronization}.
 * <li>THAT ANY REQUEST REACHED THE DISPATCHER: neither says so, a 403 from early refusal
 * satisfying both as a 404 does. ADL A46's regression ({@code withHttpOnlyFalse()} for
 * {@code csrf.spa()}) answers 403 where a 404 belongs and leaves this green;
 * {@code SignInOverRealHttpTest} goes red on it alone, not on another early refusal like
 * the rate limit {@code ApiSecurity}'s note wants before two open routes.
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration.class)
class OpenRoutesStayReadOnlyTest {

	/** Everything that is not reading, which is everything the open list does not grant. */
	private static final List<String> WRITING = List.of("POST", "PUT", "PATCH", "DELETE");

	/** Any value at all, which is the whole point of it being sent as both halves. */
	private static final String A_TOKEN = "11111111-2222-3333-4444-555555555555";

	@LocalServerPort
	private int port;

	@Autowired
	private JdbcClient db;

	@Autowired
	private Flyway flyway;

	private final HttpClient client = HttpClient.newHttpClient();

	/** One table in one line, and enough of it to tell a changed row from an equal one. */
	private record Mark(String table, long rows, String digest) {
	}

	/**
	 * NO WRITE SENT TO AN OPEN ROUTE CHANGES THE DATABASE.
	 *
	 * <p>Three assertions stand ahead of the loop, and each of them is a way this case
	 * could pass having measured nothing: an empty open list sends no request at all; a
	 * schema with no table gives a fingerprint that is the same empty answer whatever gets
	 * through; and a fingerprint of tables that are ALL empty cannot move even for a write
	 * that finishes, because there is nothing there to delete and an insert is the only
	 * thing it would see.
	 */
	@Test
	void noWriteSentToAnOpenRouteChangesTheDatabase() throws Exception {
		List<String> everyOpenAddress = everyOpenAddress();

		assertThat(everyOpenAddress)
				.as("the open list is empty, so the loop below sends nothing and asks nothing")
				.isNotEmpty();

		List<Mark> golden = fingerprint();

		assertThat(golden)
				.as("every table is empty at this moment, so this fingerprint answers the same"
						+ " however much a request deletes or changes")
				.anyMatch(mark -> mark.rows() > 0);

		for (String open : everyOpenAddress) {
			for (String writing : WRITING) {
				int answered = answerTo(writing, open);

				/* Whether a number is a success is asked of the framework that defines the
				   families, not worked out here: `answered / 100 != 2` is the same sentence
				   written in a place where nobody would look for it. */
				assertThat(HttpStatusCode.valueOf(answered).is2xxSuccessful())
						.as("%s %s was answered %s, and reading is the whole of what the open list"
								+ " grants", writing, open, answered)
						.isFalse();

				assertThat(fingerprint())
						.as("%s %s left the database changed", writing, open)
						.isEqualTo(golden);
			}
		}
	}

	/**
	 * EVERY ADDRESS {@link ApiSecurity} OPENS, as an ADDRESS and not as a pattern.
	 *
	 * <p>There are two lists since B83 and the note on
	 * {@link ApiSecurity#READ_BY_ANYBODY_UNDER_A_NAME} says why they cannot be one. Both
	 * belong here: what this case is about is that opening something for reading opened
	 * nothing for writing, and a picture is open exactly as a codebook is.
	 *
	 * <p>The entries of the second list carry a name, so each is asked with the sample value
	 * {@code ApiSecurityTest} already builds for the same purpose - one helper rather than a
	 * second spelling of the same rule. What the write is sent AT does not matter to the
	 * answer: the chain grants that address a {@code GET} and a {@code HEAD} and nothing
	 * else, so a {@code POST} is refused before any name is looked at.
	 */
	private static List<String> everyOpenAddress() {
		return Stream.concat(ApiSecurity.READ_BY_ANYBODY.stream(),
						ApiSecurity.READ_BY_ANYBODY_UNDER_A_NAME.stream()
								.map(ApiSecurityTest::withASampleValue))
				.toList();
	}

	/**
	 * A COUNT AND AN MD5 OVER EVERY ROW OF EVERY TABLE IN ONE SCHEMA, less Flyway's history
	 * table ({@code DatabaseTest.tablesInTheSchema} asks Flyway for its name the same way).
	 * The md5 is why a row changed in place moves the mark as much as one added.
	 *
	 * <p>The table list is read again on every call, so a mutation that CREATES a table
	 * moves the mark too; and its non-emptiness is asserted here and not at the top of the
	 * case, so it is asked of every measurement and not just the first.
	 *
	 * <p>The names go into the query as text because no dialect parameterises a
	 * {@code from} clause. They come out of the catalogue of the database being read, so
	 * nothing arriving over the wire can reach them - {@code DeltaMigrationAppliesTest} and
	 * {@code CompetitorEventRaceAndResultTest} name a table the same way, for that reason.
	 */
	private List<Mark> fingerprint() {
		List<String> tables = db
				.sql("select table_name from information_schema.tables"
						+ " where table_schema = current_schema() and table_type = 'BASE TABLE'"
						+ "   and table_name <> ?"
						+ " order by table_name")
				.param(flyway.getConfiguration().getTable())
				.query(String.class)
				.list();

		assertThat(tables)
				.as("the schema holds no table, so this fingerprint is the same empty answer"
						+ " whatever a request writes")
				.isNotEmpty();

		/* `t::text` is the WHOLE row, so a column changed in place changes the digest; the
		   order is the row text itself, because a table nobody sorted answers its rows in
		   whatever order the last write left them in and the digest would move on its own. */
		String each = tables.stream()
				.map(table -> "select '" + table + "' as mark_table, count(*) as mark_rows,"
						+ " md5(coalesce(string_agg(t::text, '|' order by t::text), '')) as mark_digest"
						+ " from " + table + " t")
				.collect(Collectors.joining(" union all "));

		return db.sql("select * from (" + each + ") marks order by mark_table")
				.query((row, one) -> new Mark(row.getString("mark_table"), row.getLong("mark_rows"),
						row.getString("mark_digest")))
				.list();
	}

	/**
	 * One write, sent the way somebody writing his own request writes it: no session
	 * cookie, which is the caller this is about, and a CSRF cookie and header carrying one
	 * value he chose himself, so the CSRF filter has no reason of its own to refuse.
	 *
	 * <p>WHETHER IT REFUSED ANYWAY IS NOT ASKED: this hands back a status code and the case
	 * reads it, neither ever saying that a handler was reached.
	 */
	private int answerTo(String method, String path) throws Exception {
		return client.send(
				HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
						.header("Content-Type", "application/json")
						.header("Cookie", "XSRF-TOKEN=" + A_TOKEN)
						.header("X-XSRF-TOKEN", A_TOKEN)
						.method(method, HttpRequest.BodyPublishers.ofString("{}"))
						.build(),
				HttpResponse.BodyHandlers.ofString()).statusCode();
	}
}
