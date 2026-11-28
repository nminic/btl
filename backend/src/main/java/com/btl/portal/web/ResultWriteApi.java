package com.btl.portal.web;

import com.btl.portal.domain.event.WhatAnEventCarries;
import com.btl.portal.domain.event.WhatARaceCarries;
import com.btl.portal.domain.event.WhatARaceCarries.Figures;
import com.btl.portal.domain.mail.Gender;
import com.btl.portal.domain.mail.MailLanguage;
import com.btl.portal.domain.mail.WhatAResultChangeSays;
import com.btl.portal.domain.mail.WhatAResultChangeSays.Run;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.photo.WhatAPictureIs;
import com.btl.portal.domain.photo.WithoutMetadata;
import com.btl.portal.domain.result.ProofThatTheRunHappened;
import com.btl.portal.domain.result.ProofThatTheRunHappened.Outcome;
import com.btl.portal.domain.result.ProofThatTheRunHappened.Report;
import com.btl.portal.domain.scoring.BtlScoreCalculator;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.mail.Postman;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mail.MailException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.WebUtils;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;

/**
 * A MEMBER SENDING IN HIS OWN RUN, CORRECTING IT, AND TAKING IT BACK - AND THE MESSAGE
 * THAT IS THE ONLY RECORD OF WHAT IT USED TO SAY.
 *
 * <p>{@link ResultApi} has read {@code result} since the portal had one and nothing has
 * ever written to either table: measured on this branch, every {@code insert into
 * result_submission} in the repository was under {@code src/test}. These are the first
 * three writes, and they are the member's own three - PDL, owner, 27.08.2026: „clan ga ili
 * brise (ima pravo na to, iako je verifikovan) ili menja i dostavlja dokaz za tu izmenu
 * (ponovo)."
 *
 * <p><b>ONE OF THE MANDATORY MAILS IS SENT HERE, AND SINCE 09.10.2026 THE OTHER ONE ABOUT A
 * RESULT IS NOT.</b> PDL P18, 25.09.2026, „Obaveznih mejlova je pet", names „unet rezultat" and
 * „promenjen rezultat" among the five a member cannot switch off. The second is a correction,
 * and {@link #change} sends it. The first is no longer this class's to send. The owner chose
 * among the outcomes offered on 09.10.2026, and the record words his choice as PDL P9,
 * 09.10.2026, „Pri slanju rezultata clan dobija samo red u sanducetu; mejl stize tek kad je
 * rezultat odobren"; the same record already reads the mail about an approved result as „unet
 * rezultat" (a derivation of 03.10.2026, not a sentence of the owner's). So {@link #report}
 * writes the line in his inbox and posts nothing, and the letter is
 * {@link VerificationWriteApi}'s, sent when a moderator approves the run. Until then this route
 * posted too, which would have given a member two letters about one run.
 *
 * <p>There is no switch consulted anywhere below, and since V48 there is no switch anywhere at
 * all. V13 once gave {@code notification_setting} six columns for the six OPTIONAL messages,
 * and said in its own words why the mandatory ones had none - „a column for them would be a
 * promise the portal must refuse to keep." The owner then removed the optional six outright on
 * 29.09.2026 („da funkcionise samo kao poruke u inbox portala"), so the table went with them.
 * <b>The mandatory mails are untouched by that</b>: they never had a column, which is exactly
 * why dropping the table could not reach them.
 *
 * <p><b>AND THE MESSAGE FOR A DELETION IS NOT AN EXTRA.</b> „Isto obavestenje ide i kad se
 * obrise verifikovan rezultat i kad masovni uvoz pregazi postojeci. Bez ove dve stavke,
 * brisanje i uvoz postaju nacin da se rezultat promeni bez traga, pa cela mera ne vredi
 * nista." Deleting is the cheapest way to change a result without leaving a trace, and that is
 * the hole this closes.
 *
 * <p><b>ONE MESSAGE, BUILT ONCE, AND IT GOES TO THE MEMBER AND TO NOBODY ELSE.</b> „Skrivena
 * kopija svakog takvog obavestenja ide na administrativnu adresu lige, i ista poruka ide u
 * portalski inboks" - and its exception, which is every message this class sends: PDL P9,
 * 25.09.2026, „Skrivena kopija ligi NE ide kad clan sam menja ili brise svoj rezultat". The
 * owner's own words for it: „Covek ima pravo da obrise svoj rezultat bez javljanja i time se i
 * tabele i obracuni automatski azuriraju. Ispravka svakako ide Adminu na odobrenje." So one
 * {@link Said} is written into {@code message} and, for a correction and a deletion, handed to
 * {@link Postman} for his own address with nobody copied - rather than a second wording for the
 * inbox, which is how two copies of one record come to disagree. A copy of anything the member
 * did NOT do to his own result is not this class's to decide: the moderator's approval sends
 * its own letter, copied to the league ({@link VerificationWriteApi}). What decides the words
 * is {@link WhatAResultChangeSays} and not this class.
 *
 * <p><b>A CORRECTION DOES NOT TOUCH THE RESULT, AND THAT IS AN OWNER'S DECISION MADE
 * AGAINST A MEASUREMENT.</b> 28.08.2026, choosing between four outcomes: „Stari rezultat
 * ostaje u poretku dok ispravka ceka, i menja se tek kad je moderator odobri." What it
 * overturned was the opposite behaviour, measured the same day - a profile fell from 180
 * runs and 1.752,86 points to 179 and 1.744,60 the moment a correction was SENT, with no
 * way back if it was refused. So {@link #change} writes a submission and leaves
 * {@code result} exactly as it found it; {@link #remove} is the one that takes a row away,
 * „jer tamo clan nista ne ceka ni od koga."
 *
 * <p><b>A DELETION IS ALLOWED EVEN WHEN THE RESULT IS VERIFIED, AND THAT IS THE WHOLE OF
 * THE 27.08.2026 CHANGE.</b> „Clan sme da obrise svoj rezultat i posle verifikacije.
 * Verifikacija je provera tacnosti, ne prenos vlasnistva nad zapisom." There is therefore
 * no condition anywhere below about whether a result has been through a queue - the table
 * has no such column and this class asks for none, which is the shape that cannot drift
 * from the decision.
 *
 * <p><b>WHOSE RESULT IT IS, ASKED IN THE STATEMENT AND NOT AFTER IT.</b> Both
 * {@link #change} and {@link #remove} read {@code result} with {@code competitor_id = me}
 * in the {@code where}, so somebody else's result and a result that does not exist are one
 * answer and one code path. ADL A8, the owner, 13.09.2026: a signed in member who may not
 * do something is answered 404 and not 403, „isti odgovor kao da adresa ne postoji, jer ne
 * sme ni da sazna da radnja postoji" - and a count of results is exactly what a 403 on
 * {@code /api/results/5} would hand out, one id at a time.
 *
 * <p><b>WHAT IS OPEN AND WHAT IS NOT, and this class adds no line to
 * {@link ApiSecurity}.</b> {@code /api/results} is on {@code READ_BY_ANYBODY}, and since
 * 18.09.2026 that list is granted by METHOD - {@code GET}, {@code HEAD} and
 * {@code OPTIONS} - so a {@code POST}, a {@code PUT} or a {@code DELETE} falls through to
 * {@code anyRequest().authenticated()} and an outsider is answered 401 before this class
 * runs. There is no condition here about whether anybody is signed in, and there must not
 * be one. Nor is there a {@link RightIsNeeded}: sending in one's own run is what every
 * member does, not a box the superadmin ticks, which is why all three routes stand in
 * {@code RightsAtTheDoorTest.ANSWERS_WITHOUT_A_RIGHT} beside {@code POST /api/comments}.
 *
 * <p><b>WHAT THE FORM ASKS FOR IS NOT WHAT THE RACE ANSWERS FOR, AND A CORRECTION ASKS
 * THE RACE THE SAME QUESTION A FRESH REPORT DOES.</b> Which figures a race fixes depends
 * on its kind, and {@link WhatARaceCarries#figuresOf} is the one place that decides it -
 * called from both writers here rather than boxed by each in its own words, so they cannot
 * come to answer „whose figure is this" two different ways. The moderator's approval asks
 * it too, and so does the queue that shows him what an approval would count, which is why
 * it lives beside the race and not in this class. A race of a LENGTH fixes the distance, the
 * climb and the fall; a race to a LIMIT fixes the time, „jer je zadato trkom" (owner,
 * 29.08.2026); a FREE race fixes neither - the split {@code pages/event/reportedResult.ts}
 * already makes. PDL, owner, 03.08.2026: „Duzina, uspon i spust se ne unose, nego se
 * uzimaju sa izabrane trke. To su zvanicni podaci i moderator ih ispravlja na trci, gde
 * ispravka stize svima koji su je istrcali, a ne na jednoj prijavi" - true only if a
 * correction cannot set them either, „na jednoj prijavi" being exactly what a correction
 * is.
 *
 * <p><b>„Menja se sve osim trke" (PDL, owner, 27.08.2026) is not the same question, and
 * reading it as one was a fault this class carried until 25.09.2026.</b> „Time ispravka
 * ostaje izmena BROJEVA i dokaza, a ne ponovno otvaranje celog izbora" names what a
 * correction may touch against what it may not - the race itself, five days before the
 * split above was even written - and says nothing about who a figure belongs to. Read
 * the other way, a correction of one run could rewrite the length every OTHER result on
 * the same race of a length still carries as official: exactly the „na jednoj prijavi"
 * the 03.08.2026 decision refuses.
 *
 * <p><b>THE POINTS ARE COMPUTED HERE AND NEVER ACCEPTED FROM A REQUEST.</b> PDL: „Bodovi
 * ostaju izracunata vrednost", and the formula is {@link BtlScoreCalculator}, whose golden
 * set is untouchable. The request record below has no field for them at all, which is the
 * form that cannot be got wrong: there is nothing to ignore.
 *
 * <p><b>ALL THREE VERBS TURN AWAY A MEMBER WHOSE FEE DOES NOT STAND, AS THEY TURN AWAY AN
 * ACCOUNT THAT NAMES NO MEMBER.</b> Results are on the list PDL P8 gives of what a member who
 * has not paid may not do (10.10.2026, „rezultate"), beside the older derivation „Dok članarina
 * nije izmirena, član ne može da unese rezultat; kad plati, kasniji unos se prima". So each verb
 * opens with {@link ActiveMemberOrAdministration#activeMember} where it used to ask only whether
 * the account names a member, before a byte of the body is read, and a member who has never paid
 * or whose fee has lapsed takes the branch an account naming no member takes. {@link ResultApi}
 * withholding the running season of a lapsed member from every READER is the other half, and is
 * unchanged (PDL P11). The decision is quoted in full on {@link ActiveMemberOrAdministration}.
 *
 * <p><b>A PICTURE COMES WITH THE RUN, ON BOTH VERBS THAT SEND ONE.</b> The owner, 28.11.2026: „Odradi i
 * sliku kao dokaz uz rezultat", which carries out what he chose on 28.09.2026 („polje šalje bajtove,
 * server ih prima i čuva, moderator ih vidi uz rezultat") and with it the decision of 22.08.2026 that a
 * picture stands in for the link and asks a comment beside it, „na obe forme" and, by his words of
 * 03.10.2026, „na svim slanjima rezultata". So {@link #report} and {@link #change} take the body they
 * always took as JSON, or the same body as the part {@code run} of a {@code multipart/form-data}
 * request with the file as the part {@code picture}. One route and one method each, so every floor that
 * reads the dispatcher sees the routes it saw.
 *
 * <ul>
 * <li><b>What the server asks of the file is what ADL asks of a proof, 23.08.2026</b>: „server proverava
 * tip po sadržaju a ne po nazivu ni po {@code Content-Type} zaglavlju, ograničava veličinu, nikad ne
 * upotrebljava ime fajla kao putanju i briše fajl posle odluke". The order and the words are
 * {@link TeamLogoApi}'s and {@link MePhotoApi}'s: the size before the bytes are read
 * ({@link WhatAPictureIs#AT_MOST_BYTES}), the type by the bytes, and what the camera wrote about the
 * picture taken off before anything is stored ({@link WithoutMetadata}; a telephone writes where the
 * picture was taken). The two refusals are this class's own constants with the words those classes give
 * the same faults, so the screen that answers this route reads them here.
 * <li><b>Not held to the ceiling of the cut</b> ({@code SmallPicture.isLargerThanItCuts}), because a proof
 * is never cut (PDL: „Slika uz rezultat (dokaz sa sata) se zato ni ne kropuje"): that ceiling is the
 * cut's, and a photograph of a watch from a telephone of fifty million points would be refused for a cut
 * nobody makes. My reasoning, said in the PR.
 * <li><b>Kept where V9 and V10 said it would be</b>: a {@code photo} row whose circle is the whole picture
 * (P11, it is not cut), {@code verification.photo_id} on the row that waits, and the file under the
 * number the database issued (ADL O8). No column is added: {@code verification_decided_keeps_no_photo}
 * empties the pointer the moment the row is decided either way (PDL: „Priložena slika se i dalje briše
 * sa portala posle verifikacije", and O11 for a refusal, „slika se briše odmah"), V54 deletes the row of
 * a picture nobody holds at the end of that transaction, and the sweep takes the file
 * ({@code ThePicturesFolderIsSwept}, ADL A68).
 * <li><b>Who sees it while it waits</b>: the moderator who may decide the row, through
 * {@link PhotoApi#waitingOn}, which serves the picture of any row by the right the row carries; and
 * nobody else. ADL A60 names {@code verification.photo_id} („dokaz sa sata") among the holders that are
 * not public, so {@link PhotoApi#photo} answers it as a picture that is not there.
 * </ul>
 *
 * <p><b>WHAT IS DELIBERATELY NOT HERE, each named rather than left to be found.</b>
 *
 * <ul>
 * <li><b>A way for the member to see his own picture once it is sent.</b> Nothing decides
 * who besides the moderator sees a picture that waits, so the narrowest reading is taken: the
 * moderator through {@link PhotoApi#waitingOn} and nobody else (see the note on the picture,
 * below). My reasoning and not the owner's word, put to him as a question.
 * <li><b>Withdrawing a submission that is still waiting.</b> That is a different row in a
 * different table and a different verb, and PDL keeps them apart: a result is „njegov
 * podatak" and a submission is a question he asked. This class is about {@code result}.
 * <li><b>A second correction while one is already waiting.</b> Nothing refuses it, because
 * nothing decided that it should - the same boundary {@link CommentWriteApi} and
 * {@link TeamWriteApi} draw around their own repeats. The moderator sees both.
 * <li><b>Anything about the standings in the answer or the message.</b> PDL, owner,
 * 18.09.2026: „prave bodove (i promenu plasmana) dobija tek nakon verifikacije", and the
 * decision names its own mutation - „odgovor na prijavu koji nosi ijedno polje o poziciji
 * ili o poretku".
 * </ul>
 */
