package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.card.CompetitorCard;
import com.btl.portal.domain.card.WhatACardSays;
import com.btl.portal.domain.photo.SmallPicture;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
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
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * THE CARD OF A PROFILE, ASKED FOR AS A NETWORK ASKS FOR IT.
 *
 * <p><b>Nothing in the setting is the only one of its kind</b> (the rule in {@code CLAUDE.md} about
 * two sources of one value). The member whose card is asked for is never first on the list; the
 * member first on it has races of his own in the same races, so a count that read the wrong member
 * or every member comes out different; there are scored and unscored races and a kind with none;
 * there is an approved portrait AND a newer one waiting for a moderator, of two different colours;
 * and the readers are a visitor, a signed-in active member and the administration.
 *
 * <p>The rule about what a 404 looks like over a real socket, byte for byte, is
 * {@link CompetitorCardOverRealHttpTest}'s; this class reads answers through MockMvc.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, CompetitorCardApiTest.TheClockTheseCasesUse.class})
@Transactional
class CompetitorCardApiTest {

	private static final Instant OCTOBER_2028 = LocalDateTime.of(2028, 10, 1, 12, 0)
			.atZone(SeasonClock.ZONE).toInstant();

	/** First on the list, with races of his own in the same races. */
	private static final String FIRST = "000710";

	/** The member whose card is asked for. */
	private static final String ASKED = "000711";

	/** A hidden profile, whose fee stands. */
	private static final String HIDDEN = "000712";

	/** A member with no race at all and no team. */
	private static final String NONE = "000713";

	/** A member whose fee has lapsed: a member of 2027 and not of 2028. */
	private static final String LAPSED = "000714";

	/** A member with no approved portrait and one waiting for a moderator. */
	private static final String WAITING = "000715";

	/** A member whose approved portrait's file is not in the folder. */
	private static final String GONE = "000716";

	/** The colour of the circle under the initials, the model's {@code surface}. */
	private static final Color SURFACE = new Color(0x101a2e);

	/** A member who is deleted before the case asks. */
	private static final String DELETED = "000717";

	private static final String NOBODY = "000799";

	private static final Color APPROVED = new Color(0xd0, 0x20, 0x20);

	private static final Color WAITING_COLOUR = new Color(0x20, 0x40, 0xd0);

	private static final Path FOLDER = aFolderOfItsOwn();

	@DynamicPropertySource
	static void whereThePicturesAre(DynamicPropertyRegistry settings) {
		settings.add("btl.photos.folder", FOLDER::toString);
	}

	private static Path aFolderOfItsOwn() {
		try {
			return Files.createTempDirectory("btl-cards-case");
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	private final ObjectMapper json = new ObjectMapper();

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private CompetitorCards cards;

	@Autowired
	private CompetitorApi competitors;

	@Autowired
	private Clock clock;

	private long scoredEvent;

	@BeforeEach
	void aLeagueWithRacesAndPortraits() throws IOException {
		for (String number : List.of(FIRST, ASKED, HIDDEN, NONE, LAPSED, WAITING, GONE, DELETED)) {
			member(number, number.equals(ASKED) ? "Nikola" : "Ime", number.equals(ASKED) ? "Minić" : "Prezime");
			memberOf(number, number.equals(LAPSED) ? 2027 : 2028);
		}

		db.sql("update competitor set profile_hidden = true where member_number = ?").param(HIDDEN).update();

		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id, first_season,"
				+ " admin_id) values ('dunavski', 'Dunavski trkači', '', '', (select id from place where rank = 1),"
				+ " null, null, null, 2027, null)").update();
		for (String number : List.of(ASKED, HIDDEN)) {
			db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to, left_reason)"
					+ " values ((select id from competitor where member_number = ?),"
					+ " (select id from team where slug = 'dunavski'), 2027, null, null)").param(number).update();
		}

