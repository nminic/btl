package com.btl.portal.web;

import com.btl.portal.domain.account.WhatAnAddressLooksLike;
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
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * THE SUPERADMIN MAKING A MODERATOR, TICKING HIS BOXES, AND TAKING HIS MODERATORSHIP
 * AWAY AGAIN.
 *
 * <p>The writing half of {@link ModeratorApi}, in a file of its own the way
 * {@link EventWriteApi} stands beside {@link CalendarApi}. It is the one resource on this
 * portal that is not about what a moderator may do to the league but about what he may do
 * at all: PDL P21, „Superadmin kreira moderatore i uređuje im prava pojedinačno, kao i što
 * ih menja i briše. Van toga, Superadmin i Moderator mogu isto" - so this is the whole of
 * „van toga", and every other route of the portal is the „isto".
 *
 * <p><b>{@link OnlyTheSuperadmin} and never {@link RightIsNeeded}, and that annotation's
 * own javadoc carries the reason at length.</b> The short of it: there is no box that
 * opens this, because the owner refused to create one - „Ne treba ni da postoji kolona
 * moderatori jer samo superadmin ima ta prava" (PDL P28a, 13.08.2026, „Moderatori nemaju
 * kolonu"), which is also why {@code admin_right} holds twelve codes and none of them is
 * {@code entity:moderators}. A moderator holding every one of the twelve is refused here
 * exactly as one holding none is, and that is the point rather than an edge of it: „Bez te
 * granice moderator bi sam sebi mogao da dodeli prava, pa granularna prava ne bi značila
 * ništa" (PDL P28a, 30.07.2026). The refusal is 404 and not 403 (ADL A8, owner
 * 13.09.2026), and it is not written here - it goes down the one road
 * {@link RightsAtTheDoor} takes.
 *
 * <p><b>THE ROW EITHER ROUTE THAT NAMES A KEY ACTS ON IS A MODERATOR, AND THAT ONE
 * CONDITION IS ALSO THE WHOLE OF PDL P28a's TWO PROHIBITIONS.</b> Both statements that
 * take an id join {@code role} and ask for {@code moderator}, which is the same condition
 * {@link ModeratorApi} serves the list by, so what may be written is exactly what may be
 * read - and the third route, which takes no key, WRITES that same word rather than
 * reading it, so it cannot make anything else either. The owner's sentence of
 * 11.08.2026 - „Superadmin ne sme da oduzme prava sebi ni poslednjem preostalom
 * Superadminu" - has two halves and they are not the same claim, so each is taken on its
 * own:
 *
 * <ul>
 * <li><b>„sebi".</b> A superadmin is not a moderator, so his own key finds no row here and
 * both routes answer 404 to it. He cannot be stripped because he holds nothing that is
 * kept in a table: „Superadmin nema kućice. On sme sve, uvek, i ne pojavljuje se u ovoj
 * tabeli kao neko kome se prava dodeljuju" (PDL P28a, 30.07.2026), and
 * {@link com.btl.portal.domain.rights.AdminRights} answers him yes off
 * {@code role.rights_mode} without reading a tick at all. A row written into
 * {@code account_admin_right} for him would change nothing he may do and would still be a
 * row in the table he is not in, so it is refused rather than ignored.
 * <li><b>„ni poslednjem preostalom Superadminu".</b> The same condition answers it, and
 * it answers it for a reason that does not count anything. Superadmin accounts may be
 * several - „superadminskih naloga sme da bude vise" (ADL A40, 14.09.2026), which
 * {@code role_only_one_holds_every_right} does not forbid because that index is over the
 * ROLE - so „the last one" is a question about a number of rows. This resource never asks
 * it, because the owner closed the question on the same day from a different side:
 * „posto uloga ne stoji kao zapis koji se dodeljuje, nego se izvodi iz podesavanja,
 * superadmin ne moze da se obrise ni razvlasti kroz portal uopste ... Zabrana ... postaje
 * nepotrebna po konstrukciji: nema radnje koja bi je prekrsila" (PDL P21, 14.09.2026,
 * „Superadmin se ne pravi kroz portal"). So a superadmin is refused here whether he is the
 * only one or one of several, and the answer does not move when a second one is written.
 * </ul>
 *
 * <p><b>The boundary in the other direction, said out loud because a route that refused
 * everybody would satisfy both bullets above.</b> A moderator IS made, IS re-ticked and IS
 * stripped, and that is the ordinary use of this screen; what is refused is an account
 * that is not one.
 *
 * <p><b>WHAT IS NOT HERE, EACH NAMED RATHER THAN DISCOVERED.</b>
 *
 * <ul>
 * <li><b>CHANGING his name and his address.</b> PDL P21 says the superadmin „menja"
 * moderators as well as their rights, and the screen edits both. {@link #add} WRITES a
 * name and an address, once; {@link #change} carries the row of boxes and nothing else, so
 * the day an edit is written it belongs in that same method rather than in a third one.
 * Until then a request naming them is refused by the shape of {@link Ticks}, which has no
 * field for either.
 * <li><b>The count of superadmins.</b> Named above: the owner closed it by construction on
 * 14.09.2026, and the place it would have lived is a resource over ACCOUNTS AND ROLES,
 * which this is not.
 * <li><b>Any say over who may read this.</b> {@link ModeratorApi} is where the list is
 * served and this file adds no condition of its own about who is asking; both routes ask
 * the door and the door answers for both.
 * </ul>
 *
 * <p><b>„OBRISI MODERATORA" NO LONGER DELETES AN ACCOUNT, AND THE ROW OF THIS FILE THAT
 * SAID IT DID IS GONE RATHER THAN QUALIFIED.</b> The owner, 19.09.2026, on three offered
 * outcomes: „«Obrisi moderatora» skida ulogu i prava, a nalog ostaje. Za coveka koji je i
 * takmicar to znaci da se i dalje prijavljuje na portal i da mu rezultati stoje netaknuti;
 * gubi samo moderatorstvo i sve kucice." His reason, in his own measure and not this
 * file's: „«prestaje da bude moderator» i «prestaje da postoji na portalu» su dve
 * razlicite radnje", and the second one already has its own road and its own occasion -
 * disqualification, with every result, decided off the portal and carried out by hand
 * (owner, 06.09.2026). The price he was shown and took: a moderator who never raced stays
 * as an account that can do nothing, and deleting THAT is a separate action written
 * separately.
 *
 * <p><b>Where the question came from is worth keeping, because it is the shape of the
 * mistake rather than one instance of it.</b> Until 19.09.2026 no decision covered this
 * at all, so the route did the thing that was easiest to write - it deleted the ACCOUNT -
 * and an independent review measured what that meant for the one person the decision of
 * 14.09.2026 had just created: a moderator who also races has ONE login for both, so
 * taking his moderatorship away left him in every table with every result and with no way
 * of signing in at all.
 *
 * <p><b>WHAT THE SCHEMA ANSWERED, AND WHY MOST OF IT IS NOW BESIDE THE POINT.</b> The
 * paragraph that stood here listed the four cascades a {@code delete from account} set
 * off, and every one of them is now a thing that does NOT happen: his sessions
 * ({@code account_session_account_fk}), his tokens
 * ({@code password_reset_token_account_fk}, {@code email_verification_token_account_fk})
 * and the decisions he made ({@code verification_decided_by} beside
 * {@code decided_by_name}, V9/V16) all stay exactly where they were, because the row they
 * hang off stays. What is taken from him is written here in two statements rather than
 * read off a foreign key:
 *
 * <ul>
 * <li><b>His role,</b> which is what every reader of „is this man a moderator" asks -
 * {@link ModeratorApi}'s list, both keys of this file, {@link WhatHeMayDo} (and through it
 * {@link RightsAtTheDoor} and {@link VerificationApi}), and {@link WhoIsAsking}, which is
 * what {@code /api/me} draws the portal from.
 * <li><b>And his ticks,</b> explicitly, because {@code account_admin_right_account_fk}
 * only cascades when the account goes and the account no longer goes. Left behind they
 * would be inert today - {@link com.btl.portal.domain.rights.AdminRights} reads
 * {@code rights_mode} first and the roles he can become both hold {@code none} - and would
 * come back to life the day somebody made him a moderator again, which is the superadmin
 * handing out a set of rights he never ticked.
 * </ul>
 *
 * <p><b>WHICH ROLE HE IS LEFT WITH IS DECIDED BY WHETHER HE RACES, and that is derived
 * from the owner's sentence rather than chosen.</b> He named two different men and gave
 * them two different outcomes, so one role for both would make his two halves one. V5 has
 * four roles and two of them hold {@code rights_mode = 'none'}, so nothing about
 * PERMISSION turns on the choice; what turns on it is what the portal calls him, which is
 * {@code isMember(role)} in {@code frontend/src/roles/context.ts} - „Everything a
 * competitor sees, moderators and superadmin see too", and it is false for
 * {@code visitor} alone. The fact that tells the two men apart is
 * {@code account.competitor_id}, which V23 put there for exactly this distinction:
 * „Empty for a moderator who does not race, which is the ordinary case and not a fault."
 *
 * <ul>
 * <li><b>He names a member, so he becomes a {@code competitor}</b>, which is the role
 * {@link RegistrationApi} writes for everybody who races. <b>The boundary the other
 * way:</b> written {@code visitor}, a man whose member record and results are untouched
 * would be shut out of the screens that show them, and the owner's „i dalje se prijavljuje
 * na portal i rezultati stoje netaknuti" would be half true - he would sign in and see
 * nothing of his own.
 * <li><b>He names nobody, so he becomes a {@code visitor}</b>, which is the owner's
 * „ostaje kao nalog koji nista ne moze" said as a role. <b>The boundary the other way:</b>
 * written {@code competitor}, the portal would call a man a member of the league while
 * {@code account.competitor_id} is empty and no row of {@code competitor} is his, so
 * {@code isMember} would answer yes for somebody the register of members does not hold and
 * every screen reading a member off the account would find nothing.
 * </ul>
 *
 * <p><b>AND HIS SESSION IS NOT ENDED, which is a decision and the one thing about this
 * that could have been written either way.</b> {@link PasswordResetApi} deletes every
 * session of an account it touches, and it has a reason this does not: there the PASSWORD
 * changed, so a cookie minted with the old one is a cookie its owner may not have asked
 * for. Here nothing about who he is has moved. What a cookie opens is read fresh on every
 * request - {@link WhoIsAsking} joins {@code role} on each one and {@link WhatHeMayDo}
 * reads the mode and the ticks on each one - so the door shuts at his very next request
 * without a row being deleted, and for the man who races, signing him out would be the
 * portal ending a session it has just decided he is entitled to keep.
 *
 * <p><b>HIS MEMBER RECORD IS STILL NOT HIS ACCOUNT, and that sentence outlived the
 * deletion it was written about.</b> {@code account_competitor_fk} is
 * {@code on delete restrict} - the one such key in this schema that guards a PERSON rather
 * than a codebook (V23, owner, 14.09.2026) - and nothing here writes
 * {@code competitor_id} in either direction. Taking a man's moderatorship away therefore
 * leaves the competitor, his results and his membership exactly where they were, and a
 * member who asks to go is still two steps (PDL P23).
 */
@RestController
class ModeratorWriteApi {

	private static final Logger LOG = LoggerFactory.getLogger(ModeratorWriteApi.class);

	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	static final String A_RIGHT_THE_MATRIX_DOES_NOT_HOLD = "aRightTheMatrixDoesNotHold";

	/**
	 * Mirrors {@code RegistrationApi.THE_ADDRESS_IS_TAKEN}, and it is the same sentence
	 * for the same reason: one address is one account (owner, 08.09.2026), so an address
	 * somebody already holds cannot be given a second one and the form has to say which of
	 * the two things went wrong.
	 *
	 * <p><b>Saying it out loud costs nothing HERE that it costs on registration.</b> The
	 * cost the owner weighed there was that anybody at all could ask the portal whether an
	 * address belongs to a member; this route answers only the superadmin, who reads the
	 * whole list of moderators on the next screen along and the whole list of members on
	 * the one after that.
	 */
	static final String THE_ADDRESS_IS_TAKEN = "theAddressIsTaken";

	/**
	 * Told apart from {@link #THE_FORM_IS_NOT_COMPLETE} because they are different
	 * mistakes, which is the shape {@code THE_LINK_IS_NOT_SHAPED} and
	 * {@code THE_REFERENCE_IS_NOT_SHAPED} already use one resource along: a field that is
	 * not there is one the superadmin goes back and fills in, and a field that is there and
	 * wrong is one he has to look at.
	 */
	static final String THE_ADDRESS_IS_NOT_SHAPED = "theAddressIsNotShaped";

	private final JdbcClient db;

	private final Postman postman;

	/**
	 * Written by hand rather than left on the method, the same choice {@link PaymentApi}
	 * and {@link EventWriteApi} made and for the same reason: a row of boxes is saved as
	 * one thing, so the ticks taken away and the ticks given must all happen or none of
	 * them. Half of it written down is a moderator holding a set the superadmin never
	 * ticked.
	 *
	 * <p>The same is true of both routes added since: an account written without its
	 * invitation is a moderator nobody can reach, and a moderatorship taken away without
	 * the ticks going with it is a set of rights waiting to come back.
	 */
	private final TransactionTemplate inOneTransaction;

	/**
	 * A FOURTH CONSTRUCTOR THAT BUILDS A {@code Portal} OUT OF CONFIGURATION, beside
	 * {@link RegistrationApi}'s, {@link EmailConfirmationApi}'s and
	 * {@link PasswordResetApi}'s. {@code WhatTheMessageSays} says why it may not be built
	 * out of anything that arrived with a request, and why the number of such
	 * constructors is deliberately not asserted anywhere: what is asserted is the
	 * property, one source refused at start up, and a fourth sender would only make a
	 * count stale.
	 */
	private final Portal portal;

	ModeratorWriteApi(JdbcClient db, Postman postman, TransactionTemplate inOneTransaction,
			@Value("${btl.portal.address}") String address) {
		this.db = db;
		this.postman = postman;
		this.inOneTransaction = inOneTransaction;
		this.portal = new Portal(address);
	}

	/**
	 * WHAT THE SUPERADMIN TYPES TO MAKE A MODERATOR: three fields and no fourth.
	 *
	 * <p>„Superadmin upise ime, prezime i adresu elektronske poste" (owner, PDL P28a,
	 * 18.09.2026), and the list is closed by the same sentence that opens it. <b>There is
	 * no password field and there must never be one</b> - the owner refused that outcome
	 * by name, because a password typed here travels through a second person and an
	 * unencrypted channel. <b>There is no role field either</b>, for the reason
	 * {@link RegistrationApi} gives at its own form: a form that could name its own role
	 * is a form somebody registers a superadmin with. <b>And there are no ticks</b>: a
	 * moderator who may do nothing yet is the ordinary state this screen exists to end,
	 * and {@link #change} is what ends it.
	 *
	 * @param firstName the name on the ACCOUNT, which is not the name in the register of
	 *                  members even for a moderator who is also one (V23, owner
	 *                  14.09.2026); a moderator need not be a member at all, so there is
	 *                  nowhere else it could come from
	 */
	record Invited(String firstName, String lastName, String email) {
	}

	/**
	 * @param email the address as the ROW carries it, which is folded to lower case and is
	 *              therefore not always what was typed
	 *              ({@code WhatAnAddressLooksLike.asItIsStored}, owner 08.09.2026). Read
	 *              back rather than echoed, for the reason {@link Ticked} gives: the two
	 *              agree whenever the write worked, which is exactly why echoing looks
	 *              right, and the address the message went to is the row's own
	 */
	record Made(long id, String email) {
	}

	/**
	 * MAKING A MODERATOR, WHO SETS HIS OWN PASSWORD THROUGH A LINK.
	 *
	 * <p><b>The owner, 18.09.2026, on three offered outcomes:</b> „Nov moderator dobija
	 * pozivnicu na mejl, a lozinku postavlja sam. Superadmin upise ime, prezime i adresu
	 * elektronske poste; portal posalje link za postavljanje lozinke, ISTIM MEHANIZMOM
	 * KOJI OBNOVA LOZINKE VEC NOSI. Nalog do tog trenutka nema lozinku i ne moze da se
	 * prijavi." He refused the two alternatives by name: upgrading an existing account,
	 * which would make every moderator a competitor first and collide with „moderator ne
	 * mora da bude clan" of 14.09.2026; and a temporary password read out to him off the
	 * portal, which puts a password through a second person and an unencrypted channel.
	 *
	 * <p><b>„Istim mehanizmom" IS THE WHOLE OF HOW THIS IS WRITTEN, and ADL A53 of the
	 * same day says what it forbids:</b> „Pozivnica je isti put sa drugim povodom, i pise
	 * se kao JEDAN POVOD VISE, ne kao druga tabela i drugi razred. Dva doma jedne cinjenice
	 * («ovaj token otvara postavljanje lozinke») bi se prvog dana razisla u roku ili u
	 * duzini." So the row minted below is a {@code password_reset_token} (V18), it is the
	 * same 256 bits kept as a digest and ended by the column's own default, the screen it
	 * points at is the reset's own, and the request that spends it is
	 * {@code POST /api/password-reset} - none of which is touched here. What is new is one
	 * constant in {@link Message}, which is where an occasion belongs, and the words that
	 * go with it.
	 *
	 * <p><b>THE ACCOUNT IS BORN WITH NO PASSWORD, AND SINCE 18.09.2026 THAT IS A STATE
	 * WITH A NAME.</b> ADL A53: „Nalog bez lozinke prestaje da bude slucajnost i postaje
	 * stanje sa imenom... Provera {@code account_password_hash_shape} time dobija svoj
	 * razlog i ne sme da se stegne." {@code password_hash} is simply not in the statement
	 * below, and {@code SignIn.decide} refuses such an account in the same breath as one
	 * that is locked - which is the boundary ADL A53 says must be MEASURED rather than
	 * assumed, because this is the first time such an account exists on purpose.
	 *
	 * <p><b>AND THE ADDRESS IS NOT CONFIRMED HERE, WHICH IS THE OWNER'S DECISION OF
	 * 19.09.2026 AND REPLACES WHAT THIS ROUTE DID FOR ONE ROUND.</b> In his words, on three
	 * offered outcomes: „Potvrda adrese se upisuje u trenutku kad se TOKEN POTROSI.
	 * Moderator otvori vezu iz pozivnice i postavi lozinku; tog trenutka je dokazao da cita
	 * tu postu, pa se adresa obelezava potvrdjenom." He refused confirming it at this
	 * moment, because the portal would be writing down a proof that has not happened and
	 * „potvrda adrese je prva, i uslov za sve ostalo" (PDL, 31.07.2026); and he refused a
	 * second message that only confirms, because that is two letters per account for six
	 * people.
	 *
	 * <p><b>The round this replaced is worth keeping, because the reasoning was wrong in a
	 * way that reads as careful.</b> This route wrote {@code email_confirmed_at = now()} on
	 * the argument that nothing would ever fill it in, so the man would set his password
	 * and still never get in. An independent review measured the premise and it was false:
	 * {@code POST /api/email-confirmation/resend} asks for {@code email_confirmed_at is
	 * null} and nothing else - not a password, not a role - so the invited moderator could
	 * always have confirmed his own address. The argument was not weighed against a
	 * measurement, and a confirmation written where no proof arrived is a record of
	 * something that did not happen.
	 *
	 * <p><b>So until his token is spent the account is shut twice over</b>, and both are
	 * read by {@code SignIn.decide}: no confirmation, and no password.
	 *
	 * <p><b>Nothing here writes {@code competitor_id}</b>, which is „moderator ne mora da
	 * bude clan" (owner, 14.09.2026) said as a statement rather than as a comment: the
	 * column stays empty, V23 says that is the ordinary case, and {@link #remove} reads
	 * exactly that column to decide what he becomes when his moderatorship goes.
	 *
	 * <p><b>THE MAPPING DOES NOT SAY WHAT IT CONSUMES, unlike {@link TeamWriteApi}'s own
	 * {@code POST}, and the difference was measured rather than assumed.</b> That route
	 * declares it because a request with no {@code Content-Type} would otherwise be
	 * answered 415 - „this address is here and takes something else" - where an unmapped
	 * address answers 404, and its door opens to any member, so anybody signed in could
	 * read that sentence. This door opens to one account, which already reads the whole
	 * list of moderators at this very path, and
	 * {@code ModeratorWriteApiTest.aPostWithNoContentTypeSaysNothingToAnybodyWhoMayNotAsk}
	 * is where that is a number rather than this paragraph: a moderator holding every tick
	 * there is and a plain member are both answered 404 with an empty body.
	 *
	 * <p><b>The write and the message are in this order and the order is the whole of
	 * it</b>, which is {@code RegistrationApi.writeThenSend}'s measurement and not a habit:
	 * a request that waits on somebody else's SMTP server with a transaction open holds one
	 * connection of a pool of ten, and that file carries what it was measured to do to
	 * everybody else's requests.
	 */
	@PostMapping("/api/moderators")
	@OnlyTheSuperadmin
	ResponseEntity<?> add(@RequestBody Invited typed) {
		/* WHICH FIELDS ARE MISSING AND NOT ONLY THAT SOMETHING IS, which is the second half
		   of ADL A54 („`PUT` koji ne posalje neko polje odbija se sa 400, i KAZE SE STA
		   FALI. Isto na svakoj upisnoj ruti portala, bez izuzetka", owner, 19.09.2026). The
		   shape is `RaceWriteApi`'s, down to `reason` standing first so that a caller
		   reading a refusal by its reason reads this one unchanged.

		   A ROUTE WRITTEN AFTER THAT DECISION IS BORN WITH IT. The outstanding work on the
		   other routes is about bringing the ones that came BEFORE it into line, and a new
		   one that answered a bare reason would be one more of them. */
		List<String> missing = whatTheFormLeftOut(typed);

		if (!missing.isEmpty()) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST)
					.body(new NotComplete(THE_FORM_IS_NOT_COMPLETE, missing));
		}

		/* FOLDED ON THE WAY IN, never left as typed and asked about through `lower()`
		   afterwards - `WhatAnAddressLooksLike.asItIsStored` carries the owner's decision
		   of 08.09.2026 and what the other shape cost on 14.09.2026. And the SHAPE is
		   judged after the fold, which is the order that class asks for: folding can turn
		   a character outside the range into one inside it, and that is the direction that
		   makes a homoglyph collide with the address it imitates instead of becoming a
		   second account beside it. */
		String address = WhatAnAddressLooksLike.asItIsStored(typed.email());

		/* THE SHAPE IS JUDGED HERE AND NOT LEFT TO `account_email_shape`, for the reason
		   `WhatAnAddressLooksLike` gives at length: the constraint is an ERROR, so an
		   address with no @ in it would reach INSERT, fire the check, and come back to the
		   superadmin as a 500 - and on PostgreSQL an error aborts the transaction, so the
		   409 the next lines want to answer with could not be written from there either. */
		/* AND A DIFFERENT SENTENCE FROM THE ONE ABOVE, because they are different mistakes
		   and the superadmin fixes them differently: a field he forgot is one he goes back
		   and fills in, and an address that is not an address is one he has already typed
		   and has to look at. Answered with the same word, the screen can only say „the
		   form is not complete" over a form in which every field is filled. */
		if (!WhatAnAddressLooksLike.itDoes(address)) {
			return no(HttpStatus.BAD_REQUEST, THE_ADDRESS_IS_NOT_SHAPED);
		}

		Written written = inOneTransaction.execute(committing -> write(typed, address));

		if (written.invitation() != null) {
			send(written);
		}

		return written.answer();
	}

	/** The answer, and what the message still needs - {@code RegistrationApi.Made}'s shape
	 *  and for its reason: the sending happens after the transaction has gone. */
	private record Written(ResponseEntity<?> answer, String to, String invitation) {
	}

	private Written write(Invited typed, String address) {
		/* ASKED ONCE, BY THE INDEX ITSELF, which is `RegistrationApi`'s shape and its
		   reason: a `select` followed by an `insert` are two moments, and a second request
		   arriving between them reads the same empty answer, writes, and leaves the first
		   to collide with `account_email_unique` - a collision that aborts the transaction,
		   so the 409 could not be answered from inside it.

		   `((lower(email)))` AND NOT `(email)`, because that is the index there is. V6
		   writes uniqueness over `lower(email)` (owner, 08.09.2026, one address is one
		   account whatever case it is typed in), and `on conflict (email)` names no
		   constraint this table has - it does not fall through to the other one, it fails
		   outright. */
		Optional<Made> made = db.sql("insert into account"
						+ " (first_name, last_name, email, role_id)"
						/* THE ROLE IS WRITTEN HERE AND NEVER TAKEN OFF THE REQUEST - see
						   `Invited`. And it is `moderator` rather than anything else because
						   that is the one role this screen makes: „Pozivnica vazi samo za
						   moderatore" (ADL A53), and the superadmin „se i dalje ne pravi kroz
						   portal nego se imenuje adresom u podesavanjima servera" (owner,
						   14.09.2026, PDL P21). */
						/* AND `email_confirmed_at` IS NOT IN THAT LIST EITHER, which is the
						   owner's decision of 19.09.2026 and replaces what this route did for
						   one round. V6 gives the column no default so that an account is born
						   unconfirmed, and being MADE is not being confirmed: the proof this
						   column stands for is that a man reads that mailbox, and at this
						   moment nobody has read anything. See `PasswordResetApi`, where the
						   proof arrives and the column is written. */
						+ " values (?, ?, ?, (select id from role where code = 'moderator'))"
						+ " on conflict ((lower(email))) do nothing"
						+ " returning id, email")
				.params(typed.firstName().strip(), typed.lastName().strip(), address)
				.query((row, one) -> new Made(row.getLong(1), row.getString(2)))
				.optional();

		if (made.isEmpty()) {
			return new Written(no(HttpStatus.CONFLICT, THE_ADDRESS_IS_TAKEN), null, null);
		}

		SecretToken invitation = SecretToken.fresh();

		/* A FRESH ROW, NEVER A REUSED ONE, and here there is nothing to reuse: the account
		   was written one statement ago. It is the same table a reset writes into, which is
		   ADL A53's „jedan povod vise" - and `account_id` carries no unique key on it
		   (V18), so the day the superadmin makes a second attempt, or the man asks for a
		   reset of his own, neither retires the other. */
		db.sql("insert into password_reset_token (account_id, token_hash) values (?, ?)")
				.params(made.orElseThrow().id(), invitation.hash()).update();

		/* SENT TO THE ROW'S OWN SPELLING AND NOT TO WHAT WAS TYPED, the same choice
		   `PasswordResetApi` and `RegistrationApi.theLinkToSend` make: the row is what the
		   account will be found by afterwards, and a message addressed to what was typed is
		   a message this portal sent to a mailbox the account does not live at. */
		return new Written(ResponseEntity.status(HttpStatus.CREATED).body(made.orElseThrow()),
				made.orElseThrow().email(), invitation.secret());
	}

	/**
	 * THE INVITATION, SENT AFTER THE TRANSACTION AND THEREFORE UNABLE TO UNDO IT.
	 *
	 * <p><b>It goes at once and never into a queue,</b> which is ADL A4c's first kind -
	 * „vezana za radnju... odmah, i nikad se ne odlaze" - and the invitation belongs there
	 * for the reason that row exists rather than by resemblance to the „obnova lozinke"
	 * named in it. The three kinds are sorted by who is waiting: the first two are caused
	 * by a person and have priority, and only the reminder, which the portal sends of its
	 * own accord, may wait. Here the link IS the account - until it arrives the man has no
	 * way in at all - so there is nothing a queue could do but keep him out longer. The
	 * daily cap that row is about cannot be reached either: one message per moderator ever
	 * made.
	 *
	 * <p><b>A relay that will not take it is not an error the superadmin can act on.</b>
	 * The account is there, the token is there, and nothing he can press at this screen
	 * produces a letter; answering 500 would tell him nothing happened when everything did,
	 * and send him to type the address again at a form that would now answer 409. What
	 * rescues it is the same road one occasion along: {@code POST /api/password-reset/request}
	 * asks nothing about a role or a confirmation, so it mails another link to the same
	 * mailbox, and spending THAT one sets the password and confirms the address exactly as
	 * spending this one would have.
	 */
	private void send(Written written) {
		try {
			postman.send(WhatTheMessageSays.about(Message.INVITED_AS_A_MODERATOR, portal,
					written.invitation()), written.to());
		} catch (MailException theRelayDidNotTakeIt) {
			LOG.warn("an invitation to {} did not go out; a password reset request at the same"
					+ " address is what gets him another link", written.to(),
					theRelayDidNotTakeIt);
		}
	}

	/**
	 * Which of the three the superadmin did not fill in, by the names the JSON uses.
	 *
	 * <p>Blank, empty and absent are one answer here, because the fix is one thing - type
	 * it in - and because the schema treats them as one too: {@code first_name} is
	 * {@code not null} AND {@code btrim(first_name) <> ''} (V23), so a name of one space is
	 * refused by the table exactly as an absent one is. A route that told them apart would
	 * be saying something the database does not.
	 *
	 * <p>The order is the order of {@link Invited}, which is the order of the form.
	 */
	private static List<String> whatTheFormLeftOut(Invited typed) {
		List<String> missing = new ArrayList<>();

		if (isNothing(typed.firstName())) {
			missing.add("firstName");
		}
		if (isNothing(typed.lastName())) {
			missing.add("lastName");
		}
		if (isNothing(typed.email())) {
			missing.add("email");
		}

		return missing;
	}

	/** Blank, empty or absent, which the form treats as one thing because the fix is one
	 *  thing: type it in. */
	private static boolean isNothing(String typed) {
		return typed == null || typed.isBlank();
	}

	/**
	 * ONE ROW OF THE MATRIX, WHOLE.
	 *
	 * <p>„Prava se zadaju kućicama u tabeli: red je moderator, kolone su prava" (PDL P28a,
	 * 30.07.2026), and what a row of boxes sends when it is saved is the boxes that are
	 * on - not one box and which way it moved. That is what makes this a {@code PUT}: sent
	 * twice it says the same thing, and two superadmins saving the same row cannot leave it
	 * holding the union of what each of them saw.
	 *
	 * @param rights codes as {@code admin_right.code} generates them, {@code entity:events}
	 *               or {@code queue:payments}; an empty list is a moderator who may do
	 *               nothing, which is a real state and the one this screen exists to end
	 */
	record Ticks(List<String> rights) {
	}

	/** Why a row of boxes could not be written. */
	record Refused(String reason) {
	}

	/**
	 * A refusal that also says WHICH fields are missing, which is ADL A54's second half
	 * („i kaze se sta fali", owner, 19.09.2026).
	 *
	 * <p>{@code reason} stands first and carries the same word a {@link Refused} would, so
	 * a caller that reads a refusal by its reason reads this one unchanged: the list is
	 * what is added and not what is swapped. This is {@link RaceWriteApi}'s shape, named
	 * rather than reinvented, and {@code missing} carries the components of {@link Invited}
	 * so the names that come back are the names the JSON uses.
	 *
	 * <p><b>Only {@link #add} sends it, and {@link #change} still answers a bare reason.</b>
	 * That is the outstanding half of A54 over routes written BEFORE the decision, carried
	 * as separate work; this one was written after it and is born with it.
	 */
	record NotComplete(String reason, List<String> missing) {
	}

	/**
	 * @param rights what the TABLE holds afterwards, read back rather than echoed, so an
	 *               answer cannot agree with a request the database refused
	 */
	record Ticked(long id, List<String> rights) {
	}

	/**
	 * CHANGING WHAT ONE MODERATOR MAY DO.
	 *
	 * <p><b>A box already ticked is not ticked again, and that is the schema's sentence
	 * rather than an optimisation.</b> V18: „THE PAIR IS THE KEY, so a right is granted
	 * once. Ticking a box that is already ticked is not a second fact." Emptying the row
	 * and writing it back would move {@code granted_at} on every box that did not change,
	 * so the day somebody asks when a moderator was given something the answer would be the
	 * last time anybody pressed Save. What is written is therefore the difference: the
	 * boxes that went off are deleted, the boxes that came on are inserted, and the ones
	 * that stayed on are not touched at all.
	 *
	 * <p><b>A code the matrix does not hold is refused as a SENTENCE and never as a server
	 * fault</b>, which is the shape {@link EventWriteApi} uses one resource along.
	 * {@code account_admin_right_right_fk} would refuse it anyway (V18), but as a
	 * constraint violation - a 500 reaching the superadmin after he had filled the screen
	 * in. And the codes it refuses are not a curiosity: {@code entity:moderators} is
	 * precisely the code that does not exist, by the owner's decision of 13.08.2026, so
	 * this line is where „moderators have no column" stops being a comment.
	 *
	 * <p><b>What it is compared against is read out of {@code admin_right}</b> and is not a
	 * list of twelve written here. A list would go on saying „the matrix" while meaning
	 * „the twelve I knew about", and the thirteenth right added tomorrow would be refused
	 * by a file nobody thought to open.
	 */
	@PutMapping("/api/moderators/{id}")
	@OnlyTheSuperadmin
	ResponseEntity<?> change(@PathVariable long id, @RequestBody Ticks typed) {
		/* A REQUEST THAT NAMES NO LIST AT ALL IS NOT A MODERATOR WHO MAY DO NOTHING. The
		   two are one field apart in the body and opposite in meaning, and read as the
		   second a request that lost its field on the way would quietly strip somebody of
		   everything. An empty list says that in as many words and is accepted. */
		if (typed.rights() == null) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		Set<String> asked = new HashSet<>(typed.rights());

		return inOneTransaction.execute(committing -> {
			Optional<Long> moderator = moderatorNamed(id);

			/* THE SAME ANSWER SOMEBODY WHO MAY NOT ASK GETS, and that is deliberate: an
			   account that is not a moderator - a competitor, a superadmin, a key nobody
			   holds - and a row the door would have refused read the same. It is ADL A8
			   applied to a row rather than to a route, and it is also both halves of
			   PDL P28a's „ne sme da oduzme prava sebi ni poslednjem preostalom Superadminu",
			   for the reason the header gives. */
			if (moderator.isEmpty()) {
				return no(HttpStatus.NOT_FOUND, null);
			}

			if (!theMatrixHolds().containsAll(asked)) {
				return no(HttpStatus.BAD_REQUEST, A_RIGHT_THE_MATRIX_DOES_NOT_HOLD);
			}

			Set<String> held = new HashSet<>(ticksOf(moderator.get()));

			for (String gone : minus(held, asked)) {
				db.sql("delete from account_admin_right where account_id = ? and right_code = ?")
						.params(moderator.get(), gone).update();
			}

			for (String given : minus(asked, held)) {
				db.sql("insert into account_admin_right (account_id, right_code) values (?, ?)")
						.params(moderator.get(), given).update();
			}

			/* READ BACK OUT OF THE TABLE AND NOT HANDED BACK OFF THE REQUEST. The two agree
			   whenever the write worked, which is what makes echoing it look right; the
			   screen redraws itself from this answer, so a resource that echoed would draw
			   a row of boxes nobody had written. */
			return ResponseEntity.ok(new Ticked(moderator.get(), ticksOf(moderator.get())));
		});
	}

	/**
	 * AND TAKING A MODERATOR'S MODERATORSHIP AWAY, WHICH IS NOT TAKING HIS ACCOUNT AWAY.
	 *
	 * <p>Two statements, and the class comment carries the owner's decision of 19.09.2026
	 * at length, what it replaced, and why the role he is left with is read off
	 * {@code account.competitor_id}.
	 *
	 * <p><b>THE TWO STATEMENTS ARE ONE TRANSACTION, and neither half is any use without
	 * the other.</b> The role alone leaves a set of ticks that come back to life the moment
	 * anybody is made a moderator at that key again; the ticks alone leave a man on the
	 * moderators' screen with an empty row, which is what a moderator who has just been
	 * MADE looks like.
	 *
	 * <p><b>Nobody is told, and that is named rather than left silent.</b> Nothing here
	 * writes a row into {@code message}. No decision asks for one; the nearest thing
	 * recorded to „is somebody told when something of his disappears" is the owner's answer
	 * of 11.08.2026 about a member whose result goes with a deleted race, in one word:
	 * „Ne". Reading that across to a man's own moderatorship is reasoning and not his
	 * sentence, so it is written here as the reason the route stays silent rather than as a
	 * decision it enforces.
	 */
	@DeleteMapping("/api/moderators/{id}")
	@OnlyTheSuperadmin
	ResponseEntity<?> remove(@PathVariable long id) {
		return inOneTransaction.execute(committing -> {
			/* THE ROLE IS IN THE STATEMENT AND NOT IN A READING BEFORE IT, which is what
			   this route said when it was a delete and is not weakened by becoming an
			   update: asked as a select and then a write, the two would be two moments, and
			   the condition that keeps a superadmin out of this would be standing in the
			   first of them. The count it hands back is what the row WAS, so a second call
			   at the same key finds no moderator and answers 404 - which is the same answer
			   deleting him twice used to give.

			   AND WHAT HE BECOMES IS READ OFF THE ROW BEING WRITTEN, `a.competitor_id`, in
			   the same statement. Read beforehand it would be a second moment; read off the
			   request it would be the superadmin deciding whether a man is a member. */
			int stripped = db.sql("update account a"
							+ " set role_id = (select becomes.id from role becomes"
							+ "   where becomes.code = case when a.competitor_id is null"
							+ "     then 'visitor' else 'competitor' end)"
							+ " from role r"
							+ " where r.id = a.role_id and a.id = ? and r.code = 'moderator'")
					.param(id).update();

			if (stripped == 0) {
				return no(HttpStatus.NOT_FOUND, null);
			}

			/* AND THE BOXES GO WITH THE ROLE, in a statement rather than in a cascade.
			   `account_admin_right_account_fk` is `on delete cascade` (V18) and cascades
			   when the ACCOUNT goes, which from 19.09.2026 it does not. „Gubi samo
			   moderatorstvo i sve kucice" is one sentence with two halves, and this is the
			   second. */
			db.sql("delete from account_admin_right where account_id = ?").param(id).update();

			return ResponseEntity.noContent().build();
		});
	}

	/**
	 * This key, if it belongs to a moderator.
	 *
	 * <p>The condition is {@link ModeratorApi}'s own, so the set that may be written is the
	 * set that is served. Read as „an account" it would reach a competitor and a
	 * superadmin; read as „an account with administrative standing" it would still reach
	 * the superadmin, who is the one this must not reach.
	 */
	private Optional<Long> moderatorNamed(long id) {
		return db.sql("select a.id from account a join role r on r.id = a.role_id"
						+ " where a.id = ? and r.code = 'moderator'")
				.param(id).query(Long.class).optional();
	}

	/** Every box the matrix holds, off the table that holds them. */
	private Set<String> theMatrixHolds() {
		return new HashSet<>(db.sql("select code from admin_right").query(String.class).list());
	}

	/**
	 * What one account holds, in the order {@link ModeratorApi} answers the list in, so the
	 * row this hands back and the row the screen reloads cannot come out differently
	 * ordered.
	 */
	private List<String> ticksOf(long account) {
		return db.sql("select right_code from account_admin_right where account_id = ?"
				+ " order by right_code").param(account).query(String.class).list();
	}

	/**
	 * Everything in the first that is not in the second, in an order that does not depend
	 * on how a hash fell.
	 *
	 * <p>Sorted because the rows it names are then locked in the same order by every
	 * request there is. Two superadmins saving two rows that overlap would otherwise take
	 * their locks in whatever order two hash sets happened to iterate in, which is the
	 * shape a deadlock has; it costs one word and removes a failure nobody could reproduce.
	 */
	private static List<String> minus(Set<String> these, Set<String> those) {
		return these.stream().filter(one -> !those.contains(one)).sorted().toList();
	}

	/**
	 * A refusal, with a reason where there is one to give.
	 *
	 * <p>404 carries no body, which is the shape {@link RightsAtTheDoor} answers a refused
	 * moderator with: an account this may not touch and one that is not there have to read
	 * the same, and a reason is something only one of them could have.
	 */
	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return reason == null ? ResponseEntity.status(status).build()
				: ResponseEntity.status(status).body(new Refused(reason));
	}
}
