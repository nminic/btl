package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.ZonedDateTime;
import java.util.List;

/**
 * WHOSE MEMBERSHIP FOR THE SEASON IS NOT ACTIVE, WORKED OUT AND NEVER QUEUED.
 *
 * <p><b>The owner, 27.09.2026 (PDL, section 15), choosing between three outcomes:</b> „Svidja
 * mi se pod 1, a da li moze postojati neki search da u tom domenu brzo pronadjem onog koga
 * treba proknjiziti (po clanskom broju, imenu ili prezimenu)?" The screen called Uplate stops
 * being a queue and becomes this list, and a row leaves it by the membership being written
 * rather than by anybody recording a decision.
 *
 * <p><b>WHY IT IS DERIVED AND NOT A QUEUE, WHICH IS A MEASUREMENT AND NOT A PREFERENCE.</b>
 * The queue tab was empty and always had been: {@code 'payments'} appears twice in the whole
 * backend and both are reads ({@link VerificationApi}), while five places write
 * {@code verification} and not one of them writes that queue. Paying happens entirely outside
 * the portal - the member pays, the bank shows the owner, and nothing here learns of it - so
 * there is no event a queue could hold. A tab was drawn because tabs are named after RIGHTS
 * rather than after items, which is why it looked alive.
 *
 * <p><b>THE LIST STARTS EMPTY AND FILLS, which is the opposite of what a queue would do and
 * is worth writing down because it was got wrong once.</b> Owner, 27.09.2026: „NIKO SE NE
 * DOVODI U PORTAL DOK SE SAM NE PRIJAVI KAD DODJE VREME." The imported history of competitors
 * is not a list of accounts and the import makes none, so on the first day this answers with
 * nothing and grows as people register themselves. An empty answer is therefore the ordinary
 * state of a working portal and never a fault, which is why nothing here turns emptiness into
 * a refusal - the refusal {@link VerificationApi} makes is about a moderator who may see no
 * tab at all, a different sentence.
 *
 * <p><b>WHAT „NOT ACTIVE" IS READ OFF, AND THE ONE OTHER PLACE IT MUST NOT BE READ OFF.</b>
 * The answer is the absence of a {@code membership} row for that person and that season (V22).
 * That table has no column of state - a row IS the membership - so „not active" is „no row",
 * and it must carry the SEASON: without it, last year's member who has not renewed has „a row"
 * and disappears from the screen, which in October 2027 is most of the list.
 *
 * <p>{@code competitor.active} is the other home of nearly the same fact and this route does
 * not read it. It answers „is he a member NOW" with no season on it, {@link PaymentApi} sets it
 * true beside writing the membership, and <b>nothing in the whole of {@code src/main} ever sets
 * it back to false</b>. So the two cannot be told apart on today's rows and would come apart on
 * the first row where they disagree. The question here is about a season, so the table with the
 * season in it decides, and {@code PaymentsDueApiTest} holds that with an account whose two
 * homes deliberately disagree.
 *
 * <p><b>AND BOTH BASES COUNT AS ACTIVE, which is the difference between reading {@code
 * membership} and reading {@code payment}.</b> ADL A12, widened by the owner on 26.09.2026:
 * somebody is activated in three ways, a recorded payment, a board decision freeing him from
 * the fee ({@code feeExempt}), and a balance. A route reading recorded payments would keep the
 * man who owes nothing on the screen for ever, and the moderator would be booking money nobody
 * owes him. {@code membership} holds all of them by construction, because the basis is a column
 * on it rather than a second table.
 *
 * <p><b>WHICH SEASON, AND WHY IT IS NOT A CHOICE.</b> {@link SeasonClock} has three methods
 * that answer with a year and they disagree in two different windows. This one reads
 * {@link SeasonClock#seasonBeingPaidFor} because {@code PaymentApi} reads exactly that when it
 * WRITES the membership: a reader and a writer of one fact ask the same question, or else the
 * moderator clicks Aktiviraj, a membership is written for one season, and this list goes on
 * asking about another and never lets the row go. The other two are wrong here and measurably
 * so: {@link SeasonClock#transfersTakeEffect} is a year ahead from January to September, and
 * {@link SeasonClock#seasonBeingRun} answers 2026 in October 2026 - a year the schema refuses
 * to have a membership in ({@code membership_season_not_before_the_league}), so every account
 * in the portal would surface at once on the day this ships.
 *
 * <p><b>WHAT IT SERVES, and every field had to earn its place.</b>
 *
 * <ul>
 * <li><b>{@code competitorId} is the whole purpose of the route.</b> Activation is
 * {@code POST /api/payments}, which takes a {@code Long competitorId} and nothing else that
 * identifies anybody. That id is served by no other route: {@link VerificationApi}'s record
 * carries a member NUMBER, {@link CompetitorApi} answers with the number too, and the front end
 * has not one occurrence of the word. Which is also why the number can never be the identity
 * here - the people this list exists for mostly have none.
 * <li><b>The name, because the owner reads a bank statement and looks for a named man.</b>
 * <li><b>The member number where there is one, blank where there is not</b>, because he named
 * it as one of the three things he would search by, so it has to be visible for a hit to be
 * confirmed by eye. <b>Blank rather than absent is MY choice and not a precedent, and the
 * difference is written down because the sentence that stood here claimed the opposite.</b> The
 * portal does both: {@link VerificationApi} answers {@code who} and the town blank and never
 * null, with its reason beside them, and it answers THIS field from {@code c.member_number}
 * raw, so on the queue it is null. The reason for choosing blank here is that a table cell is
 * drawn without asking whether a field is there, and the queue this replaces is being taken
 * away - not that anybody else serves this field that way.
 * <li><b>The town, and its reason is NEW rather than inherited.</b> The queue drew a town
 * because PDL P8 hung the way somebody pays on it; the owner's decision of 27.09.2026 (PDL,
 * section 14) removed the amount, the currency and the method from activation - „Novac je legao,
 * mogu da ga aktiviram" - so that reason is gone. It stays for a different one: nothing in the
 * schema stops two people sharing a first and last name, most of this list has no member number
 * to tell them apart, and a moderator picking the wrong row books one man's money to another.
 * The town is what he can read. <b>It does not decide anything about money here</b>, and that
 * sentence is written down because the old reason is still readable two files away.
 * <li><b>The country does not come.</b> Its only purpose was the one that fell, and it
 * separates no two people the town does not separate.
 * <li><b>The season comes once, on the answer rather than on every row.</b> The screen has to
 * say which season it is booking, and the front end cannot work it out: {@code
 * frontend/src/data/season.ts} exports {@code seasonRunning} and {@code transfersTakeEffect}
 * and has no {@code seasonBeingPaidFor}, so leaving it out would mean a third home for the one
 * question this class already had to settle.
 * <li><b>No amount, no currency, no method and no day</b>, because the owner's decision of
 * 27.09.2026 says the record of a payment has none of them and the price a member owes is
 * worked out on HIS side, where it is shown to him.
 * </ul>
 *
 * <p><b>NOTHING IS REFUSED HERE, and ADL A54 is why that is said out loud rather than left to
 * be noticed.</b> That decision requires a route to state which of the two meanings an omitted
 * field has, and its other half - a refused form says what is missing - is about forms being
 * refused. This route has no form: the search term is optional, and <b>absent and blank both
 * mean „the whole list"</b> rather than „nothing matches". There is no length at which a term
 * is refused, because no decision sets one and inventing a refusal is not this route's to make.
 *
 * <p><b>THE ORDER IS THE ONE A HUMAN READS, and it is total.</b> By surname then given name,
 * through the {@code sr_latn} collation the columns already carry (V1, O21), because that is
 * how somebody looks for a name he has just read off a statement. Never by member number, which
 * is what {@link CompetitorApi} sorts by: there everybody has one and here most have none. The
 * key comes last so that two people of one name cannot swap places between two readings of data
 * nobody touched.
 *
 * <p><b>AND IT DOES NOT PAGE, which is a boundary rather than an oversight.</b> No route in this
 * portal pages, so paging here would be a precedent invented for a list that begins empty. What
 * breaks and when: once the list is some hundreds of rows the answer is large and the search
 * stops being a convenience and becomes the only usable way in. That is the day this gets a
 * page and not before.
 */
