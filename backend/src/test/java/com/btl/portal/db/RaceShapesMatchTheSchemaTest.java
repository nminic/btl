package com.btl.portal.db;

import com.btl.portal.domain.event.WhatARaceCarries;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT THE CODE LETS THROUGH IS WHAT {@code race} WILL HOLD, and PostgreSQL is the one
 * asked.
 *
 * <p>The sibling of {@code EventShapesMatchTheSchemaTest} one table along, written in its
 * shape because {@link WhatARaceCarries} is written in {@code WhatAnEventCarries}'s:
 * things spelt out by hand, each of them also written in V7, and a floor that asks the
 * catalogue rather than comparing one written text with another.
 *
 * <p><b>The two disagree by a 500</b>, which is why it is worth a file: a value the code
 * lets through and the table refuses does not reach an administrator as a sentence about
 * his form. The other direction is quieter and worse: a kind the schema allows and
 * {@code RaceWriteApi} does not know is one the calendar can hold and nobody can enter.
 *
 * <p><b>THE DISTANCE IS THE HALF THE SCHEMA CANNOT REFUSE AT ALL, and that is the whole
 * reason it is here.</b> A distance with more decimals than the column keeps is not
 * rejected by PostgreSQL, it is ROUNDED, and {@code race.category} is then generated out
 * of a number nobody typed. There is no constraint to compare against, so what is
 * compared is the COLUMN: its precision and scale come out of {@code information_schema}
 * and the ceiling {@link WhatARaceCarries} holds is rebuilt from them.
 *
 * <p><b>Which is why this file did not have to be rewritten when the column moved.</b>
 * Until 19.09.2026 the column was {@code numeric(6,2)} and the value that made the point
 * was {@code 42.195}: rounded to {@code 42.20} and generated as {@code marathon}, the
 * exact opposite of „uneto 42.195 nije maraton nego „duze trke"". V25 widened the column
 * to {@code numeric(8,4)} on the owner's decision that the exact length is to be KEPT, and
 * every question below moved with it because every one of them is asked of the catalogue.
 * {@code 42.195} is now a value both sides accept, and what the cases reach for instead is
 * a fifth decimal.
 */
class RaceShapesMatchTheSchemaTest extends DatabaseTest {

	/** Every literal in a rule, which is what an enumerated rule is made of. */
	private static final Pattern SPELLED_OUT = Pattern.compile("'([^']*)'");

	/** What the schema itself says, in its own words. */
	private String whatTheSchemaSays(String constraint) {
		return db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema() and con.conname = ?")
				.param(constraint).query(String.class).single();
	}

	/**
	 * Whether PostgreSQL, applying its own rule, would hold this value in that column.
	 *
	 * <p>Every mention of the column and not the first, for the reason
	 * {@code EventShapesMatchTheSchemaTest} gives: a rule naming its column twice, asked
	 * with one parameter, fails as a bad statement rather than as a disagreement.
	 */
	private boolean theSchemaTakes(String constraint, String column, String value) {
		String rule = whatTheSchemaSays(constraint);
		String condition = rule.substring(rule.indexOf('(') + 1, rule.lastIndexOf(')'));

		int mentions = condition.split(column, -1).length - 1;
		var query = db.sql("select " + condition.replace(column, "?::text"));

		for (int mention = 0; mention < mentions; mention++) {
			query = query.param(mention + 1, value);
		}

		return Boolean.TRUE.equals(query.query(Boolean.class).single());
	}

	@Test
	void theSchemaStillHasARuleAboutTheKindAtAll() {
		assertThat(whatTheSchemaSays("race_kind_known"))
				.as("the rule is gone from the schema, so nothing here is being compared")
				.contains("kind")
				.startsWith("CHECK");
	}

	/** Every kind the code names is one the table would hold. */
	@Test
	void whatTheCodeKnowsTheSchemaTakes() {
		for (String kind : WhatARaceCarries.KINDS) {
			assertThat(theSchemaTakes("race_kind_known", "kind", kind))
					.as("the code knows the kind '%s' and the table refuses it", kind)
					.isTrue();
		}
	}

