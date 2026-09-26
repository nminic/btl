package com.btl.portal.web;

import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.InputStream;
import java.nio.channels.Channels;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * THE BYTES OF A PICTURE, ASKED FOR BY THE DIGEST OF THEIR OWN CONTENT.
 *
 * <p><b>The row says where the file is and what it is; the address says neither.</b> ADL
 * A36 O8: „Fajl na disku servera pod imenom koje izdaje baza, a u bazi red sa tipom,
 * velicinom, otiskom sadrzaja i iseckom." V8 names which name that is - „The name is this
 * row's {@code id}, which is what makes A12a's first rule keepable - the server never uses
 * the name a member's browser sent as a path, because it never uses it at all." This class
 * is the first reader of that arrangement, and the arrangement is the whole of its
 * security: what arrives over the wire is looked UP, never resolved, and what is resolved
 * is a {@code long} out of the row, which cannot carry a separator, a dot or an encoding.
 * Climbing out of the folder is therefore not refused here, it is unsayable.
 *
 * <p><b>THE ADDRESS IS THE DIGEST AND NOT THE KEY, and that is the decision of
 * 13.09.2026 arriving at a second resource.</b> PDL „Privatnost profila", „Preusmerenje
 * mora da se ponasa isto i za profil koga nema. Ako skriven profil vodi na naslovnu a
 * nepostojeci kaze 'nije pronadjen', posetilac po razlici saznaje koji brojevi pripadaju
 * skrivenim clanovima, sto je upravo ono sto se krije." A picture addressed by {@code
 * photo.id} is countable: a
 * visitor walking 1, 2, 3 learns how many pictures the portal holds and, the day a hidden
 * member has one, that his exists. Sixty four hexadecimal characters are not walked.
 * <b>It is not a substitute for a rule about WHICH pictures are public</b>, and the
 * paragraph below is that rule.
 *
 * <p><b>AND SINCE 26.09.2026 THIS ROUTE DOES ASK WHO IS CALLING, which is this paragraph
 * reversed rather than extended.</b> What stood here said „what it is still not a substitute
 * for is a rule about who is asking, and nothing here asks", and that was true of the portal
 * while no resource published a PORTRAIT'S digest. {@link CompetitorApi} publishes one from
 * 26.09.2026, so the sentence stopped being true of the portal the same day and is rewritten
 * in the same commit; left standing it would read as an instruction to take the condition
 * back out. What the route asks is one question and it decides one thing: whether a member
 * who hides his profile has his portrait answered. See the paragraph on the holders below.
 *
 * <p><b>AND ONLY A PICTURE A PUBLIC THING HOLDS IS ANSWERED AT ALL.</b> ADL A36 P-javno,
 * owner, 13.09.2026: „javno je ono sto Clan 73 nabraja, i nista vise. Sve ostalo ceka
 * resurs koji zna ko pita", and beside it „Kad je sporno, polje se IZOSTAVLJA ... Nikad se
 * ne servira 'za svaki slucaj'." The table {@code photo} is not a table of public pictures:
 * four columns in the schema point at it and only two of them belong to something the
 * portal publishes.
 *
 * <ul>
 * <li>{@code competitor.photo_id} - a member's portrait, drawn on his card and on his page,
 * <b>and since 26.09.2026 only while the member is not hiding his profile from the caller</b>
 * (see the paragraph after this list).
 * <li>{@code team.logo_id} - a team's mark, drawn before its name in the table of teams
 * (PDL, owner, 12.08.2026).
 * <li>{@code verification.photo_id} - a picture WAITING for a moderator. PDL, „Profilnu
 * sliku administrator odobrava pre objave": a picture in that queue is by definition one
 * nobody has published, so serving it is publishing it instead of him.
 * <li>{@code team_proposal.logo_id} - the mark of a team that has been PROPOSED. The
 * proposal is what a moderator decides on; until he does, there is no team and there is
 * nothing to draw it beside.
 * </ul>
 *
 * <p>So the query asks for the first two and not for the row. <b>What that costs, named
 * rather than left to be found:</b> a picture nothing holds at all - uploaded and not yet
 * attached to anything - answers the same as a digest nobody wrote, and that is the
 * direction P-javno asks for. <b>And a picture that IS refused answers exactly what an
 * absent one answers</b>, by PDL „Privatnost profila", „Oba slucaja dobijaju isti ishod":
 * told apart, the refusal would say „this digest names a picture somebody is having moderated", which is
 * the very thing being withheld. {@code PhotoApiTest} keeps one case per holder, because
 * this is a fact with four states and not two.
 *
 * <p><b>AND A PORTRAIT IS PUBLIC ONLY WHILE ITS MEMBER IS NOT HIDING HIS PROFILE FROM THE
 * CALLER. [ODLUKA 26.09.2026, owner]</b>, chosen between three offered. ADL A60 left this
 * open in as many words - „`competitor.photo_id` se tretira kao javan bez obzira na
 * `profile_hidden`" - and named what would close it: „Prvi resurs koji ga objavi mora u istom
 * potezu da donese pravilo o skrivenom profilu, inace granica pada tog dana."
 * {@link CompetitorApi} is that resource and this is the other half of one decision. <b>Why
 * the half in that resource was not enough, and it is a measurement rather than an
 * argument:</b> the digest IS the whole permission, because until this paragraph nothing here
 * asked who was calling - so a member shown the address could pass it on and any visitor
 * would get the bytes. Withheld in one place and served in the other, the rule would have
 * hidden a capability instead of refusing access.
 *
 * <p><b>Hidden from a caller who is NOT SIGNED IN, and from nobody else</b>, which is the
 * owner's own sentence: „Takmicar od ulogovanih kolega ne moze da sakrije profil" (PDL,
 * 06.09.2026), with the reason in the published policy - „ali ne i od ostalih clanova, jer bi
 * time nestao smisao zajednickog rangiranja". So the question is asked of the SESSION and of
 * nothing finer: not whose portrait it is, and not what the caller may do. A caller with a
 * session is answered exactly what was answered before this paragraph existed.
 *
 * <p><b>The refusal is INSIDE the lookup and not a branch after it, and that is what keeps
 * the guarantee this class is built on.</b> A hidden member's portrait fails the same
 * {@code exists} a picture nothing public holds fails, so it leaves through the same
 * {@link #nothingIsHere} and is byte for byte what a digest nobody wrote is answered -
 * measured by {@code aHiddenMembersPortraitIsAnsweredExactlyAsADigestNobodyWrote}, in the
 * shape the two comparisons beside it already use. Written as a check after the row came
 * back it would be a second road out, and a status set rather than sent is a different answer
 * on the wire (measured 13.09.2026). It also opens no new branch, so it adds nothing to the
 * timing difference this class records further down.
 *
 * <p><b>THE FEE IS NOT PART OF THIS RULE, said here rather than left to be found.</b> A
 * member whose fee has lapsed still has his portrait answered to anybody holding the digest.
 * The digest cannot be got from {@link CompetitorApi} - such a member is not on that list at
 * all (PDL P11, owner 13.09.2026) - so nothing hands it out; and no decision covers the case,
 * so no condition is invented for it. It is a boundary and not a protection.
 *
 * <p><b>The whole picture and never the crop.</b> PDL P11, „Odseceni deo se ne baca.
 * Slika ostaje cela, a isecak se pamti pored nje." The three fractions are answered beside
 * the thing they belong to - {@link TeamApi} already serves a team's - and nothing here
 * reads them: a route that cut the bytes would be the one place in the portal where the
 * crop is burnt in, which is exactly what ADL A17 refuses.
 *
 * <p><b>What is NOT answered, named rather than left out silently</b> (ADL A36 P-javno,
 * 13.09.2026: „Kad je sporno, polje se IZOSTAVLJA i izostavljanje se imenuje sa
 * razlogom"): the size, the digest, the crop and the moment of upload are all on the row
 * and none of them leaves here. This resource answers bytes; a caller who wants to know
 * anything ABOUT a picture is holding the wrong address, and a header invented here would
 * be a second home for a fact {@link TeamApi} already serves.
 *
 * <p><b>ONE ROW DECIDES EVEN WHEN TWO CARRY THE SAME DIGEST, and the schema allows two.</b>
 * V8 puts no unique constraint on {@code digest} and says why in as many words: „The digest
 * is what says two members uploaded the same picture." Two rows with one digest are two
 * files with identical content, so either would answer the same bytes - but „either" is not
 * a sentence a server may be written in, and {@code .optional()} over two rows is a 500. The
 * oldest row decides, which is the same tie-break {@link TeamApi} and {@link VerificationApi}
 * end their orders with.
 *
 * <p><b>A row whose file is not there is answered exactly as a digest nobody wrote.</b>
 * Any other number would be a sentence about the database: 500 or 410 would say „this
 * digest names a row and the row is broken", which is the same subtraction PDL „Privatnost
 * profila", „Oba slucaja dobijaju isti ishod" shuts for profiles, available to anybody with
 * no session. So the operator is told - the WARN
 * below is the only place that fault exists - and the caller is told what a caller of an
 * address that is not there is told. The two answers are not merely the same NUMBER: both
 * go out through {@code sendError}, so the container's own ERROR dispatch writes both, and
 * {@code PhotoApiTest.aRowWithNoFileIsAnsweredExactlyAsADigestNobodyWrote} compares them
 * body and all. ADL A8 of 13.09.2026 measured what an imitation costs: two answers carrying
 * one number and nothing else alike are an oracle, one request per guess.
 *
 * <p><b>WHAT THAT SENTENCE DOES NOT COVER, AND IT IS MEASURED RATHER THAN ARGUED: THE
 * CLOCK.</b> A security round on 20.09.2026 compared the two answers byte for byte and
 * found them identical, then timed them: over sixty samples apiece the medians were 6,77 ms
 * for a digest nobody wrote and 9,26 ms for a row whose file has gone, which is 37 per cent
 * apart, and a name of the wrong shape came back fastest at 4,40 ms because it is refused
 * before anything is asked of the database. The cause is structural - the second branch
 * opens a file and builds an exception where the first does not - so the difference cannot
 * be written away. <b>What was done about it:</b> the stack trace came out of the warning
 * below the same day, which is the largest single term in that gap. <b>What remains is a
 * BOUNDARY and is written here rather than denied:</b> these answers are indistinguishable
 * in what they SAY and not in how long they take, and whoever needs the second half owes a
 * decision about padding the refusals to a constant, which nothing on this portal does
 * today for any resource.
 *
 * <p><b>The type comes off the row and out of nothing else.</b> Not the name of the file a
 * member chose, not the {@code Content-Type} he sent, not what the bytes look like here -
 * ADL A12a, 1: the server „proveri tip po sadrzaju a ne po nazivu ni po {@code Content-Type}
 * zaglavlju", and the place that check belongs is the upload, whose answer is this column.
 * V8's {@code photo_media_type_known} allows exactly {@code image/jpeg}, {@code image/png}
 * and {@code image/webp}, which is why nothing here validates what it read: a fourth value
 * cannot be written, and a branch for one could never be measured.
 *
 * <p><b>And {@code nosniff} is what makes the sentence above binding on a browser, and this
 * class does not write it.</b> Without it a browser may disregard the type and decide from
 * the bytes, and the whole point of answering from the row is that the row is the only
 * thing that decided. A first draft set the header here; measured by taking it off again,
 * the answer carries it anyway, because Spring Security's own header writer puts it on
 * everything this chain answers. So what is left is a case pinning that it is there
 * ({@code PhotoApiTest.aPictureMayBeKeptForADayAndItsTypeMayNotBeGuessed}): nothing else
 * in the portal serves bytes a member chose, so nothing else would notice the day that
 * default changed. The edge sets it too (ADL A12a, 5, which names it among the three
 * {@code deploy/README.md} sets), which is a third floor and not the one this route rests
 * on.
 *
 * <p><b>The cache is a DAY and it is private, and both halves were a year and public until
 * a security round on 20.09.2026 measured what each of them cost.</b> The reasoning that
 * put them there is still true as far as it goes: the name is the digest of the content, so
 * the bytes behind a given address cannot change, a different picture is a different digest
 * and therefore a different address, and revalidation has no answer to come back with but
 * „unchanged". That is the same reasoning the portal's own {@code /assets/*} are served
 * under (ADL, edge rules of 09.09.2026). It was reasoning and not a recorded decision, and
 * two things measured against it hold.
 *
 * <ul>
 * <li><b>{@code public} was the only one in the portal, and this is also the only answer
 * that sets a cookie.</b> Every other resource answers {@code no-store}; this one said a
 * SHARED cache might keep it for a year, while {@code ApiSecurity}'s {@code csrf.spa()}
 * puts {@code Set-Cookie: XSRF-TOKEN} on everything this chain answers. An intermediary
 * that kept such an answer would hand one visitor's token to every later visitor, and the
 * double submit check stops being a second guard the moment the cookie is not that
 * browser's own. <b>Nothing here proves that Caddy or Cloudflare really would keep it</b> -
 * what was measured is the pair of headers on one answer, not an intermediary's behaviour.
 * {@code private} was chosen over stripping the cookie on this one route because the cookie
 * is the chain's decision and has one home; a route that opted out of it would be a second
 * home for a rule written in {@code ApiSecurity}, and what {@code public} bought here - a
 * shared copy of a picture - is not something the portal was relying on.
 * <li><b>{@code immutable} for a year locks in a picture the portal may have to withdraw.</b>
 * ADL A12a, 1 requires that the file be deleted after a moderator's decision, and deletion
 * reaches nothing that already holds a copy: the address is derived from the content, so
 * there is no new address to move to, and {@code immutable} forbids the one request that
 * could learn the picture has gone. A day is the term that does NOT lock it: long enough
 * that a page drawing twenty portraits asks for each of them once, short enough that a
 * withdrawn picture stops being shown within a day of the decision at the worst. <b>It is
 * my reasoning and not the owner's word</b>, the year was too, and the day the withdrawal
 * of a picture is decided out loud this line is what that decision moves.
 * </ul>
 *
 * <p><b>It is open to a visitor, and by a list of its own.</b>
 * {@link ApiSecurity#READ_BY_ANYBODY_UNDER_A_NAME} says why the existing list could not
 * carry it: every entry there is a whole address, and this one is an address with a name in
 * it.
 */
@RestController
class PhotoApi {

	private static final Logger LOG = LoggerFactory.getLogger(PhotoApi.class);

	/**
	 * THE SHAPE THE SCHEMA ITSELF CHECKS, spelt the same way here.
	 *
	 * <p>V8's {@code photo_digest_shape} is {@code digest ~ '^[0-9a-f]{64}$'}, so a name
	 * that is not this shape cannot be any row's digest and there is nothing to look for.
	 * Asked here rather than left to the query, because „nothing was found" and „nothing
	 * could be found" are the same answer to the caller and two different things to the
	 * server: the second costs no round trip, and a name carrying a dot, a slash or a
	 * percent never reaches anything that could be asked to resolve it.
	 *
	 * <p><b>AND NO ANSWER CAN TELL THIS APART FROM THE LOOKUP, which is written down here
	 * rather than left for somebody to find.</b> Measured before this was committed, by
	 * widening the pattern to accept capitals: every case stayed green. The reason is the
	 * schema. {@code photo_digest_shape} refuses an uppercase digest in the column, so no
	 * spelling but the lower case one can ever match a row, and a name of any other shape
	 * finds nothing whether it was refused here or asked about in vain. <b>So no case here
	 * claims to measure this line</b>; what
	 * {@code PhotoApiTest.aDigestSpeltInCapitalsIsNobody} measures is the sentence a reader
	 * cares about - that a digest spelt in capitals is not served - and the schema is what
	 * holds it.
	 *
	 * <p><b>What it is kept for, then, since it buys no answer:</b> a string that arrived
	 * over the wire never becomes a query, and rubbish costs this server nothing rather than
	 * a round trip to the database each time. Removing it was the alternative and it was
	 * considered: the answers would be identical, and the database would be asked about
	 * every name anybody cared to invent.
	 */
	private static final Pattern A_DIGEST = Pattern.compile("^[0-9a-f]{64}$");

	/**
	 * A day, which is how long a withdrawn picture may still be shown by a browser that
	 * already has it. The note at the head of this class says why it is not a year.
	 */
	private static final Duration FOR_A_DAY = Duration.ofDays(1);

	/**
	 * THE PICTURE A DIGEST NAMES, IF SOMETHING THE PORTAL PUBLISHES HOLDS IT.
	 *
	 * <p>The two {@code exists} clauses are the two holders the note at the head of this
	 * class names as public; the two it does not name are absent on purpose, and a row no
	 * holder points at is absent by the same sentence. The tie-break is unchanged and now
	 * runs over the rows that survive the rule: the OLDEST publicly held row decides.
	 *
	 * <p><b>A row rather than a join, so that two holders of one picture cannot double
	 * it.</b> Nothing stops a member's portrait from also being a team's mark - the digest
	 * is the content and V8 puts no unique constraint anywhere near it - and a join would
	 * answer that picture twice, which {@code .optional()} turns into a 500.
	 *
	 * <p><b>AND THE MEMBER MUST NOT BE HIDING HIS PROFILE FROM THIS CALLER</b>, which is the
	 * decision of 26.09.2026 and is written INSIDE the first {@code exists} rather than
	 * beside it. There it is the same sentence the rest of this string already says - „is
	 * this picture held by something this caller may see" - so a hidden member's portrait
	 * comes back as no row at all and takes the one road out that every other refusal takes.
	 * A condition after the lookup would be a second road, and the whole point of this class
	 * is that there is one.
	 *
	 * <p><b>It is on the member's {@code exists} and never on the team's</b>, and that is
	 * measurable rather than tidy: a team has no profile to hide and
	 * {@code profile_hidden} is not a column of {@code team}, so a rule written over the
	 * whole {@code or} would refuse a team's mark to every visitor the day one member hid
	 * himself. {@code whatHoldsAPictureDecidesWhetherItIsAnswered} walks the team's mark as
	 * a visitor and is what falls.
	 */
	private static final String THE_PICTURE_A_DIGEST_NAMES =
			"select p.id, p.media_type from photo p where p.digest = :digest"
			+ " and (exists (select 1 from competitor his where his.photo_id = p.id"
			+ "  and (cast(:signedIn as boolean) or not his.profile_hidden))"
			+ " or exists (select 1 from team its where its.logo_id = p.id))"
			+ " order by p.id limit 1";

	private final JdbcClient db;

	private final Path folder;

	/**
	 * @param folder where the files are, which is a setting because QA and production are
	 *               two installations of one portal and neither is this machine. ADL A43, 2,
	 *               11.09.2026: „Imenovan Docker volumen uz bazu, montiran samo u bekend."
	 *               Its default is a developer's temporary folder, and what that means is
	 *               an empty one: on a machine nobody has uploaded to, every picture is an
	 *               address that is not there, which is the true answer
	 */
	PhotoApi(JdbcClient db, @Value("${btl.photos.folder}") String folder) {
		this.db = db;
		this.folder = Path.of(folder);
	}

	/** The two things the row decides: where the file is, and what it is. */
	private record Kept(long id, String mediaType) {
	}

	/**
	 * @param name     the digest of the content, which is an address and never a path
	 * @param member   who the chain worked out is asking, or NULL when nobody is: this route
	 *                 is on {@link ApiSecurity#READ_BY_ANYBODY_UNDER_A_NAME}, so an anonymous
	 *                 GET reaches this method rather than being answered 401, and Spring's
	 *                 resolver hands a parameter of this type nothing when the principal is
	 *                 the anonymous token - the same arrangement {@link CompetitorApi} writes
	 *                 out. <b>It is read for one thing only</b>: whether a member who hides
	 *                 his profile has his portrait answered. Nothing here asks whose portrait
	 *                 it is or what the caller may do, because the rule is about a reader who
	 *                 is not signed in and about nothing finer
	 * @param response asked for so that every refusal goes down the same road an address
	 *                 that is not there takes, exactly as {@link InboxApi#inbox} and
	 *                 {@link VerificationApi#verification} do
	 */
	@GetMapping("/api/photos/{name}")
	ResponseEntity<byte[]> photo(@PathVariable String name,
			@AuthenticationPrincipal WhoIsAsking.Member member, HttpServletResponse response)
			throws IOException {

		if (!A_DIGEST.matcher(name).matches()) {
			return nothingIsHere(response);
		}

		Optional<Kept> kept = db
				.sql(THE_PICTURE_A_DIGEST_NAMES)
				.param("digest", name)
				/* WHETHER ANYBODY IS ASKING AT ALL, and it is the ACCOUNT that is asked about
				   rather than the member behind it. An account that does not race has no member
				   (V23, owner 14.09.2026), so `memberOfAccount` would answer nothing for a
				   signed in moderator and a hidden member's portrait would be refused to a
				   caller the rule was never about. This route does not know that class and does
				   not need to: „is there a session" is the whole question. */
				.param("signedIn", member != null)
				.query((row, one) -> new Kept(row.getLong(1), row.getString(2)))
				.optional();

		if (kept.isEmpty()) {
			return nothingIsHere(response);
		}

		byte[] bytes;

		try {
			/* THE NAME OF THE FILE IS THE KEY OF THE ROW AND NOTHING ELSE TOUCHES IT. Not
			   `name`, which came over the wire; not the digest, which is the same string.
			   A `long` written out is digits, so there is no spelling of it that leaves
			   this folder, and every case in `PhotoApiTest` keeps a decoy file named after
			   the digest to say which of the two was read - see the note at the head of
			   that class, which is where the arrangement is described. */
			bytes = bytesOf(folder.resolve(String.valueOf(kept.get().id())));
		} catch (IOException noFile) {
			/* THE ONLY PLACE THIS FAULT EXISTS. The caller is told what a caller of a
			   digest nobody wrote is told, so a row and its absence cannot be told apart
			   from outside; whoever runs the server is told here, because a row whose file
			   has gone is a backup that did not cover the volume (ADL A43, 2, „rezervna kopija
			   mora da pokrije i volumen, a danas ne pokriva nista").

			   AND THE EXCEPTION IS NOT HANDED TO THE LOGGER, which is the correction of
			   20.09.2026 and was a finding rather than an untidiness. Passed as the last
			   argument it printed its whole stack - some sixty lines down the filter chain -
			   for a state this portal EXPECTS: deploy/README.md says QA is refreshed by
			   throwing the volume away while the rows stay, so every picture on the portal
			   is one of these. Measured over a real socket: fifty requests of about 190
			   bytes each made the server write 1.002.600 bytes of log, 20.052 per request,
			   which is an amplifier of a hundred times over. Neither deploy stack sets a
			   `logging:` block, so Docker's json-file driver keeps it all without rotation,
			   and `frontend/nginx.conf` rate-limits signing in and registering and not this.
			   What the stack said that this line does not is WHERE the read failed, and it
			   was the same three frames every time; what matters is which digest and which
			   folder, and both are here. */
			LOG.warn("photo {} names a row whose file could not be read under {}", name, folder);
			return nothingIsHere(response);
		}

		return ResponseEntity.ok()
				.contentType(MediaType.parseMediaType(kept.get().mediaType()))
				.cacheControl(CacheControl.maxAge(FOR_A_DAY).cachePrivate())
				/* AND NOTHING IS WRITTEN HERE ABOUT SNIFFING, which a first draft did.
				   `X-Content-Type-Options: nosniff` is on this answer already, written by the
				   chain's own header writer for everything it answers - measured by taking the
				   explicit header off and finding the case that asks for it still green. A
				   line that changes no answer beside a sentence crediting it is worse than no
				   line, so the fact is PINNED in the case instead, because this route is the
				   one that depends on it. */
				.body(bytes);
	}

	/**
	 * THE BYTES OF ONE FILE, AND THE OPEN REFUSES TO FOLLOW A LINK.
	 *
	 * <p><b>{@code NOFOLLOW_LINKS} rather than {@code readAllBytes}</b>, which follows one.
	 * Nothing can put a link in this folder today - the backend writes it and nothing else
	 * is mounted there - but the two things that WILL fill it are uploading and restoring
	 * from a backup, and a restore writes whatever the archive holds. The flag costs one
	 * argument and the refusal it produces is an {@code IOException}, which is the road
	 * a missing file already takes, so a link answers what an absent picture answers.
	 *
	 * <p><b>AND NO CASE MEASURES THAT FLAG, WHICH IS A BOUNDARY AND IS WRITTEN HERE RATHER
	 * THAN LEFT TO BE FOUND.</b> Taking {@code NOFOLLOW_LINKS} out of the set leaves the whole
	 * gate green, so the line has no guard at all. What a case would need is a symbolic link
	 * in the folder, and this is where the two ends of the build disagree: a review on
	 * 20.09.2026 measured the flag working on Linux, where the open comes back
	 * {@code IOException: Too many levels of symbolic links}, and measured on the machine this
	 * repository is written on that a link cannot be MADE at all without a privilege the
	 * developer does not hold - {@code FileSystemException: A required privilege is not held
	 * by the client}, which is the same answer the operating system gives outside Java. So a
	 * case here would be one that only ever runs on CI and is skipped where it is written,
	 * which is a case nobody watches. The flag stays because it costs one argument and the
	 * production system is Linux; what is missing is a guard, and this paragraph is the
	 * record of that rather than a comment excusing it.
	 *
	 * <p><b>THE TWO THINGS IT DOES NOT DO, named rather than left to be found.</b>
	 *
	 * <ul>
	 * <li><b>A HARD link is not refusable here at all</b>, and a security round on
	 * 20.09.2026 served one: a second directory entry for a file outside the folder is not
	 * a link the file system can be asked about, it is the file, and no flag and no
	 * comparison of paths can tell it from the one the row meant. What stands in front of
	 * it is that whoever can create an entry in that volume already holds the volume.
	 * <li><b>There is no {@code startsWith(folder)} beside the flag</b>, and that is
	 * measured rather than forgotten: the name resolved here is {@code String.valueOf} of a
	 * {@code long} out of the row, so there is no value of it that leaves the folder, and
	 * the branch would be one no case could ever enter - which the gate's hundred per cent
	 * of branches refuses, and rightly. The day the name comes from anywhere but the row,
	 * that check arrives with it and with a case that reaches it.
	 * </ul>
	 */
	private static byte[] bytesOf(Path file) throws IOException {
		try (InputStream reading = Channels.newInputStream(Files.newByteChannel(file,
				Set.of(StandardOpenOption.READ, LinkOption.NOFOLLOW_LINKS)))) {

			return reading.readAllBytes();
		}
	}

	/**
	 * THE ONE ANSWER, so that the three ways of getting here cannot drift apart.
	 *
	 * <p>Written three times it would be three chances for one of them to become a
	 * different sentence - a status set on the response rather than sent as an error is
	 * already a different answer on the wire, measured byte for byte on 13.09.2026 - and
	 * the whole point is that a name of the wrong shape, a digest nobody wrote and a row
	 * whose file has gone are indistinguishable from outside.
	 */
	private static ResponseEntity<byte[]> nothingIsHere(HttpServletResponse response)
			throws IOException {
		response.sendError(HttpStatus.NOT_FOUND.value());
		return null;
	}
}
