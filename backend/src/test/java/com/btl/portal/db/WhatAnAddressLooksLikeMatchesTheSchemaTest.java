package com.btl.portal.db;

import com.btl.portal.domain.account.WhatAnAddressLooksLike;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE ADDRESSES THE CODE TAKES ARE THE ADDRESSES THE SCHEMA TAKES, and PostgreSQL is
 * the one asked.
 *
 * <p>{@link WhatAnAddressLooksLike} carries a pattern and so does
 * {@code account_email_shape}. Comparing one written pattern with another would be
 * reading rather than measuring: two patterns can be spelt differently and mean the
 * same thing, or spelt the same and behave differently, and neither is visible by
 * looking. So the constraint's own expression is taken out of the catalogue and
 * PostgreSQL is asked to judge every address the code accepts and every address the
 * code refuses. The shape is {@code MemberNumberMatchesTheSchemaTest}'s, in this same
 * package, and for the same reason.
 *
 * <p><b>Why the two copies have to agree at all.</b> The Java one exists so that an
 * address which is not one comes back to the person as "that is not an address"
 * rather than as a 500: a CHECK is an error, and on PostgreSQL an error aborts the
 * whole transaction, so nothing a registration does after that point can be recovered
 * from inside the request. Loosen the Java one and a registration reaches
 * {@code INSERT} and falls over; tighten it and a perfectly storable address is
 * refused by the portal for no reason the schema agrees with.
 *
 * <p><b>Every invisible character in this file is written as its number and never
 * typed.</b> {@code PostmanTest} keeps the same rule about a fold, and for the same
 * reason: a character nobody can see in the source is one nobody can tell from a line
 * somebody wrapped, and half of them are silently rewritten by an editor that thinks
 * it is being helpful.
 */
class WhatAnAddressLooksLikeMatchesTheSchemaTest extends DatabaseTest {

	/**
	 * The six V6 names by number, each one a character that walked through its first
	 * draft: no-break space, figure space, narrow no-break space, zero width space, byte
	 * order mark, soft hyphen.
	 *
	 * <p>{@code lower()} folds none of them, so the unique index over {@code lower(email)}
	 * did not fire either, and the same address with one of these in the middle went in
	 * beside the real one as a second account of the same person.
	 */
	private static final String[] INVISIBLE =
			{"\u00a0", "\u2007", "\u202f", "\u200b", "\ufeff", "\u00ad"};

	/**
	 * THE STANDARD'S LIMIT FOR AN ADDRESS OF ELECTRONIC MAIL, written here from RFC 5321 and read
	 * from nothing in the portal.
	 *
	 * <p>Section 4.5.3.1.3 limits a path to 256 octets, punctuation included, and an address stands
	 * in a path between two angle brackets, so the address is at most 254. It is not read from
	 * {@code WhatAnAddressLooksLike.MOST_AN_ADDRESS_CAN_BE}, because a case built from the number it
	 * tests follows that number wherever it is moved. The route cases write the same number once
	 * more, in {@code WhatAnIndexHoldsTest} in {@code com.btl.portal.web}, where this is not
	 * visible.
	 */
	private static final int THE_STANDARDS_LIMIT = 254;

	/**
	 * A text of three thousand characters, which is what the fault was first met with and is past
	 * what the index keeps (PostgreSQL 18.6, measured by {@code WhatAnIndexHoldsTest}), so that the
	 * shape rule is asked about an address the INDEX would refuse as well as about the ones it
	 * would keep.
	 */
	private static final int THREE_THOUSAND = 3000;

	/** What the schema itself says an address looks like, in its own words. */
	private String whatTheSchemaSays() {
		return db.sql("select pg_get_constraintdef(con.oid) from pg_constraint con"
						+ " join pg_class rel on rel.oid = con.conrelid"
						+ " join pg_namespace ns on ns.oid = rel.relnamespace"
						+ " where ns.nspname = current_schema()"
						+ "  and con.conname = 'account_email_shape'")
				.query(String.class).single();
	}

	/** Whether PostgreSQL, applying its own rule, would take this value. */
	private boolean theSchemaTakes(String value) {
		String rule = whatTheSchemaSays();
		String condition = rule.substring(rule.indexOf('(') + 1, rule.lastIndexOf(')'));

		/* Every mention of the column and not the first, the same way the member number's
		   own agreement test does it: a rule may name the column more than once, and each
		   mention becomes its own parameter carrying the same value. */
		String asked = condition.replace("email", "?");
		var query = db.sql("select " + asked);

		for (int mention = 0; mention < asked.chars().filter(one -> one == '?').count(); mention++) {
			query = query.param(mention + 1, value);
		}

		return Boolean.TRUE.equals(query.query(Boolean.class).single());
	}

