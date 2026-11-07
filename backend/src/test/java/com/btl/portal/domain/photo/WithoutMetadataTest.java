package com.btl.portal.domain.photo;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;

import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.EXTENDED_WEBP;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.SIMPLE_WEBP;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.WHERE_AND_WITH_WHAT;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.aPngThatSaysEverything;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.aTelephoneJpeg;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.aTelephoneWebp;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.chunk;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.chunksOf;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.concat;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.exifSegment;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.jpeg;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.pixelsOf;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.png;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.riffChunk;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.riffChunksOf;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.says;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.segment;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.tiff;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.typeOf;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.webp;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.webpOf;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.withChunks;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.withSegments;
import static com.btl.portal.domain.photo.PicturesThatCarryMetadata.xmpSegment;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT {@link WithoutMetadata} TAKES OFF AND WHAT IT KEEPS, over real pictures of the three types.
 *
 * <p>ADL, owner, 06.11.2026: „skida sve metapodatke (EXIF, uključujući GPS, datum i model uređaja) pre upisa,
 * a pravilnu orijentaciju zadržava", and the addition of the same day, „Profil boja (ICC) se zadržava". Every
 * case asks three things where they apply: the sentence a telephone wrote is gone, the picture decodes to the
 * same pixels, and the orientation it asked for is still asked for. And each type is asked once more over
 * its own output, because the clean-up of stored pictures runs at every start and must move nothing twice.
 */
class WithoutMetadataTest {

	private static final byte[] SOI = { (byte) 0xFF, (byte) 0xD8 };

	private static final byte[] EOI = { (byte) 0xFF, (byte) 0xD9 };

	/* ------------------------------------------------------------------------------------------------
	   JPEG
	   ------------------------------------------------------------------------------------------------ */

	@Test
	void aTelephoneJpegLosesThePlaceTheDateTheDeviceAndTheVideoAndKeepsItsTurnAndItsPixels() {
		for (int turn : new int[] { 6, 8, 3 }) {
			byte[] sent = aTelephoneJpeg(turn);
			byte[] kept = WithoutMetadata.of(sent, "image/jpeg");

			assertThat(says(kept, WHERE_AND_WITH_WHAT))
					.as("what the telephone wrote about where, when and with what is still in the stored picture")
					.isFalse();
			assertThat(says(kept, "ftypmp42")).as("the video after the end of the picture is still there").isFalse();
			assertThat(says(kept, "JFIF")).as("APP0 is kept, and it can carry a thumbnail").isFalse();
			assertThat(SmallPicture.orientationOf(kept))
					.as("the picture no longer asks to be turned %s, so it is shown the wrong way round", turn)
					.isEqualTo(turn);
			assertThat(Arrays.copyOfRange(kept, 2, 4 + 34))
					.as("the note is anything but the one tag, right after the start of the picture")
					.isEqualTo(concat(new byte[] { (byte) 0xFF, (byte) 0xE1, 0, 34, 'E', 'x', 'i', 'f', 0, 0 },
							WithoutMetadata.noteOf(turn)));
			assertThat(pixelsOf(kept, "image/jpeg")).as("cleaning changed the picture itself")
					.isEqualTo(pixelsOf(sent, "image/jpeg"));
			assertThat(WithoutMetadata.of(kept, "image/jpeg")).as("a cleaned picture is cleaned into something else")
					.isEqualTo(kept);
		}
	}

	@Test
	void aJpegThatAsksToBeShownAsStoredCarriesNoNoteAtAll() {
		for (int turn : new int[] { 0, 1 }) {
			byte[] kept = WithoutMetadata.of(aTelephoneJpeg(turn), "image/jpeg");

			assertThat(says(kept, "Exif")).as("a note is written for a picture that asks for no turn (%s)", turn)
					.isFalse();
			assertThat(WithoutMetadata.of(kept, "image/jpeg")).as("a clean picture is not given back as it came")
					.isSameAs(kept);
		}
	}

