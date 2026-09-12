package com.btl.portal.domain.inbox;

import com.btl.portal.domain.inbox.WhoseMessageItIs.Message;
import com.btl.portal.domain.inbox.WhoseMessageItIs.Whose;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Whose a message is, and what its reader may do with it. */
class WhoseMessageItIsTest {

	/**
	 * Three members and not two, and none of them is number one.
	 *
	 * <p>Two would let "the addressee" and "the member asking" be told apart, and
	 * nothing more; the third is what catches a rule that answers "not his" by
	 * comparing against whoever happens to be first. The numbers are far apart for
	 * the same reason.
	 */
	private static final long ME = 4102;

	private static final long HER = 7715;

	private static final long A_THIRD = 9003;

	private static final Message TO_ME = new Message(ME, false);

	private static final Message TO_HER = new Message(HER, false);

	private static final Message TO_EVERYBODY = new Message(null, false);

	/**
	 * THE THREE ANSWERS ARE THREE, and the middle one is the reason this class
	 * exists.
	 *
	 * <p>A message to the league and a message to me both end up in my inbox, so a
	 * rule written against either one alone is right about half the messages and
	 * quietly wrong about the other half. Told apart here, and both told apart
	 * from somebody else's.
	 */
	@Test
	void aMessageIsMineOrEverybodysOrNotMine() {
		assertThat(WhoseMessageItIs.whose(TO_ME, ME)).isEqualTo(Whose.HIS_OWN);
		assertThat(WhoseMessageItIs.whose(TO_EVERYBODY, ME)).isEqualTo(Whose.EVERYBODYS);
		assertThat(WhoseMessageItIs.whose(TO_HER, ME))
				.as("a message written to somebody else was answered as mine")
				.isEqualTo(Whose.SOMEBODY_ELSES);
	}

	/**
	 * AND AN ANNOUNCEMENT IS EVERYBODY'S, not the sender's or the first member's.
	 *
	 * <p>Asked of three different members, it must come back the same. A rule that
	 * happened to compare the empty addressee against a member number would answer
	 * differently for one of them.
	 */
	@Test
	void anAnnouncementReadsTheSameToEverybody() {
		for (long member : new long[] {ME, HER, A_THIRD}) {
			assertThat(WhoseMessageItIs.whose(TO_EVERYBODY, member))
					.as("the announcement was not %d's", member)
					.isEqualTo(Whose.EVERYBODYS);
			assertThat(WhoseMessageItIs.mayRead(TO_EVERYBODY, member)).isTrue();
		}
	}

	/**
	 * READING SOMEBODY ELSE'S MESSAGE IS THE THING THAT MUST NOT HAPPEN.
	 *
	 * <p>Asked from two other members' side, because a rule comparing against one
	 * remembered number would let the other through.
	 */
	@Test
	void nobodyReadsAMessageWrittenToSomebodyElse() {
		assertThat(WhoseMessageItIs.mayRead(TO_HER, ME))
				.as("a private message was readable by another member")
				.isFalse();
		assertThat(WhoseMessageItIs.mayRead(TO_ME, HER)).isFalse();
		assertThat(WhoseMessageItIs.mayRead(TO_ME, A_THIRD)).isFalse();

		assertThat(WhoseMessageItIs.mayRead(TO_ME, ME)).isTrue();
		assertThat(WhoseMessageItIs.mayRead(TO_HER, HER)).isTrue();
	}

	/**
	 * ANSWERING IS NARROWER THAN READING, and every way it is narrower is here.
	 *
	 * <p>An announcement is not a question even though everybody may read it; a
	 * plain message to me is not a question even though it is mine; and a question
	 * asked of her is not mine to accept even though I can see that she was asked
	 * only if she tells me. Each of the three fails for its own reason, and a rule
	 * that dropped any one of them would pass the other two.
	 */
	@Test
	void onlyTheOneWhoWasAskedMayAnswer() {
		Message sheWasAsked = new Message(HER, true);
		Message iWasAsked = new Message(ME, true);

		assertThat(WhoseMessageItIs.mayAnswer(iWasAsked, ME)).isTrue();

		assertThat(WhoseMessageItIs.mayAnswer(sheWasAsked, ME))
				.as("somebody else's invitation was mine to accept")
				.isFalse();
		assertThat(WhoseMessageItIs.mayAnswer(TO_ME, ME))
				.as("a message that asks nothing was answered")
				.isFalse();
		assertThat(WhoseMessageItIs.mayAnswer(new Message(null, true), ME))
				.as("a question to the whole league was answered, and the schema forbids one existing")
				.isFalse();
	}

	/**
	 * AND BEING ABLE TO READ IT IS NOT BEING ABLE TO ANSWER IT.
	 *
	 * <p>The two would be the same method if `mayAnswer` merely asked whether the
	 * message was his: an announcement is everybody's to read and nobody's to
	 * answer, and this is what says so.
	 */
	@Test
	void readingAndAnsweringAreNotTheSameQuestion() {
		Message everybodyIsAsked = new Message(null, true);

		assertThat(WhoseMessageItIs.mayRead(everybodyIsAsked, ME)).isTrue();
		assertThat(WhoseMessageItIs.mayAnswer(everybodyIsAsked, ME))
				.as("a message everybody may read was a message everybody may answer")
				.isFalse();
	}

	@Test
	void aMessageThatIsNotThereAtAllIsRefusedHere() {
		assertThatThrownBy(() -> WhoseMessageItIs.whose(null, ME))
				.isInstanceOf(NullPointerException.class).hasMessage("message");
		assertThatThrownBy(() -> WhoseMessageItIs.mayRead(null, ME))
				.isInstanceOf(NullPointerException.class).hasMessage("message");
		assertThatThrownBy(() -> WhoseMessageItIs.mayAnswer(null, ME))
				.isInstanceOf(NullPointerException.class).hasMessage("message");
	}
}
