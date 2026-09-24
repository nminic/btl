package com.btl.portal.web;

import com.btl.portal.domain.account.BreachedPasswords;
import com.btl.portal.domain.account.PasswordPolicy;
import com.btl.portal.domain.account.StoredPassword;
import com.btl.portal.domain.token.SecretToken;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

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
 * <p><b>WHAT THIS ROUTE DOES NOT DO, each named rather than discovered.</b>
 *
 * <ul>
 * <li><b>IT SENDS NO MESSAGE, AND THAT IS A DECISION OF THE OWNER'S THIS ROUTE DOES NOT YET
 * CARRY OUT.</b> The first draft of this paragraph said „PDL P22 decides what is mailed and
 * does not mention this", and that sentence was <b>false</b>. PDL P22, 11.08.2026: „Sest
 * obaveznih mejlova u prvoj verziji: kreiranje naloga i potvrda mejla, <b>promena lozinke</b>,
 * unet rezultat, promenjen rezultat, dodatni zahtev za verifikaciju, krupna izmena na
 * portalu", and beside it „Sest mejlova iz spiska su obavezni i clan ih ne moze iskljuciti."
 * It was found by running {@code btl-produkt/odluke-za-resurs.py} over this route, which is
 * exactly the class of fault that tool exists for: a claim about a precedent made from memory
 * instead of from a reading.
 * <p><b>So this is a GAP and not a boundary, and the difference is worth the word.</b> A
 * boundary is something nobody decided; this was decided, and the portal owes it. What is
 * missing is a {@link com.btl.portal.domain.mail.WhatTheMessageSays.Message} of its own, its
 * bundle key, and a {@code Postman} call AFTER the commit - which is the shape
 * {@link RegistrationApi} measured and wrote up at length, because a relay waiting inside an
 * open transaction holds a connection out of a pool of ten.
 * <p><b>It is not written on this branch because it is not this branch's subject</b>, and
 * inventing the text of a message the owner has not seen would be the portal promising a
 * warning in words nobody chose. It is named here so that the next reader finds it rather
 * than assuming the silence was decided.
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

	private final JdbcClient db;

	private final StoredPassword keeping;

	private final PasswordPolicy passwords;

	/**
	 * Both are built here rather than injected, which is what {@link PasswordResetApi} and
	 * {@link RegistrationApi} already do with the same pair: neither is a bean anywhere in
	 * this portal, and the list of leaked passwords {@link PasswordPolicy} reads is loaded
	 * once by {@code BreachedPasswords.fromResource} and held in memory by the object it
	 * hands back.
	 */
	MePasswordApi(JdbcClient db) {
		this.db = db;
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
	@Transactional
	ResponseEntity<Refused> change(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@CookieValue(name = SessionCookie.NAME) String carried,
			@RequestBody Change typed) {

		if (isNothing(typed.oldPassword()) || isNothing(typed.password())
				|| isNothing(typed.passwordRepeat())
				|| !typed.password().equals(typed.passwordRepeat())) {

			return no(THE_FORM_IS_NOT_COMPLETE);
		}

		/* FOR UPDATE, the same guard `SignInApi` puts on the row it reads before deciding
		   whether to spend it: two requests racing this one must not both read the old hash
		   and both write over it, which would leave the loser's password stored and the
		   winner told 204 about one that is not there. */
		Optional<String> stored = db.sql("select password_hash from account where id = ? for update")
				.param(asking.account())
				.query(String.class)
				.optional();

		/* AN ACCOUNT WITH NO PASSWORD AT ALL, which V18 makes a real state and the head of
		   this class says how one could be holding a session. `.optional()` answers empty
		   for a null column as well as for no row, and both are the same sentence here:
		   there is nothing stored for the old password to be. */
		if (stored.isEmpty() || !keeping.matches(typed.oldPassword(), stored.orElseThrow())) {
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
				.params(keeping.of(typed.password()), asking.account())
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
		db.sql("delete from account_session where account_id = ? and token_hash <> ?")
				.params(asking.account(), SecretToken.hashOf(carried))
				.update();

		return ResponseEntity.noContent().build();
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

	private static ResponseEntity<Refused> no(String reason) {
		return ResponseEntity.badRequest().body(new Refused(reason));
	}
}
