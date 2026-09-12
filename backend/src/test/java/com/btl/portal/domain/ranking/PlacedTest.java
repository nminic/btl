package com.btl.portal.domain.ranking;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** A row that knows its place. */
class PlacedTest {

	@Test
	void itCarriesTheRowUntouchedBesideThePlace() {
		Placed<String> first = new Placed<>("Dražen", 1);

		assertThat(first.row()).isEqualTo("Dražen");
		assertThat(first.position()).isOne();
	}

	/**
	 * A place starts at 1.
	 *
	 * <p>Zero is the one worth naming: it is what a loop counting from zero hands
	 * in, and a table whose first line reads 0 is wrong in a way a reader notices
	 * before any test does.
	 */
	@ParameterizedTest
	@ValueSource(ints = {0, -1})
	void aPlaceNeverStartsBelowOne(int position) {
		assertThatThrownBy(() -> new Placed<>("Dražen", position))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("a place starts at 1");
	}

	@Test
	void thereIsNoPlaceWithoutARow() {
		assertThatThrownBy(() -> new Placed<>(null, 1))
				.isInstanceOf(NullPointerException.class)
				.hasMessageContaining("row");
	}
}
