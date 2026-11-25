package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.season.SeasonClock;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.Clock;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE PASS FOR WHAT V115 ADDS, against a real database and a translator of its own on this machine: the rules and
 * the prizes of a league, the labels of the price list, the biography of a member and of a team, a comment, and the
 * ducats, which it must NEVER send (owner, PDL P18, 25.11.2026, „Ja ih prevedem ručno").
 *
 * <p>Every case that has a text with a neighbour has the neighbour that differs: the other thing is not the one that
 * is asked about, the hidden profile is not the one beside it, the waiting text is not the approved one. The cases
 * that are about WHAT IS NOT SENT assert on the texts the service was asked, which is the only place a leak shows.
 * Not transactional, for the reason {@link TextsAreTranslatedTest} gives.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class TheRestIsTranslatedByThePassTest {

	private static final ObjectMapper JSON = new ObjectMapper();

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate inOneTransaction;

	private ATranslatorOfItsOwn service;

	@BeforeEach
	void aServiceOfItsOwn() throws IOException {
		service = new ATranslatorOfItsOwn();
		clean();
	}

	@AfterEach
	void nothingIsLeftBehind() {
		service.close();
		clean();
	}

	private void clean() {
		db.sql("delete from text_translation where ducat_id is null").update();
		db.sql("delete from text_translation_asked").update();
		db.sql("delete from verification where subject like 'Prevod %'").update();
		db.sql("delete from comment_submission where body like 'Prevod %'").update();
		db.sql("delete from event_comment where body like 'Prevod %'").update();
		db.sql("delete from competitor where member_number like '0097%'").update();
		db.sql("delete from team where slug like 'prevod-%'").update();
		db.sql("delete from league where slug like 'prevod-%'").update();
		db.sql("delete from btl_event where slug like 'prevod-%'").update();
	}

	private TextsAreTranslated job(WhatIsTranslated... kinds) {
		return new TextsAreTranslated(db,
				new Translator(ATranslatorOfItsOwn.KEY, ATranslatorOfItsOwn.REGION, service.address(), 2000, JSON),
				inOneTransaction, 15000, Clock.systemUTC(), List.of(kinds));
	}

	private static void ran(TextsAreTranslated job) throws Exception {
		Optional<CompletableFuture<Void>> sent = job.translateWhatChanged();

		if (sent.isPresent()) {
			sent.get().get(10, TimeUnit.SECONDS);
		}
	}

	/** Every translation of one thing, by field, language and origin: {@code rules en machine -> body}. */
	private Map<String, String> translationsOf(String key, long id) {
		return db.sql("select field || ' ' || language || ' ' || origin, body from text_translation where " + key
						+ " = ?").param(id)
				.query((row, one) -> Map.entry(row.getString(1), row.getString(2)))
				.list().stream()
				.collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
	}

	private void active(long member) {
		HeldOn.season(db, member, SeasonClock.seasonsAMemberIsActiveIn(ZonedDateTime.now()).last(), "feeExempt");
	}

	/* ---------------------------------------------------------------------------------------------------------- */

	/**
	 * THE RULES AND THE PRIZES ARE TWO TEXTS WITH TWO TRANSLATIONS, each under its own field and its own league: the
	 * league that is asked about is the second written, so an answer written under the first league, or the rules
	 * written as the prizes, cannot pass for the right one.
	 */
	@Test
	void theRulesAndThePrizesOfALeagueAreTranslatedEachUnderItsOwnLeagueAndField() throws Exception {
		long first = TranslatableRows.league(db, "prevod-prva", 2051, "Pravila prve", "Nagrade prve");
		long second = TranslatableRows.league(db, "prevod-druga", 2052, "Pravila druge", "Nagrade druge");

		ran(job(WhatIsTranslated.LEAGUE_RULES, WhatIsTranslated.LEAGUE_PRIZES));

		assertThat(translationsOf("league_id", second)).isEqualTo(Map.of(
				"rules en machine", "EN: Pravila druge", "rules sr machine", "SR: Pravila druge",
				"prizes en machine", "EN: Nagrade druge", "prizes sr machine", "SR: Nagrade druge"));
		assertThat(translationsOf("league_id", first)).containsEntry("rules en machine", "EN: Pravila prve")
				.containsEntry("prizes en machine", "EN: Nagrade prve");
	}

	/** An emptied prize is words nobody wrote any more, and its translation goes. */
	@Test
	void anEmptiedPrizeLosesItsTranslation() throws Exception {
		long league = TranslatableRows.league(db, "prevod-prazna", 2053, "Pravila", "Nagrade");

		ran(job(WhatIsTranslated.LEAGUE_RULES, WhatIsTranslated.LEAGUE_PRIZES));
		db.sql("update league set prizes = '' where id = ?").param(league).update();
		ran(job(WhatIsTranslated.LEAGUE_RULES, WhatIsTranslated.LEAGUE_PRIZES));

		assertThat(translationsOf("league_id", league).keySet()).containsExactlyInAnyOrder("rules en machine",
				"rules sr machine");
	}

	@Test
	void everyLabelOfThePriceListIsTranslatedUnderItsOwnRow() throws Exception {
		ran(job(WhatIsTranslated.PRICE_LABEL));

		List<String> wrong = db.sql("select p.key from price_row p where not exists (select 1 from text_translation t"
						+ " where t.price_row_id = p.id and t.field = 'label' and t.language = 'en'"
						+ " and t.body = 'EN: ' || p.label)")
				.query(String.class).list();

		assertThat(wrong).isEmpty();
		assertThat(db.sql("select count(*) from price_row").query(Integer.class).single())
				.isEqualTo(service.textsAsked().size());
	}

	/**
	 * ONLY THE BIOGRAPHY A MODERATOR HAS APPROVED IS SENT, and only of a member the route serves. Four members: the
	 * one written second is the open one, the hidden one, the one whose fee has lapsed and the one with a biography
	 * waiting, so a text that reaches the service from any of the other three is a leak the asked list shows.
	 */
	@Test
	void onlyAnApprovedOpenBiographyOfAnActiveMemberIsSent() throws Exception {
		long hidden = TranslatableRows.member(db, "009701", "Skrivena biografija.", true);
		long open = TranslatableRows.member(db, "009702", "Otvorena biografija.", false);
		long lapsed = TranslatableRows.member(db, "009703", "Biografija bez članarine.", false);
		long waiting = TranslatableRows.member(db, "009704", "Odobrena biografija.", false);

		active(hidden);
		active(open);
		active(waiting);
		HeldOn.season(db, lapsed, SeasonClock.seasonsAMemberIsActiveIn(ZonedDateTime.now()).last() + 5, "feeExempt");
		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id)"
				+ " values ('profiles', ?, 'Prevod biografije', 'Biografija koja čeka moderatora.', null)")
				.param(waiting).update();

		ran(job(WhatIsTranslated.COMPETITOR_BIO));

		assertThat(service.textsAsked()).containsExactlyInAnyOrder("Otvorena biografija.", "Odobrena biografija.");
		assertThat(translationsOf("competitor_id", open)).isEqualTo(Map.of("bio en machine",
				"EN: Otvorena biografija.", "bio sr machine", "SR: Otvorena biografija."));
		assertThat(translationsOf("competitor_id", hidden)).isEmpty();
		assertThat(translationsOf("competitor_id", lapsed)).isEmpty();
		assertThat(translationsOf("competitor_id", waiting).get("bio en machine")).isEqualTo("EN: Odobrena biografija.");
	}

	/** A member who hides his profile AFTER he was translated loses the translation at the next pass. */
	@Test
	void aProfileThatIsHiddenLaterLosesItsTranslation() throws Exception {
		long member = TranslatableRows.member(db, "009705", "Biografija koja se krije.", false);

		active(member);
		ran(job(WhatIsTranslated.COMPETITOR_BIO));
		assertThat(translationsOf("competitor_id", member)).hasSize(2);

		db.sql("update competitor set profile_hidden = true where id = ?").param(member).update();
		ran(job(WhatIsTranslated.COMPETITOR_BIO));

		assertThat(translationsOf("competitor_id", member)).isEmpty();
	}

	/** A deleted member takes the translation of his biography with him, which is the privacy policy's promise. */
	@Test
	void aDeletedMemberTakesTheTranslationOfHisBiographyWithHim() throws Exception {
		long member = TranslatableRows.member(db, "009706", "Biografija člana koji odlazi.", false);

		active(member);
		ran(job(WhatIsTranslated.COMPETITOR_BIO));
		db.sql("delete from competitor where id = ?").param(member).update();

		assertThat(db.sql("select count(*) from text_translation where competitor_id = ?").param(member)
				.query(Integer.class).single()).isZero();
	}

	/**
	 * THE DESCRIPTION OF A TEAM IS SENT, each under its own team, and what a team's editor has sent and no moderator
	 * has approved is not in {@code team.bio} at all: it stays in {@code team_proposal}, which the pass never reads.
	 */
	@Test
	void theDescriptionOfATeamIsTranslatedAndAProposalIsNeverSent() throws Exception {
		long first = TranslatableRows.team(db, "prevod-prvi-tim", "Opis prvog tima.");
		long second = TranslatableRows.team(db, "prevod-drugi-tim", "Opis drugog tima.");
		long founder = TranslatableRows.member(db, "009707", "", false);

		db.sql("insert into team_proposal (competitor_id, team_id, name, bio, link, place_id, city, country_id)"
				+ " values (?, ?, 'Tim', 'Predlog opisa koji čeka.', '', (select id from place where rank = 1),"
				+ " null, null)").params(founder, second).update();

		ran(job(WhatIsTranslated.TEAM_BIO));

		assertThat(translationsOf("team_id", second)).isEqualTo(Map.of("bio en machine", "EN: Opis drugog tima.",
				"bio sr machine", "SR: Opis drugog tima."));
		assertThat(translationsOf("team_id", first)).containsEntry("bio en machine", "EN: Opis prvog tima.");
		assertThat(service.textsAsked()).doesNotContain("Predlog opisa koji čeka.");
	}

	/** A comment that waits for a moderator is {@code comment_submission} and is never sent; the published one is. */
	@Test
	void aPublishedCommentIsTranslatedAndOneThatWaitsIsNeverSent() throws Exception {
		long event = TranslatableRows.event(db, "prevod-komentar", "Opis");
		long member = TranslatableRows.member(db, "009708", "", false);
		long published = TranslatableRows.comment(db, event, member, "Prevod objavljen komentar.");

		db.sql("insert into comment_submission (event_id, competitor_id, rating_organisation, rating_value,"
				+ " rating_ambience, body) values (?, ?, 3, 3, 3, 'Prevod komentar koji čeka.')")
				.params(event, member).update();

		ran(job(WhatIsTranslated.COMMENT_BODY));

		assertThat(service.textsAsked()).containsExactly("Prevod objavljen komentar.");
		assertThat(translationsOf("event_comment_id", published)).containsEntry("body en machine",
				"EN: Prevod objavljen komentar.");
	}

	/**
	 * THE DUCATS ARE NEVER SENT, with every kind the portal sends in one pass: nothing the service is asked for is a
	 * word of a ducat, and no machine row names one. The fifteen English rows V115 wrote by hand are still there.
	 */
	@Test
	void noDucatIsEverSentAndTheHandTranslationsStand() throws Exception {
		ran(new TextsAreTranslated(db,
				new Translator(ATranslatorOfItsOwn.KEY, ATranslatorOfItsOwn.REGION, service.address(), 2000, JSON),
				inOneTransaction, 15000, Clock.systemUTC(), WhatIsTranslated.sentToTheService()));

		List<String> ducatWords = db.sql("select name from ducat union select top from ducat union select bottom"
				+ " from ducat union select counted from ducat union select top_female from ducat")
				.query(String.class).list().stream().filter(one -> !one.isBlank()).toList();

		assertThat(service.textsAsked()).isNotEmpty().doesNotContainAnyElementsOf(ducatWords);
		assertThat(db.sql("select count(*) from text_translation where ducat_id is not null and origin = 'machine'")
				.query(Integer.class).single()).isZero();
		assertThat(db.sql("select count(*) from text_translation where ducat_id is not null and origin = 'manual'")
				.query(Integer.class).single()).isEqualTo(49);
		assertThat(WhatIsTranslated.sentToTheService()).noneMatch(what -> what.table.equals("ducat"));
	}
}
