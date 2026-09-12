package com.btl.portal.db;

import com.btl.portal.domain.inbox.WhoseMessageItIs;
import com.btl.portal.domain.inbox.WhoseMessageItIs.Message;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE ONE THING THE CLASS LEANS ON, AND PostgreSQL IS ASKED WHETHER IT HOLDS.
 *
 * <p>{@code WhoseMessageItIs.mayAnswer} answers no for a question addressed to
 * the whole league, and its comment says that is safe because such a message
 * cannot exist: {@code message_a_question_has_an_addressee} forbids it. A lean
 * like that is only as good as the thing leaned on, and the day somebody relaxes
 * that constraint the class goes from "cannot happen" to "silently refuses
 * everybody", with nothing red to say so.
 *
 * <p>So the constraint's own expression is taken out of the catalogue and
 * evaluated, the shape {@code MemberNumberMatchesTheSchemaTest} uses in this
 * same package. Read as a text it would prove nothing: the rule is a disjunction
 * over three columns and there are a dozen ways to spell the same one.
 */
class InboxRulesMatchTheSchemaTest extends DatabaseTest {

	/** Whether PostgreSQL, applying its own rule, would hold a row of this shape. */
	private boolean theSchemaTakes(Long addressee, boolean invitesToATeam, boolean invitesToAPair) {
		String rule = whatTheSchemaSays();
		String condition = rule.substring(rule.indexOf('(') + 1, rule.lastIndexOf(')'));

		/* Each column is replaced by a literal rather than a parameter: a null here is
		   the whole point of the case, and a typed null through JDBC would have to be
		   given a type for every one of the three. */
		String asked = condition
				.replace("to_id", addressee == null ? "null::bigint" : addressee.toString())
				.replace("team_invitation_id", invitesToATeam ? "1::bigint" : "null::bigint")
				.replace("pair_invite_id", invitesToAPair ? "1::bigint" : "null::bigint");

		Boolean answered = db.sql("select " + asked).query(Boolean.class).single();

		/* NOT `coalesce(..., false)`, and the difference is the wrong way round rather
		   than cosmetic. PostgreSQL takes a CHECK that evaluates to NULL as SATISFIED:
		   a constraint refuses a row only on false. Mapping NULL to false would have
		   this method answer "the table refuses it" about a row the table would hold.

		   Today the question cannot arise - the rule is built out of IS NULL and
		   IS NOT NULL, which never yield NULL whatever they are given - so either
		   spelling gives the same answers. That is exactly why it must not be written
		   as a default: the day somebody rewrites the rule with an operator that does
		   propagate NULL, a default hides the ambiguity and this asks it out loud. */
		assertThat(answered)
				.as("the rule answered neither yes nor no, which PostgreSQL would read as yes")
				.isNotNull();

		return answered;
	}

	private String whatTheSchemaSays() {
		return db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema()"
						+ "  and con.conname = 'message_a_question_has_an_addressee'")
				.query(String.class).single();
	}

	@Test
	void theSchemaStillHasTheRuleAtAll() {
		assertThat(whatTheSchemaSays())
				.as("the rule is gone, so the class is leaning on nothing")
				.startsWith("CHECK")
				.contains("to_id");
	}

	/**
	 * A QUESTION ASKED OF THE WHOLE LEAGUE CANNOT BE WRITTEN DOWN.
	 *
	 * <p>Both kinds of question, because the rule names them separately and could
	 * lose one of them without losing the other. This is the sentence
	 * {@code mayAnswer} leans on.
	 */
	@Test
	void aQuestionToTheWholeLeagueIsRefusedByTheTable() {
		assertThat(theSchemaTakes(null, true, false))
				.as("an invitation to a team could be addressed to everybody")
				.isFalse();
		assertThat(theSchemaTakes(null, false, true))
				.as("an invitation to a pair could be addressed to everybody")
				.isFalse();
	}

	/**
	 * And everything the portal actually sends is a row the table holds.
	 *
	 * <p>Without this, the case above would pass against a rule that refuses
	 * everything, and a floor that refuses everything holds nothing up.
	 */
	@Test
	void everythingThePortalSendsTheSchemaHolds() {
		assertThat(theSchemaTakes(4102L, true, false)).as("an invitation to one member").isTrue();
		assertThat(theSchemaTakes(4102L, false, true)).as("a pair invite to one member").isTrue();
		assertThat(theSchemaTakes(4102L, false, false)).as("a plain message to one member").isTrue();
		assertThat(theSchemaTakes(null, false, false)).as("an announcement to the league").isTrue();
	}

	/**
	 * AND THE CLASS AGREES WITH THE TABLE ABOUT EVERY SHAPE THE TABLE ALLOWS.
	 *
	 * <p>Not that it answers the same - they answer different questions - but that
	 * it never says yes about a row that cannot exist. The one combination the
	 * table refuses is the one {@code mayAnswer} must refuse too, and this reads
	 * the answer off the schema rather than repeating the list.
	 */
	@Test
	void theClassSaysNoToTheRowTheTableWillNotHold() {
		long asking = 4102;

		for (boolean question : new boolean[] {true, false}) {
			boolean storable = theSchemaTakes(null, question, false);
			boolean answerable = WhoseMessageItIs.mayAnswer(new Message(null, question), asking);

			assertThat(answerable && !storable)
					.as("the class would let somebody answer a message the table cannot hold")
					.isFalse();
		}
	}
}
