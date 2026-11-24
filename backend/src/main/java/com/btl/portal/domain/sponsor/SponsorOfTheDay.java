package com.btl.portal.domain.sponsor;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * WHICH SPONSOR STANDS IN THE BOX „SPONZOR DANA” ON A GIVEN DAY.
 *
 * <p>Owner, PDL 24.11.2026: „„Sponzor dana” se smenjuje po danu, a glavni sponzor ide duplo češće od bilo
 * kog drugog.”, with „imam pravo na nivou sponzora da oznacavam da li je glavni, default No, i da ne oznacim
 * nikom.” So the box changes once a day, the one marked main comes up twice for every time any other comes
 * up once, and with nobody marked every sponsor in the rotation comes up equally often.
 *
 * <p><b>THE RULE, AND WHY IT IS PREDICTABLE</b>. The sponsors in the rotation are put in one cycle, in the
 * order they are handed in (the main one first, then the manual order of the administration). Without a main
 * sponsor the cycle is that list. With one and N others, the cycle is N + 2 days long and holds the main
 * sponsor twice: once at its head and once after the first half of the others,
 * {@code [main, o1 … o⌈N/2⌉, main, o⌈N/2⌉+1 … oN]}, so over every whole cycle the main sponsor has two days
 * and each other one day, and its two days are as far apart as the cycle allows. The day is the number of days
 * since 1 January 1970 in the league's time zone, taken modulo the length of the cycle. Nothing random and
 * nothing remembered: the same sponsors on the same day give the same answer on every server and to every
 * visitor, and a sponsor added or taken out changes the cycle from that day on.
 *
 * <p><b>What it does NOT do, named</b>: it does not keep a sponsor's turn across a change of the list. A
 * sponsor added on Tuesday makes the cycle one day longer, and Wednesday is then read off the new cycle, not
 * off the old one continued. That costs nothing the owner asked for (he asked for a share, not for a fixed
 * calendar), and remembering the old cycle would be a table of turns for a box that changes once a day.
 */
public final class SponsorOfTheDay {

	private SponsorOfTheDay() {
	}

	/**
	 * One sponsor in the rotation, as the cycle needs it.
	 *
	 * @param id   the sponsor
	 * @param main whether it is the one marked main; at most one is, which the schema holds
	 */
	public record InRotation(long id, boolean main) {
	}

	/**
	 * The cycle the days walk round.
	 *
	 * @param inRotation the sponsors in the rotation, main first and then in the manual order
	 * @return each day of the cycle, the sponsor it shows
	 */
	public static List<Long> cycleOf(List<InRotation> inRotation) {
		List<Long> others = inRotation.stream().filter(one -> !one.main()).map(InRotation::id).toList();
		Optional<Long> main = inRotation.stream().filter(InRotation::main).map(InRotation::id).findFirst();

		if (main.isEmpty()) {
			return others;
		}

		int half = (others.size() + 1) / 2;
		List<Long> cycle = new ArrayList<>(others.size() + 2);

		cycle.add(main.get());
		cycle.addAll(others.subList(0, half));
		cycle.add(main.get());
		cycle.addAll(others.subList(half, others.size()));

		return cycle;
	}

	/**
	 * The sponsor of one day, or none where nobody is in the rotation.
	 *
	 * @param inRotation the sponsors in the rotation, main first and then in the manual order
	 * @param day        the day in the league's time zone ({@code SeasonClock.ZONE})
	 * @return the sponsor that day shows
	 */
	public static Optional<Long> on(List<InRotation> inRotation, LocalDate day) {
		List<Long> cycle = cycleOf(inRotation);

		if (cycle.isEmpty()) {
			return Optional.empty();
		}

		return Optional.of(cycle.get((int) Math.floorMod(day.toEpochDay(), (long) cycle.size())));
	}
}
