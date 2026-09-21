package com.btl.portal.domain.verification;

import com.btl.portal.domain.verification.HoldingAnItem.Answer;
import com.btl.portal.domain.verification.HoldingAnItem.Hold;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHETHER SOMEBODY ELSE IS READING THIS ITEM RIGHT NOW.
 *
 * <p><b>Every case here names BOTH moments</b>, because a hold is one fact about two
 * instants and a case that fixes one of them measures the other by accident. The moment a
 * spell ends and the moment somebody asks are separate values in every assertion below,
 * and never the same constant twice.
 */
class HoldingAnItemTest {

	private static final Instant NOON = Instant.parse("2027-03-15T12:00:00Z");

	/** One account, and never the one asking, so „his" is never „anybody's". */
	private static final long HIM = 7;

	private static final long SOMEBODY_ELSE = 8;

	/**
	 * FIFTEEN MINUTES IS THE OWNER'S NUMBER AND THIS IS THE ONLY PLACE IT IS WRITTEN TWICE.
	 *
	 * <p>„Mirovanje traje 15 minuta" (PDL P9, 18.09.2026), chosen expressly „posto je broj do
	 * tada bio moj predlog a ne njegova odluka". A case that read the constant back would
	 * agree with whatever the constant said, so the number is typed out here and nowhere else
	 * in the portal.
	 */
	@Test
	void aSpellLastsTheFifteenMinutesTheOwnerChose() {
		assertThat(HoldingAnItem.QUIET).isEqualTo(Duration.ofMinutes(15));
		assertThat(HoldingAnItem.endOfAQuietSpell(NOON))
				.isEqualTo(Instant.parse("2027-03-15T12:15:00Z"));
	}

	@Test
	void nothingHoldingItIsNobodyInTheWay() {
		assertThat(HoldingAnItem.mayTouch(null, HIM, NOON)).isEqualTo(Answer.GO_AHEAD);
	}

	@Test
	void hisOwnHoldIsNeverInHisWayWhileItRuns() {
		Hold his = new Hold(HIM, NOON.plus(Duration.ofMinutes(10)));

		assertThat(HoldingAnItem.mayTouch(his, HIM, NOON)).isEqualTo(Answer.GO_AHEAD);
		assertThat(HoldingAnItem.mayTouch(his, SOMEBODY_ELSE, NOON))
				.as("the same live hold, asked about by the other man")
				.isEqualTo(Answer.SOMEBODY_ELSE_IS_READING_IT);
	}

	/**
	 * THE OWNER'S CHOICE, MEASURED AT ITS OWN EDGE.
	 *
	 * <p>He refused „samo izricito otpustanje ili odjava" with the reason said out loud: „pad
	 * pregledaca ili zatvoren laptop drzali bi stavku zauvek". So a spell that has run out
	 * stands in nobody's way, and the instant it ends is already over - the comparison is
	 * strict, and here is where that edge is nailed down rather than left to each reader.
	 */
	@Test
	void aSpellThatHasRunOutStandsInNobodysWayAndTheEdgeIsTheEndItself() {
		Instant ends = NOON.plus(HoldingAnItem.QUIET);
		Hold his = new Hold(HIM, ends);

		assertThat(HoldingAnItem.mayTouch(his, SOMEBODY_ELSE, ends.minusMillis(1)))
				.isEqualTo(Answer.SOMEBODY_ELSE_IS_READING_IT);
		assertThat(HoldingAnItem.mayTouch(his, SOMEBODY_ELSE, ends))
				.as("the instant a spell ends it is over")
				.isEqualTo(Answer.GO_AHEAD);
		assertThat(HoldingAnItem.mayTouch(his, SOMEBODY_ELSE, ends.plusMillis(1)))
				.isEqualTo(Answer.GO_AHEAD);

		assertThat(HoldingAnItem.stillRunning(his, ends.minusMillis(1))).isTrue();
		assertThat(HoldingAnItem.stillRunning(his, ends)).isFalse();
	}

	/**
	 * „Portal mora moderatoru da kaze koliko mu je ostalo, pre nego sto odluci" (owner,
	 * 18.09.2026), and a spell that has run out has NOTHING left rather than minus something.
	 */
	@Test
	void whatIsLeftIsWhatIsLeftAndNeverLessThanNothing() {
		Hold his = new Hold(HIM, NOON.plus(Duration.ofMinutes(15)));

		assertThat(HoldingAnItem.leftOf(his, NOON)).isEqualTo(Duration.ofMinutes(15));
		assertThat(HoldingAnItem.leftOf(his, NOON.plus(Duration.ofMinutes(4))))
				.isEqualTo(Duration.ofMinutes(11));
		assertThat(HoldingAnItem.leftOf(his, NOON.plus(Duration.ofMinutes(15))))
				.isEqualTo(Duration.ZERO);
		assertThat(HoldingAnItem.leftOf(his, NOON.plus(Duration.ofHours(3))))
				.as("a spell long gone has nothing left, not minus three hours")
				.isEqualTo(Duration.ZERO);
	}

	@Test
	void nothingMissingIsQuietlyAccepted() {
		Hold his = new Hold(HIM, NOON);

		assertThatThrownBy(() -> new Hold(HIM, null))
				.isInstanceOf(NullPointerException.class).hasMessage("until");
		assertThatThrownBy(() -> HoldingAnItem.mayTouch(his, HIM, null))
				.isInstanceOf(NullPointerException.class).hasMessage("now");
		assertThatThrownBy(() -> HoldingAnItem.stillRunning(null, NOON))
				.isInstanceOf(NullPointerException.class).hasMessage("hold");
		assertThatThrownBy(() -> HoldingAnItem.stillRunning(his, null))
				.isInstanceOf(NullPointerException.class).hasMessage("now");
		assertThatThrownBy(() -> HoldingAnItem.endOfAQuietSpell(null))
				.isInstanceOf(NullPointerException.class).hasMessage("now");
		assertThatThrownBy(() -> HoldingAnItem.leftOf(null, NOON))
				.isInstanceOf(NullPointerException.class).hasMessage("hold");
		assertThatThrownBy(() -> HoldingAnItem.leftOf(his, null))
				.isInstanceOf(NullPointerException.class).hasMessage("now");
	}
}
