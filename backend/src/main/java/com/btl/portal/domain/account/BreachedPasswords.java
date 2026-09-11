package com.btl.portal.domain.account;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

/**
 * The passwords that are already known to have leaked, read once and held in memory.
 *
 * <p>The owner chose a local list over asking an outside service (11.09.2026), and
 * the reason is in the decision: nothing leaves the server, there is no new
 * processor of personal data to name in the privacy policy before 15.09, and
 * registration does not stop working because somebody else's service is down. The
 * cost he accepted is coverage - a list that travels with the application holds the
 * common ones, not every one.
 *
 * <p><strong>What the file may hold.</strong> One password per line, in UTF-8,
 * blank lines and lines beginning with {@code #} ignored. Every entry must be at
 * least {@link PasswordPolicy#SHORTEST} characters long, and one that is not is
 * refused rather than quietly dropped: a shorter entry can never be reached,
 * because the length is tested first, so its presence means whoever wrote the file
 * believed something about it that is not true.
 */
public final class BreachedPasswords {

	/** Where the list lives when nobody says otherwise. */
	public static final String RESOURCE = "/security/breached-passwords.txt";

	private final Set<String> folded;

	private BreachedPasswords(Set<String> folded) {
		this.folded = folded;
	}

	/**
	 * Reads the list that travels with the application.
	 */
	public static BreachedPasswords fromResource() {
		return fromResource(RESOURCE);
	}

	/**
	 * Reads a named list, which is what lets a test hand in a small one of its own.
	 *
	 * @throws IllegalStateException when the resource is not there at all, because a
	 *                               policy that silently checks an empty list is
	 *                               worse than one that refuses to start
	 */
	public static BreachedPasswords fromResource(String resource) {
		return fromStream(BreachedPasswords.class.getResourceAsStream(resource), resource);
	}

	/**
	 * Reads a list out of an open stream, which is what lets a test hand in one it
	 * has just written without pretending to be a class loader.
	 *
	 * <p>The stream is closed here whatever happens, and a null one is the "not
	 * there" case: {@code getResourceAsStream} says so by returning null rather than
	 * by throwing.
	 *
	 * @param named what to call it when something is wrong with it
	 */
	static BreachedPasswords fromStream(InputStream stream, String named) {
		if (stream == null) {
			throw new IllegalStateException("no list of breached passwords at: " + named);
		}
		try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
			return new BreachedPasswords(read(reader));
		}
		catch (IOException failed) {
			throw new UncheckedIOException(failed);
		}
	}

	private static Set<String> read(BufferedReader reader) throws IOException {
		Set<String> folded = new HashSet<>();
		String line;
		boolean first = true;
		while ((line = reader.readLine()) != null) {
			/* THE BYTE ORDER MARK, which is not whitespace and which `strip` therefore leaves
			   exactly where it is. A file saved by an editor that writes one would put an
			   invisible character on the FIRST entry, so that entry would never match anything a
			   member types - and the password it was supposed to refuse would be accepted.

			   This portal has paid for this class of mistake once already: ADL A38 records
			   U+200B, U+FEFF and U+00AD going straight through a check on the email address that
			   was written as a check on spaces. Found here by a round on 11.09.2026, before the
			   list was replaced by a downloaded one - which is exactly when it would have bitten,
			   because a downloaded file is not one anybody looks at. */
			if (first && !line.isEmpty() && line.charAt(0) == '\uFEFF') {
				line = line.substring(1);
			}
			first = false;

			String entry = line.strip();
			if (entry.isEmpty() || entry.startsWith("#")) {
				continue;
			}
			if (entry.codePointCount(0, entry.length()) < PasswordPolicy.SHORTEST) {
				throw new IllegalStateException(
						"a password shorter than " + PasswordPolicy.SHORTEST + " characters is never"
								+ " checked against the list, because the length is tested first: " + entry);
			}
			folded.add(PasswordPolicy.fold(entry));
		}
		if (folded.isEmpty()) {
			/* AND A FILE THAT HOLDS NOTHING IS REFUSED, not just one that is not there.
			   Until a round on 11.09.2026 only the second was, while the comment above claimed
			   both - and the difference is the whole point: a policy checking an empty list
			   looks exactly like one that works, and goes on looking like it until somebody
			   uses a leaked password. */
			throw new IllegalStateException("the list of breached passwords is empty, so the second"
					+ " rule would refuse nothing at all");
		}
		return folded;
	}

	/** Whether this password is one of them. */
	public boolean knows(String password) {
		return folded.contains(PasswordPolicy.fold(password));
	}

	/** How many it holds, which is what a test over the shipped file reads. */
	public int size() {
		return folded.size();
	}
}
