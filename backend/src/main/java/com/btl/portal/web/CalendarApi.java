package com.btl.portal.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * THE CALENDAR: what was run, and what was run at it.
 *
 * <p>Two resources and one file each, because that is how the portal already
 * reads them: an event is a day and a place, and a race is one of the distances
 * that day offered. Joined into one answer they could not be asked for
 * separately, and the calendar page asks for events while the page under it asks
 * for races.
 *
 * <p><b>In date order, ascending, and the order is the answer.</b> That is the
 * order this route answers in and the order a calendar is read in; the screens' mock
 * file {@code races.json} is NOT in it (it follows the key, and its first dates are
 * 2019-09-14, 2015-04-17, 2016-04-15), so the order is a fact about this route and
 * not about the file a screen is drawn from. Sorted by
 * the key instead, the list would come back in whatever order the rows were
 * written, which for an imported history is no order at all.
 *
 * <p><b>The shapes are the schema's and not the file's, and that is a decision
 * taken on 12.09.2026 rather than an oversight.</b> Until 20.09.2026 the file
 * carried text identifiers like {@code evt-fruskogorski-maraton-2010-05-08} and
 * the strings {@code "no"} and {@code "yes"} where a yes or no belongs, both
 * artefacts of one import, while the schema said {@code bigserial} and
 * {@code boolean} - A36 O1 having refused a speaking natural key with a measured
 * reason - and the server answered with what the schema said regardless. PR 325
 * rewrote the file into the schema's own shapes that day, so the two agree now;
 * what the decision still governs is that the server answers with the schema
 * and never with the file, if they ever disagree again. What the portal must
 * keep is the NAMES of the fields, which is what {@code CalendarApiTest} holds
 * against the file it serves.
 *
 * <p><b>A town is one of two things and never two.</b> From the codebook it is
 * {@code place_id} and its name and country are the codebook's; typed by hand it
 * is {@code city} and the country beside it. The pair of checks in V7 says
 * exactly one of the two is there, so a coalesce here is a choice between a value
 * and nothing rather than between two values that might disagree.
 */
@RestController
class CalendarApi {

	private final JdbcClient db;

	CalendarApi(JdbcClient db) {
		this.db = db;
	}

	/**
	 * @param featured    the event's OWN choice, „Istaknuto: Da" or „Ne" on its form, and
	 *                    nothing besides. The form of the event reads this and only this
	 *                    (owner, PDL 24.11.2026: „Polje „Istaknuto” na formi događaja se ne
	 *                    menja: pokazuje samo ručni izbor, a istaknutost iz lige se vidi u
	 *                    kalendaru"), so it is never the field {@code highlighted} is
	 * @param highlighted whether the calendar draws the event as highlighted: its own
	 *                    choice, or a race of it counted by a league whose box „Istakni
	 *                    događaje" is ticked ({@link #HIGHLIGHTED})
	 * @param copiedFrom  the event this one was copied from when the year turned,
	 *                    or null. A calendar is built by copying the year before it
	 *                    and the link back is what says which
	 * @param description the description AS IT WAS WRITTEN, in every answer and in every
	 *                    language. It is what the form of the event edits and what the copy
	 *                    of an event carries into the next year (`event/copyOf.ts`), so it is
	 *                    never a translation: a translation saved back as the original would
	 *                    be the machine's words standing as the administration's
	 * @param descriptionShown what a reader of the language asked for is shown of the
	 *                    description (TranslatedText#shown), and only in an answer asked for in
	 *                    a language: the answer with no {@code lang} is the answer it always
	 *                    was, field for field
	 */
	record Event(long id, String slug, String name, LocalDate date, String city, String country,
			String kind, boolean featured, boolean highlighted, String description, String link,
			Long copiedFrom,
			@JsonInclude(JsonInclude.Include.NON_NULL) TranslatedText.Shown descriptionShown) {
	}

