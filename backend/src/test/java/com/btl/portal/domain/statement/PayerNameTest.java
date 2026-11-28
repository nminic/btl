package com.btl.portal.domain.statement;

import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A PAYER AS THE BANK PRINTS HIM AGAINST A MEMBER AS HE TYPED HIMSELF IN. The whole name books by itself
 * and the letters a bank drops do not keep it from doing so (owner, 27.11.2026: „isto kao za predlog"); a
 * name inside the text is a suggestion only (owner, 26.11.2026).
 */
class PayerNameTest {

	@Test
	void aNameInsideTheTextIsTwoConsecutiveWholeWordsInEitherOrder() {
		String post = "POSTA ZA MILEVIC BRANKO STEVANA OPACICA 30 BEOGRAD";

		assertThat(PayerName.inside(post, "Branko", "Milević")).isTrue();
		assertThat(PayerName.inside("UPLATA BRANKO MILEVIĆ, BEOGRAD", "Branko", "Milević")).isTrue();
		assertThat(PayerName.inside("ZA MARKO PETROVIĆ-JOVIĆ", "Marko", "Petrović Jović")).isTrue();

		/* Both hold the name's letters in a row, and neither holds its WORDS. */
		assertThat(PayerName.inside("ZABRANKO MILEVICA", "Branko", "Milević")).as("a word must be whole").isFalse();
		assertThat(PayerName.inside("MILEVIC BRANKOVIC", "Branko", "Milević")).as("a word must be whole").isFalse();
		assertThat(PayerName.inside("MILEVIC ZA BRANKO", "Branko", "Milević")).as("the words must stand together")
				.isFalse();
		assertThat(PayerName.inside(post, "", "")).as("no name is inside every text").isFalse();
		assertThat(PayerName.inside("", "Branko", "Milević")).isFalse();
	}

	/**
	 * A NAME FOLDED ONCE ANSWERS EXACTLY AS THE NAME WAS ANSWERED BEFORE IT WAS FOLDED ONCE (PENDING, security review
	 * of PR 843, S4, 28.11.2026, and review of PR 844, 28.11.2026: the loop compared the new implementation with
	 * itself, because the two methods that take the name as text now delegate to it). The left side is the new
	 * question asked of a name folded once; the right side is {@link #before}, the two questions as they were written
	 * in 76a58ea0e before the change, in this file and not in the class. Every payer against every member, in the
	 * shapes the statements print. The members include one whose two names read the same either way round and one whose
	 * name folds to nothing, so a cache that kept only one of the orders, or only one of the two names, has a pair to be
	 * wrong on.
	 */
	@Test
	void aNameFoldedOnceAnswersAsTheNameAsTextDoes() {
		String[][] members = {{"Duško", "Kunić"}, {"Branko", "Milević"}, {"Marko", "Petrović-Jović"},
				{"Đorđe", "Đorđević"}, {"Ana", "Ana"}, {"", ""}};
		String[] payers = {"DUSKO KUNIC", "KUNIĆ DUŠKO, KRALJA PETRA 1, BEOGRAD", "MILEVIC BRANKO",
				"POSTA ZA MILEVIC BRANKO STEVANA OPACICA 30 BEOGRAD", "ZA MARKO PETROVIĆ-JOVIĆ", "DJORDJE DJORDJEVIC",
				"ANA ANA", "ANA", "", "   ", "KUNIC"};
		int agreed = 0;
		TheQuestionsAsTheyWere before = new TheQuestionsAsTheyWere();

		for (String payer : payers) {
			String folded = PayerName.folded(PayerName.of(payer));

			for (String[] member : members) {
				PayerName.Member once = PayerName.member(member[0], member[1]);

				assertThat(PayerName.names(folded, once)).as("names %s / %s", payer, String.join(" ", member))
						.isEqualTo(before.names(PayerName.of(payer), member[0], member[1]));
				assertThat(PayerName.inside(PayerName.wordsOf(payer), once))
						.as("inside %s / %s", payer, String.join(" ", member))
						.isEqualTo(before.inside(payer, member[0], member[1]));
				agreed++;
			}
		}

		assertThat(agreed).isEqualTo(payers.length * members.length);
		assertThat(PayerName.names("DUSKO KUNIC", PayerName.member("Duško", "Kunić"))).isTrue();
		assertThat(PayerName.names("KUNIC DUSKO", PayerName.member("Duško", "Kunić"))).isTrue();
		assertThat(PayerName.inside(PayerName.wordsOf("ZA KUNIC DUSKO 1"), PayerName.member("Duško", "Kunić")))
				.isTrue();
		assertThat(PayerName.inside(PayerName.wordsOf("ZA DUSKO 1"), PayerName.member("Duško", "Kunić"))).isFalse();
	}

	/**
	 * THE TWO QUESTIONS AS THEY WERE WRITTEN BEFORE A NAME WAS FOLDED ONCE (the bodies of {@code names} and
	 * {@code inside} in 76a58ea0e): the member's name is folded inside each question, in both orders, from the two
	 * strings. Nothing here reads {@link PayerName.Member}, so the loop above compares two ways of arriving at the
	 * answer and not one way with itself. Only {@code folded} is shared, which is the folding the owner chose for
	 * both (27.11.2026) and which both versions call.
	 */
	private static final class TheQuestionsAsTheyWere {

		boolean names(String payer, String firstName, String lastName) {
			String printed = PayerName.folded(payer);

			return !printed.isEmpty() && (printed.equals(PayerName.folded(firstName + " " + lastName))
					|| printed.equals(PayerName.folded(lastName + " " + firstName)));
		}

		boolean inside(String printed, String firstName, String lastName) {
			List<String> words = PayerName.wordsOf(printed);

			return contains(words, PayerName.wordsOf(firstName + " " + lastName))
					|| contains(words, PayerName.wordsOf(lastName + " " + firstName));
		}

		private static boolean contains(List<String> words, List<String> name) {
			return !name.isEmpty() && Collections.indexOfSubList(words, name) >= 0;
		}
	}

	@Test
	void theNameIsWhatStandsBeforeTheAddress() {
		assertThat(PayerName.of("DUŠKO KUNIĆ, KRALJEVAČKIH ŽRTAVA 53, BEOGRAD")).isEqualTo("DUŠKO KUNIĆ");
		assertThat(PayerName.of("  DUŠKO KUNIĆ  ")).isEqualTo("DUŠKO KUNIĆ");
	}

	@Test
	void caseMarksAndTheOrderOfTheTwoNamesDoNotKeepAMemberFromBeingNamed() {
		assertThat(PayerName.names("DUSKO KUNIC", "Duško", "Kunić")).isTrue();
		assertThat(PayerName.names("KUNIĆ DUŠKO", "Duško", "Kunić")).isTrue();
		assertThat(PayerName.names("DJORDJE COLIC", "Đorđe", "Čolić")).isTrue();
		assertThat(PayerName.names("MARKO PETROVIĆ-JOVIĆ", "Marko", "Petrović Jović")).isTrue();
	}

	@Test
	void anotherNameOrNoNameAtAllNamesNobody() {
		assertThat(PayerName.names("SUPRUGA KUNIĆ", "Duško", "Kunić")).isFalse();
		assertThat(PayerName.names("DUŠKO", "Duško", "Kunić")).isFalse();
		assertThat(PayerName.names("", "", "")).isFalse();
		assertThat(PayerName.names("-", "", "")).isFalse();
	}
}
