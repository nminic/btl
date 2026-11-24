package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.sponsor.SponsorOfTheDay;
import com.btl.portal.domain.sponsor.SponsorOfTheDay.InRotation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * THE FRONT PAGE'S SPONSORS, AS ANYBODY READS THEM ({@link SponsorApi}).
 *
 * <p>The postavka separates every pair of sources that could give the same answer:
 * <ul>
 * <li>THE ORDER: the main sponsor has the LARGEST identity and the LARGEST place, and the manual order of the
 * others is not the order of their identities, so „main first" and „by place" and „by identity" are three
 * different lists;</li>
 * <li>THE TWO SWITCHES: a sponsor in the strip and not in the rotation, one in the rotation and not in the strip,
 * and the main one in both;</li>
 * <li>THE DAY: read at 23:30 UTC, which is already the next day in Belgrade, and on a cycle where the two days
 * name different sponsors, so a day taken from the server's clock and not the league's is a different answer;
 * and the day the case reads is not the day the rows were written, because nothing about writing them is a
 * day at all;</li>
 * <li>THE LANGUAGE: one sponsor with an English description and one without.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({ TestcontainersConfiguration.class, SponsorApiTest.TheClockTheseCasesUse.class })
@Transactional
class SponsorApiTest {

	/** 23:30 in London, half past midnight on the 15th in Belgrade. */
	private static final Instant LATE_ON_THE_14TH = Instant.parse("2027-03-14T23:30:00Z");

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	@Autowired
	private AClockTheCaseMoves clock;

	static final class AClockTheCaseMoves extends Clock {

		private Instant now;

		private AClockTheCaseMoves(Instant now) {
			this.now = now;
		}

		void moveTo(Instant when) {
			this.now = when;
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

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockTheseCasesUse {

		@Bean
		@Primary
		AClockTheCaseMoves aClockTheCaseMoves() {
			return new AClockTheCaseMoves(LATE_ON_THE_14TH);
		}
	}

	private int issued;

	private final Map<Long, String> digests = new HashMap<>();

	@BeforeEach
	void theClockIsWhereTheCaseBegins() {
		clock.moveTo(LATE_ON_THE_14TH);
	}

	/** A sponsor, its logo a photo row of its own unless {@code withALogo} is false. */
	private long sponsor(String name, int position, boolean main, boolean inRotation, boolean inStrip,
			String english, boolean withALogo) {
		Long logo = null;

		if (withALogo) {
			String digest = String.format("%064x", 0x5b0000 + ++issued);

			logo = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
							+ " values ('image/png', 2048, ?, 0.5, 0.5, 1) returning id")
					.param(digest).query(Long.class).single();
			digests.put(logo, digest);
		}

		return db.sql("insert into sponsor (name, url, logo_id, description_sr, description_en, main, in_rotation,"
						+ " in_strip, position) values (?, ?, ?, ?, ?, ?, ?, ?, ?) returning id")
				.params(name, "https://" + name.toLowerCase() + ".primer.rs/", logo, "Opis za " + name, english, main,
						inRotation, inStrip, position)
				.query(Long.class).single();
	}

	private MockHttpServletResponse asked(String query) throws Exception {
		return http.perform(get("/api/sponsors" + query)).andReturn().getResponse();
	}

	private JsonNode read(String query) throws Exception {
		MockHttpServletResponse answer = asked(query);

		assertThat(answer.getStatus()).as(answer.getContentAsString()).isEqualTo(200);

		return mapper.readTree(answer.getContentAsString(StandardCharsets.UTF_8));
	}

	private static List<String> namesIn(JsonNode list) {
		return StreamSupport.stream(list.spliterator(), false).map(one -> one.path("name").asString()).toList();
	}

	// NOBODY --------------------------------------------------------------------------------------------

	@Test
	void withNoSponsorThereIsNoSponsorOfTheDayAndNoStrip() throws Exception {
		JsonNode answer = read("");

		assertThat(answer.get("ofTheDay").isNull()).isTrue();
		assertThat(answer.get("strip").isArray()).isTrue();
		assertThat(answer.get("strip")).isEmpty();
	}

	@Test
	void sponsorsWithBothSwitchesOffAreNeitherInTheBoxNorInTheStrip() throws Exception {
		sponsor("Ugaseni", 0, false, false, false, null, true);
		sponsor("Glavni", 1, true, false, false, null, true);

		JsonNode answer = read("");

		assertThat(answer.get("ofTheDay").isNull()).isTrue();
		assertThat(answer.get("strip")).isEmpty();
	}

