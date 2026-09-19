package com.btl.portal.web;

import com.btl.portal.domain.event.EventAddress;
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

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

/**
 * AN ADMINISTRATOR PUTTING AN EVENT INTO THE CALENDAR, CHANGING IT, AND TAKING IT OUT.
 *
 * <p><b>Owner, PDL:</b> „Kalendar pune administratori. Clanovi smeju da predlazu", and
 * „Organizator trke nema nalog ni ulogu na portalu" - events are created by the
 * superadmin and by moderators holding that tick, and by nobody else. That is the whole
 * of what {@code @RightIsNeeded("entity:events")} says here, and the refusal it produces
 * is 404 rather than 403 (ADL A8, owner 13.09.2026), so a moderator without the tick
 * cannot learn from the answer that the action exists.
 *
 * <p><b>A refusal and never a queue.</b> ADL 13.09.2026: „Superadmin pise odmah.
 * Moderator pise odmah ono za sta ima stikliranu privilegiju, a ono za sta je nema ne
 * moze uopste; ne ide u red nego se odbija." The queues are for what MEMBERS send in.
 *
 * <p><b>WHAT IS NOT HERE, EACH NAMED RATHER THAN DISCOVERED.</b>
 *
 * <ul>
 * <li><b>Races.</b> An event holds races and this class does not write them:
 * {@link RaceWriteApi} does, and the owner's rule that an event's date is the day of its
 * first race (PDL, 10.08.2026) is honoured from both sides since then. This one is the
 * side where the EVENT moves and takes its races with it, see {@link #change}; the other
 * is where a race moves and takes the event's day - and its address - with it.
 * <li><b>Renaming an event onto the races that still carry its name.</b> Owner,
 * 23.08.2026: a race that still carries the default name follows its event when the event
 * is renamed, one renamed by hand keeps what it was given, and that is what
 * {@code race.renamed} records. {@link RaceWriteApi} writes the field; nothing here reads
 * it, so an event renamed on this server leaves every race under it called what it was.
 * The screen does it ({@code frontend/src/pages/admin/EventRaces.tsx}) and this server
 * does not, which is a hole in THIS route rather than in the one that writes races.
 * <li><b>Deleting the races of an event turned into a gathering.</b> The other half of
 * the same owner's sentence of 23.08.2026, „Skup i Trening nemaju trke": the screen takes
 * the section away and deletes them on the press, and {@link #change} does not. Until it
 * does, {@link RaceWriteApi} refuses to enter a race under such an event, so the two can
 * only disagree about rows that are already there.
 * <li><b>Copying an event.</b> PDL, 03.08.2026 gives it its own screen and its own
 * rules, including that a copy is never featured (PDL, 11.08.2026), and none of it is
 * written here. {@code copied_from} is therefore only ever null on a row this class
 * writes, which is what an event nobody copied carries.
 * <li><b>Leagues.</b> Which leagues an event counts for is {@code league_event} (V14),
 * which nothing writes today.
 * <li><b>A state.</b> Owner, 10.08.2026, in as many words: „Status dogadjaja ne treba da
 * postoji, podrazumevam logicki da je potvrdjen ako se unosi na portal. Nemoj to vise
 * nigde pratiti." There is no column for one and this class invents none. The same
 * sentence is why there is no „cancel": PDL, 11.08.2026, „Zanemari otkazivanje i trke i
 * dogadjaja. I jedno i drugo treba da moze da se obrise."
 * <li><b>An organiser and an address.</b> Owner, 11.08.2026: „Izbaci organizatora i
 * adresu iz forme." Neither is a field of the request or of the answer.
 * <li><b>Who wrote it.</b> {@code btl_event} carries no column for it, unlike
 * {@code payment}, so unlike {@link PaymentApi} this class never reads the asking
 * account. Writing one down would be a fact with no home.
 * </ul>
 *
 * <p><b>THE ADDRESS IS WORKED OUT AND NEVER TYPED.</b> Owner, 10.08.2026: „Adresa
 * dogadjaja je naziv i godina", and the portal's own form agrees - {@code slug} is a
 * hidden derived field on it, not something anybody fills in. {@link EventAddress}
 * holds the rule and is measured against all 1167 events the portal ships.
 *
 * <p><b>Deleting is ONE statement, and that is a decision rather than an omission.</b>
 * Owner, 03.08.2026: an event is deleted with all of its races, and that is the only
 * action there is. V7 already says so four times over - {@code race_event_fk},
 * {@code attending_event_fk} and {@code event_comment_event_fk} all cascade from this
 * table, and {@code result_race_fk} cascades from the race - so a {@code delete from
 * race} written here would be a second place answering a question the schema has
 * already answered, and the day the two disagreed the schema would win silently.
 */
