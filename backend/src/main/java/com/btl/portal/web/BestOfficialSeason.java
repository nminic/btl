package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;

/**
 * THE MOST POINTS A MEMBER HAS TAKEN IN ANY ONE OFFICIAL SEASON.
 *
 * <p>It exists for one question - whether the beginners' category is still open to him
 * (PDL P7) - and it is the half of that rule the database has to answer. The other half is
 * {@link com.btl.portal.domain.category.Category#firstSeasonAllowed}, which owns the
 * threshold and knows nothing about rows.
 *
 * <p><b>THE BEST SINGLE SEASON, NEVER A SUM OF SEVERAL, and that distinction is the whole
 * rule.</b> Owner, 11.08.2026 (PDL P7): „ukoliko taj clan nema ni jednu raniju sezonu u
 * kojoj je imao 12 ili vise bodova pocev od 2027 (portal treba da proveri)". The portal got
 * this wrong once, on 15.08.2026: the check summed points across all time, which in this
 * portal is the imported history of 2010 to 2026, and it closed the category to thirty of
 * the thirty two members over races run before the league existed. So the grouping below is
 * not a flourish - a query without it is that same fault written again.
 *
 * <p><b>Nothing before {@link SeasonClock#FIRST_SEASON} counts at all</b>, which is the
 * other half of the same decision, clarified by the owner the same day: „gledaju se samo
 * zvanicne BTL sezone za pravilo od 12 poena u prethodnoj, tako da u prvoj sezoni u teoriji
 * svi mogu da odu u Prvu Sezonu." The year is read off {@link SeasonClock} rather than
 * written here, so the first season the league has is one number in one place.
 *
 * <p><b>The season a result belongs to is the year its RACE was run in</b>, and that is
 * read off {@code result.race_date} rather than joined to the race. The column is on the
 * row by a composite reference to {@code (race.id, race.date)} with
 * {@code on update cascade} (V7), so the database itself refuses a day that is not that
 * race's and rewrites every result the moment a race is moved - which is what makes
 * reading it here a fact rather than a copy. {@code frontend/src/data/derive.ts} answers the
 * same question the same way ({@code seasonOf}, the year of the result's date), so the two
 * sides cannot disagree about which season a run belongs to.
 *
 * <p><b>THE RUNNING SEASON COUNTS, and it is meant to.</b> Points never go down, so a
 * season already over the threshold is certain to finish over it, and waiting for the year
 * to end would leave the category open to somebody who has plainly left it. This is also
 * the shape the owner's decision of 26.09.2026 needs: „ga superadmin / moderator
 * verifikacijom necega moze gurnuti u starosnu kategoriju ako odobri rezultat kojim prelaz
 * 12 bodova." Nothing here is triggered BY a verification - the answer simply changes the
 * moment the row it approved exists, which is why the right is never stored.
 *
 * <p><b>Which is why this is a new home on this side and not a second one.</b> Measured
 * before it was written: {@code Category.firstSeasonAllowed} and {@code Category.codeFor}
 * were called from {@code CategoryTest} and from nowhere else in {@code src/main/java}, and
 * {@code grep -rn "group by\|sum(" backend/src/main/java} found no aggregation over results
 * at all. The rule was here and the question was only ever asked on the screen, off
 * {@code /api/results} - and PDL P7 says in as many words whose question it is: „Ko sme da
 * bude u pocetnickoj kategoriji proverava portal, ne clan."
 *
 * <p><b>A component of its own rather than a query inside a controller</b>, for
 * {@link MemberOfAccount}'s own reason: two routes need exactly this fact, and the same
 * {@code select} sitting in both is free to drift apart the day one of them is edited.
 */
@Component
class BestOfficialSeason {

	private final JdbcClient db;

	BestOfficialSeason(JdbcClient db) {
		this.db = db;
	}

	/**
	 * @param competitor {@code competitor.id}, never a value the caller supplies
	 * @return the highest single-season total, or zero where there is no official season at
	 *         all. Zero rather than nothing, because a member who has taken no points in an
	 *         official season has taken no points in one, and that is the ordinary state of
	 *         every member until 2027 is over - not a case for a caller to unwrap.
	 *
	 *         <p>{@code single()} is safe here and it is the {@code coalesce} that makes it
	 *         so: {@code max} over no rows is one row holding null, which is exactly what
	 *         {@code JdbcClient}'s {@code single()} refuses ({@link MemberOfAccount} carries
	 *         that measurement), so the null is turned into the answer in SQL rather than in
	 *         Java.
	 */
	BigDecimal pointsFor(long competitor) {
		return db.sql("select coalesce(max(total), 0) from ("
						+ " select sum(points) as total from result"
						+ " where competitor_id = ? and extract(year from race_date) >= ?"
						+ " group by extract(year from race_date)) each_season")
				.params(competitor, SeasonClock.FIRST_SEASON)
				.query(BigDecimal.class)
				.single();
	}
}
