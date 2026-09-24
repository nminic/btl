package com.btl.portal.domain.photo;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHAT THE PORTAL DECIDES A FILE IS, AND IT DECIDES IT BY LOOKING.
 *
 * <p><b>NOTHING HERE IS THE ONLY ONE OF ITS KIND</b>, on every axis an assertion reads a
 * value along - which is the check {@code CLAUDE.md} asks for over the SETTING of a case
 * rather than over the code:
 *
 * <ul>
 * <li><b>Three formats and not one.</b> Measured over JPEG alone, „recognises a picture"
 * and „recognises THIS picture" are one answer, and a sniffer that returned
 * {@code image/jpeg} for everything would pass.
 * <li><b>Every signature is tried against every OTHER format's answer</b>, so „the right
 * type" is never the same string as „the first type".
 * <li><b>The bytes after the signature are different in every sample</b>, so a digest that
 * hashed only the head would come back the same for two of them and the case would say
 * nothing.
 * <li><b>The samples are not all the same length</b>, so a size read off a constant rather
 * than off the array would be caught.
 * </ul>
 */
class WhatAPictureIsTest {

	/** The three heads, in the order the class declares them. */
	private static final byte[] JPEG_HEAD = bytes(0xFF, 0xD8, 0xFF);

	private static final byte[] PNG_HEAD = bytes(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A);

	/** RIFF, four bytes of length, then WEBP - which is why it is twelve and not four. */
	private static final byte[] WEBP_HEAD = bytes('R', 'I', 'F', 'F', 0x10, 0x00, 0x00, 0x00,
			'W', 'E', 'B', 'P');

	/**
	 * The migration that decides which types there are, read off the working tree.
	 *
	 * <p>Not a list written again here: V8's {@code photo_media_type_known} is the fact, and
	 * a copy of it in a test is a second home for it. The same arrangement
	 * {@code MeWriteApiTest} has for the length of the biography, pointed at a {@code .sql}
	 * file instead of a {@code .json} one.
	 */
	private static final Path THE_MIGRATION_THAT_DECIDES = Path.of("src", "main", "resources",
			"db", "migration", "V8__registration_document_consent_photo.sql");

	private static byte[] bytes(int... values) {
		byte[] made = new byte[values.length];

		for (int i = 0; i < values.length; i++) {
			made[i] = (byte) values[i];
		}

		return made;
	}

	/** A head with a tail of its own, so no two samples hash alike and none is the same length. */
	private static byte[] like(byte[] head, String tail) {
		byte[] rest = tail.getBytes(StandardCharsets.UTF_8);
		byte[] whole = new byte[head.length + rest.length];

		System.arraycopy(head, 0, whole, 0, head.length);
		System.arraycopy(rest, 0, whole, head.length, rest.length);

		return whole;
	}

	/** Each of the three, under the type it is supposed to be recognised as. */
	private static Map<String, byte[]> theThree() {
		Map<String, byte[]> three = new HashMap<>();

		three.put("image/jpeg", like(JPEG_HEAD, "ovo je ostatak jpega"));
		three.put("image/png", like(PNG_HEAD, "a ovo je nesto sasvim drugo, duze"));
		three.put("image/webp", like(WEBP_HEAD, "treci rep"));

		return three;
	}

	@Test
	void eachOfTheThreeFormatsIsRecognisedAsItselfAndAsNothingElse() {
		Set<String> answered = new LinkedHashSet<>();

		for (Map.Entry<String, byte[]> one : theThree().entrySet()) {
			String said = WhatAPictureIs.sniff(one.getValue());

			assertThat(said)
					.as("a file beginning exactly the way %s begins was read as something else,"
							+ " so the portal would store it under a type it is not",
							one.getKey())
					.isEqualTo(one.getKey());

			answered.add(said);
		}

		assertThat(answered)
				.as("two of the three came back under one type, so the sniffer is answering the"
						+ " first thing it knows rather than what it was handed")
				.hasSize(3);
	}

