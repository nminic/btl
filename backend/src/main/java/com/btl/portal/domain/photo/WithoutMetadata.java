package com.btl.portal.domain.photo;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Set;
import java.util.zip.CRC32;

/**
 * A PICTURE WITH EVERYTHING THE CAMERA WROTE ABOUT IT TAKEN OFF, AND THE WAY IT ASKS TO BE TURNED KEPT.
 *
 * <p><b>ADL, owner, 06.11.2026, chosen among the outcomes offered, with my recommendation</b>: „Server pri
 * svakom otpremanju slike (član i administracija) skida sve metapodatke (EXIF, uključujući GPS, datum i
 * model uređaja) pre upisa, a pravilnu orijentaciju zadržava; postojeće slike na produkciji se jednom
 * očiste." The reason given: pictures are served in the open with the place they were taken in, and the
 * league has members under age.
 *
 * <p><b>THE ORIENTATION IS KEPT AS A NOTE AND NOT BURNT INTO THE PIXELS, and that is my choice, for four
 * measured reasons.</b> (1) Nothing on the class path can WRITE a WebP (the TwelveMonkeys plugin only
 * reads), so turning the pixels of one of the three types would need a dependency the portal does not have.
 * (2) Turning a JPEG means decoding and encoding it again, which loses quality every time; taking segments
 * out loses nothing, because the compressed picture is copied byte for byte. (3) The circle a member chose
 * was chosen over the picture as the browser SHOWED it ({@link SmallPicture}, ADL 23.10.2026), and the note
 * is what made the browser show it that way; with the note kept, the picture is shown exactly as before and
 * the three fractions keep meaning what they meant. (4) Whatever a browser did with the note before, it does
 * after, for all three types, because the note is the only thing that turned it. So what is left is a TIFF
 * structure of {@value #A_NOTE_OF_ONE_TAG} bytes holding one tag, {@code 0x0112}, and nothing else; and none
 * at all for a picture that asks to be shown as stored.
 *
 * <p><b>WHAT IS KEPT, BY FORMAT, AND IT IS A LIST OF WHAT DRAWS THE PICTURE.</b> Everything not on it goes.
 * <ul>
 * <li>JPEG: every segment that is not an application segment or a comment (the frame, the tables, the
 * scans, the restart interval), and of the application segments only {@code APP2 ICC_PROFILE} and
 * {@code APP14 Adobe}: the first says what the colours mean and the second how three channels are to be
 * read, and without either a photograph changes colour. Gone: {@code APP0} (JFIF and its thumbnail),
 * {@code APP1} (EXIF, with GPS, the date and the device, and XMP), every other {@code APPn}, {@code COM},
 * and anything after the end of the picture, which is where some telephones put a second picture or a
 * video ({@code MPF}, motion photos).
 * <li>PNG: the critical chunks, and of the ancillary ones only those that change how pixels are drawn
 * ({@link #PNG_DRAWING}). Gone: {@code tEXt}, {@code zTXt}, {@code iTXt}, {@code eXIf}, {@code tIME},
 * {@code pHYs} and every chunk nobody here knows, and anything after {@code IEND}.
 * <li>WebP: the chunks that draw ({@link #WEBP_DRAWING}). Gone: {@code EXIF}, {@code XMP } and every chunk
 * nobody here knows, and anything past the size the RIFF header declares. The {@code VP8X} flags are
 * rewritten to say what is still there.
 * </ul>
 *
 * <p><b>THE ICC PROFILE IS KEPT, AND THAT IS THE OWNER'S WORD</b> (ADL, 06.11.2026, added to the decision
 * above, chosen with my recommendation): „Profil boja (ICC) se zadržava", because without it the colours of
 * a photograph move, and what it can say about anybody is at most the maker of a screen. Offered and not
 * chosen: take the profile off too.
 *
 * <p><b>A FILE WHOSE STRUCTURE CANNOT BE FOLLOWED TO ITS END IS CLEANED AS FAR AS IT CAN BE, AND THE REST IS
 * KEPT AS IT CAME.</b> {@link WhatAPictureIs#sniff} reads three or twelve bytes and decodes nothing, so a
 * file that begins like a picture and is something else after that is a file this receives. What it does
 * with one is walk segments or chunks while their lengths fit; where one does not, the bytes from there on
 * are copied untouched. That is a boundary and is said as one: metadata past such a break stays. A camera
 * does not write a broken file, so the metadata the decision is about is in front of any break; and a
 * refusal of such files would be a new rule about what a picture is, which nobody decided.
 *
 * <p><b>WHAT CAME IN IS WHAT GOES OUT WHEN THERE WAS NOTHING TO TAKE</b>, the same array, not a copy. And
 * the work is IDEMPOTENT: a picture this has already cleaned comes out byte for byte the same, which is what
 * lets the one time clean up of the pictures already stored ({@code OldPicturesAreCleaned}) run at every
 * start without moving anything twice.
 *
 * <p>A domain class, no Spring and no database, for the reason {@link WhatAPictureIs} gives.
 */
