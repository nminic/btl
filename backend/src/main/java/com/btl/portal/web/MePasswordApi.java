package com.btl.portal.web;

import com.btl.portal.domain.account.BreachedPasswords;
import com.btl.portal.domain.account.PasswordPolicy;
import com.btl.portal.domain.account.SignIn;
import com.btl.portal.domain.account.StoredPassword;
import com.btl.portal.domain.mail.WhatANoticeSays;
import com.btl.portal.domain.mail.WhatANoticeSays.Notice;
import com.btl.portal.domain.token.SecretToken;
import com.btl.portal.mail.Postman;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.MailException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;

/**
 * A MEMBER CHANGING HIS PASSWORD WHILE HE IS SIGNED IN, WHICH IS TWO THINGS AND NOT ONE.
 *
 * <p><b>Owner, PDL P28b, 5, 24.09.2026, choosing between offered outcomes with the cost of
 * each put to him:</b> „Promena lozinke dok je clan prijavljen trazi STARU lozinku i
 * ODJAVLJUJE SVE OSTALE SESIJE. Razlog: ako se lozinka menja zbog sumnje da je neko zna,
 * promena bez odjave ne resava nista." Both halves are his, both are here, and neither is
 * decoration:
 *
 * <ul>
 * <li><b>The old password is asked for</b>, so a cookie somebody else is holding is not by
 * itself enough to take the account away from its owner. A session is proof that somebody
 * signed in once; it is not proof that the person at the keyboard is the member.
 * <li><b>Every OTHER session ends</b>, so the borrowed laptop, the copied cookie and the
 * telephone left at a friend's stop being let in the moment the password moves. V18 names
 * this the first of the three reasons a session is a row and not a signed token - „a member
 * changes his password" - and this is the second route to act on it.
 * </ul>
 *
 * <p><b>AND THE SESSION THIS REQUEST CAME IN ON IS THE ONE THAT SURVIVES.</b> „Sve OSTALE"
 * is the whole of the difference from {@link PasswordResetApi}, which deletes every session
 * of the account including none of its own - it has none, because a reset hands back no
 * cookie and the member was never signed in on it. Here he is, and signing him out of the
 * browser he is typing in would answer 204 and then refuse him everything, which reads as a
 * portal that broke rather than as a portal that did what he asked. The row is told apart
 * by what the cookie he sent hashes to, which is the same key {@link SignOutApi} ends one
 * session by.
 *
 * <p><b>THE COOKIE IS READ RATHER THAN CARRIED ON {@link WhoIsAsking.Member}</b>, and that
 * is the shape {@link SignOutApi} already has. {@code Member} is handed to every controller
 * on every request, and its own javadoc gives the reason a field is not added to it lightly:
 * „anything in it is fetched on every request whether or not the route wants it". Exactly
 * one route needs to know WHICH session asked, so exactly one route asks.
 *
 * <p><b>IT IS NOT {@code required = false}, AND THAT IS A STATEMENT ABOUT THE CHAIN.</b>
 * {@link WhoIsAsking} authenticates a request out of that cookie and out of nothing else,
 * so a request that reaches this method carries one by construction: there is no branch here
 * for „no cookie", because there is no such request, and a branch nothing can reach is a
 * branch nothing can measure ({@link SignOutApi} says the same of its own dead line).
 *
 * <p><b>WHAT IS REFUSED AND WHAT IT IS TOLD, AND THE ORDER IS THE POINT.</b> The OLD
 * password is judged before the new one, which is {@link PasswordResetApi}'s own correction
 * of 12.09.2026 applied to the thing that stands in for its link: judged the other way
 * round, a member who typed his old password wrongly would be told whether his NEW one is on
 * the list of leaked passwords, which is an answer about a password the portal is not going
 * to store to somebody who has not yet proved he may store one.
 *
 * <ul>
 * <li><b>A field left out, the two new ones not agreeing, or a password shorter than
 * {@link PasswordPolicy#SHORTEST}</b> are one answer, {@link #THE_FORM_IS_NOT_COMPLETE},
 * for the reason {@link PasswordResetApi} gives for folding the same three together: the fix
 * the member makes is the same one for all of them.
 * <li><b>The old password not being the one stored</b> is {@link #THE_OLD_PASSWORD_IS_WRONG},
 * and it is its own answer because it is the one fault the member cannot fix by typing the
 * new password again.
 * <li><b>A new password that has already leaked</b> is {@link #THE_PASSWORD_HAS_LEAKED},
 * told apart for the identical reason {@link RegistrationApi} tells it apart: it is the one
 * fix nobody could have known about before pressing the button.
 * </ul>
 *
 * <p><b>AN ACCOUNT HOLDING NO PASSWORD AT ALL IS ANSWERED „THE OLD ONE IS WRONG", and that
 * branch is reachable rather than defensive.</b> V18 makes {@code password_hash} nullable
 * on purpose - the owner opens accounts for honorary members and invited moderators, and
 * „those people never registered, so nobody ever typed a password for them". Such an account
 * cannot sign in, so in the portal as it runs today it cannot be holding a session either;
 * what CAN hold one is a row written by hand, by a migration or by an import, and
 * {@link StoredPassword#matches} is not given a null to compare against in any case. So the
 * answer is the one every other wrong old password gets, and the case that holds it gives a
 * member a session and no hash.
 *
 * <p><b>WHAT ELSE THIS ROUTE DOES AND DELIBERATELY DOES NOT DO, each named rather than
 * discovered.</b>
 *
 * <ul>
 * <li><b>IT TELLS HIM BY POST, AND THAT IS ONE OF THE OWNER'S SIX MANDATORY MESSAGES.</b> PDL
 * P22, 11.08.2026: „Sest obaveznih mejlova u prvoj verziji: kreiranje naloga i potvrda mejla,
 * <b>promena lozinke</b>, unet rezultat, promenjen rezultat, dodatni zahtev za verifikaciju,
 * krupna izmena na portalu", and beside it „Sest mejlova iz spiska su obavezni i clan ih ne
 * moze iskljuciti." An earlier draft of this class claimed P22 „does not mention this", which
 * was false and was found by running {@code btl-produkt/odluke-za-resurs.py} over this route.
 * <p><b>It is a {@link WhatANoticeSays.Notice} and NOT a
 * {@link com.btl.portal.domain.mail.WhatTheMessageSays.Message}</b>, and that class says at
 * length why the two are apart: a message carries a link and a screen and a lifetime, and two
 * floors are built on every one of them having all three. This carries none, so folding it in
 * would have made both floors say less.
 * <p><b>AND IT CARRIES NO PASSWORD, OLD OR NEW.</b> PDL P9 says a notice „MORA da sadrzi staru
 * vrednost, jer ona nigde drugde ne prezivljava" - and that decision is about an administrator
 * changing somebody else's RESULT, where the old value is the old time on a race. Carried
 * across to a password it would mean posting the old one, which this portal cannot do (V18
 * keeps a BCrypt hash, „A stolen copy of this database lets nobody sign in as anybody") and
 * must not. What the notice carries instead is what really survives nowhere else: WHEN it
 * changed, and how many other devices were signed out by it.
 * <li><b>It does not touch {@code email_confirmed_at}.</b> {@link PasswordResetApi} writes
 * it in exactly one case - an account that had NO password, for which spending the link is
 * the first proof anybody has of the mailbox - and this route is the opposite case by
 * construction: reaching it at all means somebody signed in, which V6 and {@code SignIn}
 * already make conditional on that column.
 * <li><b>It does not hand back a new cookie.</b> The session that asked is untouched, so the
 * one the browser is holding goes on being the right one; a fresh one would be a second row
 * for the same browser and the old one would have to be ended, which is the shape this route
 * exists to avoid.
 * </ul>
 *
 * <p><b>It carries no {@link RightIsNeeded}</b>, for the same reason {@link MeWriteApi}
 * carries none: no box anybody could tick would let one member change another's password,
 * and changing his own is what every member does. So {@code PUT /api/me/password} is named
 * in {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT}, by method and path together.
 *
 * <p><b>And it is not on {@link ApiSecurity#READ_BY_ANYBODY}</b>, so a request arriving with
 * no session is answered 401 by the chain before this class runs. There is no condition here
 * about whether anybody is signed in, and there must not be one.
 *
 * <p><b>THE MAPPING SAYS WHAT IT CONSUMES</b>, which {@link TeamWriteApi} measured on
 * 19.09.2026: without it, a request arriving with no {@code Content-Type} is answered 415,
 * a number that says „this address is here and wants a different type", while an address
 * mapping nothing goes on saying 404.
 */
