package com.btl.portal.web;

import com.btl.portal.domain.photo.AFileWaitingForItsRow;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.DirectoryIteratorException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;
import java.util.concurrent.TimeUnit;

/**
 * THE PICTURES FOLDER IS SWEPT ONCE AN HOUR: A FILE NO {@code photo} ROW NAMES, THAT HAS STOOD
 * THERE LONGER THAN TEN MINUTES, IS DELETED, AND THE LOG SAYS WHICH.
 *
 * <p><b>THE DECISION.</b> The journal's „Zaostao fajl slike brise automatski cistac", which the
 * owner chose on 02.10.2026 among the outcomes offered, with my recommendation beside the one he
 * took. <b>The sentence is mine and the choice is his</b>; it says that when a member removes or
 * replaces a picture and the file cannot be deleted (PDL P28e: the member gets the ordinary
 * answer and the fault goes to the log) the server deletes, once an hour, „fajlove slika koji
 * nemaju svoj red" that are older than ten minutes, and writes to the log what it deleted. What
 * that closes is a leftover this portal accepts on purpose (P28e) and one it cannot avoid, a
 * commit that fails after the file was written ({@link MePhotoApi} names it as its one leak):
 * until this class nothing ever came back for either, and a removal that left its file was a
 * removal in the database only. {@link AFileWaitingForItsRow} holds the two questions that need
 * neither a disk nor a database; this class is what reads the first and asks the second.
 *
 * <p><b>WHAT IT DOES TO ONE ENTRY, in this order, and the order is the cost:</b>
 * <ol>
 * <li>Is its name the {@code String.valueOf} of a key? Anything else in the folder is nobody's
 * picture and is not looked at again.
 * <li>Is it a regular file, asked of the entry itself and not of what it points at
 * ({@link LinkOption#NOFOLLOW_LINKS})? A folder with the name of a key is not deleted, and a
 * case holds that: {@code Files.deleteIfExists} would delete an empty one without a word.
 * <b>A link is not deleted either, and NO CASE HOLDS THAT</b>: a link cannot be made on the
 * machine this is written on without a privilege it does not hold, which {@link PhotoApi}
 * measured for its own flag. What the flag decides is small and is named: with it a link is
 * never a regular file and is left where it is; without it a link to a regular file would pass
 * for one, and the LINK, never what it points at, would be deleted.
 * <li>Has it stood longer than ten minutes, by ITS OWN time of last modification and by the
 * {@link Clock} the portal has?
 * <li>Is there a {@code photo} row with its key? Asked last because it is the only step that
 * costs a round trip, and asked per file and immediately before the delete: a verdict taken at the
 * top of a sweep would be as old as the sweep.
 * </ol>
 *
 * <p><b>A DATABASE THAT CANNOT ANSWER DELETES NOTHING.</b> The query is not wrapped: the fault
 * leaves the method, the scheduler logs it, and no file is touched, because the delete is
 * reached only by a positive answer that there is no row. A sweep that read „I could not ask" as
 * „there is no row" would delete every picture the portal has in an hour, and the case that holds
 * this is {@code aDatabaseThatCannotAnswerDeletesNothing}.
 *
 * <p><b>A FILE THAT WILL NOT GO IS TOLD TO THE OPERATOR AND THE SWEEP GOES ON.</b> One warning
 * with the key and the cause, no stack, because the same fault on a thousand files must not be a
 * thousand stacks (the lesson {@link PhotoApi#theFileOf} paid for in a measured amplifier of a
 * hundred times). It is a warning, which is the level every other place that deletes a file
 * here uses: there is no {@code LOG.error} in this portal. The keys are taken in ascending
 * order as numbers, so that a sweep reads the same on every machine and a fault is always met at
 * the same place.
 *
 * <p><b>THE LOG NAMES THE KEY AND NOTHING ELSE.</b> One line per deleted file, and none when
 * nothing was deleted: an hourly line saying nothing happened is twenty four a day of nothing.
 * The sweep never reads who a picture belonged to - the key is all it knows - so there is no
 * name, address or member number it could write.
 *
 * <p><b>HOURLY, AND THE FIRST SWEEP IS AN HOUR AFTER THE PROCESS STARTS.</b> The delay is on
 * purpose and is held ({@code theSweepIsScheduledOnceAnHourAndAnHourAfterStart}). A sweep at
 * start would run in every Spring context every test class builds, over whatever folder that
 * context points at, and the default folder is a temporary one that other runs on the same
 * machine share. <b>What it costs is named:</b> the timer starts again with the process, so a
 * stack that is redeployed more often than hourly never sweeps. Nothing here measures how often
 * QA is redeployed.
 *
 * <p><b>THE THREE QUESTIONS THE JOURNAL ASKS OF A SCHEDULED JOB.</b> P13 asks of the first one
 * „sta ako ne odradi", „sta ako odradi" (twice) and „sta ako server tog jutra ne radi", and
 * settles them for the 1 January job with „posao je idempotentan" and „pokusava se pri svakom
 * dizanju dok ne prodje". A sweep that does not run is made up for by the next one, an hour
 * later, and a server that was down is swept an hour after it comes back, so the first and the
 * third have one answer here too. <b>The second is the sweep's own property</b>: a file that has
 * been deleted is not listed again, and a file that is gone between the check and the delete is
 * answered by the delete itself and nothing is logged
 * ({@code aFileThatIsGoneByTheTimeItIsDeletedIsNotReportedAsDeleted}); one that is gone before
 * its attributes can be read is a warning that says so, which is true and rare and is held by no
 * case. <b>What the sweep does NOT do is what P13 asks of the 1 January job, to try at every
 * start</b>: its first run is an hour after the start, and that is my choice for the reasons
 * above and not the owner's word.
 *
 * <p><b>WHAT THIS CAN TAKE THAT IT SHOULD NOT, named rather than discovered.</b> The ten
 * minutes are the file's age by its time of last modification, so a copy that KEEPS times
 * arrives looking as old as the file it copies. {@code deploy/pour-from-qa.sh} is exactly that:
 * it copies the photographs with {@code cp -a} (measured inside {@code eclipse-temurin:21-jre},
 * the image the backend runs from: the time of last modification survives it) and does so BEFORE
 * the transaction that writes the rows, by design. A sweep that ran between those two steps on
 * production would find every poured file old and without a row, and delete it.
 * <b>Restarting the production backend immediately before a pour starts the hour again</b>, so by
 * the delay above no sweep can fall between the two steps; that is my reasoning and has not been
 * run. The script is outside this change and is not touched by it. The same arrangement fits a
 * restore of the volume before the database. And a database restored from a dump older than the
 * files makes the files of later uploads strays in THAT database, so they go within the hour;
 * they are files nothing points at there.
 *
 * <p><b>WHAT IT DOES NOT DO.</b> It looks at files and never at rows: a {@code photo} row that
 * nothing holds is not swept, and neither is its file, because the file has a row. By V9's
 * foreign keys and by what {@link CompetitorWriteApi} deletes (read, not run), one such row is
 * made when a member is deleted while a picture of his waits in the queue: the queue row goes
 * with him and the {@code photo} row does not. That is a different leftover and the owner has
 * said nothing about it; it is reported, not handled here.
 *
 * <p><b>IT IS NOT IN {@link MePhotoApi}</b>, whose class note says that sweeping „would be one
 * route carrying a rule about the whole disk". It is a fifth reader of the setting the four
 * other classes read ({@code btl.photos.folder}) and the first that reads the folder instead of
 * a file in it.
 */
