package com.btl.portal.domain.statement;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.MemoryUsageSetting;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;

import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.format.ResolverStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * A BANK STATEMENT OF AIK BANKA, READ OFF THE PAGE.
 *
 * <p><b>Owner, 24.10.2026</b> (PDL „Učitavanje izvoda iz banke na ekranu Uplate", chosen with my
 * recommendation): „Server iz PDF izvoda (AIK banka, račun 105-0000000003284-71) čita svaku uplatu koja
 * potražuje: uplatioca, njegov račun, iznos, šifru plaćanja, svrhu i poziv na broj kad postoji.
 * Isplate (naknade banke) se preskaču." This class is the reading and nothing else: it says what the
 * page holds, and {@code StatementApi} decides what each line means for a member.
 *
 * <p><b>The layout is the one the first real statement has</b> (number 1 of 23.10.2026, measured with
 * its text layer and coordinates): a heading „IZVOD BROJ n" with „Od: dd.mm.yyyy" under it, „Račun:"
 * with the account above the items and the two column heads „Duguje" and „Potražuje" beside it, every
 * item opened by its ordinal („1.") in the left margin with the payer and the amount on that same line,
 * and a block of labelled fields under it („Račun:", „Nalog:", „Šifra pl.:", the dates) with the
 * purpose in a line of its own. Which column an amount stands in is read off its right edge against
 * the right edges of the two heads, because the amounts are right aligned under them.
 *
 * <p><b>WHERE THE REFERENCE STANDS IS AN ASSUMPTION, AND A WRITTEN BOUNDARY.</b> The first statement
 * carries no payment with a poziv na broj, so nothing measured says how this bank prints one. It is
 * read as a labelled field „Poziv na broj:" on a line of fields of the item, a line that begins with a
 * label in the column of labels, the way the other fields are printed ({@code THE_VALUES}), and only
 * from there: a reference written into the purpose, ten digits or the whole label with them, is not
 * read as one, because the decision names the reference and not the purpose, and the purpose is what
 * the payer wrote. If the bank
 * prints it otherwise, the line has no reference here and goes to the manual confirmation, which is
 * the safe direction; nothing is booked on a guess. The first statement that carries one confirms or
 * corrects this paragraph (coordinator, 25.10.2026, writing it as a boundary).
 *
 * <p><b>THE PAGE CHECKS ITSELF, and that is what makes a misreading a refusal rather than a wrong
 * booking.</b> The statement prints how many items it has on each side and what they add up to
 * („Ukupno stavki potražuje: 1" and the total beside it). A page whose items, as read here, do not
 * come to exactly those counts and those totals is refused as unreadable, so an item lost across a
 * page break, a column read on the wrong side or an amount read wrong cannot pass unnoticed.
 *
 * <p><b>WHAT A BAD FILE MAY COST IS BOUNDED BEFORE ITS TEXT IS READ</b>, in the shape {@code SmallPicture}
 * gave a picture's pixels (PR 639), and each bound says what it holds:
 * <ul>
 * <li>the bytes of the file, capped by the route before this is called ({@link #AT_MOST_BYTES});
 * <li>PDFBox's cache of the streams, in memory only and never on disk ({@link #AT_MOST_STREAM_CACHE}),
 * which bounds that cache and nothing else;
 * <li>an encrypted document is not read;
 * <li>the pages, counted by walking the page tree and not read off the file's {@code /Count}, at most
 * {@link #AT_MOST_PAGES};
 * <li>the decoded bytes of everything reading the text decodes, at most
 * {@link WhatAFileMayCost#AT_MOST_DECODED}, measured before the text is read; a form inside a page, a
 * font whose glyphs are content and a stream only an image codec could decode are refused
 * ({@link WhatAFileMayCost} says why);
 * <li>the words, at most {@link #AT_MOST_WORDS}.
 * </ul>
 * Nesting is PDFBox's own to bound, and it does: measured 26.10.2026 on a stack of 512 KB, a page whose
 * resources are a dictionary nested 200 000 deep and a content of arrays nested a million deep were both
 * read without an error and refused as no statement. So no error is caught here; one that is not an
 * exception is not this method's to answer.
 * Not bounded: time, which no clock watches, and which the decoded bytes bound only as far as cheap
 * operators allow. Whatever PDFBox throws on a damaged file is the same answer as a file that is not a
 * statement at all.
 */
public final class AikStatement {

	/** The only account a statement is taken for (PDL 24.10.2026). */
	public static final String THE_ACCOUNT = "105-0000000003284-71";

	/**
	 * The largest file taken, in bytes. The first statement, one page with the bank's two pictures,
	 * is 173 330 bytes; a statement of a month is a few pages more of text, so two megabytes is ten
	 * times the measured one and far under the six the portal's multipart cap allows.
	 */
	public static final long AT_MOST_BYTES = 2L * 1024 * 1024;

	/**
	 * The most PDFBox's cache of the file's streams may hold, in memory and never in a temporary file.
	 * It bounds that cache and nothing else: what reading the text builds is bounded by
	 * {@link WhatAFileMayCost}, before the text is read.
	 */
	static final long AT_MOST_STREAM_CACHE = 32L * 1024 * 1024;

	/** A statement with more pages than this is not read. The first one has one. */
	static final int AT_MOST_PAGES = 50;

	/** And the text is abandoned after this many words; the first statement has 196. */
	static final int AT_MOST_WORDS = 100_000;

	/** How far apart two baselines may be and still be one line, in points. */
	private static final float ONE_LINE = 2.5f;

	/** How far an amount's right edge may be from its column's, in points. Measured: under half a point. */
	private static final float IN_THE_COLUMN = 15f;

	/** The left margin the ordinals stand in. Measured at 19.6; the text of an item starts at 54.9. */
	private static final float THE_MARGIN = 40f;

	/**
	 * WHERE THE COLUMN OF VALUES BEGINS, and what is left of it is the column of labels. Measured on the
	 * first statement: the labels of an item start at 60.2 („Račun:"), 61.4 („Nalog:") and 77.3 („Datum
	 * izvršenja:"), and its values and its purpose at 87.5 and after. A label is taken only where a line
	 * begins with one left of this; anything right of it is what somebody wrote, and the purpose is
	 * written by the payer (security review of PR 647, S3; owner, 26.10.2026: fixed rather than refused).
	 */
	private static final float THE_VALUES = 85f;

	private static final Pattern AN_ORDINAL = Pattern.compile("^([0-9]{1,4})\\.$");

	/** As the statement prints money: „4,200.00". Up to 999 999 999.99, then the column is asked. */
	private static final Pattern AN_AMOUNT = Pattern.compile("^[0-9]{1,3}(,[0-9]{3}){0,2}\\.[0-9]{2}$");

	private static final Pattern AN_ACCOUNT = Pattern.compile("^[0-9]{3}-[0-9]{13}-[0-9]{2}$");

	private static final Pattern A_COUNT = Pattern.compile("^[0-9]{1,5}$");

	/** A model in parentheses in front of a reference, „(97)", which the portal does not use. */
	private static final Pattern A_MODEL = Pattern.compile("^\\([0-9]{2}\\)");

	private static final DateTimeFormatter A_DAY = DateTimeFormatter.ofPattern("dd.MM.uuuu")
			.withResolverStyle(ResolverStyle.STRICT);

	/** The labels of an item's fields, each as the words it is printed in. */
	private static final List<List<String>> LABELS = List.of(
			List.of("Račun:"),
			List.of("Nalog:"),
			List.of("Šifra", "pl.:"),
			List.of("Poziv", "na", "broj:"),
			List.of("Datum", "izvršenja:"),
			List.of("Datum", "prijema:"),
			List.of("Datum", "obrade:"));

	private AikStatement() {
	}

	/**
	 * One payment the statement says arrived.
	 *
	 * @param position     its ordinal on the statement, „1." being 1
	 * @param payer        what the line names, the payer's name and his address as the bank printed them
	 * @param payerAccount the account it came from, or null when the item names none
	 * @param amount       in dinars, the only money this account holds
	 * @param paymentCode  „Šifra pl.", or null
	 * @param purpose      the purpose as printed, the lines of it joined by one space; may be empty
	 * @param reference    the poziv na broj without spaces and without a model, or null when there is none
	 * @param orderNumber  „Nalog" as printed, which is the bank's own name for this one transaction
	 */
	public record Credit(int position, String payer, String payerAccount, BigDecimal amount,
			String paymentCode, String purpose, String reference, String orderNumber) {

		/** The payer's name: what the line says before the first comma, which is where the address starts. */
		public String payerName() {
			return PayerName.of(payer);
		}
	}

	/**
	 * What one statement holds, the payments that arrived on it and nothing of what went out.
	 *
	 * @param number  „IZVOD BROJ n"
	 * @param dated   „Od: dd.mm.yyyy"
	 * @param credits every item in the column „Potražuje", in the statement's order
	 */
	public record Read(String account, int number, LocalDate dated, List<Credit> credits) {
	}

	/** Why a file was not taken as a statement. */
	public enum Refusal {
		/** Not a PDF, damaged, too large inside, or not laid out as this bank's statement. */
		NOT_A_STATEMENT,
		/** A statement, but of another account. */
		ANOTHER_ACCOUNT
	}

	/** A file that is not a statement this portal takes, and which of the two reasons. */
	public static final class NotTaken extends Exception {

		private final Refusal refusal;

		NotTaken(Refusal refusal, String why) {
			super(why);
			this.refusal = refusal;
		}

		NotTaken(String why, Throwable cause) {
			super(why, cause);
			this.refusal = Refusal.NOT_A_STATEMENT;
		}

		public Refusal refusal() {
			return refusal;
		}
	}

	/**
	 * Reads a statement.
	 *
	 * @param bytes the whole file, already no larger than {@link #AT_MOST_BYTES}
	 * @return what it holds
	 * @throws NotTaken when it is not a statement of {@link #THE_ACCOUNT} that checks against its own totals
	 */
	public static Read read(byte[] bytes) throws NotTaken {
		return of(wordsOf(bytes, AT_MOST_WORDS));
	}

	/**
	 * Every word of the file with where it stands, or a refusal: the file is opened within the bounds
	 * at the head of this class and read no further than {@code atMostWords}.
	 */
	static List<Word> wordsOf(byte[] bytes, int atMostWords) throws NotTaken {
		try (PDDocument document = Loader.loadPDF(bytes, "", null, null,
				MemoryUsageSetting.setupMainMemoryOnly(AT_MOST_STREAM_CACHE).streamCache)) {
			if (document.isEncrypted()) {
				throw new NotTaken(Refusal.NOT_A_STATEMENT, "an encrypted document");
			}

			/* THE COST OF READING THE TEXT, MEASURED BEFORE IT IS SPENT: the pages walked and not read off
			   the file's own count, and the decoded bytes of everything reading the text decodes
			   (`WhatAFileMayCost`). The review of PR 647 measured why: a file of 300 KB whose content
			   inflates to 300 MB exhausted the heap behind the stream cache this used to rely on. */
			WhatAFileMayCost.ofReading(document);

			Words reading = new Words(atMostWords);
			reading.getText(document);

			return reading.words;
		}
		catch (NotTaken refused) {
			throw refused;
		}
		catch (WhatAFileMayCost.TooMuch tooMuch) {
			throw new NotTaken(Refusal.NOT_A_STATEMENT, "reading it would cost " + tooMuch.getMessage());
		}
		catch (IOException | RuntimeException broken) {
			/* WHATEVER A DAMAGED FILE MAKES PDFBOX THROW, and a file that is not a PDF at all, is one
			   answer: the moderator can do nothing different about either. `TooManyWords` lands here
			   too, on purpose. */
			throw new NotTaken("the file could not be read as a PDF", broken);
		}
	}

	/** The words of every page, in the order PDFBox found them, with where each one stands. */
	static Read of(List<Word> words) throws NotTaken {
		List<Line> lines = linesOf(words);

		if (lines.stream().noneMatch(line -> line.has("AikBank"))) {
			throw new NotTaken(Refusal.NOT_A_STATEMENT, "no AikBank on the page");
		}

		int number = Integer.parseInt(after(lines, List.of("IZVOD", "BROJ"), A_COUNT)
				.orElseThrow(() -> new NotTaken(Refusal.NOT_A_STATEMENT, "no IZVOD BROJ")));
		LocalDate dated = day(after(lines, List.of("Od:"), Pattern.compile("^[0-9.]{10}$"))
				.orElseThrow(() -> new NotTaken(Refusal.NOT_A_STATEMENT, "no Od:")));
		String account = after(lines, List.of("Račun:"), AN_ACCOUNT)
				.orElseThrow(() -> new NotTaken(Refusal.NOT_A_STATEMENT, "no account"));

		if (!THE_ACCOUNT.equals(account)) {
			throw new NotTaken(Refusal.ANOTHER_ACCOUNT, "the account " + account);
		}

		Word debitHead = first(words, "Duguje");
		Word creditHead = first(words, "Potražuje");

		List<Credit> credits = new ArrayList<>();
		List<BigDecimal> debits = new ArrayList<>();
		List<Word> ordinals = ordinalsOf(words);

		for (int i = 0; i < ordinals.size(); i++) {
			Word ordinal = ordinals.get(i);
			int item = i + 1;
			float end = i + 1 < ordinals.size() && ordinals.get(i + 1).page() == ordinal.page()
					? ordinals.get(i + 1).y()
					: endOfItemsOn(words, ordinal.page());
			List<Line> block = lines.stream()
					.filter(line -> line.page() == ordinal.page() && line.y() > ordinal.y() - ONE_LINE
							&& line.y() < end - ONE_LINE)
					.toList();

			Line opening = block.stream().filter(line -> line.words().contains(ordinal)).findFirst()
					.orElseThrow();
			Word amountWord = opening.words().reversed().stream()
					.filter(word -> AN_AMOUNT.matcher(word.text()).matches()).findFirst()
					.orElseThrow(() -> new NotTaken(Refusal.NOT_A_STATEMENT, "item " + item + " has no amount"));
			BigDecimal amount = amountOf(amountWord.text());

			boolean isCredit = Math.abs(amountWord.right() - creditHead.right())
					< Math.abs(amountWord.right() - debitHead.right());
			float off = Math.abs(amountWord.right() - (isCredit ? creditHead : debitHead).right());

			if (off > IN_THE_COLUMN) {
				throw new NotTaken(Refusal.NOT_A_STATEMENT, "item " + item + " stands in no column");
			}

			if (!isCredit) {
				debits.add(amount);
				continue;
			}

			String payer = joined(opening.words().stream()
					.filter(word -> word.x() > ordinal.right() && word.right() < amountWord.x()).toList());
			Fields fields = fieldsOf(block.stream().filter(line -> line != opening).toList());

			if (fields.order() == null) {
				throw new NotTaken(Refusal.NOT_A_STATEMENT, "item " + item + " names no order");
			}

			Credit credit = new Credit(item, payer, fields.account(), amount, fields.code(), fields.purpose(),
					fields.reference(), fields.order());

			if (!withinItsBounds(credit)) {
				throw new NotTaken(Refusal.NOT_A_STATEMENT, "item " + item + " is longer than a statement prints");
			}

			credits.add(credit);
		}

		Word end = words.stream()
				.filter(word -> word.x() < THE_MARGIN && word.text().equals("UKUPNO"))
				.min(Comparator.comparingInt(Word::page).thenComparingDouble(Word::y))
				.orElseThrow(() -> new NotTaken(Refusal.NOT_A_STATEMENT, "no UKUPNO ZA IZVOD"));

		checkedAgainstItsTotals(lines, end, "potražuje:", creditHead,
				credits.stream().map(Credit::amount).toList());
		checkedAgainstItsTotals(lines, end, "duguje:", debitHead, debits);

		return new Read(account, number, dated, List.copyOf(credits));
	}

	/**
	 * Whether the items read add up to what the statement says they do, in count and in sum.
	 *
	 * <p>„Ukupno stavki potražuje: 1" with the total in the column beside it on the same line; the same
	 * for „duguje:". Both are asked, because a credit read as a debit leaves both sides wrong.
	 */
	private static void checkedAgainstItsTotals(List<Line> lines, Word end, String side, Word head,
			List<BigDecimal> read) throws NotTaken {
		/* ONLY UNDER „UKUPNO ZA IZVOD" IN THE MARGIN, where the bank prints its totals: the same words in a
		   purpose, above it, are what a payer wrote. */
		Line totals = lines.stream()
				.filter(line -> line.page() == end.page() && line.y() >= end.y())
				.filter(line -> line.hasRun(List.of("Ukupno", "stavki", side)))
				.findFirst()
				.orElseThrow(() -> new NotTaken(Refusal.NOT_A_STATEMENT, "no total for " + side));
		int count = Integer.parseInt(totals.after(List.of("Ukupno", "stavki", side), A_COUNT)
				.orElseThrow(() -> new NotTaken(Refusal.NOT_A_STATEMENT, "no count for " + side)));

		/* THE TOTAL OF A SIDE WITH NO ITEM may be printed as nothing at all, so it is asked for only
		   when there is something to add up. */
		BigDecimal sum = read.stream().reduce(BigDecimal.ZERO, BigDecimal::add);

		if (count != read.size()) {
			throw new NotTaken(Refusal.NOT_A_STATEMENT, side + " says " + count + ", read " + read.size());
		}

		if (count == 0) {
			return;
		}

		BigDecimal printed = totals.words().stream()
				.filter(word -> AN_AMOUNT.matcher(word.text()).matches())
				.filter(word -> Math.abs(word.right() - head.right()) <= IN_THE_COLUMN)
				.findFirst()
				.map(word -> amountOf(word.text()))
				.orElseThrow(() -> new NotTaken(Refusal.NOT_A_STATEMENT, "no sum for " + side));

		if (printed.compareTo(sum) != 0) {
			throw new NotTaken(Refusal.NOT_A_STATEMENT, side + " says " + printed + ", read " + sum);
		}
	}

	/**
	 * WHETHER EVERY FIELD IS AS LONG AS A STATEMENT PRINTS ONE AND NO LONGER. The first statement's
	 * longest field is a purpose of 135 characters and its order number has 37; a field many times that
	 * is a file made to look like a statement, and the order number is a key the database indexes.
	 */
	static boolean withinItsBounds(Credit credit) {
		return credit.payer().length() <= 300
				&& (credit.payerAccount() == null || credit.payerAccount().length() <= 40)
				&& (credit.paymentCode() == null || credit.paymentCode().length() <= 10)
				&& credit.purpose().length() <= 1000
				&& (credit.reference() == null || credit.reference().length() <= 64)
				&& credit.orderNumber().length() <= 100;
	}

	/** Where the items of a page stop: „UKUPNO ZA IZVOD" when it is on that page, the end of it otherwise. */
	private static float endOfItemsOn(List<Word> words, int page) {
		return words.stream()
				.filter(word -> word.page() == page && word.x() < THE_MARGIN && word.text().equals("UKUPNO"))
				.map(Word::y)
				.min(Float::compare)
				.orElse(Float.MAX_VALUE);
	}

	/**
	 * The ordinals in the margin, and they must count 1, 2, 3 without a gap. A page whose numbers skip
	 * is a page this did not read whole, so it is refused here rather than by the totals below it.
	 */
	private static List<Word> ordinalsOf(List<Word> words) throws NotTaken {
		List<Word> ordinals = words.stream()
				.filter(word -> word.x() < THE_MARGIN && AN_ORDINAL.matcher(word.text()).matches())
				.sorted(Comparator.comparingInt(Word::page).thenComparingDouble(Word::y))
				.toList();

		for (int i = 0; i < ordinals.size(); i++) {
			String ordinal = ordinals.get(i).text();

			/* The shape is already asked above, so the number is everything before the dot. */
			if (Integer.parseInt(ordinal.substring(0, ordinal.length() - 1)) != i + 1) {
				throw new NotTaken(Refusal.NOT_A_STATEMENT, "the items are not numbered 1 to " + ordinals.size());
			}
		}

		return ordinals;
	}

	/** An item's labelled fields, and the purpose, which is every line under it that carries no label. */
	private record Fields(String account, String order, String code, String reference, String purpose) {
	}

	private static Fields fieldsOf(List<Line> block) {
		String account = null;
		String order = null;
		String code = null;
		String reference = null;
		List<String> purpose = new ArrayList<>();

		for (Line line : block) {
			/* A LINE OF FIELDS BEGINS WITH A LABEL IN THE COLUMN OF LABELS, and only such a line is read for
			   labels at all; every other line is the purpose, read as words. A purpose that says „Nalog:" or
			   „Poziv na broj:" is the payer's text and says nothing about the payment. */
			if (line.words().getFirst().x() >= THE_VALUES || labelAt(line.words(), 0) == null) {
				purpose.add(joined(line.words()));
				continue;
			}

			for (Labelled one : labelledIn(line)) {
				String value = joined(one.value());

				if (value.isEmpty()) {
					continue;
				}

				/* AND THE FIRST PLACE A FIELD STANDS IS ITS PLACE: a second line of fields naming it again
				   does not overwrite it. */
				switch (one.label().getFirst()) {
					case "Račun:" -> account = account == null ? one.value().getFirst().text() : account;
					case "Nalog:" -> order = order == null ? value : order;
					case "Šifra" -> code = code == null ? one.value().getFirst().text() : code;
					case "Poziv" -> reference = reference == null ? referenceOf(value) : reference;
					default -> {
						/* The dates, which nothing here keeps. */
					}
				}
			}
		}

		return new Fields(account, order, code, reference, String.join(" ", purpose).strip());
	}

	/** The reference without its spaces and without a model in parentheses in front of it. */
	static String referenceOf(String printed) {
		String compact = printed.replaceAll("\\s", "");

		return A_MODEL.matcher(compact).replaceFirst("");
	}

	private record Labelled(List<String> label, List<Word> value) {
	}

	/**
	 * Every label on a line of fields, each with the words after it up to the next label. Asked only of a
	 * line that begins with a label (`fieldsOf`), so the first word is one.
	 */
	private static List<Labelled> labelledIn(Line line) {
		List<Word> words = line.words();
		List<Labelled> found = new ArrayList<>();
		List<String> current = labelAt(words, 0);
		List<Word> value = new ArrayList<>();

		for (int i = current.size(); i < words.size(); i++) {
			List<String> label = labelAt(words, i);

			if (label == null) {
				value.add(words.get(i));
				continue;
			}

			found.add(new Labelled(current, List.copyOf(value)));
			current = label;
			value.clear();
			i += label.size() - 1;
		}

		found.add(new Labelled(current, List.copyOf(value)));

		return found;
	}

	private static List<String> labelAt(List<Word> words, int at) {
		for (List<String> label : LABELS) {
			if (at + label.size() <= words.size() && wordsAre(words.subList(at, at + label.size()), label)) {
				return label;
			}
		}

		return null;
	}

	private static boolean wordsAre(List<Word> words, List<String> texts) {
		for (int i = 0; i < texts.size(); i++) {
			if (!words.get(i).text().equals(texts.get(i))) {
				return false;
			}
		}

		return true;
	}

	/**
	 * The word after the FIRST place a run of words stands, when it has the given shape.
	 *
	 * <p>The first and only the first, because the same label is printed again further down: every
	 * payment carries its own „Račun:", the payer's. Asked of every line, a statement account that is
	 * not shaped as one would have been passed over and the first payer's account read in its place.
	 */
	private static Optional<String> after(List<Line> lines, List<String> run, Pattern shape) {
		return lines.stream().filter(line -> line.hasRun(run)).findFirst()
				.flatMap(line -> line.after(run, shape));
	}

	private static Word first(List<Word> words, String text) throws NotTaken {
		return words.stream().filter(word -> word.text().equals(text)).findFirst()
				.orElseThrow(() -> new NotTaken(Refusal.NOT_A_STATEMENT, "no column " + text));
	}

	private static LocalDate day(String printed) throws NotTaken {
		try {
			return LocalDate.parse(printed, A_DAY);
		}
		catch (DateTimeParseException wrong) {
			throw new NotTaken("the day " + printed, wrong);
		}
	}

	/** „4,200.00" as 4200.00. The shape is already checked, so this cannot fail. */
	static BigDecimal amountOf(String printed) {
		return new BigDecimal(printed.replace(",", ""));
	}

	private static String joined(List<Word> words) {
		return String.join(" ", words.stream().map(Word::text).toList()).strip();
	}

	/** The words, grouped into lines by their baselines, each line read left to right. */
	private static List<Line> linesOf(List<Word> words) {
		List<Word> ordered = words.stream()
				.sorted(Comparator.comparingInt(Word::page).thenComparingDouble(Word::y))
				.toList();
		List<Line> lines = new ArrayList<>();
		List<Word> current = new ArrayList<>();

		for (Word word : ordered) {
			if (!current.isEmpty() && (word.page() != current.getFirst().page()
					|| word.y() - current.getFirst().y() > ONE_LINE)) {
				lines.add(Line.of(current));
				current = new ArrayList<>();
			}

			current.add(word);
		}

		if (!current.isEmpty()) {
			lines.add(Line.of(current));
		}

		return lines;
	}

	/**
	 * One word as PDFBox split it, where it starts and where it ends.
	 *
	 * @param y the baseline, measured down from the top of the page
	 */
	record Word(int page, float x, float right, float y, String text) {
	}

	/** One line of words, left to right. */
	record Line(int page, float y, List<Word> words) {

		static Line of(List<Word> words) {
			List<Word> leftToRight = words.stream().sorted(Comparator.comparingDouble(Word::x)).toList();

			return new Line(words.getFirst().page(), words.getFirst().y(), leftToRight);
		}

		boolean has(String text) {
			return words.stream().anyMatch(word -> word.text().equals(text));
		}

		boolean hasRun(List<String> run) {
			return indexOf(run) >= 0;
		}

		Optional<String> after(List<String> run, Pattern shape) {
			/* Asked only of a line that holds the run (`after` above), so it is found. */
			int at = indexOf(run);

			if (at + run.size() >= words.size()) {
				return Optional.empty();
			}

			String next = words.get(at + run.size()).text();

			return shape.matcher(next).matches() ? Optional.of(next) : Optional.empty();
		}

		private int indexOf(List<String> run) {
			for (int i = 0; i + run.size() <= words.size(); i++) {
				if (wordsAre(words.subList(i, i + run.size()), run)) {
					return i;
				}
			}

			return -1;
		}
	}

	/** PDFBox's own reading of the page, kept as words with their places rather than as text. */
	private static final class Words extends PDFTextStripper {

		private final List<Word> words = new ArrayList<>();

		private final int atMost;

		private int page;

		Words(int atMost) {
			this.atMost = atMost;
			setSortByPosition(true);
		}

		@Override
		protected void startPage(PDPage onePage) throws IOException {
			page++;
			super.startPage(onePage);
		}

		/**
		 * One run of text as PDFBox hands it over, which may hold several words: it is split here at
		 * every blank, glyph by glyph, so each word keeps where it starts and where it ends.
		 */
		@Override
		protected void writeString(String text, List<TextPosition> positions) {
			StringBuilder word = new StringBuilder();
			TextPosition first = null;
			TextPosition last = null;

			for (TextPosition glyph : positions) {
				/* A glyph the font gives no letter for is read as a blank, which ends the word it is in. */
				String unicode = Objects.requireNonNullElse(glyph.getUnicode(), " ");

				if (unicode.isBlank()) {
					keep(word, first, last);
					word.setLength(0);
					first = null;
					continue;
				}

				if (first == null) {
					first = glyph;
				}

				last = glyph;
				word.append(unicode);
			}

			keep(word, first, last);
		}

		private void keep(StringBuilder word, TextPosition first, TextPosition last) {
			if (first == null) {
				return;
			}

			if (words.size() >= atMost) {
				throw new TooManyWords(atMost);
			}

			words.add(new Word(page, first.getXDirAdj(), last.getXDirAdj() + last.getWidthDirAdj(),
					first.getYDirAdj(), word.toString()));
		}
	}

	/** Thrown from inside PDFBox's reading to stop it, and caught as a file that is not a statement. */
	private static final class TooManyWords extends RuntimeException {

		TooManyWords(int atMost) {
			super("more than " + atMost + " words", null, false, false);
		}
	}
}
