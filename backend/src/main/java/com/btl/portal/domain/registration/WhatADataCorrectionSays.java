package com.btl.portal.domain.registration;

import com.btl.portal.domain.mail.WhatTheMessageSays.Said;

import java.text.MessageFormat;
import java.util.List;
import java.util.Locale;
import java.util.ResourceBundle;
import java.util.stream.Collectors;

/**
 * WHAT A MEMBER IS TOLD IN HIS INBOX WHEN THE ADMINISTRATION HAS CORRECTED HIS DATA.
 *
 * <p>PDL, M7 (10.10.2026, chosen by the owner between offered outcomes, with the recommendation):
 * „član dobija poruku u sanduče kad mu administracija promeni podatke". The words are the
 * assistant's and the owner changes them on QA, which is how the other messages of the inbox were
 * written; the dictionary says so above them.
 *
 * <p><b>ITS OWN DICTIONARY</b>, {@code notices/data}, for the reason {@code notices/membership} has
 * its own: each dictionary is held by a floor that requires it to be EXACTLY its sender's keys, in
 * both directions, and two senders in one file would each find the other's keys there.
 *
 * <p><b>It names WHICH data, and never what they were or are now.</b> The member can read his data
 * on his own; a message that carried them would be a second copy of his address and his document
 * number lying in a table that is kept for other reasons. And it is said with „vi", like every other
 * message of the inbox, so no sentence has to know whether a member or a „članica" reads it.
 */
public final class WhatADataCorrectionSays {

	private static final String WORDS = "notices/data";

	/** {@code Locale.ROOT}: the words are chosen by naming their file, never by the server's locale. */
	private static final Locale ONE_SET_OF_WORDS = Locale.ROOT;

	/** Under which key a field is written out in words, followed by the field's word. */
	static final String A_FIELD = "field.";

	/** The occasion, under which the subject and the body are filed. */
	static final String CORRECTED = "corrected";

	private WhatADataCorrectionSays() {
	}

	/**
	 * EVERY FACT THE ADMINISTRATION CAN CORRECT, ONCE EACH, in the order the registration asks for
	 * them. The town is one fact although a request names it in two ways (a town of the codebook, or
	 * one typed with its country), because it is one thing about where he lives.
	 */
	public enum Field {

		FIRST_NAME("firstName"),
		LAST_NAME("lastName"),
		FATHER_NAME("fatherName"),
		GENDER("gender"),
		BIRTH_DATE("birthDate"),
		ID_NUMBER("idNumber"),
		EMAIL("email"),
		ADDRESS("address"),
		PHONE("phone"),
		TOWN("town"),
		SHIRT_SIZE("shirtSize");

		private final String word;

		Field(String word) {
			this.word = word;
		}

		/** What its words are filed under. */
		public String word() {
			return word;
		}
	}

	/**
	 * The message for these fields, named in the order {@link Field} declares them.
	 *
	 * @param fields never empty: a request that changed nothing tells him nothing, and that is the
	 *               caller's to decide before it gets here
	 */
	public static Said corrected(List<Field> fields) {
		if (fields.isEmpty()) {
			throw new IllegalArgumentException("nothing was corrected, so there is nothing to say");
		}

		ResourceBundle words = words();
		String named = fields.stream().sorted().distinct()
				.map(one -> words.getString(A_FIELD + one.word()))
				.collect(Collectors.joining(", "));

		return new Said(words.getString(CORRECTED + ".subject"),
				new MessageFormat(words.getString(CORRECTED + ".body"), ONE_SET_OF_WORDS)
						.format(new Object[] {named}));
	}

	static ResourceBundle words() {
		return ResourceBundle.getBundle(WORDS, ONE_SET_OF_WORDS);
	}
}