@RestController
class MePasswordApi {

	/**
	 * A field left out, the two new passwords not agreeing, or one that is too short.
	 *
	 * <p>Spelt the same as {@link PasswordResetApi#THE_FORM_IS_NOT_COMPLETE} and
	 * {@link RegistrationApi#THE_FORM_IS_NOT_COMPLETE}, because it is the same sentence
	 * about a form with three boxes instead of two or fourteen.
	 */
	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/** The one fault typing the new password again does not fix. */
	static final String THE_OLD_PASSWORD_IS_WRONG = "theOldPasswordIsWrong";

	/** Long enough, and already known to have leaked. */
	static final String THE_PASSWORD_HAS_LEAKED = "thePasswordHasLeaked";

	private static final Logger LOG = LoggerFactory.getLogger(MePasswordApi.class);

	private final JdbcClient db;

	private final StoredPassword keeping;

	private final PasswordPolicy passwords;

	private final Postman postman;

	/**
	 * Written by hand rather than left on the method, and the reason is the notice.
	 *
	 * <p>With {@code @Transactional} on the handler the whole request is one transaction, so
	 * the only place left to send from would be INSIDE it - and {@link RegistrationApi}
	 * measured what that does: a request waiting on somebody else's SMTP server holds a
	 * connection out of a pool of ten. Held here, the writing is a transaction and the sending
	 * is after it, which is {@link EmailConfirmationApi#resend}'s own arrangement.
	 */
	private final TransactionTemplate inOneTransaction;