@RestController
class EventWriteApi {

	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	static final String THE_KIND_IS_NOT_KNOWN = "theKindIsNotKnown";

	static final String THE_TOWN_IS_NOT_SAID_ONCE = "theTownIsNotSaidOnce";

	static final String THE_TOWN_IS_NOT_KNOWN = "theTownIsNotKnown";

	static final String THE_COUNTRY_IS_NOT_KNOWN = "theCountryIsNotKnown";

	static final String THE_COUNTRY_BELONGS_TO_A_TYPED_TOWN = "theCountryBelongsToATypedTown";

	static final String A_TYPED_TOWN_NAMES_ITS_COUNTRY = "aTypedTownNamesItsCountry";

	static final String THE_LINK_IS_NOT_SHAPED = "theLinkIsNotShaped";

	static final String THE_ADDRESS_IS_TAKEN = "theAddressIsTaken";

	private final JdbcClient db;

	/**
	 * Written by hand rather than left on the method, the same choice {@link PaymentApi}
	 * made and for the same reason: changing an event's day and moving its races is one
	 * thing that must all happen or none of it.
	 */
	private final TransactionTemplate inOneTransaction;

	EventWriteApi(JdbcClient db, TransactionTemplate inOneTransaction) {
		this.db = db;
		this.inOneTransaction = inOneTransaction;
	}

	/**
	 * WHAT THE FORM SENDS, which is what {@code admin-dogadjaj.form.json} asks for and
	 * nothing besides.
	 *
	 * <p>There is no {@code slug} and no {@code status}, each for its own reason given
	 * above; no {@code organizer} and no {@code address}, which the owner struck out on
	 * 11.08.2026; and no {@code copiedFrom}, which belongs to a screen this increment
	 * does not build.
	 *
	 * @param placeId a town out of the world codebook, which carries its own country
	 *                (owner, 11.08.2026) - so a country may not be sent beside it. IT IS
	 *                THE NUMBER {@code /api/places} SERVES, which is GeoNames' own and NOT
	 *                {@code place.id}: {@link PlaceApi} selects {@code place.geonames_id},
	 *                so the key is a number no caller has ever been given, and
	 *                {@link RegistrationApi} writes the same sentence beside its own
	 *                {@code placeId}. Until 19.09.2026 this route looked the number up as a
	 *                key, and what that cost was measured over {@code V3__place.sql}: the
	 *                codebook ships 47,016 towns, so a key runs from 1 to 47,016 while a
	 *                mark runs from 362 to 13,697,165. For 46,989 towns an administrator
	 *                was told {@link #THE_TOWN_IS_NOT_KNOWN} about a town the codebook has;
	 *                for the other 27, whose mark falls inside the keys, nothing was said
	 *                at all and ANOTHER town was written down - choosing Shahrak-e Qods
	 *                (mark 362) wrote Kharkiv, Lavāsān (490) wrote Bijie, Alvand (10570)
	 *                wrote Ferencváros
	 * @param city    a town typed by hand instead, which then names its country
	 * @param country the code of that country, {@code RS}, never its key - the same
	 *                spelling {@link CalendarApi} answers with
	 * @param kind    one of {@link WhatAnEventCarries#KINDS}; left out it is a race
	 * @param link    the organiser's own page, which PDL points a member at
	 */
	record Upsert(String name, LocalDate date, Long placeId, String city, String country,
			String kind, Boolean featured, String description, String link) {
	}

	/** Why an event could not be written. */
	record Refused(String reason) {
	}

	/**
	 * @param slug the address it answers at, which the server works out and the caller
	 *             therefore cannot know until it comes back
	 */
	record Written(long id, String slug) {
	}

	/** An event as it stands before an edit, which is what decides the new address. */
	private record Standing(long id, String slug, String name, LocalDate date) {
	}

	/**
	 * Everything about a request that has already been judged good.
	 *
	 * @param placeKey the ROW of the codebook, and deliberately not called {@code placeId}
	 *                 like the field it came from: the request carries GeoNames' mark and
	 *                 the column is a key, and the two being one word is how they came to
	 *                 be mistaken for each other. {@code countryId} beside it is a key for
	 *                 the same reason and has always been one
	 */
	private record Checked(String kind, Long placeKey, String city, Long countryId,
			boolean featured, String description, String link) {
	}

