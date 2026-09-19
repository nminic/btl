package com.btl.portal.web;

import com.btl.portal.domain.event.EventAddress;
import com.btl.portal.domain.event.WhatARaceCarries;
import com.btl.portal.domain.event.WhatAnEventCarries;
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

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * AN ADMINISTRATOR PUTTING A RACE UNDER AN EVENT, CHANGING IT, AND TAKING IT OUT.
 *
 * <p>The other half of {@link EventWriteApi}, which said in as many words that this did
 * not exist yet. Everything about who may call it is that class's sentence and is not
 * repeated: {@code @RightIsNeeded("entity:events")}, refused with 404 rather than 403
 * (ADL, owner 13.09.2026), and never a queue.
 *
 * <p><b>THE RIGHT IS {@code entity:events} AND NOT ONE OF ITS OWN, WHICH IS A DECISION
 * AND NOT A SHORTCUT.</b> PDL, 06.08.2026 and confirmed 11.08.2026: in the matrix of
 * rights „trke i znacke su ispale, jer nemaju svoj ekran: trka se definise unutar
 * dogadjaja". {@code admin_right} (V5) accordingly holds no {@code entity:races} row, and
 * {@code RightsAtTheDoorTest.everyRightARouteAsksForIsOneTheMatrixHolds} would fail on a
 * code invented here - a misspelt right is refused to every moderator and ALLOWED to the
 * superadmin, whose mode answers yes to any string at all.
 *
 * <p><b>THE WHOLE POINT OF THIS CLASS IS THE EVENT'S DAY, AND IT IS NOT A SECOND
 * FACT.</b> Owner, 10.08.2026: „Datum dogadjaja nije zaseban podatak nego dan prve trke
 * ... Trka uneta ili pomerena na raniji dan ne pravi gresku: dogadjaj tog trenutka
 * pocinje ranije i njegov datum je taj dan", and in his own words, „Datum dogadjaja uvek
 * postaje datum prve od trka." So each of the three routes below ends the same way:
 * {@code btl_event.date} is set to the earliest day any race of that event runs on. It
 * moves BACKWARDS when a race is entered or moved onto an earlier morning, and FORWARDS
 * when the race that was first is moved away or deleted - „uvek" is the owner's word and
 * it has no direction in it.
 *
 * <p><b>AND SO THE ADDRESS MOVES WITH IT WHEN THE YEAR DOES.</b> Owner, 10.08.2026:
 * „Adresa dogadjaja je naziv i godina", and an event moved inside its season keeps its
 * address. {@link EventAddress#keptOrRebuilt} is asked with the SAME NAME on both sides,
 * so it rebuilds exactly when the year moves and keeps the stored address otherwise -
 * including an imported one carrying a month, which no rule here could rebuild. This is
 * the portal's own behaviour and not a new rule: measured on the prototype on 23.08.2026
 * ({@code frontend/src/pages/adminEntities.test.tsx}, „confirms the day and the address it
 * really wrote, not the ones on the form"), where an event filed on 30.12.2026 through a
 * race was carrying {@code -2027} and „a copy made from it would have gone on carrying
 * it". The same screen measured the other half the same day, „refuses the address it
 * would write, not the one on the form": a rebuilt address another event already answers
 * at is refused, because „a result finds its event by the address".
 *
 * <p><b>AN EVENT LEFT WITH NO RACE AT ALL KEEPS THE DAY IT HAS, and that is a decision
 * with a boundary on each side.</b>
 *
 * <ul>
 * <li><b>One side:</b> delete the race of 02.06.2027 from an event that still runs on
 * 03.06.2027, and the event's day becomes 03.06.2027. There is a first race, so the
 * owner's rule answers and is obeyed.
 * <li><b>The other side:</b> delete the LAST race, and the event's day stays where it
 * was. „Dan prve trke" has no answer when there is no race, and the alternatives are
 * worse than useless: the column is NOT NULL (V7) so nothing can be cleared, and today's
 * date would file the event on a morning nothing has to do with it.
 * </ul>
 *
 * <p>It is also not a state the portal has to be taught. Owner, 23.08.2026: „Skup i
 * Trening nemaju trke", and „Skupovi ostaju jedini dogadjaji bez trka" - an event with no
 * race under it and a date of its own is an ordinary row that {@link EventWriteApi}
 * already writes, and one the calendar already draws. Deleting the last race leaves the
 * event in exactly that shape rather than in a new one.
 *
 * <p><b>AND A RACE IS ONLY EVER ENTERED UNDER AN EVENT THAT IS A RACE.</b> Owner,
 * 23.08.2026: „Kad se za Vrstu dogadjaja izabere Skup ili Trening, donja sekcija „Trke na
 * dogadjaju" ne postoji i trke se ne mogu dodavati." The screen takes the section away;
 * this refuses the write, because a rule that lives only in the screen is a rule the next
 * screen does not have.
 *
 * <p><b>WHAT IS NOT HERE, EACH NAMED RATHER THAN DISCOVERED.</b>
 *
 * <ul>
 * <li><b>Moving a race to another event.</b> Owner, 11.08.2026: „Forma trke se otvara pod
 * tek napravljenim dogadjajem, bez pitanja kom dogadjaju trka pripada: odgovor je na
 * strani iznad nje, a pitanje ciji odgovor stoji iznad njega je pitanje sa dostupnim
 * pogresnim odgovorom." So {@code eventId} sent to {@link #change} naming a different
 * event is REFUSED rather than dropped, which is the same choice {@link EventWriteApi}
 * makes for a country sent beside a codebook town: accepting the field and ignoring it
 * would tell the caller his choice was kept.
 * <li><b>Renaming an event onto the races that still carry its name.</b> Owner,
 * 23.08.2026: a race that still carries the default name follows its event, one renamed
 * by hand does not, „a ne poredi se sa nazivom dogadjaja". {@code renamed} is the field
 * that records it and this class writes it; the CASCADE belongs to
 * {@link EventWriteApi#change} and nothing on this server does it yet, which is a fault
 * of that route and not a thing this one left half done.
 * <li><b>Deleting the races of an event turned into a gathering.</b> The other half of
 * the owner's sentence above, and it is {@link EventWriteApi#change}'s to do.
 * <li><b>Any bound the FORM holds and the schema does not.</b> The table that enters
 * races refuses a distance over 1000 km and a climb over 30000 m
 * ({@code raceRows.ts}, {@code BOUNDS}). Those are the form's and are not copied here: a
 * number this class refused and the table would have held is a third voice with nothing
 * under it. What IS refused is what V7 refuses, each turned into a sentence.
 * </ul>
 *
 * <p><b>Deleting is ONE statement, and that is a decision rather than an omission.</b>
 * Owner, 24.08.2026, in as many words: „Brisanje trke treba da pobrise i njene
 * rezultate." V7 already says so: {@code result_race_fk} cascades over
 * {@code (race_id, race_date)}. Measured in this commit rather than assumed, because two
 * more tables have grown a reference to a race since: {@code result_submission_race_fk}
 * (V10) is {@code on update cascade on delete cascade} over the same pair, and
 * {@code league_race_race_fk} (V19) is {@code on delete cascade} over
 * {@code (race_id, season)}. So a {@code delete from result} written here would be a
 * second place answering a question the schema has already answered, and the day the two
 * disagreed the schema would win silently.
 */
@RestController
class RaceWriteApi {

	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	static final String THE_EVENT_IS_NOT_KNOWN = "theEventIsNotKnown";

	static final String THE_EVENT_HOLDS_NO_RACES = "theEventHoldsNoRaces";

	static final String THE_RACE_CANNOT_CHANGE_EVENTS = "theRaceCannotChangeEvents";

	static final String THE_KIND_IS_NOT_KNOWN = "theKindIsNotKnown";

	static final String THE_LIMIT_BELONGS_TO_A_TIMED_RACE = "theLimitBelongsToATimedRace";

	static final String THE_DISTANCE_BELONGS_TO_A_RACE_OF_A_LENGTH =
			"theDistanceBelongsToARaceOfALength";

	static final String THE_DISTANCE_IS_NOT_KEPT_EXACTLY = "theDistanceIsNotKeptExactly";

	static final String THE_CLIMB_OR_THE_FALL_IS_NEGATIVE = "theClimbOrTheFallIsNegative";

	static final String THE_RACE_COUNTS_IN_A_LEAGUE_OF_ITS_SEASON =
			"theRaceCountsInALeagueOfItsSeason";

	static final String THE_ADDRESS_IS_TAKEN = "theAddressIsTaken";

	/** What a race that fixes no measure of that sort carries (V7, and PDL on 0/0). */
	private static final BigDecimal NO_DISTANCE = BigDecimal.ZERO;

	private static final int NO_LIMIT = 0;

	private final JdbcClient db;

	/**
	 * Written by hand rather than left on the method, the same choice
	 * {@link EventWriteApi} made and for the same reason: writing a race and moving the
	 * day its event begins on is one thing that must all happen or none of it.
	 */
	private final TransactionTemplate inOneTransaction;

	RaceWriteApi(JdbcClient db, TransactionTemplate inOneTransaction) {
		this.db = db;
		this.inOneTransaction = inOneTransaction;
	}

	/**
	 * WHAT THE FORM SENDS.
	 *
	 * <p>There is no {@code category}, because a race carries one and it is the length and
	 * nothing else, by the exact value and with no tolerance (PDL): {@code race.category}
	 * is a generated column in V7 and the owner took the column off the screen on
	 * 23.08.2026, „U dodavanju trka na dogadjaju (administriranje) ne treba da postoji
	 * Kategorija kolona ipak". Asking for it would be a second answer to a question the
	 * table already answers.
	 *
	 * <p><b>The defaults below are {@link #add}'s, and since ADL A54 they are ONLY
	 * {@link #add}'s.</b> On entry every field but {@code eventId} may be left out and
	 * each default is the owner's rather than a convenience. On {@link #change} a field
	 * left out is refused instead, because a default that fills a blank when a race is
	 * entered overwrites a fact when one is edited; that method's javadoc says which
	 * fields and why the other three are not among them.
	 *
	 * @param eventId       which event this race is one of. Required by {@link #add} and,
	 *                      on {@link #change}, either left out or the event the race is
	 *                      already under
	 * @param name          what the race is called. Left out it is the name of its event
	 *                      (owner, 23.08.2026: „po default-u naziv dogadjaja"); sent
	 *                      blank it is refused, because that name „moze se promeniti, ne
	 *                      obrisati"
	 * @param renamed       whether that name was given by hand, which is what decides
	 *                      whether the race follows its event when the event is renamed
	 *                      (owner, 23.08.2026). Asked of the caller and not worked out
	 *                      here, for the reason the class javadoc gives
	 * @param date          the day this race runs on. Left out it is the day of its event,
	 *                      „svaka trka nosi svoj dan, koji podrazumevano ostaje dan
	 *                      dogadjaja" (owner, 10.08.2026)
	 * @param kind          one of {@link WhatARaceCarries#KINDS}; left out it is a race of
	 *                      a length
	 * @param limitSeconds  how long a timed race lasts, in SECONDS, which is what the
	 *                      record keeps. The table that enters one asks in hours and does
	 *                      the one conversion there is ({@code raceRows.ts})
	 * @param distanceKm    how long a race of a length is
	 * @param ascentM       how much it climbs, and left out it is nought
	 * @param descentM      and how much it falls
	 */
	record Upsert(Long eventId, String name, Boolean renamed, LocalDate date, String kind,
			Integer limitSeconds, BigDecimal distanceKm, Integer ascentM, Integer descentM) {
	}

	/** Why a race could not be written. */
	record Refused(String reason) {
	}

	/**
	 * The same refusal, SAYING WHICH FIELDS WERE LEFT OUT.
	 *
	 * <p>ADL A54 asks for both halves and not just the first: „`PUT` koji ne posalje neko
	 * polje odbija se sa 400, i kaze se sta fali." A 400 that does not name the field
	 * leaves an administrator with a full form and no idea which box the server could not
	 * see.
	 *
	 * <p>{@code reason} is first and carries the same word a {@link Refused} would, so
	 * every caller that reads a refusal by its reason reads this one unchanged; the list
	 * is what is added, not what is swapped. The names in it are the components of
	 * {@link Upsert}, which are the names the JSON uses, so what comes back is the name of
	 * the field the caller failed to send rather than a translation of it.
	 *
	 * <p><b>AND TODAY ONLY {@code /api/races/{id}} SENDS IT, which is measured and not an
	 * intention.</b> {@code PUT /api/events/{id}} and {@code PUT /api/moderators/{id}}
	 * answer a bare {@code {"reason": ...}} with no list at all, so a client written
	 * against this shape must not assume the other two carry it. That half of A54 is
	 * outstanding on those two routes and is carried as separate work; because
	 * {@code reason} is common to both shapes, a client that reads only the reason works
	 * against all three in the meantime.
	 */
	record NotComplete(String reason, List<String> missing) {
	}

	/**
	 * @param eventDate the day the event begins on now that this has landed, which the
	 *                  caller cannot know because it is worked out from every race there
	 *                  is and not from the one he sent
	 * @param eventSlug and the address it answers at, for the same reason
	 */
	record Written(long id, LocalDate eventDate, String eventSlug) {
	}

	/** The event a race hangs off, as it stands before the write decides its day. */
	private record Standing(long id, String slug, String name, LocalDate date, String kind) {
	}

	/** A request that has already been judged good, with every default filled in. */
	private record Checked(String name, boolean renamed, LocalDate date, String kind,
			int limitSeconds, BigDecimal distanceKm, int ascentM, int descentM) {
	}

	@PostMapping("/api/races")
	@RightIsNeeded("entity:events")
	ResponseEntity<?> add(@RequestBody Upsert typed) {
		if (typed.eventId() == null || blank(typed.name())) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		return inOneTransaction.execute(committing -> {
			Optional<Standing> event = theEvent(typed.eventId());

			/* A key the form carries and no row answers to, which is the same shape
			   `EventWriteApi` answers a town nobody has with: a 400 about the form and not
			   a 404 about the race, since the race being written is not the thing that is
			   missing. Left to the database it would be `race_event_fk` and a 500. */
			if (event.isEmpty()) {
				return no(HttpStatus.BAD_REQUEST, THE_EVENT_IS_NOT_KNOWN);
			}

			ResponseEntity<?> wrong = whatIsWrongWith(typed, event.get());

			if (wrong != null) {
				return wrong;
			}

			Checked checked = checked(typed, event.get());
			LocalDate beginning = theDayItWillBeginOn(event.get(), null, checked.date());
			String address = addressFor(event.get(), beginning);

			if (EventWriteApi.addressIsTakenBySomebodyElse(db, address, event.get().id())) {
				return no(HttpStatus.CONFLICT, THE_ADDRESS_IS_TAKEN);
			}

			long written = db.sql("insert into race (event_id, name, renamed, date, kind,"
							+ " limit_seconds, distance_km, ascent_m, descent_m)"
							+ " values (?, ?, ?, ?, ?, ?, ?, ?, ?) returning id")
					.params(event.get().id(), checked.name(), checked.renamed(), checked.date(),
							checked.kind(), checked.limitSeconds(), checked.distanceKm(),
							checked.ascentM(), checked.descentM())
					.query(Long.class).single();

			theEventNowBeginsOn(event.get(), beginning, address);

			return ResponseEntity.status(HttpStatus.CREATED)
					.body(new Written(written, beginning, address));
		});
	}

	/**
	 * CHANGING ONE, INCLUDING THE DAY IT RUNS ON.
	 *
	 * <p><b>The calendar may be changed backwards</b> (owner, 31.07.2026), so nothing here
	 * looks at what day it is. A race run in 2019 is edited exactly like one to be run next
	 * spring.
	 *
	 * <p><b>The results travel with it and nothing here says so.</b>
	 * {@code result_race_fk} and {@code result_submission_race_fk} are both
	 * {@code on update cascade} over {@code (race_id, race_date)}, so the database rewrites
	 * the day on every result and every submission the moment a race is moved. Written any
	 * other way, the reference would be violated and an administrator would meet a 500.
	 *
	 * <p><b>A FIELD LEFT OUT IS REFUSED HERE, AND THAT IS THE ONE PLACE THIS ROUTE IS NOT
	 * {@link #add}.</b> ADL A54, owner, 19.09.2026, on three offered outcomes: „`PUT` koji
	 * ne posalje neko polje odbija se sa 400, i kaze se sta fali. Isto na svakoj upisnoj
	 * ruti portala, bez izuzetka."
	 *
	 * <p><b>THIS IS THE FIRST ROUTE THAT CARRIES A54 IN FULL, and saying otherwise is the
	 * mistake this very decision is about.</b> {@link EventWriteApi#change} BEGAN the
	 * precedent and does not finish it: measured 19.09.2026 on PR 304, it asks for two of
	 * its nine fields, {@code name} and {@code date}, and still overwrites the other four
	 * with defaults written for ENTRY - a {@code PUT /api/events/{id}} carrying only
	 * {@code name}, {@code date} and {@code placeId} answers 200 and turns a
	 * {@code training} into a {@code race}, drops {@code featured}, and empties the
	 * description and the link. Until that measurement this javadoc claimed the precedent
	 * already answered this way, which was untrue in the one direction that matters: a
	 * sentence claiming a precedent that exists only in part is an instruction to the next
	 * reader to make the same mistake, which is what A54 says in as many words. ADL A54
	 * carries the correction and the numbers.
	 *
	 * <p><b>So the other two writing routes are NOT aligned yet.</b>
	 * {@code PUT /api/events/{id}} and {@code PUT /api/moderators/{id}} are carried as a
	 * separate piece of work and are not this branch's to fix. Whoever reads this before
	 * that work has landed should expect them to differ, not copy them.
	 *
	 * <p><b>What was wrong with taking the defaults, and it is why this is a decision and
	 * not a tidy-up.</b> The defaults in {@link #checked} are written for ENTRY: a race
	 * with no name is called after its event, a race with no day runs on its event's day.
	 * Applied to an EDIT they do not fill a blank, they OVERWRITE something. A PUT that
	 * left out {@code date} moved the race onto the event's morning and said 200; and
	 * because {@code result_race_fk} and {@code result_submission_race_fk} are
	 * {@code on update cascade} over {@code (race_id, race_date)}, the database rewrote the
	 * day of every result and every submission of that race along with it. A PUT that left
	 * out {@code name} renamed the race to its event and set {@code renamed} back to false.
	 * Neither said so.
	 *
	 * <p><b>Why this was settled by the owner rather than fixed.</b> The review of PR 300
	 * ran two OPPOSITE mutations - „a race keeps its own day" and „a race takes its event's
	 * day" - and the whole suite passed on both. Two opposite behaviours that both pass is
	 * a question about what the portal MEANS, not a fault in it, so it went to the owner.
	 *
	 * <p><b>Which fields, and why not all nine.</b> Everything {@link #checked} would
	 * otherwise default: {@code name}, {@code renamed}, {@code date}, {@code kind},
	 * {@code ascentM} and {@code descentM}. {@code eventId} is not one, because not naming
	 * an event is the ordinary shape of this form (the event is the page above it) and
	 * naming a DIFFERENT one has its own refusal. {@code limitSeconds} and
	 * {@code distanceKm} are not either, and that is the older decision rather than an
	 * exception to this one: V7 pairs each of them to a kind with a biconditional, so each
	 * is sent exactly when its kind calls for it and REFUSED when it does not. Demanding
	 * them unconditionally would refuse every race of a length for not sending a limit.
	 *
	 * <p><b>Everything else is as sent, which is what a PUT means here.</b> The rules a
	 * form is judged by are the same ones {@link #add} uses, in the same method, so a race
	 * is judged one way whichever door it came through. A portal that grew a second, looser
	 * answer on the edit would let an administrator walk every rule by writing a good race
	 * and then changing it into a bad one.
	 */
	@PutMapping("/api/races/{id}")
	@RightIsNeeded("entity:events")
	ResponseEntity<?> change(@PathVariable long id, @RequestBody Upsert typed) {
		/* BEFORE THE ROW IS LOOKED FOR, which is the order `EventWriteApi#change` keeps:
		   a form that could not be written is answered the same whether the key exists or
		   not, so this says nothing about which races there are. */
		List<String> missing = whatTheEditLeftOut(typed);

		if (!missing.isEmpty()) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST)
					.body(new NotComplete(THE_FORM_IS_NOT_COMPLETE, missing));
		}

		if (blank(typed.name())) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		return inOneTransaction.execute(committing -> {
			Optional<Standing> event = theEventOfTheRace(id);

			/* THE SAME ANSWER SOMEBODY WITHOUT THE RIGHT GETS, and that is deliberate: a
			   race that is not there and one he may not touch say the same thing, which is
			   ADL A8 applied to a row rather than to a route. */
			if (event.isEmpty()) {
				return no(HttpStatus.NOT_FOUND, null);
			}

			if (typed.eventId() != null && typed.eventId() != event.get().id()) {
				return no(HttpStatus.BAD_REQUEST, THE_RACE_CANNOT_CHANGE_EVENTS);
			}

			ResponseEntity<?> wrong = whatIsWrongWith(typed, event.get());

			if (wrong != null) {
				return wrong;
			}

			Checked checked = checked(typed, event.get());

			/* A RACE MAY NOT LEAVE THE SEASON OF A LEAGUE THAT COUNTS IT, and this turns
			   the database's refusal into a sentence rather than a 500. `league_race`
			   carries the season in BOTH of its foreign keys on purpose (V19: „a row that
			   names a league of one year and a race of another satisfies neither"), and
			   `league_race_race_fk` is `on delete cascade` and NOT `on update cascade` -
			   measured against a real PostgreSQL rather than read off the file.

			   Asked of `league_race.season` and not of the year this method works out, so
			   the question is the one the constraint itself asks. */
			if (countsInALeagueOfAnotherSeason(id, checked.date().getYear())) {
				return no(HttpStatus.CONFLICT, THE_RACE_COUNTS_IN_A_LEAGUE_OF_ITS_SEASON);
			}

			LocalDate beginning = theDayItWillBeginOn(event.get(), id, checked.date());
			String address = addressFor(event.get(), beginning);

			if (EventWriteApi.addressIsTakenBySomebodyElse(db, address, event.get().id())) {
				return no(HttpStatus.CONFLICT, THE_ADDRESS_IS_TAKEN);
			}

			db.sql("update race set name = ?, renamed = ?, date = ?, kind = ?, limit_seconds = ?,"
							+ " distance_km = ?, ascent_m = ?, descent_m = ? where id = ?")
					.params(checked.name(), checked.renamed(), checked.date(), checked.kind(),
							checked.limitSeconds(), checked.distanceKm(), checked.ascentM(),
							checked.descentM(), id)
					.update();

			theEventNowBeginsOn(event.get(), beginning, address);

			return ResponseEntity.ok(new Written(id, beginning, address));
		});
	}

	/**
	 * AND TAKING IT OUT, WITH THE RESULTS THAT WERE RUN AT IT.
	 *
	 * <p><b>Owner, 24.08.2026:</b> „Brisanje trke treba da pobrise i njene rezultate." One
	 * statement does the whole of it, for the reason written at the top of this class.
	 *
	 * <p><b>Nobody is told.</b> Owner, 11.08.2026, asked whether a member is notified when
	 * his result disappears with a deleted race, answering in one word: „Ne." So nothing
	 * here writes a row into {@code message}, and that is a decision rather than a thing
	 * left undone.
	 *
	 * <p><b>And it leaves every league that counted it, silently.</b>
	 * {@code league_race_race_fk} (V19) is {@code on delete cascade}, so the standing of a
	 * league changes by one race and nothing says so. That is the schema's decision and
	 * the same one V20 took for a race whose season did not match: the fact stored is the
	 * race, and a race that is gone counts towards nothing.
	 *
	 * <p><b>204 and no body, which means the caller is not told the event's new day.</b>
	 * The shape {@link EventWriteApi#remove} already answers with, and the screen that
	 * deletes a race is looking at the event it was deleted from and re-reads it. Answering
	 * with the day instead would be this route alone inventing a body for a DELETE.
	 */
	@DeleteMapping("/api/races/{id}")
	@RightIsNeeded("entity:events")
	ResponseEntity<?> remove(@PathVariable long id) {
		return inOneTransaction.execute(committing -> {
			Optional<Standing> event = theEventOfTheRace(id);

			if (event.isEmpty()) {
				return no(HttpStatus.NOT_FOUND, null);
			}

			LocalDate beginning = theDayItWillBeginOn(event.get(), id, null);
			String address = addressFor(event.get(), beginning);

			if (EventWriteApi.addressIsTakenBySomebodyElse(db, address, event.get().id())) {
				return no(HttpStatus.CONFLICT, THE_ADDRESS_IS_TAKEN);
			}

			db.sql("delete from race where id = ?").param(id).update();

			theEventNowBeginsOn(event.get(), beginning, address);

			return ResponseEntity.noContent().build();
		});
	}

	/**
	 * THE DAY THE EVENT WILL BEGIN ON ONCE THIS WRITE HAS LANDED.
	 *
	 * <p>Worked out BEFORE anything is written, which is the same order
	 * {@link EventWriteApi#change} keeps and for the same reason: the address is built out
	 * of this day and may be refused, and a refusal that had already written half of itself
	 * would answer 409 and leave the calendar changed.
	 *
	 * <p>{@code exceptRace} is the race this request is changing or taking away, so what is
	 * asked of the table is the races that will still be there. It is null for a race being
	 * entered, since there is nothing yet to leave out - asked as
	 * {@code id is distinct from null}, which every existing row satisfies, rather than
	 * through a key no row is supposed to hold.
	 *
	 * @param andThisRace the day the race will run on, or null where it is being deleted
	 */
	private LocalDate theDayItWillBeginOn(Standing event, Long exceptRace, LocalDate andThisRace) {
		/* The earliest morning as a ROW rather than as `min(date)`, so that "no race at
		   all" is no row instead of one row holding null: the two read alike through a
		   mapper and only one of them is a day. */
		Optional<LocalDate> others = db.sql("select date from race"
						+ " where event_id = ? and id is distinct from cast(? as bigint)"
						+ " order by date limit 1")
				.params(event.id(), exceptRace)
				.query((row, one) -> row.getDate(1).toLocalDate())
				.optional();

		/* THE LAST RACE TAKEN AWAY LEAVES THE DAY WHERE IT IS, for the reason the class
		   javadoc gives: „dan prve trke" has no answer where there is no race, the column
		   is NOT NULL, and an event with no race and a day of its own is the ordinary shape
		   a gathering already has. */
		if (andThisRace == null) {
			return others.orElse(event.date());
		}

		return others.filter(day -> day.isBefore(andThisRace)).orElse(andThisRace);
	}

	/**
	 * The address that event answers at once it begins on that day.
	 *
	 * <p>The SAME NAME on both sides, which is the whole of it: a race cannot rename an
	 * event, so the only thing that can move the address is the year. Asked this way the
	 * rule keeps an imported address carrying a month ({@code gradska-liga-usce-2017-05}),
	 * which no rule here could rebuild and everything joined to it is joined through.
	 */
	private String addressFor(Standing event, LocalDate beginning) {
		return EventAddress.keptOrRebuilt(event.name(), beginning,
				event.name(), event.date(), event.slug());
	}

	/** And writing that day and that address down, which is the one place either is set. */
	private void theEventNowBeginsOn(Standing event, LocalDate beginning, String address) {
		db.sql("update btl_event set date = ?, slug = ? where id = ?")
				.params(beginning, address, event.id())
				.update();
	}

	private Optional<Standing> theEvent(long id) {
		return db.sql("select id, slug, name, date, kind from btl_event where id = ?")
				.param(id).query(RaceWriteApi::standing).optional();
	}

	private Optional<Standing> theEventOfTheRace(long race) {
		return db.sql("select e.id, e.slug, e.name, e.date, e.kind from race r"
						+ " join btl_event e on e.id = r.event_id where r.id = ?")
				.param(race).query(RaceWriteApi::standing).optional();
	}

	/** One home for reading an event's standing, since two routes ask for it two ways. */
	private static Standing standing(ResultSet row, int one) throws SQLException {
		return new Standing(row.getLong(1), row.getString(2), row.getString(3),
				row.getDate(4).toLocalDate(), row.getString(5));
	}

	/**
	 * Whether this race is counted by a league of a season other than the one it would be
	 * moved into.
	 *
	 * <p>Read off {@code league_race.season}, which is the column
	 * {@code league_race_race_fk} compares against {@code race.season}, so this asks the
	 * constraint's own question rather than a similar one.
	 */
	private boolean countsInALeagueOfAnotherSeason(long race, int season) {
		return Boolean.TRUE.equals(db.sql("select exists(select 1 from league_race"
						+ " where race_id = ? and season <> ?)")
				.params(race, season).query(Boolean.class).single());
	}

	/**
	 * WHAT IS WRONG WITH THIS FORM, or null.
	 *
	 * <p>One home for both routes, because a race written and a race changed are the same
	 * row with the same rules; two copies would be two answers the day one of them was
	 * edited.
	 *
	 * <p>Every rule here is one V7 also holds, and each is answered as a SENTENCE. Left to
	 * the database every one of them would reach an administrator as a 500 after he had
	 * filled the form in, which is the fault {@code LinkShapeMatchesTheSchemaTest} exists
	 * against one column along.
	 */
	private ResponseEntity<?> whatIsWrongWith(Upsert typed, Standing event) {
		/* AN EVENT THAT IS NOT A RACE HOLDS NO RACES (owner, 23.08.2026), and it is asked
		   before anything about the race itself: what is wrong is the event it was aimed
		   at, and answering about the kind of the RACE would send an administrator to the
		   wrong cell. */
		if (!WhatAnEventCarries.A_RACE.equals(event.kind())) {
			return no(HttpStatus.BAD_REQUEST, THE_EVENT_HOLDS_NO_RACES);
		}

		String kind = kindOf(typed);

		if (!WhatARaceCarries.KINDS.contains(kind)) {
			return no(HttpStatus.BAD_REQUEST, THE_KIND_IS_NOT_KNOWN);
		}

		/* `race_only_a_timed_race_has_a_limit`, V7, said from the request's side: the
		   limit is given exactly where the kind runs to one. A limit sent beside a race of
		   a length is refused rather than dropped, the same choice `EventWriteApi` makes
		   for a country sent beside a codebook town - dropping it would tell the caller his
		   six hours were kept. */
		if (WhatARaceCarries.TO_A_LIMIT.equals(kind) != (typed.limitSeconds() != null)) {
			return no(HttpStatus.BAD_REQUEST, THE_LIMIT_BELONGS_TO_A_TIMED_RACE);
		}

		if (typed.limitSeconds() != null && typed.limitSeconds() <= NO_LIMIT) {
			return no(HttpStatus.BAD_REQUEST, THE_LIMIT_BELONGS_TO_A_TIMED_RACE);
		}

		/* And `race_only_a_length_race_fixes_a_distance` from the same side. */
		if (WhatARaceCarries.OF_A_LENGTH.equals(kind) != (typed.distanceKm() != null)) {
			return no(HttpStatus.BAD_REQUEST, THE_DISTANCE_BELONGS_TO_A_RACE_OF_A_LENGTH);
		}

		if (typed.distanceKm() != null
				&& typed.distanceKm().compareTo(NO_DISTANCE) <= 0) {
			return no(HttpStatus.BAD_REQUEST, THE_DISTANCE_BELONGS_TO_A_RACE_OF_A_LENGTH);
		}

		/* THE ONE RULE HERE THAT IS NOT A CONSTRAINT, because there is no constraint that
		   could be written: a distance the column cannot keep is not refused by PostgreSQL,
		   it is silently ROUNDED, and `race.category` is generated off the rounded value.
		   Since V25 the column keeps four decimals, so what this refuses is a fifth - the
		   owner's „tacna duzina" is kept and what would still be CHANGED on the way in is
		   turned away. The scale itself lives in `WhatARaceCarries` and is held against
		   `information_schema` by `RaceShapesMatchTheSchemaTest`. */
		if (typed.distanceKm() != null
				&& !WhatARaceCarries.distanceIsKeptExactly(typed.distanceKm())) {
			return no(HttpStatus.BAD_REQUEST, THE_DISTANCE_IS_NOT_KEPT_EXACTLY);
		}

		/* `race_ascent_not_negative` and `race_descent_not_negative`, one sentence for
		   both: a course has a climb and a fall whichever way it is run, and neither is
		   asked for at all (owner, 23.08.2026: „uspon i spust nisu obavezni, jer ako su
		   prazni tumace se kao 0/0"), so the only thing that can be wrong with one is its
		   sign. Measured on the portal's own screen before this existed: a climb of minus
		   five hundred metres saved. */
		if (negative(typed.ascentM()) || negative(typed.descentM())) {
			return no(HttpStatus.BAD_REQUEST, THE_CLIMB_OR_THE_FALL_IS_NEGATIVE);
		}

		return null;
	}

	/**
	 * WHAT AN EDIT LEFT OUT, in the order {@link Upsert} carries the fields.
	 *
	 * <p>Every field {@link #checked} would otherwise fill in with an ENTRY default, and
	 * the three that are missing from this list are missing on purpose - the javadoc on
	 * {@link #change} says which and why.
	 *
	 * <p><b>The list is written out by hand and it has a floor in the same commit.</b>
	 * {@code RaceWriteApiTest.anEditMustSendEveryFieldTheFormHas} reads the components of
	 * {@link Upsert} off the record itself, takes the three away, and drives one case per
	 * field that is left. A tenth field added to the form tomorrow is a case that fails
	 * the day it is added rather than a field nobody remembered to require.
	 */
	private static List<String> whatTheEditLeftOut(Upsert typed) {
		List<String> missing = new ArrayList<>();

		if (typed.name() == null) {
			missing.add("name");
		}
		if (typed.renamed() == null) {
			missing.add("renamed");
		}
		if (typed.date() == null) {
			missing.add("date");
		}
		if (typed.kind() == null) {
			missing.add("kind");
		}
		if (typed.ascentM() == null) {
			missing.add("ascentM");
		}
		if (typed.descentM() == null) {
			missing.add("descentM");
		}

		return missing;
	}

	/** The request as it goes into the row, once nothing about it is wrong any more. */
	private static Checked checked(Upsert typed, Standing event) {
		String kind = kindOf(typed);

		return new Checked(
				/* „Po default-u naziv dogadjaja" (owner, 23.08.2026), read off the event
				   rather than off the form: a race entered under an event is named after
				   the event it is entered under and nobody types it. */
				typed.name() == null ? event.name() : typed.name().strip(),
				Boolean.TRUE.equals(typed.renamed()),
				/* „Svaka trka nosi svoj dan, koji podrazumevano ostaje dan dogadjaja"
				   (owner, 10.08.2026). */
				typed.date() == null ? event.date() : typed.date(),
				kind,
				typed.limitSeconds() == null ? NO_LIMIT : typed.limitSeconds(),
				typed.distanceKm() == null ? NO_DISTANCE : typed.distanceKm(),
				orNought(typed.ascentM()),
				orNought(typed.descentM()));
	}

	/** Left out, a race is one of a length (owner's own screen, {@code raceRows.ts}). */
	private static String kindOf(Upsert typed) {
		return typed.kind() == null ? WhatARaceCarries.OF_A_LENGTH : typed.kind();
	}

	private static boolean negative(Integer measure) {
		return measure != null && measure < 0;
	}

	private static int orNought(Integer measure) {
		return measure == null ? 0 : measure;
	}

	/**
	 * A name sent and emptied, which is not the same as a name not sent at all.
	 *
	 * <p>Owner, 23.08.2026: the name „podrazumevano je naziv dogadjaja i moze se promeniti,
	 * ne obrisati". Left out it takes that default; sent as spaces it is somebody having
	 * deleted it, and {@code race_name_not_blank} refuses the row.
	 */
	private static boolean blank(String name) {
		return name != null && name.isBlank();
	}

	/**
	 * A refusal, with a reason where there is one to give.
	 *
	 * <p>404 carries no body, which is the shape {@link RightsAtTheDoor} answers a refused
	 * moderator with: a race somebody may not touch and one that is not there have to read
	 * the same, and a reason is something only one of them could have.
	 */
	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return reason == null ? ResponseEntity.status(status).build()
				: ResponseEntity.status(status).body(new Refused(reason));
	}
}
