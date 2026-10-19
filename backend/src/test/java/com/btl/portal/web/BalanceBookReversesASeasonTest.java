package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.balance.Balance;
import com.btl.portal.domain.balance.ReversingAMembership.Reversal;
import com.btl.portal.domain.pricing.Currency;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE BOOK REVERSES ONE SEASON OF ONE MEMBER, over a real database, with every other source of the
 * same number standing beside it.
 *
 * <p>{@link BalanceBook#reversed} reads a member's lines and writes one; {@link
 * com.btl.portal.domain.balance.ReversingAMembership} decides what the line is and has its own cases.
 * What only the database can answer is WHOSE lines are read, so the setting holds the lines a wrong
 * reading would take: another member's spend and credit for the same season, written before his; the
 * member's own spend for another season; the reward the member himself earned; and the reward his
 * referrer earned for bringing HIM in, which the owner decided stays („Nagrada preporuciocu ostaje kad
 * se clanstvo preporucenog stornira", PDL P8, 18.10.2026).
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class BalanceBookReversesASeasonTest {

	private static final String A_TOWN = "(select id from place where rank = 1)";

	private static final String AN_INSTANT = "timestamptz '2026-10-02 09:00:00+00'";

	private static final int SEASON = 2028;

	@Autowired
	private JdbcClient db;

	@Autowired
	private BalanceBook book;

	private long somebodyElse;

	private long referrer;

	private long member;

	private long newcomer;

	private long moderator;

	@BeforeEach
	void aMemberAmongOthers() {
		somebodyElse = competitor("008000", "00112233445566f1", null);
		referrer = competitor("008001", "00112233445566f2", null);
		member = competitor("008002", "00112233445566f3", referrer);
		newcomer = competitor("008003", "00112233445566f4", member);

		moderator = db.sql("insert into account (first_name, last_name, email, role_id) values ('Moderator',"
						+ " 'Probni', 'moderator-knjige@primer.rs', (select id from role where code = 'moderator'))"
						+ " returning id")
				.query(Long.class).single();

		/* Somebody else's season, the same season, written first. */
		line(somebodyElse, "-20.00", "EUR", "membership", null, SEASON);
		line(somebodyElse, "4.00", "EUR", "overpayment", null, SEASON);

		/* The reward his referrer earned for bringing him in, in the referrer's book. */
		line(referrer, "5.00", "EUR", "referral", member, null);

		/* His own reward, and his own spend for the season before. */
		line(member, "100.00", "EUR", "referral", newcomer, null);
		line(member, "-15.00", "EUR", "membership", null, 2027);
	}

	private long competitor(String number, String code, Long referredBy) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, city, country_id, first_season, first_season_2027,"
						+ " active, referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Probni', 'Clan', 'M', date '1982-02-02', " + A_TOWN + ", null,"
						+ " null, 2027, false, true, ?, ?, '', false, 'none', 'Otac', 'Ulica 1',"
						+ " 'M', timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, code, referredBy).query(Long.class).single();
	}

	private void line(long competitor, String amount, String currency, String reason, Long referred,
			Integer season) {
		db.sql("insert into balance_entry (competitor_id, amount, currency, reason,"
						+ " referred_competitor_id, season, occurred_at, recorded_by_name)"
						+ " values (?, cast(? as numeric), ?, ?, ?, ?, " + AN_INSTANT + ", 'Blagajnik Probni')")
				.params(competitor, amount, currency, reason, referred, season)
				.update();
	}

	private List<String> linesOf(long competitor) {
		return db.sql("select reason || ' ' || coalesce(season::text, '-') || ' ' || amount || ' ' || currency"
						+ " from balance_entry where competitor_id = ? order by id")
				.param(competitor).query(String.class).list();
	}

	@Test
	void aSpendOfTheSeasonIsGivenBackToHimAndNobodyElseIsTouched() {
		line(member, "-35.00", "EUR", "membership", null, SEASON);

		List<String> hisBefore = linesOf(member);
		List<String> somebodyElsesBefore = linesOf(somebodyElse);
		List<String> referrersBefore = linesOf(referrer);
		Balance.Money balanceBefore = book.of(member, Currency.EUR);

		assertThat(book.reversed(member, SEASON, Currency.EUR, moderator, "Moderator Probni"))
				.contains(new Reversal(new BigDecimal("35.00"), Currency.EUR));

		assertThat(linesOf(member)).as("the lines that stood were touched, or the reversal is not one line")
				.containsExactlyElementsOf(Stream.concat(hisBefore.stream(),
						Stream.of("reversal 2028 35.00 EUR")).toList());
		assertThat(book.of(member, Currency.EUR).amount())
				.isEqualByComparingTo(balanceBefore.amount().add(new BigDecimal("35.00")));
		assertThat(linesOf(somebodyElse)).containsExactlyElementsOf(somebodyElsesBefore);
		assertThat(linesOf(referrer)).as("the reward for bringing him in was reversed")
				.containsExactlyElementsOf(referrersBefore);

		assertThat(db.sql("select recorded_by || ' ' || recorded_by_name from balance_entry"
						+ " where reason = 'reversal'").query(String.class).single())
				.isEqualTo(moderator + " Moderator Probni");
	}

	@Test
	void aCreditOfTheSeasonIsTakenBack() {
		line(member, "7.00", "EUR", "overpayment", null, SEASON);

		assertThat(book.reversed(member, SEASON, Currency.EUR, moderator, "Moderator Probni"))
				.contains(new Reversal(new BigDecimal("-7.00"), Currency.EUR));
		assertThat(linesOf(member)).last().isEqualTo("reversal 2028 -7.00 EUR");
	}

	/** An exemption, or a payment that took nothing: the season holds nothing and nothing is written. */
	@Test
	void aSeasonThatHoldsNothingWritesNothing() {
		List<String> before = linesOf(member);

		assertThat(book.reversed(member, SEASON, Currency.EUR, moderator, "Moderator Probni")).isEmpty();
		assertThat(linesOf(member)).containsExactlyElementsOf(before);
	}

	/**
	 * CANCELLED, PAID FOR AGAIN, AND ASKED WHAT THE MEMBERSHIP TOOK: the membership that stands took 20,
	 * and the 30 of the pass already reversed is not part of it.
	 */
	@Test
	void whatAMembershipTookIsWhatTheMembershipThatStandsTook() {
		line(member, "-30.00", "EUR", "membership", null, SEASON);
		book.reversed(member, SEASON, Currency.EUR, moderator, "Moderator Probni");
		book.spentOnAMembership(member, SEASON, new Balance.Money(new BigDecimal("20.00"), Currency.EUR),
				moderator, "Moderator Probni");

		assertThat(book.whatAMembershipTook(member, SEASON, Currency.EUR))
				.isEqualTo(new Balance.Money(new BigDecimal("20.00"), Currency.EUR));
		assertThat(book.reversed(member, SEASON, Currency.EUR, moderator, "Moderator Probni"))
				.contains(new Reversal(new BigDecimal("20.00"), Currency.EUR));
	}

	/**
	 * PAID IN DINARS PARTLY FROM THE BALANCE, MOVED ABROAD, THEN CANCELLED: given back in euro, the money
	 * his balance is read in now, translated as the change of country translated (a derivation from PDL
	 * 26, not a decision of the owner's).
	 */
	@Test
	void paidInDinarsPartlyFromTheBalanceMovedAbroadThenCancelled() {
		long movedAbroad = competitor("008004", "00112233445566f5", null);

		line(movedAbroad, "1200.00", "RSD", "referral", somebodyElse, null);
		line(movedAbroad, "-600.00", "RSD", "membership", null, SEASON);
		book.translated(movedAbroad, new Balance.Money(new BigDecimal("600.00"), Currency.RSD),
				new Balance.Money(new BigDecimal("5.00"), Currency.EUR), moderator, "Moderator Probni");

		assertThat(book.reversed(movedAbroad, SEASON, Currency.EUR, moderator, "Moderator Probni"))
				.contains(new Reversal(new BigDecimal("5.00"), Currency.EUR));
		assertThat(book.of(movedAbroad, Currency.EUR).amount()).isEqualByComparingTo("10.00");
	}
}
