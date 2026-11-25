package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.StreamSupport;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * WHAT A READER IS SHOWN OF THE TEXTS V115 ADDS: the rules and the prizes of a league, the label of a price, the
 * biography of a member and of a team, a comment, and the five words of a ducat (owner, PDL P18, 25.11.2026,
 * „Automatski prevod sadržaja koji posetilac vidi", „Plan prevoda, prvi krug pitanja" and „drugi krug").
 *
 * <p>The rule is one ({@link TranslatedText#shown}) and the shape of every route is the one {@code /api/events}
 * has (CalendarApiTest): asked in a language, the answer says what that reader is shown, in a field of its own
 * ({@code ...Shown}), and the field that was there stays what was written. Each case below sets up the axis it
 * names so that the right answer and the wrong one are not the same text: two texts of one row that differ, two
 * subjects of one request with the one that is asked for NOT first, a text that waits beside one that was
 * approved.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class TheRestIsReadInALanguageTest {

	private static final ObjectMapper JSON = new ObjectMapper();

	@Autowired
	private JdbcClient db;

	@Autowired
	private MockMvc http;

	/* ---------------------------------------------------------------------------------------------------------- */
	/* Reading                                                                                                     */
	/* ---------------------------------------------------------------------------------------------------------- */

	private JsonNode answer(String address, String session) throws Exception {
		MockHttpServletRequestBuilder asks = get(address);

		if (session != null) {
			asks = asks.cookie(new Cookie(SessionCookie.NAME, session));
		}

		var answered = http.perform(asks).andReturn().getResponse();

		assertThat(answered.getStatus()).as(address).isEqualTo(200);

		return JSON.readTree(answered.getContentAsString(StandardCharsets.UTF_8));
	}

	private JsonNode answer(String address) throws Exception {
		return answer(address, null);
	}

	private static JsonNode where(JsonNode list, String field, String is) {
		return StreamSupport.stream(list.spliterator(), false)
				.filter(one -> one.path(field).asString().equals(is))
				.findFirst()
				.orElseThrow();
	}

	private static String shown(JsonNode shown) {
		return shown.path("text").asString() + "|" + (shown.path("language").isNull() ? "null"
				: shown.path("language").asString()) + "|" + shown.path("machine").asBoolean();
	}

	private static Set<String> keysOf(JsonNode record) {
		Set<String> keys = new TreeSet<>();

		record.propertyNames().forEach(keys::add);

		return keys;
	}

	private String theAdministrator;

	/** A session of a superadmin, who may read what only an active member or the administration reads. */
	private String anAdministrator() {
		if (theAdministrator != null) {
			return theAdministrator;
		}

		db.sql("insert into account (first_name, last_name, email, role_id)"
				+ " values ('Ime', 'Prezime', 'uprava-prevoda@example.org', (select id from role where code = 'superadmin'))")
				.update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at, expires_at)"
						+ " values ((select id from account where email = 'uprava-prevoda@example.org'), ?, ?, ?, ?)")
				.params(session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))), Timestamp.from(now),
						Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		theAdministrator = session.secret();

		return theAdministrator;
	}

	private void active(long member) {
		HeldOn.season(db, member, SeasonClock.seasonsAMemberIsActiveIn(ZonedDateTime.now()).last(), "feeExempt");
	}

	private void machine(String table, String column, String key, long id, String language, String body) {
		TranslatableRows.machine(db, table, column, key, id, language, body);
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* A tag that is not a language is refused, on every route                                                    */
	/* ---------------------------------------------------------------------------------------------------------- */

	@ParameterizedTest
	@ValueSource(strings = {"/api/leagues", "/api/pricing", "/api/competitors", "/api/teams", "/api/ducats"})
	void aLanguageThatIsNotATagIsRefusedWithNoBody(String route) throws Exception {
		for (String lang : List.of("EN", "sr-Latn", "e", "engl", "1")) {
			var answered = http.perform(get(route).param("lang", lang)).andReturn().getResponse();

			assertThat(answered.getStatus()).as(route + " lang=" + lang).isEqualTo(400);
			assertThat(answered.getContentAsString()).isEmpty();
		}
	}

	@Test
	void aLanguageThatIsNotATagIsRefusedOnTheCommentsToo() throws Exception {
		var answered = http.perform(get("/api/comments").param("lang", "EN")
				.cookie(new Cookie(SessionCookie.NAME, anAdministrator()))).andReturn().getResponse();

		assertThat(answered.getStatus()).isEqualTo(400);
		assertThat(answered.getContentAsString()).isEmpty();
	}

	/** A reader who may not read the comments is told the address is not there, whatever he put in the query. */
	@Test
	void theDoorOfTheCommentsIsAskedBeforeTheLanguage() throws Exception {
		assertThat(http.perform(get("/api/comments").param("lang", "EN")).andReturn().getResponse().getStatus())
				.isEqualTo(401);
		assertThat(http.perform(get("/api/comments").param("lang", "en")).andReturn().getResponse().getStatus())
				.isEqualTo(401);
	}

	/**
	 * A SIGNED-IN ACCOUNT THAT MAY NOT READ THE COMMENTS (a member who has never paid) IS TOLD THE ADDRESS IS NOT
	 * THERE, with a language, with a malformed one and with none: the door is asked before the language, and the
	 * chain's 401 is not what holds it, because he is signed in.
	 */
	@Test
	void aSignedInReaderWhoMayNotReadTheCommentsIsToldTheAddressIsNotThereWhateverHePutInTheQuery() throws Exception {
		long unpaid = TranslatableRows.member(db, "000946", "", false);

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
				+ " values ('Ime', 'Prezime', 'bez-clanarine@example.org',"
				+ " (select id from role where code = 'competitor'), ?)")
				.param(unpaid).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at, expires_at)"
						+ " values ((select id from account where email = 'bez-clanarine@example.org'), ?, ?, ?, ?)")
				.params(session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))), Timestamp.from(now),
						Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		for (String query : List.of("", "?lang=en", "?lang=EN")) {
			assertThat(http.perform(get("/api/comments" + query)
					.cookie(new Cookie(SessionCookie.NAME, session.secret()))).andReturn().getResponse().getStatus())
					.as(query).isEqualTo(404);
		}
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* Leagues: the rules and the prizes are two texts of one row                                                  */
	/* ---------------------------------------------------------------------------------------------------------- */

	/**
	 * THE RULES AND THE PRIZES OF ONE LEAGUE ARE TWO TEXTS WITH TWO TRANSLATIONS, and a route that read the one for
	 * the other would show the prizes under the rules: they are written to differ, the league that is asked for is
	 * the SECOND in the list, and the first has a translation of its own that is not this one's.
	 */
	@Test
	void theRulesAndThePrizesOfALeagueEachHaveTheirOwnTranslation() throws Exception {
		long first = TranslatableRows.league(db, "prva-prevod", 2031, "Pravila prve", "Nagrade prve");
		long second = TranslatableRows.league(db, "druga-prevod", 2032, "Pravila druge", "Nagrade druge");

		machine("league", "rules", "league_id", first, "en", "Rules of the first");
		machine("league", "rules", "league_id", second, "en", "Rules of the second");
		machine("league", "prizes", "league_id", second, "en", "Prizes of the second");

		JsonNode asked = answer("/api/leagues?lang=en");
		JsonNode theFirst = where(asked, "slug", "prva-prevod");
		JsonNode theSecond = where(asked, "slug", "druga-prevod");

		assertThat(shown(theSecond.path("rulesShown"))).isEqualTo("Rules of the second|en|true");
		assertThat(shown(theSecond.path("prizesShown"))).isEqualTo("Prizes of the second|en|true");
		assertThat(shown(theFirst.path("rulesShown"))).isEqualTo("Rules of the first|en|true");
		/* The first has no translation of its prizes: they are shown as written, and not as the rules are. */
		assertThat(shown(theFirst.path("prizesShown"))).isEqualTo("Nagrade prve|null|false");
		assertThat(theSecond.path("rules").asString()).isEqualTo("Pravila druge");
		assertThat(theSecond.path("prizes").asString()).isEqualTo("Nagrade druge");
	}

	@Test
	void theRulesAreShownAsWrittenToAReaderOfTheirOwnLanguageAndTheAnswerWithNoLanguageIsUnchanged() throws Exception {
		long league = TranslatableRows.league(db, "treca-prevod", 2033, "Pravila", "Nagrade");

		machine("league", "rules", "league_id", league, "en", "Rules");
		machine("league", "rules", "league_id", league, "sr", "Pravila, ponovo");

		JsonNode in = answer("/api/leagues?lang=sr");

		assertThat(shown(where(in, "slug", "treca-prevod").path("rulesShown"))).isEqualTo("Pravila|sr|false");
		assertThat(keysOf(where(answer("/api/leagues?lang=en"), "slug", "treca-prevod")))
				.containsAll(keysOf(where(answer("/api/leagues"), "slug", "treca-prevod")))
				.hasSize(keysOf(where(answer("/api/leagues"), "slug", "treca-prevod")).size() + 2);
		assertThat(keysOf(where(answer("/api/leagues"), "slug", "treca-prevod")))
				.doesNotContain("rulesShown", "prizesShown");
	}

	@Test
	void aTranslationOfRulesThatHaveChangedIsNotShown() throws Exception {
		long league = TranslatableRows.league(db, "cetvrta-prevod", 2034, "Stara pravila", "Nagrade");

		machine("league", "rules", "league_id", league, "en", "Old rules");
		db.sql("update league set rules = 'Nova pravila' where id = ?").param(league).update();

		assertThat(shown(where(answer("/api/leagues?lang=en"), "slug", "cetvrta-prevod").path("rulesShown")))
				.isEqualTo("Nova pravila|null|false");
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* Price list                                                                                                  */
	/* ---------------------------------------------------------------------------------------------------------- */

	@Test
	void theLabelOfARowOfThePriceListIsShownInEnglishAndTheOthersAsWritten() throws Exception {
		long regular = db.sql("select id from price_row where key = 'regular'").query(Long.class).single();

		machine("price_row", "label", "price_row_id", regular, "en", "6 October to 30 November");

		JsonNode asked = answer("/api/pricing?lang=en");

		assertThat(shown(where(asked, "key", "regular").path("labelShown")))
				.isEqualTo("6 October to 30 November|en|true");
		assertThat(where(asked, "key", "regular").path("label").asString())
				.isEqualTo(db.sql("select label from price_row where key = 'regular'").query(String.class).single());
		/* The row that is not the one translated is shown as it was written, and it is not the first row either. */
		assertThat(shown(where(asked, "key", "early").path("labelShown")))
				.isEqualTo(db.sql("select label from price_row where key = 'early'").query(String.class).single()
						+ "|null|false");
		assertThat(keysOf(where(asked, "key", "early")))
				.isEqualTo(new TreeSet<>(Set.of("key", "label", "kind", "from", "to", "eur", "rsd", "ranking",
						"labelShown")));
		assertThat(keysOf(where(answer("/api/pricing"), "key", "early"))).doesNotContain("labelShown");
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* Biography of a member                                                                                        */
	/* ---------------------------------------------------------------------------------------------------------- */

	/**
	 * A MEMBER WHO HIDES HIS PROFILE HAS NO BIOGRAPHY ANSWERED TO A VISITOR, and so no translation of it: the answer
	 * for him says nothing of it, even where a translation exists (the pass never makes one, and one that stood from
	 * before he hid is not shown). The member asked for is the SECOND of two, so a join on the first would show the
	 * other's words.
	 */
	@Test
	void aHiddenBiographyHasNoTranslationAnsweredToAVisitorAndAnotherMembersIsNotThisOnes() throws Exception {
		long open = TranslatableRows.member(db, "000941", "Trčim od detinjstva.", false);
		long hidden = TranslatableRows.member(db, "000942", "Privatna biografija.", true);
		long plain = TranslatableRows.member(db, "000943", "Druga biografija.", false);

		active(open);
		active(hidden);
		active(plain);
		machine("competitor", "bio", "competitor_id", open, "en", "I have run since childhood.");
		machine("competitor", "bio", "competitor_id", hidden, "en", "Private biography.");

		JsonNode asked = answer("/api/competitors?lang=en");

		assertThat(shown(where(asked, "memberNumber", "000941").path("bioShown")))
				.isEqualTo("I have run since childhood.|en|true");
		assertThat(where(asked, "memberNumber", "000941").path("bio").asString()).isEqualTo("Trčim od detinjstva.");
		assertThat(where(asked, "memberNumber", "000942").path("bio").isNull()).isTrue();
		assertThat(where(asked, "memberNumber", "000942").has("bioShown")).isFalse();
		assertThat(asked.toString()).doesNotContain("Private biography").doesNotContain("Privatna biografija");
		assertThat(shown(where(asked, "memberNumber", "000943").path("bioShown")))
				.isEqualTo("Druga biografija.|null|false");
		assertThat(keysOf(where(answer("/api/competitors"), "memberNumber", "000943"))).doesNotContain("bioShown");
	}

	/** A member who has written nothing is shown nothing, in any language. */
	@Test
	void aMemberWithNoBiographyIsShownNone() throws Exception {
		long silent = TranslatableRows.member(db, "000944", "", false);

		active(silent);

		assertThat(shown(where(answer("/api/competitors?lang=en"), "memberNumber", "000944").path("bioShown")))
				.isEqualTo("|null|false");
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* Description of a team                                                                                        */
	/* ---------------------------------------------------------------------------------------------------------- */

	@Test
	void theDescriptionOfATeamIsShownInEnglishAndAnotherTeamsIsNotThisOnes() throws Exception {
		long first = TranslatableRows.team(db, "a-prvi-prevod", "Mi smo prvi.");
		long second = TranslatableRows.team(db, "b-drugi-prevod", "Mi smo drugi.");

		machine("team", "bio", "team_id", second, "en", "We are the second.");

		JsonNode asked = answer("/api/teams?lang=en");

		assertThat(shown(where(asked, "slug", "b-drugi-prevod").path("bioShown")))
				.isEqualTo("We are the second.|en|true");
		assertThat(shown(where(asked, "slug", "a-prvi-prevod").path("bioShown"))).isEqualTo("Mi smo prvi.|null|false");
		assertThat(where(asked, "slug", "b-drugi-prevod").path("bio").asString()).isEqualTo("Mi smo drugi.");
		assertThat(first).isNotEqualTo(second);
		assertThat(keysOf(where(answer("/api/teams"), "slug", "a-prvi-prevod"))).doesNotContain("bioShown");
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* Comments                                                                                                     */
	/* ---------------------------------------------------------------------------------------------------------- */

	/**
	 * A COMMENT THAT WAITS FOR A MODERATOR IS NOT AN EVENT COMMENT, so it has no translation and no place in this
	 * answer: only {@code event_comment} is read. And the comment asked for is the OLDER of two (the list is newest
	 * first), so a join on the wrong row would show the newer one's words.
	 */
	@Test
	void aCommentIsShownInEnglishAndTheOneBesideItIsShownAsWritten() throws Exception {
		long event = TranslatableRows.event(db, "prevod-komentar", "Opis");
		long member = TranslatableRows.member(db, "000945", "", false);
		long older = TranslatableRows.comment(db, event, member, "Odlična organizacija.");

		db.sql("insert into event_comment (event_id, competitor_id, who, published_at, rating_organisation,"
				+ " rating_value, rating_ambience, body) values (?, ?, 'Novi Autor',"
				+ " timestamptz '2027-05-09 10:00:00+00', 5, 5, 5, 'Sjajna staza.')").params(event, member).update();
		machine("event_comment", "body", "event_comment_id", older, "en", "Excellent organisation.");

		JsonNode asked = answer("/api/comments?lang=en", anAdministrator());

		assertThat(shown(where(asked, "body", "Odlična organizacija.").path("bodyShown")))
				.isEqualTo("Excellent organisation.|en|true");
		assertThat(shown(where(asked, "body", "Sjajna staza.").path("bodyShown"))).isEqualTo("Sjajna staza.|null|false");
		assertThat(keysOf(where(answer("/api/comments", anAdministrator()), "body", "Sjajna staza.")))
				.doesNotContain("bodyShown");
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* Ducats: by hand                                                                                              */
	/* ---------------------------------------------------------------------------------------------------------- */

	/**
	 * THE ENGLISH OF THE FIFTEEN IS THERE FROM V115, written by hand, and a reader of /sr is shown the Serbian as
	 * written, marked as Serbian and not as the machine's. A ducat that has a legend in one language and not the other
	 * on one arc (the period stands there) is shown the empty one as it is.
	 */
	@Test
	void theDucatsSpeakEnglishByHandAndSerbianAsWritten() throws Exception {
		JsonNode english = where(answer("/api/ducats?lang=en"), "id", "duk-drzave");
		JsonNode serbian = where(answer("/api/ducats?lang=sr"), "id", "duk-drzave");

		assertThat(shown(english.path("nameShown"))).isEqualTo("Countries|en|false");
		assertThat(shown(english.path("topShown"))).isEqualTo("RAN IN|en|false");
		assertThat(shown(english.path("topFemaleShown"))).isEqualTo("RAN IN|en|false");
		assertThat(shown(english.path("bottomShown"))).isEqualTo("COUNTRIES|en|false");
		assertThat(shown(english.path("countedShown"))).isEqualTo("countries|en|false");
		assertThat(english.path("name").asString()).isEqualTo("Države");
		assertThat(english.path("top").asString()).isEqualTo("TRČAO U");

		assertThat(shown(serbian.path("nameShown"))).isEqualTo("Države|sr|false");
		assertThat(shown(serbian.path("topShown"))).isEqualTo("TRČAO U|sr|false");
		assertThat(shown(serbian.path("topFemaleShown"))).isEqualTo("TRČALA U|sr|false");
		assertThat(shown(serbian.path("bottomShown"))).isEqualTo("DRŽAVA|sr|false");
		assertThat(shown(serbian.path("countedShown"))).isEqualTo("država|sr|false");
	}

	/** A legend that is empty in Serbian is empty in English: nothing is invented for the arc the period takes. */
	@Test
	void anEmptyLegendStaysEmptyInEnglish() throws Exception {
		JsonNode english = where(answer("/api/ducats?lang=en"), "id", "duk-mesecni-sati");

		assertThat(shown(english.path("topShown"))).isEqualTo("|sr|false");
		assertThat(shown(english.path("bottomShown"))).isEqualTo("RUN TIME|en|false");
		assertThat(shown(english.path("topFemaleShown"))).isEqualTo("|sr|false");
	}

	/** No ducat answers a field the answer with no language does not, apart from the five that say what is shown. */
	@Test
	void askedInALanguageTheDucatAnswersTheFiveShownAndNothingMore() throws Exception {
		JsonNode with = where(answer("/api/ducats?lang=en"), "id", "duk-sve-trke");
		JsonNode without = where(answer("/api/ducats"), "id", "duk-sve-trke");

		Set<String> expected = new TreeSet<>(keysOf(without));
		expected.addAll(List.of("nameShown", "topShown", "topFemaleShown", "bottomShown", "countedShown"));

		assertThat(keysOf(with)).isEqualTo(expected);
		assertThat(with.path("top").asString()).isEqualTo(without.path("top").asString());
	}

	/** No hand translation of a ducat is ever read as a machine's, so no screen says „Automatski prevod" of a coin. */
	@Test
	void noDucatIsMarkedAsTheMachines() throws Exception {
		List<String> machines = new ArrayList<>();

		for (JsonNode one : answer("/api/ducats?lang=en")) {
			for (String field : List.of("nameShown", "topShown", "topFemaleShown", "bottomShown", "countedShown")) {
				if (one.path(field).path("machine").asBoolean()) {
					machines.add(one.path("id").asString() + "." + field);
				}
			}
		}

		assertThat(machines).isEmpty();
	}
}
