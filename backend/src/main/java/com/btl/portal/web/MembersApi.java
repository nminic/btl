package com.btl.portal.web;

import com.btl.portal.domain.balance.Balance;
import com.btl.portal.domain.category.Category;
import com.btl.portal.domain.pricing.Currency;
import com.btl.portal.domain.pricing.MembershipPrice;
import com.btl.portal.domain.season.SeasonClock;
import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.MonthDay;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * THE MEMBERS AS THE MODERATION OF THE MEMBERS READS THEM: every one who was ever given a member
 * number, whether his fee stands or not, with every season he was a member of.
 *
 * <p><b>Why a route of its own and not a parameter on {@link CompetitorApi}.</b> The owner,
 * 18.10.2026 (PDL P8, „Osnov članstva ima jedan dom”): „Moderacija članova za administraciju
 * prikazuje i neaktivne članove, uz filter ... javni spisak ostaje samo aktivni.” The public list
 * ends {@code where c.active}, and the portal reads the PRESENCE of a row on it as „this member is
 * active" on twenty screens ({@code frontend/src/data/types.ts}, the note on {@code Competitor}). A
 * lapsed member put on that answer for the administration would be a member the administration's
 * own screens draw as present everywhere else. So he arrives here, on an answer only the moderation
 * reads, and {@link CompetitorApi} is not touched.
 *
 * <p><b>Who may read it</b> is the administration over the members, the same right the basis is
 * read under on the public list ({@link CompetitorApi#OVER_THE_MEMBERS}; PDL P8, „Ko sme:
 * superadmin i moderator sa pravom nad članovima”). A visitor is answered 401 by the chain, because
 * this address is not on {@code ApiSecurity.READ_BY_ANYBODY}, and anybody signed in without the right
 * is answered 404 by {@link RightIsNeeded} (ADL A8).
 *
 * <p><b>Who is on it</b> is the owner's decision of 21.09.2026 (PDL, „Spisak članova u
 * administraciji”): „„Svi" znači aktivni plus neaktivni, dakle svako ko je ikad dobio članski broj”,
 * and an account that registered and was never given a number is on none of the three values of the
 * filter, because the row „Uplate" is where that man is handled. The filter itself is the screen's;
 * this answers all of them once and says which are active.
 *
 * <p><b>Active is {@code competitor.active}</b>, the column every other door reads, so the
 * moderation's „Aktivni" is exactly the public list. A boundary rather than an oversight: nothing in
 * the portal writes {@code active = false} today, so „Neaktivni" stays empty on a real database until
 * the flag is derived from the rows of {@code membership}, which is its own increment (V22).
 */
@RestController
class MembersApi {

	private final JdbcClient db;

	private final Clock clock;

	private final PriceRows priceRows;

	private final BalanceBook book;

	MembersApi(JdbcClient db, Clock clock, PriceRows priceRows, BalanceBook book) {
		this.db = db;
		this.clock = clock;
		this.priceRows = priceRows;
		this.book = book;
	}

	/**
	 * One season a member was a member of, and on what basis.
	 *
	 * @param season the season, never before 2027, which {@code membership} cannot hold
	 * @param basis  that season's own basis, read off that season's row and not off the season on sale
	 */
	record Season(int season, String basis) {
	}

	/**
	 * @param active           whether his fee stands, as {@code competitor.active} says it
	 * @param membershipBasis  the basis of the season ON SALE ({@link SeasonClock#seasonBeingPaidFor}),
	 *                         absent for a member who holds no row of it: the same field, under the
	 *                         same name and the same rule, as {@link CompetitorApi.Competitor}
	 * @param membershipSeason the season {@code membershipBasis} is the basis of, present exactly when
	 *                         it is
	 * @param seasons          every season he holds a row of, oldest first, each with its own basis;
	 *                         empty and never absent for a member who holds none. The screen's column
	 *                         „Poslednja sezona" is the last of these, so the fact has this one home
	 *                         (PDL P8, „Kolona sa poslednjom sezonom u moderaciji broji svaki osnov”)
	 * @param seasonOnSale     the season the four figures below are about, which is the season a
	 *                         payment recorded on this row buys ({@link SeasonClock#seasonBeingPaidFor};
	 *                         PDL P8, „do 14.10. samo tekuća, od 15.10. samo naredna”), so a question
	 *                         put about it names its year. One reading of the clock for the whole answer
	 * @param currency         the money he is billed in, from his country ({@link Currency#of})
	 * @param expected         what he sends for the season on sale, the processing fee included: the
	 *                         payments screen's „Očekivan iznos”, worked out the same way
	 *                         ({@link PaymentsDueApi})
	 * @param price            the membership without the fee, which is what a balance is measured
	 *                         against (PDL, „Članarina plaćena iz balansa ne nosi taksu”)
	 * @param balance          what his book holds, in his money. The four are answered to the
	 *                         administration over the members by the owner's decision of 18.10.2026
	 *                         (PDL P8, „Moderator sa pravom nad članovima vidi balans i očekivani iznos
	 *                         svakog člana na redu u moderaciji, isto kao na ekranu Uplate”), so that
	 *                         recording a payment on the row asks „Prihvatam umanjen ukupan iznos?”
	 *                         before anything is sent
	 */
	record Member(String memberNumber, String firstName, String lastName, String gender,
			String city, String ageBand, boolean firstSeason2027, boolean active,
			@JsonInclude(JsonInclude.Include.NON_NULL) String membershipBasis,
			@JsonInclude(JsonInclude.Include.NON_NULL) Integer membershipSeason,
			List<Season> seasons, int seasonOnSale, String currency, BigDecimal expected,
			BigDecimal price, BigDecimal balance) {
	}