	@Test
	void aSponsorWithNoLogoIsNeitherInTheBoxNorInTheStrip() throws Exception {
		sponsor("Bezloga", 0, true, true, true, null, false);

		JsonNode answer = read("");

		assertThat(answer.get("ofTheDay").isNull()).isTrue();
		assertThat(answer.get("strip")).isEmpty();

		long withOne = sponsor("Saznakom", 1, false, true, true, null, true);

		assertThat(read("").get("ofTheDay").path("id").asLong()).isEqualTo(withOne);
		assertThat(namesIn(read("").get("strip"))).containsExactly("Saznakom");
	}

	// THE STRIP -----------------------------------------------------------------------------------------

	@Test
	void theStripIsTheMainSponsorFirstAndThenTheManualOrderOfTheOthersInIt() throws Exception {
		/* Written in an order that is neither the place nor the main one first. */
		sponsor("Treci", 7, false, false, true, null, true);
		sponsor("Prvi", 2, false, true, true, null, true);
		sponsor("Vanstrane", 0, false, true, false, null, true);
		sponsor("Drugi", 5, false, false, true, null, true);
		sponsor("Glavni", 9, true, true, true, null, true);

		assertThat(namesIn(read("").get("strip"))).containsExactly("Glavni", "Prvi", "Drugi", "Treci");
	}

	@Test
	void eachSponsorIsDrawnByItsOwnNameLinkAndLogo() throws Exception {
		long one = sponsor("Volt", 0, false, false, true, null, true);
		long logo = db.sql("select logo_id from sponsor where id = ?").param(one).query(Long.class).single();

		JsonNode drawn = read("").get("strip").get(0);

		assertThat(drawn.path("id").asLong()).isEqualTo(one);
		assertThat(drawn.path("name").asString()).isEqualTo("Volt");
		assertThat(drawn.path("url").asString()).isEqualTo("https://volt.primer.rs/");
		assertThat(drawn.path("logo").asString()).isEqualTo("/api/photos/" + digests.get(logo));
		assertThat(drawn.path("description").asString()).isEqualTo("Opis za Volt");
		assertThat(drawn.path("language").asString()).isEqualTo("sr");
	}

	/**
	 * The fields of one sponsor as served, which is what `home/Sponsor.tsx` reads by. The mock the front page
	 * reads is the empty answer on purpose (the page with no sponsor is the page of 20.11.2026), so it carries no
	 * record to compare with and the names are written here, once.
	 */
	@Test
	void aSponsorIsAnsweredWithExactlyTheFieldsTheFrontPageReads() throws Exception {
		sponsor("Volt", 0, false, true, true, null, true);

		JsonNode answer = read("");

		assertThat(Answers.fieldsOf(answer)).containsExactly("ofTheDay", "strip");
		assertThat(Answers.fieldsOf(answer.get("ofTheDay")))
				.containsExactly("id", "name", "url", "logo", "description", "language");
		assertThat(Answers.fieldsOf(answer.get("strip").get(0))).isEqualTo(Answers.fieldsOf(answer.get("ofTheDay")));
		assertThat(Answers.fieldsOf(mapper.readTree(java.nio.file.Files.readString(java.nio.file.Path.of("..", "frontend",
				"src", "test", "mock", "sponsors.json"))))).containsExactly("ofTheDay", "strip");
	}

	/**
	 * THE NAMES THE FRONT PAGE'S TYPE READS ARE THE NAMES THE ROUTE ANSWERS (independent review of PR 826, 24.11.2026,
	 * SREDNJI 1). The served file is empty (`nobody`), so no case on either side meets a sponsor of the day: the
	 * frontend's sample is checked against its own type, this class against its own record, and a field renamed on one
	 * side and not on the other, `language` into `lang`, passed both. The seam is the NAME of each field, read from the
	 * two places that write it: the record the route builds and the type the front page is drawn from.
	 */
	@Test
	void theFieldsOfASponsorTheFrontPageReadsAreTheOnesTheRouteAnswers() throws Exception {
		sponsor("Prvi", 0, false, true, true, null, true);

		JsonNode answer = read("");

		assertThat(Answers.fieldsOf(answer.get("ofTheDay")))
				.as("the route answers other fields than the type `SponsorShown` names")
				.containsExactlyInAnyOrderElementsOf(namesOfTheFieldsOf("SponsorShown"));
		assertThat(Answers.fieldsOf(answer)).containsExactlyInAnyOrderElementsOf(namesOfTheFieldsOf("FrontPageSponsors"));
	}

