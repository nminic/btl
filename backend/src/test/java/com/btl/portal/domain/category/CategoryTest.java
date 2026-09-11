package com.btl.portal.domain.category;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Which category somebody competes in.
 *
 * <p>Most of this file is about the four boundaries between the bands, because a
 * boundary is the only place a band can be wrong, and about the one thing that
 * changed from the 2017 rulebook: age is decided on 1 January and does not move
 * during the season.
 */
class CategoryTest {

	/**
	 * Every boundary, from both sides.
	 *
	 * <p>Four bands make three boundaries, and each is given the last year that
	 * belongs to the lower band and the first that belongs to the upper one. A band
	 * written with {@code <} where it should have {@code <=}, or the other way round,
	 * fails here and nowhere else.
	 */
	@ParameterizedTest
	@CsvSource({
			// season 2027, so the age is 2027 minus the year of birth
			"2027, 2003, 24-",     // 24, the last year of the lowest band
			"2027, 2002, 25-39",   // 25, the first of the second
			"2027, 1988, 25-39",   // 39, the last of the second
			"2027, 1987, 40-54",   // 40, the first of the third
			"2027, 1973, 40-54",   // 54, the last of the third
			"2027, 1972, 55+",     // 55, the first of the fourth
			"2027, 1927, 55+",     // a hundred, and there is no band above
			"2027, 2027, 24-"      // born this season, which is as young as it gets
	})
	void everyBoundaryBetweenTheBandsIsWhereItShouldBe(int season, int birthYear, String band) {
		assertThat(Category.ageBandFor(birthYear, season).code()).isEqualTo(band);
	}

	/**
	 * AGE IS DECIDED ON 1 JANUARY AND DOES NOT MOVE, which is the sentence that
	 * changed from the 2017 rulebook.
	 *
	 * <p>Somebody who turns forty in November is in the 40-54 band from the first of
	 * that January, and every point he scores that year belongs to it. This is
	 * measured as an absence: there is nowhere to put a day, so the answer cannot
	 * depend on one. The day he was born and the day the question is asked are both
	 * missing from the call, and that is the guard.
	 */
	@Test
	void ageIsDecidedOnTheFirstOfJanuaryAndDoesNotMoveDuringTheSeason() {
		assertThat(Category.ageBandFor(1987, 2027).code())
				.as("somebody who turns forty during 2027 is in the older band from 1 January")
				.isEqualTo("40-54");

		assertThat(Category.ageBandFor(1987, 2026).code())
				.as("and the season before it he was in the younger one, all year")
				.isEqualTo("25-39");
	}

	/** The code is the letter and the band, run together. */
	@Test
	void theCodeIsTheLetterAndTheBand() {
		assertThat(Category.codeFor("M", 1987, 2027, false)).isEqualTo("M40-54");
		assertThat(Category.codeFor("F", 1987, 2027, false)).isEqualTo("Ž40-54");
		assertThat(Category.codeFor("M", 2003, 2027, false)).isEqualTo("M24-");
		assertThat(Category.codeFor("F", 1972, 2027, false)).isEqualTo("Ž55+");
	}

	/**
	 * THE BEGINNERS' CATEGORY REPLACES THE BAND; it does not sit beside it.
	 *
	 * <p>Owner, 03.08.2026: a member is in one or the other, never both. So the band
	 * is not even computed for somebody in it, and the same member of the same age
	 * gets a different code depending only on that one answer.
	 */
	@Test
	void theBeginnersCategoryReplacesTheBandRatherThanSittingBesideIt() {
		assertThat(Category.codeFor("M", 1987, 2027, true)).isEqualTo("M R");
		assertThat(Category.codeFor("F", 1987, 2027, true)).isEqualTo("Ž R");

		assertThat(Category.codeFor("M", 1987, 2027, true))
				.as("the age band leaked into the code of somebody who is not in one")
				.doesNotContain("40-54");
	}

	/**
	 * And the band a beginner would otherwise have been in does not change his code.
	 *
	 * <p>Which is what says the band really is not computed: two members thirty years
	 * apart get the same code, and a version that appended the band to it would give
	 * them two.
	 */
	@Test
	void twoBeginnersThirtyYearsApartCarryTheSameCode() {
		assertThat(Category.codeFor("M", 2003, 2027, true))
				.isEqualTo(Category.codeFor("M", 1973, 2027, true));
	}

	/**
	 * Twelve points closes the category, eleven do not, and it is one way only.
	 *
	 * <p>The same twelve is what a participation medal is worth (P16): one threshold
	 * in two roles.
	 */
	@Test
	void twelvePointsClosesTheBeginnersCategoryAndElevenDoNot() {
		assertThat(Category.firstSeasonAllowed(11)).isTrue();
		assertThat(Category.firstSeasonAllowed(Category.FIRST_SEASON_POINTS - 1)).isTrue();
		assertThat(Category.firstSeasonAllowed(Category.FIRST_SEASON_POINTS)).isFalse();
		assertThat(Category.firstSeasonAllowed(13)).isFalse();
	}

	/**
	 * And nobody who has never scored anything is shut out of it.
	 *
	 * <p>For the season of 2027 that is everybody, because nothing before 2027 is an
	 * official season at all. The portal got this wrong once, on 15.08.2026: the check
	 * summed points across all time, which in this portal is the imported history, and
	 * it closed the category to thirty of thirty-two members for races run before the
	 * league existed.
	 */
	@Test
	void somebodyWhoHasNeverScoredAnythingIsNotShutOut() {
		assertThat(Category.firstSeasonAllowed(0))
				.as("somebody with no official season behind him was refused the category")
				.isTrue();
	}

	/** The letter is the one the tables carry. */
	@Test
	void theLetterIsTheOneTheTablesCarry() {
		assertThat(Category.genderMark("M")).isEqualTo("M");
		assertThat(Category.genderMark("F")).isEqualTo("Ž");
	}

	/**
	 * And a third gender is a schema that has moved without this moving with it.
	 *
	 * <p>{@code competitor_gender_known} says there are two. A guess here would put
	 * somebody in a category nobody can filter for, which is worse than a refusal
	 * because nothing would say so.
	 */
	@Test
	void aThirdGenderIsRefusedRatherThanGuessed() {
		assertThatThrownBy(() -> Category.genderMark("X"))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("unknown gender");

		assertThatThrownBy(() -> Category.genderMark(null))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("no gender");
	}

	/**
	 * The four codes are four, and they are the four the portal draws.
	 *
	 * <p>A fifth band, or one of these renamed, fails here - which is the nearest
	 * thing to a floor this can have: the other side of it is TypeScript, and nothing
	 * in this build can read it. That is written down rather than pretended: what ties
	 * the two is that both are generated from PDL P7, and this is the copy the server
	 * answers by.
	 */
	@Test
	void thereAreFourBandsAndTheseAreTheirCodes() {
		assertThat(java.util.Arrays.stream(Category.AgeBand.values()).map(Category.AgeBand::code))
				.containsExactly("24-", "25-39", "40-54", "55+");
	}
}
