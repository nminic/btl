package com.btl.portal.domain.registration;

import com.btl.portal.domain.pricing.MembershipPrice;
import com.btl.portal.domain.registration.Guardianship.Relation;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The two boundaries, and the three people who may sign. */
class GuardianshipTest {

	private static final LocalDate A_DAY = LocalDate.parse("2027-06-15");

	private static LocalDate bornYearsBefore(int years) {
		return A_DAY.minusYears(years);
	}

	/**
	 * Age is whole years, and a birthday is the day it turns over.
	 *
	 * <p>The day before a birthday and the birthday itself are the two rows that
	 * would separate this from a difference of calendar years, and the last day of
	 * December against the first of January is the pair that would pass under one
	 * and fail under the other.
	 */
	@ParameterizedTest(name = "born {0}, on {1} = {2}")
	@CsvSource({
			"2011-06-16, 2027-06-15, 15",
			"2011-06-15, 2027-06-15, 16",
			"2011-06-14, 2027-06-15, 16",
			"2010-12-31, 2027-01-01, 16",
			"2011-01-01, 2027-12-31, 16",
			"2027-06-15, 2027-06-15, 0",
	})
	void ageIsWholeYearsAndTurnsOverOnTheBirthday(String born, String day, int years) {
		assertThat(Guardianship.yearsOldOn(LocalDate.parse(born), LocalDate.parse(day))).isEqualTo(years);
	}

	@Test
	void nobodyHasAnAgeBeforeHeIsBorn() {
		assertThatThrownBy(() -> Guardianship.yearsOldOn(A_DAY, A_DAY.minusDays(1)))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("before he is born");
	}

	/**
	 * UNDER FOURTEEN THE MEMBERSHIP NEEDS A PARENT'S CONSENT, and at fourteen it
	 * does not.
	 *
	 * <p>Statute, Article 9. Both sides of the boundary, because a rule written
	 * with the comparison the wrong way round is right on one of them.
	 */
	@ParameterizedTest(name = "{0} years old: {1}")
	@CsvSource({"0, true", "13, true", "14, false", "15, false", "16, false", "40, false"})
	void underFourteenTheMembershipItselfNeedsConsent(int years, boolean needed) {
		assertThat(Guardianship.membershipNeedsConsent(bornYearsBefore(years), A_DAY)).isEqualTo(needed);
	}

	/**
	 * UNDER SIXTEEN THE ACCOUNT IS A PARENT'S TO HOLD, and at sixteen it is not.
	 *
	 * <p>The row that matters most is fourteen and fifteen: TRUE here and FALSE
	 * above, which is the whole reason there are two boundaries and not one. A
	 * fourteen year old accepts membership himself while his father still holds
	 * the account.
	 */
	@ParameterizedTest(name = "{0} years old: {1}")
	@CsvSource({"0, true", "13, true", "14, true", "15, true", "16, false", "40, false"})
	void underSixteenTheAccountIsHeldByAGuardian(int years, boolean held) {
		assertThat(Guardianship.accountIsHeldByAGuardian(bornYearsBefore(years), A_DAY)).isEqualTo(held);
	}

	/**
	 * And the two are TWO, which is the sentence PDL P8 writes out.
	 *
	 * <p>"Granica od 16 za saglasnost je potpuno odvojena od junior cene, koja
	 * ostaje do 14 godina. Iste cifre se ne smeju spajati." The record that
	 * preceded this class knew one boundary, and the Statute of 17.08.2026 has
	 * two; a version answering the same thing to both questions passes every case
	 * above except the fourteen and fifteen year old, so this says it outright.
	 */
	@Test
	void thereAreTwoBoundariesAndTheyAreNotTheSameNumber() {
		assertThat(Guardianship.MEMBERSHIP_NEEDS_CONSENT_UNDER)
				.as("the two boundaries have been joined into one")
				.isNotEqualTo(Guardianship.ACCOUNT_IS_HELD_BY_A_GUARDIAN_UNDER);

		LocalDate fifteen = bornYearsBefore(15);

		assertThat(Guardianship.membershipNeedsConsent(fifteen, A_DAY))
				.as("a fifteen year old was made to ask his father for permission to join")
				.isFalse();
		assertThat(Guardianship.accountIsHeldByAGuardian(fifteen, A_DAY))
				.as("a fifteen year old was given an account of his own")
				.isTrue();
	}

	/**
	 * AND NEITHER OF THEM IS THE JUNIOR PRICE, which is also a boundary about
	 * fourteen.
	 *
	 * <p>The same sentence of PDL P8 forbids joining those two as well, and they
	 * move for different reasons: one when the Statute changes, one when the owner
	 * changes what a season costs. Read from the two classes rather than written
	 * out, so the day one of them moves this says whether the other moved with it.
	 */
	@Test
	void andNeitherBoundaryIsTheJuniorPrice() {
		assertThat(MembershipPrice.OLDEST_JUNIOR_IN_A_SEASON)
				.as("the consent boundary and the junior price have been read off one constant")
				.isNotEqualTo(Guardianship.MEMBERSHIP_NEEDS_CONSENT_UNDER)
				.isNotEqualTo(Guardianship.ACCOUNT_IS_HELD_BY_A_GUARDIAN_UNDER);
	}

	@Test
	void theThreeWhoMaySignAreTheThreeTheFormOffers() {
		assertThat(Relation.values()).hasSize(3);
		assertThat(Relation.named("mother")).isEqualTo(Relation.MOTHER);
		assertThat(Relation.named("father")).isEqualTo(Relation.FATHER);
		assertThat(Relation.named("guardian")).isEqualTo(Relation.GUARDIAN);
	}

	@Test
	void aRelationNobodyCouldHaveChosenIsRefusedByName() {
		assertThatThrownBy(() -> Relation.named("uncle"))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("uncle");
	}

	@Test
	void whatIsNotThereIsRefusedByName() {
		assertThatThrownBy(() -> Guardianship.yearsOldOn(null, A_DAY))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("born");
		assertThatThrownBy(() -> Guardianship.yearsOldOn(A_DAY, null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("day");
	}
}