	/**
	 * AND THE LIST IT ANSWERS FROM IS THE SCHEMA'S, read out of the migration.
	 *
	 * <p>The floor under {@link WhatAPictureIs#THE_TYPES_THE_SCHEMA_ALLOWS}, in the same
	 * commit as the list. A type this class learns to recognise that the column cannot hold
	 * is a route that accepts a file and then fails on a constraint; a type the column holds
	 * that nothing recognises is a value no route could ever write. Either way the build
	 * stops here and somebody decides, instead of a member finding out.
	 */
	@Test
	void theTypesItRecognisesAreExactlyTheOnesTheColumnHolds() throws Exception {
		String migration = Files.readString(THE_MIGRATION_THAT_DECIDES);
		Matcher constraint = Pattern
				.compile("photo_media_type_known\\s+check\\s*\\(\\s*media_type\\s+in\\s*\\(([^)]*)\\)")
				.matcher(migration);

		assertThat(constraint.find())
				.as("%s no longer carries photo_media_type_known in a shape this can read, so"
						+ " this case compares nothing at all", THE_MIGRATION_THAT_DECIDES)
				.isTrue();

		List<String> inTheColumn = new ArrayList<>();

		for (String one : constraint.group(1).split(",")) {
			inTheColumn.add(one.strip().replace("'", ""));
		}

		assertThat(inTheColumn)
				.as("the constraint was read as an empty list, so this compares nothing")
				.isNotEmpty();

		assertThat(WhatAPictureIs.THE_TYPES_THE_SCHEMA_ALLOWS)
				.as("the portal recognises a type the column cannot hold, or the column holds one"
						+ " nothing could ever write into it")
				.containsExactlyInAnyOrderElementsOf(inTheColumn);
	}

	/**
	 * A FILE THAT IS NOT ONE OF THEM IS NOTHING, however it is named and whatever it says.
	 *
	 * <p>The three that are worth naming: a GIF, which is a real picture format the schema
	 * does not hold; plain text, which is what an attacker renames to {@code .jpg}; and a
	 * file that begins with the RIFF letters and is NOT a picture, which is the one case the
	 * four-letter signature alone would have let through.
	 */
	@ParameterizedTest
	@ValueSource(strings = { "GIF89a and then some", "Ovo je obican tekst, ne slika.",
			"<?xml version=\"1.0\"?><svg/>" })
	void whatIsNotOneOfTheThreeIsNotAPicture(String content) {
		assertThat(WhatAPictureIs.sniff(content.getBytes(StandardCharsets.UTF_8)))
				.as("the portal was willing to store %s as a picture", content)
				.isNull();
	}

	/**
	 * AND RIFF ALONE IS NOT A PICTURE, which is the whole reason that signature is two runs.
	 *
	 * <p>A {@code .wav} and an {@code .avi} begin with exactly the four letters {@code RIFF};
	 * what says the container holds a picture is {@code WEBP} at offset eight. Written as
	 * one run, this file would have been stored as {@code image/webp} and served to browsers
	 * under that type.
	 */
	@Test
	void aRiffThatIsNotAWebpIsNotAPicture() {
		byte[] wave = bytes('R', 'I', 'F', 'F', 0x10, 0x00, 0x00, 0x00, 'W', 'A', 'V', 'E');

		assertThat(WhatAPictureIs.sniff(wave))
				.as("a sound file beginning with the same four letters as a WebP was taken for a"
						+ " picture, so the second run of that signature is not being read")
				.isNull();
	}

	/**
	 * A FILE SHORTER THAN A SIGNATURE IS NOTHING, and it does not throw.
	 *
	 * <p>Two lengths and not one: shorter than the SHORTEST signature, and long enough for
	 * RIFF's first run and too short for its second. The second is the one an index check
	 * written only at the front of the file would walk off the end of.
	 */
	@ParameterizedTest
	@ValueSource(ints = { 0, 1, 2, 4, 7, 9, 11 })
	void aFileTooShortToCarryASignatureIsNotAPicture(int howMany) {
		byte[] cut = new byte[howMany];

		System.arraycopy(WEBP_HEAD, 0, cut, 0, howMany);

		assertThat(WhatAPictureIs.sniff(cut))
				.as("%d bytes of a WebP header were taken for a whole picture", howMany)
				.isNull();
	}

