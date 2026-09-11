package com.btl.portal.domain.member;

import java.util.Objects;
import java.util.regex.Pattern;

/**
 * The mark a member is spoken of by: six digits, and the same six for life.
 *
 * <p>Six because a numbering scheme outlives the league that started it and
 * changing the width later is expensive: it is the key of every row, every
 * address and every printed card on the portal (PDL P8). Mixed for both genders,
 * and carrying no hint of which - the form with a gender letter in it was
 * dropped on 29.07.2026 and the address may not carry one either.
 *
 * <p><b>It is handed out when somebody records that the fee arrived</b>, never
 * when somebody registers. So a registered person with no number is a real
 * state, and it is the difference between a row in {@code competitor} and a
 * MEMBER: the column has been nullable since V16 for exactly that reason.
 *
 * <p><b>A number only ever counts up.</b> Deleting a member on request takes the
 * link between the number and the person away (PDL P23), and it used to take the
 * number back into circulation with it, so the next person to join inherited a
 * number that appears in old results, old tables and somebody's printed card:
 * two people, one number, and nothing able to say which of them a row from 2029
 * belongs to. The schema says this with {@code member_number_seq}, a sequence
 * rather than {@code max(member_number) + 1}, because a query reads what is
 * THERE and what is there is missing exactly the rows that were deleted.
 */
public record MemberNumber(String written) implements Comparable<MemberNumber> {

	/** Six, so 1 reads as 000001. */
	public static final int WIDTH = 6;

	/**
	 * The last number six digits can hold.
	 *
	 * <p>A line nobody is expected to reach, which is the whole reason six was
	 * chosen. Running past it in silence is what must not happen: a seventh digit
	 * out of something whose subject is that the number has six would be handed on
	 * to a key, an address and a printed card without a word.
	 */
	public static final int HIGHEST = 999_999;

	/**
	 * The shape, and it is the schema's shape.
	 *
	 * <p>{@code competitor_member_number_shape} says the same thing in SQL, and
	 * {@code MemberNumberMatchesTheSchemaTest} is what keeps the two from drifting
	 * - it asks PostgreSQL to judge what this produces and what this refuses,
	 * rather than comparing one written pattern against another.
	 */
	private static final Pattern SIX_DIGITS = Pattern.compile("^[0-9]{6}$");

	public MemberNumber {
		Objects.requireNonNull(written, "written");

		if (!SIX_DIGITS.matcher(written).matches()) {
			throw new IllegalArgumentException(
					"a member number is " + WIDTH + " digits, and '" + written + "' is not");
		}
	}

	/**
	 * The number the sequence has just handed out, written the way it is spoken.
	 *
	 * @throws IllegalArgumentException past {@link #HIGHEST}, because there is no
	 *                                  next one and saying so is the only honest
	 *                                  answer
	 */
	public static MemberNumber of(int value) {
		if (value < 1) {
			throw new IllegalArgumentException("member numbers start at 1, never at " + value);
		}

		if (value > HIGHEST) {
			throw new IllegalArgumentException(
					"no member number is left: all " + HIGHEST + " of them are spoken for");
		}

		/* The width is read from the constant rather than written into the format, so the
		   day six becomes seven there is one place to change and not two. */
		return new MemberNumber(String.format("%0" + WIDTH + "d", value));
	}

	/** What it is as a number, which is what "lower goes ahead" means (PDL P12). */
	public int value() {
		return Integer.parseInt(written);
	}

	/**
	 * Lower first, and compared as a NUMBER.
	 *
	 * <p>Every ladder on the portal ends in the member number, and "niži članski
	 * broj" means the lower number. Compared as text that happens to agree for as
	 * long as every one of them is six characters wide; asked for as a number the
	 * question cannot be got wrong at all.
	 */
	@Override
	public int compareTo(MemberNumber other) {
		return Integer.compare(value(), other.value());
	}

	@Override
	public String toString() {
		return written;
	}
}