	/**
	 * Both are built here rather than injected, which is what {@link PasswordResetApi} and
	 * {@link RegistrationApi} already do with the same pair: neither is a bean anywhere in
	 * this portal, and the list of leaked passwords {@link PasswordPolicy} reads is loaded
	 * once by {@code BreachedPasswords.fromResource} and held in memory by the object it
	 * hands back.
	 */
	MePasswordApi(JdbcClient db, Postman postman, TransactionTemplate inOneTransaction) {
		this.db = db;
		this.postman = postman;
		this.inOneTransaction = inOneTransaction;
		this.keeping = new StoredPassword();
		this.passwords = new PasswordPolicy(BreachedPasswords.fromResource());
	}

	/**
	 * What the member types, which is three boxes.
	 *
	 * @param oldPassword    the one he is signing in with today
	 * @param password       the one he wants
	 * @param passwordRepeat the same again, which is the form's own guard against a typed
	 *                       password nobody can see; the server asks it too, for the reason
	 *                       {@link com.btl.portal.domain.registration.WhatRegistrationAsksFor}
	 *                       gives about every rule a form also carries - „the form is
	 *                       JavaScript in somebody else's browser"
	 */
	record Change(String oldPassword, String password, String passwordRepeat) {
	}

	/** Why the password could not be changed. */
	record Refused(String reason) {
	}