	@Test
	void theTwoSegmentsThatSayWhatTheColoursAreStayAndEveryOtherApplicationSegmentGoes() {
		byte[] icc = segment(0xE2, concat("ICC_PROFILE\0".getBytes(StandardCharsets.ISO_8859_1), new byte[] { 1, 1, 9 }));
		byte[] adobe = segment(0xEE, concat("Adobe".getBytes(StandardCharsets.ISO_8859_1), new byte[] { 0, 100, 0 }));
		byte[] mpf = segment(0xE2, concat("MPF\0".getBytes(StandardCharsets.ISO_8859_1), said()));
		byte[] tooShortForAName = segment(0xE2, new byte[] { 'I', 'C' });
		byte[] photoshop = segment(0xED, concat("Photoshop 3.0\0".getBytes(StandardCharsets.ISO_8859_1), said()));
		byte[] app15 = segment(0xEF, said());
		byte[] notAdobe = segment(0xEE, said());
		byte[] extension = segment(0xF0, new byte[] { 7, 7 });
		byte[] jpeg = jpeg(false);

		byte[] kept = WithoutMetadata.of(withSegments(jpeg, icc, mpf, tooShortForAName, adobe, notAdobe, photoshop, app15,
				extension), "image/jpeg");

		assertThat(kept).as("the colour profile, the Adobe segment or a segment that is not an application one went,"
				+ " or something else stayed")
				.isEqualTo(concat(SOI, icc, adobe, extension, Arrays.copyOfRange(withoutApp0(jpeg), 2,
						withoutApp0(jpeg).length)));
	}

	@Test
	void anApplicationSegmentBetweenTheScansOfAProgressivePictureGoesToo() {
		byte[] progressive = jpeg(true);
		int second = secondScanOf(progressive);
		byte[] between = concat(Arrays.copyOf(progressive, second),
				segment(0xFE, said()), exifSegment(6), Arrays.copyOfRange(progressive, second, progressive.length));

		byte[] kept = WithoutMetadata.of(between, "image/jpeg");

		assertThat(says(kept, WHERE_AND_WITH_WHAT)).as("a segment between two scans was taken for picture data")
				.isFalse();
		assertThat(pixelsOf(kept, "image/jpeg")).isEqualTo(pixelsOf(progressive, "image/jpeg"));
		assertThat(kept).as("the progressive picture lost a byte of its own, or kept one it should not")
				.isEqualTo(withoutApp0(progressive));
	}

	@Test
	void insideAScanEveryEscapeOfTheMarkerByteIsData() {
		/* FF 00 is a byte, FF D0 and FF D7 restarts, FF FF a fill in front of one, and an FF that is the last byte is data. */
		byte[] scan = concat(segment(0xDA, new byte[] { 1, 1, 0, 0, 63, 0 }),
				new byte[] { 5, (byte) 0xFF, 0, 6, (byte) 0xFF, (byte) 0xD0, 7, (byte) 0xFF, (byte) 0xD7, 8,
						(byte) 0xFF, (byte) 0xFF, (byte) 0xD1, 9 });
		byte[] picture = concat(SOI, segment(0xFE, said()), scan, segment(0xFE, said()), scan, EOI);

		assertThat(WithoutMetadata.of(picture, "image/jpeg")).isEqualTo(concat(SOI, scan, scan, EOI));

		byte[] endsInTheScan = concat(SOI, segment(0xFE, said()), scan, new byte[] { (byte) 0xFF });

		assertThat(WithoutMetadata.of(endsInTheScan, "image/jpeg"))
				.as("a scan that runs to the end of the file lost its last byte")
				.isEqualTo(concat(SOI, scan, new byte[] { (byte) 0xFF }));
	}

	@Test
	void markersWithoutALengthAndFillBytesAreCopiedAsTheyStand() {
		byte[] picture = concat(SOI, new byte[] { (byte) 0xFF, (byte) 0xFF, (byte) 0xFF, 0x01, (byte) 0xFF,
				(byte) 0xD0, (byte) 0xFF, (byte) 0xD8 }, segment(0xFE, said()), segment(0xC4, new byte[] { 3 }), EOI);

		assertThat(WithoutMetadata.of(picture, "image/jpeg"))
				.isEqualTo(concat(SOI, new byte[] { (byte) 0xFF, (byte) 0xFF, (byte) 0xFF, 0x01, (byte) 0xFF,
						(byte) 0xD0, (byte) 0xFF, (byte) 0xD8 }, segment(0xC4, new byte[] { 3 }), EOI));
	}

