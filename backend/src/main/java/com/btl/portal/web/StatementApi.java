package com.btl.portal.web;

import com.btl.portal.domain.pricing.Currency;
import com.btl.portal.domain.pricing.MembershipPrice;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.statement.AikStatement;
import com.btl.portal.domain.statement.PayerName;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/**
 * A BANK STATEMENT TAKEN ON THE PAYMENTS SCREEN, AND THE PAYMENTS ON IT THAT STILL WAIT.
 *
 * <p><b>Owner, 24.10.2026</b> (PDL „Učitavanje izvoda iz banke na ekranu Uplate", all four chosen with
 * my recommendation):
 * <ul>
 * <li>„Server iz PDF izvoda (AIK banka, račun 105-0000000003284-71) čita svaku uplatu koja potražuje:
 * uplatioca, njegov račun, iznos, šifru plaćanja, svrhu i poziv na broj kad postoji. Isplate (naknade
 * banke) se preskaču." That is {@link AikStatement}.
 * <li>„Kad poziv na broj imenuje člana i sezonu ({@code YYYYNNNNNN}) i iznos je tačno očekivani, uplata
 * se evidentira sama. Sve ostalo (manji ili veći iznos, nepoznat broj) ide na ručnu potvrdu." That is
 * {@link #take}.
 * <li>A payment without a reference, owner, 26.11.2026: „Uplata bez poziva na broj knjiži se sama po imenu
 * kad imenu i prezimenu uplatioca odgovara tačno jedan član, iznos je tačno onaj koji se od njega
 * očekuje, a član za tu sezonu još nije aktivan. Sve ostalo (dva ili više imenjaka, drugi iznos) ostaje
 * predlog na potvrdi." And „Ime unutar teksta uplatioca daje predlog, nikad knjiženje." The member the
 * name books is {@link ByName#theOneItBooks}, and the suggestion is {@link #candidatesFor}. The click
 * that confirms a suggestion is the owner's of 25.10.2026 (PDL „Učitavanje izvoda: dva odgovora od 25.10.2026"): it
 * opens the member's row on the Payments screen with the line's amount written in, and the booking goes
 * through {@link PaymentApi}, which writes it onto the line ({@link PaymentApi.Confirm#statementLine}).
 * It stands on every line that waits, with a reference or without one (coordinator, 25.10.2026).
 * <li>A line that is no membership fee „zatvara se dugmetom „Nije članarina", bez knjiženja; portal pamti
 * ko ju je zatvorio i kad" (owner, 25.10.2026): {@link #setAside}.
 * <li>„Server pamti broj izvoda i stavke (da se isti izvod ne knjiži dvaput), a sam PDF ne čuva." The
 * statement and its lines are V74; the file is read in memory here and kept nowhere.
 * </ul>
 *
 * <p><b>„TAČNO OČEKIVANI" IS THE AMOUNT ON THE LABEL „Očekivan iznos"</b>, derived by the coordinator
 * on 25.10.2026 from the owner's decision of 27.09.2026 („Labela „Ocekivan iznos: IZNOS", koja prikazuje
 * koliku uplatu portal očekuje od tog člana"), and not the owner's own words: the price with its fee,
 * {@link MembershipPrice.Price#expected}, the one home both the label and this read. So a member who
 * has a balance and paid what his QR code asked, which is less, goes to the manual confirmation.
 *
 * <p><b>THERE IS ONE WAY TO BOOK A PAYMENT AND THIS IS NOT A SECOND ONE.</b> A line that qualifies is
 * booked by {@link BookingAPayment#book}, the body {@link PaymentApi} and {@link MemberPaymentApi}
 * already share, with the member's row taken {@code for update} first as both of them take it, and the
 * beginners' category asked before and after exactly as {@link PaymentApi#confirm} asks it. What this
 * class adds is only the question of WHICH lines qualify, and every line that does not is left for a
 * person. The money is {@code ips}, because a slip into the dinar account is what that word means
 * (PDL 23b); the balance is not asked to pay, because an amount that is exactly the expected one
 * leaves nothing owed for it to pay; and the reference goes onto the payment, as a moderator typing it
 * would put it. Whoever took the statement is who recorded the payment.
 *
 * <p><b>THE SEASON IS THE CLOCK'S, NEVER THE REFERENCE'S</b> (PDL, POTVRDJENO 13.09.2026: the day the
 * money is booked decides the season it buys), read once for the whole statement. A reference naming
 * another year is a reference this does not trust to book by itself, and its line waits.
 *
 * <p><b>The same statement taken twice books nothing the second time</b>, and is not refused either:
 * its key is found and its lines are shown as they stand. A line is known by the bank's order number
 * over every statement, so one payment printed on two statements is one line. Two takings of one
 * statement at once meet on those keys and the second waits for the first, then adds nothing.
 *
 * <p><b>Rights:</b> {@code queue:payments}, the tick the screen it serves is opened by; a stranger is
 * 401 and a member or a moderator without the tick 404 (ADL A8).
 */
