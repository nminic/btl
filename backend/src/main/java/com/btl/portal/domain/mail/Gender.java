package com.btl.portal.domain.mail;

import java.util.Objects;
import java.util.ResourceBundle;

/**
 * THE SEX OF WHO IS READING, which decides the participle in the Serbian words that carry one.
 *
 * <p>Owner, 21.11.2026 (PDL, „Na sajtu se ne persira"), among the outcomes offered and with the
 * assistant's recommendation: „Mejlovi i poruke u sanduče idu po polu primaoca („potvrdio" ili
 * „potvrdila"), jer pol znamo iz registracije." The letter is the one {@code competitor.gender}
 * holds (V7: {@code M} or {@code F}).
 *
 * <p>The masculine words are the dictionary every message already had. The feminine ones live
 * in a dictionary of their own ({@code *-female.properties}) that carries ONLY the keys whose
 * words change, so that the floors over the existing dictionaries, which demand an exact set of
 * keys in both directions, stay what they were.
 */
public enum Gender {

	MAN("M"),

	WOMAN("F");

	private final String letter;

	Gender(String letter) {
		this.letter = letter;
	}

	/** The letter {@code competitor.gender} holds. */
	public String letter() {
		return letter;
	}

	/** A reader by the letter the column holds; any other letter is a corrupt row, not a third sex. */
	public static Gender ofTheColumn(String letter) {
		Objects.requireNonNull(letter, "letter");

		for (Gender one : values()) {
			if (one.letter.equals(letter)) {
				return one;
			}
		}

		throw new IllegalStateException("competitor.gender holds '" + letter + "', which is not M or F");
	}

	/**
	 * The words of one key for this reader: the feminine ones where there are any and she is the
	 * reader, the dictionary's own otherwise. {@code woman} is empty for a language that has no
	 * participle to agree (English).
	 */
	public String words(ResourceBundle base, ResourceBundle woman, String key) {
		if (this == WOMAN && woman != null && woman.containsKey(key)) {
			return woman.getString(key);
		}

		return base.getString(key);
	}

	/**
	 * THE WORDS OF A KEY ASKED FOR WITHOUT A READER, which is refused for a key that has
	 * feminine words: asking for it that way is the mistake of writing it in the masculine to
	 * everybody, and nothing else would notice.
	 */
	public static String wordsOfNoOne(ResourceBundle base, ResourceBundle woman, String key) {
		if (woman != null && woman.containsKey(key)) {
			throw new IllegalStateException(key + " has words for a woman and a man, so it is asked"
					+ " for with the sex of the one who reads it");
		}

		return base.getString(key);
	}
}
