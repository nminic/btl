package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * THE PRICE LIST AS THE PORTAL ANSWERS IT, AND THE ORDER IT COMES IN.
 *
 * <p><b>The amounts are not written out here, and that is deliberate.</b> They are
 * already held twice and the chain is complete without a third copy:
 * {@code PriceListRowsTest} ties V4's seven rows to PDL P8 and to the decisions of
 * 03., 04. and 12.08.2026, and ties them again to the rows
 * {@code MembershipPrice} is written against. What is left to say is that the
 * ANSWER is those rows - every field of them, in the order somebody chose - and a
 * fourth list of seven amounts in this file would be one more thing to keep equal
 * and nothing more measured. A price changed in a migration and not in the answer
 * fails here; a price changed in a migration at all fails there.
 *
 * <p><b>WHAT THIS FILE CANNOT DO, named rather than left to be found.</b> The two
 * codebooks are tied to the file the portal serves - {@code CountryApiTest} and
 * {@code DucatApiTest} both compare the whole answer with
 * {@code frontend/public/mock/...} - and the price list has no such file. It lives
 * in {@code frontend/src/data/pricing.ts}, which is TypeScript and not data:
 * {@code PriceListRowsTest} says so in as many words and that is why it holds the
 * decision instead. So the floor {@code Answers.everyFieldThePortalReadsIsAnswered}
 * gives every other resource is not available to this one, and the field NAMES are
 * held by the record in {@code PricingApi} and by its Javadoc rather than by a
 * comparison. That is a real gap and this is where it is written down.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class PricingApiTest {

	/** Four periods, one level, one fee, one referral: ADL A36 O12, and V4's check. */
	private static final int ROWS = 7;

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private JsonNode answer() throws Exception {
		return new ObjectMapper().readTree(http.perform(get("/api/pricing"))
				.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
	}

	private static List<String> keysOf(JsonNode rows) {
		return StreamSupport.stream(rows.spliterator(), false)
				.map(one -> one.path("key").asString()).toList();
	}

	/**
	 * One value as text, whatever JSON type carries it.
	 *
	 * <p>An amount is {@code numeric(10,2)} and comes back as {@code 35.00} on one
	 * side and as a {@code BigDecimal} of the same scale on the other; a null is a
	 * null. Normalised the same way on both sides, which is the move
	 * {@code DucatApiTest} makes over the same column type and for the same reason.
	 */
	private static String saidAs(JsonNode value) {
		if (value.isNull()) {
			return null;
		}

		return value.isNumber() ? value.decimalValue().stripTrailingZeros().toPlainString()
				: value.asString();
	}

	private static String saidAs(Object value) {
		if (value == null) {
			return null;
		}

		return value instanceof java.math.BigDecimal amount
				? amount.stripTrailingZeros().toPlainString()
				: value.toString();
	}

	/** The row under a key, as the schema holds it, read by the column names V4 gives. */
	private Map<String, Object> held(String key) {
		return db.sql("select key, kind, day_from as \"from\", day_to as \"to\", eur, rsd, ranking"
						+ " from price_row where key = ?")
				.param(key)
				.query()
				.singleRow();
	}

	/**
	 * THE ANSWER IS THE PRICE LIST THE SCHEMA HOLDS, EVERY FIELD OF EVERY ROW.
	 *
	 * <p>Derived and not written out. The expected side is its own query against
	 * {@code price_row}, so a SELECT that reads one column for another, that drops a
	 * row, or that rounds an amount on the way out fails here while the rows in the
	 * database sit untouched - which is exactly the class of fault
	 * {@code PriceListRowsTest} cannot see, because it never asks the server anything.
	 *
	 * <p><b>That it can see a column read for another one is not assumed</b>, it is
	 * the case below: no two fields of this answer carry the same value in all seven
	 * rows, so every pair of them is told apart by at least one row here.
	 *
	 * <p>The count is asserted first. Compared row by row against a list that came
	 * back empty, every loop below would run nought times and the case would be green
	 * having measured nothing.
	 */
	@Test
	void theAnswerIsThePriceListTheSchemaHolds() throws Exception {
		JsonNode ours = answer();

		assertThat(ours.size())
				.as("the price list is four periods, one level, one fee and one referral, and the"
						+ " answer carries a different number of rows")
				.isEqualTo(ROWS);

		int compared = 0;

		for (JsonNode one : ours) {
			String key = one.path("key").asString();
			Map<String, Object> theirs = held(key);

			for (String field : Answers.fieldsOf(one)) {
				assertThat(theirs)
						.as("/api/pricing answers with %s, which the price list has no column for", field)
						.containsKey(field);
				assertThat(saidAs(one.get(field)))
						.as("the %s of the %s row is not what the schema holds", field, key)
						.isEqualTo(saidAs(theirs.get(field)));
				compared++;
			}
		}

		assertThat(compared)
				.as("seven rows times the seven fields of a price row were not compared, so this case"
						+ " measures less than it says")
				.isEqualTo(ROWS * 7);
	}

	/**
	 * AND NO TWO FIELDS OF THE ANSWER CARRY THE SAME VALUE IN EVERY ROW.
	 *
	 * <p>This is the floor under the case above, and without it that case has a silent
	 * way of saying nothing. A comparison field by field can only see a column read for
	 * another one if the two columns can DISAGREE somewhere in the list: were
	 * {@code eur} and {@code rsd} equal in all seven rows, a query answering the dinar
	 * price out of the euro column would pass it without a word, and the member paying
	 * from abroad would be charged the dinar figure.
	 *
	 * <p>Seven fields is twenty-one pairs, and none of them is asked about by name: the
	 * fields are read off the answer, so a field added tomorrow is either told apart
	 * from every other one here or it says so.
	 */
	@Test
	void noTwoFieldsOfTheAnswerCarryTheSameValueInEveryRow() throws Exception {
		JsonNode ours = answer();
		Map<String, List<String>> columns = new LinkedHashMap<>();

		for (JsonNode one : ours) {
			one.properties().forEach(field -> columns
					.computeIfAbsent(field.getKey(), any -> new java.util.ArrayList<>())
					.add(field.getValue().toString()));
		}

		assertThat(columns)
				.as("/api/pricing answered with nothing, so no pair of fields was compared")
				.isNotEmpty();

		List<String> fields = List.copyOf(columns.keySet());
		int pairs = 0;

		for (int left = 0; left < fields.size(); left++) {
			for (int right = left + 1; right < fields.size(); right++) {
				assertThat(columns.get(fields.get(left)))
						.as("%s and %s carry the same value in every row of the price list, so a query"
								+ " answering one of them out of the other would pass unnoticed",
								fields.get(left), fields.get(right))
						.isNotEqualTo(columns.get(fields.get(right)));
				pairs++;
			}
		}

		assertThat(pairs)
				.as("the answer no longer has seven fields, so the number of pairs compared moved with it")
				.isEqualTo(21);
	}

	/** AND NOTHING THE ANSWER CARRIES IS THE SAME IN EVERY ROW, which is the floor
	 *  every other resource of this API stands on. A field the price list never varies
	 *  is a field a constant could answer. */
	@Test
	void noFieldOfTheAnswerIsTheSameInEveryRow() throws Exception {
		Answers.noFieldIsTheSameInEveryRecord("/api/pricing", answer());
	}

	/**
	 * ALL FOUR KINDS OF ROW ARE ANSWERED, AND THE PERIODS ARE THE ONLY KIND THERE IS
	 * MORE THAN ONE OF.
	 *
	 * <p>ADL A36 O12: „four periods, one level, one fee, one referral. Seven rows, and
	 * the kind is what tells them apart rather than four tables answering one
	 * question." A resource that answers with three of the four is a price list that
	 * looks complete and is not: drop the referral and the amount a member is promised
	 * for bringing somebody in (PDL P16, owner 12.08.2026) is gone from the one place
	 * it is published; drop the fee and the member paying in euro is quoted a price he
	 * will not be charged.
	 *
	 * <p><b>The four are named here on purpose and the floor under the list is V4's own
	 * check</b>, {@code price_row_kind_known}, which is the thing that says these four
	 * and no others are the kinds there are. A fifth kind added to the schema tomorrow
	 * is a row this case does not expect and the count below fails on it.
	 */
	@Test
	void allFourKindsOfRowAreAnsweredAndOnlyThePeriodsRepeat() throws Exception {
		Map<String, Integer> kinds = new LinkedHashMap<>();

		for (JsonNode one : answer()) {
			kinds.merge(one.path("kind").asString(), 1, Integer::sum);
		}

		assertThat(kinds)
				.as("/api/pricing no longer answers with all four kinds of row, or answers with one"
						+ " the schema does not know")
				.containsOnlyKeys("period", "level", "fee", "referral")
				.containsEntry("period", 4)
				.containsEntry("level", 1)
				.containsEntry("fee", 1)
				.containsEntry("referral", 1);
	}

	/**
	 * THE ORDER IS THE ONE SOMEBODY DECIDED, AND NOT THE ONE THE ROWS WERE WRITTEN IN.
	 *
	 * <p><b>This case exists because those two are the same answer against V4's seven
	 * rows, and a case that cannot tell them apart says nothing.</b> The rows were
	 * inserted in the order they are sorted in, so {@code order by sort_order} and
	 * {@code order by id} - and a query with no order at all, on a small table nothing
	 * has updated - all come back the same list. Every other case in this file would
	 * stay green on any of the three.
	 *
	 * <p>So one row is MOVED within the order and the answer is asked again.
	 *
	 * <p><b>AND IT IS MOVED TO THE FRONT, WHICH IS THE WHOLE OF WHY THE SHIFT BELOW IS
	 * HERE.</b> The first draft of this case moved a row to the END of the order, and a
	 * mutation measured what that was worth: dropping {@code order by} altogether left
	 * it green. An {@code UPDATE} in PostgreSQL writes a NEW version of the row and the
	 * new version goes to the end of the table, so a scan with no order returns the
	 * moved row last - which is exactly where {@code sort_order} had just put it. Right
	 * and wrong gave the same list, and the case said nothing about order at all. That
	 * is the fault of 06.09.2026 in its own words: name the other place this value
	 * could have come from, and make the setup disagree with it.
	 *
	 * <p>Moved to the FRONT the two cannot agree: whatever an {@code UPDATE} does to
	 * where a row physically sits, it does not put it first. Nor does its age
	 * ({@code id} does not change when a row is updated) and nor does its key
	 * (alphabetically {@code referral} is fifth of the seven). One move, three orders
	 * ruled out.
	 *
	 * <p>Getting a free place at the front takes the shift, because 1 is taken and
	 * {@code price_row_sort_order_positive} refuses nought. Every row moves up by ten
	 * first, which collides with nothing at any point in the statement - so the unique
	 * constraint has nothing to refuse even though it is checked where the statement is
	 * written, being {@code initially immediate}. Both statements roll back with the
	 * transaction.
	 *
	 * <p>It settles the other half at the same time: the answer is read out of the
	 * schema on each request rather than out of a list written in the handler, because
	 * a written list could not have moved.
	 */
	@Test
	void theOrderIsTheOneSomebodyDecidedAndNotTheOneTheRowsWereWrittenIn() throws Exception {
		List<String> before = keysOf(answer());

		assertThat(before)
				.as("the referral no longer closes the list, so moving it to the front measures"
						+ " something else")
				.endsWith("referral");

		int shifted = db.sql("update price_row set sort_order = sort_order + 10").update();

		assertThat(shifted)
				.as("the shift that frees a place at the front of the order did not touch the whole"
						+ " price list, so the move below is not the move this case describes")
				.isEqualTo(ROWS);

		int moved = db.sql("update price_row set sort_order = 1 where key = 'referral'").update();

		assertThat(moved)
				.as("the row this case moves is not in the price list, so nothing was moved and the"
						+ " order below is the order it always was")
				.isOne();

		List<String> after = keysOf(answer());

		assertThat(after)
				.as("the referral was moved to the front of the order and the answer did not move"
						+ " with it: the rows are coming back in the order they were written, or by"
						+ " their key, or in no order at all")
				.startsWith("referral");
		assertThat(after)
				.as("the answer is the same list after a row was moved within the order, so it is not"
						+ " being read from the price list at all")
				.isNotEqualTo(before);

		/* AND THE REST KEPT THEIR ORDER, which is what tells a move from a shuffle. An
		   answer sorted by the key would also have put `referral` somewhere else, and
		   `startsWith` alone would not have said which of the two happened. */
		assertThat(after.subList(1, after.size()))
				.as("the other six rows changed order too, so what moved was not one row")
				.isEqualTo(before.subList(0, before.size() - 1));
	}

	/**
	 * AND IT IS READABLE WITHOUT SIGNING IN, which is the whole of why the route is on
	 * the open list.
	 *
	 * <p>The owner, 04.08.2026, striking out the page that used to carry the prices:
	 * „I grupa i strana su obrisane; cene su javne u Clanu 14 Pravilnika." A price list
	 * a visitor cannot read is the portal asking to be joined before it says what
	 * joining costs, and the fee beside it is named in the same direction: „Taksa se
	 * prikazuje svima, samo je ne placaju svi."
	 *
	 * <p><b>What holds the sub-paths, the spellings and the writing is not here.</b>
	 * {@code ApiSecurityTest} reads {@code ApiSecurity.READ_BY_ANYBODY} itself and asks
	 * all of that of every route on it, so this route arrived with those cases rather
	 * than needing them written again. What this one says is the sentence that list
	 * cannot: that the route is on it ON PURPOSE, and why.
	 */
	@Test
	void aPriceListIsReadableWithoutSigningIn() throws Exception {
		assertThat(http.perform(get("/api/pricing")).andReturn().getResponse().getStatus())
				.as("somebody deciding whether to join was asked to sign in before being told the price")
				.isEqualTo(200);

		Set<String> open = new LinkedHashSet<>(ApiSecurity.READ_BY_ANYBODY);

		assertThat(open)
				.as("the price list answers 200 and is not on the open list, which means something"
						+ " else is opening it and this case is measuring that instead")
				.contains("/api/pricing");
	}
}
