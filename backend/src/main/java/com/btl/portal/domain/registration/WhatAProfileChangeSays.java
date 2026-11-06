package com.btl.portal.domain.registration;

import com.btl.portal.domain.mail.WhatTheMessageSays.Said;

import java.util.Locale;
import java.util.ResourceBundle;

/**
 * WHAT A MEMBER IS TOLD IN HIS INBOX WHEN THE ADMINISTRATION HAS CHANGED HIS PICTURE OR HIS WORDS ABOUT
 * HIMSELF.
 *
 * <p>Owner, 06.11.2026 (PDL „Boksovi „Profilna slika" i „Tekst o sebi" prelaze sa Podešavanja", chosen
 * with the recommendation): „Izmena administracije stupa odmah na profil, bez reda za proveru, i član
 * dobija poruku u sanduče da mu je administracija promenila sliku ili tekst o sebi". The words are the
 * assistant's and the owner changes them on QA, which is how the other messages of the inbox were
 * written; the dictionary says so above them.
 *
 * <p><b>ITS OWN DICTIONARY</b>, {@code notices/profile}, for the reason {@code notices/data} has its own:
 * each dictionary is held by a floor that requires it to be EXACTLY its sender's keys, in both directions,
 * and two senders in one file would each find the other's keys there.
 *
 * <p><b>It says WHAT changed, and never what it is now.</b> The picture and the words are on his profile,
 * which is where he reads them; a message that carried the words would be a second copy of them in a table
 * kept for other reasons.
 */
public final class WhatAProfileChangeSays {

	private static final String WORDS = "notices/profile";

	/** {@code Locale.ROOT}: the words are chosen by naming their file, never by the server's locale. */
	private static final Locale ONE_SET_OF_WORDS = Locale.ROOT;

	private WhatAProfileChangeSays() {
	}

	/** What of his profile the administration changed, each with the key its words are filed under. */
	public enum Change {

		PICTURE("picture"),
		/** His picture taken down (owner, 06.11.2026: „Da, i uklanjanje"). */
		PICTURE_REMOVED("pictureRemoved"),
		WORDS("words");

		private final String word;

		Change(String word) {
			this.word = word;
		}

		/** What its words are filed under. */
		public String word() {
			return word;
		}
	}

	/** The message for this change. */
	public static Said about(Change change) {
		ResourceBundle words = words();

		return new Said(words.getString(change.word() + ".subject"), words.getString(change.word() + ".body"));
	}

	static ResourceBundle words() {
		return ResourceBundle.getBundle(WORDS, ONE_SET_OF_WORDS);
	}
}
