package com.btl.portal.domain.mail;

import com.btl.portal.domain.mail.WhatANoticeSays.Notice;
import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.time.Instant;
import java.util.Arrays;
import java.util.Locale;
import java.util.ResourceBundle;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * THE FLOOR UNDER THE NOTICES, WRITTEN IN THE SAME COMMIT AS THE CLASS.
 *
 * <p><b>Every case here is asked of a derived set and never of a list typed out.</b>
 * {@code CLAUDE.md}, 05.09.2026: „Pod se veze za nesto sto jezik ili alat vec izgovara",
 * and the two things that speak here are {@link Notice#values()} and the bundle's own
 * {@code keySet}. Nothing below names a notice by hand, so a second notice arriving
 * tomorrow is measured by every one of these without anybody remembering to add it - which
 * matters more than usual, because PDL P22 has four notices in it and only the first is
 * written.
 *
 * <p><b>THE ONE THING THAT CANNOT BE DERIVED IS NAMED RATHER THAN FAKED:</b> whether the
 * WORDS of a notice are the right words for the occasion. That is prose a person reads, and
 * {@code CLAUDE.md} of 01.09.2026 says an expression over prose does not converge. So
 * nothing here judges the text; what is judged is its SHAPE - that it exists, that it has
 * somewhere to put every fact it is given, and that it carries no link.
 */
class WhatANoticeSaysTest {

	private static final Instant AN_AFTERNOON = Instant.parse("2026-09-24T14:35:00Z");

	/**
	 * EVERY NOTICE HAS ITS WORDS AND EVERY SET OF WORDS HAS ITS NOTICE.
	 *
	 * <p>{@code WhatTheMessageSaysTest}'s own arrangement, over the other bundle. Both
	 * directions, because they fail differently: a notice with no words throws at the worst
	 * possible moment, and words nothing sends are a text somebody will edit believing a
	 * member reads it.
	 */
	@Test
	void everyNoticeHasItsWordsAndEveryWordHasItsNotice() {
		Set<String> expected = Arrays.stream(Notice.values())
				.flatMap(one -> Stream.of(one.key() + ".subject", one.key() + ".body"))
				.collect(Collectors.toSet());

		assertThat(WhatANoticeSays.words().keySet())
				.as("the words and the notices no longer name the same things")
				.isEqualTo(expected);
	}

	/**
	 * AND THE TWO BUNDLES ARE DISJOINT, WHICH IS WHY THE SPLIT IS SAFE.
	 *
	 * <p><b>The mutation this is written against:</b> pointing {@code WhatANoticeSays} at
	 * {@code mail/sr}. That file's texts are written with {@code {0}} = a LINK and
	 * {@code {1}} = how long it lasts, so a notice reading them would post a member a
	 * sentence about a link, with a moment where the address should be. It would also break
	 * {@code WhatTheMessageSaysTest}, which requires that bundle to be exactly the messages'
	 * keys - so the two floors together mean neither class can quietly read the other's
	 * words.
	 */
	@Test
	void theNoticesAndTheMessagesShareNoWordsAtAll() {
		Set<String> messages = ResourceBundle.getBundle("mail/sr", Locale.ROOT).keySet();

		assertThat(WhatANoticeSays.words().keySet())
				.as("a notice and a message are filed under the same key, so one of them is"
						+ " reading words written for the other")
				.doesNotContainAnyElementsOf(messages);

		assertThat(Arrays.stream(Notice.values()).map(Notice::key).toList())
				.as("a notice is named after a message, which is how the two bundles start"
						+ " agreeing by accident")
				.doesNotContainAnyElementsOf(Arrays.stream(Message.values()).map(Message::key)
						.toList());
	}

	/**
	 * WHAT THE WORDS ASK FOR AND WHAT THE CODE PROMISES TO SUPPLY ARE THE SAME NUMBER.
	 *
	 * <p>The enum says how many facts it sends; the bundle says how many holes it has. Read
	 * off one of them alone there would be nothing to disagree with, and a text that grew a
	 * {@code {2}} would quietly start posting those four characters to a member.
	 *
	 * <p>The count is taken by the class's own reader rather than by a second regular
	 * expression here, so this compares the enum with the bundle and not with a copy of the
	 * parsing.
	 */
	@ParameterizedTest
	@EnumSource(Notice.class)
	void theWordsTakeExactlyAsManyFactsAsTheNoticeSends(Notice notice) {
		String body = WhatANoticeSays.words().getString(notice.key() + ".body");

		assertThat(WhatANoticeSays.howManyFactsTheWordsTake(body))
				.as("%s says it sends %d facts and its words use a different number of them, so"
						+ " a member is posted either a hole or nothing at all",
						notice, notice.facts())
				.isEqualTo(notice.facts());
	}

	/**
	 * AND NO NOTICE CARRIES A LINK, WHICH IS THE WHOLE OF WHY THIS CLASS IS NOT THE OTHER
	 * ONE.
	 *
	 * <p>A notice arrives at somebody who asked for nothing. A link in it is exactly what
	 * he would be phished with, and it is also the thing that would make the split pointless:
	 * the moment a notice needs an address it needs a screen and a lifetime, and it belongs
	 * in {@link Message} with the two floors that ask for both.
	 *
	 * <p>Measured over the SUBJECT and the BODY, and over the text as a member reads it -
	 * after the facts are in it - so a link arriving through a fact is caught too.
	 */
	@ParameterizedTest
	@EnumSource(Notice.class)
	void noNoticeCarriesALink(Notice notice) {
		Said said = WhatANoticeSays.about(notice, someFactsFor(notice));

		assertThat(said.subject() + "\n" + said.body())
				.as("%s carries an address, so it is a message rather than a notice and it"
						+ " belongs where the floors ask for a screen and a lifetime", notice)
				.doesNotContain("://");
	}

	/** Every notice says something, and nothing it says is empty or still full of holes. */
	@ParameterizedTest
	@EnumSource(Notice.class)
	void everyNoticeSaysSomethingWithNoHolesLeftInIt(Notice notice) {
		Said said = WhatANoticeSays.about(notice, someFactsFor(notice));

		assertThat(said.subject()).isNotBlank();
		assertThat(said.body()).isNotBlank();

		assertThat(WhatANoticeSays.howManyFactsTheWordsTake(said.body()))
				.as("%s was posted with a hole still in its text", notice)
				.isZero();

		for (String fact : someFactsFor(notice)) {
			assertThat(said.body())
					.as("%s did not put one of its facts anywhere", notice)
					.contains(fact);
		}
	}

	/**
	 * A NOTICE SENT WITH THE WRONG NUMBER OF FACTS IS A FAULT IN THIS SERVER AND SAYS SO.
	 *
	 * <p>Both directions, because they are different mistakes and only one of them is loud
	 * on its own: too few leaves {@code MessageFormat} printing the hole to a member, and too
	 * many is a caller that thinks the text says more than it does.
	 */
	@ParameterizedTest
	@EnumSource(Notice.class)
	void aNoticeSentWithTheWrongNumberOfFactsIsRefused(Notice notice) {
		String[] tooFew = new String[notice.facts() - 1];
		String[] tooMany = new String[notice.facts() + 1];

		Arrays.fill(tooFew, "x");
		Arrays.fill(tooMany, "x");

		assertThatThrownBy(() -> WhatANoticeSays.about(notice, tooFew))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining(notice.name());

		assertThatThrownBy(() -> WhatANoticeSays.about(notice, tooMany))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining(notice.name());
	}

	@Test
	void nothingIsAcceptedWhereSomethingIsRequired() {
		assertThatThrownBy(() -> WhatANoticeSays.about(null, "a", "b"))
				.isInstanceOf(NullPointerException.class);

		assertThatThrownBy(() -> WhatANoticeSays.about(Notice.THE_PASSWORD_HAS_CHANGED,
				(String[]) null)).isInstanceOf(NullPointerException.class);

		assertThatThrownBy(() -> WhatANoticeSays.about(Notice.THE_PASSWORD_HAS_CHANGED,
				null, "1")).isInstanceOf(NullPointerException.class);

		assertThatThrownBy(() -> WhatANoticeSays.moment(null))
				.isInstanceOf(NullPointerException.class);
	}

	/**
	 * A MOMENT IS WRITTEN IN THE LEAGUE'S ZONE AND NOT IN THE SERVER'S.
	 *
	 * <p><b>This is a REPLACEMENT OF THE SOURCE and not an assertion about a format.</b> The
	 * same instant has two plausible renderings - the league's and whatever zone the machine
	 * is set to - and a container running in UTC would make them agree, which is how a
	 * fixture this size measures nothing. So the case names the hour in Belgrade explicitly:
	 * 14:35 UTC on a September afternoon is 16:35 there, and a formatter reading the system
	 * zone comes back with something else on any machine that is not in central Europe.
	 *
	 * <p>Why it matters at all: the whole reason a member is told is so that he can say „that
	 * was not me", and an hour that is wrong by two is an hour he cannot check against his
	 * own memory.
	 */
	@Test
	void aMomentIsWrittenInTheLeaguesOwnZone() {
		assertThat(WhatANoticeSays.moment(AN_AFTERNOON))
				.as("the moment is not written in the zone the league lives in, so a member"
						+ " cannot check it against his own afternoon")
				.isEqualTo("24.09.2026. 16:35");
	}

	/** Facts of the right count, each one visibly itself so a case can find it in the text. */
	private static String[] someFactsFor(Notice notice) {
		String[] facts = new String[notice.facts()];

		for (int i = 0; i < facts.length; i++) {
			facts[i] = "cinjenica-" + i;
		}

		return facts;
	}
}
