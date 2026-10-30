package com.btl.portal.web;

import com.btl.portal.domain.category.Category;
import com.btl.portal.domain.season.SeasonClock;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;

/**
 * THE CATEGORY A MEMBER RUNS IN, ONE SEASON AT A TIME, AND THE ONE PLACE IT IS WORKED OUT.
 *
 * <p><b>PDL, owner, 30.10.2026: „Hocu strukturalno ovo da resim, zasto se kategorije ne cuvaju po sezoni
 * vec sad?"</b> The wish is kept per member and season ({@code category_wish}, V81), and the category of a
 * season is three facts about THAT season and no other:
 * <ul>
 * <li>the age band, from the year of birth and the season (PDL P7, „Ako takmičar tokom kalendarske godine
 * puni godine za stariju kategoriju, on je u toj kategoriji od 1. januara te godine"), which is
 * {@link Category#ageBandFor};</li>
 * <li>the wish for that season, which is the latest row not after it (PDL, 30.10.2026, „Izbor kategorije
 * za novu sezonu nasleđuje poslednji raniji izbor"), and the age category where he has none at all („Starosna
 * je podrazumevana samo kad član nema nijedan raniji izbor");</li>
 * <li>and the right, the best official season STRICTLY BEFORE it ({@link BestOfficialSeason#bestBefore}).
 * PDL P7, derived 26.09.2026: „kategorija u kojoj se takmiči je izvedena: želja i pravo".</li>
 * </ul>
 *
 * <p><b>Every reader asks this, so no two of them can name two categories for one member and one
 * season:</b> the list ({@link CompetitorApi}), his own record ({@link MeApi}), the administration's list
 * ({@link MembersApi}), every runner of {@link ResultApi}, and the box of {@code /api/me/category}
 * ({@link TheChoiceAsItStands}). The reading is one {@link Book}, taken once per answer, because a
 * category per row asked of the database per row would be a query per member per season.
 *
 * <p><b>A frozen season keeps its category without being stored again</b>, and the reason is worth saying
 * because nothing here writes {@code season_competitor} (V17) yet. The wish of a season cannot be written
 * after 1 January of it at 10:00 ({@link SeasonClock#categoryMayBeChosenFor}), a wish of a later season
 * cannot change it (the latest row NOT AFTER it), the band of a season is a function of the season, and the
 * right reads only seasons before it. What can still move it is a correction of a race or a cancellation in
 * a season before it; that is the boundary until the freeze writes its snapshot.
 */
@Component
class CategoryOfASeason {

	private final JdbcClient db;

	private final BestOfficialSeason bestOfficialSeason;

	CategoryOfASeason(JdbcClient db, BestOfficialSeason bestOfficialSeason) {
		this.db = db;
		this.bestOfficialSeason = bestOfficialSeason;
	}

	/**
	 * The category of one season as every answer serves it: the band and never the finished code, so the
	 * sex is not written twice (PDL, 13.09.2026), and the season it is the category OF.
	 *
	 * @param season   the season this is the category of
	 * @param ageBand  {@code 24-}, {@code 25-39}, {@code 40-54} or {@code 55+}, for that season
	 * @param beginner whether he runs in the beginners' category in that season: the wish AND the right
	 */
	record OfASeason(int season, String ageBand, boolean beginner) {
	}

	/**
	 * One membership of his: the season, and whether it ranks (PDL, 28.10.2026: activated by 31 March).
	 */
	record Held(int season, boolean ranks) {
	}

	/** Everything the category of any season is worked out from, read for everybody at once. */
	Book everybody() {
		return read(null);
	}

	/** The same, for one member alone. */
	Book of(long member) {
		return read(member);
	}

	private Book read(Long onlyOf) {
		Map<Long, NavigableMap<Integer, Boolean>> wishes = new HashMap<>();

		db.sql("select competitor_id, season, beginner from category_wish"
						+ " where cast(:onlyOf as bigint) is null or competitor_id = cast(:onlyOf as bigint)")
				.param("onlyOf", onlyOf)
				.query((row, one) -> wishes.computeIfAbsent(row.getLong(1), any -> new TreeMap<>())
						.put(row.getInt(2), row.getBoolean(3)))
				.list();

		Map<Long, List<Held>> held = new HashMap<>();

		db.sql("select m.competitor_id, m.season, " + WhenASeasonWasActivated.of("m") + " from membership m"
						+ " where m.competitor_id is not null"
						+ " and (cast(:onlyOf as bigint) is null or m.competitor_id = cast(:onlyOf as bigint))"
						+ " order by m.competitor_id, m.season")
				.param("onlyOf", onlyOf)
				.query((row, one) -> held.computeIfAbsent(row.getLong(1), any -> new ArrayList<>())
						.add(new Held(row.getInt(2), WhenASeasonWasActivated.ranks(row.getInt(2),
								row.getTimestamp(3)))))
				.list();

		return new Book(wishes, bestOfficialSeason.totals(onlyOf), held);
	}

	/**
	 * What was read, and every question about it answered here and nowhere else.
	 */
	static final class Book {

