package com.btl.portal.domain.statement;

import org.apache.pdfbox.cos.COSArray;
import org.apache.pdfbox.cos.COSBase;
import org.apache.pdfbox.cos.COSDictionary;
import org.apache.pdfbox.cos.COSInteger;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.cos.COSNull;
import org.apache.pdfbox.cos.COSStream;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDResources;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT READING THE TEXT OF A FILE MAY COST, MEASURED BEFORE IT IS READ ({@link WhatAFileMayCost}).
 *
 * <p>The files are built here, small, and none of them can hurt the run that measures it if the measure
 * is gone: the largest decodes to a few megabytes, which PDFBox reads without trouble. What each case
 * asks is the measure's own answer, at the edge of its budget and one past it.
 *
 * <p>The review of PR 647 measured the shapes these stand for, at full size and outside the suite: a
 * content of 306 477 bytes that inflates to 300 MB (the heap ran out behind the old bound), a page tree
 * that claims one page and holds five thousand, and a font program that inflates to 300 MB.
 */
class WhatAFileMayCostTest {

	/** A content of this many decoded bytes, deflated: cheap operators, no text. */
	private static COSStream content(PDDocument document, int decoded) throws IOException {
		COSStream stream = document.getDocument().createCOSStream();
		byte[] bytes = new byte[decoded];
		byte[] operator = "q Q\n".getBytes();

		for (int i = 0; i < decoded; i++) {
			bytes[i] = operator[i % operator.length];
		}

		try (OutputStream out = stream.createOutputStream(COSName.FLATE_DECODE)) {
			out.write(bytes);
		}

		return stream;
	}

	private static PDPage aPage(PDDocument document, COSStream content) {
		PDPage page = new PDPage();
		page.getCOSObject().setItem(COSName.CONTENTS, content);
		document.addPage(page);

		return page;
	}

	private static void measured(PDDocument document, long budget) throws Exception {
		WhatAFileMayCost.ofReading(document, budget);
	}

	private static void tooMuch(PDDocument document, long budget, String what) {
		assertThatThrownBy(() -> WhatAFileMayCost.ofReading(document, budget))
				.isInstanceOf(WhatAFileMayCost.TooMuch.class)
				.hasMessageContaining(what);
	}

	@Test
	void aContentIsMeasuredByWhatItDecodesToAndRefusedOneBytePastTheBudget() throws Exception {
		try (PDDocument document = new PDDocument()) {
			aPage(document, content(document, 10_000));

			assertThatCode(() -> measured(document, 10_000)).doesNotThrowAnyException();
			tooMuch(document, 9_999, "decoded bytes");
		}
	}

	/** A CONTENT SHARED BY TWO PAGES IS READ TWICE, so it is counted twice. */
	@Test
	void aContentSharedByPagesIsCountedOnceForEachPage() throws Exception {
		try (PDDocument document = new PDDocument()) {
			COSStream shared = content(document, 10_000);
			aPage(document, shared);
			aPage(document, shared);

			assertThatCode(() -> measured(document, 20_000)).doesNotThrowAnyException();
			tooMuch(document, 19_999, "decoded bytes");
		}
	}

	/**
	 * THE PAGES ARE COUNTED BY WALKING THE TREE, so a tree that claims one page and holds fifty one is
	 * refused, and fifty are not.
	 */
	@Test
	void thePagesAreWalkedAndNotReadOffTheCountTheFileClaims() throws Exception {
		for (int pages : new int[] {AikStatement.AT_MOST_PAGES, AikStatement.AT_MOST_PAGES + 1}) {
			try (PDDocument document = new PDDocument()) {
				COSStream shared = content(document, 10);

				for (int i = 0; i < pages; i++) {
					aPage(document, shared);
				}

				document.getPages().getCOSObject().setItem(COSName.COUNT, COSInteger.ONE);

				if (pages > AikStatement.AT_MOST_PAGES) {
					tooMuch(document, WhatAFileMayCost.AT_MOST_DECODED, "pages in the page tree");
				}
				else {
					assertThatCode(() -> measured(document, WhatAFileMayCost.AT_MOST_DECODED))
							.doesNotThrowAnyException();
				}
			}
		}
	}

	@Test
	void theStreamsUnderAFontAreCountedOnceHoweverManyPagesNameIt() throws Exception {
		try (PDDocument document = new PDDocument()) {
			COSDictionary font = aFont(document, content(document, 5_000));

			for (int i = 0; i < 3; i++) {
				PDPage page = aPage(document, content(document, 100));
				page.setResources(new PDResources());
				page.getResources().getCOSObject().setItem(COSName.FONT, fontsOf(font));
			}

			assertThatCode(() -> measured(document, 5_300)).doesNotThrowAnyException();
			tooMuch(document, 5_299, "decoded bytes");
		}
	}

