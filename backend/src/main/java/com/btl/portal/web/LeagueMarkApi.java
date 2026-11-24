package com.btl.portal.web;

import com.btl.portal.domain.photo.SmallPicture;
import com.btl.portal.domain.photo.WhatAPictureIs;
import com.btl.portal.domain.photo.WithoutMetadata;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.web.MePhotoApi.Crop;
import com.btl.portal.web.MePhotoApi.Picture;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Clock;
import java.util.Optional;

/**
 * THE ADMINISTRATION SETTING A LEAGUE'S MARK, AND TAKING IT DOWN, AT ONCE.
 *
 * <p>Owner, PDL 23.11.2026, „Pravi logo lige", chosen between offered outcomes:
 *
 * <ul>
 * <li>„oblik: krug, seče se kao znak tima (uz moju preporuku): čuva se original, prikazuje se u krugu; bez
 * loga ostaje krug sa inicijalima";</li>
 * <li>„ko postavlja: administracija (administrator ili moderator sa pravom nad ligama) u moderaciji lige,
 * bez odobravanja, i odmah važi (uz moju preporuku)".</li>
 * </ul>
 *
 * <p><b>WHO MAY</b>: the right over the leagues ({@code entity:leagues}), the one {@link LeagueWriteApi}
 * asks at every one of its doors, so the superadmin and a moderator with that box ticked, and nobody else. A
 * moderator without it, a moderator over the TEAMS, and a member are answered 404 like an address that is
 * not there (ADL A8); somebody signed out is answered 401 by the chain before any of this. A league that is
 * not there is the same 404, which is A8 applied to a row.
 *
 * <p><b>THE PICTURE IS HELD TO WHAT EVERY PICTURE OF THE PORTAL IS</b>, copied from
 * {@link MemberPictureAndWordsApi#setThePicture}, the administration's other door that sets a picture at
 * once, with its guards: the type by its bytes and never by the name or the header (ADL A12a, „1. Slika kao
 * dokaz."), the size before the bytes are read ({@link WhatAPictureIs#AT_MOST_BYTES}), the circle as the
 * three fractions V21 holds ({@link MePhotoApi#fraction}), what the camera wrote taken off before the digest
 * (ADL, owner 06.11.2026, „pri svakom otpremanju slike (član i administracija)"), and the file under the
 * name the database issues (ADL O8). The refusals are therefore that door's words, by the same constants,
 * so a screen that answers a member's picture answers these.
 *
 * <p><b>NOTHING WAITS AND NOBODY IS TOLD</b>: the owner's „bez odobravanja, i odmah važi". There is no queue
 * row, and a league has no member to write to.
 *
 * <p><b>A FROZEN LEAGUE'S MARK IS NOT CHANGED, AND THAT IS DERIVED, NOT SAID</b>: from the owner's
 * „Izmena lige čija je sezona zamrznuta se odbija, i kaže se zašto; izuzetak je izbacivanje trke" (PDL,
 * 22.09.2026), whose one exception is a race taken out. So both doors answer as
 * {@link LeagueWriteApi#change} does, 409 with {@link LeagueWriteApi#THE_SEASON_IS_FROZEN}, asked of the
 * season THE ROW carries.
 *
 * <p><b>WHAT IS REPLACED OR TAKEN DOWN GOES BY THE DATABASE'S OWN RULE</b> (V54, taught the fifth holder in
 * V108, ADL A68: a {@code photo} row no column holds is deleted at the end of the transaction), and its FILE
 * with the sweep ({@code ThePicturesFolderIsSwept}), for the reason {@link MemberPictureAndWordsApi} gives:
 * the administration replaces a picture, and an hour later is soon enough for bytes nothing serves.
 */
@RestController
class LeagueMarkApi {

	private final JdbcClient db;

	private final Clock clock;

	private final Path folder;

	LeagueMarkApi(JdbcClient db, Clock clock, @Value("${btl.photos.folder}") String folder) {
		this.db = db;
		this.clock = clock;
		this.folder = Path.of(folder);
	}

