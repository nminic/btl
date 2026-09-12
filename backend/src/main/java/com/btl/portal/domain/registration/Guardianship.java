package com.btl.portal.domain.registration;

import java.time.LocalDate;
import java.time.Period;
import java.util.Objects;

/**
 * When a parent stands behind a registration, and in which of the two ways.
 *
 * <p><b>There are two boundaries and they do not do the same thing</b>, which is
 * the whole of this class. The record that preceded it knew only one, and the
 * Statute of 17.08.2026 has two.
 *
 * <p><b>Fourteen, from Article 9 of the Statute:</b> for somebody UNDER fourteen,
 * the prior consent of a parent or guardian is required for the MEMBERSHIP
 * itself. Somebody of fourteen or fifteen accepts membership on his own.
 *
 * <p><b>Sixteen, the portal's own rule:</b> the ACCOUNT of anybody under sixteen
 * is held by a parent or guardian, who maintains it until the child passes the
 * boundary. Sixteen is the highest boundary European law allows - states may
 * lower it, never raise it - so it is correct everywhere and no table by country
 * can ask for more. A table would buy convenience for thirteen to fifteen year
 * olds in some states and cost permanent upkeep for thirty; a stale table is
 * worse than a conservative constant, because it claims to be right.
 *
 * <p>The error is not symmetrical either way: a boundary set too low means a
 * child's data processed without a basis, and one set too high means a parent
 * clicks once more than he had to.
 *
 * <p><b>And neither of them is the junior price.</b> That boundary is also
 * fourteen and PDL P8 says in as many words that the two must never be joined:
 * "Granica od 16 za saglasnost je potpuno odvojena od junior cene, koja ostaje
 * do 14 godina. Iste cifre se ne smeju spajati." They move for different reasons
 * - one when the Statute changes, one when the owner changes what a season
 * costs - and a constant shared between them would move both at once.
 */
public final class Guardianship {

	/**
	 * Under this, the membership itself needs a parent's prior consent (Statute,
	 * Article 9).
	 */
	public static final int MEMBERSHIP_NEEDS_CONSENT_UNDER = 14;

	/** Under this, the account is held by a parent or guardian. */
	public static final int ACCOUNT_IS_HELD_BY_A_GUARDIAN_UNDER = 16;

	private Guardianship() {
	}

	/**
	 * Who signed, out of the three the form offers.
	 *
	 * <p>A fourth would be a relation nobody could have chosen, which is what
	 * {@code parental_consent_relation_known} says in the schema. The code is the
	 * one stored there, and {@code GuardianshipMatchesTheSchemaTest} is what keeps
	 * the two lists from drifting apart.
	 */
	public enum Relation {

		MOTHER("mother"),
		FATHER("father"),
		GUARDIAN("guardian");

		private final String code;

		Relation(String code) {
			this.code = code;
		}

		/** What the schema stores, and what the form sends. */
		public String code() {
			return code;
		}

		/** The relation stored under that code, if the form and the schema agree. */
		public static Relation named(String code) {
			for (Relation relation : values()) {
				if (relation.code.equals(code)) {
					return relation;
				}
			}

			throw new IllegalArgumentException("nobody can have chosen the relation '" + code + "'");
		}
	}

	/**
	 * How old somebody is on a given day, in whole years.
	 *
	 * <p>Whole years and not a difference of calendar years: somebody born on the
	 * last day of December is not a year older on the first day of January, and
	 * both boundaries here are about how old a person IS rather than about which
	 * season he was born in. The age used for a race category is the other kind
	 * and belongs to {@code Category}.
	 */
	public static int yearsOldOn(LocalDate born, LocalDate day) {
		Objects.requireNonNull(born, "born");
		Objects.requireNonNull(day, "day");

		if (day.isBefore(born)) {
			throw new IllegalArgumentException("nobody is a given age before he is born: " + born + " after " + day);
		}

		return Period.between(born, day).getYears();
	}

	/** Whether this registration needs a parent's consent for the membership. */
	public static boolean membershipNeedsConsent(LocalDate born, LocalDate day) {
		return yearsOldOn(born, day) < MEMBERSHIP_NEEDS_CONSENT_UNDER;
	}

	/** Whether the account behind this registration is a parent's to hold. */
	public static boolean accountIsHeldByAGuardian(LocalDate born, LocalDate day) {
		return yearsOldOn(born, day) < ACCOUNT_IS_HELD_BY_A_GUARDIAN_UNDER;
	}
}
