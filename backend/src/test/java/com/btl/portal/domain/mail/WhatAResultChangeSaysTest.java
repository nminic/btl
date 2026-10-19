package com.btl.portal.domain.mail;

import com.btl.portal.domain.mail.WhatAResultChangeSays.Run;
import com.btl.portal.domain.mail.WhatAResultChangeSays.Told;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.math.BigDecimal;
import java.text.MessageFormat;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.Locale;
import java.util.ResourceBundle;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * THE WORDS OF THE THREE MESSAGES A MEMBER GETS ABOUT HIS OWN RESULT.
 *
 * <p>Every case here sweeps {@code Told.values()} or the dictionary's own key set, so nothing
 * in this file is a list somebody has to remember to extend. A fourth occasion, or a set of
 * words nothing sends, fails on the day it is written.
 */
class WhatAResultChangeSaysTest {

	/** The one run every case is about, with a figure of its own on every axis so that two
	 *  of them cannot be confused in a rendered text. */
	private static final Run A_RUN = new Run("Dugi maraton", LocalDate.of(2027, 5, 5),
			new BigDecimal("42.2035"), 350, 410, 12000, new BigDecimal("123.45"));

	/** And a second, different in every figure, for the message that carries two. */
	private static final Run ANOTHER_RUN = new Run("Kratka trka", LocalDate.of(2026, 11, 9),
			new BigDecimal("9.5"), 12, 7, 2645, new BigDecimal("8.10"));

	private static ResourceBundle words() {
		return ResourceBundle.getBundle("notices/results", Locale.ROOT);
	}

	/** The dictionary of one language, as the class itself reads it. */
	private static ResourceBundle words(MailLanguage in) {
		return WhatAResultChangeSays.words(in);
	}

	/**
	 * EVERY OCCASION HAS ITS WORDS AND EVERY WORD HAS ITS OCCASION.
	 *
	 * <p>Both directions, because they fail differently, and this is
	 * {@code WhatTheMessageSaysTest}'s own sentence one dictionary along: an occasion with no
	 * words behind it throws when somebody tries to send it, which is the worst possible
	 * moment; a set of words nothing sends is a text somebody will edit believing a member
	 * reads it.
	 *
	 * <p>Neither side is typed out here: the keys come off the enum and the rest comes off the
	 * bundle itself.
	 */
	@Test
	void everyOccasionHasItsWordsAndEveryWordHasItsOccasion() {
		Set<String> expected = Arrays.stream(Told.values())
				.flatMap(one -> Stream.of(one.key() + ".subject", one.key() + ".body"))
				.collect(Collectors.toSet());

		assertThat(words().keySet())
				.as("the words and the occasions no longer name the same things")
				.isEqualTo(expected);

		/* AND EVERY LANGUAGE, EACH EXACT OVER THE WHOLE SET: the owner's answer of 10.10.2026, Q3,
		   is that these follow the language of the letter, so an occasion with no English words
		   throws for exactly the member who chose English. */
		for (MailLanguage in : MailLanguage.values()) {
			assertThat(words(in).keySet())
					.as("the words in %s and the occasions no longer name the same things", in)
					.isEqualTo(expected);
		}

		assertThat(words(MailLanguage.SERBIAN).getString("resultEntered.subject"))
				.as("the Serbian dictionary the class reads is not notices/results")
				.isEqualTo(words().getString("resultEntered.subject"));
	}

