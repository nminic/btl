package com.btl.portal.domain.photo;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

/**
 * WHAT A FILE HANDED TO THE PORTAL REALLY IS, DECIDED BY LOOKING AT IT.
 *
 * <p><b>ADL A12a, requirement 1, out of the security review of 23.08.2026:</b> the server
 * must „proveri tip po sadrzaju a ne po nazivu ni po {@code Content-Type} zaglavlju,
 * ograniči veličinu, nikad ne upotrebi ime fajla kao putanju". Three of those four
 * sentences are about a file before it is stored and this class is those three; the fourth
 * is about the name, and the portal keeps it by never having a name at all - V8 issues the
 * file's name out of the row's key, so a name a browser sent is not sanitised here, it is
 * discarded before anything could use it.
 *
 * <p><b>THE THREE TYPES ARE THE SCHEMA'S AND ARE NOT DECIDED HERE.</b> V8:
 * {@code photo_media_type_known check (media_type in ('image/jpeg', 'image/png',
 * 'image/webp'))}. A fourth recognised here could not be written, and one of the three
 * missing here would be a type the column allows and no route could ever produce.
 *
 * <p><b>TWO FLOORS KEEP THE LISTS EQUAL, AND THEY ARE IN TWO PLACES FOR A MEASURED
 * REASON.</b> {@code WhatAPictureIsTest} reads the MIGRATION FILE, which costs no container
 * and fails on the day somebody edits V8 - and a review on 25.09.2026 named what it cannot
 * see: a LATER migration that alters the constraint, which V8's text would go on describing
 * as though nothing had happened. So {@code MePhotoApiTest.theTypesTheSchemaReallyHolds}
 * asks the running database through {@code pg_constraint} instead. The file catches the
 * cheap mistake early and the catalogue catches the one that matters.
 *
 * <p><b>AND A TYPE IS RECOGNISED BY THE BYTES AT THE FRONT OF THE FILE.</b> Each of the
 * three formats begins with a fixed sequence that is part of the format itself rather than
 * a convention: JPEG's {@code FF D8 FF} start of image, PNG's eight byte signature, and
 * RIFF's four letters with {@code WEBP} four bytes later. Nothing else about the file is
 * read - the portal is not a decoder and does not pretend to be one - and what that
 * deliberately does NOT claim is written at {@link #sniff}.
 *
 * <p><b>A DOMAIN CLASS AND NOT A METHOD ON THE ROUTE</b>, which is where this codebase
 * keeps a rule that can be asked a question without a database:
 * {@link com.btl.portal.domain.account.PasswordPolicy} and
 * {@link com.btl.portal.domain.registration.WhatRegistrationAsksFor} are the same shape.
 * Nothing under {@code domain} touches a {@code JdbcClient}, and nothing here does.
 */
public final class WhatAPictureIs {

	/**
	 * HOW MANY BYTES A PICTURE MAY BE, AND THIS NUMBER IS MINE RATHER THAN THE OWNER'S.
	 *
	 * <p><b>Said out loud because the difference matters.</b> ADL A12a asks for a limit and
	 * names none, and no entry in PDL or ADL carries a number for this. So this is my
	 * reasoning, marked as such where somebody will read it, and it is one of the questions
	 * going back with offered outcomes rather than a decision written into a journal.
	 *
	 * <p><b>The reasoning, so that it can be argued with:</b> what arrives here is a
	 * photograph a member picked on a telephone, and a modern telephone writes between two
	 * and five megabytes. Two would refuse ordinary pictures from ordinary telephones and
	 * the member would have nothing to do about it; ten would let a page of twenty portraits
	 * be two hundred megabytes on a disk the portal shares with its database (ADL A41, „Imenovan
	 * Docker volumen uz bazu"). Five is the number that takes what people actually hand over
	 * and still bounds the volume.
	 *
	 * <p><b>It is not the only limit and it is not the outer one.</b> The container is
	 * configured above it ({@code spring.servlet.multipart.max-file-size}), so a file over
	 * THIS number is refused by the portal with a sentence the member can act on, and a file
	 * far over it never reaches the portal at all. Written the other way round - the
	 * container's limit under this one - the member would be answered by the container and
	 * this number would never decide anything.
	 */
	public static final int AT_MOST_BYTES = 5 * 1024 * 1024;

	/**
	 * THE THREE, IN THE ORDER V8 WRITES THEM.
	 *
	 * <p>Each one is its media type and the bytes that say a file is of it. The order is
	 * the schema's rather than meaningful: the three signatures cannot match one file
	 * between them, because a file beginning {@code FF D8 FF} begins with neither PNG's
	 * {@code 89 50} nor {@code RIFF}, and {@code WhatAPictureIsTest} says so by trying every
	 * signature against every other rather than by this sentence.
	 */
	private static final List<Known> KNOWN = List.of(
			new Known("image/jpeg", new int[] { 0xFF, 0xD8, 0xFF }, 0, null, 0),
			new Known("image/png",
					new int[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }, 0, null, 0),
			/* RIFF IS A CONTAINER AND ITS FOUR LETTERS ARE NOT ENOUGH. A `.wav` and an
			   `.avi` begin with exactly the same four; what says the container holds a
			   picture is `WEBP` at offset eight, after the four byte length in between. So
			   this one signature is two, and a file carrying only the first of them is not a
			   picture as far as this portal is concerned. */
			new Known("image/webp", new int[] { 'R', 'I', 'F', 'F' }, 0,
					new int[] { 'W', 'E', 'B', 'P' }, 8));