	/** Both sides of one value, which is the whole claim of this file, in one place. */
	private void bothAgreeThatItIs(String address, boolean anAddress) {
		assertThat(WhatAnAddressLooksLike.itDoes(address))
				.as("the code and the schema disagree about '%s': the code says %s", address,
						!anAddress)
				.isEqualTo(anAddress);
		assertThat(theSchemaTakes(address))
				.as("the code and the schema disagree about '%s': the schema says %s", address,
						!anAddress)
				.isEqualTo(anAddress);
	}

	@Test
	void theSchemaStillHasARuleAboutTheShapeAtAll() {
		assertThat(whatTheSchemaSays())
				.as("the rule is gone from the schema, so nothing here is being compared")
				.contains("email")
				.startsWith("CHECK");
	}

	/**
	 * Every address the code takes is one the schema would store.
	 *
	 * <p>The ordinary one, the shortest thing there can be either side of the {@code @},
	 * and the shapes that look wrong and are not: a domain with no dot in it is legal and
	 * is what a machine on a local network has, the plus sign is how half the world files
	 * its mail, and the run of punctuation is every character RFC 5322 allows unquoted -
	 * this portal is not a validator of addresses and must not become one.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"petar@primer.rs", "a@b", "PETAR@PRIMER.RS", "petar+btl@primer.rs",
			"p.p@sub.domen.primer.rs", "petar-0123@primer.rs", "!#$%&'*+-/=?^_`{|}~@primer.rs"})
	void everyAddressTheCodeTakesIsOneTheSchemaWouldStore(String address) {
		bothAgreeThatItIs(address, true);
	}

	/**
	 * And everything the code refuses, the schema refuses too.
	 *
	 * <p><b>Both halves of each value, and the second is the one that is easy to leave
	 * out</b>: a code that refused everything would pass the case above by accepting
	 * nothing wrong, while a code that accepted everything would pass this one by refusing
	 * nothing. {@link #bothAgreeThatItIs} puts each value to both.
	 *
	 * <p>The last two are homoglyphs, which are the second account by another road: a
	 * Cyrillic er draws the same picture as a Latin p, so an address that reads as
	 * somebody's is not his.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"", "petar", "@primer.rs", "petar@", "petar@primer@rs",
			"petar primer.rs", "petar@primer.rs ", " petar@primer.rs",
			"petar@primer.rs\n", "petar@primer.rs\t",
			"\u0440etar@primer.rs", "petar@primer.\u0440s"})
	void everythingTheCodeRefusesTheSchemaRefusesToo(String address) {
		bothAgreeThatItIs(address, false);
	}

	/** And an address carrying one of V6's six invisible characters is refused by both. */
	@Test
	void anAddressCarryingAnInvisibleCharacterIsRefusedByBoth() {
		for (String invisible : INVISIBLE) {
			bothAgreeThatItIs("petar" + invisible + "@primer.rs", false);
		}
	}

	/** And nothing at all is not an address, which is the one value SQL cannot be asked. */
	@Test
	void nothingAtAllIsNotAnAddress() {
		assertThat(WhatAnAddressLooksLike.itDoes(null))
				.as("a form that sent no address at all would have reached the INSERT")
				.isFalse();
	}

	/**
	 * THE BOUND THE CODE CARRIES IS THE STANDARD'S 254 AND NOT ANYTHING ELSE.
	 *
	 * <p>It is the plainest case of the lot and it is here on purpose: the number is a fact of RFC
	 * 5321 and not of the schema, so no database can be asked for it, and what holds it is a literal
	 * written from the standard. Every other case about the length reads the constant, and a
	 * constant edited to two thousand (the number a text that goes into an index is bounded at in
	 * the other two places that take one) moves them with it; this one does not move.
	 */
	@Test
	void theBoundTheCodeCarriesIsTheStandardsAndNothingElse() {
		assertThat(WhatAnAddressLooksLike.MOST_AN_ADDRESS_CAN_BE)
				.as("the bound is not the 254 that RFC 5321 gives for an address, so it comes from"
						+ " somewhere else, and nothing in the schema says where")
				.isEqualTo(THE_STANDARDS_LIMIT);
	}

