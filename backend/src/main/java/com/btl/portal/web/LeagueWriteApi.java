package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.ZonedDateTime;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * MAKING A COMPETITION THAT RUNS ALONGSIDE THE LEAGUE, CHANGING IT, TAKING IT AWAY, AND
 * SAYING WHICH RACES COUNT TOWARDS IT.
 *
 * <p>The writing half of {@link LeagueApi}, which has read {@code league} and
 * {@code league_race} since B40 while nothing at all wrote either of them.
 *
 * <p><b>THIS TABLE IS FOR THE COMPETITIONS THAT RUN ALONGSIDE, AND THE BALKAN RACING
 * LEAGUE IS NOT ONE OF THEM (PDL P15a, owner 22.09.2026).</b> In his own words:
 * „Balkanska trkacka liga je globalno takmicenje i svaka sezona se automatski prati a
 * prethodna zamrzava. <b>Ne kreira se i ne moderira</b>", and about the shape of it:
 * „BTL ne treba da se cuva na isti nacin kao ostale lige jer je potpuno drugaciji
 * koncept." So there is no row for it, there never will be, and these four routes are for
 * the propratne lige alone. The screens that used to filter a row named {@code btl-2027}
 * off their lists were guarding against a row that cannot exist, and they stopped
 * (PDL P15a, the finding that decision resolves).
 *
 * <p><b>AND IT HAS NO ADMINISTRATOR, SO THE RIGHT IS THE MATRIX'S TICK.</b> Owner,
 * 12.09.2026: „NE POSTOJI ADMINISTRATOR PROPRATNE LIGE!!!! Moze Superadmin, ili moderator
 * koji ima stikliranu tu privilegiju da uredjuje Lige." {@code league.admin_id} was
 * dropped by V19 for exactly that sentence, and {@code @RightIsNeeded("entity:leagues")}
 * is the whole of who may call these. The refusal is 404 and not 403 (ADL A8, owner
 * 13.09.2026), so a moderator without the tick cannot learn from the answer that the
 * action exists - and a league that is not there answers the same, which is the same rule
 * applied to a row rather than to a route.
 *
 * <p><b>WHAT EACH ROUTE REFUSES, AND WHICH OF THE THREE ANSWERS DECIDES.</b> Three
 * different facts about a season are asked about here and they are deliberately three
 * questions and not one:
 *
 * <ul>
 * <li><b>May a league be made for this season at all</b> -
 * {@link SeasonClock#aLeagueMayBeMadeFor}, which is the owner's „tekuca ili naredna",
 * asked of the season the FORM sends and asked only where that season is being MOVED. The
 * note on {@link #whatIsWrongWith} says why the second half of that sentence is there and
 * marks it as my reading rather than his.
 * <li><b>Is this league's season frozen</b> - {@link SeasonClock#isFrozen}, asked of the
 * season THE ROW carries and never of the one the form sends. Asked the other way round,
 * a frozen league could be dragged into a live season by the very request the freeze is
 * there to refuse, and the refusal would have been asked about the wrong year.
 * <li><b>Is this race of this league's season</b> - not asked in Java at all. V19 put the
 * season inside both of {@code league_race}'s foreign keys precisely so that nobody has to
 * remember it, and {@link #howManyOfThemPairWithTheLeaguesSeason} asks the database the
 * same pairing its own key declares rather than reading a year off a day.
 * </ul>
 *
 * <p><b>THE ADDRESS IS TYPED AND NOT WORKED OUT, WHICH IS THE OPPOSITE OF AN EVENT'S.</b>
 * {@link EventWriteApi} builds a slug out of a name and a year because the owner said an
 * event's address is exactly those two things; a league's is a field of its own form and
 * always has been („A league is filed under an id nobody sees and answers at an address
 * somebody chose", {@code AdminLeagues.tsx}). So {@code EventAddress} is not reached for
 * here, and what is checked is the shape the schema checks ({@code league_slug_shape}) and
 * whether somebody already answers at it.
 *
 * <p><b>WHAT IS NOT HERE, EACH NAMED RATHER THAN DISCOVERED.</b>
 *
 * <ul>
 * <li><b>An administrator.</b> See above: the column is gone and the role with it.
 * <li><b>A way of grouping.</b> „Lige treba da imaju poredak samo po polu. Ne zelim
 * dodatna pravila" (owner, 31.08.2026, said of every league), so there is no column and
 * nothing here invents one.
 * <li><b>Scoring of its own.</b> „Svaka Liga se boduje istim BTL bodovima" (V14).
 * <li><b>A refusal of the address {@code btl-<year>}.</b> The Balkan league is not stored,
 * so a competition saved under that address would appear on the public list beside the
 * others - and refusing it here would be a rule of MY OWN, invented in the same breath as
 * a decision and looking exactly like one. It is written down as a boundary instead.
 * <li><b>Telling anybody.</b> Nothing here writes a row into {@code message}. The same
 * answer {@link EventWriteApi} gives, and for the owner's same word of 11.08.2026.
 * </ul>
 */
@RestController
class LeagueWriteApi {

	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	static final String THE_ADDRESS_IS_NOT_SHAPED = "theAddressIsNotShaped";

	static final String THE_ADDRESS_IS_TAKEN = "theAddressIsTaken";

	/** PDL P15a: a league is made for „tekucu ili narednu" year and for no other. */
	static final String THE_SEASON_IS_NOT_THIS_ONE_OR_THE_NEXT = "theSeasonIsNotThisOneOrTheNext";

	/** PDL P15a: „Posle zamrzavanja sezone liga se NE MENJA." */
	static final String THE_SEASON_IS_FROZEN = "theSeasonIsFrozen";

	/**
	 * The one refusal here that is the SCHEMA'S and not the owner's, named so that it
	 * arrives as a sentence rather than as a 500 (see {@link #change}).
	 */
	static final String THE_SEASON_CANNOT_MOVE_WHILE_RACES_COUNT =
			"theSeasonCannotMoveWhileRacesCount";

	static final String THE_RACE_IS_NOT_SAID_ONCE = "theRaceIsNotSaidOnce";

	static final String THE_RACE_IS_NOT_KNOWN = "theRaceIsNotKnown";

	static final String THE_EVENT_IS_NOT_KNOWN = "theEventIsNotKnown";

	static final String THE_EVENT_HOLDS_NO_RACES = "theEventHoldsNoRaces";

	/** V19's two composite keys, said in words rather than met as a constraint violation. */
	static final String THE_RACE_IS_NOT_OF_THE_LEAGUES_SEASON = "theRaceIsNotOfTheLeaguesSeason";

	/**
	 * The shape {@code league_slug_shape} checks, written here so that a typed address is
	 * refused with a sentence instead of arriving as a 500 from the check constraint.
	 *
	 * <p>It is the same expression the schema holds and {@code LeagueConstraintsTest} is
	 * what says the schema still holds it; this is the sentence, never the floor.
	 */
	private static final Pattern AN_ADDRESS = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");

	private final JdbcClient db;

	/**
	 * The moment, off the bean rather than off {@code ZonedDateTime.now()}, for the reason
	 * {@code WhatTimeItIs} gives: both sides of a freeze and both sides of a New Year have
	 * to be measurable on a day that is not 1 January.
	 */
	private final Clock clock;

	/**
	 * Written by hand for {@link #countRaces}, which is the one place here that may write
	 * more than one row: an event chosen on the screen writes every race of that day
	 * (V19), and half a day entered is worse than none.
	 */
	private final TransactionTemplate inOneTransaction;

	LeagueWriteApi(JdbcClient db, Clock clock, TransactionTemplate inOneTransaction) {
		this.db = db;
		this.clock = clock;
		this.inOneTransaction = inOneTransaction;
	}

	/**
	 * WHAT THE FORM SENDS, which is what {@code admin-liga.form.json} asks for and nothing
	 * besides.
	 *
	 * @param slug   the address it answers at, TYPED and not worked out - see the head of
	 *               this class
	 * @param rules  what the competition is about, written by whoever runs it. NOT NULL in
	 *               the schema and allowed to be empty, which is a competition announced
	 *               before its propositions are written
	 * @param prizes what is won in it, on the same terms
	 */
	record Upsert(String name, String slug, Integer season, String rules, String prizes) {
	}

	/** Which race, or which whole day of them. Exactly one of the two. */
	record Counting(Long raceId, Long eventId) {
	}

	/** Why something could not be written. */
	record Refused(String reason) {
	}

	record Written(long id, String slug) {
	}

	/** A league as it stands, which is what decides whether it may be changed at all. */
	private record Standing(long id, int season) {
	}

	@PostMapping("/api/leagues")
	@RightIsNeeded("entity:leagues")
	ResponseEntity<?> add(@RequestBody Upsert typed) {
		ResponseEntity<?> wrong = whatIsWrongWith(typed, null);

		if (wrong != null) {
			return wrong;
		}

		/* ASKED ONCE, BY THE INDEX ITSELF, which is the shape `EventWriteApi` uses for a
		   taken address and the reason it gives: a `select` and an `insert` are two
		   moments, and a second request arriving between them reads the same empty answer
		   and leaves the first to collide with `league_slug_unique`. */
		Optional<Long> written = db.sql("insert into league (slug, name, season, rules, prizes)"
						+ " values (?, ?, ?, ?, ?) on conflict (slug) do nothing returning id")
				.params(typed.slug(), typed.name().strip(), typed.season(),
						orEmpty(typed.rules()), orEmpty(typed.prizes()))
				.query(Long.class).optional();

		return written.<ResponseEntity<?>>map(id -> ResponseEntity.status(HttpStatus.CREATED)
						.body(new Written(id, typed.slug())))
				.orElseGet(() -> no(HttpStatus.CONFLICT, THE_ADDRESS_IS_TAKEN));
	}

	/**
	 * CHANGING ONE, UNLESS ITS SEASON HAS FROZEN.
	 *
	 * <p><b>Owner, PDL P15a, 22.09.2026:</b> the change is „odbija, i kaze se zasto". His
	 * reason is the one P10b was given on the same morning: a league's table is always
	 * computed off the current list of races (PDL:2115) while a frozen season is a nailed
	 * down record and not a calculation (PDL:1054), so a league edited after the freeze
	 * leaves the history and the live table saying different things with nothing to report
	 * it. He was shown what it costs - „greska u spisku trka iz 2027. se posle 1.1.2028. u
	 * 16h ne moze ispraviti kroz portal" - and took it.
	 *
	 * <p><b>THE FROZEN QUESTION IS ASKED OF THE ROW'S SEASON AND THE OTHER OF THE FORM'S,
	 * and that is the whole of why there are two.</b> A request may name a season different
	 * from the one the league carries; asked of the form's season alone, a league of a
	 * frozen year would be editable by sending a live year with the edit, which is the one
	 * request the decision exists to refuse.
	 *
	 * <p><b>AND THE SEASON CANNOT MOVE UNDER A LEAGUE THAT COUNTS RACES, which is the
	 * SCHEMA speaking and not a rule of the owner's.</b> {@code league_race_league_fk}
	 * points at {@code league (id, season)} and carries no {@code on update cascade}
	 * (V19), so rewriting {@code league.season} while a single row counts towards it is a
	 * constraint violation. Moving the rows with it is not a second option either: they
	 * would then name races of the old year, which {@code league_race_race_fk} refuses
	 * from the other side. So the only question is whether an administrator is told why or
	 * meets a 500 after filling in a form, and this portal has answered that question the
	 * same way since {@code EventWriteApi} („Left to the database, every one of these would
	 * arrive as a 500").
	 */
	@PutMapping("/api/leagues/{id}")
	@RightIsNeeded("entity:leagues")
	ResponseEntity<?> change(@PathVariable long id, @RequestBody Upsert typed) {
		return inOneTransaction.execute(committing -> {
			Optional<Standing> before = theLeague(id);

			/* THE SAME ANSWER SOMEBODY WITHOUT THE RIGHT GETS, which is ADL A8 applied to
			   a row rather than to a route. */
			if (before.isEmpty()) {
				return no(HttpStatus.NOT_FOUND, null);
			}

			if (SeasonClock.isFrozen(before.get().season(), now())) {
				return no(HttpStatus.CONFLICT, THE_SEASON_IS_FROZEN);
			}

			ResponseEntity<?> wrong = whatIsWrongWith(typed, before.get().season());

			if (wrong != null) {
				return wrong;
			}

			if (addressIsTakenBySomebodyElse(typed.slug(), id)) {
				return no(HttpStatus.CONFLICT, THE_ADDRESS_IS_TAKEN);
			}

			int wasSeason = before.get().season();

			if (typed.season() != wasSeason && countsAnything(id)) {
				return no(HttpStatus.CONFLICT, THE_SEASON_CANNOT_MOVE_WHILE_RACES_COUNT);
			}

			db.sql("update league set slug = ?, name = ?, season = ?, rules = ?, prizes = ?"
							+ " where id = ?")
					.params(typed.slug(), typed.name().strip(), typed.season(),
							orEmpty(typed.rules()), orEmpty(typed.prizes()), id)
					.update();

			return ResponseEntity.ok(new Written(id, typed.slug()));
		});
	}

	/**
	 * AND TAKING ONE AWAY, WHATEVER SEASON IT BELONGS TO AND WHETHER OR NOT IT HAS FROZEN.
	 *
	 * <p><b>Owner, PDL P15c, 22.09.2026</b>, choosing between three outcomes: a competition
	 * running alongside is deleted at any moment, frozen season or not. He overturned the
	 * cost I put on it and he was right to: V17 had already provided for this.
	 * {@code season_league_standing.league_id} is nullable with {@code on delete set null},
	 * {@code league_name} is NOT NULL and is a copy carried on the frozen row, and V17's own
	 * heading says it in as many words - the league „may be deleted and the standing stays,
	 * with the league's name on it".
	 *
	 * <p><b>Which is why nothing here empties anything by hand, and that is the decision
	 * rather than an omission.</b> {@code league_race_league_fk} cascades and the standing's
	 * key empties itself; a statement written here would be a second answer to a question
	 * the schema has already answered, and on the day the two disagreed the schema would win
	 * silently. The same sentence {@link EventWriteApi#remove} carries.
	 *
	 * <p><b>Why this is not in conflict with a frozen league refusing to be CHANGED.</b> An
	 * edit moves what the live table computes while the frozen record stays as it was, so
	 * the two end up saying different things. A deletion moves nothing the snapshot ever
	 * read: it carries its own copy of the name. The difference is measured and not felt,
	 * and {@code LeagueWriteApiTest} deletes a league that a frozen standing points at and
	 * then reads the standing back.
	 */
	@DeleteMapping("/api/leagues/{id}")
	@RightIsNeeded("entity:leagues")
	ResponseEntity<?> remove(@PathVariable long id) {
		int gone = db.sql("delete from league where id = ?").param(id).update();

		return gone == 0 ? no(HttpStatus.NOT_FOUND, null) : ResponseEntity.noContent().build();
	}

	/**
	 * A RACE ENTERING A COMPETITION, ONE AT A TIME, OR A WHOLE DAY OF THEM AT ONCE.
	 *
	 * <p><b>Owner, PDL P15a, 22.09.2026:</b> „Sve trke su u BTL kalendaru. A u opsege liga
	 * ulaze dogadjaji koji postoje u kalendaru. <b>Mogu ih dodati sa strane lige, preko
	 * opcije +, jednu po jednu.</b> Uzmi u obzir da <b>mogu dodavati trke u ligu i tokom
	 * godine te lige</b>." So this is an addition and never a replacement of a list: what
	 * is already counted stays counted.
	 *
	 * <p><b>AN EVENT IS A CONVENIENCE AND A RACE IS THE FACT (V19, owner 12.09.2026).</b>
	 * „selekcijom dogadjaja, selektujem automatski i sve njegove trke, a mogu i samo da
	 * selektujem neku od trka." Choosing the day writes every race of it; nothing about the
	 * day itself is stored, so a race entered later under an event that was chosen whole
	 * does NOT join the league by itself, and that is the point of storing the race.
	 *
	 * <p><b>One of the two and never both</b>, which is the shape
	 * {@link EventWriteApi} answers a town with and for the same reason: accepting both and
	 * using one would tell the caller his choice was kept.
	 *
	 * <p><b>ALL OF THE DAY OR NONE OF IT.</b> An event may run over more than one morning
	 * (V7) and nothing stops those mornings falling either side of a New Year, so a day
	 * chosen whole can hold races of two seasons. Writing the ones that fit and dropping the
	 * rest would be a league that quietly counts half a day, so the count is asked before
	 * anything is written and the whole request is refused.
	 *
	 * <p><b>AND AFTER THE SEASON FREEZES, NO.</b> Owner, PDL P15a, on his own sentence
	 * about adding during the year: „dodavanje <b>tokom</b> sezone je dozvoljeno, dodavanje
	 * <b>posle zamrzavanja</b> nije." It is the same refusal {@link #change} makes and for
	 * the same reason - a race added to a frozen season changes what the live table computes
	 * and leaves the record saying something else.
	 *
	 * <p><b>Writing the same pair twice is not an error and not a second fact</b>, which is
	 * {@code league_race_pk} speaking; {@code on conflict do nothing} says it to this
	 * statement instead of letting a second press of a button become a 500.
	 */
	@PostMapping("/api/leagues/{id}/races")
	@RightIsNeeded("entity:leagues")
	ResponseEntity<?> countRaces(@PathVariable long id, @RequestBody Counting asked) {
		boolean oneRace = asked.raceId() != null;
		boolean aWholeDay = asked.eventId() != null;

		if (oneRace == aWholeDay) {
			return no(HttpStatus.BAD_REQUEST, THE_RACE_IS_NOT_SAID_ONCE);
		}

		return inOneTransaction.execute(committing -> {
			Optional<Standing> league = theLeague(id);

			if (league.isEmpty()) {
				return no(HttpStatus.NOT_FOUND, null);
			}

			if (SeasonClock.isFrozen(league.get().season(), now())) {
				return no(HttpStatus.CONFLICT, THE_SEASON_IS_FROZEN);
			}

			long named = oneRace ? countOf("select count(*) from race where id = ?",
					asked.raceId()) : countOf("select count(*) from race where event_id = ?",
					asked.eventId());

			if (named == 0) {
				return oneRace ? no(HttpStatus.BAD_REQUEST, THE_RACE_IS_NOT_KNOWN)
						: no(HttpStatus.BAD_REQUEST, theEventIsThereAtAll(asked.eventId()));
			}

			if (howManyOfThemPairWithTheLeaguesSeason(id, asked) < named) {
				return no(HttpStatus.CONFLICT, THE_RACE_IS_NOT_OF_THE_LEAGUES_SEASON);
			}

			db.sql("insert into league_race (league_id, season, race_id)"
							+ " select l.id, l.season, r.id from league l join race r"
							+ " on r.season = l.season"
							+ " where l.id = ? and " + whichRaces(oneRace)
							+ " on conflict on constraint league_race_pk do nothing")
					.params(id, oneRace ? asked.raceId() : asked.eventId())
					.update();

			return ResponseEntity.noContent().build();
		});
	}

	/**
	 * AND A RACE LEAVING ONE, AT ANY MOMENT AT ALL.
	 *
	 * <p><b>Owner, PDL P15c, 22.09.2026</b>, choosing between three outcomes and in his own
	 * words: „Pod 2, mogu da je izbacim rucno." Asked in the same breath as the question
	 * about a frozen season, so „u bilo kom trenutku" is his answer to that question and not
	 * an oversight - which is why nothing here asks {@link SeasonClock#isFrozen} although
	 * the route beside it does.
	 *
	 * <p><b>It takes the race out of THIS league and out of no other.</b> One race may count
	 * towards several competitions of the same season (owner, 12.09.2026), which is why
	 * {@code league_race_pk} is over the pair and not over the race, and why the statement
	 * below names both halves of it.
	 *
	 * <p>404 where the pair is not there covers three things with one answer, deliberately:
	 * no such league, no such race, and a race that never counted towards this one. Telling
	 * them apart would be telling somebody who may not be here which of the three it is.
	 */
	@DeleteMapping("/api/leagues/{id}/races/{raceId}")
	@RightIsNeeded("entity:leagues")
	ResponseEntity<?> stopCountingARace(@PathVariable long id, @PathVariable long raceId) {
		int gone = db.sql("delete from league_race where league_id = ? and race_id = ?")
				.params(id, raceId).update();

		return gone == 0 ? no(HttpStatus.NOT_FOUND, null) : ResponseEntity.noContent().build();
	}

	/**
	 * WHAT IS WRONG WITH THIS FORM, or null.
	 *
	 * <p>One home for both routes, because a league written and a league changed are the
	 * same row with the same rules; two copies would be two answers the day one of them was
	 * edited. The same sentence {@link EventWriteApi} carries over its own pair.
	 *
	 * @param wasSeason the season the league carries already, or null where there is no
	 *                  league yet - which is what parts „this season is being set" from
	 *                  „this season is being left alone"
	 */
	private ResponseEntity<?> whatIsWrongWith(Upsert typed, Integer wasSeason) {
		if (isNothing(typed.name()) || isNothing(typed.slug()) || typed.season() == null) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		if (!AN_ADDRESS.matcher(typed.slug()).matches()) {
			return no(HttpStatus.BAD_REQUEST, THE_ADDRESS_IS_NOT_SHAPED);
		}

		/* ASKED ONLY OF A SEASON THAT IS BEING SET, WHICH IS MY OWN READING AND IS MARKED
		   AS ONE.

		   PDL P15a's first decision is about MAKING a league: „liga se pravi za tekucu ili
		   narednu" year. The decision that governs changing one is the second, and it names
		   one moment - after the season freezes, the league is not changed. Asked of every
		   edit, this check would refuse more than either of them says, and the gap is not
		   theoretical: a season freezes at 16:00 on 1 January of the year AFTER it, while
		   the running year turns at midnight, so for sixteen hours a league of the season
		   just ended is neither „this one or the next" nor frozen. In that window an edit
		   that changed only a name would be refused, and refused with the wrong sentence.

		   So what is asked is whether the season is being MOVED, and an edit that leaves it
		   where it stands is not setting it. Nothing is loosened by this: a season that
		   moves is asked the whole question, {@link #change} refuses to move one under a
		   league that counts races at all, and a frozen league is refused before this method
		   is reached. */
		if (!typed.season().equals(wasSeason)
				&& !SeasonClock.aLeagueMayBeMadeFor(typed.season(), now())) {
			return no(HttpStatus.BAD_REQUEST, THE_SEASON_IS_NOT_THIS_ONE_OR_THE_NEXT);
		}

		return null;
	}

	/**
	 * HOW MANY OF THE RACES THIS REQUEST NAMES PAIR WITH THIS LEAGUE'S SEASON.
	 *
	 * <p><b>The year is never read off a day here and never compared in Java.</b> V19 put
	 * the season into both of {@code league_race}'s foreign keys so that „a league of one
	 * year cannot count a race of another" is the database's sentence and not something
	 * anybody has to remember, and {@code race.season} is a GENERATED column off
	 * {@code race.date} so it cannot disagree with the day. What is asked below is that same
	 * pairing, {@code r.season = l.season}, written once and used both to count and to
	 * write.
	 *
	 * <p><b>Which leaves the schema as the floor and this as the sentence.</b> Drop the join
	 * condition from the write below and the row is handed to PostgreSQL, which refuses it
	 * on {@code league_race_race_fk}; the administrator then meets a 500 instead of being
	 * told which race does not belong. That is the mutation this method exists against, and
	 * it is the one {@code LeagueWriteApiTest} runs.
	 */
	private long howManyOfThemPairWithTheLeaguesSeason(long id, Counting asked) {
		boolean oneRace = asked.raceId() != null;

		return countOf("select count(*) from league l join race r on r.season = l.season"
						+ " where l.id = ? and " + whichRaces(oneRace),
				id, oneRace ? asked.raceId() : asked.eventId());
	}

	/**
	 * Which races of the calendar this request is about, as the one fragment both the count
	 * and the write are built from.
	 *
	 * <p>Two literals chosen between rather than a string built out of anything a caller
	 * sent: what varies is the COLUMN and not a value, and the value stays a parameter in
	 * both branches.
	 */
	private static String whichRaces(boolean oneRace) {
		return oneRace ? "r.id = ?" : "r.event_id = ?";
	}

	/**
	 * Which of the two things is missing when a day names no race: the event, or the races
	 * under it.
	 *
	 * <p>Two sentences rather than one, because they send an administrator to two different
	 * places: a key nothing answers to is a form that is wrong, and an event entered before
	 * its distances are known (owner, 23.08.2026) is a real state of the calendar that he
	 * fixes by entering them.
	 */
	private String theEventIsThereAtAll(long eventId) {
		return countOf("select count(*) from btl_event where id = ?", eventId) == 0
				? THE_EVENT_IS_NOT_KNOWN : THE_EVENT_HOLDS_NO_RACES;
	}

	private Optional<Standing> theLeague(long id) {
		return db.sql("select id, season from league where id = ?").param(id)
				.query((row, one) -> new Standing(row.getLong(1), row.getInt(2)))
				.optional();
	}

	/**
	 * Whether this address belongs to a DIFFERENT league.
	 *
	 * <p>{@code id <> ?} is the whole of it and is why this is not the question {@link #add}
	 * asks: an edit that leaves the address alone finds its own row, and refusing there
	 * would make a league impossible to save twice.
	 */
	private boolean addressIsTakenBySomebodyElse(String address, long id) {
		return Boolean.TRUE.equals(db.sql(
						"select exists(select 1 from league where slug = ? and id <> ?)")
				.params(address, id).query(Boolean.class).single());
	}

	private boolean countsAnything(long id) {
		return countOf("select count(*) from league_race where league_id = ?", id) > 0;
	}

	private long countOf(String question, Object... about) {
		return db.sql(question).params(about).query(Long.class).single();
	}

	/** The moment, re-read in the league's own zone, which is never the server's. */
	private ZonedDateTime now() {
		return clock.instant().atZone(SeasonClock.ZONE);
	}

	private static boolean isNothing(String value) {
		return value == null || value.isBlank();
	}

	/** {@code rules} and {@code prizes} are NOT NULL and may be empty (V14). */
	private static String orEmpty(String value) {
		return value == null ? "" : value.strip();
	}

	/**
	 * A refusal, with a reason where there is one to give.
	 *
	 * <p>404 carries no body, which is the shape {@link RightsAtTheDoor} answers a refused
	 * moderator with: a league somebody may not touch and one that is not there have to read
	 * the same, and a reason is something only one of them could have.
	 */
	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return reason == null ? ResponseEntity.status(status).build()
				: ResponseEntity.status(status).body(new Refused(reason));
	}
}
