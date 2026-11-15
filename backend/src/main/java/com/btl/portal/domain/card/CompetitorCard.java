package com.btl.portal.domain.card;

import com.btl.portal.domain.photo.WhatAPictureIs;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.AlphaComposite;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontFormatException;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.geom.Arc2D;
import java.awt.geom.Ellipse2D;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

/**
 * THE CARD A PROFILE IS SHARED WITH, 1200 BY 630, DRAWN AS A JPEG.
 *
 * <p>Owner, PDL P11, 15.11.2026, on the proposal of a card to share (anchor „Profil ima deljivu sliku
 * za društvene mreže (OG sliku)”): „Baš mi se sviđa prva varijanta, prsten!” The layout is the model
 * {@code btl-produkt/predlozi/kartica-000001.html} draws in its function {@code draw}, written out
 * here in Java2D coordinate for coordinate: the ring of the kinds of race around the portrait, the
 * member number in a chip, the name, the category and the team, the two figures and every kind of
 * the ring under them, and the address at the foot.
 *
 * <p><b>What it does not draw, each by a decision.</b> No ascent or descent and no third figure
 * („m uspona i spusta nemoj pominjati”, „Bez trećeg broja”), no town („Nemoj stavljati Niš, nego
 * naziv kluba ukoliko postoji”), nothing where there is no team („ako nema tima kojem trkač
 * pripada, ne ispisuje se ništa”), no date of birth (section 3 of the privacy policy) and no best
 * race (PDL, 11.08.2026, „ne treba isticati najbolje rezultate člana"). A kind with no race has no
 * slice and no cell.
 *
 * <p><b>Pure, and with no Spring in it</b>: what is drawn is a {@link Face}, which the caller builds
 * out of what the portal answers a visitor, and the portrait arrives already decoded and cut. So
 * everything about who may see what stays where the portal decides it, and this class only draws.
 *
 * <p><b>The font is Roboto</b> (owner, 15.11.2026, chosen with my recommendation), version
 * 1.100141 of 2013, copyright Google and licensed under the Apache License 2.0, as the name table of
 * both files says; the licence stands beside them in {@code resources/fonts}. It is loaded from the
 * files rather than asked of the platform, because the logical {@code SANS_SERIF} is whatever the
 * machine has, and the card must carry č, ć, đ, š, ž and Cyrillic on every machine it is drawn on.
 *
 * <p><b>Every line of text is shrunk until it fits its column</b> (the model's {@code fit}), and a
 * line still too long at the smallest size is cut and ends in an ellipsis, so a name a member typed
 * can never run past its column or under the ring. Characters the font cannot draw and control
 * characters are left out before anything is measured ({@link #printable}).
 */
public final class CompetitorCard {

	public static final int WIDTH = 1200;

	public static final int HEIGHT = 630;

	/**
	 * THE VERSION OF THIS DRAWING, which is part of the address of every card. A change to the
	 * layout that the {@link Face} does not carry - a colour, a position, a size - raises it, so that
	 * every network asks for every card again; a change to a word or a figure does not need to,
	 * because the face is what the address is a digest of.
	 */
	public static final int DESIGN = 1;

	/** The side of the portrait's circle, in pixels of the card. */
	public static final int PORTRAIT = 364;

	/**
	 * THE MOST A CARD MAY WEIGH. WhatsApp drops a preview heavier than this (ADL A10), and the card is
	 * written at one quality chosen so that the heaviest portrait there can be - noise, which a JPEG
	 * cannot compress at all - stays under it; {@code CompetitorCardTest} measures exactly that.
	 */
	public static final int AT_MOST_BYTES = 300 * 1024;

	static final float QUALITY = 0.88f;

	/** The longest name or team this measures: more than any column can hold at any size. */
	static final int AT_MOST_CODE_POINTS = 120;

	private static final String ELLIPSIS = "…";

	static final Color BACKGROUND = new Color(0x060b16);
	static final Color SURFACE = new Color(0x101a2e);
	static final Color TEXT = new Color(0xeef2f8);
	static final Color HEAD = new Color(0xffffff);
	static final Color MUTED = new Color(0xa3b0c4);
	static final Color GOLD = new Color(0xf0c94a);
	static final Color INK = new Color(0x3a2a02);