@RestController
class ResultWriteApi {

	private static final Logger LOG = LoggerFactory.getLogger(ResultWriteApi.class);

	/** {@code verification.queue} for the tab a waiting run stands in (V5, V10). */
	private static final String RESULTS = "results";

	/** Who the member hears from in his inbox, which is the league and never a person. */
	private static final String THE_PORTAL = "Rezultati";

	/** Something the request needs is absent, empty, or outside the scale the column keeps. */
	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	/** No {@code race} answers to the id that was sent. */
	static final String THE_RACE_IS_NOT_KNOWN = "theRaceIsNotKnown";

	/**
	 * FIGURES NOBODY RAN: the run they make would be worth more than any run can be
	 * ({@link PointsOfARun#THE_MOST_A_RUN_IS_WORTH}, PDL P4, owner, 10.10.2026: „Nikad broj bodova nece biti
	 * veci nego trocifren uz jos dve decimale"), so it is refused when it is sent, as the record derives
	 * beside that decision. Asked of the figures as they are counted, so on a race of a length the length
	 * is the race's. The league's own entry answers with the same word, declared again there
	 * ({@link ResultsByTheLeagueApi#THE_RUN_IS_IMPOSSIBLE}).
	 */
	static final String THE_RUN_IS_IMPOSSIBLE = "theRunIsImpossible";

	/** PDL, owner, 11.08.2026: „Ne sme, ne moze biti rezultata u buducnosti." The day of the
	 *  race itself counts as run, the same comparison {@link CommentWriteApi} makes for a
	 *  rating and for the owner's own reason. */
	static final String THE_RACE_HAS_NOT_BEEN_RUN = "theRaceHasNotBeenRun";

	/** The request both picks a race out of the calendar and describes one. V10 holds the two
	 *  apart with a biconditional, so there is no row that could be written from it. */
	static final String THE_RACE_IS_NAMED_TWICE = "theRaceIsNamedTwice";

	/**
	 * HE ALREADY HAS A RESULT ON THE RACE HE CHOSE, so the run is refused at once.
	 *
	 * <p>PDL P6, 18.10.2026, the owner choosing among the outcomes offered: „Članova prijava za trku
	 * na kojoj već ima rezultat se odbija odmah: „Za ovu trku već imaš rezultat. Ako vrednosti nisu
	 * tačne, pošalji ispravku tog rezultata.” Prijava koja je bila odbijena pa ponovo poslata ostaje
	 * dozvoljena." It follows from P6, 09.09.2026, „Član ima najviše jedan rezultat na jednoj trci":
	 * such a run could never be approved ({@link VerificationWriteApi} refuses it).
	 *
	 * <p><b>Asked of {@code result} and never of {@code result_submission}</b>, which is the second
	 * half of the same decision: a run sent and refused, or one still waiting, is not a result, so
	 * sending it again is open ({@code ResultSubmissionConstraintsTest} holds the schema to the same:
	 * „The same member may report the same race twice"). A run he
	 * DESCRIBES names no race of the calendar, so nothing here can ask it; the approval does, of the
	 * race the moderator chooses.
	 */
	static final String HE_HAS_A_RESULT_ON_THIS_RACE = "heHasAResultOnThisRace";

	/**
	 * A RUN OF A SEASON THAT IS NOT OPEN FOR A REPORT AT THIS MOMENT, on either road.
	 *
	 * <p>PDL P9, owner, 19.10.2026, „Član prijavljuje samo rezultate aktuelne sezone; istoriju šalje ligi
	 * kao popunjen CSV šablon", and „Pre 2027 forma i predlozi ne nude ništa, a server odbija svaku
	 * prijavu" („NIŠTA! NE POSTOJI LIGA PRE 2027 GODINE..."). Which seasons are open is
	 * {@code SeasonClock.seasonsOpenForAReport}'s answer and nobody else's: the year he is in, and until
	 * 10:00 on 1 January the year just ended. The sentence is the owner's approved one (PDL, „Reči forme
	 * člana i moderatorovog ekrana"). Asked after the race that has not been run yet, which keeps its own
	 * truer sentence for a race of next year.
	 */
	static final String THE_RACE_IS_OUTSIDE_THE_SEASON = "theRaceIsOutsideTheSeason";

