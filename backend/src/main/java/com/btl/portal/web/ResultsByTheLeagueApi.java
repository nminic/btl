package com.btl.portal.web;

import com.btl.portal.domain.category.Category;
import com.btl.portal.domain.event.EventAddress;
import com.btl.portal.domain.event.WhatAnEventCarries;
import com.btl.portal.domain.event.WhatARaceCarries;
import com.btl.portal.domain.event.WhatARaceCarries.Figures;
import com.btl.portal.domain.mail.MailLanguage;
import com.btl.portal.domain.mail.WhatAResultChangeSays;
import com.btl.portal.domain.mail.WhatAResultChangeSays.Run;
import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.scoring.BtlScoreCalculator;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.verification.DecidingOnASubmission;
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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * THE LEAGUE ENTERS, CHANGES AND DELETES MEMBERS' RESULTS FROM THE EVENT PAGE, AND WHAT IT
 * ENTERS COUNTS AT ONCE.
 *
 * <p>PDL P9, „Unos rezultata sa strane događaja, za moderatora i administratora (18.10.2026)",
 * the owner's decision: „Moderator i administrator unose, menjaju i brišu rezultate članova sa
 * strane događaja, i ti rezultati su odmah odobreni." In his words: „Klikom na unesi rezultat,
 * očekivano je da unosim rezultate za takmičare koje potvrđujem automatski, pa nema potrebe za
 * slikom, komentarom i sl." So nothing here writes a submission or a queue row: a row of
 * {@code result} is written straight away, as {@link VerificationWriteApi} writes one when it
 * approves, and with no proof attached because none is asked for.
 *
 * <p><b>WHO MAY.</b> „[izabrao uz moju preporuku, 18.10.2026] Unos rezultata sa strane događaja
 * otvara pravo provere rezultata, isto pravo koje danas odobrava rezultate članova." That right is
 * {@code queue:results} (V9 generates it as {@code 'queue:' || queue}), so every route here
 * carries {@link RightIsNeeded} with it and the door answers everybody else: 401 to somebody not
 * signed in, 404 to a member or a moderator without it (ADL A8). The superadmin holds every right.
 * A moderator acting on his OWN result is let through like anybody else, which is my reading of
 * PDL P9, 09.10.2026 („Moderator sme da odluči i o sopstvenoj prijavi rezultata, kao i do sada"):
 * entering his own run is the same power as approving it.
 *
 * <p><b>WHO IS IN THE LIST.</b> „[izabrao uz moju preporuku] U padajućoj listi su svi članovi sa
 * članskim brojem, aktivni i neaktivni, sa pretragom po imenu, prezimenu i broju." {@link #runners}
 * serves exactly that, under the same right: {@code /api/members} serves the same people but under
 * {@code entity:members}, and a moderator who checks results without moderating the members would
 * be answered 404 there.
 *
 * <p><b>WHAT EACH ROW IS MADE OF.</b> The owner: „polja zavisno od vrste trke (ako je dužinska
 * sati minuti sekunde, ako je vremenska kilometraža, uspon, spust, ako je slobodna svih 6
 * parametara". That is exactly {@link WhatARaceCarries#figuresOf}, the one home of „whose figure
 * is this", which the member's report, his correction, the approval and the recount already ask:
 * a figure the race fixes is the race's whatever the request carries. The checks on a figure are
 * {@link ResultWriteApi#notADistance} and its two siblings, package visible for this reason, and
 * the points are {@link BtlScoreCalculator}'s and never a request's.
 *
 * <p><b>SEVERAL ROWS, ONE SAVE, AND NOTHING SAVED IF ONE IS WRONG.</b> „[izabrao uz moju
 * preporuku] Više redova se čuva jednim dugmetom „Sačuvaj”; ako ijedan red nije ispravan, ništa se
 * ne čuva i portal kaže koji red i zašto." Every row is judged before the first one is written, and
 * the answer names each row by its place in what was sent, which is {@link CompetitorWriteApi}'s
 * shape for a group ({@link NotEntered}, {@link Wrong}) and its limit of rows for its reason: a
 * letter goes out per row after the commit.
 *
 * <p><b>WHAT REFUSES A ROW.</b>
 * <ul>
 * <li>A member number nobody holds.
 * <li>A figure the race leaves to the runner that is missing or outside what the column keeps.
 * <li>The same member twice in one save. Both rows are named.
 * <li>A result he already has on this race, by PDL P6, 09.09.2026: „Član ima najviše jedan rezultat
 * na jednoj trci, ali sme imati više rezultata na istom događaju." Derived, not a decision about
 * this route; a result of his on another race of the same event refuses nothing. The schema holds
 * the same rule since V65 ({@code result_one_per_member_on_a_race}), and the member's two roads
 * refuse it too (PDL P6, 18.10.2026: his run is refused when he sends it, and its approval is
 * refused while he has a result on the race).
 * <li>A report or a correction of his that waits for this race: „[izabrao uz moju preporuku,
 * 18.10.2026] Kad za tu trku član već ima prijavu ili ispravku koja čeka, unos se odbija uz
 * rečenicu da član već ima prijavu koja čeka i da je prvo treba odobriti ili odbiti u redu za
 * proveru." One condition answers both, because a correction names the race of the result it
 * corrects (V32, {@code result_submission_a_correction_keeps_the_race_it_corrects}). A run he
 * described off the calendar names no race and refuses nothing: that is a boundary.
 * <li>A race of the CURRENT season and a member who holds no membership of that season:
 * „[izabrao uz moju preporuku, 18.10.2026] Za trku iz TEKUĆE sezone liga unosi rezultat samo članu
 * koji ima članstvo za tu sezonu; inače se red odbija uz rečenicu. Za prošle godine i pre 2027
 * ostaje unos svima sa članskim brojem." The season is the RACE's year, and the current one is
 * {@link SeasonClock#isTheSeasonBeingRun}: <b>THE OWNER'S DECISION OF 18.10.2026, chosen against my
 * recommendation, makes a season current from its 1 January until its freeze</b> („Sezona je „tekuća"
 * za unos rezultata do svog zamrzavanja, 1.1. sledeće godine u 16:00, ne do ponoći. Do 16:00 unos za
 * trku iz te sezone i dalje traži članstvo za nju. Odbijena moja preporuka da sezona prestane da
 * bude tekuća u ponoć."), so between 00:00 and 16:00 on 1 January both the season that ended and the
 * one that began are current. The membership asked is the row of {@code membership}
 * for exactly that member and exactly that season, never his latest. The owner's reason: for the
 * result of a member whose fee had lapsed in the running season he said „To ne moze da se desi".
 * </ul>
 *
 * <p><b>THE PENCIL DOES NOT ASK FOR THAT MEMBERSHIP, and this is a reading rather than a
 * decision.</b> The owner's sentence is about entering. The pencil changes the figures of a result
 * that is already on the race and can neither name another member nor another race, so it cannot
 * put a non-member into the running season; and a member whose membership was struck out after his
 * result was written would otherwise be left with a row only the X could touch. The X is open to
 * everybody for the same reason. The owner may object.
 *
 * <p><b>THE PENCIL AND THE X ARE REFUSED BY THE SAME WAITING SUBMISSION</b> (409, the same reason).
 * That is the coordinator's derivation by analogy with the decision above, not the owner's words:
 * left open, an approval of the waiting correction would later write over the league's figures,
 * and a deletion would take the member's waiting correction with it through
 * {@code result_submission_amends_fk} without a word to him. The owner may object.
 *
 * <p><b>THE PENCIL CHANGES THE FIGURES AND NOTHING ELSE.</b> „[izabrao uz moju preporuku,
 * 18.10.2026] Olovka menja samo polja rezultata; trka ostaje ista. Za drugu trku rezultat se briše
 * (x) i unosi ponovo." The body has no field for a race or a member, and the race is in the address
 * and must be the one the result is on, or the result is not there.
 *
 * <p><b>WHAT THE MEMBER IS TOLD, AND WHO ELSE.</b> „[izabrao uz moju preporuku] Za novi unos član
 * dobija istu poruku kao kad mu moderator odobri rezultat, u sanduče i mejlom; izmena i brisanje
 * rade po P22 (mejl sa starom vrednošću i skrivenom kopijom ligi)." So:
 * <ul>
 * <li>Each message is one {@link Said}, written into his inbox inside the transaction and handed to
 * the relay after the commit, the shape {@link ResultWriteApi} and {@link VerificationWriteApi}
 * keep. A relay that refuses is logged; the row is written either way.
 * <li>The letter goes to HIS account's address in HIS account's language and never to the asker's,
 * and the inbox copy is in the same language (PDL P18, 10.10.2026: „u sandučetu kopija
 * rezultatskih poruka prati jezik mejla"). A member with no account gets the inbox line, in
 * Serbian, and no letter.
 * <li>The league is copied in blind on every letter of this road, an entry included, because the
 * approval it equals is copied ({@link VerificationWriteApi#post}). <b>And on the moderator's own
 * result too</b>: the exception of 25.09.2026, „Skrivena kopija ligi NE ide kad član sam menja ili
 * briše svoj rezultat", rests on „Ispravka svakako ide Adminu na odobrenje", and nothing here goes
 * to anybody for approval. That is the coordinator's derivation from P22, not the owner's words.
 * <li>An entry is told with the words of an approval where the season counts it, and with words of
 * its own where it does not: before 2027, or in a year he holds no membership of („Rezultat za datum
 * pre 2027 ili za godinu kad čovek nije bio član ... ne ulazi ni u jednu sezonsku tabelu, Top
 * listu ni nagradu"). A change has words of its own. A run of a season that has FROZEN is told
 * with the owner's sentence for it (PDL P9, 18.10.2026: „Rezultat u ZAMRZNUTOJ sezoni dobija
 * posebnu rečenicu"), asked after the year (a race before 2027 is a race before the league, never
 * a frozen season) and BEFORE the membership: the sentence is true of a member and of a non-member
 * alike, and the owner names no second sentence for the non-member of a frozen season, which is my
 * reading of one decision. The three texts of 18.10.2026 were approved by the owner
 * („Može ovako"), the frozen one is his own sentence set out in lines.
 * </ul>
 *
 * <p><b>THE BEGINNERS' CATEGORY, BOTH WAYS.</b> Whether the category was open to him for the season
 * after the run's is asked before and after the write, as the approval asks it, and he is told when
 * it moved either way, as a correction of a race tells him ({@code RaceWriteApi}), because a change
 * or a deletion can open it again. A frozen season asks nothing, which is the recount's line:
 * „[izabrao uz moju preporuku] Unos, izmena i brisanje u ZAMRZNUTOJ sezoni su dozvoljeni: ...
 * zamrznuta tabela, plasmani i nagrade te sezone se ne menjaju (zamrznute tabele su konstante)."
 *
 * <p><b>THE BOUNDARY OF A FROZEN SEASON, said here rather than left to be found.</b> The snapshot of
 * a frozen season does not exist yet (PDL P9, [GRANICA, izmereno 18.10.2026], ADL A37): every table
 * is worked out live from {@code result}, so a write into a season after its freeze would still
 * move that season's live tables and the category {@link BestOfficialSeason} works out. No season
 * is frozen before 01.01.2028 at 16:00, and the snapshot has to exist before then. Nothing here
 * builds it.
 *
 * <p><b>TWO MODERATORS AT ONCE.</b> Every member the request names is locked ({@code for update} on
 * {@code competitor}, in the order of the key) before anything is judged, so of two saves naming one
 * member on one race one writes and the other meets the result it wrote.
 *
 * <p><b>THE EVENT IS TAKEN BEFORE THE MEMBERS, ON EVERY ROAD OF THE ROUTE.</b> A save that names an
 * event, or whose new event's address already answers, holds that event ({@code for no key update},
 * {@link TheDayOfAnEvent#theEventHeldForThisWrite}) and only then locks its members. A save whose new
 * event does not exist yet locks its members first, because there is nothing to hold, and if its insert
 * then gives way to an event another save made, it does not go on to hold that event with the members
 * still in its hand: a second save on that event holds it and waits for a member this one has, and this
 * one waits for the event, a deadlock which was measured (the second save answered 500). It writes
 * nothing before that insert, so its transaction ends there, which lets its members go, and it is begun
 * again from the top in a transaction of its own, where the event it met is the event it asks for first.
 * {@code TwoLeagueSavesOnANewEventTest} holds the order in place.
 *
 * <p><b>AND THE ONLY OTHER WRITER OF HIS RESULT TAKES TURNS WITH THAT LOCK BY ASKING FOR THE SAME
 * ROW FIRST.</b> A row of {@code result} checks {@code result_competitor_fk}, which takes his
 * {@code competitor} row {@code for key share}, and {@code for update} waits for that and makes it
 * wait. That check is an AFTER ROW trigger: an insert puts its row into V65's unique index first and
 * asks for the share second. So an approval of his run ({@link VerificationWriteApi}) that simply
 * inserted would, with this save holding his row, stand in the index while it waited, and this
 * save's own insert would wait on it: a deadlock, which was measured (the approval answered 500).
 * The approval therefore takes {@code for key share} on his row BEFORE its insert
 * ({@code VerificationWriteApi#countTheResult}), and the two meet in one of two orders. If it
 * commits before this save takes its lock, the save's own question meets its row. If this save has
 * the lock, the approval waits for it before it writes anything and, once the save has committed,
 * meets V65's key and answers with the owner's sentence. Measured by
 * {@code ResultsByTheLeagueConcurrencyTest} (the approval's row held uncommitted: the save waits at
 * the lock and then names the row) and by {@code VerificationDecisionConcurrencyTest} (the save
 * holding the lock, a run he described and a moderator who approves it onto this race: the save
 * is written and the approval is refused, no deadlock). That is why the insert below carries no
 * {@code on conflict}: no writer of his result can get past this lock unseen, so the clause would be
 * a branch nothing reaches. The key is the floor under the lock: without the lock, the first of
 * those cases is answered 500 (a duplicate key) rather than with a second row.
 *
 * <p>The member's own report writes no result, so it does not meet this lock; a report sent while
 * the league enters the same run is refused later, at its approval.
 */
@RestController
class ResultsByTheLeagueApi {

	private static final Logger LOG = LoggerFactory.getLogger(ResultsByTheLeagueApi.class);

	/** The right that checks the members' results, and the only one that opens this road. */
	static final String THE_RIGHT = "queue:results";

	/** Who the member hears from in his inbox, as on every other line about a result. */
	private static final String THE_PORTAL = "Rezultati";

	/** One or more rows are wrong, and {@link NotEntered#rows} says which and why. */
	static final String A_ROW_IS_WRONG = "aRowIsWrong";

	/** No member holds the number on the row (or the row names none). */
	static final String THE_MEMBER_IS_NOT_KNOWN = "theMemberIsNotKnown";

	/** The same member stands on two rows of one save. */
	static final String THE_MEMBER_IS_NAMED_TWICE = "theMemberIsNamedTwice";

	/** He already has a result on this race (PDL P6, 09.09.2026). */
	static final String HE_HAS_A_RESULT_ON_THIS_RACE = "heHasAResultOnThisRace";

	/** A report or a correction of his waits in the queue for this race (PDL P9, 18.10.2026). */
	static final String HIS_SUBMISSION_WAITS = "hisSubmissionWaits";

	/**
	 * The race is of the season being run and he holds no membership of it (PDL P9, 18.10.2026,
	 * „Za trku iz TEKUĆE sezone liga unosi rezultat samo članu koji ima članstvo za tu sezonu").
	 */
	static final String HE_HOLDS_NO_MEMBERSHIP_OF_THE_RUNNING_SEASON =
			"heHoldsNoMembershipOfTheRunningSeason";

	/*
	 * THE THREE REFUSALS OF THE MODERATOR'S SCREEN „UNOS REZULTATA ZA DOGAĐAJ” THAT ARE ITS OWN, whose words
	 * the owner approved on 19.10.2026 (PDL P9, „Reči ekrana „Unos rezultata za događaj” i panela”).
	 */

	/** The event chosen by its key is not in the calendar any more: „Taj događaj više nije u
	 *  kalendaru. Izaberi ga ponovo ili upiši nov.” */
	static final String THE_EVENT_IS_NOT_KNOWN = "theEventIsNotKnown";

	/** The race chosen by its key is not one of that event's any more: „Ta trka više nije u
	 *  kalendaru. Izaberi je ponovo ili upiši novu.” */
	static final String THE_RACE_IS_NOT_KNOWN = "theRaceIsNotKnown";

	/** A new event names no town: „Upiši mesto novog događaja.” */
	static final String THE_TOWN_IS_MISSING = "theTownIsMissing";

	/**
	 * A RACE OF ONE YEAR WOULD MOVE ITS EVENT INTO THE YEAR BEFORE, to an address another event holds
	 * already: „Trka bi pomerila događaj u godinu u kojoj događaj sa istim nazivom već postoji. Izaberi
	 * taj događaj.” Reachable only on the morning of 1 January before ten, when a race of New Year's
	 * Eve may go on an event of the new year (PDL P9, owner, 20.10.2026, „U prozoru 1. januara od 00:00
	 * do 10:00 sme se sastaviti trka na događaju druge godine”), because the event then begins on
	 * that earlier day and its address moves with the year ({@link TheDayOfAnEvent#addressFor}). The
	 * sentence is {@code VerificationWriteApi}'s for the same move, said here for the same reason; 409.
	 */
	static final String THE_EVENT_WOULD_MOVE_ONTO_ANOTHER = "theEventWouldMoveOntoAnother";

	/**
	 * A NEW RACE ON AN EVENT OF THE CALENDAR WHOSE DAY IS NOT IN THAT EVENT'S YEAR: „Dan trke nije u godini
	 * izabranog događaja.” PDL, owner, 22.10.2026, „Ekran 7b: dan trke mora biti u godini izabranog
	 * događaja” (the words were the coordinator's, approved by the choice), with his answer of the same day
	 * that the morning of 1 January before ten stays the exception („Prozor 1. januara od 00:00 do 10:00
	 * ostaje izuzetak”). Until then such a save was answered as a form not filled in, which said that a
	 * time or a measure was missing when nothing was. 409, as its neighbours that are answered by what the
	 * calendar holds rather than by what was sent: the year is the event's as it stands when the save holds
	 * it, and the screen read it earlier (`THE_EVENT_IS_NOT_KNOWN`, `THE_RACE_IS_NOT_KNOWN`).
	 *
	 * <p><b>The screen does not build it for a name of ONE edition since 23.10.2026</b> (PDL, owner,
	 * 23.10.2026, „Unos trke sa imenom događaja koji ima samo jedno izdanje, a dan trke je u drugoj godini,
	 * pravi novo izdanje tog događaja, isto kao za ime sa više izdanja”): that save goes out as a new event
	 * of the name, in the day's own year, and is answered as any new event is. The sentence stays for what
	 * can still reach it: a request that names an event by its key (an edition chosen from a name of
	 * several, a list that was stale, a request the screen did not make), and an event met at the address of
	 * the day that was moved to another year ({@code ANewEventAnotherSaveMadeTest}).
	 */
	static final String THE_DAY_IS_NOT_IN_THE_EVENTS_YEAR = "theDayIsNotInTheEventsYear";

	private final JdbcClient db;

	private final TransactionTemplate inOneTransaction;

	private final Postman postman;

	private final BestOfficialSeason bestOfficialSeason;

	/** The bean, so „a race in the future" and „a frozen season" are things a case can state. */
	private final Clock clock;

	/** The league's own address, which every letter of this road is copied to in blind. */
	private final String theLeague;

	ResultsByTheLeagueApi(JdbcClient db, TransactionTemplate inOneTransaction, Postman postman,
			BestOfficialSeason bestOfficialSeason, Clock clock,
			@Value("${btl.mail.league}") String theLeague) {
		this.db = db;
		this.inOneTransaction = inOneTransaction;
		this.postman = postman;
		this.bestOfficialSeason = bestOfficialSeason;
		this.clock = clock;
		this.theLeague = theLeague;
	}

	/** Somebody who may be chosen in the list: a member number and the name on his record. */
	record Runner(String memberNumber, String firstName, String lastName) {
	}

	/**
	 * One row of a save: whose run, and the four figures as the form sends them. A figure the race
	 * fixes may be absent, and is ignored when present ({@link WhatARaceCarries#figuresOf}).
	 */
	record Row(String memberNumber, BigDecimal distanceKm, Integer ascentM, Integer descentM,
			Integer seconds) {
	}

	/** A wrapper and not a bare array, {@link CompetitorWriteApi.Group}'s choice and reason. */
	record Rows(List<Row> rows) {
	}

	/**
	 * THE EVENT A SAVE OF „UNOS REZULTATA ZA DOGAĐAJ” IS ON: one of the calendar by its {@code id},
	 * or a new one by everything else, „Na moderatorovom ekranu nov događaj traži naziv, datum i
	 * mesto” (PDL P9, owner's choice of 19.10.2026). The date is the day of its first race, which is
	 * this one („nov događaj ima jedno polje „Datum” (isti dan kao njegova prva trka)”, approved the
	 * same day). The town is typed, with its country, as {@code PlaceField} writes it.
	 */
	record NamedEvent(Long id, String name, LocalDate date, String city, String country) {
	}

	/**
	 * THE RACE THE ROWS ARE ON: one of the event's by its {@code id}, or a new one on it, with its
	 * kind and what that kind fixes (a length its course, a race to a limit its limit, a free race
	 * nothing, {@link WhatARaceCarries}). A figure the kind does not fix is not read, the rule a row's
	 * figures have. Its {@code date} is asked on an event of the calendar only („postojeći nudi „Datum
	 * trke” popunjen datumom događaja”); on a new event the event's date is the race's.
	 */
	record NamedRace(Long id, String name, LocalDate date, String kind, BigDecimal distanceKm,
			Integer ascentM, Integer descentM, Integer limitSeconds) {
	}

	/** One save of the moderator's screen: the event, the race, and the rows on it. */
	record OnARaceOfAnEvent(NamedEvent event, NamedRace race, List<Row> rows) {
	}

	/** What the pencil sends: the figures and nothing else. */
	record Changed(BigDecimal distanceKm, Integer ascentM, Integer descentM, Integer seconds) {
	}

	/** Which row was refused and why, by its place in what was sent, counted from nought. */
	record Wrong(int row, String reason) {
	}

	/** The refusal of a save: one word for the whole of it, and a row for each one to blame. */
	record NotEntered(String reason, List<Wrong> rows) {
	}

	/** The results a save wrote, in the order of its rows. */
	record Entered(List<Long> results) {
	}

	/**
	 * What the moderator's screen is answered: the results, and the ADDRESS of the event they are on,
	 * which the screen goes to after saving („posle čuvanja ekran vodi na stranu događaja”, approved
	 * 19.10.2026) and cannot know of an event the save made.
	 */
	record EnteredOn(List<Long> results, String event) {
	}

	record Refused(String reason) {
	}

	/**
	 * EVERYBODY WHO WAS EVER GIVEN A MEMBER NUMBER, active or not, hidden or not, by number.
	 *
	 * <p>The same {@code where} as {@link MembersApi}, „EVERYBODY WHO WAS EVER GIVEN A NUMBER, and
	 * nobody else", and three fields: what the list shows and searches by, and nothing about his fee.
	 */
	@GetMapping("/api/results/runners")
	@RightIsNeeded(THE_RIGHT)
	List<Runner> runners() {
		return db.sql("select member_number, first_name, last_name from competitor"
						+ " where member_number is not null order by member_number")
				.query((row, one) -> new Runner(row.getString(1), row.getString(2), row.getString(3)))
				.list();
	}

	/**
	 * ONE SAVE OF SEVERAL ROWS FOR ONE RACE, written together or not at all.
	 *
	 * @param id the race, which the row of the event page the moderator pressed already knows
	 */
	@PostMapping("/api/races/{id}/results")
	@RightIsNeeded(THE_RIGHT)
	ResponseEntity<?> enter(@PathVariable long id, @RequestBody Rows typed) {
		List<Row> rows = typed.rows() == null ? List.of() : typed.rows();
		ResponseEntity<?> group = whatIsWrongWithTheGroup(rows);

		if (group != null) {
			return group;
		}

		Done done = inOneTransaction.execute(committing -> {
			Optional<TheRace> found = raceOf(id);

			if (found.isEmpty()) {
				return Done.only(ResponseEntity.status(HttpStatus.NOT_FOUND).build());
			}

			TheRace race = found.get();

			if (race.day().isAfter(today())) {
				return Done.only(no(HttpStatus.BAD_REQUEST, ResultWriteApi.THE_RACE_HAS_NOT_BEEN_RUN));
			}

			return theRows(race, rows);
		});

		return postAfterwards(done);
	}

	/**
	 * „UNOS REZULTATA ZA DOGAĐAJ”: THE EVENT, THE RACE AND THE ROWS IN ONE SAVE, AND NOTHING OF IT
	 * WRITTEN IF ONE PART IS REFUSED.
	 *
	 * <p>PDL P9, owner, 19.10.2026: „Događaj, trka i rezultat u jednoj formi, i za člana na „Mojim
	 * rezultatima” i za moderatora”, „Jedan ekran za sve”, and of what it writes: „Na moderatorovom
	 * ekranu nov događaj traži naziv, datum i mesto; ostalo (opis, slika, veze) dopisuje se kasnije kroz
	 * Administraciju → Događaji” and „Isti naziv ne pravi drugi događaj”, so a new event's name that the
	 * calendar already has in that year is that event. A race on an event of the calendar moves the
	 * event back to its day when it is earlier („Ne moze poceti trka pre dogadjaja na kojem je”),
	 * {@link TheDayOfAnEvent}'s rule, which {@code RaceWriteApi} and the approval keep.
	 *
	 * <p><b>The right is {@link #THE_RIGHT} and not the calendar's</b> ({@code entity:events}): the
	 * coordinator's derivation, PDL „[IZVEDENO 19.10.2026, moje, PR za 7b]”, (4), the same power the
	 * approval already has when it makes an event and a race of a run.
	 *
	 * <p><b>Any year up to today</b> (PDL P9, owner, 21.10.2026: „Moderator i admin smeju da unose rezultate
	 * za BILO KOJU prethodnu godinu, jedan po jedan”, which overturns his sentence of 20.10.2026, „NE NUDE
	 * SE STARIJI DOGAĐAJI VAN TEKUĆE SEZONE! ONI SE UNOSE IMPORTOM.”, and the refusal of a day before the
	 * league of 19.10.2026): a race of any year, those before 2027 too, is taken, new or of the calendar,
	 * and only a race still to come is refused. The words a member is told for a year before the league or
	 * for a season that has frozen are {@link #enteredWords}', the event page's own, and a year of the past
	 * moves no category. The member's own report keeps its season ({@code ResultWriteApi}); the event page's
	 * own entry of rows on a race of the calendar is not this route and already takes any year.
	 *
	 * <p><b>What has no sentence of its own is a form not filled in</b> ({@code theFormIsNotComplete}):
	 * a key beside a name, a race of the calendar on a new event, an event that is not a race, a town
	 * too long or with an invisible character or a country nobody has, and a figure the kind fixes
	 * missing. The screen builds none of them; that reading is mine. <b>A new race on an event of another
	 * year</b>, outside the one morning that allows it, has a sentence of its own since 22.10.2026
	 * ({@link #THE_DAY_IS_NOT_IN_THE_EVENTS_YEAR}), and the screen does build that one, for an edition
	 * chosen from a name of several, when its day is typed: its own box refuses it first
	 * (`eventAndRace.ts`), and this is the answer to a request that gets past it. A name of one edition
	 * builds none (owner, 23.10.2026): it goes as a new event.
	 */
	@PostMapping("/api/results/on-a-race-of-an-event")
	@RightIsNeeded(THE_RIGHT)
	ResponseEntity<?> enterOnARaceOfAnEvent(@RequestBody OnARaceOfAnEvent typed) {
		List<Row> rows = typed.rows() == null ? List.of() : typed.rows();
		ResponseEntity<?> group = whatIsWrongWithTheGroup(rows);

		if (group != null) {
			return group;
		}

		NamedEvent event = typed.event();
		NamedRace race = typed.race();
		ResponseEntity<?> wrong = event == null || race == null ? notComplete()
				: whatIsWrongWith(event, race);

		if (wrong != null) {
			return wrong;
		}

		Done done = inOneTransaction.execute(committing -> theRaceAndItsRows(event, race, rows, false));

		if (done == THE_ADDRESS_WAS_TAKEN) {
			/* A SAVE THAT FOUND NO EVENT AT THE TOP AND THEN MET ONE AT ITS INSERT IS BEGUN AGAIN FROM THE
			   TOP, in a transaction of its own, so the event it meets is the event it asks for first (see
			   the class note on the order of the locks). The first transaction wrote nothing and has
			   ended, so the members it held are let go before this one asks for anything. */
			done = inOneTransaction.execute(committing -> theRaceAndItsRows(event, race, rows, true));
		}

		return postAfterwards(done);
	}

	/** The event and the race as the body names them, judged before anything is read or written. */
	private ResponseEntity<?> whatIsWrongWith(NamedEvent event, NamedRace race) {
		boolean newEvent = event.id() == null;
		boolean newRace = race.id() == null;
		boolean namedBesideTheKey = !newEvent
				&& !nothingIn(event.name(), event.date(), event.city(), event.country());
		boolean raceNamedBesideTheKey = !newRace && !nothingIn(race.name(), race.date(), race.kind(),
				race.distanceKm(), race.ascentM(), race.descentM(), race.limitSeconds());

		if (namedBesideTheKey || raceNamedBesideTheKey || (newEvent && !newRace)
				|| (newEvent && (isNothing(event.name()) || event.date() == null || race.date() != null))
				|| (newRace && (isNothing(race.name()) || race.kind() == null
						|| !WhatARaceCarries.KINDS.contains(race.kind())))
				|| (newRace && !newEvent && race.date() == null)) {
			return notComplete();
		}

		if (newEvent && isNothing(event.city())) {
			return no(HttpStatus.BAD_REQUEST, THE_TOWN_IS_MISSING);
		}

		if (newEvent && !aTownTyped(event.city(), event.country())) {
			return notComplete();
		}

		if (newRace && figuresOfANewRaceAreWrong(race)) {
			return notComplete();
		}

		LocalDate day = newEvent ? event.date() : race.date();

		if (newRace && day.isAfter(today())) {
			return no(HttpStatus.BAD_REQUEST, ResultWriteApi.THE_RACE_HAS_NOT_BEEN_RUN);
		}

		return null;
	}

	/** A town typed, of the length and the characters a typed town may hold, in a country there is
	 *  ({@code ResultWriteApi}'s rules for a typed town). */
	private boolean aTownTyped(String city, String country) {
		String town = city.strip();

		return town.length() <= ResultWriteApi.A_TYPED_TOWN_HOLDS_AT_MOST
				&& town.codePoints().noneMatch(ResultWriteApi::nobodySees)
				&& !isNothing(country)
				&& db.sql("select id from country where code = ?").param(country).query(Long.class)
						.optional().isPresent();
	}

	/** What the kind of a new race fixes, missing or outside what the columns keep. */
	private static boolean figuresOfANewRaceAreWrong(NamedRace race) {
		boolean course = WhatARaceCarries.fixesTheCourse(race.kind());
		boolean time = WhatARaceCarries.fixesTheTime(race.kind());

		return (course && (ResultWriteApi.notADistance(race.distanceKm())
				|| ResultWriteApi.notAClimb(race.ascentM()) || ResultWriteApi.notAClimb(race.descentM())))
				|| (time && ResultWriteApi.notATime(race.limitSeconds()));
	}

	/**
	 * INSIDE THE TRANSACTION: the event (held, or made, or found at its address), the race (found on
	 * it, or made), and then the rows exactly as the event page enters them ({@link #theRows}).
	 *
	 * @param again whether this is the second time round, after the insert of a new event gave way once
	 * @return {@link #THE_ADDRESS_WAS_TAKEN} where the insert of a new event gave way to one another save
	 *         made, and nothing was written
	 */
	private Done theRaceAndItsRows(NamedEvent named, NamedRace race, List<Row> rows, boolean again) {
		Optional<TheDayOfAnEvent.Standing> event = named.id() != null
				? TheDayOfAnEvent.theEventHeldForThisWrite(db, named.id())
				: TheDayOfAnEvent.theEventAt(db, EventAddress.of(named.name().strip(), named.date()))
						.flatMap(there -> TheDayOfAnEvent.theEventHeldForThisWrite(db, there.id()));

		if (named.id() != null && event.isEmpty()) {
			return Done.only(no(HttpStatus.CONFLICT, THE_EVENT_IS_NOT_KNOWN));
		}

		if (event.isPresent() && !WhatAnEventCarries.A_RACE.equals(event.get().kind())) {
			return Done.only(notComplete());
		}

		if (race.id() != null) {
			Optional<TheRace> found = raceOf(race.id())
					.filter(one -> raceIsOn(one.id(), event.orElseThrow().id()));

			if (found.isEmpty()) {
				return Done.only(no(HttpStatus.CONFLICT, THE_RACE_IS_NOT_KNOWN));
			}

			if (found.get().day().isAfter(today())) {
				return Done.only(no(HttpStatus.BAD_REQUEST, ResultWriteApi.THE_RACE_HAS_NOT_BEEN_RUN));
			}

			return onTheEvent(theRows(found.get(), rows), event.orElseThrow().id());
		}

		LocalDate day = named.id() == null ? named.date() : race.date();

		/* A NEW RACE GOES ON AN EVENT OF ITS OWN YEAR, except on the morning of 1 January before ten, when
		   it may go on an event of the year just ended or of the year just begun.

		   Both halves are the owner's. The rule (PDL P9, 21.10.2026, of a new race of another year on an
		   existing event: „NECE DE DESITI!!!!!! PREBACICE PRVO LICNO DOGADJAJ NA PRETHODNU GODINU!”): the
		   moderator moves the event to the year first, and a race is not put on an event of another year,
		   whatever the year of either is, those before 2027 and those long past included. The exception
		   (PDL P9, 20.10.2026, „U prozoru 1. januara od 00:00 do 10:00 sme se sastaviti trka na događaju
		   druge godine”, chosen against my recommendation) is the one morning it gives way, and the owner
		   kept it so on 22.10.2026 („Prozor 1. januara od 00:00 do 10:00 ostaje izuzetak od pravila „dan
		   trke u godini događaja” na ekranu 7b”). A request outside it is answered with the owner's sentence
		   for it (PDL, 22.10.2026, „Ekran 7b: dan trke mora biti u godini izabranog događaja”): „Dan trke nije
		   u godini izabranog događaja.” It was answered as a form not filled in until that day. Since
		   23.10.2026 the screen sends a name of one edition as a new event, which never meets this question
		   (owner, „pravi novo izdanje tog događaja”), so what reaches it is a request naming an event by its
		   key.

		   THE WINDOW IS NOT WRITTEN HERE. It is the seasons open for a report, which are two for those
		   ten hours and one for the rest of the year ({@link SeasonClock#seasonsOpenForAReport}), so BOTH
		   years being among them is the whole question: two different years can both be open only inside
		   the window. That reading, and not "any year difference", is mine too, and since 21.10.2026 the
		   year of the race has to be asked here as well as the year of the event: this route no longer
		   refuses a race of a season that is not open, so a race of the year just ended is no longer
		   known to be open by the time it gets here.

		   When the race is the earlier of the two years the event begins on its day and moves into
		   its year's address ({@link TheDayOfAnEvent}), which is asked below once the day is known. */
		if (event.isPresent() && event.get().date().getYear() != day.getYear()
				&& !(SeasonClock.aRunMayBeSentFor(event.get().date().getYear(), now())
						&& SeasonClock.aRunMayBeSentFor(day.getYear(), now()))) {
			return Done.only(no(HttpStatus.CONFLICT, THE_DAY_IS_NOT_IN_THE_EVENTS_YEAR));
		}

		/* THE ROWS FIRST, on the race as it will be: a race nobody has made yet has no result and no
		   report on it, which is what its key nought answers (keys start at one). */
		Judged judged = judged(new TheRace(0, race.name().strip(), day, race.kind(),
				WhatARaceCarries.fixesTheTime(race.kind()) ? race.limitSeconds() : 0,
				WhatARaceCarries.fixesTheCourse(race.kind()) ? race.distanceKm() : BigDecimal.ZERO,
				WhatARaceCarries.fixesTheCourse(race.kind()) ? race.ascentM() : 0,
				WhatARaceCarries.fixesTheCourse(race.kind()) ? race.descentM() : 0), rows);

		if (judged.refused() != null) {
			return Done.only(judged.refused());
		}

		long made;
		long on;

		if (event.isPresent()) {
			TheDayOfAnEvent.Standing there = event.get();
			LocalDate beginning = TheDayOfAnEvent.theDayItWillBeginOn(db, there, null, day);
			String address = TheDayOfAnEvent.addressFor(there, beginning);

			/* THE RACE MOVES THE EVENT INTO THE YEAR BEFORE, where another event of that name may stand
			   already (the same refusal as `RaceWriteApi` and the approval keep). Asked before anything
			   is written; an event kept in its own year keeps its address and is never refused here. */
			if (EventWriteApi.addressIsTakenBySomebodyElse(db, address, there.id())) {
				return Done.only(no(HttpStatus.CONFLICT, THE_EVENT_WOULD_MOVE_ONTO_ANOTHER));
			}

			made = aNewRace(there.id(), race, day);
			on = there.id();
			TheDayOfAnEvent.theEventNowBeginsOn(db, there, beginning, address);
		} else {
			Optional<Long> newEvent = aNewEvent(named);

			if (newEvent.isEmpty()) {
				if (again) {
					/* THE ADDRESS WAS TAKEN TWICE IN ONE SAVE: the event the first time was gone (a delete
					   committed in that instant) when the second began, and another save made one again
					   in the same instant. Begun a third time it could be so forever; it is a 500, as
					   an event gone under a save always was. */
					throw new IllegalStateException("The address of the event was taken twice in one save: "
							+ EventAddress.of(named.name().strip(), named.date()));
				}

				return THE_ADDRESS_WAS_TAKEN;
			}

			on = newEvent.get();
			made = aNewRace(on, race, day);
		}

		return onTheEvent(written(raceOf(made).orElseThrow(), judged), on);
	}

	/** A save written, answered with the address of the event it is on as that event now stands. */
	private Done onTheEvent(Done done, long event) {
		if (!(done.answer().getBody() instanceof Entered entered)) {
			return done;
		}

		String address = db.sql("select slug from btl_event where id = ?").param(event)
				.query(String.class).single();

		return new Done(ResponseEntity.status(HttpStatus.CREATED)
				.body(new EnteredOn(entered.results(), address)), done.letters());
	}

	/**
	 * The event, in the town typed, on the day of its first race, at its address, or nothing where
	 * another save made an event at that address in between: the insert gives way to it, and the save is
	 * begun again from the top ({@link #enterOnARaceOfAnEvent}), because the checks of a race on an event
	 * that is there, and the order in which its locks are taken, are not this method's to make.
	 *
	 * @return the key of the event made, or nothing where the address was taken
	 */
	private Optional<Long> aNewEvent(NamedEvent named) {
		String address = EventAddress.of(named.name().strip(), named.date());
		Long country = db.sql("select id from country where code = ?").param(named.country())
				.query(Long.class).single();

		return db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link) values (?, ?, ?, null, ?, ?, ?, false, '', '')"
						+ " on conflict (slug) do nothing returning id")
				.params(address, named.name().strip(), named.date(), named.city().strip(), country,
						WhatAnEventCarries.A_RACE)
				.query(Long.class).optional();
	}

	/** The race, with what its kind fixes and nought for the rest, as the approval writes one. */
	private long aNewRace(long event, NamedRace race, LocalDate day) {
		boolean course = WhatARaceCarries.fixesTheCourse(race.kind());
		boolean time = WhatARaceCarries.fixesTheTime(race.kind());

		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m) values (?, ?, true, ?, ?, ?, ?, ?, ?)"
						+ " returning id")
				.params(event, race.name().strip(), day, race.kind(), time ? race.limitSeconds() : 0,
						course ? race.distanceKm() : BigDecimal.ZERO, course ? race.ascentM() : 0,
						course ? race.descentM() : 0)
				.query(Long.class).single();
	}

	private boolean raceIsOn(long race, long event) {
		return db.sql("select count(*) from race where id = ? and event_id = ?").params(race, event)
				.query(Integer.class).single() == 1;
	}

	/** The save's own two refusals of the group as a whole, before any row is judged. */
	private static ResponseEntity<?> whatIsWrongWithTheGroup(List<Row> rows) {
		if (rows.isEmpty()) {
			return ResponseEntity.badRequest()
					.body(new NotEntered(CompetitorWriteApi.THE_GROUP_IS_EMPTY, List.of()));
		}

		if (rows.size() > CompetitorWriteApi.THE_MOST_IN_ONE_GROUP) {
			return ResponseEntity.badRequest()
					.body(new NotEntered(CompetitorWriteApi.THE_GROUP_IS_TOO_BIG, List.of()));
		}

		return null;
	}

	private static ResponseEntity<?> notComplete() {
		return no(HttpStatus.BAD_REQUEST, ResultWriteApi.THE_FORM_IS_NOT_COMPLETE);
	}

	private static boolean isNothing(String value) {
		return value == null || value.isBlank();
	}

	/** Whether none of these says anything: each is absent, or a text with nothing in it. */
	private static boolean nothingIn(Object... values) {
		return Stream.of(values).allMatch(one -> one == null || one instanceof String text && text.isBlank());
	}

	/**
	 * THE ROWS OF ONE SAVE ON ONE RACE, judged all before the first is written, inside the caller's
	 * transaction: the event page's save and the moderator's screen's are this one method.
	 */
	private Done theRows(TheRace race, List<Row> rows) {
		Judged judged = judged(race, rows);

		return judged.refused() != null ? Done.only(judged.refused()) : written(race, judged);
	}

	/**
	 * EVERY ROW JUDGED ON THE RACE, and nothing written: the refusal, or whose each row is and the
	 * figures it is counted at. Asked of a race the save is about to make as well, before the event
	 * and the race are written ({@link #theRaceAndItsRows}), so a refused row leaves nothing of the
	 * save behind without the transaction having to take anything back.
	 */
	private Judged judged(TheRace race, List<Row> rows) {
		Map<String, Long> members = keysOf(rows);

		/* LOCKED BEFORE ANYTHING IS JUDGED, in the order of the key so two saves cannot hold
		   each other's members (see the class note). */
		if (!members.isEmpty()) {
			db.sql("select id from competitor where id in (:ids) order by id for update")
					.param("ids", members.values()).query(Long.class).list();
		}

		Map<Long, Integer> times = new HashMap<>();

		for (Row row : rows) {
			Long member = row == null ? null : members.get(row.memberNumber());

			if (member != null) {
				times.merge(member, 1, Integer::sum);
			}
		}

		List<Wrong> wrong = new ArrayList<>();
		List<Long> whose = new ArrayList<>();
		List<Figures> counted = new ArrayList<>();

		for (int at = 0; at < rows.size(); at++) {
			Row row = rows.get(at);
			Long member = row == null ? null : members.get(row.memberNumber());
			Figures figures = row == null ? null : WhatARaceCarries.figuresOf(race.fixes(),
					new Figures(row.distanceKm(), row.ascentM(), row.descentM(), row.seconds()));
			String why = member == null ? THE_MEMBER_IS_NOT_KNOWN
					: notARun(figures) ? ResultWriteApi.THE_FORM_IS_NOT_COMPLETE
					: times.get(member) > 1 ? THE_MEMBER_IS_NAMED_TWICE
					: hasAResultOn(member, race.id()) ? HE_HAS_A_RESULT_ON_THIS_RACE
					: hisSubmissionWaits(member, race.id()) ? HIS_SUBMISSION_WAITS
					: aMemberTheRunningSeasonDoesNotHave(member, race)
							? HE_HOLDS_NO_MEMBERSHIP_OF_THE_RUNNING_SEASON
					: null;

			if (why != null) {
				wrong.add(new Wrong(at, why));
			}

			whose.add(member);
			counted.add(figures);
		}

		return wrong.isEmpty() ? new Judged(null, whose, counted)
				: new Judged(ResponseEntity.badRequest().body(new NotEntered(A_ROW_IS_WRONG, wrong)),
						whose, counted);
	}

	/** The rows judged, written on the race as it now stands in the calendar. */
	private Done written(TheRace race, Judged judged) {
		List<Long> written = new ArrayList<>();
		List<Letter> letters = new ArrayList<>();

		for (int at = 0; at < judged.whose().size(); at++) {
			written.add(enterOne(judged.whose().get(at), race, judged.counted().get(at), letters));
		}

		return new Done(ResponseEntity.status(HttpStatus.CREATED).body(new Entered(written)),
				letters);
	}

	/**
	 * THE PENCIL: THE FIGURES OF ONE RESULT ON THIS RACE, CHANGED AT ONCE.
	 *
	 * @param id     the race the result is on, and it must be: a result on another race is not here
	 * @param result the result
	 */
	@PutMapping("/api/races/{id}/results/{result}")
	@RightIsNeeded(THE_RIGHT)
	ResponseEntity<?> change(@PathVariable long id, @PathVariable long result,
			@RequestBody Changed typed) {
		Done done = inOneTransaction.execute(committing -> {
			Optional<Standing> found = standing(result, id);

			if (found.isEmpty()) {
				return Done.only(ResponseEntity.status(HttpStatus.NOT_FOUND).build());
			}

			Standing standing = found.get();

			if (hisSubmissionWaits(standing.member(), standing.race().id())) {
				return Done.only(no(HttpStatus.CONFLICT, HIS_SUBMISSION_WAITS));
			}

			Figures figures = WhatARaceCarries.figuresOf(standing.race().fixes(), new Figures(
					typed.distanceKm(), typed.ascentM(), typed.descentM(), typed.seconds()));

			if (notARun(figures)) {
				return Done.only(no(HttpStatus.BAD_REQUEST, ResultWriteApi.THE_FORM_IS_NOT_COMPLETE));
			}

			int season = standing.race().day().getYear() + 1;
			boolean asks = asksTheCategory(standing.race());
			boolean wasOpen = asks && beginnersCategoryIsOpenFor(standing.member(), season);

			/* THE OLD VALUE IS READ BEFORE THE ROW CHANGES, which is the whole point of the
			   letter: afterwards there is nowhere left to read it from (PDL P9, „Mejl je dnevnik"). */
			Run before = standing.run();
			Run after = runOf(standing.race(), figures);

			db.sql("update result set distance_km = ?, ascent_m = ?, descent_m = ?, seconds = ?,"
							+ " points = ? where id = ?")
					.params(after.distanceKm(), after.ascentM(), after.descentM(), after.seconds(),
							after.points(), standing.id())
					.update();

			List<Letter> letters = new ArrayList<>();
			Reader reader = readerOf(standing.member());

			tellAndKeep(standing.member(), reader,
					WhatAResultChangeSays.changedByTheLeague(before, after, reader.language()), letters);

			if (asks) {
				tellIfTheCategoryMoved(standing.member(), season, wasOpen, Act.CHANGED, after);
			}

			return new Done(ResponseEntity.noContent().build(), letters);
		});

		return postAfterwards(done);
	}

	/**
	 * THE X: ONE RESULT ON THIS RACE, DELETED AT ONCE, and the letter carries what it was.
	 */
	@DeleteMapping("/api/races/{id}/results/{result}")
	@RightIsNeeded(THE_RIGHT)
	ResponseEntity<?> remove(@PathVariable long id, @PathVariable long result) {
		Done done = inOneTransaction.execute(committing -> {
			Optional<Standing> found = standing(result, id);

			if (found.isEmpty()) {
				return Done.only(ResponseEntity.status(HttpStatus.NOT_FOUND).build());
			}

			Standing standing = found.get();

			if (hisSubmissionWaits(standing.member(), standing.race().id())) {
				return Done.only(no(HttpStatus.CONFLICT, HIS_SUBMISSION_WAITS));
			}

			int season = standing.race().day().getYear() + 1;
			boolean asks = asksTheCategory(standing.race());
			boolean wasOpen = asks && beginnersCategoryIsOpenFor(standing.member(), season);
			Run before = standing.run();

			db.sql("delete from result where id = ?").param(standing.id()).update();

			List<Letter> letters = new ArrayList<>();
			Reader reader = readerOf(standing.member());

			tellAndKeep(standing.member(), reader,
					WhatAResultChangeSays.deleted(before, reader.language()), letters);

			if (asks) {
				tellIfTheCategoryMoved(standing.member(), season, wasOpen, Act.DELETED, before);
			}

			return new Done(ResponseEntity.noContent().build(), letters);
		});

		return postAfterwards(done);
	}

	/** ONE ROW OF A SAVE THAT HAS PASSED, WRITTEN: the result, the line in his inbox, the
	 *  category, and the letter kept for after the commit. */
	private long enterOne(long member, TheRace race, Figures figures, List<Letter> letters) {
		int season = race.day().getYear() + 1;
		boolean asks = asksTheCategory(race);
		boolean wasOpen = asks && beginnersCategoryIsOpenFor(member, season);
		Run run = runOf(race, figures);

		long written = db.sql("insert into result (competitor_id, race_id, race_date, distance_km,"
						+ " ascent_m, descent_m, seconds, points) values (?, ?, ?, ?, ?, ?, ?, ?)"
						+ " returning id")
				.params(member, race.id(), race.day(), run.distanceKm(), run.ascentM(),
						run.descentM(), run.seconds(), run.points())
				.query(Long.class).single();

		Reader reader = readerOf(member);

		tellAndKeep(member, reader, enteredWords(run, reader.language()), letters);

		if (asks) {
			tellIfTheCategoryMoved(member, season, wasOpen, Act.ENTERED, run);
		}

		return written;
	}

	/**
	 * THE WORDS OF AN ENTRY, BY WHETHER A SEASON COUNTS IT.
	 *
	 * <p>Three states and no fourth: a run before 2027 is a run before the league, a run of a season
	 * that has frozen has the owner's sentence for it, and every other run counts in its season. There
	 * is no „entered without a membership" state left to tell, and that is a consequence of the
	 * owner's decisions of 18.10.2026 and not a gap: a season is current until its freeze, a race is
	 * never entered before it is run, so a season that has not frozen and has begun is current, and
	 * for it the league enters only a member ({@link #aMemberTheRunningSeasonDoesNotHave}). The words
	 * for it, which the owner had approved, are gone from the dictionary.
	 * „Counts in its season" is the join {@link ResultApi} serves as {@code inItsSeason} and
	 * {@link BestOfficialSeason} sums over: a {@code membership} of the year of the run.
	 */
	private Said enteredWords(Run run, MailLanguage in) {
		int year = run.day().getYear();

		if (year < SeasonClock.FIRST_SEASON) {
			return WhatAResultChangeSays.enteredBeforeTheLeague(run, in);
		}

		if (SeasonClock.isAFrozenSeasonOfTheLeague(year, now())) {
			return WhatAResultChangeSays.enteredInAFrozenSeason(run, in);
		}

		return WhatAResultChangeSays.approved(run, in);
	}

	/**
	 * THE ROW OF {@code membership} FOR THIS MEMBER AND THIS SEASON, the one fact both questions
	 * here ask: whether a season counts a run, and whether the league may enter one in the running
	 * season. Not his latest membership and not the season the clock is in.
	 */
	private boolean holdsMembershipOf(long member, int season) {
		return Boolean.TRUE.equals(db.sql("select exists(select 1 from membership"
						+ " where competitor_id = ? and season = ?)")
				.params(member, season).query(Boolean.class).single());
	}

	/**
	 * THE RULE OF THE RUNNING SEASON (see the class note): the race is of the season being run, and
	 * he holds no membership of it. Every other year, earlier ones and those before 2027, asks nothing.
	 */
	private boolean aMemberTheRunningSeasonDoesNotHave(long member, TheRace race) {
		int season = race.day().getYear();

		return SeasonClock.isTheSeasonBeingRun(season, now()) && !holdsMembershipOf(member, season);
	}

	/** A frozen season is not asked about its category at all (see the class note). */
	private boolean asksTheCategory(TheRace race) {
		return !SeasonClock.isFrozen(race.day().getYear(), now());
	}

	private boolean beginnersCategoryIsOpenFor(long member, int season) {
		return Category.firstSeasonAllowed(bestOfficialSeason.pointsFor(member, season));
	}

	/** What the league did to the run, as the line about his category names it. */
	private enum Act {
		ENTERED("unela"), CHANGED("izmenila"), DELETED("obrisala");

		private final String verb;

		Act(String verb) {
			this.verb = verb;
		}
	}

	/**
	 * AND HE IS TOLD WHEN THAT MOVED HIS BEGINNERS' CATEGORY, either way, in Serbian.
	 *
	 * <p>The model is {@code RaceWriteApi.tellHimHisCategoryMoved} (what moved it, the threshold and
	 * which season), and like that line and the approval's this is not a copy of a letter, so it does
	 * not follow the mail language (PDL P18, 10.10.2026, „ostalo srpsko"). The words are mine and go
	 * to the owner with the others.
	 */
	private void tellIfTheCategoryMoved(long member, int season, boolean wasOpen, Act act, Run run) {
		boolean open = beginnersCategoryIsOpenFor(member, season);

		if (open == wasOpen) {
			return;
		}

		tell(member, open ? "Početnička kategorija vam je ponovo otvorena"
						: "Početnička kategorija vam je zatvorena",
				"Liga vam je " + act.verb + " rezultat sa trke " + run.raceName() + " od "
						+ WhatAResultChangeSays.asADay(run.day()) + ". Time ste u zvaničnoj sezoni "
						+ (open ? "pali ispod praga od " : "prešli prag od ")
						+ Category.FIRST_SEASON_POINTS + " bodova, pa vam je početnička kategorija "
						+ (open ? "ponovo otvorena" : "zatvorena") + " za sezonu " + season + ".");
	}

	/** The line in his inbox, and the letter kept for after the commit where he has an address. */
	private void tellAndKeep(long member, Reader reader, Said said, List<Letter> letters) {
		tell(member, said.subject(), said.body());

		if (reader.address() != null) {
			letters.add(new Letter(member, reader.address(), said));
		}
	}

	/**
	 * A LINE IN ONE MEMBER'S INBOX, always addressed: {@code message.to_id} left empty means
	 * EVERYBODY (V13), and every row of {@code result} names its member.
	 */
	private void tell(long member, String subject, String body) {
		db.sql("insert into message (to_id, from_id, from_name, subject, body)"
						+ " values (?, null, ?, ?, ?)")
				.params(member, THE_PORTAL, subject, body)
				.update();
	}

	/**
	 * WHERE HIS LETTER GOES AND ITS LANGUAGE, off HIS account, never the asker's. No account is an
	 * ordinary state (the history of the league is members who never had one): no letter, and the
	 * inbox line in Serbian.
	 */
	private Reader readerOf(long member) {
		return db.sql("select email, mail_language from account where competitor_id = ?")
				.param(member)
				.query((row, one) -> new Reader(row.getString(1),
						MailLanguage.ofTheColumn(row.getString(2))))
				.optional()
				.orElse(new Reader(null, MailLanguage.SERBIAN));
	}

	/** The letters, after the commit, each copied to the league in blind (see the class note). */
	private ResponseEntity<?> postAfterwards(Done done) {
		for (Letter letter : done.letters()) {
			try {
				postman.send(letter.said(), letter.address(), theLeague);
			} catch (MailException theRelayDidNotTakeIt) {
				LOG.warn("the letter about the result of member {} did not go out; the inbox holds"
						+ " what it said and the row is written either way", letter.member(),
						theRelayDidNotTakeIt);
			}
		}

		return done.answer();
	}

	/** Member numbers to keys, for the numbers the rows carry and only those that exist. */
	private Map<String, Long> keysOf(List<Row> rows) {
		List<String> numbers = rows.stream().filter(Objects::nonNull).map(Row::memberNumber)
				.filter(Objects::nonNull).distinct().toList();
		Map<String, Long> keys = new HashMap<>();

		if (!numbers.isEmpty()) {
			db.sql("select member_number, id from competitor where member_number in (:numbers)")
					.param("numbers", numbers)
					.query((row, one) -> keys.put(row.getString(1), row.getLong(2)))
					.list();
		}

		return keys;
	}

	private boolean hasAResultOn(long member, long race) {
		return Boolean.TRUE.equals(db.sql("select exists(select 1 from result where competitor_id = ?"
						+ " and race_id = ?)")
				.params(member, race).query(Boolean.class).single());
	}

	/** A report or a correction of his for this race, still waiting (see the class note). */
	private boolean hisSubmissionWaits(long member, long race) {
		return Boolean.TRUE.equals(db.sql("select exists(select 1 from result_submission rs"
						+ " join verification v on v.result_submission_id = rs.id"
						+ " where rs.competitor_id = ? and rs.race_id = ? and v.state = ?)")
				.params(member, race, DecidingOnASubmission.WAITING).query(Boolean.class).single());
	}

	/** Not a run anybody ran: the three checks the member's road asks of the same columns. */
	private static boolean notARun(Figures figures) {
		return ResultWriteApi.notADistance(figures.distanceKm())
				|| ResultWriteApi.notAClimb(figures.ascentM())
				|| ResultWriteApi.notAClimb(figures.descentM())
				|| ResultWriteApi.notATime(figures.seconds());
	}

	/** The run as it is counted, with the points from the one place that answers for them. */
	private static Run runOf(TheRace race, Figures figures) {
		return new Run(race.name(), race.day(), figures.distanceKm(), figures.ascentM(),
				figures.descentM(), figures.seconds(), BtlScoreCalculator.calculate(
						figures.distanceKm().doubleValue(), figures.ascentM(), figures.descentM(),
						figures.seconds()));
	}

	/** The moment, in the league's zone, which is the zone every season question is asked in. */
	private ZonedDateTime now() {
		return clock.instant().atZone(SeasonClock.ZONE);
	}

	private LocalDate today() {
		return LocalDate.now(clock.withZone(SeasonClock.ZONE));
	}

	private Optional<TheRace> raceOf(long id) {
		return db.sql("select id, name, date, kind, limit_seconds, distance_km, ascent_m, descent_m"
						+ " from race where id = ?")
				.param(id)
				.query((row, one) -> new TheRace(row.getLong(1), row.getString(2),
						row.getDate(3).toLocalDate(), row.getString(4), row.getInt(5),
						row.getBigDecimal(6), row.getInt(7), row.getInt(8)))
				.optional();
	}

	/**
	 * THE RESULT, IF IT IS ON THIS RACE, LOCKED. The race is in the {@code where}, so a result on
	 * another race and a result that is not there are one answer.
	 */
	private Optional<Standing> standing(long result, long race) {
		return db.sql("select r.id, r.competitor_id, r.distance_km, r.ascent_m, r.descent_m,"
						+ " r.seconds, r.points, ra.id, ra.name, ra.date, ra.kind, ra.limit_seconds,"
						+ " ra.distance_km, ra.ascent_m, ra.descent_m"
						+ " from result r join race ra on ra.id = r.race_id"
						+ " where r.id = ? and r.race_id = ? for update of r")
				.params(result, race)
				.query((row, one) -> new Standing(row.getLong(1), row.getLong(2),
						row.getBigDecimal(3), row.getInt(4), row.getInt(5), row.getInt(6),
						row.getBigDecimal(7), new TheRace(row.getLong(8), row.getString(9),
								row.getDate(10).toLocalDate(), row.getString(11), row.getInt(12),
								row.getBigDecimal(13), row.getInt(14), row.getInt(15))))
				.optional();
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}

	/** A race as the calendar holds it. */
	private record TheRace(long id, String name, LocalDate day, String kind, int limitSeconds,
			BigDecimal distanceKm, int ascentM, int descentM) {

		WhatARaceCarries.ARace fixes() {
			return new WhatARaceCarries.ARace(kind, distanceKm, ascentM, descentM, limitSeconds);
		}
	}

	/** A result as it stands, with its race: the old value a letter carries. */
	private record Standing(long id, long member, BigDecimal distanceKm, int ascentM, int descentM,
			int seconds, BigDecimal points, TheRace race) {

		Run run() {
			return new Run(race.name(), race.day(), distanceKm, ascentM, descentM, seconds, points);
		}
	}

	private record Reader(String address, MailLanguage language) {
	}

	private record Letter(long member, String address, Said said) {
	}

	/** The rows of a save as judged: the refusal, or whose each is and what it is counted at. */
	private record Judged(ResponseEntity<?> refused, List<Long> whose, List<Figures> counted) {
	}

	/** The answer, and the letters that leave only once it has committed. */
	private record Done(ResponseEntity<?> answer, List<Letter> letters) {

		static Done only(ResponseEntity<?> answer) {
			return new Done(answer, List.of());
		}
	}

	/** Not an answer: the insert of a new event gave way, nothing was written, and the save begins again.
	 *  It is compared by identity, and a 500 if it were ever sent. */
	private static final Done THE_ADDRESS_WAS_TAKEN = Done.only(
			ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build());
}
