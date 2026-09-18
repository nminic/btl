package com.btl.portal.web;

import com.btl.portal.domain.account.BreachedPasswords;
import com.btl.portal.domain.account.PasswordPolicy;
import com.btl.portal.domain.account.PasswordReset;
import com.btl.portal.domain.account.PasswordReset.Outcome;
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

import java.time.Instant;
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

	/**
	 * An account by the address somebody typed, and the address as the row
	 * actually carries it - the same split {@code EmailConfirmationApi.Found}
	 * makes for its own resend, and for the identical reason: the two can differ
	 * (case, a fold Postgres and Java do not agree on for every code point) and
	 * only the row's own spelling is a mailbox anybody can read.
	 */
	private record Found(long id, String email) {
	}

	private ToSend write(RequestTyped typed) {
		if (typed.email() == null || typed.email().isBlank()) {
			return null;
		}

		/* NEITHER CONFIRMED NOR UNCONFIRMED IS ASKED HERE, unlike
		   `EmailConfirmationApi.resend`'s own lookup - see the class comment for why a
		   reset is not conditioned on `email_confirmed_at` in either direction. */
		String address = WhatAnAddressLooksLike.withoutTheSpacesAround(typed.email());

		Optional<Found> found = db.sql("select id, email from account where lower(email) = lower(?)")
				.param(address)
				.query((row, i) -> new Found(row.getLong(1), row.getString(2)))
				.optional();

		if (found.isEmpty()) {
			return null;
		}

		SecretToken link = SecretToken.fresh();

		/* A FRESH ROW, NEVER A REUSED ONE - `account_id` carries no unique key here
		   either (V18), for the same reason V6 gives for the confirmation token: a
		   second link must be issuable without retiring the first. */
		db.sql("insert into password_reset_token (account_id, token_hash) values (?, ?)")
				.params(found.orElseThrow().id(), link.hash()).update();

		/* SENT TO THE ROW'S OWN SPELLING, NOT TO WHAT WAS TYPED - the same choice
		   `RegistrationApi.theLinkToSend` makes and for the same reason, stated
		   there at length: a message addressed to what was typed rather than to
		   what the account carries can end up at a mailbox the account does not
		   live at, which is a message this portal sent to nowhere on request
		   rather than a member's own mistake. */
		return new ToSend(found.orElseThrow().id(), found.orElseThrow().email(), link.secret());
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
	 * A live token, read as {@link PasswordReset} needs to see it, together with
	 * the account it opens - the account is not part of the domain question and
	 * is carried here only so this route has it once {@code decide} says yes.
	 */
	private record LiveToken(long account, PasswordReset.Link link) {
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

		boolean noToken = typed.token() == null || typed.token().isBlank();

		/* FOR UPDATE, the same guard `SignInApi` puts on the row it reads before
		   deciding whether to spend it: two requests racing the same token must not
		   both read a live link and both spend it. PostgreSQL re-evaluates a second
		   transaction's own read once the lock is released, so the request that
		   unblocks second sees the first one's `used_at` and `PasswordReset.decide`
		   correctly refuses it.

		   NOTHING IN THIS QUERY'S OWN `WHERE` JUDGES WHETHER THE LINK IS LIVE, unlike
		   the query this replaced. `expires_at` and `used_at` are read exactly as the
		   row holds them and handed to `PasswordReset.decide` whole, because that
		   class and not a second copy of its rule in SQL is what decides whether a
		   link still opens anything - see the class comment on why writing the same
		   rule twice is how it fell out of the cascade the first time. */
		Optional<LiveToken> found = noToken ? Optional.empty()
				: db.sql("select account_id, expires_at, used_at from password_reset_token"
								+ " where token_hash = ? for update")
						.param(SecretToken.hashOf(typed.token()))
						.query((row, i) -> new LiveToken(row.getLong(1), new PasswordReset.Link(
								row.getTimestamp(2).toInstant(),
								row.getTimestamp(3) == null ? null : row.getTimestamp(3).toInstant())))
						.optional();

		/* THE LINK IS JUDGED BEFORE THE PASSWORD - `PasswordReset.decide` says so
		   and this route now asks it rather than judging the password first and the
		   link second, which used to let anybody run a password past the breach
		   list with no token at all: a dead link and a leaked password answered
		   differently from a dead link and a fine one, and neither answer said
		   anything about the link. */
		Outcome outcome = PasswordReset.decide(found.map(LiveToken::link).orElse(null),
				typed.password(), passwords, Instant.now());

		if (outcome == Outcome.THE_LINK_IS_NO_GOOD) {
			return no(THE_LINK_IS_NOT_VALID);
		}
		if (outcome == Outcome.THE_PASSWORD_IS_TOO_SHORT) {
			return no(THE_FORM_IS_NOT_COMPLETE);
		}
		if (outcome == Outcome.THE_PASSWORD_HAS_BEEN_BREACHED) {
			return no(THE_PASSWORD_HAS_LEAKED);
		}

		long account = found.orElseThrow().account();

		/* EVERY LIVE TOKEN OF THIS ACCOUNT IS SPENT HERE, NOT ONLY THE ONE THAT WAS
		   USED. A second link mailed earlier - or a minute later by somebody racing
		   this same request - and never opened is exactly as good as this one until
		   this moment; left alone it would still set a password after this request
		   already has, which is one finished reset undoing another rather than a
		   member's own second thought. */
		db.sql("update password_reset_token set used_at = now()"
						+ " where account_id = ? and used_at is null")
				.param(account).update();

		/* THE LOCK IS LIFTED HERE TOO, and that is a choice this route makes rather
		   than a rule the schema states. A reset link is mailed to the same address a
		   member signs in with, so completing one is at least as strong a proof of who
		   is asking as the ten guesses `SignIn.ENOUGH_MISSES_TO_LOCK` was ever meant to
		   stop; leaving the lock in place would tell a member who just proved exactly
		   that to come back in fifteen minutes anyway. It costs nothing an attacker did
		   not already win the moment he could complete this request at all. */
		db.sql("update account set password_hash = ?, failed_sign_ins = 0, locked_until = null"
						+ " where id = ?")
				.params(keeping.of(typed.password()), account).update();

		/* EVERY SESSION OF THIS ACCOUNT ENDS HERE, AND IT ENDS AFTER THE PASSWORD IS
		   WRITTEN. THE ORDER OF THESE TWO STATEMENTS IS LOAD BEARING AND NOTHING
		   MEASURES IT - this sentence is all there is, and it says so rather than
		   pretending otherwise. Moving this delete above the update three lines up
		   passes the whole gate, every case at a hundred percent.

		   WHY THE ORDER CARRIES ANYTHING. `SignInApi` is the only place under
		   `src/main` that mints an `account_session` row, and it mints one after
		   reading `password_hash`. This route is one transaction (`@Transactional`)
		   against PostgreSQL at its default `read committed` - nothing in this portal
		   sets an isolation level anywhere - so a sign in racing it reads whichever of
		   the two states has committed, never a half of this one. Written in this
		   order, an attacker still holding the old password either signs in before this
		   transaction commits, in which case his row is already there for the delete
		   below to take, or reads the new hash and is not let in at all. In the other
		   order there is a window with no cover: he reads the OLD hash, this delete
		   runs and finds nothing of his, and his session row commits AFTER it. That row
		   then outlives the reset it was supposed to end, and `WhoIsAsking` pushes its
		   `expires_at` out on every single use, so it does not age out on its own
		   either - which is precisely the case V18 says a session is a row for.

		   AND WHY THERE IS NO GUARD, which is a price rather than an oversight, and
		   worth stating exactly. It is NOT that the portal cannot run two transactions
		   at once: `PaymentNumberConcurrencyTest` already does, with two threads, a
		   `CyclicBarrier`, a class deliberately outside the test transaction and a
		   `finally` that deletes its own rows. That arrangement reaches a race between
		   two requests. This one is inside THIS transaction, between two of its
		   statements, and no barrier a test can hold reaches in here: measuring it means
		   taking a lock on the `account` row from a second connection so this route
		   blocks on the update, waiting on `pg_stat_activity` until it really is
		   blocked, inserting a session in that gap and only then letting go. That is a
		   fixture with more moving parts than the statement it watches, and one that
		   reads as flaky on a slower machine, where flaky gets muted. So the cost is
		   written down instead: whoever swaps these two statements gets a green build,
		   and this comment is the only thing in his way. If it is ever worth a case,
		   the lock-and-wait above is the shape, and the file named is where its
		   scaffolding already lives.

		   V18 names this the first of the three reasons a session is a row and not a
		   signed token: "a member changes his password". Whoever is holding a cookie this member did not just mint -
		   a borrowed computer, a copied profile - stops being let in the moment this
		   member proves he can still read his own mailbox and picks a new password;
		   a reset is the one defence a member locked out by a stolen cookie has; it
		   bought him nothing while a row nobody deleted kept answering 200. */
		db.sql("delete from account_session where account_id = ?")
				.param(account).update();

		return ResponseEntity.noContent().build();
	}

	private static ResponseEntity<Refused> no(String reason) {
		return ResponseEntity.badRequest().body(new Refused(reason));
	}
}
