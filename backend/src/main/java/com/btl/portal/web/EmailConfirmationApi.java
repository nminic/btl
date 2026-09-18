package com.btl.portal.web;

import com.btl.portal.domain.account.EmailConfirmation;
import com.btl.portal.domain.account.EmailConfirmation.Outcome;
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
 * CONFIRMING THE ADDRESS, WHICH IS THE HALF OF REGISTRATION {@code RegistrationApi}
 * COULD NOT FINISH BY ITSELF.
 *
 * <p>PDL, owner, 31.07.2026: "Potvrda adrese elektronske poste je prva, i uslov za sve
 * ostalo. Dok adresa nije potvrdjena, nema pristupa portalu ni placanja." Registration
 * writes the account and the token and leaves {@code email_confirmed_at} empty on
 * purpose (V6); {@link com.btl.portal.domain.account.SignIn} already refuses such an
 * account in the same breath as one that is locked. This class is the other end of
 * that link: the one place that fills the column in, and the one place that mails a
 * fresh token when the first message never arrived.
 *
 * <p><b>TWO ROUTES AND NOT ONE, because they take different secrets.</b> Confirming
 * asks for the 256 bit token out of the link - a secret nobody could guess - and
 * resending asks for the address itself, because a member standing in front of an
 * empty inbox has nothing else to offer. Registration already wrote what "the screen
 * after registration" needs, in words PDL of 29.07.2026 chose before this class
 * existed: "Zato ekran posle registracije mora da racuna na nezeljenu postu... plus
 * dugme za ponovno slanje potvrde." {@code RegistrationApi}'s own comment named this
 * the increment that fills the button in.
 *
 * <p><b>RESENDING NEVER SAYS WHETHER THE ADDRESS BELONGS TO ANYBODY, AND THAT IS A
 * DIFFERENT ANSWER FROM REGISTRATION'S OWN.</b> {@code RegistrationApi} tells a second
 * registration at a taken address that it is taken - the owner's own choice of
 * 08.09.2026, weighed against the cost of a person left stuck with no account and no
 * way to make one. Asking for the link again carries no such cost: mistyping the
 * address here loses nothing but a moment, since nothing was ever promised at the
 * address that was actually typed. Absent a decision that says otherwise, this route
 * therefore falls back to the shape every OTHER lookup by address in this portal
 * already has - {@link com.btl.portal.domain.account.SignIn}'s "every no is the same
 * no" - and answers 204 whether the address belongs to nobody, to somebody already
 * confirmed, or to somebody waiting on exactly this message. <b>No decision of the
 * owner's covers this specific question and none was invented for it; see the PR this
 * class shipped with for the question actually asked of him.</b>
 *
 * <p><b>What that uniformity does NOT close: a network timing difference.</b> The
 * branch that finds an unconfirmed account calls the mail relay before answering; the
 * other two branches do not, and a relay is slower than a row that is never read.
 * {@link com.btl.portal.domain.account.SignIn} closes the equivalent gap for a
 * password by comparing against a dummy hash so every branch costs the same CPU work.
 * Doing the same here would mean opening a real SMTP conversation on every call just
 * to throw the message away, against a relay whose own honest latency already varies
 * far more than the difference being hidden. Named here rather than silently assumed
 * away; nobody has asked for it and it is not built.
 *
 * <p><b>Carries neither {@link RightIsNeeded} nor {@link OnlyTheSuperadmin}</b>: nobody
 * signed in is ever asking, so there is no box to tick that would let one in. Named
 * beside {@code /api/registration} in {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT},
 * for the identical reason.
 */
@RestController
class EmailConfirmationApi {

	private static final Logger LOG = LoggerFactory.getLogger(EmailConfirmationApi.class);