public final class WithoutMetadata {

	/** The length of the one-tag TIFF note: header 8, entry count 2, one entry 12, next directory 4. */
	static final int A_NOTE_OF_ONE_TAG = 26;

	private static final byte[] EXIF_HEADER = { 'E', 'x', 'i', 'f', 0, 0 };

	private static final byte[] ICC_PROFILE = "ICC_PROFILE\0".getBytes(StandardCharsets.ISO_8859_1);

	private static final byte[] ADOBE = "Adobe".getBytes(StandardCharsets.ISO_8859_1);

	/**
	 * The ancillary PNG chunks that change how the pixels are drawn: transparency, the four ways of saying
	 * what a colour is, the significant bits, the HDR trio, and the three of an animated PNG. Ancillary
	 * chunks only; a CRITICAL chunk (its first letter upper case) is kept whatever it is, because a decoder
	 * that does not know one must refuse the file, so none of them can be a note on the side.
	 */
	static final Set<String> PNG_DRAWING = Set.of("tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "cICP",
			"mDCV", "cLLI", "acTL", "fcTL", "fdAT");

	/** The WebP chunks that draw: the extended header, the colour profile, animation, alpha, and the image. */
	static final Set<String> WEBP_DRAWING = Set.of("VP8X", "ICCP", "ANIM", "ANMF", "ALPH", "VP8 ", "VP8L");

	/** {@code VP8X} flags: an EXIF chunk is present, an XMP chunk is present. */
	private static final int WEBP_HAS_EXIF = 0x08;

	private static final int WEBP_HAS_XMP = 0x04;

	private WithoutMetadata() {
	}

	/**
	 * The picture with its metadata taken off.
	 *
	 * @param picture   the whole file, of the type below
	 * @param mediaType one of {@link WhatAPictureIs#THE_TYPES_THE_SCHEMA_ALLOWS}, as {@link WhatAPictureIs#sniff}
	 *                  decided it
	 * @return the cleaned bytes, or {@code picture} itself where there was nothing to take
	 */
	public static byte[] of(byte[] picture, String mediaType) {
		return switch (mediaType) {
			case "image/jpeg" -> jpeg(picture);
			case "image/png" -> png(picture);
			case "image/webp" -> webp(picture);
			default -> throw new IllegalArgumentException(mediaType + " is not a type the schema holds");
		};
	}

	/* ------------------------------------------------------------------------------------------------
	   JPEG
	   ------------------------------------------------------------------------------------------------ */