	/**
	 * AND EACH TAKES AS MANY FACTS AS ITS WORDS REALLY HAVE HOLES FOR.
	 *
	 * <p>{@code MessageFormat} says nothing about a mismatch and both directions reach a
	 * member: a body with a hole nobody fills renders the literal „{1}" into his letter, and a
	 * body with one hole handed two values drops the second without a word - which, on the
	 * message about a change, would be the new value or the OLD one going missing. The count
	 * is declared on the enum and the holes are counted off the dictionary, so the two cannot
	 * drift.
	 */
	@ParameterizedTest
	@EnumSource(Told.class)
	void everyOccasionTakesAsManyFactsAsItsWordsHaveHolesFor(Told told) {
		for (MailLanguage in : MailLanguage.values()) {
			int holes = new MessageFormat(words(in).getString(told.key() + ".body"), Locale.ROOT)
					.getFormatsByArgumentIndex().length;

			assertThat(holes)
					.as("%s says it takes %d facts and its words in %s have %d holes", told,
							told.facts(), in, holes)
					.isEqualTo(told.facts());
		}
	}

	/**
	 * AND NOT ONE OF THEM CARRIES A LINK.
	 *
	 * <p><b>This is my own reasoning rather than a sentence out of the journal, and it is
	 * marked as mine.</b> Searched on 25.09.2026 through {@code PDL.md} and {@code ADL.md} for
	 * a rule that a notice may not carry one; what is there under „bez veze" is about a NAME
	 * printed without a link to a profile, which is a different thing. So the reason this case
	 * exists is the one the class itself rests on: this message is the league's only record of
	 * a result that may no longer exist, and a link into the portal about a deleted row is an
	 * address that answers nothing. A member who keeps the letter for two years must be able
	 * to read the figures out of it and not out of a page.
	 *
	 * <p>It is measured over the WHOLE formatted text, subject and body, and not over the
	 * dictionary: a hole is filled with a run, and a run one day carrying a link would put one
	 * into a message nobody edited.
	 */
	@Test
	void notOneOfThemCarriesALink() {
		for (Said said : everyOneOfThem()) {
			assertThat(said.subject() + "\n" + said.body())
					.as("a message that is the record of a deleted row points at a page instead")
					.doesNotContain("://");
		}
	}

	/**
	 * WHAT EACH OF THE FOUR SAYS, WORD FOR WORD, IN BOTH LANGUAGES, AND THAT NONE OF THEM ADVISES
	 * KEEPING IT (PDL P18, 18.10.2026).
	 *
	 * <p>The owner: "Liniju ... izbacite iz svih poruka", chosen for every message and every
	 * mail, in both languages. These are the portal's own sentences, so they are held as a
	 * snapshot of the whole text and not as a pattern over what they must not say: a pattern has
	 * to be right about sentences nobody has written yet, and a snapshot is not asked to. The
	 * run in the middle is written by {@link WhatAResultChangeSays#inWords}, which has its own
	 * case, so what is measured here is the prose around it and where each message stops.
	 */
	@Test
	void theFourMessagesSayExactlyWhatTheyWereDecidedToSayAndStopAtTheLeague() {
		for (MailLanguage in : MailLanguage.values()) {
			String run = WhatAResultChangeSays.inWords(A_RUN, in);
			String other = WhatAResultChangeSays.inWords(ANOTHER_RUN, in);
			boolean serbian = in == MailLanguage.SERBIAN;

			assertThat(WhatAResultChangeSays.entered(A_RUN, in).body())
					.as("the message about a result that was sent, in %s", in)
					.isEqualTo(lines(
							serbian ? "Primili smo rezultat koji ste poslali:"
									: "We have received the result you sent:",
							"",
							run,
							"",
							serbian ? "Bodovi su izračunati po javnoj formuli lige i ovde stoje kao račun."
									+ " Prave bodove i promenu plasmana rezultat dobija tek kad ga"
									+ " moderator odobri."
									: "The points were worked out by the public formula of the league and"
									+ " are shown here as a calculation. The result gets its real points"
									+ " and its change of standing only once a moderator approves it.",
							"",
							"Balkanska trkačka liga"));

			assertThat(WhatAResultChangeSays.changed(A_RUN, ANOTHER_RUN, in).body())
					.as("the message about a change, in %s", in)
					.isEqualTo(lines(
							serbian ? "Zatražili ste izmenu svog rezultata."
									: "You have asked for a change to your result.",
							"",
							serbian ? "Stara vrednost:" : "Old value:",
							run,
							"",
							serbian ? "Nova vrednost:" : "New value:",
							other,
							"",
							serbian ? "Stari rezultat ostaje u poretku dok izmena čeka i menja se tek kad"
									+ " je moderator odobri."
									: "The old result stays in the standings while the change waits, and is"
									+ " replaced only once a moderator approves it.",
							"",
							"Balkanska trkačka liga"));

			assertThat(WhatAResultChangeSays.approved(A_RUN, in).body())
					.as("the message about an approval, in %s", in)
					.isEqualTo(lines(
							serbian ? "Moderator je odobrio vaš rezultat:"
									: "A moderator has approved your result:",
							"",
							run,
							"",
							serbian ? "Od ovog trenutka rezultat ulazi u vaš profil, rang liste i sezonsku"
									+ " tabelu."
									: "From now on the result counts in your profile, the rankings and the"
									+ " season table.",
							"",
							"Balkanska trkačka liga"));

			assertThat(WhatAResultChangeSays.deleted(A_RUN, in).body())
					.as("the message about a deletion, in %s", in)
					.isEqualTo(lines(
							serbian ? "Sa portala je obrisan vaš rezultat:"
									: "Your result has been deleted from the portal:",
							"",
							run,
							"",
							serbian ? "Uklonjen je odmah i od ovog trenutka ne ulazi ni u jednu tabelu."
									: "It was removed at once, and from this moment it counts in no table.",
							"",
							"Balkanska trkačka liga"));
		}
	}

