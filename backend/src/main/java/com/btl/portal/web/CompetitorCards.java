package com.btl.portal.web;

import com.btl.portal.domain.card.CompetitorCard;
import com.btl.portal.domain.card.WhatACardSays;
import com.btl.portal.domain.photo.SmallPicture;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.Clock;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * THE CARD OF A PROFILE AS IT STANDS NOW: what it shows, the address it is asked for at, and the
 * picture.
 *
 * <p>Owner, PDL P11, 15.11.2026: „kad god takmicar podelio link bude povuceno aktuelno stanje”. So
 * every answer is worked out from the portal as it is at that moment, and the address carries a
 * short digest of what the card shows ({@link #fingerprintOf}): the day the card changes, the
 * address changes, and a network that keeps pictures by address asks for the new one. The route
 * draws the CURRENT card for every address of the right shape, so an old address still answers,
 * with what is true today.
 *
 * <p><b>WHO MAY SEE WHAT IS NOT WRITTEN HERE, AND THAT IS THE POINT OF HOW IT IS READ.</b> The card
 * is a picture anybody may be handed, so it is drawn from what the portal answers a VISITOR, read
 * through the very method that answers him ({@link CompetitorApi#competitors} with no member). What
 * that keeps from a visitor the card never has: a member whose fee has lapsed, a deleted one and a
 * number nobody holds are not on that list at all; a picture that waits for a moderator is not on
 * it either (PDL, 27.09.2026, „Slika koja čeka se na profilu ne vidi dok nije odobrena”), because
 * the list joins only the portrait that was approved. The one thing added here is what the profile
 * page already does with the same record: a hidden profile is a page a visitor cannot reach (PDL,
 * 06.09.2026, „Skrivanje profila znači da se do profilne strane ne može doći"), so its card is not
 * there either, and it is not there in exactly the way a number nobody holds is not (PDL,
 * 06.09.2026, confirmed 03.10.2026: „Oba slučaja dobijaju isti ishod").
 *
 * <p><b>It is read as a visitor for every caller, the member himself included.</b> What the card
 * shows is what anybody the link reaches will see, and a card drawn for a signed-in reader would
 * be kept in memory under an address anybody may ask for.
 *
 * <p><b>The figures count every race</b> (owner, 15.11.2026: „Trke, km, broje se SVE trke, ne samo
 * bodovane. Bez trećeg broja”), the scored ones and the unscored ones, and over every year (owner:
 * „Uvek ukupno?”). They are counted here over the same two views and the same condition the two
 * public routes serve results by ({@link ResultApi}, {@code scored_race}, {@code unscored_race},
 * {@link ResultApi#aRunIsServed}), and {@code CompetitorCardApiTest} holds that they equal what
 * those two routes answer for him. The profile's own figures still count the scored races alone
 * (PDL, 14.11.2026), and nothing here touches them.
 */
@Component
class CompetitorCards {

	private static final Logger LOG = LoggerFactory.getLogger(CompetitorCards.class);

	/**
	 * WHERE A CARD IS ASKED FOR. One name and not two segments, because the floor over names that
	 * are open to anybody ({@code ApiSecurityTest.noOpenNameOpensAnythingBesideIt}) respells the
	 * segment in front of the name and needs it to be a word: {@code competitor} is that word.
	 */
	static final String ASKED_AT = "/api/cards/competitor/{card}.jpg";

	/** What stands before the name. */
	private static final String THE_FOLDER = "/api/cards/competitor/";

	/**
	 * THE NAME OF A CARD: the member number, the language and the version of the drawing, and
	 * sixteen hexadecimal characters of the digest of what the card shows, for instance
	 * {@code 000001-sr1-0f3a9c2b7d4e6a18}. The language is part of the name because the words are,
	 * and a card in English is another picture.
	 */
	private static final Pattern A_NAME =
			Pattern.compile("^([0-9]{6})-(sr|en)([1-9][0-9]{0,3})-([0-9a-f]{16})$");

	/** How many hexadecimal characters of the digest the name carries. */
	private static final int SHORT = 16;

	private final CompetitorApi competitors;
	private final JdbcClient db;
	private final Clock clock;
	private final Path folder;
	private final SmallPictures drawn;

	/**
	 * @param keptBytes how much memory the cards already drawn may hold; the oldest asked for goes
	 *                  first ({@link SmallPictures}, which keeps the small portraits in exactly the
	 *                  same way and is used here as a second, separate instance)
	 * @param waitMillis how long a request waits for a card being drawn, or for its turn to draw
	 *                   one, before it is answered „not now"
	 */
	@Autowired
	CompetitorCards(CompetitorApi competitors, JdbcClient db, Clock clock,
			@Value("${btl.photos.folder}") String folder,
			@Value("${btl.cards.kept-bytes:16777216}") long keptBytes,
			@Value("${btl.cards.wait-millis:3000}") long waitMillis) {
		this(competitors, db, clock, Path.of(folder), new SmallPictures(keptBytes, waitMillis));
	}

	/** With the cards already drawn handed in, which is how a case holds one of them in the middle. */
	CompetitorCards(CompetitorApi competitors, JdbcClient db, Clock clock, Path folder,
			SmallPictures drawn) {
		this.competitors = competitors;
		this.db = db;
		this.clock = clock;
		this.folder = folder;
		this.drawn = drawn;
	}

	/** What a request for a card comes to. */
	sealed interface Answer {
	}

	/** Nothing is here: a name of the wrong shape, or a member whose card a visitor may not see. */
	record NothingIsHere() implements Answer {
	}

	/** The card is being drawn for somebody else and this request waited its whole term. */
	record NotNow() implements Answer {
	}

	record Drawn(byte[] jpeg) implements Answer {
	}

	/**
	 * THE ADDRESS OF HIS CARD AS IT STANDS NOW, or nothing when a visitor may not see it. This is
	 * what a page that shares the profile puts in its preview, and what makes a changed card a new
	 * address.
	 */
	Optional<String> addressOf(String memberNumber, WhatACardSays language) {
		return shown(memberNumber, language).map(Shown::address);
	}

	/**
	 * WHAT HIS CARD SHOWS AND THE ADDRESS IT IS ASKED FOR AT, worked out from one reading of the
	 * portal, or nothing when a visitor may not see it. The preview of a shared profile names both
	 * ({@link CompetitorPreviewApi}), and asked for the two separately it would read the list of
	 * members and count his runs twice for every profile anybody opens.
	 */
	Optional<Shown> shown(String memberNumber, WhatACardSays language) {
		return faceOf(memberNumber, language).map(face -> new Shown(face.card(),
				THE_FOLDER + nameOf(memberNumber, language, face) + ".jpg"));
	}

	/** What a card shows, and the address of the picture of it. */
	record Shown(CompetitorCard.Face face, String address) {
	}

	/** The name of his card as it stands now, which is the address without its folder and type. */
	Optional<String> fingerprintOf(String memberNumber, WhatACardSays language) {
		return faceOf(memberNumber, language).map(face -> nameOf(memberNumber, language, face));
	}

	/** What his card shows as it stands now, word for word, or nothing when a visitor may not see it. */
	Optional<CompetitorCard.Face> faceShown(String memberNumber, WhatACardSays language) {
		return faceOf(memberNumber, language).map(Face::card);
	}

	/**
	 * THE CARD FOR A NAME, DRAWN AS IT STANDS NOW. Only the member number and the language are read
	 * off the name; the digest in it only has to be of the right shape.
	 */
	Answer card(String name) {
		Matcher spelt = A_NAME.matcher(name);

		if (!spelt.matches()) {
			return new NothingIsHere();
		}

		WhatACardSays language = WhatACardSays.of(spelt.group(2)).orElseThrow();
		Optional<Face> face = faceOf(spelt.group(1), language);

		if (face.isEmpty()) {
			return new NothingIsHere();
		}

		SmallPictures.Answer answer = drawn.of(new SmallPictures.Key(face.get().card().digest(), "card"),
				() -> Optional.of(new SmallPicture.Cut(
						CompetitorCard.jpeg(face.get().card(), portraitOf(face.get().portrait())),
						"image/jpeg")));

		if (answer.busy()) {
			return new NotNow();
		}

		return answer.cut().<Answer>map(cut -> new Drawn(cut.bytes())).orElseGet(NothingIsHere::new);
	}

	private static String nameOf(String memberNumber, WhatACardSays language, Face face) {
		return memberNumber + "-" + language.code() + CompetitorCard.DESIGN + "-"
				+ face.card().digest().substring(0, SHORT);
	}

	/** The portrait the card is drawn with: which row it is, what it is, and his square of it. */
	private record Portrait(long id, String mediaType, CompetitorApi.Crop crop) {
	}

	/** What is drawn, and the portrait it is drawn with, which the face names but does not hold. */
	private record Face(CompetitorCard.Face card, Portrait portrait) {
	}

	/** How many runs of one kind, and how far they went together. */
	private record Runs(long count, BigDecimal kilometres) {
	}

	/**
	 * THE CARD OF A MEMBER AS A VISITOR WOULD BE SHOWN IT, or nothing.
	 */
	private Optional<Face> faceOf(String memberNumber, WhatACardSays language) {
		return competitors.competitors(null).stream()
				.filter(one -> memberNumber.equals(one.memberNumber()))
				.filter(one -> !one.profileHidden())
				.findFirst()
				.map(his -> faceOf(his, language));
	}

	private Face faceOf(CompetitorApi.Competitor his, WhatACardSays language) {
		Map<String, Runs> runs = runsOf(his.memberNumber());
		List<CompetitorCard.Slice> slices = new ArrayList<>();
		long races = 0;
		BigDecimal kilometres = BigDecimal.ZERO;

		for (String kind : WhatACardSays.KINDS) {
			Runs these = runs.getOrDefault(kind, new Runs(0, BigDecimal.ZERO));

			/* A kind with no race has no slice and no cell (owner, 15.11.2026). */
			if (these.count() > 0) {
				slices.add(new CompetitorCard.Slice(kind, these.count(), language.count(these.count()),
						language.kindWord(kind, these.count())));
			}

			races += these.count();
			kilometres = kilometres.add(these.kilometres());
		}

		Portrait portrait = portraitIn(his);

		return new Face(new CompetitorCard.Face(his.memberNumber(),
				his.firstName() + " " + his.lastName(),
				underTheName(his, language),
				CompetitorCard.initials(his.firstName(), his.lastName()),
				language.count(races), language.racesWord(races),
				language.kilometres(kilometres), WhatACardSays.KILOMETRES,
				language.firstRaceYetToCome(), slices, WhatACardSays.ADDRESS,
				portrait == null ? null
						: his.photo() + " " + portrait.crop().x().toPlainString() + " "
								+ portrait.crop().y().toPlainString() + " "
								+ portrait.crop().size().toPlainString()),
				portrait);
	}

	/**
	 * THE CATEGORY AND THE TEAM, as the line under the name of a profile names them, and only what
	 * there is: no team is nothing at all (owner, 15.11.2026: „ako nema tima kojem trkač pripada,
	 * ne ispisuje se ništa, a ne "nema tim"”), and no category on the card (a member who holds his
	 * season without the right to rank, PDL, 30.10.2026) is nothing either.
	 */
	private String underTheName(CompetitorApi.Competitor his, WhatACardSays language) {
		List<String> parts = new ArrayList<>();

		if (his.category() != null) {
			parts.add(language.category(his.gender(), his.category().ageBand(),
					his.category().beginner()));
		}

		if (his.teamId() != null) {
			parts.add(db.sql("select name from team where id = ?").param(his.teamId())
					.query(String.class).single());
		}

		return String.join(" · ", parts);
	}

	/**
	 * EVERY RUN OF HIS THE PUBLIC ROUTES SERVE, BY KIND: the scored ones by their length and the
	 * unscored ones as one kind of their own, which is how the ring of his profile counts them.
	 */
	private Map<String, Runs> runsOf(String memberNumber) {
		ZonedDateTime now = ZonedDateTime.now(clock);
		Map<String, Runs> runs = new HashMap<>();
		String served = " from result r join competitor c on c.id = r.competitor_id"
				+ " join %s s on s.id = r.race_id"
				+ " where c.member_number = :number and " + ResultApi.aRunIsServed("c.id", "r.race_date", now);

		db.sql("select r.category, count(*), sum(r.distance_km)" + served.formatted("scored_race")
						+ " group by r.category")
				.param("number", memberNumber)
				.query(row -> {
					runs.put(row.getString(1), new Runs(row.getLong(2), row.getBigDecimal(3)));
				});

		db.sql("select count(*), coalesce(sum(r.distance_km), 0)" + served.formatted("unscored_race"))
				.param("number", memberNumber)
				.query(row -> {
					runs.put("unscored", new Runs(row.getLong(1), row.getBigDecimal(2)));
				});

		return runs;
	}

	/**
	 * THE ROW OF THE PORTRAIT THE PUBLIC ANSWER NAMED, or none. The answer gives the digest and the
	 * square; the row is asked by that digest AND by being his approved portrait, so nothing but
	 * the picture the visitor was answered can be read here.
	 */
	private Portrait portraitIn(CompetitorApi.Competitor his) {
		if (his.photo() == null) {
			return null;
		}

		String digest = his.photo().substring(his.photo().lastIndexOf('/') + 1);

		return db.sql("select p.id, p.media_type from photo p join competitor c on c.photo_id = p.id"
						+ " where c.member_number = ? and p.digest = ?")
				.params(his.memberNumber(), digest)
				.query((row, one) -> new Portrait(row.getLong(1), row.getString(2), his.crop()))
				.single();
	}

	/**
	 * HIS SQUARE AT THE SIDE OF THE CIRCLE, or the initials when there is none or it cannot be read.
	 * A file that is gone or a picture larger than the portal decodes is drawn as a member with no
	 * portrait rather than as no card at all, because the rest of the card is still true.
	 */
	private BufferedImage portraitOf(Portrait portrait) {
		if (portrait == null) {
			return null;
		}

		try {
			return SmallPicture.square(PhotoApi.bytesOf(folder.resolve(String.valueOf(portrait.id()))),
					portrait.mediaType(), portrait.crop().x(), portrait.crop().y(), portrait.crop().size(),
					CompetitorCard.PORTRAIT);
		} catch (IOException cannot) {
			LOG.warn("the portrait {} of a card could not be read under {}: {}", portrait.id(), folder,
					cannot.toString());
			return null;
		}
	}
}