	/**
	 * @param asking  who the chain decided is asking, which is where the account comes from
	 *                and the only place it may come from
	 * @param carried the cookie this request arrived on, which names the one session that
	 *                survives
	 */
	@PutMapping(path = "/api/me/password", consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<Refused> change(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@CookieValue(name = SessionCookie.NAME) String carried,
			@RequestBody Change typed) {

		Done done = inOneTransaction.execute(committing -> write(asking.account(), carried, typed));

		/* THE NOTICE GOES AFTER THE COMMIT, AND NOTHING ABOUT IT CAN UNDO THE CHANGE.
		   `RegistrationApi` measured why at length and the reasoning carries over word for
		   word: a request that waits on somebody else's SMTP server with a transaction open
		   holds a connection out of a pool of ten. And the answer is already true by the time
		   the relay is asked - his password HAS changed and his other devices ARE signed out -
		   so a relay that is down must not turn that into a refusal. It is logged for the
		   operator instead; the way out for the member is the reset link, which is the road
		   this class sits beside. */
		if (done.refusal() == null) {
			tell(done);
		}

		return done.refusal() == null ? ResponseEntity.noContent().build() : done.refusal();
	}

	/**
	 * What one committed change leaves behind for the notice to be built from, or the refusal.
	 *
	 * <p>{@code EmailConfirmationApi.ToSend}'s own shape: the transaction hands back the facts
	 * rather than the message, so nothing under {@code domain.mail} is touched while a
	 * transaction is open and nothing about the relay reaches a decision.
	 *
	 * @param others how many OTHER sessions were ended, which is the count the statement itself
	 *               returned rather than one counted again afterwards - counted again it would
	 *               be a second question about a table that has changed in between
	 */
	private record Done(ResponseEntity<Refused> refusal, long account, String address, Instant at,
			int others) {
	}

	private Done write(long account, String carried, Change typed) {
		if (isNothing(typed.oldPassword()) || isNothing(typed.password())
				|| isNothing(typed.passwordRepeat())
				|| !typed.password().equals(typed.passwordRepeat())) {

			return no(THE_FORM_IS_NOT_COMPLETE);
		}

		/* FOR UPDATE, the same guard `SignInApi` puts on the row it reads before deciding
		   whether to spend it: two requests racing this one must not both read the old hash
		   and both write over it, which would leave the loser's password stored and the
		   winner told 204 about one that is not there. */
		/* `.single()` AND NOT `.optional()`, AND THE DIFFERENCE IS A DEAD BRANCH RATHER THAN
		   A PREFERENCE. The row is the account of whoever got this far, already resolved once
		   by `WhoIsAsking` out of the session, so there is no request that reaches this line
		   and finds no row. An `.optional()` here left `isEmpty()` unreachable - measured, it
		   was the one branch the coverage gate named on an otherwise green run - and a branch
		   nothing can reach is a branch nothing can measure ({@code SignOutApi} says the same
		   of its own).

		   IT IS ALSO SAFE IN THE WAY `MemberOfAccount` WARNS ABOUT. That class reads a column
		   through `.list().get(0)` because `.single()` refuses a null RESULT, „Result value is
		   null but no null value expected", and the column it reads is nullable. Here the
		   result is a `Held`, which the mapper always builds; the nullable thing is a FIELD on
		   it, and that is what the line below asks about. */
		Held stored = db.sql("select password_hash, email, failed_sign_ins, locked_until,"
						+ " email_confirmed_at from account where id = ? for update")
				.param(account)
				.query((row, one) -> new Held(row.getString(1), row.getString(2), row.getInt(3),
						row.getTimestamp(4) == null ? null : row.getTimestamp(4).toInstant(),
						row.getTimestamp(5) == null ? null : row.getTimestamp(5).toInstant()))
				.single();

		/* AN ACCOUNT WITH NO PASSWORD AT ALL, which V18 makes a real state and the head of
		   this class says how one could be holding a session. `.optional()` answers empty
		   for a null column as well as for no row, and both are the same sentence here:
		   there is nothing stored for the old password to be. */
		/* THE OLD PASSWORD IS JUDGED BY `SignIn` AND NOT BY A SECOND COPY OF ITS RULE, and
		   that is the whole of what a security round on 25.09.2026 found missing here.

		   ADL A43.1, owner, 11.09.2026: „zakljucavanje | posle 10 neuspelih pokusaja, 15
		   minuta". THAT DECISION IS NOT A PROPERTY OF ONE ROUTE. Until this round only
		   `SignInApi` carried it out, so this address was an unlimited oracle: measured, 25
		   wrong old passwords in a row were 25 plain refusals, `failed_sign_ins` stayed at
		   nought, `locked_until` stayed null, and an account locked BY HAND went on answering
		   as though it were open. It also FORGOT misses on success, so a run of guesses here
		   wiped the count `SignInApi` was keeping.

		   That is a hole in the very thing this route asks for the old password FOR: „a cookie
		   somebody else is holding is not by itself enough to take the account away from its
		   owner" is only true while guessing costs something. Somebody with a stolen cookie
		   could guess without limit, without a trace and without ever meeting the lock.

		   WHY `SignIn.decide` AND NOT A CONDITION WRITTEN HERE. The rule has five branches -
		   no account, an unconfirmed address, a lock that has not run out, no password at all,
		   and a comparison - and every one of them decides whether a MISS IS COUNTED, which is
		   what keeps a stranger from shutting an account he does not own. A second copy would
		   be a second home for all five, free to disagree the day one is edited. Reusing it
		   costs one thing and it is written down: the counter is shared with signing in, so
		   ten misses HERE shut the front door too. That is the owner's own reading - the
		   decision names ten attempts and does not name a door.

		   THE THREE ANSWERS ARE ONE ANSWER, deliberately, and it is `SignIn`'s own reason: a
		   locked account, an account with no password and a wrong password are told apart by
		   nothing, or the refusal becomes a way of asking what state the account is in. */
		Instant now = Instant.now();
		SignIn.Outcome outcome = SignIn.decide(new SignIn.Account(stored.hash(), stored.misses(),
				stored.lockedUntil(), stored.addressConfirmedAt()), typed.oldPassword(), now);

		if (outcome == SignIn.Outcome.COUNT_THE_MISS) {
			int misses = SignIn.missesAfter(stored.misses());

			/* WRITTEN FROM INSIDE THE TRANSACTION AND STILL KEPT. `TransactionTemplate`
			   rolls back on an exception and not on a returned value, so a refusal returned
			   after this line commits it - which is what a counter is for. */
			db.sql("update account set failed_sign_ins = ?, locked_until = ? where id = ?")
					.params(misses, Optional.ofNullable(SignIn.lockedUntilAfter(misses, now))
							.map(Timestamp::from).orElse(null), account)
					.update();
		}

		if (outcome != SignIn.Outcome.WELCOME) {
			return no(THE_OLD_PASSWORD_IS_WRONG);
		}

		PasswordPolicy.Verdict verdict = passwords.judge(typed.password());

		if (verdict == PasswordPolicy.Verdict.TOO_SHORT) {
			return no(THE_FORM_IS_NOT_COMPLETE);
		}
		if (verdict == PasswordPolicy.Verdict.BREACHED) {
			return no(THE_PASSWORD_HAS_LEAKED);
		}

		/* THE LOCK IS LIFTED HERE TOO, and it is the same choice `PasswordResetApi` makes
		   with the same reason behind it: somebody who just typed his old password has
		   proved at least as much as the ten guesses `SignIn.ENOUGH_MISSES_TO_LOCK` exists
		   to stop, and leaving the lock standing would tell a member who proved exactly that
		   to come back in fifteen minutes. It is reachable rather than tidy: an account is
		   locked by somebody ELSE guessing at it, and the member whose laptop is still
		   signed in is the one person who can end that by moving the password. */
		db.sql("update account set password_hash = ?, failed_sign_ins = 0, locked_until = null"
						+ " where id = ?")
				.params(keeping.of(typed.password()), account)
				.update();

		/* EVERY OTHER SESSION ENDS HERE, AND IT ENDS AFTER THE PASSWORD IS WRITTEN. The
		   order is load bearing for exactly the reason `PasswordResetApi` writes out at
		   length beside its own pair of statements, and the reasoning carries over
		   unchanged: `SignInApi` is the only place under `src/main` that mints an
		   `account_session` row and it mints one AFTER reading `password_hash`, so written
		   in this order somebody still holding the old password either has his row in place
		   before this transaction commits - and the delete below takes it - or reads the new
		   hash and is not let in at all. In the other order there is a window with no cover.

		   AND THE CONDITION IS `<>` AND NOT `=`, which is the whole of what the owner's „sve
		   OSTALE" adds to the sentence `PasswordResetApi` already carries. The case that
		   holds it gives the member THREE sessions and requires the two he is not asking
		   from to be gone and the one he is asking from to go on answering. */
		int others = db.sql("delete from account_session where account_id = ? and token_hash <> ?")
				.params(account, SecretToken.hashOf(carried))
				.update();

		return new Done(null, account, stored.address(), now, others);
	}

	/**
	 * What the decision needs off the account, read in one statement.
	 *
	 * <p>Three of the five are there for {@link SignIn} rather than for this route: the
	 * misses, the lock and the moment the address was confirmed are what its rule asks about,
	 * and reading them here is what lets that rule be called instead of rewritten.
	 */
	private record Held(String hash, String address, int misses, Instant lockedUntil,
			Instant addressConfirmedAt) {
	}

	/**
	 * THE NOTICE, BUILT AND SENT ONLY ONCE THE CHANGE IS COMMITTED.
	 *
	 * <p>A relay that will not take it is a warning the member does not get, and nothing
	 * more: his password has changed and his other devices are signed out either way. So it
	 * is logged for whoever runs the portal rather than turned into an answer, which is the
	 * shape {@link RegistrationApi} and {@link EmailConfirmationApi} both settled on.
	 *
	 * <p><b>Neither password reaches this method</b>, and that is by construction rather than
	 * by care: {@link Done} carries an address, a moment and a count, and there is no field
	 * on it that could hold one.
	 */
	private void tell(Done done) {
		try {
			postman.send(WhatANoticeSays.about(Notice.THE_PASSWORD_HAS_CHANGED,
					WhatANoticeSays.moment(done.at()), String.valueOf(done.others())),
					done.address());
		}
		catch (MailException theRelayDidNotTakeIt) {
			/* THE ACCOUNT'S NUMBER AND NEVER ITS ADDRESS, which is what `RegistrationApi`,
			   `EmailConfirmationApi` and `PasswordResetApi` all put in the same sentence. An
			   address in a log is a member's own datum written somewhere the privacy policy
			   does not promise to keep it, and it buys nothing: whoever reads this line has
			   the database. */
			LOG.warn("the notice that account {} changed its password did not go out; the"
					+ " password IS changed and every other session IS ended", done.account(),
					theRelayDidNotTakeIt);
		}
	}

	/**
	 * Null, or nothing but spaces - and the second of those is a REFUSAL and never a
	 * trimming.
	 *
	 * <p><b>ADL, owner's decision of 21.09.2026: „Lozinka se ne podseca nigde. Razmak je
	 * legitiman znak u lozinki, pa je podsecanje tiha izmena tajne koju je covek izabrao."</b>
	 * Nothing in this class calls {@code strip} on a password: what is judged and what is
	 * stored is what he typed, space for space. What this method does is ask whether a box
	 * was filled in at all, which is the same question the portal's own form asks, and the
	 * boundary that follows is already recorded beside that decision - a password of nothing
	 * but spaces is refused as a box nobody answered rather than as one that is too short.
	 */
	private static boolean isNothing(String value) {
		return value == null || value.isBlank();
	}

	private static Done no(String reason) {
		return new Done(ResponseEntity.badRequest().body(new Refused(reason)), 0, null, null, 0);
	}
}
