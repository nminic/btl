package com.btl.portal.web;

import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.token.SecretToken;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;

/**
 * THE ROW BEHIND AN INVITATION OF A MEMBER THE ADMINISTRATION ENTERED, WRITTEN IN ONE PLACE.
 *
 * <p>The owner, 23.10.2026 (PDL „Poruka posle potvrde adrese i rok nedovršene registracije"): „Link
 * pozivnice člana kog je upisala administracija važi 7 dana, kao link za potvrdu (ranije 1 sat)".
 * The row is still a {@code password_reset_token}, because the invitation is the reset's road with
 * another occasion (ADL A53), and that column's default stays the hour of a forgotten password
 * (owner, 11.09.2026). So the invitation's seven days are written onto its row when it is minted,
 * and they are read from {@link Message#INVITED_AS_A_MEMBER}, which
 * {@code HowLongALinkLastsMatchesTheSchemaTest} ties to how long a confirmation lasts.
 *
 * <p><b>Three routes mint it, and all three come here</b>: entering members in a group
 * ({@code CompetitorWriteApi}), correcting the address of a member who has no password
 * ({@code MemberDataWriteApi}, PDL 23.10.2026), and the administration sending a new invitation from
 * the member's row ({@code MemberInvitationApi}, PDL 25.10.2026). Written more than once, they would be
 * places for the seven days to part, and the one left at an hour would be deleted while its link still
 * promised a week. {@code GroupEntryTest}, {@code AnInvitationLastsWhatItSaysTest} and
 * {@code MemberInvitationApiTest} measure the row each route writes.
 *
 * <p>The moderator's invitation is not this: it lasts the hour it always did, because the decision
 * is about a member.
 *
 * <p><b>THE LETTER SAYS THE MOMENT THE LINK ENDS, AND THE ROW ENDS THEN</b> (the owner, 20.11.2026, of
 * the letter that confirms an address: „Ispravi tekst da kaže tačan rok"; the invitation is the same
 * question, PENDING 20.11.2026). The entry the invitation belongs to is deleted by
 * {@link UnconfirmedAccountsAreSwept} fourteen days after it was written at the latest (PDL 24.10.2026,
 * „Granica od 14 dana važi i za pozivnicu"), so the link ends at the earlier of seven days from the
 * sending and fourteen from the writing, and {@link #mint} hands that one instant both to the row and
 * to the letter.
 *
 * <p><b>The fourteen days hold only for an account the sweep really deletes</b> (PDL 20.11.2026, „Rok
 * od 14 dana ... važe samo za nalog koji čistač stvarno briše"): one with no member number and no
 * payment, the two conditions {@link UnconfirmedAccountsAreSwept} asks. A member who has a number or a
 * payment is kept, and is sent a new invitation by the administration for exactly that reason
 * ({@code MemberInvitationApi}); his link is the full seven days from the sending, which a fourteenth
 * day already behind him must not shorten into a link that ended before it was sent. The sweep also
 * keeps an account that administers the portal; that is not asked here, because the entry of a member
 * is never one, and were it, the letter would name a moment earlier than the one the portal gives,
 * which is the safe side to be wrong on.
 *
 * <p>An account with no recorded moment of being written (it stood before V72) has no fourteenth day.
 */
final class AnInvitationOfAMember {

	private AnInvitationOfAMember() {
	}

	/**
	 * Which moment an invitation sent at {@code sentAt} to an account written at {@code writtenAt} ends.
	 *
	 * @param writtenAt        when the account was written, or {@code null} where nobody recorded it
	 * @param theSweepDeletesHim whether {@link UnconfirmedAccountsAreSwept} would delete him: no member
	 *                         number and no payment
	 */
	static Instant of(Instant sentAt, Instant writtenAt, boolean theSweepDeletesHim) {
		Instant sevenDaysOn = sentAt.plus(Message.INVITED_AS_A_MEMBER.lasts());

		if (!theSweepDeletesHim || writtenAt == null) {
			return sevenDaysOn;
		}

		Instant theFourteenthDay = writtenAt.plus(UnconfirmedAccountsAreSwept.AT_THE_LATEST);

		if (!theFourteenthDay.isAfter(sentAt)) {
			return sevenDaysOn;
		}

		return theFourteenthDay.isBefore(sevenDaysOn) ? theFourteenthDay : sevenDaysOn;
	}

	/**
	 * Writes the row the secret half of {@code invitation} opens, for {@code account}, ending at the
	 * moment {@link #of} gives, and returns that moment for the letter to say.
	 */
	static Instant mint(JdbcClient db, Clock clock, long account, SecretToken invitation) {
		Instant sentAt = clock.instant();
		record His(Timestamp writtenAt, boolean theSweepDeletesHim) {
		}

		His his = db.sql("select a.created_at, (c.id is not null and c.member_number is null"
						+ " and not exists (select 1 from payment p where p.competitor_id = c.id))"
						+ " from account a left join competitor c on c.id = a.competitor_id where a.id = ?")
				.param(account)
				.query((row, i) -> new His(row.getTimestamp(1), row.getBoolean(2)))
				.single();
		Instant endsAt = of(sentAt, his.writtenAt() == null ? null : his.writtenAt().toInstant(),
				his.theSweepDeletesHim());

		db.sql("insert into password_reset_token (account_id, token_hash, expires_at) values (?, ?, ?)")
				.params(account, invitation.hash(), Timestamp.from(endsAt))
				.update();

		return endsAt;
	}
}