	/**
	 * THE LENGTH IS THE ONE THING THE TWO COPIES DO NOT SHARE, and this is the side of it where
	 * they still agree: the longest address the code takes is one the shape rule takes too.
	 *
	 * <p>Whether that address is also one the INDEX keeps is a different question with a
	 * different answer, and it is asked of the database by {@code WhatAnIndexHoldsTest} in
	 * {@code com.btl.portal.web}, for the reason that file gives. What is held here is only that
	 * the bound did not cut into the shape: an address exactly as long as the standard allows, made
	 * of nothing the shape refuses, is still an address.
	 */
	@Test
	void theLongestAddressTheCodeTakesIsOneTheShapeRuleTakesToo() {
		String longest = "a@" + "b".repeat(THE_STANDARDS_LIMIT - 2);

		assertThat(longest).hasSize(THE_STANDARDS_LIMIT);

		bothAgreeThatItIs(longest, true);
	}

	/**
	 * AND PAST THE BOUND THE CODE REFUSES WHAT THE SHAPE RULE ALONE WOULD TAKE, which is the whole
	 * reason the bound is in the code and not left to the schema.
	 *
	 * <p>{@code account_email_shape} says what an address is made of and nothing about how long it
	 * is, so it takes an address of any length. Two things stand over a long one and neither is in
	 * the shape: the standard's 254, which is the bound the code carries, and
	 * {@code account_email_unique}, which refuses past a couple of thousand characters with an
	 * error that on PostgreSQL aborts the transaction, the 500 the bound is far enough below to
	 * close as well. The values are one character past the bound, twice the bound, and three
	 * thousand (past the index, where the shape rule still says yes), so the rule is not merely
	 * "equal or less", and each is a case of its own so that the first one wrongly accepted cannot
	 * hide the others.
	 *
	 * <p><b>If the day comes that the shape rule carries a length of its own</b>, this case fails
	 * and says so, and the right reading is not that the case is wrong: the bound then has a second
	 * home in the schema, and the two are to be compared the way the shape is, by asking the
	 * database.
	 */
	@ParameterizedTest
	@MethodSource("lengthsPastTheBound")
	void theShapeRuleAloneTakesAnAddressOfAnyLengthWhichIsWhyTheCodeCarriesTheBound(int length) {
		String tooLong = "a@" + "b".repeat(length - 2);

		assertThat(WhatAnAddressLooksLike.itDoes(tooLong))
				.as("the code took an address of %d characters, past the bound it carries", length)
				.isFalse();
		assertThat(theSchemaTakes(tooLong))
				.as("the shape rule refused an address of %d characters by itself, so the length"
						+ " has a second home in the schema and the bound is no longer the only"
						+ " thing that keeps it from the INSERT", length)
				.isTrue();
	}

	/** One character past the standard's limit, twice it, and three thousand. */
	static IntStream lengthsPastTheBound() {
		return IntStream.of(THE_STANDARDS_LIMIT + 1, 2 * THE_STANDARDS_LIMIT, THREE_THOUSAND);
	}

	/**
	 * AND TAKING THE SPACES OFF TURNS AN ADDRESS THE SCHEMA REFUSES INTO ONE IT STORES.
	 *
	 * <p>That is the whole justification for doing it, measured rather than argued: a
	 * space is below {@code 0x21}, so the schema refuses an address with one on either
	 * end, and the person who pasted it out of his mail client cannot see what is wrong.
	 * Both ends of the same value, so a strip that only took one off would fail.
	 *
	 * <p><b>And what it does NOT take off is measured too</b>, because that is the half a
	 * reader would otherwise have to trust. {@link Character#isWhitespace} says no to
	 * U+00A0 by specification and has never heard of U+200B, so those survive the strip -
	 * and are then refused by the shape, loudly, which is the right answer for an address
	 * carrying an invisible character. Trimming them instead would be the fourth wrong
	 * list ADL A38 names.
	 */
	@Test
	void takingTheSpacesOffMakesAnAddressStorableAndTakesNothingElse() {
		String pasted = "  petar@primer.rs \t";

		assertThat(theSchemaTakes(pasted))
				.as("the schema takes an address with spaces around it, so stripping buys nothing")
				.isFalse();
		assertThat(WhatAnAddressLooksLike.withoutTheSpacesAround(pasted))
				.isEqualTo("petar@primer.rs");
		assertThat(theSchemaTakes(WhatAnAddressLooksLike.withoutTheSpacesAround(pasted)))
				.isTrue();

		for (String invisible : INVISIBLE) {
			String carried = invisible + "petar@primer.rs";

			assertThat(WhatAnAddressLooksLike.withoutTheSpacesAround(carried))
					.as("U+%04X was taken off, which is a list this class deliberately does not keep",
							(int) invisible.charAt(0))
					.isEqualTo(carried);
		}
	}
}
