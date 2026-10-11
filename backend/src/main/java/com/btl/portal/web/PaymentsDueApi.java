package com.btl.portal.web;

import com.btl.portal.domain.balance.Balance;
import com.btl.portal.domain.pricing.Currency;
import com.btl.portal.domain.pricing.MembershipPrice;
import com.btl.portal.domain.season.SeasonClock;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.MonthDay;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

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
 * The town is what he can read. <b>The town still decides nothing about money</b> - the CURRENCY
 * below is worked out from the country and never from the town's name, so two members of one town
 * are told apart here by nothing but the key.
 * <li><b>The country is READ and is not served, and both halves of that are the owner's
 * specification of 27.09.2026 rather than a leftover.</b> The sentence that stood here said „The
 * country does not come. Its only purpose was the one that fell" - and section 19 brought that
 * purpose back in a narrower shape: „Prazno polje sa oznakom valute pored njega. <b>Valuta zavisi
 * od zemlje clana.</b>" So the country is what the CURRENCY is worked out from, and the route reads
 * it through both of the homes V7 allows.
 * <p><b>It is not SERVED, and that is measured against what section 19 asks for rather than
 * assumed.</b> The three things it puts on the row are the expected amount, a field marked with a
 * currency, and a tick box carrying a balance; a country is not among them, and nothing on the
 * screen draws one. It also separates no two people the town does not separate, which was the
 * other half of the old sentence and is still true. So a fourth field would be a name no screen
 * reads, which is the thing {@code Answers} makes a case name out loud rather than carry in
 * silence - and {@code PaymentsDueApiTest} names the three that ARE new there.
 * <li><b>The season comes once, on the answer rather than on every row.</b> The screen has to
 * say which season it is booking, and the front end cannot work it out: {@code
 * frontend/src/data/season.ts} exports {@code seasonRunning} and {@code transfersTakeEffect}
 * and has no {@code seasonBeingPaidFor}, so leaving it out would mean a third home for the one
 * question this class already had to settle.
 * <li><b>THE EXPECTED AMOUNT, THE CURRENCY AND THE BALANCE, which are the three things section
 * 19 puts on the row and the three this route had to be changed to answer.</b> The sentence that
 * stood here said „No amount, no currency, no method and no day, because the owner's decision of
 * 27.09.2026 says the record of a payment has none of them and the price a member owes is worked
 * out on HIS side, where it is shown to him." Section 19 of the same day OVERTURNS it in as many
 * words - „Ovo obara sve ranije nacrte tog ekrana, ukljucujuci moj zakljucak iz odeljka 14 da
 * zapis o uplati nema iznos" - and the half of it that survives is worth keeping apart from the
 * half that fell:
 * <ul>
 * <li><b>The METHOD and the DAY still do not come, and now for a stronger reason than before.</b>
 * Neither is a question anybody is asked: PDL 20a fixes the method from where the member lives
 * („Srbin placa IPS uplatnicom, inostranstvo PayPal-om") and the day a payment is booked is the
 * portal's own clock and never a form.
 * <li><b>The AMOUNT comes, and it is what the member SENDS rather than what the membership
 * costs.</b> Owner, 27.09.2026: „„Ocekivan iznos" je ono sto clan SALJE, dakle sa uracunatom
 * taksom. Za clana iz inostranstva sa clanarinom 40 i taksom 3, labela kaze 43." So the
 * processing fee is added here, which is the one place in the portal that adds it without asking:
 * {@link MembershipInvoice} deliberately carries it raw, because on the member's own screen
 * whether anything is transferred at all is still open.
 * <li><b>AND THE PRICE COMES TOO, SINCE 10.10.2026: what the membership costs WITHOUT the
 * processing fee, and the one number a balance is measured against.</b> PDL, <b>[IZVEDENO
 * 02.10.2026]</b> „Članarina plaćena iz balansa ne nosi taksu ... Server tako i radi, a ekran se
 * usklađuje sa serverom (zaseban PR sa bekend delom)." The server takes {@code min(balance,
 * price)} off the book ({@code MembershipInvoice} compares the balance with
 * {@code price.amount()} and never with the amount plus the fee), so a member abroad whose
 * balance stands between 40 and 43 can be covered to the last para while the amount he SENDS is
 * still 43. The screen used to compare the balance with the expected amount and so labelled that
 * press „umanjen iznos" over a book the server spends as a whole fee; the owner's choice of
 * 10.10.2026 among the outcomes put to him (PDL, the entry „Odgovori na pitanja skupljena dok je
 * bio odsutan", item „Članstvo i uplate": „prompt „Odobri iz balansa" pokazuje članarinu umesto
 * očekivanog iznosa") needs the number on the row as well, so it is served and not worked out by
 * the screen, which cannot read the price list. <b>It is {@code price.amount()} of the very
 * object {@code expected} is added up from</b>, so the two cannot be two readings of one price.
 * <b>Called {@code price} and not {@code fee}</b> because {@code MembershipPrice.Price.fee} is
 * the processing fee, and a field named the same as a different thing is how the two get
 * swapped. Junior and period alike: the junior price replaces the period, and this is whichever
 * of them applies.
 * <li><b>The CURRENCY comes, worked out from the country and never asked for.</b>
 * <li><b>And the BALANCE comes, in that same currency</b>, because the owner chose exactly that
 * on 27.09.2026 and gave the reason: „kad balans pokriva razliku, oba broja <b>moraju</b> da budu
 * u istoj valuti da bi se oduzimanje uopste videlo", and „kurs u portalu ne postoji nigde".
 * </ul>
 * <li><b>It is what he has TODAY and never what a code promised him, and that is the owner's
 * decision of 27.09.2026 (PDL 23a) rather than the cheaper reading.</b> „Moderator aktivira sa
 * svog ekrana: odlucuje <b>kucica</b> i iznos koji stoji u njenoj labeli", against the other road
 * in which a promise decides. The case that settles it is the commonest one there is: a member
 * nobody has ever opened the membership screen for has NO promise at all, so a label fed from
 * promises would show him nothing while his book stood full. {@code balance_promise} is therefore
 * a table this route does not name, and a fixture where the two disagree is what holds it.
 * </ul>
 *
 * <p><b>NOTHING IS REFUSED HERE BUT A TERM THAT HOLDS A ZERO CHARACTER, and ADL A54 is why that
 * is said out loud rather than left to be noticed.</b> That decision requires a route to state
 * which of the two meanings an omitted field has, and its other half - a refused form says what
 * is missing - is about forms being refused. This route has no form: the search term is
 * optional, and <b>absent and blank both
 * mean „the whole list"</b> rather than „nothing matches". There is no length at which a term
 * is refused, because no decision sets one and inventing a refusal is not this route's to make.
 * The zero is not a length and not an invention: {@code text} cannot hold it, so a term carrying
 * one reached the statement and was answered 500 (measured on 09.10.2026 with
 * {@code search=%00}), and it is answered 400 now by the question {@link NoTextHoldsAZero} asks of
 * every text of a body. No other REQUEST parameter of this portal reaches a statement as it was
 * typed (a path variable does, and a zero in a path never gets this far).
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

	/*
	 * THE ONE COUNTRY THAT IS BILLED IN DINARS USED TO LIVE HERE, as `BILLED_IN_DINARS = "RS"` beside
	 * `DINARS` and `EURO`, with the whole derivation on it. It moved to `domain.pricing.Currency` on
	 * 28.09.2026 and the derivation went with it, because V42 gave the rule four more callers: the book
	 * of balance has to know which money to write a line in and which lines are a member's balance, the
	 * invoice which column of the price list to read, `PaymentApi` what a moderator's typed amount is
	 * in, and `MeWriteApi` whether a member editing his own record has changed the money he is billed
	 * in. This route still asks the question - it selects the country for every row of the screen and
	 * hands it to `Currency.of` - and it no longer answers it.
	 */

	private final JdbcClient db;

	private final Clock clock;

	/**
	 * The price list, read ONCE for the whole answer rather than per row.
	 *
	 * <p>Which row applies is a question about the day and about a year of birth
	 * ({@link MembershipPrice#on}), so it is answered in memory for every member off one reading
	 * of seven rows. Asked per row it would be one statement per person on the screen, and it
	 * could also cross an administrator's edit half way down one list.
	 */
	private final PriceRows priceRows;

	/**
	 * The book, and this is the only caller that READS it without ever writing a line.
	 *
	 * <p>Asked about the whole list in one statement ({@link BalanceBook#forEveryOneOf}) for the
	 * same reason the price list is read once. It is asked THROUGH that class and not summed here,
	 * because {@link BalanceBook} says of itself that nothing else in the portal names
	 * {@code balance_entry} - ADL's „saldo koji se uvek izvodi iz knjige" is only one answer if
	 * there is one place the deriving happens.
	 */
	private final BalanceBook book;

	PaymentsDueApi(JdbcClient db, Clock clock, PriceRows priceRows, BalanceBook book) {
		this.db = db;
		this.clock = clock;
		this.priceRows = priceRows;
		this.book = book;
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
	 * @param currency     which of the two the label beside the amount is marked with,
	 *                     {@code RSD} for a member living in Serbia and {@code EUR} for everybody
	 *                     else. Worked out from his country and never asked for: „Valuta zavisi od
	 *                     zemlje clana" (PDL, section 19)
	 * @param expected     what the portal expects HIM TO SEND in that currency, which is the
	 *                     membership fee that applies to him PLUS the processing fee where one is
	 *                     charged - forty and three make forty-three, the owner's own example. The
	 *                     junior price replaces whichever period applies rather than reducing it
	 *                     ({@link MembershipPrice})
	 * @param price        what the membership costs him in that currency WITHOUT the processing
	 *                     fee: the {@code expected} amount less the fee, which is the number a
	 *                     balance is measured against and the one the prompt for the balance names
	 *                     („Članarina: 40 EUR"). Whichever of the period and the junior price
	 *                     applies to him, from the same {@code MembershipPrice.Price} that
	 *                     {@code expected} is added up from. It is {@code price} and not
	 *                     {@code fee} because {@code Price.fee()} is the processing fee
	 * @param balance      what his book adds up to TODAY in that same currency, which is the
	 *                     number the tick box carries in its label, and never what a payment code
	 *                     once promised him (PDL 23a)
	 */
	record Due(long competitorId, String memberNumber, String firstName, String lastName,
			String city, String currency, BigDecimal expected, BigDecimal price, BigDecimal balance) {
	}

	/**
	 * @param season   the season the list is about, once for the whole answer because it is a
	 *                 fact about the question and not about any row
	 * @param accounts by surname and then given name, in the league's own alphabet, and empty on
	 *                 the day the portal opens
	 */
	record Outstanding(int season, List<Due> accounts) {
	}

	/**
	 * @param search the member number, given name, surname or full name to look for. Absent and
	 *               blank are ONE answer, the whole list, and neither is refused (ADL A54 asks
	 *               every route to say which of the two meanings omission has; here it means
	 *               „do not narrow" and can never mean „match nothing").
	 *               A term holding U+0000 is the one thing refused, with a 400.
	 */
	@GetMapping("/api/payments")
	@RightIsNeeded("queue:payments")
	Outstanding due(@RequestParam(name = "search", required = false) String search) {
		/* A ZERO CHARACTER IS NOT A TERM THE LIST CAN BE NARROWED BY. `text` cannot hold it, so it
		   would reach the statement below and come back as a 500; it is turned away here, with the
		   same question the reader of a body asks, before anything is worked out. */
		if (NoTextHoldsAZero.holdsAZero(search)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST);
		}

		/* THE SEASON PAYMENT IS BEING TAKEN FOR, read ONCE for the whole answer. Read per row
		   it could cross 15 October between two rows of one list, and two accounts would be
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
	 * <p><b>Two of those readings were measured and stayed DEAD; the third was measured, found to
	 * be guarding something else, and came back.</b> Separate readings of {@code first_name} and
	 * of {@code last_name} could not change any answer, for the reason just given, and a mutation
	 * deleting each of them passed. That is worse than clutter: a redundant condition is a reserve
	 * that catches exactly what a mutation over the load-bearing one removes, so the series reads
	 * healthier than it is. Both stay deleted.
	 *
	 * <p><b>{@code :term = ''} is back, and the sentence that justified deleting it was measured
	 * and is FALSE.</b> It claimed that no replacement of a source could separate „the term is
	 * blank" from „the name search matches", because they are, by construction, one condition: an
	 * EMPTY pattern matches every non-null string, and both name columns are {@code not null}
	 * ({@code competitor_first_name_not_blank}, V7), so the joined pair always matches it and
	 * deleting {@code :term = ''} changed no answer. <b>That is true only while the join above
	 * stays INNER, and the inner-ness of the join is exactly the one fact this clause by itself
	 * cannot express.</b> Turn it into a {@code left join} and an administrative account with no
	 * competitor of its own carries {@code null} in every column {@code c} owns: the
	 * {@code not exists} above is vacuously true for it ({@code m.competitor_id = null} matches no
	 * membership), and the two {@code ilike} readings are {@code null or null}, which is not
	 * {@code true} - so before this change the row dropped out BY ACCIDENT, on a condition whose
	 * written purpose is the name search and not the join. {@code :term = ''} touches no column of
	 * {@code c}, so restoring it takes that accident away: a blank search now asks the join to do
	 * its own job, the administration surfaces the moment it is not inner, and
	 * {@code anAccountWithNoMemberOfItsOwnIsNotOnTheListAlthoughItHasNoMembershipEither} is what
	 * catches it. <b>The condition is still dead while the join is correct</b> - deleting it today
	 * changes no answer, same as before, and that remains true and unremarkable. What changed is
	 * that „dead today" stopped meaning „safe to delete": a second mutation, over the join this
	 * query opens with, can make {@code :term = ''} the only thing standing between a blank search
	 * and the people who run the portal appearing on a list of who owes it money.
	 * {@code anAbsentOrBlankTermMeansTheWholeListAndIsNeverRefused} still measures the OUTCOME of
	 * a blank term and not the source; the join is what the source now answers for.
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
		List<OnTheList> rows = whoIsNotActiveIn(season, term);

		/* EVERY MEMBER'S MONEY FIRST, because since V42 it is what the book is asked IN and not only
		   what the label is marked with. The country is already on the row - this route selects it for
		   exactly this purpose - so `Currency.of` is applied here rather than asked of the database a
		   second time per person. */
		Map<Long, Currency> monies = rows.stream().collect(
				Collectors.toMap(OnTheList::id, one -> Currency.of(one.countryCode())));

		/* THE BOOK AND THE PRICE LIST, ONE READING EACH FOR THE WHOLE ANSWER. Read per row, the
		   book would be one statement per person and the price list could cross an
		   administrator's edit half way down one list, so two members of one age would be
		   quoted two different prices under one heading. */
		Map<Long, Balance.Money> books = book.forEveryOneOf(monies);
		List<MembershipPrice.Row> priceList = priceRows.all();

		MonthDay today = MonthDay.from(LocalDate.ofInstant(clock.instant(), SeasonClock.ZONE));

		return rows.stream().map(one -> {
			Currency his = monies.get(one.id());

			MembershipPrice.Price price = MembershipPrice.on(priceList, today,
					one.birthDate().getYear(), season, his);

			/* WHAT HE SENDS AND NOT WHAT THE MEMBERSHIP COSTS, which is the owner's choice of
			   27.09.2026 and the whole reason this is an addition rather than a column: „„Ocekivan
			   iznos" je ono sto clan SALJE, dakle sa uracunatom taksom." `MembershipPrice` already
			   answers nought for the fee on the dinar side, so the same line is right in both
			   currencies rather than branching on one of them. */
			BigDecimal expected = price.amount().add(price.fee());

			/* AND WHAT HE IS CHARGED WITHOUT THE FEE ON THE SAME ROW, taken from the very `price`
			   `expected` was just added up from: a balance is measured against this and never
			   against the sum (PDL, „Članarina plaćena iz balansa ne nosi taksu"), and two readings
			   of one price list in one answer could part by a day or a junior's birth year. */
			return new Due(one.id(), one.memberNumber(), one.firstName(), one.lastName(), one.city(),
					his.name(), expected, price.amount(), books.get(one.id()).amount());
		}).toList();
	}

	/**
	 * One row as the database holds it, before the price list and the book are asked about it.
	 *
	 * @param countryCode never null: {@code place.country_id} is {@code not null} (V3) and
	 *                    {@code competitor_typed_town_names_its_country} (V7) makes the typed
	 *                    country present exactly when the typed town is, so of the two homes one
	 *                    always answers
	 */
	private record OnTheList(long id, String memberNumber, String firstName, String lastName,
			String city, LocalDate birthDate, String countryCode) {
	}

	private List<OnTheList> whoIsNotActiveIn(int season, String term) {
		return db.sql("select c.id, coalesce(c.member_number, '') as member_number,"
						+ " c.first_name, c.last_name,"
						+ " coalesce(town.name, c.city) as city,"
						+ " c.birth_date,"
						/* THE COUNTRY THROUGH BOTH OF ITS HOMES, the shape `CompetitorApi`,
						   `MeApi` and `VerificationApi` all already use for the same column.
						   `competitor_town_is_from_the_codebook_or_typed` (V7) makes exactly one
						   of the two present, so this coalesce cannot answer empty and cannot
						   answer twice - the same sentence the town beside it stands on. */
						+ " coalesce(town_country.code, typed_country.code) as country_code"
						+ " from account a"
						+ " join competitor c on c.id = a.competitor_id"
						+ " left join place town on town.id = c.place_id"
						+ " left join country town_country on town_country.id = town.country_id"
						+ " left join country typed_country on typed_country.id = c.country_id"
						/* NOT ACTIVE IS THE ABSENCE OF THE ROW, AND THE SEASON IS HALF OF IT.
						   Without `m.season`, anybody who was ever a member of anything is off
						   this list for good - which is last season's member who has not
						   renewed, the very person the screen exists for from October on. */
						+ " where not exists (select 1 from membership m"
						+ "                   where m.competitor_id = c.id and m.season = :season)"
						/* THREE READINGS AND NOT FIVE. Two, a separate `c.first_name ilike ...`
						   and `c.last_name ilike ...`, were removed and stay removed: every
						   substring of either name is a substring of the two joined, so a
						   mutation deleting each of them passed, which is what dead logic looks
						   like from outside - and worse, it was the reserve that made a mutation
						   over the load-bearing joined reading look caught.
						   THE THIRD, `:term = ''`, IS BACK, and not for its own sake: it is the
						   one reading here that never touches `c`, so it is the one still true
						   for an administrative account should the join above stop being inner.
						   See the note on this method for what that guards and what it
						   measurably does not. */
						+ " and (:term = ''"
						+ "      or c.member_number ilike '%' || :term || '%'"
						+ "      or c.first_name || ' ' || c.last_name ilike '%' || :term || '%')"
						/* BY THE NAME AND NOT BY THE NUMBER, and the key last so the order is
						   total. See the note on this class for both halves. */
						+ " order by c.last_name, c.first_name, c.id")
				.param("season", season)
				.param("term", term)
				.query((row, i) -> new OnTheList(row.getLong(1), row.getString(2), row.getString(3),
						row.getString(4), row.getString(5), row.getDate(6).toLocalDate(),
						row.getString(7)))
				.list();
	}
}
