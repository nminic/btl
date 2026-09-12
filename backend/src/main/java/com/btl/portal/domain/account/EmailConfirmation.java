package com.btl.portal.domain.account;

import java.time.Instant;
import java.util.Objects;

/**
 * Confirming that somebody reads the address he registered with.
 *
 * <p>V6 built the link and V18 built the one for passwords; they are the same
 * shape and deliberately not the same class, because what they mean when they
 * run out is different. A password link that has expired is asked for again and
 * nothing is lost. A confirmation link that has expired belongs to a REGISTRATION
 * that is still sitting there unconfirmed, and the portal has to decide what to
 * do with it rather than say "no" and forget.
 *
 * <p>The rules are here and the writing is not, so each can be measured without a
 * database.
 */
public final class EmailConfirmation {

	private EmailConfirmation() {
	}

	/**
	 * A link and the account it points at, as this needs to see them.
	 *
	 * @param expiresAt   when the link stops working (V6: a day)
	 * @param confirmedAt when the address was confirmed, or null while it is not
	 */
	public record Link(Instant expiresAt, Instant confirmedAt) {

		public Link {
			Objects.requireNonNull(expiresAt, "expiresAt");
		}
	}

	/** What is to happen, and what is to be said. */
	public enum Outcome {

		/** Mark the address confirmed and take the link away. */
		CONFIRM_IT,

		/** It is already confirmed: say so kindly and do nothing. */
		ALREADY_DONE,

		/** The link has run out. The registration is still there and wants another. */
		THE_LINK_HAS_RUN_OUT,

		/** No such link, which is all anybody can be told about one. */
		THE_LINK_IS_NOT_ONE_OF_OURS
	}

	/**
	 * Whether this link confirms an address.
	 *
	 * <p><b>Already confirmed is its own answer, and it is not an error.</b>
	 * Somebody who clicks the link in the mail twice, or whose mail client fetches
	 * it once on its own, has done nothing wrong and must not be shown a failure.
	 * It is also why this is asked before the expiry: a confirmed address whose link
	 * has since run out is confirmed, and telling its owner the link expired would
	 * send him to ask for another he does not need.
	 *
	 * <p><b>"Not one of ours" and "run out" are told apart, and that is safe here</b>
	 * in a way it is not when signing in. A link carries what {@link
	 * com.btl.portal.domain.token.SecretToken} makes, which is 256 bits of
	 * randomness; nobody guesses one, so learning that a particular one is unknown
	 * teaches nothing about who has registered. What it buys is the difference
	 * between "ask for another" and "that address is not registered here at all",
	 * which is the difference between a member who can finish and one who is stuck.
	 *
	 * <p>This said "sixty-four characters" until a round on 12.09.2026 counted:
	 * sixty-four is the width of the SHA-256 digest kept in the row, and what
	 * travels in the link is forty-three characters of base64. The entropy behind
	 * the argument is the same either way, which is why it is now stated in bits -
	 * a number that does not move when somebody changes how it is written down.
	 */
	public static Outcome decide(Link link, Instant now) {
		Objects.requireNonNull(now, "now");

		if (link == null) {
			return Outcome.THE_LINK_IS_NOT_ONE_OF_OURS;
		}

		if (link.confirmedAt() != null) {
			return Outcome.ALREADY_DONE;
		}

		return now.isBefore(link.expiresAt())
				? Outcome.CONFIRM_IT
				: Outcome.THE_LINK_HAS_RUN_OUT;
	}
}