	/**
	 * A TOWN TYPED BY HAND THAT IS LONGER THAN THE BOX THE MEMBER TYPES IT INTO.
	 *
	 * <p>The owner, 10.10.2026, in his words: „Stavi samo validaciju "Predugačak naziv grada"."
	 * (ADL, „Predugačak tekst u polju se odbija kratkom porukom"), and the same day, in the
	 * record's wording of his answer about a run on a race the calendar does not hold: „moderator
	 * u redu vidi mesto koje je član upisao, i to je uslov za ekran, uz granicu dužine i znakova na
	 * serveru". Such a town is what the event an approval makes stands in, in the public calendar
	 * (ADL, owner, 11.09.2026: „Trka van kalendara postaje javna."), and a security review
	 * measured a hundred thousand characters going in through this route. The screen draws the
	 * sentence; this is its name.
	 */
	static final String THE_TOWN_IS_TOO_LONG = "theTownIsTooLong";

	/**
	 * A TOWN TYPED BY HAND THAT HOLDS A CHARACTER NOBODY CAN SEE: a control character or a format
	 * character, the letters that turn the direction of writing among them.
	 *
	 * <p>The second half of the same answer of 10.10.2026, „granicu dužine i znakova na serveru",
	 * which named the reason in its own words: a character that turns the direction of writing went
	 * in through this route, measured, and would have turned the words around it in the public
	 * calendar. The set is Unicode's own two categories, {@code Cc} and {@code Cf}, asked of
	 * {@link Character#getType} and not listed: the set the portal already refuses in an address
	 * (`data/outsideLink.ts`, `INVISIBLE`), where a list written by hand was found seven short.
	 */
	static final String THE_TOWN_HOLDS_AN_INVISIBLE_CHARACTER = "theTownHoldsAnInvisibleCharacter";

	/**
	 * AS MANY CHARACTERS AS THE BOX FOR A TOWN TYPED BY HAND HOLDS on the member's own form
	 * ({@code unos-rezultata.form.json}, {@code city}), which is where the number lives: the
	 * owner's rule of 10.10.2026, as the ADL derives it from his answer, is that the server refuses
	 * a text longer than the limit the form already carries. {@code ResultWriteApiTest} reads the
	 * form and demands this number, the arrangement {@link MeWriteApi#AS_LONG_AS_THE_FORM_ALLOWS}
	 * has with its own box.
	 *
	 * <p>Counted as that constant is counted and for its reasons: in the units HTML's
	 * {@code maxlength} counts ({@link String#length()}), over what is stored (the town is
	 * stripped on the way in).
	 */
	static final int A_TYPED_TOWN_HOLDS_AT_MOST = 80;

	/**
	 * THE PICTURE SENT AS PROOF IS LARGER THAN A PICTURE ON THIS PORTAL MAY BE
	 * ({@link WhatAPictureIs#AT_MOST_BYTES}, 5 MiB, ADL A65). Its own constant with the word
	 * {@link MePhotoApi} gives the same fault, so the screens that answer this route read it here.
	 */
	static final String THE_PICTURE_IS_TOO_BIG = "thePictureIsTooBig";

	/**
	 * THE FILE SENT AS PROOF IS NONE OF THE THREE KINDS OF PICTURE THE SCHEMA HOLDS, judged by its bytes and
	 * by nothing the browser said about it (ADL, 23.08.2026, „server proverava tip po sadržaju a ne po
	 * nazivu ni po {@code Content-Type} zaglavlju"). The word {@link MePhotoApi} gives the same fault.
	 */
	static final String THIS_IS_NOT_A_PICTURE = "thisIsNotAPicture";

	/**
	 * WHY A REPORT IS NOT READY, IN THE PORTAL'S OWN WORDS, AND IT IS A MAP RATHER THAN A
	 * {@code switch}.
	 *
	 * <p>Kept a map from the days when no picture could arrive and
	 * {@link Outcome#A_PHOTOGRAPH_NEVER_STANDS_ALONE} was a word nothing could reach: a
	 * {@code switch} would be one branch per outcome for the same four answers.
	 *
	 * <p><b>The floor over it is {@code everyReasonARunCanBeRefusedForHasAWordForIt}</b>,
	 * which asks the ENUM for its constants rather than reading this, so an outcome added
	 * to {@link ProofThatTheRunHappened} with no entry here fails a case instead of
	 * answering {@code null} to a member.
	 */
	static final Map<Outcome, String> WHY_NOT = whyNot();

	private static Map<Outcome, String> whyNot() {
		Map<Outcome, String> words = new EnumMap<>(Outcome.class);

		words.put(Outcome.NOTHING_SHOWS_IT_HAPPENED, "nothingShowsItHappened");
		words.put(Outcome.A_PHOTOGRAPH_NEVER_STANDS_ALONE, "aPhotographNeverStandsAlone");
		words.put(Outcome.A_LINK_THAT_IS_NOT_A_LINK, "aLinkThatIsNotALink");

		return Map.copyOf(words);
	}

	private final JdbcClient db;

	private final DucatsFollowTheResults ducats;

	/** Who is asking, and whether his fee stands: the one question each verb opens with. */
	private final ActiveMemberOrAdministration readers;

	private final Postman postman;

	/** The bean and never {@code LocalDate.now()}, so „a race in the future" is something a
	 *  case can state instead of wait for ({@code WhatTimeItIs}). */
	private final Clock clock;

	/** Written by hand rather than left on the method, {@link CommentWriteApi}'s own choice
	 *  and its measured reason: a submission and the queue row that carries it are one
	 *  thing, and {@code @Transactional} would let a test go on passing while the second
	 *  statement silently never ran. */
	private final TransactionTemplate inOneTransaction;

	/** Whether the member sending the run is on the server's list of testers, who may send a run of
	 *  2026 until 1 January 2027 (PDL P9, owner, 21.11.2026; {@link ReportTesters}). Asked of the
	 *  member the session resolved, on both roads a run is sent by. */
	private final ReportTesters testers;

	/** Where the file of a picture is kept, under the number of its row (ADL O8), the folder
	 *  {@link PhotoApi} serves it from. */
	private final Path folder;

	ResultWriteApi(JdbcClient db, ActiveMemberOrAdministration readers, Postman postman, Clock clock,
			TransactionTemplate inOneTransaction, DucatsFollowTheResults ducats, ReportTesters testers,
			@Value("${btl.photos.folder}") String folder) {
		this.db = db;
		this.ducats = ducats;
		this.readers = readers;
		this.postman = postman;
		this.clock = clock;
		this.inOneTransaction = inOneTransaction;
		this.testers = testers;
		this.folder = Path.of(folder);
	}

	/**
	 * THE PICTURE THAT CAME WITH A RUN, as it is stored: the bytes with their metadata taken off, and the
	 * kind they were found to be.
	 */
	private record ThePicture(String mediaType, byte[] bytes) {
	}

	/** What a request carried: the body, and the picture where one came and is a picture ({@code null}
	 *  where none came); or the refusal of the file that came. */
	private record Carried<T>(T body, ThePicture picture, ResponseEntity<?> refused) {
	}

	/**
	 * A RUN AS IT IS SENT IN, either way round.
	 *
	 * @param raceId     the race out of the calendar, or empty when the member describes one
	 *                   the calendar does not hold (PDL: „Clan sme da unese trku koje nema u
	 *                   kalendaru")
	 * @param raceName   what he calls it, and only when he is describing one
	 * @param day        the day it was run. Asked for only on the described road: a race in
	 *                   the calendar answers for its own day, and
	 *                   {@code result_submission_race_fk} over {@code (race_id, race_date)}
	 *                   would refuse any other one anyway
	 * @param placeId    the town out of the codebook, BY THE MARK AND NEVER BY THE KEY.
	 *                   {@link PlaceApi} serves {@code place.geonames_id}, so that is the
	 *                   number a request can carry; {@code place.id} is a bigserial the
	 *                   portal has never published and no caller can have. Resolved below
	 *                   exactly as {@link EventWriteApi} and {@link RegistrationApi} resolve
	 *                   it, which is the owner's own instruction of 11.08.2026: „Mesto i
	 *                   drzava na registraciji rade isto kao na formi dogadjaja ... Jedna
	 *                   kontrola i jedno pravilo za ceo portal, ne dva slicna."
	 * @param city       the town typed by hand, and then {@code country} with it - the
	 *                   same three columns {@code competitor} and {@code btl_event} hold a
	 *                   town in, and V10 copies their constraints word for word
	 * @param country    its CODE, which is what {@link CountryApi} serves, and not a key
	 *                   either
	 * @param distanceKm what the member covered, and it is read only where the race does not
	 *                   fix it
	 * @param link       the official results, required unless a photograph stands in for it
	 *                   ({@link ProofThatTheRunHappened})
	 * @param comment    his own note, which may be empty
	 * @param eventId    THE EVENT HE CHOSE for a race the calendar does not hold, by its key, and
	 *                   only on the described road (V66; PDL P9, owner, 19.10.2026: „Prvo ima
	 *                   naziv događaja koji je autocomplete iz baze, ali mogu da unesem novu
	 *                   vrednost", and „Prijava pamti događaj koji je član izabrao"). Never beside
	 *                   {@code eventName}: chosen or typed, as the town is
	 * @param eventName  the name he TYPED where the calendar has no such event. One of the two is
	 *                   asked for on this road; a run that names neither is a form not filled in
	 * @param eventKind  THE KIND OF THE EVENT HE TYPED, a scored race ({@code race}) or an unscored one
	 *                   ({@code unscored}), and only beside {@code eventName}. PDL, 14.11.2026, (4): „Kad
	 *                   član opiše događaj kojeg nema u kalendaru, u formi bira Bodovana ili Nebodovana
	 *                   trka (podrazumevano Bodovana)"; the default is the form's to start from, and a
	 *                   run that names no kind here is a form not filled in, never a scored race (ADL A8:
	 *                   „Izostavljeno polje nikad ne sme tiho da promeni vrednost"). An event he CHOSE has
	 *                   its own kind, so a kind beside {@code eventId} is a second answer to a question the
	 *                   calendar has answered, refused as a town beside it is
	 */
	record Ran(Long raceId, String raceName, LocalDate day, String raceKind, Long placeId,
			String city, String country, BigDecimal distanceKm, Integer ascentM, Integer descentM,
			Integer seconds, String link, String comment, Long eventId, String eventName,
			String eventKind) {
	}

