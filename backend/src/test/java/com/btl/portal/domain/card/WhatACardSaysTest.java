package com.btl.portal.domain.card;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE WORDS OF THE CARD ARE THE WORDS OF THE PROFILE, AND ARE HELD TO THEM.
 *
 * <p>{@link WhatACardSays} is a second home of words {@code frontend/src/i18n/sr.json} and
 * {@code en.json} already hold, because the server has no copy of them at run time. Every word it
 * prints is read here out of both dictionaries, by key, and compared: a word changed on one side
 * fails here until the other says the same. Parsed as JSON and asked by path, the way
 * {@code TheRowNameHasOneHomeTest} reads the same file, so a key that moves or disappears is a
 * failure that names it rather than a comparison of nothing.
 *
 * <p>And the rules the words are chosen and the numbers written by are held to
 * {@code frontend/src/components/shareCard.cases.json}, which {@code shareCard.test.tsx} holds the
 * frontend to: the two sides can only disagree by one of them failing.
 */
class WhatACardSaysTest {

	private static final Path FRONTEND = Path.of("..", "frontend", "src");

	private static JsonNode read(String path) {
		Path file = FRONTEND.resolve(path);

		assertThat(file).as("%s is not where this expects it, so nothing is compared", file).exists();

		try {
			return new ObjectMapper().readTree(Files.readString(file, StandardCharsets.UTF_8));
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	private static JsonNode dictionary(WhatACardSays language) {
		return read("i18n/" + language.code() + ".json");
	}

	private static JsonNode cases() {
		return read("components/shareCard.cases.json");
	}

	/** One plural block of the dictionary, which must be the three forms and must be there. */
	private static WhatACardSays.Forms formsAt(JsonNode block, String where) {
		assertThat(block.isObject()).as("%s is not a block of forms in the dictionary", where).isTrue();

		return new WhatACardSays.Forms(block.path("one").asString(), block.path("few").asString(),
				block.path("other").asString());
	}

	@ParameterizedTest
	@EnumSource(WhatACardSays.class)
	void everyWordUnderACountIsTheWordTheProfileDeclines(WhatACardSays language) {
		JsonNode profile = dictionary(language).path("profile");

		for (String kind : WhatACardSays.KINDS) {
			JsonNode block = kind.equals("unscored") ? profile.path("unscoredRingWord")
					: profile.path("categoryWord").path(kind);
			WhatACardSays.Forms forms = formsAt(block, language.code() + " " + kind);

			assertThat(List.of(language.kindWord(kind, 1), language.kindWord(kind, 2),
					language.kindWord(kind, 5)))
					.as("%s %s", language.code(), kind)
					.containsExactly(forms.one(), language == WhatACardSays.ENGLISH ? forms.other() : forms.few(),
							forms.other());
			/* And the one form English never reaches through a count is the dictionary's too. */
			assertThat(forms.few()).as("%s %s few", language.code(), kind).isNotEmpty();
		}

		WhatACardSays.Forms races = formsAt(profile.path("racesWord"), language.code() + " racesWord");

		assertThat(List.of(language.racesWord(1), language.racesWord(5)))
				.containsExactly(races.one(), races.other());
		if (language == WhatACardSays.SERBIAN) {
			assertThat(language.racesWord(2)).isEqualTo(races.few());
		}
	}

	@ParameterizedTest
	@EnumSource(WhatACardSays.class)
	void aCategoryIsWrittenAsTheProfileWritesIt(WhatACardSays language) {
		JsonNode category = dictionary(language).path("category");

		assertThat(language.category("M", "40-54", false))
				.isEqualTo(category.path("markMale").asString() + " 40-54");
		assertThat(language.category("F", "25-39", false))
				.isEqualTo(category.path("markFemale").asString() + " 25-39");
		assertThat(language.category("M", "40-54", true)).isEqualTo(category.path("rookieMale").asString());
		assertThat(language.category("F", "40-54", true)).isEqualTo(category.path("rookieFemale").asString());
		/* A space after the letter of the gender, which is the portal's way since 18.10.2026. */
		assertThat(language.category("M", "40-54", false)).isEqualTo("M 40-54");
	}

	@ParameterizedTest
	@EnumSource(WhatACardSays.class)
	void aCountTakesTheFormTheCasesName(WhatACardSays language) {
		JsonNode forms = cases().path("plurals").path(language.code());

		assertThat(forms.size()).as("no count is named for %s", language.code()).isPositive();
		forms.propertyStream().forEach(one -> assertThat(language.formOf(Long.parseLong(one.getKey())))
				.as("%s %s", language.code(), one.getKey())
				.isEqualTo(one.getValue().asString()));
	}

	@ParameterizedTest
	@EnumSource(WhatACardSays.class)
	void numbersAreWrittenAsTheCasesWriteThem(WhatACardSays language) {
		JsonNode counts = cases().path("counts").path(language.code());
		JsonNode kilometres = cases().path("kilometres").path(language.code());

		assertThat(counts.size()).isPositive();
		assertThat(kilometres.size()).isPositive();

		for (JsonNode row : counts) {
			assertThat(language.count(row.get(0).asLong())).isEqualTo(row.get(1).asString());
		}

		for (JsonNode row : kilometres) {
			assertThat(language.kilometres(new BigDecimal(row.get(0).asString())))
					.isEqualTo(row.get(1).asString());
		}
	}

	@Test
	void onlyTheTwoLanguagesOfThePortalAreKnown() {
		assertThat(WhatACardSays.of("sr")).contains(WhatACardSays.SERBIAN);
		assertThat(WhatACardSays.of("en")).contains(WhatACardSays.ENGLISH);
		assertThat(WhatACardSays.of("de")).isEmpty();
		assertThat(WhatACardSays.of("SR")).isEmpty();
	}

	@Test
	void theCardNeverSaysNoughtRaces() {
		assertThat(WhatACardSays.SERBIAN.firstRaceYetToCome()).isEqualTo("Prva trka na profilu tek dolazi.");
		assertThat(WhatACardSays.ENGLISH.firstRaceYetToCome()).doesNotContain("0");
	}
}