	/**
	 * ADL, owner, 07.11.2026: „čišćenje ne staje nego nastavlja kao pregledač: preskoči pokvareno mesto i skida
	 * metapodatke i iza njega; slika se prima i čista je". Every case below first asks that the sent file DOES
	 * say where it was taken (the clean-up of a file that never said it proves nothing), then that the cleaned
	 * one does not, that the pixels are the same, the turn is the one asked for, and that the second run moves
	 * nothing.
	 */
	private static void isCleanedAsAViewerWouldReadIt(byte[] sent, int turn) {
		assertThat(says(sent, WHERE_AND_WITH_WHAT)).as("the sent file never said where it was taken").isTrue();

		byte[] kept = WithoutMetadata.of(sent, "image/jpeg");

		assertThat(says(kept, WHERE_AND_WITH_WHAT)).as("what the file said about where it was taken stayed behind a"
				+ " break in its structure").isFalse();
		assertThat(pixelsOf(kept, "image/jpeg")).as("walking past the break cost the picture something")
				.isEqualTo(pixelsOf(jpeg(false), "image/jpeg"));
		assertThat(SmallPicture.orientationOf(kept)).as("the turn the file asked for").isEqualTo(turn);
		assertThat(WithoutMetadata.of(kept, "image/jpeg")).as("a second run moved something").isEqualTo(kept);
	}

	@Test
	void bytesThatAreNotAMarkerAreSkippedUntilTheNextOneAndTheMetadataBehindThemGoes() {
		byte[][] strays = { { 0x00 }, { 0x12, 0x34 }, { (byte) 0xFF, 0x00 }, { (byte) 0xFF, (byte) 0xFF, 0x00 } };

		for (byte[] stray : strays) {
			/* In front of the first segment, between two metadata segments, and in front of the first picture one. */
			byte[] plain = jpeg(false);
			isCleanedAsAViewerWouldReadIt(withSegments(plain, stray, exifSegment(6), xmpSegment()), 6);
			isCleanedAsAViewerWouldReadIt(withSegments(plain, exifSegment(6), stray, xmpSegment()), 6);
			isCleanedAsAViewerWouldReadIt(withSegments(plain, exifSegment(6), xmpSegment(), stray), 6);
		}
	}

	@Test
	void aSegmentWhoseLengthIsOneTooLongSwallowsTheNextMarkerAsADecoderDoesAndLeavesNothingBehind() {
		/* The measured shape: the XMP says one byte more than it holds, so it swallows the first byte of the
		   next marker, exactly as a decoder reading it does, and the bytes up to the next marker are skipped. */
		byte[] xmp = xmpSegment();
		xmp[3]++;
		byte[] sent = withSegments(jpeg(false), new byte[] { (byte) 0xFF }, xmp, exifSegment(6),
				segment(0xFE, said()));

		assertThat(says(sent, WHERE_AND_WITH_WHAT)).isTrue();

		byte[] kept = WithoutMetadata.of(sent, "image/jpeg");

		assertThat(says(kept, WHERE_AND_WITH_WHAT)).as("the segments after the one that swallowed a marker stayed")
				.isFalse();
		assertThat(pixelsOf(kept, "image/jpeg")).isEqualTo(pixelsOf(jpeg(false), "image/jpeg"));
		assertThat(WithoutMetadata.of(kept, "image/jpeg")).as("a second run moved something").isEqualTo(kept);
	}

	@Test
	void aMarkerWhoseLengthCannotBeTrueIsSkippedAndNotBelieved() {
		/* A length under two is a break; the two bytes of the marker are dropped and the next marker is looked for. */
		for (byte[] bogus : List.of(new byte[] { (byte) 0xFF, (byte) 0xE1, 0, 1, 9 },
				new byte[] { (byte) 0xFF, (byte) 0xE1, 0, 0 })) {
			isCleanedAsAViewerWouldReadIt(withSegments(jpeg(false), bogus, exifSegment(6), xmpSegment()), 6);
		}
	}