	/**
	 * THE THREE MESSAGES OF THE EVENT PAGE, WORD FOR WORD, IN BOTH LANGUAGES (PDL P9, 18.10.2026).
	 *
	 * <p>The words are a proposal the owner reviews with the pull request („[OTVORENO 18.10.2026]
	 * Reči poruka za rezultat pre 2027, za godinu bez članstva i za izmenu"), so they are held as a
	 * snapshot of the whole text, for the reason the case above gives. The year in the second is the
	 * run's own and is written as four digits, never as „2.027".
	 */
	@Test
	void theThreeMessagesOfTheEventPageSayExactlyWhatTheyWereProposedToSay() {
		for (MailLanguage in : MailLanguage.values()) {
			String run = WhatAResultChangeSays.inWords(A_RUN, in);
			String other = WhatAResultChangeSays.inWords(ANOTHER_RUN, in);
			boolean serbian = in == MailLanguage.SERBIAN;

			Said before = WhatAResultChangeSays.enteredBeforeTheLeague(A_RUN, in);

			assertThat(before.subject()).isEqualTo(serbian ? "Unet vam je rezultat"
					: "A result has been entered for you");
			assertThat(before.body())
					.as("the message about a run before the first season, in %s", in)
					.isEqualTo(lines(
							serbian ? "Liga vam je unela rezultat:" : "The league has entered a result for you:",
							"",
							run,
							"",
							serbian ? "Trka je održana pre prve zvanične sezone lige (2027), pa rezultat ostaje"
									+ " u vašoj istoriji i ne ulazi ni u jednu sezonsku tabelu, Top listu ni"
									+ " nagradu."
									: "The race was run before the first official season of the league (2027),"
									+ " so the result stays in your history and counts in no season table, Top"
									+ " list or award.",
							"",
							"Balkanska trkačka liga"));

			Said without = WhatAResultChangeSays.enteredWithoutAMembership(A_RUN, in);

			assertThat(without.subject()).isEqualTo(before.subject());
			assertThat(without.body())
					.as("the message about a run of a year without a membership, in %s", in)
					.isEqualTo(lines(
							serbian ? "Liga vam je unela rezultat:" : "The league has entered a result for you:",
							"",
							run,
							"",
							serbian ? "Za godinu 2027 nemate zapis o članstvu u ligi, pa rezultat ne ulazi ni u"
									+ " jednu sezonsku tabelu, Top listu ni nagradu."
									: "You hold no record of membership of the league for 2027, so the result"
									+ " counts in no season table, Top list or award.",
							"",
							"Balkanska trkačka liga"));

			Said changed = WhatAResultChangeSays.changedByTheLeague(A_RUN, ANOTHER_RUN, in);

			assertThat(changed.subject()).isEqualTo(serbian ? "Vaš rezultat je izmenjen"
					: "Your result has been changed");
			assertThat(changed.body())
					.as("the message about a change the league made, in %s", in)
					.isEqualTo(lines(
							serbian ? "Liga je izmenila vaš rezultat." : "The league has changed your result.",
							"",
							serbian ? "Stara vrednost:" : "Old value:",
							run,
							"",
							serbian ? "Nova vrednost:" : "New value:",
							other,
							"",
							serbian ? "Izmena važi odmah." : "The change takes effect at once.",
							"",
							"Balkanska trkačka liga"));
		}
	}

