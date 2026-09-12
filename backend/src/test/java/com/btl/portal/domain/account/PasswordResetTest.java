package com.btl.portal.domain.account;

import com.btl.portal.domain.account.PasswordReset.Link;
import com.btl.portal.domain.account.PasswordReset.Outcome;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Setting a password through a link. */
class PasswordResetTest {

	private static final Instant NOW = Instant.parse("2027-06-15T10:00:00Z");

	private static final PasswordPolicy POLICY = new PasswordPolicy(BreachedPasswords.fromResource());

	private static final String FINE = "sasvim nova lozinka za ligu";

	/**
	 * Long enough and still refused, which is the only way to tell the two refusals
	 * apart.
	 *
	 * <p>Taken from the list rather than invented: a password that merely looks
	 * common would be judged FINE and the case would then be measuring the length
	 * rule twice. Sixteen characters, so the length rule cannot be what refuses it.
	 */
	private static final String BREACHED = "passwordpassword";

	private static Link alive() {
		return new Link(NOW.plusSeconds(600), null);
	}

	@Test
	void aGoodLinkAndAGoodPasswordSetIt() {
		assertThat(PasswordReset.decide(alive(), FINE, POLICY, NOW)).isEqualTo(Outcome.SET_IT);
	}

	/**
	 * A LINK WORKS ONCE.
	 *
	 * <p>The schema cannot say this: `used_at` is a column anybody could write
	 * twice, and a security round on 11.09.2026 measured exactly that. Until a
	 * trigger says otherwise, this is where "once" lives, and the case is what keeps
	 * it there.
	 */
	@Test
	void aLinkWorksOnce() {
		assertThat(PasswordReset.decide(new Link(NOW.plusSeconds(600), NOW.minusSeconds(1)), FINE, POLICY, NOW))
				.isEqualTo(Outcome.THE_LINK_IS_NO_GOOD);
	}

	/**
	 * And it stops at the moment it says it does.
	 *
	 * <p>Both sides, because a comparison written the other way round is right on
	 * one of them: a moment before the end it works, and at the end itself it does
	 * not. A link is not like a lock somebody is waiting out - the boundary belongs
	 * to the server, and a link is asked for again for nothing.
	 */
	@Test
	void andItStopsAtTheMomentItSaysItDoes() {
		assertThat(PasswordReset.decide(new Link(NOW.plusMillis(1), null), FINE, POLICY, NOW))
				.isEqualTo(Outcome.SET_IT);
		assertThat(PasswordReset.decide(new Link(NOW, null), FINE, POLICY, NOW))
				.as("a link went on working past its own end")
				.isEqualTo(Outcome.THE_LINK_IS_NO_GOOD);
	}

	@Test
	void aLinkNobodyIssuedIsNoGood() {
		assertThat(PasswordReset.decide(null, FINE, POLICY, NOW)).isEqualTo(Outcome.THE_LINK_IS_NO_GOOD);
	}

	/**
	 * WHY A PASSWORD WAS REFUSED IS SAID OUT LOUD, and that is the opposite of
	 * signing in.
	 *
	 * <p>Somebody holding a link already proved he reads that address's mail, so
	 * there is nothing left to hide from him - and "no" without a reason is a form
	 * somebody retries with the same password.
	 */
	@Test
	void whyAPasswordWasRefusedIsSaidOutLoud() {
		assertThat(PasswordReset.decide(alive(), "kratka", POLICY, NOW))
				.isEqualTo(Outcome.THE_PASSWORD_IS_TOO_SHORT);
		assertThat(PasswordReset.decide(alive(), BREACHED, POLICY, NOW))
				.as("a password from the breach list was accepted, or refused for the wrong reason")
				.isEqualTo(Outcome.THE_PASSWORD_HAS_BEEN_BREACHED);
	}

	/**
	 * THE LINK IS JUDGED BEFORE THE PASSWORD.
	 *
	 * <p>A dead link with a fine password must not be told the password was fine, or
	 * the form becomes a way to test passwords against the breach list at leisure.
	 * A small thing, and free to avoid: the two rows here differ only in which of
	 * the two is wrong, and both must answer about the link.
	 */
	@Test
	void theLinkIsJudgedBeforeThePassword() {
		Link dead = new Link(NOW.minusSeconds(1), null);

		assertThat(PasswordReset.decide(dead, FINE, POLICY, NOW)).isEqualTo(Outcome.THE_LINK_IS_NO_GOOD);
		assertThat(PasswordReset.decide(dead, BREACHED, POLICY, NOW))
				.as("a dead link still said something about the password")
				.isEqualTo(Outcome.THE_LINK_IS_NO_GOOD);
	}

	@Test
	void whatIsNotThereIsRefusedByName() {
		assertThatThrownBy(() -> PasswordReset.decide(alive(), null, POLICY, NOW))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("typed");
		assertThatThrownBy(() -> PasswordReset.decide(alive(), FINE, null, NOW))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("policy");
		assertThatThrownBy(() -> PasswordReset.decide(alive(), FINE, POLICY, null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("now");
		assertThatThrownBy(() -> new Link(null, null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("expiresAt");
	}
}
