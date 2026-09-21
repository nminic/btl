package com.btl.portal.domain.verification;

import java.time.Duration;
import java.time.Instant;
import java.util.Objects;

/**
 * WHETHER SOMEBODY ELSE IS READING THIS ITEM RIGHT NOW.
 *
 * <p>The queue is one list and every moderator sees the same rows in it, so two of them
 * can open one item at the same moment. The owner, 18.09.2026 (PDL P9, „Red za proveru je
 * JEDAN i zajednicki"): „Ukoliko moderator udje da analizira nesto, odluka se zakljucava
 * drugima tako da ne mogu da joj pristupe ili da rade nista sa njom."
 *
 * <p><b>A HOLD ENDS BY ITSELF, AND THAT WAS CHOSEN AGAINST A STATED COST.</b> The owner
 * was given both roads the same day and took this one: „Zakljucavanje ISTICE posle vremena
 * mirovanja, i tada stavku uzima ko hoce", refusing „samo izricito otpustanje ili odjava"
 * because „pad pregledaca ili zatvoren laptop drzali bi stavku zauvek i niko je ne bi
 * oslobodio osim kroz bazu". So there is no state here for „released": a hold that has run
 * out is a hold that is no longer in the way, and the row may sit in the table until
 * somebody takes it over.
 *
 * <p><b>FIFTEEN MINUTES IS THE OWNER'S NUMBER AND IT IS WRITTEN ONCE.</b> „Mirovanje traje
 * 15 minuta" (PDL P9, 18.09.2026), and he was asked expressly, „posto je broj do tada bio
 * moj predlog a ne njegova odluka". He chose it with the price of both directions said out
 * loud: „kratko vreme otima stavku moderatoru koji jos cita, dugo je krije kad mu padne
 * pregledac." A second copy of that number anywhere - in a query, in a screen, in a
 * migration - is a number free to drift from his.
 *
 * <p><b>WHAT IS NOT HERE, AND IS NOT HERE ON PURPOSE.</b>
 *
 * <ul>
 * <li><b>Whether he may moderate that queue at all.</b> That is „may he", ADL A8 gives it
 * one home ({@code WhatHeMayDo}, „Odgovara jedno mesto"), and a second reading of it here
 * would be free to disagree with the door. This class is handed a holder and a moment and
 * knows nothing about privileges.
 * <li><b>Whether the superadmin may take a hold away.</b> He may - „Superadmin SME da otme
 * tudje zakljucavanje, i onaj kome je oteto to sazna" (owner, 18.09.2026) - and that is a
 * question about a ROLE, so it is asked where roles are answered and composed with this.
 * Written in here it would be the same fact in two places, and the one in the weaker place
 * would be the one somebody edits.
 * <li><b>Whether the item has already been decided.</b> {@link DecidingOnASubmission}
 * answers that and is the only place that does.
 * </ul>
 */
public final class HoldingAnItem {

	/**
	 * How long a hold survives without being renewed (owner, 18.09.2026).
	 *
	 * <p>Public because the screen has to say „koliko mu je ostalo, pre nego sto odluci",
	 * which is the obligation the owner attached to his own answer: „Brava koja istekne
	 * ispod ruke bez upozorenja je gori ishod od obe cene koje su odmerene."
	 */
	public static final Duration QUIET = Duration.ofMinutes(15);

	private HoldingAnItem() {
	}

	/**
	 * Somebody reading an item, and until when.
	 *
	 * @param heldBy the ACCOUNT, which is what {@code verification_lock.held_by} keeps and
	 *               the same choice V9 made for {@code decided_by}: moderating is done by
	 *               somebody signed in, and V23 says an account naming no member is the
	 *               ordinary case for a moderator who does not race
	 * @param until  when the spell runs out, which is what the row stores rather than when
	 *               it began - so nobody reading one has to know how long a spell is in
	 *               order to know whether it is still running
	 */
	public record Hold(long heldBy, Instant until) {

		public Hold {
			Objects.requireNonNull(until, "until");
		}
	}

	/** Whether somebody may touch an item at this moment. */
	public enum Answer {

		/** He may: nothing holds it, his own hold does, or the one that did has run out. */
		GO_AHEAD,

		/** Somebody else is reading it and his spell is still running. */
		SOMEBODY_ELSE_IS_READING_IT
	}

	/**
	 * WHETHER THIS ACCOUNT MAY TOUCH THIS ITEM, which is one question and not two.
	 *
	 * <p>Taking a hold and deciding the item are refused by exactly the same thing -
	 * somebody else is in there - so they are answered by one method rather than by two
	 * that are free to drift apart. The owner's sentence covers both in one breath: the
	 * others „ne mogu da joj pristupe ili da rade nista sa njom".
	 *
	 * <p><b>Three states and not two, which is the whole of it.</b> A hold that is absent, a
	 * hold that is HIS, and a hold that has RUN OUT all answer {@link Answer#GO_AHEAD}, and
	 * only a live hold belonging to somebody else stands in the way. Asked as „is there a
	 * row" it would lock a moderator out of the item he himself opened a minute ago, and
	 * would keep a crashed browser's hold for ever, which is the outcome the owner refused
	 * by name.
	 *
	 * @param hold what holds the item, or {@code null} where nothing does
	 * @param who  the account asking
	 * @param now  the moment, off the {@code Clock} bean and never off the database: a
	 *             spell measured against {@code now()} in SQL could not be moved in a case,
	 *             so the difference between three minutes and sixteen would only ever be
	 *             measurable by waiting
	 */
	public static Answer mayTouch(Hold hold, long who, Instant now) {
		Objects.requireNonNull(now, "now");

		if (hold == null || hold.heldBy() == who || !stillRunning(hold, now)) {
			return Answer.GO_AHEAD;
		}

		return Answer.SOMEBODY_ELSE_IS_READING_IT;
	}

	/**
	 * Whether the spell is still running.
	 *
	 * <p>The comparison is strict, so the instant a spell ends it is over. That edge is
	 * arbitrary in the only way an edge can be, and it is written here once so that every
	 * reader is on the same side of it.
	 */
	public static boolean stillRunning(Hold hold, Instant now) {
		Objects.requireNonNull(hold, "hold");
		Objects.requireNonNull(now, "now");

		return hold.until().isAfter(now);
	}

	/** When a hold taken or renewed at this moment runs out. */
	public static Instant endOfAQuietSpell(Instant now) {
		Objects.requireNonNull(now, "now");

		return now.plus(QUIET);
	}

	/**
	 * HOW LONG HE HAS LEFT, which the portal owes him before he decides anything.
	 *
	 * <p>The owner attached this to his own choice of fifteen minutes: „portal mora
	 * moderatoru da kaze koliko mu je ostalo, pre nego sto odluci. Brava koja istekne ispod
	 * ruke bez upozorenja je gori ishod od obe cene koje su odmerene."
	 *
	 * <p><b>Never negative.</b> A spell that has run out has nothing left rather than minus
	 * something, and a screen counting down from a negative number would be this method's
	 * fault rather than the screen's.
	 */
	public static Duration leftOf(Hold hold, Instant now) {
		Objects.requireNonNull(hold, "hold");
		Objects.requireNonNull(now, "now");

		Duration left = Duration.between(now, hold.until());

		return left.isNegative() ? Duration.ZERO : left;
	}
}