	/**
	 * And nothing else is, which is the direction a hand written list gets wrong.
	 *
	 * <p>The kinds are not typed out here a second time; they are read off the rule
	 * PostgreSQL hands back. A fourth kind added to the schema tomorrow arrives in this
	 * set on its own and fails this the same day, instead of being a row the calendar can
	 * hold and no form can produce.
	 */
	@Test
	void andWhatTheSchemaTakesTheCodeKnows() {
		Matcher found = SPELLED_OUT.matcher(whatTheSchemaSays("race_kind_known"));
		Set<String> saidInTheRule = found.results()
				.map(one -> one.group(1)).collect(Collectors.toSet());

		assertThat(saidInTheRule)
				.as("the rule names no kinds at all, so this is comparing an empty set")
				.isNotEmpty();
		assertThat(saidInTheRule)
				.as("the schema and WhatARaceCarries.KINDS no longer say the same thing")
				.isEqualTo(WhatARaceCarries.KINDS);
	}

	/**
	 * And the two kinds the code names ONE BY ONE are among them, which the set above
	 * cannot say.
	 *
	 * <p>{@code OF_A_LENGTH} and {@code TO_A_LIMIT} are what the pairings in
	 * {@code RaceWriteApi} are written against, and either of them misspelt would leave
	 * the set equal and the pairings wrong in a way nothing else here sees: a race of a
	 * lenght would be asked for a limit.
	 */
	@Test
	void andTheTwoKindsTheCodeNamesOneByOneAreKindsToo() {
		assertThat(WhatARaceCarries.KINDS)
				.as("a kind the pairings are written against is not one the schema knows")
				.contains(WhatARaceCarries.OF_A_LENGTH, WhatARaceCarries.TO_A_LIMIT);
	}

	/**
	 * And the rule is a rule: something outside it is refused.
	 *
	 * <p>Without this the cases above would both pass against a constraint that takes
	 * anything at all, and a floor that accepts everything holds nothing up.
	 */
	@Test
	void aKindNobodyNamedIsRefused() {
		assertThat(theSchemaTakes("race_kind_known", "kind", "distance"))
				.as("the table would hold a kind nothing in the portal can produce")
				.isFalse();
	}

	/**
	 * THE CEILING THE CODE REFUSES IS THE ONE THE COLUMN HAS, rebuilt from the catalogue.
	 *
	 * <p>{@code numeric(8,4)} holds at most {@code 9999.9999}: eight digits of which four
	 * are after the point. Both numbers are read off {@code information_schema} and the
	 * largest value is worked out from them, so a migration that widens the column fails
	 * this rather than leaving the code refusing a distance the table would have kept.
	 * V25 is exactly that migration, and this is the case that made it move the constants
	 * in {@link WhatARaceCarries} in the same commit.
	 */
	@Test
	void theCeilingTheCodeHoldsIsTheColumnsOwn() {
		int precision = numberOf("numeric_precision");
		int scale = numberOf("numeric_scale");

		assertThat(scale)
				.as("the column keeps a different number of decimals than the code does")
				.isEqualTo(WhatARaceCarries.digitsKeptAfterThePoint());

		/* 10^(precision - scale) - 10^-scale, written as the digits it really is: four
		   nines, a point and two more. */
		BigDecimal most = BigDecimal.TEN.pow(precision - scale)
				.subtract(BigDecimal.ONE.movePointLeft(scale))
				.setScale(scale);

		assertThat(WhatARaceCarries.mostADistanceCanBe())
				.as("the code and numeric(%d,%d) no longer agree about the largest distance"
						+ " there is", precision, scale)
				.isEqualByComparingTo(most);
	}

	private int numberOf(String property) {
		return db.sql("select " + property + " from information_schema.columns"
						+ " where table_schema = current_schema() and table_name = 'race'"
						+ "   and column_name = 'distance_km'")
				.query(Integer.class).single();
	}

