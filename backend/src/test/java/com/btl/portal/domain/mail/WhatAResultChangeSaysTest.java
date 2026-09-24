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
		return ResourceBundle.getBundle("notices/sr", Locale.ROOT);
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
		int holes = new MessageFormat(words().getString(told.key() + ".body"), Locale.ROOT)
				.getFormatsByArgumentIndex().length;

		assertThat(holes)
				.as("%s says it takes %d facts and its words have %d holes", told, told.facts(),
						holes)
				.isEqualTo(told.facts());
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
		String body = WhatAResultChangeSays.changed(A_RUN, ANOTHER_RUN).body();

		assertThat(body.indexOf("Dugi maraton"))
				.as("the old run is missing, or it comes after the new one")
				.isGreaterThanOrEqualTo(0)
				.isLessThan(body.indexOf("Kratka trka"));
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
	@Test
	void theClockPadsWhatReadsWrongUnpaddedAndNothingElse() {
		assertThat(WhatAResultChangeSays.asAClock(21600)).isEqualTo("6:00:00");
		assertThat(WhatAResultChangeSays.asAClock(61)).isEqualTo("0:01:01");
		assertThat(WhatAResultChangeSays.asAClock(403200)).isEqualTo("112:00:00");
	}

	/** A run that is not there at all is refused here rather than rendered as „null". */
	@Test
	void nothingIsWrittenAboutARunThatIsNotThere() {
		assertThatThrownBy(() -> WhatAResultChangeSays.entered(null))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> WhatAResultChangeSays.changed(null, A_RUN))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> WhatAResultChangeSays.changed(A_RUN, null))
				.isInstanceOf(NullPointerException.class);
		assertThatThrownBy(() -> WhatAResultChangeSays.deleted(null))
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
		return new Said[] {
				WhatAResultChangeSays.entered(A_RUN),
				WhatAResultChangeSays.changed(A_RUN, ANOTHER_RUN),
				WhatAResultChangeSays.deleted(A_RUN)};
	}
}
