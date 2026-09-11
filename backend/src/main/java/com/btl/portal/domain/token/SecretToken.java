package com.btl.portal.domain.token;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * A secret the portal hands out once and afterwards only recognises.
 *
 * <p>Three things in this portal are exactly this shape, and the schema says so by
 * giving all three the same column: {@code email_verification_token.token_hash},
 * the session cookie, and the password reset link. Every one of them is
 * {@code ^[0-9a-f]{64}$} - the hex of a SHA-256 - and none of them stores the
 * secret itself.
 *
 * <p><strong>Why the database never holds the secret.</strong> A stolen copy of the
 * database would otherwise be a set of working session cookies and working reset
 * links. Holding only the hash means it is a set of numbers that confirm a secret
 * somebody else already has.
 *
 * <p><strong>Why SHA-256 and not BCrypt here, when passwords use BCrypt.</strong>
 * The two are protecting against different things. A password is short, chosen by a
 * person, and guessable - so it needs an algorithm that is deliberately slow, to
 * make guessing expensive. A token is {@value #BYTES} random bytes: guessing it is
 * not a thing anybody can do at any speed, and the hash is asked about on every
 * single request, so slow would be a cost with nothing bought. Using BCrypt here
 * would be the same mistake as using SHA-256 for a password, in the other
 * direction.
 */
public record SecretToken(String secret, String hash) {

	/**
	 * How many random bytes a token carries.
	 *
	 * <p>Thirty-two, which is 256 bits, and the number is not arbitrary: it is what
	 * the hash it is compared through carries, so anything longer would add nothing
	 * and anything shorter would be the weaker half of the pair.
	 */
	public static final int BYTES = 32;

	private static final SecureRandom RANDOM = new SecureRandom();

	/**
	 * Makes a fresh one.
	 *
	 * <p>The secret is URL safe and carries no padding, because it travels in a link
	 * in an email and in a cookie, and {@code +}, {@code /} and {@code =} all mean
	 * something else in both places.
	 */
	public static SecretToken fresh() {
		byte[] bytes = new byte[BYTES];
		RANDOM.nextBytes(bytes);

		String secret = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
		return new SecretToken(secret, hashOf(secret));
	}

	/**
	 * NEVER THE SECRET, whatever is printed.
	 *
	 * <p>A record writes every one of its fields into its own {@code toString}, so
	 * without this any line that logged the whole object rather than one of its parts
	 * would put a live activation link, session cookie or password reset link into the
	 * log - and a log is usually easier to reach than a database. The whole reason the
	 * schema keeps only the hash is the "somebody took a copy of the database" case,
	 * and a generated {@code toString} walks around it.
	 *
	 * <p>Found by a round on 11.09.2026, before this was wired to anything.
	 */
	@Override
	public String toString() {
		return "SecretToken[hash=" + hash + "]";
	}

	/**
	 * The source of randomness, named so that a case can say what it is.
	 *
	 * <p>Not for callers. It exists because "the numbers are unpredictable" is not a
	 * property any number of samples can demonstrate: five hundred draws from a
	 * generator seeded with forty-two are all different from each other too. What can
	 * be said is WHICH generator, and that is what the case asks.
	 */
	static java.security.SecureRandom source() {
		return RANDOM;
	}

	/**
	 * What a secret somebody has just handed back hashes to, so it can be looked up.
	 *
	 * <p>This is the only way the portal ever asks about a token: it never compares
	 * secrets, it hashes what arrived and looks for the row.
	 */
	public static String hashOf(String secret) {
		return hashOf(secret, "SHA-256");
	}

	/**
	 * The same, with the algorithm named, which exists so that the one branch nobody
	 * can reach in production can be reached in a test.
	 *
	 * <p>Every Java runtime is required to carry SHA-256, so the failure below cannot
	 * happen on a machine this portal runs on. It is still written out rather than
	 * swallowed, because if it ever did happen every token in the portal would
	 * silently stop matching, and "nothing works and nobody knows why" is the worst
	 * possible shape for that.
	 */
	static String hashOf(String secret, String algorithm) {
		MessageDigest digest;
		try {
			digest = MessageDigest.getInstance(algorithm);
		}
		catch (NoSuchAlgorithmException impossible) {
			throw new IllegalStateException(algorithm + " is not on this machine", impossible);
		}
		return HexFormat.of().formatHex(digest.digest(secret.getBytes(StandardCharsets.UTF_8)));
	}

	/**
	 * Whether a secret somebody handed back is the one behind a stored hash.
	 *
	 * <p>The comparison is done in constant time. That is not a formality: comparing
	 * two hex strings with {@code equals} stops at the first character that differs,
	 * so how long the answer takes says how much of the hash was right, and enough
	 * measurements of that reconstruct it one character at a time. It matters less
	 * for a hash than for a secret, because a reconstructed hash is not a working
	 * token - but it costs nothing to do properly and the habit is what keeps the
	 * next comparison safe too.
	 */
	public static boolean matches(String secret, String storedHash) {
		return MessageDigest.isEqual(
				hashOf(secret).getBytes(StandardCharsets.UTF_8),
				storedHash.getBytes(StandardCharsets.UTF_8));
	}
}
