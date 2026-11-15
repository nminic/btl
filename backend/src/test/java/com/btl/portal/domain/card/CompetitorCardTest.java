package com.btl.portal.domain.card;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * THE CARD AS IT IS DRAWN, MEASURED ON ITS PIXELS.
 *
 * <p>The layout is the model's ({@code btl-produkt/predlozi/kartica-000001.html}); what is
 * measured here is the part of it a decision names: the size, the weight WhatsApp allows (ADL A10),
 * the letters of both alphabets, the portrait or the initials in the circle, every kind of the ring
 * in its own place in the grid the owner described for one to six kinds, and that nothing a member
 * typed runs past its column. Pixels are read off the decoded JPEG with a tolerance, because a JPEG
 * moves every colour a little.
 */
class CompetitorCardTest {

	private static final List<String> SIX = WhatACardSays.KINDS;

	/** A portrait of one colour, so the colour in the circle says which of the two was drawn. */
	private static BufferedImage aPortraitOf(Color colour) {
		BufferedImage square = new BufferedImage(CompetitorCard.PORTRAIT, CompetitorCard.PORTRAIT,
				BufferedImage.TYPE_INT_ARGB_PRE);
		Graphics2D pen = square.createGraphics();
		pen.setColor(colour);
		pen.fillRect(0, 0, CompetitorCard.PORTRAIT, CompetitorCard.PORTRAIT);
		pen.dispose();
		return square;
	}

	/** Noise in every pixel, which is the heaviest thing a JPEG can be asked to hold. */
	private static BufferedImage noise() {
		Random random = new Random(20261115L);
		BufferedImage square = new BufferedImage(CompetitorCard.PORTRAIT, CompetitorCard.PORTRAIT,
				BufferedImage.TYPE_INT_ARGB_PRE);

		for (int y = 0; y < CompetitorCard.PORTRAIT; y++) {
			for (int x = 0; x < CompetitorCard.PORTRAIT; x++) {
				square.setRGB(x, y, 0xFF000000 | random.nextInt(0x1000000));
			}
		}

		return square;
	}

	private static List<CompetitorCard.Slice> slices(int howMany) {
		List<CompetitorCard.Slice> slices = new ArrayList<>();

		for (int at = 0; at < howMany; at++) {
			String kind = SIX.get(at);
			long count = 10 + at;
			slices.add(new CompetitorCard.Slice(kind, count, WhatACardSays.SERBIAN.count(count),
					WhatACardSays.SERBIAN.kindWord(kind, count)));
		}

		return slices;
	}

	private static CompetitorCard.Face face(String name, String underName, List<CompetitorCard.Slice> slices) {
		return new CompetitorCard.Face("000001", name, underName, "NM", "282", "trke", "8.465,94", "km",
				WhatACardSays.SERBIAN.firstRaceYetToCome(), slices, WhatACardSays.ADDRESS, "portrait");
	}

	private static BufferedImage drawn(CompetitorCard.Face face, BufferedImage portrait) throws IOException {
		return ImageIO.read(new ByteArrayInputStream(CompetitorCard.jpeg(face, portrait)));
	}

	private static void near(BufferedImage card, int x, int y, Color expected, String what) {
		Color found = new Color(card.getRGB(x, y));

		assertThat(Math.abs(found.getRed() - expected.getRed()) + Math.abs(found.getGreen() - expected.getGreen())
				+ Math.abs(found.getBlue() - expected.getBlue()))
				.as("%s at %d,%d is %s and not %s", what, x, y, found, expected)
				.isLessThan(40);
	}

	/** A point on the middle of the ring's band, at an angle measured clockwise from twelve. */
	private static int[] onTheRing(double degrees) {
		double angle = Math.toRadians(degrees);
		return new int[] {(int) Math.round(CompetitorCard.CENTRE_X + 208 * Math.sin(angle)),
				(int) Math.round(CompetitorCard.CENTRE_Y - 208 * Math.cos(angle))};
	}

