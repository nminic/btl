package com.btl.portal.domain.ranking;

import com.btl.portal.domain.ranking.Standing.Rung;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The ladder of the general standing, and the places it hands out. */
class StandingTest {

	/** A competitor with a season behind him. The member number is a number and not
	 *  a string, which is the whole of what the last rung asks for. */
	private record Row(String who, Totals totals, long memberNumber) {
	}

	private static final Comparator<Row> LADDER =
			Comparator.comparing(Row::totals, Standing.ladder(Standing.GENERAL));

	private static Row row(String who, long memberNumber, String points, String kilometers, int races,
			int ascent, int descent, long seconds) {
		return new Row(who, new Totals(races, new BigDecimal(kilometers), ascent, descent, seconds,
				new BigDecimal(points)), memberNumber);
	}

	private static List<String> orderOf(List<Row> rows) {
		return Standing.places(rows, LADDER, Row::memberNumber).stream()
				.map(placed -> placed.row().who())
				.toList();
	}

	/** Everything equal but the rung being measured, so the rung is the only thing
	 *  that can decide. */
	private static Row levelExcept(String who, long memberNumber, String points, String kilometers, int races,
			int vertical, long seconds) {
		return row(who, memberNumber, points, kilometers, races, vertical, 0, seconds);
	}

	@Test
	void pointsDecideFirst() {
		assertThat(orderOf(List.of(
				levelExcept("manje", 1, "40.00", "100.00", 5, 1000, 3600L),
				levelExcept("vise", 2, "40.01", "100.00", 5, 1000, 3600L))))
				.as("the standing was not led by points, which is its first rung")
				.containsExactly("vise", "manje");
	}

	@Test
	void whenPointsAreLevelKilometresDecide() {
		assertThat(orderOf(List.of(
				levelExcept("manje", 1, "40.00", "100.00", 5, 1000, 3600L),
				levelExcept("vise", 2, "40.00", "100.01", 5, 1000, 3600L))))
				.containsExactly("vise", "manje");
	}

	@Test
	void whenKilometresAreLevelMoreRacesDecide() {
		assertThat(orderOf(List.of(
				levelExcept("manje", 1, "40.00", "100.00", 5, 1000, 3600L),
				levelExcept("vise", 2, "40.00", "100.00", 6, 1000, 3600L))))
				.containsExactly("vise", "manje");
	}

	@Test
	void whenRacesAreLevelMoreVerticalDecides() {
		assertThat(orderOf(List.of(
				levelExcept("manje", 1, "40.00", "100.00", 5, 1000, 3600L),
				levelExcept("vise", 2, "40.00", "100.00", 5, 1001, 3600L))))
				.containsExactly("vise", "manje");
	}

	/**
	 * And vertical is ascent AND descent, not one of them.
	 *
	 * <p>The rung is named "više vertikale" and the rulebook counts both.
	 *
	 * <p><b>TWO PAIRS, because one pair cannot say it.</b> The case here until a
	 * round on 11.09.2026 was a single pair, level on the total, one climbing more
	 * and the other descending more; the member number then decided, and it
	 * happened to agree with the climbing half, so a version reading only the
	 * climb passed. Reversing the member numbers only moves the hole to the other
	 * half. The claim "both halves" is two claims and needs a pair each.
	 *
	 * <p>So neither pair is level: each is separated by the TOTAL while the row
	 * that should lose holds the larger of one half. The first pair falls to a
	 * version reading only the climb, the second to one reading only the descent,
	 * and in both the member number is set so that a version consulting no rung at
	 * all comes out backwards too.
	 */
	@Test
	void verticalIsBothHalvesAndNotOne() {
		/* 1000 against 900, and the loser climbs eight times as much. */
		assertThat(orderOf(List.of(
				row("silazi", 9, "40.00", "100.00", 5, 100, 900, 3600L),
				row("penje", 1, "40.00", "100.00", 5, 800, 100, 3600L))))
				.as("only the climbing half was counted, and the rulebook counts both")
				.containsExactly("silazi", "penje");

		/* And the same the other way: 1000 against 900, the loser descends eight
		   times as much. */
		assertThat(orderOf(List.of(
				row("penje", 9, "40.00", "100.00", 5, 900, 100, 3600L),
				row("silazi", 1, "40.00", "100.00", 5, 100, 800, 3600L))))
				.as("only the descending half was counted, and the rulebook counts both")
				.containsExactly("penje", "silazi");
	}

	/**
	 * TIME ON COURSE IS NOT A RUNG, and that is the principle of Član 49 rather
	 * than an omission.
	 *
	 * <p>"Nagrađuje se veći obim, nikad efikasnost." Two seasons identical but for
	 * the hours spent are level in this standing, and the member number decides.
	 * Reading time as a rung either way would be a rule about speed: more of it
	 * would seat whoever was slower over the same course ahead, less of it would
	 * seat whoever did less.
	 */
	@Test
	void timeOnCourseDecidesNothingInTheGeneralStanding() {
		assertThat(orderOf(List.of(
				levelExcept("sporiji", 7, "40.00", "100.00", 5, 1000, 36000L),
				levelExcept("brzi", 3, "40.00", "100.00", 5, 1000, 3600L))))
				.as("the standing was ordered by how long somebody was out there")
				.containsExactly("brzi", "sporiji");
	}

