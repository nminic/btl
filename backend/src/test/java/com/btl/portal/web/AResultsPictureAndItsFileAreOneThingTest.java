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
import org.springframework.mock.web.MockPart;
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
import java.time.ZonedDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

/**
 * A RUN AND THE FILE OF ITS PICTURE ARE ONE REQUEST: A FILE THAT CANNOT BE WRITTEN LEAVES NO RUN, NO QUEUE ROW
 * AND NO PICTURE BEHIND.
 *
 * <p>{@code ThePictureAndItsFileAreOneThingTest}'s arrangement for {@code MePhotoApi}, and its reason: not
 * {@code @Transactional}, because a test-managed transaction swallows the question; and the folder setting
 * pointed at an ordinary FILE, so {@code Files.createDirectories} throws where a full disk would, with no line
 * of production code knowing about this case. Without the rollback a moderator would be shown a run whose proof
 * nobody can see.
 *
 * <p>Through the correction, because a correction asks no season and this class has no clock of its own: the
 * day it runs is whatever day it is.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AResultsPictureAndItsFileAreOneThingTest {

	private static final String ME = "000931";

	private static final String MY_ADDRESS = "dokaz-i-fajl@primer.rs";

	private static final Path NOT_A_FOLDER = aFileWhereAFolderShouldBe();

	private static Path aFileWhereAFolderShouldBe() {
		try {
			Path made = Files.createTempFile("btl-photos-proof-not-a-folder-", ".txt");

			Files.writeString(made, "ovo je fajl, ne folder");

			return made;
		}
		catch (IOException noFile) {
			throw new IllegalStateException("no temporary file to stand in a folder's place", noFile);
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

	private long picturesBefore;

	private long event;

	private long result;

	@BeforeEach
	void oneMemberWithOneResult() {
		picturesBefore = db.sql("select coalesce(max(id), 0) from photo").query(Long.class).single();

		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Dokaz', 'Fajlic', 'F', date '1990-01-01', (select id from place where rank = 1),"
						+ " 2027, '0000000000000931', '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00')")
				.param(ME).update();

		HeldOn.activeAt(db, ME, ZonedDateTime.now());

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Dokaz', 'Fajlic', ?, (select id from role where code = 'competitor'),"
						+ " (select id from competitor where member_number = ?))")
				.params(MY_ADDRESS, ME).update();

		session = SecretToken.fresh();
		Instant issuedAt = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(MY_ADDRESS, session.hash(), Timestamp.from(issuedAt.minus(Duration.ofDays(1))),
						Timestamp.from(issuedAt), Timestamp.from(issuedAt.plus(SessionLife.LASTS)))
				.update();

		event = db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
						+ " values ('dokaz-i-fajl', 'Dokaz i fajl', date '2027-04-04',"
						+ " (select id from place where rank = 1), 'race', false, '', '') returning id")
				.query(Long.class).single();

		long race = db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km,"
						+ " ascent_m, descent_m) values (?, 'Dokaz i fajl', false, date '2027-04-04', 'length', 0,"
						+ " 21.10, 0, 0) returning id")
				.param(event).query(Long.class).single();

		result = db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points) values ((select id from competitor where member_number = ?),"
						+ " ?, date '2027-04-04', 21.10, 0, 0, 6000, 50.00) returning id")
				.params(ME, race).query(Long.class).single();
	}

	/** Everything this class wrote, in the order the keys allow (`ThePictureAndItsFileAreOneThingTest`). */
	@AfterEach
	void takeBackWhatWasReallyCommitted() {
		db.sql("delete from message where to_id = (select id from competitor where member_number = ?)")
				.param(ME).update();
		db.sql("delete from result_submission where competitor_id ="
				+ " (select id from competitor where member_number = ?)").param(ME).update();
		db.sql("delete from verification where competitor_id ="
				+ " (select id from competitor where member_number = ?)").param(ME).update();
		db.sql("delete from photo where id > ?").param(picturesBefore).update();
		db.sql("delete from result where id = ?").param(result).update();
		db.sql("delete from btl_event where id = ?").param(event).update();
		db.sql("delete from account where email = ?").param(MY_ADDRESS).update();
		db.sql("delete from competitor where member_number = ?").param(ME).update();
	}

	private long whatASendWrites() {
		return db.sql("select (select count(*) from photo where id > ?)"
						+ " + (select count(*) from verification v join competitor c on c.id = v.competitor_id"
						+ "    where c.member_number = ?)"
						+ " + (select count(*) from result_submission s join competitor c on c.id = s.competitor_id"
						+ "    where c.member_number = ?)")
				.params(picturesBefore, ME, ME).query(Long.class).single();
	}

	/**
	 * A FILE THAT COULD NOT BE WRITTEN LEAVES NOTHING CLAIMING IT. The mutation this is written against is the
	 * file written after the transaction rather than inside it, or its fault swallowed: the three rows then
	 * commit and the moderator meets a proof whose file never was.
	 */
	@Test
	void aFileThatCouldNotBeWrittenLeavesNoRunAndNoPictureBehind() {
		Throwable thrown = catchThrowable(() -> http.perform(multipart("/api/results/" + result)
				.file(new MockMultipartFile("picture", "sat.jpg", MediaType.IMAGE_JPEG_VALUE,
						new byte[] { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 'x' }))
				.part(new MockPart("run", "{\"distanceKm\":\"21.10\",\"ascentM\":0,\"descentM\":0,\"seconds\":5000,"
						+ "\"link\":\"\",\"comment\":\"Sat\"}".getBytes(StandardCharsets.UTF_8)))
				.with(request -> {
					request.setMethod("PUT");
					return request;
				})
				.with(csrf())
				.cookie(new Cookie(SessionCookie.NAME, session.secret()))));

		assertThat(thrown).as("the portal was told to keep its pictures in a plain file and did not fail").isNotNull();
		assertThat(whatASendWrites()).isZero();
	}

	/** And the same correction with no picture goes through, so the case above measured the file and not the
	 *  correction. */
	@Test
	void theSameCorrectionWithNoPictureGoesThrough() throws Exception {
		int status = http.perform(multipart("/api/results/" + result)
						.part(new MockPart("run", "{\"distanceKm\":\"21.10\",\"ascentM\":0,\"descentM\":0,\"seconds\":5000,"
								+ "\"link\":\"https://rezultati.rs/x\",\"comment\":\"Sat\"}".getBytes(StandardCharsets.UTF_8)))
						.with(request -> {
							request.setMethod("PUT");
							return request;
						})
						.with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, session.secret())))
				.andReturn().getResponse().getStatus();

		assertThat(status).isEqualTo(200);
		assertThat(whatASendWrites()).isEqualTo(2);
		assertThat(new String(Files.readAllBytes(NOT_A_FOLDER), StandardCharsets.UTF_8))
				.isEqualTo("ovo je fajl, ne folder");
	}
}
