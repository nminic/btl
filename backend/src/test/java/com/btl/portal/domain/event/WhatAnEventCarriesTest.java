package com.btl.portal.domain.event;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHICH KINDS HOLD RACES, AND WHICH CHANGE OF KIND ENTERS ONE, over every pair of the four kinds.
 *
 * <p>PDL, 14.11.2026: the four kinds are „Bodovana trka", „Nebodovana trka", „Trening" and „Skup", and
 * „Vrsta događaja koji ima ijedan rezultat ne može da se promeni između Bodovane i Nebodovane trke dok
 * rezultati stoje"; „Prelazak u Trening ili Skup se ovim ne menja". A change INTO a scored or an unscored
 * race from any other kind is the one asked about, out of a training and a gathering included, since an
 * event standing as a training with its races no longer says whether they were scored (review of PR 729).
 * A change into a training or a gathering, and a kind kept, are not.
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
			"training, race, true", "training, unscored, true", "training, training, false",
			"training, gathering, false",
			"gathering, race, true", "gathering, unscored, true", "gathering, training, false",
			"gathering, gathering, false"})
	void onlyAChangeIntoAScoredOrAnUnscoredRaceFromAnotherKindIsAsked(String before, String after,
			boolean enters) {
		assertThat(WhatAnEventCarries.entersAKindThatHoldsRaces(before, after)).isEqualTo(enters);
	}
}
