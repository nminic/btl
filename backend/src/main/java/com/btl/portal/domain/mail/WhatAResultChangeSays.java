package com.btl.portal.domain.mail;

import com.btl.portal.domain.mail.WhatTheMessageSays.Said;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.text.MessageFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Objects;
import java.util.ResourceBundle;

/**
 * THE THREE MESSAGES A MEMBER GETS ABOUT HIS OWN RESULT, AND THEY ARE THE LEAGUE'S
 * ONLY RECORD OF WHAT THE NUMBERS USED TO BE.
 *
 * <p><b>This is not a letter, it is a ledger, and the owner said so.</b> PDL P22:
 * „Mejl je dnevnik. Posto se istorija izmena ne cuva (odluka gore) ni dnevnik
 * administrativnih akcija (P21), obavestenje MORA da sadrzi staru vrednost, jer ona
 * nigde drugde ne prezivljava. Kopija ostaje kod clana, van sistema, i administrator je
 * ne moze ni izmeniti ni obrisati." Everything about the shape of these three texts
 * follows from that one sentence: the old figures are written out in full, in words a
 * person reads, and they are written into the message itself rather than pointed at,
 * because a link into the portal points at a row that no longer exists.
 *
 * <p><b>Which is why deleting sends one too.</b> Same decision, in as many words: „Isto
 * obavestenje ide i kad se obrise verifikovan rezultat i kad masovni uvoz pregazi
 * postojeci. Bez ove dve stavke, brisanje i uvoz postaju nacin da se rezultat promeni bez
 * traga, pa cela mera ne vredi nista." A deletion with no message is the cheapest way
 * there is to change a result without leaving one.
 *
 * <p><b>SEPARATE FROM {@link WhatTheMessageSays}, AND THAT IS A DECISION WITH A REASON
 * THAT CAN BE MEASURED.</b> That class is about messages carrying a LINK: its
 * {@code Message} enum holds a path and a lifetime for each occasion, and two floors rest
 * on exactly that - {@code HowLongALinkLastsMatchesTheSchemaTest} ties every entry's
 * lifetime to the column default the owner chose, and
 * {@code WhatTheMessageSaysTest.everySecretTheTokenMakerWritesIsOneThisAccepts} requires
 * every real token to pass its check. An occasion with no link and no token would have to
 * carry a path and a lifetime that mean nothing, and both of those floors would stop
 * saying what they exist to say. So the two kinds of message are two classes, and what
 * they share is the {@link Said} pair of strings that {@code Postman} takes - which is a
 * hand-off, not machinery.
 *
 * <p><b>AND THE SAME {@link Said} GOES INTO THE INBOX.</b> „Skrivena kopija svakog takvog
 * obavestenja ide na administrativnu adresu lige, i ISTA PORUKA ide u portalski inboks."
 * One value, built once here, written into {@code message} and handed to the relay -
 * rather than a second wording for the inbox, which is exactly how two copies of one
 * record come to disagree.
 *
 * <p><b>The words live in {@code notices/sr.properties}</b> and deliberately not beside the
 * other Serbian this server says out loud; {@link #WORDS} carries the measured reason.
 *
 * <p><b>THIS CLASS IS HALF A PLACEHOLDER, AND SAYING SO IS CHEAPER THAN LETTING IT BE
 * FOUND.</b> A parallel branch ({@code b87-moj-nalog}) writes {@code WhatANoticeSays}, the
 * general form of exactly this - a message that reports something and carries no link - with
 * a {@code Notice} enum, this same dictionary, and floors that sweep {@code Notice.values()}
 * and the dictionary's own key set so no list is typed out anywhere. When that lands, the
 * three methods below become three constants of that enum and what survives here is
 * {@link #inWords}, which is about a RUN and is this domain's rather than the mail
 * machinery's. Nothing here was invented in parallel with it: the three keys are written into
 * the dictionary that branch reads, so folding them in adds constants and deletes methods
 * rather than moving prose.
 *
 * <p><b>WHAT IS DELIBERATELY NOT IN ANY OF THE THREE: a position, a place in a table, or
 * anything about the standings.</b> PDL, owner, 18.09.2026: „prave bodove (i promenu
 * plasmana) dobija tek nakon verifikacije", and the decision names its own mutation -
 * „odgovor na prijavu koji nosi ijedno polje o poziciji ili o poretku". The points ARE
 * written, because the formula is public and the number is a sum rather than an award;
 * where the member stands is not, because that cannot be known before a moderator has
 * decided.
 */