	@Test
	void aSegmentThatRunsPastTheEndOfTheFileTakesTheRestWithItAndIsKeptOnlyWhereItDraws() {
		byte[] exif = exifSegment(6);

		/* A metadata segment cut short: its length says more than the file holds, so it is the rest of the file. */
		assertThat(WithoutMetadata.of(concat(SOI, segment(0xFE, said()), Arrays.copyOf(exif, exif.length - 4)),
				"image/jpeg"))
				.isEqualTo(concat(SOI, segment(0xE1, concat(new byte[] { 'E', 'x', 'i', 'f', 0, 0 },
						WithoutMetadata.noteOf(6)))));

		/* A marker the file ends in the middle of the length of: metadata goes, a segment that draws stays. */
		assertThat(WithoutMetadata.of(concat(SOI, segment(0xFE, said()), new byte[] { (byte) 0xFF, (byte) 0xE1, 0 }),
				"image/jpeg")).isEqualTo(SOI);

		byte[] tail = { (byte) 0xFF, (byte) 0xC4, 0, 90, 9 };
		byte[] cutTable = { (byte) 0xFF, (byte) 0xC4, 0 };

		assertThat(WithoutMetadata.of(concat(SOI, segment(0xFE, said()), tail), "image/jpeg"))
				.isEqualTo(concat(SOI, tail));
		assertThat(WithoutMetadata.of(concat(SOI, segment(0xFE, said()), cutTable), "image/jpeg"))
				.isEqualTo(concat(SOI, cutTable));

		/* And a lone byte where the file ends is not a marker. */
		assertThat(WithoutMetadata.of(concat(SOI, segment(0xC4, new byte[] { 3 }), new byte[] { (byte) 0xFF }),
				"image/jpeg")).isEqualTo(concat(SOI, segment(0xC4, new byte[] { 3 })));
	}

	@Test
	void aFileThatOnlyBeginsLikeAJpegIsGivenBackAsItCame() {
		byte[] fake = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 'b', '2', '5', '7' };

