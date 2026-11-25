package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * EVERY COLUMN OF TEXT THE SCHEMA HOLDS SAYS WHETHER A VISITOR READS IT, AND HOW IT REACHES HIM IN ANOTHER LANGUAGE.
 *
 * <p>Owner, PDL P18, 25.11.2026: „treba da ne postoji ni jedan deo portala koji posetilac iz US recimo moze da vidi
 * a da nema engleski prevod". Which text that is cannot be derived: it is a decision, one line per column, so it is
 * written out here, and the floor under it is the catalogue, asked in both directions. A column of text added
 * tomorrow fails this case until somebody says which kind it is, which is the moment the question belongs to.
 * The precedent for a hand-written table with a derived floor beside it is {@code WhatEachStackRequiresTest}.
 *
 * <p><b>And the machine translates exactly the columns this table says it does</b>: the second case holds
 * {@link WhatIsTranslated} against the {@link Kind#TRANSLATED} rows, so a name of a person, a race or a place cannot
 * reach the service by somebody adding it there (owner, 25.11.2026: „nazivi trka, mesta i događaja i imena ljudi
 * ostaju u originalu").
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class EveryTextColumnIsClassifiedTest {

	enum Kind {
		/** Translated by the machine ({@link WhatIsTranslated#sentToTheService}). */
		TRANSLATED,
		/**
		 * Translated BY HAND and read like every translated text ({@link WhatIsTranslated}) but never sent to the
		 * service: the ducats (owner, 25.11.2026, „Ja ih prevedem ručno"), whose English is written in V115.
		 */
		TRANSLATED_BY_HAND,
		/**
		 * A visitor reads it and its English is written by hand somewhere else or it is shown as written: the written
		 * pages (PDL P18, „Prevodi Claude") and the sponsors (owner, 25.11.2026, „opis sponzora se ne prevodi
		 * mašinski").
		 */
		BY_HAND_OR_AS_WRITTEN,
		/** A name of a person, a race, an event, a team, a league or a place, which stays as it was written. */
		A_NAME,
		/** Not words anybody reads as prose: a code, a key, a digest, an address, a link, an amount. */
		NOT_PROSE,
		/**
		 * Read by nobody but the one it concerns or the administration: a text that waits for a moderator, a message,
		 * a reason of a refusal, the book of the balance (owner, 25.11.2026: „poruke u sandučetu, razlozi odbijanja i
		 * knjiga balansa ne").
		 */
		NOT_FOR_A_VISITOR,
		/** A translation itself. */
		A_TRANSLATION
	}

	private static final Map<String, Kind> KINDS = kinds();

	private static Map<String, Kind> kinds() {
		Map<String, Kind> kinds = new LinkedHashMap<>();

		put(kinds, Kind.TRANSLATED, "btl_event.description", "competitor.bio", "team.bio", "league.rules",
				"league.prizes", "price_row.label", "event_comment.body");

		put(kinds, Kind.TRANSLATED_BY_HAND, "ducat.name", "ducat.top", "ducat.top_female", "ducat.bottom",
				"ducat.counted");

		put(kinds, Kind.BY_HAND_OR_AS_WRITTEN, "sponsor.description_sr", "sponsor.description_en", "static_page.title",
				"static_page_section.heading", "static_page_section.body", "static_page_translation.title",
				"static_page_section_translation.heading", "static_page_section_translation.body");

		put(kinds, Kind.A_NAME, "account.first_name", "account.last_name", "balance_entry.recorded_by_name",
				"bank_statement.loaded_by_name", "bank_statement_line.set_aside_by_name", "btl_event.city",
				"btl_event.name", "competitor.city", "competitor.father_name", "competitor.first_name",
				"competitor.last_name", "country.name", "event_comment.who", "league.name",
				"membership.decided_by_name", "membership_change.decided_by_name", "parental_consent.guardian_name",
				"payment.recorded_by_name", "place.english_name", "place.name", "race.name", "result_submission.city",
				"result_submission.event_name", "result_submission.race_name", "season_award.team_name",
				"season_award.who", "season_board.race_name", "season_board.who", "season_competitor.who",
				"season_league_column.name", "season_league_standing.league_name", "season_league_standing.who",
				"season_pair_half.who", "season_team.name", "season_team_member.who", "sponsor.name", "team.city",
				"team.name", "verification.decided_by_name");

		put(kinds, Kind.NOT_PROSE, "account.mail_language", "account.password_hash", "account_admin_right.right_code",
				"account_session.token_hash", "admin_right.code", "admin_right.scope", "admin_right.target",
				"balance_entry.currency", "balance_promise.currency", "bank_statement.account",
				"bank_statement_line.order_number", "bank_statement_line.payer_account",
				"bank_statement_line.payment_code", "bank_statement_line.reference", "btl_event.kind", "btl_event.link",
				"btl_event.slug", "competitor.birthday_shown", "competitor.gender", "competitor.member_number",
				"competitor.referral_code", "competitor.shirt_size", "country.code", "ducat.art", "ducat.code",
				"ducat.kind", "ducat.mark", "ducat.period", "ducat.period_at", "ducat_award.kind", "ducat_award.period",
				"ducat_kind.code", "email_verification_token.token_hash", "league.slug", "membership.basis",
				"membership_change.action", "membership_change.basis_after", "membership_change.basis_before",
				"parental_consent.relation", "password_reset_token.token_hash", "payment.currency", "payment.method",
				"payment.reference", "payment.state", "photo.digest", "photo.media_type", "price_row.day_from",
				"price_row.day_to", "price_row.key", "price_row.kind", "race.category", "race.kind",
				"racing_pair.man_gender", "racing_pair.woman_gender", "result.brought_by", "result.category",
				"result_submission.event_kind", "result_submission.link", "result_submission.race_kind", "role.code",
				"role.rights_mode", "season_award.category", "season_award.gender", "season_award.kind",
				"season_board.board", "season_board.gender", "season_board.length", "season_competitor.category",
				"season_competitor.gender", "season_league_standing.gender", "season_pair_half.gender",
				"season_team_length.length", "season_team_member.gender", "shared_card.address", "shared_card.card",
				"shared_card.member_number", "sponsor.url", "static_page.slug", "static_page_section.gallery",
				"static_page_section_translation.language", "static_page_translation.language", "team.link",
				"team.slug", "verification.queue", "verification.right_code", "verification.state",
				"text_translation.field", "text_translation.language", "text_translation.origin",
				"text_translation.source_digest", "text_translation.source_language", "text_translation_asked.field",
				"text_translation_asked.source_digest");

		put(kinds, Kind.NOT_FOR_A_VISITOR, "account.email", "balance_entry.reason", "bank_statement_line.payer",
				"bank_statement_line.purpose", "bank_statement_line.waits_because", "comment_submission.body",
				"competitor.address", "competitor.phone", "competitor_document.document_number", "message.body",
				"message.from_name", "message.subject", "result_submission.comment", "team_membership.left_reason",
				"team_proposal.bio", "team_proposal.city", "team_proposal.link", "team_proposal.name",
				"verification.body", "verification.reason", "verification.subject");

		put(kinds, Kind.A_TRANSLATION, "text_translation.body");

		return kinds;
	}

	private static void put(Map<String, Kind> kinds, Kind kind, String... columns) {
		for (String column : columns) {
			assertThat(kinds.put(column, kind)).as("%s is classified twice", column).isNull();
		}
	}

	@Autowired
	private JdbcClient db;

	@Autowired
	private Flyway flyway;

	@Test
	void everyColumnOfTextIsClassifiedAndNothingElseIs() {
		Set<String> inTheSchema = new TreeSet<>(db.sql("select table_name || '.' || column_name"
						+ " from information_schema.columns where table_schema = current_schema()"
						+ " and data_type in ('text', 'character varying', 'character') and table_name <> ?")
				.param(flyway.getConfiguration().getTable())
				.query(String.class)
				.list());

		assertThat(new TreeSet<>(KINDS.keySet()))
				.as("a column of text was added or removed; say which kind it is (owner, PDL P18, 25.11.2026)")
				.isEqualTo(inTheSchema);
	}

	@Test
	void theMachineTranslatesExactlyWhatThisTableSaysItDoes() {
		assertThat(columnsOf(WhatIsTranslated.sentToTheService())).isEqualTo(classifiedAs(Kind.TRANSLATED));
	}

	/**
	 * AND WHAT IS READ AS TRANSLATED BUT NEVER SENT is exactly the ducats, so a column cannot be made a text the
	 * service is not asked about by leaving it out of the pass, and a name cannot be sent by being put among them.
	 */
	@Test
	void whatIsTranslatedByHandIsExactlyWhatThisTableSaysItIs() {
		assertThat(columnsOf(Arrays.stream(WhatIsTranslated.values()).filter(what -> !what.byMachine).toList()))
				.isEqualTo(classifiedAs(Kind.TRANSLATED_BY_HAND));
	}

	private static Set<String> columnsOf(java.util.List<WhatIsTranslated> whats) {
		return whats.stream().map(what -> what.table + "." + what.column)
				.collect(Collectors.toCollection(TreeSet::new));
	}

	private static Set<String> classifiedAs(Kind kind) {
		return KINDS.entrySet().stream()
				.filter(one -> one.getValue() == kind)
				.map(Map.Entry::getKey)
				.collect(Collectors.toCollection(TreeSet::new));
	}
}