	@Test
	void theCardIs1200By630AndAJpegUnderWhatWhatsAppTakesWithTheHeaviestPortraitThereIs()
			throws IOException {
		byte[] jpeg = CompetitorCard.jpeg(face("Nikola Minić", "M 40-54 · Dunavski trkači", slices(6)), noise());
		BufferedImage card = ImageIO.read(new ByteArrayInputStream(jpeg));

		assertThat(card.getWidth()).isEqualTo(1200);
		assertThat(card.getHeight()).isEqualTo(630);
		assertThat(jpeg[0] & 0xFF).isEqualTo(0xFF);
		assertThat(jpeg[1] & 0xFF).isEqualTo(0xD8);
		assertThat(jpeg.length).as("bytes of a card with a portrait of noise")
				.isLessThan(CompetitorCard.AT_MOST_BYTES);
	}

	@Test
	void bothFacesCarryEveryLetterOfBothAlphabetsTheNamesOfThePortalAreWrittenIn() {
		String letters = "ČĆĐŠŽčćđšž ЉЊЂЋЏЖШЧљњђћџжшч АБВГДЕЗИЈКЛМНОПРСТУФХЦ абвгдезијклмнопрстуфхц …·";

		assertThat(CompetitorCard.REGULAR.canDisplayUpTo(letters)).isEqualTo(-1);
		assertThat(CompetitorCard.BOLD.canDisplayUpTo(letters)).isEqualTo(-1);
		assertThat(CompetitorCard.REGULAR.getFamily()).isEqualTo("Roboto");
		assertThat(CompetitorCard.BOLD.isBold() || CompetitorCard.BOLD.getFontName().contains("Bold")).isTrue();
	}

	@Test
	void thePortraitIsInTheCircleAndWithoutOneTheCircleIsItsOwnColourUnderTheInitials() throws IOException {
		Color red = new Color(0xd0, 0x20, 0x20);

		/* Above the initials and inside the circle, which is 182 around the centre. */
		near(drawn(face("Nikola Minić", "", slices(3)), aPortraitOf(red)), 330, 180, red, "the portrait");
		near(drawn(face("Nikola Minić", "", slices(3)), null), 330, 180, CompetitorCard.SURFACE,
				"the circle without a portrait");
		/* And the initials are drawn in it, in the colour of the text, across the middle. */
		BufferedImage initials = drawn(face("Nikola Minić", "", slices(3)), null);
		assertThat(brightIn(initials, 160, 260, 500, 370)).as("pixels of the initials").isGreaterThan(500);
		assertThat(brightIn(drawn(new CompetitorCard.Face("000001", "Nikola Minić", "", "", "1", "trka",
				"1,00", "km", "-", slices(1), WhatACardSays.ADDRESS, null), null), 160, 260, 500, 370))
				.as("pixels in a circle with no initials").isZero();
	}

	private static int brightIn(BufferedImage card, int left, int top, int right, int bottom) {
		int bright = 0;

		for (int y = top; y < bottom; y++) {
			for (int x = left; x < right; x++) {
				if (new Color(card.getRGB(x, y)).getRed() > 200) {
					bright++;
				}
			}
		}

		return bright;
	}

	/** Pixels anything was written on, light or muted, against the dark background. */
	private static int mutedIn(BufferedImage card, int left, int top, int right, int bottom) {
		int written = 0;

		for (int y = top; y < bottom; y++) {
			for (int x = left; x < right; x++) {
				if (new Color(card.getRGB(x, y)).getBlue() > 120) {
					written++;
				}
			}
		}

		return written;
	}

