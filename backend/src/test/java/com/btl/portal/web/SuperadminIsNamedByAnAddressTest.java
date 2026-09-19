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
 * <p><b>The setting below is made up, and not because the owner's own address is a
 * secret.</b> It is not one: an address is an identity, his stands in the author header
 * of every commit this public repository carries, and an address on its own opens
 * nothing. What opens everything is the password beside it - „superadminski nalog vidi
 * spisak prava svih administratora i sve licne podatke, pa ko dodje do te lozinke dolazi
 * do svega" (PDL P21, 14.09.2026). His real one belongs in {@code deploy/.env} because
 * that is where the decision put it („adresa stoji u deploy/.env"), and nothing here
 * needs it: what these cases need is that some addresses are named and another is not.
 *
 * <p><b>THE SETTING IS WRITTEN AS THE LINE AN OPERATOR ACTUALLY TYPES, and that is the
 * half no unit test can reach.</b> Two addresses, one comma, capitals and stray spaces
 * around both - so what is measured here is not only that this portal answers correctly
 * but that the property binder cuts that line into members at all. Cut by nobody, the
 * whole line matches no row and EVERY case below goes red, which is the shape the fault
 * of 20.09.2026 had: two addresses in the settings and no superadmin anywhere.
 */
@SpringBootTest(properties = "btl.superadmin.email=Imenovani@Primer.rs , Drugi@Primer.rs ")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class SuperadminIsNamedByAnAddressTest {

	/**
	 * The address the settings name, as a ROW carries it: folded.
	 *
	 * <p>Both members of the setting above are deliberately spelled with capitals, and
	 * with a stray space on either side of the comma, which is what a person editing
	 * {@code deploy/.env} by hand actually produces. That such a spelling and this row are
	 * one address is the property {@code TheNamedSuperadminTest} measures directly;
	 * carrying the difference here as well means the whole path would fail if the fold
	 * were ever dropped between the setting and the row.
	 */
	private static final String NAMED = "imenovani@primer.rs";

	/**
	 * The SECOND address the settings name, and the reason the case below is not a
	 * repetition of the first.
	 *
	 * <p>It exists only on the far side of a comma, so no reading that takes the setting
	 * as one address can ever produce it: it is the member the operator's line would lose.
	 */
	private static final String ALSO_NAMED = "drugi@primer.rs";

	private static final String SOMEBODY_ELSE = "neimenovani@primer.rs";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@BeforeEach
	void threeAccountsAndNoneOfThemIsAnythingSpecial() {
		/* ALL THREE ARE `competitor` IN THE ROW, which is the point rather than the
		   fixture being lazy: the role the owner holds is not written anywhere, so an
		   account that carried `superadmin` in its row would measure the old world and
		   pass whatever this code did. Registration writes `competitor` for him too, and
		   `theRoleIsNeverWrittenIntoTheRow` holds that. */
		member(NAMED, "competitor");
		member(ALSO_NAMED, "competitor");
		member(SOMEBODY_ELSE, "competitor");
	}

	private void member(String email, String role) {
		db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values ('Probni', 'Probic', ?, (select id from role where code = ?))")
				.params(email, role).update();
	}

	/**
	 * Which account a row is, so that an answer about a role can be pinned to the account
	 * it is about rather than to any account that happens to hold the same role.
	 */
	private long idOf(String email) {
		return db.sql("select id from account where email = ?")
				.param(email).query(Long.class).single();
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
	 * AND SO IS THE SECOND ADDRESS ON THE SAME LINE, which is the decision this setting
	 * carries out rather than a capability nobody asked for.
	 *
	 * <p>„Odluka od istog dana da superadminskih naloga <b>sme da bude vise</b> ostaje
	 * tacna i sprovodi se <b>brojem adresa u podesavanjima</b>, ne kucicama u portalu",
	 * and „danas je u podesavanjima jedna adresa. <b>Portal to ne ogranicava</b>, ali ni ne
	 * nudi ekran za dodavanje" (PDL P21, 14.09.2026). ADL says the same from the schema's
	 * side: {@code role_only_one_holds_every_right} fixes one ROLE holding every right,
	 * while „broj naloga sa tom ulogom nije njime ogranicen <b>i ne sme da bude</b>".
	 *
	 * <p><b>This is the case that measures the cutting, and no other one can.</b> The
	 * address it asks about is the one that exists only after a comma: a portal that took
	 * the whole setting as a single address would answer it {@code competitor} - and would
	 * answer the FIRST address that way too, which is exactly how the fault of 20.09.2026
	 * read from the outside. Both halves are asked, the screen list and the door, for the
	 * reason the class javadoc gives: a role drawn and a role granted must be one.
	 *
	 * <p><b>The answer is pinned to the account it is about, and that is not decoration.</b>
	 * „superadmin" would be answered by the FIRST named account just as readily, so a case
	 * that only read the role would be satisfied by a session opened for the wrong one and
	 * would measure the address it was written to measure - the second - not at all.
	 * Reading the account back off the same response is what separates the two.
	 */
	@Test
	void twoNamedAddressesAreTwoSuperadmins() throws Exception {
		confirm(ALSO_NAMED);

		SecretToken his = openFor(ALSO_NAMED);

		assertThat(asking("/api/me", his).getContentAsString())
				.as("a second address was named in the settings and the portal called that"
						+ " account an ordinary member, which limits in code a number the"
						+ " settings are meant to decide")
				.contains("\"role\":\"superadmin\"")
				.contains("\"account\":" + idOf(ALSO_NAMED));

		assertThat(asking("/api/moderators", his).getStatus())
				.as("the portal called the second named account a superadmin and then shut the"
						+ " one door only a superadmin opens")
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
