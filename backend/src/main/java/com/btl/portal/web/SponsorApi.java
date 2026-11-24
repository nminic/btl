package com.btl.portal.web;

import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.sponsor.SponsorOfTheDay;
import com.btl.portal.domain.sponsor.SponsorOfTheDay.InRotation;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * THE SPONSORS OF THE FRONT PAGE: THE ONE OF THE DAY, AND THE STRIP.
 *
 * <p>Owner, PDL 24.11.2026, „Strana za upravljanje sponzorima u Administraciji → Podaci → Sponzori”: the logo
 * „se automatski prikazuje kako treba i u boksu sa desne strane, i u donjoj liniji”. This is what both of those
 * read, and nothing else on the portal reads it: „Sponzori stoje samo na naslovnoj strani” (PDL, 17.11.2026),
 * and „Sponzor nema podstranu na portalu”, so a sponsor is a link to its own page and no address here names
 * one.
 *
 * <p><b>THE SPONSOR OF THE DAY IS WORKED OUT HERE AND NOT IN A BROWSER</b>, so it is the same for every visitor
 * on the same day: „„Sponzor dana” se smenjuje po danu, a glavni sponzor ide duplo češće od bilo kog drugog”.
 * The rule is {@link SponsorOfTheDay}; the day is the league's ({@link SeasonClock#ZONE}), not the server's,
 * so the box changes at midnight in Belgrade wherever the machine stands.
 *
 * <p><b>THE STRIP IS THE MAIN SPONSOR FIRST, THEN THE MANUAL ORDER</b>: „Redosled u traci: glavni sponzor
 * prvi, pa ručni redosled koji se podešava u administraciji.” The identity is the last word only where the
 * order is otherwise equal, which {@code sponsor_position_unique} (V111) says never happens.
 *
 * <p><b>A SPONSOR WITH NO LOGO STANDS IN NEITHER, and that is derived, not said.</b> [IZVEDENO 24.11.2026, my
 * reasoning and not a sentence of the owner's] The box draws the logo over the name and the strip is a row of
 * logos (PDL P24, 18.11.2026), and the owner asked for the logo to be shown „kako treba” in both; a sponsor
 * whose logo has not been sent yet would be an empty tile. It is entered first and its logo sent after, so
 * the state is real, and the administration sees it on its list.
 *
 * <p><b>THE DESCRIPTION IS IN THE READER'S LANGUAGE, AND IN SERBIAN WHERE NO ENGLISH IS WRITTEN</b>: „Opis ima
 * srpsku i englesku verziju; ako engleska nije upisana, engleska naslovna pokazuje srpsku.” The language
 * travels in the query as {@code lang}, for the reason {@link PageApi} gives (the edge keeps the two languages
 * as two addresses), and is matched against the shape of a tag and nothing finer, as there. Each sponsor says
 * which language its description is really in ({@code language}), so the page can mark Serbian words on the
 * English page as Serbian for a screen reader, which is the field {@link PageApi.Page} carries for the same
 * reason.
 *
 * <p><b>Nobody in either is not an error</b>: „kad nijedan sponzor nije u rotaciji, boksa nema i kalendar ide
 * do dna, kao danas” (the plan approved 24.11.2026). The answer is then {@code ofTheDay: null} and an empty
 * strip, and the front page is the page it has been since 20.11.2026.
 */
@RestController
class SponsorApi {

	/** The language the original is in, and the answer where no other is written. */
	static final String THE_ORIGINAL = "sr";

	/** The one other language a description may be written in (PDL 24.11.2026). */
	static final String ENGLISH = "en";

	private static final Pattern A_LANGUAGE_TAG = Pattern.compile("^[a-z]{2,3}$");

	private final JdbcClient db;

	private final Clock clock;

	SponsorApi(JdbcClient db, Clock clock) {
		this.db = db;
		this.clock = clock;
	}

	/**
	 * One sponsor as the front page draws it.
	 *
	 * @param id          the sponsor, for the key of a list and nothing a reader is shown
	 * @param name        the name, which is the link on the box and the name of the tile
	 * @param url         where both lead, in a new window; never written out („Domen sponzora se ne ispisuje")
	 * @param logo        the public address of the logo, the whole picture and never a cut
	 * @param description the two lines of the box, in {@code language}
	 * @param language    the language {@code description} is really written in, {@code sr} or {@code en}
	 */
	record Shown(long id, String name, String url, String logo, String description, String language) {
	}

	/**
	 * What the front page reads.
	 *
	 * @param ofTheDay the sponsor of the day, or null where nobody is in the rotation
	 * @param strip    the sponsors of the strip, the main one first and then the manual order
	 */
	record FrontPage(Shown ofTheDay, List<Shown> strip) {
	}

	private record Row(long id, String name, String url, String digest, String descriptionSr,
			String descriptionEn, boolean main, boolean inRotation, boolean inStrip) {
	}

	/**
	 * The sponsor of today and the strip.
	 *
	 * @param lang the reader's language; absent, the original. A value not shaped like a language tag is
	 *             refused with 400, as {@link PageApi} refuses it
	 */
	@GetMapping("/api/sponsors")
	ResponseEntity<FrontPage> sponsors(@RequestParam(name = "lang", required = false) String lang) {
		if (lang != null && !A_LANGUAGE_TAG.matcher(lang).matches()) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
		}

		boolean english = ENGLISH.equals(lang);
		List<Row> rows = db.sql("select s.id, s.name, s.url, p.digest, s.description_sr, s.description_en,"
						+ " s.main, s.in_rotation, s.in_strip from sponsor s join photo p on p.id = s.logo_id"
						+ " order by s.main desc, s.position, s.id")
				.query(Row.class).list();

		LocalDate today = clock.instant().atZone(SeasonClock.ZONE).toLocalDate();
		Optional<Long> ofTheDay = SponsorOfTheDay.on(rows.stream().filter(Row::inRotation)
				.map(one -> new InRotation(one.id(), one.main())).toList(), today);

		Shown shown = ofTheDay.flatMap(id -> rows.stream().filter(one -> one.id() == id).findFirst())
				.map(one -> shown(one, english)).orElse(null);
		List<Shown> strip = rows.stream().filter(Row::inStrip).map(one -> shown(one, english)).toList();

		return ResponseEntity.ok(new FrontPage(shown, strip));
	}

	private static Shown shown(Row row, boolean english) {
		boolean inEnglish = english && row.descriptionEn() != null;

		return new Shown(row.id(), row.name(), row.url(), "/api/photos/" + row.digest(),
				inEnglish ? row.descriptionEn() : row.descriptionSr(), inEnglish ? ENGLISH : THE_ORIGINAL);
	}
}
