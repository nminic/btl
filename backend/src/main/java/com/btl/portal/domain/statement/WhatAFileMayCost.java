package com.btl.portal.domain.statement;

import org.apache.pdfbox.cos.COSArray;
import org.apache.pdfbox.cos.COSBase;
import org.apache.pdfbox.cos.COSDictionary;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.cos.COSStream;
import org.apache.pdfbox.filter.FilterFactory;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDResources;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Set;

/**
 * WHAT READING THE TEXT OF A FILE WILL COST, MEASURED BEFORE IT IS READ, AND REFUSED WHEN IT IS TOO MUCH.
 *
 * <p><b>Why this exists, and it is a measured failure and not a precaution.</b> The review of PR 647
 * (25.10.2026) built a file of 306 477 bytes, under the 2 MB the route takes, whose one page content
 * inflates to 300 MB, and reading its text exhausted the heap ({@code OutOfMemoryError}). The bound that
 * stood in front of it, PDFBox's memory-only stream cache, bounds that cache and nothing else: what the
 * content parser and the fonts build from the decoded bytes was bounded by nothing. And
 * {@code getNumberOfPages()} is the {@code /Count} the file itself writes, so a file claiming one page
 * and holding thousands was read whole.
 *
 * <p><b>So the cost is measured in the units reading the text spends, before any of it is spent:</b>
 * <ul>
 * <li><b>Pages, counted by walking the page tree</b> and never read off {@code /Count}: at most
 * {@link AikStatement#AT_MOST_PAGES}.
 * <li><b>The decoded bytes of every stream reading the text will decode</b>: each page's content, as
 * many times as pages use it (a content shared by fifty pages is read fifty times), and every stream
 * under every font a page names (the font program, its cmap), once each. At most
 * {@link #AT_MOST_DECODED}. Each stream is decoded into a sink that stops the decoder at what is left of
 * that budget, so the measuring holds no more than the budget either.
 * <li><b>What would make a content run more than once is refused outright</b>, because the count above
 * could not say how often: a form inside a page (an {@code /XObject} that is not a picture, which the
 * text reader enters and may nest) and a font whose glyphs are themselves content ({@code /Type3}).
 * <li><b>A stream that only an image codec could decode is refused</b> unless it is a picture, which
 * reading the text does not decode at all: the codecs build whole images in memory and are not stopped
 * by a sink.
 * </ul>
 *
 * <p><b>Measured against the first real statement</b> (number 1 of 23.10.2026): one page, and 123 041
 * decoded bytes of content and fonts; its two pictures are 173 550 bytes more and are not decoded by
 * reading the text. So {@link #AT_MOST_DECODED} is some thirty times the one real statement.
 *
 * <p><b>WHAT IS NOT BOUNDED HERE, said rather than claimed:</b> time, which no clock watches. What a
 * reading of the text spends is bounded by the decoded bytes it reads, so a long reading is a large one,
 * and that is bounded; four megabytes of cheap operators still take their time, and that is the
 * boundary. And how PDFBox builds the skeleton of the file (the cross-reference, the dictionaries)
 * before this is asked: that is bounded by the bytes of the file, which the route caps at
 * {@link AikStatement#AT_MOST_BYTES}.
 */
final class WhatAFileMayCost {

	/** The decoded bytes reading the text may cost, over all its streams. See the head of this class. */
	static final long AT_MOST_DECODED = 4L * 1024 * 1024;

	/** How deep the dictionaries under a font may go before the walk stops trusting them. */
	private static final int DEEPEST = 16;

	/** The filters whose decoders write as they go, so a sink can stop them. */
	private static final Set<COSName> COUNTABLE = Set.of(COSName.FLATE_DECODE, COSName.FLATE_DECODE_ABBREVIATION,
			COSName.LZW_DECODE, COSName.LZW_DECODE_ABBREVIATION, COSName.RUN_LENGTH_DECODE,
			COSName.RUN_LENGTH_DECODE_ABBREVIATION, COSName.ASCII85_DECODE, COSName.ASCII85_DECODE_ABBREVIATION,
			COSName.ASCII_HEX_DECODE, COSName.ASCII_HEX_DECODE_ABBREVIATION);

