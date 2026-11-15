package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.card.CompetitorCard;
import com.btl.portal.domain.card.WhatACardSays;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * WHAT A NETWORK SHOWS FOR THE ADDRESS OF A PROFILE, ASKED AS NGINX ASKS FOR IT.
 *
 * <p>Owner, PDL P11, 15.11.2026: the preview of a pasted profile carries the card and the title
 * „{ime i prezime} u Balkanskoj trkačkoj ligi”, and no description. What nginx does with the answer
 * is {@code frontend/src/test/serverConfig.test.ts}'s; this class holds the answer.
 *
 * <p><b>Nothing in the setting is the only one of its kind</b> (the rule in {@code CLAUDE.md} about
 * two sources of one value). The member asked for is never first on the list, and the member first
 * on it has a portrait and a team of his own, so a block that read the wrong member says another
 * name and another card; every member a visitor may not see is asked for beside one he may, by the
 * same shape of address; the English page is asked of the same member as the Serbian one, so a
 * title or a card read in the wrong language is another string; and one reader is signed in as an
 * active member, who may read a hidden profile on the portal and still gets no block for it here.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, CompetitorCardApiTest.TheClockTheseCasesUse.class})
@Transactional
class CompetitorPreviewApiTest {

	/** First on the list, with a portrait and a team of his own. */
	private static final String FIRST = "000730";

	/** The member whose preview is asked for. */
	private static final String ASKED = "000731";

	/** A hidden profile, whose fee stands. */
	private static final String HIDDEN = "000732";

	/** A member whose fee has lapsed: a member of 2027 and not of 2028. */
	private static final String LAPSED = "000733";

	/** A member who is deleted before the case asks. */
	private static final String DELETED = "000734";

	/** A name with every letter an attribute must not carry as it is, and Cyrillic. */
	private static final String TYPED = "000735";

	/** A name the address of a profile cannot spell at all. */
	private static final String GREEK = "000736";

	/** An active member, who reads hidden profiles on the portal. */
	private static final String READER = "000737";

	private static final String NOBODY = "000799";

	private static final String TYPED_FIRST = "Ђорђе \"Ђоле\"";

	private static final String TYPED_LAST = "<Јовановић> & 'Син'";

	private final ObjectMapper json = new ObjectMapper();

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private CompetitorCards cards;

	@Autowired
	private CompetitorPreviewApi previews;

	@Autowired
	private Clock clock;

	@Value("${btl.portal.address}")
	private String portal;

