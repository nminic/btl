package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.season.SeasonClock;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.config.FixedDelayTask;
import org.springframework.scheduling.config.ScheduledTask;
import org.springframework.scheduling.config.ScheduledTaskHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHO THE DELETION OF A PROFILE PAST ITS KEEPING TAKES AND WHO IT LEAVES, one state against the other.
 *
 * <p>PDL P23 and the owner's answers of 05.11.2026: five years from the end of the last season of
 * membership on any basis, a cancelled season counting as a season; twelve months from the opening of a
 * confirmed account that never became a member; never an account that administers; no message to
 * anybody; the name staying as text in the frozen tables of his seasons and nowhere else.
 *
 * <p><b>Every case that keeps somebody beside him deletes somebody too</b>, or names the moment at
 * which the same member does go, so „nothing was deleted" is never the reason a case passes. And the
 * cases ask {@link ProfilesPastTheirKeepingAreDeleted#goes} of one member wherever they can, rather
 * than walking every member the shared database holds.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class ProfilesPastTheirKeepingAreDeletedTest {

	private static final String A_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	/** The opening of every account written here unless a case names another: long before every case. */
	private static final ZonedDateTime OPENED = belgrade(2026, 9, 1, 12, 0, 0);

	/**
	 * The first moment at which a member whose last season is 2027 is deleted: his five years end on 1
	 * January 2033 and the deletion comes from 1 February (PDL 05.11.2026, „Brisanje posle pet godina ide
	 * tek od 1. februara").
	 */
	private static final ZonedDateTime FIVE_YEARS_AFTER_2027 = belgrade(2033, 2, 1, 0, 0, 0);

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate inOneTransaction;

	@Autowired
	private CompetitorWriteApi members;

	@Autowired
	private ObjectProvider<ScheduledTaskHolder> schedulers;

	private int issued;

	private static ZonedDateTime belgrade(int year, int month, int day, int hour, int minute, int second) {
		return ZonedDateTime.of(year, month, day, hour, minute, second, 0, SeasonClock.ZONE);
	}

	private ProfilesPastTheirKeepingAreDeleted job(ZonedDateTime at) {
		return new ProfilesPastTheirKeepingAreDeleted(db, Clock.fixed(at.toInstant(), ZoneOffset.UTC),
				inOneTransaction, members);
	}

	private boolean goes(long member, ZonedDateTime at) {
		return job(at).goes(member, at);
	}

	/**
	 * A member behind a confirmed account opened at {@link #OPENED}, with a number or without one; his
	 * key.
	 */
	private long aMember(String gender, String number, String role) {
		long member = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, referral_code, bio, profile_hidden, birthday_shown,"
						+ " father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Clan', ?, date '1990-01-01', " + A_TOWN_IN_SERBIA
						+ ", 2027, ?, '', false, 'none', 'Otac', 'Ulica 1', 'M', ?) returning id")
				.params(number, gender, String.format("%016x", 0xb5e7L * 1000 + ++issued),
						Timestamp.from(OPENED.toInstant()))
				.query(Long.class).single();

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id, password_hash,"
						+ " email_confirmed_at, created_at) values ('Probni', 'Clan', ?,"
						+ " (select id from role where code = ?), ?, '{bcrypt}$2a$10$abcdefghijklmnopqrstuv', ?, ?)")
				.params("cuvanje-" + issued + "@primer.rs", role, member,
						Timestamp.from(OPENED.toInstant()), Timestamp.from(OPENED.toInstant()))
				.update();

		return member;
	}

	/** A member with a number, behind an ordinary account. */
	private long aMember(String gender) {
		return aMember(gender, String.format("0%05d", 70000 + issued + 1), "competitor");
	}

	/** Somebody who registered and never became a member: no number and no season. */
	private long neverAMember() {
		return aMember("M", null, "competitor");
	}

	private void heldOn(long member, int season, String basis) {
		HeldOn.season(db, member, season, basis);
	}

	private void cancelled(long member, int season) {
		db.sql("insert into membership_change (competitor_id, season, action, basis_before, basis_after,"
						+ " decided_by, decided_by_name, decided_at) values (?, ?, 'cancelled', 'payment', null,"
						+ " null, 'Blagajnik Probni', timestamptz '2027-03-01 10:00:00+00')")
				.params(member, season).update();
	}

	private void opened(long member, ZonedDateTime account, ZonedDateTime registration) {
		db.sql("update account set created_at = ? where competitor_id = ?")
				.params(account == null ? null : Timestamp.from(account.toInstant()), member).update();
		db.sql("update competitor set health_statement_at = ? where id = ?")
				.params(Timestamp.from(registration.toInstant()), member).update();
	}

	private boolean stands(long member) {
		return db.sql("select count(*) from competitor where id = ?").param(member).query(Long.class).single() == 1;
	}

	/**
	 * FIVE YEARS FROM THE END OF HIS LAST SEASON, which is midnight of 1 January in the league's zone: a
	 * second short of it he stays, at it he goes, and four and a half years on he stays. The member beside
	 * him who held 2027 AND 2029 stays at the same moment, so the keeping is counted from the last of his
	 * seasons and not from the first.
	 */
	@Test
	void fiveYearsAreCountedFromTheEndOfTheLastSeason() {
		long last2027 = aMember("M");
		long alsoIn2029 = aMember("M");

		heldOn(last2027, 2027, "payment");
		heldOn(alsoIn2029, 2027, "payment");
		heldOn(alsoIn2029, 2029, "payment");

		assertThat(goes(last2027, belgrade(2032, 7, 1, 12, 0, 0))).as("four and a half years").isFalse();
		assertThat(goes(last2027, belgrade(2033, 1, 1, 0, 0, 1))).as("the five years just over").isFalse();
		assertThat(goes(last2027, belgrade(2033, 1, 31, 23, 59, 59)))
				.as("31 January 2033, the last second of the month after").isFalse();
		assertThat(goes(last2027, FIVE_YEARS_AFTER_2027.minusSeconds(1))).as("a second short").isFalse();
		assertThat(stands(last2027)).isTrue();

		assertThat(goes(alsoIn2029, FIVE_YEARS_AFTER_2027)).as("counted from his first season").isFalse();
		assertThat(goes(last2027, FIVE_YEARS_AFTER_2027)).isTrue();

		assertThat(stands(last2027)).isFalse();
		assertThat(stands(alsoIn2029)).isTrue();
		assertThat(db.sql("select count(*) from account where competitor_id = ?").param(last2027)
				.query(Long.class).single()).as("his account went with him").isZero();
	}

	/**
	 * EVERY SEASON OF MEMBERSHIP COUNTS, WHATEVER ITS BASIS (PDL 05.11.2026). Each of three members held
	 * 2027 on a payment and 2029 on one of the three bases, and in 2034 each stays; the one who held only
	 * 2027 goes.
	 */
	@Test
	void everySeasonOfMembershipCountsWhateverItsBasis() {
		ZonedDateTime in2034 = belgrade(2034, 6, 1, 12, 0, 0);
		long onlyThe2027 = aMember("M");

		heldOn(onlyThe2027, 2027, "payment");

		for (String basis : List.of("payment", "feeExempt", "balance")) {
			long member = aMember("M");

			heldOn(member, 2027, "payment");
			heldOn(member, 2029, basis);

			assertThat(goes(member, in2034)).as("a season of 2029 on %s did not count", basis).isFalse();
		}

		assertThat(goes(onlyThe2027, in2034)).isTrue();
	}

	/**
	 * A MEMBER WHOSE ONLY SEASON WAS CANCELLED GOES FIVE YEARS AFTER IT, NOT TWELVE MONTHS AFTER HIS
	 * OPENING (PDL 05.11.2026): he has a number and a trail of money. And a cancelled season beside one
	 * that stood counts the same way, which is derived and not the owner's words.
	 */
	@Test
	void aCancelledSeasonCountsAsASeason() {
		long onlyCancelled = aMember("M");
		long cancelledLater = aMember("M");

		cancelled(onlyCancelled, 2028);
		heldOn(cancelledLater, 2027, "payment");
		cancelled(cancelledLater, 2029);

		assertThat(goes(onlyCancelled, belgrade(2033, 6, 1, 12, 0, 0))).as("the short way").isFalse();
		assertThat(goes(cancelledLater, belgrade(2034, 6, 1, 12, 0, 0))).as("from the season before").isFalse();
		assertThat(goes(onlyCancelled, belgrade(2034, 1, 31, 23, 59, 59))).as("the month after").isFalse();
		assertThat(goes(onlyCancelled, belgrade(2034, 2, 1, 0, 0, 0))).isTrue();
	}

	/**
	 * A NUMBER WITH NEITHER A SEASON NOR A TRAIL IS IN NEITHER OF THE TWO, and stays: it is not an
	 * account that never became a member („ni članski broj"), and it has no season to count from.
	 */
	@Test
	void aNumberWithNothingBehindItStays() {
		long aNumberAlone = aMember("M");
		long beside = neverAMember();

		ZonedDateTime years = belgrade(2040, 1, 1, 0, 0, 0);

		assertThat(goes(aNumberAlone, years)).isFalse();
		assertThat(goes(beside, years)).isTrue();
	}

	/**
	 * TWELVE MONTHS FROM THE OPENING OF A CONFIRMED ACCOUNT THAT NEVER BECAME A MEMBER (PDL 05.11.2026):
	 * on the moment he goes and a second short of it he stays; counted from the opening and not from the
	 * confirmation; and a payment that is only awaited is neither a season nor a number. But an account
	 * with ANY payment beside it stays (PDL 05.11.2026, „Nalog uz koji postoji ikakva uplata"), whether
	 * the payment is recorded or still awaits its booking; the account beside them with none goes.
	 */
	@Test
	void anAccountThatNeverBecameAMemberGoesTwelveMonthsFromItsOpening() {
		ZonedDateTime now = belgrade(2028, 3, 3, 10, 0, 0);
		long onTheMoment = neverAMember();
		long aSecondShort = neverAMember();
		long confirmedLately = neverAMember();
		long awaitingAPayment = neverAMember();
		long withARecordedPayment = neverAMember();

		opened(onTheMoment, now.minusMonths(12), OPENED);
		opened(aSecondShort, now.minusMonths(12).plusSeconds(1), OPENED);
		db.sql("update account set email_confirmed_at = ? where competitor_id = ?")
				.params(Timestamp.from(now.minusDays(1).toInstant()), confirmedLately).update();
		db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount, currency,"
						+ " fee, method, state) values (?, 2028, null,"
						+ " (select id from price_row order by sort_order limit 1), 35.00, 'EUR', 3.00, 'paypal',"
						+ " 'awaited')")
				.param(awaitingAPayment).update();
		db.sql("insert into payment (competitor_id, season, price_row_id, amount, currency, fee, method, state,"
						+ " recorded_at, recorded_by_name, received) values (?, 2028,"
						+ " (select id from price_row order by sort_order limit 1), 35.00, 'EUR', 3.00, 'paypal',"
						+ " 'recorded', now(), 'Blagajnik Probni', 35.00)")
				.param(withARecordedPayment).update();

		assertThat(goes(aSecondShort, now)).as("a second short of twelve months").isFalse();
		assertThat(goes(onTheMoment, now)).isTrue();
		assertThat(goes(confirmedLately, now)).as("counted from the confirmation").isTrue();
		assertThat(goes(awaitingAPayment, now)).as("a payment that awaits its booking kept him").isFalse();
		assertThat(goes(withARecordedPayment, now)).as("a recorded payment kept him").isFalse();
		assertThat(stands(awaitingAPayment)).isTrue();
		assertThat(stands(withARecordedPayment)).isTrue();
		assertThat(db.sql("select count(*) from payment where competitor_id in (?, ?)")
				.params(awaitingAPayment, withARecordedPayment).query(Long.class).single())
				.as("both payments still name their member").isEqualTo(2);
	}

	/**
	 * TWELVE MONTHS ON, A PARTNER IS TOLD THE PAIR IS BROKEN (PDL 05.11.2026, „Brisanje naloga koji nikad
	 * nije postao član (posle 12 meseci) javlja partneru da je trkački par raskinut"): an account opened
	 * and confirmed on 1 March 2027 with no number and no season, in a pair of 2028 with a woman who holds
	 * 2028, measured on 2 March 2028. The woman has one message and the pair is gone. Beside it, the
	 * deletion five years on tells her nothing, so the two ways are asked of the same woman.
	 */
	@Test
	void anAccountThatNeverBecameAMemberTellsHisPartnerThePairIsBroken() {
		ZonedDateTime now = belgrade(2028, 3, 2, 10, 0, 0);
		long he = neverAMember();
		long she = aMember("F");

		opened(he, belgrade(2027, 3, 1, 10, 0, 0), belgrade(2027, 3, 1, 10, 0, 0));
		heldOn(she, 2028, "payment");
		db.sql("insert into racing_pair (season, man_id, woman_id) values (2028, ?, ?)").params(he, she).update();

		assertThat(goes(he, now)).isTrue();

		assertThat(db.sql("select count(*) from message where to_id = ?").param(she).query(Long.class).single())
				.as("his partner was told the pair is broken").isEqualTo(1);
		assertThat(db.sql("select count(*) from racing_pair where woman_id = ?").param(she).query(Long.class).single())
				.isZero();
		assertThat(stands(she)).isTrue();
	}

	/**
	 * AN ACCOUNT THAT STOOD BEFORE V72 HAS NO OPENING, AND THE REGISTRATION'S MOMENT IS IT: thirteen
	 * months ago he goes, eleven he stays; and where the account has its own moment, that moment decides
	 * and not the registration's.
	 */
	@Test
	void anAccountWithNoOpeningIsCountedFromItsRegistration() {
		ZonedDateTime now = belgrade(2028, 3, 3, 10, 0, 0);
		long registeredLongAgo = neverAMember();
		long registeredLately = neverAMember();
		long theAccountIsLater = neverAMember();

		opened(registeredLongAgo, null, now.minusMonths(13));
		opened(registeredLately, null, now.minusMonths(11));
		opened(theAccountIsLater, now.minusMonths(11), now.minusMonths(13));

		assertThat(goes(registeredLately, now)).isFalse();
		assertThat(goes(theAccountIsLater, now)).as("the registration decided over the account").isFalse();
		assertThat(goes(registeredLongAgo, now)).isTrue();
	}

	/**
	 * WHAT THE TWELVE MONTHS DO NOT REACH: an unconfirmed account, which is {@link
	 * UnconfirmedAccountsAreSwept}'s; and an account behind a season or a trail of one, even without a
	 * number, which is a state only a fixture writes and is asked here because the decision names both.
	 */
	@Test
	void theTwelveMonthsReachNeitherAnUnconfirmedAccountNorASeason() {
		ZonedDateTime now = belgrade(2028, 3, 3, 10, 0, 0);
		long unconfirmed = neverAMember();
		long aSeason = neverAMember();
		long aTrail = neverAMember();
		long beside = neverAMember();

		db.sql("update account set email_confirmed_at = null where competitor_id = ?").param(unconfirmed).update();
		heldOn(aSeason, 2027, "feeExempt");
		cancelled(aTrail, 2027);

		assertThat(goes(unconfirmed, now)).as("an unconfirmed account").isFalse();
		assertThat(goes(aSeason, now)).as("a season without a number").isFalse();
		assertThat(goes(aTrail, now)).as("a trail without a number").isFalse();
		assertThat(goes(beside, now)).isTrue();
	}

	/** An account that administers stays (PDL 05.11.2026), by role and by a single ticked right. */
	@Test
	void anAccountThatAdministersStays() {
		long moderator = aMember("M", "071001", "moderator");
		long ticked = aMember("M", "071002", "competitor");
		long beside = aMember("M");

		for (long each : List.of(moderator, ticked, beside)) {
			heldOn(each, 2027, "payment");
		}
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where competitor_id = ?), 'queue:payments')")
				.param(ticked).update();

		assertThat(goes(moderator, FIVE_YEARS_AFTER_2027)).isFalse();
		assertThat(goes(ticked, FIVE_YEARS_AFTER_2027)).isFalse();
		assertThat(goes(beside, FIVE_YEARS_AFTER_2027)).isTrue();
	}

	/**
	 * HIS NAME STAYS IN THE FROZEN TABLES OF HIS SEASONS, WITHOUT A LINK, AND NOWHERE ELSE (PDL P23 and
	 * 05.11.2026). The snapshot tables are asked of the catalogue, so a table the snapshot adds is
	 * covered without a line here changing: this case writes one of its own, {@code season_probe}. A key
	 * that cascades ({@code season_points_at_freeze}) goes with him and is not asked to empty; a table
	 * outside the snapshot ({@code message}) says <Obrisani član>, as for a deletion he asked for. And
	 * the row of the member beside him is not touched.
	 */
	@Test
	void theNameStaysInTheFrozenTablesOfHisSeasonsAndNowhereElse() {
		long he = aMember("M");
		long beside = aMember("M");

		heldOn(he, 2027, "payment");
		heldOn(beside, 2032, "payment");

		/* The totals and the place in the category are V84's, as in CompetitorWriteApiTest: the place is the
		   place, which is the one category both rows stand in. */
		db.sql("insert into season_competitor (season, position, competitor_id, who, gender, category, points,"
				+ " races, kilometers, ascent, descent, seconds, category_position)"
				+ " values (2027, 1, ?, 'Probni Clan', 'M', 'Seniori', 10.00, 3, 30, 0, 0, 9000, 1),"
				+ " (2027, 2, ?, 'Drugi Clan', 'M', 'Seniori', 9.00, 3, 30, 0, 0, 9000, 2)")
				.params(he, beside).update();

		db.sql("create table season_probe (id bigserial primary key,"
				+ " competitor_id bigint references competitor (id) on delete set null, who text)").update();
		db.sql("insert into season_probe (competitor_id, who) values (?, 'Probni Clan')").param(he).update();
		/* THE PROBE EMPTIES ITS NAME ON THE DELETION, as V79's trigger does for the two real tables. Without
		   it `on delete set null` alone gives "the pointer empty, the name staying" whatever the job did,
		   so the same value would come from two places and no mutation of the catalogue question would
		   change it. */
		db.sql("create function season_probe_forgets_the_name() returns trigger language plpgsql as"
				+ " $body$ begin update season_probe set who = null where competitor_id = old.id;"
				+ " return old; end; $body$").update();
		db.sql("create trigger season_probe_forgets_the_name_of_a_deleted_member before delete on competitor"
				+ " for each row execute function season_probe_forgets_the_name()").update();

		/* THE STANDINGS OF A LEAGUE: his own row, and the row of the member beside him. */
		db.sql("insert into league (slug, name, season, rules, prizes) values ('probna-liga', 'Probna liga',"
				+ " 2027, '', '')").update();
		db.sql("insert into season_league_standing (season, league_id, league_name, position, competitor_id,"
				+ " who, gender, points) values (2027, (select id from league where slug = 'probna-liga'),"
				+ " 'Probna liga', 1, ?, 'Probni Clan', 'M', 10.00),"
				+ " (2027, (select id from league where slug = 'probna-liga'), 'Probna liga', 2, ?,"
				+ " 'Drugi Clan', 'M', 9.00)").params(he, beside).update();

		/* A LEAGUE AND A TEAM WHOSE KEY IS THE NUMBER OF THE MEMBER WHO GOES. A key that names a league
		   or a team is not a key that names a member, and the question put to the catalogue is which
		   table points at competitor: with it dropped, `league_id = ?` and `team_id = ?` are asked of his
		   number and empty somebody else's league and team. */
		db.sql("insert into league (id, slug, name, season, rules, prizes) values (?, 'liga-s-njegovim-brojem',"
				+ " 'Liga s njegovim brojem', 2027, '', '')").param(he).update();
		db.sql("insert into team (id, slug, name, bio, link, place_id, city, country_id, logo_id, first_season,"
				+ " admin_id) values (?, 'tim-s-njegovim-brojem', 'Tim s njegovim brojem', '', '', "
				+ A_TOWN_IN_SERBIA + ", null, null, null, 2027, null)").param(he).update();
		db.sql("insert into season_league_standing (season, league_id, league_name, position, competitor_id,"
				+ " who, gender, points) values (2027, ?, 'Liga s njegovim brojem', 1, ?, 'Drugi Clan', 'M', 8.00)")
				.params(he, beside).update();
		db.sql("insert into season_team (season, position, team_id, name, points, members, races, kilometers,"
				+ " ascent, descent, seconds) values (2027, 1, ?, 'Tim s njegovim brojem', 20.00, 2, 1, 10, 0,"
				+ " 0, 3000)").param(he).update();

		/* THE TABLES V84 ADDED, which no line of the job names: the roster of that team and the awards.
		   Each holds his row and the row of the member beside him, so "the pointer empty, the name staying"
		   is asked of the one and "untouched" of the other. */
		db.sql("insert into season_team_member (season_team_id, position, competitor_id, who, gender, points,"
				+ " races, kilometers, ascent, descent, seconds) values"
				+ " ((select id from season_team where name = 'Tim s njegovim brojem'), 1, ?, 'Probni Clan', 'M',"
				+ " 10.00, 3, 30, 0, 0, 9000),"
				+ " ((select id from season_team where name = 'Tim s njegovim brojem'), 2, ?, 'Drugi Clan', 'M',"
				+ " 9.00, 3, 30, 0, 0, 9000)").params(he, beside).update();
		db.sql("insert into season_award (season, kind, position, competitor_id, who, gender, points) values"
				+ " (2027, 'overall', 1, ?, 'Probni Clan', 'M', 10.00),"
				+ " (2027, 'overall', 2, ?, 'Drugi Clan', 'M', 9.00)").params(he, beside).update();

		db.sql("insert into season_frozen (season, frozen_at) values (2027, timestamptz '2028-01-01 15:00:00+00')"
				+ " on conflict do nothing").update();
		db.sql("insert into season_points_at_freeze (season, competitor_id, points) values (2027, ?, 10.00)")
				.param(he).update();

		db.sql("insert into message (to_id, from_id, from_name, subject, body)"
				+ " values (?, ?, 'Probni Clan', 'Pozdrav', 'Vidimo se')").params(beside, he).update();

		assertThat(goes(he, FIVE_YEARS_AFTER_2027)).isTrue();

		assertThat(db.sql("select competitor_id, who from season_competitor where season = 2027 and position = 1")
				.query().singleRow()).as("his row of the frozen table")
				.containsEntry("competitor_id", null).containsEntry("who", "Probni Clan");
		assertThat(db.sql("select competitor_id, who from season_competitor where season = 2027 and position = 2")
				.query().singleRow()).as("the row of the member beside him")
				.containsEntry("competitor_id", beside).containsEntry("who", "Drugi Clan");
		assertThat(db.sql("select competitor_id, who from season_team_member where position = 1").query()
				.singleRow()).as("his place on the roster of a frozen team")
				.containsEntry("competitor_id", null).containsEntry("who", "Probni Clan");
		assertThat(db.sql("select competitor_id, who from season_team_member where position = 2").query()
				.singleRow()).as("the place of the member beside him on it")
				.containsEntry("competitor_id", beside).containsEntry("who", "Drugi Clan");
		assertThat(db.sql("select competitor_id, who from season_award where position = 1").query().singleRow())
				.as("his award, in a table the job names nowhere")
				.containsEntry("competitor_id", null).containsEntry("who", "Probni Clan");
		assertThat(db.sql("select competitor_id, who from season_award where position = 2").query().singleRow())
				.as("the award of the member beside him")
				.containsEntry("competitor_id", beside).containsEntry("who", "Drugi Clan");

		assertThat(db.sql("select competitor_id, who from season_probe").query().singleRow())
				.as("a snapshot table nothing here names")
				.containsEntry("competitor_id", null).containsEntry("who", "Probni Clan");

		assertThat(db.sql("select competitor_id, who from season_league_standing where position = 1"
				+ " and league_name = 'Probna liga'").query().singleRow()).as("his row of a league's standing")
				.containsEntry("competitor_id", null).containsEntry("who", "Probni Clan");
		assertThat(db.sql("select competitor_id, who from season_league_standing where position = 2"
				+ " and league_name = 'Probna liga'").query().singleRow())
				.as("the row of the member beside him in it")
				.containsEntry("competitor_id", beside).containsEntry("who", "Drugi Clan");
		assertThat(db.sql("select league_id, competitor_id, who from season_league_standing"
				+ " where league_name = 'Liga s njegovim brojem'").query().singleRow())
				.as("a row whose LEAGUE has the number of the member who went")
				.containsEntry("league_id", he).containsEntry("competitor_id", beside)
				.containsEntry("who", "Drugi Clan");
		assertThat(db.sql("select team_id from season_team where name = 'Tim s njegovim brojem'")
				.query(Long.class).single()).as("a row whose TEAM has the number of the member who went")
				.isEqualTo(he);

		Map<String, Object> message = db.sql("select from_id, from_name from message where to_id = ?")
				.param(beside).query().singleRow();
		assertThat(message).containsEntry("from_id", null).containsEntry("from_name", CompetitorWriteApi.A_DELETED_MAN);
	}

	/**
	 * NOBODY IS TOLD (PDL 05.11.2026, „ni bivšem partneru iz para"), while his pair goes with him: the
	 * woman he raced with in 2027 has no message, where the administration's deletion would have sent her
	 * one.
	 */
	@Test
	void nobodyIsToldAndHisPairGoesWithHim() {
		long he = aMember("M");
		long she = aMember("F");

		heldOn(he, 2027, "payment");
		heldOn(she, 2027, "payment");
		heldOn(she, 2032, "payment");
		db.sql("insert into racing_pair (season, man_id, woman_id) values (2027, ?, ?)").params(he, she).update();

		assertThat(goes(he, FIVE_YEARS_AFTER_2027)).isTrue();

		assertThat(db.sql("select count(*) from message where to_id = ?").param(she).query(Long.class).single())
				.as("his partner of 2027 was told").isZero();
		assertThat(db.sql("select count(*) from racing_pair where woman_id = ?").param(she).query(Long.class).single())
				.isZero();
		assertThat(stands(she)).isTrue();
	}

	/**
	 * A MEMBER GIVEN A SEASON BETWEEN THE WALK AND THE HOLD STAYS: the question is asked again of him as
	 * he stands under the hold.
	 */
	@Test
	void aMemberGivenASeasonAfterTheWalkFoundHimStays() {
		long he = aMember("M");

		heldOn(he, 2027, "payment");
		heldOn(he, 2033, "payment");

		assertThat(goes(he, FIVE_YEARS_AFTER_2027)).isFalse();
		assertThat(stands(he)).isTrue();
	}

	/**
	 * THE WALK, TWICE: the first run takes him and leaves the member beside him, and the second finds
	 * nothing of his left to take and fails on nothing. A moderator whose own season is as old as his is
	 * found by the walk every hour, because the walk asks only the keeping, and is left every hour,
	 * because the decision asks who administers.
	 */
	@Test
	void aSecondRunFindsNothingLeftAndFailsOnNothing() {
		long he = aMember("M");
		long beside = aMember("M");
		long moderator = aMember("M", "071003", "moderator");

		heldOn(he, 2027, "payment");
		heldOn(beside, 2032, "payment");
		heldOn(moderator, 2027, "payment");

		job(FIVE_YEARS_AFTER_2027).sweep();

		assertThat(stands(he)).isFalse();
		assertThat(stands(beside)).isTrue();
		assertThat(stands(moderator)).as("the walk deleted a moderator").isTrue();

		job(FIVE_YEARS_AFTER_2027.plus(Duration.ofHours(1))).sweep();

		assertThat(stands(beside)).isTrue();
		assertThat(stands(moderator)).isTrue();
	}

	/** Once an hour, the first an hour after the start, as the pictures' sweep. */
	@Test
	void theSweepIsScheduledOnceAnHourAndAnHourAfterStart() {
		String theSweep = ProfilesPastTheirKeepingAreDeleted.class.getName() + ".sweep";
		List<ScheduledTask> found = schedulers.stream()
				.flatMap(each -> each.getScheduledTasks().stream())
				.distinct()
				.filter(task -> task.getTask().getRunnable().toString().equals(theSweep))
				.toList();

		assertThat(found).as("the scheduler holds no task that runs the sweep").hasSize(1);
		assertThat(found.get(0).getTask()).isInstanceOf(FixedDelayTask.class);
		assertThat(((FixedDelayTask) found.get(0).getTask()).getIntervalDuration()).isEqualTo(Duration.ofHours(1));
		assertThat(((FixedDelayTask) found.get(0).getTask()).getInitialDelayDuration()).isEqualTo(Duration.ofHours(1));
	}
}
