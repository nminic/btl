package com.btl.portal.web;

import com.btl.portal.domain.category.Category;
import com.btl.portal.domain.season.SeasonClock;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

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
 * <p><b>WHERE THE WISH IS STORED, AND WHICH SEASON IT IS READ FOR.</b> Since V81 the wish is a row per
 * member and season ({@code category_wish}), and the season here is the one being chosen,
 * {@link SeasonClock#seasonBeingPaidFor}: from 11 November that is next year, so a member who holds
 * the running season and ticks the box for the next one changes the next one alone, and the running
 * season keeps the category it began with (PDL P7, „Nema promene kategorije tokom godine"). Where no
 * row of that season exists yet the box opens on the last one before it (PDL, owner, 30.10.2026,
 * „Izbor kategorije za novu sezonu nasleđuje poslednji raniji izbor"). The debt the owner recorded on
 * 27.09.2026 about a column with 2027 in its name is paid by that migration; the wish, the right and
 * the category are asked of {@link CategoryOfASeason}, which every list asks as well.
 */
@Component
class TheChoiceAsItStands {

	private final JdbcClient db;

	private final CategoryOfASeason categories;

	private final Clock clock;

	TheChoiceAsItStands(JdbcClient db, CategoryOfASeason categories, Clock clock) {
		this.db = db;
		this.categories = categories;
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
		CategoryOfASeason.Book book = categories.of(me);
		boolean wish = book.wish(me, season);
		boolean allowed = book.allowed(me, season);

		return new MeCategoryApi.Choice(season, wish, allowed,
				Category.codeFor(whoHeIs.gender(), whoHeIs.birthYear(), season, wish && allowed),
				SeasonClock.categoryMayBeChosenFor(season, now));
	}

	/**
	 * What the row holds about him: the two facts a band is made of.
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
		return db.sql("select gender, birth_year from competitor where id = ?")
				.param(me)
				.query((row, one) -> new Member(row.getString(1), row.getInt(2)))
				.single();
	}

	/**
	 * <p>Not a record anybody outside sees: {@code birth_year} is the short form of a date of
	 * birth and section 3 of the privacy policy forbids showing it (ADL A8), so it goes into a band here and never
	 * into an answer.
	 */
	private record Member(String gender, int birthYear) {
	}
}
