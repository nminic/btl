package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * The catalogue of towns, which is the first thing the portal asked of a server.
 *
 * <p>Forty-seven thousand rows: every town in the region from five hundred
 * people up and every town in the world from fifteen thousand up (owner,
 * 10.08.2026). It is asked for when somebody starts typing a place and on no
 * other screen, which is why it is fetched and not bundled.
 *
 * <p><b>In rank order, and the order is the answer.</b> Rank is what is left of
 * the population, and the field that offers places offers the likeliest first.
 * Sorted by name instead, somebody typing "Beo" would be offered a village
 * before the capital.
 */
@RestController
class PlaceApi {

	private final JdbcClient db;

	PlaceApi(JdbcClient db) {
		this.db = db;
	}

	/**
	 * Every town, as the portal already receives them.
	 *
	 * <p><b>A row is an array and not an object</b>, which is what the portal
	 * serves today. Three keys repeated forty-seven thousand times are the better
	 * part of a megabyte of the word "geonamesId" and its two companions, on top
	 * of the largest thing the portal fetches. The shape is a decision about this
	 * one resource, taken because of its size, and it is not the shape the rest of
	 * the API takes.
	 *
	 * <p><b>And a row is three long or four.</b> The fourth is the English name,
	 * and it is there only when a town really has a different one: the schema
	 * records one only when the two differ, and `place_english_name_differs` is
	 * what says so. Written as a fixed four with a null in it, every one of the
	 * forty-six thousand towns whose name is the same in both languages would
	 * carry a `null` nobody reads.
	 *
	 * <p>Which is why the row is built here rather than left to a record and an
	 * annotation: a record writes all of its components or none, and this one has
	 * a component that is sometimes not part of the answer at all.
	 */
	@GetMapping("/api/places")
	List<Object[]> places() {
		return db.sql("select place.geonames_id, place.name, country.code, place.english_name"
						+ " from place join country on country.id = place.country_id"
						+ " order by place.rank")
				.query((row, one) -> {
					String english = row.getString(4);

					return english == null
							? new Object[] {row.getLong(1), row.getString(2), row.getString(3)}
							: new Object[] {row.getLong(1), row.getString(2), row.getString(3), english};
				})
				.list();
	}
}