	@Test
	void theRingGoesRoundInTheOrderOfTheKindsWithEachItsShare() throws IOException {
		/* Two kinds of equal count: the first from twelve to six on the right, the second back. */
		List<CompetitorCard.Slice> two = List.of(new CompetitorCard.Slice("half", 5, "5", "polumaratona"),
				new CompetitorCard.Slice("unscored", 5, "5", "nebodovanih"));
		BufferedImage card = drawn(face("Ana Anić", "", two), null);

		int[] right = onTheRing(90);
		int[] left = onTheRing(270);
		near(card, right[0], right[1], CompetitorCard.KIND_COLOURS.get("half"), "the first half of the ring");
		near(card, left[0], left[1], CompetitorCard.KIND_COLOURS.get("unscored"), "the second half");

		/* And the gap at the top, between the end of the last and the start of the first. */
		int[] top = onTheRing(0);
		near(card, top[0], top[1], CompetitorCard.BACKGROUND, "the gap at twelve");
	}

	@Test
	void withNothingRunTheRingIsWholeAndOfTheCirclesColourAndTheSentenceStandsForTheFigures()
			throws IOException {
		BufferedImage card = drawn(face("Ana Anić", "", List.of()), null);

		for (double degrees : new double[] {0, 90, 180, 270}) {
			int[] at = onTheRing(degrees);
			near(card, at[0], at[1], CompetitorCard.SURFACE, "the empty ring at " + degrees);
		}

		/* No dot of any kind where the first cell of the grid would be. */
		near(card, 609, 407, CompetitorCard.BACKGROUND, "the place of the first cell");
		/* And the sentence where the figures stand, and no figure: nothing where the words under the
		   two figures would be, below the sentence's lowest letter. Never „0 trka". */
		assertThat(brightIn(card, 600, 290, 1140, 345)).isPositive();
		assertThat(mutedIn(card, 600, 345, 1140, 365)).as("the words under the figures").isZero();
		assertThat(mutedIn(drawn(face("Ana Anić", "", slices(1)), null), 600, 345, 1140, 365))
				.as("the words under the figures, where there are figures").isPositive();
	}

	/**
	 * THE GRID THE OWNER DESCRIBED, measured by the colour of each cell's dot where it must stand:
	 * five or six in three columns of 180 and two rows, three or four in two columns of 270 and two
	 * rows, one or two in one row of two columns of 270.
	 */
	@ParameterizedTest
	@ValueSource(ints = {1, 2, 3, 4, 5, 6})
	void everyKindHasItsCellInTheGridTheOwnerDescribed(int howMany) throws IOException {
		BufferedImage card = drawn(face("Ana Anić", "", slices(howMany)), null);
		int columns = howMany >= 5 ? 3 : howMany >= 3 ? 2 : howMany;
		double width = 540.0 / Math.max(columns, 2);

		assertThat(CompetitorCard.columnsFor(howMany)).isEqualTo(columns);

		for (int at = 0; at < howMany; at++) {
			int x = (int) (600 + at % columns * width + 9);
			int y = 418 + at / columns * 84 - 11;
			near(card, x, y, CompetitorCard.KIND_COLOURS.get(SIX.get(at)), howMany + " kinds, cell " + at);
		}

		/* And no seventh cell: the place after the last is empty. */
		int after = howMany;
		int x = (int) (600 + after % columns * width + 9);
		int y = 418 + after / columns * 84 - 11;
		if (y < 600) {
			near(card, x, y, CompetitorCard.BACKGROUND, "after the last cell");
		}
	}

	@Test
	void aNameAndATeamTooLongForTheColumnStayInIt() throws IOException {
		String name = "Wwwwwwwwwwwwwwwwwwwwwwwwwwwwww Mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm";
		String team = "M 40-54 · " + "Dugačko Ime Tima Koje Ne Staje Nikako ".repeat(4);
		BufferedImage card = drawn(face(name, team, slices(6)), null);

		/* Nothing of either line right of the column, where only the background stands. */
		for (int y = 100; y < 230; y++) {
			for (int x = 1146; x < 1200; x++) {
				near(card, x, y, CompetitorCard.BACKGROUND, "right of the column");
			}
		}

		Graphics2D pen = aPen();
		double width = CompetitorCard.line(pen, name, 600, 168, CompetitorCard.BOLD, 64, 44, Color.WHITE, 540,
				CompetitorCard.Anchor.START);
		assertThat(width).isLessThanOrEqualTo(540);
		assertThat(CompetitorCard.within(pen, name, CompetitorCard.BOLD.deriveFont(44f), 540)).endsWith("…");
	}

