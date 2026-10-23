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
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
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

	private static byte[] resource(String name) {
		try (InputStream in = SmallPictureTest.class.getResourceAsStream("/photos/" + name)) {
			return in.readAllBytes();
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
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
