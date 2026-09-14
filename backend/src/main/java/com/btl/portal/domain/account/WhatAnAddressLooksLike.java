package com.btl.portal.domain.account;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * THE SHAPE OF AN ADDRESS OF ELECTRONIC MAIL THIS PORTAL WILL STORE, on the Java
 * side of the same rule V6 put on the column.
 *
 * <p><b>Why this exists at all, when the schema already says it.</b> It says it as
 * a CHECK, and a CHECK is an error: a registration carrying {@code petar} with no
 * {@code @} in it would reach {@code INSERT}, the constraint would fire, and what
 * came back to the person filling in the form would be a 500 rather than "that is
 * not an address". Worse than the number is what it does to the transaction - on
 * PostgreSQL an error aborts it outright, so nothing after that point can be
 * recovered from inside the request. The rule therefore lives twice on purpose,
 * exactly the way {@link com.btl.portal.domain.registration.WhatRegistrationAsksFor}
 * says the list of required fields does, and this is the copy that answers the
 * person.
 *
 * <p><b>The two copies are not kept equal by reading them.</b> Two patterns can be
 * spelt differently and mean the same thing, or spelt the same and behave
 * differently, and neither is visible by looking. {@code WhatAnAddressLooksLikeMatchesTheSchemaTest}
 * takes {@code account_email_shape} out of the catalogue and asks PostgreSQL itself
 * to judge every address this accepts and every address this refuses, which is the
 * shape {@code MemberNumberMatchesTheSchemaTest} already uses for the member number.
 *
 * <p><b>A RANGE OF WHAT IS ALLOWED, NEVER AN EXCLUSION OF WHAT IS NOT</b>, and V6
 * says at length why: its own first draft excluded whitespace, and under the ctype
 * the {@code postgres:18} image is built with, {@code [:space:]} is the ASCII
 * whitespace and nothing more - so U+00A0, U+2007, U+202F, U+200B, U+FEFF and
 * U+00AD all walked through, {@code lower()} folded none of them, and the unique
 * index did not fire either. The same address with a zero width space in the middle
 * went in beside the real one as a second account of the same person. A range cannot
 * come up short that way: it says what is allowed, so the seventh invisible
 * character needs no line here.
 *
 * <p><b>What the range costs is what V6's own note says it costs:</b> no
 * internationalised address, and the refusal is loud rather than silent. The day the
 * league owes somebody an address in his own alphabet, that is a migration and a
 * decision, and this class moves with it.
 */
public final class WhatAnAddressLooksLike {

	/**
	 * Exactly one {@code @}, with something a reader can see on either side.
	 *
	 * <p>{@code !} (0x21) through {@code ~} (0x7E) with {@code @} (0x40) taken out,
	 * written as the two ranges that surround it, which is character for character
	 * what {@code account_email_shape} says in SQL.
	 */
	private static final Pattern ONE_AT_BETWEEN_VISIBLE_ASCII =
			Pattern.compile("^[\\x21-\\x3f\\x41-\\x7e]+@[\\x21-\\x3f\\x41-\\x7e]+$");

	private WhatAnAddressLooksLike() {
	}

	/**
	 * Whether this is an address the portal would store.
	 *
	 * @param address what somebody typed, which may be anything at all, null included
	 */
	public static boolean itDoes(String address) {
		return address != null && ONE_AT_BETWEEN_VISIBLE_ASCII.matcher(address).matches();
	}