	/**
	 * THE EVENT A DESCRIBED RUN NAMES, CHOSEN OR TYPED, AND {@link #NONE} WHERE IT NAMES NONE.
	 *
	 * @param chosen the key of the event he chose, which V66 writes into {@code event_id}
	 * @param typed  the name he typed, stripped, which V66 writes into {@code event_name}
	 */
	record TheEvent(Long chosen, String typed) {

		/** A run that names no event: one from the calendar, a correction, or one sent without. */
		static final TheEvent NONE = new TheEvent(null, null);
	}

	/**
	 * A CORRECTION, WHICH IS THE NUMBERS AND THE PROOF AND NOTHING ELSE.
	 *
	 * <p>There is no race on it, and that is PDL rather than an omission: „Menja se sve osim
	 * trke. Ko je pogresio trku, brise rezultat i unosi nov." A field for it would be a
	 * field this class would have to refuse.
	 */
	record Correction(BigDecimal distanceKm, Integer ascentM, Integer descentM, Integer seconds,
			String link, String comment) {
	}

	/** Why something was refused, the shape every writing route on this server answers with. */
	record Refused(String reason) {
	}

	/** @param id the submission now standing in the queue. */
	record Made(long id) {
	}

	/**
	 * A RESULT IS SENT IN, and what it makes is a submission and a queue row, never a
	 * result.
	 *
	 * <p>PDL: „Rezultat ulazi u rang liste tek posle odobrenja. Ne prikazuje se pre
	 * verifikacije, pa ne postoji ni oznaka `nepotvrdjen` u tabelama." So nothing here
	 * touches {@code result}, and {@link ResultApi} goes on answering exactly what it did.
	 */
	@PostMapping(path = "/api/results",
			consumes = { MediaType.APPLICATION_JSON_VALUE, MediaType.MULTIPART_FORM_DATA_VALUE })
	ResponseEntity<?> report(@AuthenticationPrincipal WhoIsAsking.Member asking,
			WhatWasSent<Ran> sent, HttpServletRequest request) throws IOException {
		Long me = readers.activeMember(asking).orElse(null);

		/* AN ACCOUNT THAT NAMES NO MEMBER, OR A MEMBER WHOSE FEE DOES NOT STAND (see the class
		   note), and his body is not read: it is read below, after this question, and not bound
		   as an argument (register 166). A body with a picture is parsed by the container before
		   any method runs, as every picture of the portal is (`MePhotoApi`); what it says is read
		   here, after the question, all the same. */
		if (me == null) {
			return awayAtAnOpenAddress();
		}

		Carried<Ran> carried = whatCameWith(sent, request);
		Ran typed = carried.body();

		if (typed == null) {
			return no(THE_FORM_IS_NOT_COMPLETE);
		}

		if (carried.refused() != null) {
			return carried.refused();
		}

		ResponseEntity<?> proof = whatIsWrongWithTheProof(typed.link(), carried.picture() != null,
				typed.comment());

		if (proof != null) {
			return proof;
		}

		return typed.raceId() == null ? described(me, typed, carried.picture())
				: fromTheCalendar(me, typed, carried.picture());
	}

	/**
	 * A RESULT IS CORRECTED, and the result itself is not touched.
	 *
	 * <p>The correction is a submission like any other and goes „na kraj reda kao nov"
	 * (owner, 27.08.2026) - the queue is read by {@code raised_at} and this row is new, so
	 * that is what it does by being written rather than by anything here saying so. What
	 * makes it a CORRECTION rather than a second report is {@code amends_result_id} (V31),
	 * which is both the label the owner asked the queue for and the row an approval will
	 * have to replace.
	 *
	 * <p><b>The proof is asked for again</b>, and that is the owner's own sentence:
	 * „menja i dostavlja dokaz za tu izmenu (PONOVO)". A counted result carries none of its
	 * own to fall back on - the picture is deleted on decision (ADL A12) and the link was
	 * the moderator's to read at the time.
	 *
	 * <p><b>The four figures go through {@link WhatARaceCarries#figuresOf}</b>, the very
	 * function {@link #fromTheCalendar} calls, so which of them is the member's to correct still
	 * depends on what the race fixes (see the class note) - a correction does not get a
	 * second, looser answer to that question just for being a correction.
	 */
	@PutMapping(path = "/api/results/{id}",
			consumes = { MediaType.APPLICATION_JSON_VALUE, MediaType.MULTIPART_FORM_DATA_VALUE })
	ResponseEntity<?> change(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@PathVariable AKey id, WhatWasSent<Correction> sent, HttpServletRequest request)
			throws IOException {
		Long me = readers.activeMember(asking).orElse(null);

		if (me == null) {
			throw nothingIsHere();
		}

		Carried<Correction> carried = whatCameWith(sent, request);
		Correction typed = carried.body();

		if (typed == null) {
			return no(THE_FORM_IS_NOT_COMPLETE);
		}

		Optional<Counted> standing = his(id.value(), me);

		if (standing.isEmpty()) {
			throw nothingIsHere();
		}

		/* AFTER THE QUESTION WHOSE RESULT IT IS, so a picture sent at somebody else's result is
		   answered as that result is, and nothing about the file is told about a result he may not
		   know of (ADL A8). */
		if (carried.refused() != null) {
			return carried.refused();
		}

		ResponseEntity<?> proof = whatIsWrongWithTheProof(typed.link(), carried.picture() != null,
				typed.comment());

		if (proof != null) {
			return proof;
		}

		/* THE RACE ANSWERS FOR WHAT IT FIXES HERE TOO (see the class note). `result_race_fk`
		   cascades on the result this row corrects, so the race it names cannot have been
		   deleted out from under it and `orElseThrow` never actually throws. */
		Counted before = standing.get();
		TheRace race = raceOf(before.raceId()).orElseThrow();
		/* THE CLIMB AND THE FALL MAY BE LEFT OUT AT AN UNSCORED RACE, and are nought then
		   (PointsOfARun#withTheClimbOptional carries the owner's words); a correction is the same run
		   at the same race, so it is asked of the race it is at. */
		Figures figures = PointsOfARun.withTheClimbOptional(before.scored(),
				WhatARaceCarries.figuresOf(race.fixes(), new Figures(typed.distanceKm(),
						typed.ascentM(), typed.descentM(), typed.seconds())));

		if (notADistance(figures.distanceKm()) || notAClimb(figures.ascentM())
				|| notAClimb(figures.descentM()) || notATime(figures.seconds())) {
			return no(THE_FORM_IS_NOT_COMPLETE);
		}

		if (PointsOfARun.impossible(before.scored(), race.kind(), figures)) {
			return no(THE_RUN_IS_IMPOSSIBLE);
		}

		Run after = new Run(before.raceName(), before.day(), figures.distanceKm(),
				figures.ascentM(), figures.descentM(), figures.seconds(), PointsOfARun.toTell(
						before.scored(), pointsFor(race.kind(), figures.distanceKm(), figures.ascentM(),
								figures.descentM(), figures.seconds())));

		Recipient him = recipient(asking.account());
		Said said = WhatAResultChangeSays.changed(before.run(), after, him.language(), him.gender());

		Long made = inOneTransaction.execute(committing -> {
			long submission = writeTheSubmission(me, before.raceId(), before.day(), null, null,
					null, null, null, TheEvent.NONE, null, after, typed.link(), typed.comment(),
					id.value());

			queue(me, submission, before.raceName(), typed.comment(), carried.picture());
			tell(me, said);

			return submission;
		});

		post(asking.account(), him, said);

		return ResponseEntity.ok(new Made(made));
	}

