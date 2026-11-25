package com.btl.portal.web;

import com.btl.portal.domain.photo.SmallPicture;
import com.btl.portal.domain.photo.WhatAPictureIs;
import com.btl.portal.domain.photo.WithoutMetadata;
import com.btl.portal.web.MePhotoApi.Crop;
import com.btl.portal.web.MePhotoApi.MyPictures;
import com.btl.portal.web.MePhotoApi.Picture;
import com.btl.portal.web.MePhotoApi.Refused;
import com.btl.portal.web.MePhotoApi.Waiting;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
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
import java.time.ZonedDateTime;
import java.util.Optional;

/**
 * A TEAM'S LOGO: SENT FOR APPROVAL BY THE MEMBER WHO RUNS THE TEAM, AND SET AT ONCE BY THE ADMINISTRATION.
 *
 * <p>Owner, PDL 25.11.2026, „Urednik tima postavlja znak tima slikom”: „da li timovi mogu da podignu sliku kao
 * svoj znak? TJ da urednik tima uredi znak tima? Ako ne, molim te napravi tu funkcionalnost. Isti oblik secenja
 * krugom i da moze i iz administracije”. Two derivations recorded the same day: the logo the team's editor sends
 * waits for a moderator and is not seen until it is approved (from the decision of 12.08.2026, „Prolazi kroz
 * isto odobravanje kao profilna slika, u redu za proveru timova”), and the logo the administration sets stands
 * at once (from the league's mark, „administracija … bez odobravanja, i odmah važi”). And the owner's answers of
 * the same day („Logo tima, pitanja iz plana”): the editor may also take the logo down, at once and with no
 * approval; an approved logo sends no message and a refused one sends the reason; a logo the administration sets
 * while the editor's waits leaves the waiting one in the queue.
 *
 * <p><b>THE EDITOR'S DOOR IS THE MEMBER'S OWN PICTURE, ONE TAB OVER</b> ({@link MePhotoApi}, copied with its
 * guards): the type by its bytes, the size before the bytes are read, no larger than the cut takes, what the
 * camera wrote taken off before the digest, the file under the name the database issues. A second send
 * overwrites the row that waits and keeps its place in the queue (owner, 27.09.2026, „Ponovno slanje pregazi
 * red koji čeka, ne pravi drugi”), and a send with no file moves the circle over the logo that waits, naming the
 * picture it was drawn over ({@code over}, owner 24.11.2026). The row is the teams tab's, with the team named in
 * {@code verification.team_id} (V112).
 *
 * <p><b>WHO IS THE EDITOR</b>: whoever administers the team ({@link TeamApi#administers}), the one rule a change of
 * the team and its deletion already ask, and whose fee stands. Everybody else is answered 404, the team included
 * where it is not there (ADL A8), and the right over the teams opens nothing on this door, as on
 * {@code POST /api/teams/{id}/changes}: the administration has its own door here and no business sending itself a
 * logo to approve.
 *
 * <p><b>ONE WRITE OF A TEAM'S LOGO AT A TIME</b>: every door here takes the team's row first ({@code for update}),
 * so two sends of the editor, a send and the administration's set, and a send and the team's deletion run one
 * after the other. A first send therefore finds the row the send in front of it opened; V112's
 * {@code verification_one_logo_waits_per_team} is the floor under that.
 *
 * <p><b>THE ADMINISTRATION'S DOOR IS THE LEAGUE'S MARK</b> ({@link LeagueMarkApi}): the right over the teams at the
 * door, a new picture with its circle and nothing that waits, and the logo taken down at once. <b>What waits is not
 * touched</b> by either of its writes (the owner's answer above), so a moderator may later approve it over the
 * administration's.
 *
 * <p><b>WHAT IS REPLACED OR TAKEN DOWN GOES BY THE DATABASE'S OWN RULE</b> (V54: a {@code photo} row no column holds
 * is deleted at the end of the transaction), and its FILE with the sweep ({@code ThePicturesFolderIsSwept}), as
 * {@link LeagueMarkApi} leaves it (owner, 02.10.2026, „Zaostao fajl slike briše automatski čistač”). That holds for
 * a logo that waited and was overwritten too, where {@link MePhotoApi#send} deletes the file at once: nothing
 * serves those bytes once the row has gone, and an hour later is soon enough.
 *
 * <p><b>NOTHING HERE IS FROZEN OR WINDOWED</b>, derived and recorded on 25.11.2026: a team has no frozen season of
 * its own, and its logo is not who is in it.
 */