@Component
class ThePicturesFolderIsSwept {

	private static final Logger LOG = LoggerFactory.getLogger(ThePicturesFolderIsSwept.class);

	/**
	 * HOW A FILE LEAVES THE DISK, as a seam and not as a call to {@link Files}.
	 *
	 * <p>No way of making a regular file refuse a delete is the same on both systems this is
	 * built on (measured on Windows: a read only flag makes {@code Files.deleteIfExists} throw
	 * {@link java.nio.file.AccessDeniedException}; on Linux a delete is refused by the folder
	 * and not by the file), so a case that needs a refusal passes one of its own; every other
	 * case, and the portal, delete for real through {@code Files::deleteIfExists}. The answer is
	 * the one {@link Files#deleteIfExists} gives: whether this call deleted anything.
	 */
	@FunctionalInterface
	interface Deleter {

		boolean delete(Path file) throws IOException;
	}

	private final JdbcClient db;

	private final Clock clock;

	private final Path folder;

	private final Deleter deleter;

	/**
	 * @param folder the same setting {@link MePhotoApi}, {@link PhotoApi},
	 *               {@link CompetitorWriteApi} and {@link ATeamGoesWithItsLastMember} read, and it
	 *               must be the same one: a second copy would be a second home for the folder a
	 *               picture's file actually lives in
	 */
	@Autowired
	ThePicturesFolderIsSwept(JdbcClient db, Clock clock,
			@Value("${btl.photos.folder}") String folder) {

		this(db, clock, Path.of(folder), Files::deleteIfExists);
	}

