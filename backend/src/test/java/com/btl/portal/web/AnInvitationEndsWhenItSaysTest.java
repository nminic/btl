package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.mail.MailLanguage;
import com.btl.portal.domain.mail.WhatANoticeSays;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.token.SecretToken;
import com.btl.portal.mail.Postman;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * THE LETTER THAT INVITES A MEMBER SAYS THE MOMENT ITS LINK ENDS, AND THE LINK'S ROW ENDS THEN.
 *
 * <p>The owner, 20.11.2026, of the letter that confirms an address: „Ispravi tekst da kaže tačan rok".
 * The invitation said „Link važi sedam dana" on every day, and the entry it belongs to is deleted by
 * {@code UnconfirmedAccountsAreSwept} fourteen days after it was written at the latest (PDL 24.10.2026,
 * „Granica od 14 dana važi i za pozivnicu"), and only if the account has no member number and no payment
 * (PDL 20.11.2026, „Rok od 14 dana ... važe samo za nalog koji čistač stvarno briše").
 *
 * <p><b>THE DAY OF WRITING AND THE DAY OF SENDING ARE DIFFERENT IN EVERY CASE</b> (nine days apart where
 * it matters), so a moment worked out from the day of writing and one worked out from the day of sending
 * are two different instants: an invitation whose link ends fourteen days after the SENDING, or seven
 * after the WRITING, fails every case below that is not the group entry's own.
 *
 * <p><b>Three levels, because the routes cannot reach every axis.</b> A member the administration entered
 * has no number until he pays, so he cannot be addressed by number and no route sends HIM a second
 * invitation; the members a route sends one to all have a number, which the sweep never deletes. The axis
 * „the sweep deletes him and the fourteenth day is nearer" is therefore reached at the level that mints
 * the row ({@link #theSweepDeletesOnlyWhoHasNeitherANumberNorAPayment}), and in the pure rule
 * ({@link #theMomentIsTheEarlierOfTheTwoAndOnlyWhereTheSweepDeletes}); the two routes that do send a
 * second invitation are measured through their letters.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class AnInvitationEndsWhenItSaysTest {

	/** The sending: now, and the clock is fixed on it so that the rows and the cases name the same instant. */
	private static final Instant SENT = Instant.now().truncatedTo(ChronoUnit.SECONDS);

	private static final Instant NINE_DAYS_BEFORE = SENT.minus(Duration.ofDays(9));

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisFileUses {

		@Bean
		@Primary
		Clock aClockFixedOnTheSending() {
			return Clock.fixed(SENT, ZoneOffset.UTC);
		}
	}

	/** One case of the pure rule, the moments written by hand and never worked out from the rule. */
	record Case(String name, Instant sentAt, Instant writtenAt, boolean sweeps, Instant ends) {

		@Override
		public String toString() {
			return name;
		}
	}

	private static final Instant D10 = Instant.parse("2026-12-10T12:00:00Z");

	static Stream<Case> theCases() {
		return Stream.of(
				new Case("the sweep deletes him, younger than a week: seven days from the sending", D10,
						Instant.parse("2026-12-07T12:00:00Z"), true, Instant.parse("2026-12-17T12:00:00Z")),
				new Case("the sweep deletes him, older than a week: fourteen days from the writing", D10,
						Instant.parse("2026-12-01T12:00:00Z"), true, Instant.parse("2026-12-15T12:00:00Z")),
				new Case("the sweep deletes him, no recorded writing: seven days from the sending", D10,
						null, true, Instant.parse("2026-12-17T12:00:00Z")),
				new Case("the sweep deletes him, past his fourteenth day: seven days from the sending", D10,
						Instant.parse("2026-11-20T12:00:00Z"), true, Instant.parse("2026-12-17T12:00:00Z")),
				new Case("the sweep deletes him, fourteenth day exactly the seventh from the sending", D10,
						Instant.parse("2026-12-03T12:00:00Z"), true, Instant.parse("2026-12-17T12:00:00Z")),
				new Case("the sweep does NOT delete him, older than a week: still seven days from the sending",
						D10, Instant.parse("2026-12-01T12:00:00Z"), false, Instant.parse("2026-12-17T12:00:00Z")),
				new Case("the sweep does NOT delete him, younger than a week: seven days from the sending", D10,
						Instant.parse("2026-12-07T12:00:00Z"), false, Instant.parse("2026-12-17T12:00:00Z")));
	}

	@ParameterizedTest(name = "{0}")
	@MethodSource("theCases")
	void theMomentIsTheEarlierOfTheTwoAndOnlyWhereTheSweepDeletes(Case theCase) {
		assertThat(AnInvitationOfAMember.of(theCase.sentAt(), theCase.writtenAt(), theCase.sweeps()))
				.isEqualTo(theCase.ends());
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private Clock clock;

	@MockitoSpyBean
	private Postman postman;

	private String session;

	private int sequence;

	@BeforeEach
	void aModeratorOverTheMembers() {
		doNothing().when(postman).send(any(Said.class), anyString());

		db.sql("insert into account (first_name, last_name, email, role_id, email_confirmed_at,"
						+ " password_hash) values ('Mira', 'Clanovic', 'rok-pozivnice-moderator@primer.rs',"
						+ " (select id from role where code = 'moderator'), now(),"
						+ " '{bcrypt}$2a$10$abcdefghijklmnopqrstuv')")
				.update();
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = 'rok-pozivnice-moderator@primer.rs'),"
						+ " 'entity:members')")
				.update();

		SecretToken cookie = SecretToken.fresh();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at, expires_at)"
						+ " values ((select id from account where email = 'rok-pozivnice-moderator@primer.rs'),"
						+ " ?, ?, ?, ?)")
				.params(cookie.hash(), Timestamp.from(SENT.minus(Duration.ofDays(1))), Timestamp.from(SENT),
						Timestamp.from(SENT.plus(SessionLife.LASTS)))
				.update();
		session = cookie.secret();
	}

	/** A member, with the number or the payment the case gives him, and an account with no password. */
	private long anAccountWritten(String number, boolean withAPayment, Instant writtenAt) {
		int one = ++sequence;
		long member = db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season, referral_code, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, 'Bez', 'Lozinke', 'F', date '1993-09-09',"
						+ " (select id from place where country_id = (select id from country where code = 'RS')"
						+ " order by rank limit 1), 2027, ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, "0011aabbcc00" + (1000 + one))
				.query(Long.class).single();
		long account = db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values ('Bez', 'Lozinke', ?, (select id from role where code = 'competitor'), ?)"
						+ " returning id")
				.params("rok-pozivnice-" + one + "@primer.rs", member).query(Long.class).single();

		db.sql("update account set created_at = ? where id = ?")
				.params(writtenAt == null ? null : Timestamp.from(writtenAt), account).update();

		if (withAPayment) {
			db.sql("insert into payment (competitor_id, season, reference, price_row_id, amount, currency,"
							+ " fee, method, state, recorded_at, recorded_by, recorded_by_name, received)"
							+ " values (?, 2028, null, (select id from price_row order by sort_order limit 1),"
							+ " 35.00, 'EUR', 3.00, 'paypal', 'awaited', null, null, null, null)")
					.param(member).update();
		}

		return account;
	}

	private Instant theRowEnds(long account) {
		return db.sql("select expires_at from password_reset_token where account_id = ?")
				.param(account).query(Timestamp.class).single().toInstant();
	}

	/**
	 * THE ROW IS WRITTEN WHERE THE MOMENT IS WORKED OUT, and the three kinds of account the sweep tells
	 * apart each get theirs: no number and no payment is deleted, so his link ends on the fourteenth day
	 * from his writing, five days from the sending nine days after it; a number alone keeps him, and a
	 * payment alone keeps him, and each gets the full seven days. The payment is a case of its own and
	 * not a variation of the number, because the sweep asks the two separately.
	 */
	@ParameterizedTest(name = "{0}")
	@MethodSource("theKindsOfAccount")
	void theSweepDeletesOnlyWhoHasNeitherANumberNorAPayment(String kind, String number, boolean payment,
			boolean sweeps) {
		long account = anAccountWritten(number, payment, NINE_DAYS_BEFORE);
		SecretToken invitation = SecretToken.fresh();

		Instant returned = AnInvitationOfAMember.mint(db, clock, account, invitation);

		Instant expected = sweeps ? NINE_DAYS_BEFORE.plus(Duration.ofDays(14)) : SENT.plus(Duration.ofDays(7));

		assertThat(returned).as("what the letter is handed").isEqualTo(expected);
		assertThat(theRowEnds(account)).as("what the row ends").isEqualTo(expected);
	}

	/**
	 * AN ACCOUNT NOBODY RECORDED THE WRITING OF (it stood before V72) HAS NO FOURTEENTH DAY, and is read back
	 * off the row as it is and not guessed: the sweep would delete him, and his link is seven days from the
	 * sending all the same.
	 */
	@Test
	void anAccountWithNoRecordedWritingIsSevenDaysFromTheSending() {
		long account = anAccountWritten(null, false, null);

		assertThat(AnInvitationOfAMember.mint(db, clock, account, SecretToken.fresh()))
				.isEqualTo(SENT.plus(Duration.ofDays(7)));
		assertThat(theRowEnds(account)).isEqualTo(SENT.plus(Duration.ofDays(7)));
	}

	static Stream<org.junit.jupiter.params.provider.Arguments> theKindsOfAccount() {
		return Stream.of(
				org.junit.jupiter.params.provider.Arguments.of("no number and no payment: swept", null, false, true),
				org.junit.jupiter.params.provider.Arguments.of("a number and no payment: kept", "009001", false,
						false),
				org.junit.jupiter.params.provider.Arguments.of("a payment and no number: kept", null, true,
						false));
	}

	/**
	 * THE ADMINISTRATION CORRECTS THE ADDRESS OF A MEMBER WITH NO PASSWORD, nine days after he was written:
	 * he has a number, so the sweep keeps him, and the letter and the row say seven days from the sending
	 * and not five (fourteen from the writing).
	 */
	@Test
	void aCorrectedAddressIsSentAnInvitationWhoseLetterSaysTheMomentTheRowEnds() throws Exception {
		long account = anAccountWritten("009002", false, NINE_DAYS_BEFORE);

		assertThat(http.perform(put("/api/members/009002/data").with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content("{\"email\": \"rok-ispravljena@primer.rs\"}")
								.cookie(new Cookie(SessionCookie.NAME, session)))
						.andReturn().getResponse().getStatus())
				.isEqualTo(200);

		assertTheLetterSaysTheMomentTheRowEnds(account, "rok-ispravljena@primer.rs");
	}

	/** THE ADMINISTRATION SENDS A NEW INVITATION from the member's row, nine days after he was written. */
	@Test
	void aNewInvitationFromTheAdministrationSaysTheMomentTheRowEnds() throws Exception {
		long account = anAccountWritten("009003", false, NINE_DAYS_BEFORE);

		assertThat(http.perform(post("/api/members/009003/invitation").with(csrf())
								.cookie(new Cookie(SessionCookie.NAME, session)))
						.andReturn().getResponse().getStatus())
				.isEqualTo(200);

		assertTheLetterSaysTheMomentTheRowEnds(account, "rok-pozivnice-" + sequence + "@primer.rs");
	}

	private void assertTheLetterSaysTheMomentTheRowEnds(long account, String to) {
		ArgumentCaptor<Said> letter = ArgumentCaptor.forClass(Said.class);

		verify(postman, times(1)).send(letter.capture(), org.mockito.ArgumentMatchers.eq(to));
		assertThat(theRowEnds(account))
				.as("seven days from the sending, and not from the writing")
				.isEqualTo(SENT.plus(Duration.ofDays(7)));
		assertThat(letter.getValue().body())
				.contains("Link važi do " + WhatANoticeSays.moment(theRowEnds(account), MailLanguage.SERBIAN)
						+ " i može da se upotrebi jednom.")
				.doesNotContain("Link važi sedam dana");
	}
}