@RestController
class TeamLogoApi {

	/** The tab a team's logo waits in, which is the tab a team's change already waits in. */
	static final String THE_TEAMS_TAB = "teams";

	/** Where a logo that stands is asked for: the public route, a team's logo being a public holder (ADL A60). */
	private static final String A_PUBLISHED_PICTURE_IS_ASKED_FOR_AT = "/api/photos/";

	/**
	 * THE ROW OF THIS TEAM THAT WAITS WITH A LOGO IN IT, as a clause both the write and the reading ask, so they
	 * cannot come to mean different things by „waiting”. {@code state = 'waiting'} is implied by
	 * {@code photo_id is not null} (V9, {@code verification_decided_keeps_no_photo}) and is written for the reason
	 * {@link MePhotoApi#THE_ONE_OF_MINE_THAT_WAITS} gives.
	 */
	static final String THE_ONE_OF_THE_TEAM_THAT_WAITS =
			" from verification v where v.team_id = :team and v.queue = :tab"
			+ " and v.state = 'waiting' and v.photo_id is not null"
			+ " order by v.raised_at, v.id limit 1";

	private final JdbcClient db;

	private final ActiveMemberOrAdministration readers;

	private final Clock clock;

	private final Path folder;

	TeamLogoApi(JdbcClient db, ActiveMemberOrAdministration readers, Clock clock,
			@Value("${btl.photos.folder}") String folder) {

		this.db = db;
		this.readers = readers;
		this.clock = clock;
		this.folder = Path.of(folder);
	}

	/** The key of the row that waits and of the logo it holds. */
	private record Waits(long row, long photo) {
	}

	/**
	 * Where the logo that WAITS is asked for, which is nobody's but the team's editor's ({@link PhotoApi#teamLogoThatWaits}).
	 * The digest is in it for {@link MePhotoApi}'s reason: a new logo is a new address, so a kept answer never
	 * shows the logo that was overwritten. No key of the team in it: the route asks which team's logo waits under
	 * that digest, and answers only the member who runs that team.
	 */
	static final String WHERE_THE_LOGO_THAT_WAITS_IS = "/api/teams/own-logo/";

