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
 * itself, from {@code PDL.md:1694} (an empty biography is a removal that takes effect at
 * once) and {@code :1655} (a member changes or removes his picture „kad god hoce"), with the
 * reason beside it: „Uklanjanje ne moze da bude sporno."
 * <li><b>„Dok slika ceka odobrenje, clan vidi SVOJU novu sliku sa oznakom da ceka; svi
 * ostali vide staru ili nijednu."</b> His reason: „da zna da je slanje uspelo i da je ne
 * salje tri puta." What that means HERE is one sentence and it is the whole of this route's
 * answer: the key of the waiting row and the digest of the picture in it come back to the
 * member who sent it, and to nobody else. What it means for the BYTES is
 * {@link PhotoApi}'s, and that half is NOT done on this branch - see „what is not here".
 * </ul>
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
 * <li><b>Is one of his pictures already waiting?</b> 409 {@link #A_PICTURE_ALREADY_WAITS}.
 * The rule is the picture's half of what the owner decided for the TEXT on 19.09.2026 -
 * „Nov tekst o sebi se ODBIJA dok prethodni ceka odluku moderatora. Odgovor je 409" - and it
 * is what the portal's own screen already does: {@code pages/member/ProfilePicture.tsx}
 * draws no control while one stands, „a second ask gives a moderator two faces and no
 * question to answer". <b>It is derived from that pair rather than quoted from a decision
 * about pictures</b>, and it is written here so that a reader can see which it is. The
 * owner's sentence of 24.09.2026 points the same way: a member is shown his waiting picture
 * precisely „da je ne salje tri puta".
 * <li><b>Is the crop three fractions between nought and one?</b> V21 bounds all three and
 * bounds the diameter above nought; a crop outside that is refused here rather than by the
 * constraint, because a constraint violation aborts the transaction and answers 500 where
 * the member should have been told which number was wrong.
 * <li><b>Is the file small enough, and is it a picture?</b> {@link WhatAPictureIs} answers
 * both, and the second is answered by reading the bytes rather than the name or the
 * {@code Content-Type} the browser claimed (ADL A12a, 1).
 * </ol>
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
 * exception rolls the row and the queue item back, <b>because both mappings say
 * {@code rollbackFor = IOException.class} and would not otherwise</b>. Spring rolls back on
 * a {@link RuntimeException} and an {@link Error} and COMMITS on a checked one, and
 * {@link IOException} is checked: this paragraph claimed the rollback for a round without it
 * being true, and a security review measured what that cost. With the row committed, a
 * passing fault of the disk left a queue card pointing at a picture with no file, the member
 * was answered 500 and then <b>refused for ever</b> by the 409 below, and he could not take it
 * back himself - {@link #remove} deliberately does not withdraw what a moderator is holding.
 * The only way out was a moderator approving a picture {@link PhotoApi} could never serve.
 * <b>The case that holds it cannot live in {@code MePhotoApiTest}</b>, because that class is
 * {@code @Transactional} and the route then joins the test's transaction, which is exactly why
 * the fault survived a green file; it is in
 * {@code ThePictureAndItsFileAreOneThingTest}, which is not.
 * <li><b>The commit itself fails after the file was written</b> and a file is left on the
 * disk that no row points at. That is the one leak, it is bounded by
 * {@link WhatAPictureIs#AT_MOST_BYTES} apiece, and {@link PhotoApi} serves nothing for it -
 * „a picture nothing holds at all answers the same as a digest nobody wrote". Sweeping such
 * files is work nothing in this portal does for any table yet, and inventing it here would
 * be one route carrying a rule about the whole disk.
 * </ul>
 *
 * <h2>WHAT IS NOT HERE, EACH NAMED RATHER THAN DISCOVERED</h2>
 *
 * <ul>
 * <li><b>THE MEMBER SEEING HIS OWN WAITING PICTURE'S BYTES.</b> {@link PhotoApi} serves a
 * digest only when a PUBLIC thing holds it, and it names {@code verification.photo_id} among
 * the two holders it refuses: „a picture in that queue is by definition one nobody has
 * published". The owner's decision of 24.09.2026 asks for exactly one exception to that -
 * the member who sent it, and the moderator who decides it - and an exception to it is a
 * change to a resource that is open to visitors and has no session to read. This route
 * therefore answers the digest of the waiting picture to its own sender, which is what a
 * screen needs in order to ASK for it, and the asking is the other half. <b>It is not
 * pretended otherwise and it is not half-built:</b> nothing here loosens {@link PhotoApi},
 * so today the member is told his picture arrived and is shown the picture he chose out of
 * his own browser, which is what {@code CropChooser} already holds.
 * <li><b>The decision.</b> Approving or refusing belongs to whoever holds
 * {@code queue:profiles} and {@link VerificationWriteApi} already does it - on approval it
 * runs {@code update competitor set photo_id = ?} and empties the queue row's own pointer,
 * which V9's {@code verification_decided_keeps_no_photo} requires. Nothing here touches that
 * branch.
 * <li><b>The file leaving the disk when a moderator decides.</b> ADL A12a, 1 asks for it and
 * V9 says the schema can only carry half of it - „that the FILE leaves the disk with it is
 * the deleting code's to do". That code is the decision's, not this route's, and it is not
 * written yet: this class deletes a file in exactly one case, the one where the member takes
 * his own standing picture down.
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
 * <p><b>Neither route carries a {@link RightIsNeeded}</b>, for {@link MeWriteApi}'s own
 * reason: no box anybody could tick would let one member change another's portrait. Both are
 * named in {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT}, by method and path together.
 */
@RestController
class MePhotoApi {

	private static final Logger LOG = LoggerFactory.getLogger(MePhotoApi.class);

	/** This member's picture is already standing in front of a moderator. */
	static final String A_PICTURE_ALREADY_WAITS = "aPictureAlreadyWaits";

	/** Nothing arrived where the picture should have been. */
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
	 * @param picture the file itself. {@code required = false} so that a request that
	 *                carried no such part is refused by this class with a sentence, rather
	 *                than by the argument resolver with a 400 that names a part
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

		/* ASKED BEFORE THE BYTES ARE LOOKED AT, which is the same order `MeWriteApi` keeps
		   for its own conflict: a member whose picture is already waiting is told so without
		   the portal hashing five megabytes first. */
		if (thePictureThatWaits(me).isPresent()) {
			return no(HttpStatus.CONFLICT, A_PICTURE_ALREADY_WAITS);
		}

		if (picture == null || picture.isEmpty()) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		BigDecimal x = fraction(cropX, true);
		BigDecimal y = fraction(cropY, true);
		BigDecimal size = fraction(cropSize, false);

		if (x == null || y == null || size == null) {
			return no(HttpStatus.BAD_REQUEST, THE_CROP_IS_NOT_A_CIRCLE);
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
		long waiting = db.sql("insert into verification (queue, competitor_id, subject, body,"
						+ " photo_id) select ?, c.id, c.first_name || ' ' || c.last_name, '', ?"
						+ " from competitor c where c.id = ? returning id")
				.params(THE_PROFILES_TAB, photo, me)
				.query(Long.class)
				.single();

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

		return ResponseEntity.ok(new Waiting(waiting, digest, theDigestStandingOn(me)));
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
	 * <p><b>THE ROW AND THE FILE BOTH GO, and the order is the row first.</b> V8 points
	 * {@code competitor.photo_id} at the row with {@code on delete set null}, so deleting the
	 * row empties the pointer by itself - and the pointer is emptied in its own statement
	 * first anyway, because a route that leaned on a cascade to do the thing it was asked to
	 * do would be a route whose subject is a foreign key rather than a member. The file is
	 * deleted after the row, outside nothing: a file removed before the transaction commits
	 * and a transaction that then rolls back would leave a row pointing at a picture that is
	 * gone, which is the one state {@link PhotoApi} has to log a fault for.
	 */
	@DeleteMapping("/api/me/photo")
	@Transactional(rollbackFor = IOException.class)
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
			db.sql("update competitor set photo_id = null where id = ?").param(me).update();
			db.sql("delete from photo where id = ?").param(standing.orElseThrow()).update();

			/* deleteIfExists AND NOT delete: a row whose file has already gone is a state
			   `PhotoApi` names and serves nothing for, and refusing to take the row down
			   because of it would leave the member unable to remove a picture nobody can see
			   anyway. The fault is told to the operator and not to him. */
			if (!Files.deleteIfExists(folder.resolve(String.valueOf(standing.orElseThrow())))) {
				LOG.warn("the file of photo {} was already gone when its member took it down",
						standing.orElseThrow());
			}
		}

		return ResponseEntity.ok(new Removed(thePictureThatWaits(me).orElse(null)));
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
	 * THIS MEMBER'S PICTURE STANDING IN THE QUEUE UNDECIDED, OR NOTHING.
	 *
	 * <p>The mirror of {@link MeWriteApi}'s own {@code theTextThatWaits}, told apart by the
	 * one thing the schema offers: {@code photo_id is not null} where that one asks for
	 * null. PDL P28a, 06.08.2026 puts both in one tab - „Profili: trkacke biografije i
	 * profilne slike" - and „razlikuje se samo sta moderator pise, jer se slika menja po
	 * instrukciji a tekst se pise ponovo".
	 *
	 * <p><b>{@code state = 'waiting'} IS WRITTEN HERE AND CANNOT BE MEASURED HERE, AND THAT
	 * IS SAID OUT LOUD RATHER THAN LEFT FOR A REVIEWER.</b> A mutation that loosened it to
	 * „any state at all" was run before this was opened and the whole file stayed green, 31
	 * of 31. The reason is not a missing case but V9:
	 * {@code verification_decided_keeps_no_photo check (state = 'waiting' or photo_id is
	 * null)} - read the other way round, a row whose {@code photo_id} is NOT null is
	 * necessarily still waiting. So for PICTURES the condition below is implied by the one
	 * beside it, and no fixture can separate them, because the database refuses to hold the
	 * row that would.
	 *
	 * <p><b>It stays, for two reasons that are not habit.</b> It says what this query means
	 * to a reader who has not got V9 open, and it goes on being right the day that constraint
	 * is relaxed - at which point the condition stops being redundant and starts being the
	 * only thing keeping a decided picture out of this answer. <b>What IS measured is the
	 * thing that really holds it:</b>
	 * {@code MePhotoApiTest.theSchemaRefusesADecidedRowThatStillHoldsAPicture} asks the
	 * database to write exactly that row and requires it to refuse. That is the floor under
	 * this line, and it is a case about behaviour rather than a case about a string.
	 *
	 * <p><b>Note that the same condition on {@link MeWriteApi}'s TEXT query is load bearing
	 * and is not redundant at all</b>, because a decided text keeps its {@code body}: there
	 * the two halves of this tab really do differ, which is what PDL P28a means by one row
	 * holding two sorts.
	 *
	 * <p>Oldest first with the key last and {@code limit 1}, which is how V9 indexes the
	 * queue and how {@link VerificationApi} reads it.
	 */
	private Optional<Long> thePictureThatWaits(long me) {
		return db.sql("select id from verification where competitor_id = ? and queue = ?"
						+ " and state = 'waiting' and photo_id is not null"
						+ " order by raised_at, id limit 1")
				.params(me, THE_PROFILES_TAB)
				.query(Long.class)
				.optional();
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