	/**
	 * The one reason a confirmation is refused. There is only the one: the token this
	 * route was handed does not point at a row that is still live, whether because it
	 * never did, because somebody already spent it on a different link, or because its
	 * twenty four hours (V6) ran out. Registration tells three reasons apart because
	 * three different fields need three different fixes; a token is not a field
	 * anybody edits, so there is nothing here for a second reason to say that this one
	 * does not already cover.
	 */
	static final String THE_LINK_IS_NOT_VALID = "theLinkIsNotValid";

	private final JdbcClient db;

	private final Postman postman;

	private final TransactionTemplate inOneTransaction;

	private final Portal portal;

	EmailConfirmationApi(JdbcClient db, Postman postman, TransactionTemplate inOneTransaction,
			@Value("${btl.portal.address}") String address) {
		this.db = db;
		this.postman = postman;
		this.inOneTransaction = inOneTransaction;
		/* THIS IS NO LONGER THE ONLY CONSTRUCTOR THAT DOES THIS, and the comment on
		   `WhatTheMessageSays.Portal` that used to say so is corrected in the same
		   commit that adds this line, together with the one in
		   `application.properties` that made the same claim. Both said "RegistrationApi's
		   constructor is the only line"; a second and third line making the same
		   promise at start up is not a hole in that sentence; a sentence that no longer
		   describes the code is. */
		this.portal = new Portal(address);
	}

	/** What the link in the message sends back. */
	record Typed(String token) {
	}

	/** What the "send it again" button sends. */
	record ResendTyped(String email) {
	}

	/** Why a confirmation was refused. */
	record Refused(String reason) {
	}

	/**
	 * A link and the account it names, read together so {@link EmailConfirmation}
	 * can see both halves of its own question at once.
	 */
	private record Confirmable(long account, EmailConfirmation.Link link) {
	}

	/**
	 * THE LINK ITSELF: a token, and nothing that names an account.
	 *
	 * <p><b>No session comes out of this either</b>, for the same reason
	 * {@code RegistrationApi} hands none back: confirming the address is not signing
	 * in, and the member typed no password here for a cookie to stand in for.
	 */
	@PostMapping("/api/email-confirmation")
	@Transactional
	ResponseEntity<Refused> confirm(@RequestBody Typed typed) {
		if (typed.token() == null || typed.token().isBlank()) {
			return no();
		}

		/* THE TOKEN IS HASHED BEFORE IT IS EVER COMPARED, and never the other way
		   round: the row holds only what the link hashes to (V6), so a comparison
		   against the column has to start from the same hash or it compares nothing
		   that is actually in the table. */
		String hash = SecretToken.hashOf(typed.token());

		/* THE ACCOUNT'S OWN `email_confirmed_at` TRAVELS WITH THE LINK, joined in
		   rather than asked in a second query, because `EmailConfirmation.decide`
		   has to see it BEFORE it asks whether this particular link has run out -
		   see the class comment there for why an address already confirmed through
		   some OTHER, still-live link must be told "already done" rather than "ask
		   for another", even on a link whose own day has since passed. Judging
		   expiry first, the way a query filtering on `expires_at > now()` alone
		   does, is the identical mistake `PasswordResetApi`'s security review named
		   for its own link: a rule this route's own domain class already states
		   correctly, rewritten one field short in SQL. */
		Optional<Confirmable> found = db.sql(
						"select t.account_id, t.expires_at, a.email_confirmed_at"
								+ " from email_verification_token t"
								+ " join account a on a.id = t.account_id"
								+ " where t.token_hash = ?")
				.param(hash)
				.query((row, i) -> new Confirmable(row.getLong(1),
						new EmailConfirmation.Link(row.getTimestamp(2).toInstant(),
								row.getTimestamp(3) == null ? null : row.getTimestamp(3).toInstant())))
				.optional();

		Outcome outcome = EmailConfirmation.decide(found.map(Confirmable::link).orElse(null), Instant.now());

		if (outcome != Outcome.CONFIRM_IT && outcome != Outcome.ALREADY_DONE) {
			return no();
		}

		if (outcome == Outcome.CONFIRM_IT) {
			/* AND ONLY WHILE IT IS STILL EMPTY. `decide` has already refused a link
			   whose account was confirmed by the time this query read it, but that
			   read and this write are two round trips to the database with nothing
			   between them holding the row - two requests racing two different, both
			   still-unconfirmed-when-read live links must not both write the moment.
			   What guards that is the same it always was: the column, checked again,
			   atomically, right here. */
			db.sql("update account set email_confirmed_at = now()"
							+ " where id = ? and email_confirmed_at is null")
					.param(found.orElseThrow().account()).update();
		}

		return ResponseEntity.noContent().build();
	}

