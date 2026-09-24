package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;

/**
 * TAKING A PICTURE DOWN EMPTIES THE ROW EVEN ON A DISK THAT WILL NOT GIVE THE FILE BACK.
 *
 * <p><b>NOT {@code @Transactional}, for the same reason {@code ThePictureAndItsFileAreOneThingTest}
 * gives for standing apart from {@code MePhotoApiTest}:</b> a test-managed transaction always
 * unwinds at the end of the case regardless of what the route decided inside it, so with
 * {@code rollbackFor} right and with it wrong the table looks the same when the case itself
 * never really commits anything. Only a real commit tells them apart, and this class exists so
 * one happens.
 *
 * <p><b>HERE THAT IS NOT A THEORY EITHER.</b> A security review on 25.09.2026 found
 * {@code MePhotoApi.remove} carrying {@code rollbackFor = IOException.class}, the same
 * attribute {@code send} needs, copied onto a method the owner's decision reads the opposite
 * way: PDL P28b, 3, 24.09.2026, „Brisanje slike stupa odmah, bez moderacije... Uklanjanje ne
 * moze da bude sporno." On {@code send} a rollback keeps that promise - a row survives only
 * with its file. On {@code remove} the SAME rollback breaks it: the row and the pointer that
 * were about to make the removal true are undone by nothing worse than a file that refused to
 * leave the disk, and the picture stays exactly as published as it was before the member asked.
 *
 * <p><b>HOW THE DELETE IS MADE TO FAIL, with no line of production code knowing about this
 * case.</b> The picture's file is not a file at all but a directory with something inside it,
 * which is a property of a file system rather than of anything stubbed:
 * {@code Files.deleteIfExists} on a non-empty directory throws
 * {@link java.nio.file.DirectoryNotEmptyException}, a checked {@link IOException} and exactly
 * the class {@code rollbackFor} used to name.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class TheRemovalStandsEvenWhenTheFileWontGoTest {

	private static final String ME = "000901";

	private static final String MY_ADDRESS = "uklanjanje-i-fajl@primer.rs";

	/**
	 * A FOLDER OF THIS RUN'S OWN, for the reason {@code MePhotoApiTest} measured for its own: a
	 * folder shared with another run, or another worktree, could collide on the same name.
	 */
	private static final Path PHOTOS = aFolderOfThisRunsOwn();

	private static Path aFolderOfThisRunsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-removal-");
		}
		catch (IOException noFolder) {
			throw new IllegalStateException("no temporary folder to keep pictures in", noFolder);
		}
	}

	@DynamicPropertySource
	static void thePortalKeepsItsPicturesHere(DynamicPropertyRegistry registry) {
		registry.add("btl.photos.folder", PHOTOS::toString);
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private SecretToken session;

	/** The picture standing on this member's profile, made undeletable before each case. */
	private long photo;

	@BeforeEach
	void oneMemberWithAPictureStandingBehindAFileThatCannotLeave() throws IOException {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at)"
						+ " values (?, 'Uklonjen', 'Uklonjenovic', 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " '00000000000009fd', '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00')")
				.param(ME).update();

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Roditelj', 'Roditeljevic', ?,"
						+ " (select id from role where code = 'competitor'),"
						+ " (select id from competitor where member_number = ?))")
				.params(MY_ADDRESS, ME).update();

		session = SecretToken.fresh();
		Instant issuedAt = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(MY_ADDRESS, session.hash(),
						Timestamp.from(issuedAt.minus(Duration.ofDays(1))),
						Timestamp.from(issuedAt), Timestamp.from(issuedAt.plus(SessionLife.LASTS)))
				.update();

		String digest = String.format("%064x", 1);

		photo = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values ('image/jpeg', 40960, ?, 0.3, 0.7, 0.45)"
						+ " returning id")
				.param(digest).query(Long.class).single();

		db.sql("update competitor set photo_id = ? where member_number = ?")
				.params(photo, ME).update();

		/* A NON-EMPTY DIRECTORY WHERE THE FILE SHOULD BE. `Files.deleteIfExists` refuses a
		   directory that still holds something, which is a real filesystem property rather
		   than a mock standing in for one. */
		Path wherePictureShouldBe = PHOTOS.resolve(String.valueOf(photo));

		Files.createDirectory(wherePictureShouldBe);
		Files.writeString(wherePictureShouldBe.resolve("nemoguce-obrisati.txt"), "x");
	}

	/** Everything this case wrote goes again, because nothing here is inside a transaction. */
	@AfterEach
	void takeBackWhatWasReallyCommitted() throws IOException {
		db.sql("delete from photo where id = ?").param(photo).update();
		db.sql("delete from account where email = ?").param(MY_ADDRESS).update();
		db.sql("delete from competitor where member_number = ?").param(ME).update();

		Path madeUndeletable = PHOTOS.resolve(String.valueOf(photo));

		Files.deleteIfExists(madeUndeletable.resolve("nemoguce-obrisati.txt"));
		Files.deleteIfExists(madeUndeletable);
	}

	/**
	 * @return whatever came out of the request. {@code Files.deleteIfExists} throws inside the
	 *         transactional method and no line here catches it, so a portal that still rolls
	 *         back on it never reaches {@code ResponseEntity.ok} at all
	 */
	private Throwable removingMyPicture() {
		return catchThrowable(() -> http.perform(delete("/api/me/photo").with(csrf())
				.cookie(new Cookie(SessionCookie.NAME, session.secret()))));
	}

	/**
	 * A REMOVAL THE OWNER CALLED IMMEDIATE STAYS IMMEDIATE EVEN WHEN THE FILE WILL NOT GO.
	 *
	 * <p><b>The mutation this is written against is one token:</b> putting
	 * {@code rollbackFor = IOException.class} back on {@code remove}. With it back, the
	 * {@link java.nio.file.DirectoryNotEmptyException} this case forces rolls the two
	 * statements above it back too, and a removal that was supposed to happen at once leaves
	 * the picture exactly as published as it was before the request.
	 */
	@Test
	void aFileThatCannotBeRemovedDoesNotBringThePictureBack() {
		assertThat(removingMyPicture())
				.as("the disk was told to hold this member's picture behind a directory it"
						+ " cannot delete and did not fail, so this case is measuring nothing")
				.isNotNull();

		assertThat(db.sql("select photo_id from competitor where member_number = ?").param(ME)
						.query(Long.class).optional())
				.as("the pointer survived a removal the owner called immediate, so the member's"
						+ " old picture is still exactly as published as before the request")
				.isEmpty();

		assertThat(db.sql("select count(*) from photo where id = ?").param(photo)
						.query(Long.class).single())
				.as("the photo row survived a removal the owner called immediate")
				.isZero();
	}
}
