package com.btl.portal.domain.mail;

import java.util.Arrays;
import java.util.Objects;
import java.util.Optional;

/**
 * THE LANGUAGE A MEMBER'S MAIL IS WRITTEN IN, AND THERE ARE TWO.
 *
 * <p><b>The owner, PDL P18, 03.10.2026, choosing between the outcomes put to him:</b> the screen
 * does not remember a language (the address carries it), but the member chooses the language of
 * his mail in his profile, Serbian unless he chooses otherwise. And on 10.10.2026 (PDL, „Jezik
 * mejlova (JM), odgovoreno pojedinačno"), how it is first set and how far it reaches: a
 * registration typed on the English page starts in English, a link in an English letter leads to
 * the English page, the inbox copy of the messages about a result follows the language of the
 * letter while the rest of the inbox stays Serbian, and the invitations the administration sends
 * are always Serbian.
 *
 * <p><b>The code is the column's value and the frontend's name for the same language</b>, which
 * is why it is {@code sr} and {@code en} and not a word: {@code account.mail_language} holds
 * exactly these two (V59, {@code account_mail_language_known}), and the page a member registered
 * on names itself by the same two letters ({@code frontend/src/i18n/config.ts}). Both are held to
 * this enum by a case each, so a third language arrives as a decision rather than as a string
 * one side has never heard of.
 */
public enum MailLanguage {

	/** The league's own language, and every account's until its owner chooses otherwise. */
	SERBIAN("sr", ""),

	/**
	 * English, whose links carry {@code /en}: the owner's answer of 10.10.2026 (Q2), „Veza u
	 * engleskom mejlu … nosi {@code /en/}", so a member who reads his mail in English lands on the
	 * page in English rather than on a Serbian one he then has to switch.
	 */
	ENGLISH("en", "/en");

	private final String code;

	private final String prefix;

	MailLanguage(String code, String prefix) {
		this.code = code;
		this.prefix = prefix;
	}

	/** What the column holds and what the page calls itself. */
	public String code() {
		return code;
	}

	/**
	 * What goes between the portal's address and the path of a link.
	 *
	 * <p>Nothing for Serbian, and that is the links already in members' mailboxes rather than a
	 * choice made here: every Serbian message sent until now carries {@code /nova-lozinka} with no
	 * language in front, and the frontend sends an address without one to the Serbian page
	 * ({@code LocaleLayout}). Changing it would change nothing a member sees and every link a
	 * test reads.
	 */
	public String prefix() {
		return prefix;
	}

	/** The language a code names, or nothing for a code that is not one of the two. */
	public static Optional<MailLanguage> of(String code) {
		Objects.requireNonNull(code, "code");

		return Arrays.stream(values()).filter(one -> one.code.equals(code)).findFirst();
	}

	/**
	 * The language a row of {@code account} holds, which is always one of the two.
	 *
	 * <p>For a value read off the column and never for one that arrived with a request: the
	 * column's own check refuses everything else, so a value it holds that this enum does not
	 * know means the two have parted, and that is a fault in this server to be thrown rather than
	 * a member to be written to in a language picked for him.
	 */
	public static MailLanguage ofTheColumn(String code) {
		return of(code).orElseThrow(() -> new IllegalStateException(
				"account.mail_language holds '" + code + "', which is not a language the portal writes"));
	}
}
