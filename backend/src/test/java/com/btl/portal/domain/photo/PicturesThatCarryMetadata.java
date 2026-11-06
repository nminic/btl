package com.btl.portal.domain.photo;

import com.twelvemonkeys.imageio.plugins.webp.WebPImageReaderSpi;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.MemoryCacheImageInputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.zip.CRC32;

/**
 * REAL PICTURES OF THE THREE TYPES, WITH WHAT A TELEPHONE WRITES INTO THEM, built here and not carried as files.
 *
 * <p>The JPEG and the PNG are drawn and written by the platform, so the compressed picture inside is a real
 * one and a decoder can be asked whether cleaning changed a single pixel. The WebP is one of the pictures
 * {@code SmallPictureTest} carries (made once with Pillow, since the platform writes no WebP), in Base64 for
 * the reason given there: every file under {@code backend/src} is read as text by a floor.
 *
 * <p>The metadata is a TIFF structure with the two things the decision names that a test can look for in
 * the bytes: a description that says where and with what it was taken ({@link #WHERE_AND_WITH_WHAT}), and,
 * where asked, an orientation.
 */
public final class PicturesThatCarryMetadata {

	/** What a telephone writes about a photograph, as text a test can search the bytes for. */
	public static final String WHERE_AND_WITH_WHAT = "GPS 44.8125 N 20.4612 E, 2026:11:06 08:15, Pixel 8";

	/** Lossless, 400 by 300, no VP8X: a simple WebP, which cannot carry metadata at all. */
	public static final String SIMPLE_WEBP =
			"UklGRjYAAABXRUJQVlA4TCoAAAAvj8FKAA8Q87//8x8OFLVtxHTw53TM7ncEZkT/JyAvvEY13n+95/3/LQU=";

	/** Lossy with alpha, 400 by 300: VP8X, ALPH and VP8, which is the shape a WebP with EXIF has. */
	public static final String EXTENDED_WEBP =
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

	private PicturesThatCarryMetadata() {
	}

	/* ------------------------------------------------------------------------------------------------
	   THE NOTE
	   ------------------------------------------------------------------------------------------------ */

	/**
	 * A TIFF structure as a camera writes one, big-endian: a description ({@code 0x010E}) carrying
	 * {@link #WHERE_AND_WITH_WHAT} and, unless {@code turn} is 0, an orientation ({@code 0x0112}).
	 */
	public static byte[] tiff(int turn, boolean littleEndian) {
		byte[] said = (WHERE_AND_WITH_WHAT + "\0").getBytes(StandardCharsets.ISO_8859_1);
		int entries = turn == 0 ? 1 : 2;
		int valueAt = 8 + 2 + 12 * entries + 4;
		Out out = new Out(littleEndian);
		out.raw(littleEndian ? new byte[] { 'I', 'I' } : new byte[] { 'M', 'M' });
		out.sixteen(42);
		out.thirtyTwo(8);
		out.sixteen(entries);
		out.sixteen(0x010E);
		out.sixteen(2);
		out.thirtyTwo(said.length);
		out.thirtyTwo(valueAt);

		if (turn != 0) {
			out.sixteen(0x0112);
			out.sixteen(3);
			out.thirtyTwo(1);
			out.sixteen(turn);
			out.sixteen(0);
		}

		out.thirtyTwo(0);
		out.raw(said);
		return out.bytes();
	}

	/* ------------------------------------------------------------------------------------------------
	   JPEG
	   ------------------------------------------------------------------------------------------------ */

	/** A drawing that is different in every corner, so a picture turned the wrong way is not the same picture. */
	public static BufferedImage drawing(int width, int height) {
		BufferedImage image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);

		for (int y = 0; y < height; y++) {
			for (int x = 0; x < width; x++) {
				image.setRGB(x, y, (x * 255 / width) << 16 | (y * 255 / height) << 8 | (x < width / 4 ? 200 : 20));
			}
		}

