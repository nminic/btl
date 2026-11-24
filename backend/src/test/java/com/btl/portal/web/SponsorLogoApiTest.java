package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.TheEndOfTheTransaction;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.photo.PicturesOfASize;
import com.btl.portal.domain.photo.PicturesThatCarryMetadata;
import com.btl.portal.domain.photo.WhatAPictureIs;
import com.btl.portal.domain.photo.WithoutMetadata;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

/**
 * A SPONSOR'S LOGO SENT AND TAKEN DOWN ({@link SponsorLogoApi}).
 *
 * <p>Owner, PDL 24.11.2026: „Logo se otprema kao PNG, WebP ili JPEG, ne SVG.” and „Logo stoji providno na tamnoj
 * pozadini, bez svetle pločice.” So the three types are taken, an SVG is refused, the picture is kept whole and its
 * transparency stays. Two sponsors, each with a logo of its own, so a logo sent to one and written on the other is
 * a different answer.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class SponsorLogoApiTest {

	private static final Instant NOW = Instant.now();

	private static final String OVER_THE_SPONSORS = "moderator-logo-sponzori@primer.rs";

	private static final String OVER_THE_LEAGUES = "moderator-lige-logo@primer.rs";

	private static final String A_MEMBER = "clan-logo-sponzori@primer.rs";

	private static final Path PHOTOS = aFolderOfThisRunsOwn();

	private static Path aFolderOfThisRunsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-sponsors-");
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

	@Autowired
	private ObjectMapper mapper;

	private final Map<String, String> cookies = new HashMap<>();

	private long this1;

	private long theOther;

	private long thisOnesLogo;

	private long theOthersLogo;

	private int issued;

	@BeforeEach
	void twoSponsorsEachWithALogo() {
		thisOnesLogo = aPhotoRow();
		theOthersLogo = aPhotoRow();
		this1 = sponsor("Volt", 0, thisOnesLogo);
		theOther = sponsor("Sofra", 1, theOthersLogo);

		account(OVER_THE_SPONSORS, "moderator");
		ticked(OVER_THE_SPONSORS, "entity:sponsors");
		account(OVER_THE_LEAGUES, "moderator");
		ticked(OVER_THE_LEAGUES, "entity:leagues");
		account(A_MEMBER, "competitor");
	}

	private long sponsor(String name, int position, long logo) {
		return db.sql("insert into sponsor (name, url, logo_id, description_sr, in_strip, position)"
						+ " values (?, 'https://primer.rs/', ?, 'Opis', true, ?) returning id")
				.params(name, logo, position).query(Long.class).single();
	}

	private long aPhotoRow() {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
						+ " values ('image/png', 4096, ?, 0.5, 0.5, 1) returning id")
				.param(String.format("%064x", 0x5d0000 + ++issued)).query(Long.class).single();
	}

	private void account(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id, email_confirmed_at, password_hash)"
						+ " values ('Ime', 'Prezime', ?, (select id from role where code = ?),"
						+ " timestamptz '2026-09-02 10:00:00+00', null)")
				.params(email, role).update();

		SecretToken session = SecretToken.fresh();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(NOW.minus(Duration.ofDays(1))),
						Timestamp.from(NOW), Timestamp.from(NOW.plus(SessionLife.LASTS)))
				.update();

		cookies.put(email, session.secret());
	}

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	private MockHttpServletResponse sent(AbstractMockHttpServletRequestBuilder<?> asks, String email) throws Exception {
		return http.perform(email == null ? asks : asks.cookie(new Cookie(SessionCookie.NAME, cookies.get(email))))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse logo(long sponsor, byte[] content, String email) throws Exception {
		MockMultipartHttpServletRequestBuilder asking = multipart("/api/sponsors/" + sponsor + "/logo");

		if (content != null) {
			asking.file(new MockMultipartFile("picture", "logo.png", MediaType.IMAGE_PNG_VALUE, content));
		}

		return sent(asking.with(csrf()), email);
	}

	private MockHttpServletResponse takenDown(long sponsor, String email) throws Exception {
		return sent(delete("/api/sponsors/" + sponsor + "/logo").with(csrf()), email);
	}

	private String reason(MockHttpServletResponse answer) throws Exception {
		assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(400);

		return mapper.readTree(answer.getContentAsString(StandardCharsets.UTF_8)).path("reason").asString();
	}

	private Long logoOf(long sponsor) {
		return db.sql("select logo_id from sponsor where id = ?").param(sponsor).query(Long.class).optional()
				.orElse(null);
	}

	private boolean stands(long photo) {
		return db.sql("select exists (select 1 from photo where id = ?)").param(photo).query(Boolean.class).single();
	}

	private List<String> everyLogo() {
		return db.sql("select name || ' ' || coalesce(logo_id::text, '-') from sponsor order by id").query(String.class)
				.list();
	}

	private List<String> asItWas() {
		return List.of("Volt " + thisOnesLogo, "Sofra " + theOthersLogo);
	}

	/** A logo the way a sponsor sends one for a dark page: a mark on a background that is not there. */
	private static byte[] aLogoOnNothing() throws IOException {
		BufferedImage drawn = new BufferedImage(40, 16, BufferedImage.TYPE_INT_ARGB);

		for (int x = 10; x < 30; x++) {
			for (int y = 4; y < 12; y++) {
				drawn.setRGB(x, y, 0xFFFFC300);
			}
		}

		ByteArrayOutputStream out = new ByteArrayOutputStream();

		ImageIO.write(drawn, "png", out);

		return out.toByteArray();
	}

	// THE DOOR -----------------------------------------------------------------------------------------

	@Test
	void nobodySignedInIsAskedToSignInOnBoth() throws Exception {
		assertThat(logo(this1, aLogoOnNothing(), null).getStatus()).isEqualTo(401);
		assertThat(takenDown(this1, null).getStatus()).isEqualTo(401);
		assertThat(everyLogo()).containsExactlyElementsOf(asItWas());
	}

	@Test
	void whoeverLacksTheRightOverTheSponsorsIsAnsweredAsIfNothingWereThere() throws Exception {
		for (String email : List.of(OVER_THE_LEAGUES, A_MEMBER)) {
			assertThat(logo(this1, aLogoOnNothing(), email).getStatus()).as(email).isEqualTo(404);
			assertThat(takenDown(this1, email).getStatus()).as(email).isEqualTo(404);
		}

		assertThat(everyLogo()).containsExactlyElementsOf(asItWas());
	}

	@Test
	void aSponsorNobodyHasIsNotFoundOnBoth() throws Exception {
		long nobodys = db.sql("select max(id) + 1000 from sponsor").query(Long.class).single();

		assertThat(logo(nobodys, aLogoOnNothing(), OVER_THE_SPONSORS).getStatus()).isEqualTo(404);
		assertThat(takenDown(nobodys, OVER_THE_SPONSORS).getStatus()).isEqualTo(404);
		assertThat(everyLogo()).containsExactlyElementsOf(asItWas());
	}

	// SENDING ------------------------------------------------------------------------------------------

	@Test
	void aLogoStandsAtOnceWholeAndSeeThroughOnThisSponsorAloneAndTheOneItReplacedGoes() throws Exception {
		byte[] sent = aLogoOnNothing();
		MockHttpServletResponse answer = logo(this1, sent, OVER_THE_SPONSORS);

		assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(200);

		Long now = logoOf(this1);

		assertThat(now).isNotNull().isNotEqualTo(thisOnesLogo);

		byte[] stored = Files.readAllBytes(PHOTOS.resolve(String.valueOf(now)));
		BufferedImage read = ImageIO.read(new ByteArrayInputStream(stored));

		/* „Logo se ne seče u krug; čuva se ceo, providnost ostaje.” The whole picture, its size, and a corner
		   that was nothing is still nothing. */
		assertThat(read.getWidth() + "x" + read.getHeight()).isEqualTo("40x16");
		assertThat(read.getColorModel().hasAlpha()).isTrue();
		assertThat(read.getRGB(0, 0) >>> 24).as("the background of the logo is no longer see-through").isZero();
		assertThat(read.getRGB(20, 8)).isEqualTo(0xFFFFC300);

		String digest = WhatAPictureIs.digestOf(stored);

		assertThat(db.sql("select digest || ' ' || media_type || ' ' || byte_size from photo where id = ?").param(now)
				.query(String.class).single()).isEqualTo(digest + " image/png " + stored.length);
		for (String[] column : new String[][] {{"crop_x", "0.5"}, {"crop_y", "0.5"}, {"crop_diameter", "1"}}) {
			assertThat(db.sql("select " + column[0] + " from photo where id = ?").param(now)
					.query(BigDecimal.class).single()).as(column[0]).isEqualByComparingTo(column[1]);
		}
		assertThat(mapper.readTree(answer.getContentAsString(StandardCharsets.UTF_8)).path("logo").asString())
				.isEqualTo("/api/photos/" + digest);
		assertThat(everyLogo()).containsExactly("Volt " + now, "Sofra " + theOthersLogo);

		TheEndOfTheTransaction.broughtForward(db);

		assertThat(stands(thisOnesLogo)).as("the replaced logo's row is still there").isFalse();
		assertThat(stands(now)).isTrue();
		assertThat(stands(theOthersLogo)).as("the logo of the sponsor beside it went").isTrue();

		/* And it is the picture the public address answers, as the front page reads it. */
		assertThat(http.perform(get("/api/photos/" + digest)).andReturn().getResponse().getContentAsByteArray())
				.isEqualTo(stored);
	}

	@ParameterizedTest
	@ValueSource(strings = {"image/jpeg", "image/png", "image/webp"})
	void eachOfTheThreeTypesIsTakenByItsBytesAndWhatTheCameraWroteIsTakenOff(String type) throws Exception {
		byte[] sent = switch (type) {
			case "image/jpeg" -> PicturesThatCarryMetadata.aTelephoneJpeg(6);
			case "image/png" -> PicturesThatCarryMetadata.aPngThatSaysEverything(6);
			default -> PicturesThatCarryMetadata.aTelephoneWebp(6);
		};

		MockHttpServletResponse answer = logo(this1, sent, OVER_THE_SPONSORS);

		assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(200);

		long photo = logoOf(this1);
		byte[] stored = Files.readAllBytes(PHOTOS.resolve(String.valueOf(photo)));

		assertThat(db.sql("select media_type from photo where id = ?").param(photo).query(String.class).single())
				.isEqualTo(type);
		assertThat(PicturesThatCarryMetadata.says(stored, PicturesThatCarryMetadata.WHERE_AND_WITH_WHAT)).isFalse();
		assertThat(stored).isEqualTo(WithoutMetadata.of(sent, type));
	}

	@Test
	void anSvgIsRefusedAsSomethingThatIsNotAPicture() throws Exception {
		/* „ne SVG” (SVG može da nosi skriptu). Sent under a picture's name and type, which decide nothing. */
		byte[] svg = ("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\">"
				+ "<script>alert(1)</script><rect width=\"10\" height=\"10\"/></svg>").getBytes(StandardCharsets.UTF_8);

		assertThat(reason(logo(this1, svg, OVER_THE_SPONSORS))).isEqualTo(MePhotoApi.THIS_IS_NOT_A_PICTURE);
		assertThat(everyLogo()).containsExactlyElementsOf(asItWas());
	}

	@Test
	void aLogoIsRefusedForWhatAMembersPictureIsRefusedFor() throws Exception {
		assertThat(reason(logo(this1, null, OVER_THE_SPONSORS))).isEqualTo(MePhotoApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(reason(logo(this1, new byte[0], OVER_THE_SPONSORS))).isEqualTo(MePhotoApi.THE_FORM_IS_NOT_COMPLETE);
		assertThat(reason(logo(this1, "nije slika".getBytes(StandardCharsets.UTF_8), OVER_THE_SPONSORS)))
				.isEqualTo(MePhotoApi.THIS_IS_NOT_A_PICTURE);
		assertThat(reason(logo(this1, "GIF89a\u0001\u0000".getBytes(StandardCharsets.ISO_8859_1), OVER_THE_SPONSORS)))
				.isEqualTo(MePhotoApi.THIS_IS_NOT_A_PICTURE);
		assertThat(everyLogo()).containsExactlyElementsOf(asItWas());
	}

	@Test
	void theLargestFileIsTakenAndOneByteMoreIsNot() throws Exception {
		byte[] largest = new byte[WhatAPictureIs.AT_MOST_BYTES];
		byte[] jpeg = PicturesThatCarryMetadata.jpeg(false);

		System.arraycopy(jpeg, 0, largest, 0, jpeg.length);

		byte[] oneMore = new byte[WhatAPictureIs.AT_MOST_BYTES + 1];

		System.arraycopy(jpeg, 0, oneMore, 0, jpeg.length);

		assertThat(reason(logo(theOther, oneMore, OVER_THE_SPONSORS))).isEqualTo(MePhotoApi.THE_PICTURE_IS_TOO_BIG);
		assertThat(logoOf(theOther)).isEqualTo(theOthersLogo);
		assertThat(logo(this1, largest, OVER_THE_SPONSORS).getStatus()).isEqualTo(200);
	}

	@Test
	void aLogoOfMorePixelsThanTheCutTakesIsRefusedOnEachCeiling() throws Exception {
		assertThat(reason(logo(this1, PicturesOfASize.png(5_000, 5_001), OVER_THE_SPONSORS)))
				.isEqualTo(MePhotoApi.THE_PICTURE_IS_TOO_BIG);
		assertThat(reason(logo(this1, PicturesOfASize.webpOverItsCeiling(), OVER_THE_SPONSORS)))
				.isEqualTo(MePhotoApi.THE_PICTURE_IS_TOO_BIG);
		assertThat(logoOf(this1)).isEqualTo(thisOnesLogo);
		assertThat(logo(this1, PicturesOfASize.png(5_000, 5_000), OVER_THE_SPONSORS).getStatus()).isEqualTo(200);
	}

	// TAKING DOWN --------------------------------------------------------------------------------------

	@Test
	void theLogoTakenDownLeavesTheSponsorWithoutOneAndItsRowGoes() throws Exception {
		assertThat(takenDown(this1, OVER_THE_SPONSORS).getStatus()).isEqualTo(204);
		assertThat(everyLogo()).containsExactly("Volt -", "Sofra " + theOthersLogo);

		TheEndOfTheTransaction.broughtForward(db);

		assertThat(stands(thisOnesLogo)).isFalse();
		assertThat(stands(theOthersLogo)).isTrue();
	}

	@Test
	void takingDownWhatIsNotThereIsNotAnError() throws Exception {
		takenDown(this1, OVER_THE_SPONSORS);

		assertThat(takenDown(this1, OVER_THE_SPONSORS).getStatus()).isEqualTo(204);
		assertThat(logoOf(this1)).isNull();
	}
}