	/**
	 * WHETHER THE CALENDAR DRAWS AN EVENT HIGHLIGHTED, and the one place that decides it.
	 *
	 * <p><b>Owner, PDL 24.11.2026:</b> „Ukoliko je to štiklirano, svi događaji te lige
	 * automatski dobijaju istaknutost u kalendaru. Ako ih izbacim iz lige, istaknutost se
	 * gubi." And of the event's own choice, chosen among the outcomes offered: „Ručno
	 * „Istaknuto: Da” na događaju je zaseban izbor i ostaje kad se događaj izbaci iz lige;
	 * događaj bez ručnog „Da” gubi istaknutost čim izađe iz lige."
	 *
	 * <p><b>Worked out on every read and written nowhere</b>, which is the plan he approved
	 * („istaknutost se računa pri čitanju kalendara iz ručnog izbora ili iz lige, bez
	 * prepisivanja na događaj"). So taking a race out of a league, unticking the box or
	 * deleting the league ends the highlight with nothing to undo, and the event's own
	 * {@code featured} is never touched by any of them.
	 *
	 * <p><b>An event of a league is an event with at least one race that league counts</b>,
	 * because from V19 a league counts races and not days; another race of the same day
	 * that the league does not count does not take the highlight away. <b>And one ticked
	 * league is enough</b> where an event's races count towards several. Both of those are
	 * the assistant's reading of „svi događaji te lige", not the owner's words.
	 *
	 * <p>The highlight is the CALENDAR'S and nobody else reads it: the copy of an event is
	 * never featured (owner, 11.08.2026), which is about {@code featured}, and a copy counts
	 * no race of any league until somebody puts one in.
	 */
	private static final String HIGHLIGHTED = "(e.featured or exists (select 1 from race r"
			+ " join league_race lr on lr.race_id = r.id"
			+ " join league l on l.id = lr.league_id"
			+ " where r.event_id = e.id and l.highlights_events))";

	/**
	 * @param renamed whether the name was changed after the event was created,
	 *                which is what stops an import matching on it
	 * @param dots    the lengths the calendar draws for this race, worked out by
	 *                {@link #DOTS} and by nothing on the screen
	 */
	record Race(long id, long eventId, String name, boolean renamed, LocalDate date, String kind,
			int limitSeconds, BigDecimal distanceKm, int ascentM, int descentM, String category,
			List<String> dots) {
	}

	/**
	 * THE DOTS A RACE CARRIES IN THE CALENDAR, and the one place that decides them.
	 *
	 * <p><b>A race over a length</b> carries the dot of its own length, which is
	 * {@code race.category}, generated off {@code race.distance_km}. What its results say
	 * is not read: on such a race the length is the race's and not the runner's.
	 *
	 * <p><b>A free race</b> carries the sixth dot, the one without a set length (PDL,
	 * 30.08.2026, chosen by the owner among three outcomes offered, with his words „Jedna nova
	 * boja i njeno ime u legendi"). Its results are not read either; the decision below is
	 * about a timed race and nothing else.
	 *
	 * <p><b>A timed race carries the sixth dot until its results say otherwise</b> (PDL, owner
	 * 12.11.2026, who changed his decision of 16.10.2026): „Zimski BTL dezorijentiring se kao
	 * vremenska trka tumači kao ultramaraton jer ima crvenu tačku. To nije tačno - ukoliko je
	 * trka vremenska, treba da ima tačku ljubičaste boje (Bez zadate dužine)", chosen among the
	 * outcomes offered with „Ljubičasta dok nema rezultata". Refused: always purple, and purple
	 * beside the dots of the results. Once results exist the 16.10.2026 rule stands unchanged:
	 * „Kad stignu rezultati, tačke su tačno one koje rezultati nose", so the purple dot goes
	 * away where there is a result, and an ultra is drawn only where a result is an ultra. Its
	 * own {@code category} cannot answer this: the race fixes no length, carries nought, and
	 * the column says „short".
	 *
	 * <p><b>A result is a row of {@code result}</b>, which only an approval writes
	 * ({@code VerificationWriteApi}); a submission still waiting is in
	 * {@code result_submission} and is not read. Each result brings its own generated
	 * {@code category}, off the kilometres that runner covered, so this rule decides which
	 * dots are drawn and never what length a result is.
	 *
	 * <p><b>Only the calendar reads this.</b> {@code category} stays what it is for every
	 * other reader, and the rankings, the awards and the profile read the category of the
	 * result, not of the race.
	 */
	private static final String DOTS = "case r.kind"
			+ " when 'length' then array[r.category]"
			+ " when 'free' then array['unmeasured']"
			+ " when 'time' then coalesce(ran.lengths, array['unmeasured'])"
			+ " end";

