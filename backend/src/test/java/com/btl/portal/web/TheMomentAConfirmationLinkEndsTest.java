package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.mail.Postman;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * THE LETTER THAT CONFIRMS AN ADDRESS SAYS THE MOMENT ITS LINK ENDS, AND THE LINK'S ROW ENDS THEN.
 *
 * <p>The owner, 20.11.2026: „Ispravi tekst da kaže tačan rok". The letter said „Link važi sedam dana"
 * on every day; the owner decided on 24.10.2026 (PDL „Rok nepotvrđene prijave") that „nova poruka za potvrdu
 * daje novih 7 dana, ali se prijava svakako briše najkasnije 14 dana posle registracije". So a link asked for
 * on the tenth day ends on the fourteenth. {@code UnconfirmedAccountsAreSwept} deletes it then.
 *
 * <p><b>Asked through the route a member presses, {@code POST /api/email-confirmation/resend}</b>, the one
 * place a link can be asked for on any day of the account's life. The other two routes that mint it
 * ({@code RegistrationApi} and {@code MemberDataWriteApi}) make the same call and are measured in their own
 * tests; {@link #noRouteWritesTheLinkWithoutAskingTheOneThatKnowsWhenItEnds} is what keeps a fourth
 * from being written the old way.
 *
 * <p><b>THE DAY OF THE REGISTRATION AND THE DAY OF THE SENDING ARE DIFFERENT IN EVERY CASE</b> (three or
 * nine days apart), so a letter that reads one for the other says something else. And each case holds the
 * letter against the row it ends, so a row written by the column's default (seven days from the
 * transaction's own start, which is today and not a day in December 2026) fails every one.
 *
 * <p>The cases name their axes: the account younger than the week or older (so „seven days from the
 * sending" or „fourteen from the registration" is the earlier), the sending near midnight in UTC (when
 * the Belgrade day is the next), the language of the letter, an account with no recorded day of being
 * written, and an account already past its fourteenth day that the sweep keeps.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class TheMomentAConfirmationLinkEndsTest {

	/** One case: when the account was written, when the link is asked for, and what both say. */
	record Case(String name, String language, Instant registered, Instant sent, Instant ends, String said) {

		@Override
		public String toString() {
			return name + " / " + language;
		}
	}

	private static final Instant THREE_DAYS_BEFORE_THE_SENDING = Instant.parse("2026-12-07T12:00:00Z");

	/** What the movable clock reads, and what a link asked for is sent at. */
	static class TheClockTheCasesMove extends Clock {

		private volatile Instant now = Instant.parse("2026-12-10T12:00:00Z");

		void moveTo(Instant when) {
			this.now = when;
		}

		@Override
		public Instant instant() {
			return now;
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return Clock.fixed(now, zone);
		}
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisFileUses {

		@Bean
		@Primary
		TheClockTheCasesMove theClockTheCasesMove() {
			return new TheClockTheCasesMove();
		}
	}

	/**
	 * Every case in both languages. The moments are written out by hand, in Belgrade's winter time (one
	 * hour ahead of UTC), and never worked out from the rule they test.
	 */
	static Stream<Case> theCases() {
		return Stream.of(
				new Case("younger than a week: seven days from the sending", "sr",
						THREE_DAYS_BEFORE_THE_SENDING, Instant.parse("2026-12-10T12:00:00Z"),
						Instant.parse("2026-12-17T12:00:00Z"), "do 17.12.2026. 13:00. Posle toga"),
				new Case("younger than a week: seven days from the sending", "en",
						THREE_DAYS_BEFORE_THE_SENDING, Instant.parse("2026-12-10T12:00:00Z"),
						Instant.parse("2026-12-17T12:00:00Z"), "until 17 December 2026 at 13:00. After that"),
				new Case("older than a week: fourteen days from the registration", "sr",
						Instant.parse("2026-12-01T12:00:00Z"), Instant.parse("2026-12-10T12:00:00Z"),
						Instant.parse("2026-12-15T12:00:00Z"), "do 15.12.2026. 13:00. Posle toga"),
				new Case("older than a week: fourteen days from the registration", "en",
						Instant.parse("2026-12-01T12:00:00Z"), Instant.parse("2026-12-10T12:00:00Z"),
						Instant.parse("2026-12-15T12:00:00Z"), "until 15 December 2026 at 13:00. After that"),
				new Case("sent at half past eleven at night in UTC, younger", "sr",
						THREE_DAYS_BEFORE_THE_SENDING, Instant.parse("2026-12-10T23:30:00Z"),
						Instant.parse("2026-12-17T23:30:00Z"), "do 18.12.2026. 00:30. Posle toga"),
				new Case("sent at half past eleven at night in UTC, younger", "en",
						THREE_DAYS_BEFORE_THE_SENDING, Instant.parse("2026-12-10T23:30:00Z"),
						Instant.parse("2026-12-17T23:30:00Z"), "until 18 December 2026 at 00:30. After that"),
				new Case("sent at half past eleven at night in UTC, older", "sr",
						Instant.parse("2026-12-01T23:30:00Z"), Instant.parse("2026-12-10T23:30:00Z"),
						Instant.parse("2026-12-15T23:30:00Z"), "do 16.12.2026. 00:30. Posle toga"),
				new Case("sent at half past eleven at night in UTC, older", "en",
						Instant.parse("2026-12-01T23:30:00Z"), Instant.parse("2026-12-10T23:30:00Z"),
						Instant.parse("2026-12-15T23:30:00Z"), "until 16 December 2026 at 00:30. After that"),
				new Case("no recorded day of being written: seven days from the sending", "sr",
						null, Instant.parse("2026-12-10T12:00:00Z"),
						Instant.parse("2026-12-17T12:00:00Z"), "do 17.12.2026. 13:00. Posle toga"),
				new Case("no recorded day of being written: seven days from the sending", "en",
						null, Instant.parse("2026-12-10T12:00:00Z"),
						Instant.parse("2026-12-17T12:00:00Z"), "until 17 December 2026 at 13:00. After that"),
				/* PAST ITS FOURTEENTH DAY, AN ACCOUNT WITH NO NUMBER AND NO PAYMENT (the only kind this fixture
				   writes: the sweep deletes it, the row is just still here): a link that ended before it was
				   sent could never confirm it, so it is seven days from the sending. An account the sweep
				   keeps is not set up here. */
				new Case("past its fourteenth day, an account with no number and no payment: seven days from the sending", "sr",
						Instant.parse("2026-11-20T12:00:00Z"), Instant.parse("2026-12-10T12:00:00Z"),
						Instant.parse("2026-12-17T12:00:00Z"), "do 17.12.2026. 13:00. Posle toga"),
				new Case("past its fourteenth day, an account with no number and no payment: seven days from the sending", "en",
						Instant.parse("2026-11-20T12:00:00Z"), Instant.parse("2026-12-10T12:00:00Z"),
						Instant.parse("2026-12-17T12:00:00Z"), "until 17 December 2026 at 13:00. After that"));
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private TheClockTheCasesMove clock;

	@MockitoBean
	private Postman postman;

	@ParameterizedTest(name = "{0}")
	@MethodSource("theCases")
	void aLinkAskedForAgainEndsWhenTheRegistrationWouldAndTheLetterSaysSo(Case theCase) throws Exception {
		String address = "rok-" + System.nanoTime() + "@primer.rs";
		long account = db.sql("insert into account (first_name, last_name, email, role_id, mail_language)"
						+ " values ('Probni', 'Probic', ?, (select id from role where code = 'competitor'), ?)"
						+ " returning id")
				.params(address, theCase.language()).query(Long.class).single();

		db.sql("update account set created_at = cast(? as timestamptz) where id = ?")
				.params(theCase.registered() == null ? null : Timestamp.from(theCase.registered()), account)
				.update();
		clock.moveTo(theCase.sent());

		assertThat(http.perform(post("/api/email-confirmation/resend").with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{\"email\":\"" + address + "\"}"))
				.andReturn().getResponse().getStatus()).isEqualTo(204);

		ArgumentCaptor<Said> letter = ArgumentCaptor.forClass(Said.class);

		verify(postman, times(1)).send(letter.capture(), anyString());
		assertThat(letter.getValue().body())
				.as("the letter named another moment than the one the link ends")
				.contains((theCase.language().equals("sr") ? "Link važi " : "The link is valid ") + theCase.said());
		assertThat(db.sql("select expires_at from email_verification_token where account_id = ?")
				.param(account).query(Timestamp.class).single().toInstant())
				.as("the row ends another moment than the letter says")
				.isEqualTo(theCase.ends());
	}

	/**
	 * NO ROUTE WRITES A LINK TO CONFIRM AN ADDRESS BY ITSELF.
	 *
	 * <p>The moment a link ends is worked out in {@link TheMomentAConfirmationLinkEnds} and nowhere else,
	 * and the question „who writes {@code email_verification_token}" is answered by the files under
	 * {@code src/main/java}, not by a list: a fourth route that writes the row with the column's default
	 * would mail „sedam dana" again from a path no case above passes through. Measured by putting the
	 * old statement back into {@code RegistrationApi}, which this fails on.
	 */
	@Test
	void noRouteWritesTheLinkWithoutAskingTheOneThatKnowsWhenItEnds() throws IOException {
		Path theSources = Path.of("src", "main", "java");

		try (Stream<Path> files = Files.walk(theSources)) {
			List<String> writers = files.filter(file -> file.toString().endsWith(".java"))
					.filter(file -> {
						try {
							return Files.readString(file).contains("insert into email_verification_token");
						} catch (IOException unreadable) {
							throw new IllegalStateException(unreadable);
						}
					})
					.map(file -> file.getFileName().toString())
					.sorted()
					.collect(Collectors.toList());

			assertThat(writers).containsExactly("TheMomentAConfirmationLinkEnds.java");
		}
	}
}
