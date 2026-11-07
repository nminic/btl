package com.btl.portal.web;

import com.btl.portal.domain.photo.WhatAPictureIs;
import com.btl.portal.domain.photo.WithoutMetadata;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

/**
 * THE PICTURES STORED BEFORE THE PORTAL TOOK METADATA OFF ARE CLEANED, ONCE EACH, AND THE ROW SAYS IT WAS.
 *
 * <p><b>ADL, owner, 06.11.2026</b>, the last half of „Server pri svakom otpremanju slike (član i
 * administracija) skida sve metapodatke ... postojeće slike na produkciji se jednom očiste." The two doors
 * take metadata off a picture as it arrives ({@link WithoutMetadata}); this is the same work over the files
 * that were stored before they did, which V88 marks {@code may_carry_metadata}.
 *
 * <p><b>WHAT IT DOES TO ONE ROW, in one transaction of its own:</b> the row is locked and read again (so a
 * row that has gone or was done meanwhile is passed over), its file is read, cleaned, and - only where the
 * cleaning changed it - written under a name that is not a key and moved over the old one in one step; then
 * the row gets the size and the DIGEST of the bytes now on the disk, and {@code may_carry_metadata = false}.
 *
 * <p><b>THE DIGEST IS WRITTEN AGAIN, SO THE ADDRESS OF A CLEANED PICTURE CHANGES, AND THAT IS DERIVED, NOT
 * CHOSEN.</b> ADL („Rok keširanja putuje sa adresom, ne sa čitaocem"): an address derived from content is
 * kept a day because „otisak imenuje bajtove, pa isti niz uvek znači istu sliku"; new bytes under the old
 * digest would break the one thing the day of caching rests on. The cost, named: the old address answers
 * 404 from the moment the row is written, so a page that was open at that moment draws an empty circle until
 * it is loaded again. Nothing else holds a digest: a moderator's decision carries the picture's KEY and its
 * circle (ADL, 10.10.2026), and the small pictures are kept by digest and circle, so a new digest is a new
 * cut.
 *
 * <p><b>WHEN IT RUNS, AND THE THREE QUESTIONS P13 ASKS OF A SCHEDULED JOB.</b> At start and every hour, the
 * shape {@link ASeasonFreezes} has and the journal's „posao je idempotentan i pokušava se pri svakom dizanju
 * dok ne prođe". A run that does not happen is made up by the next. A run that happens twice does nothing
 * the second time, because a done row is false and because cleaning a cleaned file gives the same bytes
 * ({@link WithoutMetadata}). A row whose file cannot be read is left TRUE and is told to the operator, so it
 * is tried again; that is a warning an hour per such row, which is the price of not marking a row done that
 * nothing was done to (a volume restored later would bring the metadata back under a row that says it is
 * gone). Once every row is false a run is one query that finds nothing. <b>A file that is not of the type its
 * row says</b> (one byte, a truncated copy: {@link WithoutMetadata#of} throws on it) is the same case, told
 * and left TRUE, and the run goes on to the next row; before 07.11.2026 it ended the run, so one such row
 * stopped every picture after it from ever being cleaned.
 *
 * <p><b>THE FILE IS READ BY {@link PhotoApi#bytesOf}, NOT BY {@code readAllBytes}</b>, the one place in the
 * portal that reads a picture off the disk and refuses a symbolic link there. This job WRITES what it reads
 * back over the same name, so a link in the folder (a restored backup writes whatever the archive holds) would
 * have been replaced by a regular file holding the cleaned copy of whatever it pointed at. A refused link is an
 * {@code IOException}, the road a missing file takes: told and left TRUE. <b>No case measures that flag, and
 * that is {@code PhotoApi}'s boundary carried over and not a new one</b>: a link cannot be made on the machine
 * this is written on (measured again 07.11.2026, {@code Administrator privilege required}), so a case would
 * only ever run on CI, which {@code PhotoApi#bytesOf} has already decided is a case nobody watches. Taking the
 * flag out leaves the gate green.
 *
 * <p><b>WHAT A FAILURE BETWEEN THE FILE AND THE ROW LEAVES, named:</b> the move is done before the row is
 * written, so a commit that fails leaves a cleaned file under a row that still carries the old digest and
 * still says it may carry metadata. The next run cleans the file again, finds it unchanged, and writes the
 * digest of what is there: the state mends itself. The other order would leave a row naming bytes that are
 * not on the disk, which {@link PhotoApi} answers as a picture that is gone.
 *
 * <p><b>THE NAME IT WRITES UNDER IS NOT A KEY</b> ({@code <key>.clean}), so {@link ThePicturesFolderIsSwept}
 * never takes it for a stray picture in the moment between the write and the move; it is deleted in
 * {@code finally} if the move did not happen.
 *
 * <p><b>THE LOG NAMES THE KEY AND NOTHING ELSE</b>, as the sweep's does: one line per picture cleaned, none
 * for a run that found nothing.
 */