	/** One colour per kind of the ring, the model's and the profile's ({@code styles/tokens.css}). */
	static final Map<String, Color> KIND_COLOURS = Map.of(
			"short", new Color(0x5b9cf0),
			"half", new Color(0x3fc27f),
			"long", new Color(0xe3c04a),
			"marathon", new Color(0xf0904a),
			"ultra", new Color(0xf4726a),
			"unscored", new Color(0xa3b0c4));

	static final int CENTRE_X = 330;
	static final int CENTRE_Y = 315;
	private static final int RING_RADIUS = 208;
	private static final int RING_BAND = 24;
	private static final double GAP = Math.toRadians(3);

	/** The right column: from here to {@link #RIGHT}, 540 pixels. */
	private static final int LEFT = 600;
	private static final int RIGHT = 1140;
	private static final int COLUMN = RIGHT - LEFT;

	static final Font REGULAR = fontAt("/fonts/Roboto-Regular.ttf");
	static final Font BOLD = fontAt("/fonts/Roboto-Bold.ttf");

	/** One kind of the ring: its key, how many races, and the figure and word written in its cell. */
	public record Slice(String kind, long count, String figure, String word) {
	}

	/**
	 * EVERYTHING THE CARD SHOWS, AS IT IS WRITTEN, and the one thing it is a digest of.
	 *
	 * @param chip      the member number
	 * @param name      first and last name, as the member wrote them
	 * @param underName the category and the team, or empty where there is neither
	 * @param initials  what the circle carries when there is no portrait
	 * @param slices    every kind with at least one race, in the ring's order; empty for a member
	 *                  who has run nothing, and then {@code nothingYet} stands where the figures do
	 * @param portrait  which portrait and which square of it, or null where none is public
	 */
	public record Face(String chip, String name, String underName, String initials,
			String racesFigure, String racesWord, String kilometresFigure, String kilometresWord,
			String nothingYet, List<Slice> slices, String address, String portrait) {

		public Face {
			slices = List.copyOf(slices);
		}

		/**
		 * A DIGEST OF EVERYTHING DRAWN, and of the version of the drawing, so that two cards that
		 * look different never share an address and two that look the same always do. Every field
		 * is written with its length in front of it, so no two faces can run together into the same
		 * text.
		 */
		public String digest() {
			StringBuilder text = new StringBuilder().append("design ").append(DESIGN);

			for (String field : new String[] {chip, name, underName, initials, racesFigure, racesWord,
					kilometresFigure, kilometresWord, nothingYet, address, String.valueOf(portrait)}) {
				text.append('\n').append(field.length()).append(':').append(field);
			}

			for (Slice cell : slices) {
				text.append('\n').append(cell.kind()).append(' ').append(cell.count()).append(' ')
						.append(cell.figure().length()).append(':').append(cell.figure())
						.append(cell.word().length()).append(':').append(cell.word());
			}

			/* The portal's one way of writing a SHA-256 (`WhatAPictureIs`), over the bytes of the
			   text. */
			return WhatAPictureIs.digestOf(text.toString().getBytes(StandardCharsets.UTF_8));
		}
	}

	private CompetitorCard() {
	}

	/**
	 * THE INITIALS OF A MEMBER WITHOUT A PORTRAIT, exactly as {@code components/Portrait.tsx} draws
	 * them on every circle of the portal: the first unit of the first name and the first unit of the
	 * last, {@code firstName.slice(0, 1)} and {@code lastName.slice(0, 1)}. Owner, 15.11.2026: „Kad
	 * nema profilne slike, u krugu treba da se nađu inicijali, a ne čovečuljak”. One fact with two
	 * homes, and {@code frontend/src/components/shareCard.cases.json} is what both are held to.
	 */
	public static String initials(String firstName, String lastName) {
		return first(firstName) + first(lastName);
	}

	private static String first(String text) {
		return text.isEmpty() ? "" : text.substring(0, 1);
	}

	/**
	 * THE CARD AS A JPEG.
	 *
	 * @param portrait the member's square, upright, or null for the initials
	 */
	public static byte[] jpeg(Face face, BufferedImage portrait) throws IOException {
		BufferedImage card = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
		Graphics2D pen = card.createGraphics();

		try {
			pen.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
			pen.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING,
					RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
			pen.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS,
					RenderingHints.VALUE_FRACTIONALMETRICS_ON);
			pen.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
			pen.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
			pen.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
					RenderingHints.VALUE_INTERPOLATION_BICUBIC);

