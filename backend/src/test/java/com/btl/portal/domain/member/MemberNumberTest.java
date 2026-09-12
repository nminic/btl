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
	 * Lower goes ahead, which is the last rung of every ladder on the portal
	 * (PDL P12).
	 *
	 * <p>This says the ORDER and nothing beyond it. Whether the comparison reads the
	 * number or the text cannot be measured from outside the class: the constructor
	 * lets nothing through that is not six digits wide, and at equal widths the two
	 * agree on every pair there is. The claim that this case separated them stood
	 * here until a round on 11.09.2026 measured it and found otherwise.
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

	/**
	 * THE THREE PLACES THAT CARRY THE WIDTH AGREE, which is what can be said instead
	 * of claiming there is one.
	 *
	 * <p>It is written in three: the constant, the ceiling, and the pattern the
	 * constructor checks against. That is a cost, it is named in the constant's own
	 * comment, and what this case does is make moving one of them alone fail here
	 * rather than wait to be noticed.
	 *
	 * <p>The pattern is asked through BEHAVIOUR rather than read: reading it would
	 * say where the six is written and never what it does. One digit short and one
	 * digit long are both refused, and one of exactly the width is taken.
	 */
	@Test
	void theThreePlacesThatCarryTheWidthAgree() {
		assertThat(MemberNumber.of(1).written()).hasSize(MemberNumber.WIDTH);
		assertThat(String.valueOf(MemberNumber.HIGHEST)).hasSize(MemberNumber.WIDTH);

		String exactly = "1".repeat(MemberNumber.WIDTH);

		assertThat(new MemberNumber(exactly).written()).isEqualTo(exactly);
		assertThatThrownBy(() -> new MemberNumber("1".repeat(MemberNumber.WIDTH - 1)))
				.isInstanceOf(IllegalArgumentException.class);
		assertThatThrownBy(() -> new MemberNumber("1".repeat(MemberNumber.WIDTH + 1)))
				.isInstanceOf(IllegalArgumentException.class);
	}
}
