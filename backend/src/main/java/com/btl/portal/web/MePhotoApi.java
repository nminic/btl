package com.btl.portal.web;

import com.btl.portal.domain.photo.WhatAPictureIs;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Optional;

/**
 * A MEMBER'S PORTRAIT: THE FIRST ROUTE IN THIS PORTAL THAT IS HANDED A FILE, AND THE ONE
 * THAT TAKES IT AWAY AGAIN.
 *
 * <p><b>Owner, PDL P11, 12.08.2026:</b> „Clanovi treba da imaju mogucnost da promene ili
 * obrisu fotografiju naknadno tokom koriscenja sajta. Tad se samo fotografija salje na
 * odobrenje Adminu ili moderatoru sa adekvatnim pravima." The same entry says what a waiting
 * picture does NOT do - „Dok nova slika ceka, na profilu stoji ona koja je odobrena:
 * nijedna neodobrena slika se ne prikazuje nikome osim onome ko ju je poslao i onome ko je
 * odobrava" - and PDL P28b, 3, 24.09.2026 settles the two halves this route could not have
 * decided for itself:
 *
 * <ul>
 * <li><b>„Brisanje slike stupa odmah, bez moderacije."</b> The owner derived it in the entry
 * itself, from PDL.md ("Prazan tekst znaci BRISANJE biografije") (an empty biography is a
 * removal that takes effect at once) and PDL.md
 * ("Član menja ili briše profilnu sliku i kasnije, kad god hoće") (a member changes or
 * removes his picture „kad god hoce"), with the
 * reason beside it: „Uklanjanje ne moze da bude sporno."
 * <li>~~<b>„Dok slika ceka odobrenje, clan vidi SVOJU novu sliku sa oznakom da ceka; svi
 * ostali vide staru ili nijednu."</b>~~ <b>[OBORENO 27.09.2026, owner, PDL 21.]</b> The
 * sentence this route was written under is no longer the rule, and what replaced it is
 * narrower in one place and wider in another - which is why it is set out below rather than
 * quietly swapped.
 * </ul>
 *
 * <h2>WHAT A WAITING PICTURE DOES NOW, AND THE TWO HALVES ARE DECIDED SEPARATELY</h2>
 *
 * <p><b>PDL 21a, on the PROFILE: not until it is approved. [ODLUKA 27.09.2026, owner]</b>
 * „Clan i ne treba da vidi svoju sliku dok nije odobrena. Kad je bude ugledao po prvi put tad
 * ce znati da je slika i odobrena." So the first appearance on the profile is itself the
 * notice, and no second one is made.
 *
 * <p><b>PDL 21b, on THIS route's own screen: he does see it, with the crop. [ODLUKA
 * 27.09.2026, owner]</b> „ukoliko udjem da posaljem ponovo, vidim da je trenutno slika u
 * statusu cekanja i tu vidim trenutno azuriranu sliku sa krugom." So the screen a member sends
 * from shows the waiting picture, cut to the circle he set, under a mark that it is waiting.
 *
 * <p><b>BOTH HALVES ARE IMPLEMENTED HERE, which is what this increment is.</b> 21b gets the
 * GET this class did not have ({@link #mine}) plus the bytes route beside it
 * ({@link PhotoApi#mineThatWaits}), and 21c takes the refusal out of {@link #send}.
 *
 * <p><b>SO THE QUESTION THIS CLASS USED TO NAME AS OPEN IS ANSWERED: {@code digest} STAYS, and
 * it is now what the screen ASKS with.</b> It was put on the answer so the member could see his
 * own waiting picture, and until this increment no route served those bytes to him -
 * {@link PhotoApi#photo} refuses a picture only a queue row holds (ADL A60), and
 * {@link PhotoApi#waitingOn} is the moderator's, keyed to a {@code verification.id} he does not
 * know and shut by a queue right he does not hold. {@link PhotoApi#mineThatWaits} answers at
 * {@code /api/me/photo/<digest>}, so the field stopped being decoration the day that route was
 * written.
 *
 * <p><b>AND PDL 21c: SENDING AGAIN OVERWRITES THE ROW THAT WAITS.</b> „Ako hocu da pregazim
 * novom ili da pomerim krug da gadja drugi deo slike, opet se salje na verifikaciju i gazi
 * trenutan red kod verifikatora." So the 409 this class used to answer
 * ({@code aPictureAlreadyWaits}) is gone, and „gazi" is read as the owner's own boundary reads
 * it - see {@link #send}, where the POINTER MOVES and the row does not.
 *
 * <h2>THE FIRST MULTIPART ROUTE, AND WHAT THAT CHANGES</h2>
 *
 * <p><b>Until this class, no signature under {@code backend/src/main/java} carried a
 * {@link MultipartFile} or a {@code @RequestPart}</b>, and three routes said so in as many
 * words - {@link RegistrationApi}, {@link TeamWriteApi} and {@link MeWriteApi}, each of them
 * naming the picture among what it deliberately does not collect. Those sentences are about
 * THEIR OWN mappings and stay true: each of the three declares
 * {@code consumes = MediaType.APPLICATION_JSON_VALUE}, so a {@code multipart/form-data} body
 * still does not match them and still answers 404 rather than 415. What has changed is that
 * the portal now has one address that is written to be handed a file, and it is this one.
 *
 * <p><b>SO THIS MAPPING SAYS WHAT IT CONSUMES TOO, and for the mirror image of their
 * reason.</b> A JSON body posted here matches nothing and goes down the road an address that
 * is not there takes ({@link NothingIsHereRatherThanAlmost}), rather than reaching an
 * argument resolver that would answer 415 and thereby say „this address is here and wants
 * something else".
 *
 * <h2>WHAT IS CHECKED, AND THE ORDER IS PART OF IT</h2>
 *
 * <p>Every refusal happens before anything is written, which is {@link MeWriteApi}'s own
 * rule about its transaction, and here it covers a second thing that cannot be rolled back
 * at all: a file on a disk.
 *
 * <ol>
 * <li><b>Is there a member behind this account?</b> Asked first, exactly as
 * {@link MeWriteApi#change} asks it, and answered 404 with no body (ADL A8, 13.09.2026).
 * <li><b>Is one of his pictures already waiting?</b> Asked, but no longer to REFUSE him:
 * it is what decides whether this send overwrites a row or opens one, and it is asked with
 * {@code for update} so a decision cannot land between the question and the answer, <b>and
 * only once this member's turn is held</b> (the section below), because for a FIRST send there is
 * no row for {@code for update} to lock. <b>The
 * 409 that used to stand here is what PDL 21c removed</b>, and the pair it was derived from
 * (the owner's 409 for the TEXT, 19.09.2026) is untouched: {@link MeWriteApi} still refuses a
 * second biography, because a text and a picture are two sorts on one tab and „razlikuje se
 * samo sta moderator pise".
 * <li><b>Did a picture arrive at all?</b> If not, this is 21c's second half - „ili da
 * pomerim krug da gadja drugi deo slike" - and it is legal exactly when something is
 * waiting to be re-cropped. With nothing waiting there is no picture to move a circle over,
 * so it is {@link #THE_FORM_IS_NOT_COMPLETE} as before.
 * <li><b>Is the crop three fractions between nought and one?</b> V21 bounds all three and
 * bounds the diameter above nought; a crop outside that is refused here rather than by the
 * constraint, because a constraint violation aborts the transaction and answers 500 where
 * the member should have been told which number was wrong.
 * <li><b>Is the file small enough, and is it a picture?</b> {@link WhatAPictureIs} answers
 * both, and the second is answered by reading the bytes rather than the name or the
 * {@code Content-Type} the browser claimed (ADL A12a, 1).
 * </ol>
 *
 * <h2>THE SENDS OF ONE MEMBER TAKE TURNS, AND THAT IS WHAT LETS THE QUESTION ABOVE SAY
 * „FIRST"</h2>
 *
 * <p><b>The hole, measured and not read.</b> {@code for update} locks the rows a query returns,
 * and for a member's FIRST picture the question above returns none: nothing waits, so there is
 * nothing to lock. Two first sends that both asked before either wrote were both told „nothing
 * waits" and both opened a row, and a member pressing „Posalji" twice is enough. Measured on
 * 09.10.2026 on the code before this section existed, with the case written first
 * ({@code APictureSentTwiceAtOnceTest}): two first sends held at the foreign key of the insert by
 * one row lock and then let go were both answered 200, with two different queue rows, two pictures
 * of one member waiting, both of their {@code photo} rows held, and both files on the disk. The
 * owner's „Red ostaje jedan" (PDL 21c) was untrue for the one send it matters most for.
 *
 * <p><b>The fix has two halves and neither is enough alone.</b>
 *
 * <ul>
 * <li><b>The sends of one member take turns.</b> {@link #oneSendOfAMemberAtATime} takes a
 * transaction-scoped advisory lock keyed by the member, as the first statement after the member
 * question. The second send waits for the first to commit, then asks the question above and finds
 * the row the first opened, so it goes down the overwrite road and leaves exactly what a send that
 * arrived after the first leaves: one row, with the first's {@code id} and place in the queue, the
 * second's picture, and the first's picture and file gone. Measured on this case for two sends at
 * once and for three.
 * <li><b>The database refuses a second picture.</b> {@code verification_one_picture_waits_per_member}
 * (V55) is a partial unique index under the words of {@link #THE_ONE_OF_MINE_THAT_WAITS}. It is the
 * floor under the lock: a writer that does not take the turn, a future door or this one with the
 * lock taken out, meets a unique violation and not a second row. It does not make the second send
 * an overwrite, which is the lock's work, and V55's header says why the two are measured apart.
 * </ul>
 *
 * <p><b>The mechanism is a technical choice made between measured alternatives on 09.10.2026, and
 * not a sentence of the owner's.</b> The OUTCOME is his (PDL 21c). Three other ways of getting it
 * were each measured against the same case and not taken:
 *
 * <ul>
 * <li><b>{@code on conflict do update} on the index</b>, so that the loser's insert becomes the
 * overwrite. The rows come out right, but the statement cannot say which picture it replaced, so
 * the route cannot delete that picture's file: one stray file for two sends, two for three, until
 * {@link ThePicturesFolderIsSwept} picks them up. That is not what a send after the first leaves.
 * <li><b>{@code on conflict do nothing} and then asking again</b>, the shape {@link MeWriteApi}
 * has for a text. The loser's second question can find nothing, because a moderator may decide the
 * winner's row in the instant between the conflict and the question, and that is a third road no
 * case can enter without a hook inside that instant. The gate asks one hundred per cent of the
 * branches, and a branch nothing can reach is a branch that looks like protection.
 * <li><b>Locking the member's row first.</b> {@link VerificationWriteApi} claims the QUEUE row and
 * then updates the MEMBER, so a send that took the member and then the queue row is the opposite
 * order. Measured with two transactions in those two orders: deadlock detected after about a
 * second, the victim a moderator's decision in one run and the send in the other. The advisory lock
 * cannot be part of such a cycle, because a send waits for it only while holding nothing else.
 * </ul>
 *
 * <p><b>Transaction-scoped and not session-scoped, and that is measured too.</b> A session lock
 * outlives the request that took it: it stays on the pooled connection, and the next send of that
 * member, on another connection, waits behind a request that has finished (made session-scoped,
 * {@code APictureSentTwiceAtOnceTest} fails: at once in the case that asks the lock manager, and in
 * the forced cases after it, which find the requests of the one before stuck behind the leaked
 * lock). A transaction lock leaves with the commit or the rollback of the transaction that took it,
 * whichever comes, with the session that took it still connected (measured on PostgreSQL 18, both
 * ways), so a send that fails at the disk ({@code rollbackFor = IOException.class}) lets the next
 * one through.
 *
 * <p><b>The boundary, named rather than left to be found.</b> The sends of one member wait for one
 * another, and each waiting request holds a connection of the pool, which is the default ten and is
 * not tuned (ADL, the open entry of 14.09.2026 on the size of the pool). {@code lock_timeout} is
 * not set by the portal, so the wait has no end of its own: it ends when the transaction in front
 * of it ends, and that one writes a file of up to {@link WhatAPictureIs#AT_MOST_BYTES} bytes and
 * runs V54's deferred triggers at commit. A REPEATED send already waited like that, on the row,
 * with the same bound; the first send waits now too. This is the first advisory lock in the portal
 * (there is none in backend/src, deploy or backend/tools on 09.10.2026). Its key is a text hashed
 * by the database, so it is this route's own, and two members whose keys met would only take turns.
 *
 * <h2>THE ROW IS WRITTEN FIRST AND THE FILE IS WRITTEN AFTER IT, WHICH IS NOT AN ORDER
 * ANYBODY MAY SWAP</h2>
 *
 * <p>V8: „the file lives on the disk under a name the database issues", and the name is the
 * {@code photo} row's own key. So the key has to exist before the file can be named, and
 * there is no arrangement in which the file comes first.
 *
 * <p><b>What that costs, named rather than discovered.</b> A write to a disk is not part of
 * a transaction and cannot be rolled back. Written inside it, as it is here, the two
 * failures fall the two different ways they should:
 *
 * <ul>
 * <li><b>The file cannot be written</b> - no room, no permission, no folder - and the
 * exception rolls the row and the queue item back, <b>because this mapping says
 * {@code rollbackFor = IOException.class} and would not otherwise</b>. Spring rolls back on
 * a {@link RuntimeException} and an {@link Error} and COMMITS on a checked one, and
 * {@link IOException} is checked: this paragraph claimed the rollback for a round without it
 * being true, and a security review measured what that cost. With the row committed, a
 * passing fault of the disk left a queue card pointing at a picture with no file, and the only
 * way out was a moderator approving a picture {@link PhotoApi} could never serve. <b>The half
 * of that cost which said the member was then „refused for ever" by a 409 has gone with the 409
 * itself (PDL 21c), and the guard has NOT</b>: a card in front of a moderator that names bytes
 * nobody can read is wrong whether or not its member can send again, and since 21c the rollback
 * carries a second weight the 409 never had - an overwrite DELETES the picture it replaced, so a
 * half-written send that committed would take a good picture with it. <b>The case that holds it
 * cannot live in {@code MePhotoApiTest}</b>, because that class is {@code @Transactional} and
 * the route then joins the test's transaction, which is exactly why the fault survived a green
 * file; it is in {@code ThePictureAndItsFileAreOneThingTest}, which is not.
 * <li><b>{@link #remove}'s own mapping does NOT carry {@code rollbackFor}, and since PDL
 * P28e nothing checked leaves it either</b>, though a review on 25.09.2026 found the attribute
 * copied there anyway. There the checked exception is the FILE refusing to leave the disk after
 * the row and the pointer are already gone, and the owner's decisions about it are two
 * different sentences. PDL P28b, 3, 24.09.2026 calls a removal immediate and not moot -
 * „Brisanje slike stupa odmah, bez moderacije... Uklanjanje ne moze da bude sporno" - so
 * rolling the row back because a file would not go undoes exactly that decision. And PDL P28e,
 * 25.09.2026, which he chose among the outcomes offered with my recommendation beside it,
 * settles what the member is told: the ordinary answer, with the fault in the log. So the
 * exception is caught where it is thrown, logged with the picture's key and its cause, and the
 * answer is the one a removal gets when the file leaves. What stays on the disk is a stray
 * file, and until {@link ThePicturesFolderIsSwept} deletes it - once an hour, when it is older
 * than ten minutes - {@link PhotoApi} already serves nothing for a picture no row points at: it
 * asks for a {@code photo} row and a holder, never for a file.
 * {@code TheRemovalStandsEvenWhenTheFileWontGoTest} holds all three halves - the row goes, the
 * answer is ordinary, the fault is in the log - outside {@code MePhotoApiTest} for the
 * identical reason the case above is.
 * <li><b>THE OVERWRITE IN {@link #send} DOES THE SAME FOR THE FILE OF THE PICTURE IT
 * REPLACES, AND THAT IS MY READING OF PDL P28e AND NOT THE OWNER'S WORD ABOUT REPLACING.</b>
 * The decision speaks of a removal, but the condition it states - the row goes and the file
 * cannot be deleted - is true of an overwrite exactly as it is of a removal, and there it was
 * worse: the exception rolled the whole send back through {@code rollbackFor}, so a member whose
 * new picture had been written was answered 500, the new row went, and the new file stayed on
 * the disk with nothing pointing at it. The {@code rollbackFor} above is for a file that cannot
 * be WRITTEN and stays; a file that cannot be DELETED, after the row it belonged to is gone, is
 * caught, logged and answered as a send that succeeded. The owner said nothing about what a
 * member is told when the old file of a picture he has REPLACED will not go; if he reads it
 * differently, this is the one place to turn.
 * <li><b>The commit itself fails after the file was written</b> and a file is left on the
 * disk that no row points at. That is the one leak this route makes, it is bounded by
 * {@link WhatAPictureIs#AT_MOST_BYTES} apiece, and {@link PhotoApi} serves nothing for it -
 * „a picture nothing holds at all answers the same as a digest nobody wrote". It is not swept
 * here, because that would be one route carrying a rule about the whole disk:
 * {@link ThePicturesFolderIsSwept} deletes such files once an hour, once they are older than ten
 * minutes, and a file whose commit is still on its way is younger than that.
 * </ul>
 *
 * <h2>WHAT IS NOT HERE, EACH NAMED RATHER THAN DISCOVERED</h2>
 *
 * <ul>
 * <li><b>THE BYTES THEMSELVES, which are one address away and deliberately not this one.</b>
 * {@link #mine} answers WHERE they are and {@link PhotoApi#mineThatWaits} answers WITH them,
 * and they are two routes because {@code PhotoApi.bytesOf} is the one place in this portal
 * that reads a picture off a disk for a response and the one place {@code NOFOLLOW_LINKS} is
 * written - a second reader would split the refusal of a symbolic link across two files. What
 * is NOT loosened is {@link PhotoApi#photo}: a picture only a queue row holds is still not
 * public and {@code THE_PICTURE_A_DIGEST_NAMES} is untouched, so „javan nosilac" still means
 * exactly {@code competitor.photo_id} and {@code team.logo_id} (ADL A60).
 * <li><b>The decision.</b> Approving or refusing belongs to whoever holds
 * {@code queue:profiles} and {@link VerificationWriteApi} already does it - on approval it
 * runs {@code update competitor set photo_id = ?} and empties the queue row's own pointer,
 * which V9's {@code verification_decided_keeps_no_photo} requires. Nothing here touches that
 * branch.
 * <li><b>The file leaving the disk when a moderator decides.</b> ADL A12a, 1 asks for it and
 * V9 says the schema can only carry half of it - „that the FILE leaves the disk with it is
 * the deleting code's to do". Neither this route nor the decision does it. Since V54 the
 * database deletes the {@code photo} row of a picture that a decision, or anything else, leaves
 * with no holder, and {@link ThePicturesFolderIsSwept} deletes the file of a row that is gone
 * at its next hourly pass. This class deletes a file itself in two cases only, both of them a
 * member's own act: he takes his standing picture down, and he overwrites one that waits.
 * <li><b>A SIZE IN PIXELS, AND IT IS A REAL DECISION OF THE OWNER'S THAT THIS ROUTE DOES NOT
 * ENFORCE.</b> PDL, 27.08.2026, between three measured candidates: „Poslusacu preporuku 240."
 * So a picture whose shorter edge is under 240 real pixels is refused and a circle may not be
 * cut smaller than that inside one, and {@code frontend/src/components/crop.ts} carries both
 * as {@code SMALLEST_PIXELS} and {@code closestIn}. The server does NOT repeat either, and
 * the reason is measured rather than lazy: both need the picture's DIMENSIONS, which means
 * decoding it, and the platform's {@code ImageIO} cannot read {@code image/webp} at all - so
 * a rule written here would hold for two of the three types the schema allows and quietly not
 * for the third, which is worse than a rule that says what it covers. <b>What that leaves
 * open is a request that never passed through the form</b>, exactly the case
 * {@link com.btl.portal.domain.registration.WhatRegistrationAsksFor} is written against; what
 * it costs today is a portrait a moderator refuses, which is the road every picture is on
 * anyway. Closing it properly means a decoder that reads all three formats, and that is a
 * dependency and its own piece of work.
 * <li><b>A BYTE SIZE THE OWNER CHOSE.</b> {@link WhatAPictureIs#AT_MOST_BYTES} is five
 * megabytes and that number is MINE, not his: ADL A12a asks for a limit and names none, and
 * nothing in either journal carries one. It is marked as mine where it is declared and it is
 * a question going back to him rather than an entry written into a journal.
 * </ul>
 *
 * <p><b>No route here carries a {@link RightIsNeeded}</b>, for {@link MeWriteApi}'s own
 * reason: no box anybody could tick would let one member change another's portrait. All three
 * are named in {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT}, by method and path
 * together, and that list has a floor:
 * {@code everyRouteTheControllersMapEitherNeedsARightOrIsNamedHere} reads every mapping out of
 * {@code RequestMappingHandlerMapping} and compares the two sets exactly, so a route added
 * without an entry fails the gate rather than going unnoticed.
 */