@RestController
class PaymentsDueApi {

	private final JdbcClient db;

	private final Clock clock;

	PaymentsDueApi(JdbcClient db, Clock clock) {
		this.db = db;
		this.clock = clock;
	}

	/**
	 * One account whose membership for the season is not active.
	 *
	 * @param competitorId {@code competitor.id}, which is what {@code POST /api/payments} takes
	 *                     and the only thing on this row that identifies anybody to a machine
	 * @param memberNumber his, or BLANK where he has none - which since V16 is the ordinary
	 *                     state of somebody who has registered and never paid, and therefore
	 *                     the state most of this list is in
	 * @param firstName    as he registered it
	 * @param lastName     as he registered it
	 * @param city         where he lives, out of the codebook or as he typed it, and here to
	 *                     tell two people of one name apart rather than to decide anything
	 *                     about money
	 */
	record Due(long competitorId, String memberNumber, String firstName, String lastName,
			String city) {
	}

	/**
	 * @param season   the season the list is about, once for the whole answer because it is a
	 *                 fact about the question and not about any row
	 * @param accounts oldest surname first, and empty on the day the portal opens
	 */
	record Outstanding(int season, List<Due> accounts) {
	}

	/**
	 * @param search the member number, given name, surname or full name to look for. Absent and
	 *               blank are ONE answer, the whole list, and neither is refused (ADL A54 asks
	 *               every route to say which of the two meanings omission has; here it means
	 *               „do not narrow" and can never mean „match nothing")
	 */
	@GetMapping("/api/payments")
	@RightIsNeeded("queue:payments")
	Outstanding due(@RequestParam(name = "search", required = false) String search) {
		/* THE SEASON PAYMENT IS BEING TAKEN FOR, read ONCE for the whole answer. Read per row
		   it could cross 1 October between two rows of one list, and two accounts would be
		   answered about two different seasons under one heading. `PaymentApi` reads the same
		   method at the same point of its own work, which is what keeps the writer and this
		   reader from disagreeing about which membership closes a row. */
		int season = SeasonClock.seasonBeingPaidFor(ZonedDateTime.now(clock));

		String term = search == null ? "" : search.strip();

		return new Outstanding(season, notActiveIn(season, term));
	}

