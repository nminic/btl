package com.btl.portal.domain.statement;

import org.apache.pdfbox.cos.COSArray;
import org.apache.pdfbox.cos.COSDictionary;
import org.apache.pdfbox.cos.COSInteger;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.function.Consumer;

/**
 * A STATEMENT OF AIK BANKA THAT NOBODY WAS EVER PAID ON, laid out as the first real one is.
 *
 * <p><b>Why this exists and the real file does not go into the repository:</b> the real statement
 * (number 1 of 23.10.2026) names a member, his address and his account, and the repository is public.
 * What was taken from it is the LAYOUT only, measured with PDFBox's own reading of the page: where every
 * label, value and column stands, in which font and at which size, and the gap from one item to the
 * next. The names, accounts and order numbers here are made up.
 *
 * <p><b>The fonts are the standard ones with a table of differences</b>, because the page needs „č",
 * „ć" and „đ" („Račun:", „Članarina") and the standard encoding has none of them, while the standard
 * fonts' own metrics do. So no font file is committed and the text layer is read the way a real one
 * is: PDFBox turns each glyph name back into its letter.
 */
public final class ASyntheticStatement {

	/** One item of the statement, a payment that arrived or a charge that went out. */
	public record Item(boolean credit, String payer, String payerAccount, BigDecimal amount, String code,
			List<String> purpose, String reference, String order) {
	}

	private static final float WIDTH = 575;

	private static final float HEIGHT = 842;

	/** The first item's baseline, measured. */
	private static final float FIRST_ITEM = 243.8f;

	/** Where an item may start before it goes onto the next page. */
	private static final float LAST_ITEM = 700f;

	/** The right edges the amounts are aligned to, measured. */
	private static final float DEBIT_RIGHT = 442.7f;

	private static final float CREDIT_RIGHT = 543.4f;

	private String account = AikStatement.THE_ACCOUNT;

	private String bank = "AikBank ad Beograd";

	private int number = 1;

	private String dated = "23.10.2026";

	private final List<Item> items = new ArrayList<>();

	/** Lines of fields printed again under an item's purpose, by the item they follow. */
	private final java.util.Map<Item, List<String[]>> againUnder = new java.util.IdentityHashMap<>();

	private Integer saysCredits;

	private BigDecimal saysCreditTotal;

	private int itemsPerPage = Integer.MAX_VALUE;

	private int blankPagesAfter;

	private boolean blankOnly;

	private Consumer<PDDocument> beforeSaving = document -> {
	};

	public static ASyntheticStatement number(int number) {
		ASyntheticStatement statement = new ASyntheticStatement();
		statement.number = number;

		return statement;
	}

	public ASyntheticStatement dated(String day) {
		this.dated = day;

		return this;
	}

	public ASyntheticStatement ofTheAccount(String other) {
		this.account = other;

		return this;
	}

	public ASyntheticStatement ofTheBank(String other) {
		this.bank = other;

		return this;
	}

	/**
	 * A payment that arrived.
	 *
	 * @param reference the poziv na broj as it is to be printed, or null for none
	 */
	public ASyntheticStatement credit(String payer, String amount, String reference, String order) {
		items.add(new Item(true, payer, "200-0000000000001-11", new BigDecimal(amount), "289",
				List.of("Članarina za 2027. godinu"), reference, order));

		return this;
	}

	public ASyntheticStatement item(Item item) {
		items.add(item);

		return this;
	}

	/** A charge of the bank, the shape the three on the first statement have. */
	public ASyntheticStatement fee(String amount, String order) {
		items.add(new Item(false, null, null, new BigDecimal(amount), "221",
				List.of("Naplata: Naknade po partiji 105000000000328471, dospele na dan 31.07.2021. u iznosu od "
						+ amount + " RSD.Obaveza je naplacena u celosti", "dospele na dan"), null, order));

		return this;
	}

	/**
	 * A second line of fields under the last item's purpose, the label in the column of labels and the
	 * value beside it, for the case that asks which of two places a field is taken from.
	 */
	public ASyntheticStatement secondFieldsLine(String label, String value) {
		againUnder.computeIfAbsent(items.getLast(), item -> new ArrayList<>()).add(new String[] {label, value});

		return this;
	}

	/** Prints another count of credits than the items have, for the statement that does not add up. */
	public ASyntheticStatement sayingTheCreditsAre(int count, String total) {
		this.saysCredits = count;
		this.saysCreditTotal = new BigDecimal(total);

		return this;
	}

	public ASyntheticStatement itemsPerPage(int count) {
		this.itemsPerPage = count;

		return this;
	}

	public ASyntheticStatement blankPagesAfter(int count) {
		this.blankPagesAfter = count;

		return this;
	}

	/** A PDF of one empty page and nothing else: a file that is a PDF and holds no text at all. */
	public ASyntheticStatement blankOnly() {
		this.blankOnly = true;

		return this;
	}

