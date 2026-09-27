package com.btl.portal.web;

import com.btl.portal.domain.pricing.MembershipPrice;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * THE SEVEN ROWS OF THE PRICE LIST, in the shape {@link MembershipPrice} reads them in.
 *
 * <p><b>A shared home rather than the same {@code select} written three times</b>, which is the
 * reason {@link MemberOfAccount} gives for existing and the same one applies here: the day
 * somebody adds a column to {@code price_row} that {@link MembershipPrice} turns on, this is one
 * place to change rather than three free to drift.
 *
 * <p><b>{@link PricingApi} deliberately keeps its own</b>, and that is not an oversight. It serves
 * the list to a screen and reads {@code label} with it (V34), which is a fact about how a row is
 * NAMED and no part of what a row COSTS; nothing that asks {@link MembershipPrice#on} a question
 * has any use for it. One query for the rule and one for the screen is two queries about two
 * things, where three queries about the rule would be three copies of one thing.
 */
@Component
class PriceRows {

	private final JdbcClient db;

	PriceRows(JdbcClient db) {
		this.db = db;
	}

	/**
	 * In {@code sort_order}, because {@link MembershipPrice#on} walks the periods in the order
	 * the list is printed in and V4 put that order in a column rather than leaving it to
	 * whatever the planner returns.
	 */
	List<MembershipPrice.Row> all() {
		return db.sql("select key, kind, day_from, day_to, eur, rsd, ranking from price_row order by sort_order")
				.query((row, i) -> new MembershipPrice.Row(row.getString(1), row.getString(2),
						row.getString(3), row.getString(4), row.getBigDecimal(5), row.getBigDecimal(6),
						row.getObject(7, Boolean.class)))
				.list();
	}
}
