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
 * <p><b>THE RUNNING SEASON COUNTS TOWARD THE SEASON AFTER IT, AND NEVER TOWARD ITSELF.</b>
 * A season's own category was already decided off the seasons before it (PDL P7: „cela
 * sezona je u kategoriji koja je dodeljena na njenom pocetku"), and a season is never
 * before itself - so the year {@link SeasonClock#seasonBeingPaidFor} names is the one
 * boundary this method must never cross. The portal got exactly this wrong once: a query
 * with no upper bound let {@code season}'s own still-growing total decide {@code season},
 * which meant every member's first season closed on him from the inside, months before it
 * ended, and PDL P7 says the opposite in as many words - „nijedna zvanicna BTL sezona nije
 * zavrsena sa 12 ili vise bodova" is what shuts the category, and a season that is still
 * being run has not finished.
 *
 * <p><b>Toward the NEXT season, points go down only by a hand that means them to</b> - a
 * member deleting his own run, which he may do even after it was approved (PDL P9,
 * 27.08.2026), or a race corrected downward, after which every run counted at it is
 * counted again ({@code RaceWriteApi}, PDL P4, the owner's decision of 20.09.2026) - so a
 * season already over the threshold almost always finishes over it, and waiting for the
 * year to end would leave that next season's category open to somebody who has plainly
 * left it. Where the points DO go down the answer goes down with them, because nothing
 * here is stored: the right opens again exactly as it closed, and the member is told only
 * when an approval closes it ({@code VerificationWriteApi}). Whether he should hear it when
 * a correction of a race moves it was put to the owner on 09.10.2026. This is also the shape
 * the owner's decision of 26.09.2026 needs: „ga superadmin / moderator verifikacijom necega
 * moze gurnuti u starosnu kategoriju ako odobri rezultat kojim prelaz 12 bodova", spelt out
 * the same day for which season moves - „ako odobrenje prevede clanov zbir tekuce sezone na
 * 12 ili vise, pocetnicka mu se za NAREDNU sezonu zatvara istog trenutka." Nothing here is
 * triggered BY a verification - the answer simply changes the moment the row it approved
 * exists, which is why the right is never stored, and what it changes is the season AFTER
 * the one the row belongs to, never that season itself.
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
	 * @param season     the season the question is being asked FOR
	 *                   ({@link SeasonClock#seasonBeingPaidFor}), which is never one of the
	 *                   seasons counted: a season's category is decided off the seasons
	 *                   BEFORE it, and a season is never before itself. This is the bound
	 *                   that was missing when the portal asked this without it - the query
	 *                   summed a season against its own still-growing total and closed it
	 *                   on him from the inside.
	 * @return the highest single-season total among seasons from
	 *         {@link SeasonClock#FIRST_SEASON} up to but NOT including {@code season}, or
	 *         zero where there is no such season at all. Zero rather than nothing, because a
	 *         member who has taken no points in an official season before this one has taken
	 *         no points in one, and that is the ordinary state of every member through the
	 *         whole of 2027 - not a case for a caller to unwrap.
	 *
	 *         <p>{@code single()} is safe here and it is the {@code coalesce} that makes it
	 *         so: {@code max} over no rows is one row holding null, which is exactly what
	 *         {@code JdbcClient}'s {@code single()} refuses ({@link MemberOfAccount} carries
	 *         that measurement), so the null is turned into the answer in SQL rather than in
	 *         Java.
	 */
	BigDecimal pointsFor(long competitor, int season) {
		return db.sql("select coalesce(max(total), 0) from ("
						+ " select sum(points) as total from result"
						+ " where competitor_id = ? and extract(year from race_date) >= ?"
						+ " and extract(year from race_date) < ?"
						+ " group by extract(year from race_date)) each_season")
				.params(competitor, SeasonClock.FIRST_SEASON, season)
				.query(BigDecimal.class)
				.single();
	}
}