	/** THE YEAR IN THE SECOND IS THE RUN'S, not a constant: a run of another year names that one. */
	@Test
	void theYearWithoutAMembershipIsTheYearOfTheRun() {
		assertThat(WhatAResultChangeSays.enteredWithoutAMembership(ANOTHER_RUN, MailLanguage.SERBIAN)
				.body()).contains("Za godinu 2026 nemate").doesNotContain("2027 nemate");
	}

	/**
	 * THE LIST THE SWEEPS READ IS EVERY OCCASION, EACH THROUGH ITS OWN METHOD: as many messages as
	 * {@link Told} has constants and no two alike, so an occasion added without a method on that
	 * list, or a method that reached for another occasion's words, fails here.
	 */
	@Test
	void theMessagesTheSweepsReadAreEveryOccasionOnce() {
		for (MailLanguage in : MailLanguage.values()) {
			Said[] all = everyOneOfThem(in);

			assertThat(all).hasSize(Told.values().length);
			assertThat(Stream.of(all).map(one -> one.subject() + one.body()).distinct().count())
					.isEqualTo(Told.values().length);
		}
	}

	/**
	 * THE POINTS OF A RUN IN A SERBIAN MESSAGE: TWO DECIMALS AND THE COMMA (PDL P18, 18.10.2026).
	 *
	 * <p>A figure with decimals, one with a single decimal that must keep its second, a whole
	 * number that must keep both noughts, and one that has to round, which is the four
	 * shapes {@code toPlainString} writes four different ways and a decimal comma never does.
	 */
	@Test
	void pointsAreWrittenWithTwoDecimalsAndTheComma() {
		assertThat(WhatAResultChangeSays.pointsInWords(new BigDecimal("98.45"))).isEqualTo("98,45");
		assertThat(WhatAResultChangeSays.pointsInWords(new BigDecimal("98.4"))).isEqualTo("98,40");
		assertThat(WhatAResultChangeSays.pointsInWords(new BigDecimal("100"))).isEqualTo("100,00");
		assertThat(WhatAResultChangeSays.pointsInWords(new BigDecimal("98.455"))).isEqualTo("98,46");
	}

	private static String lines(String... each) {
		return String.join("\n", each);
	}

	/** AND NONE OF THEM IS EMPTY OR LEAVES A HOLE UNFILLED. */
	@Test
	void everyOneOfThemIsFilledIn() {
		for (Said said : everyOneOfThem()) {
			assertThat(said.subject()).isNotBlank().doesNotContain("{");
			assertThat(said.body()).isNotBlank().doesNotContain("{");
		}
	}

