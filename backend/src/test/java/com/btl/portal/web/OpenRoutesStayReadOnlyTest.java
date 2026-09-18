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

import static org.assertj.core.api.Assertions.assertThat;

/**
 * NOTHING ON THE OPEN LIST MAY FINISH A WRITE, asked by sending one and then measuring
 * the database.
 *
 * <p><b>What it asks.</b> For every path in {@link ApiSecurity#READ_BY_ANYBODY}, over a
 * real socket, with no session and with a CSRF cookie and header the caller invents - one
 * value in both halves, which {@code ApiSecurity}'s own note says any direct caller can
 * pick: {@code POST}, {@code PUT}, {@code PATCH}, {@code DELETE}. Each must be answered
 * outside 2xx, and the fingerprint of the whole database must be equal before and after
 * each one.
 *
 * <p><b>Behaviour and not registration, which is the whole of the change.</b> Six drafts
 * of this file asked WHERE a handler is registered and WHAT TYPE it is, and each was
 * broken by a shape the one before it did not know about. A write that finished is a fact
 * about the database, and the database is where every shape has to arrive. The socket
 * rather than MockMvc is ADL A46 of 12.09.2026: what the SERVER does is measured where
 * the test framework's helpers are not. Neither floor on main asks this -
 * {@code ApiSecurityTest.nothingOpenForReadingIsOpenForWriting} posts without a CSRF
 * token and is refused before the dispatcher is asked anything, and
 * {@code RightsAtTheDoorTest} filters the open list OUT on purpose - and neither is
 * repaired here.
 *
 * <p><b>The fingerprint is derived, and compared whole rather than item by item.</b>
 * Tables come out of {@code information_schema} for this connection's schema, less
 * Flyway's history table, whose name is asked of Flyway rather than written down a second
 * time ({@code DatabaseTest.tablesInTheSchema} is the precedent). Each gives a count AND
 * an md5 over its rows, so a row changed in place moves it as much as one added or
 * removed.
 *
 * <p><b>WHAT IT STILL DOES NOT SEE</b>, both measured on 18.09.2026 and left as a
 * boundary rather than patched over:
 *
 * <ul>
 * <li>A {@code GET} that writes. An {@code update} put inside {@code PricingApi.pricing}
 * leaves this case green, because no {@code GET} is sent.
 * <li>A write that happens only after a body of its own has parsed. Every request carries
 * {@code Content-Type: application/json} and an empty object, which reaches a handler
 * taking no body and one declaring it consumes JSON, and no further.
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
		assertThat(ApiSecurity.READ_BY_ANYBODY)
				.as("the open list is empty, so the loop below sends nothing and asks nothing")
				.isNotEmpty();

		List<Mark> golden = fingerprint();

		assertThat(golden)
				.as("every table is empty at this moment, so this fingerprint answers the same"
						+ " however much a request deletes or changes")
				.anyMatch(mark -> mark.rows() > 0);

		for (String open : ApiSecurity.READ_BY_ANYBODY) {
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
	 * A COUNT AND AN MD5 OVER EVERY ROW OF EVERY TABLE, in one query and one round trip.
	 *
	 * <p>The table list is read again on every call rather than once, so a mutation that
	 * CREATES a table moves the fingerprint too; and its non-emptiness is asserted here
	 * rather than at the top of the case, so it is asked of every measurement instead of
	 * the first.
	 *
	 * <p>The names go into the query as text because no dialect parameterises a
	 * {@code from} clause. They come out of the catalogue of the database being read, so
	 * there is nothing here that anything arriving over the wire can reach -
	 * {@code CompetitorEventRaceAndResultTest} and {@code DeltaMigrationAppliesTest} name
	 * a table the same way and for the same reason.
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
	 * One write, sent the way somebody writing his own request writes it.
	 *
	 * <p>No session cookie, which is the caller this is about; and the CSRF cookie and
	 * header carry one value he chose himself, so the request is not refused by the CSRF
	 * filter before anything has decided whether a handler exists. Without that, every
	 * answer here would be 403 and the case would be measuring the filter.
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
