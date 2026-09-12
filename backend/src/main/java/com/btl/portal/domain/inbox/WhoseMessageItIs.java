package com.btl.portal.domain.inbox;

import java.util.Objects;

/**
 * WHOSE INBOX A MESSAGE IS IN, AND WHAT ITS READER MAY DO WITH IT.
 *
 * <p>V13 says the league is the ABSENCE of an addressee: one column that is
 * there or is not, rather than a flag and a list that have to agree. That is a
 * good shape and it has one cost, which is the whole reason this class is
 * separate from the query that reads the table: "addressed to me" and
 * "addressed to nobody in particular" both make a message mine, so a rule
 * written against one of them is right about half the messages and silently
 * wrong about the other half.
 *
 * <p><b>What that half looks like when it goes wrong.</b> Written as "it is mine
 * if the addressee is empty", every member reads every private message on the
 * portal. Written as "it is mine if the addressee is me", nobody ever sees an
 * announcement. Neither shows up in a case that has one message in it.
 *
 * <p><b>Answering is narrower than reading, and that is the second half.</b> An
 * invitation to a team or to a pair is a question, and a question is asked of
 * one person. The schema says so itself - {@code message_a_question_has_an_addressee}
 * - so a question addressed to the whole league cannot exist, and this class is
 * allowed to lean on that rather than invent an answer for it.
 * {@code InboxRulesMatchTheSchemaTest} is what says the lean is safe.
 *
 * <p><b>Read is the absence of a row</b> and not a false in one, which is what
 * lets an announcement reach two thousand members without writing two thousand
 * rows the moment it is sent. So marking one read is a row per member, and the
 * member it names must be the one asking.
 */
public final class WhoseMessageItIs {

	private WhoseMessageItIs() {
	}

	/**
	 * A message, reduced to the two things these rules turn on.
	 *
	 * @param addressee    whose it is, or {@code null} for the whole league
	 * @param asksAQuestion whether it carries an invitation waiting for an answer
	 */
	public record Message(Long addressee, boolean asksAQuestion) {
	}

	/** Whose it is, from the asking member's side. */
	public enum Whose {

		/** Written to him and to nobody else. */
		HIS_OWN,

		/** Written to the league, so it is his as much as anybody's. */
		EVERYBODYS,

		/** Written to somebody else, and he must not see that it exists. */
		SOMEBODY_ELSES
	}

	public static Whose whose(Message message, long asking) {
		Objects.requireNonNull(message, "message");

		if (message.addressee() == null) {
			return Whose.EVERYBODYS;
		}

		return message.addressee() == asking ? Whose.HIS_OWN : Whose.SOMEBODY_ELSES;
	}

	/**
	 * Whether he may see it at all, which is reading it and marking it read.
	 *
	 * <p>The two go together on purpose: a member who may not read a message may
	 * not write a row saying he has.
	 */
	public static boolean mayRead(Message message, long asking) {
		return whose(message, asking) != Whose.SOMEBODY_ELSES;
	}

	/**
	 * Whether he may answer it, which is narrower.
	 *
	 * <p>Only a question can be answered, and only by the one it was asked of. An
	 * announcement is not a question; somebody else's invitation is not his to
	 * accept, and neither is one addressed to the league, which the schema does
	 * not allow to exist in the first place.
	 */
	public static boolean mayAnswer(Message message, long asking) {
		/* Whose it is asked first, and the order is not style: it is what says
		   "message" when nothing was handed in, rather than whatever the machine
		   says about a method call on nothing. */
		return whose(message, asking) == Whose.HIS_OWN && message.asksAQuestion();
	}
}