	@PostMapping("/api/events")
	@RightIsNeeded("entity:events")
	ResponseEntity<?> add(@RequestBody Upsert typed) {
		if (isNothing(typed.name()) || typed.date() == null) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		return inOneTransaction.execute(committing -> {
			ResponseEntity<?> wrong = whatIsWrongWith(typed);

			if (wrong != null) {
				return wrong;
			}

			Checked checked = checked(typed);
			String address = EventAddress.of(typed.name(), typed.date());

			/* ASKED ONCE, BY THE INDEX ITSELF, which is the shape `RegistrationApi` uses
			   for a taken address and the reason it gives: a `select` followed by an
			   `insert` are two moments, and a second request arriving between them reads
			   the same empty answer, writes, and leaves the first to collide with
			   `btl_event_slug_unique`. A collision inside a transaction aborts it, so the
			   409 this method wants to answer with could not be written from there. */
			Optional<Long> written = db.sql("insert into btl_event (slug, name, date, place_id,"
							+ " city, country_id, kind, featured, description, link)"
							+ " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
							+ " on conflict (slug) do nothing"
							+ " returning id")
					.params(address, typed.name().strip(), typed.date(), checked.placeKey(),
							checked.city(), checked.countryId(), checked.kind(), checked.featured(),
							checked.description(), checked.link())
					.query(Long.class).optional();

			/* THE OWNER'S OWN SENTENCE, 10.08.2026: „Isti naziv dvaput u istoj godini je
			   sudar adresa i portal ga odbija uz poruku koja to kaze." The imported history
			   carries groups where that happened and theirs carry a month as well; their
			   shape is expressly undecided („do vlasnikove odluke o obliku") and this route
			   never builds one. It refuses, and the form says so. */
			return written.<ResponseEntity<?>>map(id -> ResponseEntity.status(HttpStatus.CREATED)
							.body(new Written(id, address)))
					.orElseGet(() -> no(HttpStatus.CONFLICT, THE_ADDRESS_IS_TAKEN));
		});
	}

	/**
	 * CHANGING ONE, INCLUDING ITS DAY.
	 *
	 * <p><b>The calendar may be changed backwards</b> (owner, 31.07.2026), so nothing
	 * here looks at what day it is. An event run in 2019 is edited exactly like one to be
	 * run next spring.
	 *
	 * <p><b>Moving the day moves the races with it, by the same number of days.</b>
	 * Owner, 10.08.2026: „Kad se datum dogadjaja pomeri, trke se pomeraju sa njim, za isti
	 * broj dana ... Isto vazi i za obicnu ispravku datuma, ne samo za kopiju." That keeps
	 * the shape of a weekend - two races on the Saturday and one on the Sunday stay that
	 * way - and it keeps the owner's other sentence true, that an event's day is the day
	 * of its first race. Results move with the races and nothing here says so:
	 * {@code result_race_fk} is {@code on update cascade} over {@code (race_id,
	 * race_date)}, so the database rewrites every result the moment a race is moved.
	 *
	 * <p>Written without a branch on whether the day moved at all, because adding zero
	 * days is what "it did not move" means, and a branch nothing distinguishes is a branch
	 * nothing can measure.
	 */
	@PutMapping("/api/events/{id}")
	@RightIsNeeded("entity:events")
	ResponseEntity<?> change(@PathVariable long id, @RequestBody Upsert typed) {
		if (isNothing(typed.name()) || typed.date() == null) {
			return no(HttpStatus.BAD_REQUEST, THE_FORM_IS_NOT_COMPLETE);
		}

		return inOneTransaction.execute(committing -> {
			Optional<Standing> before = db.sql(
							"select id, slug, name, date from btl_event where id = ?")
					.param(id)
					.query((row, one) -> new Standing(row.getLong(1), row.getString(2),
							row.getString(3), row.getDate(4).toLocalDate()))
					.optional();

			/* THE SAME ANSWER SOMEBODY WITHOUT THE RIGHT GETS, and that is deliberate: an
			   event that is not there and one he may not touch say the same thing, which is
			   ADL A8 applied to a row rather than to a route. */
			if (before.isEmpty()) {
				return no(HttpStatus.NOT_FOUND, null);
			}

			ResponseEntity<?> wrong = whatIsWrongWith(typed);

			if (wrong != null) {
				return wrong;
			}

			Checked checked = checked(typed);

			/* THE ADDRESS AN EDIT LEAVES BEHIND, WHICH IS NOT ALWAYS THE ONE THE RULE WOULD
			   BUILD. An event moved inside its season keeps its address and everything
			   joined to it (owner, 10.08.2026), and an imported address carrying a month is
			   one no rule here can rebuild - asked for the rule's answer instead, an edit
			   that changed only the town would rewrite it and orphan the lot. */
			String address = EventAddress.keptOrRebuilt(typed.name(), typed.date(),
					before.get().name(), before.get().date(), before.get().slug());

			if (addressIsTakenBySomebodyElse(db, address, id)) {
				return no(HttpStatus.CONFLICT, THE_ADDRESS_IS_TAKEN);
			}

			db.sql("update btl_event set slug = ?, name = ?, date = ?, place_id = ?, city = ?,"
							+ " country_id = ?, kind = ?, featured = ?, description = ?, link = ?"
							+ " where id = ?")
					.params(address, typed.name().strip(), typed.date(), checked.placeKey(),
							checked.city(), checked.countryId(), checked.kind(), checked.featured(),
							checked.description(), checked.link(), id)
					.update();

			db.sql("update race set date = date + cast(? as int) where event_id = ?")
					.params(ChronoUnit.DAYS.between(before.get().date(), typed.date()), id)
					.update();

			return ResponseEntity.ok(new Written(id, address));
		});
	}

