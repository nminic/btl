package com.btl.portal.domain.member;

import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * The code a member's referral link carries: sixteen lowercase hexadecimal
 * characters, drawn and never worked out.
 *
 * <p><b>DRAWN, and that is the whole of the class.</b> ADL, 13.08.2026, out of a
 * security round, in as many words: „Identifikator koji stiti nesto se dodeljuje,
 * nikad ne izvodi iz javnog podatka." The code was first
 * {@code sha256(salt + member number)} cut to ten characters, which is not a one way
 * function but a mapping both ways - one unchanging salt for every member, and a
 * space of a million member numbers that a laptop walks through in a moment. PDL
 * says the same thing from the product side (13.08.2026): „Link nosi kod, nikad
 * clanski broj... Da link nosi njega, svako bi mogao da sastavi tudji link, ili da
 * samom sebi pripise clana kog nije doveo."
 *
 * <p><b>Why it is not a {@link com.btl.portal.domain.token.SecretToken}</b>, which is
 * the type that already draws random bytes here. That one is a secret the portal
 * hands out once and afterwards only recognises, so it stores a digest and never the
 * value; the three things shaped like it are the session cookie, the confirmation
 * link and the password reset link. A referral code is the opposite kind of thing: it
 * is stored as itself, it is shown to the member so that he can send it to somebody,
 * and it lives as long as he does. Hashing it would make it unusable, and its column
 * says so - {@code competitor_referral_code_shape} is sixteen hex characters, where
 * every token column in this schema is sixty-four.
 *
 * <p><b>Eight bytes, which is what sixteen hex characters hold.</b> Not the
 * thirty-two a token carries: a code travels in a link somebody types or reads aloud,
 * and sixty-four characters is not a thing anybody passes on. What it has to be is
 * unguessable enough that nobody assembles somebody else's link, and 2^64 is that by
 * a wide margin - the whole league is a few thousand rows, so the chance of two
 * members ever drawing the same code is vanishingly small, and
 * {@code competitor_referral_code_unique} is what happens if they do.
 *
 * <p><b>The shape is the schema's shape and is not compared with it by reading.</b>
 * Every code this makes is written through {@code INSERT} in {@code RegistrationApi},
 * so {@code competitor_referral_code_shape} judges it at the moment it is stored: a
 * generator that started producing capitals, or seventeen characters, would fail the
 * registration rather than pass a test comparing one written pattern with another.
 */
public record ReferralCode(String written) {

	/**
	 * Sixteen, and it is a count of characters rather than of bytes.
	 *
	 * <p>Half of it is the number of random bytes, because hex writes two characters
	 * per byte. That relation is arithmetic rather than a second constant, which is
	 * what keeps the two from being moved apart by somebody changing one.
	 */
	public static final int WIDTH = 16;

	/**
	 * The shape, and it is {@code competitor_referral_code_shape} in Java.
	 *
	 * <p>Lowercase on purpose: {@link HexFormat#of()} writes lowercase, the schema
	 * demands lowercase, and the shipped members all carry lowercase. A capital here
	 * would be an address that looks like somebody else's and is not.
	 */
	private static final Pattern SIXTEEN_LOWERCASE_HEX = Pattern.compile("^[0-9a-f]{16}$");

	/**
	 * The source of randomness, named so that a case can say WHICH it is.
	 *
	 * <p>The same sentence {@code SecretToken} carries: "the numbers are
	 * unpredictable" is not a property any number of samples can demonstrate, since
	 * five hundred draws from a generator seeded with forty-two are all different from
	 * each other too. What can be said is which generator, and that is what is asked.
	 */
	private static final SecureRandom RANDOM = new SecureRandom();

	public ReferralCode {
		Objects.requireNonNull(written, "written");

		if (!SIXTEEN_LOWERCASE_HEX.matcher(written).matches()) {
			throw new IllegalArgumentException("a referral code is " + WIDTH
					+ " lowercase hexadecimal characters, and '" + written + "' is not");
		}
	}

	/** Draws a fresh one. */
	public static ReferralCode fresh() {
		byte[] bytes = new byte[WIDTH / 2];

		RANDOM.nextBytes(bytes);

		return new ReferralCode(HexFormat.of().formatHex(bytes));
	}

	/** Which generator the codes come from, for the case that asks. Not for callers. */
	static SecureRandom source() {
		return RANDOM;
	}

	@Override
	public String toString() {
		return written;
	}
}