	/**
	 * The address with the spaces around it taken off, which is what is done to an
	 * address SOMEBODY TYPED before it is compared with anything.
	 *
	 * <p><b>It is a decision and not a convenience.</b> A space is below 0x21 and so is
	 * refused by the shape above, which means an address pasted out of a mail client
	 * with a trailing space would be turned away with nothing a person could act on -
	 * the space is invisible and he would retype the same thing. Taking it off is safe
	 * in the one way that matters: uniqueness is over {@code lower(email)}, and folding
	 * two spellings into one can only ever refuse a second account, never admit one.
	 *
	 * <p><b>This is the half that signing in uses, and {@link #asItIsStored} is the half
	 * that registering uses.</b> The difference is deliberate and is written out there:
	 * the row is written folded, and what somebody types at a form is compared against
	 * it by the database's own {@code lower()} rather than by a second fold in Java.
	 *
	 * <p><b>And it takes off only what {@link Character#isWhitespace} knows</b>, which
	 * is not every invisible character there is - by specification it says no to
	 * U+00A0, U+2007 and U+202F, and it has never heard of U+200B or U+FEFF. That is
	 * deliberate rather than a gap: what it does not take off, the shape refuses, and a
	 * loud refusal is the right answer for an address carrying an invisible character
	 * in the middle of it. Trimming more would be the fourth wrong list ADL A38 names.
	 *
	 * @param address what somebody typed, never null
	 */
	public static String withoutTheSpacesAround(String address) {
		return address.strip();
	}

	/**
	 * THE ADDRESS AS THE ROW CARRIES IT: the spaces off, and folded to lower case.
	 *
	 * <p><b>The fold is not a new decision; it is the one V6 already took, moved to
	 * where it can be true.</b> The owner, 08.09.2026: one address is one account, and
	 * the uniqueness that holds him to it is written over {@code lower(email)} and not
	 * over {@code email}, "because a plain unique key would let Petar@primer.rs and
	 * petar@primer.rs both in and the same person would hold two accounts". A portal
	 * that has decided those two are ONE PERSON cannot go on storing them as two
	 * spellings and hope every later reader remembers which.
	 *
	 * <p><b>What it cost while it was not done, measured 14.09.2026.</b> Registration
	 * wrote the address as it was typed and signing in looked for it literally, so
	 * somebody who registered as {@code Novi.Clan@primer.rs} - which is what a telephone
	 * keyboard offers first - confirmed the address, typed it back in lower case, and
	 * was told 401. He then tried to register again and was told 409, the address is
	 * taken. Both answers were correct and together they are a person who can neither
	 * get in nor start again, at an address nobody else can ever use. Nothing but the
	 * owner's own hand gets him out of there.
	 *
	 * <p><b>Folded here, on the way in, and NOT in every query afterwards.</b> The other
	 * shape of this fix is to leave the row as typed and write {@code lower(email)} into
	 * every statement that ever looks for one - which is a rule somebody has to remember
	 * on a route that does not exist yet, and the day he forgets looks exactly like the
	 * fault above. Stored folded, {@code email = ?} is right by construction for every
	 * row this portal writes; {@link com.btl.portal.web.SignInApi} asks through
	 * {@code lower()} as well, and that is the floor under any row written some other
	 * way - by a migration, by a hand at the console, or by a route written before this
	 * sentence.
	 *
	 * <p><b>What the fold costs, said here rather than found later.</b> A mailbox whose
	 * local part really is case sensitive - the RFC permits one, and no major provider
	 * has one - would be written down folded and mailed to folded. That cost is already
	 * inside V6's decision: a portal that refuses {@code Petar@} because {@code petar@}
	 * exists has already declared those the same mailbox, and this only makes the row
	 * say so too.
	 *
	 * <p><b>And the shape is judged AFTER the fold</b>, by whoever calls
	 * {@link #itDoes}, which is what keeps the fold from being a way in. Folding can
	 * turn a character outside the range into one inside it - U+212A, the Kelvin sign,
	 * lowercases to an ordinary {@code k} - and that is the safe direction and the only
	 * one: it makes a homoglyph collide with the address it imitates, so the unique
	 * index refuses it as a second account instead of admitting it as a new one.
	 *
	 * @param address what somebody typed, never null
	 */
	public static String asItIsStored(String address) {
		return withoutTheSpacesAround(address).toLowerCase(Locale.ROOT);
	}
}
