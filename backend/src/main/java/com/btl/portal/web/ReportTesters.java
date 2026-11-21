package com.btl.portal.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * THE MEMBERS WHO MAY REPORT A RUN OF 2026 WHILE IT LASTS, NAMED BY THEIR MEMBER NUMBERS IN THE
 * SERVER'S SETTINGS.
 *
 * <p>PDL P9, owner, 21.11.2026, chosen among the outcomes offered: „Izuzetak za testiranje: članovi sa
 * spiska testera u podešavanjima servera (sada samo 000002, Marko Jovičić) smeju da prijavljuju
 * rezultate trka iz 2026, do 1.1.2027, kada se izuzetak sam gasi; za sve ostale ova odluka stoji kako
 * jeste." What the exception opens and until when is {@code SeasonClock.seasonsOpenForAReport(at,
 * aTester)}; this answers only WHO.
 *
 * <p><b>Asked of the member the session resolved, and of nothing in the request.</b> The callers pass
 * the competitor key {@code ActiveMemberOrAdministration} or {@code MemberOfAccount} read off the
 * account behind the session cookie, and the number is read off his own row here, so no field a
 * request carries can make anybody a tester.
 *
 * <p><b>Empty by default</b> ({@code btl.report-testers=} in {@code application.properties}), so a
 * stack that does not name anybody runs exactly as before; production names its testers in
 * {@code deploy/compose.prod.yml} as {@code BTL_REPORT_TESTERS}. Entries are separated by commas, the
 * way Spring reads a list-valued property everywhere ({@code btl.superadmin.email} the same), and a
 * blank entry names nobody.
 */
@Component
class ReportTesters {

	private final JdbcClient db;

	private final Set<String> numbers;

	ReportTesters(JdbcClient db, @Value("${btl.report-testers:}") String[] numbers) {
		this.db = db;
		this.numbers = Arrays.stream(numbers)
				.map(String::strip)
				.filter(number -> !number.isEmpty())
				.collect(Collectors.toUnmodifiableSet());
	}

	/**
	 * @param competitor the key of the member the session resolved, never one read off a request
	 * @return whether his member number is on the list. A member with no number yet is never on it
	 */
	boolean is(long competitor) {
		if (numbers.isEmpty()) {
			return false;
		}

		/* `coalesce` because a person who registered and has not been admitted carries no number (ADL
		   A44), and the set refuses to be asked about a null. An empty string is never on the list:
		   blank entries are dropped above. */
		String number = db.sql("select coalesce(member_number, '') from competitor where id = ?")
				.param(competitor).query(String.class).single();

		return numbers.contains(number);
	}
}
