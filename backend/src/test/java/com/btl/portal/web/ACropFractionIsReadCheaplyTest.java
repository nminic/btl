package com.btl.portal.web;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT {@link MePhotoApi#fraction} TAKES AND WHAT IT REFUSES, AND THAT A REFUSAL COSTS NOTHING.
 *
 * <p>The security review of PR 688 measured a denial of service in this one method: {@code new BigDecimal}
 * of a long string costs more than linear time, inside a mapping that holds a connection. And measuring the
 * fix found a second road the length alone does not close: eleven characters, {@code 1E-99999999}, made
 * {@code setScale(8, UNNECESSARY)} divide by ten to the hundred millionth power, 79,6 s on Java 21. Both
 * doors that take a picture read their circle through this method, so both are held here, and
 * {@code ACircleThatCostsTooMuchIsRefusedAtOnceOverRealHttpTest} holds them over a real socket.
 *
 * <p>The time bound is an assertion and not a timeout: a mutation that moves either line back makes the case
 * fail on its own sentence, after paying the cost it was written to keep out.
 */
class ACropFractionIsReadCheaplyTest {

	private static final long A_MOMENT_IN_NANOS = 250_000_000L;

	@Test
	void aFractionLongerThanTheBoundIsRefusedAndOneOnItIsTaken() {
		String onTheBound = "0.5" + "0".repeat(MePhotoApi.AT_MOST_CHARACTERS - 3);

		assertThat(onTheBound).hasSize(MePhotoApi.AT_MOST_CHARACTERS);
		assertThat(MePhotoApi.fraction(onTheBound, false)).isEqualTo(new BigDecimal("0.50000000"));
		assertThat(MePhotoApi.fraction(onTheBound + "0", false))
				.as("a fraction one character over the bound was read")
				.isNull();
	}

	@Test
	void aMillionDigitsAreRefusedBeforeTheyAreParsed() {
		String long_ = "0." + "5".repeat(1_500_000);
		long from = System.nanoTime();

		BigDecimal read = MePhotoApi.fraction(long_, true);

		assertThat(read).isNull();
		assertThat(System.nanoTime() - from)
				.as("a million and a half digits were parsed before they were refused, so a request costs seconds"
						+ " of a thread and a connection from the pool")
				.isLessThan(A_MOMENT_IN_NANOS);
	}

	@Test
	void aShortNumberWithAnEnormousScaleIsRefusedWithoutBeingScaled() {
		long from = System.nanoTime();

		BigDecimal read = MePhotoApi.fraction("1E-99999999", true);

		assertThat(read).isNull();
		assertThat(System.nanoTime() - from)
				.as("eleven characters with a scale of a hundred million were scaled before they were refused")
				.isLessThan(A_MOMENT_IN_NANOS);
	}

	@Test
	void whatTheColumnHoldsIsTakenInWhateverSpellingItArrives() {
		assertThat(MePhotoApi.fraction("0.25", true)).isEqualTo(new BigDecimal("0.25000000"));
		assertThat(MePhotoApi.fraction("  0.25  ", true)).isEqualTo(new BigDecimal("0.25000000"));
		assertThat(MePhotoApi.fraction("5E-1", true)).isEqualTo(new BigDecimal("0.50000000"));
		assertThat(MePhotoApi.fraction("0.1234567800", true)).isEqualTo(new BigDecimal("0.12345678"));
		assertThat(MePhotoApi.fraction("1", false)).isEqualTo(new BigDecimal("1.00000000"));
		assertThat(MePhotoApi.fraction("0E-2147483647", true)).isEqualTo(new BigDecimal("0.00000000"));
	}

	@Test
	void whatTheColumnCannotHoldIsRefused() {
		assertThat(MePhotoApi.fraction(null, true)).isNull();
		assertThat(MePhotoApi.fraction("   ", true)).isNull();
		assertThat(MePhotoApi.fraction("pola", true)).isNull();
		assertThat(MePhotoApi.fraction("-0.1", true)).isNull();
		assertThat(MePhotoApi.fraction("1.00000001", true)).isNull();
		assertThat(MePhotoApi.fraction("0.123456789", true)).as("finer than the column").isNull();
		assertThat(MePhotoApi.fraction("0", false)).as("a circle of no diameter").isNull();
		assertThat(MePhotoApi.fraction("0E-2147483647", false)).as("nought however it is spelt").isNull();
	}
}
