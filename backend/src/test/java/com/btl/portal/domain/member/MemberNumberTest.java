package com.btl.portal.domain.member;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Six digits, and what is not six digits. */
class MemberNumberTest {

	@ParameterizedTest(name = "{0} reads as {1}")
	@CsvSource({"1, 000001", "42, 000042", "999, 000999", "1000, 001000", "123456, 123456", "999999, 999999"})
	void aNumberIsWrittenOutToSixDigits(int value, String written) {
		assertThat(MemberNumber.of(value).written()).isEqualTo(written);
		assertThat(MemberNumber.of(value)).hasToString(written);
	}

	/** And reads back as the number it was, which is the half a formatter alone
	 *  does not give. */
	@ParameterizedTest
	@ValueSource(ints = {1, 42, 999, 1000, 123456, 999999})
	void andReadsBackAsTheNumberItWas(int value) {
		assertThat(MemberNumber.of(value).value()).isEqualTo(value);
	}

	/**
	 * PAST THE LAST ONE THERE IS NO NEXT ONE, and it says so.
	 *
	 * <p>Six digits were chosen to outlive the league (PDL P8), so this is a line
	 * nobody is expected to reach. Running past it in silence is what must not
	 * happen: a seven digit number would be handed on to a key, an address and a
	 * printed card without a word. The version this replaces returned '1000000'.
	 */
	@Test
	void pastTheLastNumberThereIsNoNextOne() {
		assertThat(MemberNumber.of(MemberNumber.HIGHEST).written()).isEqualTo("999999");

		assertThatThrownBy(() -> MemberNumber.of(MemberNumber.HIGHEST + 1))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("no member number is left");
	}

	@ParameterizedTest
	@ValueSource(ints = {0, -1, Integer.MIN_VALUE})
	void thereIsNoZerothMember(int value) {
		assertThatThrownBy(() -> MemberNumber.of(value))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("start at 1");
	}

	/**
	 * What is not six digits is not a member number, whatever else it is.
	 *
	 * <p>Every row here is a way somebody could get a number from somewhere other
	 * than the sequence: a number typed without its padding, one typed with too
	 * much, one with a space that survived a form, one with the gender letter the
	 * old portal used and 29.07.2026 dropped, and one written in another script
	 * whose digits are digits to a human and not to this.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"", "1", "12345", "1234567", "12345 ", " 12345", "00 0001", "m00127", "000001a",
			"-00001", "+00001", "٠٠٠٠٠١"})
	void whatIsNotSixDigitsIsNotAMemberNumber(String written) {
		assertThatThrownBy(() -> new MemberNumber(written))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("6 digits");
	}

	@Test
	void thereIsNoMemberNumberThatIsNotThere() {
		assertThatThrownBy(() -> new MemberNumber(null))
				.isInstanceOf(NullPointerException.class)
				.hasMessageContaining("written");
	}

	/**
	 * Lower goes ahead, and the comparison is about NUMBERS.
	 *
	 * <p>The last rung of every ladder on the portal (PDL P12). Six digit strings
	 * happen to sort the same way, so the case is written on the pair that would
	 * separate the two answers if the padding were ever lost: "001000" against
	 * "000999" agrees, "1000" against "999" does not.
	 */
	@Test
	void theLowerNumberGoesAhead() {
		assertThat(MemberNumber.of(999)).isLessThan(MemberNumber.of(1000));
		assertThat(MemberNumber.of(1000)).isGreaterThan(MemberNumber.of(999));
		assertThat(MemberNumber.of(42)).isEqualByComparingTo(MemberNumber.of(42));
	}

	/** And two of the same number are the same member number, which is what makes
	 *  it usable as a key. */
	@Test
	void twoOfTheSameNumberAreOne() {
		assertThat(MemberNumber.of(42)).isEqualTo(new MemberNumber("000042"));
		assertThat(MemberNumber.of(42)).hasSameHashCodeAs(new MemberNumber("000042"));
	}

	/** Six is read from one place, so the day it becomes seven there is one line
	 *  to change and not two. */
	@Test
	void theWidthIsSaidOnceAndTheHighestFollowsFromIt() {
		assertThat(MemberNumber.of(1).written()).hasSize(MemberNumber.WIDTH);
		assertThat(String.valueOf(MemberNumber.HIGHEST)).hasSize(MemberNumber.WIDTH);
	}
}
