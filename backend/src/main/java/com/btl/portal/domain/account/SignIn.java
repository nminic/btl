package com.btl.portal.domain.account;

import java.time.Instant;
import java.util.Objects;

/**
 * What happens when somebody types an address and a password.
 *
 * <p>The rules are here and the writing is not, so that every one of them can be
 * measured without a database: this decides, and the caller carries the decision
 * out.
 *
 * <p><b>Nothing the answer carries says whether the address exists.</b> An
 * account nobody has, an account with the wrong password, an account with no
 * password at all and a locked account all come back the same way. Told apart,
 * the sign in form becomes a way of asking the portal who its members are, which
 * is a question it must not answer to somebody who is not one.
 *
 * <p>The one thing that IS told apart is what the server does next, and that is
 * the whole reason this returns more than a boolean: a wrong password is counted
 * against the account and a missing account is not, because counting one would
 * let anybody lock an account he does not own by typing at it ten times.
 */
public final class SignIn {

	/** Ten misses in a row and the account is shut (owner, 11.09.2026). */
	public static final int ENOUGH_MISSES_TO_LOCK = 10;

	/** How long it stays shut. Not in the schema, and V18 says why: a column holds
	 *  one moment, and a length is the difference between two. */
	public static final java.time.Duration LOCKED_FOR = java.time.Duration.ofMinutes(15);

	private SignIn() {
	}

	/** An account as this needs to see it: what it can be compared against, and
	 *  what has happened at it lately. */
	public record Account(String passwordHash, int failedSignIns, Instant lockedUntil) {

		public Account {
			if (failedSignIns < 0) {
				throw new IllegalArgumentException("misses cannot be counted backwards: " + failedSignIns);
			}
		}
	}

	/** What the caller is to do, which is never the same as what to say. */
	public enum Outcome {

		/** Let him in, forget the misses, and open a session. */
		WELCOME,

		/** Count the miss, and shut the account if that was the tenth. */
		COUNT_THE_MISS,

		/** Do nothing at all: the account is shut, or there is none. */
		DO_NOTHING
	}

	/**
	 * Whether somebody who typed that password gets in.
	 *
	 * @param account what the database holds, or null when there is no such address
	 * @param typed   what he typed, which may be anything at all
	 * @param now     the moment, so a lock can be asked whether it has run out
	 */
	public static Outcome decide(Account account, String typed, Instant now) {
		Objects.requireNonNull(typed, "typed");
		Objects.requireNonNull(now, "now");

		/* No such address: nothing to count, because the count lives on a row and
		   there is none. This is also why a stranger cannot lock somebody out of an
		   account that does not exist - there is nothing to lock. */
		if (account == null) {
			return Outcome.DO_NOTHING;
		}

		/* Shut, and still shut: not even the right password opens it, or the lock
		   would be a suggestion. `isBefore` and not `isAfter` at the boundary means
		   the moment the lock runs out it is over, rather than one moment later. */
		if (account.lockedUntil() != null && now.isBefore(account.lockedUntil())) {
			return Outcome.DO_NOTHING;
		}

		/* No password on the account at all, which V18 says is a real state: the
		   owner opens accounts for honorary members and they set one through the
		   reset link. There is nothing to compare against, and nothing to count
		   either - a miss against an account nobody can sign in to would let anybody
		   shut it for ever. */
		if (account.passwordHash() == null) {
			return Outcome.DO_NOTHING;
		}

		return new StoredPassword().matches(typed, account.passwordHash())
				? Outcome.WELCOME
				: Outcome.COUNT_THE_MISS;
	}

	/**
	 * What the count becomes after a miss.
	 *
	 * <p>Its own answer rather than a line at the call site, because the tenth miss
	 * is the one that shuts the account and "the tenth" is exactly the sort of
	 * thing that gets written as the ninth.
	 */
	public static int missesAfter(int before) {
		if (before < 0) {
			throw new IllegalArgumentException("misses cannot be counted backwards: " + before);
		}

		return before + 1;
	}

	/**
	 * When the account is shut until, after that miss, or null while it stays open.
	 *
	 * <p>The count is the one AFTER the miss, so the tenth shuts it. Every further
	 * miss shuts it again from the moment of the miss, which is what makes guessing
	 * cost more the longer it goes on rather than the same every time.
	 */
	public static Instant lockedUntilAfter(int missesNow, Instant now) {
		Objects.requireNonNull(now, "now");

		return missesNow >= ENOUGH_MISSES_TO_LOCK ? now.plus(LOCKED_FOR) : null;
	}
}
