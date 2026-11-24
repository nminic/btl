package com.btl.portal.web;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * THE ADMINISTRATION ENTERING, CHANGING, ORDERING AND DELETING THE SPONSORS.
 *
 * <p>Owner, PDL 24.11.2026, „Strana za upravljanje sponzorima u Administraciji → Podaci → Sponzori”: „Zelim
 * da mogu da u sekciji Administracija > Podaci odem na Sponzori, i da tu dodajem, menjam ili brisem sponzore.”
 *
 * <p><b>WHO MAY</b>: „Sponzore uređuje i moderator sa pravom (novo pravo „Sponzori”, kao ostala prava), ne samo
 * administrator.” So every door here asks {@code entity:sponsors} (V111), which the superadmin holds without a
 * tick; a moderator without it and a member are answered 404 like an address that is not there, and somebody
 * signed out is answered 401 by the chain before any of this (ADL A8). A sponsor that is not there is the same
 * 404, which is A8 applied to a row.
 *
 * <p><b>WHAT IS REFUSED, AND BY WHOSE SENTENCE</b>:
 * <ul>
 * <li>a name, a link or a Serbian description missing ({@link #THE_FORM_IS_NOT_COMPLETE});</li>
 * <li>a name over 80 characters ({@link #THE_NAME_IS_TOO_LONG}), which is {@code sponsor_name_shape} (V111)
 * said before the database says it as a 500. [IZVEDENO 24.11.2026, my reasoning] The owner set 80 for the
 * description; the name is drawn on the same box, and the price list holds its names to the same 80;</li>
 * <li>a link that is not {@code http://} or {@code https://} with no white space ({@link #THE_LINK_IS_NOT_A_LINK}),
 * since it is opened in a new window from the front page, and anything else there is an address a visitor's
 * browser would be asked to run;</li>
 * <li>a description, Serbian or English, over 80 characters ({@link #THE_DESCRIPTION_IS_TOO_LONG}) or written
 * in capitals only ({@link #THE_DESCRIPTION_IS_IN_CAPITALS}): „Ograničenje od 80 znakova i zabrana pisanja svim
 * velikim slovima (18.11.2026) važe za obe.”</li>
 * </ul>
 * The characters are counted as a reader counts them, one per letter whatever its encoding, which is what
 * {@code char_length} counts in V111's checks: „č” is one, as „c” is.
 *
 * <p><b>THE MAIN SPONSOR IS AT MOST ONE, AND MARKING A NEW ONE TAKES THE MARK OFF THE OLD IN THE SAME
 * WRITE</b>: „Glavni sponzor je najviše jedan.”, and the derivation told the owner with the plan he approved
 * on 24.11.2026, „označavanje novog glavnog sponzora skida oznaku sa prethodnog”. The index
 * {@code sponsor_main_is_one} is the floor under it; this class takes the mark off first, so the index is
 * never what answers.
 *
 * <p><b>EVERY WRITE TAKES THE TABLE'S OWN LOCK FIRST</b> ({@code share row exclusive}, which conflicts with
 * itself and with no reader). Two administrations marking two different main sponsors at the same moment
 * would otherwise each take the mark off a row the other has not written yet, and the second would meet the
 * index as a 500; two sponsors added at once would read the same last place. The table is a few rows and is
 * written by hand, so the cost is nothing anybody can wait on.
 *
 * <p><b>THE ORDER IS MOVED ONE PLACE AT A TIME, AMONG THE SPONSORS THAT ARE NOT MAIN</b>: the strip draws the
 * main one first whatever its place, so the place of the main one is not something a press of „up” could be
 * seen to change. A move swaps the place with the neighbour's, which {@code sponsor_position_unique} lets
 * happen in one transaction because it is deferred. Moving the first one up or the last one down changes
 * nothing and is not an error: the list is then as it was asked to be.
 *
 * <p><b>DELETING A SPONSOR DELETES ITS LOGO</b> (the plan approved 24.11.2026, „brisanje sponzora briše i
 * njegov logo"): the {@code photo} row goes at the end of the transaction by V111's trigger, and its file with
 * the sweep ({@code ThePicturesFolderIsSwept}), as every picture of the portal does.
 */
@RestController
class SponsorWriteApi {

	static final String THE_FORM_IS_NOT_COMPLETE = "theFormIsNotComplete";

	static final String THE_NAME_IS_TOO_LONG = "theNameIsTooLong";

	static final String THE_LINK_IS_NOT_A_LINK = "theLinkIsNotALink";

	static final String THE_DESCRIPTION_IS_TOO_LONG = "theDescriptionIsTooLong";

	static final String THE_DESCRIPTION_IS_IN_CAPITALS = "theDescriptionIsInCapitals";

	/** The ceiling the owner set on the description (PDL, 18.11.2026), and the one the name is held to. */
	static final int AT_MOST = 80;

	/** The ceiling on a link, which nobody types and V111 holds as a floor. */
	static final int A_LINK_AT_MOST = 2000;

	private static final Pattern A_LINK = Pattern.compile("^https?://\\S+$");

	private final JdbcClient db;

	SponsorWriteApi(JdbcClient db) {
		this.db = db;
	}

	/**
	 * What a sponsor is entered as. Every field may be missing from the request; a missing box is not
	 * ticked, a missing English description is none.
	 */
	record Upsert(String name, String url, String descriptionSr, String descriptionEn, Boolean main,
			Boolean inRotation, Boolean inStrip) {
	}

	/**
	 * One sponsor as the administration's list draws it.
	 *
	 * @param logo the public address of the logo, or null where none has been sent
	 */
	record Entered(long id, String name, String url, String descriptionSr, String descriptionEn, boolean main,
			boolean inRotation, boolean inStrip, int position, String logo) {
	}

	record Written(long id) {
	}

	record Refused(String reason) {
	}

	private record Row(long id, String name, String url, String descriptionSr, String descriptionEn, boolean main,
			boolean inRotation, boolean inStrip, int position, String digest) {
	}

	/** Every sponsor, in the order of the strip: the main one first, then the manual order. */
	@GetMapping("/api/sponsors/all")
	@RightIsNeeded("entity:sponsors")
	List<Entered> all() {
		return db.sql("select s.id, s.name, s.url, s.description_sr, s.description_en, s.main, s.in_rotation,"
						+ " s.in_strip, s.position, p.digest from sponsor s left join photo p on p.id = s.logo_id"
						+ " order by s.main desc, s.position, s.id")
				.query(Row.class).list().stream()
				.map(one -> new Entered(one.id(), one.name(), one.url(), one.descriptionSr(), one.descriptionEn(),
						one.main(), one.inRotation(), one.inStrip(), one.position(),
						one.digest() == null ? null : "/api/photos/" + one.digest()))
				.toList();
	}

	/** A new sponsor, at the end of the manual order. */
	@PostMapping("/api/sponsors")
	@RightIsNeeded("entity:sponsors")
	@Transactional
	ResponseEntity<?> add(@RequestBody Upsert typed) {
		String wrong = whatIsWrongWith(typed);

		if (wrong != null) {
			return no(wrong);
		}

		lock();

		boolean main = Boolean.TRUE.equals(typed.main());

		if (main) {
			db.sql("update sponsor set main = false where main").update();
		}

		long id = db.sql("insert into sponsor (name, url, description_sr, description_en, main, in_rotation,"
						+ " in_strip, position) values (?, ?, ?, ?, ?, ?, ?,"
						+ " (select coalesce(max(position) + 1, 0) from sponsor)) returning id")
				.params(typed.name().strip(), typed.url().strip(), typed.descriptionSr().strip(),
						englishOf(typed), main, Boolean.TRUE.equals(typed.inRotation()),
						Boolean.TRUE.equals(typed.inStrip()))
				.query(Long.class).single();

		return ResponseEntity.status(HttpStatus.CREATED).body(new Written(id));
	}

	/** A sponsor changed. Its place in the order and its logo are not on the form and stay as they were. */
	@PutMapping("/api/sponsors/{id}")
	@RightIsNeeded("entity:sponsors")
	@Transactional
	ResponseEntity<?> change(@PathVariable long id, @RequestBody Upsert typed, HttpServletResponse response)
			throws IOException {
		String wrong = whatIsWrongWith(typed);

		if (wrong != null) {
			return no(wrong);
		}

		lock();

		boolean main = Boolean.TRUE.equals(typed.main());

		if (main) {
			db.sql("update sponsor set main = false where main and id <> ?").param(id).update();
		}

		int changed = db.sql("update sponsor set name = ?, url = ?, description_sr = ?, description_en = ?,"
						+ " main = ?, in_rotation = ?, in_strip = ? where id = ?")
				.params(typed.name().strip(), typed.url().strip(), typed.descriptionSr().strip(),
						englishOf(typed), main, Boolean.TRUE.equals(typed.inRotation()),
						Boolean.TRUE.equals(typed.inStrip()), id)
				.update();

		if (changed == 0) {
			return away(response);
		}

		return ResponseEntity.ok(new Written(id));
	}

	/** A sponsor deleted, and with it its logo. */
	@DeleteMapping("/api/sponsors/{id}")
	@RightIsNeeded("entity:sponsors")
	@Transactional
	ResponseEntity<?> remove(@PathVariable long id, HttpServletResponse response) throws IOException {
		lock();

		int gone = db.sql("delete from sponsor where id = ?").param(id).update();

		return gone == 0 ? away(response) : ResponseEntity.noContent().build();
	}

	/** One place earlier in the manual order. */
	@PostMapping("/api/sponsors/{id}/up")
	@RightIsNeeded("entity:sponsors")
	@Transactional
	ResponseEntity<?> up(@PathVariable long id, HttpServletResponse response) throws IOException {
		return move(id, true, response);
	}

	/** One place later in the manual order. */
	@PostMapping("/api/sponsors/{id}/down")
	@RightIsNeeded("entity:sponsors")
	@Transactional
	ResponseEntity<?> down(@PathVariable long id, HttpServletResponse response) throws IOException {
		return move(id, false, response);
	}

	private record Place(int position, boolean main) {
	}

	private ResponseEntity<?> move(long id, boolean earlier, HttpServletResponse response) throws IOException {
		lock();

		Optional<Place> place = db.sql("select position, main from sponsor where id = ?").param(id)
				.query(Place.class).optional();

		if (place.isEmpty()) {
			return away(response);
		}

		if (place.get().main()) {
			return ResponseEntity.noContent().build();
		}

		Optional<Long> neighbour = db.sql(earlier
						? "select id from sponsor where not main and position < ? order by position desc limit 1"
						: "select id from sponsor where not main and position > ? order by position limit 1")
				.param(place.get().position()).query(Long.class).optional();

		neighbour.ifPresent(other -> db.sql("update sponsor set position = case id"
						+ " when ? then (select position from sponsor where id = ?)"
						+ " when ? then (select position from sponsor where id = ?) end where id in (?, ?)")
				.params(id, other, other, id, id, other).update());

		return ResponseEntity.noContent().build();
	}

	/**
	 * What is wrong with what was sent, as the refusal that names it, or null where nothing is.
	 */
	static String whatIsWrongWith(Upsert typed) {
		if (blank(typed.name()) || blank(typed.url()) || blank(typed.descriptionSr())) {
			return THE_FORM_IS_NOT_COMPLETE;
		}

		if (length(typed.name().strip()) > AT_MOST) {
			return THE_NAME_IS_TOO_LONG;
		}

		String url = typed.url().strip();

		if (!A_LINK.matcher(url).matches() || url.length() > A_LINK_AT_MOST) {
			return THE_LINK_IS_NOT_A_LINK;
		}

		for (String description : new String[] {typed.descriptionSr(), englishOf(typed)}) {
			if (description == null) {
				continue;
			}

			if (length(description.strip()) > AT_MOST) {
				return THE_DESCRIPTION_IS_TOO_LONG;
			}

			if (inCapitalsOnly(description)) {
				return THE_DESCRIPTION_IS_IN_CAPITALS;
			}
		}

		return null;
	}

	/**
	 * WHETHER A TEXT IS WRITTEN IN CAPITALS ONLY: it holds at least one letter that has a small form, and none
	 * of its letters is small. So „VOLT za duge treninge” is not, „ENERGETSKO PIĆE” is, and „3 x 10 km” is not,
	 * because a text with no such letter at all is not written in capitals. Asked of each letter by Java, which
	 * knows „Č” and „č” on every machine; the database is not asked, for the reason V111 gives.
	 */
	static boolean inCapitalsOnly(String text) {
		boolean capital = false;

		for (int at = 0; at < text.length(); at = text.offsetByCodePoints(at, 1)) {
			int letter = text.codePointAt(at);

			if (Character.isLowerCase(letter)) {
				return false;
			}

			if (Character.isUpperCase(letter) || Character.isTitleCase(letter)) {
				capital = true;
			}
		}

		return capital;
	}

	/** The English description as it is stored: none where nothing but white space was sent. */
	private static String englishOf(Upsert typed) {
		return blank(typed.descriptionEn()) ? null : typed.descriptionEn().strip();
	}

	private static boolean blank(String text) {
		return text == null || text.isBlank();
	}

	private static int length(String text) {
		return text.codePointCount(0, text.length());
	}

	private void lock() {
		db.sql("lock table sponsor in share row exclusive mode").update();
	}

	static ResponseEntity<?> away(HttpServletResponse response) throws IOException {
		response.sendError(HttpStatus.NOT_FOUND.value());
		return null;
	}

	private static ResponseEntity<?> no(String reason) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new Refused(reason));
	}
}
