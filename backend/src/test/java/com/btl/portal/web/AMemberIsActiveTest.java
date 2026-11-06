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

import java.time.ZonedDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHO IS ACTIVE AT A MOMENT, ASKED OF THE ONE CONDITION EVERY READER IS BUILT WITH, OVER A DATABASE THAT
 * HOLDS EVERY KIND OF ROW.
 *
 * <p>PDL, „Članstvo je činjenica po sezoni" (13.09.2026): „aktivan je onaj ko ima zapis za tekuću sezonu, a
 * u prelaznom roku i onaj ko ga ima za narednu", and „Stornirana uplata i ona koja se čeka ne prave zapis".
 * The owner, 06.11.2026: „Član sa članarinom samo za sezonu koja je upravo završila ostaje aktivan 1. januara
 * do 16:00 [...] U 16:00:00 postaje neaktivan", and „Storno nove sezone urađen 1. januara pre 16:00 ne gasi
 * člana koji ima prethodnu sezonu pre 16:00".
 *
 * <p><b>The flag is set AGAINST the rows on purpose</b>: everybody who holds a season that makes him active
 * has {@code active = false}, and everybody who holds none has {@code active = true}, so a condition that
 * read the flag would answer every case below the other way round.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class AMemberIsActiveTest {

	@Autowired
	private JdbcClient db;

	/** Holds 2027 only, paid. */
	private long only2027;

	/** Holds 2028 only, on his balance. */
	private long only2028;

	/** Holds 2029 only, freed of the fee. */
	private long only2029;

	/** Holds nothing, and his flag says he is active. */
	private long nothing;

	/** Holds 2027 and had 2028, which was cancelled: the row is gone, the trail stays. */
	private long cancelled2028;

	/** Waits on a payment for 2027 nobody has recorded. */
	private long awaiting;

	@BeforeEach
	void everyKindOfRow() {
		only2027 = member("000801", false);
		only2028 = member("000802", false);
		only2029 = member("000803", false);
		nothing = member("000804", true);
		cancelled2028 = member("000805", false);
		awaiting = member("000806", true);

		HeldOn.season(db, only2027, 2027, "payment");
		HeldOn.season(db, only2028, 2028, "balance");
		HeldOn.season(db, only2029, 2029, "feeExempt");
		HeldOn.season(db, cancelled2028, 2027, "feeExempt");
		HeldOn.season(db, cancelled2028, 2028, "feeExempt");
		db.sql("delete from membership where competitor_id = ? and season = 2028").param(cancelled2028).update();
		db.sql("insert into payment (competitor_id, season, price_row_id, amount, currency, fee, method, state)"
						+ " values (?, 2027, (select id from price_row order by sort_order limit 1), 30.00, 'EUR',"
						+ " 3.00, 'ips', 'awaited')")
				.param(awaiting).update();
	}

	/** In June of a season only that season counts, on any basis, and never a later or an earlier one. */
	@Test
	void inJuneOnlyTheSeasonBeingRunCounts() {
		assertThat(activeAt(belgrade(2028, 6, 15, 12, 0, 0, 0)))
				.containsExactly(only2028);
		assertThat(activeAt(belgrade(2027, 6, 15, 12, 0, 0, 0)))
				.as("a season cancelled leaves its row out, and a payment still awaited writes none")
				.containsExactly(only2027, cancelled2028);
	}

	/** The window opens on 11 November: the next season counts from its first instant and not before. */
	@Test
	void theNextSeasonCountsFromTheFirstInstantOf11November() {
		assertThat(activeAt(belgrade(2027, 11, 10, 23, 59, 59, 999_999_999)))
				.containsExactly(only2027, cancelled2028);
		assertThat(activeAt(belgrade(2027, 11, 11, 0, 0, 0, 0)))
				.containsExactly(only2027, only2028, cancelled2028);
	}

	/**
	 * On 1 January the season just ended counts until 16:00:00 and not at it; midnight and 10:00 move nothing.
	 * The member whose new season was cancelled before 16:00 holds only the old one and is answered as anybody
	 * who holds only it is.
	 */
	@Test
	void theSeasonJustEndedCountsUntil16OnNewYearsDay() {
		List<Long> untilFour = List.of(only2027, only2028, cancelled2028);

		assertThat(activeAt(belgrade(2027, 12, 31, 23, 59, 59, 999_999_999))).containsExactlyElementsOf(untilFour);
		assertThat(activeAt(belgrade(2028, 1, 1, 0, 0, 0, 0))).containsExactlyElementsOf(untilFour);
		assertThat(activeAt(belgrade(2028, 1, 1, 10, 0, 0, 0))).containsExactlyElementsOf(untilFour);
		assertThat(activeAt(belgrade(2028, 1, 1, 15, 59, 59, 999_999_999))).containsExactlyElementsOf(untilFour);
		assertThat(activeAt(belgrade(2028, 1, 1, 16, 0, 0, 0)))
				.as("16:00:00 on 1 January: whoever holds only 2027 is no longer active")
				.containsExactly(only2028);
	}

	/** The clock is the one handed in, and never the database's: two moments a year apart give two answers. */
	@Test
	void theMomentIsTheOneHandedIn() {
		assertThat(activeAt(belgrade(2029, 3, 1, 12, 0, 0, 0))).containsExactly(only2029);
		assertThat(activeAt(belgrade(2028, 3, 1, 12, 0, 0, 0))).containsExactly(only2028);
	}

	private List<Long> activeAt(ZonedDateTime at) {
		return db.sql("select c.id from competitor c where c.member_number like '0008%' and "
						+ AMemberIsActive.of("c.id", at) + " order by c.id")
				.query(Long.class)
				.list();
	}

	private static ZonedDateTime belgrade(int year, int month, int day, int hour, int minute, int second, int nano) {
		return ZonedDateTime.of(year, month, day, hour, minute, second, nano, SeasonClock.ZONE);
	}

	private long member(String number, boolean flag) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season, active,"
						+ " referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Clan', 'M', date '1990-05-05',"
						+ " (select id from place where rank = 1), null, null, 2027, ?,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, flag, "0011223344" + number)
				.query(Long.class).single();
	}
}