@Component
class OldPicturesAreCleaned {

	private static final Logger LOG = LoggerFactory.getLogger(OldPicturesAreCleaned.class);

	private final JdbcClient db;

	private final TransactionTemplate inOneTransaction;

	private final Path folder;

	/**
	 * @param folder the setting the other readers of the folder read ({@code btl.photos.folder}), so this
	 *               cleans the files {@link PhotoApi} serves and not a folder of its own
	 */
	OldPicturesAreCleaned(JdbcClient db, TransactionTemplate inOneTransaction,
			@Value("${btl.photos.folder}") String folder) {
		this.db = db;
		this.inOneTransaction = new TransactionTemplate(inOneTransaction.getTransactionManager());
		this.folder = Path.of(folder);
	}

	/** Every row that may still carry metadata, each in a transaction of its own, oldest key first. */
	@Scheduled(fixedDelay = 1, initialDelay = 0, timeUnit = TimeUnit.HOURS)
	void clean() {
		List<Long> waiting = db.sql("select id from photo where may_carry_metadata order by id")
				.query(Long.class)
				.list();

		for (long photo : waiting) {
			inOneTransaction.executeWithoutResult(writing -> clean(photo));
		}
	}

	void clean(long photo) {
		Optional<String> mediaType = db.sql("select media_type from photo where id = ? and may_carry_metadata"
						+ " for update")
				.param(photo)
				.query(String.class)
				.optional();

		if (mediaType.isEmpty()) {
			return;
		}

		Path file = folder.resolve(String.valueOf(photo));
		byte[] stored;

		try {
			stored = PhotoApi.bytesOf(file);
		} catch (IOException unread) {
			LOG.warn("picture {} could not be read under {} to be cleaned: {}", photo, folder, unread.toString());
			return;
		}

		byte[] clean;

		try {
			clean = WithoutMetadata.of(stored, mediaType.get());
		} catch (RuntimeException notAPicture) {
			/* THE DOOR SNIFFS A FILE BEFORE IT CLEANS IT AND THIS DOES NOT, so a file stored under a type it is
			   not (one byte, a truncated copy) throws here. Left uncaught it ends the run at this row and every
			   run after it, and no later picture is ever cleaned; caught, it is the same case as a file that
			   cannot be read. Narrow on purpose: only the cleaning of the bytes, never the database. */
			LOG.warn("picture {} could not be cleaned, its file is not of the type its row says: {}", photo,
					notAPicture.toString());
			return;
		}

		if (!Arrays.equals(clean, stored) && !written(photo, file, clean)) {
			return;
		}

		db.sql("update photo set byte_size = ?, digest = ?, may_carry_metadata = false where id = ?")
				.params(clean.length, WhatAPictureIs.digestOf(clean), photo)
				.update();

		LOG.info("picture {} is cleaned of its metadata", photo);
	}

	/** The cleaned bytes over the old file in one step, or false and a warning where they could not be. */
	private boolean written(long photo, Path file, byte[] clean) {
		Path beside = folder.resolve(photo + ".clean");

		try {
			Files.write(beside, clean);
			Files.move(beside, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
			return true;
		} catch (IOException unwritten) {
			LOG.warn("picture {} could not be written back cleaned under {}: {}", photo, folder,
					unwritten.toString());
			return false;
		} finally {
			try {
				Files.deleteIfExists(beside);
			} catch (IOException stays) {
				LOG.warn("picture {} left {} behind: {}", photo, beside, stays.toString());
			}
		}
	}
}