		private final Map<Long, NavigableMap<Integer, Boolean>> wishes;

		private final Map<Long, Map<Integer, BigDecimal>> totals;

		private final Map<Long, List<Held>> held;

		Book(Map<Long, NavigableMap<Integer, Boolean>> wishes, Map<Long, Map<Integer, BigDecimal>> totals,
				Map<Long, List<Held>> held) {
			this.wishes = wishes;
			this.totals = totals;
			this.held = held;
		}

		/**
		 * What he wants for a season: the latest wish not after it, and the age category where there is
		 * none (PDL, 30.10.2026).
		 */
		boolean wish(long member, int season) {
			Map.Entry<Integer, Boolean> latest = wishes.getOrDefault(member, new TreeMap<>()).floorEntry(season);

			return latest != null && latest.getValue();
		}

		/** Whether the beginners' category is open to him for a season: the best season strictly before it. */
		boolean allowed(long member, int season) {
			return Category.firstSeasonAllowed(
					BestOfficialSeason.bestBefore(totals.getOrDefault(member, Map.of()), season));
		}

		/** The category he runs in, in one season. */
		OfASeason in(long member, int birthYear, int season) {
			return new OfASeason(season, Category.ageBandFor(birthYear, season).code(),
					wish(member, season) && allowed(member, season));
		}

		/** Every season he holds a membership of, oldest first. */
		List<Held> held(long member) {
			return held.getOrDefault(member, List.of());
		}

		/**
		 * THE CATEGORY OF EVERY SEASON HE STANDS IN THE TABLE OF, oldest first: a membership of it that
		 * ranks. PDL, 30.10.2026: „Za sezonu bez prava rangiranja server u javnom odgovoru ne šalje ni
		 * kategoriju ni oznaku da je član bez prava", so such a season is simply not here, which is what
		 * the table of that season already shows.
		 */
		List<OfASeason> standing(long member, int birthYear) {
			return held(member).stream()
					.filter(Held::ranks)
					.map(one -> in(member, birthYear, one.season()))
					.toList();
		}

		/**
		 * THE SEASON THE PLACES THAT ARE NOT TIED TO A SEASON SPEAK OF: his card on the list and the head of
		 * his profile. PDL, owner, 30.10.2026: „dok traje trenutna sezona, prikazuje se kategorija u
		 * trenutnoj sezoni. Ukoliko clan nije clan trenutne sezone nego naredne, prikazuje se na njegovom
		 * profilu da je clan te buduce kategorije. Ukoliko clan jeste clan i tekuce i naredne sezone, 1.1.
		 * se njegova kategorija automatski menja".
		 *
		 * <p>So the running season where he holds it, the one on sale where he holds only that, and the
		 * running season again where he holds neither (a member on the list with no row of either
		 * season, which the list itself already treats as somebody whose fee stands).
		 *
		 * @param at the one reading of the clock the whole answer is made from
		 */
		int seasonOfTheCard(long member, ZonedDateTime at) {
			int running = SeasonClock.seasonTheBandIsWorkedOutFor(at);
			int onSale = SeasonClock.seasonBeingPaidFor(at);

			if (holds(member, running) == null && holds(member, onSale) != null) {
				return onSale;
			}

			return running;
		}

		/**
		 * The category of his card, for a reader who may be told it: null where he holds the season of
		 * the card without the right to rank in it (PDL, 30.10.2026, „ne prikazuje se javno nigde njegov
		 * odabir"), EXCEPT that a member who holds the running season without the right and holds the one on
		 * sale as well is carded for the one on sale. PDL, owner, 30.10.2026: „Član koji je u tekućoj sezoni
		 * bez prava rangiranja, a platio je i narednu, od 11.11. do 31.12. ima na kartici kategoriju naredne
		 * sezone", the reason being that otherwise he would be the one member on the public list with no
		 * category, and the list would say he is without the right. The exception is for the member whose
		 * running category is not shown anyway, so it is never the running season's category that is carried
		 * (that would hand out the choice the decision keeps back).
		 */
		OfASeason onTheCard(long member, int birthYear, ZonedDateTime at) {
			int season = seasonOfTheCard(member, at);
			Held that = holds(member, season);

			if (that == null || that.ranks()) {
				return in(member, birthYear, season);
			}

			int onSale = SeasonClock.seasonBeingPaidFor(at);
			Held next = onSale == season ? null : holds(member, onSale);

			return next == null || !next.ranks() ? null : in(member, birthYear, onSale);
		}

		/**
		 * The same category told to him and to the administration, who are not the public (PDL,
		 * 18.10.2026, „profil, kartica takmičara, tim, administracija ... odmah pokazuju novu kategoriju"),
		 * so never withheld.
		 */
		OfASeason onHisOwnCard(long member, int birthYear, ZonedDateTime at) {
			return in(member, birthYear, seasonOfTheCard(member, at));
		}

		private Held holds(long member, int season) {
			return held(member).stream().filter(one -> one.season() == season).findFirst().orElse(null);
		}
	}
}
