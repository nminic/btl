package com.btl.portal.domain.statement;

import java.text.Normalizer;
import java.util.Locale;

/**
 * A NAME AS A BANK PRINTS IT AND AS A MEMBER TYPED IT, MADE COMPARABLE.
 *
 * <p>Owner, 24.10.2026 (PDL „Učitavanje izvoda iz banke"): „Uplata bez poziva na broj dobija predlog
 * člana po imenu i prezimenu uplatioca, a vlasnik ga potvrđuje jednim klikom ili bira drugog." So the
 * question is only ever a SUGGESTION that a person confirms, and that is what decides how loose the
 * comparison may be: a payer whose bank drops the Serbian letters („DUSKO KUNIC", which banks do) is
 * still suggested, because a wrong suggestion costs one look and a missed one costs a search.
 *
 * <p>Folded: upper case, the marks taken off the letters („Š" to „S", „Ć" to „C"), „Đ" written „DJ" as
 * it is written without the letter, and anything that is not a letter (a hyphen, a dot) read as a space.
 * The first name and the last name are compared in both orders, because a statement prints whichever
 * order the paying bank keeps.
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
}
