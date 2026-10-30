package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.mail.WhatTheMessageSays;
import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.mail.WhatTheMessageSays.Portal;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.token.SecretToken;
import com.btl.portal.mail.Postman;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.MailSendException;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * {@code POST /api/members/{memberNumber}/invitation}: the administration sends a new invitation
 * (owner, 23.10.2026 and 25.10.2026; see {@link MemberInvitationApi}).
 *
 * <p><b>THE POSTAVKA KEEPS EVERY SOURCE OF A VALUE APART FROM EVERY OTHER</b> ({@code CLAUDE.md}, „Dva
 * izvora, jedna vrednost"):
 * <ul>
 * <li>the member invited (000005) is never the first row: 000002 is first and ALSO has an account with
 * no password, so „the first account with none" is a different man, and his links must survive;</li>
 * <li>the password and the confirmed address are two facts: 000007 registered himself, so he has a
 * password and an address not confirmed, and he is refused;</li>
 * <li>the one asking has an address and a member of his own (the moderator is 000003, with a password),
 * so a letter sent to the asker, or a link written for the asker's account, is a different row;</li>
 * <li>and the member invited holds links of all three kinds before, so „all of them go" is a claim with
 * something to be wrong about.</li>
 * </ul>
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class MemberInvitationApiTest {

	private static final String THE_SUPERADMIN = "superadmin-pozivnica@primer.rs";

	private static final String OVER_THE_MEMBERS = "moderator-clanovi-pozivnica@primer.rs";

	private static final String OVER_THE_PAYMENTS_ONLY = "moderator-uplate-pozivnica@primer.rs";

	private static final String A_MEMBER = "clan-pozivnica@primer.rs";

	/** 000002, the first row, entered and never taken over, like the one invited. */
	private static final String THE_FIRST_WITH_NONE = "prvi-bez-lozinke@primer.rs";

	/** 000005, the one every invitation below is for. */
	private static final String HIS_ADDRESS = "pozvani@primer.rs";

	/** 000007, who registered himself: a password, and an address not confirmed. */
	private static final String REGISTERED_HIMSELF = "sam-se-registrovao@primer.rs";

	private static final String A_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	private static final String A_PASSWORD = "{bcrypt}$2a$10$notarealhashnotarealhashnotarealhashnotarealhashnotarea";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Value("${btl.portal.address}")
	private String portalAddress;

	@MockitoSpyBean
	private Postman postman;

	private final Map<String, String> cookies = new HashMap<>();

	private long first;

	private long invited;

	@BeforeEach
	void membersAndTheAdministration() {
		doNothing().when(postman).send(any(Said.class), anyString());

		first = competitor("000002", "b1", "Prvi");
		long theModeratorHimself = competitor("000003", "b2", "Moderator");
		invited = competitor("000005", "b3", "Pozvani");
		long registered = competitor("000007", "b4", "Sam");
		competitor("000009", "b5", "Bez naloga");
		long withNoNumber = competitor(null, "b6", "Bez broja");

		account(THE_SUPERADMIN, "superadmin", null, true);
		account(OVER_THE_MEMBERS, "moderator", theModeratorHimself, true);
		ticked(OVER_THE_MEMBERS, "entity:members");
		account(OVER_THE_PAYMENTS_ONLY, "moderator", null, true);
		ticked(OVER_THE_PAYMENTS_ONLY, "queue:payments");
		account(A_MEMBER, "competitor", null, true);
		account(THE_FIRST_WITH_NONE, "competitor", first, false);
		account(HIS_ADDRESS, "competitor", invited, false);
		account(REGISTERED_HIMSELF, "competitor", registered, true);
		account("bez-broja@primer.rs", "competitor", withNoNumber, false);

		/* LINKS OF EVERY KIND, TO THE ONE INVITED AND TO THE FIRST: an invitation of seven days, a
		   forgotten password of an hour, and a link to confirm. */
		for (String email : List.of(HIS_ADDRESS, THE_FIRST_WITH_NONE)) {
			db.sql("insert into password_reset_token (account_id, token_hash, expires_at)"
							+ " values ((select id from account where email = ?), ?, now() + interval '6 days')")
					.params(email, SecretToken.fresh().hash()).update();
			db.sql("insert into password_reset_token (account_id, token_hash)"
							+ " values ((select id from account where email = ?), ?)")
					.params(email, SecretToken.fresh().hash()).update();
			db.sql("insert into email_verification_token (account_id, token_hash)"
							+ " values ((select id from account where email = ?), ?)")
					.params(email, SecretToken.fresh().hash()).update();
		}
	}

	private long competitor(String number, String suffix, String name) {
		return db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, active, referral_code, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, 'Clan', 'M', date '1990-05-15', " + A_TOWN_IN_SERBIA + ", 2027,"
						+ " true, ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.params(number, name, "0011aabbccddee" + suffix)
				.query(Long.class).single();
	}

	private void account(String email, String role, Long competitor, boolean withAPassword) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id, password_hash)"
						+ " values ('Ime', 'Prezime', ?, (select id from role where code = ?), ?, ?)")
				.params(email, role, competitor, withAPassword ? A_PASSWORD : null)
				.update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		cookies.put(email, session.secret());
	}

	private void ticked(String email, String right) {
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), ?)")
				.params(email, right).update();
	}

	private MockHttpServletResponse invite(String number, String email) throws Exception {
		var asks = post("/api/members/" + number + "/invitation").with(csrf());

		return http.perform(email == null ? asks : asks.cookie(new Cookie(SessionCookie.NAME, cookies.get(email))))
				.andReturn().getResponse();
	}

	private long linksOf(String table, long competitor) {
		return db.sql("select count(*) from " + table + " t join account a on a.id = t.account_id"
				+ " where a.competitor_id = ?").param(competitor).query(Long.class).single();
	}

	@Test
	void aVisitorIsAskedToSignIn() throws Exception {
		assertThat(invite("000005", null).getStatus()).isEqualTo(401);
		verifyNoInteractions(postman);
	}

	@Test
	void anybodySignedInWithoutTheRightOverTheMembersIsToldThereIsNothingHere() throws Exception {
		/* ADL A8: 404. The moderator over the payments holds a right, just not this one. */
		for (String refused : List.of(A_MEMBER, OVER_THE_PAYMENTS_ONLY)) {
			assertThat(invite("000005", refused).getStatus()).as(refused).isEqualTo(404);
		}

		verifyNoInteractions(postman);
		assertThat(linksOf("password_reset_token", invited)).isEqualTo(2);
	}

	@Test
	void theInvitationGoesToHimWithTheOnlyLinkHeHasAndItLastsSevenDays() throws Exception {
		for (String asking : List.of(THE_SUPERADMIN, OVER_THE_MEMBERS)) {
			MockHttpServletResponse answer = invite("000005", asking);

			assertThat(answer.getStatus()).as(asking).isEqualTo(200);
			/* The address it went to, which the screen's sentence names, and it is his own. */
			assertThat(answer.getContentAsString(StandardCharsets.UTF_8))
					.isEqualTo("{\"email\":\"" + HIS_ADDRESS + "\"}");
		}

		ArgumentCaptor<Said> letter = ArgumentCaptor.forClass(Said.class);
		ArgumentCaptor<String> to = ArgumentCaptor.forClass(String.class);

		verify(postman, times(2)).send(letter.capture(), to.capture());
		assertThat(to.getAllValues()).containsExactly(HIS_ADDRESS, HIS_ADDRESS);

		/* THE INVITATION AS IT STANDS, its words unchanged (owner, 25.10.2026). */
		Said asItStands = WhatTheMessageSays.about(Message.INVITED_AS_A_MEMBER, new Portal(portalAddress), "SECRET");
		Said sent = letter.getAllValues().get(1);

		assertThat(sent.subject()).isEqualTo(asItStands.subject());

		Matcher token = Pattern.compile("nova-lozinka\\?token=([A-Za-z0-9_-]+)").matcher(sent.body());

		assertThat(token.find()).as(sent.body()).isTrue();
		assertThat(sent.body().replace(token.group(1), "SECRET")).isEqualTo(asItStands.body());

		/* THE LINK IS HIS ACCOUNT'S, it is the only link of any kind he has, and the second press took
		   the first press's link with it: „Prethodni link više ne važi". */
		assertThat(db.sql("select a.competitor_id from password_reset_token t join account a on a.id = t.account_id"
						+ " where t.token_hash = ?").param(SecretToken.hashOf(token.group(1)))
				.query(Long.class).single()).isEqualTo(invited);
		assertThat(linksOf("password_reset_token", invited)).isOne();
		assertThat(linksOf("email_verification_token", invited)).isZero();

		/* SEVEN DAYS, the invitation's, and not the hour of the column's default. */
		assertThat(db.sql("select extract(epoch from (t.expires_at - t.created_at))::bigint"
						+ " from password_reset_token t join account a on a.id = t.account_id where a.competitor_id = ?")
				.param(invited).query(Long.class).single())
				.isEqualTo(Message.INVITED_AS_A_MEMBER.lasts().toSeconds())
				.isEqualTo(Duration.ofDays(7).toSeconds());

		/* The first member's links are his and stand. */
		assertThat(linksOf("password_reset_token", first)).isEqualTo(2);
		assertThat(linksOf("email_verification_token", first)).isOne();
	}

	@Test
	void aMemberWhoHasAPasswordIsRefusedEvenWithHisAddressNotConfirmed() throws Exception {
		/* 000007 registered himself, so the password and the confirmed address part here; and the
		   moderator's own row, 000003, which has a password because he is signed in. */
		for (String number : List.of("000007", "000003")) {
			MockHttpServletResponse answer = invite(number, OVER_THE_MEMBERS);

			assertThat(answer.getStatus()).as(number).isEqualTo(409);
			assertThat(answer.getContentAsString(StandardCharsets.UTF_8))
					.isEqualTo("{\"reason\":\"" + MemberInvitationApi.THE_PASSWORD_IS_SET + "\"}");
		}

		verifyNoInteractions(postman);
	}

	@Test
	void aMemberWithNoAccountIsRefusedAndANumberNobodyHasIsNotThere() throws Exception {
		MockHttpServletResponse noAccount = invite("000009", OVER_THE_MEMBERS);

		assertThat(noAccount.getStatus()).isEqualTo(409);
		assertThat(noAccount.getContentAsString(StandardCharsets.UTF_8))
				.isEqualTo("{\"reason\":\"" + MemberInvitationApi.THERE_IS_NO_ACCOUNT + "\"}");
		assertThat(invite("000099", OVER_THE_MEMBERS).getStatus()).isEqualTo(404);

		verifyNoInteractions(postman);
	}

	@Test
	void aLetterTheRelayDoesNotTakeIsSaidToTheScreen() throws Exception {
		doThrow(new MailSendException("the relay is not there")).when(postman).send(any(Said.class), anyString());

		MockHttpServletResponse answer = invite("000005", OVER_THE_MEMBERS);

		assertThat(answer.getStatus()).isEqualTo(503);
		assertThat(answer.getContentAsString(StandardCharsets.UTF_8))
				.isEqualTo("{\"reason\":\"" + MemberInvitationApi.THE_POST_DID_NOT_TAKE_IT + "\"}");
	}
}
