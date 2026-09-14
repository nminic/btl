package com.btl.portal.domain.member;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The code a member's referral link carries. */
class ReferralCodeTest {

	@Test
	void aFreshOneIsSixteenLowercaseHexadecimalCharacters() {
		assertThat(ReferralCode.fresh().written())
				.hasSize(ReferralCode.WIDTH)
				.matches("^[0-9a-f]{16}$");
	}

	/**
	 * AND IT IS DRAWN, NOT WORKED OUT.
	 *
	 * <p>ADL, 13.08.2026, out of a security round: „Identifikator koji stiti nesto se
	 * dodeljuje, nikad ne izvodi iz javnog podatka." A code worked out of anything the
	 * portal already knows - a member number, an address - is a code anybody holding that
	 * public thing can assemble, and PDL says what that buys him: somebody else's referral
	 * link, or a member he never brought in credited to himself.
	 *
	 * <p><b>What this can and cannot say.</b> It cannot say the numbers are
	 * unpredictable; five hundred draws from a generator seeded with forty-two are all
	 * different from each other too. What it says is that two draws are not the same
	 * value, which is what a code worked out from a constant would fail, and
	 * {@link #theyComeFromTheGeneratorThatIsMeantForSecrets} names the generator, which is
	 * the part no number of samples can demonstrate. {@code SecretToken} carries the same
	 * pair of cases for the same reason.
	 */
	@Test
	void twoDrawsAreTwoDifferentCodes() {
		Set<String> drawn = new HashSet<>();

		for (int draw = 0; draw < 500; draw++) {
			drawn.add(ReferralCode.fresh().written());
		}

		assertThat(drawn)
				.as("five hundred draws produced fewer than five hundred codes, so something"
						+ " about them is not drawn at all")
				.hasSize(500);
	}

	/** And it is the one meant for secrets rather than {@code java.util.Random}. */
	@Test
	void theyComeFromTheGeneratorThatIsMeantForSecrets() {
		assertThat(ReferralCode.source())
				.as("the codes come from a generator whose next value can be worked out from"
						+ " the ones already handed out")
				.isInstanceOf(java.security.SecureRandom.class);
	}

	/**
	 * And a value that is not a code is refused rather than carried.
	 *
	 * <p>Capitals among them, because {@code competitor_referral_code_shape} refuses them
	 * and a code in the wrong case is an address that looks like somebody else's and is
	 * not. The short and the long one are how a width goes wrong.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"", "0123456789abcde", "0123456789abcdef0", "0123456789ABCDEF",
			"0123456789abcdeg", "0123456789abcde ", " 0123456789abcdef", "0123-456789abcde"})
	void aValueThatIsNotACodeIsRefused(String written) {
		assertThatThrownBy(() -> new ReferralCode(written))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("referral code");
	}

	@Test
	void nothingAtAllIsRefusedByName() {
		assertThatThrownBy(() -> new ReferralCode(null))
				.isInstanceOf(NullPointerException.class).hasMessage("written");
	}

	/** And it prints as itself, which is what a message naming one has to be able to do. */
	@Test
	void itPrintsAsItself() {
		ReferralCode code = ReferralCode.fresh();

		assertThat(code).hasToString(code.written());
	}
}
