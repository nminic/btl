package com.btl.portal.web;

import com.btl.portal.domain.mail.WhatTheMessageSays;
import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.mail.WhatTheMessageSays.Portal;
import com.btl.portal.domain.token.SecretToken;
import com.btl.portal.mail.Postman;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.MailException;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

/**
 * {@code POST /api/members/{memberNumber}/invitation}: THE ADMINISTRATION SENDS A NEW INVITATION.
 *
 * <p>The owner, 23.10.2026 (PDL „Poruka posle potvrde adrese i rok nedovršene registracije"): a member
 * the administration entered who sets no password in seven days is deleted, „Izuzetak: član koji već
 * ima evidentiranu uplatu ili članski broj se ne briše (broj se nikad ne dodeljuje ponovo);
 * administracija mu šalje novu pozivnicu." The invitation he was sent says the same to him: „tada nam se
 * javite na info@balkanskatrkackaliga.net i poslaćemo vam novi." This is that sending. The owner's
 * answers of 25.10.2026 (PDL „Nova pozivnica od administracije i rečenica o trkama: odgovori od
 * 25.10.2026") settle the rest, and each is a line below:
 * <ul>
 * <li><b>Who: a member with a number whose account has no password</b> (derived that day from the
 * decision of 23.10.2026: every recorded payment draws a number, {@code BookingAPayment#recordIt}, so
 * „uplata ili broj" is the members with a number). The route is addressed by the number, so a member
 * without one is answered 404 like an address nobody has. An account WITH a password is refused
 * {@link #THE_PASSWORD_IS_SET}, which is what the row's envelope says when it is switched off, and a
 * member with no account is refused {@link #THERE_IS_NO_ACCOUNT}: there is no address to send to;</li>
 * <li><b>The letter is the invitation as it stands</b>, {@link Message#INVITED_AS_A_MEMBER}, its words
 * unchanged, and its row is written by {@link AnInvitationOfAMember}, so it lasts the invitation's
 * seven days and not the hour of a forgotten password;</li>
 * <li><b>„Nova pozivnica poništava sve ranije veze tog naloga (pozivnice i obnove lozinke), kao
 * ispravka adrese."</b> Both kinds of link are deleted before the new one is written, the order
 * {@code MemberDataWriteApi.write} keeps, and so are the links to confirm the address, which that
 * correction deletes too: an account with no password is confirmed by spending the invitation, so a
 * link to confirm would be a second road in that this one leaves standing;</li>
 * <li><b>When the relay does not take the letter the screen says so</b> („Pošta trenutno ne prima
 * poruke, pa pozivnica nije poslata."), so this answers 503 rather than the 200 every other letter of
 * the portal answers after a relay's refusal. What is committed stays: the earlier links are gone and
 * the new one is written but reached by nobody, and pressing again writes another. That is the price of
 * sending after the commit, and the commit comes first for the reason {@code EmailConfirmationApi.resend}
 * gives: a letter sent from inside the transaction would carry a link a rollback could take back.</li>
 * </ul>
 *
 * <p><b>Who may</b> is the administration over the members ({@link CompetitorApi#OVER_THE_MEMBERS}),
 * the right of every other write on the member's row: a visitor is answered 401 by the chain, anybody
 * signed in without the right 404 by {@link RightIsNeeded} (ADL A8). A moderator asking about his own
 * row needs no rule of its own: he is signed in, so his account has a password, and he is refused
 * {@link #THE_PASSWORD_IS_SET} like anybody else's.
 *
 * <p><b>Two presses at once</b> are put in a line by the hold on the account, taken first, as every route
 * that touches an account and its links takes it: the second waits, then deletes the link the first one
 * wrote and writes its own. Two letters go, and only the second link works, which is what „Prethodni
 * link više ne važi" says.
 */
@RestController
class MemberInvitationApi {

	private static final Logger LOG = LoggerFactory.getLogger(MemberInvitationApi.class);

	/** His account has a password, so he needs no invitation: he signs in, or asks for a new password. */
	static final String THE_PASSWORD_IS_SET = "thePasswordIsSet";

	/** He has no account, so there is no address an invitation could go to. */
	static final String THERE_IS_NO_ACCOUNT = "thereIsNoAccount";

	/** The relay did not take the letter. */
	static final String THE_POST_DID_NOT_TAKE_IT = "thePostDidNotTakeIt";

	private final JdbcClient db;

	private final TransactionTemplate inOneTransaction;

	private final Postman postman;

	private final Portal portal;

	MemberInvitationApi(JdbcClient db, TransactionTemplate inOneTransaction, Postman postman,
			@Value("${btl.portal.address}") String portalAddress) {
		this.db = db;
		this.inOneTransaction = inOneTransaction;
		this.postman = postman;
		this.portal = new Portal(portalAddress);
	}

	/** What the screen is answered with: the address the letter went to, which its sentence names. */
	record Sent(String email) {
	}

	/** What the transaction decided: a refusal, or the letter to send once it has committed. */
	private record Decided(ResponseEntity<?> refused, String address, String link) {
	}

	@PostMapping("/api/members/{memberNumber}/invitation")
	@RightIsNeeded(CompetitorApi.OVER_THE_MEMBERS)
	ResponseEntity<?> send(@PathVariable String memberNumber) {
		Decided decided = inOneTransaction.execute(committing -> decide(memberNumber));

		if (decided.refused() != null) {
			return decided.refused();
		}

		try {
			postman.send(WhatTheMessageSays.about(Message.INVITED_AS_A_MEMBER, portal, decided.link()),
					decided.address());
		} catch (MailException theRelayDidNotTakeIt) {
			/* An account and never an address in the log: an address is a personal datum (ADL A12). */
			LOG.warn("a new invitation to member {} did not go out; pressing again writes another",
					memberNumber, theRelayDidNotTakeIt);

			return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
					.body(new MeWriteApi.Refused(THE_POST_DID_NOT_TAKE_IT));
		}

		return ResponseEntity.ok(new Sent(decided.address()));
	}

	private Decided decide(String memberNumber) {
		Optional<Long> member = db.sql("select id from competitor where member_number = ?")
				.param(memberNumber).query(Long.class).optional();

		if (member.isEmpty()) {
			return new Decided(ResponseEntity.notFound().build(), null, null);
		}

		/* THE ACCOUNT HELD FIRST, and whether it has a password asked under the hold: a password set in
		   the same instant (`PasswordReset.confirm`) spends a link and holds this row, so it is either
		   before this read, which then finds the password, or after it, and finds its link deleted. */
		record Held(long id, String email, boolean hasNoPassword) {
		}

		Optional<Held> held = db.sql("select id, email, password_hash is null from account"
						+ " where competitor_id = ? for update")
				.param(member.get())
				.query((row, i) -> new Held(row.getLong(1), row.getString(2), row.getBoolean(3)))
				.optional();

		if (held.isEmpty()) {
			return new Decided(conflict(THERE_IS_NO_ACCOUNT), null, null);
		}

		if (!held.get().hasNoPassword()) {
			return new Decided(conflict(THE_PASSWORD_IS_SET), null, null);
		}

		long account = held.get().id();

		db.sql("delete from password_reset_token where account_id = ?").param(account).update();
		db.sql("delete from email_verification_token where account_id = ?").param(account).update();

		SecretToken invitation = SecretToken.fresh();

		AnInvitationOfAMember.mint(db, account, invitation);

		return new Decided(null, held.get().email(), invitation.secret());
	}

	private static ResponseEntity<?> conflict(String reason) {
		return ResponseEntity.status(HttpStatus.CONFLICT).body(new MeWriteApi.Refused(reason));
	}
}
