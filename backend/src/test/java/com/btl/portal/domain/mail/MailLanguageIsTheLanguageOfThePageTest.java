package com.btl.portal.domain.mail;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * EVERY LANGUAGE A PAGE CAN BE IN IS A LANGUAGE THE MAIL CAN BE WRITTEN IN, AND THE OTHER WAY ROUND.
 *
 * <p>The registration sends the language of the page it was typed on as the first choice for the
 * mail (owner, 10.10.2026, Q1), by the two letters the frontend names it with, and the server refuses
 * a code it does not know. So a third language added to the frontend would turn every registration
 * typed on it into „the form is not complete" with nothing to say why, and a language the mail knows
 * and no page carries would be a choice nobody can arrive with. Both directions are a decision to
 * take once, and this is where it is asked for.
 *
 * <p><b>It reads the frontend's declaration as text, which is the one thing a floor across two
 * languages can do</b> - the shape {@code APostedAddressHasAScreenTest} and the frontend's own
 * {@code refusals.test.ts} already take. The declaration it reads is one line,
 * {@code export const LOCALES = [...] as const}, and a declaration it cannot find fails here rather
 * than comparing nothing.
 */
class MailLanguageIsTheLanguageOfThePageTest {

	private static final Pattern THE_DECLARATION =
			Pattern.compile("export const LOCALES = \\[([^\\]]*)\\] as const");

	private static final Pattern A_CODE = Pattern.compile("'([^']*)'");

	@Test
	void everyLanguageOfThePageIsALanguageOfTheMail() throws IOException {
		String config = Files.readString(repositoryRoot().resolve("frontend/src/i18n/config.ts"));
		Matcher declared = THE_DECLARATION.matcher(config);

		assertThat(declared.find())
				.as("frontend/src/i18n/config.ts no longer declares LOCALES the way this reads it, so"
						+ " this compares nothing")
				.isTrue();

		Set<String> ofThePage = A_CODE.matcher(declared.group(1)).results()
				.map(one -> one.group(1)).collect(Collectors.toSet());

		assertThat(ofThePage).as("the page declares no language at all").isNotEmpty();
		assertThat(ofThePage)
				.as("a page can be in a language the mail is not written in, or the other way round;"
						+ " a registration typed on it would be refused for a field it never showed")
				.isEqualTo(Arrays.stream(MailLanguage.values()).map(MailLanguage::code)
						.collect(Collectors.toSet()));
	}

	/** The root of the repository, found the way {@code EveryMailIsAMandatoryOneTest} finds it. */
	private static Path repositoryRoot() {
		Path here = Path.of("").toAbsolutePath();

		for (Path candidate = here; candidate != null; candidate = candidate.getParent()) {
			if (Files.isDirectory(candidate.resolve("backend"))
					&& Files.isDirectory(candidate.resolve("frontend"))) {
				return candidate;
			}
		}

		throw new IllegalStateException("no directory above " + here + " holds both backend/ and frontend/");
	}
}