	private final long budget;

	private long spent;

	/** Every stream and container under the fonts already walked, so none is walked or counted twice. */
	private final Set<COSBase> walked = Collections.newSetFromMap(new IdentityHashMap<>());

	private WhatAFileMayCost(long budget) {
		this.budget = budget;
	}

	/**
	 * Whether reading the text of this document stays within its bounds.
	 *
	 * @throws TooMuch naming what was over, when anything is
	 */
	static void ofReading(PDDocument document) throws TooMuch, IOException {
		ofReading(document, AT_MOST_DECODED);
	}

	/** The same against another budget, for the cases that stand at its edge. */
	static void ofReading(PDDocument document, long budget) throws TooMuch, IOException {
		WhatAFileMayCost cost = new WhatAFileMayCost(budget);
		int pages = 0;

		for (PDPage page : document.getPages()) {
			pages++;

			if (pages > AikStatement.AT_MOST_PAGES) {
				throw new TooMuch("more than " + AikStatement.AT_MOST_PAGES + " pages in the page tree");
			}

			cost.ofThePage(page);
		}
	}

	private void ofThePage(PDPage page) throws TooMuch, IOException {
		for (COSStream content : streamsOf(page.getCOSObject().getDictionaryObject(COSName.CONTENTS))) {
			spend(content);
		}

		PDResources resources = page.getResources();

		if (resources == null) {
			return;
		}

		COSDictionary own = resources.getCOSObject();

		for (COSBase one : valuesOf(own.getCOSDictionary(COSName.XOBJECT))) {
			if (!(one instanceof COSStream object) || !COSName.IMAGE.equals(object.getCOSName(COSName.SUBTYPE))) {
				throw new TooMuch("an object in a page that is not a picture");
			}
		}

		for (COSBase one : valuesOf(own.getCOSDictionary(COSName.FONT))) {
			if (!(one instanceof COSDictionary font)) {
				throw new TooMuch("a font that is not a font");
			}

			if (COSName.TYPE3.equals(font.getCOSName(COSName.SUBTYPE))) {
				throw new TooMuch("a font whose glyphs are content");
			}

			spendUnder(font, 0);
		}
	}

	/** Every stream under a font, each counted once however many pages and fonts name it. */
	private void spendUnder(COSBase base, int depth) throws TooMuch, IOException {
		if (depth > DEEPEST) {
			throw new TooMuch("a font nested deeper than " + DEEPEST);
		}

		if (base == null || !walked.add(base)) {
			return;
		}

		if (base instanceof COSStream stream) {
			spend(stream);
		}
		else if (base instanceof COSDictionary dictionary) {
			for (COSBase one : valuesOf(dictionary)) {
				spendUnder(one, depth + 1);
			}
		}
		else if (base instanceof COSArray array) {
			for (int i = 0; i < array.size(); i++) {
				spendUnder(array.getObject(i), depth + 1);
			}
		}
	}

