package com.btl.portal.domain.account;

import com.btl.portal.domain.account.EmailConfirmation.Link;
import com.btl.portal.domain.account.EmailConfirmation.Outcome;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Confirming that somebody reads the address he registered with. */
class EmailConfirmationTest {

	private static final Instant NOW = Instant.parse("2027-06-15T10:00:00Z");

	@Test
	void aLinkThatIsStillGoodConfirmsTheAddress() {
		assertThat(EmailConfirmation.decide(new Link(NOW.plusSeconds(600), null), NOW))
				.isEqualTo(Outcome.CONFIRM_IT);
	}

	/**
	 * ALREADY CONFIRMED IS ITS OWN ANSWER, AND IT IS NOT A FAILURE.
	 *
	 * <p>Somebody who clicks the link twice, or whose mail client fetches it once on
	 * its own before he ever sees it, has done nothing wrong and must not be shown
	 * an error.
	 */
	@Test
	void alreadyConfirmedIsItsOwnAnswer() {
		assertThat(EmailConfirmation.decide(new Link(NOW.plusSeconds(600), NOW.minusSeconds(60)), NOW))
				.isEqualTo(Outcome.ALREADY_DONE);
	}

	/**
	 * AND IT IS ASKED BEFORE THE EXPIRY, which is the half a single case would miss.
	 *
	 * <p>An address confirmed a month ago, whose link has long since run out, is
	 * confirmed. Asked the other way round its owner would be told the link expired
	 * and would go asking for another he does not need.
	 */
	@Test
	void alreadyConfirmedIsAskedBeforeTheExpiry() {
		assertThat(EmailConfirmation.decide(new Link(NOW.minusSeconds(600), NOW.minusSeconds(900)), NOW))
				.as("a confirmed address was sent to ask for another link")
				.isEqualTo(Outcome.ALREADY_DONE);
	}

	/**
	 * A link that has run out says so, and says it at the moment it runs out.
	 *
	 * <p>Both sides, because a comparison written the other way round is right on
	 * one of them.
	 */
	@Test
	void aLinkThatHasRunOutSaysSo() {
		assertThat(EmailConfirmation.decide(new Link(NOW.plusMillis(1), null), NOW))
				.isEqualTo(Outcome.CONFIRM_IT);
		assertThat(EmailConfirmation.decide(new Link(NOW, null), NOW))
				.as("a link went on working past its own end")
				.isEqualTo(Outcome.THE_LINK_HAS_RUN_OUT);
	}

	/**
	 * AND "NOT ONE OF OURS" IS TOLD APART FROM "RUN OUT".
	 *
	 * <p>Safe here in a way it is not when signing in: a link is sixty-four
	 * characters of randomness and nobody guesses one, so learning that a particular
	 * one is unknown teaches nothing about who has registered. What it buys is the
	 * difference between "ask for another" and "that address is not registered here
	 * at all", which is the difference between a member who can finish and one who
	 * is stuck.
	 */
	@Test
	void aLinkNobodyIssuedIsToldApartFromOneThatRanOut() {
		assertThat(EmailConfirmation.decide(null, NOW))
				.isEqualTo(Outcome.THE_LINK_IS_NOT_ONE_OF_OURS)
				.isNotEqualTo(EmailConfirmation.decide(new Link(NOW.minusSeconds(1), null), NOW));
	}

	@Test
	void whatIsNotThereIsRefusedByName() {
		assertThatThrownBy(() -> EmailConfirmation.decide(new Link(NOW, null), null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("now");
		assertThatThrownBy(() -> new Link(null, null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("expiresAt");
	}

	/**
	 * Every way it can end has its own answer, and no two of them are the same.
	 *
	 * <p>Four outcomes and four states, so nothing is folded together. A version
	 * that answered "not one of ours" to an expired link would pass every case above
	 * except this one.
	 */
	@Test
	void everyWayItCanEndHasItsOwnAnswer() {
		assertThat(java.util.Set.of(
				EmailConfirmation.decide(new Link(NOW.plusSeconds(600), null), NOW),
				EmailConfirmation.decide(new Link(NOW.plusSeconds(600), NOW.minusSeconds(1)), NOW),
				EmailConfirmation.decide(new Link(NOW.minusSeconds(1), null), NOW),
				EmailConfirmation.decide(null, NOW)))
				.as("two ways of ending were given the same answer")
				.hasSize(Outcome.values().length);
	}
}