	/**
	 * <p><b>An INNER join onto {@code competitor}, and both directions of it are a rule.</b>
	 * {@code account.competitor_id} is empty for a moderator who does not race, which the owner
	 * called the ordinary case on 14.09.2026 - so a left join would put the administration on
	 * the screen as people who owe a fee. And reading {@code competitor} instead of
	 * {@code account} would put the imported history there, people who have never registered,
	 * against „NIKO SE NE DOVODI U PORTAL DOK SE SAM NE PRIJAVI". The intersection is exactly
	 * the population this screen is for: whoever signed himself up.
	 *
	 * <p><b>Whether his address is confirmed is not asked, and that is a decision rather than
	 * something forgotten.</b> PDL, the owner's change of 11.08.2026: „Clanstvo sme da se
	 * aktivira i pre nego sto je adresa potvrdjena", his word being „Sme". {@code POST
	 * /api/payments} reads that column nowhere either, so asking it here would have made the
	 * man whose money has arrived the one man who cannot be booked.
	 *
	 * <p><b>The town comes from whichever of the two places holds it.</b>
	 * {@code competitor_town_is_from_the_codebook_or_typed} (V7) makes exactly one of them
	 * present, so the coalesce cannot answer empty and cannot answer twice.
	 *
	 * <p><b>THE SEARCH IS TWO READINGS AND IT ANSWERS THREE KEYS, which is not a coincidence but
	 * the reason there are only two.</b> The owner named the member number, the given name and the
	 * surname. A term matches a substring of the number, or a substring of the two names joined by
	 * a space - and the second of those answers „ime" and „prezime" both, because every substring
	 * of either name is a substring of the pair. <b>Joining them is my own reasoning rather than a
	 * decision</b>, and it earns its place twice over: his reason for wanting a search at all was
	 * that he copies a name off a bank statement, where it is one string, so „Marko Markovic"
	 * finding nothing would be a miss on the first day.
	 *
	 * <p><b>Two conditions stood here until they were measured, and they were DEAD rather than
	 * wrong.</b> Separate readings of {@code first_name} and of {@code last_name} could not change
	 * any answer, for the reason just given, and a mutation deleting each of them passed. That is
	 * worse than clutter: a redundant condition is a reserve that catches exactly what a mutation
	 * over the load-bearing one removes, so the series reads healthier than it is.
	 *
	 * <p><b>AND A BOUNDARY, written down because no mutation can express it.</b> An explicit
	 * {@code :term = ''} stood in front of those two and was equally dead. An EMPTY pattern matches
	 * every non-null string, and both name columns are {@code not null} with
	 * {@code competitor_first_name_not_blank} beside them (V7), so the joined pair always matches
	 * it. A blank term therefore returns the whole list <b>through the same condition the name
	 * search uses</b>, and no replacement of a source can separate the two, because by construction
	 * they are one condition. {@code anAbsentOrBlankTermMeansTheWholeListAndIsNeverRefused}
	 * measures the OUTCOME and not the source, and that is the most it can do.
	 *
	 * <p><b>What the search deliberately is not:</b> insensitive to Serbian diacritics. That wants
	 * {@code unaccent}, V1 creates no extension at all, and a migration is not this branch's to
	 * write - so „Cacic" does not find „Čačić", and how far the case folding DOES reach is measured
	 * in the test rather than guessed at here.
	 *
	 * <p>{@code %} and {@code _} inside a term are taken as wildcards, because the pattern is
	 * assembled in the statement. Said rather than left to be found: a name contains neither, and
	 * the alternative is escaping that nobody would ever exercise.
	 */
	private List<Due> notActiveIn(int season, String term) {
		return db.sql("select c.id, coalesce(c.member_number, '') as member_number,"
						+ " c.first_name, c.last_name,"
						+ " coalesce(town.name, c.city) as city"
						+ " from account a"
						+ " join competitor c on c.id = a.competitor_id"
						+ " left join place town on town.id = c.place_id"
						/* NOT ACTIVE IS THE ABSENCE OF THE ROW, AND THE SEASON IS HALF OF IT.
						   Without `m.season`, anybody who was ever a member of anything is off
						   this list for good - which is last season's member who has not
						   renewed, the very person the screen exists for from October on. */
						+ " where not exists (select 1 from membership m"
						+ "                   where m.competitor_id = c.id and m.season = :season)"
						/* TWO READINGS AND NOT FOUR, and the other two were removed rather
						   than never written: a separate `c.first_name ilike ...` and
						   `c.last_name ilike ...` cannot change this answer, because every
						   substring of either name is a substring of the two joined. A
						   mutation removing each of them passed, which is what dead logic
						   looks like from outside - and worse, it is the reserve that makes
						   a mutation over the clause that IS load-bearing look caught. */
						+ " and (c.member_number ilike '%' || :term || '%'"
						+ "      or c.first_name || ' ' || c.last_name ilike '%' || :term || '%')"
						/* BY THE NAME AND NOT BY THE NUMBER, and the key last so the order is
						   total. See the note on this class for both halves. */
						+ " order by c.last_name, c.first_name, c.id")
				.param("season", season)
				.param("term", term)
				.query((row, i) -> new Due(row.getLong(1), row.getString(2), row.getString(3),
						row.getString(4), row.getString(5)))
				.list();
	}
}