@RestController
class MePhotoApi {

	private static final Logger LOG = LoggerFactory.getLogger(MePhotoApi.class);

	/**
	 * Nothing arrived where the picture should have been, AND there was nothing to re-crop.
	 *
	 * <p>Since PDL 21c a send with no file is how „ili da pomerim krug da gadja drugi deo
	 * slike" is said, so this answer narrowed rather than stayed: it is the state where a
	 * circle arrived over nothing at all.
	 */
	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/** More bytes than {@link WhatAPictureIs#AT_MOST_BYTES}. */
	static final String THE_PICTURE_IS_TOO_BIG = "thePictureIsTooBig";

	/**
	 * The bytes are not one of the three formats the schema holds.
	 *
	 * <p>One answer for „this is a text file called {@code portret.jpg}" and for „this is a
	 * GIF", because the member's way out of both is the same: hand over a different file.
	 */
	static final String THIS_IS_NOT_A_PICTURE = "thisIsNotAPicture";

	/** One of the three fractions is missing, unreadable, or outside what V21 holds. */
	static final String THE_CROP_IS_NOT_A_CIRCLE = "theCropIsNotACircle";

	/** The tab a portrait waits in, which is the one PDL P28a names „Profili". */
	private static final String THE_PROFILES_TAB = "profiles";