	@Test
	void aFontWhoseGlyphsAreContentIsRefused() throws Exception {
		try (PDDocument document = new PDDocument()) {
			COSDictionary font = aFont(document, content(document, 10));
			font.setItem(COSName.SUBTYPE, COSName.TYPE3);
			PDPage page = aPage(document, content(document, 10));
			page.setResources(new PDResources());
			page.getResources().getCOSObject().setItem(COSName.FONT, fontsOf(font));

			tooMuch(document, WhatAFileMayCost.AT_MOST_DECODED, "glyphs are content");
		}
	}

	@Test
	void aFontNestedDeeperThanAFontIsIsRefused() throws Exception {
		try (PDDocument document = new PDDocument()) {
			COSDictionary font = aFont(document, content(document, 10));
			COSDictionary deepest = font;

			for (int i = 0; i < 20; i++) {
				COSDictionary inner = new COSDictionary();
				deepest.setItem(COSName.getPDFName("Inner"), inner);
				deepest = inner;
			}

			PDPage page = aPage(document, content(document, 10));
			page.setResources(new PDResources());
			page.getResources().getCOSObject().setItem(COSName.FONT, fontsOf(font));

			tooMuch(document, WhatAFileMayCost.AT_MOST_DECODED, "nested deeper");
		}
	}

	/**
	 * A PICTURE IS NOT DECODED BY READING THE TEXT, so it costs nothing however large; a form is entered
	 * and may nest, so it is refused.
	 */
	@Test
	void aPictureCostsNothingAndAFormIsRefused() throws Exception {
		try (PDDocument document = new PDDocument()) {
			COSStream picture = document.getDocument().createCOSStream();

			try (OutputStream out = picture.createRawOutputStream()) {
				out.write(new byte[50_000]);
			}

			picture.setItem(COSName.SUBTYPE, COSName.IMAGE);
			picture.setItem(COSName.FILTER, COSName.DCT_DECODE);

			PDPage page = aPage(document, content(document, 10));
			page.setResources(new PDResources());
			COSDictionary objects = new COSDictionary();
			objects.setItem(COSName.getPDFName("Im1"), picture);
			page.getResources().getCOSObject().setItem(COSName.XOBJECT, objects);

			assertThatCode(() -> measured(document, 10)).doesNotThrowAnyException();

			COSStream form = content(document, 10);
			form.setItem(COSName.SUBTYPE, COSName.FORM);
			objects.setItem(COSName.getPDFName("Fm1"), form);

			tooMuch(document, WhatAFileMayCost.AT_MOST_DECODED, "not a picture");
		}
	}

	@Test
	void aContentOnlyAnImageCodecCouldDecodeIsRefused() throws Exception {
		try (PDDocument document = new PDDocument()) {
			COSStream content = document.getDocument().createCOSStream();

			try (OutputStream out = content.createRawOutputStream()) {
				out.write(new byte[100]);
			}

			content.setItem(COSName.FILTER, COSName.DCT_DECODE);
			aPage(document, content);

			tooMuch(document, WhatAFileMayCost.AT_MOST_DECODED, "filtered by DCTDecode");
		}
	}

	/** A CHAIN OF FILTERS IS COUNTED BY WHAT THE LAST ONE GIVES, as the real statement writes its own. */
	@Test
	void aChainOfFiltersIsCountedByWhatItFinallyDecodesTo() throws Exception {
		try (PDDocument document = new PDDocument()) {
			COSStream content = document.getDocument().createCOSStream();
			byte[] decoded = new byte[3_000];
			Arrays.fill(decoded, (byte) ' ');
			COSArray filters = new COSArray();
			filters.add(COSName.ASCII_HEX_DECODE);
			filters.add(COSName.FLATE_DECODE);

			try (OutputStream out = content.createOutputStream(filters)) {
				out.write(decoded);
			}

			aPage(document, content);

			assertThatCode(() -> measured(document, 3_000)).doesNotThrowAnyException();
			tooMuch(document, 2_999, "decoded bytes");
		}
	}

	/** THE SHAPE THE REVIEW MEASURED, at a size that cannot hurt this run: refused before its text is read. */
	@Test
	void aFileWhoseContentInflatesPastTheBudgetIsNotAStatementAndItsTextIsNeverRead() throws Exception {
		byte[] file;

		try (PDDocument document = new PDDocument()) {
			aPage(document, content(document, (int) WhatAFileMayCost.AT_MOST_DECODED + 1));

			ByteArrayOutputStream out = new ByteArrayOutputStream();
			document.save(out);
			file = out.toByteArray();
		}

		assertThat(file.length).isLessThan(100_000);
		assertThatThrownBy(() -> AikStatement.read(file))
				.isInstanceOfSatisfying(AikStatement.NotTaken.class, refused -> {
					assertThat(refused.refusal()).isEqualTo(AikStatement.Refusal.NOT_A_STATEMENT);
					assertThat(refused.getMessage()).contains("decoded bytes");
				});
	}

	/* ------------------------------------------------------------------------------------
	   SHAPES A FILE MAY TAKE THAT THE MEASURE STILL ANSWERS
	   ------------------------------------------------------------------------------------ */