@RestController
class StatementApi {

	static final String THE_STATEMENT_IS_MISSING = "theStatementIsMissing";

	static final String THE_STATEMENT_IS_TOO_LARGE = "theStatementIsTooLarge";

	static final String THE_FILE_IS_NOT_A_STATEMENT = "theFileIsNotAStatement";

	static final String THE_STATEMENT_IS_OF_ANOTHER_ACCOUNT = "theStatementIsOfAnotherAccount";

	/** A line set aside that was booked already, or set aside already. */
	static final String THE_LINE_IS_SETTLED = "theStatementLineIsSettled";

	/** What a line is, as the screen is told. */
	static final String BOOKED = "booked";

	static final String ALREADY_RECORDED = "alreadyRecorded";

	static final String WAITING = "waiting";

	/** Closed by „Nije članarina", with no payment (owner, 25.10.2026). */
	static final String SET_ASIDE = "setAside";

	/** The only money the account the statement is of holds (PDL P8). */
	private static final Currency DINARS = Currency.RSD;

	private final JdbcClient db;

	private final Clock clock;

	private final TransactionTemplate inOneTransaction;

	private final BookingAPayment booking;

	private final ABeginnersCategoryAMembershipMoves category;

	private final CurrencyOfMember currencyOf;

	private final PriceRows priceRows;

	private final MemberOfAccount memberOfAccount;

	StatementApi(JdbcClient db, Clock clock, TransactionTemplate inOneTransaction, BookingAPayment booking,
			ABeginnersCategoryAMembershipMoves category, CurrencyOfMember currencyOf, PriceRows priceRows,
			MemberOfAccount memberOfAccount) {
		this.db = db;
		this.clock = clock;
		this.inOneTransaction = inOneTransaction;
		this.booking = booking;
		this.category = category;
		this.currencyOf = currencyOf;
		this.priceRows = priceRows;
		this.memberOfAccount = memberOfAccount;
	}

	/** Why a statement was refused. */
	record Refused(String reason) {
	}

	/** A member a line may be about. */
	record Candidate(long competitorId, String memberNumber, String firstName, String lastName, String city) {
	}

	/**
	 * One payment of a statement, as it stands.
	 *
	 * @param state        {@link #BOOKED}, {@link #ALREADY_RECORDED}, {@link #SET_ASIDE} or {@link #WAITING}
	 * @param member       whom it was booked to, or who already holds the season; null while it waits
	 * @param candidates   while it waits, whom it may be about: the member its reference names, or the
	 *                     members of the payer's name, both namesakes when there are two, and after them
	 *                     every member whose name stands inside the payer's text; empty when nothing
	 *                     names anybody
	 * @param waitsBecause why it was not booked by itself, while it waits
	 */
	record Line(long id, LocalDate dated, int statement, int position, String payer, String payerAccount,
			BigDecimal amount, String currency, String paymentCode, String purpose, String reference, int season,
			String state, Candidate member, List<Candidate> candidates, String waitsBecause) {
	}

	/**
	 * What taking a statement did.
	 *
	 * @param bookedNow how many of its payments this taking booked; nought when it was taken before
	 * @param lines     every payment on it, as it stands now
	 */
	record Taken(int number, LocalDate dated, int bookedNow, List<Line> lines) {
	}