	/** The fields of one exported type of the front end, as it writes them: a name at the first indent, then a colon. */
	private static List<String> namesOfTheFieldsOf(String type) throws Exception {
		String source = Files.readString(Path.of("..", "frontend", "src", "data", "types.ts"));
		Matcher body = Pattern.compile("export type " + type + " = \\{\\R(.*?)\\R\\}", Pattern.DOTALL).matcher(source);

		assertThat(body.find()).as("the type " + type + " is not written as an object type in types.ts").isTrue();

		List<String> names = new ArrayList<>();
		Matcher field = Pattern.compile("^  (\\w+)\\??: ", Pattern.MULTILINE).matcher(body.group(1));

		while (field.find()) {
			names.add(field.group(1));
		}

		assertThat(names).as("no field was found in the type " + type).isNotEmpty();

		return names;
	}

	/**
	 * THE MAIN SPONSOR STANDS TWICE FOR EVERY ONCE OF ANOTHER WHATEVER THE NUMBER OF THE OTHERS, as the route serves it
	 * (independent review of PR 826, 24.11.2026, low): the case above holds three others, an odd number, and a rule that
	 * doubled the main sponsor only then was told from the right one by the unit test alone, never by the route. The
	 * cycle is {@code others + 2} days, so five whole cycles are walked for each count.
	 */
	@ParameterizedTest
	@ValueSource(ints = {0, 1, 2, 4})
	void theMainSponsorStandsTwiceForEveryOnceOfAnotherForAnyNumberOfOthers(int others) throws Exception {
		long main = sponsor("Glavni", 90, true, true, true, null, true);
		List<Long> theOthers = new ArrayList<>();

		for (int one = 0; one < others; one++) {
			theOthers.add(sponsor("Drugi" + "x".repeat(one + 1), one, false, true, false, null, true));
		}

		List<Long> seen = new ArrayList<>();

		for (int day = 0; day < 5 * (others + 2); day++) {
			clock.moveTo(LATE_ON_THE_14TH.plusSeconds(86_400L * day));
			seen.add(read("").get("ofTheDay").path("id").asLong());
		}

		Map<Long, Long> counted = seen.stream().collect(Collectors.groupingBy(one -> one, Collectors.counting()));

		assertThat(counted.get(main)).as("days of the main sponsor").isEqualTo(10L);

		for (long other : theOthers) {
			assertThat(counted.get(other)).as("days of sponsor " + other).isEqualTo(5L);
		}
	}

	// THE SPONSOR OF THE DAY ------------------------------------------------------------------------------

	/** The rotation as the route hands it to the rule, in the same order. */
	private List<InRotation> inRotation() {
		return db.sql("select id, main from sponsor where in_rotation and logo_id is not null"
						+ " order by main desc, position, id")
				.query(InRotation.class).list();
	}

	@Test
	void theSponsorOfTheDayIsTheDayOfTheLeaguesTimeZoneAndNotOfTheServersClock() throws Exception {
		sponsor("Prvi", 0, false, true, false, null, true);
		sponsor("Drugi", 1, false, true, false, null, true);
		sponsor("Treci", 2, false, true, false, null, true);

		LocalDate inBelgrade = LATE_ON_THE_14TH.atZone(SeasonClock.ZONE).toLocalDate();
		LocalDate inLondon = LATE_ON_THE_14TH.atZone(ZoneOffset.UTC).toLocalDate();

		assertThat(inBelgrade).isEqualTo(inLondon.plusDays(1));

		long expected = SponsorOfTheDay.on(inRotation(), inBelgrade).orElseThrow();

		assertThat(expected).as("the two days name the same sponsor, so this case could not tell them apart")
				.isNotEqualTo(SponsorOfTheDay.on(inRotation(), inLondon).orElseThrow());
		assertThat(read("").get("ofTheDay").path("id").asLong()).isEqualTo(expected);
	}

	@Test
	void overAWholeCycleOfDaysTheMainSponsorStandsTwiceForEveryOnceOfAnyOther() throws Exception {
		long main = sponsor("Glavni", 8, true, true, true, null, true);
		long first = sponsor("Prvi", 1, false, true, false, null, true);
		long second = sponsor("Drugi", 3, false, true, true, null, true);
		long third = sponsor("Treci", 5, false, true, false, null, true);
		/* In the strip and not in the rotation: it stands on no day. */
		sponsor("Samotraka", 0, false, false, true, null, true);

		List<Long> seen = new ArrayList<>();

		for (int day = 0; day < 5 * 4; day++) {
			clock.moveTo(LATE_ON_THE_14TH.plusSeconds(86_400L * day));
			seen.add(read("").get("ofTheDay").path("id").asLong());
		}

		assertThat(seen.stream().collect(Collectors.groupingBy(one -> one, Collectors.counting())))
				.containsExactlyInAnyOrderEntriesOf(Map.of(main, 8L, first, 4L, second, 4L, third, 4L));
		/* And every sponsor of the rotation stood on some day, the one in the strip alone on none. */
		assertThat(Set.copyOf(seen)).containsExactlyInAnyOrder(main, first, second, third);
	}

