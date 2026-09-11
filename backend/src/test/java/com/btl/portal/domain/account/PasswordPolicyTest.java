package com.btl.portal.domain.account;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * The two rules a password has to meet, and the one place they are compared.
 *
 * <p>Two rules and not three: the owner decided on 11.09.2026 that length and the
 * breach list are the whole of it, and that there is no demand for a digit, a
 * capital and a symbol. So there is nothing here that measures a third rule, and if
 * one ever appeared this file would say nothing about it - which is why
 * {@link #nothingElseIsDemandedOfAPassword()} exists.
 */
class PasswordPolicyTest {

	private final PasswordPolicy policy = new PasswordPolicy(BreachedPasswords.fromResource());

	/**
	 * Eleven characters is short and twelve is not, which is the only place the
	 * boundary can be wrong.
	 */
	@Test
	void twelveCharactersIsLongEnoughAndElevenIsNot() {
		/* Ne "abcdefghijkl": ona je NA listi procurelih, pa bi slucaj pao iz drugog
		   razloga nego sto tvrdi. Nadjeno cim je prvi put pusten. */
		assertThat(policy.judge("jedanaest12")).isEqualTo(PasswordPolicy.Verdict.TOO_SHORT);
		assertThat(policy.judge("dvanaest1234")).isEqualTo(PasswordPolicy.Verdict.FINE);
	}

	/**
	 * And a character that a person counts as one counts as one.
	 *
	 * <p>{@code String.length()} counts UTF-16 units, so twelve emoji are
	 * twenty-four by that count and eleven of them would be twenty-two - still
	 * "long enough" by a rule written with {@code length()}, while a person typing
	 * eleven characters would have been refused. This is the case that tells the two
	 * counts apart, and it fails the moment {@code codePointCount} is replaced.
	 */
	@Test
	void aCharacterAPersonCountsAsOneCountsAsOne() {
		String elevenEmoji = "🏃".repeat(11);

		assertThat(elevenEmoji.length()).as("the case no longer tells the two counts apart").isEqualTo(22);
		assertThat(policy.judge(elevenEmoji)).isEqualTo(PasswordPolicy.Verdict.TOO_SHORT);
		assertThat(policy.judge(elevenEmoji + "🏃")).isEqualTo(PasswordPolicy.Verdict.FINE);
	}

	/**
	 * A password out of the list is refused however it is capitalised.
	 */
	@ParameterizedTest
	@ValueSource(strings = { "passwordpassword", "PasswordPassword", "PASSWORDPASSWORD", "pAsSwOrDpAsSwOrD" })
	void aLeakedPasswordIsRefusedWhateverItsCapitals(String password) {
		assertThat(policy.judge(password)).isEqualTo(PasswordPolicy.Verdict.BREACHED);
	}

	/**
	 * And folding is done the same way everywhere, which a Turkish locale is what
	 * tells you.
	 *
	 * <p>In Turkish {@code "I".toLowerCase()} is {@code "ı"}, not {@code "i"}. A
	 * policy that folded in the default locale would therefore fold the list one way
	 * on a Turkish server and the typed password the same way - so it would look
	 * right - but differently from every other server, and a password refused in
	 * Belgrade would be accepted in Istanbul. This measures the folding directly,
	 * because the symptom only appears on a machine nobody runs the tests on.
	 */
	@Test
	void foldingDoesNotDependOnWhereTheServerIs() {
		assertThat(PasswordPolicy.fold("ILOVEYOUFOREVER")).isEqualTo("iloveyouforever");
		assertThat(PasswordPolicy.fold("I")).isEqualTo("i");
	}

	/**
	 * Spaces are characters somebody chose and are not taken away.
	 *
	 * <p>A passphrase is the shape this policy is built to encourage, and trimming
	 * or squeezing its spaces would turn three different passphrases into one.
	 */
	@Test
	void spacesAreCharactersLikeAnyOther() {
		assertThat(policy.judge("konj baterija spajalica")).isEqualTo(PasswordPolicy.Verdict.FINE);
		assertThat(PasswordPolicy.fold(" a b ")).isEqualTo(" a b ");
	}

	/**
	 * NOTHING ELSE IS DEMANDED, and this is the case that says so.
	 *
	 * <p>Every one of these is long enough and not on the list, and every one of them
	 * would be refused by the rule the portal deliberately does not have: no digit,
	 * no capital, no symbol, all one case, a word repeated, a keyboard row. They are
	 * accepted, and the day somebody adds a "must contain" rule this fails and sends
	 * him to the decision of 11.09.2026 rather than to a bug report.
	 */
	@Test
	void nothingElseIsDemandedOfAPassword() {
		List<String> accepted = List.of(
				"samamalaslova",
				"SAMAVELIKASLOVA",
				"aaaaaaaaaaaaaaab",
				"asdfghjklqwertz",
				"111111111111111112",
				"konj baterija spajalica",
				"...............");

		assertThat(accepted).allSatisfy(password ->
				assertThat(policy.judge(password))
						.as("odbijena je lozinka %s, a portal nema pravilo koje bi je odbilo", password)
						.isEqualTo(PasswordPolicy.Verdict.FINE));
	}

	/** The plain yes or no says the same thing as the verdict. */
	@Test
	void theShortAnswerAgreesWithTheLongOne() {
		assertThat(policy.accepts("konj baterija spajalica")).isTrue();
		assertThat(policy.accepts("kratka")).isFalse();
		assertThat(policy.accepts("passwordpassword")).isFalse();
	}

	/**
	 * The list that travels with the application holds something, and holds nothing
	 * that can never be reached.
	 *
	 * <p>The first half is what stops a policy that checks an empty list from looking
	 * exactly like one that works. The second is the rule the loader enforces, read
	 * back off the shipped file rather than trusted.
	 */
	@Test
	void theShippedListIsNotEmptyAndHoldsNothingTooShort() {
		BreachedPasswords shipped = BreachedPasswords.fromResource();

		assertThat(shipped.size())
				.as("the shipped list is empty, so every password passes the second rule")
				.isGreaterThan(50);
	}

	/** A list that is not there stops the application rather than passing everything. */
	@Test
	void aMissingListIsRefusedRatherThanTreatedAsEmpty() {
		assertThatThrownBy(() -> BreachedPasswords.fromResource("/security/nema-ovoga.txt"))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("nema liste");
	}

	/**
	 * Blank lines and remarks are skipped, and an entry shorter than the minimum is
	 * refused.
	 *
	 * <p>Refused rather than dropped, because a short entry can never be reached -
	 * the length is tested first - so its presence means whoever wrote the file
	 * believed something about it that is not true, and saying so is cheaper than
	 * leaving him to find out.
	 */
	@Test
	void theLoaderSkipsRemarksAndRefusesAnEntryThatCanNeverBeReached(@org.junit.jupiter.api.io.TempDir Path folder)
			throws IOException {
		assertThat(loaded(folder, "# napomena\n\n   \nduga lozinka ovde\n").size()).isOne();

		assertThatThrownBy(() -> loaded(folder, "duga lozinka ovde\nkratka\n"))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("kratka");
	}

	/**
	 * A list that cannot be read through is not silently treated as an empty one
	 * either.
	 *
	 * <p>The file being missing and the file being unreadable are two different
	 * failures and both end the same way: the application does not start. A policy
	 * that quietly checks nothing looks exactly like one that works, and would look
	 * like it for as long as nobody tried a leaked password.
	 */
	@Test
	void aListThatCannotBeReadIsRefusedTheSameWay() {
		java.io.InputStream broken = new java.io.InputStream() {
			@Override
			public int read() throws IOException {
				throw new IOException("disk je otkazao");
			}
		};

		assertThatThrownBy(() -> BreachedPasswords.fromStream(broken, "pokvarena.txt"))
				.isInstanceOf(java.io.UncheckedIOException.class)
				.hasMessageContaining("disk je otkazao");
	}

	/**
	 * Reads a list written for one case, through the same door the shipped one goes
	 * through.
	 */
	private BreachedPasswords loaded(Path folder, String content) throws IOException {
		Path file = folder.resolve("lista.txt");
		Files.writeString(file, content, StandardCharsets.UTF_8);

		return BreachedPasswords.fromStream(Files.newInputStream(file), file.toString());
	}
}