	@PostMapping(path = "/api/statements", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	@RightIsNeeded("queue:payments")
	ResponseEntity<?> take(@RequestPart(name = "statement", required = false) MultipartFile statement,
			@AuthenticationPrincipal WhoIsAsking.Member asking) throws IOException {

		if (statement == null || statement.isEmpty()) {
			return no(THE_STATEMENT_IS_MISSING);
		}

		/* THE SIZE IS ASKED BEFORE A BYTE IS READ, so a file over it costs nothing past the upload the
		   portal's own multipart cap already bounds. */
		if (statement.getSize() > AikStatement.AT_MOST_BYTES) {
			return no(THE_STATEMENT_IS_TOO_LARGE);
		}

		AikStatement.Read read;

		try {
			read = AikStatement.read(statement.getBytes());
		}
		catch (AikStatement.NotTaken refused) {
			return no(refused.refusal() == AikStatement.Refusal.ANOTHER_ACCOUNT
					? THE_STATEMENT_IS_OF_ANOTHER_ACCOUNT
					: THE_FILE_IS_NOT_A_STATEMENT);
		}

		int season = SeasonClock.seasonBeingPaidFor(ZonedDateTime.now(clock));

		int bookedNow = inOneTransaction.execute(committing -> keep(read, season, asking));

		List<String> orders = read.credits().stream().map(AikStatement.Credit::orderNumber).toList();

		return ResponseEntity.ok(new Taken(read.number(), read.dated(), bookedNow,
				orders.isEmpty() ? List.of() : seen(linesWithOrders(orders))));
	}

	/**
	 * Every payment of every statement that still waits for a person, oldest statement first, and every one
	 * that is already recorded and not yet closed. Owner, 26.10.2026 (PDL): „Stavka čiji je jedini
	 * predloženi član već član te sezone ne nestaje: ostaje na spisku sa oznakom „Već evidentirano" i
	 * dugmetom „Nije članarina", pa se zatvara sa ko i kad."
	 */
	@GetMapping("/api/statements/lines")
	@RightIsNeeded("queue:payments")
	ResponseEntity<List<Line>> waiting() {
		/* WHETHER A LINE WAITS IS ANSWERED ONCE, by the state `seen` gives it, and not a second time here:
		   a line set aside reads as set aside and is left out below with every line that does not wait. */
		List<Line> lines = seen(db.sql(LINES + " where l.payment_id is null"
						+ " order by s.dated, s.number, l.position")
				.query(StatementApi::stored).list());

		return ResponseEntity.ok(lines.stream()
				.filter(line -> WAITING.equals(line.state()) || ALREADY_RECORDED.equals(line.state()))
				.toList());
	}

	/**
	 * „NIJE ČLANARINA": THE LINE IS CLOSED WITHOUT A BOOKING, AND WHO CLOSED IT AND WHEN IS KEPT (owner,
	 * 25.10.2026, PDL „Učitavanje izvoda: dva odgovora od 25.10.2026").
	 *
	 * <p>The line is taken {@code for update}, the lock {@link PaymentApi} takes on it when „Potvrdi" books
	 * it, so the two cannot both settle one line: whichever comes second finds it settled. A line nobody
	 * kept is answered 404, as an address that does not exist.
	 */
	@PostMapping("/api/statements/lines/{id}/set-aside")
	@RightIsNeeded("queue:payments")
	ResponseEntity<?> setAside(@PathVariable long id, @AuthenticationPrincipal WhoIsAsking.Member asking) {
		return inOneTransaction.execute(committing -> {
			Optional<Boolean> settled = db.sql("select payment_id is not null or set_aside_at is not null"
							+ " from bank_statement_line where id = ? for update")
					.param(id).query(Boolean.class).optional();

			if (settled.isEmpty()) {
				return ResponseEntity.notFound().build();
			}

			if (settled.get()) {
				return ResponseEntity.status(HttpStatus.CONFLICT).body(new Refused(THE_LINE_IS_SETTLED));
			}

			db.sql("update bank_statement_line set set_aside_at = ?, set_aside_by = ?, set_aside_by_name = ?,"
							+ " waits_because = null where id = ?")
					.params(Timestamp.from(clock.instant()), asking.account(),
							memberOfAccount.nameOf(asking.account()), id)
					.update();

			return ResponseEntity.noContent().build();
		});
	}

	/**
	 * The statement and its new lines written, and every new line that qualifies booked. Answers how
	 * many were booked.
	 */
	private int keep(AikStatement.Read read, int season, WhoIsAsking.Member asking) {
		/* THE FREEZE IS HELD STILL FIRST, before the rows of the members it books and before the clock ({@link ASeasonBegins#holdTheFreezeStill}). */
		ASeasonBegins.holdTheFreezeStill(db);

		String name = memberOfAccount.nameOf(asking.account());
		Timestamp now = Timestamp.from(clock.instant());

		db.sql("insert into bank_statement (account, number, dated, loaded_at, loaded_by, loaded_by_name)"
						+ " values (?, ?, ?, ?, ?, ?) on conflict do nothing")
				.params(read.account(), read.number(), read.dated(), now, asking.account(), name)
				.update();

		long statementId = db.sql("select id from bank_statement where account = ? and number = ? and dated = ?")
				.params(read.account(), read.number(), read.dated())
				.query(Long.class).single();

		record Fresh(long line, AikStatement.Credit credit) {
		}

		List<Fresh> fresh = new ArrayList<>();

		/* IN THE ORDER OF THE ORDER NUMBERS AND NOT OF THE FILE, because `bank_statement_line_one_order_once`
		   (V74) is one number for the whole table and `on conflict do nothing` WAITS for an uncommitted line of
		   another statement that carries the same number. Two statements that share two numbers and print them in
		   opposite orders are a cycle: each holds the first and waits for the second. Measured on PostgreSQL 18
		   with the same statements in two sessions: `deadlock detected` after one second, one of the two
		   uploads answered 500 and nothing was written by it (PENDING, PR 843, 28.11.2026). Taken in one order
		   by both, the second waits for the first and then finds the lines already kept. The `position` is each
		   line's own and does not follow the order they are inserted in. */
		List<AikStatement.Credit> inTheOrderOfTheNumbers = read.credits().stream()
				.sorted(Comparator.comparing(AikStatement.Credit::orderNumber)).toList();

		for (AikStatement.Credit credit : inTheOrderOfTheNumbers) {
			db.sql("insert into bank_statement_line (statement_id, position, order_number, payer, payer_account,"
							+ " amount, payment_code, purpose, reference, season)"
							+ " values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) on conflict do nothing returning id")
					.params(statementId, credit.position(), credit.orderNumber(), credit.payer(),
							credit.payerAccount(), credit.amount(), credit.paymentCode(), credit.purpose(),
							credit.reference(), season)
					.query(Long.class).optional()
					.ifPresent(line -> fresh.add(new Fresh(line, credit)));
		}

		/* WHOM EACH NEW LINE'S REFERENCE OR, WITHOUT ONE, ITS PAYER'S NAME BOOKS, and the lines that book
		   nobody wait at once. A line WITH a reference is never booked by the name, whatever the reference
		   is: „Sve ostalo (manji ili veći iznos, nepoznat broj) ide na ručnu potvrdu" (owner, 24.10.2026). */
		record Bookable(long line, long competitorId, AikStatement.Credit credit) {
		}

		List<Bookable> bookable = new ArrayList<>();
		List<Candidate> everybody = fresh.stream().anyMatch(one -> one.credit().reference() == null)
				? everybody() : List.of();

		for (Fresh one : fresh) {
			if (one.credit().reference() == null) {
				Optional<Candidate> byName = ByName.of(one.credit().payer(), everybody).theOneItBooks();

				if (byName.isEmpty()) {
					waits(one.line(), WhyALineWaits.NO_REFERENCE);
				}
				else {
					bookable.add(new Bookable(one.line(), byName.get().competitorId(), one.credit()));
				}

				continue;
			}

			Optional<Long> named = whomTheReferenceNames(one.credit().reference(), season);

			if (named.isEmpty()) {
				waits(one.line(), whyTheReferenceDoesNotBook(one.credit().reference(), season));
			}
			else {
				bookable.add(new Bookable(one.line(), named.get(), one.credit()));
			}
		}

		/* IN THE ORDER OF THE MEMBERS AND NOT OF THE STATEMENT, so that two statements taken at once
		   that book the same two members take their rows in one order and cannot hold each other. The
		   lines booked by the name are in this one list for that reason: a second loop after it would
		   take a row out of that order. */
		bookable.sort(Comparator.comparingLong(Bookable::competitorId));

		int booked = 0;

		for (Bookable one : bookable) {
			if (book(one.line(), one.competitorId(), one.credit(), season, asking)) {
				booked++;
			}
		}

		return booked;
	}

	/**
	 * Books one line, when its amount is the one expected of the member in dinars, and says whether it
	 * did. Every refusal leaves the line waiting with its reason.
	 */
	private boolean book(long line, long competitorId, AikStatement.Credit credit, int season,
			WhoIsAsking.Member asking) {
		/* HIS ROW FIRST, BEFORE ANYTHING ABOUT HIM IS READ, which is the lock `PaymentApi.lockTheMember`
		   takes and for its reasons: his money and his book are read below, and a change of country or
		   a press on his row must take turns with this. */
		db.sql("select id from competitor where id = ? for update")
				.param(competitorId).query(Long.class).single();

		if (currencyOf.of(competitorId) != DINARS) {
			waits(line, WhyALineWaits.NOT_IN_DINARS);

			return false;
		}

		if (credit.amount().compareTo(expectedOf(competitorId, season)) != 0) {
			waits(line, WhyALineWaits.NOT_THE_EXPECTED_AMOUNT);

			return false;
		}

		ABeginnersCategoryAMembershipMoves.Before before = category.before(competitorId, season);

		ResponseEntity<?> answer = booking.book(
				new PaymentApi.Confirm(competitorId, credit.amount(), false, "ips", credit.reference()),
				credit.reference(), asking, season).answer();

		category.tellHimIfItMoved(before);

		/* ONLY A NEW PAYMENT IS THIS LINE'S. The harmless repeat (200) is a payment that already stood,
		   booked by somebody else's hand, and a refusal is no payment at all. */
		if (answer.getStatusCode() != HttpStatus.CREATED) {
			waits(line, WhyALineWaits.NOT_BOOKED);

			return false;
		}

		long payment = ((PaymentApi.Confirmed) Objects.requireNonNull(answer.getBody())).paymentId();

		db.sql("update bank_statement_line set payment_id = ? where id = ?").params(payment, line).update();

		return true;
	}

	/** What the label „Očekivan iznos" says this member sends for this season, in dinars. */
	private BigDecimal expectedOf(long competitorId, int season) {
		LocalDate born = db.sql("select birth_date from competitor where id = ?")
				.param(competitorId).query(LocalDate.class).single();
		LocalDate today = LocalDate.ofInstant(clock.instant(), SeasonClock.ZONE);

		return MembershipPrice.on(priceRows.all(), today, born.getYear(), season, DINARS).expected();
	}

	/**
	 * The member a reference names, when it is a reference of this season and he exists. A line without a
	 * reference never gets here: it is booked or held by its payer's name above.
	 */
	private Optional<Long> whomTheReferenceNames(String reference, int season) {
		if (!PaymentApi.A_REFERENCE.matcher(reference).matches()
				|| Integer.parseInt(reference.substring(0, 4)) != season) {
			return Optional.empty();
		}

		return byNumber(reference.substring(4));
	}

	private String whyTheReferenceDoesNotBook(String reference, int season) {
		if (PaymentApi.A_REFERENCE.matcher(reference).matches()
				&& Integer.parseInt(reference.substring(0, 4)) != season) {
			return WhyALineWaits.ANOTHER_SEASON;
		}

		return WhyALineWaits.UNKNOWN_REFERENCE;
	}

	private Optional<Long> byNumber(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?")
				.param(memberNumber).query(Long.class).optional();
	}

	private void waits(long line, String because) {
		db.sql("update bank_statement_line set waits_because = ? where id = ?").params(because, line).update();
	}

	/**
	 * A line as V74 holds it.
	 *
	 * @param booked   whether the line names a payment, asked of the line itself
	 * @param bookedTo whose that payment is, and null when it names none OR when its member has since been
	 *                 deleted: since V79 the payment outlives him without a pointer at him (PDL,
	 *                 29.10.2026), so the line stays booked and there is nobody left to draw beside it
	 */
	private record Stored(long id, LocalDate dated, int statement, int position, String payer,
			String payerAccount, BigDecimal amount, String paymentCode, String purpose, String reference,
			int season, boolean booked, Long bookedTo, String waitsBecause, boolean setAside) {
	}

	private static final String LINES = "select l.id, s.dated, s.number, l.position, l.payer, l.payer_account,"
			+ " l.amount, l.payment_code, l.purpose, l.reference, l.season, p.competitor_id, l.waits_because,"
			+ " l.set_aside_at is not null, l.payment_id is not null"
			+ " from bank_statement_line l"
			+ " join bank_statement s on s.id = l.statement_id"
			+ " left join payment p on p.id = l.payment_id";

	private static Stored stored(java.sql.ResultSet row, int i) throws java.sql.SQLException {
		/* ASKED OF THE COLUMN ITSELF, because `wasNull` answers about whichever column was read last. */
		Long bookedTo = row.getObject(12, Long.class);

		return new Stored(row.getLong(1), row.getDate(2).toLocalDate(), row.getInt(3), row.getInt(4),
				row.getString(5), row.getString(6), row.getBigDecimal(7), row.getString(8), row.getString(9),
				row.getString(10), row.getInt(11), row.getBoolean(15), bookedTo, row.getString(13),
				row.getBoolean(14));
	}

	private List<Stored> linesWithOrders(List<String> orders) {
		return db.sql(LINES + " where l.order_number = any (?) order by s.dated, s.number, l.position")
				.param(orders.toArray(String[]::new))
				.query(StatementApi::stored).list();
	}

	/**
	 * Each line as the screen is told it: booked, already settled by the member it is about, or waiting
	 * with whom it may be about.
	 */
	private List<Line> seen(List<Stored> lines) {
		List<Candidate> everybody = lines.isEmpty() ? List.of() : everybody();

		return lines.stream().map(one -> {
			/* BOOKED IS A FACT ABOUT THE LINE, AND WHOSE IS A FACT ABOUT THE PAYMENT. Read off the payment's
			   member, a line booked to somebody since deleted read as waiting in the answer to a statement
			   taken again, while the queue, which asks the line, left it out. */
			if (one.booked()) {
				return line(one, BOOKED, one.bookedTo() == null ? null : find(everybody, one.bookedTo()),
						List.of(), null);
			}

			if (one.setAside()) {
				return line(one, SET_ASIDE, null, List.of(), null);
			}

			Suggested suggested = candidatesFor(one, everybody);
			List<Candidate> candidates = suggested.candidates();

			/* ALREADY RECORDED ONLY WHEN THE LINE IS ABOUT ONE MEMBER, and he holds the season the line was
			   taken for, on whatever basis: two namesakes are a question a person answers, whichever of
			   them has paid. And not when that one member's name was found only inside the payer's text
			   (owner, 27.11.2026): „stavka čeka i nudi „Drugi član", a ne „Već evidentirano", jer adresa
			   ume da nosi ime aktivnog člana dok je uplatio neko drugi." */
			if (candidates.size() == 1 && !suggested.onlyInsideTheText()
					&& holds(candidates.getFirst().competitorId(), one.season())) {
				return line(one, ALREADY_RECORDED, candidates.getFirst(), List.of(), null);
			}

			return line(one, WAITING, null, candidates,
					one.waitsBecause() == null ? WhyALineWaits.NOT_BOOKED : one.waitsBecause());
		}).toList();
	}

	/**
	 * Whom a waiting line may be about.
	 *
	 * @param candidates        the member its reference names when it names one, whatever season it
	 *                          names, and otherwise the members of the payer's name ({@link ByName#all})
	 * @param onlyInsideTheText whether they were all found only inside the payer's text, which a line
	 *                          never reads as „already recorded" (owner, 27.11.2026)
	 */
	private record Suggested(List<Candidate> candidates, boolean onlyInsideTheText) {
	}

	private static Suggested candidatesFor(Stored line, List<Candidate> everybody) {
		if (line.reference() != null && PaymentApi.A_REFERENCE.matcher(line.reference()).matches()) {
			String number = line.reference().substring(4);
			List<Candidate> named = everybody.stream()
					.filter(one -> number.equals(one.memberNumber())).toList();

			if (!named.isEmpty()) {
				return new Suggested(named, false);
			}
		}

		ByName byName = ByName.of(line.payer(), everybody);

		return new Suggested(byName.all(), byName.whole().isEmpty());
	}

	/**
	 * WHOM A PAYER'S NAME IS ABOUT, asked in one place by the booking ({@link #keep}) and by the
	 * suggestion ({@link #seen}), so the two cannot part.
	 *
	 * @param whole  every member the payer, as far as the first comma, IS ({@link PayerName#names})
	 * @param inside every OTHER member whose name stands inside the whole payer field
	 *               ({@link PayerName#inside})
	 */
	private record ByName(List<Candidate> whole, List<Candidate> inside) {

		static ByName of(String payer, List<Candidate> everybody) {
			String name = PayerName.of(payer);
			List<Candidate> whole = everybody.stream()
					.filter(one -> PayerName.names(name, one.firstName(), one.lastName())).toList();

			return new ByName(whole, everybody.stream()
					.filter(one -> !whole.contains(one) && PayerName.inside(payer, one.firstName(), one.lastName()))
					.toList());
		}

		/** The whole name's members first, then the rest: the order the line suggests them in. */
		List<Candidate> all() {
			List<Candidate> all = new ArrayList<>(whole);
			all.addAll(inside);

			return List.copyOf(all);
		}

		/**
		 * THE MEMBER THE NAME BOOKS BY ITSELF, when there is exactly one: exactly one member IS the name,
		 * and no other is named anywhere in the payer's text, because „adresa ume da nosi tuđe ime"
		 * (owner, 26.11.2026) and a second name in it is a question for a person (coordinator, 27.11.2026,
		 * from the agent's reasoning). And he has a member number already (owner, 27.11.2026): „Prijavljen
		 * koji još nema članski broj se po imenu ne knjiži sam", because a booking in error would spend a
		 * number, and numbers are not given back. Whether he holds the season already, and whether the
		 * amount is the expected one in dinars, is asked by {@link #book}, as for a reference.
		 */
		Optional<Candidate> theOneItBooks() {
			return whole.size() == 1 && inside.isEmpty() && whole.getFirst().memberNumber() != null
					? Optional.of(whole.getFirst()) : Optional.empty();
		}
	}

	private boolean holds(long competitorId, int season) {
		return Boolean.TRUE.equals(db.sql("select exists(select 1 from membership"
						+ " where competitor_id = ? and season = ?)")
				.params(competitorId, season).query(Boolean.class).single());
	}

	private static Candidate find(List<Candidate> everybody, long competitorId) {
		return everybody.stream().filter(one -> one.competitorId() == competitorId).findFirst().orElseThrow();
	}

	private static Line line(Stored one, String state, Candidate member, List<Candidate> candidates,
			String waitsBecause) {
		return new Line(one.id(), one.dated(), one.statement(), one.position(), one.payer(), one.payerAccount(),
				one.amount(), DINARS.name(), one.paymentCode(), one.purpose(), one.reference(), one.season(), state,
				member, candidates, waitsBecause);
	}

	/**
	 * Every member, with what tells two of one name apart: the number and the town, the shape the list of
	 * the Payments screen draws ({@link PaymentsDueApi}).
	 */
	private List<Candidate> everybody() {
		return db.sql("select c.id, c.member_number, c.first_name, c.last_name,"
						+ " coalesce(town.name, c.city) as city"
						+ " from competitor c left join place town on town.id = c.place_id"
						+ " order by c.last_name, c.first_name, c.id")
				.query((row, i) -> new Candidate(row.getLong(1), row.getString(2), row.getString(3),
						row.getString(4), row.getString(5)))
				.list();
	}

	private static ResponseEntity<Refused> no(String reason) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new Refused(reason));
	}
}