	/**
	 * AND TAKING IT OUT, WITH EVERYTHING HANGING OFF IT.
	 *
	 * <p><b>Owner, 03.08.2026:</b> an event is deleted with all of its races, and that is
	 * the only action there is. One statement does the whole of it, for the reason written
	 * at the top of this class.
	 *
	 * <p><b>Nobody is told.</b> Owner, 11.08.2026, asked whether a member is notified when
	 * his result disappears with a deleted race, answering in one word: „Ne." So nothing
	 * here writes a row into {@code message}, and that is a decision rather than a thing
	 * left undone.
	 */
	@DeleteMapping("/api/events/{id}")
	@RightIsNeeded("entity:events")
	ResponseEntity<?> remove(@PathVariable long id) {
		int gone = db.sql("delete from btl_event where id = ?").param(id).update();

		return gone == 0 ? no(HttpStatus.NOT_FOUND, null) : ResponseEntity.noContent().build();
	}

	/**
	 * WHAT IS WRONG WITH THIS FORM, or null.
	 *
	 * <p>One home for both routes, because an event written and an event changed are the
	 * same row with the same rules; two copies would be two answers the day one of them
	 * was edited.
	 */
	private ResponseEntity<?> whatIsWrongWith(Upsert typed) {
		if (!WhatAnEventCarries.KINDS.contains(kindOf(typed))) {
			return no(HttpStatus.BAD_REQUEST, THE_KIND_IS_NOT_KNOWN);
		}

		if (!WhatAnEventCarries.linkIsShaped(orEmpty(typed.link()))) {
			return no(HttpStatus.BAD_REQUEST, THE_LINK_IS_NOT_SHAPED);
		}

		return whatIsWrongWithTheTown(typed);
	}

	/**
	 * A TOWN IS ONE OF TWO THINGS AND NEVER TWO, which is V7's pair of checks and the
	 * owner's sentence of 11.08.2026 said in the same breath: „Mesto se bira iz svetskog
	 * sifarnika i tada nosi svoju drzavu, koja se ne menja; drzava se bira samo uz mesto
	 * upisano rukom."
	 *
	 * <p>Answered as a SENTENCE and not as a constraint violation. Left to the database,
	 * every one of these would arrive as a 500 after the form was filled in, which is the
	 * same fault {@code LinkShapeMatchesTheSchemaTest} exists to prevent one column along.
	 */
	private ResponseEntity<?> whatIsWrongWithTheTown(Upsert typed) {
		boolean fromTheCodebook = typed.placeId() != null;
		boolean typedByHand = !isNothing(typed.city());

		if (fromTheCodebook == typedByHand) {
			return no(HttpStatus.BAD_REQUEST, THE_TOWN_IS_NOT_SAID_ONCE);
		}

		if (fromTheCodebook) {
			/* A country sent beside a codebook town is refused rather than dropped. Its
			   country is the codebook's and does not change, so accepting the field and
			   ignoring it would tell the caller his choice was kept. */
			if (!isNothing(typed.country())) {
				return no(HttpStatus.BAD_REQUEST, THE_COUNTRY_BELONGS_TO_A_TYPED_TOWN);
			}

			return placeKey(typed.placeId()).isPresent() ? null
					: no(HttpStatus.BAD_REQUEST, THE_TOWN_IS_NOT_KNOWN);
		}

		if (isNothing(typed.country())) {
			return no(HttpStatus.BAD_REQUEST, A_TYPED_TOWN_NAMES_ITS_COUNTRY);
		}

		return countryKey(typed.country()).isPresent() ? null
				: no(HttpStatus.BAD_REQUEST, THE_COUNTRY_IS_NOT_KNOWN);
	}