	/**
	 * Where the picture ON THE PROFILE is asked for, which is the public route and unchanged.
	 *
	 * <p>Spelt the same way {@link CompetitorApi} and {@link TeamApi} spell it, because it is
	 * the same address and PDL P28f settled the shape there: „Ruta nosi dva polja: `photo`,
	 * adresu oblika `/api/photos/<otisak>`, i `crop` sa tri frakcije, oba `null` za clana bez
	 * slike."
	 */
	private static final String A_PUBLISHED_PICTURE_IS_ASKED_FOR_AT = "/api/photos/";

	/**
	 * And where the picture that is still WAITING is asked for, which is nobody's but his.
	 *
	 * <p><b>The digest and not a fixed word, and that is measured rather than tidy.</b>
	 * {@link PhotoApi} keeps every answer that carries bytes for a day (privately), and the
	 * whole ground for that is that an address derived from CONTENT cannot come to mean
	 * different bytes. Since PDL 21c the picture a member is waiting on may be replaced, so a
	 * fixed address such as {@code /api/me/photo/waiting} would serve him the picture he just
	 * overwrote for up to a day. With the digest in it, a new picture is a new address and the
	 * day stands.
	 */
	private static final String MY_WAITING_PICTURE_IS_ASKED_FOR_AT = "/api/me/photo/";

