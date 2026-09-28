package com.btl.portal.db;

import com.btl.portal.domain.pricing.Currency;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Arrays;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE TWO MONIES THE CODE KNOWS ARE THE TWO THE SCHEMA ALLOWS, ON ALL THREE TABLES THAT HOLD ONE, AND
 * PostgreSQL IS THE ONE ASKED.
 *
 * <p>{@link Currency} is an enum written by hand whose {@code name()} goes straight into a {@code text}
 * column, and a list written by hand is only as safe as the floor under it. The floor is not another
 * written list: each constraint's own expression is taken out of the catalogue and PostgreSQL is asked
 * to judge, exactly the shape {@code PaymentMethodsMatchTheSchemaTest} uses over
 * {@code payment_method_known} and {@code PaymentStatesMatchTheSchemaTest} over
 * {@code payment_state_known}.
 *
 * <p><b>THREE CONSTRAINTS AND NOT ONE, and that is the measurement rather than thoroughness.</b>
 * {@code payment_currency_known} (V16) has held two words since the beginning;
 * {@code balance_entry_currency_known} and {@code balance_promise_currency_known} arrived with V42,
 * which is the migration that made a currency a column anybody stores rather than a fact implied by
 * which of two amounts you read. Three tables now carry the word, so three tables can drift apart -
 * and the way that hurts is asymmetric: a money the code writes and a table refuses is a 500 with a
 * member number already drawn, while a money a table would hold and the code does not know is a word
 * nothing can ever write, which is how {@code sepa} lived in {@code payment} from V16 until V39
 * without one row, one screen or one case ever saying it.
 *
 * <p><b>AND THE COUNTRY IS ASKED OF THE CODEBOOK RATHER THAN OF THESE TWO LETTERS.</b>
 * {@code Currency.of} turns {@code 'RS'} into dinars, and {@code 'RS'} is the code of a row in
 * {@code country} (V2) rather than a fact about the world this file may assert on its own.
 *
 * <p>It lives in {@code com.btl.portal.db} because everything it reads is the schema, unlike its
 * sibling over {@code PaymentApi.METHODS}, which had to sit beside a package-private field.
 */
class CurrencyMatchesTheSchemaTest extends DatabaseTest {

	/** Every literal in a rule, which is what an enumerated rule is made of. */
	private static final Pattern SPELLED_OUT = Pattern.compile("'([^']*)'");

	/**
	 * THE THREE RULES AND THE COLUMN EACH ONE IS ABOUT.
	 *
	 * <p>Written out because the constraint NAMES cannot be derived - the schema does not know that
	 * these three are one question - and the floor under this list is
	 * {@link #everyRuleAboutAmoneyInTheSchemaIsOneOfTheThree}, which sweeps {@code pg_constraint} for
	 * anything named like a currency rule and fails on a fourth.
	 */
	private static final Set<String> THE_RULES = Set.of(
			"payment_currency_known",
			"balance_entry_currency_known",
			"balance_promise_currency_known");

	/** What the schema itself says a money may be, in its own words. */
	private String whatTheSchemaSays(String constraint) {
		return db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema() and con.conname = ?")
				.param(constraint)
				.query(String.class).single();
	}

	/** Whether PostgreSQL, applying its own rule, would take this money. */
	private boolean theSchemaTakes(String constraint, String money) {
		String rule = whatTheSchemaSays(constraint);
		String condition = rule.substring(rule.indexOf('(') + 1, rule.lastIndexOf(')'));

		return Boolean.TRUE.equals(db.sql("select " + condition.replace("currency", "?::text"))
				.param(1, money).query(Boolean.class).single());
	}

	@ParameterizedTest
	@ValueSource(strings = {"payment_currency_known", "balance_entry_currency_known",
			"balance_promise_currency_known"})
	void theSchemaStillHasAruleAboutTheMoneyAtAll(String constraint) {
		assertThat(whatTheSchemaSays(constraint))
				.as("the rule %s is gone from the schema, so nothing here is being compared", constraint)
				.contains("currency")
				.startsWith("CHECK");
	}

	/** Every money the code knows is one all three tables would hold. */
	@ParameterizedTest
	@ValueSource(strings = {"payment_currency_known", "balance_entry_currency_known",
			"balance_promise_currency_known"})
	void everyCurrencyIsAwordTheSchemaKnows(String constraint) {
		for (Currency money : Currency.values()) {
			assertThat(theSchemaTakes(constraint, money.name()))
					.as("the code knows the money '%s' and %s refuses it", money, constraint)
					.isTrue();
		}
	}

