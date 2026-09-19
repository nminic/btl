package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * THE SUPERADMIN IS THE ACCOUNT THE SERVER'S SETTINGS NAME, over a real request and a
 * real database.
 *
 * <p><b>The owner, 14.09.2026, choosing between three offered outcomes</b> (PDL P21,
 * 14.09.2026, „Superadmin se ne pravi kroz portal"): „Superadmin se ne pravi kroz portal
 * nego se imenuje adresom u podesavanjima servera", and „Nalog sa tom adresom, kad je
 * adresa potvrdjena, nosi ulogu superadmina."
 *
 * <p><b>Every case here asks TWO questions of one request, and that is the whole reason
 * the class is shaped this way.</b> The role lives in two places that must not disagree:
 * {@link MeApi} tells the browser which screens to draw, and {@link WhatHeMayDo} decides
 * whether the routes behind them answer. A suite that only read {@code /api/me} would go
 * green on a portal that draws the owner an administration and then refuses him 404 at
 * every door in it - which is exactly what deriving the role in one of the two places
 * produces. {@code /api/moderators} is the door: it carries {@link OnlyTheSuperadmin},
 * which no tick can open.
 *
 * <p><b>The setting is a made up address and never the owner's own.</b> His lives in
 * {@code deploy/.env} and in no file this repository carries (PDL P21: „adresa stoji u
 * deploy/.env"), and nothing here needs it to be real - only that one address is named
 * and another is not.
 */
@SpringBootTest(properties = "btl.superadmin.email=Imenovani@Primer.rs ")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class SuperadminIsNamedByAnAddressTest {

	/**
	 * The address the settings name, as a ROW carries it: folded.
	 *
	 * <p>The setting above is deliberately spelled with capitals and a trailing space,
	 * which is what a person editing {@code deploy/.env} by hand actually produces. That
	 * the two are one address is the property {@code TheNamedSuperadminTest} measures
	 * directly; carrying the difference here as well means the whole path would fail if
	 * the fold were ever dropped between the setting and the row.
	 */
	private static final String NAMED = "imenovani@primer.rs";

	private static final String SOMEBODY_ELSE = "neimenovani@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@BeforeEach
	void twoAccountsAndNeitherOfThemIsAnythingSpecial() {
		/* BOTH ARE `competitor` IN THE ROW, which is the point rather than the fixture
		   being lazy: the role the owner holds is not written anywhere, so an account
		   that carried `superadmin` in its row would measure the old world and pass
		   whatever this code did. Registration writes `competitor` for him too, and
		   `theRowStillSaysCompetitor` holds that. */
		member(NAMED, "competitor");
		member(SOMEBODY_ELSE, "competitor");
	}

	private void member(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Probni', 'Probic', ?, (select id from role where code = ?))")
				.params(email, role).update();
	}

	/** Marks the address confirmed, which is the second half of the owner's sentence. */
	private void confirm(String email) {
		db.sql("update account set email_confirmed_at = ? where email = ?")
				.params(Timestamp.from(Instant.now()), email).update();
	}

	private SecretToken openFor(String email) {
		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at, expires_at)"
						+ " values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		return session;
	}

	private MockHttpServletResponse asking(String address, SecretToken carrying) throws Exception {
		return http.perform(get(address).cookie(new Cookie(SessionCookie.NAME, carrying.secret())))
				.andReturn().getResponse();
	}

	/**
	 * THE NAMED AND CONFIRMED ACCOUNT IS THE SUPERADMIN, on both halves of the answer.
	 *
	 * <p>The screen list and the door, measured on the same account in the same state. The
	 * second assertion is the one that cannot be satisfied by drawing anything: it goes
	 * through {@link WhatHeMayDo}, which reads what the role GRANTS, and
	 * {@code /api/moderators} is the one route no tick anywhere can open.
	 */
	@Test
	void theNamedAndConfirmedAccountIsTheSuperadmin() throws Exception {
		confirm(NAMED);

		SecretToken his = openFor(NAMED);

		assertThat(asking("/api/me", his).getContentAsString())
				.as("the portal did not call the named account the superadmin, so it would draw"
						+ " him no administration at all")
				.contains("\"role\":\"superadmin\"");

		assertThat(asking("/api/moderators", his).getStatus())
				.as("the portal called him the superadmin and then shut the one door only a"
						+ " superadmin opens, which is an administration drawn and not real")
				.isEqualTo(200);
	}

	/**
	 * AND AN UNCONFIRMED ADDRESS HOLDS NOTHING, which is the half of the sentence a
	 * reading of the address alone would drop.
	 *
	 * <p>„Nalog sa tom adresom, <b>kad je adresa potvrdjena</b>, nosi ulogu superadmina."
	 * Anybody may type anybody's address into the registration form, so without this half
	 * whoever registered with the owner's address first would hold every right there is
	 * without ever opening the mail - the one act that proves the address is his.
	 *
	 * <p>The refusal is 404 rather than 403 (ADL A8, 13.09.2026): somebody signed in who
	 * may not do a thing is told the address does not exist.
	 */
	@Test
	void theNamedAccountHoldsNothingUntilItsAddressIsConfirmed() throws Exception {
		SecretToken his = openFor(NAMED);

		assertThat(asking("/api/me", his).getContentAsString())
				.as("an account that merely CLAIMS the named address was called the superadmin,"
						+ " so registering with it is enough to take the portal")
				.contains("\"role\":\"competitor\"");

		assertThat(asking("/api/moderators", his).getStatus())
				.as("an unconfirmed account was let through the superadmin's own door")
				.isEqualTo(404);
	}

	/**
	 * AND A CONFIRMED ACCOUNT AT ANOTHER ADDRESS IS AN ORDINARY MEMBER.
	 *
	 * <p>Without this the two cases above are satisfied by a portal that makes EVERY
	 * confirmed account a superadmin, and both would read as green.
	 */
	@Test
	void aConfirmedAccountAtAnotherAddressIsNotTheSuperadmin() throws Exception {
		confirm(SOMEBODY_ELSE);

		SecretToken his = openFor(SOMEBODY_ELSE);

		assertThat(asking("/api/me", his).getContentAsString())
				.as("an account at an address the settings do not name was called the superadmin")
				.contains("\"role\":\"competitor\"");

		assertThat(asking("/api/moderators", his).getStatus())
				.as("an account the settings do not name was let through the superadmin's door")
				.isEqualTo(404);
	}

	/**
	 * AND NOTHING IS WRITTEN DOWN, which is what makes the rest of the decision true.
	 *
	 * <p>„posto uloga <b>ne stoji kao zapis koji se dodeljuje</b>, nego se izvodi iz
	 * podesavanja, superadmin ne moze da se obrise ni razvlasti kroz portal uopste" (PDL
	 * P21). Asking him every question above and then reading his row is the only way to
	 * tell a derived role from one that was quietly written on first sight: a portal that
	 * wrote {@code role_id} would pass every case above and fail this one.
	 *
	 * <p><b>Why it matters beyond tidiness.</b> Written down, the role would outlive the
	 * setting - change the address in {@code deploy/.env} and the old account would go on
	 * holding every right there is, with no screen anywhere able to take it away, because
	 * by this same decision no such screen exists.
	 */
	@Test
	void theRoleIsNeverWrittenIntoTheRow() throws Exception {
		confirm(NAMED);

		SecretToken his = openFor(NAMED);

		assertThat(asking("/api/me", his).getContentAsString()).contains("\"role\":\"superadmin\"");
		assertThat(asking("/api/moderators", his).getStatus()).isEqualTo(200);

		assertThat(db.sql("select r.code from account a join role r on r.id = a.role_id"
						+ " where a.email = ?")
				.param(NAMED).query(String.class).single())
				.as("the portal wrote the superadmin's role into his row, so it would survive the"
						+ " setting that granted it and nothing could then take it away")
				.isEqualTo("competitor");
	}
}
