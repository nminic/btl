package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.season.SeasonClock;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE DUCATS AN IMPORT BRINGS ARE WRITTEN, AND WRITTEN IN SILENCE, against the real schema.
 *
 * <p>The owner, PDL, 16.11.2026: „ne znaci da treba ljudi da ostanu uskraceni za dukate koje zasluzuju”, so the
 * ducat is written; „Potpuno tiho”, so no message; and „Dukat se javlja samo ako je prag preveo odobren rezultat
 * i nijedan uvezen rezultat među prebrojanim nije stigao posle njega.” A result the import tool writes carries
 * {@code brought_by = 'import'} and its moment (V105). The frozen season stays as the owner decided it on
 * 08.11.2026: „Rezultat unet ili ispravljen posle zamrzavanja svoje sezone donosi samo trajne dukate”.
 *
 * <p><b>Two members run the same races, and the other one's results are written FIRST and arrive the opposite
 * way</b>: where hers is approved his is imported and the other way round, so a reconciliation that read how a
 * result came in off anybody else's row would tell what it should keep silent, or the reverse.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class AnImportBringsDucatsInSilenceTest {

	private static final String ANA = "000941";

	private static final String OTHER = "000942";

	/** When her run of the 10th was approved, well after the start of awarding. */
	private static final Instant APPROVED = AwardingDucats.AWARDING_BEGAN.plusSeconds(86_400);

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate transactions;

	private long lastMessage;

	@BeforeEach
	void theMessagesSoFar() {
		lastMessage = db.sql("select coalesce(max(id), 0) from message").query(Long.class).single();
	}

	/** February 2028 for both: 60 km on the 3rd and 70 km on the 10th, the run that reaches 125. */
	private void february() {
		member(OTHER);
		member(ANA);
		memberOf(OTHER, 2028);
		memberOf(ANA, 2028);
		race("Uvoz-prva", "2028-02-03", "10");
		race("Uvoz-druga", "2028-02-10", "10");

		for (String who : List.of(OTHER, ANA)) {
			run(who, "Uvoz-prva", "60");
			run(who, "Uvoz-druga", "70");
		}
	}

	@Test
	void anApprovalThatCarriedHerOverIsToldInTheWordsOfAnApprovalAndOnlyToHer() {
		february();
		broughtIn(OTHER, "Uvoz-druga", APPROVED, "import");
		broughtIn(ANA, "Uvoz-druga", APPROVED, "approval");

		assertThat(codes(at().reconcile(id(ANA)))).containsExactly("duk-mesecni-km");
		assertThat(messages()).containsExactly(id(ANA) + " | Osvojila si dukat | Odobren ti je rezultat sa trke"
				+ " Uvoz-druga od 10.02.2028, i njime si osvojila dukat \"Mesečni kilometri\" za februar 2028. Dukat"
				+ " stoji na tvom profilu.");
	}

	@Test
	void anApprovalThatCarriedHerOverOnlyBecauseAnOlderRaceWasImportedAfterItIsWrittenInSilence() {
		february();
		broughtIn(OTHER, "Uvoz-prva", APPROVED.minusSeconds(60), "approval");
		broughtIn(ANA, "Uvoz-druga", APPROVED, "approval");
		broughtIn(ANA, "Uvoz-prva", APPROVED.plusSeconds(60), "import");

		assertThat(codes(at().reconcile(id(ANA)))).as("she is not left without the ducat she earned")
				.containsExactly("duk-mesecni-km");
		assertThat(messages()).isEmpty();
	}

	/**
	 * ONLY AN IMPORT SILENCES: the league entered her run of the 10th, which carried her over, and her older run
	 * of the 3rd was approved an hour LATER. It is counted and it came in after, and it is no import, so the ducat
	 * is told, in the league's words. The other member's older run is the one imported.
	 */
	@Test
	void anOlderRaceApprovedAfterTheLeaguesEntryThatCarriedHerOverIsNoImportSoTheEntryIsTold() {
		february();
		broughtIn(OTHER, "Uvoz-prva", APPROVED.plusSeconds(3600), "import");
		broughtIn(ANA, "Uvoz-druga", APPROVED, "league");
		broughtIn(ANA, "Uvoz-prva", APPROVED.plusSeconds(3600), "approval");

		assertThat(codes(at().reconcile(id(ANA)))).containsExactly("duk-mesecni-km");
		assertThat(messages()).containsExactly(id(ANA) + " | Osvojila si dukat | Liga ti je unela rezultat sa"
				+ " trke Uvoz-druga od 10.02.2028, i njime si osvojila dukat \"Mesečni kilometri\" za februar 2028."
				+ " Dukat stoji na tvom profilu.");
	}

	@Test
	void anImportOfAnOlderRaceBeforeTheApprovalDidNotCarryHerOverSoTheApprovalIsTold() {
		february();
		broughtIn(OTHER, "Uvoz-prva", APPROVED.plusSeconds(60), "import");
		broughtIn(ANA, "Uvoz-druga", APPROVED, "approval");
		broughtIn(ANA, "Uvoz-prva", APPROVED.minusSeconds(60), "import");

		assertThat(codes(at().reconcile(id(ANA)))).containsExactly("duk-mesecni-km");
		assertThat(messages()).hasSize(1).first().asString().startsWith(id(ANA) + " | Osvojila si dukat");
	}

	/**
	 * AN IMPORT THAT CARRIED HER OVER IS SILENT, and the approved run of hers counted before it does not speak
	 * for it: the message is never opened from another result's way of coming in.
	 */
	@Test
	void anImportThatCarriedHerOverIsWrittenInSilenceThoughAnotherRunOfHersWasApproved() {
		february();
		broughtIn(OTHER, "Uvoz-druga", APPROVED, "approval");
		broughtIn(ANA, "Uvoz-prva", APPROVED.plusSeconds(60), "approval");
		broughtIn(ANA, "Uvoz-druga", APPROVED, "import");

		assertThat(codes(at().reconcile(id(ANA)))).containsExactly("duk-mesecni-km");
		assertThat(messages()).isEmpty();
	}

	@Test
	void theHistoryThatCarriedHerOverIsWrittenInSilence() {
		february();
		broughtIn(OTHER, "Uvoz-druga", APPROVED, "approval");
		broughtIn(ANA, "Uvoz-prva", APPROVED, "approval");

		assertThat(codes(at().reconcile(id(ANA)))).containsExactly("duk-mesecni-km");
		assertThat(messages()).isEmpty();
	}

	/**
	 * AN IMPORT INTO A FROZEN SEASON BRINGS ONLY THE DUCATS OF ALL TIME, AND IN SILENCE; the same import while the
	 * season is open brings the ducat of the month as well, also in silence. Three marathons of July 2027, two of
	 * which make „Maratoni” here, and 126.6 km, which makes „Mesečni kilometri” for July.
	 */
	@Test
	void anImportIntoAFrozenSeasonBringsOnlyTheDucatsOfAllTimeAndAnOpenSeasonBothAndNeitherIsTold() {
		marathonsCountFrom(2);
		member(OTHER);
		member(ANA);
		memberOf(OTHER, 2027);
		memberOf(ANA, 2027);

		for (String day : List.of("03", "10", "20")) {
			String name = "Uvoz-maraton-" + day;
			race(name, "2027-07-" + day, "42.2");
			run(OTHER, name, "42.2");
			run(ANA, name, "42.2");
			broughtIn(ANA, name, APPROVED, "import");
		}

		frozen(2027);

		assertThat(codes(at().reconcile(id(ANA)))).as("not July's kilometres of a frozen 2027")
				.containsExactly("duk-maratoni");

		db.sql("delete from ducat_award where competitor_id = ?").param(id(ANA)).update();
		db.sql("delete from season_frozen where season = 2027").update();

		assertThat(codes(at().reconcile(id(ANA)))).as("the other side: 2027 has not frozen")
				.containsExactlyInAnyOrder("duk-mesecni-km", "duk-maratoni");
		assertThat(messages()).isEmpty();
	}

	private AwardingDucats at() {
		return new AwardingDucats(db, Clock.fixed(LocalDateTime.of(2028, 3, 15, 12, 0).atZone(SeasonClock.ZONE)
				.toInstant(), ZoneOffset.UTC), transactions);
	}

	private static List<String> codes(List<AwardingDucats.Won> written) {
		return written.stream().map(AwardingDucats.Won::code).toList();
	}

	/** Every message written in this case to either member or to the whole league, as {@code to | subject | body}. */
	private List<String> messages() {
		return db.sql("select coalesce(to_id::text, 'the league') || ' | ' || subject || ' | ' || body from message"
						+ " where id > ? and (to_id is null or to_id in (select id from competitor"
						+ " where member_number in (?, ?))) order by id")
				.params(lastMessage, ANA, OTHER).query(String.class).list();
	}

	private void marathonsCountFrom(int howMany) {
		db.sql("update ducat set threshold = ? where code = 'duk-maratoni'").param(howMany).update();
	}

	private void frozen(int season) {
		db.sql("insert into season_frozen (season, frozen_at) values (?, ?)")
				.params(season, Timestamp.from(LocalDateTime.of(season + 1, 1, 1, 16, 0).atZone(SeasonClock.ZONE)
						.toInstant()))
				.update();
	}

	private long id(String number) {
		return db.sql("select id from competitor where member_number = ?").param(number).query(Long.class).single();
	}

	private void member(String number) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season,"
						+ " referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Ime', 'Prezime', 'F', date '1990-05-05',"
						+ " (select id from place where rank = 1), null, null, 2027,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, "001122334" + number + "b").update();
	}

	private void memberOf(String number, int season) {
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values ((select id from competitor where member_number = ?), ?, 'feeExempt',"
						+ " 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
				.params(number, season).update();
	}

	private void race(String name, String day, String kilometres) {
		db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, ?, date '" + day + "', null, 'Grad',"
						+ " (select id from country where code = 'RS'), 'race', false, '', '')")
				.params("uvoz-dukat-" + name.toLowerCase(), name).update();
		db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values ((select id from btl_event where slug = ?), ?, false,"
						+ " date '" + day + "', 'length', 0, " + kilometres + ", 0, 0)")
				.params("uvoz-dukat-" + name.toLowerCase(), name).update();
	}

	private void run(String member, String raceName, String kilometres) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m,"
						+ " descent_m, seconds, points)"
						+ " select (select id from competitor where member_number = ?), race.id, race.date, "
						+ kilometres + ", 0, 0, 3000, 1 from race where race.name = ?")
				.params(member, raceName).update();
	}

	/** The moment and the way his run on that race came in. */
	private void broughtIn(String member, String raceName, Instant at, String by) {
		assertThat(db.sql("update result set brought_at = ?, brought_by = ? where competitor_id = ?"
						+ " and race_id = (select id from race where name = ?)")
				.params(Timestamp.from(at), by, id(member), raceName).update()).isEqualTo(1);
	}
}
