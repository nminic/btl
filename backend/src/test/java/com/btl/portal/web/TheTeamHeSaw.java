package com.btl.portal.web;

import org.springframework.jdbc.core.simple.JdbcClient;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * THE WORDS A MODERATOR HAD IN FRONT OF HIM, put beside a decision about a card of a team.
 *
 * <p>Since 23.11.2026 a decision about a proposal or a change of a team names the words it was
 * taken about ({@code seenTeam}, PDL P13, [ODLUKA 23.11.2026], „nova zamenjuje staru"), as one about a
 * picture names the picture. A case that is about something else (what an approval makes, who is told,
 * what a refusal keeps) decides the card as the screen would: with the words the card shows NOW. That is
 * what this adds, read off the database with the expressions {@link VerificationApi} serves them with,
 * and nothing more.
 *
 * <p><b>It is NOT for a case about the words themselves.</b> Those write their request whole and name
 * the words they mean (a case that read them at the moment of the press would be the very route it is
 * written against), so they never come through here.
 */
final class TheTeamHeSaw {

	private static final JsonMapper MAPPER = JsonMapper.builder().build();

	private TheTeamHeSaw() {
	}

	/**
	 * The body with {@code seenTeam} added where the card holds a proposal and the body does not already
	 * name one, and the body as it was for every other card.
	 */
	static String beside(JdbcClient db, long item, String body) {
		if (body.contains("\"seenTeam\"")) {
			return body;
		}

		List<Map<String, String>> now = db.sql("select p.name, coalesce(town.name, p.city, ''),"
						+ " coalesce(town_country.code, typed_country.code, ''),"
						+ " case when p.bio <> '' then p.bio else v.body end, p.link"
						+ " from verification v join team_proposal p on p.id = v.team_proposal_id"
						+ " left join place town on town.id = p.place_id"
						+ " left join country town_country on town_country.id = town.country_id"
						+ " left join country typed_country on typed_country.id = p.country_id"
						+ " where v.id = ?")
				.param(item)
				.query((row, number) -> {
					Map<String, String> words = new LinkedHashMap<>();
					words.put("name", row.getString(1));
					words.put("city", row.getString(2));
					words.put("country", row.getString(3));
					words.put("bio", row.getString(4));
					words.put("link", row.getString(5));

					return words;
				})
				.list();

		if (now.isEmpty()) {
			return body;
		}

		String closed = body.strip();
		String opening = closed.substring(0, closed.length() - 1);
		String separator = opening.strip().equals("{") ? "" : ",";

		return opening + separator + "\"seenTeam\":" + MAPPER.writeValueAsString(now.get(0)) + "}";
	}
}
