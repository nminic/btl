package com.btl.portal.domain.registration;

import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/**
 * Which of the registration's fields are required, which depends on how old the
 * person is.
 *
 * <p><b>Why the server decides this at all, when the form already does.</b> The
 * form hides and shows fields as somebody types a date of birth, and that is
 * where the answer belongs for the person filling it in. But the form is
 * JavaScript in somebody else's browser: a registration can arrive without ever
 * having passed through it, and the one that arrives that way is exactly the one
 * that would leave a fourteen year old on the portal with nobody standing behind
 * him. So the rule lives twice on purpose, and this is the copy that decides.
 *
 * <p>Both boundaries come from {@link Guardianship}, which is where they are
 * decided; nothing here writes a number.
 */
public final class WhatRegistrationAsksFor {

	/** Asked of everybody, whatever his age. */
	public static final Set<String> OF_EVERYBODY = Set.of(
			"firstName", "lastName", "fatherName", "birthDate", "gender", "firstSeason2027",
			"email", "password", "passwordRepeat", "address", "city", "shirtSize", "photo",
			"healthStatement");

	/**
	 * Asked only of somebody old enough to have one.
	 *
	 * <p>An identity card is issued at sixteen, so asking a fourteen year old for
	 * its number is asking for something that does not exist. The number itself is a
	 * legal obligation (owner, 20.08.2026, and the privacy policy carries it with
	 * that basis), so it is required the moment it can be.
	 */
	public static final Set<String> ONLY_WITH_AN_IDENTITY_CARD = Set.of("idNumber");

	/**
	 * Asked only of somebody whose account a parent holds.
	 *
	 * <p>The signature and the relation together: V8 refuses a consent with one
	 * without the other, and so does the form.
	 */
	public static final Set<String> ONLY_FROM_A_GUARDIAN = Set.of("parentConsent", "parentRelation");

	/** Never required, whoever is registering. */
	public static final Set<String> NEVER_REQUIRED = Set.of("phone", "bio");

	private WhatRegistrationAsksFor() {
	}

	/**
	 * Every field this person must fill in.
	 *
	 * <p>The two conditional groups move in opposite directions across the same
	 * boundary: at sixteen the identity card becomes required and the parent's
	 * signature stops being. That they share a boundary is why one method answers
	 * both - split in two, one of them would one day be moved and the other not.
	 */
	public static Set<String> from(LocalDate born, LocalDate day) {
		Objects.requireNonNull(born, "born");
		Objects.requireNonNull(day, "day");

		Set<String> asked = new LinkedHashSet<>(OF_EVERYBODY);

		if (Guardianship.accountIsHeldByAGuardian(born, day)) {
			asked.addAll(ONLY_FROM_A_GUARDIAN);
		} else {
			asked.addAll(ONLY_WITH_AN_IDENTITY_CARD);
		}

		return Set.copyOf(asked);
	}
}
