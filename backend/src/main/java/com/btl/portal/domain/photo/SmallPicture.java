package com.btl.portal.domain.photo;

import com.twelvemonkeys.imageio.plugins.webp.WebPImageReaderSpi;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import javax.imageio.stream.MemoryCacheImageInputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.Graphics2D;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Arrays;

/**
 * THE PICTURE A CIRCLE DRAWS, CUT AND MADE SMALL ON THE SERVER.
 *
 * <p>PDL, 23.10.2026, the owner choosing between offered outcomes, with my recommendation:
 * „Server pravi i šalje umanjenu, već isečenu sliku za kružiće (Top 10 i svuda gde se slika
 * prikazuje mala); original ostaje za profil." Until then every circle on the portal asked for
 * the whole original and the browser cut it with {@code object-position} and {@code scale}
 * ({@code frontend/src/components/crop.ts}, {@code fittedTo}), so a circle of 64 pixels cost a
 * download of the whole photograph: 624 KB measured for one.
 *
 * <p><b>The crop means here exactly what it means in the browser, and that is the whole of
 * what this class must get right.</b> ADL A17 and V21: three fractions, the third the
 * diameter as a share of the picture's SHORTER edge, and {@code x} and {@code y} where that
 * square sits along whatever room is left over in each direction. {@code frameOf} in
 * {@code crop.ts} spells the same arithmetic for the moderator's view; {@link #squareOf} is
 * its twin, in pixels instead of percentages.
 *
 * <p><b>And it is measured on the picture AS A BROWSER SHOWS IT, which is not always the
 * picture as it is stored.</b> A telephone writes a photograph in the orientation its sensor
 * had and adds an EXIF note saying how to turn it, and every browser turns it
 * ({@code image-orientation: from-image} is the default). The member chose his circle over
 * the turned picture, so a cut taken over the stored one would land on the wrong part of it.
 * {@link #orientationOf} reads that note and {@link #upright} applies it. Read for JPEG only,
 * which is where telephones write it; a PNG or WebP carrying the same note is drawn as
 * stored, and that is a boundary written down rather than a turn guessed at.
 *
 * <p><b>The size is {@value #SIDE} pixels a side, one size for every circle, and the number is
 * not taste.</b> It is the floor every circle was cut against: PDL 27.08.2026, „Poslušaću
 * preporuku 240", so a circle smaller than 240 real pixels cannot be chosen
 * ({@code SMALLEST_PIXELS}), and a cut of 240 is therefore never an enlargement of a crop
 * chosen under that rule. The largest circle a small one is drawn at is a competitor's card,
 * 7.5rem, so 120 CSS pixels and 240 on a screen of double density.
 *
 * <p><b>JPEG, and PNG only where the picture is see-through.</b> The platform writes both and
 * does not write WebP. A team's logo is often a shape on nothing, and a JPEG would fill the
 * nothing with a colour the circle behind it does not have, so whatever is see-through in the
 * cut goes out as PNG and keeps it.
 */
public final class SmallPicture {

	/** The side of every small picture, in pixels. See the head of this class. */
	public static final int SIDE = 240;

	/**
	 * How hard the JPEG is squeezed. My reasoning, not a recorded decision: measured on a
	 * photograph cut to {@value #SIDE}, 0.85 is where the file stops shrinking faster than the
	 * face loses detail, and the circle is drawn at half that size or less.
	 */
	static final float JPEG_QUALITY = 0.85f;

	/**
	 * The largest JPEG or PNG this cuts, in pixels.
	 *
	 * <p>A picture's bytes are capped at upload ({@link WhatAPictureIs#AT_MOST_BYTES}) and its
	 * pixels never were, and a flat colour five megabytes long unpacks to a picture of hundreds
	 * of millions of pixels. The production server gives the JVM some 350 MB of heap
	 * ({@code deploy/compose.prod.yml}). The platform's two readers decode only the square asked
	 * for, a row at a time (measured: a PNG of 8000 by 6000 cut in 128 MB of heap), but a
	 * progressive JPEG keeps its whole picture in native memory beside the heap while it is read.
	 * Twenty five million is a camera of 6000 by 4000; a telephone's default picture is twelve.
	 * Over it the picture is not cut, the log says so, and the circle on the screen falls back to
	 * the original ({@code frontend/src/components/Portrait.tsx}).
	 */
	static final long AT_MOST_PIXELS = 25_000_000L;