	/**
	 * NO SHARED PLACE: 1, 2, 3, nothing skipped and nothing given twice.
	 *
	 * <p>Owner, 31.07.2026, confirmed 11.08.2026. Until then two level rows shared
	 * a number and the next was skipped, so a level first place read 1, 1, 3 and
	 * the trophy was handed out twice. All three rows here are level all the way
	 * down the ladder, which is the case that used to produce 1, 1, 1.
	 */
	@Test
	void placesRunOneTwoThreeEvenWhenTheLadderSeparatesNobody() {
		List<Placed<Row>> placed = Standing.places(List.of(
				levelExcept("treci", 300_000, "40.00", "100.00", 5, 1000, 3600L),
				levelExcept("prvi", 100_000, "40.00", "100.00", 5, 1000, 3600L),
				levelExcept("drugi", 200_000, "40.00", "100.00", 5, 1000, 3600L)),
				LADDER, Row::memberNumber);

		assertThat(placed.stream().map(Placed::position)).containsExactly(1, 2, 3);
		assertThat(placed.stream().map(one -> one.row().who()))
				.as("the lower member number did not go ahead where nothing else separated them")
				.containsExactly("prvi", "drugi", "treci");
	}

	/**
	 * The last rung is a NUMBER, which is what makes it right for a member number
	 * written without its padding.
	 *
	 * <p>A member number is six digits with leading zeros, and compared as text
	 * that works only for as long as every one of them is six characters wide: as
	 * strings "1000" sorts ahead of "999", and the table would be wrong in a way
	 * nobody would look for. The two here are level all the way down, so the last
	 * rung is the only thing deciding.
	 */
	@Test
	void theLastRungOrdersNumbersAndNotText() {
		assertThat(orderOf(List.of(
				levelExcept("hiljaditi", 1000, "40.00", "100.00", 5, 1000, 3600L),
				levelExcept("devetstodevedesetdeveti", 999, "40.00", "100.00", 5, 1000, 3600L))))
				.as("999 came after 1000, which is what comparing member numbers as text does")
				.containsExactly("devetstodevedesetdeveti", "hiljaditi");
	}

	/**
	 * The caller's own list comes back as it went in.
	 *
	 * <p>Sorting in place would reorder an array the caller is still drawing from,
	 * and the rows are handed in unsorted precisely so nobody sorts them twice.
	 */
	@Test
	void theListHandedInIsNotReorderedUnderneathTheCaller() {
		List<Row> mine = new ArrayList<>(List.of(
				levelExcept("drugi", 2, "10.00", "10.00", 1, 10, 60L),
				levelExcept("prvi", 1, "99.00", "10.00", 1, 10, 60L)));

		Standing.places(mine, LADDER, Row::memberNumber);

		assertThat(mine.stream().map(Row::who))
				.as("the caller's list was sorted underneath it")
				.containsExactly("drugi", "prvi");
	}

	@Test
	void nobodyAtAllIsNoPlacesAtAll() {
		assertThat(Standing.places(List.of(), LADDER, Row::memberNumber)).isEmpty();
	}

	/**
	 * Every rung of the general standing is one of the four, in the rulebook's
	 * order.
	 *
	 * <p>Written out here and read out of the published rulebook by
	 * {@link LaddersMatchTheRulebookTest}, which is where the two are tied
	 * together. What this one holds is the ORDER as code sees it, so a ladder
	 * whose rungs were shuffled fails here even if the set is unchanged.
	 */
	@Test
	void theGeneralLadderIsPointsKilometresRacesVertical() {
		assertThat(Standing.GENERAL)
				.containsExactly(Rung.POINTS, Rung.KILOMETERS, Rung.RACES, Rung.VERTICAL);
	}

	@Test
	void aLadderWithNoRungsOrdersNothingAndSaysSo() {
		assertThatThrownBy(() -> Standing.ladder(List.of()))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("no rungs");
	}

	@Test
	void whatIsNotThereIsRefusedByName() {
		assertThatThrownBy(() -> Standing.ladder(null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("rungs");
		assertThatThrownBy(() -> Standing.places(null, LADDER, Row::memberNumber))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("rows");
		assertThatThrownBy(() -> Standing.places(List.of(), null, Row::memberNumber))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("ladder");
		assertThatThrownBy(() -> Standing.places(List.<Row>of(), LADDER, null))
				.isInstanceOf(NullPointerException.class).hasMessageContaining("lastRung");
	}

	/** A ladder of one rung is a ladder, which is the case the loop below the first
	 *  rung never runs for. */
	@Test
	void aLadderOfOneRungIsALadder() {
		assertThat(orderOf(List.of(
				levelExcept("manje", 1, "10.00", "10.00", 1, 10, 60L),
				levelExcept("vise", 2, "20.00", "10.00", 1, 10, 60L))))
				.containsExactly("vise", "manje");

		Comparator<Totals> onlyPoints = Standing.ladder(List.of(Rung.POINTS));

		assertThat(onlyPoints.compare(
				new Totals(1, new BigDecimal("99.00"), 0, 0, 1L, new BigDecimal("10.00")),
				new Totals(9, new BigDecimal("10.00"), 0, 0, 9L, new BigDecimal("10.00"))))
				.as("a ladder of one rung consulted a second one")
				.isZero();
	}
}
