package com.btl.portal.web;

import com.btl.portal.domain.mail.WhatTheMessageSays.Said;
import com.btl.portal.domain.photo.WhatAPictureIs;
import com.btl.portal.domain.registration.WhatAProfileChangeSays;
import com.btl.portal.domain.registration.WhatAProfileChangeSays.Change;
import com.btl.portal.web.MePhotoApi.Crop;
import com.btl.portal.web.MePhotoApi.Picture;
import com.btl.portal.web.MePhotoApi.Refused;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Objects;
import java.util.Optional;

/**
 * THE ADMINISTRATION CHANGING A MEMBER'S PICTURE AND HIS WORDS ABOUT HIMSELF, AT ONCE.
 *
 * <p>Owner, 06.11.2026 (PDL „Boksovi „Profilna slika" i „Tekst o sebi" prelaze sa Podešavanja"):
 * „Administracija na tuđoj kartici Podaci sme i da menja članovu sliku i tekst o sebi" (chosen against
 * the recommendation), and, chosen with it, „Izmena administracije stupa odmah na profil, bez reda za
 * proveru, i član dobija poruku u sanduče da mu je administracija promenila sliku ili tekst o sebi".
 *
 * <p><b>WHO MAY, AND WHAT THE OTHERS ARE TOLD</b>, copied from {@link MemberDataWriteApi}, the
 * administration's other route on the same card, with its guards:
 *
 * <ul>
 * <li>the right over the members ({@link CompetitorApi#OVER_THE_MEMBERS}), asked at the door, so a
 * moderator without it is answered 404 like an address that is not there (ADL A8);</li>
 * <li>a number nobody has is 404, and so is a moderator about the member his own account names (PDL, M7:
 * „moderator ne ispravlja svoj zapis"): his own picture and words go through {@code /api/me/photo} and
 * {@code PUT /api/me}, into the queue, like every member's. The superadmin may, as on the data;</li>
 * <li>somebody signed out is answered 401 before any of this, by the chain.</li>
 * </ul>
 *
 * <p><b>THE PICTURE IS HELD TO WHAT A MEMBER'S IS</b> ({@link MePhotoApi#send}): the type by its bytes and
 * never by the name or the header (ADL A12a, „1. Slika kao dokaz."), the size before the bytes are read,
 * the circle as three fractions the column holds, the file under the name the database issues. And it
 * takes the member's turn ({@link MePhotoApi#oneSendOfAMemberAtATime}), so an administrator and the
 * member sending at one moment are one after the other.
 *
 * <p><b>WHAT OF HIS WAITS IS TAKEN AWAY</b>: the picture of his that waits when a picture is set, his words
 * that wait when words are set. That is the assistant's reasoning, offered to the owner with the work and
 * not yet answered by him: the administration's change stands at once, and a row of his left in the queue
 * would, once a moderator approved it, put back on the profile what the administration has just replaced,
 * with nobody told. The same shape the owner gave a member's own second send: „gazi trenutan red"
 * (PDL 27.09.2026).
 *
 * <p><b>ONE MESSAGE TO HIM, AND ONLY WHEN SOMETHING CHANGED</b> ({@link WhatAProfileChangeSays}), from the
 * league, to the member whose number the address names: {@code to_id} is his row, never nobody's and
 * never the administrator's. Words sent that are the words standing change nothing he needs to hear
 * about, as a form of data saved as it was opened (`MemberDataWriteApi`).
 */
@RestController
class MemberPictureAndWordsApi {

	private final JdbcClient db;

	private final MemberOfAccount memberOfAccount;

	private final WhatHeMayDo mayHe;

	private final ObjectMapper json;

	private final Path folder;

	MemberPictureAndWordsApi(JdbcClient db, MemberOfAccount memberOfAccount, WhatHeMayDo mayHe,
			ObjectMapper json, @Value("${btl.photos.folder}") String folder) {

		this.db = db;
		this.memberOfAccount = memberOfAccount;
		this.mayHe = mayHe;
		this.json = json;
		this.folder = Path.of(folder);
	}