	private static byte[] jpeg(byte[] in) {
		int turn = SmallPicture.orientationOf(in);
		ByteArrayOutputStream out = new ByteArrayOutputStream(in.length);
		out.write(in, 0, 2);

		if (turn != 1) {
			byte[] note = noteOf(turn);
			out.write(0xFF);
			out.write(0xE1);
			writeSixteen(out, 2 + EXIF_HEADER.length + note.length);
			out.write(EXIF_HEADER, 0, EXIF_HEADER.length);
			out.write(note, 0, note.length);
		}

		int at = 2;

		while (at + 1 < in.length && (in[at] & 0xFF) == 0xFF) {
			int marker = in[at + 1] & 0xFF;

			if (marker == 0xD9) {
				/* AND WHAT FOLLOWS THE END OF THE PICTURE IS NOT PART OF IT: a second picture, a video. */
				out.write(in, at, 2);
				return theSameWhereNothingChanged(in, out);
			}

			if (marker == 0xFF || marker == 0x01 || marker >= 0xD0 && marker <= 0xD8) {
				/* A fill byte or a marker that carries no length. */
				int step = marker == 0xFF ? 1 : 2;
				out.write(in, at, step);
				at += step;
				continue;
			}

			if (at + 4 > in.length) {
				break;
			}

			int length = sixteen(in, at + 2);
			int end = at + 2 + length;

			if (length < 2 || end > in.length) {
				break;
			}

			if (!isMetadata(in, at, marker, length)) {
				out.write(in, at, end - at);
			}

			at = end;

			if (marker == 0xDA) {
				at = theScanFrom(in, at, out);
			}
		}

		/* WHERE THE STRUCTURE COULD NOT BE FOLLOWED, the rest as it came (see the class note). */
		out.write(in, at, in.length - at);
		return theSameWhereNothingChanged(in, out);
	}

	/**
	 * The compressed data of one scan, copied, up to the next marker. Inside it {@code FF 00} is a byte of
	 * data, {@code FF D0} to {@code FF D7} a restart, and {@code FF FF} a fill; anything else after an
	 * {@code FF} is the next marker, which may be another scan's tables, an application segment between the
	 * scans of a progressive picture, or the end.
	 *
	 * @return where the next marker is, or the end of the file
	 */
	private static int theScanFrom(byte[] in, int from, ByteArrayOutputStream out) {
		int at = from;

		while (at < in.length) {
			if ((in[at] & 0xFF) == 0xFF && at + 1 < in.length) {
				int next = in[at + 1] & 0xFF;

				if (next != 0x00 && next != 0xFF && (next < 0xD0 || next > 0xD7)) {
					break;
				}

				at += next == 0xFF ? 1 : 2;
			} else {
				at++;
			}
		}

		out.write(in, from, at - from);
		return at;
	}

	/** An application segment or a comment, except the two that say what the colours are. */
	private static boolean isMetadata(byte[] in, int at, int marker, int length) {
		if (marker == 0xFE) {
			return true;
		}

		if (marker < 0xE0 || marker > 0xEF) {
			return false;
		}

		int data = at + 4;
		int size = length - 2;

		return !(marker == 0xE2 && startsWith(in, data, size, ICC_PROFILE)
				|| marker == 0xEE && startsWith(in, data, size, ADOBE));
	}

	/* ------------------------------------------------------------------------------------------------
	   PNG
	   ------------------------------------------------------------------------------------------------ */

	private static byte[] png(byte[] in) {
		int turn = pngOrientation(in);
		ByteArrayOutputStream out = new ByteArrayOutputStream(in.length);
		out.write(in, 0, 8);

		int at = 8;

		while (at + 12 <= in.length) {
			long length = thirtyTwo(in, at);

			if (length > in.length - at - 12L) {
				break;
			}

			int end = at + 12 + (int) length;
			String type = new String(in, at + 4, 4, StandardCharsets.ISO_8859_1);

			if (isCritical(in[at + 4]) || PNG_DRAWING.contains(type)) {
				out.write(in, at, end - at);
			}

			at = end;

			if ("IHDR".equals(type) && turn != 1) {
				/* RIGHT AFTER THE HEADER, which is before any image data, where every reader looks. */
				pngChunk(out, "eXIf", noteOf(turn));
			}

			if ("IEND".equals(type)) {
				/* And what follows the end is not part of the picture. */
				return theSameWhereNothingChanged(in, out);
			}
		}

		out.write(in, at, in.length - at);
		return theSameWhereNothingChanged(in, out);
	}

