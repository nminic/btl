package com.btl.portal.domain.balance;

import com.btl.portal.domain.balance.BookLine.Reason;
import com.btl.portal.domain.pricing.Currency;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * WHAT ONE SEASON'S MEMBERSHIP HOLDS AGAINST THE BALANCE, AND THE LINE THAT REVERSES IT.
 *
 * <p><b>The decision.</b> The owner, 18.10.2026 (PDL P8, the section „Osnov clanstva ima jedan dom,
 * zapis po sezoni"), chosen with the recommendation: „Knjiga balansa pri stornu i pri promeni
 * "uplata" u oslobodjenje: protivstavka. Upisuje se nova stavka koja vraca ono sto je bilo skinuto sa
 * balansa, odnosno skida visak koji je otisao u balans; nista se ne brise". And: „aktivacija iz
 * balansa se moze stornirati, uz protivstavku u knjizi." So when a season's membership is cancelled,
 * or its basis changes from a payment to an exemption, a {@code reversal} line (V63) gives back what
 * the season took off the balance and takes back the surplus it credited.
 *
 * <p><b>What a season holds is read off the book as it stands</b>, never recomputed from a price list:
 * the book is the record of what happened ({@code BalanceBook.whatAMembershipTook} says why). The
 * lines that belong to a season are the ones naming it, and which reasons name a season is the
 * schema's rule rather than a list here: {@code balance_entry_what_names_the_season} puts
 * {@code membership}, {@code overpayment} and {@code reversal} on that side and nothing else. That is
 * why a reward is never reversed: it names no season and stands in the referrer's book („Nagrada
 * preporuciocu ostaje kad se clanstvo preporucenog stornira", 18.10.2026).
 *
 * <p><b>ONLY THE LINES AFTER THE SEASON'S LAST REVERSAL.</b> A season can be cancelled, paid for again
 * and cancelled a second time, and every pass leaves its lines in a book that never changes. A
 * reversal nets the season to nothing at the moment it is written, so what the season holds NOW is
 * what was written for it after the last one. In one currency that is the same number as the net of
 * the whole history; the two part company only when the member changed country in between, and then
 * the netting across currencies would add a restatement's rounding to every later answer. The order
 * is the key the book gave each line, which is the order they were written in.
 *
 * <p><b>IN HIS MONEY OF TODAY, translated with {@link Balance#translated}.</b> This is not a decision
 * of the owner's but a derivation from the one rule the portal has for moving a balance between
 * currencies (PDL 26: 1 EUR = 120 RSD, the rounding of {@link Balance#translated}): the balance is the
 * sum of his lines in his current currency ({@code BalanceBook.of}), so a reversal written in the money
 * of the original line would never reach the balance he sees once he has moved. Each line is
 * translated on its own, with the same rounding a change of country uses.
 *
 * <p><b>WHAT THIS DOES NOT CHECK: that the balance stays above nothing afterwards.</b> Taking back a
 * credit lowers the balance, and {@link Balance.Money} refuses a negative amount. It cannot go below
 * nothing while the seasons that may be acted on are „do 14.10. samo tekuca, od 15.10. samo naredna"
 * (PDL P8, 18.10.2026): a credit of season S can only be spent on another season's membership, and
 * that season is sold only once S may no longer be touched. The route that writes a reversal enforces
 * those seasons; this class does not repeat the rule.
 */
public final class ReversingAMembership {

	private ReversingAMembership() {
	}

	/**
	 * THE LINE A REVERSAL WRITES: an amount with its sign, never nought, in his money of today.
	 *
	 * <p>Positive when the season took something off the balance and it is given back, negative when
	 * the season credited a surplus and it is taken back; {@code balance_entry_a_reversal_moves_something}
	 * (V63) refuses nought, and so does this record.
	 */
	public record Reversal(BigDecimal amount, Currency currency) {

		public Reversal {
			Objects.requireNonNull(amount, "amount");
			Objects.requireNonNull(currency, "currency");

			if (amount.signum() == 0) {
				throw new IllegalArgumentException("a reversal of nothing is not a line of the book");
			}
		}
	}

	/**
	 * The lines one season holds now: the ones naming it, after the last reversal of it, in the order
	 * they were written.
	 *
	 * @param book every line of ONE member's book, in any order
	 */
	public static List<BookLine> whatTheSeasonHolds(List<BookLine> book, int season) {
		Objects.requireNonNull(book, "book");

		List<BookLine> ofTheSeason = book.stream()
				.filter(line -> Objects.equals(line.season(), season))
				.sorted(Comparator.comparingLong(BookLine::id))
				.toList();

		int lastReversal = -1;

		for (int i = 0; i < ofTheSeason.size(); i++) {
			if (ofTheSeason.get(i).reason() == Reason.REVERSAL) {
				lastReversal = i;
			}
		}

		return ofTheSeason.subList(lastReversal + 1, ofTheSeason.size());
	}

	/**
	 * THE REVERSAL OF ONE SEASON, or nothing when the season holds nothing against the balance - a
	 * membership on a payment that took nothing and credited nothing, an exemption, or a season
	 * already reversed.
	 *
	 * @param book  every line of ONE member's book
	 * @param today the money he is billed in today
	 */
	public static Optional<Reversal> reversal(List<BookLine> book, int season, Currency today) {
		Objects.requireNonNull(today, "today");

		BigDecimal held = BigDecimal.ZERO;

		for (BookLine line : whatTheSeasonHolds(book, season)) {
			held = held.add(inHisMoney(line, today));
		}

		return held.signum() == 0 ? Optional.empty() : Optional.of(new Reversal(held.negate(), today));
	}

	/**
	 * WHAT THE SEASON'S MEMBERSHIP TOOK OFF THE BALANCE, as a positive amount in the money the spend
	 * was written in, and nothing in {@code ifItTookNothing} when it took nothing.
	 *
	 * <p>In the line's own money and not his money of today, for the reason
	 * {@code BalanceBook.whatAMembershipTook} gives: a member who has since changed country is told
	 * about the line that exists. One membership is written at one moment and so in one money; two
	 * moneys among the lines a season holds is a book this portal cannot write, and it is refused
	 * rather than answered with one of the two.
	 */
	public static Balance.Money whatItTook(List<BookLine> book, int season, Currency ifItTookNothing) {
		Objects.requireNonNull(ifItTookNothing, "ifItTookNothing");

		List<BookLine> spends = whatTheSeasonHolds(book, season).stream()
				.filter(line -> line.reason() == Reason.MEMBERSHIP)
				.toList();

		if (spends.isEmpty()) {
			return Balance.Money.nothingIn(ifItTookNothing);
		}

		Currency written = spends.get(0).currency();
		BigDecimal taken = BigDecimal.ZERO;

		for (BookLine spend : spends) {
			if (spend.currency() != written) {
				throw new IllegalStateException("season " + season + " holds spends in " + written
						+ " and in " + spend.currency());
			}

			taken = taken.subtract(spend.amount());
		}

		return new Balance.Money(taken, written);
	}

	/** One line's signed amount in the given money, translated as a change of country translates. */
	private static BigDecimal inHisMoney(BookLine line, Currency today) {
		BigDecimal translated = Balance.translated(
				new Balance.Money(line.amount().abs(), line.currency()), today).amount();

		return line.amount().signum() < 0 ? translated.negate() : translated;
	}
}