	/** The request as it goes into the row, once nothing about it is wrong any more. */
	private Checked checked(Upsert typed) {
		boolean fromTheCodebook = typed.placeId() != null;

		return new Checked(kindOf(typed),
				fromTheCodebook ? placeKey(typed.placeId()).orElseThrow() : null,
				fromTheCodebook ? null : typed.city().strip(),
				fromTheCodebook ? null : countryKey(typed.country()).orElseThrow(),
				Boolean.TRUE.equals(typed.featured()),
				orEmpty(typed.description()),
				orEmpty(typed.link()));
	}

	/** Left out, an event is a race (owner, 10.08.2026). */
	private static String kindOf(Upsert typed) {
		return isNothing(typed.kind()) ? WhatAnEventCarries.A_RACE : typed.kind();
	}

	/**
	 * THE ROW OF THE CODEBOOK A MARK NAMES, and nothing when the codebook has no such town.
	 *
	 * <p><b>Written exactly like {@link #countryKey} below, and asked in exactly the same
	 * two places</b>, because it answers the same kind of question: a request names a row
	 * of a codebook by the spelling that codebook publishes, and what goes into the column
	 * is the key. {@link RegistrationApi} resolves the same field the same way
	 * ({@code select id from place where geonames_id = ?}), and the owner settled on
	 * 11.08.2026 that it must: „Mesto i drzava na registraciji rade isto kao na formi
	 * dogadjaja ... Jedna kontrola i jedno pravilo za ceo portal, ne dva slicna."
	 *
	 * <p><b>Asked twice rather than carried, which is the shape {@link #countryKey} already
	 * had here.</b> Once to say whether the form is wrong at all, and once to build the row;
	 * between them sits a transaction and nothing that could change the answer. Threading
	 * the first answer through to the second would make {@link #whatIsWrongWith} return
	 * something other than "what is wrong", and that method has two callers.
	 */
	private Optional<Long> placeKey(long mark) {
		return db.sql("select id from place where geonames_id = ?")
				.param(mark).query(Long.class).optional();
	}

	private Optional<Long> countryKey(String code) {
		return db.sql("select id from country where code = ?").param(code)
				.query(Long.class).optional();
	}

	/**
	 * Whether this address belongs to a DIFFERENT event.
	 *
	 * <p>{@code id <> ?} is the whole of it and is why this is not the same question as
	 * the one {@link #add} asks: an edit that changes nothing about the address finds its
	 * own row, and refusing there would make an event impossible to save twice.
	 *
	 * <p><b>Static, and {@link RaceWriteApi} asks it too rather than asking its own.</b>
	 * Whether an address is free is one question about one unique index
	 * ({@code btl_event_slug_unique}), and it is asked from two places since a race can
	 * move its event's year and with it the address the rule builds. Written twice, the
	 * day one of them learnt about a second table the other would go on answering the old
	 * way, and the one that was wrong would be answering about a collision nobody sees
	 * until a result cannot find its event.
	 */
	static boolean addressIsTakenBySomebodyElse(JdbcClient db, String address, long id) {
		return Boolean.TRUE.equals(db.sql(
						"select exists(select 1 from btl_event where slug = ? and id <> ?)")
				.params(address, id).query(Boolean.class).single());
	}

	private static boolean isNothing(String value) {
		return value == null || value.isBlank();
	}

	/** {@code description} and {@code link} are NOT NULL and may be empty (V7). */
	private static String orEmpty(String value) {
		return value == null ? "" : value.strip();
	}

	/**
	 * A refusal, with a reason where there is one to give.
	 *
	 * <p>404 carries no body, which is the shape {@link RightsAtTheDoor} answers a refused
	 * moderator with: an event somebody may not touch and one that is not there have to
	 * read the same, and a reason is something only one of them could have.
	 */
	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return reason == null ? ResponseEntity.status(status).build()
				: ResponseEntity.status(status).body(new Refused(reason));
	}
}
