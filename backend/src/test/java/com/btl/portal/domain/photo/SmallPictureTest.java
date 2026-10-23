package com.btl.portal.domain.photo;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.zip.CRC32;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * THE CUT A CIRCLE DRAWS, MEASURED BY WHAT IS IN IT.
 *
 * <p>Every picture here is the same drawing on a different road: a red field with one blue
 * square in it, and a circle chosen exactly over the square. A cut that lands on the circle is
 * blue all through; a cut of the whole picture, a cut of another circle, or the original sent
 * back unchanged is red somewhere a right cut is blue, or is not {@value SmallPicture#SIDE}
 * pixels a side. So each case reads the colour in the cut rather than trusting how it was made.
 *
 * <p><b>Where the colour is read, and why there.</b> Inside the square and away from its edge:
 * a JPEG smears an edge over a block of eight pixels, and the edge of the square IS the edge of
 * the cut, so the outer rim of a right cut is allowed to be pinkish and nothing here asks it.
 */
class SmallPictureTest {

	private static final int RED = 0xFF0000;

	private static final int BLUE = 0x0000FF;

	/** The points inside the cut a right cut has blue at: the middle and four well inside. */
	private static final int[][] INSIDE = { { 120, 120 }, { 40, 40 }, { 200, 40 }, { 40, 200 },
			{ 200, 200 } };

	/**
	 * A red field of this size with one blue square, as JPEG or PNG.
	 *
	 * @param left where the square starts across, in pixels
	 * @param top  where it starts down
	 * @param side its side
	 */
	private static BufferedImage drawn(int width, int height, int left, int top, int side) {
		BufferedImage picture = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
		Graphics2D pen = picture.createGraphics();
		pen.setColor(new Color(RED));
		pen.fillRect(0, 0, width, height);
		pen.setColor(new Color(BLUE));
		pen.fillRect(left, top, side, side);
		pen.dispose();
		return picture;
	}

	private static byte[] as(BufferedImage picture, String format) {
		ByteArrayOutputStream bytes = new ByteArrayOutputStream();

		try {
			assertThat(ImageIO.write(picture, format, bytes)).isTrue();
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}

		return bytes.toByteArray();
	}

	/*
	 * THE THREE WEBP PICTURES, AS TEXT. The platform writes no WebP, so they were made once with
	 * Pillow (a red field 400 by 300 with the blue square at 250, 50, lossy; a blue disc on nothing,
	 * 300 by 300, lossless; a blue field 2001 by 2000, lossless) and are carried here in Base64
	 * rather than as files: every file under backend/src is read as text by
	 * JournalCitationsDoNotNameALineTest, and that floor reads no binary file today.
	 */
	private static final String MARKED_WEBP =
			"UklGRlgCAABXRUJQVlA4IEwCAADwJwCdASqQASwBPjEYjEQiIaEQ3MwAIAMEtLdwuwCNjq/gH4AaYD8AP2O/qtOA"
			+ "/gH4AfMzlAP4B+QG8AfwD2qv4B/AOkA4AD9AN8A/gH6EfvGVUaCw/EwFqQX3rThw4cOHDhw4cOHDhw4cOHDhw4cO"
			+ "HDhw4cOHDhw4cOHBqTqXfznvXrTk3ZbCchpVPzhw4cOHDXa1WlT7l5WpBfetOHDXa1WlT65nvvWnDhw4a7Wq0qfX"
			+ "USkF9604cODZnSclWG36dOnTp06dCeZNvFCQzSvzp06dOmwD/4gfl2E8J4TwlZ3zcxZpX506dOnTp06dOnTp06dO"
			+ "nTp06dOnTp06dOnTp06dOnTp06dOnTp06dOnTp06dOnTp06dOnTp06dOnTp06dOnTp06dOnTp06dOnTp06dOnTp0"
			+ "6dOnTp06dOnTp06dOnTp06bAAP7/ik/NzG1NIft0dgDBSZ9z/8J8kJipMAAR10bG2vtOhEUvzEls51vnDjCD3xmq"
			+ "8MWVbCo6nP3ELWmaRZdEfL9apw9v/CRkIQHLlzEjvwmUJYaBH86D7B4U/Xo1YIbzmpKc0JlHJ9qtvY9FuuvtQyNg"
			+ "yvAh0ry7ZwOoXnGU7HsJ1T073cDdds8RK45qtUqAY+QZ96jjUuGe0ucLnAwgLxIADNOxRj4Cic5KqmcU9n5iS2jZ"
			+ "xGf75TuEMU87viFrUZImWiPPPanYnQR4k4gJ6XgSgD8bfO87DswGpiOzLSlqjSLzUVcJ4zuKwJ2Nfad8AxSXCHdk"
			+ "m8ukgAAAAAAAAAAAAAA=";

	private static final String SEE_THROUGH_WEBP =
			"UklGRmQBAABXRUJQVlA4TFgBAAAvK8FKEA8QMf/zHwzIsW23bZS1ZAkqBaVRpaEUlsClbGP0HP//uGBwnoj+O3Ab"
			+ "SZGycIw9VHnC5j/mbVBPcJV0AbhJ0pa4RC6GN4CHyzu0r0Xv6epvIzdvH9C2+hHkAQl5IBuk2mciT7xJyBOLhDzx"
			+ "bnGubmKqbmjZJNW9EnnhaKK690Leqtjsq94LeSvZdDVlQgqVHVJNmZBCjQ5iyiRt21I89hXFRMopj44iXnKk6Nkl"
			+ "NWVw6ZsyuohpGNK2JcVnP33uPueWyKebPNcAl4bkAGkhGAL0C8EYQCvELcL2u5BVHAeWawxerjlrWvPyHFcV01oT"
			+ "zXFFN631KLQCntaae1pZgEof08o7VMKi0tq08iGUSKl0SyVlKnVTCZ6yAZRZoCwFZDwoe0KZGMrqUIaIsk2UuYIs"
			+ "GGXUKDtHmT7KGkIGkrKZlBmFLCtlbCn7C5lkykr/x7xtAA==";

	private static final String TOO_MANY_PIXELS_WEBP =
			"UklGRsoAAABXRUJQVlA4TL4AAAAv0MfzAQcQ0f/+BwQkSf//kxH9z/jPf/7zn//85z//+c9//vOf//znP//5z3/+"
			+ "85///Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+"
			+ "85///Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+"
			+ "85///Oc///nP/9EC";

	/*
	 * AND FIVE MORE, from the review of PR 639, round 1. The first three are the drawing above (red
	 * 400 by 300, the blue square at 250, 50) as a WebP without loss, without loss and with an
	 * alpha channel (its top left corner 60 by 60 see-through), and with loss and an alpha channel:
	 * on imageio-webp 3.12.0 a circle smaller than the picture came out of the first green-grey and
	 * out of the other two see-through. The last two claim a canvas of 100 by 100 (VP8X) around a
	 * frame of 16383 by 16383, the second inside a frame of an animation (ANMF): on 3.12.0 the first
	 * was an OutOfMemoryError on a heap of 350 MB.
	 */
	private static final String LOSSLESS_WEBP =
			"UklGRjYAAABXRUJQVlA4TCoAAAAvj8FKAA8Q87//8x8OFLVtxHTw53TM7ncEZkT/JyAvvEY13n+95/3/LQU=";
	private static final String LOSSLESS_WITH_ALPHA_WEBP =
			"UklGRkgAAABXRUJQVlA4TDsAAAAvj8FKEBcQ8y8gKPJ/tPkP+EBRI0nKmjz0x0b5Rx3R/wmQ1rpn/HfEeNU9nEer"
			+ "4z/8d1Lgf/yP/z+XAQA=";
	private static final String LOSSY_WITH_ALPHA_WEBP =
			"UklGRtwCAABXRUJQVlA4WAoAAAAQAAAAjwEAKwEAQUxQSCEAAAABDzD/ERFCUds2UPmjLYOdrwFYIvo/Adodh79w"
			+ "+B//E24AVlA4IJQCAAAQKgCdASqQASwBPjEYiEQiIYiPPBABglnbuF1URsdX8A/ADTAfgx+zNWB8gXw/8D/3/9wD"
			+ "8AOoA/jX5HcAD9AP5B7Y/8A/gHSAejB1gH6AekB1Bf8A/Q79/yqjQ/KBQuqHprsKvvNUPTTTaqUUwq+81Q9NdhSQ"
			+ "z/HdUPTXYVfeZbkbWrgTskEpwbvUV1Q9NMlal38Ik1kjT37vfQIENZS4muwq+8Z8PqfvYZzzVD012FXwhlX3AU71"
			+ "KvvNUPTXWZB5PaM7/quwq+81Q8qkw9KlKazmda7Cr7zLsFg8RxbCQGqHprsKtAf/EErziq/PNXgZsoJYweh6a7Cr"
			+ "7zVD012FX3mqHprsKvvNUPTXYVfeaoemuwq+81Q9NdhV95qh6a7Cr7zVD012FX3mqHprsKvvNUPTXYVfeaoemuwq"
			+ "+81Q9NdhV95qh6a7Cr7zVD012FX3mqHprsKvvGAA/v/guNf89m//1UCjTqk9FrHqObWuV1ZaQPwDew3mHz/AWYG9"
			+ "cF+8H60taL2zY/0jFs260UuJp8Z1DSLOfeM0z9U90JtNdRwuO3NHwCdFTkSCEefpCJdU19ZM5r06ERS/MR1irKS+"
			+ "wQQF895/TIs8yUdObiD/YKl7/39mmogw5BOnznivd19ghmpUuegIKYEDQeAcFuSzF3/JqEWiasEN5zUlMpnOFXjl"
			+ "K1Pm/a1PCl8puoJaHB04Dm/zGKMt71rgIILKtMtMDzrvwdkSCVXnOdHgqEQAEIWS6s4YUZOEWzrjasLo/zMSb5iO"
			+ "s4nPKVw72T3oGfvEH+mOrdE/fZJ2wWXLSRAZqVLWE4f+E4e23P1oZKyMBZcJUrnTUvNAQR6t/U1P7eUP/5KrpvSs"
			+ "4UxCNgAAAAAAAAAAAAA=";
	private static final String A_FRAME_LARGER_THAN_ITS_CANVAS_WEBP =
			"UklGRnwAAABXRUJQVlA4WAoAAAAAAAAAYwAAYwAAVlA4IF4AAADwBQCdASr/P/8/PtFosFMoJiSioKgBABoJaW7h"
			+ "c/D1QCe9xF5Yk+qVb0itGywJtTe4i8sA11NsAAD+/lF9//9CT//ibP/6TZ8Ir8YTSSDw1BVq5ZgUNlSOiCvsQAAA";
	private static final String AN_ANIMATION_FRAME_LARGER_THAN_ITS_CANVAS_WEBP =
			"UklGRioBAABXRUJQVlA4WAoAAAACAAAAYwAAYwAAQU5JTQYAAAAAAAAAAABBTk1GfAAAAAAAAAAAAGMAAGMAAGQA"
			+ "AAJWUDggZAAAADAHAJ0BKv8//z8+0WiwUygmJKKgqAEAGglpbt/wL0C8AfoAAIs4PHifnk/0RpdBth7R82rjrNq4"
			+ "6zauOs2rjrNIAAD+8Ju///0JP/+Js//pNnwiv6S6XHj0gmn5xivXeopAEABBTk1GegAAAAAAAAAAAGMAAGMAAGQA"
			+ "AABWUDggYgAAANQGAJ0BKmQAZAA+0WCmUwIKAAGglpbt/kC8AfoB+/4nQAHZWL4lF1mdRe8iTT5Ik0+SJNPkiTT5"
			+ "Ik0+SJM2AAD+6zj//oTY9qK///Qk/+Js/4mz4QX/rBdmHoEGOChLCAAA";

	private static byte[] resource(String name) {
		return Base64.getDecoder().decode(switch (name) {
			case "marked.webp" -> MARKED_WEBP;
			case "see-through.webp" -> SEE_THROUGH_WEBP;
			case "lossless.webp" -> LOSSLESS_WEBP;
			case "lossless-alpha.webp" -> LOSSLESS_WITH_ALPHA_WEBP;
			case "lossy-alpha.webp" -> LOSSY_WITH_ALPHA_WEBP;
			case "bomb.webp" -> A_FRAME_LARGER_THAN_ITS_CANVAS_WEBP;
			case "bomb-animated.webp" -> AN_ANIMATION_FRAME_LARGER_THAN_ITS_CANVAS_WEBP;
			default -> TOO_MANY_PIXELS_WEBP;
		});
	}

	private static BufferedImage read(SmallPicture.Cut cut) {
		try {
			return ImageIO.read(new ByteArrayInputStream(cut.bytes()));
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	private static BigDecimal share(String said) {
		return new BigDecimal(said);
	}

	/** Near enough to this colour for a JPEG: each channel within a fifth of the way. */
	private static boolean near(int pixel, int colour) {
		for (int shift : new int[] { 16, 8, 0 }) {
			if (Math.abs((pixel >> shift & 0xFF) - (colour >> shift & 0xFF)) > 50) {
				return false;
			}
		}

		return true;
	}

	private static void blueAllThrough(SmallPicture.Cut cut) {
		BufferedImage small = read(cut);

		assertThat(small.getWidth()).as("the cut is not %d wide", SmallPicture.SIDE)
				.isEqualTo(SmallPicture.SIDE);
		assertThat(small.getHeight()).as("the cut is not %d high", SmallPicture.SIDE)
				.isEqualTo(SmallPicture.SIDE);

		for (int[] at : INSIDE) {
			assertThat(near(small.getRGB(at[0], at[1]), BLUE))
					.as("the cut is not blue at %d, %d: it is %06x, so it is not the circle",
							at[0], at[1], small.getRGB(at[0], at[1]) & 0xFFFFFF)
					.isTrue();
		}
	}

	/**
	 * LYING DOWN: wider than high, so the room left over is across and {@code y} has none.
	 * The square at 250 across in a picture of 400, side 100: x is 250 of the 300 left over.
	 */
	@Test
	void aPictureLyingDownIsCutWhereItsCircleIs() throws IOException {
		byte[] jpeg = as(drawn(400, 300, 250, 50, 100), "jpeg");

		SmallPicture.Cut cut = SmallPicture.of(jpeg, "image/jpeg", share("0.83333333"),
				share("0.25"), share("0.33333333"));

		assertThat(cut.mediaType()).isEqualTo("image/jpeg");
		blueAllThrough(cut);
	}

	/** STANDING: higher than wide, so the room left over is down. */
	@Test
	void aPictureStandingIsCutWhereItsCircleIs() throws IOException {
		byte[] jpeg = as(drawn(300, 400, 50, 250, 100), "jpeg");

		blueAllThrough(SmallPicture.of(jpeg, "image/jpeg", share("0.25"), share("0.83333333"),
				share("0.33333333")));
	}

	/**
	 * AND THE SAME PICTURE CUT TO ANOTHER CIRCLE IS NOT BLUE, which is what makes the two cases
	 * above say anything: a cut that ignored the circle would be red here and red there alike.
	 */
	@Test
	void anotherCircleOfTheSamePictureIsAnotherCut() throws IOException {
		byte[] jpeg = as(drawn(400, 300, 250, 50, 100), "jpeg");

		BufferedImage small = read(SmallPicture.of(jpeg, "image/jpeg", share("0"), share("0"),
				share("0.33333333")));

		assertThat(near(small.getRGB(120, 120), RED))
				.as("the top left corner of the picture is red, and the cut of it is not")
				.isTrue();
	}

	/**
	 * A WHOLE PHOTOGRAPH, large enough that the decoder is asked for every other pixel and the
	 * cut is halved before its last step. The whole picture's circle is the largest one there
	 * is, centred, so its middle is the middle of the picture.
	 */
	@Test
	void aLargePhotographIsCutAndMadeSmall() throws IOException {
		byte[] jpeg = as(drawn(3000, 2000, 1250, 750, 500), "jpeg");

		BufferedImage small = read(SmallPicture.of(jpeg, "image/jpeg", share("0.5"), share("0.5"),
				share("1")));

		assertThat(small.getWidth()).isEqualTo(SmallPicture.SIDE);
		assertThat(near(small.getRGB(120, 120), BLUE)).as("the middle of the whole circle").isTrue();
		assertThat(near(small.getRGB(10, 10), RED)).as("its corner, which is the field").isTrue();
	}

	/** A PNG with nothing see-through goes out as a JPEG: it would only be larger as a PNG. */
	@Test
	void anOpaquePngGoesOutAsAJpeg() throws IOException {
		BufferedImage withRoomForClear = new BufferedImage(400, 300, BufferedImage.TYPE_INT_ARGB);
		Graphics2D pen = withRoomForClear.createGraphics();
		pen.drawImage(drawn(400, 300, 250, 50, 100), 0, 0, null);
		pen.dispose();

		SmallPicture.Cut cut = SmallPicture.of(as(withRoomForClear, "png"), "image/png",
				share("0.83333333"), share("0.25"), share("0.33333333"));

		assertThat(cut.mediaType()).isEqualTo("image/jpeg");
		blueAllThrough(cut);
	}

	/**
	 * A MARK ON NOTHING STAYS ON NOTHING: what is see-through in the cut goes out as PNG and
	 * is still see-through, so the circle behind it shows instead of a colour nobody chose.
	 */
	@Test
	void whatIsSeeThroughStaysSeeThrough() throws IOException {
		BufferedImage mark = new BufferedImage(300, 300, BufferedImage.TYPE_INT_ARGB);
		Graphics2D pen = mark.createGraphics();
		pen.setColor(new Color(BLUE));
		pen.fillOval(75, 75, 150, 150);
		pen.dispose();

		SmallPicture.Cut cut = SmallPicture.of(as(mark, "png"), "image/png", share("0.5"),
				share("0.5"), share("1"));

		assertThat(cut.mediaType()).isEqualTo("image/png");
		BufferedImage small = read(cut);
		assertThat(small.getRGB(2, 2) >>> 24).as("the corner is not see-through").isZero();
		assertThat(small.getRGB(120, 120) & 0xFFFFFF).as("the middle is the mark").isEqualTo(BLUE);
	}

	/** THE THIRD TYPE, lossy: the reader the platform does not have. */
	@Test
	void aWebpIsCutLikeTheOtherTwo() throws IOException {
		blueAllThrough(SmallPicture.of(resource("marked.webp"), "image/webp", share("0.83333333"),
				share("0.25"), share("0.33333333")));
	}

	/**
	 * A CIRCLE SMALLER THAN THE PICTURE, in each of the three ways a WebP can be written, which is
	 * the case the whole-picture cases above could not see: the reader is then asked for a region
	 * and not for everything, and on imageio-webp 3.12.0 that region came out wrong for the two
	 * pictures without loss and see-through for both with an alpha channel. Blue all through and
	 * not see-through anywhere, so the cut is the square and the square is opaque.
	 */
	@ParameterizedTest
	@ValueSource(strings = { "lossless.webp", "lossless-alpha.webp", "lossy-alpha.webp" })
	void aWebpCircleSmallerThanThePictureIsCutWhereItIs(String name) throws IOException {
		SmallPicture.Cut cut = SmallPicture.of(resource(name), "image/webp", share("0.83333333"),
				share("0.25"), share("0.33333333"));

		assertThat(cut.mediaType()).as("%s: the square is opaque, so its cut is a JPEG", name)
				.isEqualTo("image/jpeg");
		blueAllThrough(cut);
	}

	/**
	 * A FRAME THAT CLAIMS MORE THAN ITS CANVAS IS MEASURED BY THE FRAME. The reader answers the
	 * canvas, 100 by 100, so a ceiling asked only of the reader lets the decoder try 16383 by
	 * 16383; the message carries the frame's count, which is what says the frame was read.
	 */
	@ParameterizedTest
	@ValueSource(strings = { "bomb.webp", "bomb-animated.webp" })
	void aWebpWhoseFrameClaimsMoreThanItsCanvasIsNotCut(String name) {
		assertThatThrownBy(() -> SmallPicture.of(resource(name), "image/webp", share("0.5"),
				share("0.5"), share("1")))
				.isInstanceOf(IOException.class)
				.hasMessageContaining("100 by 100")
				.hasMessageContaining(String.valueOf(16383L * 16383L));
	}

	/** What the chunks claim, read without decoding; and a file that ends too soon claims nothing. */
	@Test
	void theLargestFrameIsReadOffTheChunks() {
		assertThat(SmallPicture.largestFrameOf(resource("lossless.webp")))
				.as("VP8L").isEqualTo(400L * 300);
		assertThat(SmallPicture.largestFrameOf(resource("lossy-alpha.webp")))
				.as("VP8X, ALPH and VP8 ").isEqualTo(400L * 300);
		assertThat(SmallPicture.largestFrameOf(resource("bomb-animated.webp")))
				.as("a frame inside ANMF").isEqualTo(16383L * 16383);

		byte[] whole = resource("bomb.webp");
		assertThat(SmallPicture.largestFrameOf(java.util.Arrays.copyOf(whole, 40)))
				.as("a VP8 chunk cut off before its size is said").isZero();
	}

	/** And lossless with an alpha channel, which is a different decoder inside the same reader. */
	@Test
	void aSeeThroughWebpStaysSeeThrough() throws IOException {
		SmallPicture.Cut cut = SmallPicture.of(resource("see-through.webp"), "image/webp",
				share("0.5"), share("0.5"), share("1"));

		assertThat(cut.mediaType()).isEqualTo("image/png");
		BufferedImage small = read(cut);
		assertThat(small.getRGB(2, 2) >>> 24).isZero();
		assertThat(small.getRGB(120, 120) & 0xFFFFFF).isEqualTo(BLUE);
	}

	/**
	 * TURNED BY ITS EXIF NOTE, all eight ways. The picture is drawn as a browser shows it - 400
	 * by 300, the square at 250 across and 50 down - and then STORED the way a camera holding
	 * itself in each of the eight positions would store it, with the note saying how to turn
	 * it back. The circle is chosen over the shown picture, as the member chose it.
	 *
	 * <p><b>The stored picture is built from the EXIF specification's own words about each
	 * value</b> (which side of the shown picture the stored first row and first column are),
	 * mapping stored to shown, which is the opposite direction from the class under test. So a
	 * slip in one of its eight cases is not repeated here.
	 */
	@ParameterizedTest
	@ValueSource(ints = { 1, 2, 3, 4, 5, 6, 7, 8 })
	void aTurnedPhotographIsCutWhereTheMemberSawItsCircle(int orientation) throws IOException {
		BufferedImage shown = drawn(400, 300, 250, 50, 100);
		boolean sideways = orientation >= 5;
		int width = sideways ? 300 : 400;
		int height = sideways ? 400 : 300;
		BufferedImage stored = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);

		for (int down = 0; down < height; down++) {
			for (int across = 0; across < width; across++) {
				int[] at = shownAt(orientation, across, down, width, height);
				stored.setRGB(across, down, shown.getRGB(at[0], at[1]));
			}
		}

		byte[] jpeg = withOrientation(as(stored, "jpeg"), orientation, orientation % 2 == 0);

		assertThat(SmallPicture.orientationOf(jpeg)).isEqualTo(orientation);
		blueAllThrough(SmallPicture.of(jpeg, "image/jpeg", share("0.83333333"), share("0.25"),
				share("0.33333333")));
	}

	/**
	 * Where a stored pixel is shown, per EXIF 2.3, tag 0x0112: 1 row 0 is the top and column 0
	 * the left; 2 top and right; 3 bottom and right; 4 bottom and left; 5 row 0 is the left and
	 * column 0 the top; 6 right and top; 7 right and bottom; 8 left and bottom.
	 */
	private static int[] shownAt(int orientation, int across, int down, int width, int height) {
		return switch (orientation) {
			case 2 -> new int[] { width - 1 - across, down };
			case 3 -> new int[] { width - 1 - across, height - 1 - down };
			case 4 -> new int[] { across, height - 1 - down };
			case 5 -> new int[] { down, across };
			case 6 -> new int[] { height - 1 - down, across };
			case 7 -> new int[] { height - 1 - down, width - 1 - across };
			case 8 -> new int[] { down, width - 1 - across };
			default -> new int[] { across, down };
		};
	}

	/** This JPEG with an EXIF segment carrying one tag, put after its JFIF segment. */
	private static byte[] withOrientation(byte[] jpeg, int orientation, boolean little) {
		byte[] exif = exifSaying(0x0112, orientation, little);
		int afterJfif = 4 + ((jpeg[4] & 0xFF) << 8 | jpeg[5] & 0xFF);
		return ByteBuffer.allocate(jpeg.length + exif.length).put(jpeg, 0, afterJfif).put(exif)
				.put(jpeg, afterJfif, jpeg.length - afterJfif).array();
	}

	/** An APP1 segment: „Exif", a TIFF header, and a first directory of one entry. */
	private static byte[] exifSaying(int tag, int value, boolean little) {
		ByteBuffer tiff = ByteBuffer.allocate(26)
				.order(little ? java.nio.ByteOrder.LITTLE_ENDIAN : java.nio.ByteOrder.BIG_ENDIAN);
		tiff.put(little ? (byte) 'I' : (byte) 'M').put(little ? (byte) 'I' : (byte) 'M')
				.putShort((short) 42).putInt(8)
				.putShort((short) 1)
				.putShort((short) tag).putShort((short) 3).putInt(1).putShort((short) value)
				.putShort((short) 0)
				.putInt(0);
		return segment(0xE1, concat("Exif\0\0".getBytes(StandardCharsets.ISO_8859_1), tiff.array()));
	}

	private static byte[] segment(int marker, byte[] payload) {
		int length = payload.length + 2;
		return ByteBuffer.allocate(payload.length + 4).put((byte) 0xFF).put((byte) marker)
				.put((byte) (length >> 8)).put((byte) length).put(payload).array();
	}

	private static byte[] concat(byte[] first, byte[] second) {
		return ByteBuffer.allocate(first.length + second.length).put(first).put(second).array();
	}

	private static final byte[] SOI = { (byte) 0xFF, (byte) 0xD8 };

	private static final byte[] SOS = { (byte) 0xFF, (byte) 0xDA, 0, 2 };

	/** A note it does not understand, or none, is „as stored", as in a browser that cannot read it. */
	@Test
	void whatTheNoteCannotSayIsAsStored() {
		byte[] xmp = segment(0xE1, "http://ns.adobe.com/xap/1.0/\0".getBytes(StandardCharsets.ISO_8859_1));

		assertThat(SmallPicture.orientationOf(concat(SOI, SOS)))
				.as("a JPEG with no note at all").isEqualTo(1);
		assertThat(SmallPicture.orientationOf(concat(SOI, concat(xmp, concat(exifSaying(0x0112, 6,
				false), SOS)))))
				.as("an APP1 that is not EXIF is stepped over, and the EXIF after it read")
				.isEqualTo(6);
		assertThat(SmallPicture.orientationOf(concat(SOI, concat(exifSaying(0x0110, 6, false), SOS))))
				.as("a directory without the orientation tag").isEqualTo(1);
		assertThat(SmallPicture.orientationOf(concat(SOI, concat(exifSaying(0x0112, 0, true), SOS))))
				.as("a value under one").isEqualTo(1);
		assertThat(SmallPicture.orientationOf(concat(SOI, concat(exifSaying(0x0112, 9, true), SOS))))
				.as("a value over eight").isEqualTo(1);
		assertThat(SmallPicture.orientationOf(concat(SOI, new byte[] { 0x00, 0x01 })))
				.as("something where a marker should be").isEqualTo(1);
		assertThat(SmallPicture.orientationOf(concat(SOI, new byte[] { (byte) 0xFF, (byte) 0xE1, 0 })))
				.as("a file cut short in a segment's length").isEqualTo(1);
	}

	/** Garbage under a picture's type is refused by the reader, as an exception and not a cut. */
	@Test
	void bytesThatAreNotAPictureAreNotCut() {
		assertThatThrownBy(() -> SmallPicture.of(new byte[] { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF,
				'n', 'o' }, "image/jpeg", share("0.5"), share("0.5"), share("1")))
				.isInstanceOf(IOException.class);
	}

	/**
	 * A PICTURE OF MORE PIXELS THAN THE SERVER CAN HOLD IS NOT CUT, and that is decided off the
	 * header before a single pixel is unpacked: this PNG says 10000 by 6000 and carries no
	 * pixels at all, so a reader that went on to decode it would fail differently.
	 */
	@Test
	void aPictureLargerThanTheServerCanHoldIsNotCut() {
		assertThatThrownBy(() -> SmallPicture.of(pngHeaderOf(10_000, 6_000), "image/png",
				share("0.5"), share("0.5"), share("1")))
				.isInstanceOf(IOException.class)
				.hasMessageContaining("10000 by 6000");
	}

	/**
	 * AND A WEBP HAS A LOWER CEILING, because its reader holds the whole picture while decoding.
	 * 2001 by 2000 is one row over four million; the same picture as a PNG is far under the
	 * other ceiling, so this falls on the WebP one and on nothing else.
	 */
	@Test
	void aWebpOverItsOwnCeilingIsNotCut() {
		assertThatThrownBy(() -> SmallPicture.of(resource("too-many-pixels.webp"), "image/webp",
				share("0.5"), share("0.5"), share("1")))
				.isInstanceOf(IOException.class)
				.hasMessageContaining("2001 by 2000");
	}

	private static byte[] pngHeaderOf(int width, int height) {
		byte[] header = ByteBuffer.allocate(17).put("IHDR".getBytes(StandardCharsets.ISO_8859_1))
				.putInt(width).putInt(height).put((byte) 8).put((byte) 2).put((byte) 0)
				.put((byte) 0).put((byte) 0).array();
		CRC32 crc = new CRC32();
		crc.update(header);
		return ByteBuffer.allocate(8 + 4 + 17 + 4)
				.put(new byte[] { (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A })
				.putInt(13).put(header).putInt((int) crc.getValue()).array();
	}
}
