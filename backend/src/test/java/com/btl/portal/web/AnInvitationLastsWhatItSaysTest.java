package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.token.SecretToken;
import com.btl.portal.mail.Postman;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * THE INVITATION A CORRECTED ADDRESS IS SENT LASTS THE SEVEN DAYS ITS LETTER PROMISES.
 *
 * <p>The owner chose on 23.10.2026, with my recommendation, that the invitation of a member the
 * administration entered lasts seven days, as long as the confirmation link, where it was one hour. Two routes mint that invitation: entering members in a group, measured
 * in {@code GroupEntryTest}, and correcting the address of a member who has no password (PDL
 * 23.10.2026), measured here. A class of its own and not a case in {@code MemberDataWriteApiTest},
 * because that file is being changed on another branch at the same time.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class AnInvitationLastsWhatItSaysTest {

	private static final String OVER_THE_MEMBERS = "pozivnica-moderator@primer.rs";

	private static final String HE_HAS_NONE = "pozivnica-bez-lozinke@primer.rs";

	private static final String A_TOWN_IN_SERBIA =
			"(select id from place where country_id = (select id from country where code = 'RS')"
					+ " order by rank limit 1)";

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@MockitoSpyBean
	private Postman postman;

	private String session;

	@BeforeEach
	void aModeratorOverTheMembersAndAMemberWithNoPassword() {
		doNothing().when(postman).send(any(Said.class), anyString());

		db.sql("insert into account (first_name, last_name, email, role_id, email_confirmed_at,"
						+ " password_hash) values ('Mira', 'Clanovic', ?, (select id from role where code ="
						+ " 'moderator'), now(), '{bcrypt}$2a$10$abcdefghijklmnopqrstuv')")
				.param(OVER_THE_MEMBERS).update();
		db.sql("insert into account_admin_right (account_id, right_code)"
						+ " values ((select id from account where email = ?), 'entity:members')")
				.param(OVER_THE_MEMBERS).update();

		SecretToken cookie = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at, expires_at)"
						+ " values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(OVER_THE_MEMBERS, cookie.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();
		session = cookie.secret();

		long member = db.sql("insert into competitor (member_number, first_name, last_name, gender,"
						+ " birth_date, place_id, first_season, active,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values ('000071', 'Bez', 'Lozinke', 'F', date '1993-09-09', " + A_TOWN_IN_SERBIA
						+ ", 2027, true, '0011aabbccdd7171', '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00') returning id")
				.query(Long.class).single();

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values ('Bez', 'Lozinke', ?, (select id from role where code = 'competitor'), ?)")
				.params(HE_HAS_NONE, member).update();
	}

	@Test
	void theInvitationSentToACorrectedAddressLastsSevenDays() throws Exception {
		assertThat(http.perform(put("/api/members/000071/data").with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content("{\"email\": \"ispravljena-pozivnica@primer.rs\"}")
								.cookie(new Cookie(SessionCookie.NAME, session)))
						.andReturn().getResponse().getStatus())
				.isEqualTo(200);

		assertThat(db.sql("select extract(epoch from (expires_at - created_at))::bigint"
						+ " from password_reset_token where account_id ="
						+ " (select id from account where email = 'ispravljena-pozivnica@primer.rs')")
				.query(Long.class).single())
				.isEqualTo(Message.INVITED_AS_A_MEMBER.lasts().toSeconds())
				.isEqualTo(Duration.ofDays(7).toSeconds());

		assertThat(db.sql("select count(*) from email_verification_token where account_id ="
						+ " (select id from account where email = 'ispravljena-pozivnica@primer.rs')")
				.query(Long.class).single())
				.as("the invitation went down the confirmation's road")
				.isZero();
	}
}