	/**
	 * A NEW PICTURE ON HIS PROFILE, at once.
	 *
	 * @param picture the file, required here: there is no row of his that waits for the administration
	 *                to move a circle on, so a request with no file has nothing to set
	 * @return the picture that now stands, at its public address, with its circle
	 */
	@PostMapping(path = "/api/members/{memberNumber}/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	@RightIsNeeded(CompetitorApi.OVER_THE_MEMBERS)
	@Transactional(rollbackFor = IOException.class)
	ResponseEntity<?> setThePicture(@PathVariable String memberNumber,
			@AuthenticationPrincipal WhoIsAsking.Member asking,
			@RequestPart(name = "picture", required = false) MultipartFile picture,
			@RequestParam(name = "cropX", required = false) String cropX,
			@RequestParam(name = "cropY", required = false) String cropY,
			@RequestParam(name = "cropSize", required = false) String cropSize,
			HttpServletResponse response) throws IOException {

		Long member = hisIfTheAskingMayChangeIt(memberNumber, asking);

		if (member == null) {
			return away(response);
		}

		if (picture == null || picture.isEmpty()) {
			return no(MePhotoApi.THE_FORM_IS_NOT_COMPLETE);
		}

		BigDecimal x = MePhotoApi.fraction(cropX, true);
		BigDecimal y = MePhotoApi.fraction(cropY, true);
		BigDecimal size = MePhotoApi.fraction(cropSize, false);

		if (x == null || y == null || size == null) {
			return no(MePhotoApi.THE_CROP_IS_NOT_A_CIRCLE);
		}

		if (picture.getSize() > WhatAPictureIs.AT_MOST_BYTES) {
			return no(MePhotoApi.THE_PICTURE_IS_TOO_BIG);
		}

		byte[] bytes = picture.getBytes();
		String mediaType = WhatAPictureIs.sniff(bytes);

		if (mediaType == null) {
			return no(MePhotoApi.THIS_IS_NOT_A_PICTURE);
		}

		/* HIS TURN, the one his own sends take, so this and a send of his are one after the other. */
		MePhotoApi.oneSendOfAMemberAtATime(db, member);

		String digest = WhatAPictureIs.digestOf(bytes);
		long photo = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values (?, ?, ?, ?, ?, ?) returning id")
				.params(mediaType, bytes.length, digest, x, y, size)
				.query(Long.class)
				.single();

		/* THE PICTURE OF HIS THAT WAITED GOES, with its row (see the class note), and the one that stood
		   stops standing. Their `photo` rows go by the database's own rule at the end of the transaction
		   (V54, ADL A68: a `photo` row no column holds is deleted), and their FILES are left to the sweep
		   (`ThePicturesFolderIsSwept`, owner 02.10.2026: „fajlove slika koji nemaju svoj red", older than
		   ten minutes). Not deleted here, which `MePhotoApi.remove` does: that is a member taking his own
		   picture down, where the bytes should leave as soon as they can; here the administration replaces
		   one, and an hour later is soon enough for bytes nothing serves. */
		db.sql("delete from verification where id in (select v.id" + MePhotoApi.THE_ONE_OF_MINE_THAT_WAITS + ")")
				.param("me", member)
				.param("tab", MePhotoApi.THE_PROFILES_TAB)
				.update();

		db.sql("update competitor set photo_id = ? where id = ?").params(photo, member).update();

		Files.createDirectories(folder);
		Files.write(folder.resolve(String.valueOf(photo)), bytes, StandardOpenOption.CREATE_NEW,
				StandardOpenOption.WRITE);

		tell(member, WhatAProfileChangeSays.about(Change.PICTURE));

		return ResponseEntity.ok(new Picture("/api/photos/" + digest, new Crop(x, y, size)));
	}

	/**
	 * HIS WORDS ABOUT HIMSELF, at once. Blank is a removal, as it is for the member himself (owner,
	 * 19.09.2026, „skloni moju biografiju"), and the most a text may be is the member's own number
	 * ({@link MeWriteApi#AS_LONG_AS_THE_FORM_ALLOWS}).
	 *
	 * <p>THE BODY IS READ ONLY AFTER „IS THERE A MEMBER HERE, AND IS HE YOURS TO CHANGE" IS ANSWERED, for
	 * the reason {@link MemberDataWriteApi} gives: bound as an argument, a body nobody can parse would be
	 * answered 400 before the method ran, while the same body sent to a number nobody has is 404.
	 *
	 * @return the words that now stand
	 */
	@PutMapping(path = "/api/members/{memberNumber}/bio", consumes = MediaType.APPLICATION_JSON_VALUE)
	@RightIsNeeded(CompetitorApi.OVER_THE_MEMBERS)
	@Transactional
	ResponseEntity<?> setTheWords(@PathVariable String memberNumber,
			@AuthenticationPrincipal WhoIsAsking.Member asking, HttpServletRequest request,
			HttpServletResponse response) throws IOException {

		Long member = hisIfTheAskingMayChangeIt(memberNumber, asking);

		if (member == null) {
			return away(response);
		}

		String sent = wordsIn(request.getInputStream().readAllBytes());

		if (sent == null) {
			return no(MeWriteApi.THE_FORM_IS_NOT_COMPLETE);
		}

		String words = sent.strip();

		if (words.length() > MeWriteApi.AS_LONG_AS_THE_FORM_ALLOWS) {
			return no(MeWriteApi.THE_TEXT_IS_TOO_LONG);
		}

		String standing = db.sql("select coalesce(bio, '') from competitor where id = ?")
				.param(member)
				.query(String.class)
				.single();

		/* WHAT OF HIS WAITS GOES, whether or not the words change: the administration has said what
		   stands, and a text of his approved later would undo it (see the class note). */
		int withdrawn = db.sql("delete from verification v where v.competitor_id = ? and "
						+ MeWriteApi.A_TEXT_THAT_WAITS)
				.param(member)
				.update();

		if (!words.equals(standing)) {
			db.sql("update competitor set bio = ? where id = ?").params(words, member).update();
		}

		if (!words.equals(standing) || withdrawn > 0) {
			tell(member, WhatAProfileChangeSays.about(Change.WORDS));
		}

		return ResponseEntity.ok(new Words(words));
	}

	/** What the words route answers: the words that now stand on his profile. */
	record Words(String bio) {
	}

	/**
	 * His row, where the address names a member and the one asking may change him; nothing otherwise, and
	 * nothing is told apart: a number nobody has and a moderator about himself are the same 404.
	 */
	private Long hisIfTheAskingMayChangeIt(String memberNumber, WhoIsAsking.Member asking) {
		Optional<Long> member = db.sql("select id from competitor where member_number = ?")
				.param(memberNumber)
				.query(Long.class)
				.optional();

		if (member.isEmpty()) {
			return null;
		}

		boolean hisOwn = Objects.equals(memberOfAccount.competitorId(asking.account()), member.get());

		return hisOwn && !mayHe.holdsEveryRightThereIs() ? null : member.get();
	}

	/**
	 * The words of a body that is an object with a {@code bio} of text, and nothing for any other body.
	 *
	 * <p>TYPED THROUGH THE APPLICATION'S MAPPER ({@link Words}), and not read off the tree, for the reason
	 * {@link NoTextHoldsAZero} gives: the mapper refuses a text holding a zero character, which PostgreSQL
	 * cannot store, and a text taken off the tree by hand would carry it into the statement as a 500.
	 * The tree is asked first only whether {@code bio} is a text at all, since the record would take a
	 * number as its digits.
	 */
	private String wordsIn(byte[] sent) {
		try {
			/* `get` of a name is nothing on every node that is not an object (a list, a number, `null`, the
			   node of an empty body), so the one question covers them all. */
			JsonNode read = json.readTree(sent);
			JsonNode bio = read.get("bio");

			return bio == null || !bio.isString() ? null : json.treeToValue(read, Words.class).bio();
		}
		catch (JacksonException notWords) {
			return null;
		}
	}

	private void tell(long member, Said said) {
		db.sql("insert into message (to_id, from_id, from_name, subject, body) values (?, null, ?, ?, ?)")
				.params(member, PairWriteApi.THE_LEAGUE, said.subject(), said.body())
				.update();
	}

	private static ResponseEntity<?> away(HttpServletResponse response) throws IOException {
		response.sendError(HttpStatus.NOT_FOUND.value());
		return null;
	}

	private static ResponseEntity<?> no(String reason) {
		return ResponseEntity.badRequest().body(new Refused(reason));
	}
}