public final class WhatAResultChangeSays {

	/**
	 * ITS OWN DICTIONARY, AND {@code mail/sr} IS NOT IT, WHICH IS A FLOOR RATHER THAN A
	 * PREFERENCE.
	 *
	 * <p>{@code WhatTheMessageSaysTest.everyMessageHasItsWordsAndEveryWordHasItsMessage}
	 * requires the key set of {@code mail/sr} to EQUAL the keys of {@code Message}, in both
	 * directions, and requires every body there to hold {@code {0}} for a link and
	 * {@code {1}} for how long it lasts. A notice has neither, so three of them written into
	 * that file would fail that case - and that case is there because a message with no words
	 * behind it throws at the worst possible moment.
	 */
	private static final String WORDS = "notices/sr";

	/** One set of words, and {@code mail/sr.properties} is it - {@link WhatTheMessageSays}
	 *  carries the reason at length and this does not repeat it. */
	private static final Locale ONE_SET_OF_WORDS = Locale.ROOT;

	/** „05.05.2027", which is how the portal writes a day everywhere a person reads one. */
	private static final DateTimeFormatter A_DAY = DateTimeFormatter.ofPattern("dd.MM.yyyy");

	private WhatAResultChangeSays() {
	}

	/**
	 * ONE RUN, IN THE FIGURES THE FORMULA IS FED AND THE ONE IT GIVES BACK.
	 *
	 * <p>Every field of it is in the message, and that is the point: this record IS the
	 * old value the decision says must survive outside the portal. A field left out here
	 * is a field that, once the row is gone, nobody can ever recover.
	 *
	 * @param raceName   what the race is called. The race's own name and not the event's,
	 *                   which is the owner's rule of 29.08.2026 for every place the portal
	 *                   names a race: „Nikad dogadjaj, uvek trka."
	 * @param day        the day it was run, which is the result's own and never the day
	 *                   anybody typed it in (ADL A12, 2c)
	 * @param distanceKm as measured, which since V25 may carry four decimals
	 * @param points     what {@code BtlScoreCalculator} makes of the four numbers, and
	 *                   never a number that arrived with a request
	 */
	public record Run(String raceName, LocalDate day, BigDecimal distanceKm, int ascentM,
			int descentM, int seconds, BigDecimal points) {

		public Run {
			Objects.requireNonNull(raceName, "raceName");
			Objects.requireNonNull(day, "day");
			Objects.requireNonNull(distanceKm, "distanceKm");
			Objects.requireNonNull(points, "points");
		}
	}

	/**
	 * THE THREE OCCASIONS, AND EACH SAYS HOW MANY FACTS ITS WORDS TAKE.
	 *
	 * <p><b>An enum rather than three keys typed at three call sites, and the count is what
	 * makes it one.</b> {@code MessageFormat} does not complain about a hole nobody fills: a
	 * body written with {@code {1}} in it and handed one value renders the literal
	 * „{1}" into a member's letter, and a body written with one hole and handed two drops the
	 * second silently. So the number is declared here and
	 * {@code WhatAResultChangeSaysTest.everyOccasionTakesAsManyFactsAsItsWordsHaveHolesFor}
	 * compares it with the holes the dictionary really uses.
	 *
	 * <p><b>This is deliberately the shape {@code WhatANoticeSays} has on the branch that will
	 * absorb it</b> - an occasion, a key, a count, and floors that sweep {@code values()} and
	 * the dictionary's own {@code keySet()} so that no list is typed anywhere. Folding the two
	 * together is then three constants moving across and {@link #inWords} staying behind,
	 * rather than two classes being reconciled.
	 */
	public enum Told {

		/** „unet rezultat", PDL P22's third mandatory message. */
		A_RESULT_WAS_ENTERED("resultEntered", 1),

		/** „promenjen rezultat", its fourth, and the one that carries both values. */
		A_RESULT_WAS_CHANGED("resultChanged", 2),

		/** Not on the list of six by that name, and required by the same decision all the
		 *  same: „Isto obavestenje ide i kad se obrise verifikovan rezultat." */
		A_RESULT_WAS_DELETED("resultDeleted", 1);

		private final String key;

		private final int facts;

		Told(String key, int facts) {
			this.key = key;
			this.facts = facts;
		}

		/** What the words are filed under, and the floor over the bundle reads this. */
		public String key() {
			return key;
		}

		/** How many values its words take, which is what the same floor measures. */
		public int facts() {
			return facts;
		}
	}

