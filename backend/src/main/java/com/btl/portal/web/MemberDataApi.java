package com.btl.portal.web;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;
import java.util.regex.Pattern;

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
 * number is somebody this route can answer about. A person who registered and was never given one
 * is not on {@link MembersApi} at all, and had no address here until 10.11.2026; since then he has
 * one of his own, {@link #UNNUMBERED}, by the key the screen Uplate lists him under (see
 * {@link #readUnnumbered}).
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
			String phone, Long placeId, String city, String country, String shirtSize, String bio, String photo,
			MePhotoApi.Crop crop) {
	}

	@GetMapping("/api/members/{memberNumber}/data")
	@RightIsNeeded(CompetitorApi.OVER_THE_MEMBERS)
	ResponseEntity<Data> read(@PathVariable String memberNumber) {
		return answered(numbered(memberNumber));
	}

	/**
	 * THE SAME DATA OF SOMEBODY WHO REGISTERED AND HAS NO MEMBER NUMBER, by the key the screen Uplate
	 * already holds for him.
	 *
	 * <p>Owner, 10.11.2026 (PDL, „Ekran Uplate: izmena podataka pre knjiženja i čišćenje reda"), asked
	 * whether the data of somebody newly registered can be edited BEFORE his fee is booked: „Može na
	 * uplatama. [...] Dodaj ikonicu olovkice kao na redu članova". And, chosen with the recommendation,
	 * „Podatke člana bez članskog broja menjaju isti kao danas: admin i moderator sa pravom nad
	 * članovima" - so this is read under {@link CompetitorApi#OVER_THE_MEMBERS} exactly as the address
	 * above is, and a moderator who holds only the payments is answered 404 (ADL A8) although the screen
	 * he works on lists the man.
	 *
	 * <p><b>WHY THE KEY IS {@code competitor.id}, and why that gives nothing away.</b> Such a man has no
	 * member number, which is the whole reason he had no address here. The only other thing that names
	 * him is his address of post, and that is personal data, which never goes into an address (the
	 * portal's own rule for queries and paths alike). {@code competitor.id} is the key {@link
	 * PaymentsDueApi} already serves on every row of that screen, because {@code POST /api/payments}
	 * takes nothing else - so the screen that leads here holds it already, and a reader of this route
	 * learns no key he did not have.
	 *
	 * <p><b>WHOM IT ANSWERS, and both halves are a boundary.</b> Somebody with an ACCOUNT, because the
	 * list on Uplate is exactly whoever signed himself up and the imported history is not a list of
	 * people („NIKO SE NE DOVODI U PORTAL DOK SE SAM NE PRIJAVI", owner, 27.09.2026). And somebody with
	 * NO member number, because a member who has one has his address already, above, and a second one
	 * would be two homes for one record. A number given while the form is open (his fee is booked in
	 * between) therefore makes this address answer 404, and the form then says it could not save, which
	 * is the truth: he is now at the other address.
	 */
	@GetMapping(UNNUMBERED)
	@RightIsNeeded(CompetitorApi.OVER_THE_MEMBERS)
	ResponseEntity<Data> readUnnumbered(@PathVariable String competitorId) {
		return answered(unnumbered(competitorId));
	}

	/** The address of the data of somebody with no member number (see {@link #readUnnumbered}). */
	static final String UNNUMBERED = "/api/members/unnumbered/{competitorId}/data";

	private ResponseEntity<Data> answered(Optional<Long> member) {
		return member.flatMap(this::of)
				.map(ResponseEntity::ok)
				.orElseGet(() -> ResponseEntity.notFound().build());
	}

	/** The member holding this number, or nobody. Package-private: {@link MemberDataWriteApi} asks it. */
	Optional<Long> numbered(String memberNumber) {
		return db.sql("select id from competitor where member_number = ?")
				.param(memberNumber).query(Long.class).optional();
	}

	/**
	 * The registrant with no member number this key names, or nobody: a key that is not the plain
	 * decimal spelling of a key ({@code 007}, {@code 7a}, a number past what a key can hold) names
	 * nobody rather than being refused as a malformed request, so it is the same 404 a key nobody has
	 * gets. Package-private: {@link MemberDataWriteApi} asks it.
	 */
	Optional<Long> unnumbered(String competitorId) {
		if (!A_KEY.matcher(competitorId).matches()) {
			return Optional.empty();
		}

		return db.sql("select c.id from competitor c"
						+ " where c.id = ? and c.member_number is null"
						+ " and exists (select 1 from account a where a.competitor_id = c.id)")
				.param(Long.parseLong(competitorId)).query(Long.class).optional();
	}

	/** A key as the database writes one: no leading zero, and short enough to be a {@code bigint}. */
	private static final Pattern A_KEY = Pattern.compile("[1-9][0-9]{0,17}");

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
						+ " coalesce(pk.code, k.code), c.shirt_size,"
						/* HIS WORDS AND HIS PICTURE AS THEY STAND, in the shape the public list gives them
						   (`CompetitorApi`): the address of the picture and its circle, both null for a member
						   with none. Here for the administration's boxes on a card the public list does not
						   carry (owner, 06.11.2026, PDL „Boksovi „Profilna slika" i „Tekst o sebi" prelaze sa
						   Podešavanja": the administration changes the picture and the words of a member whose
						   fee has lapsed too, and sees the picture itself). */
						+ " c.bio, '/api/photos/' || ph.digest, ph.crop_x, ph.crop_y, ph.crop_diameter"
						+ " from competitor c"
						+ " left join competitor_document d on d.competitor_id = c.id"
						+ " left join account a on a.competitor_id = c.id"
						+ " left join photo ph on ph.id = c.photo_id"
						+ " left join place p on p.id = c.place_id"
						+ " left join country k on k.id = c.country_id"
						+ " left join country pk on pk.id = p.country_id"
						+ " where c.id = ?")
				.param(competitor)
				.query((row, i) -> new Data(row.getString(1), row.getString(2), row.getString(3),
						row.getString(4), row.getString(5), row.getString(6), row.getString(7),
						row.getString(8), (Boolean) row.getObject(9), row.getString(10), row.getString(11),
						(Long) row.getObject(12), row.getString(13), row.getString(14), row.getString(15),
						row.getString(16), row.getString(17), row.getString(17) == null ? null
								: new MePhotoApi.Crop(row.getBigDecimal(18), row.getBigDecimal(19), row.getBigDecimal(20))))
				.optional();
	}
}