	/** Something done to the document just before it is written, such as encrypting it. */
	public ASyntheticStatement beforeSaving(Consumer<PDDocument> what) {
		this.beforeSaving = what;

		return this;
	}

	public byte[] bytes() {
		try (PDDocument document = new PDDocument()) {
			if (blankOnly) {
				document.addPage(new PDPage(new PDRectangle(WIDTH, HEIGHT)));

				return saved(document);
			}

			Fonts fonts = new Fonts();
			List<Item> credits = items.stream().filter(Item::credit).toList();
			List<Item> debits = items.stream().filter(item -> !item.credit()).toList();

			int ordinal = 0;
			int onThisPage = 0;
			Page page = new Page(document, fonts, true);
			float y = FIRST_ITEM;

			for (Item item : items) {
				if (onThisPage == itemsPerPage || y > LAST_ITEM) {
					page.close();
					page = new Page(document, fonts, false);
					y = FIRST_ITEM;
					onThisPage = 0;
				}

				ordinal++;
				onThisPage++;
				y = page.item(ordinal, item, y);
			}

			page.totals(y + 4.5f,
					debits.size(), sum(debits),
					saysCredits == null ? credits.size() : saysCredits,
					saysCreditTotal == null ? sum(credits) : saysCreditTotal);
			page.close();

			for (int i = 0; i < blankPagesAfter; i++) {
				document.addPage(new PDPage(new PDRectangle(WIDTH, HEIGHT)));
			}

			beforeSaving.accept(document);

			return saved(document);
		}
		catch (IOException broken) {
			throw new UncheckedIOException(broken);
		}
	}

	private static byte[] saved(PDDocument document) throws IOException {
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		document.save(out);

		return out.toByteArray();
	}

