package com.btl.portal.domain.account;

import java.time.Instant;
import java.util.Objects;

/**
 * Setting a password through a link, which for some members is the only way they
 * ever set one.
 *
 * <p>V18 says why {@code password_hash} is nullable: the owner opens accounts for
 * honorary members and for profiles that exist before the portal launches, and
 * those people never registered, so nobody ever typed a password for them. This
 * is the door they come in by, and it is the same door somebody uses who has
 * forgotten his.
 *
 * <p>The rules are here and the writing is not, so each can be measured without a
 * database.
 */
public final class PasswordReset {

	private PasswordReset() {
	}

	/** A link as this needs to see it: when it stops working, and whether it has
	 *  already been used. */
	public record Link(Instant expiresAt, Instant usedAt) {

		public Link {
			Objects.requireNonNull(expiresAt, "expiresAt");
		}
	}

	/** What is to happen, and unlike signing in, what is to be SAID. */
	public enum Outcome {

		/** Write the password and mark the link used, in that order and together. */
		SET_IT,

		/** The link has been used, has run out, or was never one of ours. */
		THE_LINK_IS_NO_GOOD,

		/** The link is fine and the password is not: too short. */
		THE_PASSWORD_IS_TOO_SHORT,

		/** The link is fine and the password is not: it is in the breach list. */
		THE_PASSWORD_HAS_BEEN_BREACHED
	}

	/**
	 * Whether this link and this password set one.
	 *
	 * <p><b>Here the answer IS said out loud, and that is the opposite of signing
	 * in.</b> Somebody holding a link already proved he reads the address's mail, so
	 * telling him the link has run out reveals nothing he could not learn by asking
	 * for another. And telling him WHY a password was refused is the whole point:
	 * "no" without a reason is a form somebody retries with the same password.
	 *
	 * <p><b>The link is judged before the password.</b> A dead link with a fine
	 * password must not be told the password was fine, or it becomes a way to test
	 * passwords against the breach list at leisure - which is a small thing, but it
	 * is free to avoid.
	 *
	 * @param link     what the database holds, or null when no such link exists
	 * @param typed    what he typed
	 * @param policy   what a password has to be
	 * @param now      the moment, so the link can be asked whether it has run out
	 */
	public static Outcome decide(Link link, String typed, PasswordPolicy policy, Instant now) {
		Objects.requireNonNull(typed, "typed");
		Objects.requireNonNull(policy, "policy");
		Objects.requireNonNull(now, "now");

		if (link == null || link.usedAt() != null || !now.isBefore(link.expiresAt())) {
			return Outcome.THE_LINK_IS_NO_GOOD;
		}

		return switch (policy.judge(typed)) {
			case FINE -> Outcome.SET_IT;
			case TOO_SHORT -> Outcome.THE_PASSWORD_IS_TOO_SHORT;
			case BREACHED -> Outcome.THE_PASSWORD_HAS_BEEN_BREACHED;
		};
	}
}
