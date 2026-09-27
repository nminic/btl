package com.btl.portal.web;

import com.btl.portal.domain.category.Category;
import com.btl.portal.domain.season.SeasonClock;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.ZonedDateTime;

/**
 * THE CATEGORY A MEMBER WILL RUN UNDER, WORKED OUT FROM HIS WISH AND HIS RIGHT.
 *
 * <p><b>A component of its own because BOTH verbs of {@code /api/me/category} need exactly
 * this answer</b>, and a derivation written twice is the one thing this increment is about
 * avoiding. {@link MeCategoryApi} answers it, and {@link MeCategoryWriteApi} answers it again
 * after a write so that what comes back is what the next {@code GET} would say rather than an
 * echo of the request. The shape is {@link MemberOfAccount}'s and {@link BestOfficialSeason}'s
 * - a fact several routes need, asked in one place.
 *
 * <p><b>THE DERIVATION IS THE DECISION, and it is one line.</b> Owner, 26.09.2026 (PDL P7 §9):
 * „Ono sto se cuva je ZELJA, ne kategorija... kategorija u kojoj se takmici je izvedena: zelja
 * i pravo." So a wish the member no longer has a right to is not corrected, cleaned up or
 * refused anywhere: it turns into an age category HERE, every time the question is asked, and
 * his wish stays exactly as he left it. That is why no state „a saved choice he has no right
 * to" can arise, which is what the journal says in as many words, and why a verification that
 * pushes him over twelve points writes nothing at all - the answer simply changes the moment
 * the row it approved exists.
 *
 * <p><b>WHERE THE WISH IS STORED TODAY, AND WHY THAT IS A DEBT RATHER THAN A DESIGN.</b>
 * {@code competitor.first_season_2027} (V7) is a single boolean per member whose NAME carries
 * a season, so it can hold the wish for one season only. The wish is a fact about a member AND
 * a season (PDL P7: the category is assigned per season and a change takes effect from the
 * next one), which is a row per pair rather than a column per member - and
 * {@code btl-produkt/PRED-BAZU-ANALIZA.md} recorded exactly that before V7 shipped: „Ime nosi
 * godinu u sebi... pa je u bazi izbor kategorije po sezoni, ne bulean na clanu." The owner was
 * shown what moving it costs - 172 places in 95 files - and chose to keep the column for now
 * and record the debt (27.09.2026: „da zapises kao tehnicki dug da se ne zaboravi i resi
 * strukturalno nekad sto pre"). The debt is in {@code PENDING.md} and it becomes live in
 * OCTOBER 2027, the first moment {@link SeasonClock#seasonBeingPaidFor} names a season the
 * column cannot: from then a wish written for 2028 overwrites the one that was 2027's.
 * {@code theColumnAndTheSeasonAgreeOnlyWhileTheSeasonIsTheFirstOne} in
 * {@code MeCategoryApiTest} stands on that instant and names it, so the deadline is in the
 * suite and not only in a document.
 */
@Component
class TheChoiceAsItStands {

	private final JdbcClient db;

	private final BestOfficialSeason bestOfficialSeason;

	private final Clock clock;

	TheChoiceAsItStands(JdbcClient db, BestOfficialSeason bestOfficialSeason, Clock clock) {
		this.db = db;
		this.bestOfficialSeason = bestOfficialSeason;
		this.clock = clock;
	}

	/**
	 * @param me {@code competitor.id}, read off the session by the route and never off the
	 *           request
	 */
	MeCategoryApi.Choice of(long me) {
		/* ONE READING OF THE CLOCK AND NOT THREE. The season, the derived code and „may he
		   still change it" are three answers about ONE moment, and three calls to
		   `ZonedDateTime.now` could straddle 10:00 on 1 January - the single instant any of
		   this is about - and answer that the choice is shut for a season it also says is not
		   the one being chosen. */
		ZonedDateTime now = ZonedDateTime.now(clock);
		int season = SeasonClock.seasonBeingPaidFor(now);

		Member whoHeIs = memberRow(me);
		BigDecimal best = bestOfficialSeason.pointsFor(me);
		boolean allowed = Category.firstSeasonAllowed(best);

		return new MeCategoryApi.Choice(season, whoHeIs.firstSeason(), allowed,
				Category.codeFor(whoHeIs.gender(), whoHeIs.birthYear(), season,
						whoHeIs.firstSeason() && allowed),
				SeasonClock.categoryMayBeChosenFor(season, now));
	}

	/**
	 * What the row holds about him: his wish, and the two facts a band is made of.
	 *
	 * <p><b>{@code birth_year} is a GENERATED column</b> ({@code extract(year from birth_date)},
	 * V8), so the year the band is taken from is the database's own reading of the date it
	 * holds rather than a second extraction here.
	 *
	 * <p>{@code single()} rather than {@code optional()}: the row is the member the session
	 * already resolved to, so there is no case here for none. A missing row would be a
	 * {@code competitor_id} on {@code account} pointing at nothing, which
	 * {@code account_competitor_fk} refuses outright.
	 */
	private Member memberRow(long me) {
		return db.sql("select gender, birth_year, first_season_2027 from competitor where id = ?")
				.param(me)
				.query((row, one) -> new Member(row.getString(1), row.getInt(2), row.getBoolean(3)))
				.single();
	}

	/**
	 * <p>Not a record anybody outside sees: {@code birth_year} is the short form of a date of
	 * birth and Article 74 forbids showing it (ADL A8), so it goes into a band here and never
	 * into an answer.
	 */
	private record Member(String gender, int birthYear, boolean firstSeason) {
	}
}