			pen.setColor(BACKGROUND);
			pen.fillRect(0, 0, WIDTH, HEIGHT);
			pen.setColor(GOLD);
			pen.fillRect(0, 0, WIDTH, 6);

			ring(pen, face.slices());
			circle(pen, face, portrait);
			column(pen, face);
		} finally {
			pen.dispose();
		}

		return written(card);
	}

	/**
	 * THE RING: a slice per kind, its share of the races, with a gap of three degrees on either side
	 * of every boundary, beginning at the top and going clockwise. With nothing run the ring is whole
	 * and of the colour of the circle.
	 */
	private static void ring(Graphics2D pen, List<Slice> slices) {
		pen.setStroke(new BasicStroke(RING_BAND, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER));

		if (slices.isEmpty()) {
			pen.setColor(SURFACE);
			pen.draw(new Ellipse2D.Double(CENTRE_X - RING_RADIUS, CENTRE_Y - RING_RADIUS,
					2.0 * RING_RADIUS, 2.0 * RING_RADIUS));
			return;
		}

		long total = slices.stream().mapToLong(Slice::count).sum();
		double at = 0;

		for (Slice slice : slices) {
			double sweep = (double) slice.count() / total * 2 * Math.PI;
			double from = at + GAP / 2;
			double to = at + sweep - GAP / 2;

			/* Java2D measures angles from three o'clock, counter-clockwise and in degrees; the model
			   measures them from twelve, clockwise and in radians. */
			pen.setColor(KIND_COLOURS.get(slice.kind()));
			pen.draw(new Arc2D.Double(CENTRE_X - RING_RADIUS, CENTRE_Y - RING_RADIUS,
					2.0 * RING_RADIUS, 2.0 * RING_RADIUS, 90 - Math.toDegrees(from),
					-Math.toDegrees(to - from), Arc2D.OPEN));
			at += sweep;
		}
	}

	/** The portrait in its circle, or the initials on the colour of the circle. */
	private static void circle(Graphics2D pen, Face face, BufferedImage portrait) {
		int left = CENTRE_X - PORTRAIT / 2;
		int top = CENTRE_Y - PORTRAIT / 2;

		pen.setColor(SURFACE);
		pen.fill(new Ellipse2D.Double(left, top, PORTRAIT, PORTRAIT));

		if (portrait == null) {
			line(pen, face.initials(), CENTRE_X, 365, BOLD, 140, 60, TEXT, PORTRAIT - 40, Anchor.MIDDLE);
			return;
		}

		/* Cut through a mask drawn with antialiasing rather than through a clip, which Java2D draws
		   with a hard edge. */
		BufferedImage round = new BufferedImage(PORTRAIT, PORTRAIT, BufferedImage.TYPE_INT_ARGB);
		Graphics2D mask = round.createGraphics();

		try {
			mask.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
			mask.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
					RenderingHints.VALUE_INTERPOLATION_BICUBIC);
			mask.setColor(Color.WHITE);
			mask.fill(new Ellipse2D.Double(0, 0, PORTRAIT, PORTRAIT));
			mask.setComposite(AlphaComposite.SrcIn);
			mask.drawImage(portrait, 0, 0, PORTRAIT, PORTRAIT, null);
		} finally {
			mask.dispose();
		}

		pen.drawImage(round, left, top, null);
	}

	/** Everything right of the ring, top to bottom, at the model's coordinates. */
	private static void column(Graphics2D pen, Face face) {
		Font chipFont = BOLD.deriveFont(28f);
		double chipWidth = widthOf(pen, printable(face.chip()), chipFont) + 40;

		pen.setColor(GOLD);
		pen.fill(new RoundRectangle2D.Double(LEFT, 52, chipWidth, 46, 46, 46));
		line(pen, face.chip(), LEFT + chipWidth / 2, 84, BOLD, 28, 20, INK, chipWidth - 40,
				Anchor.MIDDLE);

		line(pen, face.name(), LEFT, 168, BOLD, 64, 44, HEAD, COLUMN, Anchor.START);

		if (!face.underName().isEmpty()) {
			line(pen, face.underName(), LEFT, 214, REGULAR, 32, 24, MUTED, COLUMN, Anchor.START);
		}

		if (face.slices().isEmpty()) {
			line(pen, face.nothingYet(), LEFT, 330, REGULAR, 40, 28, TEXT, COLUMN, Anchor.START);
		} else {
			figures(pen, face);
			kinds(pen, face.slices());
		}

		line(pen, face.address(), RIGHT, 596, REGULAR, 26, 18, MUTED, COLUMN, Anchor.END);
	}

	/** The count of races and the kilometres, each over its word. */
	private static void figures(Graphics2D pen, Face face) {
		double races = line(pen, face.racesFigure(), LEFT, 318, BOLD, 80, 52, TEXT, COLUMN / 2.0,
				Anchor.START);
		double racesWord = line(pen, face.racesWord(), LEFT, 358, REGULAR, 30, 20, MUTED,
				COLUMN / 2.0, Anchor.START);
		double second = LEFT + Math.max(races, racesWord) + 64;

		line(pen, face.kilometresFigure(), second, 318, BOLD, 80, 52, TEXT, RIGHT - second,
				Anchor.START);
		line(pen, face.kilometresWord(), second, 358, REGULAR, 30, 20, MUTED, RIGHT - second,
				Anchor.START);
	}

	/**
	 * EVERY KIND OF THE RING UNDER THE FIGURES, in the ring's order and its colours. Owner,
	 * 15.11.2026: „Možda treba da stanu u 3 kolone i dva reda ukoliko se vidi svih 6 kategorija, ili
	 * 5, ako su 4 vidljive onda 2 x 2, kao i za 3, a kad su samo dve ili jedna vidljiva moze jedan red
	 * sa 1 ili 2 kategorije”. Each cell is the count over its word; the words of all cells shrink
	 * together, from 26 down to 18, until every cell fits its column.
	 */
	private static void kinds(Graphics2D pen, List<Slice> slices) {
		int columns = columnsFor(slices.size());
		double width = (double) COLUMN / Math.max(columns, 2);
		Font figure = BOLD.deriveFont(32f);
		int size = 26;

		while (size > 18 && !allFit(pen, slices, figure, REGULAR.deriveFont((float) size), width)) {
			size--;
		}

		for (int at = 0; at < slices.size(); at++) {
			Slice slice = slices.get(at);
			double x = LEFT + at % columns * width;
			double y = 418 + at / columns * 84.0;

			pen.setColor(KIND_COLOURS.get(slice.kind()));
			pen.fill(new Ellipse2D.Double(x, y - 20, 18, 18));
			line(pen, slice.figure(), x + 28, y, BOLD, 32, 32, TEXT, width - 38, Anchor.START);
			line(pen, slice.word(), x + 28, y + 32, REGULAR, size, size, MUTED, width - 38,
					Anchor.START);
		}
	}

	/** Five or six kinds in three columns, three or four in two, one or two in one row. */
	static int columnsFor(int kinds) {
		if (kinds >= 5) {
			return 3;
		}

		return kinds >= 3 ? 2 : kinds;
	}

	private static boolean allFit(Graphics2D pen, List<Slice> slices, Font figure, Font word,
			double width) {
		return slices.stream().allMatch(slice -> 28 + Math.max(
				widthOf(pen, printable(slice.figure()), figure),
				widthOf(pen, printable(slice.word()), word)) <= width - 10);
	}

	enum Anchor { START, MIDDLE, END }

	/**
	 * ONE LINE OF TEXT, SHRUNK UNTIL IT FITS AND CUT IF IT STILL DOES NOT, and how wide it came out.
	 *
	 * @param x the start of the line, its middle or its end, as the anchor says
	 * @param y the baseline
	 */
	static double line(Graphics2D pen, String text, double x, double y, Font font, int size, int min,
			Color colour, double max, Anchor anchor) {
		String shown = printable(text);
		int now = size;
		Font sized = font.deriveFont((float) now);

		while (now > min && widthOf(pen, shown, sized) > max) {
			now--;
			sized = font.deriveFont((float) now);
		}

		shown = within(pen, shown, sized, max);

		double width = widthOf(pen, shown, sized);
		double start = anchor == Anchor.START ? x : anchor == Anchor.MIDDLE ? x - width / 2 : x - width;

		pen.setFont(sized);
		pen.setColor(colour);

		if (!shown.isEmpty()) {
			pen.drawString(shown, (float) start, (float) y);
		}

		return width;
	}

	/**
	 * THE LONGEST BEGINNING OF A LINE THAT FITS WITH AN ELLIPSIS AFTER IT, or the whole line when it
	 * fits as it is. Found by halving, so a long line is measured a dozen times and not once per
	 * character.
	 */
	static String within(Graphics2D pen, String text, Font font, double max) {
		if (widthOf(pen, text, font) <= max) {
			return text;
		}

		int[] points = text.codePoints().toArray();
		int fits = 0;
		int fails = points.length;

		while (fails - fits > 1) {
			int middle = (fits + fails) / 2;

			if (widthOf(pen, cut(points, middle), font) <= max) {
				fits = middle;
			} else {
				fails = middle;
			}
		}

		return cut(points, fits);
	}

	private static String cut(int[] points, int count) {
		return new String(points, 0, count).strip() + ELLIPSIS;
	}

	private static double widthOf(Graphics2D pen, String text, Font font) {
		return font.getStringBounds(text, pen.getFontRenderContext()).getWidth();
	}

	/**
	 * WHAT OF A TEXT A MEMBER TYPED CAN BE DRAWN, and only that: no control or formatting character
	 * (the route is public and draws what anybody wrote into his name), nothing the font has no
	 * glyph for, every run of white space one space, and no more than {@value #AT_MOST_CODE_POINTS}
	 * characters, which is more than any column holds at the smallest size.
	 */
	static String printable(String text) {
		StringBuilder kept = new StringBuilder();

		text.codePoints().limit(AT_MOST_CODE_POINTS).forEach(point -> {
			if (Character.isWhitespace(point) || Character.isSpaceChar(point)) {
				kept.append(' ');
			} else if (drawable(point)) {
				kept.appendCodePoint(point);
			}
		});

		return kept.toString().replaceAll(" {2,}", " ").strip();
	}

	/*
	 * Of the five types refused here, FORMAT and PRIVATE_USE are what keeps out characters Roboto
	 * really draws (a soft hyphen, the marks that turn text round, U+F6C3; measured over every code
	 * point). CONTROL, SURROGATE and UNASSIGNED are today refused by `canDisplay` as well, since no
	 * face of this font has a glyph for any of them, and are named so that a font that does is still
	 * refused them.
	 */
	private static boolean drawable(int point) {
		return switch (Character.getType(point)) {
			case Character.CONTROL, Character.FORMAT, Character.SURROGATE, Character.PRIVATE_USE,
					Character.UNASSIGNED -> false;
			/* Both faces, and with `&` rather than `&&`: a glyph the regular face has and the bold one
			   lacks would be an empty box in the name. */
			default -> REGULAR.canDisplay(point) & BOLD.canDisplay(point);
		};
	}

	/**
	 * Written at {@link #QUALITY}, in memory and never through the platform's temporary files, which
	 * is {@code SmallPicture}'s way and its reason. The {@code IOException} that cannot happen into
	 * memory is declared rather than caught, as {@code IpsPicture} declares it: the caller draws this
	 * inside {@code SmallPictures}, which already answers whatever goes wrong while a picture is made.
	 */
	private static byte[] written(BufferedImage card) throws IOException {
		ImageWriter jpeg = ImageIO.getImageWritersByFormatName("jpeg").next();
		ImageWriteParam squeeze = jpeg.getDefaultWriteParam();
		squeeze.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
		squeeze.setCompressionQuality(QUALITY);

		ByteArrayOutputStream bytes = new ByteArrayOutputStream();

		try (ImageOutputStream out = new MemoryCacheImageOutputStream(bytes)) {
			jpeg.setOutput(out);
			jpeg.write(null, new IIOImage(card, null, null), squeeze);
		} finally {
			jpeg.dispose();
		}

		return bytes.toByteArray();
	}

	/**
	 * One of the two fonts, out of the files that ship with the portal.
	 *
	 * @throws IllegalStateException when the file is not there or is not a font, which is a portal
	 *                               built wrong and never anything a request did
	 */
	static Font fontAt(String resource) {
		try (InputStream in = CompetitorCard.class.getResourceAsStream(resource)) {
			if (in == null) {
				throw new IllegalStateException(resource + " is not on the class path");
			}

			return Font.createFont(Font.TRUETYPE_FONT, in);
		} catch (IOException | FontFormatException broken) {
			throw new IllegalStateException(resource + " is not a font this can read", broken);
		}
	}
}