	/** The orientation an {@code eXIf} chunk asks for, the first one, 1 where there is none. */
	private static int pngOrientation(byte[] in) {
		int at = 8;

		while (at + 12 <= in.length) {
			long length = thirtyTwo(in, at);

			if (length > in.length - at - 12L) {
				return 1;
			}

			if (startsWith(in, at + 4, 4, "eXIf".getBytes(StandardCharsets.ISO_8859_1))) {
				return orientationOfTheNote(Arrays.copyOfRange(in, at + 8, at + 8 + (int) length));
			}

			at += 12 + (int) length;
		}

		return 1;
	}

	/** A chunk's type whose first letter is upper case is critical (bit 5 of the first byte is clear). */
	private static boolean isCritical(byte first) {
		return (first & 0x20) == 0;
	}

	private static void pngChunk(ByteArrayOutputStream out, String type, byte[] data) {
		byte[] name = type.getBytes(StandardCharsets.ISO_8859_1);
		writeThirtyTwo(out, data.length);
		out.write(name, 0, 4);
		out.write(data, 0, data.length);

		CRC32 crc = new CRC32();
		crc.update(name);
		crc.update(data);
		writeThirtyTwo(out, crc.getValue());
	}

	/* ------------------------------------------------------------------------------------------------
	   WEBP
	   ------------------------------------------------------------------------------------------------ */

	private static byte[] webp(byte[] in) {
		/* WHAT THE RIFF HEADER SAYS THE FILE IS, and bytes past that are not part of it. A size that says
		   more than there is, or less than the header itself, leaves the file as long as it is. */
		long declared = littleThirtyTwo(in, 4);
		int limit = declared >= 4 && declared + 8 <= in.length ? (int) declared + 8 : in.length;
		/* EXTENDED: the first chunk is a `VP8X` of its one legal size, ten bytes, so its flags are the byte at
		   offset 20 and stay at offset 8 of what is written after the header. */
		boolean extended = limit >= 30 && startsWith(in, 12, 4, "VP8X".getBytes(StandardCharsets.ISO_8859_1))
				&& littleThirtyTwo(in, 16) == 10;

		ByteArrayOutputStream chunks = new ByteArrayOutputStream(in.length);
		int turn = 1;
		boolean read = false;
		int at = 12;

		while (at + 8 <= limit) {
			long size = littleThirtyTwo(in, at + 4);

			if (size > limit - at - 8L) {
				break;
			}

			int next = (int) Math.min(limit, at + 8 + size + (size & 1));
			String type = new String(in, at, 4, StandardCharsets.ISO_8859_1);

			if ("EXIF".equals(type) && !read) {
				turn = orientationOfAWebpNote(Arrays.copyOfRange(in, at + 8, at + 8 + (int) size));
				read = true;
			}

			if (WEBP_DRAWING.contains(type)) {
				chunks.write(in, at, next - at);
			}

			at = next;
		}

		/* WHERE THE STRUCTURE COULD NOT BE FOLLOWED, the rest as it came (see the class note). */
		chunks.write(in, at, limit - at);

		/* THE NOTE GOES ONLY WHERE A READER LOOKS FOR ONE: an extended file, after the image, as the format
		   orders it. A simple file cannot carry EXIF at all, so a note in one was never read by anybody. */
		boolean noted = extended && turn != 1 && at == limit;

		if (noted) {
			byte[] note = noteOf(turn);
			chunks.write('E');
			chunks.write('X');
			chunks.write('I');
			chunks.write('F');
			writeLittleThirtyTwo(chunks, note.length);
			chunks.write(note, 0, note.length);
		}

		byte[] body = chunks.toByteArray();

		if (extended) {
			int was = body[8] & 0xFF;
			body[8] = (byte) (was & ~(WEBP_HAS_EXIF | WEBP_HAS_XMP) | (noted ? WEBP_HAS_EXIF : 0));
		}

		ByteArrayOutputStream out = new ByteArrayOutputStream(body.length + 12);
		out.write(in, 0, 4);
		writeLittleThirtyTwo(out, body.length + 4L);
		out.write(in, 8, 4);
		out.write(body, 0, body.length);
		return theSameWhereNothingChanged(in, out);
	}