	@Test
	void whatIsCutIsTheLongestBeginningThatFitsWithItsEllipsis() {
		Graphics2D pen = aPen();
		Font font = CompetitorCard.REGULAR.deriveFont(30f);
		String text = "abcdefghijklmnopqrstuvwxyz".repeat(3);
		String cut = CompetitorCard.within(pen, text, font, 300);
		int kept = cut.length() - 1;

		assertThat(font.getStringBounds(cut, pen.getFontRenderContext()).getWidth()).isLessThanOrEqualTo(300);
		assertThat(font.getStringBounds(text.substring(0, kept + 1) + "…", pen.getFontRenderContext()).getWidth())
				.as("one more letter would have fit").isGreaterThan(300);
		assertThat(CompetitorCard.within(pen, "kratko", font, 300)).isEqualTo("kratko");
	}

	@Test
	void figuresTooWideForTheirCellsShrinkTheWordsAndAreCutRatherThanRunOver() throws IOException {
		List<CompetitorCard.Slice> wide = new ArrayList<>();
		for (String kind : SIX) {
			wide.add(new CompetitorCard.Slice(kind, 1, "123.456.789.012", "ultramaratona ultramaratona"));
		}

		BufferedImage card = drawn(face("Ana Anić", "", wide), null);

		assertThat(card.getWidth()).isEqualTo(1200);
		/* The gap between the first and the second column holds nothing of the first cell. */
		for (int y = 380; y < 460; y++) {
			near(card, 778, y, CompetitorCard.BACKGROUND, "between two columns");
		}
	}

	@Test
	void onlyWhatCanBeDrawnOfWhatAMemberTypedIsDrawn() {
		String typed = "Ana\u0001\u0007‮\uD800͸中😀\t\nNBSP   Anić ";

		assertThat(CompetitorCard.printable(typed)).isEqualTo("Ana NBSP Anić");
		assertThat(CompetitorCard.printable("")).isEmpty();

		/* Roboto HAS glyphs for these, so only the type of the character keeps them out: a soft
		   hyphen, a zero width space and a joiner, the marks that turn text round, the byte order
		   mark (all formatting) and one character of private use. Measured over every code point:
		   these and nothing else of the five types are ones both faces claim to display. */
		String drawableByTheFont = "­​‍‎‪‮⁪﻿";

		assertThat(CompetitorCard.REGULAR.canDisplayUpTo(drawableByTheFont)).as("the font draws them").isEqualTo(-1);
		assertThat(CompetitorCard.printable("A" + drawableByTheFont + "B")).isEqualTo("AB");

		/* And no control character at all, whitespace aside, which today the font itself has no glyph
		   for; the type is what keeps them out the day a face does. */
		for (int point = 0; point < 0xA0; point++) {
			if (Character.getType(point) == Character.CONTROL && !Character.isWhitespace(point)
					&& !Character.isSpaceChar(point)) {
				assertThat(CompetitorCard.printable("A" + Character.toString(point) + "B"))
						.as("U+%04X", point).isEqualTo("AB");
			}
		}
		assertThat(CompetitorCard.printable("x".repeat(1000))).hasSize(CompetitorCard.AT_MOST_CODE_POINTS);
	}

	@Test
	void anEmptyOrUnprintableNameStillDrawsACard() throws IOException {
		BufferedImage card = drawn(new CompetitorCard.Face("000001", "\u0001\u0002", "‮", "", "0", "trka",
				"0,00", "km", WhatACardSays.SERBIAN.firstRaceYetToCome(), List.of(), WhatACardSays.ADDRESS, null),
				null);

		assertThat(card.getWidth()).isEqualTo(1200);
	}