	/**
	 * THE SIGNATURE IS COMPARED UNSIGNED, which is the one mistake that would refuse every
	 * picture in the world.
	 *
	 * <p>PNG begins {@code 0x89} and JPEG {@code 0xFF}; a Java byte is signed, so both arrive
	 * as negative numbers. Compared without the mask neither would ever match. This case is
	 * the one that falls the moment somebody takes the {@code & 0xFF} out, and it is separate
	 * from the case above because that one would go on passing: everything would be „not a
	 * picture", which is what it asserts.
	 */
	@Test
	void theTwoSignaturesThatCarryAHighByteAreStillRecognised() {
		assertThat(WhatAPictureIs.sniff(like(PNG_HEAD, "x"))).isEqualTo("image/png");
		assertThat(WhatAPictureIs.sniff(like(JPEG_HEAD, "y"))).isEqualTo("image/jpeg");
	}

	/**
	 * THE DIGEST IS THE SHA-256 OF THE BYTES, in the shape V8's own check demands.
	 *
	 * <p>Compared against a digest taken here by a different road - {@link MessageDigest}
	 * asked directly - rather than against a string written down, because a hexadecimal
	 * constant in a test is a value somebody copied out of the thing it is measuring.
	 */
	@Test
	void theDigestIsTheOneTheColumnWillHold() throws Exception {
		for (byte[] one : theThree().values()) {
			String said = WhatAPictureIs.digestOf(one);

			assertThat(said)
					.as("the digest is not sixty four lowercase hexadecimal characters, which is"
							+ " the whole of what photo_digest_shape will hold")
					.matches("^[0-9a-f]{64}$");

			assertThat(said).isEqualTo(HexFormat.of()
					.formatHex(MessageDigest.getInstance("SHA-256").digest(one)));
		}
	}

	/**
	 * AND IT IS OVER THE WHOLE FILE, NOT OVER ITS HEAD.
	 *
	 * <p>Two files of one format whose first bytes agree and whose tails do not: hashed over
	 * the signature alone they would share an address, and {@link com.btl.portal.web.PhotoApi}
	 * serves a picture BY its digest - so one member's portrait would be answered for
	 * another's.
	 */
	@Test
	void twoPicturesThatBeginAlikeDoNotShareAnAddress() {
		assertThat(WhatAPictureIs.digestOf(like(JPEG_HEAD, "prva slika")))
				.isNotEqualTo(WhatAPictureIs.digestOf(like(JPEG_HEAD, "druga slika")));
	}

	/** And the same bytes always answer the same thing, which is what makes it an address. */
	@Test
	void theSameBytesAlwaysHaveTheSameAddress() {
		assertThat(WhatAPictureIs.digestOf(like(PNG_HEAD, "ista slika")))
				.isEqualTo(WhatAPictureIs.digestOf(like(PNG_HEAD, "ista slika")));
	}

	/**
	 * THE LIMIT IS A NUMBER SOMEBODY CAN READ, and this case says what it is rather than
	 * checking arithmetic.
	 *
	 * <p>It is here so that moving it is a deliberate act: the number is mine and not the
	 * owner's (see the constant), so the day he chooses another this case is what says
	 * somebody chose.
	 */
	@Test
	void theLimitIsFiveMegabytes() {
		assertThat(WhatAPictureIs.AT_MOST_BYTES).isEqualTo(5 * 1024 * 1024);
	}

	/**
	 * AND A MACHINE WITH NO SUCH ALGORITHM FAILS LOUDLY RATHER THAN QUIETLY.
	 *
	 * <p>{@code SecretToken} takes the algorithm as a parameter for exactly this reason: a
	 * branch that cannot be reached is a branch nobody can measure, and „every token in the
	 * portal would silently stop matching" is what it is written against. Here it is every
	 * picture's address instead, and the same sentence holds: a portal that cannot hash must
	 * not go on writing rows that claim to describe a file.
	 */
	@Test
	void aMachineWithNoSuchAlgorithmIsSaidSoRatherThanGuessedAround() {
		org.assertj.core.api.Assertions
				.assertThatThrownBy(() -> WhatAPictureIs.digestOf(new byte[] { 1 }, "SHA-999"))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("SHA-999");
	}
}
