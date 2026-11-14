package com.btl.portal.domain.event;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHICH KINDS HOLD RACES, AND WHICH CHANGE OF KIND CROSSES THE SCORING, over every pair of the four kinds.
 *
 * <p>PDL, 14.11.2026: the four kinds are „Bodovana trka", „Nebodovana trka", „Trening" and „Skup", and
 * „Vrsta događaja koji ima ijedan rezultat ne može da se promeni između Bodovane i Nebodovane trke dok
 * rezultati stoje"; „Prelazak u Trening ili Skup se ovim ne menja". So of the sixteen pairs exactly two
 * cross the scoring, and a change OUT of a training or a gathering crosses nothing either (it holds no
 * race, so it carries no result to protect).
 */
class WhatAnEventCarriesTest {

	@ParameterizedTest
	@CsvSource({"race, true", "unscored, true", "training, false", "gathering, false"})
	void aScoredAndAnUnscoredRaceHoldRacesAndNothingElseDoes(String kind, boolean holds) {
		assertThat(WhatAnEventCarries.holdsRaces(kind)).isEqualTo(holds);
	}

	@ParameterizedTest
	@CsvSource({
			"race, race, false", "race, unscored, true", "race, training, false", "race, gathering, false",
			"unscored, race, true", "unscored, unscored, false", "unscored, training, false",
			"unscored, gathering, false",
			"training, race, false", "training, unscored, false", "training, training, false",
			"training, gathering, false",
			"gathering, race, false", "gathering, unscored, false", "gathering, training, false",
			"gathering, gathering, false"})
	void onlyAChangeBetweenAScoredAndAnUnscoredRaceCrossesTheScoring(String before, String after,
			boolean crosses) {
		assertThat(WhatAnEventCarries.crossesTheScoring(before, after)).isEqualTo(crosses);
	}
}
