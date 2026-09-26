package com.btl.portal.domain.registration;

import java.time.DateTimeException;
import java.time.LocalDate;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * WHAT ONE FIELD OF THE REGISTRATION FORM MEANS, ONCE, FOR EVERY ROUTE THAT TAKES ONE.
 *
 * <p><b>Why this is a class and not a handful of private methods.</b> Two routes now
 * collect the same form: somebody registering himself
 * ({@code RegistrationApi}) and the administration entering a group of members off a
 * paper consent ({@code CompetitorWriteApi#enter}, owner, PDL P8b, 25.09.2026). Written
 * at each of them, every rule below would have two homes free to drift the day one is
 * edited - and the journal has a name for that class of fault and a count of what it has
 * cost: „dva doma jedne cinjenice koji se ne slazu". {@link WhatRegistrationAsksFor} is
 * already one home for WHICH fields are required; this is one home for WHAT each of them
 * has to look like.
 *
 * <p><b>Every answer here is „the value, or nothing", never a boolean.</b> A field left
 * out altogether and a field carrying something nobody could have chosen are the same
 * answer to the route that has to refuse the form, and answering with the value means one
 * loop can ask the same question of a name, a gender and a tick alike.
 *
 * <p><b>Nothing here touches a database</b>, which is what keeps it in {@code domain}: the
 * one field that cannot be judged without one is the town, because a number nothing maps
 * and a country code nothing maps are questions about the codebook rather than about the
 * form. That lives beside the routes, in {@code ATownFromTheCodebookOrTyped}.
 */
public final class WhatAFieldMeans {

	/** The seven the form offers, which is {@code competitor_shirt_size_known}. */
	private static final Set<String> SHIRT_SIZES =
			Set.of("XS", "S", "M", "L", "XL", "XXL", "XXXL");

	/** The two the form offers, which is {@code competitor_gender_known}. */
	private static final Set<String> GENDERS = Set.of("M", "F");

	/** Letters and digits, at most twenty, which is {@code competitor_document_number_shape}. */
	private static final Pattern A_DOCUMENT_NUMBER = Pattern.compile("^[0-9A-Za-z]{1,20}$");

	private WhatAFieldMeans() {
	}

	/**
	 * Whether a field was filled in at all.
	 *
	 * <p>Absent, empty, and a run of spaces are one answer and not three: JSON has a null,
	 * a form has an empty box, and a person has a space bar, and a guard written against
	 * one of the three lets the other two through to a column whose {@code btrim(...) <> ''}
	 * would then refuse them as an error.
	 */
	public static boolean isNothing(String value) {
		return value == null || value.isBlank();
	}

	/**
	 * The day somebody was born, or nothing when what arrived is not a day.
	 *
	 * <p><b>A day in the future is not one either</b>, and it is refused here rather than
	 * left to {@link Guardianship}: that class throws for a date after the day it is asked
	 * about - „nobody is a given age before he is born" - and a form carrying tomorrow
	 * would otherwise be a server fault rather than a form the portal will not take. Today
	 * itself is allowed: a registration for somebody born this morning is nonsense a person
	 * will notice and is not a shape the server has to have an opinion about.
	 */
	public static LocalDate theDay(String written, LocalDate today) {
		if (written == null) {
			return null;
		}

		try {
			LocalDate born = LocalDate.parse(written.strip());

			return born.isAfter(today) ? null : born;
		} catch (DateTimeException notADay) {
			return null;
		}
	}

	/** The letter when it is one of the two, and nothing otherwise. */
	public static String theGender(String value) {
		return chosenFrom(GENDERS, value);
	}

	/** The size when it is one of the seven, and nothing otherwise. */
	public static String theShirtSize(String value) {
		return chosenFrom(SHIRT_SIZES, value);
	}

	/**
	 * The value when it is one the form offers, and nothing otherwise.
	 *
	 * <p><b>The null is tested here and not left to the set</b>, and that is a fault a
	 * route had until it was measured: {@code Set.of(...)} is immutable, and immutable sets
	 * THROW when they are asked whether they hold null rather than answering false. So a
	 * form that left the gender out altogether came back a server fault instead of „the
	 * form is not complete", and only a case that took every field away one at a time
	 * showed it.
	 */
	private static String chosenFrom(Set<String> offered, String value) {
		return value != null && offered.contains(value) ? value : null;
	}

	/** The identity number when it is one, and nothing when it is not. */
	public static String theDocument(String written) {
		if (isNothing(written)) {
			return null;
		}

		String number = written.strip();

		return A_DOCUMENT_NUMBER.matcher(number).matches() ? number : null;
	}

	/**
	 * The relation when it is one the form offers, and nothing otherwise.
	 *
	 * <p><b>The enum is read rather than its three values written out.</b>
	 * {@link Guardianship.Relation} is the list, {@code parental_consent_relation_known} is
	 * the same list in SQL, and {@code GuardianshipMatchesTheSchemaTest} is what keeps
	 * those two from drifting; a third copy would be a list nothing holds to the other two.
	 */
	public static String theRelation(String written) {
		for (Guardianship.Relation relation : Guardianship.Relation.values()) {
			if (relation.code().equals(written)) {
				return relation.code();
			}
		}

		return null;
	}

	/**
	 * The biography, which is never null in the row and may be empty.
	 *
	 * <p>V7: „`bio` is NOT NULL and may be empty, and that is the difference between it and
	 * a name: twenty of the thirty two members in the shipped data have written none, and
	 * an empty biography is a state the profile has to look right in."
	 */
	public static String theBio(String written) {
		return isNothing(written) ? "" : written.strip();
	}

	/**
	 * The telephone number, which is null when there is none and never an empty string.
	 *
	 * <p>V8: „Optional, and the only optional field of the thirteen, so an empty string
	 * would be a second way of saying the same absence. There is one way: no phone is
	 * NULL." {@code competitor_phone_not_blank} is what refuses the other.
	 */
	public static String thePhone(String written) {
		return isNothing(written) ? null : written.strip();
	}
}
