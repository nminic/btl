package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The roles the portal has, and the twelve boxes of the matrix of rights.
 *
 * V5 loads nineteen rows written by hand, so the question this file has to
 * answer is the one a hand written list always raises: what is underneath it.
 * The answer differs per claim, and saying which is which is the point of this
 * comment, because a claim with nothing under it is worth knowing about before
 * a review rather than after one.
 *
 * <ul>
 * <li><b>The twelve rights have a floor</b>, and it is the portal's own
 * dictionary. Every right carries the key its column is headed with,
 * {@code rights.column.entity.<id>} and {@code rights.column.queue.<id>}, and
 * the front end's own suite refuses a right whose keys the dictionary cannot
 * answer (rights.test.tsx, "carry no key the dictionary cannot answer"). So a
 * tenth entity or a seventh queue reaches the dictionary on the day it is
 * added, and fails here until the migration carries it too. Read out of the
 * JSON rather than out of the TypeScript that builds RIGHTS: a guard that reads
 * source text is answering a question about how something is written, and this
 * one is about what is there.</li>
 *
 * <li><b>The four roles the portal uses have a floor</b>, the same dictionary.
 * The role switch names every role it can become, {@code role.<code>}
 * (RoleSwitch.tsx), so the day the portal learns to be a sponsor the dictionary
 * gains the word and {@code in_use} has to answer for it.</li>
 *
 * <li><b>The other three roles have none, and cannot have one.</b> They are in
 * the schema because PDL P21 calls the list of seven final and ADL A8 says a
 * difference between that list and the schema would be a debt where the
 * difference between the list and the code is not. Their source is a sentence
 * in a decision journal, and a guard that parses prose is a guard that argues
 * with the person writing the prose. The boundary is written down here instead:
 * an eighth role could be decided and this file would not know.</li>
 *
 * <li><b>{@code rights_mode} has none either.</b> It is useMay() in rights.ts,
 * which is TypeScript the portal runs and not a file to read. What holds it is
 * the one claim that matters most and is measurable here: exactly one role
 * holds everything, and it is the superadmin.</li>
 * </ul>
 */
class RolesAndRightsTest extends DatabaseTest {

	private static final ObjectMapper JSON = new ObjectMapper();

	/** The portal's dictionary, which is where every claim below that has a
	 *  floor gets it from. */
	private static final String DICTIONARY = "frontend/src/i18n/sr.json";

	/** The one key under {@code role} that is not a role: the label over the
	 *  switch itself. Named rather than skipped by shape, because there is no
	 *  shape to skip it by, and a floor is worth more with one exception written
	 *  into it than it is not written at all. */
	private static final String NOT_A_ROLE = "label";

	record RoleRow(String code, String rightsMode, boolean inUse) {
	}

	/**
	 * All seven of PDL P21, with what each of them may hold and whether the
	 * portal uses it today.
	 *
	 * The three at the bottom are the ones the running portal does not show. A
	 * league organiser and a sponsor get their own screens later and the
	 * boutique is inactive until further notice, and all three hold nothing of
	 * this matrix: the twelve rights below describe what a moderator may do, and
	 * PDL P21 says so in those words.
	 */
	@Test
	void allSevenRolesAreRowsAndHoldWhatTheSpecificationSays() {
		List<RoleRow> rows = db
				.sql("select code, rights_mode, in_use from role order by code")
				.query((rs, row) -> new RoleRow(rs.getString("code"), rs.getString("rights_mode"),
						rs.getBoolean("in_use")))
				.list();

		assertThat(rows).containsExactlyInAnyOrder(
				new RoleRow("visitor", "none", true),
				new RoleRow("competitor", "none", true),
				new RoleRow("moderator", "granted", true),
				new RoleRow("superadmin", "all", true),
				new RoleRow("league_organiser", "none", false),
				new RoleRow("sponsor", "none", false),
				new RoleRow("boutique", "none", false));
	}