	@Test
	void withNobodyMarkedMainEverySponsorInTheRotationStandsAsOftenAsAnother() throws Exception {
		long first = sponsor("Prvi", 4, false, true, true, null, true);
		long second = sponsor("Drugi", 1, false, true, true, null, true);

		List<Long> seen = new ArrayList<>();

		for (int day = 0; day < 2 * 6; day++) {
			clock.moveTo(LATE_ON_THE_14TH.plusSeconds(86_400L * day));
			seen.add(read("").get("ofTheDay").path("id").asLong());
		}

		assertThat(seen.stream().collect(Collectors.groupingBy(one -> one, Collectors.counting())))
				.containsExactlyInAnyOrderEntriesOf(Map.of(first, 6L, second, 6L));
	}

	@Test
	void theSponsorOfTheDayIsInTheRotationAndNeedNotBeInTheStrip() throws Exception {
		long only = sponsor("Samoboks", 3, false, true, false, null, true);

		sponsor("Samotraka", 1, true, false, true, null, true);

		JsonNode answer = read("");

		assertThat(answer.get("ofTheDay").path("id").asLong()).isEqualTo(only);
		assertThat(namesIn(answer.get("strip"))).containsExactly("Samotraka");
	}

	@Test
	void theSameDayIsTheSameSponsorForEveryReaderAndEveryLanguage() throws Exception {
		sponsor("Prvi", 0, false, true, true, "In English", true);
		sponsor("Drugi", 1, false, true, true, null, true);
		sponsor("Treci", 2, false, true, true, null, true);

		long once = read("").get("ofTheDay").path("id").asLong();

		assertThat(read("?lang=en").get("ofTheDay").path("id").asLong()).isEqualTo(once);
		assertThat(read("?lang=sr").get("ofTheDay").path("id").asLong()).isEqualTo(once);
		assertThat(read("").get("ofTheDay").path("id").asLong()).isEqualTo(once);
	}

	// THE LANGUAGE ----------------------------------------------------------------------------------------

	@Test
	void theDescriptionIsInEnglishWhereItIsWrittenAndInSerbianWhereItIsNot() throws Exception {
		sponsor("Engleski", 0, false, false, true, "Energy drink for long runs", true);
		sponsor("Srpski", 1, false, false, true, null, true);

		List<String> english = StreamSupport.stream(read("?lang=en").get("strip").spliterator(), false)
				.map(one -> one.path("description").asString() + " | " + one.path("language").asString()).toList();
		List<String> serbian = StreamSupport.stream(read("?lang=sr").get("strip").spliterator(), false)
				.map(one -> one.path("description").asString() + " | " + one.path("language").asString()).toList();
		List<String> unasked = StreamSupport.stream(read("").get("strip").spliterator(), false)
				.map(one -> one.path("description").asString() + " | " + one.path("language").asString()).toList();

		assertThat(english).containsExactly("Energy drink for long runs | en", "Opis za Srpski | sr");
		assertThat(serbian).containsExactly("Opis za Engleski | sr", "Opis za Srpski | sr");
		assertThat(unasked).isEqualTo(serbian);
	}

	@Test
	void aLanguageThePortalHasNoWordsInIsAnsweredTheOriginal() throws Exception {
		sponsor("Engleski", 0, false, false, true, "Energy drink", true);

		assertThat(read("?lang=cnr").get("strip").get(0).path("language").asString()).isEqualTo("sr");
	}

	@Test
	void aValueNotShapedLikeALanguageIsRefused() throws Exception {
		assertThat(asked("?lang=EN").getStatus()).isEqualTo(400);
		assertThat(asked("?lang=e").getStatus()).isEqualTo(400);
		assertThat(asked("?lang=engl").getStatus()).isEqualTo(400);
		/* A tag with the end of a line behind it is not a tag (independent security review of PR 826, 24.11.2026, low
		   N4): `$` in a Java pattern stands before a final line terminator, so only a match of the WHOLE value keeps
		   `sr` and `sr` plus a line break apart, and a search for the pattern inside the value would take both. */
		assertThat(asked("?lang=sr%0A").getStatus()).isEqualTo(400);
		assertThat(asked("?lang=en%0A").getStatus()).isEqualTo(400);
		assertThat(asked("?lang=").getStatus()).isEqualTo(400);
	}
}