	/**
	 * A RESULT IS TAKEN BACK, AND IT GOES AT ONCE.
	 *
	 * <p>PDL, owner, 27.08.2026: „Clan sme da obrise svoj rezultat i posle verifikacije...
	 * rezultat je njegov podatak i pravo da ga povuce ne prestaje time sto ga je moderator
	 * odobrio", and 28.08.2026 on the difference from a correction: „Brisanje verifikovanog
	 * i dalje vadi rezultat odmah, jer tamo clan nista ne ceka ni od koga."
	 *
	 * <p><b>Any correction waiting on it goes with it, and that is the schema's doing rather
	 * than a second statement here.</b> {@code result_submission_amends_fk} cascades (V31),
	 * and {@code verification_result_submission_fk} cascades behind it (V10), so no queue
	 * item is left pointing at a run nobody can see.
	 *
	 * <p><b>The message is built BEFORE the row is deleted</b>, which is the whole point of
	 * the decision it carries out: after the delete there is nowhere left to read the old
	 * value from, and a message assembled afterwards would be a record of nothing.
	 */
	@DeleteMapping("/api/results/{id}")
	ResponseEntity<?> remove(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@PathVariable AKey id) {
		Long me = readers.activeMember(asking).orElse(null);

		if (me == null) {
			throw nothingIsHere();
		}

		Optional<Counted> standing = his(id.value(), me);

		if (standing.isEmpty()) {
			throw nothingIsHere();
		}

		Recipient him = recipient(asking.account());
		Said said = WhatAResultChangeSays.deleted(standing.get().run(), him.language());

		inOneTransaction.executeWithoutResult(committing -> {
			/* WHOSE IT IS IS IN THIS STATEMENT TOO, AND IT IS A SECOND LOCK WITH NO CASE OF
			   ITS OWN. Measured rather than believed: taking `competitor_id` off this line
			   and running the whole class leaves it green, because `his` above has already
			   refused somebody else's result and this statement is never reached with one.
			   Taking it off `his` IS caught, so the pair is one guard and one belt.

			   It stays, and the boundary is written here rather than left for the next round
			   to find: a condition that cannot be measured is a condition somebody will
			   delete as dead, and this one is what stands between a future caller of this
			   method - one that has not read `his` - and deleting a stranger's result. */
			db.sql("delete from result where id = ? and competitor_id = ?").params(id.value(), me).update();
			tell(me, said);
		});

		post(asking.account(), him, said);

		/* AND HIS DUCATS AFTER THE COMMIT: „Kad se dukat oduzme, član ne dobija posebnu poruku; poruku o
		   brisanju ili ispravci rezultata ionako dobija.” (PDL, 08.11.2026) A ducat this run writes is told by
		   {@link AwardingDucats} by the rule of 12.11.2026. */
		ducats.follow(me);

		return ResponseEntity.noContent().build();
	}

	/**
	 * A RUN ON A RACE THE CALENDAR HOLDS: THE RACE ANSWERS FOR WHAT IT FIXES.
	 *
	 * <p>The day is the race's and is never read off the request. {@code result_submission}
	 * points at {@code race (id, date)} - the composite key V10 chose on purpose - so a day
	 * that disagreed with the calendar could not be written anyway, and asking for one would
	 * be a 500 where an answer belongs.
	 */
	private ResponseEntity<?> fromTheCalendar(long me, Ran typed, ThePicture picture) {
		/* AN EVENT BESIDE A RACE OF THE CALENDAR is the same request as a town beside one: the race
		   has its event already, and V66 (`result_submission_only_a_described_run_names_its_event`)
		   holds the row to that. Refused with the same reason and not dropped, for the reason that
		   reason gives for the race's own description. */
		if (typed.raceName() != null || typed.raceKind() != null || typed.placeId() != null
				|| typed.city() != null || typed.country() != null || typed.eventId() != null
				|| typed.eventName() != null || typed.eventKind() != null) {
			return no(THE_RACE_IS_NAMED_TWICE);
		}

		Optional<TheRace> found = raceOf(typed.raceId());

		if (found.isEmpty()) {
			return no(THE_RACE_IS_NOT_KNOWN);
		}

		TheRace race = found.get();

		if (race.day().isAfter(today())) {
			return no(THE_RACE_HAS_NOT_BEEN_RUN);
		}

		if (!SeasonClock.aRunMayBeSentFor(race.day().getYear(), now(), testers.is(me))) {
			return no(THE_RACE_IS_OUTSIDE_THE_SEASON);
		}

		/* HIS RESULT ON THIS RACE, if there is one (see HE_HAS_A_RESULT_ON_THIS_RACE). A result the
		   league writes after this question is not seen here, and the approval refuses the run then:
		   this is the member being told early, and V65 is the rule. */
		if (Boolean.TRUE.equals(db.sql("select exists(select 1 from result where competitor_id = ?"
						+ " and race_id = ?)")
				.params(me, race.id()).query(Boolean.class).single())) {
			return no(HE_HAS_A_RESULT_ON_THIS_RACE);
		}

		/* A RACE OF AN UNSCORED EVENT LETS THE CLIMB AND THE FALL BE LEFT OUT, and nought is written
		   (PointsOfARun#withTheClimbOptional), and its message names no points. */
		boolean scored = PointsOfARun.scored(db, race.id());
		Figures figures = PointsOfARun.withTheClimbOptional(scored,
				WhatARaceCarries.figuresOf(race.fixes(), new Figures(typed.distanceKm(),
						typed.ascentM(), typed.descentM(), typed.seconds())));

		if (notADistance(figures.distanceKm()) || notAClimb(figures.ascentM())
				|| notAClimb(figures.descentM()) || notATime(figures.seconds())) {
			return no(THE_FORM_IS_NOT_COMPLETE);
		}

		if (PointsOfARun.impossible(scored, race.kind(), figures)) {
			return no(THE_RUN_IS_IMPOSSIBLE);
		}

		Run run = new Run(race.name(), race.day(), figures.distanceKm(), figures.ascentM(),
				figures.descentM(), figures.seconds(), PointsOfARun.toTell(scored,
						pointsFor(race.kind(), figures.distanceKm(), figures.ascentM(), figures.descentM(),
								figures.seconds())));

		return write(me, typed.raceId(), race.day(), null, null, null, null, null, TheEvent.NONE,
				null, run, typed, race.name(), picture);
	}

	/*
	 * WHICH FOUR FIGURES A RUN CARRIES stood here as a private function from the day this class
	 * was written until the moderator's approval and the queue that shows it came to need the
	 * same answer. It moved rather than being copied - three copies of „whose figure is this"
	 * would be free to disagree - and it lives beside the race now, with its note about why the
	 * race's side is boxed by hand: {@link WhatARaceCarries#figuresOf}.
	 */

	/**
	 * A RUN ON A RACE THE CALENDAR DOES NOT HOLD: THE MEMBER ANSWERS FOR ALL OF IT.
	 *
	 * <p>PDL: „Clan sme da unese trku koje nema u kalendaru. Tada administrator kreira
	 * dogadjaj i trku uz rezultat, i sve troje nastaje istovremeno." So everything the
	 * approval will need to make an event and a race out of is collected here, at the one
	 * moment somebody knows it - which is V10's own reason for these columns.
	 */
	private ResponseEntity<?> described(long me, Ran typed, ThePicture picture) {
		/* THE KIND OF THE EVENT, FIRST, because whether the climb and the fall may be left out turns on
		   it (PointsOfARun#withTheClimbOptional). The member's own where he typed the event, and the
		   chosen event's where he chose one (V101 keeps either). A chosen event that is not there, or
		   that holds no races, is refused below; until then its run is judged as a scored race's,
		   which is how every run was judged before an unscored race existed. */
		String kind = typed.eventId() != null ? kindOfTheEvent(typed.eventId()).orElse(null)
				: typed.eventKind();
		boolean scored = !WhatAnEventCarries.AN_UNSCORED_RACE.equals(kind);
		Figures figures = PointsOfARun.withTheClimbOptional(scored, new Figures(typed.distanceKm(),
				typed.ascentM(), typed.descentM(), typed.seconds()));

		/* THE KIND IS ASKED FOR ITSELF BEFORE THE CODEBOOK IS ASKED ABOUT IT, and that too
		   was a 500: `WhatARaceCarries.KINDS` is a `Set.of(...)`, and an immutable set THROWS
		   on `contains(null)` rather than answering false. So a form that never chose a kind
		   answered a server fault instead of „the form is not complete". */
		/* AND THE EVENT IS ASKED FOR WITH THE REST (PDL P9, 19.10.2026, the owner's form: „Prvo ima
		   naziv događaja"; required on this road by the coordinator's derivation from it, Q8 of 7a):
		   chosen by its key or typed, and a run that names neither is a form not filled in. */
		if (isNothing(typed.raceName()) || typed.day() == null || typed.raceKind() == null
				|| !WhatARaceCarries.KINDS.contains(typed.raceKind())
				|| notADistance(figures.distanceKm()) || notAClimb(figures.ascentM())
				|| notAClimb(figures.descentM()) || notATime(figures.seconds())
				|| (typed.eventId() == null && isNothing(typed.eventName()))) {
			return no(THE_FORM_IS_NOT_COMPLETE);
		}

		/* AND FIGURES NOBODY RAN, judged as the kind he sent it under is judged: a run of an unscored race
		   keeps nought and is never refused for it. */
		if (PointsOfARun.impossible(scored, typed.raceKind(), figures)) {
			return no(THE_RUN_IS_IMPOSSIBLE);
		}

		/* A KIND BESIDE A CHOSEN EVENT is a second answer to what the calendar answers (see Ran), and is
		   refused as a town beside one is; a TYPED event with no kind, or with one that is not a race, is
		   a form not filled in. Asked of the two words and not of `WhatAnEventCarries.KINDS`, because a
		   training or a gathering holds no race a run could be at. */
		if (typed.eventId() != null && typed.eventKind() != null) {
			return no(THE_RACE_IS_NAMED_TWICE);
		}

		if (typed.eventId() == null && !WhatAnEventCarries.A_RACE.equals(kind)
				&& !WhatAnEventCarries.AN_UNSCORED_RACE.equals(kind)) {
			return no(THE_FORM_IS_NOT_COMPLETE);
		}

		/* CHOSEN AND TYPED AT ONCE is a run naming two events, and V66 holds the row to one
		   (`result_submission_event_is_chosen_or_typed`). The reason is the one the race's own two
		   ways get, for the same request one field along. */
		if (typed.eventId() != null && !isNothing(typed.eventName())) {
			return no(THE_RACE_IS_NAMED_TWICE);
		}

		boolean chosen = typed.eventId() != null;

		if (chosen) {
			/* AN EVENT HE CHOSE BRINGS ITS OWN TOWN (V67, `result_submission_a_chosen_event_brings_its_
			   town`), so a town sent beside it is a second answer to a question the calendar has
			   answered: refused with the reason a town beside a race of the calendar gets, and not
			   dropped, for that reason's own reason. */
			if (typed.placeId() != null || typed.city() != null || typed.country() != null) {
				return no(THE_RACE_IS_NAMED_TWICE);
			}

			/* AND A KEY NO EVENT ANSWERS TO IS REFUSED, which until V67 it was not (it was kept as no
			   event, beside the town the run then carried). A run on a chosen event carries no town
			   now, so kept as no event it would name neither, and the approval could make no event of
			   it. The reason is the one a race of the calendar that is gone gets, and its sentence
			   sends him to choose again, which is what he has to do: my reading, since that sentence
			   names the race and not the event (said in the PR, with words of its own to come with
			   the member's form). */
			/* AND SO IS AN EVENT THAT HOLDS NO RACE, a training or a gathering, which the member's
			   form never offers (`eventsToOffer.ts`) and the approval would refuse in any case
			   (`VerificationWriteApi`, „Taj događaj nije trka."): a run on it has no kind of race to
			   carry (V101), so it is told now, with the sentence that sends him to choose again. */
			if (kind == null || !WhatAnEventCarries.holdsRaces(kind)) {
				return no(THE_RACE_IS_NOT_KNOWN);
			}
		} else {
			ResponseEntity<?> town = whatIsWrongWithTheTown(typed);

			if (town != null) {
				return town;
			}
		}

		if (typed.day().isAfter(today())) {
			return no(THE_RACE_HAS_NOT_BEEN_RUN);
		}

		if (!SeasonClock.aRunMayBeSentFor(typed.day().getYear(), now(), testers.is(me))) {
			return no(THE_RACE_IS_OUTSIDE_THE_SEASON);
		}

		boolean fromTheCodebook = typed.placeId() != null;
		String named = typed.raceName().strip();

		Run run = new Run(named, typed.day(), figures.distanceKm(), figures.ascentM(),
				figures.descentM(), figures.seconds(), PointsOfARun.toTell(scored,
						pointsFor(typed.raceKind(), figures.distanceKm(), figures.ascentM(),
								figures.descentM(), figures.seconds())));

		return write(me, null, typed.day(), named, typed.raceKind(),
				fromTheCodebook ? placeKey(typed.placeId()).orElseThrow() : null,
				chosen || fromTheCodebook ? null : typed.city().strip(),
				chosen || fromTheCodebook ? null : countryKey(typed.country()).orElseThrow(),
				chosen ? new TheEvent(typed.eventId(), null)
						: new TheEvent(null, typed.eventName().strip()),
				kind, run, typed, named, picture);
	}