	/** A CONTENT WITH NO FILTER costs its own bytes, and one byte past the budget is refused. */
	@Test
	void aContentWithNoFilterCostsItsOwnBytes() throws Exception {
		try (PDDocument document = new PDDocument()) {
			COSStream plain = document.getDocument().createCOSStream();

			try (OutputStream out = plain.createRawOutputStream()) {
				out.write(new byte[1_000]);
			}

			aPage(document, plain);

			assertThatCode(() -> measured(document, 1_000)).doesNotThrowAnyException();
			tooMuch(document, 999, "decoded bytes");
		}
	}

	/** A CONTENT IN SEVERAL STREAMS costs all of them; a page with no content costs nothing. */
	@Test
	void aContentInSeveralStreamsCostsAllOfThemAndNoContentCostsNothing() throws Exception {
		try (PDDocument document = new PDDocument()) {
			COSArray parts = new COSArray();
			parts.add(content(document, 300));
			parts.add(content(document, 700));
			PDPage page = new PDPage();
			page.getCOSObject().setItem(COSName.CONTENTS, parts);
			document.addPage(page);
			document.addPage(new PDPage());

			assertThatCode(() -> measured(document, 1_000)).doesNotThrowAnyException();
			tooMuch(document, 999, "decoded bytes");
		}
	}

	@Test
	void aContentThatIsNotAStreamIsRefused() throws Exception {
		for (COSBase contents : new COSBase[] {COSInteger.ONE, arrayOf(COSInteger.ONE)}) {
			try (PDDocument document = new PDDocument()) {
				PDPage page = new PDPage();
				page.getCOSObject().setItem(COSName.CONTENTS, contents);
				document.addPage(page);

				tooMuch(document, WhatAFileMayCost.AT_MOST_DECODED, "not a stream");
			}
		}
	}

	@Test
	void aFilterThatIsNotANameIsRefused() throws Exception {
		for (COSBase filter : new COSBase[] {COSInteger.ONE, arrayOf(COSInteger.ONE)}) {
			try (PDDocument document = new PDDocument()) {
				COSStream content = content(document, 10);
				content.setItem(COSName.FILTER, filter);
				aPage(document, content);

				tooMuch(document, WhatAFileMayCost.AT_MOST_DECODED, "not a name");
			}
		}
	}

	/** An object in a page that is not a stream at all is not a picture either. */
	@Test
	void anObjectThatIsNotAStreamIsRefused() throws Exception {
		try (PDDocument document = new PDDocument()) {
			PDPage page = aPage(document, content(document, 10));
			page.setResources(new PDResources());
			COSDictionary objects = new COSDictionary();
			objects.setItem(COSName.getPDFName("Im1"), COSInteger.ONE);
			page.getResources().getCOSObject().setItem(COSName.XOBJECT, objects);

			tooMuch(document, WhatAFileMayCost.AT_MOST_DECODED, "not a picture");
		}
	}

	/** A font that is not a dictionary is refused; an entry of a font that names nothing costs nothing. */
	@Test
	void aFontThatIsNotADictionaryIsRefusedAndAnEmptyEntryCostsNothing() throws Exception {
		try (PDDocument document = new PDDocument()) {
			PDPage page = aPage(document, content(document, 10));
			page.setResources(new PDResources());
			COSDictionary fonts = new COSDictionary();
			fonts.setItem(COSName.getPDFName("F1"), COSInteger.ONE);
			page.getResources().getCOSObject().setItem(COSName.FONT, fonts);

			tooMuch(document, WhatAFileMayCost.AT_MOST_DECODED, "not a font");
		}

		try (PDDocument document = new PDDocument()) {
			COSDictionary font = aFont(document, content(document, 10));
			font.setItem(COSName.getPDFName("Nothing"), COSNull.NULL);
			PDPage page = aPage(document, content(document, 10));
			page.setResources(new PDResources());
			page.getResources().getCOSObject().setItem(COSName.FONT, fontsOf(font));

			assertThatCode(() -> measured(document, 20)).doesNotThrowAnyException();
		}
	}

	private static COSArray arrayOf(COSBase one) {
		COSArray array = new COSArray();
		array.add(one);

		return array;
	}

	private static COSDictionary aFont(PDDocument document, COSStream program) {
		COSDictionary descriptor = new COSDictionary();
		descriptor.setItem(COSName.FONT_FILE2, program);
		COSDictionary font = new COSDictionary();
		font.setItem(COSName.TYPE, COSName.FONT);
		font.setItem(COSName.SUBTYPE, COSName.TRUE_TYPE);
		font.setItem(COSName.FONT_DESC, descriptor);

		return font;
	}

	private static COSDictionary fontsOf(COSDictionary font) {
		COSDictionary fonts = new COSDictionary();
		fonts.setItem(COSName.getPDFName("F1"), font);

		return fonts;
	}
}
