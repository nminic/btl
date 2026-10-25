package com.btl.portal.web;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

/**
 * EVERYTHING THE REGISTRATION ASKED OF A MEMBER, BAR THE PASSWORD, FOR THE ADMINISTRATION OVER THE
 * MEMBERS TO CORRECT.
 *
 * <p>Owner, 22.10.2026 (PDL, „Red člana, kartica Podaci i strana Podešavanja"): „Dugme Edit otvara
 * popunjenu formu sa svim podacima kao registracionu, samo bez lozinke. Tu admini i moderatori imaju
 * pravo da izmene sve podatke takmičara." And, chosen between offered outcomes with the
 * recommendation: „Tuđe podatke otvara i menja samo moderator sa pravom nad članovima, i admin." So
 * this is read under {@link CompetitorApi#OVER_THE_MEMBERS}, the box that already opens the screen
 * of the members, and anybody else signed in is answered 404 (ADL A8) by the door, before this class
 * runs.
 *
 * <p><b>WHAT IS LEFT OUT OF „SVI PODACI", AND WHY.</b> The password, by the owner's own words. The
 * statement of health and the parent's consent, because each is a record that something was given at
 * one moment and not a fact about the member: V8 keeps the consent as evidence (PDL, „Uz roditeljski
 * potpis čuvaju se potpis, relacija, datum i vreme, i IP adresa"), and evidence that could be edited
 * would no longer be evidence. And the choice of the beginners' category, which has a screen and a
 * route of its own ({@link MeCategoryWriteApi}) and rules about when it may move. The last three are
 * the assistant's reasoning, told to the owner's side as such on 22.10.2026; not his words.
 *
 * <p><b>THE DOCUMENT NUMBER AND THE FATHER'S NAME ARE HERE, AND ONLY HERE.</b> PDL P32, 20.08.2026:
 * „Broj ličnog dokumenta i ime oca se ne prikazuju nigde, ni na profilu, ni u tabelama, ni
 * administratoru van ekrana članova." The card this route fills is where the button on the screen of
 * the members leads, so it counts as that screen (derived, not the owner's word, 22.10.2026). The
 * number is read out of {@code competitor_document}, the table of its own that ADL A12 keeps it in,
 * and it is null for a member who never gave one: under sixteen it is asked and not required.
 *
 * <p><b>A MEMBER WHOSE FEE HAS LAPSED IS ANSWERED TOO</b>, because the screen of the members shows
 * him under „Neaktivni" and the button stands on his row as on any other. Anybody ever given a
 * number is somebody this route can answer about; a person who registered and was never given one
 * has no address here at all, which is the same boundary {@link MembersApi} draws.
 *
 * <p><b>THE ADDRESS OF POST IS THE ACCOUNT'S</b>, with whether it was confirmed beside it, because
 * the administration may correct it only while it is not (PDL, M7, 10.10.2026: „adresu pošte
 * administracija menja samo dok nije potvrđena"). A member with no account at all - one entered by
 * the league before he took one over, or one older than the portal - has neither, and both are null.
 */
@RestController
class MemberDataApi {

	private final JdbcClient db;

	MemberDataApi(JdbcClient db) {
		this.db = db;
	}

	/**
	 * What a member's data are, as the form draws them again.
	 *
	 * @param birthDate      ISO, {@code 1990-05-15}, which is what the form's date box sends back
	 * @param idNumber       null where none was given
	 * @param email          null where he has no account
	 * @param emailConfirmed null where he has no account
	 * @param phone          null where he has none
	 * @param placeId        the {@code geonames_id} of his town where it came out of the codebook,
	 *                       and null where he typed one - never {@code place.id}, which is this
	 *                       database's key and means nothing to a caller ({@link MeWriteApi.Changed}
	 *                       answers it the same way)
	 * @param city           the NAME of his town, whichever road it came by: the codebook's name, or
	 *                       the one typed. Since 23.10.2026, because the card „Podaci" opens the form
	 *                       of the registration, whose town is a name and a country, with what stands
	 *                       (`GET /api/me` has answered it this way all along). Until then it was the
	 *                       typed town only, and a town of the codebook opened an empty box
	 * @param country        the code of that town's country, whichever road it came by
	 */
	record Data(String memberNumber, String firstName, String lastName, String fatherName, String gender,
			String birthDate, String idNumber, String email, Boolean emailConfirmed, String address,
			String phone, Long placeId, String city, String country, String shirtSize) {
	}

	@GetMapping("/api/members/{memberNumber}/data")
	@RightIsNeeded(CompetitorApi.OVER_THE_MEMBERS)
	ResponseEntity<Data> read(@PathVariable String memberNumber) {
		return db.sql("select id from competitor where member_number = ?")
				.param(memberNumber).query(Long.class).optional()
				.flatMap(this::of)
				.map(ResponseEntity::ok)
				.orElseGet(() -> ResponseEntity.notFound().build());
	}

	/**
	 * The data of one member by his key, read in one statement. Package-private because
	 * {@link MemberDataWriteApi} answers with the same record after it has written, and reads what
	 * stood before it wrote through the same statement, so the two answers cannot be drawn
	 * differently.
	 */
	Optional<Data> of(long competitor) {
		return db.sql("select c.member_number, c.first_name, c.last_name, c.father_name, c.gender,"
						+ " c.birth_date::text, d.document_number, a.email,"
						+ " case when a.id is null then null else a.email_confirmed_at is not null end,"
						+ " c.address, c.phone, p.geonames_id, coalesce(p.name, c.city),"
						+ " coalesce(pk.code, k.code), c.shirt_size"
						+ " from competitor c"
						+ " left join competitor_document d on d.competitor_id = c.id"
						+ " left join account a on a.competitor_id = c.id"
						+ " left join place p on p.id = c.place_id"
						+ " left join country k on k.id = c.country_id"
						+ " left join country pk on pk.id = p.country_id"
						+ " where c.id = ?")
				.param(competitor)
				.query((row, i) -> new Data(row.getString(1), row.getString(2), row.getString(3),
						row.getString(4), row.getString(5), row.getString(6), row.getString(7),
						row.getString(8), (Boolean) row.getObject(9), row.getString(10), row.getString(11),
						(Long) row.getObject(12), row.getString(13), row.getString(14), row.getString(15)))
				.optional();
	}
}
