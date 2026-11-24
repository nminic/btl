package com.btl.portal.web;

import com.btl.portal.domain.photo.SmallPicture;
import com.btl.portal.domain.photo.WhatAPictureIs;
import com.btl.portal.domain.photo.WithoutMetadata;
import com.btl.portal.web.MePhotoApi.Refused;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;

/**
 * THE ADMINISTRATION SENDING A SPONSOR'S LOGO, AND TAKING IT DOWN, AT ONCE.
 *
 * <p>Owner, PDL 24.11.2026: „Potrebno mi je da se Podese wrapperi ili kako vec treba da se ucitava znak
 * sponzora (njegov logo) koji se automatski prikazuje kako treba i u boksu sa desne strane, i u donjoj
 * liniji.”, with „Logo se otprema kao PNG, WebP ili JPEG, ne SVG.” and „Logo stoji providno na tamnoj
 * pozadini, bez svetle pločice.”
 *
 * <p><b>WHO MAY</b>: the right over the sponsors ({@code entity:sponsors}, V111), as at every door of
 * {@link SponsorWriteApi}; anybody else signed in is answered 404 like an address that is not there, and
 * somebody signed out 401 by the chain (ADL A8). A sponsor that is not there is the same 404.
 *
 * <p><b>THE PICTURE IS HELD TO WHAT EVERY PICTURE OF THE PORTAL IS</b>, copied from
 * {@link LeagueMarkApi#setTheMark}, the other door of the administration that sets a mark at once, with its
 * guards and in its order: the size before the bytes are read ({@link WhatAPictureIs#AT_MOST_BYTES}), the type
 * by its bytes and never by the name or the header (ADL A12a, „1. Slika kao dokaz.”), no larger than the cut
 * takes ({@link SmallPicture#isLargerThanItCuts}, PR 815), what the camera wrote taken off before the digest
 * (ADL, owner 06.11.2026), and the file under the name the database issues (ADL O8). So the refusals are that
 * door's words, by the same constants. <b>An SVG is refused by the same sniff</b>, which knows JPEG, PNG and
 * WebP and nothing else, so it is answered {@link MePhotoApi#THIS_IS_NOT_A_PICTURE} as a text file is: „ne SVG”
 * (SVG može da nosi skriptu).
 *
 * <p><b>WHAT IS NOT COPIED, AND WHY</b>: the circle. „Logo se ne seče u krug; čuva se ceo, providnost ostaje.”
 * So no crop is asked for, the photo row's three fractions are written whole ({@code 0.5, 0.5, 1}), which V21
 * accepts and nothing reads for a sponsor, and no small cut is made: the front page draws the logo inside a
 * tile and a box, never in a circle. What the camera wrote is taken off as it is for every picture, and the
 * transparency of a PNG or a WebP is not metadata ({@link WithoutMetadata} keeps {@code tRNS} and
 * {@code ALPH}), so it stays.
 *
 * <p><b>NOTHING WAITS AND NOBODY IS TOLD</b>, as for a league's mark: there is no queue row, and a sponsor has
 * no member to write to.
 *
 * <p><b>WHAT IS REPLACED OR TAKEN DOWN GOES BY THE DATABASE'S OWN RULE</b> (V111, the sixth holder): the
 * {@code photo} row nothing holds goes at the end of the transaction, and its file with the sweep.
 */
@RestController
class SponsorLogoApi {

	/** The whole picture, as V21's three fractions say it: the centre and a diameter of one. */
	private static final BigDecimal THE_MIDDLE = new BigDecimal("0.5");

	private final JdbcClient db;

	private final Path folder;

	SponsorLogoApi(JdbcClient db, @Value("${btl.photos.folder}") String folder) {
		this.db = db;
		this.folder = Path.of(folder);
	}

	/**
	 * A NEW LOGO ON THE SPONSOR, at once.
	 *
	 * @param picture the file, required
	 * @return the logo that now stands, at its public address
	 */
	@PostMapping(path = "/api/sponsors/{id}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	@RightIsNeeded("entity:sponsors")
	@Transactional(rollbackFor = IOException.class)
	ResponseEntity<?> setTheLogo(@PathVariable long id,
			@RequestPart(name = "picture", required = false) MultipartFile picture,
			HttpServletResponse response) throws IOException {

		if (!theSponsorUnderALock(id)) {
			return SponsorWriteApi.away(response);
		}

		if (picture == null || picture.isEmpty()) {
			return no(MePhotoApi.THE_FORM_IS_NOT_COMPLETE);
		}

		if (picture.getSize() > WhatAPictureIs.AT_MOST_BYTES) {
			return no(MePhotoApi.THE_PICTURE_IS_TOO_BIG);
		}

		byte[] bytes = picture.getBytes();
		String mediaType = WhatAPictureIs.sniff(bytes);

		if (mediaType == null) {
			return no(MePhotoApi.THIS_IS_NOT_A_PICTURE);
		}

		if (SmallPicture.isLargerThanItCuts(bytes, mediaType)) {
			return no(MePhotoApi.THE_PICTURE_IS_TOO_BIG);
		}

		/* Before the digest, so the address names the stored bytes. */
		bytes = WithoutMetadata.of(bytes, mediaType);

		String digest = WhatAPictureIs.digestOf(bytes);
		long photo = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values (?, ?, ?, ?, ?, ?) returning id")
				.params(mediaType, bytes.length, digest, THE_MIDDLE, THE_MIDDLE, BigDecimal.ONE)
				.query(Long.class)
				.single();

		/* THE LOGO THAT STOOD STOPS STANDING here, and its `photo` row goes at the end of the transaction by the
		   sponsor's own trigger (V111). */
		db.sql("update sponsor set logo_id = ? where id = ?").params(photo, id).update();

		Files.createDirectories(folder);
		Files.write(folder.resolve(String.valueOf(photo)), bytes, StandardOpenOption.CREATE_NEW,
				StandardOpenOption.WRITE);

		return ResponseEntity.ok(new Logo("/api/photos/" + digest));
	}

	/**
	 * The logo as it now stands.
	 *
	 * @param logo its public address
	 */
	record Logo(String logo) {
	}

	/**
	 * THE LOGO TAKEN DOWN, at once. Taking down what is not there is not an error: the sponsor is then as it
	 * was asked to be.
	 */
	@DeleteMapping("/api/sponsors/{id}/logo")
	@RightIsNeeded("entity:sponsors")
	@Transactional
	ResponseEntity<?> takeTheLogoDown(@PathVariable long id, HttpServletResponse response) throws IOException {
		if (!theSponsorUnderALock(id)) {
			return SponsorWriteApi.away(response);
		}

		db.sql("update sponsor set logo_id = null where id = ? and logo_id is not null").param(id).update();

		return ResponseEntity.noContent().build();
	}

	/**
	 * Whether the sponsor is there, read UNDER A LOCK on its row, for the reason {@link LeagueMarkApi} gives:
	 * without it a deletion landing between this read and the write would leave the {@code photo} row
	 * inserted for it held by nothing, which V54's rule leaves standing on purpose.
	 */
	private boolean theSponsorUnderALock(long id) {
		/* THE TABLE BEFORE THE ROW, as every write of a sponsor takes them (`SponsorWriteApi#lock`): a row first
		   and the table after is the order that deadlocks with a change or a deletion of the same sponsor. */
		SponsorWriteApi.lock(db);

		return db.sql("select id from sponsor where id = ? for update").param(id).query(Long.class).optional()
				.isPresent();
	}

	private static ResponseEntity<?> no(String reason) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new Refused(reason));
	}
}
