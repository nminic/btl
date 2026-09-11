package com.btl.portal.domain.account;

import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.nio.charset.StandardCharsets;

/**
 * How a password is kept, which is never the password.
 *
 * <p>{@code btl/CLAUDE.md} says BCrypt or Argon2, and this is BCrypt - but through
 * Spring's DELEGATING encoder rather than directly, and that choice is the whole
 * point of the class.
 *
 * <p><strong>Why delegating.</strong> What it writes is {@code {bcrypt}$2a$10$...}:
 * the algorithm is stored beside the hash rather than assumed. So moving to Argon2
 * later is one line here, and every password already stored goes on working - it is
 * read with the algorithm it was written with, and rewritten with the new one the
 * next time its owner signs in. Storing a bare hash would make that a migration of
 * every account, which in practice means it never happens.
 *
 * <p><strong>What BCrypt does with a very long password, measured rather than
 * assumed.</strong> BCrypt hashes at most 72 BYTES and silently ignores the rest.
 * That matters here more than it does elsewhere, because the password policy
 * deliberately encourages passphrases: twelve characters minimum and no demand for
 * symbols is a rule that pushes people towards several words. Seventy-two bytes is
 * about seventy Latin characters, or about thirty-six if they are written in
 * Cyrillic or carry Serbian diacritics, because those take two bytes each in UTF-8.
 *
 * <p>Nothing here truncates on purpose and nothing refuses a long password: refusing
 * would be a third rule, and the owner decided there are two. What is done instead
 * is that the limit is MEASURED, in {@code StoredPasswordTest}, so the day somebody
 * moves to Argon2 the case that documents it fails and says why it was there.
 */
public final class StoredPassword {

	/**
	 * How many bytes of a password BCrypt actually reads.
	 *
	 * <p>Not a setting and not a choice: it is what the algorithm does, and it is
	 * named here so that the case which measures it has something to point at.
	 */
	public static final int BYTES_BCRYPT_READS = 72;

	private final PasswordEncoder encoder;

	/** With the encoder the portal uses. */
	public StoredPassword() {
		this(PasswordEncoderFactories.createDelegatingPasswordEncoder());
	}

	/**
	 * With one handed in, which is what lets a test use a deliberately fast one:
	 * BCrypt is slow on purpose, and a hundred cases at the real cost is a minute
	 * of waiting for nothing.
	 */
	public StoredPassword(PasswordEncoder encoder) {
		this.encoder = encoder;
	}

	/**
	 * Turns a password into what is written to the database.
	 *
	 * <p>Two calls with the same password give two different answers, because the
	 * salt is drawn fresh each time. That is not a detail: without it, two members
	 * who chose the same password would be visibly the same in the table.
	 */
	public String of(String password) {
		return encoder.encode(password);
	}

	/**
	 * Whether a typed password is the one that was stored.
	 *
	 * @param typed  what somebody just typed, never null
	 * @param stored what the database holds, never null
	 */
	public boolean matches(String typed, String stored) {
		return encoder.matches(typed, stored);
	}

	/**
	 * Whether what is stored was written by an algorithm the portal has since moved
	 * on from, and should be rewritten while the password is in hand.
	 *
	 * <p>This is the half that makes the delegating encoder worth having. It is only
	 * ever true just after a successful sign in, which is the one moment the plain
	 * password exists in memory and can be hashed again.
	 */
	public boolean shouldBeRewritten(String stored) {
		return encoder.upgradeEncoding(stored);
	}

	/**
	 * How many bytes this password occupies, which is what BCrypt counts.
	 *
	 * <p>Here rather than in a test, because the number a person needs to reason
	 * about is bytes and what they type is characters, and the two differ by a factor
	 * of two for half of the alphabet this portal is written in.
	 */
	public static int bytesOf(String password) {
		return password.getBytes(StandardCharsets.UTF_8).length;
	}
}