	private record Row(long id, String memberNumber, String firstName, String lastName, String gender,
			String city, boolean firstSeason2027, boolean active, String basis, int birthYear,
			String countryCode) {
	}

	@GetMapping("/api/members")
	@RightIsNeeded(CompetitorApi.OVER_THE_MEMBERS)
	List<Member> members() {
		/* The clock is read ONCE for the whole answer, as `CompetitorApi` reads it: the band for the
		   season it is worked out for, and the basis for the season on sale, which from 15 October
		   is the next one. */
		ZonedDateTime now = ZonedDateTime.now(clock);
		int season = SeasonClock.seasonTheBandIsWorkedOutFor(now);
		int sold = SeasonClock.seasonBeingPaidFor(now);

		/* EVERY SEASON OF EVERY MEMBER ON THE LIST, read once and handed out by member. Oldest
		   first, which the screen relies on to name the last one. */
		Map<Long, List<Season>> held = new HashMap<>();

		db.sql("select m.competitor_id, m.season, m.basis from membership m"
						+ " order by m.competitor_id, m.season")
				.query((row, one) -> held.computeIfAbsent(row.getLong(1), any -> new ArrayList<>())
						.add(new Season(row.getInt(2), row.getString(3))))
				.list();

		List<Row> rows = db.sql("select c.id, c.member_number, c.first_name, c.last_name, c.gender,"
						+ " coalesce(town.name, c.city) as city, c.first_season_2027, c.active,"
						+ " sold.basis, c.birth_year,"
						/* THE COUNTRY THROUGH BOTH OF ITS HOMES, the shape `PaymentsDueApi` reads the
						   same column with: V7 makes exactly one of the two present. */
						+ " coalesce(town_country.code, typed_country.code) as country_code"
						+ " from competitor c"
						+ " left join place town on town.id = c.place_id"
						+ " left join country town_country on town_country.id = town.country_id"
						+ " left join country typed_country on typed_country.id = c.country_id"
						/* `membership_pk` is (competitor, season), so this joins at most one row. */
						+ " left join membership sold on sold.competitor_id = c.id"
						+ "  and sold.season = :sold"
						/* EVERYBODY WHO WAS EVER GIVEN A NUMBER, and nobody else (PDL, 21.09.2026). */
						+ " where c.member_number is not null"
						+ " order by c.member_number")
				.param("sold", sold)
				.query((row, one) -> new Row(row.getLong(1), row.getString(2), row.getString(3),
						row.getString(4), row.getString(5), row.getString(6), row.getBoolean(7),
						row.getBoolean(8), row.getString(9), row.getInt(10), row.getString(11)))
				.list();

		/* EVERY MEMBER'S MONEY, THEN THE BOOK AND THE PRICE LIST ONE READING EACH FOR THE WHOLE ANSWER,
		   which is `PaymentsDueApi`'s order and its reason: read per row, the price list could cross an
		   administrator's edit half way down one list. */
		Map<Long, Currency> monies = rows.stream().collect(
				Collectors.toMap(Row::id, one -> Currency.of(one.countryCode())));
		Map<Long, Balance.Money> books = book.forEveryOneOf(monies);
		List<MembershipPrice.Row> priceList = priceRows.all();
		MonthDay today = MonthDay.from(LocalDate.ofInstant(clock.instant(), SeasonClock.ZONE));

		return rows.stream().map(one -> {
			Currency his = monies.get(one.id());

			/* THE SEASON ON SALE AND NOT THE SEASON THE BAND IS WORKED OUT FOR, which is the one read
			   above for the band: from 15 October the two are different years, and the junior price
			   follows the season paid for (`MembershipPrice.on`). */
			MembershipPrice.Price price = MembershipPrice.on(priceList, today, one.birthYear(), sold, his);

			return new Member(one.memberNumber(), one.firstName(), one.lastName(), one.gender(),
					one.city(), Category.ageBandFor(one.birthYear(), season).code(),
					one.firstSeason2027(), one.active(),
					one.basis(), one.basis() == null ? null : sold,
					List.copyOf(held.getOrDefault(one.id(), List.of())),
					sold, his.name(), price.amount().add(price.fee()), price.amount(),
					books.get(one.id()).amount());
		}).toList();
	}
}
