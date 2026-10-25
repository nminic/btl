package com.btl.portal.web;

import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.token.SecretToken;
import org.springframework.jdbc.core.simple.JdbcClient;

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
 */
final class AnInvitationOfAMember {

	private AnInvitationOfAMember() {
	}

	/** Writes the row the secret half of {@code invitation} opens, for {@code account}. */
	static void mint(JdbcClient db, long account, SecretToken invitation) {
		db.sql("insert into password_reset_token (account_id, token_hash, expires_at)"
						+ " values (?, ?, now() + make_interval(secs => ?))")
				.params(account, invitation.hash(), Message.INVITED_AS_A_MEMBER.lasts().toSeconds())
				.update();
	}
}