	@Test
	void theInitialsAreTheFirstLetterOfEachNameAsEveryCircleOfThePortalDrawsThem() throws IOException {
		JsonNode cases = new ObjectMapper().readTree(Files.readString(
				Path.of("..", "frontend", "src", "components", "shareCard.cases.json"), StandardCharsets.UTF_8));

		assertThat(cases.path("initials").size()).isPositive();

		for (JsonNode one : cases.path("initials")) {
			assertThat(CompetitorCard.initials(one.path("firstName").asString(), one.path("lastName").asString()))
					.as(one.toString())
					.isEqualTo(one.path("initials").asString());
		}
	}

	@Test
	void theDigestIsOfEverythingDrawnAndOfNothingElse() {
		CompetitorCard.Face one = face("Ana Anić", "M 40-54", slices(2));

		assertThat(one.digest()).hasSize(64).isEqualTo(face("Ana Anić", "M 40-54", slices(2)).digest());

		List<CompetitorCard.Face> others = List.of(
				new CompetitorCard.Face("000002", "Ana Anić", "M 40-54", "NM", "282", "trke", "8.465,94", "km", "-",
						slices(2), "a", "portrait"),
				face("Ana Anića", "M 40-54", slices(2)),
				face("Ana Anić", "M 40-54 · Tim", slices(2)),
				face("Ana Anić", "M 40-54", slices(3)),
				face("Ana Anić", "M 40-54", List.of(new CompetitorCard.Slice("short", 11, "10", "kraćih trka"),
						slices(2).get(1))),
				new CompetitorCard.Face("000001", "Ana Anić", "M 40-54", "NM", "283", "trke", "8.465,94", "km", "-",
						slices(2), WhatACardSays.ADDRESS, "portrait"),
				new CompetitorCard.Face("000001", "Ana Anić", "M 40-54", "NM", "282", "trke", "8.465,95", "km", "-",
						slices(2), WhatACardSays.ADDRESS, "portrait"),
				new CompetitorCard.Face("000001", "Ana Anić", "M 40-54", "NM", "282", "trke", "8.465,94", "km", "-",
						slices(2), WhatACardSays.ADDRESS, null),
				/* Two fields that run together into the same text still make two digests. */
				new CompetitorCard.Face("000001", "Ana Anić", "M 40-54", "NM", "282", "trke", "8.465,9", "4km", "-",
						slices(2), WhatACardSays.ADDRESS, "portrait"));

		for (CompetitorCard.Face other : others) {
			assertThat(other.digest()).as(other.toString()).isNotEqualTo(one.digest());
		}
	}

	@Test
	void aFontThatIsNotThereOrIsNotAFontIsAPortalBuiltWrong() {
		assertThatThrownBy(() -> CompetitorCard.fontAt("/fonts/nema.ttf"))
				.isInstanceOf(IllegalStateException.class).hasMessageContaining("class path");
		assertThatThrownBy(() -> CompetitorCard.fontAt("/fonts/Roboto-LICENSE.txt"))
				.isInstanceOf(IllegalStateException.class).hasMessageContaining("not a font");
	}

	@Test
	void theLicenceOfTheFontShipsBesideIt() throws IOException {
		try (var in = CompetitorCard.class.getResourceAsStream("/fonts/Roboto-LICENSE.txt")) {
			assertThat(in).isNotNull();
			assertThat(new String(in.readAllBytes(), StandardCharsets.UTF_8))
					.contains("Apache License").contains("Version 2.0, January 2004");
		}
	}

	private static Graphics2D aPen() {
		Graphics2D pen = new BufferedImage(10, 10, BufferedImage.TYPE_INT_RGB).createGraphics();
		pen.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_ON);
		pen.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
		return pen;
	}
}