	/**
	 * THE ONE ROW OF HIS THAT IS WAITING WITH A PICTURE IN IT, as a clause rather than a query.
	 *
	 * <p>It is a fragment because two things ask it and they must not come to ask it
	 * differently: {@link #theOneThatWaits} reads the row in order to write, and {@link #mine}
	 * reads the same row's picture in order to answer. Written twice, the day one of them gains
	 * a condition is the day they disagree about what „waiting" means.
	 *
	 * <p><b>{@code state = 'waiting'} IS WRITTEN HERE AND CANNOT BE MEASURED HERE, AND THAT IS
	 * SAID OUT LOUD RATHER THAN LEFT FOR A REVIEWER.</b> A mutation that loosened it to „any
	 * state at all" leaves the file green, and the reason is not a missing case but V9:
	 * {@code verification_decided_keeps_no_photo check (state = 'waiting' or photo_id is null)} -
	 * read the other way round, a row whose {@code photo_id} is NOT null is necessarily still
	 * waiting. So for PICTURES the two conditions imply each other and no fixture can separate
	 * them, because the database refuses to hold the row that would. <b>It stays</b> because it
	 * says what this clause means to a reader who has not got V9 open, and because it goes on
	 * being right the day that constraint is relaxed. <b>What IS measured is the thing that
	 * really holds it:</b> {@code MePhotoApiTest.theSchemaRefusesADecidedRowThatStillHoldsAPicture}
	 * asks the database to write exactly that row and requires it to refuse.
	 *
	 * <p><b>Note that the same condition on {@link MeWriteApi}'s TEXT query is load bearing</b>,
	 * because a decided text keeps its {@code body}: there the two halves of this tab really do
	 * differ, which is what PDL P28a means by one row holding two sorts.
	 *
	 * <p>Oldest first with the key last and {@code limit 1}, which is how V9 indexes the queue
	 * and how {@link VerificationApi} reads it.
	 */
	private static final String THE_ONE_OF_MINE_THAT_WAITS =
			" from verification v where v.competitor_id = :me and v.queue = :tab"
			+ " and v.state = 'waiting' and v.photo_id is not null"
			+ " order by v.raised_at, v.id limit 1";

	/**
	 * The bounds V21 puts on the two positions, spelt here so a refusal can name the fault.
	 *
	 * <p>{@code photo_crop_x_in_range check (crop_x between 0 and 1)} and the same for
	 * {@code crop_y}. Inclusive at both ends, which V21 says is the point: „0 and 1 are
	 * legal positions and not edge cases".
	 */
	private static final BigDecimal NONE = BigDecimal.ZERO;

	private static final BigDecimal ALL = BigDecimal.ONE;

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	private final Path folder;

	/**
	 * @param folder the same setting {@link PhotoApi} reads, and it must be: one of them
	 *               writes the file and the other opens it, so two settings would be two
	 *               folders the day somebody set one of them
	 */
	MePhotoApi(JdbcClient db, MemberOfAccount memberOfAccount,
			@Value("${btl.photos.folder}") String folder) {

		this.db = db;
		this.memberOfAccount = memberOfAccount;
		this.folder = Path.of(folder);
	}

	/** Why the picture was not taken. */
	record Refused(String reason) {
	}

	/**
	 * WHAT IS TRUE AFTER THE PICTURE WAS TAKEN, read back rather than echoed.
	 *
	 * @param waiting  the key of the queue row his picture is standing in
	 * @param digest   the digest of the picture that is waiting, which is the name
	 *                 {@link PhotoApi} would serve it under. Answered to its own sender and
	 *                 to nobody else, which is the owner's decision of 24.09.2026
	 * @param standing the digest of the picture that is ON the profile, or null where there
	 *                 is none - and it is deliberately answered beside the one above, because
	 *                 the whole of that decision is that the two are DIFFERENT pictures while
	 *                 one waits. Echoed as one field, a screen could not draw „this is what
	 *                 everybody sees, and this is what you sent"
	 */
	record Waiting(long waiting, String digest, String standing) {
	}

	/**
	 * The three fractions, under the portal's own names for them.
	 *
	 * <p>{@link CompetitorApi} and {@link TeamApi} both carry a record of exactly this shape and
	 * both explain the third name: the column has been {@code crop_diameter} since V21 and the
	 * portal's word is {@code size}. A third copy rather than one shared record is what those two
	 * already do, and the reason holds here too - each resource owns the shape of its own answer,
	 * and a shared record would make three contracts move together the day one of them wants a
	 * fourth number.
	 */
	record Crop(BigDecimal x, BigDecimal y, BigDecimal size) {
	}

	/**
	 * One picture as a screen needs it: an address to fetch it from, and the circle over it.
	 *
	 * @param photo the address, never the key. Which address depends on which picture this is,
	 *              and that is the whole difference the two fields below carry
	 * @param crop  the circle the member set, which V21 keeps as three fractions and which
	 *              {@link PhotoApi} never burns into the bytes (ADL A17)
	 */
	record Picture(String photo, Crop crop) {
	}

	/**
	 * WHAT THIS MEMBER'S PORTRAIT IS DOING, BOTH HALVES OF IT, and either may be nothing.
	 *
	 * <p><b>PDL 21 decides the two halves separately and this record is why they can be drawn
	 * apart.</b> 21a: on the PROFILE he does not see it until it is approved. 21b, the screen
	 * this answers: „ukoliko udjem da posaljem ponovo, vidim da je trenutno slika u statusu
	 * cekanja i tu vidim trenutno azuriranu sliku sa krugom." Two fields, so a screen can say
	 * „this is what everybody sees, and this is what you sent" rather than guessing which it has.
	 *
	 * <p><b>Both null for a member with no picture at all</b>, which is the shape PDL P28f fixed
	 * for {@link CompetitorApi}: „oba `null` za clana bez slike". An absent key would tell the
	 * two states apart by their SHAPE, which is what PDL.md ("postoji jedno stanje profila i
 * jedno ponašanje veze") refuses for hiding, and
	 * there is no reason for this answer to invent a second convention.
	 *
	 * @param waiting  at {@code /api/me/photo/<digest>}, served by
	 *                 {@link PhotoApi#mineThatWaits} and by nothing else. This is the field that
	 *                 did not survive a reload before this increment: the bytes lived in the
	 *                 browser that sent them and no route would answer them again
	 * @param standing at {@code /api/photos/<digest>}, the public address, because a picture on
	 *                 a profile IS published and {@link PhotoApi#photo} already serves it
	 */
	record MyPictures(Picture waiting, Picture standing) {
	}

	/**
	 * The row of his that is waiting, and the picture in it, read as one row.
	 *
	 * <p>Both are needed by {@link #send} and reading them separately would be reading two
	 * moments: a decision landing in between would empty the pointer under the second read.
	 *
	 * @param row   {@code verification.id}, which is what an overwrite REPOINTS and never
	 *              replaces
	 * @param photo {@code photo.id} of the picture being replaced, which is what the overwrite
	 *              then takes away
	 */
	private record Waits(long row, long photo) {
	}

