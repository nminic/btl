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
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

/**
 * TWO PICTURES SENT AT ONCE BY A MEMBER WHO HAS TWO WAITING LEAVE THREE WAITING, NEVER FOUR.
 *
 * <p>The owner, 28.11.2026: „Član sme da drži najviše tri slike kao dokaz na čekanju istovremeno; četvrta se
 * odbija". A count asked and then acted on passes every case that sends one request at a time, so the order is
 * taken from the scheduler the way {@code APictureSentTwiceAtOnceTest} takes it: the member's own row is held
 * before anything is sent, every request stops where its first insert takes {@code FOR KEY SHARE} on that row
 * through the foreign key, or behind the turn of the one that got there first, and only when the lock manager
 * shows both stopped is the row let go. Without the turn both would have counted two before either wrote.
 *
 * <p>Through the correction, which asks no season, so the day it runs on does not matter. Not
 * {@code @Transactional}: the requests need connections and transactions of their own, so the rows are real
 * commits and {@link #takeBackWhatWasCommitted} takes them out.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AFourthProofSentAtOnceTest {

	private static final String ME = "000941";

	private static final String MY_ADDRESS = "cetvrti-dokaz-odjednom@primer.rs";

	private static final Path PHOTOS = aFolderOfThisRunsOwn();

	private static Path aFolderOfThisRunsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-fourth-proof-");
		}
		catch (IOException noFolder) {
			throw new UncheckedIOException(noFolder);
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

	@Autowired
	private TransactionTemplate holdingTheRow;

	private SecretToken session;

	private long picturesBefore;

	private long me;

	private long event;

	private long result;

	@BeforeEach
	void oneMemberWithOneResultAndTwoPicturesWaiting() throws Exception {
		picturesBefore = db.sql("select coalesce(max(id), 0) from photo").query(Long.class).single();

		me = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Cetvrti', 'Dokazic', 'F', date '1990-01-01', (select id from place where rank = 1),"
						+ " 2027, '0000000000000941', '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00') returning id")
				.param(ME).query(Long.class).single();

		HeldOn.activeAt(db, ME, ZonedDateTime.now());

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Cetvrti', 'Dokazic', ?, (select id from role where code = 'competitor'), ?)")
				.params(MY_ADDRESS, me).update();

		session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(MY_ADDRESS, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		event = db.sql("insert into btl_event (slug, name, date, place_id, kind, featured, description, link)"
						+ " values ('cetvrti-dokaz-odjednom', 'Cetvrti dokaz', date '2027-04-04',"
						+ " (select id from place where rank = 1), 'race', false, '', '') returning id")
				.query(Long.class).single();

		long race = db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds, distance_km,"
						+ " ascent_m, descent_m) values (?, 'Cetvrti dokaz', false, date '2027-04-04', 'length', 0,"
						+ " 21.10, 0, 0) returning id")
				.param(event).query(Long.class).single();

		result = db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points) values (?, ?, date '2027-04-04', 21.10, 0, 0, 6000, 50.00)"
						+ " returning id")
				.params(me, race).query(Long.class).single();

		for (String one : List.of("prva koja ceka", "druga koja ceka")) {
			assertThat(corrected(one).getStatus()).as("a picture that is to be waiting was not taken").isEqualTo(200);
		}
	}

	@AfterEach
	void takeBackWhatWasCommitted() {
		db.sql("delete from message where to_id = ?").param(me).update();
		db.sql("delete from result_submission where competitor_id = ?").param(me).update();
		db.sql("delete from verification where competitor_id = ?").param(me).update();
		db.sql("delete from photo where id > ?").param(picturesBefore).update();
		db.sql("delete from result where id = ?").param(result).update();
		db.sql("delete from btl_event where id = ?").param(event).update();
		db.sql("delete from account where email = ?").param(MY_ADDRESS).update();
		db.sql("delete from competitor where id = ?").param(me).update();
	}

	@Test
	void twoSentAtOnceOverTwoWaitingLeaveThreeAndRefuseOne() throws Exception {
		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<MockHttpServletResponse>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				db.sql("select 1 from competitor where id = ? for update").param(me).query(Integer.class).single();

				assertThat(BlockedBehindThisHold.count(db)).isZero();

				submitted.add(pool.submit(() -> corrected("treca, istovremeno")));
				submitted.add(pool.submit(() -> corrected("cetvrta, istovremeno")));

				Instant deadline = Instant.now().plusSeconds(10);

				while (BlockedBehindThisHold.count(db) < 2) {
					if (Instant.now().isAfter(deadline)) {
						throw new IllegalStateException("both requests should have stopped behind the held row");
					}

					try {
						Thread.sleep(20);
					}
					catch (InterruptedException interrupted) {
						Thread.currentThread().interrupt();
						throw new IllegalStateException(interrupted);
					}
				}

				assertThat(submitted).noneMatch(Future::isDone);

				return null;
			});

			List<Integer> statuses = new ArrayList<>();
			List<String> bodies = new ArrayList<>();

			for (Future<MockHttpServletResponse> one : submitted) {
				MockHttpServletResponse answered = one.get(30, TimeUnit.SECONDS);

				statuses.add(answered.getStatus());
				bodies.add(answered.getContentAsString(StandardCharsets.UTF_8));
			}

			assertThat(statuses).containsExactlyInAnyOrder(200, 400);
			assertThat(bodies).anyMatch(body -> body.contains(ResultWriteApi.THREE_PICTURES_WAIT));
			assertThat(db.sql("select count(*) from verification where competitor_id = ? and queue = 'results'"
							+ " and state = 'waiting' and photo_id is not null")
					.param(me).query(Long.class).single())
					.as("two sent at once over two waiting left other than three")
					.isEqualTo(3L);
		}
		finally {
			pool.shutdownNow();
		}
	}

	private MockHttpServletResponse corrected(String picture) throws Exception {
		byte[] rest = picture.getBytes(StandardCharsets.UTF_8);
		byte[] jpeg = new byte[3 + rest.length];

		jpeg[0] = (byte) 0xFF;
		jpeg[1] = (byte) 0xD8;
		jpeg[2] = (byte) 0xFF;
		System.arraycopy(rest, 0, jpeg, 3, rest.length);

		return http.perform(multipart("/api/results/" + result)
						.file(new MockMultipartFile("picture", "sat.jpg", MediaType.IMAGE_JPEG_VALUE, jpeg))
						.param("run", "{\"distanceKm\":\"21.10\",\"ascentM\":0,\"descentM\":0,\"seconds\":5000,"
								+ "\"link\":\"\",\"comment\":\"Sat\"}")
						.with(request -> {
							request.setMethod("PUT");
							return request;
						})
						.with(csrf())
						.cookie(new Cookie(SessionCookie.NAME, session.secret())))
				.andReturn().getResponse();
	}
}
