package com.btl.portal.domain.statement;

import java.text.Normalizer;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * A NAME AS A BANK PRINTS IT AND AS A MEMBER TYPED IT, MADE COMPARABLE.
 *
 * <p><b>Two questions, and they decide different things since 26.11.2026</b> (PDL „Učitavanje izvoda iz
 * banke na ekranu Uplate"):
 * <ul>
 * <li>{@link #names}: the payer, as far as the first comma, IS this first and last name. When exactly one
 * member answers it, the payment is booked by itself (owner, 26.11.2026: „Uplata bez poziva na broj
 * knjiži se sama po imenu kad imenu i prezimenu uplatioca odgovara tačno jedan član").
 * <li>{@link #inside}: the name stands somewhere in what the payer field prints, as consecutive words.
 * That is a suggestion and never a booking (owner, 26.11.2026: „Ime unutar teksta uplatioca daje
 * predlog, nikad knjiženje"), because an address can carry somebody else's name.
 * </ul>
 *
 * <p>Folded the same way for both: upper case, the marks taken off the letters („Š" to „S", „Ć" to
 * „C"), „Đ" written „DJ" as it is written without the letter, and anything that is not a letter (a
 * hyphen, a dot, a digit) read as a space. The first name and the last name are compared in both orders,
 * because a statement prints whichever order the paying bank keeps. The owner chose the same folding for
 * the booking as for the suggestion (27.11.2026), with its price stated and accepted: „Kunic" and
 * „Kunić" read as one last name.
 */
public final class PayerName {

	private PayerName() {
	}

	/** The payer's name out of what a line prints: what stands before the first comma, where the address starts. */
	public static String of(String printed) {
		int comma = printed.indexOf(',');

		return (comma < 0 ? printed : printed.substring(0, comma)).strip();
	}

	/** The name with its case, its marks and everything that is not a letter folded away. */
	public static String folded(String name) {
		String withoutDj = name.replace("Đ", "DJ").replace("đ", "dj");
		String withoutMarks = Normalizer.normalize(withoutDj, Normalizer.Form.NFD).replaceAll("\\p{M}", "");

		return withoutMarks.toUpperCase(Locale.ROOT).replaceAll("[^\\p{L}]+", " ").strip();
	}

	/** Whether a payer, as printed, is this first and last name in either order. */
	public static boolean names(String payer, String firstName, String lastName) {
		String printed = folded(payer);

		return !printed.isEmpty() && (printed.equals(folded(firstName + " " + lastName))
				|| printed.equals(folded(lastName + " " + firstName)));
	}

	/**
	 * Whether this first and last name, in either order, stand as consecutive WHOLE words anywhere in what
	 * the payer field prints: „POSTA ZA MILEVIC BRANKO STEVANA OPACICA 30 BEOGRAD" has Branko Milević in
	 * it, „BRANKOVIC MILEVIC" and „MILEVIC ZA BRANKO" do not.
	 */
	public static boolean inside(String printed, String firstName, String lastName) {
		List<String> words = wordsOf(printed);

		return contains(words, wordsOf(firstName + " " + lastName))
				|| contains(words, wordsOf(lastName + " " + firstName));
	}

	private static List<String> wordsOf(String text) {
		String folded = folded(text);

		return folded.isEmpty() ? List.of() : List.of(folded.split(" "));
	}

	private static boolean contains(List<String> words, List<String> name) {
		return !name.isEmpty() && Collections.indexOfSubList(words, name) >= 0;
	}
}
