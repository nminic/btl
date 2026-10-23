package com.btl.portal.web;

import com.btl.portal.domain.photo.SmallPicture;
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
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.channels.Channels;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
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
 * <b>and since 26.09.2026 only while the member is not hiding his profile from the caller,
 * and since this increment only while the member is active, the member himself and the
 * administration excepted</b> (see the paragraphs after this list).
 * <li>{@code team.logo_id} - a team's mark, drawn before its name in the table of teams
 * (PDL, owner, 12.08.2026).
 * <li>{@code verification.photo_id} - a picture WAITING for a moderator. PDL, „Profilnu
 * sliku administrator odobrava pre objave": a picture in that queue is by definition one
 * nobody has published, so serving it HERE is publishing it instead of him. <b>Since
 * 27.09.2026 it has TWO addresses of its own, and that sentence is why they are routes rather
 * than a third {@code exists}</b>: {@link #waitingOn} for the moderator who decides about it,
 * and {@link #mineThatWaits} for the member whose picture it is (PDL 21b). Each serves one
 * caller about one row by construction, so neither can be widened by accident, and the rule
 * above is narrowed in exactly two named places rather than moved.
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
 * <p><b>Hidden from everybody who is NEITHER AN ACTIVE MEMBER NOR THE ADMINISTRATION, and from
 * nobody else.</b> The owner's own sentence was „Takmicar od ulogovanih kolega ne moze da sakrije
 * profil" (PDL, 06.09.2026), with the reason in the published policy - „ali ne i od ostalih
 * clanova, jer bi time nestao smisao zajednickog rangiranja", and until 03.10.2026 this route read
 * „ulogovanih" as „anybody with a session". The owner chose otherwise between offered outcomes
 * (PDL P23, 03.10.2026, „Skrivanje deluje prema svakome ko nije aktivan član ni administracija,
 * nikad prema aktivnom članu"):
 * a free account and a member whose fee has lapsed are refused the bytes as a visitor is.
 * So the question is asked of WHO IS READING and of nothing finer: not whose portrait it is,
 * and not what right the caller holds. {@link ActiveMemberOrAdministration} answers it, and a
 * reader it lets in is answered exactly what he was answered before this paragraph existed.
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
 * <p><b>AND THE FEE OF THE MEMBER WHOSE PORTRAIT IT IS DECIDES TOO, which until this increment
 * was a boundary written down here and is now a condition. [IZVEDENO 10.10.2026, my reasoning
 * from the record and NOT a sentence of the owner's; carried out here]</b> The reader's fee has
 * been part of this rule since 03.10.2026; the HOLDER's was not, and a member whose fee had
 * lapsed still had his portrait answered to anybody holding the digest. It is derived from three
 * entries of PDL: P8, „Pre plaćanja član sme da otvori nalog, ali nigde nije vidljiv i ne može
 * ništa da radi u sistemu"; P11, „profil se ne prikazuje za sezonu u kojoj član nije aktivan",
 * which the owner confirmed on 03.08.2026 as deliberate; and the rule of 13.09.2026, „Nijedan
 * javni odgovor ne sme da imenuje člana kome je članarina istekla, ni posredno". A portrait that
 * is served to whoever holds its address is a public answer about a member who is on no public
 * list, and the member himself cannot take it down (PDL P8, 10.10.2026 and 11.10.2026: the
 * picture is on the list of what a member who is not active may not do). The league has members
 * under age, which is why the boundary was not left to be found.
 *
 * <p><b>So two readers are answered the bytes of a portrait whose member is not active, and
 * nobody else is.</b> The member himself while his profile is open, because PDL P8 of 25.09.2026
 * lets a member whose fee has lapsed open his own profile („Treba da moze da otvori svoj profil
 * dokle god postoji, odnosno dok ga admin ne obrise") and that page draws his portrait; and the
 * administration, which reads what a member keeps from everybody else. <b>The member himself is
 * NOT answered it when his fee has lapsed AND his profile is hidden, and that is the owner's choice
 * and not an oversight:</b> shown with PR 515 (10.10.2026) that this member is handed the address
 * and not the bytes, he chose to leave it (the boundary C of that PR, written out in
 * {@link MeApi}). Every other reader, an active member and a visitor included, is answered what a
 * digest nobody wrote is answered: the refusal is inside the lookup and takes the one road out. <b>The question is asked of the HOLDER's {@code competitor.active}
 * and never of the reader's</b>, and the two are different facts that this route now asks side by
 * side: {@code readsHiddenProfiles} is the reader's, {@code his.active} is the holder's, and
 * written with one for the other the rule would serve the bytes of a lapsed member to every
 * active reader. {@code PhotoOfAMemberWhoseFeeHasLapsedTest} walks the four combinations.
 *
 * <p><b>A team's mark is not touched.</b> A team has no fee and {@code team.logo_id} is on the
 * other {@code exists}, so a team whose last member lapsed still has its mark answered.
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
 * it. <b>That sentence is about {@link #photo} and not about this class</b>, which since
 * 27.09.2026 maps two further routes that are on no open list at all.
 *
 * <p><b>AND THOSE TWO ARE WHY THIS CLASS SERVES THREE KINDS OF CALLER FROM ONE PLACE, which is
 * a choice with a measurement behind it rather than a convenience.</b> {@link #waitingOn}
 * answers the picture a moderator is deciding about and {@link #mineThatWaits} answers the one
 * its own member is waiting on. Either could have lived with the resource it belongs to -
 * {@link VerificationApi} and {@link MePhotoApi} - and what decided otherwise is that
 * {@link #bytesOf} is the ONE place in this portal that reads a picture off the disk for a
 * response, and the one place {@code NOFOLLOW_LINKS} is written. A second reader would split the
 * refusal of a symbolic link across two files, so whoever hardened one would miss the other. The
 * folder setting is a different matter and is already read in four classes
 * ({@code MePhotoApi} says so in as many words), so a fifth reader of a SETTING is the
 * pattern here and a second reader of the BYTES is not.
 *
 * <p><b>What the three routes do NOT share is the question they ask</b>, and nothing was
 * loosened to fit them in one class: {@link #photo} asks „does something public hold this
 * digest", {@link #waitingOn} asks „may this moderator decide about this row", and
 * {@link #mineThatWaits} asks „is this the picture the caller himself is waiting on". They share
 * {@link #bytesOf}, {@link #nothingIsHere} and the folder, all three of which are about carrying
 * bytes out and none of which is about permission. <b>What they deliberately do NOT share any
 * more is how long an answer may be kept</b>, and that split arrived with PDL 21c: see
 * {@link #FOR_A_DAY_PRIVATELY} and {@link #NOT_KEPT_AT_ALL}, where the line is drawn by whether
 * the ADDRESS is derived from the content. {@code THE_PICTURE_A_DIGEST_NAMES} gains no holder from
 * either of the two, so which KINDS of holder are public is exactly what it was.
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
	 * What an answer ADDRESSED BY A DIGEST may be kept for, which is the day argued above.
	 *
	 * <p>Private rather than public, and the security round of 20.09.2026 that measured why is at
	 * the head of this class: this is the only caching answer in the portal and the only one that
	 * sets a cookie.
	 */
	private static final CacheControl FOR_A_DAY_PRIVATELY =
			CacheControl.maxAge(FOR_A_DAY).cachePrivate();

	/**
	 * And what an answer ADDRESSED BY A ROW may be kept for, which is nothing at all.
	 *
	 * <p><b>This constant arrives with PDL 21c and the reason is measured rather than cautious.</b>
	 * Until 27.09.2026 no code in this portal ever rewrote {@code verification.photo_id} to a
	 * different picture: the only {@code update verification} anywhere under
	 * {@code src/main/java} is the DECISION, and it sets the column to null
	 * ({@code VerificationWriteApi}). So the bytes behind {@code /api/verification/{id}/photo}
	 * could not change, and keeping them for a day was as safe as keeping a digest's.
	 *
	 * <p><b>21c is what changed that, and it changed it in the worst possible direction.</b>
	 * „Ponovno slanje PREGAZI red koji ceka": from that day the same {@code verification.id}
	 * names different bytes, while the address stays the same character for character. A day of
	 * private caching would then show a moderator the picture a member has already replaced - and
	 * approving a photograph he had not actually seen is the exact fault the owner found on QA and
	 * the exact reason {@link #waitingOn} exists.
	 *
	 * <p><b>{@link CacheControl#empty()} writes NO header</b> rather than writing one that says
	 * nothing, which leaves the field to Spring Security's own writer - the same one that puts
	 * {@code nosniff} on everything this chain answers, and what the rest of the portal's
	 * resources already answer with. Measured by the case that reads the header off the answer
	 * rather than assumed from the framework.
	 */
	private static final CacheControl NOT_KEPT_AT_ALL = CacheControl.empty();

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
	 * a visitor and is what falls. The same goes for {@code his.active}, and a team has no fee.
	 *
	 * <p><b>AND THE MEMBER MUST BE ACTIVE, UNLESS THE READER IS HIM OR THE ADMINISTRATION</b>
	 * ([IZVEDENO 10.10.2026], the paragraph on the fee of the holder at the head of this class).
	 * Three alternatives in one parenthesis, in this order and for these reasons:
	 *
	 * <ul>
	 * <li>{@code :administration} - the role can hold a right at all, a moderator ticked or not
	 * and the superadmin. Asked of the REQUEST's role and not of the reader's member, because
	 * an account that races for nobody is still the administration.
	 * <li>{@code me.competitor_id = his.id and not his.profile_hidden} - the account asking IS the
	 * holder, and his profile is open. Joined through {@code account} in this statement, the shape
	 * {@link #THE_PICTURE_I_AM_WAITING_ON} already has, so „whose picture is this" is a part of the
	 * permission and not a lookup beside it. <b>{@code not his.profile_hidden} IS NOT A SECOND
	 * CAUTION AND IT IS NOT MINE:</b> the owner was shown, with PR 515 (10.10.2026), that a member
	 * whose fee has lapsed AND who hides his profile is handed the ADDRESS of his own portrait by
	 * {@code GET /api/me} and not its bytes, and chose to leave it so: the profile is drawn and the
	 * portrait does not load (the boundary C of that PR, written out in {@link MeApi}). This clause
	 * lets a lapsed holder read his own open portrait, which is what he was served before this
	 * increment as well, and does not undo that choice. An ACTIVE holder who hides is not in this
	 * clause at all: he is the reader of the next one, and {@code readsHiddenProfiles} is true for him.
	 * <li>{@code his.active and (readsHidden or not hidden)} - everybody else, and an active holder
	 * who hides himself as well, and this is the
	 * rule that stood alone until this increment with {@code his.active} in front of it. <b>It is
	 * the HOLDER's {@code active}, a column of {@code his}</b>; the reader's fee is
	 * {@code readsHiddenProfiles}, a parameter, and the two answer different questions.
	 * </ul>
	 *
	 * <p>The account is cast to {@code bigint} because a visitor has none, and a null parameter
	 * has no type of its own; the cast gives PostgreSQL the type, as the one beside
	 * {@code :administration} does for a boolean.
	 */
	private static final String THE_PICTURE_A_DIGEST_NAMES =
			"select p.id, p.media_type from photo p where p.digest = :digest"
			+ PhotoApi.HELD_IN_THE_OPEN_FOR_THIS_READER
			+ " order by p.id limit 1";

	/**
	 * WHETHER SOMETHING THIS READER MAY SEE HOLDS THE ROW {@code p}: the whole of the rule the
	 * note on {@link #THE_PICTURE_A_DIGEST_NAMES} explains, written once.
	 *
	 * <p><b>One string read by two statements</b>, the original's and the small picture's
	 * ({@link #THE_SMALL_PICTURE}), so that who may see a circle and who may see the picture it
	 * was cut from are one sentence and cannot drift apart: a hidden member's face, a waiting
	 * picture and a proposed team's mark are refused on both doors by the same words.
	 */
	private static final String HELD_IN_THE_OPEN_FOR_THIS_READER =
			" and (exists (select 1 from competitor his where his.photo_id = p.id"
			+ "  and (cast(:administration as boolean)"
			+ "   or (not his.profile_hidden and exists (select 1 from account me"
			+ "    where me.id = cast(:account as bigint) and me.competitor_id = his.id))"
			+ "   or (his.active"
			+ "    and (cast(:readsHiddenProfiles as boolean) or not his.profile_hidden))))"
			+ " or exists (select 1 from team its where its.logo_id = p.id))";

	/**
	 * THE PICTURE A DIGEST NAMES, CUT TO THIS CIRCLE, IF SOMETHING THIS READER MAY SEE HOLDS IT
	 * WITH EXACTLY THIS CIRCLE.
	 *
	 * <p><b>The circle is part of the question and not only of the answer.</b> Two rows may
	 * carry one digest with two circles (a member who moves the circle over his approved
	 * picture sends the same bytes again, PDL 27.09.2026, and two members may send one file),
	 * and only a circle some public holder really has is cut. A circle nobody chose is
	 * nothing here, which is what keeps this from cutting whatever a caller cares to spell -
	 * and a waiting picture's circle is never one, because a waiting picture has no public
	 * holder (ADL A60).
	 */
	private static final String THE_SMALL_PICTURE =
			"select p.id, p.media_type from photo p where p.digest = :digest"
			+ " and p.crop_x = :x and p.crop_y = :y and p.crop_diameter = :diameter"
			+ PhotoApi.HELD_IN_THE_OPEN_FOR_THIS_READER
			+ " order by p.id limit 1";

	/**
	 * WHERE A CIRCLE'S SMALL PICTURE IS ASKED FOR: the digest of the picture, and its circle
	 * spelt out.
	 *
	 * <p><b>The circle is IN the address, and that is what lets the answer be kept a day.</b>
	 * The day at the head of this class rests on „the bytes behind a given address cannot
	 * change". For a small picture the bytes are the content AND the circle, so an address of
	 * the digest alone would go on naming the old cut for a day after the circle moved. Spelt
	 * out, a moved circle is a new address, exactly as a new picture is a new digest.
	 */
	static final String A_SMALL_PICTURE_IS_ASKED_FOR_AT = "/api/photos/{digest}/small/{circle}";

	/**
	 * The circle as the address spells it: the three fractions as V21 stores them, eight places
	 * each, joined by hyphens. Exactly one spelling per circle, so one cut per circle is kept.
	 */
	private static final Pattern A_CIRCLE = Pattern.compile(
			"^([01]\\.\\d{8})-([01]\\.\\d{8})-([01]\\.\\d{8})$");

	/**
	 * THE PICTURE ONE QUEUE ROW IS ABOUT, AND THE PRIVILEGE THAT ROW ITSELF NAMES.
	 *
	 * <p><b>The join to {@code photo} is what answers three of this route's states at
	 * once, and it is INNER on purpose.</b> A row that has been decided, a row on the
	 * biographies half of the same tab, and a row that was never there all produce no row
	 * here, so all three leave through the one {@link #nothingIsHere}.
	 *
	 * <p><b>There is deliberately NO {@code and v.state = 'waiting'} in this statement</b>,
	 * and that is a reading of the schema rather than an omission. V9's
	 * {@code verification_decided_keeps_no_photo check (state = 'waiting' or photo_id is
	 * null)} means a decided row CANNOT hold a picture, so „it still holds one" and „it is
	 * still waiting" are one fact and the {@code check} is the thing that says so. Written
	 * here as well it would be a second home for it, and the two could only ever disagree
	 * by one of them being wrong. {@code VerificationConstraintsTest} keeps the two
	 * violations that fall if the constraint is lost.
	 *
	 * <p><b>And {@code right_code} comes back rather than being compared here</b>, which is
	 * the shape {@code VerificationWriteApi.itemHeMayModerate} already has and gives the
	 * reason for: the superadmin holds every right with no tick anywhere (V5's
	 * {@code rights_mode = 'all'}), so a condition over the ticks written into this SQL
	 * would refuse him his own portal. V9 GENERATES the column as {@code 'queue:' || queue}
	 * and keys it to {@code admin_right(code)}, so the row carries the exact privilege that
	 * opens it and nothing here re-derives which tab is which.
	 */
	private static final String THE_WAITING_PICTURE_OF_A_ROW =
			"select p.id, p.media_type, v.right_code from verification v"
			+ " join photo p on p.id = v.photo_id where v.id = :id";

	/** The tab a portrait waits in, which is the one PDL P28a names „Profili". */
	private static final String THE_PROFILES_TAB = "profiles";

	/**
	 * THE PICTURE THE CALLING ACCOUNT'S OWN MEMBER IS WAITING ON, BY ITS DIGEST.
	 *
	 * <p><b>Every join in it is part of the permission and none of them is a lookup beside it.</b>
	 * The digest says WHICH picture, the queue row says it is waiting rather than published, and
	 * the account says it is HIS - so a digest belonging to another member's waiting picture finds
	 * no row at all and leaves through the one {@link #nothingIsHere} everything else leaves
	 * through. A condition checked after the row came back would be a second road out.
	 *
	 * <p><b>{@code v.state = 'waiting'} is here for {@link MePhotoApi}'s recorded reason and is
	 * implied by the join</b>: V9's {@code verification_decided_keeps_no_photo} means a row holding
	 * a picture is necessarily still waiting, so no fixture can separate the two, and it stays
	 * because it says what the clause means and goes on being right the day that constraint is
	 * relaxed.
	 *
	 * <p><b>{@code order by p.id limit 1} rather than trusting there to be one row</b>, which is
	 * {@link #THE_PICTURE_A_DIGEST_NAMES}'s reason word for word: V8 puts no unique constraint on
	 * {@code digest} because „the digest is what says two members uploaded the same picture", so
	 * two rows may carry one digest - and two rows through {@code .optional()} is a 500. The oldest
	 * decides, the same tie-break the two routes beside this use.
	 *
	 * <p><b>The tab is asked for although a portrait is the only sort of picture on it</b>, so that
	 * this clause says which queue it means rather than relying on there being no other queue that
	 * holds a member's own photograph. {@code verification.right_code} is not read at all here: a
	 * member holds no queue right and none is asked of him, which is exactly the difference between
	 * this route and {@link #waitingOn}.
	 */
	private static final String THE_PICTURE_I_AM_WAITING_ON =
			"select p.id, p.media_type from photo p"
			+ " join verification v on v.photo_id = p.id"
			+ " join account a on a.competitor_id = v.competitor_id"
			+ " where p.digest = :digest and a.id = :account and v.queue = :tab"
			+ " and v.state = 'waiting'"
			+ " order by p.id limit 1";

	private final JdbcClient db;

	private final Path folder;

	private final WhatHeMayDo mayHe;

	private final ActiveMemberOrAdministration readers;

	private final SmallPictures small;

	/**
	 * @param folder  where the files are, which is a setting because QA and production are
	 *                two installations of one portal and neither is this machine. ADL A43, 2,
	 *                11.09.2026: „Imenovan Docker volumen uz bazu, montiran samo u bekend."
	 *                Its default is a developer's temporary folder, and what that means is
	 *                an empty one: on a machine nobody has uploaded to, every picture is an
	 *                address that is not there, which is the true answer
	 * @param mayHe   the one place „may he" is answered about a RIGHT (ADL A8, „Odgovara jedno
	 *                mesto"), asked by {@link #waitingOn} and by nothing else here
	 * @param readers the one place „may he read what the league keeps for its own" is answered,
	 *                asked by {@link #photo} and by nothing else here. Since 03.10.2026 that
	 *                route asks who is reading rather than only whether there is a session, and
	 *                the answer is not a right: an active member reads without holding one.
	 *                Asked by {@link #small} too, with the same three parameters
	 * @param small   the small pictures already cut, and the one place a cut is made
	 */
	PhotoApi(JdbcClient db, @Value("${btl.photos.folder}") String folder, WhatHeMayDo mayHe,
			ActiveMemberOrAdministration readers, SmallPictures small) {
		this.db = db;
		this.folder = Path.of(folder);
		this.mayHe = mayHe;
		this.readers = readers;
		this.small = small;
	}

	/** The two things the row decides: where the file is, and what it is. */
	private record Kept(long id, String mediaType) {
	}

	/**
	 * The same two, and the privilege the queue row carries beside them.
	 *
	 * <p>Read in ONE statement with the picture rather than asked for afterwards, so „which
	 * tab is this row in" and „which picture is it about" are one reading of one moment. A
	 * tab read separately could be read after a decision had emptied the row.
	 */
	private record KeptForADecision(long id, String mediaType, String rightCode) {
	}

	/**
	 * @param name     the digest of the content, which is an address and never a path
	 * @param member   who the chain worked out is asking, or NULL when nobody is: this route
	 *                 is on {@link ApiSecurity#READ_BY_ANYBODY_UNDER_A_NAME}, so an anonymous
	 *                 GET reaches this method rather than being answered 401, and Spring's
	 *                 resolver hands a parameter of this type nothing when the principal is
	 *                 the anonymous token - the same arrangement {@link CompetitorApi} writes
	 *                 out. <b>It is read for one thing only</b>: whether a member who hides
	 *                 his profile has his portrait answered, <b>and since this increment for two
	 *                 more</b>: whether the reader is the administration, and whether the
	 *                 account asking is the very member whose portrait it is and his profile is
	 *                 open, which is the one reader the fee of the holder does not shut out. Nothing here asks what
	 *                 right the caller may use; {@link ActiveMemberOrAdministration} answers the
	 *                 first and the second, and answers no for the null of a visitor
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

		Optional<Kept> kept = askedBy(member, db
				.sql(THE_PICTURE_A_DIGEST_NAMES)
				.param("digest", name))
				.query((row, one) -> new Kept(row.getLong(1), row.getString(2)))
				.optional();

		if (kept.isEmpty()) {
			return nothingIsHere(response);
		}

		Optional<byte[]> bytes = theFileOf(kept.get().id(), name);

		if (bytes.isEmpty()) {
			return nothingIsHere(response);
		}

		return carrying(kept.get().mediaType(), bytes.get(), FOR_A_DAY_PRIVATELY);
	}

	/**
	 * THE THREE FACTS ABOUT THE READER THAT {@link #HELD_IN_THE_OPEN_FOR_THIS_READER} ASKS, set
	 * on a statement in one place for both doors that ask it.
	 */
	private JdbcClient.StatementSpec askedBy(WhoIsAsking.Member member,
			JdbcClient.StatementSpec statement) {
		return statement
				/* WHETHER THE CALLER MAY READ A HIDDEN PROFILE, which since 03.10.2026 is
				   `ActiveMemberOrAdministration` and no longer „is there a session" (PDL P23,
				   03.10.2026, „Skrivanje deluje prema svakome ko nije aktivan član ni
				   administracija,
				   nikad prema aktivnom članu"). The class reads the administration off the role the request
				   carries, so an account that races for nobody and is a moderator still reads,
				   and a member's fee off `competitor.active`, so a free account and a member
				   whose fee has lapsed are refused the bytes exactly as a visitor is. It is
				   asked HERE, in the same breath as the list asks it, because the digest is the
				   whole permission: handed to a reader the list withholds it from, it would be a
				   capability and not an access. */
				.param("readsHiddenProfiles", readers.includes(member))
				/* AND TWO FACTS ABOUT THE READER THAT DECIDE WHETHER THE HOLDER'S OWN FEE MATTERS
				   (the note on `THE_PICTURE_A_DIGEST_NAMES`). The administration is asked of the
				   request's role and a visitor, who arrives as null, is not it; the account is the
				   session's own and never anything the request carried, and null for a visitor,
				   which no account has. */
				.param("administration", member != null && readers.isTheAdministration(member))
				.param("account", member == null ? null : member.account());
	}

	/**
	 * THE SMALL PICTURE A CIRCLE DRAWS: the picture a digest names, cut to the circle the
	 * address spells and made {@value SmallPicture#SIDE} pixels a side ({@link SmallPicture}).
	 *
	 * <p>PDL, 23.10.2026: „Server pravi i šalje umanjenu, već isečenu sliku za kružiće (Top 10
	 * i svuda gde se slika prikazuje mala); original ostaje za profil." {@link #photo} stays
	 * exactly what it was and goes on carrying the original to the profile, the cropper and
	 * the moderator.
	 *
	 * <p><b>Who may see it is who may see the original, by the same words</b>
	 * ({@link #HELD_IN_THE_OPEN_FOR_THIS_READER}), and every refusal takes the one road out a
	 * digest nobody wrote takes, so this door is open to a visitor and still answers 404 for a
	 * hidden member's face, a waiting picture and a proposed team's mark (ADL A8, A60). It is
	 * kept a day and privately, for {@link #FOR_A_DAY_PRIVATELY}'s reason, and that reason holds
	 * here because the circle is in the address ({@link #A_SMALL_PICTURE_IS_ASKED_FOR_AT}).
	 *
	 * <p><b>A picture that cannot be cut answers as one whose file is gone</b>, with one line to
	 * whoever runs the server ({@link SmallPictures}): there is no smaller picture to send, and the
	 * original would show the wrong part of it. <b>A reader who waited his whole term for his turn
	 * is answered 503</b>, which is not a refusal of the picture but „not now".
	 *
	 * @param digest the digest of the content
	 * @param circle the three fractions of the circle, as {@link #addressOfTheSmall} spells them
	 * @param member who is asking, or null for a visitor, read exactly as {@link #photo} reads it
	 */
	@GetMapping(A_SMALL_PICTURE_IS_ASKED_FOR_AT)
	ResponseEntity<byte[]> small(@PathVariable String digest, @PathVariable String circle,
			@AuthenticationPrincipal WhoIsAsking.Member member, HttpServletResponse response)
			throws IOException {
		Matcher spelt = A_CIRCLE.matcher(circle);

		if (!A_DIGEST.matcher(digest).matches() || !spelt.matches()) {
			return nothingIsHere(response);
		}

		BigDecimal x = new BigDecimal(spelt.group(1));
		BigDecimal y = new BigDecimal(spelt.group(2));
		BigDecimal diameter = new BigDecimal(spelt.group(3));

		Optional<Kept> kept = askedBy(member, db
				.sql(THE_SMALL_PICTURE)
				.param("digest", digest)
				.param("x", x)
				.param("y", y)
				.param("diameter", diameter))
				.query((row, one) -> new Kept(row.getLong(1), row.getString(2)))
				.optional();

		if (kept.isEmpty()) {
			return nothingIsHere(response);
		}

		SmallPictures.Answer answer = small.of(new SmallPictures.Key(digest, circle), () -> {
			Optional<byte[]> bytes = theFileOf(kept.get().id(), digest);

			return bytes.isEmpty() ? Optional.empty()
					: Optional.of(SmallPicture.of(bytes.get(), kept.get().mediaType(), x, y, diameter));
		});

		/* NOT NOW, and said as such: the server is cutting other circles and this reader waited
		   his whole term (`SmallPictures`). Not 404, because the picture IS there and the next
		   reader will be answered it; the circle on the screen answers any refusal by drawing the
		   original, so to a member this is the circle as it was before small pictures existed. */
		if (answer.busy()) {
			response.sendError(HttpStatus.SERVICE_UNAVAILABLE.value());
			return null;
		}

		if (answer.cut().isEmpty()) {
			return nothingIsHere(response);
		}

		return carrying(answer.cut().get().mediaType(), answer.cut().get().bytes(),
				FOR_A_DAY_PRIVATELY);
	}

	/**
	 * WHERE THE SMALL PICTURE OF A PICTURE AND ITS CIRCLE IS ASKED FOR, written once for every
	 * answer that hands one out ({@link CompetitorApi}, {@link MeApi}, {@link TeamApi}).
	 *
	 * <p>The fractions come off {@code numeric(9, 8)} (V21), so they carry eight places already
	 * and {@code UNNECESSARY} says so: a ninth would be a column this was not written for.
	 */
	static String addressOfTheSmall(String digest, BigDecimal x, BigDecimal y,
			BigDecimal diameter) {
		return A_SMALL_PICTURE_IS_ASKED_FOR_AT.replace("{digest}", digest)
				.replace("{circle}", spelt(x) + "-" + spelt(y) + "-" + spelt(diameter));
	}

	private static String spelt(BigDecimal fraction) {
		return fraction.setScale(8, RoundingMode.UNNECESSARY).toPlainString();
	}


	/**
	 * THE BYTES OF THE PICTURE THE CALLER HIMSELF IS WAITING ON, TO HIM AND TO NOBODY ELSE.
	 *
	 * <p><b>ADL A60, second amendment of 27.09.2026, and it is marked there as reasoning rather
	 * than as the owner's word.</b> What the owner decided is PDL 21b: „ukoliko udjem da posaljem
	 * ponovo, vidim da je trenutno slika u statusu cekanja i tu vidim trenutno azuriranu sliku sa
	 * krugom." What was measured is that this did not survive a reload - the bytes were in the
	 * browser that sent them and no route would answer them again.
	 *
	 * <p><b>THIS IS THE SECOND NAMED EXCEPTION AND NOT A WIDENING, which is the whole reason it
	 * is a route of its own.</b> A60 of 20.09.2026 still stands word for word: a picture only a
	 * queue row holds „nije javna" and „odgovara tacno isto kao slika koje nema". {@link #photo}
	 * still refuses it and {@code THE_PICTURE_A_DIGEST_NAMES} names no queue row, so „javan nosilac"
	 * still means exactly {@code competitor.photo_id} and {@code team.logo_id}. A60's own words
	 * for why this is cheaper: „cuvar uske rute po konstrukciji sluzi jednom pozivaocu nad jednim
	 * redom, pa se ne moze slucajno prosiriti."
	 *
	 * <p><b>THE GUARD IS THE SESSION AND THERE IS NO SECOND HALF OF IT.</b> {@link #waitingOn} is
	 * keyed to a {@code verification.id} and shut by a right over that queue; this one is keyed to
	 * the caller's own account, so „whose picture is this" is not a question it asks but the thing
	 * it is written out of. A member holding another member's digest is answered exactly as a
	 * digest nobody wrote is answered, through the same {@link #nothingIsHere}, because the row he
	 * is asking about is not joined to HIS account at all.
	 *
	 * <p><b>Asked of the ACCOUNT and never of the member, which is the shape
	 * {@code MemberOfAccount} exists for and is done here in SQL instead.</b> V23 points
	 * {@code account.competitor_id} at the member, so one join answers „the member behind this
	 * session" without this class learning a second collaborator - and {@link #photo}'s own note
	 * says why that matters: an account that does not race has no member at all, and a route that
	 * asked about the member would answer nothing for a caller who is perfectly well signed in.
	 * Here that outcome is right rather than wrong: an account with no member has no picture
	 * waiting either.
	 *
	 * <p><b>NOTHING HERE ASKS WHETHER ANYBODY IS SIGNED IN, and there must not be.</b> This
	 * address is on no open list, so the chain answers 401 before this method runs, and
	 * {@code ApiSecurityTest.everyRouteNobodyOpenedIsARouteNobodyCanRead} derives that from the
	 * dispatcher rather than being told - so it covers this route by existing. Written as a branch
	 * here it would be a branch no request can reach, which the gate's hundred per cent of
	 * branches refuses.
	 *
	 * <p><b>AND THE CROP IS NOT ANSWERED HERE EITHER, though the member is the one reader who
	 * needs it.</b> It rides beside the address on {@code GET /api/me/photo}
	 * ({@link MePhotoApi#mine}), which is the shape PDL P28f fixed for {@link CompetitorApi} and
	 * {@link TeamApi}: an address in one field and three fractions in another. This route answers
	 * bytes and nothing about them, exactly as {@link #photo} does - „a caller who wants to know
	 * anything ABOUT a picture is holding the wrong address".
	 *
	 * <p><b>IT IS KEPT FOR A DAY LIKE {@link #photo}'S AND UNLIKE {@link #waitingOn}'S, and the
	 * line is drawn by the ADDRESS rather than by the reader.</b> This one carries a digest, so the
	 * bytes behind it cannot change and the argument at the head of this class holds unchanged -
	 * an overwrite gives the member a NEW digest and therefore a new address, and the old one stops
	 * being named by anything. {@link #waitingOn} is the one that had to give the day up, because a
	 * {@code verification.id} now names different bytes over time; see {@link #NOT_KEPT_AT_ALL}.
	 *
	 * @param digest   the digest of the content, which is an address and never a path. The same
	 *                 shape {@link #photo} takes, refused by {@link #A_DIGEST} before anything is
	 *                 asked of the database for the identical reason
	 * @param asking   whose request it is, as the chain resolved it. Never null here, by the
	 *                 paragraph above
	 * @param response asked for so a refusal goes down the road an address that is not there
	 *                 takes, exactly as the two routes beside it do
	 */
	@GetMapping("/api/me/photo/{digest}")
	ResponseEntity<byte[]> mineThatWaits(@PathVariable String digest,
			@AuthenticationPrincipal WhoIsAsking.Member asking, HttpServletResponse response)
			throws IOException {

		if (!A_DIGEST.matcher(digest).matches()) {
			return nothingIsHere(response);
		}

		Optional<Kept> kept = db
				.sql(THE_PICTURE_I_AM_WAITING_ON)
				.param("digest", digest)
				.param("account", asking.account())
				.param("tab", THE_PROFILES_TAB)
				.query((row, one) -> new Kept(row.getLong(1), row.getString(2)))
				.optional();

		if (kept.isEmpty()) {
			return nothingIsHere(response);
		}

		Optional<byte[]> bytes = theFileOf(kept.get().id(), digest);

		if (bytes.isEmpty()) {
			return nothingIsHere(response);
		}

		return carrying(kept.get().mediaType(), bytes.get(), FOR_A_DAY_PRIVATELY);
	}

	/**
	 * THE PICTURE ONE QUEUE ROW IS WAITING FOR A DECISION ABOUT, TO THE MODERATOR WHO MAY
	 * TAKE IT.
	 *
	 * <p><b>ADL A60, dopuna 27.09.2026, and the owner found the hole himself on QA:</b> he
	 * approved a photograph WITHOUT SEEING IT, because the queue never drew one. „kad neko
	 * posalje sliku na odobrenje, zelim da dobijem jedan jedini red na strani verifikacije
	 * gde cu videti tu sliku i odobriti njeno takvo postavljanje na profil clana", and then,
	 * asked about the conflict with the rule above: „Svakako uradi sta god je potrebno da
	 * moderator vidi sliku koju verifikuje."
	 *
	 * <p><b>THE RULE ABOVE IS NARROWED AND NOT OVERTURNED, which is the whole reason this is
	 * a route of its own.</b> A60 of 20.09.2026 still stands: „Slika koju drzi samo nesto sto
	 * ceka odluku moderatora nije javna... Takva slika odgovara tacno isto kao slika koje
	 * nema." {@link #photo} still refuses it and {@code THE_PICTURE_A_DIGEST_NAMES} names no queue
	 * row, so a picture waiting for a decision is still not PUBLIC. What changes is that
	 * one moderator has an address. Widening the digest route instead would have moved the
	 * idea of „a public holder" and pulled the identical question along for
	 * {@code team_proposal.logo_id}, which no decision covers; a route keyed to a ROW serves
	 * one caller about one row by construction, so its guard is narrower than the concept.
	 *
	 * <p><b>The privilege is the ROW'S and never this file's</b>, which is
	 * {@code VerificationWriteApi.itemHeMayModerate}'s shape and its reason: five queues
	 * exist, so one code written on the route could only be one of them and would either
	 * shut the route to four moderators out of five or open all five to any one of them.
	 * {@code verification.right_code} carries the exact privilege that opens the row, and it
	 * is handed to {@link WhatHeMayDo}, the one place „may he" is answered.
	 *
	 * <p><b>Somebody who may not is told 404 and not 403</b>, ADL A8, owner 13.09.2026:
	 * „Server odbija moderatora bez privilegije sa 404, ne sa 403". PDL P28a, owner
	 * 30.07.2026, says the same from the screen's side and is the stronger sentence of the
	 * two: „Ne treba ni da budu svesni moderatori da postoje akcije koje im nisu
	 * dodeljene." So a competitor, a moderator holding another queue and a row that was
	 * never there are ONE answer, and it leaves through the same {@link #nothingIsHere}
	 * every other refusal in this class leaves through.
	 *
	 * <p><b>NOTHING HERE ASKS WHETHER ANYBODY IS SIGNED IN, and there must not be.</b> This
	 * address is on no open list, so the chain answers 401 before this method runs -
	 * {@code ApiSecurityTest.everyRouteNobodyOpenedIsARouteNobodyCanRead} derives that from
	 * the dispatcher rather than being told, so it covers this route by existing. Written as
	 * a branch here it would be a branch no request can reach, which the gate's hundred per
	 * cent of branches refuses.
	 *
	 * <p><b>AND NOTHING HERE ASKS ABOUT {@code profile_hidden} EITHER, for two independent
	 * reasons.</b> A60 closes that rule with „Od koga se krije: samo od neprijavljenog", and
	 * every caller of this route is signed in by the paragraph above, so the condition could
	 * never decide anything; and a picture waiting for a decision is not ON the profile yet,
	 * so there is no profile field for hiding to cover.
	 * {@code aWaitingPictureOfAHiddenMemberIsStillAnsweredToItsModerator} is what pins that,
	 * rather than this paragraph asserting it.
	 *
	 * <p><b>THE WHOLE PICTURE AND NEVER THE CROP, AND THAT IS A DECISION RATHER THAN THIS
	 * INCREMENT'S EDGE. [IZVEDENO 27.09.2026 - my reasoning and NOT the owner's word, and it
	 * is marked so because he was never asked.]</b> The moderator decides what enters the
	 * portal, so it is more use to him to see what falls OUTSIDE the circle than less: what he
	 * is judging is the photograph, and anything the circle hides is exactly what he could not
	 * otherwise refuse. The circle is the MEMBER's choice over his own picture and it applies
	 * when the picture is approved, which makes it his decision and not part of the one being
	 * taken here.
	 *
	 * <p>The mechanics agree with the decision rather than forcing it, and that is worth
	 * separating. PDL P11 - „Odseceni deo se ne baca. Slika ostaje cela, a isecak se pamti
	 * pored nje" - and ADL A17 both refuse a route that burns a crop into bytes, so cutting
	 * here was never available; what was available was answering the three fractions BESIDE
	 * the picture, on {@code /api/verification}, and that is what the paragraph above turns
	 * down. Doing it would also change that answer's shape and therefore the portal's
	 * contract, but the reason it is not done is the first one and not the cost.
	 *
	 * <p><b>[ISPRAVLJENO 10.10.2026, OS: the three fractions ARE answered beside the picture
	 * now, for another reason than drawing it.]</b> {@code /api/verification} carries {@code
	 * crop} on a row that holds a picture, because a decision about the row names the circle as
	 * well as the key ({@code VerificationWriteApi.Answered#seenCrop}): a circle moved over the
	 * same picture does not change its key, and it is a change of what the moderator saw. THIS
	 * route is unchanged - it answers the WHOLE original and nothing about the crop - and the card
	 * still draws the whole photograph. That the moderator sees the crop with the rest dimmed is
	 * the owner's decision of 27.09.2026 and a job of its own; the day it is done it reads the
	 * fractions from that answer and this route needs nothing.
	 *
	 * <p><b>AND THE CROP IS NOT REFUSED EVERYWHERE, WHICH HAS TO BE SAID HERE OR THIS
	 * PARAGRAPH READS AS A RULE ABOUT THE PORTAL.</b> PDL 21b gives the MEMBER his own waiting
	 * picture „sa krugom" on the screen he sends from. So the two readers are deliberately
	 * opposite: the member is shown what he chose, because the circle IS his choice and he is
	 * checking it; the moderator is shown everything, because what he is judging is whether
	 * the photograph may be on the portal at all and the circle would hide the part he could
	 * not otherwise refuse. <b>Both halves of that now exist</b>: {@link #mineThatWaits} carries
	 * the member's bytes and {@link MePhotoApi#mine} carries his circle beside them, so the crop
	 * is answered where it is his and refused where it is not.
	 *
	 * <p><b>AND THE MEMBER WHOSE PICTURE IT IS IS ANSWERED 404 HERE TOO, BUT THE REASON IS
	 * THIS ROUTE'S OWNER AND NOT A RULE ABOUT HIM.</b> He holds no queue right and does not
	 * know a {@code verification.id}, so he is refused exactly as anybody else without the
	 * tick. <b>Saying more than that would be wrong</b>, and PDL 21 decides the two halves
	 * separately:
	 *
	 * <ul>
	 * <li><b>21a, on the PROFILE, not until approved. [ODLUKA 27.09.2026, owner]</b> „Clan i
	 * ne treba da vidi svoju sliku dok nije odobrena. Kad je bude ugledao po prvi put tad ce
	 * znati da je slika i odobrena." So the first appearance ON THE PROFILE is itself the
	 * notice and no second one is made.
	 * <li><b>21b, on the SCREEN HE SENDS FROM, he does see it. [ODLUKA 27.09.2026, owner]</b>
	 * „ukoliko udjem da posaljem ponovo, vidim da je trenutno slika u statusu cekanja i tu
	 * vidim trenutno azuriranu sliku sa krugom." With the crop he set, and with a mark that it
	 * is waiting.
	 * </ul>
	 *
	 * <p><b>So 21b has a route of its own and it is NOT this one</b> - {@link #mineThatWaits},
	 * keyed to the caller's own session rather than to a queue row, and carrying the crop rather
	 * than refusing it. ADL A60 says so in as many words: „Ono sto clan vidi na svom ekranu za
	 * slanje i ono sto moderator vidi u redu su dve imenovane rute sa svojim pravom, ne sirenje
	 * pojma „javna slika"." <b>The member is still 404 HERE</b>, and that sentence is what this
	 * paragraph is about: two narrow routes are not one wide one, and neither of them knows the
	 * other's key.
	 *
	 * <p><b>Both of those overturn the decision of 24.09.2026</b> („Dok slika ceka odobrenje,
	 * clan vidi svoju novu sliku sa oznakom da ceka"), which is named because a sentence
	 * describing it as still open would be an instruction to build it. <b>And the first
	 * writing of the new one was WIDER than the owner meant</b> - „the member sees it nowhere"
	 * - which 21b corrected the same day. That is recorded here because this paragraph carried
	 * the wide version until it was measured against the log, and the wide version is the one
	 * that reads as „no screen may ever show him his own picture".
	 *
	 * @param id       {@code verification.id}, taken as an {@link AKey}, which is what
	 *                 {@code VerificationWriteApi} takes for the same key. A word in its place is
	 *                 the key no row has, so it finds no row and is answered as a row that is not
	 *                 there: it does not tell the caller this path pattern exists, which is what
	 *                 {@code hold}, {@code letGo} and {@code decision} answer it too
	 * @param asking   whose request it is, as the chain resolved it. Taken as a parameter
	 *                 rather than read off the context because that is the shape
	 *                 {@link WhatHeMayDo#may(WhoIsAsking.Member, String)} exists for, and it
	 *                 is never a value out of the body, a header or a query
	 * @param response asked for so a refusal goes down the road an address that is not there
	 *                 takes, exactly as {@link #photo} and {@link VerificationApi} do
	 */
	@GetMapping("/api/verification/{id}/photo")
	ResponseEntity<byte[]> waitingOn(@PathVariable AKey id,
			@AuthenticationPrincipal WhoIsAsking.Member asking, HttpServletResponse response)
			throws IOException {

		Optional<KeptForADecision> kept = db
				.sql(THE_WAITING_PICTURE_OF_A_ROW)
				.param("id", id.value())
				.query((row, one) -> new KeptForADecision(row.getLong(1), row.getString(2),
						row.getString(3)))
				.optional()
				/* MAY HE MODERATE THE TAB THIS ROW STANDS IN, asked of the one place that
				   answers it and about the code THE ROW carries. The superadmin holds every
				   right with no tick anywhere (V5's `rights_mode = 'all'`), so a condition
				   over the ticks would refuse him his own portal.

				   AND IT IS A `filter` ON THE SAME OPTIONAL, not a branch of its own, so „no
				   such row" and „not his row" are one emptiness and cannot be told apart by
				   anything outside. */
				.filter(one -> mayHe.may(asking, one.rightCode()));

		if (kept.isEmpty()) {
			return nothingIsHere(response);
		}

		Optional<byte[]> bytes = theFileOf(kept.get().id(), id.value());

		if (bytes.isEmpty()) {
			return nothingIsHere(response);
		}

		return carrying(kept.get().mediaType(), bytes.get(), NOT_KEPT_AT_ALL);
	}

	/**
	 * THE BYTES OF THE PICTURE A ROW NAMES, OR NOTHING AND ONE LINE TO WHOEVER RUNS THE
	 * SERVER.
	 *
	 * <p><b>THE ONLY PLACE THIS FAULT EXISTS</b>, and it is one place for three routes rather
	 * than three places saying the same thing. The caller is told what a caller of a digest
	 * nobody wrote is told, so a row and its absence cannot be told apart from outside;
	 * whoever runs the server is told here, because a row whose file has gone is a backup
	 * that did not cover the volume (ADL A43, 2, „rezervna kopija mora da pokrije i volumen,
	 * a danas ne pokriva nista").
	 *
	 * <p><b>THE NAME OF THE FILE IS THE KEY OF THE ROW AND NOTHING ELSE TOUCHES IT.</b> Not
	 * what came over the wire, and not the digest, which is the same string. A {@code long}
	 * written out is digits, so there is no spelling of it that leaves this folder, and every
	 * case in {@code PhotoApiTest} keeps a decoy file named after the digest to say which of
	 * the two was read.
	 *
	 * <p><b>AND THE EXCEPTION IS NOT HANDED TO THE LOGGER</b>, which is the correction of
	 * 20.09.2026 and was a finding rather than an untidiness. Passed as the last argument it
	 * printed its whole stack - some sixty lines down the filter chain - for a state this
	 * portal EXPECTS: deploy/README.md says QA is refreshed by throwing the volume away while
	 * the rows stay, so every picture on the portal is one of these. Measured over a real
	 * socket: fifty requests of about 190 bytes each made the server write 1.002.600 bytes of
	 * log, 20.052 per request, an amplifier of a hundred times over. Neither deploy stack
	 * sets a {@code logging:} block, so Docker's json-file driver keeps it all without
	 * rotation, and {@code frontend/nginx.conf} rate-limits signing in and registering and
	 * not this. What the stack said that this line does not is WHERE the read failed, and it
	 * was the same three frames every time; what matters is which picture, by which address,
	 * and under which folder, and all three are here.
	 *
	 * @param photo {@code photo.id}, which is the file's name
	 * @param named how the caller asked for it - a digest on {@link #photo} and on
	 *              {@link #mineThatWaits}, a queue row's key on {@link #waitingOn}. Carried into
	 *              the line because „which picture" alone does not tell an operator which address
	 *              is broken, and the three routes reach one picture by two different sorts of
	 *              name
	 */
	private Optional<byte[]> theFileOf(long photo, Object named) {
		try {
			return Optional.of(bytesOf(folder.resolve(String.valueOf(photo))));
		} catch (IOException noFile) {
			LOG.warn("picture {} asked for as {} could not be read under {}", photo, named,
					folder);

			return Optional.empty();
		}
	}

	/**
	 * THE ONE ANSWER THAT CARRIES BYTES, so that the three routes cannot come to disagree
	 * about how a picture travels.
	 *
	 * <p><b>HOW LONG IT MAY BE KEPT IS THE CALLER'S TO SAY, AND THAT IS NOT A LOOSENING BUT THE
	 * ONLY THING THAT MAKES THE DAY TRUE.</b> The whole argument for a day (at the head of this
	 * class) rests on one sentence: „the name is the digest of the content, so the bytes behind a
	 * given address cannot change". That is a property of the ADDRESS and not of this method, and
	 * two of the three routes here are addressed by a digest while one is addressed by a
	 * {@code verification.id}. So the term travels with the address: {@link #FOR_A_DAY_PRIVATELY}
	 * where the address is derived from the content, {@link #NOT_KEPT_AT_ALL} where it is not.
	 *
	 * <p><b>AND NOTHING IS WRITTEN HERE ABOUT SNIFFING, which a first draft did.</b>
	 * {@code X-Content-Type-Options: nosniff} is on this answer already, written by the
	 * chain's own header writer for everything it answers - measured by taking the explicit
	 * header off and finding the case that asks for it still green. A line that changes no
	 * answer beside a sentence crediting it is worse than no line, so the fact is PINNED in
	 * the case instead, because these routes are the ones that depend on it.
	 *
	 * @param mediaType off the row and out of nothing else, which the note at the head of
	 *                  this class explains and V8's {@code photo_media_type_known} bounds
	 * @param how       one of the two constants above and never a third thing invented at a call
	 *                  site, so that „which answers may be kept" is a question with two answers
	 *                  written down rather than one per route
	 */
	private static ResponseEntity<byte[]> carrying(String mediaType, byte[] bytes,
			CacheControl how) {

		return ResponseEntity.ok()
				.contentType(MediaType.parseMediaType(mediaType))
				.cacheControl(how)
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
	 * THE ONE ANSWER, so that the many ways of getting here cannot drift apart.
	 *
	 * <p>Written out at each of them it would be as many chances for one to become a
	 * different sentence - a status set on the response rather than sent as an error is
	 * already a different answer on the wire, measured byte for byte on 13.09.2026 - and
	 * the whole point is that a name of the wrong shape, a digest nobody wrote, a row
	 * whose file has gone, a queue right the caller has not got and a picture that is
	 * somebody else's are indistinguishable from outside.
	 */
	private static ResponseEntity<byte[]> nothingIsHere(HttpServletResponse response)
			throws IOException {
		response.sendError(HttpStatus.NOT_FOUND.value());
		return null;
	}
}