		scoredEvent = event("prolece-2028", "2028-04-04", "race");
		long unscoredEvent = event("triatlon-2028", "2028-05-05", "unscored");
		long ten = race(scoredEvent, "Deset", "2028-04-04", 10);
		long anotherTen = race(scoredEvent, "Jos deset", "2028-04-04", 10);
		long half = race(scoredEvent, "Polumaraton", "2028-04-04", 21.1);
		long marathon = race(scoredEvent, "Maraton", "2028-04-04", 42.2);
		long ultra = race(scoredEvent, "Ultra", "2028-04-04", 50);
		long swim = race(unscoredEvent, "Trcanje", "2028-05-05", 5.5);

		/* His: two short, a half, a marathon, and one unscored. No long race and no ultra. */
		run(ASKED, ten, "10");
		run(ASKED, anotherTen, "10");
		run(ASKED, half, "21.1");
		run(ASKED, marathon, "42.2");
		run(ASKED, swim, "5.5");
		/* And the first member's, in the same races, including the kinds he has none of. */
		run(FIRST, ultra, "50");
		run(FIRST, ten, "10");
		run(FIRST, swim, "5.5");
		run(HIDDEN, ten, "10");
		run(LAPSED, ten, "10");

		portrait(FIRST, APPROVED, true);
		portrait(ASKED, APPROVED, true);
		waiting(ASKED, WAITING_COLOUR);
		waiting(WAITING, WAITING_COLOUR);
		portrait(HIDDEN, APPROVED, true);
		portrait(GONE, APPROVED, false);

