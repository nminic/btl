package com.btl.portal.domain.result;

import java.util.Objects;
import java.util.regex.Pattern;

/**
 * WHAT HAS TO COME WITH A REPORTED RUN BEFORE ANYBODY LOOKS AT IT.
 *
 * <p><b>This is the one rule on the table that the schema cannot hold, and
 * saying so is why the class exists.</b> V10 writes it out and then hands it
 * over in as many words: the rule „has three legs over two tables", the link and
 * the comment on {@code result_submission} and the photograph on
 * {@code verification}, „a single-table check cannot say it and none is
 * pretended here... it belongs to whoever writes the row". That is this.
 *
 * <p><b>The rule itself, and it is the same in both forms the portal serves.</b>
 * A link is required; a photograph makes it optional
 * ({@code optionalWhenFilled: photo}); and a photograph makes the COMMENT
 * required in its place ({@code requiredWhenFilled: photo}), which is the owner's
 * „slika nikad ne stoji sama". So the two legs swap: whichever way the run is
 * shown, something says what it was.
 *
 * <p><b>A photograph with a comment needs no link, and a link needs no
 * photograph.</b> Those are the two ways through; everything else is one of the
 * three refusals below, and each is a different sentence to show the member
 * rather than one shrug covering all of them.
 *
 * <p><b>The link's shape is judged here as well, and that is a 400 bought with a
 * 500.</b> {@code result_submission_link_shape} says the same thing in SQL and
 * would throw the row out, but a constraint violation reaches the member as a
 * server fault rather than as "that is not a web address".
 * {@code LinkShapeMatchesTheSchemaTest} is what keeps the two from drifting: it
 * asks PostgreSQL to judge what this accepts and what this refuses, rather than
 * comparing one written pattern against another.
 */
public final class ProofThatTheRunHappened {

	/**
	 * A web address and nothing with a space in it.
	 *
	 * <p>The same rule as {@code result_submission_link_shape}, and deliberately
	 * this loose: a result lives on somebody else's timing site, and guessing which
	 * of them are real is a list that goes stale. What it does refuse is the thing
	 * that is not an address at all.
	 */
	private static final Pattern A_WEB_ADDRESS = Pattern.compile("^https?://[^\\s]+$");

	private ProofThatTheRunHappened() {
	}

	/**
	 * What the member sent, reduced to the three things this rule turns on.
	 *
	 * @param link         what he typed, or blank
	 * @param aPhotograph  whether a photograph came with it. A boolean and not the
	 *                     photograph itself, because the photograph is the
	 *                     verification row's and this decision is made before there
	 *                     is one
	 * @param comment      his own note, or blank
	 */
	public record Report(String link, boolean aPhotograph, String comment) {
	}

	/** Why a report is not ready, and each of the three is its own sentence. */
	public enum Outcome {

		/** It may be looked at. */
		GOOD,

		/** No link and no photograph: nothing here says the run happened. */
		NOTHING_SHOWS_IT_HAPPENED,

		/** A photograph came with no word about it, and „slika nikad ne stoji sama". */
		A_PHOTOGRAPH_NEVER_STANDS_ALONE,

		/** Something was typed in the link field and it is not a web address. */
		A_LINK_THAT_IS_NOT_A_LINK
	}

	/**
	 * WHAT IS JUDGED IS EXACTLY WHAT WOULD BE WRITTEN, which is the one property
	 * that makes this decision and {@link #linkAsItGoesIn} impossible to disagree.
	 *
	 * <p>It was written the other way round first, judging the text as typed, and a
	 * floor caught it the same afternoon: an address pasted out of a browser
	 * carries a trailing space often enough, and that member would have been told
	 * his address was not one. Judged on what goes in, the space is gone before
	 * anybody looks.
	 *
	 * <p>The shape is judged before the rest, because a link that is not a link is
	 * not a link whether or not a photograph came with it. Judged after, a member
	 * who mistyped his address and attached a photograph would be told his report
	 * was fine and then have the mistyped text thrown out by the database.
	 */
	public static Outcome decide(Report report) {
		String link = linkAsItGoesIn(report);

		if (!link.isEmpty() && !A_WEB_ADDRESS.matcher(link).matches()) {
			return Outcome.A_LINK_THAT_IS_NOT_A_LINK;
		}

		if (report.aPhotograph()) {
			return blank(report.comment()) ? Outcome.A_PHOTOGRAPH_NEVER_STANDS_ALONE : Outcome.GOOD;
		}

		return link.isEmpty() ? Outcome.NOTHING_SHOWS_IT_HAPPENED : Outcome.GOOD;
	}

	/**
	 * THE LINK AS IT GOES INTO THE ROW, which is not always the link as it was
	 * typed.
	 *
	 * <p><b>This exists because of a gap measured on 12.09.2026 and it is a 500 that
	 * was waiting to happen.</b> {@code result_submission.link} is {@code not null}
	 * and {@code result_submission_link_shape} takes the empty string or a web
	 * address and nothing else. A member who leaves a space in that field and proves
	 * his run with a photograph passes {@link #decide} - correctly, because he has
	 * proved it - and the space would then be written into a column that refuses it.
	 * Nothing between the two said what to write, so each caller would have decided
	 * for itself and one of them would have got it wrong.
	 *
	 * <p>So the class that judges the field also says how it is stored: a field
	 * nobody filled in is stored as the empty string, and what somebody did fill in
	 * is stored without the space he left around it.
	 */
	public static String linkAsItGoesIn(Report report) {
		Objects.requireNonNull(report, "report");

		return blank(report.link()) ? "" : report.link().trim();
	}

	/** Absent and whitespace are one thing here: both are a field nobody filled in. */
	private static boolean blank(String typed) {
		return typed == null || typed.isBlank();
	}
}