	/**
	 * THE EDITOR SENDS A LOGO FOR APPROVAL, OR MOVES THE CIRCLE OVER THE ONE THAT WAITS.
	 *
	 * @param picture the file, or nothing where only the circle over the logo that waits is moved
	 * @param over    the address of the picture the circle was drawn over, named by a send with no file
	 */
	@PostMapping(path = "/api/teams/{id}/own-logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	@Transactional(rollbackFor = IOException.class)
	ResponseEntity<?> send(@AuthenticationPrincipal WhoIsAsking.Member asking, @PathVariable AKey id,
			@RequestPart(name = "picture", required = false) MultipartFile picture,
			@RequestParam(name = "cropX", required = false) String cropX,
			@RequestParam(name = "cropY", required = false) String cropY,
			@RequestParam(name = "cropSize", required = false) String cropSize,
			@RequestParam(name = "over", required = false) String over,
			HttpServletResponse response) throws IOException {

		Long me = readers.activeMember(asking).orElse(null);
		Optional<String> name = theEditorTakesTheTeam(me, id.value());

		if (name.isEmpty()) {
			return away(response);
		}

		long team = id.value();
		Optional<Waits> waits = theOneThatWaits(team);
		boolean onlyTheCircle = picture == null || picture.isEmpty();

		if (onlyTheCircle && over == null) {
			return no(HttpStatus.BAD_REQUEST, MePhotoApi.THE_FORM_IS_NOT_COMPLETE);
		}

		BigDecimal x = MePhotoApi.fraction(cropX, true);
		BigDecimal y = MePhotoApi.fraction(cropY, true);
		BigDecimal size = MePhotoApi.fraction(cropSize, false);

		if (x == null || y == null || size == null) {
			return no(HttpStatus.BAD_REQUEST, MePhotoApi.THE_CROP_IS_NOT_A_CIRCLE);
		}

		if (onlyTheCircle) {
			/* OVER THE LOGO THAT WAITS NOW, read above with the team's row taken: nothing waiting and another
			   waiting are one answer, „the picture is not the one I drew the circle over”. */
			if (!waits.map(held -> over.equals(WHERE_THE_LOGO_THAT_WAITS_IS + theDigestOf(held.photo())))
					.orElse(false)) {
				return no(HttpStatus.CONFLICT, MePhotoApi.THE_PICTURE_HAS_CHANGED);
			}

			Waits standing = waits.orElseThrow();

			db.sql("update photo set crop_x = ?, crop_y = ?, crop_diameter = ? where id = ?")
					.params(x, y, size, standing.photo())
					.update();

			/* AND THE ROW NOW SPEAKS FOR WHOEVER MOVED IT: the seat may have passed while the logo waited, and the
			   reason of a refusal goes to the member the row names (`VerificationWriteApi.tell`). My reasoning. */
			db.sql("update verification set competitor_id = ? where id = ?").params(me, standing.row()).update();

			return ResponseEntity.ok(new Waiting(standing.row(), theDigestOf(standing.photo()), theDigestStandingOn(team)));
		}

		Optional<ResponseEntity<?>> refused = whyThePictureIsRefused(picture);

		if (refused.isPresent()) {
			return refused.get();
		}

		String mediaType = WhatAPictureIs.sniff(picture.getBytes());
		byte[] bytes = WithoutMetadata.of(picture.getBytes(), mediaType);
		String digest = WhatAPictureIs.digestOf(bytes);
		long photo = aPhotoRow(mediaType, bytes, digest, x, y, size);

		/* REPOINTED AND NOT REPLACED, for `MePhotoApi.send`'s measured reason: the row keeps its key, its place in
		   the queue and a moderator's hold, and the picture under his hand changes. */
		long waiting;

		if (waits.isPresent()) {
			db.sql("update verification set photo_id = ?, competitor_id = ? where id = ?")
					.params(photo, me, waits.orElseThrow().row())
					.update();

			waiting = waits.orElseThrow().row();
		} else {
			/* THE SUBJECT IS THE TEAM'S NAME AS IT IS NOW; the queue draws the name as it is when it is read
			   (`VerificationApi`). `body` is empty, the schema's word for a tab that proposes no text (V9). */
			waiting = db.sql("insert into verification (queue, competitor_id, subject, body, photo_id, team_id)"
							+ " values (?, ?, ?, '', ?, ?) returning id")
					.params(THE_TEAMS_TAB, me, name.get(), photo, team)
					.query(Long.class)
					.single();
		}

		/* AND THE FILE OF THE LOGO THIS OVERWROTE GOES WITH THE SWEEP: its row goes at the end of this transaction
		   (V54), so nothing serves the bytes any more (owner, 02.10.2026, „Zaostao fajl slike briše automatski
		   čistač”). */
		write(photo, bytes);

		return ResponseEntity.ok(new Waiting(waiting, digest, theDigestStandingOn(team)));
	}

	/**
	 * WHAT THE TEAM'S LOGO IS DOING, FOR ITS EDITOR: the logo that waits, at the address only he is served it at,
	 * and the logo that stands, at its public one, each with its circle (owner, 27.09.2026, „Na ekranu za slanje
	 * slike vidi se slika koja čeka, sa krugom i oznakom da čeka odobrenje”).
	 */
	@GetMapping("/api/teams/{id}/own-logo")
	@Transactional
	ResponseEntity<?> ours(@AuthenticationPrincipal WhoIsAsking.Member asking, @PathVariable AKey id,
			HttpServletResponse response) throws IOException {

		Long me = readers.activeMember(asking).orElse(null);
		long team = id.value();

		if (me == null || !TeamApi.administers(db, me, team, ZonedDateTime.now(clock))) {
			return away(response);
		}

		return ResponseEntity.ok(db
				.sql("select waiting.digest, waiting.crop_x, waiting.crop_y, waiting.crop_diameter,"
						+ " standing.digest, standing.crop_x, standing.crop_y, standing.crop_diameter"
						+ " from team t"
						+ " left join photo standing on standing.id = t.logo_id"
						+ " left join photo waiting on waiting.id = (select v.photo_id"
						+ THE_ONE_OF_THE_TEAM_THAT_WAITS + ")"
						+ " where t.id = :team")
				.param("team", team)
				.param("tab", THE_TEAMS_TAB)
				.query((row, one) -> new MyPictures(
						pictureAt(WHERE_THE_LOGO_THAT_WAITS_IS, row.getString(1), row.getBigDecimal(2),
								row.getBigDecimal(3), row.getBigDecimal(4)),
						pictureAt(A_PUBLISHED_PICTURE_IS_ASKED_FOR_AT, row.getString(5), row.getBigDecimal(6),
								row.getBigDecimal(7), row.getBigDecimal(8))))
				.single());
	}

	/**
	 * THE EDITOR TAKES THE LOGO DOWN, at once and with no approval (owner, 25.11.2026, „i urednik tima sme da
	 * ukloni logo, i to važi odmah, bez odobrenja”). <b>A logo that waits stays in the queue</b>: what becomes of it
	 * was not decided, and leaving it is the shape the owner chose for the administration's set beside it. Taking
	 * down what is not there is not an error.
	 */
	@DeleteMapping("/api/teams/{id}/own-logo")
	@Transactional
	ResponseEntity<?> takeDownOurs(@AuthenticationPrincipal WhoIsAsking.Member asking, @PathVariable AKey id,
			HttpServletResponse response) throws IOException {

		if (theEditorTakesTheTeam(readers.activeMember(asking).orElse(null), id.value()).isEmpty()) {
			return away(response);
		}

		db.sql("update team set logo_id = null where id = ? and logo_id is not null").param(id.value()).update();

		return ResponseEntity.ok().build();
	}

	/**
	 * A NEW LOGO ON THE TEAM, set by the administration, at once.
	 *
	 * @return the logo that now stands, at its public address, with its circle
	 */
	@PostMapping(path = "/api/teams/{id}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	@RightIsNeeded(TeamApi.OVER_THE_TEAMS)
	@Transactional(rollbackFor = IOException.class)
	ResponseEntity<?> setTheLogo(@PathVariable long id,
			@RequestPart(name = "picture", required = false) MultipartFile picture,
			@RequestParam(name = "cropX", required = false) String cropX,
			@RequestParam(name = "cropY", required = false) String cropY,
			@RequestParam(name = "cropSize", required = false) String cropSize,
			HttpServletResponse response) throws IOException {

		if (theTeamUnderALock(id).isEmpty()) {
			return away(response);
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

		Optional<ResponseEntity<?>> refused = whyThePictureIsRefused(picture);

		if (refused.isPresent()) {
			return refused.get();
		}

		String mediaType = WhatAPictureIs.sniff(picture.getBytes());
		byte[] bytes = WithoutMetadata.of(picture.getBytes(), mediaType);
		String digest = WhatAPictureIs.digestOf(bytes);
		long photo = aPhotoRow(mediaType, bytes, digest, x, y, size);

		/* THE LOGO THAT STOOD STOPS STANDING here, and its `photo` row goes at the end of the transaction (V54). What
		   waits for a moderator is not touched (the owner's answer of 25.11.2026). */
		db.sql("update team set logo_id = ? where id = ?").params(photo, id).update();

		write(photo, bytes);

		return ResponseEntity.ok(new Picture(A_PUBLISHED_PICTURE_IS_ASKED_FOR_AT + digest, new Crop(x, y, size)));
	}

	/** THE LOGO TAKEN DOWN BY THE ADMINISTRATION, at once; what waits is not touched. */
	@DeleteMapping("/api/teams/{id}/logo")
	@RightIsNeeded(TeamApi.OVER_THE_TEAMS)
	@Transactional
	ResponseEntity<?> takeTheLogoDown(@PathVariable long id, HttpServletResponse response) throws IOException {
		if (theTeamUnderALock(id).isEmpty()) {
			return away(response);
		}

		db.sql("update team set logo_id = null where id = ? and logo_id is not null").param(id).update();

		return ResponseEntity.ok().build();
	}

	/**
	 * The team's name, read UNDER A LOCK on its row, where the one asking is its editor and his fee stands; nothing
	 * otherwise. The lock is taken before the question, so a seat that passes or a team that goes is seen by it.
	 */
	private Optional<String> theEditorTakesTheTeam(Long me, long team) {
		if (me == null) {
			return Optional.empty();
		}

		Optional<String> name = theTeamUnderALock(team);

		return name.filter(taken -> TeamApi.administers(db, me, team, ZonedDateTime.now(clock)));
	}

	/**
	 * The team's name under a lock on its row, or nothing where there is no such team. The lock keeps a deletion
	 * of the team from landing between this read and the write (V54 leaves a picture nobody ever held standing),
	 * and it is the turn every write of the team's logo takes.
	 */
	private Optional<String> theTeamUnderALock(long team) {
		return db.sql("select name from team where id = ? for update").param(team).query(String.class).optional();
	}

	private Optional<Waits> theOneThatWaits(long team) {
		return db.sql("select v.id, v.photo_id" + THE_ONE_OF_THE_TEAM_THAT_WAITS + " for update")
				.param("team", team)
				.param("tab", THE_TEAMS_TAB)
				.query((row, one) -> new Waits(row.getLong(1), row.getLong(2)))
				.optional();
	}

	/**
	 * Why the file is not a logo the portal takes, asked in {@link MePhotoApi#send}'s order and with its words:
	 * the size before the bytes are read, the type by the bytes, and no larger than the cut takes.
	 */
	private static Optional<ResponseEntity<?>> whyThePictureIsRefused(MultipartFile picture) throws IOException {
		if (picture.getSize() > WhatAPictureIs.AT_MOST_BYTES) {
			return Optional.of(no(HttpStatus.BAD_REQUEST, MePhotoApi.THE_PICTURE_IS_TOO_BIG));
		}

		byte[] bytes = picture.getBytes();
		String mediaType = WhatAPictureIs.sniff(bytes);

		if (mediaType == null) {
			return Optional.of(no(HttpStatus.BAD_REQUEST, MePhotoApi.THIS_IS_NOT_A_PICTURE));
		}

		if (SmallPicture.isLargerThanItCuts(bytes, mediaType)) {
			return Optional.of(no(HttpStatus.BAD_REQUEST, MePhotoApi.THE_PICTURE_IS_TOO_BIG));
		}

		return Optional.empty();
	}

	private long aPhotoRow(String mediaType, byte[] bytes, String digest, BigDecimal x, BigDecimal y,
			BigDecimal size) {

		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values (?, ?, ?, ?, ?, ?) returning id")
				.params(mediaType, bytes.length, digest, x, y, size)
				.query(Long.class)
				.single();
	}

	/** The file under the name the database just issued, and never over one that is there (`MePhotoApi.send`). */
	private void write(long photo, byte[] bytes) throws IOException {
		Files.createDirectories(folder);
		Files.write(folder.resolve(String.valueOf(photo)), bytes, StandardOpenOption.CREATE_NEW,
				StandardOpenOption.WRITE);
	}

	private String theDigestOf(long photo) {
		return db.sql("select digest from photo where id = ?").param(photo).query(String.class).single();
	}

	private String theDigestStandingOn(long team) {
		return db.sql("select p.digest from team t join photo p on p.id = t.logo_id where t.id = ?")
				.param(team)
				.query(String.class)
				.optional()
				.orElse(null);
	}

	private static Picture pictureAt(String at, String digest, BigDecimal x, BigDecimal y, BigDecimal size) {
		return digest == null ? null : new Picture(at + digest, new Crop(x, y, size));
	}

	private static ResponseEntity<?> away(HttpServletResponse response) throws IOException {
		response.sendError(HttpStatus.NOT_FOUND.value());
		return null;
	}

	private static ResponseEntity<?> no(HttpStatus status, String reason) {
		return ResponseEntity.status(status).body(new Refused(reason));
	}
}
