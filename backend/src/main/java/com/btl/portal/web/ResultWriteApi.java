package com.btl.portal.web;

import com.btl.portal.domain.event.WhatARaceCarries;
import com.btl.portal.domain.mail.WhatAResultChangeSays;
import com.btl.portal.domain.mail.WhatAResultChangeSays.Run;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.result.ProofThatTheRunHappened;
import com.btl.portal.domain.result.ProofThatTheRunHappened.Outcome;
import com.btl.portal.domain.result.ProofThatTheRunHappened.Report;
import com.btl.portal.domain.scoring.BtlScoreCalculator;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.mail.Postman;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
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
 * <p><b>TWO OF THE SIX MANDATORY MESSAGES LIVE HERE.</b> PDL P22, 11.08.2026: „Sest
 * obaveznih mejlova u prvoj verziji: kreiranje naloga i potvrda mejla, promena lozinke,
 * UNET REZULTAT, PROMENJEN REZULTAT, dodatni zahtev za verifikaciju, krupna izmena na
 * portalu", and „Sest mejlova iz spiska su obavezni i clan ih ne moze iskljuciti." There
 * is no switch consulted anywhere below, and there is no column to consult: V13 gives
 * {@code notification_setting} six columns for the six OPTIONAL messages and says in its
 * own words why the mandatory six have none - „a column for them would be a promise the
 * portal must refuse to keep."
 *
 * <p><b>AND THE THIRD MESSAGE, THE ONE FOR A DELETION, IS NOT AN EXTRA.</b> Same
 * decision: „Isto obavestenje ide i kad se obrise verifikovan rezultat i kad masovni uvoz
 * pregazi postojeci. Bez ove dve stavke, brisanje i uvoz postaju nacin da se rezultat
 * promeni bez traga, pa cela mera ne vredi nista." Deleting is the cheapest way to change
 * a result without leaving a trace, and that is the hole this closes.
 *
 * <p><b>THE SAME MESSAGE GOES THREE PLACES AND IS BUILT ONCE.</b> „Skrivena kopija svakog
 * takvog obavestenja ide na administrativnu adresu lige, i ista poruka ide u portalski
 * inboks." One {@link Said}, handed to {@link Postman} with the league blind-copied and
 * written into {@code message} - rather than a second wording for the inbox, which is how
 * two copies of one record come to disagree. What decides the words is
 * {@link WhatAResultChangeSays} and not this class.
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
 * on its kind, and {@link #figuresOf} is the one place that decides it - called from both
 * writers rather than boxed by each in its own words, so they cannot come to answer
 * „whose figure is this" two different ways. A race of a LENGTH fixes the distance, the
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
 * <p><b>WHAT IS DELIBERATELY NOT HERE, each named rather than left to be found.</b>
 *
 * <ul>
 * <li><b>A photograph.</b> {@link ProofThatTheRunHappened} knows about one because the
 * forms do, and nothing on this server can receive one: there is no {@code insert into
 * photo} anywhere in {@code src/main} and no upload route of any kind. So the report handed
 * to that class always says there is none, and the day an upload exists is the day this
 * line changes - written down here rather than discovered by whoever writes it.
 * <li><b>Whether the member's fee is current.</b> {@link CommentWriteApi} met the identical
 * question and wrote out at length why no write on this server gates on
 * {@code competitor.active}; gating here alone would be one route enforcing a portal-wide
 * decision by itself. {@link ResultApi} already withholds the running season of a lapsed
 * member from every READER, which is the half that was decided (PDL P11).
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

	/** PDL, owner, 11.08.2026: „Ne sme, ne moze biti rezultata u buducnosti." The day of the
	 *  race itself counts as run, the same comparison {@link CommentWriteApi} makes for a
	 *  rating and for the owner's own reason. */
	static final String THE_RACE_HAS_NOT_BEEN_RUN = "theRaceHasNotBeenRun";

	/** The request both picks a race out of the calendar and describes one. V10 holds the two
	 *  apart with a biconditional, so there is no row that could be written from it. */
	static final String THE_RACE_IS_NAMED_TWICE = "theRaceIsNamedTwice";

	/**
	 * WHY A REPORT IS NOT READY, IN THE PORTAL'S OWN WORDS, AND IT IS A MAP RATHER THAN A
	 * {@code switch}.
	 *
	 * <p>A {@code switch} would carry a branch for
	 * {@link Outcome#A_PHOTOGRAPH_NEVER_STANDS_ALONE} that nothing can reach, because no
	 * photograph can arrive at this server at all (see the class note) - an arm that is
	 * dead, that coverage cannot forgive, and that would be deleted by whoever met it next
	 * without knowing it is waiting for an upload route.
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

	private final MemberOfAccount memberOfAccount;

	private final Postman postman;

	/** The league's own address, which the blind copy goes to (PDL P22). Configured rather
	 *  than written here for the reason {@code application.properties} gives beside it. */
	private final String theLeague;

	/** The bean and never {@code LocalDate.now()}, so „a race in the future" is something a
	 *  case can state instead of wait for ({@code WhatTimeItIs}). */
	private final Clock clock;

	/** Written by hand rather than left on the method, {@link CommentWriteApi}'s own choice
	 *  and its measured reason: a submission and the queue row that carries it are one
	 *  thing, and {@code @Transactional} would let a test go on passing while the second
	 *  statement silently never ran. */
	private final TransactionTemplate inOneTransaction;

	ResultWriteApi(JdbcClient db, MemberOfAccount memberOfAccount, Postman postman,
			@Value("${btl.mail.league}") String theLeague, Clock clock,
			TransactionTemplate inOneTransaction) {
		this.db = db;
		this.memberOfAccount = memberOfAccount;
		this.postman = postman;
		this.theLeague = theLeague;
		this.clock = clock;
		this.inOneTransaction = inOneTransaction;
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
	 */
	record Ran(Long raceId, String raceName, LocalDate day, String raceKind, Long placeId,
			String city, String country, BigDecimal distanceKm, Integer ascentM, Integer descentM,
			Integer seconds, String link, String comment) {
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
	@PostMapping(path = "/api/results", consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<?> report(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@RequestBody Ran typed) {
		Long me = memberOfAccount.competitorId(asking.account());

		if (me == null) {
			return away();
		}

		ResponseEntity<?> proof = whatIsWrongWithTheProof(typed.link(), typed.comment());

		if (proof != null) {
			return proof;
		}

		return typed.raceId() == null ? described(asking, me, typed) : fromTheCalendar(asking, me, typed);
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
	 * <p><b>The four figures go through {@link #figuresOf}</b>, the very function
	 * {@link #fromTheCalendar} calls, so which of them is the member's to correct still
	 * depends on what the race fixes (see the class note) - a correction does not get a
	 * second, looser answer to that question just for being a correction.
	 */
	@PutMapping(path = "/api/results/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
	ResponseEntity<?> change(@AuthenticationPrincipal WhoIsAsking.Member asking,
			@PathVariable long id, @RequestBody Correction typed) {
		Long me = memberOfAccount.competitorId(asking.account());

		if (me == null) {
			return away();
		}

		Optional<Counted> standing = his(id, me);

		if (standing.isEmpty()) {
			return away();
		}

		ResponseEntity<?> proof = whatIsWrongWithTheProof(typed.link(), typed.comment());

		if (proof != null) {
			return proof;
		}

		/* THE RACE ANSWERS FOR WHAT IT FIXES HERE TOO (see the class note). `result_race_fk`
		   cascades on the result this row corrects, so the race it names cannot have been
		   deleted out from under it and `orElseThrow` never actually throws. */
		Counted before = standing.get();
		TheRace race = raceOf(before.raceId()).orElseThrow();
		Figures figures = figuresOf(race, typed.distanceKm(), typed.ascentM(), typed.descentM(),
				typed.seconds());

		if (notADistance(figures.distanceKm()) || notAClimb(figures.ascentM())
				|| notAClimb(figures.descentM()) || notATime(figures.seconds())) {
			return no(THE_FORM_IS_NOT_COMPLETE);
		}

		Run after = new Run(before.raceName(), before.day(), figures.distanceKm(),
				figures.ascentM(), figures.descentM(), figures.seconds(), pointsFor(
						figures.distanceKm(), figures.ascentM(), figures.descentM(),
						figures.seconds()));

		Said said = WhatAResultChangeSays.changed(before.run(), after);

		Long made = inOneTransaction.execute(committing -> {
			long submission = writeTheSubmission(me, before.raceId(), before.day(), null, null,
					null, null, null, after, typed.link(), typed.comment(), id);

			queue(me, submission, before.raceName(), typed.comment());
			tell(me, said);

			return submission;
		});

		post(asking.account(), said);

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
			@PathVariable long id) {
		Long me = memberOfAccount.competitorId(asking.account());

		if (me == null) {
			return away();
		}

		Optional<Counted> standing = his(id, me);

		if (standing.isEmpty()) {
			return away();
		}

		Said said = WhatAResultChangeSays.deleted(standing.get().run());

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
			db.sql("delete from result where id = ? and competitor_id = ?").params(id, me).update();
			tell(me, said);
		});

		post(asking.account(), said);

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
	private ResponseEntity<?> fromTheCalendar(WhoIsAsking.Member asking, long me, Ran typed) {
		if (typed.raceName() != null || typed.raceKind() != null || typed.placeId() != null
				|| typed.city() != null || typed.country() != null) {
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

		Figures figures = figuresOf(race, typed.distanceKm(), typed.ascentM(), typed.descentM(),
				typed.seconds());

		if (notADistance(figures.distanceKm()) || notAClimb(figures.ascentM())
				|| notAClimb(figures.descentM()) || notATime(figures.seconds())) {
			return no(THE_FORM_IS_NOT_COMPLETE);
		}

		Run run = new Run(race.name(), race.day(), figures.distanceKm(), figures.ascentM(),
				figures.descentM(), figures.seconds(), pointsFor(figures.distanceKm(),
						figures.ascentM(), figures.descentM(), figures.seconds()));

		return write(asking, me, typed.raceId(), race.day(), null, null, null, null, null, run,
				typed, race.name());
	}

	/**
	 * WHICH FOUR FIGURES A RUN CARRIES, ASKED OF THE RACE EXACTLY ONCE FOR BOTH WRITERS.
	 *
	 * <p>{@link #fromTheCalendar} and {@link #change} both call this rather than each
	 * boxing the race's side by hand, which is the whole of what the class note above
	 * means by „they cannot come to answer the question two different ways": one function
	 * decides it now, not two that could drift apart. A race of a length gives the three
	 * it measured; a race to a limit gives the time, because on such a race the time is
	 * the same for everyone who finished and it is what the formula scores it against; a
	 * free race gives neither, so every figure below is the request's own (owner,
	 * 29.08.2026).
	 *
	 * <p><b>THE RACE'S SIDE IS BOXED BY HAND, AND THAT IS NOT STYLE - IT WAS A 500.</b>
	 * Written {@code ofALength ? race.ascentM() : typedAscentM}, with an {@code int} on
	 * one side and an {@code Integer} on the other, Java promotes: the conditional UNBOXES
	 * the typed value before anything looks at it, so a form with no climb in it threw a
	 * NullPointerException here, before the guard after this call could answer 400.
	 * Measured on three of the four figures at once
	 * ({@code everyWayARunOnAFreeRaceCanFailToHoldTogether}); the length was safe only
	 * because both of its sides are already {@code BigDecimal}.
	 */
	private static Figures figuresOf(TheRace race, BigDecimal typedDistanceKm,
			Integer typedAscentM, Integer typedDescentM, Integer typedSeconds) {
		boolean ofALength = WhatARaceCarries.OF_A_LENGTH.equals(race.kind());
		boolean toALimit = WhatARaceCarries.TO_A_LIMIT.equals(race.kind());

		return new Figures(
				ofALength ? race.distanceKm() : typedDistanceKm,
				ofALength ? Integer.valueOf(race.ascentM()) : typedAscentM,
				ofALength ? Integer.valueOf(race.descentM()) : typedDescentM,
				toALimit ? Integer.valueOf(race.limitSeconds()) : typedSeconds);
	}

	/** The four figures {@link #figuresOf} decides between the race and the request. */
	private record Figures(BigDecimal distanceKm, Integer ascentM, Integer descentM,
			Integer seconds) {
	}

	/**
	 * A RUN ON A RACE THE CALENDAR DOES NOT HOLD: THE MEMBER ANSWERS FOR ALL OF IT.
	 *
	 * <p>PDL: „Clan sme da unese trku koje nema u kalendaru. Tada administrator kreira
	 * dogadjaj i trku uz rezultat, i sve troje nastaje istovremeno." So everything the
	 * approval will need to make an event and a race out of is collected here, at the one
	 * moment somebody knows it - which is V10's own reason for these columns.
	 */
	private ResponseEntity<?> described(WhoIsAsking.Member asking, long me, Ran typed) {
		/* THE KIND IS ASKED FOR ITSELF BEFORE THE CODEBOOK IS ASKED ABOUT IT, and that too
		   was a 500: `WhatARaceCarries.KINDS` is a `Set.of(...)`, and an immutable set THROWS
		   on `contains(null)` rather than answering false. So a form that never chose a kind
		   answered a server fault instead of „the form is not complete". */
		if (isNothing(typed.raceName()) || typed.day() == null || typed.raceKind() == null
				|| !WhatARaceCarries.KINDS.contains(typed.raceKind())
				|| notADistance(typed.distanceKm()) || notAClimb(typed.ascentM())
				|| notAClimb(typed.descentM()) || notATime(typed.seconds())) {
			return no(THE_FORM_IS_NOT_COMPLETE);
		}

		ResponseEntity<?> town = whatIsWrongWithTheTown(typed);

		if (town != null) {
			return town;
		}

		if (typed.day().isAfter(today())) {
			return no(THE_RACE_HAS_NOT_BEEN_RUN);
		}

		boolean fromTheCodebook = typed.placeId() != null;
		String named = typed.raceName().strip();

		Run run = new Run(named, typed.day(), typed.distanceKm(), typed.ascentM(),
				typed.descentM(), typed.seconds(),
				pointsFor(typed.distanceKm(), typed.ascentM(), typed.descentM(), typed.seconds()));

		return write(asking, me, null, typed.day(), named, typed.raceKind(),
				fromTheCodebook ? placeKey(typed.placeId()).orElseThrow() : null,
				fromTheCodebook ? null : typed.city().strip(),
				fromTheCodebook ? null : countryKey(typed.country()).orElseThrow(),
				run, typed, named);
	}

	/**
	 * THE TOWN, EXACTLY ONE WAY AND BY THE NUMBER THE PORTAL REALLY PUBLISHES.
	 *
	 * <p><b>This is {@link EventWriteApi#whatIsWrongWithTheTown} word for word, and copying it
	 * is the instruction rather than the shortcut.</b> The owner, 11.08.2026: „Mesto i drzava
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

		if (isNothing(typed.country())) {
			return no(EventWriteApi.A_TYPED_TOWN_NAMES_ITS_COUNTRY);
		}

		return countryKey(typed.country()).isPresent() ? null
				: no(EventWriteApi.THE_COUNTRY_IS_NOT_KNOWN);
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

	/** The writing, which is one transaction from the submission to the queue row and the
	 *  line in his inbox, and the message after it has committed. */
	private ResponseEntity<?> write(WhoIsAsking.Member asking, long me, Long raceId, LocalDate day,
			String raceName, String raceKind, Long theTownsKey, String city, Long theCountrysKey,
			Run run, Ran typed, String subject) {
		Said said = WhatAResultChangeSays.entered(run);

		Long made = inOneTransaction.execute(committing -> {
			long submission = writeTheSubmission(me, raceId, day, raceName, raceKind, theTownsKey,
					city, theCountrysKey, run, typed.link(), typed.comment(), null);

			queue(me, submission, subject, typed.comment());
			tell(me, said);

			return submission;
		});

		post(asking.account(), said);

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
	 */
	private long writeTheSubmission(long me, Long raceId, LocalDate day, String raceName,
			String raceKind, Long theTownsKey, String city, Long theCountrysKey, Run run,
			String link, String comment, Long amends) {
		return db.sql("insert into result_submission (competitor_id, race_id, race_date,"
						+ " race_name, race_kind, place_id, city, country_id, distance_km,"
						+ " ascent_m, descent_m, seconds, link, comment, amends_result_id)"
						+ " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) returning id")
				.params(me, raceId, day, raceName, raceKind, theTownsKey, city, theCountrysKey,
						run.distanceKm(), run.ascentM(), run.descentM(), run.seconds(),
						ProofThatTheRunHappened.linkAsItGoesIn(report(link, comment)),
						orEmpty(comment), amends)
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
	private void queue(long me, long submission, String subject, String comment) {
		db.sql("insert into verification (queue, competitor_id, subject, body,"
						+ " result_submission_id) values (?, ?, ?, ?, ?)")
				.params(RESULTS, me, subject, orEmpty(comment), submission)
				.update();
	}

	/**
	 * THE RESULT, IF IT IS HIS.
	 *
	 * <p>Whose it is stands in the {@code where} rather than in a condition after it, so a
	 * result belonging to somebody else and a result that is not there are one answer.
	 */
	private Optional<Counted> his(long id, long me) {
		return db.sql("select r.id, r.race_id, r.race_date, ra.name, r.distance_km, r.ascent_m,"
						+ " r.descent_m, r.seconds, r.points"
						+ " from result r join race ra on ra.id = r.race_id"
						+ " where r.id = ? and r.competitor_id = ?")
				.params(id, me)
				.query((row, one) -> new Counted(row.getLong(1), row.getLong(2),
						row.getDate(3).toLocalDate(), row.getString(4), row.getBigDecimal(5),
						row.getInt(6), row.getInt(7), row.getInt(8), row.getBigDecimal(9)))
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
	 * THE MESSAGE, SENT AFTER THE COMMIT AND THEREFORE UNABLE TO UNDO IT, WITH THE LEAGUE
	 * COPIED IN BLIND.
	 *
	 * <p>{@link RegistrationApi}'s decision, made again here because it is a different
	 * answer for a different route and is supposed to be: a relay that will not take it is
	 * not something the member can act on. His result IS reported, his correction IS in the
	 * queue, his deletion HAS happened - and the record survives in his inbox, which is
	 * written inside the transaction above precisely so that a relay having a bad afternoon
	 * does not cost the league its record. Answering 500 would say „nothing happened" to
	 * somebody for whom everything did, and would have him send it a second time.
	 *
	 * <p><b>The address is read off the account that is asking</b>, never off anything in the
	 * request, and {@code account_competitor_unique} (V23) is what makes „his address" one
	 * row rather than a question.
	 *
	 * <p><b>What is logged is the account and never the address</b>, which is
	 * {@link RegistrationApi}'s rule and ADL A12's reason: an address is a personal datum and
	 * a log is read by whoever can read the disk.
	 */
	private void post(long account, Said said) {
		String to = db.sql("select email from account where id = ?")
				.param(account)
				.query(String.class)
				.single();

		try {
			postman.send(said, to, theLeague);
		} catch (MailException theRelayDidNotTakeIt) {
			LOG.warn("the message about the result of account {} did not go out; what it said is"
					+ " in his inbox and the row is written either way", account,
					theRelayDidNotTakeIt);
		}
	}

	/** What the proof rule is asked about, and the photograph is always absent - see the
	 *  class note on why, and on what changes the day an upload route exists. */
	private static Report report(String link, String comment) {
		return new Report(link, false, comment);
	}

	private ResponseEntity<?> whatIsWrongWithTheProof(String link, String comment) {
		Outcome outcome = ProofThatTheRunHappened.decide(report(link, comment));

		return outcome == Outcome.GOOD ? null : no(WHY_NOT.get(outcome));
	}

	/** The points, from the one place that answers for them and never from a request. */
	private static BigDecimal pointsFor(BigDecimal distanceKm, int ascentM, int descentM,
			int seconds) {
		return BtlScoreCalculator.calculate(distanceKm.doubleValue(), ascentM, descentM, seconds);
	}

	/** Today in the league's own zone, never the machine's: a server kept in UTC would call a
	 *  race run this morning in Belgrade a race in the future for the first hour of the day. */
	private LocalDate today() {
		return LocalDate.now(clock.withZone(SeasonClock.ZONE));
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
	 */
	private static boolean notADistance(BigDecimal value) {
		return value == null || value.signum() <= 0
				|| value.compareTo(WhatARaceCarries.mostADistanceCanBe()) > 0
				|| !WhatARaceCarries.distanceIsKeptExactly(value);
	}

	/** {@code result_submission_ascent_not_negative} and its twin: nought is a real climb and
	 *  a flat race has one, so this refuses only what is missing or below it. */
	private static boolean notAClimb(Integer value) {
		return value == null || value < 0;
	}

	/** {@code result_submission_seconds_positive}, and it is NOT the same rule as the climb
	 *  above: nought metres of ascent is a flat race, and nought seconds is not a run. */
	private static boolean notATime(Integer value) {
		return value == null || value <= 0;
	}

	/** {@code result_submission.comment} is {@code not null} and may be empty (V10). */
	private static String orEmpty(String value) {
		return value == null ? "" : value.strip();
	}

	/** The answer for somebody this address is not for, which carries nothing at all -
	 *  {@link CommentWriteApi#away}'s shape and its reason: there is nothing decided to put
	 *  in a body. */
	private static ResponseEntity<?> away() {
		return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
	}

	private static ResponseEntity<?> no(String reason) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new Refused(reason));
	}

	/** A result as it stands today, which is the old value the message has to carry. */
	private record Counted(long id, long raceId, LocalDate day, String raceName,
			BigDecimal distanceKm, int ascentM, int descentM, int seconds, BigDecimal points) {

		Run run() {
			return new Run(raceName, day, distanceKm, ascentM, descentM, seconds, points);
		}
	}

	/** A race as the calendar holds it, with everything it might answer for. */
	private record TheRace(long id, String name, LocalDate day, String kind, int limitSeconds,
			BigDecimal distanceKm, int ascentM, int descentM) {
	}
}