	@BeforeEach
	void aLeagueWithMembersAVisitorMayAndMayNotSee() {
		member(FIRST, "Ana", "Prva");
		member(ASKED, "Nikola", "Minić");
		member(HIDDEN, "Skriveni", "Član");
		member(LAPSED, "Bivši", "Član");
		member(DELETED, "Obrisani", "Član");
		member(TYPED, TYPED_FIRST, TYPED_LAST);
		member(GREEK, "Γιώργος", "Παπαδόπουλος");
		member(READER, "Aktivni", "Čitalac");

		for (String number : List.of(FIRST, ASKED, HIDDEN, DELETED, TYPED, GREEK, READER)) {
			memberOf(number, 2028);
		}

		memberOf(LAPSED, 2027);

		db.sql("update competitor set profile_hidden = true where member_number = ?").param(HIDDEN).update();
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id, first_season,"
				+ " admin_id) values ('prvi-tim', 'Prvi tim', '', '', (select id from place where rank = 1),"
				+ " null, null, null, 2027, null)").update();
		db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to, left_reason)"
				+ " values ((select id from competitor where member_number = ?),"
				+ " (select id from team where slug = 'prvi-tim'), 2027, null, null)").param(FIRST).update();
		db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
				+ " values ('image/jpeg', 10, ?, 0.25, 0.5, 0.8)").param("a".repeat(64)).update();
		db.sql("update competitor set photo_id = (select id from photo where digest = ?) where member_number = ?")
				.params("a".repeat(64), FIRST).update();

		db.sql("delete from membership where competitor_id = (select id from competitor where member_number = ?)")
				.param(DELETED).update();
		db.sql("delete from competitor where member_number = ?").param(DELETED).update();
	}

	@Test
	void theBlockNamesTheMemberAndHisCardInTheOwnersWordsAndNothingElse() throws Exception {
		MockHttpServletResponse answered = response("/api/previews/competitor/" + ASKED + "-sr", null);
		String card = portal + cards.addressOf(ASKED, WhatACardSays.SERBIAN).orElseThrow();

		assertThat(answered.getStatus()).isEqualTo(200);
		assertThat(answered.getContentType()).isEqualTo("text/html;charset=UTF-8");
		assertThat(answered.getHeader("Cache-Control")).isEqualTo("no-store");
		assertThat(card).matches(".*/api/cards/competitor/" + ASKED + "-sr1-[0-9a-f]{16}\\.jpg");
		assertThat(answered.getContentAsString()).isEqualTo(String.join("\n    ",
				"<title>Nikola Minić u Balkanskoj trkačkoj ligi</title>",
				"<meta property=\"og:type\" content=\"profile\" />",
				"<meta property=\"og:site_name\" content=\"Balkanska trkačka liga\" />",
				"<meta property=\"og:title\" content=\"Nikola Minić u Balkanskoj trkačkoj ligi\" />",
				"<meta property=\"og:url\" content=\"" + portal + "/sr/takmicar/" + ASKED + "-nikola-minic\" />",
				"<meta property=\"og:locale\" content=\"sr_RS\" />",
				"<meta property=\"og:image\" content=\"" + card + "\" />",
				"<meta property=\"og:image:type\" content=\"image/jpeg\" />",
				"<meta property=\"og:image:width\" content=\"1200\" />",
				"<meta property=\"og:image:height\" content=\"630\" />",
				"<meta property=\"og:image:alt\" content=\"Kartica profila: Nikola Minić\" />",
				"<meta name=\"twitter:card\" content=\"summary_large_image\" />",
				"<meta name=\"twitter:title\" content=\"Nikola Minić u Balkanskoj trkačkoj ligi\" />",
				"<meta name=\"twitter:image\" content=\"" + card + "\" />",
				"<meta name=\"twitter:image:alt\" content=\"Kartica profila: Nikola Minić\" />") + "\n");
		/* „ne treba da piše uopšte ovaj deo [...]” (owner, 15.11.2026): no description of any kind,
		   so a network that falls back from one to the other has nothing to fall back to. */
		assertThat(answered.getContentAsString()).doesNotContain("description");
	}

	@Test
	void theEnglishPageIsTitledInEnglishAndShowsTheEnglishCard() throws Exception {
		String serbian = response("/api/previews/competitor/" + ASKED + "-sr", null).getContentAsString();
		String english = response("/api/previews/competitor/" + ASKED + "-en", null).getContentAsString();
		String card = portal + cards.addressOf(ASKED, WhatACardSays.ENGLISH).orElseThrow();

		assertThat(card).contains("-en1-");
		assertThat(content(english, "og:image")).isEqualTo(card).isNotEqualTo(content(serbian, "og:image"));
		assertThat(content(english, "twitter:image")).isEqualTo(card);
		assertThat(content(english, "og:title")).isEqualTo("Nikola Minić in the Balkan Running League");
		assertThat(english).contains("<title>Nikola Minić in the Balkan Running League</title>");
		assertThat(content(english, "og:locale")).isEqualTo("en_GB");
		assertThat(content(english, "og:url")).isEqualTo(portal + "/en/takmicar/" + ASKED + "-nikola-minic");
		assertThat(content(english, "og:image:alt")).isEqualTo("Profile card: Nikola Minić");
	}

	@Test
	void everyProfileAVisitorMayNotSeeIsAnsweredAsANumberNobodyHolds() throws Exception {
		MockHttpServletResponse nobody = response("/api/previews/competitor/" + NOBODY + "-sr", null);

		assertThat(nobody.getStatus()).isEqualTo(404);

		List<String> pages = new ArrayList<>();

		for (String number : List.of(HIDDEN, LAPSED, DELETED)) {
			pages.add(number + "-sr");
			pages.add(number + "-en");
		}

		/* And every name of the wrong shape, which nginx never sends and the route still refuses. */
		pages.addAll(List.of(ASKED, ASKED + "-de", ASKED + "-SR", ASKED + "-sr-x", "x" + ASKED + "-sr",
				"00073-sr", "1"));

		for (String page : pages) {
			MockHttpServletResponse answered = response("/api/previews/competitor/" + page, null);

			assertThat(answered.getStatus()).as(page).isEqualTo(nobody.getStatus());
			assertThat(answered.getContentAsByteArray()).as(page).isEqualTo(nobody.getContentAsByteArray());
			assertThat(answered.getErrorMessage()).as(page).isEqualTo(nobody.getErrorMessage());
			assertThat(answered.getHeaderNames()).as(page).isEqualTo(nobody.getHeaderNames());
		}

		/* The control that makes the hidden case a case: the same member, once he stops hiding, has a
		   block, so it is the hiding and nothing else about him that took it away. */
		db.sql("update competitor set profile_hidden = false where member_number = ?").param(HIDDEN).update();
		assertThat(response("/api/previews/competitor/" + HIDDEN + "-sr", null).getStatus()).isEqualTo(200);
	}

	@Test
	void anActiveMemberWhoReadsHiddenProfilesIsAnsweredWhatAVisitorIs() throws Exception {
		String session = account("citalac@example.org", "competitor", READER);

		/* He reads the hidden profile on the portal, which is what makes this a case. */
		List<String> read = new ArrayList<>();

		for (JsonNode one : json.readTree(response("/api/competitors", session).getContentAsString())) {
			read.add(one.path("memberNumber").asString());
		}

		assertThat(read).contains(HIDDEN);

		assertThat(response("/api/previews/competitor/" + HIDDEN + "-sr", session).getStatus()).isEqualTo(404);
		assertThat(response("/api/previews/competitor/" + ASKED + "-sr", session).getContentAsString())
				.isEqualTo(response("/api/previews/competitor/" + ASKED + "-sr", null).getContentAsString());
	}

	@Test
	void aNameTheMemberTypedIsTextInEveryAttributeAndNeverATag() throws Exception {
		String block = response("/api/previews/competitor/" + TYPED + "-sr", null).getContentAsString();
		String written = "Ђорђе &quot;Ђоле&quot; &lt;Јовановић&gt; &amp; &#39;Син&#39;";

		assertThat(block).contains("<title>" + written + " u Balkanskoj trkačkoj ligi</title>");
		assertThat(block).contains("<meta property=\"og:title\" content=\"" + written
				+ " u Balkanskoj trkačkoj ligi\" />");
		assertThat(block).contains("<meta property=\"og:image:alt\" content=\"Kartica profila: " + written + "\" />");
		assertThat(block).doesNotContain(TYPED_FIRST).doesNotContain(TYPED_LAST);

		/* AND THE BLOCK IS NOTHING BUT ITS TAGS. Every tag the route writes is taken out by its whole
		   shape, with no quotation mark or angle bracket inside a value; what remains must be the
		   white space between them. A value that broke out of its attribute leaves the rest of
		   itself behind. */
		assertThat(block.replaceAll("<title>[^<>\"]*</title>", "")
				.replaceAll("<meta (property|name)=\"[a-z:_]+\" content=\"[^<>\"]*\" />", ""))
				.isBlank();

		/* And the name read back out of the attribute is the name he typed. */
		assertThat(org.springframework.web.util.HtmlUtils.htmlUnescape(content(block, "og:title")))
				.isEqualTo(TYPED_FIRST + " " + TYPED_LAST + " u Balkanskoj trkačkoj ligi");
		assertThat(content(block, "og:url")).isEqualTo(portal + "/sr/takmicar/" + TYPED + "-dorde-dole-jovanovic-sin");
	}

	@Test
	void aNameTheAddressCannotSpellLeavesTheNumberAloneAsTheProfileDoes() throws Exception {
		String block = response("/api/previews/competitor/" + GREEK + "-sr", null).getContentAsString();

		assertThat(content(block, "og:url")).isEqualTo(portal + "/sr/takmicar/" + GREEK);
		assertThat(content(block, "og:title")).isEqualTo("Γιώργος Παπαδόπουλος u Balkanskoj trkačkoj ligi");
	}

	@Test
	void theAddressOfTheProfileIsTheOneTheFrontendWrites() {
		/* `profileAddress.test.ts`: „expect(profilePath(someone(), 'sr')).toBe('/sr/takmicar/000127-nikola-minic')". */
		assertThat(CompetitorPreviewApi.profilePath("000127", "Nikola Minić", CompetitorPreviewApi.Words.SERBIAN))
				.isEqualTo("/sr/takmicar/000127-nikola-minic");
		assertThat(CompetitorPreviewApi.profilePath("000127", ". .", CompetitorPreviewApi.Words.ENGLISH))
				.isEqualTo("/en/takmicar/000127");
	}

	/**
	 * THE TITLE IS THE SENTENCE THE FRONTEND WRITES FOR THE SAME LINK, IN BOTH LANGUAGES.
	 *
	 * <p>The browser titles a shared profile by {@code seo.competitor.shareTitle} once the page has
	 * run ({@code PageMeta}, {@code head.ts}), and a network that runs nothing reads this one. Two
	 * homes of one sentence, held here: a word changed in either fails until the other says it too.
	 * And the name of the site and the language Open Graph names, which {@code head.ts} writes from
	 * {@code app.name} and from {@code OG_LOCALES}, and the origin, which {@code head.ts} writes as
	 * {@code SITE_ORIGIN} and the server reads from {@code btl.portal.address}.
	 */
	@Test
	void theWordsAreTheFrontendsOwn() throws IOException {
		String head = Files.readString(Path.of("..", "frontend", "src", "app", "head.ts"), StandardCharsets.UTF_8);

		for (CompetitorPreviewApi.Words words : CompetitorPreviewApi.Words.values()) {
			JsonNode dictionary = dictionary(words.code());
			String sentence = dictionary.path("seo").path("competitor").path("shareTitle").asString();

			assertThat(sentence).as("%s has no seo.competitor.shareTitle", words.code()).contains("{name}");
			assertThat(words.title("Nikola Minić")).isEqualTo(sentence.replace("{name}", "Nikola Minić"));
			assertThat(dictionary.path("app").path("name").asString()).isEqualTo(CompetitorPreviewApi.SITE_NAME);
			assertThat(head).contains(words.code() + ": '" + words.locale() + "',");
		}

		Matcher origin = Pattern.compile("export const SITE_ORIGIN = '([^']+)'").matcher(head);

		assertThat(origin.find()).as("head.ts names no SITE_ORIGIN").isTrue();
		assertThat(portal).isEqualTo(origin.group(1));
	}

	@Test
	void theCardIsNamedAtTheSizeItIsDrawn() {
		assertThat(List.of(CompetitorCard.WIDTH, CompetitorCard.HEIGHT)).containsExactly(1200, 630);
		assertThat(previews.blockFor(ASKED + "-sr").orElseThrow())
				.contains("content=\"" + CompetitorCard.WIDTH + "\"", "content=\"" + CompetitorCard.HEIGHT + "\"");
	}

	private static String content(String block, String key) {
		Matcher tag = Pattern.compile("<meta (?:property|name)=\"" + Pattern.quote(key) + "\" content=\"([^\"]*)\" />")
				.matcher(block);

		assertThat(tag.find()).as("the block carries no %s", key).isTrue();
		return tag.group(1);
	}

	private static JsonNode dictionary(String code) {
		Path file = Path.of("..", "frontend", "src", "i18n", code + ".json");

		assertThat(file).as("%s is not where this expects it, so nothing is compared", file).exists();

		try {
			return new ObjectMapper().readTree(Files.readString(file, StandardCharsets.UTF_8));
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
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
				.params(number, first, last, "0011223388" + number).update();
	}

	private void memberOf(String number, int season) {
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values ((select id from competitor where member_number = ?), ?, 'feeExempt',"
						+ " 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
				.params(number, season).update();
	}

	private String account(String email, String role, String member) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values ('Probni',"
						+ " 'Probic', ?, (select id from role where code = ?),"
						+ " (select id from competitor where member_number = ?))")
				.params(email, role, member).update();

		SecretToken session = SecretToken.fresh();
		Instant now = clock.instant();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at, expires_at)"
						+ " values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))), Timestamp.from(now),
						Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return session.secret();
	}
}
