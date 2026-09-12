package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The catalogue of countries, in the two groups the portal offers them in.
 *
 * <p>Eleven in the region and two hundred and thirty five besides. The split is
 * not decoration: a form that asks where somebody runs offers the eleven first,
 * because almost every answer is one of them, and the rest below.
 *
 * <p><b>This route's name was opened before it existed.</b> `ApiSecurity` has
 * permitted `/api/countries` since the first endpoint, on the reasoning that a
 * list of states belongs to nobody, and a name opened with nothing behind it is
 * a small thing that is nonetheless a decision waiting to be finished. This
 * finishes it.
 *
 * <p><b>Within each group the order is the schema's</b>, and it is an order
 * somebody chose rather than the alphabet: `sort_order` is a column, unique and
 * deferrable, precisely because it is maintained by moving a range of it. Sorted
 * by name instead, the eleven of the region would come out in an order nobody
 * decided.
 */
@RestController
class CountryApi {

	private final JdbcClient db;

	CountryApi(JdbcClient db) {
		this.db = db;
	}

	/** One country, as the portal already receives it: what it is called, and how
	 *  it is written. */
	record Country(String code, String name) {
	}

	@GetMapping("/api/countries")
	Map<String, List<Country>> countries() {
		Map<String, List<Country>> grouped = new LinkedHashMap<>();

		grouped.put("region", inOrRest(true));
		grouped.put("rest", inOrRest(false));

		return grouped;
	}

	private List<Country> inOrRest(boolean inRegion) {
		return db.sql("select code, name from country where in_region = ? order by sort_order")
				.param(inRegion)
				.query((row, one) -> new Country(row.getString(1), row.getString(2)))
				.list();
	}
}