	/** The kind of an event of the calendar, and nothing where no event answers to the key. */
	private Optional<String> kindOfTheEvent(long id) {
		return db.sql("select kind from btl_event where id = ?").param(id).query(String.class).optional();
	}

	/**
	 * THE TOWN, EXACTLY ONE WAY AND BY THE NUMBER THE PORTAL REALLY PUBLISHES.
	 *
	 * <p><b>This is {@link EventWriteApi#whatIsWrongWithTheTown} word for word, but for what a
	 * town typed by hand may hold (the comment inside says why this route is first), and copying
	 * it is the instruction rather than the shortcut.</b> The owner, 11.08.2026: „Mesto i drzava
	 * na registraciji rade isto kao na formi dogadjaja ... Jedna kontrola i jedno pravilo za
	 * ceo portal, ne dva slicna." The reasons it answers with are that class's own constants
	 * and not copies of its strings, so the two cannot come to say different words for one
	 * refusal.
	 *
	 * <p><b>Half of this is a constraint asked before the row rather than after it</b>
	 * ({@code result_submission_town_is_from_the_codebook_or_typed},
	 * {@code ..._typed_town_names_its_country}): left to the database, each would reach the
	 * member as a server fault instead of a sentence.
	 *
	 * <p><b>THE OTHER HALF IS NOT A CONSTRAINT AT ALL AND IS THE ONE THAT COST THIS ROUTE A
	 * ROUND.</b> The first draft wrote {@code placeId} straight into {@code place_id}, which
	 * is a key, while {@link PlaceApi} serves {@code place.geonames_id}, which is a mark.
	 * Measured over {@code V3__place.sql}: 47,016 towns, so a key runs to 47,016 and a mark
	 * runs to 13,697,165. For 46,989 of them the member would be refused a town the codebook
	 * has - as a 500, on the foreign key - and for the other 27 a row WOULD be found, a
	 * different town's, and written down with nothing said. {@code EventWriteApi} had exactly
	 * this until 19.09.2026 and its own cases sent the key, so code and cases agreed with each
	 * other and neither agreed with the portal.
	 *
	 * <p><b>What caught it here was not review and not a case of this route's own</b>, but
	 * {@code EveryRouteFindsATownByItsMarkTest}, which asks the DISPATCHER which handlers take
	 * a body holding a {@code placeId} and requires a probe for each. It failed on the day this
	 * route was written, which is the day somebody could still decide what it should do.
	 *
	 * @return the refusal, or {@code null} when there is nothing wrong with the town
	 */
	private ResponseEntity<?> whatIsWrongWithTheTown(Ran typed) {
		boolean fromTheCodebook = typed.placeId() != null;
		boolean typedByHand = !isNothing(typed.city());

		if (fromTheCodebook == typedByHand) {
			return no(EventWriteApi.THE_TOWN_IS_NOT_SAID_ONCE);
		}

		if (fromTheCodebook) {
			/* A country beside a codebook town is refused rather than dropped, which is
			   EventWriteApi's own reasoning: its country is the codebook's and does not
			   change, so taking the field and ignoring it would tell the member his choice
			   was kept. */
			if (!isNothing(typed.country())) {
				return no(EventWriteApi.THE_COUNTRY_BELONGS_TO_A_TYPED_TOWN);
			}

			return placeKey(typed.placeId()).isPresent() ? null
					: no(EventWriteApi.THE_TOWN_IS_NOT_KNOWN);
		}

		/* AND WHAT A TOWN TYPED BY HAND MAY HOLD, which is this route's own and not yet the event
		   form's: the owner made it the condition of the screen that shows the moderator this
		   town (10.10.2026, `THE_TOWN_IS_TOO_LONG` and `THE_TOWN_HOLDS_AN_INVISIBLE_CHARACTER` carry
		   his words). The rule that the server holds every text to the box its form draws reaches
		   the other towns of the portal with the rest of that work (NV), and `EventWriteApi` is
		   word for word the rest of this method until then. */
		String town = typed.city().strip();

		if (town.length() > A_TYPED_TOWN_HOLDS_AT_MOST) {
			return no(THE_TOWN_IS_TOO_LONG);
		}

		if (town.codePoints().anyMatch(ResultWriteApi::nobodySees)) {
			return no(THE_TOWN_HOLDS_AN_INVISIBLE_CHARACTER);
		}

		if (isNothing(typed.country())) {
			return no(EventWriteApi.A_TYPED_TOWN_NAMES_ITS_COUNTRY);
		}

		return countryKey(typed.country()).isPresent() ? null
				: no(EventWriteApi.THE_COUNTRY_IS_NOT_KNOWN);
	}

	/** A control character or a format character, by Unicode's own category (`Cc`, `Cf`). */
	static boolean nobodySees(int character) {
		int category = Character.getType(character);

		return category == Character.CONTROL || category == Character.FORMAT;
	}

	/** The row of the codebook a MARK names, and nothing where the codebook has no such town.
	 *  {@link EventWriteApi#placeKey} carries the reason at length and this is the same
	 *  statement rather than a second reading of the same question. */
	private Optional<Long> placeKey(long mark) {
		return db.sql("select id from place where geonames_id = ?")
				.param(mark).query(Long.class).optional();
	}

	private Optional<Long> countryKey(String code) {
		return db.sql("select id from country where code = ?").param(code)
				.query(Long.class).optional();
	}

	/**
	 * THE WRITING, which is one transaction from the submission to the queue row and the line
	 * in his inbox, AND NO LETTER AFTER IT.
	 *
	 * <p>The line in the inbox is the whole of what a run sent in tells him (PDL P9,
	 * 09.10.2026, „Pri slanju rezultata clan dobija samo red u sanducetu"), and the letter
	 * waits for the approval, which is {@link VerificationWriteApi}'s. Until 09.10.2026 the
	 * account that is asking came this far only to be asked for the address that letter went
	 * to, so with the letter gone neither road that ends here carries it.
	 */
	private ResponseEntity<?> write(long me, Long raceId, LocalDate day, String raceName,
			String raceKind, Long theTownsKey, String city, Long theCountrysKey, TheEvent event,
			String eventKind, Run run, Ran typed, String subject, ThePicture picture) {
		/* IN HIS LANGUAGE, which is the account's (owner, 10.10.2026, Q3: the inbox copy of the
		   messages about a result follows the language of the letter). There is no letter for a
		   run sent in, and so no address to read the language beside; it is read off the account
		   whose member this is, which `account_competitor_unique` (V23) makes one row. */
		Recipient him = db.sql("select a.email, a.mail_language, c.gender from account a"
				+ " join competitor c on c.id = a.competitor_id where a.competitor_id = ?")
				.param(me)
				.query(ResultWriteApi::aRecipient)
				.single();
		Said said = WhatAResultChangeSays.entered(run, him.language(), him.gender());

		Long made = inOneTransaction.execute(committing -> {
			long submission = writeTheSubmission(me, raceId, day, raceName, raceKind, theTownsKey,
					city, theCountrysKey, event, eventKind, run, typed.link(), typed.comment(), null);

			queue(me, submission, subject, typed.comment(), picture);
			tell(me, said);

			return submission;
		});

		return ResponseEntity.status(HttpStatus.CREATED).body(new Made(made));
	}