	/**
	 * THE MESSAGE ABOUT A CHANGE CARRIES BOTH RUNS, AND THE OLD ONE FIRST.
	 *
	 * <p>The two runs differ in every figure, so this cannot pass on a class that wrote one of
	 * them into both halves - which is the mutation the whole increment exists against.
	 */
	@Test
	void theMessageAboutAChangeCarriesTheOldRunBeforeTheNewOne() {
		for (MailLanguage in : MailLanguage.values()) {
			String body = WhatAResultChangeSays.changed(A_RUN, ANOTHER_RUN, in).body();

			assertThat(body.indexOf("Dugi maraton"))
					.as("the old run is missing in %s, or it comes after the new one", in)
					.isGreaterThanOrEqualTo(0)
					.isLessThan(body.indexOf("Kratka trka"));
		}
	}

	/**
	 * ONE RUN IN WORDS, WITH EVERY FIGURE IN THE SHAPE A PERSON READS IT.
	 *
	 * <p>The comma is Serbian's decimal mark and is SET rather than asked of a locale, so this
	 * is what says the machine's locale data cannot change what a member reads. The length is
	 * shown at two decimals although it is stored at four - the owner's own split of
	 * 19.09.2026, „prikazuje zaokruzeno na dve ili manje decimala" - so 42,2035 reads 42,20.
	 */
	@Test
	void oneRunIsWrittenOutTheWayAPersonReadsIt() {
		assertThat(WhatAResultChangeSays.inWords(A_RUN))
				.isEqualTo("Dugi maraton, 05.05.2027, 42,20 km, uspon 350 m, spust 410 m,"
						+ " vreme 3:20:00, 123,45 bodova");

		/* The second run is what says the first is not simply being echoed: a shorter time, a
		   length that rounds UP rather than down, and a minute and a second that both need
		   padding. */
		assertThat(WhatAResultChangeSays.inWords(ANOTHER_RUN))
				.isEqualTo("Kratka trka, 09.11.2026, 9,50 km, uspon 12 m, spust 7 m,"
						+ " vreme 0:44:05, 8,10 bodova");
	}

	/** „6:00:00" and „0:01:01": the hours are however many there are and the rest is padded,
	 *  because a race of a hundred and twelve hours is a real thing in this league while
	 *  {@code 3:2:5} is not a time anybody writes. */
	/**
	 * AND IN ENGLISH, THE SAME FIGURES IN ENGLISH WORDS, with the decimal point the English page
	 * writes and the day in words.
	 *
	 * <p>Asked of the whole line, because a line that kept the Serbian comma or the Serbian
	 * „uspon" would still contain every figure.
	 */
	@Test
	void oneRunIsWrittenOutTheWayAnEnglishReaderReadsIt() {
		assertThat(WhatAResultChangeSays.inWords(A_RUN, MailLanguage.ENGLISH))
				.isEqualTo("Dugi maraton, 5 May 2027, 42.20 km, ascent 350 m, descent 410 m,"
						+ " time 3:20:00, 123.45 points");
		assertThat(WhatAResultChangeSays.inWords(ANOTHER_RUN, MailLanguage.ENGLISH))
				.isEqualTo("Kratka trka, 9 November 2026, 9.50 km, ascent 12 m, descent 7 m,"
						+ " time 0:44:05, 8.10 points");
		assertThat(WhatAResultChangeSays.inWords(A_RUN, MailLanguage.SERBIAN))
				.isEqualTo(WhatAResultChangeSays.inWords(A_RUN));
	}

	/**
	 * EVERY OCCASION IN ENGLISH IS ENGLISH, carries the run in English words, and is signed the way
	 * the owner chose (10.10.2026, Q5: „potpis „Balkanska trkačka liga", u prozi BTL").
	 */
	@Test
	void everyOccasionInEnglishIsEnglishAndSignedAsTheOwnerChose() {
		for (Said said : everyOneOfThem(MailLanguage.ENGLISH)) {
			assertThat(said.body())
					.contains("ascent 350 m")
					.endsWith("Balkanska trkačka liga")
					.doesNotContain("uspon")
					.doesNotContain("Sačuvajte");
		}

		for (Said said : everyOneOfThem(MailLanguage.SERBIAN)) {
			assertThat(said.body()).contains("uspon 350 m").doesNotContain("ascent");
		}
	}