	/**
	 * A RESULT HAS BEEN SENT IN, and there is no old value because there was nothing
	 * there before.
	 *
	 * <p>This is the one of the three whose shape differs, and it differs for a reason
	 * rather than for tidiness: the other two exist to carry what is being overwritten or
	 * taken away, and a first report overwrites nothing. It is on the owner's list of six
	 * mandatory messages all the same („unet rezultat", PDL P22, 11.08.2026), because what
	 * it tells the member is that the portal really did receive what he sent.
	 */
	public static Said entered(Run sent) {
		Objects.requireNonNull(sent, "sent");

		return said(Told.A_RESULT_WAS_ENTERED, inWords(sent));
	}

	/**
	 * A RESULT HAS BEEN CHANGED, and both halves are in the message.
	 *
	 * <p>The old one first and the new one after it, which is the order the decision is
	 * about: what the member has to be able to prove years later is what the figures WERE.
	 */
	public static Said changed(Run before, Run after) {
		Objects.requireNonNull(before, "before");
		Objects.requireNonNull(after, "after");

		return said(Told.A_RESULT_WAS_CHANGED, inWords(before), inWords(after));
	}

	/** A RESULT HAS BEEN DELETED, and what it said is the whole of the message. */
	public static Said deleted(Run before) {
		Objects.requireNonNull(before, "before");

		return said(Told.A_RESULT_WAS_DELETED, inWords(before));
	}

	/** The words of one occasion, filled in. Package visible so the floor over the
	 *  dictionary can ask for every occasion rather than for the three somebody remembers. */
	static Said said(Told told, Object... values) {
		ResourceBundle words = ResourceBundle.getBundle(WORDS, ONE_SET_OF_WORDS);

		return new Said(words.getString(told.key() + ".subject"),
				new MessageFormat(words.getString(told.key() + ".body"), ONE_SET_OF_WORDS)
						.format(values));
	}

	/**
	 * ONE RUN AS A PERSON READS IT, built here and never in the words file.
	 *
	 * <p><b>The figures are formatted here rather than handed to {@link MessageFormat} as
	 * numbers, and that is not a preference.</b> Asked to format a number itself,
	 * {@code MessageFormat} would use the locale it was built with, which is
	 * {@code Locale.ROOT} for the reason {@link WhatTheMessageSays} gives - so a length
	 * would come out as {@code 42.2} in a Serbian sentence, and a big number would come out
	 * with a comma where the decimal mark belongs. Everything below reaches the words file
	 * as a finished string.
	 *
	 * <p><b>The length is shown rounded and stored exact, which is the owner's own split of
	 * 19.09.2026:</b> „Hocu da mogu da unosim tacnu duzinu, ali se prikazuje zaokruzeno na
	 * dve ili manje decimala. Dakle 42.203 treba da zaokruzi na 42.2, ali da vodi kao
	 * ultramaraton." This is a place where it is SHOWN, so two decimals; what decides the
	 * category is the stored value and is not this class's business at all.
	 */
	static String inWords(Run run) {
		return run.raceName() + ", " + run.day().format(A_DAY) + ", "
				+ twoDecimals(run.distanceKm()) + " km, uspon " + run.ascentM()
				+ " m, spust " + run.descentM() + " m, vreme " + asAClock(run.seconds())
				+ ", " + twoDecimals(run.points()) + " bodova";
	}

	/**
	 * „42,20", with the comma Serbian writes a decimal with.
	 *
	 * <p>The separator is SET rather than asked of a locale: the answer would then depend on
	 * which locale data the machine running the server happens to carry, and the one thing
	 * this file is about is a record that reads the same in ten years as it does today.
	 */
	private static String twoDecimals(BigDecimal value) {
		DecimalFormatSymbols serbian = new DecimalFormatSymbols(Locale.ROOT);

		serbian.setDecimalSeparator(',');

		return new DecimalFormat("0.00", serbian).format(value.setScale(2, RoundingMode.HALF_UP));
	}

	/**
	 * „3:20:00", and the hours are NOT padded while the minutes and seconds are.
	 *
	 * <p>A run of a hundred and twelve hours is a real thing in this league - PDL P5 has
	 * timed races and „24 h" is one of them - so the hours are however many there are, and
	 * what is padded is what reads wrong unpadded: {@code 3:2:5} is not a time anybody
	 * writes.
	 */
	static String asAClock(int seconds) {
		return seconds / 3600 + String.format(Locale.ROOT, ":%02d:%02d",
				seconds / 60 % 60, seconds % 60);
	}
}