		return image;
	}

	/** The drawing as the platform writes a JPEG, baseline or progressive. */
	public static byte[] jpeg(boolean progressive) {
		ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
		ImageWriteParam param = writer.getDefaultWriteParam();

		if (progressive) {
			param.setProgressiveMode(ImageWriteParam.MODE_DEFAULT);
		}

		ByteArrayOutputStream bytes = new ByteArrayOutputStream();

		try (MemoryCacheImageOutputStream out = new MemoryCacheImageOutputStream(bytes)) {
			writer.setOutput(out);
			writer.write(null, new IIOImage(drawing(64, 48), null, null), param);
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		} finally {
			writer.dispose();
		}

		return bytes.toByteArray();
	}

	/** One JPEG segment: its marker, its length, its payload. */
	public static byte[] segment(int marker, byte[] payload) {
		Out out = new Out(false);
		out.raw(new byte[] { (byte) 0xFF, (byte) marker });
		out.sixteen(payload.length + 2);
		out.raw(payload);
		return out.bytes();
	}

	/** An EXIF segment as a telephone writes it. */
	public static byte[] exifSegment(int turn) {
		return segment(0xE1, concat(new byte[] { 'E', 'x', 'i', 'f', 0, 0 }, tiff(turn, false)));
	}

	/** An XMP segment carrying the same sentence. */
	public static byte[] xmpSegment() {
		return segment(0xE1, ("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>" + WHERE_AND_WITH_WHAT + "</x:xmpmeta>")
				.getBytes(StandardCharsets.ISO_8859_1));
	}

	/** The segments put right after the start of the picture, in this order. */
	public static byte[] withSegments(byte[] jpeg, byte[]... segments) {
		return concat(Arrays.copyOf(jpeg, 2), concat(segments), Arrays.copyOfRange(jpeg, 2, jpeg.length));
	}

	/** A JPEG from a telephone: EXIF with the place and the orientation, XMP, a comment, and a video after it. */
	public static byte[] aTelephoneJpeg(int turn) {
		return concat(withSegments(jpeg(false), exifSegment(turn), xmpSegment(),
				segment(0xFE, WHERE_AND_WITH_WHAT.getBytes(StandardCharsets.ISO_8859_1))),
				("ftypmp42 " + WHERE_AND_WITH_WHAT).getBytes(StandardCharsets.ISO_8859_1));
	}

	/* ------------------------------------------------------------------------------------------------
	   PNG
	   ------------------------------------------------------------------------------------------------ */

	/** The drawing as the platform writes a PNG. */
	public static byte[] png() {
		ByteArrayOutputStream bytes = new ByteArrayOutputStream();

		try {
			ImageIO.write(drawing(40, 30), "png", bytes);
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}

		return bytes.toByteArray();
	}

	/** One PNG chunk with its CRC. */
	public static byte[] chunk(String type, byte[] data) {
		byte[] name = type.getBytes(StandardCharsets.ISO_8859_1);
		CRC32 crc = new CRC32();
		crc.update(name);
		crc.update(data);
		Out out = new Out(false);
		out.thirtyTwo(data.length);
		out.raw(name);
		out.raw(data);
		out.thirtyTwo((int) crc.getValue());
		return out.bytes();
	}

	/** The chunks put right after {@code IHDR}, which is always the first 33 bytes. */
	public static byte[] withChunks(byte[] png, byte[]... chunks) {
		return concat(Arrays.copyOf(png, 33), concat(chunks), Arrays.copyOfRange(png, 33, png.length));
	}

	/** Every text chunk a PNG can carry, the EXIF chunk, the time, the density and a private chunk, and a tail. */
	public static byte[] aPngThatSaysEverything(int turn) {
		byte[] said = WHERE_AND_WITH_WHAT.getBytes(StandardCharsets.ISO_8859_1);
		return concat(withChunks(png(),
				chunk("tEXt", concat("Comment\0".getBytes(StandardCharsets.ISO_8859_1), said)),
				chunk("iTXt", concat("XML:com.adobe.xmp\0\0\0\0\0".getBytes(StandardCharsets.ISO_8859_1), said)),
				chunk("zTXt", concat("Author\0\0".getBytes(StandardCharsets.ISO_8859_1), said)),
				chunk("eXIf", tiff(turn, true)),
				chunk("tIME", new byte[] { 0x07, (byte) 0xEA, 11, 6, 8, 15, 0 }),
				chunk("pHYs", new byte[] { 0, 0, 0x0B, 0x13, 0, 0, 0x0B, 0x13, 1 }),
				chunk("gAMA", new byte[] { 0, 0, (byte) 0xB1, (byte) 0x8F }),
				chunk("prVt", said)), said);
	}

	/** The type of every chunk, in order. */
	public static List<String> chunksOf(byte[] png) {
		List<String> types = new ArrayList<>();
		int at = 8;

		while (at + 12 <= png.length) {
			int length = (png[at] & 0xFF) << 24 | (png[at + 1] & 0xFF) << 16 | (png[at + 2] & 0xFF) << 8
					| png[at + 3] & 0xFF;
			types.add(new String(png, at + 4, 4, StandardCharsets.ISO_8859_1));
			at += 12 + length;
		}

		return types;
	}

	/* ------------------------------------------------------------------------------------------------
	   WEBP
	   ------------------------------------------------------------------------------------------------ */

	public static byte[] webp(String base64) {
		return Base64.getDecoder().decode(base64);
	}

	/** One RIFF chunk, padded to an even length. */
	public static byte[] riffChunk(String type, byte[] data) {
		Out out = new Out(true);
		out.raw(type.getBytes(StandardCharsets.ISO_8859_1));
		out.thirtyTwo(data.length);
		out.raw(data);

		if (data.length % 2 == 1) {
			out.raw(new byte[] { 0 });
		}

		return out.bytes();
	}

	/** The chunks of a WebP after its header, with the RIFF size and, where asked, VP8X flags rewritten. */
	public static byte[] webpOf(byte[] header, int flagsToSet, byte[]... chunks) {
		byte[] body = concat(chunks);

		if (flagsToSet != 0) {
			body[8] = (byte) (body[8] | flagsToSet);
		}

		Out out = new Out(true);
		out.raw("RIFF".getBytes(StandardCharsets.ISO_8859_1));
		out.thirtyTwo(body.length + 4);
		out.raw(Arrays.copyOfRange(header, 8, 12));
		out.raw(body);
		return out.bytes();
	}

	/** The chunks of a WebP after its twelve byte header, each whole. */
	public static List<byte[]> riffChunksOf(byte[] webp) {
		List<byte[]> chunks = new ArrayList<>();
		int at = 12;

		while (at + 8 <= webp.length) {
			int size = (webp[at + 4] & 0xFF) | (webp[at + 5] & 0xFF) << 8 | (webp[at + 6] & 0xFF) << 16
					| (webp[at + 7] & 0xFF) << 24;
			int end = Math.min(webp.length, at + 8 + size + (size & 1));
			chunks.add(Arrays.copyOfRange(webp, at, end));
			at = end;
		}

		return chunks;
	}

	public static String typeOf(byte[] riffChunk) {
		return new String(riffChunk, 0, 4, StandardCharsets.ISO_8859_1);
	}

	/** An extended WebP from a telephone: EXIF with the place and the orientation, XMP, and a chunk nobody knows. */
	public static byte[] aTelephoneWebp(int turn) {
		byte[] webp = webp(EXTENDED_WEBP);
		List<byte[]> chunks = riffChunksOf(webp);
		byte[] said = WHERE_AND_WITH_WHAT.getBytes(StandardCharsets.ISO_8859_1);
		List<byte[]> all = new ArrayList<>(chunks);
		all.add(riffChunk("EXIF", tiff(turn, false)));
		all.add(riffChunk("XMP ", said));
		all.add(riffChunk("prVt", said));
		return webpOf(webp, 0x08 | 0x04, all.toArray(byte[][]::new));
	}

	/* ------------------------------------------------------------------------------------------------
	   READING BACK
	   ------------------------------------------------------------------------------------------------ */

	/** The pixels of a picture of any of the three types, as a decoder gives them. */
	public static int[] pixelsOf(byte[] picture, String mediaType) {
		try {
			ImageReader reader = "image/webp".equals(mediaType) ? new WebPImageReaderSpi().createReaderInstance()
					: ImageIO.getImageReadersByMIMEType(mediaType).next();

			try (ImageInputStream in = new MemoryCacheImageInputStream(new ByteArrayInputStream(picture))) {
				reader.setInput(in, true, true);
				BufferedImage image = reader.read(0);
				return image.getRGB(0, 0, image.getWidth(), image.getHeight(), null, 0, image.getWidth());
			} finally {
				reader.dispose();
			}
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	public static boolean says(byte[] picture, String what) {
		return new String(picture, StandardCharsets.ISO_8859_1).contains(what);
	}

	public static byte[] concat(byte[]... parts) {
		ByteArrayOutputStream out = new ByteArrayOutputStream();

		for (byte[] part : parts) {
			out.writeBytes(part);
		}

		return out.toByteArray();
	}

	private static final class Out {

		private final ByteArrayOutputStream bytes = new ByteArrayOutputStream();

		private final boolean little;

		Out(boolean little) {
			this.little = little;
		}

		void raw(byte[] some) {
			bytes.writeBytes(some);
		}

		void sixteen(int value) {
			if (little) {
				bytes.write(value);
				bytes.write(value >>> 8);
			} else {
				bytes.write(value >>> 8);
				bytes.write(value);
			}
		}

		void thirtyTwo(int value) {
			if (little) {
				sixteen(value & 0xFFFF);
				sixteen(value >>> 16);
			} else {
				sixteen(value >>> 16);
				sixteen(value & 0xFFFF);
			}
		}

		byte[] bytes() {
			return bytes.toByteArray();
		}
	}
}