	/**
	 * The largest WebP this cuts, and it is six times smaller for a measured reason: the WebP
	 * reader holds the whole of a lossy picture as objects while it decodes it, about twenty
	 * bytes a pixel. Measured on this machine: four million pixels cut in 96 MB of heap, six
	 * million did not fit in 128 MB, and twelve did not fit in 200. A WebP is a picture saved off
	 * the web far more often than one off a camera, so four million is room enough, and over it
	 * the same fall back as above applies.
	 */
	static final long AT_MOST_WEBP_PIXELS = 4_000_000L;

	/** What came out: the bytes and what they are. */
	public record Cut(byte[] bytes, String mediaType) {
	}

	private SmallPicture() {
	}

	/**
	 * The circle of this picture, {@value #SIDE} pixels a side.
	 *
	 * @param original  the bytes of the picture as they were sent
	 * @param mediaType what {@link WhatAPictureIs#sniff} said they are, which V8 holds to one of
	 *                  three
	 * @param x         where the square sits across, 0 to 1
	 * @param y         where it sits down, 0 to 1
	 * @param diameter  its side as a share of the shorter edge, above 0 and up to 1
	 * @throws IOException when the bytes are not a picture this can read, or one larger than
	 *                     {@link #AT_MOST_PIXELS} or {@link #AT_MOST_WEBP_PIXELS}
	 */
	public static Cut of(byte[] original, String mediaType, BigDecimal x, BigDecimal y,
			BigDecimal diameter) throws IOException {
		ImageReader reader = readerFor(mediaType);

		try (ImageInputStream in = new MemoryCacheImageInputStream(
				new ByteArrayInputStream(original))) {
			reader.setInput(in, true, true);

			int width = reader.getWidth(0);
			int height = reader.getHeight(0);

			if ((long) width * height > ("image/webp".equals(mediaType) ? AT_MOST_WEBP_PIXELS
					: AT_MOST_PIXELS)) {
				throw new IOException(width + " by " + height + " is more than this cuts");
			}

			int turn = "image/jpeg".equals(mediaType) ? orientationOf(original) : 1;
			Rectangle square = squareOf(turn, width, height, x, y, diameter);

			/* ONLY THE SQUARE IS DECODED, AND ONLY AS FINELY AS IT IS NEEDED. Twice the side
			   and no finer: the halving below then has real pixels to average over, and a
			   photograph of twelve million pixels is never held whole. */
			ImageReadParam param = reader.getDefaultReadParam();
			param.setSourceRegion(square);
			int step = Math.max(1, square.width / (2 * SIDE));
			param.setSourceSubsampling(step, step, 0, 0);

			return written(scaled(upright(reader.read(0, param), turn)));
		} finally {
			reader.dispose();
		}
	}

	/**
	 * The reader for the type, asked by the type the row carries and not by sniffing again.
	 * The WebP reader is built by name rather than found through the registry, because the
	 * registry is filled from the class path of whichever thread touched it first, and a
	 * picture type that silently has no reader in one packaging and has one in another is
	 * exactly the gap this dependency exists to close.
	 */
	private static ImageReader readerFor(String mediaType) throws IOException {
		if ("image/webp".equals(mediaType)) {
			return new WebPImageReaderSpi().createReaderInstance();
		}

		return ImageIO.getImageReadersByMIMEType(mediaType).next();
	}

