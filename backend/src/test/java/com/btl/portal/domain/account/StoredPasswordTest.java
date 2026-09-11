package com.btl.portal.domain.account;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.NoOpPasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * How a password is kept, and the two things about it that are easy to get wrong
 * without anybody noticing.
 *
 * <p>The cases run against a BCrypt encoder at its cheapest setting rather than the
 * portal's, because BCrypt is slow on purpose and the cost is the only difference
 * that matters to what is measured here. The one case that is about the PORTAL's
 * encoder rather than about BCrypt says so and builds its own.
 */
class StoredPasswordTest {

	/** Cheap on purpose: four rounds instead of ten, same algorithm. */
	private final StoredPassword stored = new StoredPassword(new BCryptPasswordEncoder(4));

	private static final String PASSWORD = "konj baterija spajalica";

	/** What is written is never the password, and it does match it. */
	@Test
	void whatIsWrittenIsNotThePasswordAndStillMatchesIt() {
		String written = stored.of(PASSWORD);

		assertThat(written).doesNotContain(PASSWORD);
		assertThat(stored.matches(PASSWORD, written)).isTrue();
		assertThat(stored.matches("nesto drugo sasvim", written)).isFalse();
	}

	/**
	 * A stored value the portal does not recognise is "no", not an error.
	 *
	 * <p>On the path this sits on - somebody signing in - an exception would be a
	 * server error rather than "wrong password", and a person who mistyped his
	 * password and a row that has been corrupted would see completely different
	 * things while only one of them is his to fix.
	 *
	 * <p>Three shapes, because the encoder treats them differently and only one of
	 * them was ever safe: nothing at all, a value with no prefix, and a value whose
	 * prefix names an algorithm that does not exist. Found by a round on 11.09.2026,
	 * before this was wired to anything.
	 */
	@Test
	void aStoredValueThePortalDoesNotRecogniseIsNoRatherThanAnError() {
		StoredPassword portal = new StoredPassword();

		assertThat(portal.matches(PASSWORD, "")).isFalse();
		assertThat(portal.matches(PASSWORD, "ovo-nije-nikakav-otisak"))
				.as("a stored value with no prefix was a server error instead of a refusal")
				.isFalse();
		assertThat(portal.matches(PASSWORD, "{nepoznato}bilo-sta"))
				.as("a prefix naming an algorithm nobody has was a server error instead of a refusal")
				.isFalse();

		assertThat(portal.matches(PASSWORD, portal.of(PASSWORD)))
				.as("the guard swallowed a real answer as well")
				.isTrue();
	}

	/**
	 * Two members who choose the same password are not visibly the same in the
	 * table.
	 *
	 * <p>This is what the salt buys, and it is worth a case of its own: an encoder
	 * written without one passes every other test in this file.
	 */
	@Test
	void theSamePasswordIsWrittenDifferentlyEveryTime() {
		assertThat(stored.of(PASSWORD))
				.as("two members with the same password would be visibly the same in the table")
				.isNotEqualTo(stored.of(PASSWORD));

		assertThat(stored.matches(PASSWORD, stored.of(PASSWORD))).isTrue();
	}

	/**
	 * THE ALGORITHM IS WRITTEN BESIDE THE HASH, which is what makes moving to
	 * another one possible at all.
	 *
	 * <p>This is the one case about the portal's own encoder rather than about
	 * BCrypt, so it builds it. Without the prefix, changing the algorithm later
	 * would mean every stored password becomes unreadable at once, and in practice
	 * that means the algorithm is never changed.
	 */
	@Test
	void theAlgorithmIsWrittenBesideTheHash() {
		assertThat(new StoredPassword().of(PASSWORD))
				.as("the hash does not say what wrote it, so nothing can ever replace it")
				.startsWith("{bcrypt}$2a$");
	}

	/**
	 * And a password written by an older algorithm is recognised as one to rewrite.
	 *
	 * <p>Measured with an encoder that is deliberately not the portal's: anything
	 * stored under a different algorithm has to come back as "rewrite this", and
	 * anything stored under the current one must not.
	 */
	@Test
	void aPasswordWrittenByAnOlderAlgorithmIsMarkedForRewriting() {
		StoredPassword portal = new StoredPassword();

		@SuppressWarnings("deprecation")
		String plain = "{noop}" + NoOpPasswordEncoder.getInstance().encode(PASSWORD);

		assertThat(portal.shouldBeRewritten(plain))
				.as("a password kept under an algorithm the portal has left would stay that way for ever")
				.isTrue();
		assertThat(portal.shouldBeRewritten(portal.of(PASSWORD)))
				.as("every sign in would rewrite a password that is already current")
				.isFalse();
		assertThat(portal.matches(PASSWORD, plain))
				.as("a member whose password predates the change could no longer sign in")
				.isTrue();
	}

	/**
	 * BCRYPT READS SEVENTY-TWO BYTES AND NO MORE, and this is where that is written
	 * down.
	 *
	 * <p>It matters here more than it does elsewhere, because the password policy
	 * deliberately encourages passphrases. Two passwords that agree on their first
	 * seventy-two bytes and differ after them are the same password to BCrypt, and
	 * nothing about that is visible to anybody: both sign in, and the member believes
	 * his hundred characters are doing work.
	 *
	 * <p>Nothing here refuses a long password - refusing would be a third rule and
	 * the owner decided there are two. What this does is MEASURE the limit, so that
	 * the day the portal moves to Argon2 this case fails and says why it existed.
	 */
	@Test
	void bcryptReadsSeventyTwoBytesAndTheRestOfALongPassphraseIsNotRead() {
		String seventyTwo = "a".repeat(StoredPassword.BYTES_BCRYPT_READS);
		String andMore = seventyTwo + " i jos ovoliko teksta koji se nikad ne cita";

		assertThat(StoredPassword.bytesOf(seventyTwo)).isEqualTo(StoredPassword.BYTES_BCRYPT_READS);

		assertThat(stored.matches(andMore, stored.of(seventyTwo)))
				.as("BCrypt has stopped ignoring what is past its limit, so this case is obsolete"
						+ " and the comment above it is wrong")
				.isTrue();
	}

	/**
	 * And Serbian letters take two bytes each, which halves how much of a passphrase
	 * is read.
	 *
	 * <p>Seventy-two bytes is about seventy Latin characters and about thirty-six
	 * written in Cyrillic or with the diacritics this portal's own collation is named
	 * after. That is the number somebody reasoning about the limit needs, and it is
	 * not the number of characters he sees.
	 */
	@Test
	void serbianLettersTakeTwoBytesEach() {
		assertThat(StoredPassword.bytesOf("cccc")).isEqualTo(4);
		assertThat(StoredPassword.bytesOf("čččč"))
				.as("the count is of characters rather than of bytes, and BCrypt counts bytes")
				.isEqualTo(8);
		assertThat(StoredPassword.bytesOf("ћћћћ")).isEqualTo(8);
	}
}
