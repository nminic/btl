package com.btl.portal.domain.mail;

import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.season.SeasonClock;

import java.text.MessageFormat;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Objects;
import java.util.ResourceBundle;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * THE MESSAGES THAT TELL A MEMBER SOMETHING HAPPENED, AND CARRY NO WAY TO DO ANYTHING.
 *
 * <p><b>The sibling of {@link WhatTheMessageSays}, and the split is the whole point.</b> That
 * class opens by saying what it is: „THE MESSAGES THE PORTAL SENDS TO SOMEBODY WHO IS NOT
 * SIGNED IN, and the links in them... Each carries a link and nothing else of value." Every
 * {@link WhatTheMessageSays.Message} therefore has a PATH and a DURATION, and two floors are
 * built on exactly that - {@code APostedAddressHasAScreenTest} requires every path to have a
 * screen, pinned from both ends through {@code frontend/src/app/postedAddresses.json}, and
 * {@code HowLongALinkLastsMatchesTheSchemaTest} ties every duration to the column default the
 * owner chose.
 *
 * <p><b>A NOTICE HAS NEITHER, AND PUTTING ONE IN THERE WOULD HAVE MADE BOTH FLOORS SAY
 * LESS.</b> „Your password has changed" points at nothing, expires never, and hands over no
 * secret. Folded into that enum it would have needed an invented path and an invented
 * duration, and the two floors would have had to stop asking for a screen and stop asking for
 * a column - which is the same fault this branch already measured elsewhere on the same day: a
 * guard that has to ignore something in order to pass is usually ignoring the thing it exists
 * to measure. So the occasions live apart, and each floor goes on being exact in both
 * directions over its own set.
 *
 * <p><b>THE SECURITY PROPERTY THIS SPLIT BUYS, AND IT IS MEASURED RATHER THAN PROMISED.</b>
 * {@link WhatTheMessageSays#about} takes a {@link WhatTheMessageSays.Portal} and a TOKEN,
 * because building an address is its whole job. {@link #about} takes neither: there is no
 * parameter here that could carry a secret, and no words here may carry a link -
 * {@code WhatANoticeSaysTest} formats every notice and requires that no {@code ://} appear in
 * any of them. A notice that grew a link would be a notice somebody could be phished with,
 * and the road it would have to take is closed rather than discouraged.
 *
 * <p><b>THE WORDS ARE IN THEIR OWN FILE, {@code notices/sr.properties}, AND THAT IS NOT
 * TIDINESS EITHER.</b> {@code WhatTheMessageSaysTest} requires the keys of {@code mail/sr} to
 * be EXACTLY the keys of its enum, in both directions, so a notice key added to that file
 * would have broken it. Two files, two exact floors, neither loosened.
 *
 * <h2>WHY THIS IS WRITTEN TO BE INHERITED</h2>
 *
 * <p>PDL P22, 11.08.2026 names six mandatory messages, „i clan ih ne moze iskljuciti". Four of
 * the six are notices rather than links: a password changed, a result entered, a result
 * changed, and a large change to the portal. So this is a shape three more pieces of work will
 * take, and the two things that make it inheritable are the two that are easy to get wrong:
 *
 * <ul>
 * <li><b>A notice declares how many facts its words take</b>, and the floor compares that
 * number with the placeholders the bundle actually uses. A notice whose text grows a
 * {@code {2}} without anybody supplying a third fact stops the build instead of mailing the
 * two characters {@code {2}} to a member.
 * <li><b>The facts are already words when they get here.</b> A moment is turned into text by
 * {@link #moment}, in the portal's own zone, so every notice reads the same way and nobody has
 * to remember which zone a server happens to run in.
 * </ul>
 *
 * <h2>WHAT A NOTICE MAY NOT SAY, AND THIS ONE IS THE OWNER'S DECISION READ CORRECTLY</h2>
 *
 * <p>PDL, P9: „Mejl je dnevnik. Posto se istorija izmena ne cuva... obavestenje MORA da sadrzi
 * staru vrednost, jer ona nigde drugde ne prezivljava." <b>That decision is about an
 * administrator changing somebody else's RESULT</b> - the sentence above it names what he may
 * change, „vreme, duzina, uspon, spust, trka, link" - and the old value is the old time on a
 * race.
 *
 * <p><b>It does not carry across to a password, and the attempt to carry it was refused.</b>
 * The portal cannot produce an old password: V18 keeps a BCrypt hash and says why in as many
 * words, „A stolen copy of this database lets nobody sign in as anybody." A message carrying
 * one would overturn that decision from the outside, and there is no code that could even
 * build it. What the password notice carries instead is what really survives nowhere else:
 * WHEN it changed, and that every other session was ended.
 */
public final class WhatANoticeSays {

	/**
	 * Their own file, beside {@code mail/sr.properties} rather than inside it.
	 *
	 * <p>See the head of this class: the other bundle is held to being EXACTLY the messages'
	 * keys, in both directions, so a notice written into it would have broken that floor
	 * rather than joined it.
	 */
	private static final String WORDS = "notices/sr";

	/**
	 * {@code Locale.ROOT}, for the reason {@link WhatTheMessageSays} gives about its own: there
	 * is one set of words and this file is it, and asking for a language would let the machine
	 * the server happens to run on decide which half of the members get which text.
	 */
	private static final Locale ONE_SET_OF_WORDS = Locale.ROOT;

	/** Every {@code {0}}-shaped hole in a text, which is how the floor counts what it takes. */
	private static final Pattern A_PLACE_FOR_A_FACT = Pattern.compile("\\{(\\d+)\\}");

	/**
	 * How a moment is written to a member, and the zone is the league's rather than the
	 * server's.
	 *
	 * <p>{@link SeasonClock#ZONE} is where the league lives and where every other date in this
	 * portal is decided. A moment formatted in whatever zone a container happens to be set to
	 * would tell a member his password changed at three in the morning when it was five in the
	 * afternoon, which is exactly the sentence a warning must not get wrong: the whole reason
	 * he is told at all is so that he can say „that was not me".
	 */
	private static final DateTimeFormatter AS_A_MEMBER_READS_IT =
			DateTimeFormatter.ofPattern("dd.MM.yyyy. HH:mm", ONE_SET_OF_WORDS);

	private WhatANoticeSays() {
	}

	/**
	 * The occasions, and each one says how many facts its words take.
	 *
	 * <p>The number is here rather than counted off the text at run time so that the two can be
	 * compared: the enum says what the code promises to supply, the bundle says what the words
	 * ask for, and {@code WhatANoticeSaysTest} requires them to agree. Counted off the text
	 * alone there would be nothing to disagree with, and a text that grew a hole would quietly
	 * start printing it.
	 */
	public enum Notice {

		/**
		 * A member changed his own password while signed in.
		 *
		 * <p>Owner, PDL P22, 11.08.2026: „promena lozinke" is one of the six mandatory
		 * messages, „i clan ih ne moze iskljuciti". Two facts, and neither of them is a
		 * password: WHEN it changed, and how many other sessions were ended by it - which is
		 * the security half of the owner's decision of 24.09.2026, „odjavljuje sve ostale
		 * sesije... ako se lozinka menja zbog sumnje da je neko zna, promena bez odjave ne
		 * resava nista".
		 */
		THE_PASSWORD_HAS_CHANGED("thePasswordHasChanged", 2);

		private final String key;

		private final int facts;

		Notice(String key, int facts) {
			this.key = key;
			this.facts = facts;
		}

		/** What the words are filed under, and the floor over the bundle reads this. */
		public String key() {
			return key;
		}

		/** How many facts the words take, which the floor compares with the text itself. */
		public int facts() {
			return facts;
		}
	}

	/**
	 * A moment, as a member reads it, in the league's own zone.
	 *
	 * <p>Here rather than at each call site so that every notice writes a moment the same way.
	 * The day one of them needs another shape, that is a decision about what a member reads and
	 * it is made here, once.
	 */
	public static String moment(Instant at) {
		Objects.requireNonNull(at, "at");

		return AS_A_MEMBER_READS_IT.format(at.atZone(SeasonClock.ZONE));
	}

	/**
	 * THE NOTICE, WITH ITS FACTS ALREADY IN IT.
	 *
	 * <p><b>No {@link WhatTheMessageSays.Portal} and no token, and that is the point of this
	 * class.</b> There is no parameter here that could carry a secret or build an address, so a
	 * notice cannot become a link by somebody adding an argument; it would have to become a
	 * different class.
	 *
	 * @param notice which occasion
	 * @param facts  the values its words take, already written as text. Exactly as many as
	 *               {@link Notice#facts} declares, which is checked rather than trusted: a
	 *               notice sent with too few would mail a member the characters {@code {1}}
	 * @throws IllegalArgumentException when the count does not match, which is a fault in this
	 *                                  server rather than in anything a member sent
	 */
	public static Said about(Notice notice, String... facts) {
		Objects.requireNonNull(notice, "notice");
		Objects.requireNonNull(facts, "facts");

		if (facts.length != notice.facts()) {
			throw new IllegalArgumentException(notice + " takes " + notice.facts()
					+ " facts and was given " + facts.length);
		}

		for (String one : facts) {
			Objects.requireNonNull(one, "a fact");
		}

		ResourceBundle words = ResourceBundle.getBundle(WORDS, ONE_SET_OF_WORDS);

		return new Said(words.getString(notice.key() + ".subject"),
				/* MessageFormat and not concatenation, the same as the other bundle: the words
				   decide where a fact goes, because they are edited by somebody reading them as
				   prose. */
				MessageFormat.format(words.getString(notice.key() + ".body"), (Object[]) facts));
	}

	/**
	 * How many facts a text actually asks for, which is what the floor compares with the enum.
	 *
	 * <p>The highest {@code {n}} plus one rather than a count of holes, because
	 * {@link MessageFormat} numbers them from nought and a text is free to use one twice or to
	 * use them out of order. Nought for a text with no holes at all.
	 *
	 * <p>Package private: it exists so that {@code WhatANoticeSaysTest} can ask the bundle the
	 * same question the enum answers, rather than a list in a test being the second home for
	 * that number.
	 */
	static int howManyFactsTheWordsTake(String text) {
		Matcher holes = A_PLACE_FOR_A_FACT.matcher(text);
		int highest = -1;

		while (holes.find()) {
			highest = Math.max(highest, Integer.parseInt(holes.group(1)));
		}

		return highest + 1;
	}

	/** The bundle itself, so the floor reads the one this class reads and not a copy of it. */
	static ResourceBundle words() {
		return ResourceBundle.getBundle(WORDS, ONE_SET_OF_WORDS);
	}
}