	/**
	 * @param lang the reader's language, absent for the description as it was written and nothing else. Asked
	 *             for, every event says what that reader is shown of its description
	 *             ({@code descriptionShown}): its machine translation into that language, or the description
	 *             as written where there is none yet, where the service did not answer, where the description
	 *             has changed since it was translated, or where it is written in that language already (owner,
	 *             PDL P18, 25.11.2026, „Automatski prevod sadržaja koji posetilac vidi”). A value not shaped like
	 *             a language tag is refused with 400 and no body, as {@code PageApi} refuses it.
	 */
	@GetMapping("/api/events")
	ResponseEntity<List<Event>> events(
			@RequestParam(name = TranslatedText.THE_LANGUAGE_ASKED_FOR, required = false) String lang) {
		if (lang != null && !TranslatedText.A_LANGUAGE_TAG.matcher(lang).matches()) {
			return ResponseEntity.badRequest().build();
		}

		WhatIsTranslated description = WhatIsTranslated.EVENT_DESCRIPTION;

		return ResponseEntity.ok(db.sql("select e.id, e.slug, e.name, e.date,"
						+ " coalesce(town.name, e.city) as city,"
						+ " coalesce(town_country.code, typed_country.code) as country,"
						+ " e.kind, e.featured, " + HIGHLIGHTED + " as highlighted,"
						+ " e.description, e.link, e.copied_from"
						+ (lang == null ? "" : ", " + description.joinedColumns())
						+ " from btl_event e"
						+ " left join place town on town.id = e.place_id"
						+ " left join country town_country on town_country.id = town.country_id"
						+ " left join country typed_country on typed_country.id = e.country_id"
						+ (lang == null ? "" : description.joinedOver("e"))
						+ " order by e.date, e.id")
				.params(lang == null ? Map.<String, Object>of() : Map.<String, Object>of("language", lang))
				.query((row, one) -> new Event(row.getLong(1), row.getString(2), row.getString(3),
						row.getDate(4).toLocalDate(), row.getString(5), row.getString(6),
						row.getString(7), row.getBoolean(8), row.getBoolean(9), row.getString(10),
						row.getString(11), row.getObject(12) == null ? null : row.getLong(12),
						lang == null ? null : TranslatedText.shown(row.getString(10), lang, row.getString(13),
								row.getString(14), row.getBoolean(15))))
				.list());
	}

	@GetMapping("/api/races")
	List<Race> races() {
		return db.sql("select r.id, r.event_id, r.name, r.renamed, r.date, r.kind,"
						+ " r.limit_seconds, r.distance_km, r.ascent_m, r.descent_m, r.category,"
						+ " " + DOTS + " as dots"
						+ " from race r"
						/* The lengths run at each race, joined by the race and never by its
						   event: two timed races of one event are two answers. */
						+ " left join (select res.race_id,"
						+ " array_agg(distinct res.category order by res.category) as lengths"
						+ " from result res group by res.race_id) ran on ran.race_id = r.id"
						+ " order by r.date, r.id")
				.query((row, one) -> new Race(row.getLong(1), row.getLong(2), row.getString(3),
						row.getBoolean(4), row.getDate(5).toLocalDate(), row.getString(6),
						row.getInt(7), row.getBigDecimal(8), row.getInt(9), row.getInt(10),
						row.getString(11), List.of((String[]) row.getArray(12).getArray())))
				.list();
	}
}
