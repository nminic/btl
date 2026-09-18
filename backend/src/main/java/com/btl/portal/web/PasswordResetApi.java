package com.btl.portal.web;

import com.btl.portal.domain.account.BreachedPasswords;
import com.btl.portal.domain.account.PasswordPolicy;
import com.btl.portal.domain.account.PasswordPolicy.Verdict;
import com.btl.portal.domain.account.StoredPassword;
import com.btl.portal.domain.account.WhatAnAddressLooksLike;
import com.btl.portal.domain.mail.WhatTheMessageSays;
import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.mail.WhatTheMessageSays.Portal;
import com.btl.portal.domain.token.SecretToken;
import com.btl.portal.mail.Postman;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.MailException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

/**
 * A FORGOTTEN PASSWORD, PDL's OWN WORDS: "standardnim postupkom: link na mejl, pa
 * unos nove lozinke i ponavljanje u novom prozoru. Prijava bez lozinke se ne uvodi."
 *
 * <p>Three sentences and this class is all three: a link mailed on request, a screen
 * that asks for the new password twice, and deliberately no session at the end of it
 * - the member types his new password here and signs in with it afterwards, through
 * {@code SignInApi}, exactly like anybody else. "Prijava bez lozinke se ne uvodi"
 * rules out a shortcut this route could otherwise have taken for free.
 *
 * <p><b>THIS IS ALSO THE ONLY WAY SOME ACCOUNTS EVER GET A PASSWORD AT ALL.</b> V18,
 * on why {@code password_hash} is nullable: the owner opens accounts for honorary
 * members himself, and "those people never registered, so nobody ever typed a
 * password for them; they set one through the reset link, which is exactly what the
 * table below is for." So this route asks nothing about
 * {@code account.email_confirmed_at} in either direction - not to require it, not to
 * set it - because confirming an address and proving you can read a mailbox well
 * enough to be handed a reset link are two different facts, and V6 already keeps them
 * apart for registration's own reasons. An account this route hands a fresh password
 * to is not, by that alone, one {@code SignIn} will let in: the address still has to
 * be confirmed on its own road, exactly as it does for every other account.
 *
 * <p><b>REQUESTING A RESET NEVER SAYS WHETHER THE ADDRESS BELONGS TO ANYBODY</b>, for
 * the reasons {@link EmailConfirmationApi} gives at the same point about its own
 * resend button - no decision of the owner's covers this question either, both are
 * asked of him together, and absent an answer this falls back to the same shape
 * every other lookup by address in this portal already has.
 *
 * <p><b>Carries neither {@link RightIsNeeded} nor {@link OnlyTheSuperadmin}</b>, for
 * the identical reason {@link EmailConfirmationApi} carries neither: nobody signed in
 * is ever asking. Named beside {@code /api/registration} in
 * {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT}.
 */
@RestController
class PasswordResetApi {

	private static final Logger LOG = LoggerFactory.getLogger(PasswordResetApi.class);

	/**
	 * Mirrors {@code RegistrationApi.THE_FORM_IS_NOT_COMPLETE}: a blank field, the two
	 * passwords not agreeing, or a password shorter than {@link PasswordPolicy#SHORTEST}.
	 * The reset screen has exactly two fields where registration has fourteen, but the
	 * fix a member makes for any of these three is the same one - type the password
	 * again - so it is one reason here for the same cause it is one reason there.
	 */
	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/** Mirrors {@code RegistrationApi.THE_PASSWORD_HAS_LEAKED}, told apart from the
	 *  reason above for the identical reason it is told apart there: it is the one
	 *  fix the member could not have known about before he pressed the button. */
	static final String THE_PASSWORD_HAS_LEAKED = "thePasswordHasLeaked";

	/** Mirrors {@code EmailConfirmationApi.THE_LINK_IS_NOT_VALID}: the token this
	 *  route was handed does not point at a row that is still live and unspent. */
	static final String THE_LINK_IS_NOT_VALID = "theLinkIsNotValid";

	private final JdbcClient db;

	private final Postman postman;

	private final TransactionTemplate inOneTransaction;

	private final Portal portal;

	private final PasswordPolicy passwords;

	private final StoredPassword keeping;

	PasswordResetApi(JdbcClient db, Postman postman, TransactionTemplate inOneTransaction,
			@Value("${btl.portal.address}") String address) {
		this.db = db;
		this.postman = postman;
		this.inOneTransaction = inOneTransaction;
		/* A THIRD CONSTRUCTOR THAT BUILDS A `Portal` OUT OF CONFIGURATION, beside
		   `RegistrationApi`'s and `EmailConfirmationApi`'s; see the note in
		   `EmailConfirmationApi` for the two comments elsewhere corrected to say so. */
		this.portal = new Portal(address);
		/* READ ONCE AT START UP, the same reasoning `RegistrationApi` gives for its own
		   copy: read per request the leaked password list would be a file opened and
		   parsed while somebody waits, and a missing or empty resource fails the server
		   at start up instead of silently accepting every leaked password there is. */
		this.passwords = new PasswordPolicy(BreachedPasswords.fromResource());
		this.keeping = new StoredPassword();
	}