		assertThat(WithoutMetadata.of(fake, "image/jpeg")).isSameAs(fake);
	}

	@Test
	void whatFollowsTheEndOfACleanPictureIsTakenAndNothingElse() {
		byte[] clean = concat(SOI, segment(0xC4, new byte[] { 3 }), EOI);

		assertThat(WithoutMetadata.of(clean, "image/jpeg")).isSameAs(clean);
		assertThat(WithoutMetadata.of(concat(clean, said()), "image/jpeg")).isEqualTo(clean);
	}

	/* ------------------------------------------------------------------------------------------------
	   PNG
	   ------------------------------------------------------------------------------------------------ */

	@Test
	void aPngLosesEveryTextItsTimeItsDensityAndAPrivateChunkAndKeepsItsTurnItsGammaAndItsPixels() {
		byte[] sent = aPngThatSaysEverything(6);
		byte[] kept = WithoutMetadata.of(sent, "image/png");

		assertThat(says(kept, WHERE_AND_WITH_WHAT)).as("a text chunk, the EXIF chunk or the tail is still there")
				.isFalse();
		assertThat(chunksOf(kept)).as("the chunks of the cleaned picture")
				.containsExactlyElementsOf(concatLists(List.of("IHDR", "eXIf", "gAMA"),
						chunksOf(png()).subList(1, chunksOf(png()).size())));
		assertThat(kept).as("the note right after the header is anything but the one tag")
				.containsSubsequence(chunk("eXIf", WithoutMetadata.noteOf(6)));
		assertThat(pixelsOf(kept, "image/png")).isEqualTo(pixelsOf(sent, "image/png"));
		assertThat(WithoutMetadata.of(kept, "image/png")).isEqualTo(kept);
	}

	@Test
	void aPngThatAsksForNoTurnGetsNoNoteAndACleanOneComesBackAsItCame() {
		byte[] kept = WithoutMetadata.of(aPngThatSaysEverything(0), "image/png");

		assertThat(chunksOf(kept)).doesNotContain("eXIf");
		assertThat(WithoutMetadata.of(kept, "image/png")).isSameAs(kept);
	}

	@Test
	void aCriticalChunkNobodyKnowsIsTakenTooBecauseNothingForcesItToHoldOnlyPixels() {
		byte[] png = png();
		byte[] sent = withChunks(png, chunk("GPSx", said()), chunk("tEXt", said()));

		assertThat(says(sent, WHERE_AND_WITH_WHAT)).isTrue();

		byte[] kept = WithoutMetadata.of(sent, "image/png");

		assertThat(chunksOf(kept)).doesNotContain("GPSx", "tEXt");
		assertThat(says(kept, WHERE_AND_WITH_WHAT)).isFalse();
		assertThat(kept).as("one of the four critical chunks of the format was touched").isEqualTo(png);
	}

	@Test
	void aPngWhoseStructureBreaksIsCleanedPastTheBreakAndWhatCannotBeFollowedDoesNotStay() {
		byte[] png = png();
		byte[] broken = concat(new byte[] { 0, 0, 0x7F, 0 }, "tEXt".getBytes(StandardCharsets.ISO_8859_1), said());
		byte[] sent = concat(Arrays.copyOf(png, 33), chunk("tEXt", said()), broken);

		assertThat(says(sent, WHERE_AND_WITH_WHAT)).isTrue();
		assertThat(WithoutMetadata.of(sent, "image/png")).as("a chunk that cannot be followed was copied")
				.isEqualTo(Arrays.copyOf(png, 33));

		/* A tail that is shorter than any chunk is not one. */
		byte[] tooShortForAChunk = concat(Arrays.copyOf(png, 8), new byte[] { 1, 2, 3 });

		assertThat(WithoutMetadata.of(tooShortForAChunk, "image/png")).isEqualTo(Arrays.copyOf(png, 8));

		/* The picture itself, cut in the middle of its data, is what a viewer shows as far as it goes. */
		byte[] cutInTheImage = Arrays.copyOf(png, png.length - 20);

		assertThat(WithoutMetadata.of(withChunks(cutInTheImage, chunk("tEXt", said())), "image/png"))
				.as("the cut image data was dropped with the break").isEqualTo(cutInTheImage);
	}

	@Test
	void anExifChunkAfterTheEndOfThePictureIsNotWhatTheViewerTurnsItBy() {
		byte[] png = png();
		byte[] sent = concat(png, chunk("eXIf", tiff(6, true)));

		assertThat(WithoutMetadata.of(sent, "image/png"))
				.as("a note was written for a chunk no viewer reads, so the picture is shown turned")
				.isEqualTo(png);
		assertThat(WithoutMetadata.of(png, "image/png")).isSameAs(png);
	}

	@Test
	void aPngWhoseNoteIsCutShortIsShownAsStored() {
		byte[] kept = WithoutMetadata.of(withChunks(png(), chunk("eXIf", new byte[] { 'M', 'M' })), "image/png");

		assertThat(chunksOf(kept)).doesNotContain("eXIf");
	}

	/* ------------------------------------------------------------------------------------------------
	   WEBP
	   ------------------------------------------------------------------------------------------------ */

	@Test
	void anExtendedWebpLosesItsExifItsXmpAndAChunkNobodyKnowsAndKeepsItsTurnAndItsPixels() {
		byte[] sent = aTelephoneWebp(6);
		byte[] kept = WithoutMetadata.of(sent, "image/webp");

		assertThat(says(kept, WHERE_AND_WITH_WHAT)).isFalse();
		assertThat(riffChunksOf(kept).stream().map(PicturesThatCarryMetadata::typeOf))
				.containsExactly("VP8X", "ALPH", "VP8 ", "EXIF");
		assertThat(riffChunksOf(kept).get(3)).as("the note after the picture is anything but the one tag")
				.isEqualTo(riffChunk("EXIF", WithoutMetadata.noteOf(6)));
		assertThat(kept[20] & 0x0C).as("the VP8X flags do not say EXIF and only EXIF").isEqualTo(0x08);
		assertThat(littleEndian(kept, 4)).as("the RIFF size is not the size of what is there").isEqualTo(kept.length - 8);
		assertThat(pixelsOf(kept, "image/webp")).isEqualTo(pixelsOf(webp(EXTENDED_WEBP), "image/webp"));
		assertThat(WithoutMetadata.of(kept, "image/webp")).isEqualTo(kept);
	}

	@Test
	void anExtendedWebpThatAsksForNoTurnSaysItCarriesNothingAndACleanOneComesBackAsItCame() {
		byte[] kept = WithoutMetadata.of(aTelephoneWebp(0), "image/webp");

		assertThat(kept).isEqualTo(webp(EXTENDED_WEBP));

		byte[] clean = webp(EXTENDED_WEBP);

		assertThat(WithoutMetadata.of(clean, "image/webp")).isSameAs(clean);
	}

	@Test
	void theTurnIsReadOutOfTheFirstExifChunkAndWithTheHeaderSomeWritersPutInFront() {
		byte[] webp = webp(EXTENDED_WEBP);
		List<byte[]> chunks = riffChunksOf(webp);
		byte[] headed = webpOf(webp, 0x08, chunks.get(0), chunks.get(1), chunks.get(2),
				riffChunk("EXIF", concat(new byte[] { 'E', 'x', 'i', 'f', 0, 0 }, tiff(8, true))),
				riffChunk("EXIF", tiff(3, false)));

		List<byte[]> kept = riffChunksOf(WithoutMetadata.of(headed, "image/webp"));

		assertThat(kept).as("no note was written, or a second one").hasSize(4);
		assertThat(kept.get(3)).isEqualTo(riffChunk("EXIF", WithoutMetadata.noteOf(8)));
	}

	@Test
	void aSimpleWebpCannotCarryANoteSoAnExifChunkInOneIsTakenAndNoneIsWritten() {
		byte[] simple = webp(SIMPLE_WEBP);
		byte[] sent = webpOf(simple, 0, riffChunksOf(simple).get(0), riffChunk("EXIF", tiff(6, false)));

		assertThat(WithoutMetadata.of(sent, "image/webp")).isEqualTo(simple);
		assertThat(WithoutMetadata.of(simple, "image/webp")).isSameAs(simple);
	}

	@Test
	void whatLiesPastTheSizeTheRiffHeaderDeclaresIsTakenAndASizeThatCannotBeTrueIsNotBelieved() {
		byte[] clean = webp(EXTENDED_WEBP);

		assertThat(WithoutMetadata.of(concat(clean, said()), "image/webp")).isEqualTo(clean);

		for (int declared : new int[] { 3, clean.length }) {
			byte[] lying = clean.clone();
			setLittleEndian(lying, 4, declared);

			assertThat(WithoutMetadata.of(lying, "image/webp"))
					.as("a RIFF size of %s was believed, so the picture was cut, or it was kept in the header", declared)
					.isEqualTo(clean);
		}
	}

	@Test
	void aWebpWhoseStructureBreaksIsCleanedPastTheBreakAndWhatCannotBeFollowedDoesNotStay() {
		byte[] webp = webp(EXTENDED_WEBP);
		List<byte[]> chunks = riffChunksOf(webp);
		byte[] exif = riffChunk("EXIF", tiff(6, false));

		/* The XMP says one byte more than the file holds: a chunk that cannot be followed and does not draw. */
		byte[] xmp = riffChunk("XMP ", said());
		setLittleEndian(xmp, 4, said().length + 8);
		byte[] sent = webpOf(webp, 0x08 | 0x04, chunks.get(0), chunks.get(1), chunks.get(2), exif, xmp);

		assertThat(says(sent, WHERE_AND_WITH_WHAT)).isTrue();

		byte[] kept = WithoutMetadata.of(sent, "image/webp");

		assertThat(says(kept, WHERE_AND_WITH_WHAT)).as("an XMP chunk that overran the file stayed").isFalse();
		assertThat(riffChunksOf(kept).stream().map(PicturesThatCarryMetadata::typeOf))
				.containsExactly("VP8X", "ALPH", "VP8 ", "EXIF");
		assertThat(riffChunksOf(kept).get(3)).as("the turn was lost with the break")
				.isEqualTo(riffChunk("EXIF", WithoutMetadata.noteOf(6)));
		assertThat(WithoutMetadata.of(kept, "image/webp")).isEqualTo(kept);

		/* Bytes inside the declared size that are too few for a chunk header are not a chunk. */
		byte[] clean = webp(EXTENDED_WEBP);
		byte[] withTail = concat(clean, new byte[] { 1, 2, 3 });
		setLittleEndian(withTail, 4, withTail.length - 8);

		assertThat(WithoutMetadata.of(withTail, "image/webp")).isEqualTo(clean);

		/* An image chunk that runs past the end is kept as far as it goes, and no note goes after it. */
		byte[] cutImage = { 'V', 'P', '8', ' ', 0, 0, 0, 0x70, 1, 2 };
		byte[] keptCut = WithoutMetadata.of(webpOf(webp, 0, chunks.get(0), chunks.get(1), exif, cutImage), "image/webp");

		assertThat(Arrays.copyOfRange(keptCut, 12, keptCut.length))
				.isEqualTo(concat(withFlags(chunks.get(0), 0x10), chunks.get(1), cutImage));
	}

	@Test
	void aFileTooShortForAnExtendedHeaderOrWithAHeaderOfTheWrongSizeIsNotReadAsExtended() {
		byte[] tooShort = concat("RIFF".getBytes(StandardCharsets.ISO_8859_1), new byte[] { 12, 0, 0, 0 },
				"WEBPVP8X".getBytes(StandardCharsets.ISO_8859_1), new byte[] { 2, 0, 0, 0 });

		assertThat(WithoutMetadata.of(tooShort, "image/webp")).isSameAs(tooShort);

		byte[] wrongSize = webpOf(webp(EXTENDED_WEBP), 0, riffChunk("VP8X", new byte[] { 0x0C, 0, 0, 0, 0, 0, 0, 0,
				0, 0, 0, 0 }), riffChunk("EXIF", tiff(6, false)));
		byte[] kept = WithoutMetadata.of(wrongSize, "image/webp");

		assertThat(riffChunksOf(kept).stream().map(PicturesThatCarryMetadata::typeOf)).containsExactly("VP8X");
		assertThat(kept[20]).as("the flags of a header of the wrong size were rewritten").isEqualTo((byte) 0x0C);
	}

	/* ------------------------------------------------------------------------------------------------
	   ANYTHING ELSE
	   ------------------------------------------------------------------------------------------------ */

	@Test
	void aTypeTheSchemaDoesNotHoldIsRefusedRatherThanPassedThrough() {
		assertThatThrownBy(() -> WithoutMetadata.of(new byte[] { 'G', 'I', 'F' }, "image/gif"))
				.isInstanceOf(IllegalArgumentException.class)
				.hasMessageContaining("image/gif");
	}

	@Test
	void everyTypeTheSchemaHoldsIsCleaned() {
		for (String type : WhatAPictureIs.THE_TYPES_THE_SCHEMA_ALLOWS) {
			byte[] sent = switch (type) {
				case "image/jpeg" -> aTelephoneJpeg(6);
				case "image/png" -> aPngThatSaysEverything(6);
				default -> aTelephoneWebp(6);
			};

			assertThat(says(WithoutMetadata.of(sent, type), WHERE_AND_WITH_WHAT)).as(type).isFalse();
		}
	}

	/* ------------------------------------------------------------------------------------------------ */

	private static byte[] said() {
		return WHERE_AND_WITH_WHAT.getBytes(StandardCharsets.ISO_8859_1);
	}

	/** The platform's JPEG without the APP0 it always writes first. */
	private static byte[] withoutApp0(byte[] jpeg) {
		int length = (jpeg[4] & 0xFF) << 8 | jpeg[5] & 0xFF;
		return concat(SOI, Arrays.copyOfRange(jpeg, 4 + length, jpeg.length));
	}

	private static int secondScanOf(byte[] jpeg) {
		int found = 0;

		for (int at = 0; at + 1 < jpeg.length; at++) {
			if ((jpeg[at] & 0xFF) == 0xFF && (jpeg[at + 1] & 0xFF) == 0xDA && ++found == 2) {
				return at;
			}
		}

		throw new AssertionError("the platform wrote a progressive JPEG with one scan");
	}

	private static byte[] withFlags(byte[] vp8x, int flags) {
		byte[] copy = vp8x.clone();
		copy[8] = (byte) flags;
		return copy;
	}

	private static long littleEndian(byte[] bytes, int at) {
		return (bytes[at] & 0xFFL) | (bytes[at + 1] & 0xFFL) << 8 | (bytes[at + 2] & 0xFFL) << 16
				| (bytes[at + 3] & 0xFFL) << 24;
	}

	private static void setLittleEndian(byte[] bytes, int at, int value) {
		bytes[at] = (byte) value;
		bytes[at + 1] = (byte) (value >>> 8);
		bytes[at + 2] = (byte) (value >>> 16);
		bytes[at + 3] = (byte) (value >>> 24);
	}

	private static List<String> concatLists(List<String> first, List<String> second) {
		return java.util.stream.Stream.concat(first.stream(), second.stream()).toList();
	}
}