	/**
	 * The roles the portal uses are the roles the portal can name.
	 *
	 * This is the floor under {@code in_use}, and it works in both directions: a
	 * role the switch offers and this table calls dormant fails here, and so
	 * does a role marked in use that the portal has no word for.
	 */
	@Test
	void theRolesInUseAreTheOnesThePortalCanName() {
		List<String> named = new ArrayList<>();

		for (String key : read(DICTIONARY).get("role").propertyNames()) {
			if (!NOT_A_ROLE.equals(key)) {
				named.add(key);
			}
		}

		/* Four, written out so that a dictionary that quietly lost a role is a
		   failure here rather than a shorter list matching a shorter table. */
		assertThat(named).hasSize(4);

		List<String> inUse = db.sql("select code from role where in_use").query(String.class).list();

		assertThat(inUse).containsExactlyInAnyOrderElementsOf(named);
	}

	/**
	 * Twelve boxes: six entities and six queues.
	 *
	 * Six and not seven entities, because the moderators are the one entity no
	 * tick can ever open (ADL A8, 30.07.2026): a column for it was a box the
	 * superadmin could set, a row that then read one right more, and a moderator
	 * who got the same refusal as before. It is left out of the dictionary for
	 * the same reason it is left out of the matrix, so the floor sees six on
	 * both sides without being told about the exception.
	 *
	 * Compared as sets and not in order. The order of the columns is read off
	 * ENTITY_FORMS and QUEUES and is the front end's own; the database holds no
	 * order and this is where that decision is visible.
	 */
	@Test
	void theTwelveRightsAreTheBoxesOfTheMatrix() {
		JsonNode columns = read(DICTIONARY).get("rights").get("column");

		List<String> expected = new ArrayList<>();
		addKeys(expected, columns, "entity");
		addKeys(expected, columns, "queue");

		assertThat(expected).hasSize(12);

		List<String> loaded = db.sql("select code from admin_right").query(String.class).list();

		assertThat(loaded).containsExactlyInAnyOrderElementsOf(expected);
	}

	/**
	 * The key of a right is spelt once, and there is no second place to spell it.
	 *
	 * Both halves matter and they are one decision. The composed half says the
	 * key follows the pair, so a right cannot be filed under a name that does
	 * not describe it; the refused half says the pair cannot be overruled, which
	 * is what would put the two back out of step.
	 */
	@Test
	void theKeyOfARightIsComposedAndCannotBeWrittenByHand() {
		db.sql("insert into admin_right (scope, target) values ('entity', 'probno')").update();

		assertThat(db.sql("select code from admin_right where target = 'probno'").query(String.class).single())
				.isEqualTo("entity:probno");

		/* Asked of the root cause. Spring words this one as bad grammar and puts
		   the statement in its own message, so what PostgreSQL actually refused
		   is one level down; matched on the sentence rather than on the class,
		   because the class would be the same for a typo. */
		assertThatThrownBy(() -> db
				.sql("insert into admin_right (scope, target, code) values ('queue', 'probno', 'queue:nesto')")
				.update())
				.rootCause()
				.hasMessageContaining("cannot insert a non-DEFAULT value into column \"code\"");
	}

	/**
	 * One role holds everything, and it is the superadmin.
	 *
	 * The other half of the same statement is in the schema and is measured by
	 * RoleAndRightConstraintsTest: a second role with that mode is refused. This
	 * half is about the rows, which no index can say anything about, and it is
	 * the security claim of the file. A second all holding role would be a way
	 * to hold every right that nobody ticked and no screen would mention:
	 * useMay() answers yes and stops looking (rights.ts, PDL P28a).
	 */
	@Test
	void onlyTheSuperadminHoldsEveryRight() {
		assertThat(db.sql("select code from role where rights_mode = 'all'").query(String.class).list())
				.containsExactly("superadmin");

		assertThat(db.sql("select code from role where rights_mode = 'granted'").query(String.class).list())
				.containsExactly("moderator");
	}

	private static void addKeys(List<String> into, JsonNode columns, String scope) {
		for (String key : columns.get(scope).propertyNames()) {
			into.add(scope + ":" + key);
		}
	}

	private static JsonNode read(String relativePath) {
		Path source = repositoryRoot().resolve(relativePath);

		/* Never skipped when the file is not there. A floor that steps aside
		   when it cannot find its source would go quiet on exactly the day the
		   dictionary moved, which is the day it is needed. */
		assertThat(Files.isRegularFile(source)).as("dictionary %s", source).isTrue();

		return JSON.readTree(source);
	}
}