	/**
	 * And nothing else is, which is the direction a hand written list gets wrong.
	 *
	 * <p>The two words are not typed out here a second time; they are read off the rule PostgreSQL hands
	 * back. A third word added to any of the three tomorrow arrives in that set on its own and fails
	 * this the same day, instead of sitting in a column unreachable.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"payment_currency_known", "balance_entry_currency_known",
			"balance_promise_currency_known"})
	void andWhatTheSchemaTakesTheCodeKnows(String constraint) {
		Matcher found = SPELLED_OUT.matcher(whatTheSchemaSays(constraint));
		Set<String> saidInTheRule = found.results()
				.map(one -> one.group(1)).collect(Collectors.toSet());

		assertThat(saidInTheRule)
				.as("%s names no money at all, so this is comparing an empty set", constraint)
				.isNotEmpty();
		assertThat(saidInTheRule)
				.as("%s and the Currency enum no longer say the same thing", constraint)
				.isEqualTo(Arrays.stream(Currency.values()).map(Currency::name)
						.collect(Collectors.toSet()));
	}

	/**
	 * And each rule is a rule: something outside it is refused.
	 *
	 * <p>Without this the cases above would all pass against a constraint that takes anything at all,
	 * and a floor that accepts everything holds nothing up.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"payment_currency_known", "balance_entry_currency_known",
			"balance_promise_currency_known"})
	void andAmoneyNobodyNamedIsRefused(String constraint) {
		assertThat(theSchemaTakes(constraint, "USD"))
				.as("%s would take any word at all, so it holds nothing up", constraint)
				.isFalse();
	}

	/**
	 * AND THERE IS NO FOURTH TABLE HOLDING A MONEY THAT NOBODY IS COMPARING.
	 *
	 * <p><b>The floor under the written list above, and it is the reason that list is allowed to be
	 * written.</b> The three constraint names cannot be derived from anything - the schema does not know
	 * these three ask one question - so the sweep is over the SHAPE of the name: every check constraint
	 * in this schema whose name ends in {@code _currency_known}. A fourth table gaining one tomorrow
	 * turns this red and asks for a decision once, rather than drifting out of the comparison in silence.
	 */
	@Test
	void everyRuleAboutAmoneyInTheSchemaIsOneOfTheThree() {
		Set<String> found = Set.copyOf(db.sql("select con.conname from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema() and con.contype = 'c'"
						+ "  and con.conname like '%\\_currency\\_known'")
				.query(String.class).list());

		assertThat(found)
				.as("the sweep found nothing, so it has stopped recognising the rules it is the floor"
						+ " under")
				.isNotEmpty();
		assertThat(found)
				.as("a table gained a rule about a money that nothing in this file is comparing")
				.isEqualTo(THE_RULES);
	}

	/**
	 * AND DINARS ARE THE COUNTRY THE CODEBOOK CALLS SERBIA, asked of {@code country} rather than
	 * asserted.
	 *
	 * <p>{@link Currency#of} turns one two-letter code into dinars and everything else into euro. The
	 * code itself is a codebook key, the same kind of thing {@code BalanceBook.REFERRAL} is, so what
	 * this asks is that the key names a row that really exists and really is Serbia - and that a country
	 * which is NOT that row answers the other way, which is the half a case naming only Serbia would
	 * leave out.
	 *
	 * <p><b>Kosovo needs no case of its own and V2 says why:</b> {@code country_code_not_kosovo} refuses
	 * {@code XK} outright, and the generator that builds the town codebook „rewrites it to RS on the way
	 * in", so a town there already carries this code and is already billed in dinars by the codebook.
	 */
	@Test
	void dinarsAreTheCountryTheCodebookCallsSerbia() {
		String serbia = db.sql("select code from country where name = 'Srbija'")
				.query(String.class).single();

		assertThat(Currency.of(serbia))
				.as("the country the codebook calls Srbija is not the one the code bills in dinars")
				.isEqualTo(Currency.RSD);

		String somewhereElse = db.sql("select code from country where code <> ? order by code limit 1")
				.param(serbia).query(String.class).single();

		assertThat(Currency.of(somewhereElse))
				.as("a country that is not Serbia was billed in dinars, so the rule takes everybody")
				.isEqualTo(Currency.EUR);
	}

	/** And a country that reached this point as nothing is refused rather than billed in euro. */
	@Test
	void anabsentCountryIsRefusedRatherThanBilledInEuro() {
		assertThat(org.assertj.core.api.Assertions.catchThrowable(() -> Currency.of(null)))
				.as("a lost join would have been answered with a price instead of a failure")
				.isInstanceOf(NullPointerException.class);
	}
}