	ThePicturesFolderIsSwept(JdbcClient db, Clock clock, Path folder, Deleter deleter) {
		this.db = db;
		this.clock = clock;
		this.folder = folder;
		this.deleter = deleter;
	}

	/**
	 * THE SWEEP. Once an hour, with the first one an hour after the process starts.
	 *
	 * <p>{@code fixedDelay} and not {@code fixedRate}: the next sweep waits an hour after this one
	 * has finished, so a slow volume cannot make them run back to back.
	 */
	@Scheduled(fixedDelay = 1, initialDelay = 1, timeUnit = TimeUnit.HOURS)
	void sweep() {
		Instant now = clock.instant();

		for (Map.Entry<Long, Path> candidate : theFilesNamedLikePictures().entrySet()) {
			long key = candidate.getKey();
			Path file = candidate.getValue();

			try {
				if (goes(key, file, now) && deleter.delete(file)) {
					LOG.info("the file of picture {} was deleted: no photo row has that key", key);
				}
			}
			catch (IOException noGo) {
				LOG.warn("the file of picture {} could not be examined or deleted: {}", key,
						noGo.toString());
			}
		}
	}

	/**
	 * EVERY ENTRY WHOSE NAME IS A KEY, in ascending order of the key as a number.
	 *
	 * <p>A folder that is not there is not a fault: a portal nobody has uploaded to has none, and
	 * the route that writes the first picture makes it. A folder that cannot be read is told to
	 * the operator by its path, because the line has to say which setting to look at, and what
	 * was read before the fault is still swept: every file is checked on its own.
	 *
	 * <p><b>The catch for a fault in the MIDDLE of a listing is held by no case.</b> It shares a
	 * handler with a folder that cannot be opened, which is held, and it needs a file system that
	 * fails halfway through a directory, which the cases cannot make.
	 */
	private SortedMap<Long, Path> theFilesNamedLikePictures() {
		SortedMap<Long, Path> found = new TreeMap<>();

		try (DirectoryStream<Path> entries = Files.newDirectoryStream(folder)) {
			for (Path entry : entries) {
				AFileWaitingForItsRow.keyOf(entry.getFileName().toString())
						.ifPresent(key -> found.put(key, entry));
			}
		}
		catch (NoSuchFileException nothingWasEverUploaded) {
			// No folder, no files: nothing to sweep and nothing to say.
		}
		catch (IOException | DirectoryIteratorException unreadable) {
			LOG.warn("the pictures folder {} could not be read: {}", folder, unreadable.toString());
		}

		return found;
	}

	/**
	 * WHETHER THIS ENTRY IS A LEFTOVER, the cheap questions first and the database last.
	 *
	 * <p>The attributes are read of the entry itself, so a link is not followed and is never a
	 * regular file here. Written as one expression so that a step cannot be reordered past the
	 * query: the database is asked only about an entry that is a file, that is old enough.
	 */
	private boolean goes(long key, Path file, Instant now) throws IOException {
		BasicFileAttributes found = Files.readAttributes(file, BasicFileAttributes.class,
				LinkOption.NOFOLLOW_LINKS);

		return found.isRegularFile()
				&& AFileWaitingForItsRow.hasWaitedLongEnough(found.lastModifiedTime().toInstant(), now)
				&& !hasARow(key);
	}

	private boolean hasARow(long key) {
		return db.sql("select exists (select 1 from photo where id = ?)")
				.param(key)
				.query(Boolean.class)
				.single();
	}
}
