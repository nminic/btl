package com.btl.portal.domain.photo;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.zip.CRC32;

/**
 * PICTURES THAT SAY HOW LARGE THEY ARE AND CARRY NOTHING ELSE, for the ceiling the cut has and the doors a
 * picture comes in by ask of it ({@link SmallPicture#isLargerThanItCuts}).
 *
 * <p>Headers and no pixels, on purpose: a picture of twenty five million pixels is a hundred megabytes of
 * heap to make, and the question is answered by the header alone, so a header is the honest fixture. Each
 * of them is read by the platform's own reader for its type (a JPEG needs its {@code SOS} marker for that,
 * measured: without it the reader says „missing SOS marker"), so a ceiling crossed here is crossed by what
 * the reader reports and not by a file the reader refuses.
 *
 * <p>Public, because the three routes' tests are in another package and send the same bytes.
 */
public final class PicturesOfASize {

	private PicturesOfASize() {
	}

	/** A PNG of only its signature and its {@code IHDR}. */
	public static byte[] png(int width, int height) {
		byte[] header = ByteBuffer.allocate(17).put("IHDR".getBytes(StandardCharsets.ISO_8859_1))
				.putInt(width).putInt(height).put((byte) 8).put((byte) 2).put((byte) 0)
				.put((byte) 0).put((byte) 0).array();
		CRC32 crc = new CRC32();
		crc.update(header);
		return ByteBuffer.allocate(8 + 4 + 17 + 4)
				.put(new byte[] { (byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A })
				.putInt(13).put(header).putInt((int) crc.getValue()).array();
	}

	/** A JPEG of only its start, its frame ({@code SOF0}, three components) and the start of its scan. */
	public static byte[] jpeg(int width, int height) {
		ByteBuffer bytes = ByteBuffer.allocate(2 + 19 + 14);

		bytes.put((byte) 0xFF).put((byte) 0xD8);
		bytes.put((byte) 0xFF).put((byte) 0xC0).putShort((short) 17).put((byte) 8)
				.putShort((short) height).putShort((short) width).put((byte) 3);

		for (int component = 1; component <= 3; component++) {
			bytes.put((byte) component).put((byte) 0x11).put((byte) 0);
		}

		bytes.put((byte) 0xFF).put((byte) 0xDA).putShort((short) 12).put((byte) 3);

		for (int component = 1; component <= 3; component++) {
			bytes.put((byte) component).put((byte) 0);
		}

		return bytes.put((byte) 0).put((byte) 63).put((byte) 0).array();
	}

	/** A real WebP of 2001 by 2000, one row over its ceiling of four million. */
	public static byte[] webpOverItsCeiling() {
		return SmallPictureTest.resource("too-many-pixels.webp");
	}

	/** A real WebP well under its ceiling, which the cut takes. */
	public static byte[] webpUnderItsCeiling() {
		return SmallPictureTest.resource("marked.webp");
	}
}