	/**
	 * THE ROW ITSELF.
	 *
	 * <p>The link is written as {@link ProofThatTheRunHappened#linkAsItGoesIn} says and never
	 * as it was typed: that class judges the field AND says how it is stored, precisely so a
	 * caller cannot decide for itself and get it wrong against
	 * {@code result_submission_link_shape}.
	 *
	 * @param theTownsKey    the ROW of the codebook, deliberately not called {@code placeId} -
	 *                       {@link EventWriteApi}'s own naming, and for its own measured
	 *                       reason: the number that ARRIVES under that name is a mark, and a
	 *                       parameter sharing its name is an invitation to hand one on
	 * @param theCountrysKey the same, one column along
	 * @param event          the event a described run names (V66), and {@link TheEvent#NONE}
	 *                       everywhere else
	 * @param eventKind      the kind of that event (V101): the member's choice where he typed it, the
	 *                       chosen event's where he chose one, and empty on a run from the calendar
	 */
	private long writeTheSubmission(long me, Long raceId, LocalDate day, String raceName,
			String raceKind, Long theTownsKey, String city, Long theCountrysKey, TheEvent event,
			String eventKind, Run run, String link, String comment, Long amends) {
		return db.sql("insert into result_submission (competitor_id, race_id, race_date,"
						+ " race_name, race_kind, place_id, city, country_id, distance_km,"
						+ " ascent_m, descent_m, seconds, link, comment, amends_result_id,"
						+ " event_id, event_name, event_kind)"
						+ " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) returning id")
				.params(me, raceId, day, raceName, raceKind, theTownsKey, city, theCountrysKey,
						run.distanceKm(), run.ascentM(), run.descentM(), run.seconds(),
						ProofThatTheRunHappened.linkAsItGoesIn(report(link, false, comment)),
						orEmpty(comment), amends, event.chosen(), event.typed(), eventKind)
				.query(Long.class)
				.single();
	}

	/**
	 * AND THE TAB IT WAITS IN, which is the only one a row carrying a submission may stand in
	 * ({@code verification_only_the_results_queue_carries_a_submission}).
	 *
	 * <p>{@code state}, {@code raised_at} and {@code right_code} are left to V9's own
	 * defaults, the same absence {@link CommentWriteApi} and {@link TeamWriteApi} leave.
	 */
	/**
	 * THE ROW THAT WAITS, AND THE PICTURE ON IT WHERE ONE CAME.
	 *
	 * <p><b>The picture's row first, the queue row pointing at it, and the file last</b>, which is
	 * {@link TeamLogoApi}'s order and its reason: the file is named by the number the database issues
	 * for the row (ADL O8), so nothing a member sent comes near the path, and a disk that refuses the
	 * file throws out of the transaction and takes both rows back with it. A commit that fails after
	 * the file is written leaves a file no row names, which the sweep takes (ADL A68), the state
	 * {@code MePhotoApi} already accepts by the same reasoning.
	 *
	 * <p><b>Its circle is the whole picture</b> ({@code 0.5}, {@code 0.5}, {@code 1}), the values V21
	 * gave every picture that stood before the circle existed: a proof is not cut (P11), and the columns
	 * are not null. A decision about the row names this circle beside the key
	 * ({@code VerificationWriteApi}: a decision about a row that holds a picture names the picture the
	 * moderator saw), and nothing ever moves it.
	 */
	private void queue(long me, long submission, String subject, String comment, ThePicture picture) {
		Long photo = picture == null ? null : db.sql("insert into photo (media_type, byte_size, digest,"
						+ " crop_x, crop_y, crop_diameter) values (?, ?, ?, 0.5, 0.5, 1) returning id")
				.params(picture.mediaType(), picture.bytes().length,
						WhatAPictureIs.digestOf(picture.bytes()))
				.query(Long.class)
				.single();

		db.sql("insert into verification (queue, competitor_id, subject, body,"
						+ " result_submission_id, photo_id) values (?, ?, ?, ?, ?, ?)")
				.params(RESULTS, me, subject, orEmpty(comment), submission, photo)
				.update();

		if (photo != null) {
			try {
				Files.createDirectories(folder);
				Files.write(folder.resolve(String.valueOf(photo)), picture.bytes(),
						StandardOpenOption.CREATE_NEW, StandardOpenOption.WRITE);
			} catch (IOException notWritten) {
				throw new UncheckedIOException(notWritten);
			}
		}
	}

	/**
	 * WHAT A REQUEST CARRIED, IN EITHER OF ITS TWO SHAPES.
	 *
	 * <p>A JSON body is read as it always was ({@link WhatWasSent}). A body with a picture carries
	 * the same JSON as its part {@code run}, read by the same reader ({@link WhatWasSent#readFrom}), and
	 * the file as its part
	 * {@code picture}. A part {@code run} that is absent or not JSON is a body that is not JSON: a
	 * form not filled in. A part {@code picture} that is empty is no picture, which is what a browser
	 * sends for a file box nobody filled.
	 *
	 * <p><b>The picture is judged here, in {@link TeamLogoApi}'s order</b>: the size asked of the part
	 * before its bytes are read, then the type by the bytes and never by the header or the name of the
	 * file (neither {@link MultipartFile#getContentType} nor {@link MultipartFile#getOriginalFilename} is
	 * read anywhere in this class), then the metadata taken off, so what is stored, counted and hashed is
	 * the picture without where it was taken.
	 */
	private <T> Carried<T> whatCameWith(WhatWasSent<T> sent, HttpServletRequest request) throws IOException {
		MultipartHttpServletRequest parts =
				WebUtils.getNativeRequest(request, MultipartHttpServletRequest.class);

		if (parts == null) {
			return new Carried<>(sent.read(), null, null);
		}

		String run = parts.getParameter("run");
		T body = run == null ? null : sent.readFrom(run);
		MultipartFile picture = parts.getFile("picture");

		if (picture == null || picture.isEmpty()) {
			return new Carried<>(body, null, null);
		}

		if (picture.getSize() > WhatAPictureIs.AT_MOST_BYTES) {
			return new Carried<>(body, null, no(THE_PICTURE_IS_TOO_BIG));
		}

		byte[] bytes = picture.getBytes();
		String mediaType = WhatAPictureIs.sniff(bytes);

		if (mediaType == null) {
			return new Carried<>(body, null, no(THIS_IS_NOT_A_PICTURE));
		}

		return new Carried<>(body, new ThePicture(mediaType, WithoutMetadata.of(bytes, mediaType)), null);
	}


	/**
	 * THE RESULT, IF IT IS HIS.
	 *
	 * <p>Whose it is stands in the {@code where} rather than in a condition after it, so a
	 * result belonging to somebody else and a result that is not there are one answer.
	 */
	private Optional<Counted> his(long id, long me) {
		return db.sql("select r.id, r.race_id, r.race_date, ra.name, r.distance_km, r.ascent_m,"
						+ " r.descent_m, r.seconds, r.points,"
						+ " exists(select 1 from scored_race s where s.id = r.race_id)"
						+ " from result r join race ra on ra.id = r.race_id"
						+ " where r.id = ? and r.competitor_id = ?")
				.params(id, me)
				.query((row, one) -> new Counted(row.getLong(1), row.getLong(2),
						row.getDate(3).toLocalDate(), row.getString(4), row.getBigDecimal(5),
						row.getInt(6), row.getInt(7), row.getInt(8), row.getBigDecimal(9),
						row.getBoolean(10)))
				.optional();
	}

	private Optional<TheRace> raceOf(long id) {
		return db.sql("select id, name, date, kind, limit_seconds, distance_km, ascent_m,"
						+ " descent_m from race where id = ?")
				.param(id)
				.query((row, one) -> new TheRace(row.getLong(1), row.getString(2),
						row.getDate(3).toLocalDate(), row.getString(4), row.getInt(5),
						row.getBigDecimal(6), row.getInt(7), row.getInt(8)))
				.optional();
	}

	/**
	 * A LINE IN HIS INBOX, carrying the very words the message carries.
	 *
	 * <p>{@link VerificationWriteApi}'s own shape, and the reason it gives applies here
	 * unchanged: {@code message.to_id} left empty means EVERYBODY (V13), so this is always
	 * addressed, and the member it names is the one whose result it is about.
	 */
	private void tell(long me, Said said) {
		db.sql("insert into message (to_id, from_id, from_name, subject, body)"
						+ " values (?, null, ?, ?, ?)")
				.params(me, THE_PORTAL, said.subject(), said.body())
				.update();
	}

