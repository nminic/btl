package com.btl.portal.domain.token;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The secret the portal hands out once and afterwards only recognises.
 *
 * <p>Three things in the schema are this shape and every one of them carries the
 * same column, {@code ^[0-9a-f]{64}$}. So the cases here are mostly about that
 * shape, about the secret never being derivable from it, and about the secret being
 * safe to put in a link and in a cookie.
 */
class SecretTokenTest {

	/** The hash is exactly what the schema will accept, in all three tables. */
	@Test
	void theHashIsTheShapeEveryTokenColumnDemands() {
		assertThat(SecretToken.fresh().hash())
				.as("the hash would be refused by email_verification_token, account_session"
						+ " and password_reset_token alike")
				.matches("^[0-9a-f]{64}$");
	}

	/**
	 * The secret is safe in a link and in a cookie.
	 *
	 * <p>It travels in both, and {@code +}, {@code /} and {@code =} all mean
	 * something else in each: the first two are a query separator and a path, and
	 * the third ends a cookie's value. A secret carrying one of them arrives as a
	 * different secret, and the member sees "this link is not valid".
	 */
	@Test
	void theSecretIsSafeInALinkAndInACookie() {
		String secret = SecretToken.fresh().secret();

		assertThat(secret).matches("^[A-Za-z0-9_-]+$");
		assertThat(secret).doesNotContain("+", "/", "=");
	}

	/** And it carries the full weight it claims to. */
	@Test
	void theSecretCarriesTheBytesItClaims() {
		String secret = SecretToken.fresh().secret();

		/* Base64 without padding: four characters for every three bytes, rounded up. */
		assertThat(secret.length())
				.as("the secret is shorter than the %d bytes it is supposed to carry", SecretToken.BYTES)
				.isEqualTo((SecretToken.BYTES * 4 + 2) / 3);
	}

	/**
	 * Two tokens are never the same, measured over enough of them to notice.
	 *
	 * <p>A generator that returned a constant, or seeded itself the same way every
	 * time, passes every other case in this file.
	 */
	@Test
	void everyTokenIsDifferent() {
		Set<String> secrets = new HashSet<>();
		Set<String> hashes = new HashSet<>();

		IntStream.range(0, 500).forEach(one -> {
			SecretToken token = SecretToken.fresh();
			secrets.add(token.secret());
			hashes.add(token.hash());
		});

		assertThat(secrets).as("two tokens came out the same").hasSize(500);
		assertThat(hashes).as("two different secrets hashed to the same thing").hasSize(500);
	}

	/**
	 * NOTHING PRINTED EVER CARRIES THE SECRET.
	 *
	 * <p>A record writes every field into its own {@code toString}, so this is the one
	 * case standing between a live session cookie and a log line. A round on
	 * 11.09.2026 found it printing the secret in full.
	 */
	@Test
	void nothingPrintedEverCarriesTheSecret() {
		SecretToken token = SecretToken.fresh();

		assertThat(token.toString())
				.as("a line that logged the whole token would put a live secret in the log")
				.doesNotContain(token.secret())
				.contains(token.hash());
	}

	/**
	 * And the numbers come from a generator that is meant for this.
	 *
	 * <p>"Unpredictable" is not a property any number of samples can show: five hundred
	 * draws from a generator seeded with forty-two are all different from each other
	 * too, and every other case in this file passes with one. What can be said is WHICH
	 * generator, so that is what this asks. A round on 11.09.2026 measured exactly that
	 * gap.
	 */
	@Test
	void theNumbersComeFromAGeneratorMeantForThis() {
		assertThat(SecretToken.source())
				.as("the source of randomness is no longer one built for secrets")
				.isInstanceOf(java.security.SecureRandom.class);
	}

	/** The hash does not carry the secret, in either direction. */
	@Test
	void theHashSaysNothingAboutTheSecret() {
		SecretToken token = SecretToken.fresh();

		assertThat(token.hash()).doesNotContain(token.secret());
		assertThat(token.secret()).doesNotContain(token.hash());
	}

	/**
	 * The same secret always hashes to the same thing, which is what makes looking
	 * it up possible at all.
	 */
	@Test
	void theSameSecretAlwaysHashesToTheSameThing() {
		SecretToken token = SecretToken.fresh();

		assertThat(SecretToken.hashOf(token.secret())).isEqualTo(token.hash());
		assertThat(SecretToken.hashOf(token.secret())).isEqualTo(SecretToken.hashOf(token.secret()));
	}

	/**
	 * A known value, so that the hash is the one everybody else computes too.
	 *
	 * <p>Without this, an implementation that hashed something slightly different -
	 * the secret with a newline, or in another encoding - would pass every case
	 * above, and would go on working until somebody had to verify a token against a
	 * hash computed anywhere else.
	 */
	@Test
	void theHashIsSha256OfTheSecretAndNothingElse() {
		assertThat(SecretToken.hashOf("abc"))
				.as("this is not SHA-256 of the secret's UTF-8 bytes")
				.isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");

		assertThat(SecretToken.hashOf(""))
				.isEqualTo("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
	}

	/** Recognising a secret works, and recognising the wrong one does not. */
	@Test
	void aSecretIsRecognisedAndAnythingElseIsNot() {
		SecretToken token = SecretToken.fresh();

		assertThat(SecretToken.matches(token.secret(), token.hash())).isTrue();
		assertThat(SecretToken.matches(SecretToken.fresh().secret(), token.hash())).isFalse();
		assertThat(SecretToken.matches("", token.hash())).isFalse();
	}

	/**
	 * And a hash that is nearly right is as wrong as one that is not.
	 *
	 * <p>The comparison is done in constant time, so a stored hash differing in its
	 * last character is refused exactly as a stored hash differing in its first one
	 * is. This measures the answer rather than the timing - timing is not something a
	 * test on a shared machine can measure honestly - but it is what fails if the
	 * comparison is ever replaced by something that returns early on a length
	 * mismatch and lets a short hash through.
	 */
	@Test
	void aNearlyRightHashIsAsWrongAsAnyOther() {
		SecretToken token = SecretToken.fresh();
		String hash = token.hash();

		String lastCharacterOff = hash.substring(0, 63) + (hash.endsWith("a") ? "b" : "a");
		String firstCharacterOff = (hash.startsWith("a") ? "b" : "a") + hash.substring(1);
		String truncated = hash.substring(0, 32);

		assertThat(SecretToken.matches(token.secret(), lastCharacterOff)).isFalse();
		assertThat(SecretToken.matches(token.secret(), firstCharacterOff)).isFalse();
		assertThat(SecretToken.matches(token.secret(), truncated))
				.as("a hash that is only half there was accepted")
				.isFalse();
	}
	/**
	 * An algorithm the machine does not carry stops the portal rather than being
	 * swallowed.
	 *
	 * <p>Every Java runtime is required to carry SHA-256, so this cannot happen where
	 * the portal runs. It is measured anyway, because the alternative shape - catching
	 * it and returning something - would make every token in the portal silently stop
	 * matching, and "nothing works and nobody knows why" is the worst possible answer.
	 */
	@Test
	void anAlgorithmTheMachineDoesNotCarryStopsThePortal() {
		org.assertj.core.api.Assertions
				.assertThatThrownBy(() -> SecretToken.hashOf("bilo sta", "NE-POSTOJI-256"))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("NE-POSTOJI-256")
				.hasMessageContaining("is not on this machine");
	}

}
