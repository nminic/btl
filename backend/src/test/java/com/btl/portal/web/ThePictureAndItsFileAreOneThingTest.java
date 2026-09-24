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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

/**
 * A PICTURE'S ROW AND ITS FILE ARE ONE REQUEST: BOTH HAPPEN OR NEITHER DOES.
 *
 * <p><b>NOT {@code @Transactional}, AND THAT IS THE WHOLE REASON THIS FILE IS SEPARATE FROM
 * {@code MePhotoApiTest}.</b> It is the same arrangement, and the same reason,
 * {@code TheSwitchAndTheTextAreOneThingTest} gives for standing apart from
 * {@code MeWriteApiTest}: a test-managed transaction swallows the question it is asked,
 * because the route joins it and every half-finished write disappears at the end of the case
 * whatever the route did.
 *
 * <p><b>HERE THAT IS NOT A THEORY BUT WHAT ACTUALLY HAPPENED.</b> A security review on
 * 25.09.2026 found that {@code MePhotoApi.send} was committing a picture's row and its queue
 * card when the FILE could not be written - and that its own javadoc claimed the opposite in
 * as many words. Spring rolls back on a {@link RuntimeException} and an {@link Error} and
 * COMMITS on a checked one, and {@link IOException} is checked, so the mapping needed
 * {@code rollbackFor} and did not have it. {@code MePhotoApiTest} was green at 34 of 34
 * throughout, and could not have been anything else: inside its transaction there is nothing
 * to commit.
 *
 * <p><b>WHAT THE FAULT COST, which is why it was high rather than tidy.</b> A passing fault
 * of the disk - full, unwritable, a folder that is not there - left a queue card pointing at
 * a {@code photo} row whose file never existed. The member was answered 500, and then refused
 * for ever: the next attempt met {@code aPictureAlreadyWaits}, and he cannot take back a
 * picture a moderator is holding, because {@code DELETE /api/me/photo} deliberately removes
 * only what STANDS. The one way out was a moderator approving a picture {@link PhotoApi}
 * could never serve.
 *
 * <p><b>HOW THE WRITE IS MADE TO FAIL, with no line of production code knowing about this
 * case.</b> The folder setting is pointed at an ordinary FILE. {@code Files.createDirectories}
 * then throws because the path exists and is not a directory, which is a property of a file
 * system rather than of anything stubbed, and it arrives exactly where a full disk would.
 *
 * <p><b>AND BOTH DIRECTIONS ARE MEASURED</b>, because a case that only asserted the empty
 * table would pass against a route that never wrote anything at all. The second case sends
 * the same picture into a folder that really is one and requires exactly one row of each.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ThePictureAndItsFileAreOneThingTest {

	private static final String ME = "000900";

	private static final String MY_ADDRESS = "slika-i-fajl@primer.rs";

	/**
	 * A PLAIN FILE WHERE THE PORTAL EXPECTS A FOLDER.
	 *
	 * <p>Made before the context is built, for the reason {@code MePhotoApiTest} gives about
	 * its own: {@code @DynamicPropertySource} runs while the context is coming up and has to
	 * be able to answer with a path that already exists.
	 */
	private static final Path NOT_A_FOLDER = aFileWhereAFolderShouldBe();

	private static Path aFileWhereAFolderShouldBe() {
		try {
			Path made = Files.createTempFile("btl-photos-not-a-folder-", ".txt");

			Files.writeString(made, "ovo je fajl, ne folder");

			return made;
		}
		catch (IOException noFile) {
			throw new IllegalStateException("no temporary file to stand in a folder's place",
					noFile);
		}
	}

	@DynamicPropertySource
	static void thePortalIsToldToKeepItsPicturesInAFile(DynamicPropertyRegistry registry) {
		registry.add("btl.photos.folder", NOT_A_FOLDER::toString);
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private SecretToken session;

	/** Where the table stood before this case, so the clean up takes only what it wrote. */
	private long picturesBefore;

	@BeforeEach
	void oneMemberWithOneSessionAndNothingWaiting() {
		picturesBefore = highestPicture();

		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at)"
						+ " values (?, 'Slikan', 'Slikic', 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " '00000000000009ff', '', false, 'none', 'Otac', 'Ulica 1', 'M',"
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
	}

	/**
	 * EVERYTHING THIS CLASS WROTE GOES AGAIN, because nothing here is inside a transaction.
	 *
	 * <p>{@code TeamProposalAndItsQueueRowAreOneThingTest}'s arrangement, and the ORDER is the
	 * schema's rather than a preference. The queue row goes before the picture, because
	 * {@code verification_photo_fk} points at {@code photo}. The ACCOUNT goes before the
	 * member, and the first draft of this said it went „by cascade" - which was wrong and
	 * failed here at once: {@code account_competitor_fk} is RESTRICT, so a member with an
	 * account cannot be deleted at all. The account takes its own session with it, and THAT
	 * one really is a cascade ({@code account_session_account_fk}).
	 */
	@AfterEach
	void takeBackWhatWasReallyCommitted() {
		db.sql("delete from verification where competitor_id ="
				+ " (select id from competitor where member_number = ?)").param(ME).update();

		/* ONLY WHAT THIS CASE WROTE. A sweep over „every picture nothing points at" would
		   reach rows other classes committed, and this is the one file here that commits at
		   all - so the boundary is the key, taken before the case ran. */
		db.sql("delete from photo where id > ?").param(picturesBefore).update();

		db.sql("delete from account where email = ?").param(MY_ADDRESS).update();

		db.sql("delete from competitor where member_number = ?").param(ME).update();
	}

	private long howManyPictures() {
		return db.sql("select count(*) from photo").query(Long.class).single();
	}

	private long highestPicture() {
		return db.sql("select coalesce(max(id), 0) from photo").query(Long.class).single();
	}

	private long howManyQueueRowsOfMine() {
		return db.sql("select count(*) from verification where competitor_id ="
				+ " (select id from competitor where member_number = ?)")
				.param(ME).query(Long.class).single();
	}

	/**
	 * @return whatever came out of the request, or null when it answered cleanly. A refusal
	 *         this route decides - a 409, a 400 - is an ANSWER and throws nothing, so a null
	 *         here really does mean „the portal replied" rather than „the disk was fine"
	 */
	private Throwable sendingAPicture() {
		return catchThrowable(() -> http.perform(multipart("/api/me/photo").with(csrf())
				.file(new MockMultipartFile("picture", "portret.jpg", MediaType.IMAGE_JPEG_VALUE,
						aJpeg()))
				.param("cropX", "0.25").param("cropY", "0.75").param("cropSize", "0.5")
				.cookie(new Cookie(SessionCookie.NAME, session.secret()))));
	}

	private static byte[] aJpeg() {
		byte[] head = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF };
		byte[] tail = "ostatak slike".getBytes(StandardCharsets.UTF_8);
		byte[] whole = new byte[head.length + tail.length];

		System.arraycopy(head, 0, whole, 0, head.length);
		System.arraycopy(tail, 0, whole, head.length, tail.length);

		return whole;
	}

	/**
	 * A FILE THAT COULD NOT BE WRITTEN LEAVES NO ROW AND NO CARD BEHIND.
	 *
	 * <p><b>The mutation this is written against is one token:</b> taking
	 * {@code rollbackFor = IOException.class} off the mapping. Both counts then come back
	 * one, and the member is blocked for ever by a card nobody can act on.
	 */
	@Test
	void aFileThatCouldNotBeWrittenLeavesNothingClaimingIt() {
		long howMany = howManyPictures();

		assertThat(sendingAPicture())
				.as("the portal was told to keep its pictures in a plain file and did not fail"
						+ " at all, so this case is measuring nothing")
				.isNotNull();

		assertThat(howManyPictures())
				.as("A PICTURE ROW SURVIVED A FILE THAT WAS NEVER WRITTEN. PhotoApi can serve"
						+ " nothing for it, and the card below keeps the member out for ever.")
				.isEqualTo(howMany);

		assertThat(howManyQueueRowsOfMine())
				.as("a queue card survived, so the member meets aPictureAlreadyWaits on every"
						+ " later attempt and cannot take back what a moderator is holding")
				.isZero();
	}

	/**
	 * AND HE IS NOT BLOCKED AFTERWARDS, which is the half a member actually feels.
	 *
	 * <p>Written as a second case rather than as another assertion in the first, because it
	 * is a different sentence: the first says the table is clean, and this says the PORTAL
	 * behaves as though it is. A route that rolled the rows back and left something else
	 * standing would pass the first and fail this.
	 */
	@Test
	void aFailedAttemptDoesNotBlockTheNextOne() {
		assertThat(sendingAPicture()).isNotNull();

		assertThat(sendingAPicture())
				.as("the second attempt was refused rather than failing on the disk again, which"
						+ " means the first one left a card behind")
				.isNotNull();

		assertThat(howManyQueueRowsOfMine()).isZero();
	}
}
