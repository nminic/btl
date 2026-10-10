package com.btl.portal.domain.event;

import com.btl.portal.domain.event.WhatARaceCarries.ARace;
import com.btl.portal.domain.event.WhatARaceCarries.Figures;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT A RACE FIXES, READ FROM THE RACE'S SIDE, AND WHETHER AN EDIT MOVED IT.
 *
 * <p>{@link WhatARaceCarries#figuresOf} is measured where it is asked, by the routes that count
 * a run ({@code ResultWriteApiTest}, {@code VerificationWriteApiTest},
 * {@code VerificationApiTest}). What is measured here is the pair built on top of it for the
 * recount of a corrected race ({@code RaceWriteApi}): {@link WhatARaceCarries#whatItFixes} and
 * {@link WhatARaceCarries#whatItFixesMoved}. Both are pure, so every way they can be wrong is
 * a case that runs in milliseconds rather than against a database.
 *
 * <p><b>THE TABLE OF EDITS IS WRITTEN BY HAND AND HAS A FLOOR IN THE SAME FILE.</b>
 * {@link #everyKindIsAskedBothWaysItCanBeAsked} reads the kinds off {@link WhatARaceCarries#KINDS}
 * and requires, for each, an edit that moves nothing and - where the kind fixes anything at all -
 * an edit that moves what it fixes. A fourth kind added to the codebook fails it the day it is
 * added, rather than being the one nobody wrote a case for.
 */
class WhatARaceCarriesTest {

	/** A marathon with a climb unlike its fall, so a figure read from the wrong side shows. */
	private static final ARace A_MARATHON = new ARace("length", new BigDecimal("42.2"), 300, 280, 0);

	/** Six hours, with a climb and a fall of its own that are in nobody's score. */
	private static final ARace SIX_HOURS = new ARace("time", BigDecimal.ZERO, 350, 410, 21600);

	/** A race that fixes nothing, carrying a climb and a fall all the same. */
	private static final ARace A_FREE_ONE = new ARace("free", BigDecimal.ZERO, 200, 210, 0);

	/** One edit: the race before, the race after, and whether the runs at it would move. */
	record Edit(String what, ARace before, ARace after, boolean moves) {

		@Override
		public String toString() {
			return what;
		}
	}

	static List<Edit> edits() {
		return List.of(
				new Edit("a marathon left as it was", A_MARATHON, A_MARATHON, false),
				new Edit("a marathon's length written at another scale", A_MARATHON,
						new ARace("length", new BigDecimal("42.2000"), 300, 280, 0), false),
				new Edit("a marathon corrected to 42,195", A_MARATHON,
						new ARace("length", new BigDecimal("42.195"), 300, 280, 0), true),
				new Edit("a marathon's climb corrected", A_MARATHON,
						new ARace("length", new BigDecimal("42.2"), 301, 280, 0), true),
				new Edit("a marathon's fall corrected", A_MARATHON,
						new ARace("length", new BigDecimal("42.2"), 300, 279, 0), true),
				new Edit("six hours left as they were", SIX_HOURS, SIX_HOURS, false),
				new Edit("six hours with a climb and a fall of their own corrected", SIX_HOURS,
						new ARace("time", BigDecimal.ZERO, 500, 600, 21600), false),
				new Edit("six hours corrected to twenty four", SIX_HOURS,
						new ARace("time", BigDecimal.ZERO, 350, 410, 86400), true),
				new Edit("a free race left as it was", A_FREE_ONE, A_FREE_ONE, false),
				new Edit("a free race with a climb and a fall of its own corrected", A_FREE_ONE,
						new ARace("free", BigDecimal.ZERO, 333, 222, 0), false),
				new Edit("a marathon turned into six hours", A_MARATHON, SIX_HOURS, true),
				new Edit("six hours turned into a marathon", SIX_HOURS, A_MARATHON, true),
				new Edit("a free race turned into a marathon", A_FREE_ONE, A_MARATHON, true),
				new Edit("a marathon turned into a free race", A_MARATHON, A_FREE_ONE, true),
				new Edit("a free race turned into six hours", A_FREE_ONE, SIX_HOURS, true),
				new Edit("six hours turned into a free race", SIX_HOURS, A_FREE_ONE, true));
	}

	@ParameterizedTest
	@MethodSource("edits")
	void anEditMovesTheRunsExactlyWhenItMovesWhatTheRaceFixes(Edit edit) {
		assertThat(WhatARaceCarries.whatItFixesMoved(edit.before(), edit.after()))
				.as(edit.what())
				.isEqualTo(edit.moves());
	}

	/**
	 * WHAT EACH KIND FIXES, AS A VALUE, AND AN EMPTY PLACE FOR WHAT IT LEAVES TO THE RUNNER.
	 *
	 * <p>Written out per kind rather than compared against {@link WhatARaceCarries#figuresOf},
	 * because asked that way this case would be the method compared with itself.
	 */
	@Test
	void eachKindFixesWhatTheOwnerSaidItFixesAndLeavesTheRestEmpty() {
		assertThat(WhatARaceCarries.whatItFixes(A_MARATHON))
				.as("a race of a length fixes the course and leaves the time to the runner")
				.isEqualTo(new Figures(new BigDecimal("42.2"), 300, 280, null));
		assertThat(WhatARaceCarries.whatItFixes(SIX_HOURS))
				.as("a race to a limit fixes the time and leaves the course to the runner,"
						+ " its own climb and fall included")
				.isEqualTo(new Figures(null, null, null, 21600));
		assertThat(WhatARaceCarries.whatItFixes(A_FREE_ONE))
				.as("a free race fixes nothing at all")
				.isEqualTo(new Figures(null, null, null, null));
	}

	/**
	 * THE FLOOR UNDER THE TABLE ABOVE: every kind the codebook holds is asked both ways it can be.
	 *
	 * <p>For each kind, an edit that leaves the race of that kind as it was must be in the table,
	 * and - where the kind fixes anything - an edit that keeps the kind and moves what it fixes.
	 * Read off {@link WhatARaceCarries#KINDS} and off {@link WhatARaceCarries#whatItFixes} itself,
	 * so neither half is a list of its own.
	 */
	@Test
	void everyKindIsAskedBothWaysItCanBeAsked() {
		Set<String> askedStill = edits().stream()
				.filter(one -> one.before().kind().equals(one.after().kind()) && !one.moves())
				.map(one -> one.before().kind())
				.collect(Collectors.toSet());
		Set<String> askedMoved = edits().stream()
				.filter(one -> one.before().kind().equals(one.after().kind()) && one.moves())
				.map(one -> one.before().kind())
				.collect(Collectors.toSet());
		Set<String> fixingSomething = edits().stream()
				.map(Edit::before)
				.filter(race -> !WhatARaceCarries.whatItFixes(race)
						.equals(new Figures(null, null, null, null)))
				.map(ARace::kind)
				.collect(Collectors.toSet());

		assertThat(askedStill).as("a kind with no edit that leaves it as it was")
				.isEqualTo(WhatARaceCarries.KINDS);
		assertThat(askedMoved).as("a kind that fixes something with no edit that moves it")
				.containsAll(fixingSomething);
		assertThat(edits().stream().map(Edit::before).map(ARace::kind).collect(Collectors.toSet()))
				.as("a kind of the codebook no race in the table is of")
				.isEqualTo(WhatARaceCarries.KINDS);
	}
}