	private static BigDecimal sum(List<Item> items) {
		return items.stream().map(Item::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
	}

	/** „4,200.00", as the statement prints money. */
	public static String printed(BigDecimal amount) {
		return new DecimalFormat("#,##0.00", DecimalFormatSymbols.getInstance(Locale.US)).format(amount);
	}

	/** One page being drawn. */
	private final class Page {

		private final PDPageContentStream text;

		private final Fonts fonts;

		Page(PDDocument document, Fonts fonts, boolean first) throws IOException {
			PDPage page = new PDPage(new PDRectangle(WIDTH, HEIGHT));
			document.addPage(page);
			this.text = new PDPageContentStream(document, page);
			this.fonts = fonts;

			at(fonts.bold, 6, 15.5f, 21.7f, "Asseco SEE 2015 ;ks2izvplkk ; Rel. 1.6");
			at(fonts.boldItalic, 8, 334.7f, 22.7f, "Strana: 1 od: 1");

			if (first) {
				at(fonts.bold, 12, 257.9f, 46.0f, bank);
				at(fonts.bold, 12, 257.9f, 60.0f, "Bulevar Primera 1,Beograd");
				at(fonts.bold, 14, 17.9f, 114.2f, "IZVOD BROJ " + number);
				at(fonts.bold, 12, 285.5f, 111.4f, "Komitent:");
				at(fonts.bold, 10, 18.2f, 127.4f, "Od: " + dated);
				at(fonts.bold, 12, 292.4f, 125.0f, "SPORTSKO UDRUŽENJE BTL");
			}

			at(fonts.bold, 10, 21.4f, 226.2f, "Račun: " + account);
			at(fonts.boldItalic, 8, 418.3f, 223.9f, "Duguje");
			at(fonts.boldItalic, 8, 512.4f, 223.9f, "Potražuje");
		}

		/** Draws one item from its baseline and answers where the next one starts. */
		float item(int ordinal, Item item, float top) throws IOException {
			at(fonts.boldItalic, 8, 17.6f, top, " " + ordinal + ".");
			right(fonts.courierBold, 8, item.credit() ? CREDIT_RIGHT : DEBIT_RIGHT, top - 0.7f,
					printed(item.amount()));

			float y = top;

			if (item.credit()) {
				at(fonts.bold, 8, 54.9f, top - 0.1f, item.payer());
				y += 12.2f;
				at(fonts.boldItalic, 8, 60.2f, y, "Račun:");
				at(fonts.bold, 8, 87.6f, y - 0.2f, item.payerAccount());
			}

			y += item.credit() ? 11.3f : 12.2f;
			at(fonts.boldItalic, 8, 61.4f, y, "Nalog:");
			at(fonts.regular, 8, 88.2f, y - 0.1f, item.order());
			at(fonts.boldItalic, 8, 301.0f, y, "Šifra pl.:");
			at(fonts.regular, 8, 334.6f, y - 0.1f, item.code());

			if (item.reference() != null) {
				/* WHERE THE BANK PRINTS THE REFERENCE IS NOT MEASURED (AikStatement's head): this puts it
				   where the bank prints its other labelled fields, on a line of its own. */
				y += 11.3f;
				at(fonts.boldItalic, 8, 61.4f, y, "Poziv na broj:");
				at(fonts.regular, 8, 120.0f, y - 0.1f, item.reference());
			}

			y += 12.7f;

			for (String line : item.purpose()) {
				at(fonts.regular, 8, 87.5f, y, line);
				y += 8.3f;
			}

			for (String[] again : againUnder.getOrDefault(item, List.of())) {
				at(fonts.boldItalic, 8, 61.4f, y, again[0]);
				at(fonts.regular, 8, 120.0f, y - 0.1f, again[1]);
				y += 8.3f;
			}

			y += 4.9f;
			at(fonts.boldItalic, 8, 77.3f, y, "Datum izvršenja:");
			at(fonts.courier, 8, 138.8f, y - 0.8f, dated);
			at(fonts.boldItalic, 8, 264.5f, y, item.credit() ? "Datum prijema:" : "Datum obrade:");
			at(fonts.courier, 8, 331.4f, y - 0.8f, dated);

			return y + 14.0f;
		}

		void totals(float top, int debits, BigDecimal debitTotal, int credits, BigDecimal creditTotal)
				throws IOException {
			at(fonts.bold, 10, 19.1f, top, "UKUPNO ZA IZVOD");
			at(fonts.boldItalic, 8, 394.7f, top - 1.5f, "Dug.promet");
			at(fonts.boldItalic, 8, 509.5f, top - 1.5f, "Pot.promet");
			at(fonts.boldItalic, 8, 141.6f, top + 11.9f, "Prethodno stanje:");
			right(fonts.courierBold, 8, 319.2f, top + 10.3f, "0.00");
			at(fonts.boldItalic, 8, 124.8f, top + 22.0f, "Ukupno stavki duguje:");
			right(fonts.courierBold, 8, 214.0f, top + 21.2f, String.valueOf(debits));
			right(fonts.courierBold, 8, 436.2f, top + 22.7f, printed(debitTotal));
			at(fonts.boldItalic, 8, 116.8f, top + 34.5f, "Ukupno stavki potražuje:");
			right(fonts.courierBold, 8, 214.2f, top + 33.7f, String.valueOf(credits));
			right(fonts.courierBold, 8, 546.7f, top + 33.7f, printed(creditTotal));
			at(fonts.boldItalic, 10, 148.6f, top + 45.9f, "Novo stanje:");
			right(fonts.courierBold, 10, 319.2f, top + 45.8f,
					printed(creditTotal.subtract(debitTotal)));
		}

		void close() throws IOException {
			text.close();
		}

		private void at(PDFont font, float size, float x, float baseline, String what) throws IOException {
			text.beginText();
			text.setFont(font, size);
			text.newLineAtOffset(x, HEIGHT - baseline);
			text.showText(what);
			text.endText();
		}

		private void right(PDFont font, float size, float rightEdge, float baseline, String what)
				throws IOException {
			at(font, size, rightEdge - font.getStringWidth(what) / 1000 * size, baseline, what);
		}
	}

	/** The four faces the first statement is printed in, each able to write the Serbian letters. */
	private static final class Fonts {

		final PDFont regular = standard("Times-Roman");

		final PDFont bold = standard("Times-Bold");

		final PDFont boldItalic = standard("Times-BoldItalic");

		final PDFont courier = standard("Courier");

		final PDFont courierBold = standard("Courier-Bold");

		Fonts() throws IOException {
		}

		/**
		 * A standard font whose encoding puts the five letters the standard encoding lacks on five codes
		 * it does not use. The glyphs are in the fonts' own metrics, and PDFBox reads each glyph name back
		 * as its letter, so the page reads as Serbian without a font file.
		 */
		private static PDFont standard(String name) throws IOException {
			COSArray differences = new COSArray();
			differences.add(COSInteger.get(128));

			for (String glyph : List.of("Ccaron", "ccaron", "Cacute", "cacute", "Dcroat", "dcroat")) {
				differences.add(COSName.getPDFName(glyph));
			}

			COSDictionary encoding = new COSDictionary();
			encoding.setItem(COSName.TYPE, COSName.ENCODING);
			encoding.setItem(COSName.BASE_ENCODING, COSName.WIN_ANSI_ENCODING);
			encoding.setItem(COSName.DIFFERENCES, differences);

			COSDictionary font = new COSDictionary();
			font.setItem(COSName.TYPE, COSName.FONT);
			font.setItem(COSName.SUBTYPE, COSName.TYPE1);
			font.setName(COSName.BASE_FONT, name);
			font.setItem(COSName.ENCODING, encoding);

			return new PDType1Font(font);
		}
	}
}
