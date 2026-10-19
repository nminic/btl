package com.btl.portal.web;

import com.btl.portal.domain.category.Category;
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

		if (rows.isEmpty()) {
			return ResponseEntity.badRequest()
					.body(new NotEntered(CompetitorWriteApi.THE_GROUP_IS_EMPTY, List.of()));
		}

		if (rows.size() > CompetitorWriteApi.THE_MOST_IN_ONE_GROUP) {
			return ResponseEntity.badRequest()
					.body(new NotEntered(CompetitorWriteApi.THE_GROUP_IS_TOO_BIG, List.of()));
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

			if (!wrong.isEmpty()) {
				return Done.only(ResponseEntity.badRequest().body(new NotEntered(A_ROW_IS_WRONG, wrong)));
			}

			List<Long> written = new ArrayList<>();
			List<Letter> letters = new ArrayList<>();

			for (int at = 0; at < rows.size(); at++) {
				written.add(enterOne(whose.get(at), race, counted.get(at), letters));
			}

			return new Done(ResponseEntity.status(HttpStatus.CREATED).body(new Entered(written)),
					letters);
		});

		return postAfterwards(done);
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

	/** The answer, and the letters that leave only once it has committed. */
	private record Done(ResponseEntity<?> answer, List<Letter> letters) {

		static Done only(ResponseEntity<?> answer) {
			return new Done(answer, List.of());
		}
	}
}