	/**
	 * What was made, or the very array that came in where the two are byte for byte the same. Asked of the
	 * bytes and not kept as a flag of what was taken on the way, because a flag has to be right about every
	 * road through the walk and the comparison cannot be wrong about any of them.
	 */
	private static byte[] theSameWhereNothingChanged(byte[] in, ByteArrayOutputStream out) {
		byte[] made = out.toByteArray();
		return Arrays.equals(made, in) ? in : made;
	}

	/** A WebP's EXIF payload is a TIFF structure, and some writers put {@code Exif\0\0} in front of it. */
	private static int orientationOfAWebpNote(byte[] payload) {
		boolean headed = startsWith(payload, 0, payload.length, EXIF_HEADER);
		return orientationOfTheNote(headed ? Arrays.copyOfRange(payload, EXIF_HEADER.length, payload.length)
				: payload);
	}

	/* ------------------------------------------------------------------------------------------------
	   THE NOTE
	   ------------------------------------------------------------------------------------------------ */

	/** What a TIFF structure on its own asks for, read by {@link SmallPicture}'s reader. */
	private static int orientationOfTheNote(byte[] tiff) {
		try {
			return SmallPicture.orientationIn(tiff, 0);
		} catch (ArrayIndexOutOfBoundsException cutShort) {
			return 1;
		}
	}

	/**
	 * A TIFF structure that says one thing: turn me this way. Big-endian, one directory, one entry,
	 * {@code 0x0112} of type SHORT and count 1, and no next directory.
	 */
	static byte[] noteOf(int turn) {
		return new byte[] { 'M', 'M', 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, (byte) turn, 0,
				0, 0, 0, 0, 0 };
	}

	/* ------------------------------------------------------------------------------------------------
	   BYTES
	   ------------------------------------------------------------------------------------------------ */

	private static boolean startsWith(byte[] in, int at, int room, byte[] prefix) {
		return room >= prefix.length
				&& Arrays.equals(in, at, at + prefix.length, prefix, 0, prefix.length);
	}

	private static int sixteen(byte[] in, int at) {
		return (in[at] & 0xFF) << 8 | in[at + 1] & 0xFF;
	}

	private static long thirtyTwo(byte[] in, int at) {
		return (long) sixteen(in, at) << 16 | sixteen(in, at + 2);
	}

	private static long littleThirtyTwo(byte[] in, int at) {
		return (in[at] & 0xFFL) | (in[at + 1] & 0xFFL) << 8 | (in[at + 2] & 0xFFL) << 16 | (in[at + 3] & 0xFFL) << 24;
	}

	private static void writeSixteen(ByteArrayOutputStream out, int value) {
		out.write(value >>> 8);
		out.write(value);
	}

	private static void writeThirtyTwo(ByteArrayOutputStream out, long value) {
		writeSixteen(out, (int) (value >>> 16) & 0xFFFF);
		writeSixteen(out, (int) value & 0xFFFF);
	}

	private static void writeLittleThirtyTwo(ByteArrayOutputStream out, long value) {
		out.write((int) value);
		out.write((int) (value >>> 8));
		out.write((int) (value >>> 16));
		out.write((int) (value >>> 24));
	}
}