	/**
	 * ASKING FOR THE LINK AGAIN, which never says more than "if there was something to
	 * do, it is done" - see the class comment for why silence is the answer here and
	 * not the exception {@code RegistrationApi} made of itself.
	 */
	@PostMapping("/api/email-confirmation/resend")
	ResponseEntity<Void> resend(@RequestBody ResendTyped typed) {
		ToSend made = inOneTransaction.execute(committing -> write(typed));

		if (made != null) {
			send(made);
		}

		return ResponseEntity.noContent().build();
	}

	/**
	 * What one committed resend leaves for the message to be built from, or
	 * {@code null} when there is nothing to send - an address nobody holds, an address
	 * already confirmed, or no address at all. {@code RegistrationApi}'s {@code Made}
	 * carries an answer too, because its answer varies; this route's never does, so
	 * there is nothing here but what the letter needs.
	 */
	private record ToSend(long account, String address, String link) {
	}

	private ToSend write(ResendTyped typed) {
		if (typed.email() == null || typed.email().isBlank()) {
			return null;
		}

		/* `lower(email) = lower(?)` AND NOT A FOLDED VALUE COMPARED WITH `=`, the same
		   choice `SignInApi` makes and for the same reason: this is a lookup over rows
		   this route did not write, so the floor under a row that reached the table
		   some other way - by hand, by a migration, by a route older than the fold -
		   has to be the database's own `lower()` and not a second fold in Java that
		   could disagree with the unique index by one character. */
		String address = WhatAnAddressLooksLike.withoutTheSpacesAround(typed.email());

		Optional<Found> found = db.sql("select id, email from account"
						+ " where lower(email) = lower(?) and email_confirmed_at is null")
				.param(address)
				.query((row, i) -> new Found(row.getLong(1), row.getString(2)))
				.optional();

		if (found.isEmpty()) {
			return null;
		}

		SecretToken link = SecretToken.fresh();

		/* A FRESH ROW, NEVER A REUSED ONE. V6 gives `account_id` no unique key
		   precisely so a second link can be issued without retiring the first - ADL-posta
		   asked for the resend button on the strength of that column shape before this
		   route existed to use it. */
		db.sql("insert into email_verification_token (account_id, token_hash) values (?, ?)")
				.params(found.orElseThrow().id(), link.hash()).update();

		return new ToSend(found.orElseThrow().id(), found.orElseThrow().email(), link.secret());
	}

	private record Found(long id, String email) {
	}

	/**
	 * THE MESSAGE, SENT AFTER THE COMMIT, for the identical reason
	 * {@code RegistrationApi} gives at length: a relay waiting inside an open
	 * transaction holds a connection out of a pool of ten, and this row is worth
	 * nothing to anybody who is not the one connection waiting on it.
	 */
	private void send(ToSend made) {
		try {
			postman.send(
					WhatTheMessageSays.about(Message.CONFIRM_THE_ADDRESS, portal, made.link()),
					made.address());
		} catch (MailException theRelayDidNotTakeIt) {
			LOG.warn("a resent confirmation message for account {} did not go out; the token is"
					+ " written and asking again is what gets him out of it",
					made.account(), theRelayDidNotTakeIt);
		}
	}

	private static ResponseEntity<Refused> no() {
		return ResponseEntity.badRequest().body(new Refused(THE_LINK_IS_NOT_VALID));
	}
}
