package com.btl.portal.domain.photo;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Set;
import java.util.zip.CRC32;
import java.util.zip.DataFormatException;
import java.util.zip.Inflater;

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
 * video ({@code MPF}, motion photos), and bytes between segments that are not part of any.
 * <li>PNG: the four critical chunks ({@link #PNG_CRITICAL}), and of the others only those that change how
 * pixels are drawn ({@link #PNG_DRAWING}). Gone: {@code tEXt}, {@code zTXt}, {@code iTXt}, {@code eXIf},
 * {@code tIME}, {@code pHYs} and every chunk nobody here knows, whatever its first letter, and anything
 * after {@code IEND}; {@code IEND} is written with length 0 whatever length the file gave it, and
 * {@code IDAT} is kept exactly to the end of its zlib stream (through all the IDAT chunks), so text a length
 * claims into is gone too.
 * <li>WebP: the chunks that draw ({@link #WEBP_DRAWING}). Gone: {@code EXIF}, {@code XMP } and every chunk
 * nobody here knows, and anything past the size the RIFF header declares. The {@code VP8X} flags are
 * rewritten to say what is still there. <b>Text inside an image chunk whose size claims more than the
 * image takes stays</b>, see the boundary below.
 * </ul>
 *
 * <p><b>THE ICC PROFILE IS KEPT, AND THAT IS THE OWNER'S WORD</b> (ADL, 06.11.2026, added to the decision
 * above, chosen with my recommendation): „Profil boja (ICC) se zadržava", because without it the colours of
 * a photograph move, and what it can say about anybody is at most the maker of a screen. Offered and not
 * chosen: take the profile off too.
 *
 * <p><b>A FILE WHOSE STRUCTURE BREAKS IS CLEANED PAST THE BREAK, AS A VIEWER READS IT</b> (ADL, owner,
 * 07.11.2026, chosen among the outcomes offered, with my recommendation): „Kad fajl na jednom mestu ne prati
 * očekivanu strukturu (suvišan bajt, pokvaren segment), čišćenje ne staje nego nastavlja kao pregledač:
 * preskoči pokvareno mesto i skida metapodatke i iza njega; slika se prima i čista je." Offered and not
 * chosen: refuse such a file; leave it and write the boundary down. {@link WhatAPictureIs#sniff} reads three
 * or twelve bytes and decodes nothing, so a file that begins like a picture and is something else after that is
 * a file this receives, and the first version of this class copied everything from the first break on, which
 * kept the GPS of a picture one stray byte had been put in front of while the picture was still shown.
 * What „as a viewer" means here is MY reading of the decision and not a recorded one:
 * <ul>
 * <li>JPEG: bytes that are not a marker are skipped until the next {@code FF xx} with {@code xx} not 00, which
 * is how a decoder finds the next segment, between all segments and not only in front of the first. A
 * segment whose length is under two is dropped as a marker and the search goes on; a segment that runs past
 * the end of the file is the rest of the file, as it is to a decoder, and is kept as far as it goes only if it
 * is one that draws.
 * <li>PNG and WebP carry nothing to find the next block by, so a block whose size runs past the end of the file
 * is the rest of the file, kept as far as it goes only if it draws (a picture cut in its data is shown as far
 * as it goes), and bytes too few to be a block are dropped. The one exception to „kept as far as it goes" is
 * PNG image data, which ends where its zlib stream ends (ADL, owner, 07.11.2026, „Blok slike čija dužina
 * prebaci stvarne podatke": „Kod PNG-a IEND se piše kanonski (dužina 0), a IDAT se zadržava tačno do kraja
 * svog toka, pa tekst iza njega ne ostaje.").
 * </ul>
 * <b>WebP IS A RECORDED BOUNDARY AND NOT AN OVERSIGHT</b> (the same decision): „Kod WebP-a se kraj slike
 * unutar bloka ne može pouzdano odrediti, pa tekst iza „prebačenog" bloka slike ostaje; takav fajl ne pravi
 * nijedan telefon ni program, nego samo neko ručno, i to sam vlasnik slike sa sopstvenim podacima." So a
 * {@code VP8 }, {@code VP8L}, {@code ALPH} or {@code ANMF} chunk whose size covers text after the picture keeps
 * that text, and a case says so.
 * What a break swallows from a decoder's side is swallowed here: a JPEG segment one byte too long takes the
 * first byte of the marker after it, and the bytes up to the next marker are skipped, so what is lost there is
 * lost to the viewer as well. <b>The boundary that is left, said as one:</b> bytes skipped on the way to a
 * marker are never copied, but a marker that is only FOUND inside skipped bytes (an {@code FF xx} inside the
 * content of a segment that swallowed a marker) is read as a marker, and a segment that is not metadata is
 * kept; the content of such a segment is what a decoder would have read too, and it is not EXIF.
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
	 * chunks only. The critical ones are {@link #PNG_CRITICAL}, four; a chunk with another name is dropped
	 * even when its first letter is upper case. (Until 07.11.2026 every such chunk was kept on the ground
	 * that a decoder must refuse the file for one, so it could not be a note on the side. That was wrong
	 * twice: the file is stored and served whether or not a viewer can show it, and the chunk is where
	 * a writer can put anything, GPS included, in a name that sounds critical.)
	 */
	static final Set<String> PNG_DRAWING = Set.of("tRNS", "gAMA", "cHRM", "sRGB", "iCCP", "sBIT", "cICP",
			"mDCV", "cLLI", "acTL", "fcTL", "fdAT");

	/** The four chunks the PNG format itself calls critical; any other critical-looking name is nobody's. */
	static final Set<String> PNG_CRITICAL = Set.of("IHDR", "PLTE", "IDAT", "IEND");

	/** The WebP chunks that draw: the extended header, the colour profile, animation, alpha, and the image. */
	static final Set<String> WEBP_DRAWING = Set.of("VP8X", "ICCP", "ANIM", "ANMF", "ALPH", "VP8 ", "VP8L");

	/** {@code VP8X} flags: an EXIF chunk is present, an XMP chunk is present. */
	private static final int WEBP_HAS_EXIF = 0x08;

	private static final int WEBP_HAS_XMP = 0x04;

	/**
	 * The most bytes the image stream of a PNG is inflated to while its end is looked for. A stream is
	 * 5 MiB at most when it reaches this class, and one that small can still inflate to gigabytes (measured
	 * 07.11.2026: 5,242,380 bytes inflating to about 5.4 GB, 2.9 s of one processor, with a database
	 * connection and the advisory lock held). The largest real photograph below 5 MiB inflates to a few
	 * hundred MB, so this leaves it room. Past it the stream is treated as one that does not end.
	 */
	static final long INFLATED_CEILING = 512L * 1024 * 1024;

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
		return of(picture, mediaType, INFLATED_CEILING);
	}

	/** {@link #of(byte[], String)} with the ceiling of the inflated PNG stream given, so a test need not inflate half a gigabyte. */
	static byte[] of(byte[] picture, String mediaType, long inflatedCeiling) {
		return switch (mediaType) {
			case "image/jpeg" -> jpeg(picture);
			case "image/png" -> png(picture, inflatedCeiling);
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

		/* BYTES THAT ARE NOT A MARKER ARE SKIPPED UNTIL ONE IS, here and after every segment below, which is
		   what a decoder does and the whole of „nastavlja kao pregledač" for this type. */
		int at = SmallPicture.markerFrom(in, 2);

		while (at + 1 < in.length) {
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
				at = SmallPicture.markerFrom(in, at + step);
				continue;
			}

			boolean lengthIsThere = at + 4 <= in.length;
			int length = lengthIsThere ? sixteen(in, at + 2) : 2;

			if (length < 2) {
				/* A length no segment can have: the marker is dropped and the next one looked for. */
				at = SmallPicture.markerFrom(in, at + 2);
				continue;
			}

			/* A SEGMENT THAT RUNS PAST THE END OF THE FILE (or whose length the file ends in the middle of) IS
			   THE REST OF THE FILE, as it is to a decoder. */
			int end = lengthIsThere ? (int) Math.min(at + 2L + length, in.length) : in.length;

			if (!isMetadata(in, marker, at + 4, end)) {
				out.write(in, at, end - at);
			}

			at = end;

			if (marker == 0xDA) {
				at = theScanFrom(in, at, out);
			}

			at = SmallPicture.markerFrom(in, at);
		}

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
	private static boolean isMetadata(byte[] in, int marker, int dataFrom, int end) {
		if (marker == 0xFE) {
			return true;
		}

		if (marker < 0xE0 || marker > 0xEF) {
			return false;
		}

		int size = Math.max(0, end - dataFrom);

		return !(marker == 0xE2 && startsWith(in, dataFrom, size, ICC_PROFILE)
				|| marker == 0xEE && startsWith(in, dataFrom, size, ADOBE));
	}

	/* ------------------------------------------------------------------------------------------------
	   PNG
	   ------------------------------------------------------------------------------------------------ */

	private static byte[] png(byte[] in, long inflatedCeiling) {
		int turn = pngOrientation(in);
		ByteArrayOutputStream out = new ByteArrayOutputStream(in.length);
		out.write(in, 0, 8);

		int at = 8;
		int stream = imageStreamLength(in, inflatedCeiling);
		int seen = 0;
		boolean trimmed = false;

		while (at + 12 <= in.length) {
			long length = thirtyTwo(in, at);
			String type = new String(in, at + 4, 4, StandardCharsets.ISO_8859_1);
			boolean draws = PNG_CRITICAL.contains(type) || PNG_DRAWING.contains(type);

			if ("IEND".equals(type)) {
				/* WRITTEN CANONICALLY, length 0, whatever length the file gave it (ADL 07.11.2026): an IEND
				   that claims data is a place text can sit, and what follows the end is not part of the picture. */
				pngChunk(out, "IEND", new byte[0]);
				return theSameWhereNothingChanged(in, out);
			}

			if ("IDAT".equals(type)) {
				/* THE IMAGE DATA IS KEPT EXACTLY TO THE END OF ITS ZLIB STREAM, which runs through all the IDAT
				   chunks (ADL 07.11.2026): a length that claims more than the stream holds is a place text can sit. */
				int have = (int) Math.min(length, in.length - at - 8L);
				int keep = Math.max(0, Math.min(have, stream - seen));
				seen += have;

				if (keep < have) {
					trimmed = true;

					if (keep > 0) {
						pngChunk(out, "IDAT", Arrays.copyOfRange(in, at + 8, at + 8 + keep));
					}

					at = (int) Math.min(in.length, at + 12L + length);
					continue;
				}
			}

			if (length > in.length - at - 12L) {
				/* A CHUNK THAT RUNS PAST THE END is the rest of the file: kept as far as it goes where it
				   draws (a picture cut in its data is shown as far as it goes), and gone where it does not. */
				if (draws) {
					out.write(in, at, in.length - at);
				}

				return theSameWhereNothingChanged(in, out);
			}

			int end = at + 12 + (int) length;

			if (draws) {
				out.write(in, at, end - at);
			}

			at = end;

			if ("IHDR".equals(type) && turn != 1) {
				/* RIGHT AFTER THE HEADER, which is before any image data, where every reader looks. */
				pngChunk(out, "eXIf", noteOf(turn));
			}
		}

		if (trimmed) {
			/* The chunk that claimed too much took the rest of the file with it, the end included. */
			pngChunk(out, "IEND", new byte[0]);
		}

		/* Fewer bytes than the smallest chunk are not one. */
		return theSameWhereNothingChanged(in, out);
	}

	/**
	 * How many bytes of the IDAT data (all the chunks of it, one after another) the zlib stream of the image
	 * really takes, found by inflating it to its end and asking the inflater what it did not use. Where the
	 * stream does not end (a picture cut in its data, or data that is no zlib stream) it is all of the IDAT
	 * data there is, which keeps what a viewer would show as far as it goes.
	 *
	 * <p>A stream that inflates to more than {@code ceiling} bytes is treated the same way, as one that does
	 * not end: the inflating stops there, and all of the IDAT data is kept. THE RECORDED BOUNDARY of that:
	 * text placed inside the IDAT length of a stream that inflates past the ceiling stays, as it does for the
	 * WebP image chunks (ADL 07.11.2026). Nothing that draws is lost, and a real picture is never this large.
	 */
	static int imageStreamLength(byte[] in, long ceiling) {
		ByteArrayOutputStream data = new ByteArrayOutputStream();
		byte[] idat = "IDAT".getBytes(StandardCharsets.ISO_8859_1);
		byte[] iend = "IEND".getBytes(StandardCharsets.ISO_8859_1);
		int at = 8;

		while (at + 12 <= in.length) {
			long length = thirtyTwo(in, at);

			if (startsWith(in, at + 4, 4, idat)) {
				data.write(in, at + 8, (int) Math.min(length, in.length - at - 8L));
			}

			if (startsWith(in, at + 4, 4, iend) || length > in.length - at - 12L) {
				break;
			}

			at += 12 + (int) length;
		}

		byte[] all = data.toByteArray();
		Inflater inflater = new Inflater();

		try {
			inflater.setInput(all);
			byte[] sink = new byte[8192];

			boolean moving = true;
			long inflated = 0;

			while (moving && !inflater.finished()) {
				int got = inflater.inflate(sink);
				inflated += got;

				if (inflated > ceiling) {
					return all.length;
				}

				moving = got > 0;
			}

			/* An inflater that stops short of the end wants more input, which this file does not have. */
			return inflater.finished() ? all.length - inflater.getRemaining() : all.length;
		} catch (DataFormatException notAStream) {
			return all.length;
		} finally {
			inflater.end();
		}
	}

	/**
	 * The orientation an {@code eXIf} chunk asks for, the first one in front of {@code IEND}, 1 where there
	 * is none: what comes after the end of the picture is not read by anybody who shows it.
	 */
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

			if (startsWith(in, at + 4, 4, "IEND".getBytes(StandardCharsets.ISO_8859_1))) {
				return 1;
			}

			at += 12 + (int) length;
		}

		return 1;
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
		/* WHAT THE RIFF HEADER SAYS THE FILE IS, and bytes past that are not part of it. (Inside an image
		   chunk the end of the picture cannot be found, so text its size covers stays: a recorded boundary.) A size that says
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

		boolean cutImage = false;

		while (at + 8 <= limit) {
			long size = littleThirtyTwo(in, at + 4);
			String type = new String(in, at, 4, StandardCharsets.ISO_8859_1);

			if (size > limit - at - 8L) {
				/* A CHUNK THAT RUNS PAST THE END is the rest of the file: kept as far as it goes where it
				   draws, and gone where it does not (see the class note). */
				if (WEBP_DRAWING.contains(type)) {
					chunks.write(in, at, limit - at);
					cutImage = true;
				}

				break;
			}

			int next = (int) Math.min(limit, at + 8 + size + (size & 1));

			if ("EXIF".equals(type) && !read) {
				turn = orientationOfAWebpNote(Arrays.copyOfRange(in, at + 8, at + 8 + (int) size));
				read = true;
			}

			if (WEBP_DRAWING.contains(type)) {
				chunks.write(in, at, next - at);
			}

			at = next;
		}

		/* THE NOTE GOES ONLY WHERE A READER LOOKS FOR ONE: an extended file, after the image, as the format
		   orders it, and not after a chunk that was cut (a chunk written behind it would be inside it). A
		   simple file cannot carry EXIF at all, so a note in one was never read by anybody. */
		boolean noted = extended && turn != 1 && !cutImage;

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
