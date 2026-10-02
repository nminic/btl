package com.btl.portal.web;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.AbstractDataSource;
import org.springframework.scheduling.config.FixedDelayTask;
import org.springframework.scheduling.config.ScheduledTask;
import org.springframework.scheduling.config.ScheduledTaskHolder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.io.IOException;
import java.sql.Connection;
import java.sql.SQLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * THE PICTURES FOLDER IS SWEPT: A FILE NO {@code photo} ROW NAMES, AND THAT HAS STOOD LONGER
 * THAN TEN MINUTES, GOES, AND NOTHING ELSE DOES.
 *
 * <p><b>THE DECISION THIS HOLDS</b> is the journal's „Zaostao fajl slike brise automatski
 * cistac", chosen by the owner among the outcomes offered with my recommendation beside the
 * one he took; the sentence is mine and his is the choice.
 *
 * <p><b>NOT {@code @Transactional}</b>, for the reason the two cases next door give for
 * standing apart: the sweep asks the database from its own call and must see COMMITTED rows,
 * and a test-managed transaction would hide that the question was asked of the right table.
 * What every case writes it takes back in {@link #takeBackWhatWasReallyCommitted}.
 *
 * <p><b>EVERY CASE HAS BOTH STATES OF THE FACT IT IS ABOUT, IN ONE FOLDER</b>, because the
 * sweep reads three facts per file and a fixture holding one value of each would pass for
 * any reading of them:
 * <ul>
 * <li><b>Whether the file has a row.</b> A stray beside a file that has one, so „no row" and
 * „has a row" cannot be swapped without a case failing.
 * <li><b>How old it is.</b> A stray of nine minutes beside one of eleven, written in the SAME
 * folder: an age read off the folder, off the neighbour, or off the first file it met gives
 * both files one answer and so fails one of the two assertions.
 * <li><b>What kind of entry it is.</b> A name a key could not be, and a directory with the
 * name of a key, each beside a stray that does go - so „stays" always means „the sweep ran
 * and left it" and never „the sweep did nothing".
 * <li><b>What time it is.</b> The clock the cases move stands in 2031 and the machine's does
 * not, so a sweep that read the machine's gets the wrong answer on both edges.
 * </ul>
 *
 * <p><b>THE KEYS ARE THE ONES THE SEQUENCE ISSUES</b>, and a stray's key is a picture that was
 * made and then deleted, which is exactly how one comes to exist: the row goes, the file stays.
 * So a stray's key is never the key of any row in the case and never the same number as another
 * file's, and a log line naming a neighbour's key cannot pass for the right one.
 *
 * <p><b>WHAT IS STUBBED IS THE DELETE IN THREE CASES AND THE DATABASE IN ONE, AND NOTHING ELSE
 * IS.</b> No way of making a regular file refuse a delete is the same on both of the systems this
 * is built on: measured on Windows, a read only flag makes the delete throw, and on Linux a delete
 * is refused by the folder and not by the file. A case that only runs where it is written is a
 * case nobody watches, so the two that need a refusal or a „gone already" pass a
 * {@link ThePicturesFolderIsSwept.Deleter} of their own, the third only records the order and
 * deletes for real, and the one that needs a database that cannot answer hands the sweep a data
 * source that refuses every connection. Every other case deletes for real and asks the real one.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class ThePicturesFolderIsSweptTest {

	/**
	 * A MOMENT THE MACHINE IS NOT AT, and not by hours: five years ahead of the day this was
	 * written, so a sweep that asked the machine what time it is would find every file in the
	 * folder dated in its future.
	 */
	private static final Instant A_MOMENT_THE_MACHINE_IS_NOT_AT =
			Instant.parse("2031-03-15T10:00:00Z");

	/** A FOLDER OF THIS RUN'S OWN, so that another run or another worktree cannot sweep it. */
	private static final Path PHOTOS = aFolderOfThisRunsOwn();

	private static long digests;

	private static Path aFolderOfThisRunsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-sweep-");
		}
		catch (IOException noFolder) {
			throw new IllegalStateException("no temporary folder to keep pictures in", noFolder);
		}
	}

	@DynamicPropertySource
	static void thePortalKeepsItsPicturesHere(DynamicPropertyRegistry registry) {
		registry.add("btl.photos.folder", PHOTOS::toString);
	}

	/**
	 * A clock the case moves, the shape every case that needs a boundary in time carries. The
	 * zone is UTC and is not read by the sweep at all, which is why nothing here depends on it.
	 */
	static final class AClockTheCaseMoves extends Clock {

		private Instant now;

		private AClockTheCaseMoves(Instant now) {
			this.now = now;
		}

		void moveTo(Instant when) {
			this.now = when;
		}

		@Override
		public Instant instant() {
			return now;
		}

		@Override
		public ZoneId getZone() {
			return ZoneOffset.UTC;
		}

		@Override
		public Clock withZone(ZoneId zone) {
			return Clock.fixed(now, zone);
		}
	}

	@TestConfiguration(proxyBeanMethods = false)
	static class TheClockThisCaseUses {

		@Bean
		@Primary
		AClockTheCaseMoves aClockTheCaseMoves() {
			return new AClockTheCaseMoves(A_MOMENT_THE_MACHINE_IS_NOT_AT);
		}
	}

	@Autowired
	private JdbcClient db;

	@Autowired
	private AClockTheCaseMoves clock;

	@Autowired
	private ThePicturesFolderIsSwept sweeper;

	@Autowired
	private ObjectProvider<ScheduledTaskHolder> schedulers;

	/** Where the picture table stood before this case, so the clean up takes only what it wrote. */
	private long picturesBefore;

	@BeforeEach
	void aClockOfOurOwnAndAFolderWithNothingInIt() {
		clock.moveTo(A_MOMENT_THE_MACHINE_IS_NOT_AT);
		picturesBefore = db.sql("select coalesce(max(id), 0) from photo").query(Long.class).single();
	}

	@AfterEach
	void takeBackWhatWasReallyCommitted() throws IOException {
		db.sql("delete from photo where id > ?").param(picturesBefore).update();

		try (Stream<Path> everything = Files.walk(PHOTOS)) {
			for (Path one : everything.sorted(Comparator.reverseOrder()).toList()) {
				if (!one.equals(PHOTOS)) {
					Files.delete(one);
				}
			}
		}
	}

	@AfterAll
	static void theFolderGoesToo() throws IOException {
		Files.deleteIfExists(PHOTOS);
	}

	/** One picture row, with the digest the schema keeps unique. */
	private long aPicture() {
		return db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values ('image/jpeg', 40960, ?, 0.3, 0.7, 0.45)"
						+ " returning id")
				.param(String.format("%064x", ++digests)).query(Long.class).single();
	}

	/**
	 * A KEY NO ROW HAS, which is a picture that was made and taken away again: the sequence
	 * handed the key out and will not hand it out twice, so nothing can come to hold it.
	 */
	private long aKeyNoRowHas() {
		long key = aPicture();

		db.sql("delete from photo where id = ?").param(key).update();

		return key;
	}

	/** A file of this key, last written at that moment. */
	private static Path aFile(long key, Instant modified) throws IOException {
		Path file = PHOTOS.resolve(String.valueOf(key));

		Files.writeString(file, "the bytes of picture " + key);
		Files.setLastModifiedTime(file, FileTime.from(modified));

		return file;
	}

	private Instant minutesAgo(long minutes) {
		return clock.instant().minus(Duration.ofMinutes(minutes));
	}

	private long rowsOf(long key) {
		return db.sql("select count(*) from photo where id = ?").param(key).query(Long.class).single();
	}

	/** What the sweep said to the log while it ran. */
	private record Heard(List<ILoggingEvent> events) {

		List<String> messages() {
			return events.stream().map(ILoggingEvent::getFormattedMessage).toList();
		}
	}

	/**
	 * THE LOGGER IS ASKED AND NO LOG FILE IS READ, which is the difference between measuring
	 * what the sweep said and measuring how it was spelt: logback keeps the level and the
	 * message as fields of the event.
	 */
	private static Heard heardWhile(Runnable sweeping) {
		Logger speaking = (Logger) LoggerFactory.getLogger(ThePicturesFolderIsSwept.class);
		ListAppender<ILoggingEvent> heard = new ListAppender<>();

		heard.start();
		speaking.addAppender(heard);

		try {
			sweeping.run();

			return new Heard(List.copyOf(heard.list));
		}
		finally {
			speaking.detachAppender(heard);
			heard.stop();
		}
	}

	private Heard sweeping() {
		return heardWhile(sweeper::sweep);
	}

	private static String deletedLine(long key) {
		return "the file of picture " + key + " was deleted: no photo row has that key";
	}

	/**
	 * A FILE NO ROW HAS GOES ONCE IT HAS WAITED LONGER THAN TEN MINUTES, AND THE LOG NAMES EACH
	 * ONE BY ITS KEY AND BY NOTHING ELSE.
	 *
	 * <p>Two strays and a file with a row, so a line naming the neighbour, the last file met,
	 * or the key plus one would read as a line about the wrong file. The lines are held as
	 * whole sentences: this is the portal's own prose and nobody else's, and a sentence held
	 * whole is what says „a key and nothing personal" - the sweep never reads who a picture
	 * belongs to, and there is nowhere in this line for it to arrive.
	 */
	@Test
	void aFileNoRowHasThatHasWaitedLongEnoughGoesAndTheLogNamesEachByItsKey() throws IOException {
		long first = aKeyNoRowHas();
		long held = aPicture();
		long second = aKeyNoRowHas();

		Path firstFile = aFile(first, minutesAgo(11));
		Path heldFile = aFile(held, minutesAgo(11));
		Path secondFile = aFile(second, minutesAgo(30));

		Heard heard = sweeping();

		assertThat(firstFile).as("a file no row has, eleven minutes old, was left on the disk")
				.doesNotExist();
		assertThat(secondFile).as("a file no row has, half an hour old, was left on the disk")
				.doesNotExist();
		assertThat(heldFile).as("the file of a picture that has a row went with the strays").exists();
		assertThat(heard.messages()).containsExactly(deletedLine(first), deletedLine(second));
		assertThat(heard.events()).allSatisfy(said -> assertThat(said.getLevel()).isEqualTo(Level.INFO));
	}

	/**
	 * A STRAY THAT HAS NOT WAITED LONG ENOUGH STAYS, AND IT IS THE ROW ALONE THAT IS NOT YET
	 * VISIBLE.
	 *
	 * <p>This is the whole of why the limit exists: the route writes the file BEFORE its
	 * transaction commits, so for a moment a good picture is a file with no row. Nine minutes
	 * beside eleven in one folder, so the verdict is read off each file's own time.
	 */
	@Test
	void aFileNoRowHasThatIsYoungerThanTheLimitStaysBesideAnOlderOneThatGoes() throws IOException {
		long young = aKeyNoRowHas();
		long old = aKeyNoRowHas();

		Path youngFile = aFile(young, minutesAgo(9));
		Path oldFile = aFile(old, minutesAgo(11));

		Heard heard = sweeping();

		assertThat(youngFile).as("a file with no row that is nine minutes old was swept: its row may be"
				+ " a moment from being visible").exists();
		assertThat(oldFile).as("a file with no row that is eleven minutes old was left").doesNotExist();
		assertThat(heard.messages()).containsExactly(deletedLine(old));
	}

	/**
	 * A FILE WITH A ROW STAYS HOWEVER OLD, AND A STRAY BESIDE IT GOES.
	 *
	 * <p>Three days, which is a picture that has stood on a profile since before this ran. The
	 * stray is what makes the case read both ways: a sweep that had the row test backwards
	 * would delete the old picture and keep the stray, and fail both assertions.
	 */
	@Test
	void aFileThatHasARowStaysHoweverOldAndBesideOneThatHasNone() throws IOException {
		long held = aPicture();
		long stray = aKeyNoRowHas();

		Path heldFile = aFile(held, minutesAgo(3 * 24 * 60));
		Path strayFile = aFile(stray, minutesAgo(3 * 24 * 60));

		sweeping();

		assertThat(heldFile).as("the file of a picture that has a row was deleted").exists();
		assertThat(strayFile).as("the file of a picture that has no row was left").doesNotExist();
	}

	/**
	 * A ROW WITH NO FILE IS NOT THE SWEEP'S BUSINESS: IT IS NOT TOUCHED, NOTHING IS REPORTED,
	 * AND THE SWEEP DOES NOT FAIL.
	 *
	 * <p>It is a state the portal expects - the deploy notes say that dropping the pictures
	 * volume loses pictures "whose rows will then answer 404" - and {@code PhotoApi} already names
	 * it when somebody asks for the picture. The stray beside it is what proves the sweep ran.
	 */
	@Test
	void aRowWithNoFileIsNotTouchedAndNothingIsSaidAboutIt() throws IOException {
		long rowOnly = aPicture();
		long stray = aKeyNoRowHas();

		aFile(stray, minutesAgo(11));

		Heard heard = sweeping();

		assertThat(rowsOf(rowOnly)).as("the sweep took a row away because its file was not there")
				.isOne();
		assertThat(heard.messages()).containsExactly(deletedLine(stray));
	}

	/**
	 * WHAT IS NOT THE FILE OF A PICTURE IS NOT TOUCHED, however old it is and whether or not any
	 * row could be said to name it.
	 *
	 * <p>Every name here is one the writer cannot have written: its own
	 * {@code String.valueOf} of a key never gives a leading zero, a sign, an extension, or a
	 * number beyond what a {@code bigserial} holds. A sweep that deleted by „looks like a
	 * number" would take them all, and a sweep that deleted everything in the folder would take
	 * them with the strays.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"notes.txt", "0", "007", "-5", "+5", "12.jpg", "12abc",
			"9223372036854775808", "lost+found", ".hidden"})
	void whatIsNotAPicturesFileIsNotTouched(String name) throws IOException {
		long stray = aKeyNoRowHas();
		Path strayFile = aFile(stray, minutesAgo(11));
		Path odd = PHOTOS.resolve(name);

		Files.writeString(odd, "not a picture");
		Files.setLastModifiedTime(odd, FileTime.from(minutesAgo(3 * 24 * 60)));

		sweeping();

		assertThat(strayFile).as("the sweep did not run: the stray beside it is still there")
				.doesNotExist();
		assertThat(odd).as("the sweep deleted %s, which is not the file of any picture", name)
				.exists();
	}

	/**
	 * A FOLDER WITH THE NAME OF A KEY IS NOT A FILE, AND IT IS EMPTY ON PURPOSE.
	 *
	 * <p>{@code Files.deleteIfExists} refuses a folder that holds something and deletes one that
	 * does not, so a sweep that skipped the check for „is it a file" would pass a case that used
	 * a full one: it would be refused by the file system, logged, and the case would look
	 * satisfied. An empty one is what the mutation takes.
	 */
	@Test
	void aFolderWithTheNameOfAKeyIsNotTouched() throws IOException {
		long named = aKeyNoRowHas();
		long stray = aKeyNoRowHas();
		Path folder = Files.createDirectory(PHOTOS.resolve(String.valueOf(named)));
		Path strayFile = aFile(stray, minutesAgo(11));

		Files.setLastModifiedTime(folder, FileTime.from(minutesAgo(3 * 24 * 60)));

		Heard heard = sweeping();

		assertThat(folder).as("the sweep deleted a folder").isDirectory();
		assertThat(strayFile).doesNotExist();
		assertThat(heard.messages()).containsExactly(deletedLine(stray));
	}

	/**
	 * A FILE THAT WILL NOT GO IS REPORTED BY ITS KEY AND THE OTHERS STILL GO.
	 *
	 * <p>The one that refuses has the SMALLEST key, so the sweep meets it first and the two
	 * after it are what „carry on" is measured on: a sweep that stopped at the first fault, or
	 * let it leave the method, leaves them where they are. The line is a warning, because it is
	 * what the operator has to act on, and it names the key and the cause and carries no stack:
	 * the same fault on a thousand files must not be a thousand stacks.
	 */
	@Test
	void aFileThatWillNotGoIsReportedByItsKeyAndTheOthersStillGo() throws IOException {
		long refuses = aKeyNoRowHas();
		long second = aKeyNoRowHas();
		long third = aKeyNoRowHas();

		Path refusingFile = aFile(refuses, minutesAgo(11));
		Path secondFile = aFile(second, minutesAgo(11));
		Path thirdFile = aFile(third, minutesAgo(11));

		ThePicturesFolderIsSwept stubborn = new ThePicturesFolderIsSwept(db, clock, PHOTOS, file -> {
			if (file.getFileName().toString().equals(String.valueOf(refuses))) {
				throw new IOException("the disk said no");
			}

			return Files.deleteIfExists(file);
		});

		Heard heard = heardWhile(stubborn::sweep);

		assertThat(refusingFile).as("the file that was refused is the one that was left").exists();
		assertThat(secondFile).as("a fault on one file stopped the sweep before this one")
				.doesNotExist();
		assertThat(thirdFile).as("a fault on one file stopped the sweep before this one")
				.doesNotExist();

		assertThat(heard.events()).hasSize(3);

		ILoggingEvent warned = heard.events().get(0);

		assertThat(warned.getLevel()).as("the fault was not logged at WARN").isEqualTo(Level.WARN);
		assertThat(warned.getFormattedMessage())
				.isEqualTo("the file of picture " + refuses + " could not be examined or deleted:"
						+ " java.io.IOException: the disk said no");
		assertThat(warned.getThrowableProxy()).as("a stack for every file that will not go").isNull();
		assertThat(heard.messages().subList(1, 3))
				.containsExactly(deletedLine(second), deletedLine(third));
	}

	/**
	 * A FILE THAT HAS GONE BY THE TIME IT IS DELETED IS NOT REPORTED AS DELETED.
	 *
	 * <p>{@code deleteIfExists} says whether it deleted anything. The sweep is the one reader
	 * of that answer: a line „deleted" for a file that was already gone would tell the
	 * operator the sweep did something it did not.
	 */
	@Test
	void aFileThatIsGoneByTheTimeItIsDeletedIsNotReportedAsDeleted() throws IOException {
		long stray = aKeyNoRowHas();

		aFile(stray, minutesAgo(11));

		ThePicturesFolderIsSwept toolate = new ThePicturesFolderIsSwept(db, clock, PHOTOS, file -> false);

		assertThat(heardWhile(toolate::sweep).events())
				.as("the sweep reported a deletion that did not happen, or a fault where there was none")
				.isEmpty();
	}

	/**
	 * THE KEYS ARE TAKEN IN ASCENDING ORDER, AS NUMBERS AND NOT AS NAMES.
	 *
	 * <p>The case above that holds „carry on" puts the refusing file first, and it can only
	 * mean that if the order is the same on every machine. Two keys of different lengths, whose
	 * order as numbers is the opposite of their order as text, so a sweep that took the folder
	 * in the order the file system lists it - the order of the names on one of the two systems
	 * this is built on - is heard.
	 */
	@Test
	void theKeysAreTakenInAscendingOrderAsNumbersAndNotAsNames() throws IOException {
		long shorter = 9_000_000_000L;
		long longer = 10_000_000_000L;

		aFile(longer, minutesAgo(11));
		aFile(shorter, minutesAgo(11));

		List<String> order = new ArrayList<>();
		ThePicturesFolderIsSwept recording = new ThePicturesFolderIsSwept(db, clock, PHOTOS, file -> {
			order.add(file.getFileName().toString());

			return Files.deleteIfExists(file);
		});

		recording.sweep();

		assertThat(order).containsExactly(String.valueOf(shorter), String.valueOf(longer));
	}

	/**
	 * THE SWEEP TELLS TIME BY THE CLOCK THE PORTAL HAS AND BY NOTHING ELSE.
	 *
	 * <p>One file, one stray, and the clock moved across the edge: nine minutes after the file
	 * was written it stays and eleven minutes after it goes. The machine's own clock is years
	 * away from both, so a sweep that read it would find the file dated in its future on the
	 * first sweep and on the second, and the second assertion fails.
	 */
	@Test
	void theSweepTellsTimeByTheClockAndByNothingElse() throws IOException {
		long stray = aKeyNoRowHas();
		Path file = aFile(stray, A_MOMENT_THE_MACHINE_IS_NOT_AT);

		clock.moveTo(A_MOMENT_THE_MACHINE_IS_NOT_AT.plus(Duration.ofMinutes(9)));
		sweeping();

		assertThat(file).as("the file went nine minutes after it was written").exists();

		clock.moveTo(A_MOMENT_THE_MACHINE_IS_NOT_AT.plus(Duration.ofMinutes(11)));
		sweeping();

		assertThat(file).as("the file stayed eleven minutes after it was written").doesNotExist();
	}

	/**
	 * A DATABASE THAT CANNOT ANSWER DELETES NOTHING.
	 *
	 * <p>The one failure whose wrong handling is a catastrophe and not a nuisance: a sweep that
	 * read „I could not ask" as „there is no row" would take every picture on the portal in one
	 * hour. The stray is old and has no row, so it is exactly what such a sweep would delete,
	 * and the case holds that the fault leaves the method and the file stays.
	 */
	@Test
	void aDatabaseThatCannotAnswerDeletesNothing() throws IOException {
		long stray = aKeyNoRowHas();
		Path strayFile = aFile(stray, minutesAgo(11));

		ThePicturesFolderIsSwept blind = new ThePicturesFolderIsSwept(
				JdbcClient.create(new ADatabaseThatIsDown()), clock, PHOTOS, Files::deleteIfExists);

		assertThatThrownBy(blind::sweep).isInstanceOf(DataAccessException.class);
		assertThat(strayFile).as("a sweep that could not ask the database deleted a file").exists();
	}

	private static final class ADatabaseThatIsDown extends AbstractDataSource {

		@Override
		public Connection getConnection() throws SQLException {
			throw new SQLException("the database is down");
		}

		@Override
		public Connection getConnection(String username, String password) throws SQLException {
			throw new SQLException("the database is down");
		}
	}

	/**
	 * A FOLDER THAT IS NOT THERE IS NOT A FAULT: a portal nobody has uploaded to has none yet,
	 * and the route that writes the first picture makes it.
	 */
	@Test
	void aFolderThatIsNotThereIsNotAFault() {
		ThePicturesFolderIsSwept nowhere = new ThePicturesFolderIsSwept(db, clock,
				PHOTOS.resolve("nothing-was-ever-uploaded"), Files::deleteIfExists);

		assertThat(heardWhile(nowhere::sweep).events())
				.as("the sweep spoke about a folder that was never made")
				.isEmpty();
	}

	/**
	 * A FOLDER THAT CANNOT BE READ IS REPORTED AND NOT THROWN, and what it is called is the
	 * folder: an operator looking at the line has to know which setting to look at.
	 */
	@Test
	void aFolderThatCannotBeReadIsReportedAndNotThrown() throws IOException {
		Path notAFolder = Files.writeString(PHOTOS.resolve("a-file-where-the-folder-should-be"), "x");

		ThePicturesFolderIsSwept confused = new ThePicturesFolderIsSwept(db, clock, notAFolder,
				Files::deleteIfExists);

		Heard heard = heardWhile(confused::sweep);

		assertThat(heard.events()).hasSize(1);
		assertThat(heard.events().get(0).getLevel()).isEqualTo(Level.WARN);
		assertThat(heard.events().get(0).getFormattedMessage())
				.startsWith("the pictures folder " + notAFolder + " could not be read: ");
	}

	/**
	 * IT IS SCHEDULED, ONCE AN HOUR, AND THE FIRST SWEEP IS AN HOUR AFTER START.
	 *
	 * <p>Asked of the scheduler the context really built and not of the annotation's text, so
	 * this is also what says scheduling is switched on at all: with the switch off there is no
	 * task and the case finds none. <b>The hour before the first sweep is on purpose</b> and
	 * is the second thing held: a sweep at start would run in every context every test class
	 * builds, over whatever folder that context points at.
	 */
	@Test
	void theSweepIsScheduledOnceAnHourAndAnHourAfterStart() {
		List<ScheduledTask> theSweeps = theTasksOfTheSweep();

		assertThat(theSweeps).as("the scheduler holds no task that runs the sweep").hasSize(1);
		assertThat(theSweeps.get(0).getTask()).isInstanceOf(FixedDelayTask.class);

		FixedDelayTask every = (FixedDelayTask) theSweeps.get(0).getTask();

		assertThat(every.getIntervalDuration()).isEqualTo(Duration.ofHours(1));
		assertThat(every.getInitialDelayDuration()).isEqualTo(Duration.ofHours(1));
	}

	/**
	 * AND THE TASK THE SCHEDULER HOLDS REALLY SWEEPS, which ties „it is scheduled" to „what is
	 * scheduled does the work": the runnable is taken out of the scheduler and run, over the
	 * real deleter and the folder the setting names.
	 */
	@Test
	void theTaskTheSchedulerHoldsDoesTheSweep() throws IOException {
		long stray = aKeyNoRowHas();
		Path strayFile = aFile(stray, minutesAgo(11));

		theTasksOfTheSweep().get(0).getTask().getRunnable().run();

		assertThat(strayFile).as("the task the scheduler holds did not sweep").doesNotExist();
	}

	/**
	 * THE TASKS THE SCHEDULER HOLDS FOR THE SWEEP, named the way the scheduler names them.
	 *
	 * <p>A task describes itself as {@code <class>.<method>}, which is the description the
	 * actuator's own scheduled tasks endpoint prints. It is asked that way and not by looking
	 * for the {@code ScheduledMethodRunnable} inside it, because Spring 7 wraps every runnable
	 * in a package private class that tracks its last outcome and gives no way back to what it
	 * wraps - measured, the runnable of this task is not a {@code ScheduledMethodRunnable}.
	 */
	private List<ScheduledTask> theTasksOfTheSweep() {
		String theSweep = ThePicturesFolderIsSwept.class.getName() + ".sweep";

		return schedulers.stream()
				.flatMap(each -> each.getScheduledTasks().stream())
				.distinct()
				.filter(task -> task.getTask().getRunnable().toString().equals(theSweep))
				.toList();
	}
}