	/**
	 * The media types this portal will store, which is the list V8's constraint holds.
	 *
	 * <p>Derived from {@link #KNOWN} rather than written again, so a fourth signature added
	 * below cannot arrive without this list growing with it - and the floor that compares
	 * THIS list with the schema then fails, which is the moment somebody has to write the
	 * migration rather than discover afterwards that a type nothing can store is being
	 * accepted.
	 */
	public static final List<String> THE_TYPES_THE_SCHEMA_ALLOWS =
			KNOWN.stream().map(Known::mediaType).toList();

	private WhatAPictureIs() {
	}

	/**
	 * WHAT THESE BYTES ARE, or nothing at all.
	 *
	 * <p><b>What this answers:</b> that the file begins the way a file of this format
	 * begins. <b>What it deliberately does not claim, written here rather than left to be
	 * found:</b> that the rest of the file is a valid picture, that it can be decoded, that
	 * it holds no second document after the first, and that it is not enormous once
	 * unpacked. Deciding any of those means decoding the picture, and the portal accepts a
	 * format the platform's own {@code ImageIO} cannot read at all, so a rule written over
	 * a decoder would hold for two of the three types and quietly not for the third - which
	 * is worse than a rule that says what it covers.
	 *
	 * <p><b>What carries the rest, so that the paragraph above is a boundary and not a
	 * hole:</b> the bytes are served back under the type this method decided and never under
	 * one the browser claimed, with {@code X-Content-Type-Options: nosniff} on the answer
	 * ({@link com.btl.portal.web.PhotoApi}, measured there), so a file that is both a
	 * picture and something else is still only ever offered to a browser as a picture. And a
	 * picture reaches a profile only after a moderator has looked at it.
	 *
	 * @param bytes the whole file, never null
	 * @return one of the three media types, or null for anything else
	 */
	public static String sniff(byte[] bytes) {
		for (Known one : KNOWN) {
			if (one.matches(bytes)) {
				return one.mediaType();
			}
		}

		return null;
	}

	/**
	 * THE SHA-256 OF THE CONTENT, sixty four lowercase hexadecimal characters.
	 *
	 * <p>The shape V8's {@code photo_digest_shape} demands, spelt by the same
	 * {@link HexFormat} {@link com.btl.portal.domain.token.SecretToken} spells its own with,
	 * so the one thing both columns promise - lower case hex - has one spelling in the
	 * portal. It is the picture's address ({@code PhotoApi}, ADL A60) and it is what says
	 * two members handed over the same photograph.
	 *
	 * <p>Over BYTES and never over a string. The other digests in this portal are of a token,
	 * which is text; this one is of a file, and a file decoded into characters on the way to
	 * being hashed would hash to something that is not the file.
	 */
	public static String digestOf(byte[] bytes) {
		return digestOf(bytes, "SHA-256");
	}

	/**
	 * The same, WITH THE ALGORITHM NAMED, which is the shape
	 * {@link com.btl.portal.domain.token.SecretToken#hashOf(String, String)} already has and
	 * for the same reason.
	 *
	 * <p>SHA-256 is required of every Java platform, so the branch below cannot be reached
	 * through the method above. It is still written out rather than swallowed - a portal that
	 * cannot hash a picture must not go on storing rows that claim to describe one - and it
	 * is still reachable, by this parameter, so it is a branch that can be MEASURED instead
	 * of one that sits untested for ever behind a comment saying it cannot happen.
	 */
	static String digestOf(byte[] bytes, String algorithm) {
		MessageDigest digest;

		try {
			digest = MessageDigest.getInstance(algorithm);
		}
		catch (NoSuchAlgorithmException noSuchThing) {
			throw new IllegalStateException(algorithm + " is not on this machine", noSuchThing);
		}

		return HexFormat.of().formatHex(digest.digest(bytes));
	}

	/**
	 * One format: its type, and the one or two runs of bytes that say a file is of it.
	 *
	 * @param second where a second run is needed, as RIFF's is. Null where one run says it
	 *               all
	 */
	private record Known(String mediaType, int[] first, int at, int[] second, int secondAt) {

		boolean matches(byte[] bytes) {
			return runMatches(bytes, first, at)
					&& (second == null || runMatches(bytes, second, secondAt));
		}

		private static boolean runMatches(byte[] bytes, int[] run, int from) {
			if (bytes.length < from + run.length) {
				return false;
			}

			for (int i = 0; i < run.length; i++) {
				/* MASKED, because a Java byte is signed and every one of these signatures
				   carries a value above 127. Compared without the mask, PNG's 0x89 arrives
				   as -119 and no picture in the world would ever be recognised. */
				if ((bytes[from + i] & 0xFF) != run[i]) {
					return false;
				}
			}

			return true;
		}
	}
}