	/**
	 * @param picture the file itself, and ABSENT IS A LEGAL REQUEST since PDL 21c: „ili da
	 *                pomerim krug da gadja drugi deo slike". {@code required = false} was
	 *                already here for a different reason - so that a request carrying no such
	 *                part is refused by this class with a sentence rather than by the argument
	 *                resolver with a 400 that names a part - and it now carries both
	 * @param cropX   taken as text and parsed here, for the same reason: a number Spring
	 *                could not bind would be a 400 nobody wrote
	 */
	@PostMapping(path = "/api/me/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	@Transactional(rollbackFor = IOException.class)
	ResponseEntity<?> send(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@RequestPart(name = "picture", required = false) MultipartFile picture,
			@RequestParam(name = "cropX", required = false) String cropX,
			@RequestParam(name = "cropY", required = false) String cropY,
			@RequestParam(name = "cropSize", required = false) String cropSize,
			HttpServletResponse response) throws IOException {

		Long me = memberOfAccount.competitorId(asking.account());

		if (me == null) {
			return away(response);
		}

		/* HIS TURN, AND IT IS THE FIRST STATEMENT THAT TOUCHES ANYTHING OF HIS. After the member
		   question, so an account with no member never takes a turn, and before the question below,
		   so that a FIRST send finds the row the send in front of it opened instead of asking at
		   the same moment and being told „nothing waits". The class note says why a turn and not
		   another way, and why the turn ends with the transaction. */
		oneSendOfAMemberAtATime(me);

		/* ASKED BEFORE THE BYTES ARE LOOKED AT, which is the order this class already kept for
		   the refusal that used to live here: what is waiting decides whether this send opens a
		   row or repoints one, and neither needs five megabytes hashed first.

		   HELD FOR THE LENGTH OF THIS WRITE, and that is the one line PDL 21c's boundary rests
		   on. Without it a decision may land between this read and the repoint below, and then
		   the repoint meets a row the moderator has just approved: V9's
		   `verification_decided_keeps_no_photo` refuses it outright, so the member is answered
		   500 for a request that was perfectly good. With the lock the two serialise, and in
		   READ COMMITTED this statement re-checks its own WHERE after taking the lock - so what
		   comes back is either a row that really is still waiting or nothing at all, and
		   „nothing at all" is the correct answer in that case: his overwrite becomes a fresh
		   proposal beside the decision that just happened.

		   WHAT HOLDS IT, said plainly: nothing here does. The case would have to interleave two
		   requests, which is `VerificationDecisionConcurrencyTest`'s trade and not this file's,
		   and the SCHEMA is the floor underneath either way - the constraint above makes the bad
		   outcome a 500 rather than a lost portrait. This is a boundary written down rather than
		   a protection claimed. That is about a DECISION landing in the middle of a send; two
		   SENDS of one member cannot land in the middle of each other, because of the turn above,
		   and `APictureSentTwiceAtOnceTest` holds that. */
		Optional<Waits> waits = theOneThatWaits(me, true);

		/* A SEND WITH NO FILE IS 21c'S SECOND HALF, and it is legal exactly when there is
		   something to move a circle over. „Ako hocu da pregazim novom ILI DA POMERIM KRUG da
		   gadja drugi deo slike, opet se salje na verifikaciju." With nothing waiting there is no
		   picture here to re-cut, so the sentence this class already had goes on being the right
		   one. */
		boolean onlyTheCircle = picture == null || picture.isEmpty();

		if (onlyTheCircle && waits.isEmpty()) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		BigDecimal x = fraction(cropX, true);
		BigDecimal y = fraction(cropY, true);
		BigDecimal size = fraction(cropSize, false);

		if (x == null || y == null || size == null) {
			return no(HttpStatus.BAD_REQUEST, THE_CROP_IS_NOT_A_CIRCLE);
		}

		/* AND THE CIRCLE ALONE MOVES ON THE ROW THAT IS ALREADY THERE: no second `photo` row, no
		   second file, and the same bytes under the same digest. The digest is the content, so the
		   address `PhotoApi.mineThatWaits` answers at does not move either, which is exactly right
		   - the bytes a browser may have cached really are still the bytes. */
		if (onlyTheCircle) {
			Waits standing = waits.orElseThrow();

			db.sql("update photo set crop_x = ?, crop_y = ?, crop_diameter = ? where id = ?")
					.params(x, y, size, standing.photo())
					.update();

			return ResponseEntity.ok(new Waiting(standing.row(), theDigestOf(standing.photo()),
					theDigestStandingOn(me)));
		}

		/* THE LENGTH IS ASKED OF THE PART BEFORE THE BYTES ARE READ INTO MEMORY. Spring has
		   already written anything over `spring.servlet.multipart.file-size-threshold` to a
		   temporary file, so `getSize` is answered without reading it, and a file this
		   portal is going to refuse is never held whole in the heap. */
		if (picture.getSize() > WhatAPictureIs.AT_MOST_BYTES) {
			return no(HttpStatus.BAD_REQUEST, THE_PICTURE_IS_TOO_BIG);
		}

		byte[] bytes = picture.getBytes();
		String mediaType = WhatAPictureIs.sniff(bytes);

		/* BY THE CONTENT, AND BY NOTHING THE BROWSER SAID. ADL A12a, 1. Neither
		   `picture.getContentType()` nor `picture.getOriginalFilename()` is read anywhere in
		   this class, and that is not an oversight to be corrected later: the name is what
		   V8 refuses to let near a path, and the type is what an attacker chooses. */
		if (mediaType == null) {
			return no(HttpStatus.BAD_REQUEST, THIS_IS_NOT_A_PICTURE);
		}

		/* HASHED ONCE. The row is written with it and the answer carries it, and on a file of
		   five megabytes a second pass is a second pass over five megabytes for a value that
		   cannot have changed in between. */
		String digest = WhatAPictureIs.digestOf(bytes);

		long photo = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values (?, ?, ?, ?, ?, ?) returning id")
				.params(mediaType, bytes.length, digest, x, y, size)
				.query(Long.class)
				.single();

		/* AND NOW EITHER THE ROW THAT IS THERE POINTS AT THE NEW PICTURE, OR A ROW IS OPENED.
		   PDL 21c, the owner: „opet se salje na verifikaciju i gazi trenutan red kod
		   verifikatora", and „Red ostaje jedan".

		   REPOINTED AND NOT REPLACED, and the choice is the owner's own boundary rather than
		   taste. He was told what overwriting costs and accepted it in these words: „ako clan
		   pregazi sliku dok je moderator gleda, RED MU SE PROMENI POD RUKOM. Po pravilu da red
		   ostaje jedan to je prihvatljivo, ali se zna i zapisano je." Measured against the
		   schema, that sentence is true of one of the two shapes and not the other:

		     - repointed, the row keeps its `id` and its `raised_at`, and V28's
		       `verification_lock` row keeps pointing at it - so a moderator who is holding it
		       goes on holding it and the picture under his hand changes, which is the sentence;
		     - deleted and opened again, the row VANISHES from under him and the hold goes with
		       it, because `verification_lock_verification_fk` is ON DELETE CASCADE. That is a
		       different thing, and no decision describes it.

		   Measured, both directions, on a real PostgreSQL: the lock count is 1 before, 1 after a
		   repoint, and 0 after a delete.

		   AND HIS PLACE IN THE QUEUE IS KEPT, which follows from the same choice and is named so
		   nobody reads it as an accident: `raised_at` is untouched, so a member who moves the
		   circle ten times does not go to the back of a queue V9 orders by that column. */
		long waiting;

		if (waits.isPresent()) {
			db.sql("update verification set photo_id = ? where id = ?")
					.params(photo, waits.orElseThrow().row())
					.update();

			waiting = waits.orElseThrow().row();
		} else {
			/* THE SUBJECT IS THE MEMBER'S OWN NAME AND COMES OUT OF HIS OWN ROW, which is the
			   arrangement `MeWriteApi.queued` already measured: PDL P21 gives a member under
			   sixteen an account his parent holds, so `account.first_name` is the parent's and
			   `competitor.first_name` is the child's, and a card about the child's profile
			   carries the child's name. Selected inside the statement, there is no variable in
			   between for the other value to arrive in.

			   `body` IS EMPTY AND THAT IS THE SCHEMA'S OWN WORD FOR IT. V9 makes the column NOT
			   NULL and says it „may be blank - the same shape `competitor.bio` already has", for
			   „a tab that proposes nothing". A picture proposes a picture; what the moderator
			   looks at is `photo_id`, and a sentence invented here would be the portal writing
			   into a field the member never filled in. */
			waiting = db.sql("insert into verification (queue, competitor_id, subject, body,"
							+ " photo_id) select ?, c.id, c.first_name || ' ' || c.last_name, '', ?"
							+ " from competitor c where c.id = ? returning id")
					.params(THE_PROFILES_TAB, photo, me)
					.query(Long.class)
					.single();
		}

		/* AND THE FILE, UNDER THE NAME THE DATABASE JUST ISSUED. `String.valueOf` of a
		   `long` is the same thing `PhotoApi` resolves when it opens one, and it is the whole
		   of why climbing out of the folder is not refused here but unsayable: a `long`
		   carries no separator, no dot and no encoding.

		   CREATE_NEW AND NOT CREATE, AND IT IS A BOUNDARY RATHER THAN A GUARD. The reasoning
		   is that a `bigserial` just handed out cannot name a file that is already there, so a
		   file that IS there means something is wrong and overwriting it would destroy a
		   picture this route never looked at.

		   WHAT IT IS NOT IS MEASURED, and a review on 25.09.2026 said so: swapping it for
		   CREATE leaves the whole of `MePhotoApiTest` green, 34 of 34. No case can reach it,
		   because reaching it means predicting the key the sequence is about to hand out and
		   putting a file there first - and a sequence is not transactional, so that number is
		   not knowable from a test without writing the very race this line is about.
		   `CLAUDE.md` asks that such a thing be written down as a decision instead of claimed
		   as a protection, so it is: this is a belt beside the braces, the braces being that
		   the name comes from the database and from nothing a member sent. */
		Files.createDirectories(folder);
		Files.write(folder.resolve(String.valueOf(photo)), bytes, StandardOpenOption.CREATE_NEW,
				StandardOpenOption.WRITE);

		/* AND ONLY NOW DOES THE FILE OF THE PICTURE THAT WAS OVERWRITTEN GO, and its ROW goes by
		   itself. The repoint above is what let go of that picture, and the database deletes a
		   `photo` row that nobody holds at the end of this transaction (V54; ADL A68, 03.10.2026,
		   „Na kraju svake transakcije baza brise zapis slike koji vise ne drzi nijedna od cetiri
		   kolone"), so this route no longer deletes the row. It used to, and the order it kept was
		   measured in both directions on a real PostgreSQL:

		     - THE POINTER MOVES FIRST, ALWAYS, and it still does, because it is the event the
		       database reacts to. Deleting the `photo` row while the queue row still pointed at it
		       was not refused - `verification_photo_fk` is ON DELETE SET NULL (V9) - and what it
		       left behind was worse than a refusal would have been. The row SURVIVED as
		       `state = 'waiting', photo_id = null`, which is exactly the shape of a BIOGRAPHY item
		       (`MeWriteApi.theTextThatWaits` asks for `photo_id is null`). Measured: after such a
		       delete this class's own query answered 0 rows and `MeWriteApi`'s answered 1. So the
		       moderator got a card proposing a text that is empty, and the member's biography was
		       locked behind `MeWriteApi`'s own 409 by a row nobody meant to write. The database
		       deletes only a photo that no column points at, so it cannot make that row.
		     - AND THE FILE GOES AFTER THE NEW ONE IS WRITTEN, which is why this is below
		       `Files.write` and not above it. Written first, a disk that then refused the new file
		       would roll the rows back onto a picture whose bytes had already gone.

		   WHAT THIS COSTS, named rather than discovered: the delete of a FILE is not part of a
		   transaction, so a commit that failed after this line leaves the row pointing at bytes
		   that are gone. That is not a new state - it is the one `remove` already accepts by the
		   same reasoning, and `PhotoApi` answers it exactly as it answers a digest nobody wrote
		   and logs the fault for whoever runs the server.

		   AND THE FILE IS DELETED WITHOUT ASKING WHETHER ANYTHING ELSE HOLDS THE PICTURE, which is
		   a boundary and not an oversight. A waiting picture is held by its queue row alone: every
		   send INSERTS its own `photo` row, and an approval moves the picture onto
		   `competitor.photo_id` while emptying the queue row's pointer
		   (`VerificationWriteApi.approve`), so the two pointers never name one row. The pointer
		   was moved off it one statement ago, and the `for update` above is what stops a decision
		   from putting it on a profile in between. Written as a condition it would be a branch no
		   case could enter, which the gate's hundred per cent of branches refuses. */
		if (waits.isPresent()) {
			long overwritten = waits.orElseThrow().photo();

			/* deleteIfExists AND NOT delete, for `remove`'s own reason: a row whose file has
			   already gone is a state `PhotoApi` names and serves nothing for, and refusing to
			   finish an overwrite because of it would leave the member unable to replace a
			   picture nobody can see anyway. The fault is told to the operator, not to him.

			   AND A FILE THAT WILL NOT GO IS TOLD TO THE OPERATOR AND NOT THROWN, which is `remove`'s
			   rule (PDL P28e) carried one road over, and the carrying is MY READING and not the
			   owner's word about replacing: the condition the decision states - the row goes and the
			   file cannot be deleted - is true here too. Thrown, it was worse than there: this
			   mapping says `rollbackFor = IOException.class` for a file that cannot be WRITTEN, so a
			   file that could not be DELETED rolled back a send whose new picture was already on the
			   disk, answered the member 500, and left that file with no row. The rollback stays for
			   the write above; this line is after the pointer that named the old picture has moved. */
			try {
				if (!Files.deleteIfExists(folder.resolve(String.valueOf(overwritten)))) {
					LOG.warn("the file of photo {} was already gone when its member overwrote it",
							overwritten);
				}
			}
			catch (IOException notRemoved) {
				LOG.warn("the file of photo {} could not be removed from disk when its member"
						+ " overwrote it", overwritten, notRemoved);
			}
		}

		return ResponseEntity.ok(new Waiting(waiting, digest, theDigestStandingOn(me)));
	}

	/**
	 * WHAT THIS MEMBER'S PORTRAIT IS DOING, WHICH IS THE ANSWER A RELOAD NEEDS.
	 *
	 * <p><b>PDL 21b, owner, 27.09.2026:</b> „Neka ta recenica stoji u segmentu da se salje slika.
	 * Tako da ukoliko udjem da posaljem ponovo, vidim da je trenutno slika u statusu cekanja i tu
	 * vidim trenutno azuriranu sliku sa krugom."
	 *
	 * <p><b>WHAT WAS MEASURED BEFORE THIS ROUTE EXISTED, because it is the whole reason it
	 * does.</b> A waiting picture reached the screen only in the visit that SENT it: the bytes
	 * were in that browser and the mark beside them was an overlay in front of the session
	 * (`session/context.ts`). After a reload nothing answered either. {@link #send} carried the
	 * digest of the waiting picture from the day it was written, and no route would serve those
	 * bytes - so the field was a name for something unreachable. This route and
	 * {@link PhotoApi#mineThatWaits} are the two halves that make it reachable.
	 *
	 * <p><b>IT IS A READ OF ONE MEMBER'S OWN ROW AND THE SESSION IS THE WHOLE OF ITS GUARD.</b>
	 * There is no path variable naming a member, no key of a queue row, and therefore no shape in
	 * which this route can answer about somebody else - which is what ADL A60's second amendment
	 * of 27.09.2026 means by „cuvar uske rute po konstrukciji sluzi jednom pozivaocu nad jednim
	 * redom, pa se ne moze slucajno prosiriti". An account with no member behind it (V23, owner
	 * 14.09.2026) is answered as {@link #send} and {@link #remove} answer it: nothing at all.
	 *
	 * <p><b>ONE STATEMENT, and the clause that says „waiting" is
	 * {@link #THE_ONE_OF_MINE_THAT_WAITS} rather than a second copy of it.</b> Read as two
	 * queries this would be two moments - a decision landing in between would let the waiting
	 * picture be answered after it had been approved - and read with the clause written out again
	 * it would be a second home for what „waiting" means.
	 *
	 * <p><b>The two addresses are DIFFERENT and that is the point of answering both.</b> The
	 * standing picture is public and lives at {@code /api/photos/<digest>}; the waiting one is
	 * not public at all and lives at {@code /api/me/photo/<digest>}, which is nobody's address
	 * but his. A screen that got one field could not draw the sentence 21b asks for.
	 *
	 * @param response asked for so that an account these addresses are not for goes down the road
	 *                 an address that is not there takes, exactly as the two writes here do
	 */
	@GetMapping("/api/me/photo")
	ResponseEntity<?> mine(@AuthenticationPrincipal WhoIsAsking.Member asking,
			HttpServletResponse response) throws IOException {

		Long me = memberOfAccount.competitorId(asking.account());

		if (me == null) {
			return away(response);
		}

		return ResponseEntity.ok(db
				.sql("select waiting.digest, waiting.crop_x, waiting.crop_y,"
						+ " waiting.crop_diameter, standing.digest, standing.crop_x,"
						+ " standing.crop_y, standing.crop_diameter"
						+ " from competitor c"
						+ " left join photo standing on standing.id = c.photo_id"
						+ " left join photo waiting on waiting.id = (select v.photo_id"
						+ THE_ONE_OF_MINE_THAT_WAITS + ")"
						+ " where c.id = :me")
				.param("me", me)
				.param("tab", THE_PROFILES_TAB)
				.query((row, one) -> new MyPictures(
						pictureAt(MY_WAITING_PICTURE_IS_ASKED_FOR_AT, row.getString(1),
								row.getBigDecimal(2), row.getBigDecimal(3), row.getBigDecimal(4)),
						pictureAt(A_PUBLISHED_PICTURE_IS_ASKED_FOR_AT, row.getString(5),
								row.getBigDecimal(6), row.getBigDecimal(7), row.getBigDecimal(8))))
				/* ONE ROW, AND IT IS HIS. `account.competitor_id` is ON DELETE RESTRICT (V23) -
				   „the member cannot be deleted while this column still names him" - so a value
				   that is not null names a row that is there, which is the reasoning `MeApi`
				   writes out for the identical read. */
				.single());
	}

	/**
	 * One picture as an address and a circle, or nothing where the join found no row.
	 *
	 * @param at     the prefix, which is what tells the public address from the member's own
	 * @param digest null exactly when the {@code left join} matched nothing, so it is the one
	 *               thing asked. The three fractions are NOT NULL on a row that exists (V21), so
	 *               there is no arrangement in which a digest arrived and a fraction did not
	 */
	private static Picture pictureAt(String at, String digest, BigDecimal x, BigDecimal y,
			BigDecimal size) {

		return digest == null ? null : new Picture(at + digest, new Crop(x, y, size));
	}

	/**
	 * TAKING DOWN THE PICTURE THAT STANDS ON THE PROFILE, WHICH HAPPENS AT ONCE.
	 *
	 * <p>Owner, PDL P28b, 3, 24.09.2026: „Brisanje slike stupa odmah, bez moderacije...
	 * Uklanjanje ne moze da bude sporno." It is the picture's half of the sentence PDL P11
	 * already carries about the biography, and it is the member's right over his own datum
	 * rather than a proposal.
	 *
	 * <p><b>A MEMBER WITH NO PICTURE IS ANSWERED 204 AND NOT 404, which is a decision and
	 * not a shrug.</b> „Take my picture down" asked by somebody who has none is a request
	 * that is already true, and the alternative answer would be the portal refusing to agree
	 * with itself. It is also what makes the control on a screen safe to press twice.
	 *
	 * <p><b>AND IT DOES NOT WITHDRAW A PICTURE THAT IS WAITING.</b> This is the same
	 * boundary {@link MeWriteApi#write} writes down for the biography, and it is written
	 * here rather than quietly patched for the same reason: removing what STANDS and taking
	 * back what a moderator is already HOLDING are different things, no decision covers the
	 * second, and a member whose waiting picture is later approved gets a portrait back on a
	 * profile he had cleared. That is what the decisions say read together. What keeps it
	 * from being a trap is the answer: {@link #Removed} carries the key of the picture that
	 * is still waiting, so a screen says so instead of pretending the profile is now empty
	 * for good.
	 *
	 * <p><b>THE ROW GOES BY ITSELF AND THE FILE GOES HERE.</b> Emptying the pointer is what
	 * lets go of the picture, and the database deletes a {@code photo} row that nobody holds at
	 * the end of the transaction (V54; ADL A68, 03.10.2026, „Na kraju svake transakcije baza
	 * brise zapis slike koji vise ne drzi nijedna od cetiri kolone"). This route used to
	 * delete the row too, and no longer does: written here it would be a second home for a
	 * rule that lives in the database, and A68 records the accepted cost as „pravilo zivi u
	 * bazi, ne u Java kodu". The pointer is still emptied in its own statement, because a
	 * route that leaned on {@code on delete set null} to do the thing it was asked to do would
	 * be a route whose subject is a foreign key rather than a member. The FILE is what a
	 * database cannot delete, so it is deleted here, at once, which is what PDL P28b 3, quoted
	 * at the top, asks; and it is deleted after the statements, because a file removed before
	 * the transaction commits and a transaction that then rolls back would leave a row pointing
	 * at a picture that is gone, which is the one state {@link PhotoApi} has to log a fault for.
	 *
	 * <p><b>A FILE THAT WILL NOT LEAVE THE DISK IS THE OPERATOR'S AND NEVER THE MEMBER'S.</b> PDL
	 * P28e, 25.09.2026: he chose, among the outcomes offered and with my recommendation beside
	 * the one he took, that when the row goes and the file cannot be deleted the member gets the
	 * ordinary answer and the fault goes to the log. The picture really has come down - it is
	 * not served, because {@link PhotoApi} asks for a row and a holder and there is no row - so
	 * the answer that was here before, a 500 for a removal that had happened, told him the
	 * opposite of what is true.
	 */
	@DeleteMapping("/api/me/photo")
	@Transactional
	ResponseEntity<?> remove(@AuthenticationPrincipal WhoIsAsking.Member asking,
			HttpServletResponse response) throws IOException {

		Long me = memberOfAccount.competitorId(asking.account());

		if (me == null) {
			return away(response);
		}

		Optional<Long> standing = db.sql("select photo_id from competitor where id = ?")
				.param(me)
				.query(Long.class)
				.optional();

		if (standing.isPresent()) {
			long photo = standing.orElseThrow();

			db.sql("update competitor set photo_id = null where id = ?").param(me).update();

			/* deleteIfExists AND NOT delete: a row whose file has already gone is a state
			   `PhotoApi` names and serves nothing for, and refusing to take the picture down
			   because of it would leave the member unable to remove a picture nobody can see
			   anyway. The fault is told to the operator and not to him.

			   AND THE SAME FOR A FILE THAT WILL NOT GO (PDL P28e, 25.09.2026): caught here, logged
			   with the picture's key and its cause, answered as an ordinary removal. It is not a
			   cover-up and the reason is measured: after this the picture is no longer public,
			   because `PhotoApi` asks for a `photo` row and a holder and neither exists, so what
			   is left on the disk is a file nothing reads, which `ThePicturesFolderIsSwept`
			   deletes once it is older than ten minutes. The same shape, for the same reason,
			   is in `CompetitorWriteApi` and `ATeamGoesWithItsLastMember`. */
			try {
				if (!Files.deleteIfExists(folder.resolve(String.valueOf(photo)))) {
					LOG.warn("the file of photo {} was already gone when its member took it down",
							photo);
				}
			}
			catch (IOException notRemoved) {
				LOG.warn("the file of photo {} could not be removed from disk when its member took"
						+ " it down", photo, notRemoved);
			}
		}

		/* READ WITHOUT THE LOCK `send` TAKES, and that is deliberate rather than an omission.
		   This read only REPORTS what is waiting; nothing here writes to that row, so there is
		   nothing for a concurrent decision to spoil. Taking the lock anyway would have this
		   route and `send` acquire the same two rows in opposite orders, which is how two
		   requests of one member deadlock rather than queue. */
		return ResponseEntity.ok(new Removed(theOneThatWaits(me, false)
				.map(Waits::row)
				.orElse(null)));
	}

	/**
	 * What is true after a removal.
	 *
	 * @param waiting the key of the picture still standing in front of a moderator, or null.
	 *                Here so that the boundary above is a sentence a screen can draw rather
	 *                than a surprise a member meets a week later
	 */
	record Removed(Long waiting) {
	}

	/**
	 * THIS MEMBER'S ROW STANDING IN THE QUEUE UNDECIDED WITH A PICTURE IN IT, OR NOTHING.
	 *
	 * <p>The mirror of {@link MeWriteApi}'s own {@code theTextThatWaits}, told apart by the one
	 * thing the schema offers: {@code photo_id is not null} where that one asks for null. PDL
	 * P28a, 06.08.2026 puts both in one tab - „Profili: trkacke biografije i profilne slike" -
	 * and „razlikuje se samo sta moderator pise, jer se slika menja po instrukciji a tekst se
	 * pise ponovo". What the clause says and why every word of it is there is on
	 * {@link #THE_ONE_OF_MINE_THAT_WAITS}, which is its one home.
	 *
	 * <p><b>Both columns come back and that is what PDL 21c needs</b>: the key of the ROW,
	 * because an overwrite repoints it and never replaces it, and the key of the PICTURE,
	 * because the overwrite then takes that one away. Read as one row rather than two reads, so
	 * a decision cannot land between them.
	 *
	 * @param holdIt whether the row is locked for the length of the caller's transaction.
	 *               {@link #send} needs it because it WRITES to the row it just read;
	 *               {@link #remove} must not take it, because it only reports what is waiting
	 *               and would otherwise take these two rows in the opposite order from
	 *               {@link #send} and deadlock against it
	 */
	private Optional<Waits> theOneThatWaits(long me, boolean holdIt) {
		return db
				.sql("select v.id, v.photo_id" + THE_ONE_OF_MINE_THAT_WAITS
						+ (holdIt ? " for update" : ""))
				.param("me", me)
				.param("tab", THE_PROFILES_TAB)
				.query((row, one) -> new Waits(row.getLong(1), row.getLong(2)))
				.optional();
	}

	/**
	 * WAITS UNTIL NO OTHER SEND OF THIS MEMBER'S IS IN FLIGHT, AND KEEPS HIS TURN UNTIL THE
	 * TRANSACTION ENDS.
	 *
	 * <p>{@code pg_advisory_xact_lock} is the transaction-scoped one: the commit or the rollback of
	 * the transaction that took it releases it, and there is no unlock call that a road out of
	 * {@link #send} could forget. The key is the text {@code profile-picture:} and his key, hashed
	 * to a {@code bigint} by the database. The function returns {@code void}, which has nothing to
	 * map, hence the cast to text: it only gives {@code JdbcClient} the one row it asks for
	 * something to read.
	 *
	 * <p><b>The text is written here and is NOT a {@code static final String}, and that is
	 * measured rather than tidy.</b> {@code frontend/src/pages/account/refusals.test.ts} reads every
	 * {@code static final String} this class declares as a refusal the screens have to answer, and
	 * counts them: the gate of the screens went red on 09.10.2026 when this text was one, as the
	 * eighth. A constant that is not a refusal has to be named in that file and counted there, and
	 * this text is spelt once, so it is not made one.
	 *
	 * <p>Why a turn and not another way, and where its edge is, is the class note on the sends of
	 * one member.
	 */
	private void oneSendOfAMemberAtATime(long me) {
		db.sql("select pg_advisory_xact_lock(hashtextextended(?, 0))::text")
				.param("profile-picture:" + me)
				.query(String.class)
				.single();
	}

	/**
	 * The digest of one picture by its key, which is the address it is asked for at.
	 *
	 * <p>Read back rather than carried down from the crop that was just written: what the answer
	 * has to name is the row as it now stands, and a value held in a variable across an
	 * {@code update} is a value nobody read.
	 */
	private String theDigestOf(long photo) {
		return db.sql("select digest from photo where id = ?")
				.param(photo)
				.query(String.class)
				.single();
	}

	/**
	 * The digest of the picture that is ON the profile, or nothing.
	 *
	 * <p>Read through the join rather than off {@code photo_id}, because the key is this
	 * database's own and the digest is the address {@link PhotoApi} answers at.
	 */
	private String theDigestStandingOn(long me) {
		return db.sql("select p.digest from competitor c join photo p on p.id = c.photo_id"
						+ " where c.id = ?")
				.param(me)
				.query(String.class)
				.optional()
				.orElse(null);
	}

	/**
	 * One of the three fractions, or nothing where what arrived is not one.
	 *
	 * @param mayBeNought whether nought is a legal value, which is the difference V21 draws
	 *                    between a position and a diameter: {@code crop_x} and {@code crop_y}
	 *                    are {@code between 0 and 1} because „0 and 1 are legal positions and
	 *                    not edge cases", while {@code crop_diameter} is {@code > 0 and <= 1}
	 *                    because „a circle of no diameter is not a crop of a photograph, it
	 *                    is the absence of one"
	 */
	private static BigDecimal fraction(String written, boolean mayBeNought) {
		if (written == null || written.isBlank()) {
			return null;
		}

		BigDecimal value;

		try {
			value = new BigDecimal(written.strip());
		}
		catch (NumberFormatException notANumber) {
			return null;
		}

		if (value.compareTo(NONE) < 0 || value.compareTo(ALL) > 0
				|| (!mayBeNought && value.compareTo(NONE) == 0)) {

			return null;
		}

		/* SCALED TO WHAT THE COLUMN HOLDS, and refused rather than rounded when it will not
		   fit. V21 chose `numeric(9, 8)` and said why: „Declaring the scale says out loud how
		   finely two crops may be told apart." A value with more digits than that is one
		   PostgreSQL would round on the way in, so the crop stored would not be the crop
		   sent - and V21's whole reason for exact decimal is that „what the member chose is
		   what is stored and what is read back, byte for byte". */
		try {
			return value.setScale(8, java.math.RoundingMode.UNNECESSARY);
		}
		catch (ArithmeticException finerThanTheColumn) {
			return null;
		}
	}

	/**
	 * THE ANSWER FOR AN ACCOUNT THESE ADDRESSES ARE NOT FOR, which carries nothing at all.
	 *
	 * <p>{@code sendError} and not a status on the response, which is the shape
	 * {@link MeWriteApi#away} measured on a real socket: a status comes back with
	 * {@code Content-Length: 0} while an address mapping nothing comes back longer and
	 * chunked, and that difference is precisely what tells a member-less account that a
	 * write lives at an address the portal never offered him.
	 */
	private static ResponseEntity<?> away(HttpServletResponse response) throws IOException {
		response.sendError(HttpStatus.NOT_FOUND.value());
		return null;
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}
}
