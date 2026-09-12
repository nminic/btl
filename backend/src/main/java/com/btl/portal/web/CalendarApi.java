package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

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
 * order the portal serves today and the order a calendar is read in. Sorted by
 * the key instead, the list would come back in whatever order the rows were
 * written, which for an imported history is no order at all.
 *
 * <p><b>The shapes are the schema's and not the file's, and that is a decision
 * taken on 12.09.2026 rather than an oversight.</b> What the portal serves today
 * carries text identifiers like {@code evt-fruskogorski-maraton-2010-05-08} and
 * the strings {@code "no"} and {@code "yes"} where a yes or no belongs; both are
 * artefacts of one import. The schema says {@code bigserial} and {@code boolean},
 * A36 O1 having refused a speaking natural key with a measured reason, and the
 * server answers with what the schema says. What the portal must keep is the
 * NAMES of the fields, which is what {@code CalendarApiTest} holds against the
 * file it serves.
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
	 * @param copiedFrom the event this one was copied from when the year turned,
	 *                   or null. A calendar is built by copying the year before it
	 *                   and the link back is what says which
	 */
	record Event(long id, String slug, String name, LocalDate date, String city, String country,
			String kind, boolean featured, String description, String link, Long copiedFrom) {
	}

	/**
	 * @param renamed whether the name was changed after the event was created,
	 *                which is what stops an import matching on it
	 */
	record Race(long id, long eventId, String name, boolean renamed, LocalDate date, String kind,
			int limitSeconds, BigDecimal distanceKm, int ascentM, int descentM, String category) {
	}

	@GetMapping("/api/events")
	List<Event> events() {
		return db.sql("select e.id, e.slug, e.name, e.date,"
						+ " coalesce(town.name, e.city) as city,"
						+ " coalesce(town_country.code, typed_country.code) as country,"
						+ " e.kind, e.featured, e.description, e.link, e.copied_from"
						+ " from btl_event e"
						+ " left join place town on town.id = e.place_id"
						+ " left join country town_country on town_country.id = town.country_id"
						+ " left join country typed_country on typed_country.id = e.country_id"
						+ " order by e.date, e.id")
				.query((row, one) -> new Event(row.getLong(1), row.getString(2), row.getString(3),
						row.getDate(4).toLocalDate(), row.getString(5), row.getString(6),
						row.getString(7), row.getBoolean(8), row.getString(9), row.getString(10),
						row.getObject(11) == null ? null : row.getLong(11)))
				.list();
	}

	@GetMapping("/api/races")
	List<Race> races() {
		return db.sql("select r.id, r.event_id, r.name, r.renamed, r.date, r.kind,"
						+ " r.limit_seconds, r.distance_km, r.ascent_m, r.descent_m, r.category"
						+ " from race r order by r.date, r.id")
				.query((row, one) -> new Race(row.getLong(1), row.getLong(2), row.getString(3),
						row.getBoolean(4), row.getDate(5).toLocalDate(), row.getString(6),
						row.getInt(7), row.getBigDecimal(8), row.getInt(9), row.getInt(10),
						row.getString(11)))
				.list();
	}
}