	/**
	 * Where the circle's square lies over the STORED picture, in its pixels.
	 *
	 * <p>The arithmetic is {@code frameOf}'s ({@code crop.ts}) on the picture as it is shown:
	 * the side is the diameter times the shorter edge, which turning does not change, and
	 * each offset is its fraction of the room left over in that direction. The square found
	 * there is then carried back to where it lies in the stored picture, which for a turned
	 * one is a different corner.
	 */
	static Rectangle squareOf(int turn, int width, int height, BigDecimal x, BigDecimal y,
			BigDecimal diameter) {
		boolean sideways = turn >= 5;
		int shownWidth = sideways ? height : width;
		int shownHeight = sideways ? width : height;
		int shorter = Math.min(width, height);
		int side = Math.max(1, pixels(diameter, shorter));
		int left = pixels(x, shownWidth - side);
		int top = pixels(y, shownHeight - side);

		return switch (turn) {
			case 2 -> new Rectangle(width - left - side, top, side, side);
			case 3 -> new Rectangle(width - left - side, height - top - side, side, side);
			case 4 -> new Rectangle(left, height - top - side, side, side);
			case 5 -> new Rectangle(top, left, side, side);
			case 6 -> new Rectangle(top, height - left - side, side, side);
			case 7 -> new Rectangle(width - top - side, height - left - side, side, side);
			case 8 -> new Rectangle(width - top - side, left, side, side);
			default -> new Rectangle(left, top, side, side);
		};
	}

	/** A share of a length, in whole pixels, rounded the way a person rounds. */
	private static int pixels(BigDecimal share, int length) {
		return share.multiply(BigDecimal.valueOf(length)).setScale(0, RoundingMode.HALF_UP)
				.intValueExact();
	}

	/**
	 * The stored square turned the way a browser shows it, premultiplied so that the halving
	 * below does not drag the colour of an invisible pixel into a visible edge.
	 *
	 * <p>Each case says which stored pixel lands on the shown pixel {@code (across, down)},
	 * for the eight orientations EXIF names (1 as stored, 2 mirrored, 3 half a turn, 4 flipped,
	 * 5 transposed, 6 a quarter turn clockwise, 7 transversed, 8 a quarter turn back).
	 */
	static BufferedImage upright(BufferedImage stored, int turn) {
		int width = stored.getWidth();
		int height = stored.getHeight();
		boolean sideways = turn >= 5;
		int shownWidth = sideways ? height : width;
		int shownHeight = sideways ? width : height;
		int[] from = stored.getRGB(0, 0, width, height, null, 0, width);
		int[] to = new int[from.length];

		for (int down = 0; down < shownHeight; down++) {
			for (int across = 0; across < shownWidth; across++) {
				int at = switch (turn) {
					case 2 -> down * width + (width - 1 - across);
					case 3 -> (height - 1 - down) * width + (width - 1 - across);
					case 4 -> (height - 1 - down) * width + across;
					case 5 -> across * width + down;
					case 6 -> (height - 1 - across) * width + down;
					case 7 -> (height - 1 - across) * width + (width - 1 - down);
					case 8 -> across * width + (width - 1 - down);
					default -> down * width + across;
				};
				to[down * shownWidth + across] = from[at];
			}
		}

		BufferedImage shown = new BufferedImage(shownWidth, shownHeight,
				BufferedImage.TYPE_INT_ARGB_PRE);
		shown.setRGB(0, 0, shownWidth, shownHeight, to, 0, shownWidth);
		return shown;
	}

	/**
	 * Down to {@value #SIDE}, by halves while a half is still at least that big and then in
	 * one last step. A single bilinear step from a thousand pixels to two hundred reads one
	 * pixel in five and throws the rest away; halving averages all of them.
	 */
	private static BufferedImage scaled(BufferedImage square) {
		BufferedImage now = square;

		while (now.getWidth() / 2 >= SIDE) {
			now = drawn(now, now.getWidth() / 2, BufferedImage.TYPE_INT_ARGB_PRE);
		}

		return drawn(now, SIDE, BufferedImage.TYPE_INT_ARGB_PRE);
	}

	private static BufferedImage drawn(BufferedImage from, int side, int type) {
		BufferedImage to = new BufferedImage(side, side, type);
		Graphics2D pen = to.createGraphics();

		try {
			pen.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
					RenderingHints.VALUE_INTERPOLATION_BILINEAR);
			pen.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
			pen.drawImage(from, 0, 0, side, side, null);
		} finally {
			pen.dispose();
		}

