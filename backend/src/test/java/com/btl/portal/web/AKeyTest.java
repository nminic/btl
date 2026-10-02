package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.convert.ConversionService;
import org.springframework.jdbc.core.simple.JdbcClient;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT A KEY IS, AND THE ONE KEY NOBODY HAS.
 *
 * <p>{@code AWordInAKeyOverRealHttpTest} asks every route over a socket and is the case that says
 * a word is answered as a number that matches no row. This is the unit under it: what the type
 * reads, that Spring is really told to read it, and that the key it falls back to cannot be the
 * key of a row.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class AKeyTest {

	@Autowired
	private JdbcClient db;

	/** The conversion service the dispatcher binds path variables with, asked for by name. */
	@Autowired
	@Qualifier("mvcConversionService")
	private ConversionService conversion;

	/**
	 * DIGITS ARE A KEY, AND AT MOST EIGHTEEN OF THEM.
	 *
	 * <p>Leading zeros are digits, which is what the three routes of 02.10.2026 already did and
	 * what Spring did before them. Eighteen nines is the longest, because it is smaller than the
	 * largest {@code long}.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"0", "7", "007", "999999999999999999"})
	void digitsAreAKey(String spelt) {
		assertThat(AKey.read(spelt)).isEqualTo(new AKey(Long.parseLong(spelt)));
	}

	/**
	 * EVERYTHING ELSE IS THE KEY NOBODY HAS.
	 *
	 * <p>Each of these is something Spring's own conversion accepts, rejects or throws on, and the
	 * three are told apart on purpose: a plus sign and {@code 0x7} and a space were read as numbers
	 * before this type; nineteen nines does not fit a {@code long}, so a bound one digit too wide
	 * parses it and throws, which is a 500; and the last one is made of digits that are not the
	 * ones the sequences count in, which {@code \d} would accept under one flag and {@code [0-9]}
	 * never does. A line feed on the end is what a pattern anchored with {@code $} lets through.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"", "nije-kljuc", "+7", "-7", "0x7", "0X7", "7 ", " 7", "7\n", "1.5",
			"1e3", "9999999999999999999", "99999999999999999999", "١٢٣", "½"})
	void everythingElseIsTheKeyNobodyHas(String spelt) {
		assertThat(AKey.read(spelt)).isEqualTo(AKey.NONE);
	}

	/**
	 * SPRING IS TOLD TO READ IT, which is the junction between this type and every route that takes
	 * it.
	 *
	 * <p>Without the registration a {@code @PathVariable} of this type is converted by Spring's
	 * generic object-to-object conversion, which finds no constructor taking text and answers
	 * 400 for every key, a number included. The comparison below is asked of the very service the
	 * dispatcher binds with, so it falls the day the registration is lost or the wrong service is
	 * told.
	 */
	@Test
	void springReadsAPathVariableOfThisTypeThroughIt() {
		assertThat(conversion.convert("7", AKey.class)).isEqualTo(new AKey(7));
		assertThat(conversion.convert("nije-kljuc", AKey.class)).isEqualTo(AKey.NONE);
		assertThat(conversion.convert("0x7", AKey.class)).isEqualTo(AKey.NONE);
	}

	/**
	 * NO SEQUENCE THE DATABASE HAS CAN PRODUCE THE KEY NOBODY HAS.
	 *
	 * <p><b>Read off the catalog and not off a list of sequences</b>, so a table added tomorrow is
	 * covered on the day it is made: every sequence says where it starts, how far it goes either way
	 * and by how much it steps, and the key nobody has is reachable by one of them only if it lies
	 * between its bounds on one of its steps. A key is a sequence's value, so a sequence that could
	 * reach it is a row that could be given it, and a word would then act on that row.
	 *
	 * <p>The question is asked of a key that IS reachable first, because a catalog query that found
	 * nothing for every number would make the answer below true while asking about nothing.
	 */
	@Test
	void noSequenceCanProduceTheKeyNobodyHas() {
		assertThat(sequencesThatCanProduce(1))
				.as("the query finds no sequence that can produce 1, so it asks about nothing")
				.isPositive();

		assertThat(sequencesThatCanProduce(AKey.NONE.value()))
				.as("a sequence can produce %d, the key an address that names none stands for, so"
						+ " a word would act on a row", AKey.NONE.value())
				.isZero();
	}

	private long sequencesThatCanProduce(long key) {
		return db.sql("select count(*) from pg_sequences"
						+ " where ? between min_value and max_value"
						+ " and mod(? - start_value, increment_by) = 0")
				.params(key, key)
				.query(Long.class).single();
	}
}