	/** What the "forgot your password" form sends. */
	record RequestTyped(String email) {
	}

	/** What the screen after the link sends: the token, and the password twice. */
	record ResetTyped(String token, String password, String passwordRepeat) {
	}

	/** Why a reset was refused. */
	record Refused(String reason) {
	}

	/**
	 * ASKING FOR THE LINK, which never says more than "if there was something to do,
	 * it is done" - see the class comment.
	 */
	@PostMapping("/api/password-reset/request")
	ResponseEntity<Void> request(@RequestBody RequestTyped typed) {
		ToSend made = inOneTransaction.execute(committing -> write(typed));

		if (made != null) {
			send(made);
		}

		return ResponseEntity.noContent().build();
	}

	private record ToSend(long account, String address, String link) {
	}

	private ToSend write(RequestTyped typed) {
		if (typed.email() == null || typed.email().isBlank()) {
			return null;
		}

		/* NEITHER CONFIRMED NOR UNCONFIRMED IS ASKED HERE, unlike
		   `EmailConfirmationApi.resend`'s own lookup - see the class comment for why a
		   reset is not conditioned on `email_confirmed_at` in either direction. */
		String address = WhatAnAddressLooksLike.withoutTheSpacesAround(typed.email());

		Optional<Long> account = db.sql("select id from account where lower(email) = lower(?)")
				.param(address).query(Long.class).optional();

		if (account.isEmpty()) {
			return null;
		}

		SecretToken link = SecretToken.fresh();

		/* A FRESH ROW, NEVER A REUSED ONE - `account_id` carries no unique key here
		   either (V18), for the same reason V6 gives for the confirmation token: a
		   second link must be issuable without retiring the first. */
		db.sql("insert into password_reset_token (account_id, token_hash) values (?, ?)")
				.params(account.orElseThrow(), link.hash()).update();

		return new ToSend(account.orElseThrow(), address, link.secret());
	}

	private void send(ToSend made) {
		try {
			postman.send(
					WhatTheMessageSays.about(Message.SET_A_NEW_PASSWORD, portal, made.link()),
					made.address());
		} catch (MailException theRelayDidNotTakeIt) {
			LOG.warn("a password reset message for account {} did not go out; asking again is"
					+ " what gets him another one", made.account(), theRelayDidNotTakeIt);
		}
	}

	/**
	 * SETTING THE NEW PASSWORD, which hands back no session - see the class comment
	 * for why "prijava bez lozinke se ne uvodi" rules that out on its own.
	 */
	@PostMapping("/api/password-reset")
	@Transactional
	ResponseEntity<Refused> reset(@RequestBody ResetTyped typed) {
		if (typed.password() == null || typed.passwordRepeat() == null
				|| !typed.password().equals(typed.passwordRepeat())) {
			return no(THE_FORM_IS_NOT_COMPLETE);
		}

		Verdict verdict = passwords.judge(typed.password());

		if (verdict == Verdict.TOO_SHORT) {
			return no(THE_FORM_IS_NOT_COMPLETE);
		}
		if (verdict == Verdict.BREACHED) {
			return no(THE_PASSWORD_HAS_LEAKED);
		}

		if (typed.token() == null || typed.token().isBlank()) {
			return no(THE_LINK_IS_NOT_VALID);
		}

		String hash = SecretToken.hashOf(typed.token());

		/* FOR UPDATE, the same guard `SignInApi` puts on the row it reads before
		   deciding whether to spend it: two requests racing the same token must not
		   both read `used_at is null` and both spend it. PostgreSQL re-evaluates the
		   WHERE clause against the latest committed row once the lock is released, so
		   the second request to unblock sees the first one's `used_at` and correctly
		   finds nothing. */
		Optional<Long> account = db.sql("select account_id from password_reset_token"
						+ " where token_hash = ? and expires_at > now() and used_at is null"
						+ " for update")
				.param(hash).query(Long.class).optional();

		if (account.isEmpty()) {
			return no(THE_LINK_IS_NOT_VALID);
		}

		db.sql("update password_reset_token set used_at = now() where token_hash = ?")
				.param(hash).update();

		/* THE LOCK IS LIFTED HERE TOO, and that is a choice this route makes rather
		   than a rule the schema states. A reset link is mailed to the same address a
		   member signs in with, so completing one is at least as strong a proof of who
		   is asking as the ten guesses `SignIn.ENOUGH_MISSES_TO_LOCK` was ever meant to
		   stop; leaving the lock in place would tell a member who just proved exactly
		   that to come back in fifteen minutes anyway. It costs nothing an attacker did
		   not already win the moment he could complete this request at all. */
		db.sql("update account set password_hash = ?, failed_sign_ins = 0, locked_until = null"
						+ " where id = ?")
				.params(keeping.of(typed.password()), account.orElseThrow()).update();

		return ResponseEntity.noContent().build();
	}

	private static ResponseEntity<Refused> no(String reason) {
		return ResponseEntity.badRequest().body(new Refused(reason));
	}
}