		return to;
	}

	/** As JPEG, unless something in it can be seen through; then as PNG, which keeps that. */
	private static Cut written(BufferedImage small) throws IOException {
		if (seeThrough(small)) {
			return new Cut(encoded(drawn(small, SIDE, BufferedImage.TYPE_INT_ARGB), "png", null),
					"image/png");
		}

		ImageWriter jpeg = ImageIO.getImageWritersByFormatName("jpeg").next();
		ImageWriteParam squeeze = jpeg.getDefaultWriteParam();
		squeeze.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
		squeeze.setCompressionQuality(JPEG_QUALITY);
		jpeg.dispose();

		return new Cut(encoded(drawn(small, SIDE, BufferedImage.TYPE_INT_RGB), "jpeg", squeeze),
				"image/jpeg");
	}

	private static boolean seeThrough(BufferedImage small) {
		for (int pixel : small.getRGB(0, 0, SIDE, SIDE, null, 0, SIDE)) {
			if (pixel >>> 24 != 0xFF) {
				return true;
			}
		}

		return false;
	}

	/** In memory, never through the platform's temporary files. */
	private static byte[] encoded(BufferedImage image, String format, ImageWriteParam how)
			throws IOException {
		ImageWriter writer = ImageIO.getImageWritersByFormatName(format).next();
		ByteArrayOutputStream bytes = new ByteArrayOutputStream();

		try (ImageOutputStream out = new MemoryCacheImageOutputStream(bytes)) {
			writer.setOutput(out);
			writer.write(null, new IIOImage(image, null, null), how);
		} finally {
			writer.dispose();
		}

		return bytes.toByteArray();
	}

	private static final byte[] EXIF = { 'E', 'x', 'i', 'f', 0, 0 };

	/**
	 * Which of the eight EXIF orientations a JPEG asks to be shown in, 1 when it asks for none.
	 *
	 * <p>Walks the segments before the picture data, finds the one that says {@code Exif},
	 * and reads tag {@code 0x0112} out of its first directory. Anything it does not understand
	 * - a file cut short, a value outside one to eight, a segment where a marker should be - is
	 * „as stored", which is what a browser that cannot read the note does too.
	 */
	static int orientationOf(byte[] jpeg) {
		try {
			int at = 2;

			while ((jpeg[at] & 0xFF) == 0xFF) {
				int marker = jpeg[at + 1] & 0xFF;

				if (marker == 0xDA) {
					return 1;
				}

				if (marker == 0xE1 && Arrays.equals(jpeg, at + 4, at + 10, EXIF, 0, EXIF.length)) {
					return orientationIn(jpeg, at + 10);
				}

				at += 2 + sixteen(jpeg, at + 2, false);
			}

			return 1;
		} catch (ArrayIndexOutOfBoundsException cutShort) {
			return 1;
		}
	}

	private static int orientationIn(byte[] bytes, int tiff) {
		boolean little = bytes[tiff] == 'I';
		int directory = tiff + thirtyTwo(bytes, tiff + 4, little);
		int entries = sixteen(bytes, directory, little);

		for (int one = 0; one < entries; one++) {
			int entry = directory + 2 + 12 * one;

			if (sixteen(bytes, entry, little) == 0x0112) {
				int said = sixteen(bytes, entry + 8, little);
				return said >= 1 && said <= 8 ? said : 1;
			}
		}

		return 1;
	}

	private static int sixteen(byte[] bytes, int at, boolean little) {
		int first = bytes[at] & 0xFF;
		int second = bytes[at + 1] & 0xFF;
		return little ? second << 8 | first : first << 8 | second;
	}

	private static int thirtyTwo(byte[] bytes, int at, boolean little) {
		int high = sixteen(bytes, little ? at + 2 : at, little);
		int low = sixteen(bytes, little ? at : at + 2, little);
		return high << 16 | low;
	}
}
