package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.photo.PicturesThatCarryMetadata;
import com.btl.portal.domain.photo.WhatAPictureIs;
import com.btl.portal.domain.photo.WithoutMetadata;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE PICTURES STORED BEFORE THE METADATA WENT ARE CLEANED, ONCE, AND NOTHING ELSE IS TOUCHED.
 *
 * <p>ADL, owner, 06.11.2026, „postojeće slike na produkciji se jednom očiste". The rows a database in use
 * holds are the rows V88 marked, {@code may_carry_metadata = true}; a row written after V88 is false and is a
 * row a door has already cleaned. The axes, each with both sides in one run:
 * <ul>
 * <li>the type: a JPEG, a PNG and a WebP, each from a telephone, so a clean-up that skipped one type leaves
 * that one saying where it was taken;
 * <li>old and new: a row marked and a row not marked, both over a file that carries metadata, so a clean-up
 * that read every row rewrites the one it must not;
 * <li>with and without metadata: a marked row whose file carries none is marked done and its digest stays;
 * <li>a file that is there and one that is not: the missing one stays marked, to be tried again;
 * <li>once and twice: the second run moves nothing.
 * </ul>
 * The test's transaction holds every row and is rolled back; the clean-up's own transactions join it, which is
 * what {@code TransactionTemplate} does inside one that is already open.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class OldPicturesAreCleanedTest {

	private static final Path PHOTOS = aFolderOfThisRunsOwn();

	private static Path aFolderOfThisRunsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-cleaned-");
		} catch (IOException noFolder) {
			throw new IllegalStateException("no temporary folder to keep pictures in", noFolder);
		}
	}

	@DynamicPropertySource
	static void thePortalKeepsItsPicturesHere(DynamicPropertyRegistry registry) {
		registry.add("btl.photos.folder", PHOTOS::toString);
	}

	@Autowired
	private JdbcClient db;

	@Autowired
	private OldPicturesAreCleaned cleaning;

	private long stored(String mediaType, byte[] file, boolean mayCarry) throws IOException {
		long id = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter,"
						+ " may_carry_metadata) values (?, ?, ?, 0.5, 0.5, 0.5, ?) returning id")
				.params(mediaType, file.length, WhatAPictureIs.digestOf(file), mayCarry)
				.query(Long.class)
				.single();

		Files.write(PHOTOS.resolve(String.valueOf(id)), file);

		return id;
	}

	private String row(long photo) {
		return db.sql("select byte_size || ' ' || digest || ' ' || may_carry_metadata from photo where id = ?")
				.param(photo)
				.query(String.class)
				.single();
	}

	private byte[] fileOf(long photo) throws IOException {
		return Files.readAllBytes(PHOTOS.resolve(String.valueOf(photo)));
	}

	@Test
	void everyOldPictureOfEveryTypeIsCleanedItsDigestWrittenAgainAndANewOneIsNotTouched() throws IOException {
		byte[] jpeg = PicturesThatCarryMetadata.aTelephoneJpeg(6);
		byte[] png = PicturesThatCarryMetadata.aPngThatSaysEverything(6);
		byte[] webp = PicturesThatCarryMetadata.aTelephoneWebp(6);

		long oldJpeg = stored("image/jpeg", jpeg, true);
		long oldPng = stored("image/png", png, true);
		long oldWebp = stored("image/webp", webp, true);
		long new_ = stored("image/jpeg", jpeg, false);
		byte[] alreadyClean = WithoutMetadata.of(jpeg, "image/jpeg");
		long oldButClean = stored("image/jpeg", alreadyClean, true);
		long oldWithNoFile = stored("image/png", png, true);
		Files.delete(PHOTOS.resolve(String.valueOf(oldWithNoFile)));
		String newAsItWas = row(new_);
		String noFileAsItWas = row(oldWithNoFile);

		cleaning.clean();

		for (long photo : List.of(oldJpeg, oldPng, oldWebp)) {
			byte[] now = fileOf(photo);

			assertThat(PicturesThatCarryMetadata.says(now, PicturesThatCarryMetadata.WHERE_AND_WITH_WHAT))
					.as("picture %s still says where, when and with what it was taken", photo)
					.isFalse();
			assertThat(row(photo))
					.as("the row of picture %s does not describe the cleaned file, or does not say it was done", photo)
					.isEqualTo(now.length + " " + WhatAPictureIs.digestOf(now) + " false");
		}

		assertThat(fileOf(oldJpeg)).isEqualTo(alreadyClean);
		assertThat(fileOf(oldPng)).isEqualTo(WithoutMetadata.of(png, "image/png"));
		assertThat(fileOf(oldWebp)).isEqualTo(WithoutMetadata.of(webp, "image/webp"));

		assertThat(fileOf(new_)).as("a picture a door wrote after V88 was rewritten").isEqualTo(jpeg);
		assertThat(row(new_)).isEqualTo(newAsItWas);

		assertThat(fileOf(oldButClean)).isEqualTo(alreadyClean);
		assertThat(row(oldButClean)).isEqualTo(alreadyClean.length + " " + WhatAPictureIs.digestOf(alreadyClean)
				+ " false");

		assertThat(row(oldWithNoFile)).as("a row whose file could not be read was marked done").isEqualTo(noFileAsItWas);

		String[] before = { row(oldJpeg), row(oldPng), row(oldWebp), row(oldButClean) };
		byte[] jpegBefore = fileOf(oldJpeg);

		cleaning.clean();

		assertThat(new String[] { row(oldJpeg), row(oldPng), row(oldWebp), row(oldButClean) })
				.as("a second run moved something")
				.containsExactly(before);
		assertThat(fileOf(oldJpeg)).isEqualTo(jpegBefore);
	}

	@Test
	void aPictureThatCannotBeWrittenBackStaysMarkedAndIsCleanedOnTheNextRun() throws IOException {
		byte[] jpeg = PicturesThatCarryMetadata.aTelephoneJpeg(8);
		long photo = stored("image/jpeg", jpeg, true);
		String asItWas = row(photo);

		/* A FOLDER WHERE THE CLEANED BYTES WOULD BE WRITTEN, with something in it, so the write is refused and
		   the delete in `finally` is refused too, on every system this is built on. */
		Path inTheWay = PHOTOS.resolve(photo + ".clean");
		Files.createDirectories(inTheWay);
		Files.write(inTheWay.resolve("x"), new byte[] { 1 });

		cleaning.clean();

		assertThat(row(photo)).as("a row whose file was not written back was marked done").isEqualTo(asItWas);
		assertThat(fileOf(photo)).isEqualTo(jpeg);

		Files.delete(inTheWay.resolve("x"));
		Files.delete(inTheWay);
		cleaning.clean();

		assertThat(fileOf(photo)).isEqualTo(WithoutMetadata.of(jpeg, "image/jpeg"));
		assertThat(Files.exists(inTheWay)).as("the file written beside the picture was left behind").isFalse();
	}

	@Test
	void aRowDoneByTheTimeItsTurnComesIsPassedOver() throws IOException {
		byte[] jpeg = PicturesThatCarryMetadata.aTelephoneJpeg(6);
		long photo = stored("image/jpeg", jpeg, false);

		cleaning.clean(photo);

		assertThat(fileOf(photo)).isEqualTo(jpeg);
	}

	@Test
	void itRunsAtStartAndEveryHour() throws NoSuchMethodException {
		Scheduled when = OldPicturesAreCleaned.class.getDeclaredMethod("clean").getAnnotation(Scheduled.class);

		assertThat(when.initialDelay()).as("P13: the job is tried at every start until it passes").isZero();
		assertThat(when.fixedDelay()).isOne();
		assertThat(when.timeUnit()).isEqualTo(TimeUnit.HOURS);
	}
}