	@Test
	void theClockPadsWhatReadsWrongUnpaddedAndNothingElse() {
		assertThat(WhatAResultChangeSays.asAClock(21600)).isEqualTo("6:00:00");
		assertThat(WhatAResultChangeSays.asAClock(61)).isEqualTo("0:01:01");
		assertThat(WhatAResultChangeSays.asAClock(403200)).isEqualTo("112:00:00");
	}

	/** „05.05.2027", „01.02.2027" and „19.11.2026": the day and the month are padded and nothing
	 *  else is, so the notice about a closed category, which writes the day of a run through this
	 *  method, and the letter about the same approval cannot spell it two ways. */
	@Test
	void aDayIsWrittenWithItsDayAndItsMonthPadded() {
		assertThat(WhatAResultChangeSays.asADay(LocalDate.of(2027, 5, 5))).isEqualTo("05.05.2027");
		assertThat(WhatAResultChangeSays.asADay(LocalDate.of(2027, 2, 1))).isEqualTo("01.02.2027");
		assertThat(WhatAResultChangeSays.asADay(LocalDate.of(2026, 11, 19))).isEqualTo("19.11.2026");
	}

	/** A run that is not there at all is refused here rather than rendered as „null". */
	@Test
	void nothingIsWrittenAboutARunThatIsNotThere() {
		assertThatThrownBy(() -> WhatAResultChangeSays.entered(null, MailLanguage.SERBIAN))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> WhatAResultChangeSays.changed(null, A_RUN, MailLanguage.SERBIAN))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> WhatAResultChangeSays.changed(A_RUN, null, MailLanguage.SERBIAN))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> WhatAResultChangeSays.deleted(null, MailLanguage.SERBIAN))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> WhatAResultChangeSays.approved(null, MailLanguage.SERBIAN))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> WhatAResultChangeSays.approved(A_RUN, null))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> WhatAResultChangeSays.enteredBeforeTheLeague(null, MailLanguage.SERBIAN))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> WhatAResultChangeSays.enteredWithoutAMembership(null, MailLanguage.SERBIAN))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> WhatAResultChangeSays.changedByTheLeague(null, A_RUN, MailLanguage.SERBIAN))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> WhatAResultChangeSays.changedByTheLeague(A_RUN, null, MailLanguage.SERBIAN))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> WhatAResultChangeSays.inWords(A_RUN, null))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> new Run(null, LocalDate.now(), BigDecimal.ONE, 0, 0, 1,
				BigDecimal.ONE)).isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> new Run("Trka", null, BigDecimal.ONE, 0, 0, 1, BigDecimal.ONE))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> new Run("Trka", LocalDate.now(), null, 0, 0, 1, BigDecimal.ONE))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> new Run("Trka", LocalDate.now(), BigDecimal.ONE, 0, 0, 1, null))
				.isInstanceOf(NullPointerException.class);
	}

	/** All three, built through the three methods a caller really uses rather than through
	 *  the enum, so a method that reached for the wrong occasion is visible here too. */
	private static Said[] everyOneOfThem() {
		return Stream.of(MailLanguage.values()).flatMap(in -> Stream.of(everyOneOfThem(in)))
				.toArray(Said[]::new);
	}

	private static Said[] everyOneOfThem(MailLanguage in) {
		return new Said[] {
				WhatAResultChangeSays.entered(A_RUN, in),
				WhatAResultChangeSays.changed(A_RUN, ANOTHER_RUN, in),
				WhatAResultChangeSays.deleted(A_RUN, in),
				WhatAResultChangeSays.approved(A_RUN, in),
				WhatAResultChangeSays.enteredBeforeTheLeague(A_RUN, in),
				WhatAResultChangeSays.enteredWithoutAMembership(A_RUN, in),
				WhatAResultChangeSays.changedByTheLeague(A_RUN, ANOTHER_RUN, in)};
	}
}