	/** Decodes one stream into a sink that stops at what is left, and spends what it decoded. */
	private void spend(COSStream stream) throws TooMuch, IOException {
		List<COSName> filters = filtersOf(stream);
		byte[] input;

		try (InputStream raw = stream.createRawInputStream()) {
			input = raw.readAllBytes();
		}

		/* A STREAM WITH NO FILTER IS ITS OWN BYTES, and it goes through the same sink as any other, so
		   what is left of the budget is asked in one place for every stream. */
		if (filters.isEmpty()) {
			Sink plain = new Sink(budget - spent, false);

			try {
				plain.write(input, 0, input.length);
			}
			catch (Stopped stopped) {
				/* `over` below says so. */
			}

			if (plain.over) {
				throw new TooMuch("more than " + budget + " decoded bytes");
			}

			spent += plain.counted;

			return;
		}

		for (int i = 0; i < filters.size(); i++) {
			if (!COUNTABLE.contains(filters.get(i))) {
				throw new TooMuch("a stream that is not a picture, filtered by " + filters.get(i).getName());
			}

			boolean last = i == filters.size() - 1;
			Sink step = new Sink(budget - spent, !last);

			try {
				FilterFactory.INSTANCE.getFilter(filters.get(i))
						.decode(new ByteArrayInputStream(input), step, stream, i);
			}
			catch (Stopped stopped) {
				/* The sink stopped the decoder; `over` below says so. */
			}

			if (step.over) {
				throw new TooMuch("more than " + budget + " decoded bytes");
			}

			input = step.kept();

			if (last) {
				spent += step.counted;
			}
		}
	}

	private static List<COSName> filtersOf(COSStream stream) throws TooMuch {
		COSBase filters = stream.getFilters();

		if (filters == null) {
			return List.of();
		}

		if (filters instanceof COSName one) {
			return List.of(one);
		}

		if (!(filters instanceof COSArray array)) {
			throw new TooMuch("a filter that is not a name");
		}

		List<COSName> named = new ArrayList<>();

		for (int i = 0; i < array.size(); i++) {
			if (!(array.getObject(i) instanceof COSName one)) {
				throw new TooMuch("a filter that is not a name");
			}

			named.add(one);
		}

		return named;
	}

	private static List<COSStream> streamsOf(COSBase contents) throws TooMuch {
		if (contents == null) {
			return List.of();
		}

		if (contents instanceof COSStream one) {
			return List.of(one);
		}

		if (!(contents instanceof COSArray array)) {
			throw new TooMuch("a content that is not a stream");
		}

		List<COSStream> streams = new ArrayList<>();

		for (int i = 0; i < array.size(); i++) {
			if (!(array.getObject(i) instanceof COSStream one)) {
				throw new TooMuch("a content that is not a stream");
			}

			streams.add(one);
		}

		return streams;
	}

	/** The values of a dictionary, each resolved; none for no dictionary. */
	private static List<COSBase> valuesOf(COSDictionary dictionary) {
		if (dictionary == null) {
			return List.of();
		}

		List<COSBase> values = new ArrayList<>();

		for (COSName key : dictionary.keySet()) {
			values.add(dictionary.getDictionaryObject(key));
		}

		return values;
	}

	/**
	 * Where a decoder writes: it counts, keeps what it is given when it is a step before the last, and
	 * stops the decoder the moment it is given more than it may take. It notes that as well as throwing,
	 * because a decoder that caught what it was thrown would carry on as though it had not: the flag is
	 * what is asked after the decoder returns, however it returned.
	 */
	private static final class Sink extends OutputStream {

		private final long atMost;

		private final boolean keeping;

		private final ByteArrayOutputStream kept = new ByteArrayOutputStream();

		private long counted;

		private boolean over;

		Sink(long atMost, boolean keeping) {
			this.atMost = atMost;
			this.keeping = keeping;
		}

		@Override
		public void write(int one) throws Stopped {
			write(new byte[] {(byte) one}, 0, 1);
		}

		@Override
		public void write(byte[] bytes, int from, int length) throws Stopped {
			if (counted + length > atMost) {
				over = true;

				throw new Stopped();
			}

			counted += length;

			if (keeping) {
				kept.write(bytes, from, length);
			}
		}

		byte[] kept() {
			return kept.toByteArray();
		}
	}

	/** Thrown by a sink to stop its decoder; never leaves this class. */
	private static final class Stopped extends IOException {

		Stopped() {
			super("the sink is full");
		}
	}

	/** What reading the text would cost more of than a statement does. */
	static final class TooMuch extends Exception {

		TooMuch(String what) {
			super(what);
		}
	}
}