	/**
	 * A NEW MARK ON THE LEAGUE, at once.
	 *
	 * @param picture the file, required: there is nothing of the league's that waits for a circle to be moved on
	 * @return the mark that now stands, at its public address, with its circle
	 */
	@PostMapping(path = "/api/leagues/{id}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	@RightIsNeeded("entity:leagues")
	@Transactional(rollbackFor = IOException.class)
	ResponseEntity<?> setTheMark(@PathVariable long id,
			@RequestPart(name = "picture", required = false) MultipartFile picture,
			@RequestParam(name = "cropX", required = false) String cropX,
			@RequestParam(name = "cropY", required = false) String cropY,
			@RequestParam(name = "cropSize", required = false) String cropSize,
			HttpServletResponse response) throws IOException {

		Optional<Integer> season = theSeasonOfTheLeagueUnderALock(id);

		if (season.isEmpty()) {
			return away(response);
		}

		if (SeasonClock.isFrozen(season.get(), clock.instant().atZone(SeasonClock.ZONE))) {
			return no(HttpStatus.CONFLICT, LeagueWriteApi.THE_SEASON_IS_FROZEN);
		}

		if (picture == null || picture.isEmpty()) {
			return no(HttpStatus.BAD_REQUEST, MePhotoApi.THE_FORM_IS_NOT_COMPLETE);
		}

		BigDecimal x = MePhotoApi.fraction(cropX, true);
		BigDecimal y = MePhotoApi.fraction(cropY, true);
		BigDecimal size = MePhotoApi.fraction(cropSize, false);

		if (x == null || y == null || size == null) {
			return no(HttpStatus.BAD_REQUEST, MePhotoApi.THE_CROP_IS_NOT_A_CIRCLE);
		}

		if (picture.getSize() > WhatAPictureIs.AT_MOST_BYTES) {
			return no(HttpStatus.BAD_REQUEST, MePhotoApi.THE_PICTURE_IS_TOO_BIG);
		}

		byte[] bytes = picture.getBytes();
		String mediaType = WhatAPictureIs.sniff(bytes);

		if (mediaType == null) {
			return no(HttpStatus.BAD_REQUEST, MePhotoApi.THIS_IS_NOT_A_PICTURE);
		}

		/* AND NO LARGER THAN THE CUT TAKES, for the reason `MePhotoApi.send` gives. */
		if (SmallPicture.isLargerThanItCuts(bytes, mediaType)) {
			return no(HttpStatus.BAD_REQUEST, MePhotoApi.THE_PICTURE_IS_TOO_BIG);
		}

		/* Before the digest, so the address names the stored bytes. */
		bytes = WithoutMetadata.of(bytes, mediaType);

		String digest = WhatAPictureIs.digestOf(bytes);
		long photo = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values (?, ?, ?, ?, ?, ?) returning id")
				.params(mediaType, bytes.length, digest, x, y, size)
				.query(Long.class)
				.single();

		/* THE MARK THAT STOOD STOPS STANDING here, and its `photo` row goes at the end of the transaction by
		   the league's own trigger (V108). */
		db.sql("update league set logo_id = ? where id = ?").params(photo, id).update();

		Files.createDirectories(folder);
		Files.write(folder.resolve(String.valueOf(photo)), bytes, StandardOpenOption.CREATE_NEW,
				StandardOpenOption.WRITE);

		return ResponseEntity.ok(new Picture("/api/photos/" + digest, new Crop(x, y, size)));
	}

	/**
	 * THE MARK TAKEN DOWN, at once, and the league is drawn with its initials again. Taking down what is not
	 * there is not an error: the league is then as it was asked to be.
	 */
	@DeleteMapping("/api/leagues/{id}/logo")
	@RightIsNeeded("entity:leagues")
	@Transactional
	ResponseEntity<?> takeTheMarkDown(@PathVariable long id, HttpServletResponse response) throws IOException {
		Optional<Integer> season = theSeasonOfTheLeagueUnderALock(id);

		if (season.isEmpty()) {
			return away(response);
		}

		if (SeasonClock.isFrozen(season.get(), clock.instant().atZone(SeasonClock.ZONE))) {
			return no(HttpStatus.CONFLICT, LeagueWriteApi.THE_SEASON_IS_FROZEN);
		}

		db.sql("update league set logo_id = null where id = ? and logo_id is not null").param(id).update();

		return ResponseEntity.ok().build();
	}

	/**
	 * The season of the league, read UNDER A LOCK on its row, or nothing where there is no such league.
	 *
	 * <p>The lock is what keeps a deletion of the league from landing between this read and the write: without
	 * it the {@code update} would find no row, and the {@code photo} row inserted for it would be one nothing
	 * ever held, which V54's rule leaves standing on purpose („a photo nobody ever held stays"). With it the
	 * deletion waits for this transaction, and then takes the league and its mark together.
	 */
	private Optional<Integer> theSeasonOfTheLeagueUnderALock(long id) {
		return db.sql("select season from league where id = ? for update").param(id).query(Integer.class)
				.optional();
	}

	private static ResponseEntity<?> away(HttpServletResponse response) throws IOException {
		response.sendError(HttpStatus.NOT_FOUND.value());
		return null;
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}
}
