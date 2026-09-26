package com.btl.portal.web;

import com.btl.portal.domain.account.WhatAnAddressLooksLike;
import com.btl.portal.domain.mail.WhatTheMessageSays;
import com.btl.portal.domain.mail.WhatTheMessageSays.Message;
import com.btl.portal.domain.mail.WhatTheMessageSays.Portal;
import com.btl.portal.domain.member.ReferralCode;
import com.btl.portal.domain.registration.Guardianship;
import com.btl.portal.domain.registration.WhatRegistrationAsksFor;
import com.btl.portal.domain.rights.TheNamedSuperadmin;
import com.btl.portal.domain.registration.WhatAFieldMeans;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import com.btl.portal.mail.Postman;
import com.btl.portal.web.ATownFromTheCodebookOrTyped.Town;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.MailException;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * THE WRITING HALF OF {@link CompetitorApi}: ENTERING MEMBERS IN A GROUP, AND DELETING ONE.
 *
 * <p><b>Two acts in one file, which is {@link ModeratorWriteApi}'s arrangement and its
 * reason:</b> the writing of a resource lives beside the reading of it, and a second write
 * class for one resource would be a second place to look for who may change a member.
 * {@link #enter} is the entering and {@link #remove} is the deleting; what each is for is at
 * its own method, and what follows here is the deleting, because it is the older of the two
 * and its reasoning is the longer.
 *
 * <p><b>ENTERING, IN ONE SENTENCE, AND {@link #enter} CARRIES THE REST.</b> PDL P8b, owner,
 * 25.09.2026: the button for entering a member in the administration is „grupni unos koji
 * salje pozivnice". Nobody is given an account he can use - he is given a row, and a link he
 * sets his own password on.
 *
 * <h2>Deleting a member</h2>
 *
 * <p>DELETING A MEMBER IS THE ONE ADMINISTRATIVE ACT THE OWNER LEFT IN THE PORTAL AFTER HE
 * TOOK THE WHOLE DISCIPLINARY PROCEDURE OUT OF IT.
 *
 * <p>PDL P21, owner, 06.09.2026: „sve u vezi suspenzije se resava van portala, a
 * administrator / moderator nakon odluke samo obrisu clana ako je to odluceno." And PDL P23,
 * owner, 11.08.2026, on what deletion means: „Ne postoje arhivirani takmicari. Ili ce biti
 * skriven profil jer nema aktivno clanstvo, ili ce biti obrisan zauvek sa svim svojim
 * profilom i rezultatima, a na mestima gde se pominje bice anonimizovan."
 *
 * <p><b>ALMOST NONE OF THE DELETING IS IN THIS FILE, AND THAT IS THE DESIGN RATHER THAN AN
 * OMISSION.</b> The schema already sorts every row that points at a member into what is HIS
 * and goes with him ({@code on delete cascade}: his results, his submissions, his payments,
 * his memberships, his pairs, his invitations, his ducats, his messages) and what merely
 * NAMES him and keeps its own existence ({@code on delete set null}: the seat of a team or
 * a league, a comment he wrote, a frozen season's row). One statement here sets all of it
 * going. V23 wrote that sorting down at length and this class is what finally pulls the
 * lever.
 *
 * <p><b>FOUR THINGS THE CASCADE CANNOT DO, AND THEY ARE THE WHOLE OF THIS CLASS.</b>
 *
 * <ul>
 * <li><b>The account has to be decided first.</b> {@code account_competitor_fk} is
 * {@code on delete restrict} (V23) - the only key in this schema that guards a person
 * rather than a codebook - and the owner put it there on 14.09.2026 so that anonymising
 * cannot be forgotten: „onaj ko za pola godine bude pisao brisanje morao bi da se SETI da
 * anonimizuje nalog, a da zaboravi, nista ne bi puklo i ime obrisanog coveka bi ostalo u
 * bazi. Ovako je nemoguce zaboraviti, jer baza odbija." So the request says what happens to
 * it, and the two happen in one transaction: „brisanje clana je od tog trenutka UVEK dva
 * koraka" is two DECISIONS, not two doors, and a member left half deleted between two
 * requests is the state the restrict exists to prevent.
 * <li><b>The other half of every racing pair has to be told.</b> The pair rows go by
 * cascade and say nothing to anybody, and PDL P13, 07.09.2026 says the opposite in as many
 * words: „„Raskini" obavestava drugu polovinu. Isto pravilo kao kod prihvatanja: promena
 * pogadja clana koji nista nije pritisnuo, pa se obavestava odmah. Bez toga je portal
 * javljao kroz jedna vrata a cutao kroz druga." Deleting a member is a third door onto the
 * same act.
 * <li><b>A team he was the last of has to go with him</b>, which is
 * {@link ATeamGoesWithItsLastMember} and the owner's decision of 25.09.2026.
 * <li><b>His own picture has to go with him, row and file, which the schema cannot reach
 * either.</b> {@code competitor_photo_fk} (V8) is a key on the WRONG side for a cascade to help
 * here: it says what happens to {@code competitor.photo_id} when a {@code photo} ROW is
 * deleted, and says nothing about the other direction. Deleting the competitor therefore left
 * his {@code photo} row, and the file beside it, standing for ever with nothing pointing at
 * them any more - measured 25.09.2026 by a probe that deleted a member with a portrait and read
 * {@code select count(*) from photo} back at one. PDL P21 (11.08.2026 and 24.09.2026 together):
 * a deletion „obrisan zauvek sa svim svojim profilom", and „jedina fotografija clana je njegova
 * profilna, koja odlazi sa profilom" - a survivor is exactly the „sakriveno, ne obrisano" P23
 * refuses. {@link MePhotoApi#remove} is the portal's own precedent for taking a picture down at
 * all and its shape is copied here together with its guard: the row goes first and the file
 * after it.
 * </ul>
 *
 * <p><b>AND ONE THING THE CASCADE DOES BADLY, WHICH V33 FIXES RATHER THAN THIS CLASS.</b>
 * A key that empties a POINTER cannot empty the NAME beside it, so until 25.09.2026 a
 * deleted member's name went on standing in {@code message.from_name} and
 * {@code event_comment.who}. That is done by a trigger and not here, for the reason the
 * owner gave about the account: an obligation that depends on whoever writes the deletion
 * remembering is not an obligation the portal keeps.
 *
 * <p><b>THE KEY IS THE MEMBER NUMBER, WHICH IS THE KEY {@link CompetitorApi} HANDS OUT.</b>
 * ADL A55's rule, applied: a write at a resource carries the key its read answers with. It
 * costs one thing and it is named rather than discovered - {@code competitor.member_number}
 * is nullable since V16 („a row in {@code competitor} is a PERSON WHO REGISTERED. A MEMBER
 * is a row whose {@code member_number} is there"), so a row that registered and never
 * became a member cannot be reached through this address at all. Nothing has decided what
 * becomes of such a row and this route does not decide it either.
 *
 * <p><b>WHAT IS NOT ASKED HERE, AND ITS ABSENCE IS DELIBERATE: {@code competitor.active}.</b>
 * Almost every other resource reads it, because the owner's rule of 19.09.2026 refuses every
 * action to a member whose fee has lapsed. That rule is about what a MEMBER may do with his
 * own things; this is the administration acting on him, and a member whose fee lapsed is
 * exactly the one an administrator is most likely to be deleting. Read here, the route would
 * serve only members in good standing.
 */
@RestController
class CompetitorWriteApi {

	/**
	 * What the request must say about the account, and the only word it may say today.
	 *
	 * <p>PDL P23, 14.09.2026, names two: „Prvo se odluci sta sa nalogom (anonimizuje se ili
	 * se brise), pa tek onda clan moze da ode." Both are below; one of them is refused, and
	 * {@link #ANONYMISING_IS_NOT_WRITTEN_YET} says why in the place the caller meets it.
	 */
	static final String DELETE_THE_ACCOUNT = "delete";

	/** The other of the owner's two words, accepted by the parser and refused by the route. */
	static final String ANONYMISE_THE_ACCOUNT = "anonymise";

	/**
	 * Nothing was said about the account, or a word nobody decided was.
	 *
	 * <p>The parameter is optional as far as the dispatcher is concerned and required by
	 * this route, which is the difference between a 404 and a sentence: a parameter Spring
	 * itself demands is one of the four near misses {@link NothingIsHereRatherThanAlmost}
	 * turns into „no handler", and an administrator who forgot to say what happens to the
	 * account would be told the address does not exist.
	 */
	static final String THE_ACCOUNT_MUST_BE_DECIDED =
			"Odlučite šta biva sa nalogom pre nego što član ode.";

	/**
	 * The owner's other outcome, which this increment does not carry out.
	 *
	 * <p><b>Refused rather than approximated.</b> Anonymising an account means writing three
	 * columns nobody has decided the shape of: {@code account.email} is NOT NULL, carries a
	 * shape check and a unique index over {@code lower(email)}, and {@code first_name} and
	 * {@code last_name} refuse a blank. Whatever went into them would be a value this server
	 * invented for a person, which is the one thing a deletion must not produce.
	 *
	 * <p><b>And the case it exists for is the case below.</b> The reason the owner kept
	 * anonymising as an outcome at all is the moderator who also races and has one account
	 * for both (PDL P23, 14.09.2026) - and that member is refused by
	 * {@link #THE_ACCOUNT_ADMINISTERS} whatever this parameter says. So the two boundaries
	 * are one boundary seen from two sides, and they open together or not at all.
	 */
	static final String ANONYMISING_IS_NOT_WRITTEN_YET =
			"Anonimizacija naloga još nije napisana; nalog se za sada može samo obrisati.";

	/**
	 * His account administers the portal, so neither outcome fits and the portal says so.
	 *
	 * <p>This is the case that produced the {@code restrict} in the first place (PDL P23,
	 * 14.09.2026): „moderator koji i trci ima JEDAN nalog za oboje. Ako mu se obrise
	 * takmicarski zapis, on i dalje treba da administrira portal." Deleting the account takes
	 * his moderatorship with it; leaving it leaves his name on a row that no longer names
	 * anybody. What the portal should do with him is a question the owner has not answered,
	 * and a route that guessed would answer it by accident.
	 */
	static final String THE_ACCOUNT_ADMINISTERS =
			"Nalog ovog člana administrira portal, pa se član ne može obrisati odavde.";

	/**
	 * WHAT STANDS WHERE HIS NAME STOOD, and it is not invented here.
	 *
	 * <p>ADL A37, owner, 06.09.2026: „Zamenski tekst je <Obrisani clan>, odnosno <Obrisana
	 * clanica>, sa uglastim zagradama." His own words: „Moze da bude <Obrisani clan> ili
	 * clanica npr. Sa sve ovim znakovima okolo."
	 *
	 * <p><b>Why the man's word and never the woman's, in the one place this class writes
	 * it.</b> The message below is addressed to the other half of a racing pair, and a
	 * racing pair is one man and one woman ({@code racing_pair_man_fk},
	 * {@code racing_pair_woman_fk}, V12, both keyed on {@code (id, gender)}). So the half
	 * who is told is never of the same sex as the half who is gone, and which word to use is
	 * decided by the column the recipient is NOT read off. It is derived here rather than
	 * read, because after the deletion there is no row left to read a gender from and before
	 * it the message has not been written; {@link #partnersOf} answers the pairs and the
	 * schema answers the sex.
	 *
	 * <p><b>The same two words are also written by the trigger in V33</b>, which has
	 * {@code old.gender} in its hand and picks between them. Two homes for one pair of
	 * words, and they are named here so the next reader finds the other one.
	 */
	static final String A_DELETED_MAN = "<Obrisani član>";

	/** The other of the pair. See {@link #A_DELETED_MAN}. */
	static final String A_DELETED_WOMAN = "<Obrisana članica>";

	/** The letter {@code competitor.gender} carries for a man ({@code competitor_gender_known}). */
	private static final String A_MAN = "M";

	private static final Logger LOG = LoggerFactory.getLogger(CompetitorWriteApi.class);

	private final JdbcClient db;

	private final ATeamGoesWithItsLastMember emptyTeams;

	private final TransactionTemplate inOneTransaction;

	private final TheNamedSuperadmin namedSuperadmin;

	private final Path folder;

	private final Postman postman;

	private final Clock clock;

	/** One home for „where is he from", asked by this route and by {@link RegistrationApi}. */
	private final ATownFromTheCodebookOrTyped towns;

	/**
	 * A FIFTH CONSTRUCTOR THAT BUILDS A {@code Portal} OUT OF CONFIGURATION, beside
	 * {@link RegistrationApi}'s, {@link EmailConfirmationApi}'s, {@link PasswordResetApi}'s
	 * and {@link ModeratorWriteApi}'s.
	 *
	 * <p>{@code WhatTheMessageSays} says why it may never be built out of anything that
	 * arrived with a request, and why the number of such constructors is deliberately not
	 * asserted anywhere: what is asserted is the property, one source refused at start up,
	 * and a fifth sender would only make a count stale.
	 */
	private final Portal portal;

	/**
	 * @param folder the same setting {@link MePhotoApi} and {@link PhotoApi} read, for his own
	 *               picture's file, so that this class and theirs never carry two folders the
	 *               day somebody sets one of them.
	 * @param clock  the one the container holds, so a case can put the group entry on a
	 *               chosen day: which season a member's first is, and whether he is old
	 *               enough to sign for himself, are both answers about a date
	 */
	CompetitorWriteApi(JdbcClient db, ATeamGoesWithItsLastMember emptyTeams,
			TransactionTemplate inOneTransaction, TheNamedSuperadmin namedSuperadmin,
			Postman postman, Clock clock, ATownFromTheCodebookOrTyped towns,
			@Value("${btl.photos.folder}") String folder,
			@Value("${btl.portal.address}") String address) {

		this.db = db;
		this.emptyTeams = emptyTeams;
		this.inOneTransaction = inOneTransaction;
		this.namedSuperadmin = namedSuperadmin;
		this.postman = postman;
		this.clock = clock;
		this.towns = towns;
		this.folder = Path.of(folder);
		this.portal = new Portal(address);
	}

	record Refused(String reason) {
	}

	/**
	 * The other half of one pair, and the season that pair runs in.
	 *
	 * @param gender the gender of the half who is GOING, which is what decides which of the
	 *               two replacement words the message carries
	 */
	private record Partner(long member, int season, String gender) {
	}

	/**
	 * @param account what happens to his account, {@link #DELETE_THE_ACCOUNT}. Optional as
	 *                far as the dispatcher is concerned and required by the route; see
	 *                {@link #THE_ACCOUNT_MUST_BE_DECIDED}.
	 */
	@DeleteMapping("/api/competitors/{memberNumber}")
	@RightIsNeeded(CompetitorApi.OVER_THE_MEMBERS)
	ResponseEntity<?> remove(@PathVariable String memberNumber,
			@RequestParam(name = "account", required = false) String account) {

		return inOneTransaction.execute(committing -> deleting(memberNumber, account));
	}

	/**
	 * THE DELETING, IN ONE TRANSACTION, because the account going and the member going are
	 * the two halves of one act and the database refuses the second without the first.
	 *
	 * <p>Stopped between them, an administrator would have taken away somebody's login and
	 * left his profile standing, which is neither of the two outcomes PDL P23 allows and is
	 * not a state any screen can draw.
	 *
	 * <p><b>THE ORDER OF THE THREE REFUSALS IS NOT INTERCHANGEABLE.</b>
	 *
	 * <ol>
	 * <li><b>A member who is not there is answered first</b>, the shape
	 * {@link TeamWriteApi#leave} keeps: a key this address has nothing behind gets the same
	 * answer whatever else is wrong with the request.
	 * <li><b>Then what the request SAYS</b>, because a malformed request is answered before
	 * anything is read about its subject. Asked the other way round, an administrator who
	 * forgot the parameter would be told which members administer the portal.
	 * <li><b>And last what the member IS</b>, which is the only one of the three that needs
	 * a second table.
	 * </ol>
	 */
	private ResponseEntity<?> deleting(String memberNumber, String account) {
		Optional<Long> member = memberNumbered(memberNumber);

		if (member.isEmpty()) {
			return away();
		}

		if (ANONYMISE_THE_ACCOUNT.equals(account)) {
			return no(HttpStatus.CONFLICT, ANONYMISING_IS_NOT_WRITTEN_YET);
		}

		if (!DELETE_THE_ACCOUNT.equals(account)) {
			return no(HttpStatus.BAD_REQUEST, THE_ACCOUNT_MUST_BE_DECIDED);
		}

		long gone = member.orElseThrow();

		if (hisAccountAdministers(gone)) {
			return no(HttpStatus.CONFLICT, THE_ACCOUNT_ADMINISTERS);
		}

		/* READ BEFORE THE DELETE AND NEVER AFTER, all three, and for one reason:
		   `racing_pair` and `team_membership` are `on delete cascade` (V12, V11) and
		   `competitor.photo_id` is a column ON THE ROW ITSELF, so the moment the member goes
		   there is nothing left to read any of them off. The same sentence `PairWriteApi.end`
		   writes beside its own reading. */
		List<Partner> partners = partnersOf(gone);
		List<Long> teams = emptyTeams.teamsOf(gone);
		Optional<Long> photo = photoOf(gone);

		/* TOLD BESIDE THE READING THAT FOUND THEM, which is `PairWriteApi.end`'s own
		   arrangement, and it does not matter whether it happens before or after the
		   delete: these rows carry `from_id` null, and V33's trigger rewrites the sender
		   of a message only `where from_id = old.id`. So the one worry this order invites
		   - that the deletion would reach back and rewrite the league's own name out of a
		   message the league has just written - cannot happen, and it is said here because
		   it is the first thing a reader of V33 will wonder about. */
		for (Partner each : partners) {
			tell(each.member(), PairWriteApi.THE_PAIR_IS_BROKEN,
					PairWriteApi.theBrokenPairReads(theNameThatIsGone(each.gender()),
							each.season()));
		}

		/* AND THE ACCOUNT, WHICH THE DATABASE DEMANDS GO FIRST. `account_competitor_fk` is
		   `on delete restrict`, so the statement below fails outright while this row
		   stands. Written the other way round the transaction would roll back and the
		   administrator would read a 500 where the schema was saying something exact. */
		db.sql("delete from account where competitor_id = ?").param(gone).update();

		db.sql("delete from competitor where id = ?").param(gone).update();

		emptyTeams.goIfEmpty(teams);
		photo.ifPresent(this::takeAwayThePhoto);

		return ResponseEntity.noContent().build();
	}

	/**
	 * The picture standing on his profile, read before he goes so that there is still a row to
	 * read it off.
	 *
	 * <p>Answered as an id and not joined against {@code photo} here, for
	 * {@link #memberNumbered}'s own reason: what {@link #takeAwayThePhoto} needs next is the
	 * key, and reading it back off a row that may already be gone would be the wrong table to
	 * ask twice.
	 */
	private Optional<Long> photoOf(long member) {
		return db.sql("select photo_id from competitor where id = ?")
				.param(member)
				.query(Long.class)
				.optional();
	}

	/**
	 * HIS PICTURE'S ROW AND ITS FILE, BOTH GONE, THE SAME SHAPE {@link MePhotoApi#remove} KEEPS.
	 *
	 * <p>The row first, then the file, matching that route's own order: „THE ROW AND THE FILE
	 * BOTH GO, and the order is the row first". Nothing here empties {@code competitor.photo_id}
	 * the way that route empties it explicitly, because the row it stood on is already gone by
	 * the time this runs - there is no column left to leave pointing at anything.
	 *
	 * <p><b>A fault taking the file off the disk is logged and swallowed, not thrown.</b> The
	 * member's deletion is the act PDL P23 calls immediate and final, and a stray file
	 * {@link PhotoApi} will never serve again - because nothing in {@code photo} points at it
	 * once its row is gone below - is the one leak that class already answers nothing for, not
	 * a reason to leave a deleted member's account and pairs standing while an administrator is
	 * told a disk fault instead of a completed deletion.
	 */
	private void takeAwayThePhoto(long photo) {
		db.sql("delete from photo where id = ?").param(photo).update();

		try {
			if (!Files.deleteIfExists(folder.resolve(String.valueOf(photo)))) {
				LOG.warn("the file of photo {} was already gone when its member was deleted", photo);
			}
		}
		catch (IOException notRemoved) {
			LOG.warn("the file of photo {} could not be removed from disk when its member was"
					+ " deleted", photo, notRemoved);
		}
	}

	/**
	 * The member this number belongs to, or nothing.
	 *
	 * <p>Answered as an id and not as a row, because everything below it keys on the id: the
	 * number is public and consecutive, the id is what every foreign key in the schema
	 * points at, and looking each statement up by the number again would be the same
	 * question asked five times and free to be answered differently by the fifth.
	 */
	private Optional<Long> memberNumbered(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?")
				.param(memberNumber)
				.query(Long.class)
				.optional();
	}

	/**
	 * WHETHER HIS ACCOUNT IS ALSO SOMEBODY'S ADMINISTRATIVE STANDING, asked as one question
	 * over both of the things that can carry it.
	 *
	 * <p><b>A role that is not {@code competitor} OR a single ticked box, and the two are
	 * not the same question.</b> {@link ModeratorWriteApi} takes a moderatorship away in two
	 * statements because they can come apart: „The role alone leaves a set of ticks that
	 * come back to life the moment anybody is made a moderator at that key again; the ticks
	 * alone leave a man on the moderators' screen with an empty row." A moderator with every
	 * box removed is still a moderator, and a competitor with a box ticked is a row nobody
	 * meant to write - both are refused, and a condition over one of the two would let the
	 * other through.
	 *
	 * <p><b>THE SUPERADMIN IS NOT INSIDE THE FIRST HALF, AND HE NEEDS A THIRD CONDITION OF HIS
	 * OWN.</b> This javadoc said otherwise until 25.09.2026 - „his role is not
	 * {@code competitor}" - and that sentence was read out of what the row would be if the
	 * role were written, not out of what {@link RegistrationApi} actually does. It never
	 * writes it: „no row anywhere - this one included - ever carries the superadmin's role...
	 * What this statement writes stays {@code competitor} for him too" (that class's own
	 * comment, beside the insert). PDL P21, 14.09.2026: the role „ne stoji kao zapis koji se
	 * dodeljuje, nego se izvodi iz podesavanja", and ADL says the row-level consequence in as
	 * many words - „nema radnje kroz portal koja bi superadmina obrisala ili razvlastila. Ta
	 * provera se ne pise nikad" - and this route was exactly such an action, undetected,
	 * until a review sent a named-and-confirmed account through it and read back a 204. So
	 * the row this asks about carries {@code competitor} and zero ticks for him precisely in
	 * the case that matters most, and the first two conditions answer him "no" every time. The
	 * third asks {@link TheNamedSuperadmin} directly, which is the one source the portal
	 * already derives this fact from ({@link WhoIsAsking}), rather than a second comparison
	 * against the word {@code superadmin} that could disagree with it.
	 *
	 * <p><b>Asked of the ROW BEING DELETED, not of whoever is asking.</b> A superadmin who
	 * targets himself reaches this method too - the door lets him through because
	 * {@link WhoIsAsking} hands him every right there is, and only the read below, over the
	 * account named by the number in the address, can still say no. A check written the other
	 * way round, over the caller's own session, would refuse nothing when he deletes himself.
	 *
	 * <p><b>An account is not required to exist at all.</b> Nothing says a member has one -
	 * {@code account.competitor_id} is nullable and unique, so a member hangs off at most one
	 * account and may hang off none. A member with no account is refused nothing here and the
	 * delete below removes no row.
	 */
	private boolean hisAccountAdministers(long member) {
		return db.sql("select r.code, a.email, a.email_confirmed_at,"
						+ " exists(select 1 from account_admin_right x where x.account_id = a.id)"
						+ " from account a join role r on r.id = a.role_id"
						+ " where a.competitor_id = ?")
				.param(member)
				.query((row, one) -> !"competitor".equals(row.getString(1)) || row.getBoolean(4)
						|| namedSuperadmin.covers(row.getString(2), row.getTimestamp(3) != null))
				.optional()
				.orElse(false);
	}

	/**
	 * THE OTHER HALF OF EVERY PAIR HE IS IN, WHICH IS NEVER „HIS PAIR" IN THE SINGULAR.
	 *
	 * <p>PDL P13, 07.09.2026: „Od 1. januara clan sme da drzi dva: onaj u kom trci sezonu
	 * koja tece, i onaj napravljen za sledecu." Both go with him, so both halves are told,
	 * and a fixture with one pair cannot tell a route that tells everybody from one that
	 * tells the first.
	 *
	 * <p><b>Both columns, because either of them can be him.</b> {@code racing_pair} stores
	 * the man and the woman in two columns, and a query written off {@code man_id} alone
	 * passes every case whose fixture happens to delete a man. The same sentence
	 * {@link PairWriteApi} writes about its own two columns.
	 *
	 * <p><b>Every season and not only the one being run</b>, which is where this parts
	 * company with {@link PairWriteApi#end}. That route refuses a pair of a season that has
	 * ended, because „par iz sezone koja je prosla se NIKAD ne dira" is about a member
	 * reaching back into a finished season. Nothing here reaches: the rows go because
	 * {@code racing_pair} is {@code on delete cascade} on both halves, which V12 decided long
	 * before this route existed, and they go whatever season they are in. Frozen seasons are
	 * untouched by that, and they are untouched because a frozen season is its own tables
	 * (A37) and not one of them holds a pair.
	 */
	private List<Partner> partnersOf(long member) {
		return db.sql("select case when p.man_id = :me then p.woman_id else p.man_id end,"
						/* AND THE GENDER OF THE ONE WHO IS GOING, read off the column he is
						   NOT in: if he is the man then the woman is told and he is a man.
						   The schema keys each half on `(id, gender)`, so this is the
						   database's own answer and not a join back to a row that is about
						   to disappear. */
						+ " p.season, case when p.man_id = :me then 'M' else 'F' end"
						+ " from racing_pair p"
						+ " where p.man_id = :me or p.woman_id = :me"
						/* SEASON FIRST AND THE KEY LAST, so the order is total and two
						   messages to one member arrive the same way round every time. */
						+ " order by p.season, p.id")
				.param("me", member)
				.query((row, one) -> new Partner(row.getLong(1), row.getInt(2), row.getString(3)))
				.list();
	}

	/** Which of ADL A37's two words stands where his name stood. See {@link #A_DELETED_MAN}. */
	private static String theNameThatIsGone(String gender) {
		return A_MAN.equals(gender) ? A_DELETED_MAN : A_DELETED_WOMAN;
	}

	/**
	 * The portal writing to a member itself, which is {@link PairWriteApi#tell}'s shape and
	 * its constant.
	 *
	 * <p>PDL P13, 19.09.2026, the owner choosing between three offered answers: „Kad portal
	 * sam pise poruku clanu, posiljalac je NAZIV LIGE." So {@code from_id} is empty and
	 * {@code from_name} carries the league, which is the row V13 built for exactly this - „a
	 * message with a name and no pointer".
	 */
	private void tell(long member, String subject, String body) {
		db.sql("insert into message (to_id, from_id, from_name, subject, body)"
						+ " values (?, null, ?, ?, ?)")
				.params(member, PairWriteApi.THE_LEAGUE, subject, body)
				.update();
	}

	/**
	 * THE ANSWER FOR A KEY THIS ADDRESS HAS NOTHING BEHIND.
	 *
	 * <p>Empty, the shape {@link TeamWriteApi} and {@link ModeratorWriteApi} use. ADL A8,
	 * owner, 13.09.2026: a caller who may not do a thing and a caller asking about a thing
	 * that is not there get the same answer, „isti odgovor kao da adresa ne postoji". Here
	 * the right is read at the door by {@link RightIsNeeded}, so what reaches this line is
	 * somebody who MAY delete members asking about a number nobody has.
	 */
	private static ResponseEntity<?> away() {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}

	/**
	 * ONE ROW OF THE GROUP: everything the registration asks for, less the two things
	 * nobody but the member himself may hand over.
	 *
	 * <p><b>The list is the registration's and is not written out again here.</b>
	 * {@link WhatRegistrationAsksFor} is what decides which fields are required and at
	 * which age, and {@link #enter} asks it rather than a list of its own - so a field
	 * added to the registration tomorrow is one this route starts requiring on the same
	 * day. That is the owner's answer of 25.09.2026, in his words: „Pod 1, ali svakako se
	 * mora uneti mail da bi covek mogao da napravi account."
	 *
	 * <p><b>The two that are not here.</b> {@code password} and {@code passwordRepeat},
	 * because the whole of PDL 31.07.2026 is that no password passes through the hands of
	 * whoever does the entering („Time nijedna lozinka ne prolazi kroz ruke organizatora
	 * Tima"); and {@code photo}, which {@link RegistrationApi#NOT_COLLECTED_YET} says is
	 * not received by anything under {@code src/main} yet, so requiring it here would be
	 * requiring something no route can take.
	 *
	 * <p><b>And one that is here for a reason worth naming: {@code healthStatement}.</b>
	 * The owner, 25.09.2026: „Potrebno je da covek to poseduje i dovoljno je da kaze da
	 * ima. Ako je slagao, to je njegov problem." So it is a tick and nothing more - no
	 * number of a document, no date of one, no proof - and what
	 * {@code competitor.health_statement_at} then records is the moment somebody with the
	 * paper in his hand said so. He refused the other outcome by name: writing the column
	 * with nobody having said anything, which is the portal recording a thing that did not
	 * happen, the same mistake an independent review found in the invitation to a
	 * moderator on 19.09.2026.
	 *
	 * @param referredBy is NOT a field of this record and the absence is the decision. The
	 *                   referral is paid for a link somebody OPENED (PDL, 24.09.2026,
	 *                   „Svako deljenje nosi clanski link za preporuku. Ako se neko
	 *                   registruje preko podeljenog linka..."), and nobody opened a link
	 *                   here: the administration typed him in off a sheet of paper.
	 *                   {@code competitor.referred_by} is left empty.
	 */
	record Invited(String firstName, String lastName, String fatherName, String birthDate,
			String gender, Boolean firstSeason2027, String email, String address, Long placeId,
			String city, String country, String idNumber, String phone, String shirtSize,
			String bio, Boolean healthStatement, String parentConsent, String parentRelation) {
	}

	/**
	 * The whole group, which is a list and never a single row.
	 *
	 * <p>A wrapper rather than a bare JSON array, so that the day the screen needs to send
	 * anything ABOUT the group - which team it is for, say - the body does not change
	 * shape. {@code ModeratorWriteApi.Ticks} is the same choice one resource along and for
	 * the same reason.
	 */
	record Group(List<Invited> members) {
	}

	/**
	 * Which row was refused and why, by its place in what was sent.
	 *
	 * <p><b>The row is named by its index and never by its address, and that is the
	 * smaller thing to say rather than the larger.</b> The owner decided on 08.09.2026
	 * that an address somebody holds is said out loud („Registracija na vec zauzetu adresu
	 * kaze da je zauzeta"), with the price named and taken; this answers that question for
	 * the row that asked it without also reading the whole group's addresses back out to
	 * whoever posted them.
	 *
	 * @param missing the field names, by the names the JSON uses, and EMPTY when the row's
	 *                reason is not about a field that is absent. Empty rather than null:
	 *                „nothing is missing, something else is wrong" is a sentence, and a
	 *                screen reading it has one shape to read rather than two
	 */
	record Wrong(int row, String reason, List<String> missing) {
	}

	/**
	 * The refusal: one word for the whole group, and a row for each one to blame.
	 *
	 * <p>{@code reason} stands first, which is {@code RaceWriteApi}'s shape and the second
	 * half of ADL A54 („`PUT` koji ne posalje neko polje odbija se sa 400, I KAZE SE STA
	 * FALI", owner, 19.09.2026). A route written after that decision is born with it.
	 */
	record NotEntered(String reason, List<Wrong> rows) {
	}

	/**
	 * @param email the address as the ROW carries it, folded and stripped, which is not
	 *              always what was typed ({@code WhatAnAddressLooksLike.asItIsStored}).
	 *              Read back off the row for {@link Made}'s reason one resource along
	 */
	record Made(long id, String email) {
	}

	/** Everyone the group entered, in the order they were sent. */
	record Entered(List<Made> members) {
	}

	static final String THE_GROUP_IS_EMPTY = "theGroupIsEmpty";

	/**
	 * More rows than one request may carry.
	 *
	 * <p>See {@link #THE_MOST_IN_ONE_GROUP}, which is where the number is and where it is
	 * said whose number it is.
	 */
	static final String THE_GROUP_IS_TOO_BIG = "theGroupIsTooBig";

	/**
	 * The same address on two rows of one group.
	 *
	 * <p><b>Its own word, and it is not {@link #THE_ADDRESS_IS_TAKEN}.</b> Nobody holds
	 * that address yet; the administration typed one person in twice, and the fix is to
	 * take a row out rather than to find out whose account is in the way. Told apart by
	 * the index alone they would also be told apart wrongly: written in one transaction,
	 * the second row would collide with the FIRST ROW OF THIS SAME GROUP and the portal
	 * would report an account that did not exist a moment ago as somebody else's.
	 */
	static final String THE_ADDRESS_IS_TWICE_IN_THE_GROUP = "theAddressIsTwiceInTheGroup";

	/** Mirrors {@code RegistrationApi.THE_FORM_IS_NOT_COMPLETE}, row by row. */
	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/** Mirrors {@code ModeratorWriteApi.THE_ADDRESS_IS_NOT_SHAPED}, row by row. */
	static final String THE_ADDRESS_IS_NOT_SHAPED = "theAddressIsNotShaped";

	/** Mirrors {@code RegistrationApi.THE_ADDRESS_IS_TAKEN}, row by row. */
	static final String THE_ADDRESS_IS_TAKEN = "theAddressIsTaken";

	/**
	 * THE LARGEST GROUP ONE REQUEST MAY CARRY, AND THIS NUMBER IS MINE RATHER THAN THE
	 * OWNER'S - which is why it says so here instead of quoting somebody.
	 *
	 * <p>Nothing in PDL or ADL says how many people go in at once, and a number invented
	 * in silence would read afterwards like a decision. What it is protecting IS measured:
	 * {@link RegistrationApi#writeThenSend} carries what one slow relay costs, 5,15
	 * seconds for one message, and this route sends one per row after the commit. The
	 * connection pool is not what is at risk - nothing here holds a connection while the
	 * relay is spoken to - but the REQUEST THREAD is, and a group of ten thousand would
	 * hold one for as long as the relay cared to take.
	 *
	 * <p><b>The cost in the other direction, so it can be weighed rather than assumed:</b>
	 * a club entering more than a hundred people at once sends two requests. If that is
	 * ever wrong, the number is one line and no migration.
	 */
	static final int THE_MOST_IN_ONE_GROUP = 100;

	/**
	 * THE ADMINISTRATION ENTERS MEMBERS IN A GROUP, AND WHAT EACH OF THEM GETS IS AN
	 * INVITATION RATHER THAN AN ACCOUNT HE CAN USE.
	 *
	 * <p><b>The owner, PDL P8b, 25.09.2026:</b> the button for entering a member in the
	 * administration is „grupni unos koji salje pozivnice". That carries out two sentences
	 * that were already written and were not being carried out by anything: „Registracija
	 * se radi iskljucivo na sajtu. Niko ne moze tehnicki da se registruje mimo sistema."
	 * (PDL) and „Grupni unos stvara pozivnice, ne naloge. Svakom unetom stize poruka sa
	 * vezom na kojoj sam postavlja lozinku i time preuzima nalog. Do tada je vidljiv u
	 * ligi ali se ne moze prijaviti." (PDL, owner, 31.07.2026).
	 *
	 * <p><b>He refused the other outcome with its reason given:</b> that the
	 * administration make the account itself. The portal would then have to know a
	 * password or set one on a man's behalf, and somebody would have to type a member
	 * number, which PDL forbids in as many words - „administrator ga nikad ne kuca".
	 *
	 * <p><b>WHAT „POZIVNICE, NE NALOGE" IS IN ROWS, and it is the moderator's road with a
	 * third occasion on it.</b> An {@code account} with NO PASSWORD and NO CONFIRMED
	 * ADDRESS, a {@code competitor} that is not active, and a
	 * {@code password_reset_token}. Not a table of its own: ADL A53, 18.09.2026,
	 * „Pozivnica je isti put sa drugim povodom, i pise se kao JEDAN POVOD VISE, ne kao
	 * druga tabela i drugi razred. Dva doma jedne cinjenice bi se prvog dana razisla u
	 * roku ili u duzini." {@link ModeratorWriteApi#add} mints the same row for the same
	 * reason, {@code POST /api/password-reset} is what spends it, and neither is touched
	 * here.
	 *
	 * <p><b>SO THE TWO STATES OF PDL'S OWN SENTENCE ARE TWO DIFFERENT COLUMNS, AND
	 * NEITHER IS DERIVED FROM THE OTHER.</b> „Vidljiv u ligi" is the {@code competitor}
	 * row, which exists from this moment and which the administration works with;
	 * {@code active} is false, so {@link CompetitorApi}'s {@code where c.active} keeps him
	 * off the public list until his fee is recorded, exactly as it does for somebody who
	 * registered himself. „Ne moze se prijaviti" is
	 * {@link com.btl.portal.domain.account.SignIn}, which refuses an unconfirmed address
	 * and a missing password separately, so he is shut twice over and either one alone
	 * would do it.
	 *
	 * <p><b>NO MEMBER NUMBER IS WRITTEN HERE AND {@code member_number_seq} IS NOT
	 * ASKED.</b> PDL, 30.07.2026: the number „se dodeljuje automatski u trenutku
	 * evidentiranja uplate... i administrator ga nikad ne kuca". {@link PaymentApi} is
	 * where the sequence is drawn from, and a row entered here is what that class calls a
	 * person who registered and is not yet a member.
	 *
	 * <p><b>AND NOTHING HERE MAY CLAIM HONORARY MEMBERSHIP.</b>
	 * {@code membership_basis} is written {@code 'payment'}, the same constant
	 * {@link RegistrationApi} writes and for its reason: {@code 'feeExempt'} is the
	 * owner's to grant, and a form that could name its own basis would be a form that
	 * grants it. The owner's answer of 25.09.2026 was „the whole of the registration's
	 * field set", and the registration has never had that field.
	 *
	 * <p><b>ALL OR NOTHING, AND THAT IS THE ONE PIECE OF THIS ROUTE'S SHAPE I DECIDED
	 * RATHER THAN READ.</b> A group half written is a group whose invitations have already
	 * gone out to half of it, and an invitation cannot be taken back - the man has the
	 * link and the row. Whoever entered the group would then have to work out which half
	 * arrived before he could try again, and trying again at the same list would answer
	 * {@link #THE_ADDRESS_IS_TAKEN} for every row that did. So one bad row refuses the
	 * whole group, nothing is written, and nothing is sent.
	 *
	 * <p><b>WHICH IS ALSO WHY THE ADDRESSES ARE JUDGED BY THE INDEX AND NOT BY A QUESTION
	 * ASKED BEFOREHAND.</b> {@code select ... where email = ?} before the insert is two
	 * moments with a registration able to fit between them; every account of the group goes
	 * in with {@code on conflict do nothing}, which asks the index itself, and a row that
	 * comes back empty is one whose address was taken. Nothing is an error, so the
	 * transaction is still usable and can be rolled back deliberately with an answer in
	 * hand rather than by a fault.
	 */
	@PostMapping("/api/competitors")
	@RightIsNeeded(CompetitorApi.OVER_THE_MEMBERS)
	ResponseEntity<?> enter(@RequestBody Group group, HttpServletRequest asking) {
		List<Invited> members = group.members() == null ? List.of() : group.members();

		if (members.isEmpty()) {
			return ResponseEntity.badRequest().body(new NotEntered(THE_GROUP_IS_EMPTY, List.of()));
		}

		if (members.size() > THE_MOST_IN_ONE_GROUP) {
			return ResponseEntity.badRequest().body(new NotEntered(THE_GROUP_IS_TOO_BIG, List.of()));
		}

		LocalDate today = LocalDate.ofInstant(clock.instant(), SeasonClock.ZONE);
		List<Reading> read = new ArrayList<>();
		List<Wrong> wrong = new ArrayList<>();
		Set<String> alreadyInThisGroup = new HashSet<>();

		for (int row = 0; row < members.size(); row++) {
			Reading reading = readingOf(members.get(row), today);

			read.add(reading);

			/* THE DUPLICATE IS ASKED AFTER THE FORM AND ONLY OF A ROW THAT PASSED IT, so
			   that two rows both carrying nothing at all are two incomplete forms rather
			   than one incomplete form and one duplicate of it: the folded address of an
			   empty row is the empty string, and the empty string repeats. */
			if (reading.wrong() != null) {
				wrong.add(new Wrong(row, reading.wrong(), reading.missing()));
			} else if (!alreadyInThisGroup.add(reading.address())) {
				wrong.add(new Wrong(row, THE_ADDRESS_IS_TWICE_IN_THE_GROUP, List.of()));
			}
		}

		if (!wrong.isEmpty()) {
			return ResponseEntity.badRequest()
					.body(new NotEntered(THE_FORM_IS_NOT_COMPLETE, List.copyOf(wrong)));
		}

		Written written = inOneTransaction.execute(
				committing -> writeAll(read, today, asking.getRemoteAddr(), committing));

		/* AFTER THE COMMIT, NEVER INSIDE IT, and the whole of why is measured in
		   `RegistrationApi.writeThenSend`: a request that waits on somebody else's SMTP
		   server with a transaction open holds one connection of a pool of ten, and at
		   twelve such requests every two seconds an unrelated member's sign in was answered
		   HTTP 500 after thirty seconds. A group multiplies that by its own size. */
		written.invitations().forEach(this::send);

		return written.answer();
	}

	/**
	 * One row after everything that can be worked out about it without the database has
	 * been, or the reason it will never be written.
	 *
	 * @param wrong   null when the row is fine, which is what {@link #enter} branches on
	 * @param missing the names of the absent fields, empty when the reason is not that
	 */
	private record Reading(Invited typed, LocalDate born, Town town, String address,
			String wrong, List<String> missing) {
	}

	/** What is left to send once the rows are committed, or the refusal instead. */
	private record Written(ResponseEntity<?> answer, List<ToSend> invitations) {
	}

	/**
	 * @param to    the address READ BACK OFF THE ROW rather than carried along from what
	 *              was typed, which is {@code RegistrationApi.theLinkToSend}'s measurement:
	 *              the two differ on purpose, and a message sent to what was typed goes
	 *              where the account does not live
	 * @param link  the secret half, which exists here and in the letter and nowhere else
	 */
	private record ToSend(String to, String link) {
	}

	/**
	 * EVERY ROW, IN ONE TRANSACTION, AND THE ACCOUNTS FIRST.
	 *
	 * <p><b>The accounts of the whole group go in before any member does, and the order is
	 * the same one {@link RegistrationApi#write} explains for one person.</b> The one
	 * refusal that can arrive this late is a taken address; written after the competitors,
	 * it would arrive with rows already inserted behind it. Written first, every such
	 * refusal is known before anything else exists - and known for EVERY row rather than
	 * for the first one, which is what the group needs and a single registration does not.
	 *
	 * <p><b>The rollback is deliberate and carries an answer with it.</b>
	 * {@code on conflict do nothing} is not an error, so the transaction is untouched and
	 * this method can ask it to roll back while still returning 409 with a body - which is
	 * the thing a constraint violation could not have done, because PostgreSQL aborts a
	 * transaction on any error at all.
	 */
	private Written writeAll(List<Reading> read, LocalDate today, String from,
			TransactionStatus committing) {

		List<Made> made = new ArrayList<>();
		List<Wrong> taken = new ArrayList<>();

		for (int row = 0; row < read.size(); row++) {
			Optional<Made> account = accountFor(read.get(row));

			if (account.isEmpty()) {
				taken.add(new Wrong(row, THE_ADDRESS_IS_TAKEN, List.of()));
			} else {
				made.add(account.orElseThrow());
			}
		}

		if (!taken.isEmpty()) {
			committing.setRollbackOnly();

			return new Written(ResponseEntity.status(HttpStatus.CONFLICT)
					.body(new NotEntered(THE_ADDRESS_IS_TAKEN, List.copyOf(taken))), List.of());
		}

		List<ToSend> invitations = new ArrayList<>();
		Timestamp now = Timestamp.from(clock.instant());

		for (int row = 0; row < read.size(); row++) {
			memberFor(read.get(row), made.get(row).id(), now, today, from);
			invitations.add(new ToSend(made.get(row).email(), invitationFor(made.get(row).id())));
		}

		return new Written(ResponseEntity.status(HttpStatus.CREATED)
				.body(new Entered(List.copyOf(made))), List.copyOf(invitations));
	}

	/**
	 * The account, with no password and no confirmation, or nothing when the address is
	 * held.
	 *
	 * <p>The role is {@code competitor} and is never taken off the request, which is
	 * {@link RegistrationApi#write}'s reason said again: a form that could name its own
	 * role is a form somebody enters a superadmin with.
	 */
	private Optional<Made> accountFor(Reading reading) {
		return db.sql("insert into account (first_name, last_name, email, role_id)"
						+ " values (?, ?, ?, (select id from role where code = 'competitor'))"
						+ " on conflict ((lower(email))) do nothing"
						+ " returning id, email")
				.params(reading.typed().firstName().strip(), reading.typed().lastName().strip(),
						reading.address())
				.query((one, number) -> new Made(one.getLong(1), one.getString(2)))
				.optional();
	}

	/** His member record, his document if he sent one, and his guardian's consent if he needs one. */
	private void memberFor(Reading reading, long account, Timestamp now, LocalDate today,
			String from) {

		long member = db.sql("insert into competitor"
						+ " (first_name, last_name, gender, place_id, city, country_id,"
						+ "  first_season, first_season_2027, active, membership_basis,"
						+ "  referral_code, bio, profile_hidden, birth_date,"
						+ "  father_name, address, phone, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, ?, ?, ?, ?, ?, false, 'payment', ?, ?, false, ?,"
						+ "  ?, ?, ?, ?, ?)"
						+ " returning id")
				.params(reading.typed().firstName().strip(), reading.typed().lastName().strip(),
						reading.typed().gender(), reading.town().placeId(), reading.town().city(),
						reading.town().countryId(),
						SeasonClock.seasonBeingPaidFor(ZonedDateTime.now(clock)),
						reading.typed().firstSeason2027(), ReferralCode.fresh().written(),
						WhatAFieldMeans.theBio(reading.typed().bio()),
						java.sql.Date.valueOf(reading.born()),
						reading.typed().fatherName().strip(), reading.typed().address().strip(),
						WhatAFieldMeans.thePhone(reading.typed().phone()),
						reading.typed().shirtSize(), now)
				.query(Long.class).single();

		db.sql("update account set competitor_id = ? where id = ?").params(member, account).update();

		String document = WhatAFieldMeans.theDocument(reading.typed().idNumber());

		if (document != null) {
			db.sql("insert into competitor_document (competitor_id, document_number) values (?, ?)")
					.params(member, document).update();
		}

		if (Guardianship.accountIsHeldByAGuardian(reading.born(), today)) {
			/* `given_from` IS THE ADDRESS THIS SERVER SAW, WHICH HERE IS THE
			   ADMINISTRATION'S MACHINE AND NOT THE GUARDIAN'S - and that is a boundary
			   named rather than left to be discovered.

			   The column is `inet NOT NULL` (V8), so there is no empty state to write; and
			   of the five things V8 calls „together the evidence that it was given", four
			   are the guardian's and this one is not. In a registration it is the guardian's
			   own browser - or rather, as `RegistrationApi` measured and wrote down, the
			   proxy in front of it, because `server.forward-headers-strategy` is set
			   nowhere. In a GROUP ENTRY the consent arrived on paper, which the owner's own
			   sentence says („na osnovu papirne saglasnosti", PDL, 31.07.2026), so no
			   machine of the guardian's was ever involved and the honest reading of this
			   column is the one `RegistrationApi` already gives it: it holds what the server
			   saw, which is where the RECORD was made. Here that is the office the group was
			   typed in, and `guardian_name`, `relation` and `given_at` are what carry the
			   consent itself. */
			db.sql("insert into parental_consent"
							+ " (competitor_id, guardian_name, relation, given_at, given_from)"
							+ " values (?, ?, ?, ?, cast(? as inet))")
					.params(member, reading.typed().parentConsent().strip(),
							Guardianship.Relation.named(reading.typed().parentRelation()).code(),
							now, from)
					.update();
		}
	}

	/** The row that lets him set a password, and the secret half it is reached by. */
	private String invitationFor(long account) {
		SecretToken invitation = SecretToken.fresh();

		db.sql("insert into password_reset_token (account_id, token_hash) values (?, ?)")
				.params(account, invitation.hash()).update();

		return invitation.secret();
	}

	/**
	 * ONE INVITATION, AND A RELAY THAT WILL NOT TAKE IT STOPS NEITHER THE GROUP NOR THE
	 * ROW.
	 *
	 * <p><b>Each message is tried on its own</b>, which is the whole of what a group adds
	 * to {@link ModeratorWriteApi#send}: one refused message must not take the other
	 * ninety-nine with it, and it cannot take the rows either - they are committed before
	 * the first letter is attempted. Answering 500 would tell the administration nothing
	 * happened when everything did, and send it to type the same list again at a route
	 * that would now answer {@link #THE_ADDRESS_IS_TAKEN} for every row.
	 *
	 * <p><b>What rescues the man is the road one occasion along, and it is measured rather
	 * than hoped:</b> {@code POST /api/password-reset/request} asks nothing about a role, a
	 * password or a confirmed address, so a link to the same mailbox gets him in, and
	 * spending THAT one sets the password and confirms the address exactly as spending this
	 * one would have.
	 *
	 * <p>What is logged is never the address: a log is read by whoever can read the disk,
	 * and an address of electronic mail is a personal datum (ADL A12).
	 */
	private void send(ToSend invitation) {
		try {
			postman.send(WhatTheMessageSays.about(Message.INVITED_AS_A_MEMBER, portal,
					invitation.link()), invitation.to());
		} catch (MailException theRelayDidNotTakeIt) {
			LOG.warn("an invitation to somebody entered in a group did not go out; a password"
					+ " reset request at the same address is what gets him another link",
					theRelayDidNotTakeIt);
		}
	}

	/**
	 * EVERYTHING THAT CAN BE JUDGED ABOUT ONE ROW BEFORE ANYTHING IS WRITTEN.
	 *
	 * <p>The shape is {@link RegistrationApi#register}'s, step for step and in its order,
	 * because it is the same form with two fields taken out: the day, then the town, then
	 * the address as the row will carry it, then which fields this person's age requires,
	 * then the document's shape at every age.
	 */
	private Reading readingOf(Invited typed, LocalDate today) {
		LocalDate born = WhatAFieldMeans.theDay(typed.birthDate(), today);

		if (born == null) {
			return notComplete(typed, List.of("birthDate"));
		}

		Town town = towns.of(typed.placeId(), typed.city(), typed.country());
		String address = WhatAnAddressLooksLike.asItIsStored(
				typed.email() == null ? "" : typed.email());
		/* AN ADDRESS THAT IS NOT ONE IS ITS OWN SENTENCE, AND IT IS ASKED BEFORE THE LOOP
		   AND ONLY OF A ROW THAT TYPED SOMETHING.

		   `ModeratorWriteApi.THE_ADDRESS_IS_NOT_SHAPED` is why the two are told apart at
		   all: a field somebody forgot is one he goes back and fills in, and a field he has
		   already typed and got wrong is one he has to look at. Answered with the same word,
		   the screen can only say „the form is not complete" over a form in which every box
		   is full.

		   THE ORDER IS LOAD BEARING AND IT WAS MEASURED, not reasoned. Written AFTER the
		   loop, this line was dead: the loop's own entry for `email` reads
		   `itDoes(address) ? address : null`, so a misshapen address is already „a field not
		   filled in" by the time the loop ends, and the row came back
		   `theFormIsNotComplete` naming `email`. Written before the loop WITHOUT the first
		   half of this condition it is dead the other way: a row that left the address out
		   altogether would be told its address is misshapen rather than absent. */
		if (!WhatAFieldMeans.isNothing(typed.email())
				&& !WhatAnAddressLooksLike.itDoes(address)) {

			return new Reading(typed, born, town, address, THE_ADDRESS_IS_NOT_SHAPED, List.of());
		}

		Map<String, String> filledIn = whatWasFilledIn(typed, town, address);

		List<String> missing = new ArrayList<>();

		for (String field : WhatRegistrationAsksFor.from(born, today)) {
			if (!NOT_ASKED_OF_A_GROUP.contains(field)
					&& WhatAFieldMeans.isNothing(filledIn.get(field))) {
				missing.add(field);
			}
		}

		if (!missing.isEmpty()) {
			missing.sort(String::compareTo);

			return notComplete(typed, List.copyOf(missing));
		}

		/* A DOCUMENT NUMBER THAT IS NOT ONE IS REFUSED AT EVERY AGE, which the loop above
		   cannot say: `WhatRegistrationAsksFor` stops asking a child under sixteen for one,
		   so for him the name is not in `asked` and nothing above looks at it. Sent one
		   anyway, and it would reach `memberFor` unlooked at, where `if (document != null)`
		   drops it rather than refusing the row - the row would be entered with the broken
		   number simply gone. Asked here, both ages get the same refusal, same as
		   `RegistrationApi#register`. */
		if (!WhatAFieldMeans.isNothing(typed.idNumber())
				&& WhatAFieldMeans.theDocument(typed.idNumber()) == null) {

			return notComplete(typed, List.of("idNumber"));
		}

		return new Reading(typed, born, town, address, null, List.of());
	}

	private static Reading notComplete(Invited typed, List<String> missing) {
		return new Reading(typed, null, null, null, THE_FORM_IS_NOT_COMPLETE, missing);
	}

	/**
	 * The two names {@link WhatRegistrationAsksFor} asks for that this route does not.
	 *
	 * <p><b>Named rather than silent, which is {@link RegistrationApi#NOT_COLLECTED_YET}'s
	 * reason:</b> a field left out on purpose and a field that went missing look exactly
	 * alike from inside a handler. {@code GroupEntryTest} holds this list to being a subset
	 * of what the registration asks, so a name that stops being asked for cannot sit here
	 * excusing nothing, and a field added to the registration tomorrow is one this route
	 * starts requiring rather than one it quietly skips.
	 *
	 * <p>{@code photo} because nothing under {@code src/main} receives a file for a member
	 * yet; {@code password} and {@code passwordRepeat} because the whole point is that no
	 * password passes through the hands of whoever enters the group.
	 */
	static final Set<String> NOT_ASKED_OF_A_GROUP = Set.of("photo", "password", "passwordRepeat");

	/**
	 * Every field the form asks for, under the name {@link WhatRegistrationAsksFor} knows
	 * it by, and empty when this row does not carry it.
	 *
	 * <p>The three that are not text answer with a word when they are there and with
	 * nothing when they are not, so one loop can ask the same question of all of them: a
	 * category nobody chose, a town that is not one, and a health statement left unticked
	 * are each a field not filled in.
	 */
	private static Map<String, String> whatWasFilledIn(Invited typed, Town town, String address) {
		Map<String, String> filledIn = new LinkedHashMap<>();

		filledIn.put("firstName", typed.firstName());
		filledIn.put("lastName", typed.lastName());
		filledIn.put("fatherName", typed.fatherName());
		filledIn.put("birthDate", typed.birthDate());
		filledIn.put("gender", WhatAFieldMeans.theGender(typed.gender()));
		filledIn.put("firstSeason2027", typed.firstSeason2027() == null ? null : "izabrano");
		filledIn.put("email", WhatAnAddressLooksLike.itDoes(address) ? address : null);
		filledIn.put("address", typed.address());
		filledIn.put("city", town == null ? null : "izabrano");
		filledIn.put("shirtSize", WhatAFieldMeans.theShirtSize(typed.shirtSize()));
		filledIn.put("healthStatement", Boolean.TRUE.equals(typed.healthStatement()) ? "da" : null);
		filledIn.put("idNumber", WhatAFieldMeans.theDocument(typed.idNumber()));
		filledIn.put("parentConsent", typed.parentConsent());
		filledIn.put("parentRelation", WhatAFieldMeans.theRelation(typed.parentRelation()));

		return filledIn;
	}

}