	/**
	 * AND A DISTANCE THE CODE ACCEPTS IS ONE THE COLUMN KEEPS <b>UNCHANGED</b> AND V7 DOES
	 * NOT REFUSE, which is two questions because the table answers them in two places.
	 *
	 * <p>{@code race_distance_not_negative} is a CHECK and is asked as one, its own
	 * expression out of the catalogue. Whether the value survives the COLUMN is not a
	 * check at all and no constraint says anything about it: a value with one decimal too
	 * many is refused by nothing, it is silently rounded, and the generated
	 * {@code race.category} is then worked out of the rounded number. So that half is
	 * asked of the type instead, rounded to the column's own scale and held under its own
	 * precision, both read off the catalogue.
	 */
	@ParameterizedTest
	@ValueSource(strings = {
			"0", "0.00", "10", "10.5", "21.1", "42.2", "9999.99",
			/* The two the owner named himself, and since V25 they are values the column
			   KEEPS rather than values it rounds. That the two sides agree about them is
			   the same assertion it always was; what the two sides agree ON has moved. */
			"42.195", "21.0975",
			/* And the one from his sentence of 19.09.2026, „42.203 ... ali da vodi kao
			   ultramaraton", which is a third decimal away from a category boundary. */
			"42.203",
			/* A fourth that is not near a boundary at all, so this is about the column and
			   not about the numbers the owner happened to mention. */
			"7.125",
			/* One decimal past what the column keeps, which is where the rule now turns:
			   rounded on the way in, and a category worked out of a number nobody typed. */
			"42.19512", "21.09751", "7.12345",
			/* The widened ceiling itself, and one step over it. */
			"9999.9999", "9999.99991",
			/* Over the ceiling, which overflows rather than rounding. */
			"10000", "10000.00", "99999.99",
			/* And below nought, which the code refuses and `race_distance_not_negative`
			   refuses too. */
			"-1", "-0.01",
	})
	void whatTheCodeSaysAboutADistanceTheColumnSaysToo(String distance) {
		BigDecimal asked = new BigDecimal(distance);

		assertThat(WhatARaceCarries.distanceIsKeptExactly(asked))
				.as("the code and race.distance_km disagree about %s: either the administrator"
						+ " meets a 500 rather than a sentence, or a distance he typed is"
						+ " quietly changed into another one and its category with it", distance)
				.isEqualTo(theColumnKeepsItUnchanged(asked) && theSchemaTakesADistance(asked));
	}

	/**
	 * Whether that value would go into the column and come back the same number.
	 *
	 * <p>Asked as a ROUNDING rather than as a cast into the column's type, on purpose: a
	 * cast that overflows aborts the transaction, and every statement after it in the same
	 * case then fails over something that is not what the case is about. Rounded to the
	 * column's own scale and held under its own precision, both read off the catalogue, so
	 * this cannot go on asking about {@code numeric(6,2)} after a migration has widened it
	 * - which V25 did, and this went on measuring the widened column without a line
	 * changing.
	 */
	private boolean theColumnKeepsItUnchanged(BigDecimal asked) {
		int precision = numberOf("numeric_precision");
		int scale = numberOf("numeric_scale");

		return Boolean.TRUE.equals(db.sql("select round(cast(? as numeric), " + scale + ")"
						+ " = cast(? as numeric)"
						+ " and abs(cast(? as numeric)) < power(cast(10 as numeric), "
						+ (precision - scale) + ")")
				.params(asked, asked, asked).query(Boolean.class).single());
	}

	/** And whether V7's own CHECK would hold it, asked in the constraint's own words. */
	private boolean theSchemaTakesADistance(BigDecimal asked) {
		String rule = whatTheSchemaSays("race_distance_not_negative");
		String condition = rule.substring(rule.indexOf('(') + 1, rule.lastIndexOf(')'));

		return Boolean.TRUE.equals(db.sql("select "
						+ condition.replace("distance_km", "cast(? as numeric)"))
				.param(asked).query(Boolean.class).single());
	}
}