		db.sql("delete from membership where competitor_id = (select id from competitor where member_number = ?)")
				.param(DELETED).update();
		db.sql("delete from competitor where member_number = ?").param(DELETED).update();
	}

	@Test
	void theCardIsAJpegOfWhatItShowsNowAtItsAddressAndAtAnyNameOfTheRightShape() throws Exception {
		String address = cards.addressOf(ASKED, WhatACardSays.SERBIAN).orElseThrow();

		assertThat(address).matches("/api/cards/competitor/" + ASKED + "-sr1-[0-9a-f]{16}\\.jpg");

		MockHttpServletResponse answered = response(address, null);

		assertThat(answered.getStatus()).isEqualTo(200);
		/* The charset is the one this case sets to read text answers, not the route's. */
		assertThat(answered.getContentType()).startsWith("image/jpeg");
		assertThat(answered.getHeader("Cache-Control")).isEqualTo("max-age=86400, private");
		assertThat(answered.getContentAsByteArray().length).isLessThan(CompetitorCard.AT_MOST_BYTES);

		BufferedImage card = ImageIO.read(new ByteArrayInputStream(answered.getContentAsByteArray()));
		assertThat(card.getWidth()).isEqualTo(1200);
		assertThat(card.getHeight()).isEqualTo(630);

		/* Any digest of the right shape is answered the card as it stands now. */
		MockHttpServletResponse anyOther = response("/api/cards/competitor/" + ASKED + "-sr1-0000000000000000.jpg",
				null);
		assertThat(anyOther.getStatus()).isEqualTo(200);
		assertThat(anyOther.getContentAsByteArray()).isEqualTo(answered.getContentAsByteArray());

		/* And the English card is another picture at another address. */
		String english = cards.addressOf(ASKED, WhatACardSays.ENGLISH).orElseThrow();
		assertThat(english).contains("-en1-").isNotEqualTo(address.replace("-sr1-", "-en1-"));
		assertThat(response(english, null).getContentAsByteArray()).isNotEqualTo(answered.getContentAsByteArray());
	}

	@Test
	void theCardShowsWhatTheOwnerAskedForInTheWordsOfTheProfile() {
		CompetitorCard.Face face = cards.faceShown(ASKED, WhatACardSays.SERBIAN).orElseThrow();
		CompetitorApi.Competitor his = competitors.competitors(null).stream()
				.filter(one -> ASKED.equals(one.memberNumber())).findFirst().orElseThrow();

		assertThat(face.chip()).isEqualTo(ASKED);
		assertThat(face.name()).isEqualTo("Nikola Minić");
		assertThat(face.initials()).isEqualTo("NM");
		/* The category as the public answer gives it, written as the profile writes it, then the team. */
		assertThat(face.underName()).isEqualTo(WhatACardSays.SERBIAN.category(his.gender(),
				his.category().ageBand(), his.category().beginner()) + " · Dunavski trkači");
		assertThat(face.racesFigure()).isEqualTo("5");
		assertThat(face.racesWord()).isEqualTo("trka");
		assertThat(face.kilometresFigure()).isEqualTo("88,80");
		assertThat(face.slices()).extracting(slice -> slice.kind() + " " + slice.figure() + " " + slice.word())
				.containsExactly("short 2 kraće trke", "half 1 polumaraton", "marathon 1 maraton",
						"unscored 1 nebodovana");
		assertThat(face.address()).isEqualTo("balkanskatrkackaliga.net");

		CompetitorCard.Face english = cards.faceShown(ASKED, WhatACardSays.ENGLISH).orElseThrow();
		assertThat(english.racesWord()).isEqualTo("races");
		assertThat(english.kilometresFigure()).isEqualTo("88.80");
		assertThat(english.slices()).extracting(CompetitorCard.Slice::word)
				.containsExactly("short races", "half marathon", "marathon", "unscored");
	}

	/**
	 * THE FIGURES ARE WHAT THE TWO PUBLIC ROUTES SERVE FOR HIM, SCORED AND UNSCORED TOGETHER. Owner,
	 * 15.11.2026: „Trke, km, broje se SVE trke, ne samo bodovane." Two homes of one fact - the card's
	 * own count and the two routes - held to each other here.
	 */
	@Test
	void theFiguresCountEveryRaceThePublicRoutesServeHimScoredAndUnscored() throws Exception {
		List<JsonNode> his = new ArrayList<>();
		for (String route : List.of("/api/results", "/api/unscored-results")) {
			for (JsonNode one : json.readTree(response(route, null).getContentAsString())) {
				if (ASKED.equals(one.path("memberNumber").asString())) {
					his.add(one);
				}
			}
		}

		BigDecimal kilometres = his.stream().map(one -> one.path("distanceKm").decimalValue())
				.reduce(BigDecimal.ZERO, BigDecimal::add);
		CompetitorCard.Face face = cards.faceShown(ASKED, WhatACardSays.SERBIAN).orElseThrow();

		assertThat(his).as("the case has scored and unscored runs of his").hasSize(5);
		assertThat(face.racesFigure()).isEqualTo(WhatACardSays.SERBIAN.count(his.size()));
		assertThat(face.kilometresFigure()).isEqualTo(WhatACardSays.SERBIAN.kilometres(kilometres));
		assertThat(face.slices().stream().mapToLong(CompetitorCard.Slice::count).sum()).isEqualTo(his.size());
	}

	@Test
	void aMemberWithNoRaceHasNoSliceAndTheSentenceAndNoTeamIsNothingAtAll() {
		CompetitorCard.Face face = cards.faceShown(NONE, WhatACardSays.SERBIAN).orElseThrow();
		CompetitorApi.Competitor his = competitors.competitors(null).stream()
				.filter(one -> NONE.equals(one.memberNumber())).findFirst().orElseThrow();

		assertThat(face.slices()).isEmpty();
		assertThat(face.nothingYet()).isEqualTo("Prva trka na profilu tek dolazi.");
		assertThat(face.underName()).isEqualTo(WhatACardSays.SERBIAN.category(his.gender(),
				his.category().ageBand(), his.category().beginner())).doesNotContain("·");
	}

	@Test
	void aMemberWithoutACategoryOnTheCardHasOnlyHisTeamUnderTheName() {
		/* Held without the right to rank: activated after 31 March of the season (PDL, 28.10.2026). */
		db.sql("update membership set decided_at = timestamptz '2028-06-01 10:00:00+00'"
				+ " where competitor_id = (select id from competitor where member_number = ?)").param(ASKED).update();

		CompetitorApi.Competitor his = competitors.competitors(null).stream()
				.filter(one -> ASKED.equals(one.memberNumber())).findFirst().orElseThrow();

		assertThat(his.category()).as("the public answer gives him no category, so the case measures that state").isNull();
		assertThat(cards.faceShown(ASKED, WhatACardSays.SERBIAN).orElseThrow().underName())
				.isEqualTo("Dunavski trkači");
	}

	@Test
	void theAddressMovesWhenARaceIsAddedAndTheOldOneAnswersTheNewCard() throws Exception {
		String before = cards.addressOf(ASKED, WhatACardSays.SERBIAN).orElseThrow();
		byte[] drawnBefore = response(before, null).getContentAsByteArray();

		run(ASKED, race(scoredEvent, "Jos jedna", "2028-04-04", 10), "10");

		String after = cards.addressOf(ASKED, WhatACardSays.SERBIAN).orElseThrow();

		assertThat(after).isNotEqualTo(before);
		assertThat(response(before, null).getContentAsByteArray())
				.isEqualTo(response(after, null).getContentAsByteArray())
				.isNotEqualTo(drawnBefore);
	}

	@Test
	void theAddressMovesWhenHisSquareMovesAndNotWhenSomebodyElseRuns() {
		String before = cards.addressOf(ASKED, WhatACardSays.SERBIAN).orElseThrow();

		run(FIRST, race(scoredEvent, "Tudja", "2028-04-04", 10), "10");
		assertThat(cards.addressOf(ASKED, WhatACardSays.SERBIAN)).contains(before);

		db.sql("update photo set crop_x = 0.4 where id = (select photo_id from competitor where member_number = ?)")
				.param(ASKED).update();
		assertThat(cards.addressOf(ASKED, WhatACardSays.SERBIAN).orElseThrow()).isNotEqualTo(before);
	}

	/**
	 * A HIDDEN PROFILE, A LAPSED MEMBER, A DELETED ONE, A NUMBER NOBODY HOLDS AND A NAME OF THE WRONG
	 * SHAPE ARE ONE ANSWER. PDL, 06.09.2026, confirmed 03.10.2026: „Oba slučaja dobijaju isti ishod".
	 */
	@Test
	void aHiddenALapsedADeletedANobodyAndAMisshapenNameAreOneAnswer() throws Exception {
		MockHttpServletResponse nobody = response(nameFor(NOBODY), null);

		assertThat(nobody.getStatus()).isEqualTo(404);

		for (String path : List.of(nameFor(HIDDEN), nameFor(LAPSED), nameFor(DELETED),
				"/api/cards/competitor/" + ASKED + "-sr1-000000000000000.jpg",
				"/api/cards/competitor/" + ASKED + "-de1-0000000000000000.jpg",
				"/api/cards/competitor/" + ASKED + "-sr0-0000000000000000.jpg",
				"/api/cards/competitor/" + ASKED + "-sr1-000000000000000G.jpg",
				"/api/cards/competitor/00071-sr1-0000000000000000.jpg",
				"/api/cards/competitor/" + ASKED + ".jpg")) {
			MockHttpServletResponse answered = response(path, null);

			assertThat(answered.getStatus()).as(path).isEqualTo(404);
			assertThat(answered.getHeaderNames()).as(path).isEqualTo(nobody.getHeaderNames());
			assertThat(answered.getContentAsByteArray()).as(path).isEqualTo(nobody.getContentAsByteArray());
		}

		for (String number : List.of(HIDDEN, LAPSED, DELETED, NOBODY)) {
			assertThat(cards.addressOf(number, WhatACardSays.SERBIAN)).as(number).isEmpty();
		}

		/* And the members around them are there, so the emptiness above is about them. */
		assertThat(cards.addressOf(ASKED, WhatACardSays.SERBIAN)).isPresent();
		assertThat(cards.addressOf(FIRST, WhatACardSays.SERBIAN)).isPresent();
	}

	/**
	 * EVERY READER IS ANSWERED WHAT A VISITOR IS, the member asking for his own card included: the
	 * card is what anybody the link reaches will see, and it is kept in memory under an address
	 * anybody may ask for.
	 */
	@Test
	void aSignedInReaderIsAnsweredWhatAVisitorIs() throws Exception {
		String member = account("clan-kartica@primer.rs", "competitor", FIRST);
		String hiding = account("skriven-kartica@primer.rs", "competitor", HIDDEN);
		String superadmin = account("admin-kartica@primer.rs", "superadmin", null);
		String address = cards.addressOf(ASKED, WhatACardSays.SERBIAN).orElseThrow();
		byte[] visitor = response(address, null).getContentAsByteArray();

		for (String session : List.of(member, hiding, superadmin)) {
			assertThat(response("/api/me", session).getStatus()).as("a session the server knows").isEqualTo(200);
			assertThat(response(address, session).getContentAsByteArray()).isEqualTo(visitor);
			assertThat(response(nameFor(HIDDEN), session).getStatus()).as("the hidden card to a reader")
					.isEqualTo(404);
		}
	}

	@Test
	void theApprovedPortraitIsDrawnAndAWaitingOneNeverIs() throws Exception {
		near(cardOf(ASKED), APPROVED, "his approved portrait, with a newer one waiting");
		near(cardOf(WAITING), SURFACE, "a member whose only portrait waits");
	}

	@Test
	void aPortraitWhoseFileIsGoneIsDrawnAsTheInitials() throws Exception {
		near(cardOf(GONE), SURFACE, "a portrait with no file");
	}

	/**
	 * WHILE ANOTHER REQUEST DRAWS THE SAME CARD, a request that has waited its whole term is told
	 * „not now" and the route says 503. Held deterministically: the card's own key is occupied by a
	 * drawing that does not end until the case lets it, and the term is nought.
	 */
	@Test
	void aCardBeingDrawnForSomebodyElseIsNotNowAndTheRouteSays503() throws Exception {
		SmallPictures drawn = new SmallPictures(1 << 20, 0);
		CompetitorCards held = new CompetitorCards(competitors, db, clock, FOLDER, drawn);
		CompetitorCard.Face face = held.faceShown(ASKED, WhatACardSays.SERBIAN).orElseThrow();
		CountDownLatch drawing = new CountDownLatch(1);
		CountDownLatch letGo = new CountDownLatch(1);

		CompletableFuture<SmallPictures.Answer> other = CompletableFuture.supplyAsync(() -> drawn.of(
				new SmallPictures.Key(face.digest(), "card"), () -> {
					drawing.countDown();
					try {
						letGo.await(10, TimeUnit.SECONDS);
					} catch (InterruptedException stopped) {
						Thread.currentThread().interrupt();
					}
					return Optional.of(new SmallPicture.Cut(new byte[] {1}, "image/jpeg"));
				}));

		try {
			assertThat(drawing.await(10, TimeUnit.SECONDS)).as("the other drawing began").isTrue();

			String name = held.fingerprintOf(ASKED, WhatACardSays.SERBIAN).orElseThrow();
			assertThat(held.card(name)).isInstanceOf(CompetitorCards.NotNow.class);

			MockHttpServletResponse answered = new MockHttpServletResponse();
			assertThat(new CompetitorCardApi(held).card(name, answered)).isNull();
			assertThat(answered.getStatus()).isEqualTo(503);
		} finally {
			letGo.countDown();
			other.get(10, TimeUnit.SECONDS);
		}
	}

	private BufferedImage cardOf(String number) throws Exception {
		MockHttpServletResponse answered = response(cards.addressOf(number, WhatACardSays.SERBIAN).orElseThrow(), null);

		assertThat(answered.getStatus()).isEqualTo(200);
		return ImageIO.read(new ByteArrayInputStream(answered.getContentAsByteArray()));
	}

	/** Inside the circle and above the initials. */
	private static void near(BufferedImage card, Color expected, String what) {
		Color found = new Color(card.getRGB(330, 180));

		assertThat(Math.abs(found.getRed() - expected.getRed()) + Math.abs(found.getGreen() - expected.getGreen())
				+ Math.abs(found.getBlue() - expected.getBlue()))
				.as("%s: %s and not %s", what, found, expected)
				.isLessThan(40);
	}

	private static String nameFor(String number) {
		return "/api/cards/competitor/" + number + "-sr1-0123456789abcdef.jpg";
	}

	private MockHttpServletResponse response(String path, String session) throws Exception {
		MockHttpServletRequestBuilder request = get(path);

		if (session != null) {
			request.cookie(new Cookie(SessionCookie.NAME, session));
		}

		MockHttpServletResponse response = http.perform(request).andReturn().getResponse();
		response.setCharacterEncoding("UTF-8");
		return response;
	}

	private void member(String number, String first, String last) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season,"
						+ " referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'M', date '1980-05-05',"
						+ " (select id from place where rank = 1), null, null, 2027,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, "0011223377" + number).update();
	}

	private void memberOf(String number, int season) {
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values ((select id from competitor where member_number = ?), ?, 'feeExempt',"
						+ " 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
				.params(number, season).update();
	}

	private long event(String slug, String day, String kind) {
		return db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, ?, cast(? as date), null, 'Grad', (select id from country where code = 'RS'),"
						+ " ?, false, '', '') returning id")
				.params(slug, slug, day, kind).query(Long.class).single();
	}

	private long race(long event, String name, String day, double kilometres) {
		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values (?, ?, false, cast(? as date), 'length', 0, ?, 0, 0) returning id")
				.params(event, name, day, kilometres).query(Long.class).single();
	}

	private void run(String member, long race, String kilometres) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m, seconds,"
						+ " points) select (select id from competitor where member_number = ?), id, date,"
						+ " cast(? as numeric), 0, 0, 3600, 0 from race where id = ?")
				.params(member, kilometres, race).update();
	}

	private static byte[] aJpegOf(Color colour) throws IOException {
		BufferedImage picture = new BufferedImage(400, 300, BufferedImage.TYPE_INT_RGB);
		Graphics2D pen = picture.createGraphics();
		pen.setColor(colour);
		pen.fillRect(0, 0, 400, 300);
		pen.dispose();

		ByteArrayOutputStream bytes = new ByteArrayOutputStream();
		ImageIO.write(picture, "jpeg", bytes);
		return bytes.toByteArray();
	}

	private long photo(Color colour, boolean withItsFile) throws IOException {
		byte[] bytes = aJpegOf(colour);
		long id = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
						+ " values ('image/jpeg', ?, ?, 0.25, 0.5, 0.8) returning id")
				.params(bytes.length, com.btl.portal.domain.photo.WhatAPictureIs.digestOf(bytes))
				.query(Long.class).single();

		if (withItsFile) {
			Files.write(FOLDER.resolve(String.valueOf(id)), bytes);
		}

		return id;
	}

	private void portrait(String number, Color colour, boolean withItsFile) throws IOException {
		db.sql("update competitor set photo_id = ? where member_number = ?")
				.params(photo(colour, withItsFile), number).update();
	}

	private void waiting(String number, Color colour) throws IOException {
		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id, state)"
						+ " values ('profiles', (select id from competitor where member_number = ?), 'Nova slika', '',"
						+ " ?, 'waiting')")
				.params(number, photo(colour, true)).update();
	}

	private String account(String email, String role, String member) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values ('Probni',"
						+ " 'Probic', ?, (select id from role where code = ?),"
						+ " (select id from competitor where member_number = ?))")
				.params(email, role, member).update();

		SecretToken session = SecretToken.fresh();
		Instant now = OCTOBER_2028;

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at, expires_at)"
						+ " values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))), Timestamp.from(now),
						Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return session.secret();
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockTheseCasesUse {

		@Bean
		@Primary
		Clock theClockOfOctober2028() {
			return new FixedAt(OCTOBER_2028);
		}
	}

	private static final class FixedAt extends Clock {

		private final Instant now;

		private FixedAt(Instant now) {
			this.now = now;
		}

		@Override
		public Instant instant() {
			return now;
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return Clock.fixed(now, zone);
		}
	}
}
