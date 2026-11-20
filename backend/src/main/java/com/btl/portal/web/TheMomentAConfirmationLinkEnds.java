package com.btl.portal.web;

import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.token.SecretToken;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;

/**
 * THE MOMENT A LINK TO CONFIRM AN ADDRESS STOPS WORKING, WORKED OUT AND WRITTEN IN ONE PLACE, AND THE
 * SAME MOMENT IS WHAT THE LETTER SAYS.
 *
 * <p>The owner, 23.10.2026 (PDL „Poruka posle potvrde adrese i rok nedovršene registracije"): „Link za
 * potvrdu adrese važi 7 dana … a prijava koja za to vreme nije potvrđena briše se sama". And 24.10.2026
 * („Rok nepotvrđene prijave"): „nova poruka za potvrdu daje novih 7 dana, ali se prijava svakako briše
 * najkasnije 14 dana posle registracije". So a link asked for on the tenth day does not live for seven
 * days: the registration it belongs to is deleted on the fourteenth, and
 * {@link UnconfirmedAccountsAreSwept} deletes it with the link. The letter used to say „Link važi sedam
 * dana" whatever the day, which was true of the first letter and untrue of every later one.
 *
 * <p><b>THE LINK ENDS AT THE EARLIER OF TWO MOMENTS:</b> seven days from the moment it is sent
 * ({@link Message#CONFIRM_THE_ADDRESS}, whose {@code lasts} the schema is asked to agree with), and
 * fourteen days from the moment the account was written ({@link UnconfirmedAccountsAreSwept#AT_THE_LATEST}).
 * The moment is written onto the row ({@code expires_at}) and handed back to the caller, which gives the
 * same instant to the letter, so the portal and the letter cannot say two things.
 *
 * <p><b>An account with no recorded moment of being written</b> (it stood before V72, whose
 * {@code created_at} is empty for such accounts and not guessed) has no fourteenth day, and its link
 * is seven days from the sending, as before.
 *
 * <p><b>A fourteenth day that has already passed does not shorten the link to nothing.</b> The sweep
 * deletes only a member with no number and no payment; an account the sweep keeps, which stands
 * unconfirmed past its fourteenth day, would be mailed a link that ended before it was sent and could
 * never confirm. For it the seven days from the sending stand. An account the sweep does delete is
 * gone within the hour whatever any link says.
 *
 * <p>Three routes mint this link and all three come here ({@code RegistrationApi},
 * {@code EmailConfirmationApi.resend}, and the administration correcting an address in
 * {@code MemberDataWriteApi}), so that the rule is not written three times and the one left at the old
 * length is not the one a member is mailed.
 */
final class TheMomentAConfirmationLinkEnds {

	private TheMomentAConfirmationLinkEnds() {
	}

	/**
	 * Which moment a link sent at {@code sentAt} to an account written at {@code registeredAt} ends.
	 *
	 * @param registeredAt when the account was written, or {@code null} where nobody recorded it
	 */
	static Instant of(Instant sentAt, Instant registeredAt) {
		Instant sevenDaysOn = sentAt.plus(Message.CONFIRM_THE_ADDRESS.lasts());

		if (registeredAt == null) {
			return sevenDaysOn;
		}

		Instant theFourteenthDay = registeredAt.plus(UnconfirmedAccountsAreSwept.AT_THE_LATEST);

		if (!theFourteenthDay.isAfter(sentAt)) {
			return sevenDaysOn;
		}

		return theFourteenthDay.isBefore(sevenDaysOn) ? theFourteenthDay : sevenDaysOn;
	}

	/**
	 * Writes the row the secret half of {@code link} opens, for {@code account}, ending at the moment
	 * {@link #of} gives, and returns that moment for the letter to say.
	 */
	static Instant write(JdbcClient db, Clock clock, long account, SecretToken link) {
		Instant sentAt = clock.instant();
		Timestamp registered = db.sql("select created_at from account where id = ?")
				.param(account).query((row, i) -> row.getTimestamp(1)).list().getFirst();
		Instant endsAt = of(sentAt, registered == null ? null : registered.toInstant());

		db.sql("insert into email_verification_token (account_id, token_hash, expires_at) values (?, ?, ?)")
				.params(account, link.hash(), Timestamp.from(endsAt)).update();

		return endsAt;
	}
}
