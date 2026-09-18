package com.btl.portal.domain.event;

import java.util.Set;
import java.util.regex.Pattern;

/**
 * THE TWO THINGS AN EVENT CARRIES THAT ARE SPELT OUT RATHER THAN MEASURED: which
 * kinds there are, and what a link looks like.
 *
 * <p><b>Both are written by hand and both have a floor.</b> A list written by hand is
 * only as safe as what stands under it, and what stands under these is
 * {@code EventShapesMatchTheSchemaTest}: the constraint's own expression is taken out
 * of PostgreSQL's catalogue and PostgreSQL is asked to judge each value, which is the
 * shape {@code PaymentStatesMatchTheSchemaTest} and {@code LinkShapeMatchesTheSchemaTest}
 * already use. Comparing one written pattern against another would be reading rather
 * than measuring.
 *
 * <p><b>Why they are not read out of the catalogue at request time instead.</b> A route
 * that asked the database what a kind may be would answer every form with a round trip
 * to {@code pg_constraint}, and the rule would then live in one place but be unreadable
 * from the code that enforces it. The repository's answer to that is the pair above: the
 * value is named here and the floor is what keeps the two equal.
 *
 * <p><b>The two disagree by a 500.</b> A value this class lets through and the table
 * refuses does not reach an administrator as "that is not a kind of event"; it reaches
 * him as a server fault, after he has finished filling the form in.
 */
public final class WhatAnEventCarries {

	/**
	 * <b>Owner, 10.08.2026</b> (PDL): „Dogadjaj ima vrstu: Trka, Trening ili Skup", and
	 * the default is a race. {@code btl_event_kind_known}, V7, holds the same three.
	 *
	 * <p>A calendar that covers more than races is the owner's own decision (PDL: the
	 * calendar carries an association's events that are not races, and in the first phase
	 * only an administrator adds them), so a gathering with no race under it is an
	 * ordinary row and not a half filled one.
	 */
	public static final Set<String> KINDS = Set.of("race", "training", "gathering");

	/** What an event is unless somebody says otherwise, which is the owner's sentence. */
	public static final String A_RACE = "race";

	/**
	 * {@code btl_event_link_shape}, V7: empty, or a web address with no whitespace in it.
	 *
	 * <p><b>Whitespace is asked of the CODE POINT, not of {@code \S}.</b> Java's
 * {@code \S} is ASCII and knows six characters; the schema spells
 * {@code [^[:space:]]}, which PostgreSQL reads over the whole of Unicode. The gap is not
 * theoretical: measured 18.09.2026, a link carrying {@code U+2003} (em space),
 * {@code U+3000} (ideographic space) or {@code U+2028} (line separator) passed this check
 * and then died on the insert as a 500, which is the very fault this class exists to turn
 * into a sentence. {@link Character#isWhitespace} answers for those three and agrees with
 * the table on {@code U+00A0} and {@code U+0085}, where the two dialects already did.
 *
 * <p>The floor still asks PostgreSQL rather than comparing the two texts, which is why
	 * the floor asks PostgreSQL rather than comparing the two texts: they are two
	 * dialects and reading them side by side proves nothing.
	 */
	private static final Pattern A_LINK = Pattern.compile("^https?://\\S+$");

	private WhatAnEventCarries() {
	}

	/** Whether this is a link the table would hold. Empty is one, and is not a link. */
	public static boolean linkIsShaped(String link) {
		return link.isEmpty()
				|| (A_LINK.matcher(link).matches()
						&& link.codePoints().noneMatch(Character::isWhitespace));
	}
}
