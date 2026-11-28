package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.TheEndOfTheTransaction;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.photo.PicturesThatCarryMetadata;
import com.btl.portal.domain.photo.WhatAPictureIs;
import com.btl.portal.domain.photo.WithoutMetadata;
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
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * A PICTURE SENT AS THE PROOF OF A RUN: RECEIVED, KEPT, SHOWN TO THE MODERATOR AND GONE WITH THE DECISION.
 *
 * <p>The owner, 28.11.2026: „Odradi i sliku kao dokaz uz rezultat", which carries out his choice of 28.09.2026,
 * „polje šalje bajtove, server ih prima i čuva, moderator ih vidi uz rezultat", and with it the decision of
 * 22.08.2026 (PDL, „Slika jeste zamena za link"): „Ukoliko podignete sliku, link ka zvaničnim rezultatima
 * postaje neobavezan, ali polje Komentar postaje obavezno". ADL, 23.08.2026: „server proverava tip po sadržaju
 * a ne po nazivu ni po {@code Content-Type} zaglavlju, ograničava veličinu, nikad ne upotrebljava ime fajla kao
 * putanju i briše fajl posle odluke".
 *
 * <p><b>The axes, each with both its states in the fixture.</b> Two roads that send a run (a new one, on a race
 * of the calendar and on one described, and a correction); a picture whose header names one kind and whose
 * bytes another; a size at the ceiling and one past it; a picture that carries where it was taken; a row that
 * waits and one decided either way; a moderator over the results and one over the profiles, the member himself
 * and nobody; the same bytes twice. And a picture of the results tab already waiting for SOMEBODY ELSE, so „the
 * picture of this row" cannot be answered by „the picture that waits".
 *
 * <p>Its own folder, for {@code TeamLogoApiTest}'s reason: every file this class writes is one it can count.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TestcontainersConfiguration.class, AResultsPictureAsProofTest.InJune.class })
@Transactional
class AResultsPictureAsProofTest {

	private static final Instant IN_JUNE = Instant.parse("2027-06-15T10:00:00Z");

	@TestConfiguration(proxyBeanMethods = false)
	static class InJune {

		@Bean
		@Primary
		Clock inJuneOf2027() {
			return Clock.fixed(IN_JUNE, ZoneOffset.UTC);
		}
	}

	private static final String ME = "000921";

	private static final String SOMEBODY_ELSE = "000922";

	private static final String OVER_THE_RESULTS = "moderator-rezultati-dokaz@primer.rs";

	private static final String OVER_THE_PROFILES = "moderator-profili-dokaz@primer.rs";

	private static final Path PHOTOS = aFolderOfThisRunsOwn();

	private static Path aFolderOfThisRunsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-proof-of-a-run-");
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

	private long race;

	private long myResult;

	private long somebodyElsesResult;

	private long issued;

	@BeforeEach
	void twoMembersARaceAResultEachAndAPictureOfSomebodyElseWaiting() throws Exception {
		member(ME, "Vera", "Dokazna");
		member(SOMEBODY_ELSE, "Bojan", "Drugi");
		staff(OVER_THE_RESULTS, "queue:results");
		staff(OVER_THE_PROFILES, "queue:profiles");

		race = race("Dugi maraton", "2027-05-05");
		long theRaceIRan = race("Polumaraton", "2027-04-04");

		myResult = ran(ME, theRaceIRan, "2027-04-04");
		somebodyElsesResult = ran(SOMEBODY_ELSE, theRaceIRan, "2027-04-04");

		/* SOMEBODY ELSE'S PICTURE, ALREADY WAITING IN THE SAME TAB, sent through the route: so the row a case
		   asks about is never the only results row that holds a picture. */
		assertThat(reported(SOMEBODY_ELSE, Map.of("raceId", race, "seconds", 13000, "link", "",
				"comment", "Njegov sat"), aJpeg("njegova slika")).getStatus()).isEqualTo(201);
	}

	// A NEW RUN -------------------------------------------------------------------------------------------

	/**
	 * A PICTURE WITH A COMMENT STANDS IN FOR THE LINK, and what is kept is a picture by its bytes, under the
	 * number its row was given, with nothing of the name or the header of the file.
	 *
	 * <p>The header says JPEG and the bytes are a PNG, so a route that read the header would write
	 * {@code image/jpeg}; the name of the file climbs out of the folder, so a route that used it would write a
	 * file this case does not find where it looks.
	 */
	@Test
	void aPictureWithACommentStandsInForTheLinkAndIsKeptByItsBytes() throws Exception {
		byte[] png = PicturesThatCarryMetadata.png();

		MockHttpServletResponse answered = sent(multipart("/api/results")
				.file(new MockMultipartFile("picture", "../../../izlazim.jpg", MediaType.IMAGE_JPEG_VALUE, png))
				.param("run", json(Map.of("raceId", race, "seconds", 12345, "link", "",
						"comment", "Sat pokazuje 3:25:45"))), ME);

		assertThat(answered.getStatus()).isEqualTo(201);

		long submission = idIn(answered);
		long photo = thePictureOf(submission);

		assertThat(db.sql("select link from result_submission where id = ?").param(submission)
				.query(String.class).single()).isEmpty();
		assertThat(db.sql("select media_type || ' ' || crop_x || ' ' || crop_y || ' ' || crop_diameter"
						+ " from photo where id = ?").param(photo).query(String.class).single())
				.isEqualTo("image/png 0.50000000 0.50000000 1.00000000");

		byte[] kept = Files.readAllBytes(PHOTOS.resolve(String.valueOf(photo)));

		assertThat(kept).isEqualTo(WithoutMetadata.of(png, "image/png"));
		assertThat(db.sql("select digest from photo where id = ?").param(photo).query(String.class).single())
				.isEqualTo(WhatAPictureIs.digestOf(kept));
		assertThat(Files.exists(PHOTOS.resolve("../../../izlazim.jpg").normalize())).isFalse();
		assertThat(db.sql("select body from verification where result_submission_id = ?").param(submission)
				.query(String.class).single()).isEqualTo("Sat pokazuje 3:25:45");
	}

	/** And on a race the calendar does not hold, which is the other road a new run takes. */
	@Test
	void aRunOnARaceTheCalendarDoesNotHoldCarriesItsPictureToo() throws Exception {
		Map<String, Object> described = new HashMap<>();
		described.put("raceName", "Trka van kalendara");
		described.put("day", "2027-05-20");
		described.put("raceKind", "length");
		described.put("eventName", "Dogadjaj van kalendara");
		described.put("eventKind", "race");
		described.put("city", "Negde");
		described.put("country", "RS");
		described.put("distanceKm", "21.10");
		described.put("ascentM", 100);
		described.put("descentM", 100);
		described.put("seconds", 6000);
		described.put("link", "");
		described.put("comment", "Diploma sa trke");

		MockHttpServletResponse answered = reported(ME, described, aJpeg("diploma"));

		assertThat(answered.getStatus()).isEqualTo(201);
		assertThat(Files.readAllBytes(PHOTOS.resolve(String.valueOf(thePictureOf(idIn(answered))))))
				.isEqualTo(WithoutMetadata.of(aJpeg("diploma"), "image/jpeg"));
	}

	/** „Slika nikad ne stoji sama": a picture with no comment is refused, and nothing is written. */
	@Test
	void aPictureWithNoCommentIsRefusedAndNothingIsWritten() throws Exception {
		long before = everything();

		MockHttpServletResponse answered = reported(ME, Map.of("raceId", race, "seconds", 12345, "link", "",
				"comment", "   "), aJpeg("bez reci"));

		assertThat(answered.getStatus()).isEqualTo(400);
		assertThat(reasonOf(answered)).isEqualTo("aPhotographNeverStandsAlone");
		assertThat(everything()).isEqualTo(before);
	}

	/** Text with a picture's header is not a picture, and a run whose only proof it was proves nothing. */
	@Test
	void textCalledAPictureIsNotOne() throws Exception {
		long before = everything();

		MockHttpServletResponse answered = sent(multipart("/api/results")
				.file(new MockMultipartFile("picture", "sat.png", MediaType.IMAGE_PNG_VALUE,
						"nije slika".getBytes(StandardCharsets.UTF_8)))
				.param("run", json(Map.of("raceId", race, "seconds", 12345, "link", "", "comment", "Sat"))), ME);

		assertThat(answered.getStatus()).isEqualTo(400);
		assertThat(reasonOf(answered)).isEqualTo(ResultWriteApi.THIS_IS_NOT_A_PICTURE);
		assertThat(everything()).isEqualTo(before);
	}

	/** Five MiB is a picture the portal takes, and one byte more is not. */
	@Test
	void theCeilingIsFiveMebibytesAndNotAByteMore() throws Exception {
		Map<String, Object> run = Map.of("raceId", race, "seconds", 12345, "link", "", "comment", "Velika");

		MockHttpServletResponse over = reported(ME, run, aJpeg("x".repeat(WhatAPictureIs.AT_MOST_BYTES - 2)));

		assertThat(over.getStatus()).isEqualTo(400);
		assertThat(reasonOf(over)).isEqualTo(ResultWriteApi.THE_PICTURE_IS_TOO_BIG);

		assertThat(reported(ME, run, aJpeg("x".repeat(WhatAPictureIs.AT_MOST_BYTES - 3))).getStatus())
				.isEqualTo(201);
	}

	/** What the telephone wrote about where the picture was taken does not reach the disk. */
	@Test
	void whatTheCameraWroteIsTakenOffBeforeTheFileIsWritten() throws Exception {
		byte[] telephone = PicturesThatCarryMetadata.aTelephoneJpeg(6);

		long photo = thePictureOf(idIn(reported(ME, Map.of("raceId", race, "seconds", 12345, "link", "",
				"comment", "Sat"), telephone)));
		byte[] kept = Files.readAllBytes(PHOTOS.resolve(String.valueOf(photo)));

		assertThat(kept).isEqualTo(WithoutMetadata.of(telephone, "image/jpeg")).isNotEqualTo(telephone);
		assertThat(new String(kept, StandardCharsets.ISO_8859_1))
				.doesNotContain(PicturesThatCarryMetadata.WHERE_AND_WITH_WHAT);
	}

	/**
	 * A FILE BOX NOBODY FILLED IS NO PICTURE: the link alone still proves the run and nothing is held, and with
	 * no link and no word either nothing shows it happened. A request with no part {@code run}, or one that is not
	 * JSON, is a form not filled in.
	 */
	@Test
	void anEmptyFileIsNoPictureAndABodyThatIsNotThereIsAFormNotFilledIn() throws Exception {
		Map<String, Object> linked = Map.of("raceId", race, "seconds", 12345,
				"link", "https://rezultati.rs/moja-trka", "comment", "Sat");

		MockHttpServletResponse withALink = reported(ME, linked, new byte[0]);

		assertThat(withALink.getStatus()).isEqualTo(201);
		assertThat(db.sql("select photo_id from verification where result_submission_id = ?")
				.param(idIn(withALink)).query(Long.class).optional()).isEmpty();

		assertThat(reasonOf(reported(ME, Map.of("raceId", race, "seconds", 12345, "link", "",
				"comment", "  "), new byte[0]))).isEqualTo("nothingShowsItHappened");

		/* And words with the empty file box are words alone, which is a proof (PDL P9, 28.11.2026): the
		   empty box is no picture, and no picture is what holds nothing, not what refuses. */
		MockHttpServletResponse byWords = reported(ME, Map.of("raceId", race, "seconds", 12345, "link", "",
				"comment", "Sat"), new byte[0]);

		assertThat(byWords.getStatus()).isEqualTo(201);
		assertThat(db.sql("select photo_id from verification where result_submission_id = ?")
				.param(idIn(byWords)).query(Long.class).optional()).isEmpty();

		assertThat(sent(multipart("/api/results").param("run", json(linked)), ME).getStatus()).isEqualTo(201);

		MockHttpServletResponse noRun = sent(multipart("/api/results")
				.file(new MockMultipartFile("picture", "a.jpg", MediaType.IMAGE_JPEG_VALUE, aJpeg("x"))), ME);

		assertThat(noRun.getStatus()).isEqualTo(400);
		assertThat(reasonOf(noRun)).isEqualTo(ResultWriteApi.THE_FORM_IS_NOT_COMPLETE);

		MockHttpServletResponse notJson = sent(multipart("/api/results").param("run", "{nije json"), ME);

		assertThat(reasonOf(notJson)).isEqualTo(ResultWriteApi.THE_FORM_IS_NOT_COMPLETE);
	}

	/**
	 * THE SAME BYTES SENT TWICE ARE TWO PROOFS OF TWO SENDS: two rows of {@code photo} under one digest (V8 puts
	 * no unique constraint on it), two files, and two rows in the queue, each pointing at its own picture.
	 */
	@Test
	void theSameFileSentTwiceIsTwoPicturesAndTwoFiles() throws Exception {
		Map<String, Object> run = Map.of("raceId", race, "seconds", 12345, "link", "", "comment", "Isti sat");

		long first = thePictureOf(idIn(reported(ME, run, aJpeg("isti fajl"))));
		long second = thePictureOf(idIn(reported(ME, run, aJpeg("isti fajl"))));

		assertThat(first).isNotEqualTo(second);
		assertThat(Files.readAllBytes(PHOTOS.resolve(String.valueOf(first))))
				.isEqualTo(Files.readAllBytes(PHOTOS.resolve(String.valueOf(second))));
	}

	// THREE AT MOST -----------------------------------------------------------------------------------------

	/**
	 * THE THIRD PICTURE WAITING IS TAKEN AND A FOURTH IS REFUSED, ON EVERY ROAD A RUN IS SENT BY. The owner,
	 * 28.11.2026: „Član sme da drži najviše tri slike kao dokaz na čekanju istovremeno; četvrta se odbija".
	 *
	 * <p><b>The counts are kept apart from every other picture that waits</b>: somebody else's proof already waits
	 * in the same tab (the fixture), and a picture of his own waits in the profiles tab, so a count over the whole
	 * tab or over every tab would refuse his third. And somebody else may still send his own after the refusal.
	 */
	@Test
	void aThirdPictureWaitingIsTakenAndAFourthIsRefusedOnEveryRoad() throws Exception {
		long portrait = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
						+ " values ('image/jpeg', 4, ?, 0.5, 0.5, 1) returning id")
				.param("b".repeat(64)).query(Long.class).single();

		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id)"
						+ " values ('profiles', (select id from competitor where member_number = ?), 'Vera', '', ?)")
				.params(ME, portrait).update();

		Map<String, Object> run = Map.of("raceId", race, "seconds", 12345, "link", "", "comment", "Sat");

		/* AND A RUN OF HIS THAT WAITS WITH NO PICTURE, proved by its link: it is a row in the same tab and holds no
		   file, so a count of his rows rather than of his pictures would refuse the third. */
		assertThat(sent(multipart("/api/results").param("run", json(Map.of("raceId", race, "seconds", 12000,
				"link", "https://rezultati.rs/prvo-bez-slike", "comment", ""))), ME).getStatus()).isEqualTo(201);

		for (int one = 1; one <= ResultWriteApi.AT_MOST_PICTURES_WAITING; one++) {
			assertThat(reported(ME, run, aJpeg("slika " + one)).getStatus()).as("picture %d", one).isEqualTo(201);
		}

		long before = everything();

		MockHttpServletResponse fromTheCalendar = reported(ME, run, aJpeg("cetvrta"));
		MockHttpServletResponse described = reported(ME, aDescribedRun(), aJpeg("cetvrta, opisana"));
		MockHttpServletResponse correction = corrected(myResult, aJpeg("cetvrta, ispravka"), "Sat");

		for (MockHttpServletResponse refused : List.of(fromTheCalendar, described, correction)) {
			assertThat(refused.getStatus()).isEqualTo(400);
			assertThat(reasonOf(refused)).isEqualTo(ResultWriteApi.THREE_PICTURES_WAIT);
		}

		assertThat(everything()).as("a refused fourth left something behind").isEqualTo(before);
		assertThat(db.sql("select count(*) from message m join competitor c on c.id = m.to_id"
						+ " where c.member_number = ?").param(ME).query(Long.class).single())
				.as("a refused fourth told him in his inbox that something was sent")
				.isEqualTo(4L);

		/* A run proved by its link alone holds no picture, and goes. */
		assertThat(sent(multipart("/api/results").param("run", json(Map.of("raceId", race, "seconds", 12345,
				"link", "https://rezultati.rs/bez-slike", "comment", ""))), ME).getStatus()).isEqualTo(201);

		/* And somebody else, with one of his own waiting, still sends two. */
		assertThat(reported(SOMEBODY_ELSE, run, aJpeg("njegova druga")).getStatus()).isEqualTo(201);
		assertThat(reported(SOMEBODY_ELSE, run, aJpeg("njegova treca")).getStatus()).isEqualTo(201);
		assertThat(reasonOf(reported(SOMEBODY_ELSE, run, aJpeg("njegova cetvrta"))))
				.isEqualTo(ResultWriteApi.THREE_PICTURES_WAIT);
	}

	/** A decision about one of the three frees its place at once, refused or approved. */
	@Test
	void aDecisionAboutOneOfTheThreeFreesItsPlace() throws Exception {
		Map<String, Object> run = Map.of("raceId", race, "seconds", 12345, "link", "", "comment", "Sat");
		long first = idIn(reported(ME, run, aJpeg("prva od tri")));

		reported(ME, run, aJpeg("druga od tri"));
		reported(ME, run, aJpeg("treca od tri"));

		assertThat(reasonOf(reported(ME, run, aJpeg("pre odluke")))).isEqualTo(ResultWriteApi.THREE_PICTURES_WAIT);

		long row = theRowOf(first);

		assertThat(decide(row, "{\"approved\":false,\"reason\":\"Ne vidi se.\"," + seen(row) + "}").getStatus())
				.isEqualTo(200);
		assertThat(reported(ME, run, aJpeg("posle odluke")).getStatus()).isEqualTo(201);
		assertThat(reasonOf(reported(ME, run, aJpeg("opet cetvrta")))).isEqualTo(ResultWriteApi.THREE_PICTURES_WAIT);
	}

	/**
	 * A PICTURE BESIDE A LINK STILL ASKS ITS COMMENT (Član 37: „Ukoliko podignete sliku, link ka zvaničnim
	 * rezultatima postaje neobavezan, ali polje Komentar postaje obavezno"), on a new run and on a correction: a
	 * comment of spaces is no comment, and the link does not stand in for it.
	 */
	@Test
	void aPictureBesideALinkStillAsksItsComment() throws Exception {
		long before = everything();

		MockHttpServletResponse sentIn = reported(ME, Map.of("raceId", race, "seconds", 12345,
				"link", "https://rezultati.rs/moja-trka", "comment", "   "), aJpeg("uz link"));
		MockHttpServletResponse correction = sent(multipart("/api/results/" + myResult)
				.file(new MockMultipartFile("picture", "sat.jpg", MediaType.IMAGE_JPEG_VALUE, aJpeg("uz link")))
				.param("run", json(Map.of("distanceKm", "21.10", "ascentM", 0, "descentM", 0, "seconds", 5000,
						"link", "https://rezultati.rs/ispravka", "comment", "   ")))
				.with(request -> {
					request.setMethod("PUT");
					return request;
				}), ME);

		for (MockHttpServletResponse refused : List.of(sentIn, correction)) {
			assertThat(refused.getStatus()).isEqualTo(400);
			assertThat(reasonOf(refused)).isEqualTo("aPhotographNeverStandsAlone");
		}

		assertThat(everything()).isEqualTo(before);
	}

	private static Map<String, Object> aDescribedRun() {
		Map<String, Object> described = new HashMap<>();
		described.put("raceName", "Trka van kalendara");
		described.put("day", "2027-05-20");
		described.put("raceKind", "length");
		described.put("eventName", "Dogadjaj van kalendara");
		described.put("eventKind", "race");
		described.put("city", "Negde");
		described.put("country", "RS");
		described.put("distanceKm", "21.10");
		described.put("ascentM", 100);
		described.put("descentM", 100);
		described.put("seconds", 6000);
		described.put("link", "");
		described.put("comment", "Diploma sa trke");
		return described;
	}

	// A CORRECTION ----------------------------------------------------------------------------------------

	/** A correction is the third road a run is sent by, and a picture with a comment proves it as well. */
	@Test
	void aCorrectionCarriesItsPictureAndAmendsTheResultItNames() throws Exception {
		MockHttpServletResponse answered = sent(multipart("/api/results/" + myResult)
				.file(new MockMultipartFile("picture", "sat.jpg", MediaType.IMAGE_JPEG_VALUE, aJpeg("ispravka")))
				.param("run", json(Map.of("distanceKm", "21.10", "ascentM", 0, "descentM", 0, "seconds", 5000,
						"link", "", "comment", "Sat je stao na 1:23:20")))
				.with(request -> {
					request.setMethod("PUT");
					return request;
				}), ME);

		assertThat(answered.getStatus()).isEqualTo(200);

		long submission = idIn(answered);

		assertThat(db.sql("select amends_result_id from result_submission where id = ?").param(submission)
				.query(Long.class).single()).isEqualTo(myResult);
		assertThat(Files.readAllBytes(PHOTOS.resolve(String.valueOf(thePictureOf(submission)))))
				.isEqualTo(WithoutMetadata.of(aJpeg("ispravka"), "image/jpeg"));

		MockHttpServletResponse bare = corrected(myResult, aJpeg("bez komentara"), "");

		assertThat(reasonOf(bare)).isEqualTo("aPhotographNeverStandsAlone");

		MockHttpServletResponse notJson = sent(multipart("/api/results/" + myResult)
				.file(new MockMultipartFile("picture", "sat.jpg", MediaType.IMAGE_JPEG_VALUE, aJpeg("x")))
				.param("run", "nije json")
				.with(request -> {
					request.setMethod("PUT");
					return request;
				}), ME);

		assertThat(reasonOf(notJson)).isEqualTo(ResultWriteApi.THE_FORM_IS_NOT_COMPLETE);
	}

	/** Somebody else's result is not there for him, and a file that is not a picture says nothing about it. */
	@Test
	void aPictureSentAtSomebodyElsesResultIsAnsweredAsAResultThatIsNotThere() throws Exception {
		long before = everything();

		MockHttpServletResponse answered = sent(multipart("/api/results/" + somebodyElsesResult)
				.file(new MockMultipartFile("picture", "sat.jpg", MediaType.IMAGE_JPEG_VALUE,
						"nije slika".getBytes(StandardCharsets.UTF_8)))
				.param("run", json(Map.of("distanceKm", "21.10", "ascentM", 0, "descentM", 0, "seconds", 5000,
						"link", "", "comment", "Tudji")))
				.with(request -> {
					request.setMethod("PUT");
					return request;
				}), ME);

		assertThat(answered.getStatus()).isEqualTo(404);
		assertThat(everything()).isEqualTo(before);
		assertThat(reasonOf(corrected(myResult, "nije slika".getBytes(StandardCharsets.UTF_8), "Moj")))
				.isEqualTo(ResultWriteApi.THIS_IS_NOT_A_PICTURE);
		assertThat(reasonOf(corrected(myResult, aJpeg("x".repeat(WhatAPictureIs.AT_MOST_BYTES)), "Moj")))
				.isEqualTo(ResultWriteApi.THE_PICTURE_IS_TOO_BIG);
	}

	/** Taking back the result takes the correction that waits on it, and the picture of that correction. */
	@Test
	void aResultTakenBackTakesThePictureOfItsWaitingCorrectionWithIt() throws Exception {
		long photo = thePictureOf(idIn(corrected(myResult, aJpeg("ispravka koja odlazi"), "Sat")));

		assertThat(sent(delete("/api/results/" + myResult).with(csrf()), ME).getStatus()).isEqualTo(204);

		TheEndOfTheTransaction.broughtForward(db);

		assertThat(stands(photo)).isFalse();
	}

	// WHO SEES IT -----------------------------------------------------------------------------------------

	/**
	 * THE MODERATOR OVER THE RESULTS SEES THE PICTURE OF THE ROW HE DECIDES, AND NOBODY ELSE SEES IT: not a
	 * moderator over another tab, not the member who sent it, not anybody at its public address (ADL A60:
	 * „Slika koju drži samo nešto što čeka odluku moderatora nije javna: ni {@code verification.photo_id}
	 * (dokaz sa sata)").
	 */
	@Test
	void onlyTheModeratorOverTheResultsSeesThePictureThatWaits() throws Exception {
		long submission = idIn(reported(ME, Map.of("raceId", race, "seconds", 12345, "link", "",
				"comment", "Sat"), aJpeg("samo za moderatora")));
		long row = theRowOf(submission);
		long photo = thePictureOf(submission);
		String digest = db.sql("select digest from photo where id = ?").param(photo).query(String.class).single();

		MockHttpServletResponse seen = sent(get("/api/verification/" + row + "/photo"), OVER_THE_RESULTS);

		assertThat(seen.getStatus()).isEqualTo(200);
		assertThat(seen.getContentAsByteArray()).isEqualTo(WithoutMetadata.of(aJpeg("samo za moderatora"),
				"image/jpeg"));
		assertThat(seen.getHeader("X-Content-Type-Options")).isEqualTo("nosniff");

		assertThat(sent(get("/api/verification/" + row + "/photo"), OVER_THE_PROFILES).getStatus()).isEqualTo(404);
		assertThat(sent(get("/api/verification/" + row + "/photo"), ME).getStatus()).isEqualTo(404);
		assertThat(sent(get("/api/photos/" + digest), ME).getStatus()).isEqualTo(404);
		assertThat(sent(get("/api/photos/" + digest), OVER_THE_RESULTS).getStatus()).isEqualTo(404);
		assertThat(sent(get("/api/photos/" + digest), null).getStatus()).isEqualTo(404);
	}

	/** And the queue names it, on the row it is the proof of and on no other. */
	@Test
	void theQueueServesThePictureOnItsOwnRow() throws Exception {
		long submission = idIn(reported(ME, Map.of("raceId", race, "seconds", 12345, "link", "",
				"comment", "Sat"), aJpeg("u redu")));

		String queue = sent(get("/api/verification"), OVER_THE_RESULTS).getContentAsString(StandardCharsets.UTF_8);
		var mine = java.util.stream.StreamSupport.stream(mapper.readTree(queue).spliterator(), false)
				.filter(one -> one.path("id").asString().equals(String.valueOf(theRowOf(submission))))
				.findFirst().orElseThrow();

		assertThat(mine.path("photoId").asLong()).isEqualTo(thePictureOf(submission));
	}

	// THE DECISION ----------------------------------------------------------------------------------------

	/**
	 * APPROVED, THE RUN IS COUNTED AND THE PICTURE GOES (PDL: „Priložena slika se i dalje briše sa portala posle
	 * verifikacije"); and the approval names the picture the moderator saw, as every decision about a row that
	 * holds one does.
	 */
	@Test
	void anApprovedRunIsCountedAndItsPictureGoes() throws Exception {
		long submission = idIn(reported(ME, Map.of("raceId", race, "seconds", 12345, "link", "",
				"comment", "Sat"), aJpeg("odobrena")));
		long row = theRowOf(submission);
		long photo = thePictureOf(submission);

		assertThat(decide(row, "{\"approved\":true}").getStatus()).isEqualTo(400);
		assertThat(decide(row, "{\"approved\":true," + seen(row) + "}").getStatus()).isEqualTo(200);

		assertThat(db.sql("select photo_id from verification where id = ?").param(row).query(Long.class)
				.optional()).isEmpty();
		assertThat(db.sql("select count(*) from result r join competitor c on c.id = r.competitor_id"
						+ " where c.member_number = ? and r.race_id = ?").params(ME, race).query(Long.class)
				.single()).isOne();

		TheEndOfTheTransaction.broughtForward(db);

		assertThat(stands(photo)).isFalse();
		assertThat(stands(thePictureOfSomebodyElse())).isTrue();
	}

	/** Refused, the picture goes at once (ADL O11: „red ostaje sa stanjem i razlogom, slika se briše odmah"). */
	@Test
	void aRefusedRunKeepsItsRowAndLosesItsPicture() throws Exception {
		long submission = idIn(reported(ME, Map.of("raceId", race, "seconds", 12345, "link", "",
				"comment", "Sat"), aJpeg("odbijena")));
		long row = theRowOf(submission);
		long photo = thePictureOf(submission);

		assertThat(decide(row, "{\"approved\":false,\"reason\":\"Na slici se ne vidi vreme.\"," + seen(row) + "}")
				.getStatus()).isEqualTo(200);
		assertThat(db.sql("select state || ' ' || coalesce(photo_id::text, '-') from verification where id = ?")
				.param(row).query(String.class).single()).isEqualTo("rejected -");

		TheEndOfTheTransaction.broughtForward(db);

		assertThat(stands(photo)).isFalse();
	}

	// FIXTURE ---------------------------------------------------------------------------------------------

	private void member(String number, String first, String last) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'F', date '1990-01-01', (select id from place where rank = 1), 2027,"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M', timestamptz '2026-01-01 10:00:00+00')")
				.params(number, first, last, String.format("%016x", 0x9210L + ++issued))
				.update();

		HeldOn.activeAt(db, number, IN_JUNE.atZone(SeasonClock.ZONE));

		String email = number + "@primer.rs";

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " (?, ?, ?, (select id from role where code = 'competitor'),"
						+ " (select id from competitor where member_number = ?))")
				.params(first, last, email, number).update();

		session(email);
		cookies.put(number, cookies.get(email));
	}

	private void staff(String email, String right) {
		db.sql("insert into account (first_name, last_name, email, role_id) values"
						+ " ('Moderator', 'Probni', ?, (select id from role where code = 'moderator'))")
				.param(email).update();
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();

		session(email);
	}

	private void session(String email) {
		SecretToken session = SecretToken.fresh();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(IN_JUNE.minus(Duration.ofDays(1))),
						Timestamp.from(IN_JUNE), Timestamp.from(IN_JUNE.plus(SessionLife.LASTS)))
				.update();

		cookies.put(email, session.secret());
	}

	private long race(String name, String day) {
		long event = db.sql("insert into btl_event (slug, name, date, place_id, kind, featured,"
						+ " description, link) values (?, ?, date '" + day + "',"
						+ " (select id from place where rank = 1), 'race', false, '', '') returning id")
				.params("dokaz-" + String.format("%016x", ++issued), name)
				.query(Long.class).single();

		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values (?, ?, false, date '" + day + "', 'length', 0, 21.10, 0, 0) returning id")
				.params(event, name)
				.query(Long.class).single();
	}

	private long ran(String member, long raceId, String day) {
		return db.sql("insert into result (competitor_id, race_id, race_date, distance_km,"
						+ " ascent_m, descent_m, seconds, points)"
						+ " values ((select id from competitor where member_number = ?), ?,"
						+ " date '" + day + "', 21.10, 0, 0, 6000, 50.00) returning id")
				.params(member, raceId)
				.query(Long.class).single();
	}

	/** A file that begins as a JPEG does: what {@link WhatAPictureIs#sniff} reads, and nothing more. */
	private static byte[] aJpeg(String tail) {
		byte[] rest = tail.getBytes(StandardCharsets.UTF_8);
		byte[] whole = new byte[3 + rest.length];

		whole[0] = (byte) 0xFF;
		whole[1] = (byte) 0xD8;
		whole[2] = (byte) 0xFF;
		System.arraycopy(rest, 0, whole, 3, rest.length);

		return whole;
	}

	// ASKING ----------------------------------------------------------------------------------------------

	private MockHttpServletResponse sent(AbstractMockHttpServletRequestBuilder<?> asks, String who)
			throws Exception {
		AbstractMockHttpServletRequestBuilder<?> with = asks.with(csrf());

		return http.perform(who == null ? with : with.cookie(new Cookie(SessionCookie.NAME, cookies.get(who))))
				.andReturn().getResponse();
	}

	private MockHttpServletResponse reported(String who, Map<String, Object> run, byte[] picture) throws Exception {
		MockMultipartHttpServletRequestBuilder asking = multipart("/api/results")
				.file(new MockMultipartFile("picture", "sat.jpg", MediaType.IMAGE_JPEG_VALUE, picture));

		return sent(asking.param("run", json(run)), who);
	}

	private MockHttpServletResponse corrected(long result, byte[] picture, String comment) throws Exception {
		return sent(multipart("/api/results/" + result)
				.file(new MockMultipartFile("picture", "sat.jpg", MediaType.IMAGE_JPEG_VALUE, picture))
				.param("run", json(Map.of("distanceKm", "21.10", "ascentM", 0, "descentM", 0, "seconds", 5000,
						"link", "", "comment", comment)))
				.with(request -> {
					request.setMethod("PUT");
					return request;
				}), ME);
	}

	private MockHttpServletResponse decide(long row, String body) throws Exception {
		return sent(post("/api/verification/" + row + "/decision").contentType(MediaType.APPLICATION_JSON)
				.content(body), OVER_THE_RESULTS);
	}

	private String json(Map<String, Object> fields) throws Exception {
		return mapper.writeValueAsString(fields);
	}

	private String seen(long row) {
		return db.sql("select '\"seenPhotoId\":' || p.id || ',\"seenCrop\":{\"x\":' || p.crop_x || ',\"y\":'"
						+ " || p.crop_y || ',\"size\":' || p.crop_diameter || '}' from verification v"
						+ " join photo p on p.id = v.photo_id where v.id = ?")
				.param(row).query(String.class).single();
	}

	// READING THE STATE -----------------------------------------------------------------------------------

	private long idIn(MockHttpServletResponse answered) throws Exception {
		return mapper.readTree(answered.getContentAsString(StandardCharsets.UTF_8)).path("id").asLong();
	}

	private String reasonOf(MockHttpServletResponse answered) throws Exception {
		return mapper.readTree(answered.getContentAsString(StandardCharsets.UTF_8)).path("reason").asString();
	}

	private long theRowOf(long submission) {
		return db.sql("select id from verification where result_submission_id = ?").param(submission)
				.query(Long.class).single();
	}

	private long thePictureOf(long submission) {
		return db.sql("select photo_id from verification where result_submission_id = ?").param(submission)
				.query(Long.class).single();
	}

	private long thePictureOfSomebodyElse() {
		return db.sql("select v.photo_id from verification v join competitor c on c.id = v.competitor_id"
						+ " where c.member_number = ? and v.queue = 'results'").param(SOMEBODY_ELSE)
				.query(Long.class).single();
	}

	private boolean stands(long photo) {
		return db.sql("select exists(select 1 from photo where id = ?)").param(photo).query(Boolean.class).single();
	}

	/** Every row a send could write, counted together, so „nothing was written" is one number. */
	private long everything() {
		return db.sql("select (select count(*) from photo) + (select count(*) from verification)"
						+ " + (select count(*) from result_submission)").query(Long.class).single()
				+ List.of(PHOTOS.toFile().list()).size();
	}
}
