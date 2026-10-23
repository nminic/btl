package com.btl.portal.web;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.photo.SmallPicture;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * THE SMALL PICTURE A CIRCLE DRAWS, ASKED FOR AT THE ADDRESS THE ANSWERS HAND OUT.
 *
 * <p>PDL, 23.10.2026: „Server pravi i šalje umanjenu, već isečenu sliku za kružiće". Every case
 * here walks the address as {@code /api/competitors}, {@code /api/me} or {@code /api/teams}
 * hands it out, never one spelt in this file, so the address and the door are measured as one
 * thing: an answer that spelt the circle one way and a door that read it another would be a
 * circle that never draws, and both halves would pass alone.
 *
 * <p><b>The pictures are real</b>, the same drawing {@code SmallPictureTest} uses: a red field
 * with one blue square, and a circle chosen exactly over it, so a right cut is blue in the
 * middle and the original, a cut of the whole picture, or a cut of another circle is not.
 *
 * <p><b>The axes, each in the fixture with both of its states</b>: a picture in the open and one
 * whose member hides his profile; a circle a public holder has and the same digest under a
 * circle only a waiting row has; a member's portrait and a team's see-through mark; a row whose
 * file is there, one whose file is gone, and one whose file is not a picture.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class SmallPhotoApiTest {

	private static final String FACE = "5a".repeat(32);

	private static final String HIDDEN = "6b".repeat(32);

	private static final String MARK = "7c".repeat(32);

	private static final String WAITING_ONLY = "8d".repeat(32);

	private static final String NO_FILE = "9e".repeat(32);

	private static final String NOT_A_PICTURE = "af".repeat(32);

	/** The circle over the blue square of a 400 by 300 picture with the square at 250, 50. */
	private static final BigDecimal[] OVER_THE_SQUARE = { new BigDecimal("0.83333333"),
			new BigDecimal("0.25"), new BigDecimal("0.33333333") };

	/** Another circle of the same picture: its top left corner, which is red. */
	private static final BigDecimal[] IN_THE_CORNER = { new BigDecimal("0"), new BigDecimal("0"),
			new BigDecimal("0.33333333") };

	private static final String HE = "on@primer.rs";

	private static final String AN_ACTIVE_MEMBER = "clan@primer.rs";

	private static final Path FOLDER = aFolderOfItsOwn();

	@DynamicPropertySource
	static void whereThePicturesAre(DynamicPropertyRegistry settings) {
		settings.add("btl.photos.folder", FOLDER::toString);
	}

	private static Path aFolderOfItsOwn() {
		try {
			return Files.createTempDirectory("btl-small-photos-case");
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private int issued;

	private long theFacesWaitingRow;

	private final ListAppender<ILoggingEvent> log = new ListAppender<>();

	@BeforeEach
	void picturesInTheOpenHiddenWaitingAndBroken() {
		long face = picture(FACE, "image/jpeg", OVER_THE_SQUARE, drawn("jpeg"));
		long hidden = picture(HIDDEN, "image/jpeg", OVER_THE_SQUARE, drawn("jpeg"));
		long mark = picture(MARK, "image/png", new BigDecimal[] { new BigDecimal("0.5"),
				new BigDecimal("0.5"), new BigDecimal("1") }, seeThroughMark());
		long waitingOnly = picture(WAITING_ONLY, "image/jpeg", OVER_THE_SQUARE, drawn("jpeg"));
		long noFile = picture(NO_FILE, "image/jpeg", OVER_THE_SQUARE, null);
		long notAPicture = picture(NOT_A_PICTURE, "image/jpeg", OVER_THE_SQUARE,
				new byte[] { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 'n', 'o' });

		/* THE SAME BYTES UNDER ANOTHER CIRCLE, held only by a row that waits: the member moved
		   his circle over his approved picture (PDL, 27.09.2026), and until a moderator decides
		   the circle he moved it to is nobody's to see. */
		theFacesWaitingRow = picture(FACE, "image/jpeg", IN_THE_CORNER, drawn("jpeg"));

		competitor("000951", face, false);
		competitor("000952", hidden, true);
		competitor("000953", noFile, false);
		competitor("000954", notAPicture, false);
		competitor("000955", null, false);
		waiting("000951", theFacesWaitingRow);
		waiting("000955", waitingOnly);
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id,"
						+ " first_season, admin_id) values ('tim-sa-znakom', 'Tim sa znakom', '',"
						+ " '', (select id from place where rank = 1), null, null, ?, 2027, null)")
				.param(mark)
				.update();

		account(HE, "000951");
		account(AN_ACTIVE_MEMBER, "000955");

		Logger photos = (Logger) LoggerFactory.getLogger(PhotoApi.class);
		log.start();
		photos.addAppender(log);
	}

	@AfterEach
	void theFolderIsLeftEmptyAndTheLogAlone() throws IOException {
		((Logger) LoggerFactory.getLogger(PhotoApi.class)).detachAppender(log);

		try (Stream<Path> left = Files.walk(FOLDER)) {
			for (Path one : left.sorted(Comparator.reverseOrder()).toList()) {
				if (!one.equals(FOLDER)) {
					Files.delete(one);
				}
			}
		}
	}

	private static byte[] drawn(String format) {
		BufferedImage picture = new BufferedImage(400, 300, BufferedImage.TYPE_INT_RGB);
		Graphics2D pen = picture.createGraphics();
		pen.setColor(Color.RED);
		pen.fillRect(0, 0, 400, 300);
		pen.setColor(Color.BLUE);
		pen.fillRect(250, 50, 100, 100);
		pen.dispose();
		return encoded(picture, format);
	}

	private static byte[] seeThroughMark() {
		BufferedImage mark = new BufferedImage(300, 300, BufferedImage.TYPE_INT_ARGB);
		Graphics2D pen = mark.createGraphics();
		pen.setColor(Color.BLUE);
		pen.fillOval(75, 75, 150, 150);
		pen.dispose();
		return encoded(mark, "png");
	}

	private static byte[] encoded(BufferedImage picture, String format) {
		ByteArrayOutputStream bytes = new ByteArrayOutputStream();

		try {
			ImageIO.write(picture, format, bytes);
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}

		return bytes.toByteArray();
	}

	/** A row in {@code photo}, and its file under the row's key unless there is none. */
	private long picture(String digest, String mediaType, BigDecimal[] circle, byte[] file) {
		long id = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values (?, 1024, ?, ?, ?, ?) returning id")
				.params(mediaType, digest, circle[0], circle[1], circle[2])
				.query(Long.class).single();

		if (file != null) {
			try {
				Files.write(FOLDER.resolve(String.valueOf(id)), file);
			} catch (IOException cannot) {
				throw new UncheckedIOException(cannot);
			}
		}

		return id;
	}

	private void competitor(String number, Long photo, boolean hiding) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, "
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at, photo_id)"
						+ " values (?, 'Ime', 'Prezime', 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, "
						+ " ?, '', ?, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00', ?)")
				.params(number, String.format("%016x", ++issued), hiding, photo)
				.update();
	}

	private void waiting(String number, long photo) {
		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id, state)"
						+ " values ('profiles', (select id from competitor where member_number = ?),"
						+ " 'Nova slika', '', ?, 'waiting')")
				.params(number, photo)
				.update();
	}

	private final java.util.Map<String, SecretToken> sessions = new java.util.HashMap<>();

	private void account(String email, String number) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values ('Ime', 'Prezime', ?, (select id from role where code = 'competitor'),"
						+ " (select id from competitor where member_number = ?))")
				.params(email, number).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	private MockHttpServletResponse answer(String email, String address) throws Exception {
		MockHttpServletRequestBuilder asks = get(URI.create(address));
		return http.perform(email == null ? asks
						: asks.cookie(new Cookie(SessionCookie.NAME, sessions.get(email).secret())))
				.andReturn().getResponse();
	}

	private JsonNode read(String email, String address) throws Exception {
		return new ObjectMapper().readTree(answer(email, address).getContentAsString());
	}

	/** The record of one member on {@code /api/competitors}, as this reader is answered it. */
	private JsonNode recordOf(String email, String number) throws Exception {
		return StreamSupport.stream(read(email, "/api/competitors").spliterator(), false)
				.filter(one -> one.path("memberNumber").asString().equals(number))
				.findFirst().orElseThrow();
	}

	private static BufferedImage picture(MockHttpServletResponse answer) {
		try {
			return ImageIO.read(new ByteArrayInputStream(answer.getContentAsByteArray()));
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	private static boolean near(int pixel, Color colour) {
		return Math.abs((pixel >> 16 & 0xFF) - colour.getRed()) <= 50
				&& Math.abs((pixel >> 8 & 0xFF) - colour.getGreen()) <= 50
				&& Math.abs((pixel & 0xFF) - colour.getBlue()) <= 50;
	}

	/**
	 * THE CIRCLE THE LIST HANDS OUT IS SERVED CUT: {@value SmallPicture#SIDE} a side, blue where
	 * the member's circle is blue, under the type of the cut and kept a day and privately, like
	 * the original (ADL, „Slika se kešira dan i privatno").
	 */
	@Test
	void theCircleTheListHandsOutIsServedCutAndSmall() throws Exception {
		String address = recordOf(null, "000951").path("smallPhoto").asString();

		MockHttpServletResponse served = answer(null, address);

		assertThat(served.getStatus()).as("%s was not answered to a visitor", address).isEqualTo(200);
		assertThat(served.getContentType()).isEqualTo("image/jpeg");
		assertThat(served.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("max-age=86400, private");

		BufferedImage small = picture(served);
		assertThat(small.getWidth()).as("this is not the small picture").isEqualTo(SmallPicture.SIDE);
		assertThat(small.getHeight()).isEqualTo(SmallPicture.SIDE);
		assertThat(near(small.getRGB(120, 120), Color.BLUE))
				.as("the middle of the cut is not the middle of his circle").isTrue();
		assertThat(near(small.getRGB(40, 200), Color.BLUE))
				.as("the cut reaches outside his circle").isTrue();
	}

	/**
	 * THE ADDRESS SPELLS THE CIRCLE, so a moved circle is a new address and a browser that kept
	 * the old cut for a day is never shown it as the new one. The member's portrait is moved to
	 * the row with the other circle, as an approval of the moved circle does
	 * ({@code VerificationWriteApi}: {@code update competitor set photo_id}), and the waiting row
	 * lets go of it - deleted here rather than decided, because what is measured is only that
	 * nothing waits on it any more.
	 */
	@Test
	void aMovedCircleIsANewAddressAndTheOldOneIsNobodys() throws Exception {
		String before = recordOf(null, "000951").path("smallPhoto").asString();

		/* Asked once BEFORE the circle moves, so the server has the old cut kept: a cut kept by
		   the picture alone, and not by the picture and its circle, would be handed out again
		   below under the new address. */
		assertThat(near(picture(answer(null, before)).getRGB(120, 120), Color.BLUE)).isTrue();

		db.sql("delete from verification where photo_id = ?").param(theFacesWaitingRow).update();
		db.sql("update competitor set photo_id = ? where member_number = '000951'")
				.param(theFacesWaitingRow).update();

		String after = recordOf(null, "000951").path("smallPhoto").asString();

		assertThat(after).as("the circle moved and the address did not").isNotEqualTo(before);
		assertThat(after).as("the digest is the same picture, so it must stay in the address")
				.contains(FACE);

		MockHttpServletResponse moved = answer(null, after);
		assertThat(moved.getStatus()).isEqualTo(200);
		assertThat(near(picture(moved).getRGB(120, 120), Color.RED))
				.as("the new address is still cut to the old circle").isTrue();
		assertThat(answer(null, before).getStatus())
				.as("the old circle is held by nothing public any more and was still cut")
				.isEqualTo(404);
	}

	/**
	 * WHAT THE OTHER TWO ANSWERS HAND OUT IS SERVED TOO: his own small portrait on
	 * {@code /api/me}, for the circle beside his name, and the team's small mark on
	 * {@code /api/teams} - which is see-through, so it comes back as a PNG that still is.
	 */
	@Test
	void theCirclesOfMeAndOfATeamAreServedToo() throws Exception {
		String mine = read(HE, "/api/me").path("member").path("smallPhoto").asString();

		assertThat(mine).as("/api/me hands out another circle than the list does")
				.isEqualTo(recordOf(HE, "000951").path("smallPhoto").asString());
		assertThat(answer(HE, mine).getStatus()).isEqualTo(200);

		String logo = StreamSupport.stream(read(null, "/api/teams").spliterator(), false)
				.filter(one -> one.path("slug").asString().equals("tim-sa-znakom"))
				.findFirst().orElseThrow().path("smallLogo").asString();
		MockHttpServletResponse served = answer(null, logo);

		assertThat(served.getStatus()).as("%s was not answered", logo).isEqualTo(200);
		assertThat(served.getContentType()).isEqualTo("image/png");
		assertThat(picture(served).getRGB(2, 2) >>> 24).as("the mark lost what was see-through")
				.isZero();
	}

	/**
	 * A HIDDEN MEMBER'S FACE IS A VISITOR'S NOTHING ON THIS DOOR AS ON THE ORIGINAL'S (PDL P23,
	 * 03.10.2026, „Skrivanje deluje prema svakome ko nije aktivan član ni administracija"), and an
	 * active member reads it. The address is built here only because the list rightly hands a
	 * visitor none: what is measured is that knowing it is not enough.
	 */
	@Test
	void aHiddenMembersCircleIsAVisitorsNothingAndAnActiveMembersPicture() throws Exception {
		String address = PhotoApi.addressOfTheSmall(HIDDEN, OVER_THE_SQUARE[0], OVER_THE_SQUARE[1],
				OVER_THE_SQUARE[2]);

		assertThat(recordOf(AN_ACTIVE_MEMBER, "000952").path("smallPhoto").asString())
				.as("the address built here is not the one the list hands an active member")
				.isEqualTo(address);
		assertThat(recordOf(null, "000952").path("smallPhoto").isNull())
				.as("the list handed a visitor the circle of a member who hides").isTrue();
		assertThat(answer(null, address).getStatus()).isEqualTo(404);
		assertThat(answer(AN_ACTIVE_MEMBER, address).getStatus()).isEqualTo(200);
	}

	/**
	 * A CIRCLE NO PUBLIC HOLDER HAS IS NOTHING, whoever spells it: the circle of a picture that
	 * only waits (ADL A60), the circle the member moved to over a picture that IS public, and a
	 * circle nobody ever chose. Each is the same 404 as a digest nobody wrote.
	 */
	@Test
	void aCircleNoPublicHolderHasIsNothing() throws Exception {
		MockHttpServletResponse nobodyWroteIt = answer(null, PhotoApi.addressOfTheSmall(
				"00".repeat(32), OVER_THE_SQUARE[0], OVER_THE_SQUARE[1], OVER_THE_SQUARE[2]));

		for (String address : new String[] {
				PhotoApi.addressOfTheSmall(WAITING_ONLY, OVER_THE_SQUARE[0], OVER_THE_SQUARE[1],
						OVER_THE_SQUARE[2]),
				PhotoApi.addressOfTheSmall(FACE, IN_THE_CORNER[0], IN_THE_CORNER[1],
						IN_THE_CORNER[2]),
				PhotoApi.addressOfTheSmall(FACE, new BigDecimal("0.5"), new BigDecimal("0.5"),
						new BigDecimal("1")) }) {
			MockHttpServletResponse refused = answer(AN_ACTIVE_MEMBER, address);

			assertThat(refused.getStatus()).as("%s was answered", address).isEqualTo(404);
			assertThat(refused.getContentAsByteArray()).isEqualTo(nobodyWroteIt.getContentAsByteArray());
		}

		assertThat(answer(AN_ACTIVE_MEMBER, PhotoApi.addressOfTheSmall(FACE, OVER_THE_SQUARE[0],
				OVER_THE_SQUARE[1], OVER_THE_SQUARE[2])).getStatus())
				.as("the circle that IS public is refused too, so the refusals above say nothing")
				.isEqualTo(200);
	}

	/**
	 * A NAME OR A CIRCLE SPELT ANY OTHER WAY IS NOTHING, and never a 401: the door is open to a
	 * visitor, so what it refuses it refuses as a missing address. Eight places exactly, so one
	 * circle has one spelling and one cut is kept for it.
	 */
	@ParameterizedTest
	@ValueSource(strings = { "0.5-0.25-0.33333333", "0.833333330-0.25000000-0.33333333",
			"0.83333333-0.25000000", "a.83333333-0.25000000-0.33333333",
			"0.83333333_0.25000000_0.33333333" })
	void aCircleSpeltAnyOtherWayIsNothing(String circle) throws Exception {
		assertThat(answer(null, "/api/photos/" + FACE + "/small/" + circle).getStatus())
				.isEqualTo(404);
	}

	@Test
	void aDigestSpeltAnyOtherWayIsNothing() throws Exception {
		String right = PhotoApi.addressOfTheSmall(FACE, OVER_THE_SQUARE[0], OVER_THE_SQUARE[1],
				OVER_THE_SQUARE[2]);

		assertThat(answer(null, right).getStatus()).isEqualTo(200);
		assertThat(answer(null, right.replace(FACE, FACE.toUpperCase(java.util.Locale.ROOT)))
				.getStatus()).isEqualTo(404);
		assertThat(answer(null, right.replace(FACE, FACE.substring(1))).getStatus()).isEqualTo(404);
	}

	/**
	 * A ROW WHOSE FILE IS GONE AND A ROW WHOSE FILE IS NOT A PICTURE are both the 404 of a digest
	 * nobody wrote to the caller, and one line each to whoever runs the server: the first says
	 * the file could not be read, the second that it could not be cut.
	 */
	@Test
	void aFileGoneAndAFileThatIsNoPictureAreNothingAndALine() throws Exception {
		MockHttpServletResponse gone = answer(null, recordOf(null, "000953").path("smallPhoto")
				.asString());
		MockHttpServletResponse broken = answer(null, recordOf(null, "000954").path("smallPhoto")
				.asString());

		assertThat(gone.getStatus()).isEqualTo(404);
		assertThat(broken.getStatus()).isEqualTo(404);
		assertThat(log.list).extracting(ILoggingEvent::getFormattedMessage)
				.anySatisfy(line -> assertThat(line).contains("could not be read").contains(NO_FILE))
				.anySatisfy(line -> assertThat(line).contains("could not be cut"));
	}
}