	/**
	 * THE MESSAGE, SENT AFTER THE COMMIT AND THEREFORE UNABLE TO UNDO IT, TO HIM AND WITH
	 * NOBODY COPIED.
	 *
	 * <p><b>Nobody copied, and that is the owner's exception to the league's copy rather than
	 * an omission.</b> Both callers are the member acting on his own result - a correction and
	 * a deletion - and PDL P9, 25.09.2026, „Skrivena kopija ligi NE ide kad clan sam menja ili
	 * brise svoj rezultat" (see the class note). A run sent in does not come here at all.
	 *
	 * <p>{@link RegistrationApi}'s decision, made again here because it is a different
	 * answer for a different route and is supposed to be: a relay that will not take it is
	 * not something the member can act on. His correction IS in the queue, his deletion HAS
	 * happened - and the record survives in his inbox, which is written inside the transaction
	 * above precisely so that a relay having a bad afternoon does not cost the league its
	 * record. Answering 500 would say „nothing happened" to somebody for whom everything did,
	 * and would have him send it a second time.
	 *
	 * <p><b>The address is read off the account that is asking</b>, never off anything in the
	 * request, and {@code account_competitor_unique} (V23) is what makes „his address" one
	 * row rather than a question.
	 *
	 * <p><b>What is logged is the account and never the address</b>, which is
	 * {@link RegistrationApi}'s rule and ADL A12's reason: an address is a personal datum and
	 * a log is read by whoever can read the disk.
	 */
	private void post(long account, Recipient him, Said said) {
		try {
			postman.send(said, him.address());
		} catch (MailException theRelayDidNotTakeIt) {
			LOG.warn("the message about the result of account {} did not go out; what it said is"
					+ " in his inbox and the row is written either way", account,
					theRelayDidNotTakeIt);
		}
	}

	/**
	 * WHERE HIS LETTER GOES AND WHICH LANGUAGE IT IS WRITTEN IN, read in one statement off the
	 * account that is asking.
	 *
	 * <p>Both halves of one row, so the language cannot be anybody's but the reader's: the
	 * member who corrects or deletes his own result IS the one the letter goes to, and nothing
	 * in the request names either. Read before the letter is built, because the same
	 * {@link Said} goes into his inbox inside the transaction and to the relay after it.
	 */
	private Recipient recipient(long account) {
		return db.sql("select a.email, a.mail_language, c.gender from account a"
				+ " join competitor c on c.id = a.competitor_id where a.id = ?")
				.param(account)
				.query(ResultWriteApi::aRecipient)
				.single();
	}

	private static Recipient aRecipient(java.sql.ResultSet row, int one) throws java.sql.SQLException {
		return new Recipient(row.getString(1), MailLanguage.ofTheColumn(row.getString(2)),
				Gender.ofTheColumn(row.getString(3)));
	}

	/**
	 * An address, the language of what is written to it and the sex of who reads it, off one row of
	 * {@code account} and the member it belongs to (owner, 21.11.2026: the words follow the sex of the
	 * reader, which the registration asked for). Every member who sends a result has an account that
	 * names him (V23), so the join loses nobody who can reach this code.
	 */
	private record Recipient(String address, MailLanguage language, Gender gender) {
	}

	/** What the proof rule is asked about: the link, whether a picture came that is a picture, and
	 *  the comment (see the class note on the picture). */
	private static Report report(String link, boolean aPicture, String comment) {
		return new Report(link, aPicture, comment);
	}

	private ResponseEntity<?> whatIsWrongWithTheProof(String link, boolean aPicture, String comment) {
		Outcome outcome = ProofThatTheRunHappened.decide(report(link, aPicture, comment));

		return outcome == Outcome.GOOD ? null : no(WHY_NOT.get(outcome));
	}

	/** The points, from the one place that answers for them and never from a request: the formula of the
	 *  kind of race the run is at ({@link PointsOfARun#of}), which the caller asks whether to tell. */
	private static BigDecimal pointsFor(String raceKind, BigDecimal distanceKm, int ascentM, int descentM,
			int seconds) {
		return PointsOfARun.of(true, raceKind, new Figures(distanceKm, ascentM, descentM, seconds));
	}

	/** Today in the league's own zone, never the machine's: a server kept in UTC would call a
	 *  race run this morning in Belgrade a race in the future for the first hour of the day. */
	private LocalDate today() {
		return LocalDate.now(clock.withZone(SeasonClock.ZONE));
	}

	/** The moment the window of the seasons is asked at; the window reads it in the league's zone. */
	private ZonedDateTime now() {
		return ZonedDateTime.now(clock);
	}

	/** Absent, blank and a run of spaces are one state, {@link TeamWriteApi#isNothing}'s own
	 *  reasoning: a guard written against one shape of „not there" lets the others through to
	 *  a column whose {@code check} refuses them as a server fault instead of an answer. */
	private static boolean isNothing(String value) {
		return value == null || value.isBlank();
	}

	/**
	 * NOT A LENGTH ANYBODY RAN, AND THE THREE WAYS OF NOT BEING ONE ARE ONE ANSWER.
	 *
	 * <p>Each of the three is a {@code check} the table would fire on, turned into a 400
	 * before it can be a 500: {@code result_submission_distance_positive} refuses nought and
	 * below, {@code numeric(8,4)} refuses anything past 9999,9999 - and the third is not a
	 * refusal at all but a SILENT rounding, which is the worst of the three. PostgreSQL does
	 * not throw a fifth decimal out, it rounds it, so 42,19501 would be stored as 42,1950 and
	 * the portal would carry a length nobody entered. {@link WhatARaceCarries} already answers
	 * that question for {@code race.distance_km} - the same scale since V31 - so it is asked
	 * there rather than counted again here.
	 *
	 * <p><b>Package-private and not private, together with the two below</b>, because a
	 * moderator who puts his own figures in place of the runner's at approval
	 * ({@link VerificationWriteApi}) writes into the same columns under the same checks, and a
	 * second copy of these three would be a second answer to „is this a run".
	 */
	static boolean notADistance(BigDecimal value) {
		return value == null || value.signum() <= 0
				|| value.compareTo(WhatARaceCarries.mostADistanceCanBe()) > 0
				|| !WhatARaceCarries.distanceIsKeptExactly(value);
	}

	/** {@code result_submission_ascent_not_negative} and its twin: nought is a real climb and
	 *  a flat race has one, so this refuses only what is missing or below it. */
	static boolean notAClimb(Integer value) {
		return value == null || value < 0;
	}

	/** {@code result_submission_seconds_positive}, and it is NOT the same rule as the climb
	 *  above: nought metres of ascent is a flat race, and nought seconds is not a run. */
	static boolean notATime(Integer value) {
		return value == null || value <= 0;
	}

	/** {@code result_submission.comment} is {@code not null} and may be empty (V10). */
	private static String orEmpty(String value) {
		return value == null ? "" : value.strip();
	}

	/**
	 * The answer for somebody an open address is not for, which carries nothing at all -
	 * {@link CommentWriteApi#away}'s shape and its reason: there is nothing decided to put
	 * in a body.
	 *
	 * <p>Only {@link #report} uses it: its address is one {@link ApiSecurity#READ_BY_ANYBODY} opens,
	 * {@code OPTIONS} there already says that a write lives at it ({@link ApiSecurity}, 18.09.2026),
	 * and {@link TeamWriteApi#awayAtAnOpenAddress} says why nothing is left for the shape of this 404
	 * to hide. The routes that take a key answer through {@link #nothingIsHere}.
	 */
	private static ResponseEntity<?> awayAtAnOpenAddress() {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
	}

	/**
	 * THE ANSWER FOR SOMEBODY AN ADDRESS WITH A KEY IN IT IS NOT FOR, which carries nothing at all.
	 *
	 * <p><b>IT GOES DOWN THE ROAD AN ADDRESS THAT MAPS NOTHING GOES DOWN, AND THE CALLER THROWS
	 * IT.</b> A status written onto the response comes back with {@code Content-Length: 0}, while an
	 * address that maps nothing comes back as the container's error document, chunked: over a real
	 * socket that is 262 bytes against more than 380, and it is an oracle for whether a route lives at
	 * this address, one request per guess ({@link RightsAtTheDoor} measured it).
	 * {@link ResponseStatusException} is answered by {@code sendError}, one call into the machinery an
	 * unmapped address already uses and not an imitation of it. It is thrown and not returned because
	 * this is asked from inside transaction callbacks, where there is no response to hand. It is made
	 * here and thrown at the call site and not thrown from this method, because the coverage report
	 * counts a line whose call never comes back as not run: measured, a method that always throws left
	 * every {@code return} that called it uncovered, and the gate refuses anything under a hundred per
	 * cent. Every refusal here is decided before the first write, so the rollback the exception causes
	 * undoes nothing. {@code AWordInAKeyOverRealHttpTest} compares the bytes with the twin's, for every
	 * kind of caller.
	 */
	private static ResponseStatusException nothingIsHere() {
		return new ResponseStatusException(HttpStatus.NOT_FOUND);
	}

	private static ResponseEntity<?> no(String reason) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new Refused(reason));
	}

	/**
	 * A result as it stands today, which is the old value the message has to carry.
	 *
	 * @param scored whether its race is a scored one ({@code scored_race}, V99): the message about a run of
	 *               an unscored race names no points (PointsOfARun#toTell)
	 */
	private record Counted(long id, long raceId, LocalDate day, String raceName,
			BigDecimal distanceKm, int ascentM, int descentM, int seconds, BigDecimal points,
			boolean scored) {

		Run run() {
			return new Run(raceName, day, distanceKm, ascentM, descentM, seconds,
					PointsOfARun.toTell(scored, points));
		}
	}

	/** A race as the calendar holds it, with everything it might answer for. */
	private record TheRace(long id, String name, LocalDate day, String kind, int limitSeconds,
			BigDecimal distanceKm, int ascentM, int descentM) {

		/** The part of it {@link WhatARaceCarries#figuresOf} asks about. */
		WhatARaceCarries.ARace fixes() {
			return new WhatARaceCarries.ARace(kind, distanceKm, ascentM, descentM, limitSeconds);
		}
	}
}
