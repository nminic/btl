package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.photo.WhatAPictureIs;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

/**
 * A MEMBER WHO SENDS HIS FIRST PICTURE TWICE AT ONCE LEAVES ONE PICTURE WAITING, AND BOTH SENDS ARE
 * ANSWERED.
 *
 * <p><b>The owner's decision, PDL, „Ponovno slanje pregazi red koji ceka, ne pravi drugi"
 * (27.09.2026):</b> sending again „gazi trenutan red kod verifikatora", and „Red ostaje jedan".
 * Every sequential case in {@code MePhotoApiTest} already held that for a member whose picture is
 * waiting, and none of them could see the hole this file is about: for a FIRST send the question
 * „does a picture of his wait" returns no row, so the {@code for update} on it locks nothing, and
 * two first sends that both asked before either wrote were both told „nothing waits" and both
 * opened a row. Measured on 09.10.2026 on the code before the turn existed, with this case
 * written first: both sends were answered 200, with two different queue rows, two pictures of one
 * member waiting, both of their {@code photo} rows held, and both files on the disk.
 *
 * <p><b>The fix is two things, and this file holds the one that is not a constraint.</b>
 * {@code MePhotoApi} makes the sends of one member take turns, so the second asks after the first
 * has committed and goes down the overwrite road; V55's
 * {@code verification_one_picture_waits_per_member} is the floor under that. The index is held by
 * {@code VerificationConstraintsTest}, {@code KeysAndIndexesTest} and
 * {@code OnePictureWaitsCarriedOverTest}, and nothing in THIS file can see it go: with the turn and
 * without the index the cases below still leave one row (measured 09.10.2026). The turn is what
 * these cases hold, in two ways. The three cases about FIRST sends at once (two, three, and the
 * comparison with one after the other) fail if the turn is taken out or taken after the question
 * (measured 09.10.2026); made session-scoped, the case that asks the lock manager fails at once and
 * the forced cases after it fail behind the lock it leaves. The others hold what the turn must not
 * do: hold up another member, stay held after a send that worked or one that failed, or take from a
 * send over a waiting picture the serialising it already had.
 *
 * <p><b>NOT {@code @Transactional}</b>, for the reason {@code ATextSentTwiceAtOnceTest} gives: a
 * test-managed transaction is bound to the calling thread, so the requests below each get a
 * connection and a transaction of their own and really do overlap. The rows are real commits, and
 * {@link #nothingOfItIsLeftBehind} takes them back out whether the case passed or not.
 *
 * <p><b>THE ORDER IS TAKEN AWAY FROM THE SCHEDULER, the way the precedent takes it.</b> The case
 * holds one row of the database before any request is sent, so every request stops inside it, and
 * only then lets the row go. For a FIRST send the row is the member's own: the insert of his queue
 * row takes {@code FOR KEY SHARE} on it through the foreign key, which a held {@code FOR UPDATE}
 * refuses, and the first request stops there while the others stop behind its turn. For a send over
 * a picture that WAITS the row is the queue row, which every send asks for with {@code for update}.
 * {@code BlockedBehindThisHold} counts the requests the lock manager shows stopped, and the case
 * requires all of them before it lets go.
 *
 * <p><b>The assertions are INVARIANTS and never „the first request wins".</b> Which request gets
 * its turn first is not a thing a case may claim, so they say what is true whichever it was: every
 * send is answered 200, every answer names the one queue row that waits, one picture of the member
 * waits, one of the pictures sent has a {@code photo} row and the others have none, the folder holds
 * exactly that picture's file, and the member's own screen is told that picture is the one waiting.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class APictureSentTwiceAtOnceTest {

	/**
	 * A FOLDER OF THIS RUN'S OWN, for the reason {@code MePhotoApiTest} gives: the default is one
	 * folder shared by every run on the machine, and a file here is named by a {@code bigserial}
	 * that starts again at one in every fresh Testcontainers database.
	 */
	private static final Path PHOTOS = aFolderOfThisRunsOwn();

	private static Path aFolderOfThisRunsOwn() {
		try {
			return Files.createTempDirectory("btl-photos-twice-");
		}
		catch (IOException noFolder) {
			throw new UncheckedIOException(noFolder);
		}
	}

	@DynamicPropertySource
	static void thePortalKeepsItsPicturesHere(DynamicPropertyRegistry registry) {
		registry.add("btl.photos.folder", PHOTOS::toString);
	}

	/** Distinct from every other fixture's members, on purpose: these rows are committed. */
	private static final AtomicInteger ISSUED = new AtomicInteger();

	/**
	 * What is true of ANY number of sends of one member, however they were interleaved: all answered,
	 * all naming the one row that waits, one picture waiting, one of the pictures sent kept and the
	 * rest gone, and one file on the disk. It is also what one send after another leaves, and the
	 * case that says so compares the two.
	 */
	private static final Shape WHAT_ANY_NUMBER_OF_SENDS_LEAVE = new Shape(true, true, 1, 1, 1);

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private ObjectMapper mapper;

	/** The row's own lock, held from this thread so every request queues behind it. */
	@Autowired
	private TransactionTemplate holdingTheRow;

	private final List<Member> members = new ArrayList<>();

	/** One member the case made, with the cookie of his session. */
	private record Member(long id, String address, SecretToken session) {
	}

	/**
	 * What a send came back with: the status and body of an answer, or the exception that came out
	 * of the dispatcher in the place of one (status -1), which on a real socket is a 500.
	 */
	private record Answer(int status, String body, String threw) {
	}

	/**
	 * What was left behind, as numbers.
	 *
	 * @param everyoneAnswered200          every send came back 200
	 * @param everyAnswerNamesTheRowThatWaits the {@code waiting} key in every answer is the id of
	 *                                     the one queue row that waits
	 * @param picturesWaiting              queue rows of his in the profiles tab, waiting, with a picture
	 * @param photoRowsOfWhatWasSent       {@code photo} rows that exist for the pictures that were sent
	 * @param filesOnTheDisk               files in the folder
	 */
	private record Shape(boolean everyoneAnswered200, boolean everyAnswerNamesTheRowThatWaits,
			long picturesWaiting, long photoRowsOfWhatWasSent, long filesOnTheDisk) {
	}

	@AfterEach
	void nothingOfItIsLeftBehind() throws IOException {
		/* The folder first: a case that replaced it with a file must not leave the next one without. */
		if (Files.isRegularFile(PHOTOS)) {
			Files.delete(PHOTOS);
			Files.createDirectory(PHOTOS);
		}

		/* Real commits, so a real delete, children before parents. Taking the queue rows out is what
		   lets the database take the photo rows with them (V54). */
		for (Member made : members) {
			db.sql("delete from verification where competitor_id = ?").param(made.id()).update();
			db.sql("delete from account where email = ?").param(made.address()).update();
			db.sql("delete from competitor where id = ?").param(made.id()).update();
		}

		emptyTheFolder();
	}

	/* ------------------------------------------------------------------------------------------
	   THE CASES
	   ------------------------------------------------------------------------------------------ */

	/**
	 * TWO FIRST SENDS AT ONCE: ONE PICTURE WAITS, AND BOTH SENDS ARE TOLD SO.
	 *
	 * <p>The sentence the plan asks for: what the second of two simultaneous FIRST sends gets, and
	 * what stays in the database, is what it would have been had the second arrived after the first.
	 */
	@Test
	void twoFirstSendsAtOnceLeaveOnePictureWaitingAndBothAreAnswered() throws Exception {
		Member me = aMember();
		byte[] one = aJpeg("prvo slanje, istovremeno");
		byte[] other = aJpeg("drugo slanje, istovremeno");

		List<Answer> both = atOnceBehind(holdingTheMemberRowOf(me), me, one, other);

		assertWhatAnyNumberOfSendsLeave(me, both, one, other);
	}

	/**
	 * THREE FIRST SENDS AT ONCE, which is a member who presses the button three times.
	 *
	 * <p>Two and three are different cases for the turn: the third request waits behind a second
	 * that is itself waiting, and the lock manager has to hand the turn on twice.
	 */
	@Test
	void threeFirstSendsAtOnceLeaveOnePictureWaitingAndAllAreAnswered() throws Exception {
		Member me = aMember();
		byte[] one = aJpeg("prvo od tri");
		byte[] other = aJpeg("drugo od tri");
		byte[] third = aJpeg("trece od tri");

		List<Answer> all = atOnceBehind(holdingTheMemberRowOf(me), me, one, other, third);

		assertWhatAnyNumberOfSendsLeave(me, all, one, other, third);
	}

	/**
	 * AND TWO SENDS OVER A PICTURE THAT ALREADY WAITS LEAVE ONE ROW, the row it already was.
	 *
	 * <p>The other state of „first": a send over a waiting picture was already serialised by the
	 * {@code for update} on its row, and this case is what says the turn did not take that away. Here
	 * the row held is the QUEUE row, because a send over a waiting picture does not touch the member's
	 * row at all and a hold on it would stop nobody.
	 */
	@Test
	void twoSendsAtOnceOverAPictureThatAlreadyWaitsLeaveTheRowItWas() throws Exception {
		Member me = aMember();
		byte[] original = aJpeg("slika koja vec ceka");
		byte[] one = aJpeg("preko nje, prva");
		byte[] other = aJpeg("preko nje, druga");

		Answer first = send(me, original);

		assertThat(first.status()).as("the picture that is to be waiting was not taken: %s", first)
				.isEqualTo(200);

		long theRow = theRowThatWaits(me);

		List<Answer> both = atOnceBehind(holdingTheQueueRow(theRow), me, one, other);

		assertWhatAnyNumberOfSendsLeave(me, both, original, one, other);
		assertThat(theRowThatWaits(me))
				.as("the row that waited was replaced rather than repointed")
				.isEqualTo(theRow);
	}

	/**
	 * WHAT TWO AT ONCE LEAVE IS WHAT ONE AFTER THE OTHER LEAVES.
	 *
	 * <p>The shape is compared, member against member, and not only with a constant: a constant is
	 * satisfied by two runs that are both wrong in the same way, and two runs that disagree are the
	 * one thing the owner's decision cannot allow. The folder is emptied between the two, so each
	 * shape counts the files of its own member alone.
	 */
	@Test
	void whatTwoAtOnceLeaveIsWhatOneAfterTheOtherLeaves() throws Exception {
		Member racing = aMember();
		byte[] racingOne = aJpeg("utrka, prvo");
		byte[] racingOther = aJpeg("utrka, drugo");

		List<Answer> atOnce = atOnceBehind(holdingTheMemberRowOf(racing), racing, racingOne, racingOther);
		Shape raced = shapeOf(racing, atOnce, racingOne, racingOther);

		emptyTheFolder();

		Member taking = aMember();
		byte[] firstOne = aJpeg("redom, prvo");
		byte[] thenOther = aJpeg("redom, drugo");

		List<Answer> oneAfterTheOther = List.of(send(taking, firstOne), send(taking, thenOther));
		Shape inTurn = shapeOf(taking, oneAfterTheOther, firstOne, thenOther);

		assertThat(raced)
				.as("two sends at once left something other than one send after the other leaves")
				.isEqualTo(inTurn);
		assertThat(inTurn)
				.as("one send after the other left something other than what any number of sends"
						+ " leave, so the comparison above would agree about a wrong thing")
				.isEqualTo(WHAT_ANY_NUMBER_OF_SENDS_LEAVE);
	}

	/**
	 * ANOTHER MEMBER IS NOT HELD UP BY THE FIRST MEMBER'S TURN.
	 *
	 * <p><b>The other half of „this member".</b> A turn keyed by a constant, or by anything two
	 * members share, passes every case above, because every case above has one member. Here the first
	 * member's send is stopped behind a row of his, holding his turn, and a second member sends: his
	 * answer must come while the first is still stopped. Both states are in the case, the second
	 * member being let through and the first being, at that moment, held.
	 */
	@Test
	void anotherMembersSendIsNotHeldUpByTheFirstMembersTurn() throws Exception {
		Member first = aMember();
		Member another = aMember();
		ExecutorService pool = Executors.newFixedThreadPool(2);
		List<Future<Answer>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				holdingTheMemberRowOf(first).run();

				submitted.add(pool.submit(() -> send(first, aJpeg("prvi clan, njegov red je zadrzan"))));
				untilAllAreStopped(1, submitted);

				submitted.add(pool.submit(() -> send(another, aJpeg("drugi clan, njegov red nije"))));

				assertThat(submitted.get(1))
						.as("the second member's send was held up by the first member's turn, although"
								+ " his own row was free: the turn is not keyed by the member")
						.succeedsWithin(Duration.ofSeconds(10))
						.satisfies(answer -> assertThat(answer.status())
								.as("the second member's send was not taken: %s", answer)
								.isEqualTo(200));
				assertThat(submitted.get(0))
						.as("the first member's send was let through while his row was held, so the"
								+ " case is not holding the thing it says it holds")
						.isNotDone();

				return null;
			});

			assertThat(submitted.get(0).get(30, TimeUnit.SECONDS).status())
					.as("the first member's send was not taken once his row was let go")
					.isEqualTo(200);
		}
		finally {
			pool.shutdownNow();
		}
	}

	/**
	 * NO TURN OUTLIVES THE SEND THAT TOOK IT, WHETHER THE SEND WORKED OR FAILED.
	 *
	 * <p><b>Asked of the lock manager and not of the next request.</b> A turn that stayed on the
	 * pooled connection that took it would be re-entered without a wait by the next request that
	 * happened to get the same connection, and a case that only sent again would pass by luck of the
	 * pool. {@code pg_locks} lists every advisory lock any session holds, an idle pooled one included.
	 *
	 * <p><b>The question is proved able to see one first</b>, with a lock this case takes itself,
	 * because „none are held" is also what a query that looks in the wrong place answers.
	 *
	 * <p><b>The failing send fails where the route says it can:</b> the folder is replaced by a plain
	 * file, so {@code Files.createDirectories} throws, which is the {@code IOException} the mapping
	 * rolls back on (the way {@code ThePictureAndItsFileAreOneThingTest} makes the same fault).
	 */
	@Test
	void noTurnOutlivesTheSendThatTookItWhetherItWorkedOrFailed() throws Exception {
		Member me = aMember();

		assertThat(advisoryLocksHeld()).as("the case begins with a lock held by somebody").isZero();

		holdingTheRow.execute(heldOpen -> {
			db.sql("select pg_advisory_xact_lock(1)::text").query(String.class).single();

			assertThat(advisoryLocksHeld())
					.as("the question cannot see an advisory lock held by this very case, so a nought"
							+ " from it below says nothing")
					.isEqualTo(1);

			return null;
		});

		assertThat(advisoryLocksHeld()).as("the case's own lock outlived its transaction").isZero();

		assertThat(send(me, aJpeg("slanje koje uspe")).status()).isEqualTo(200);
		assertThat(advisoryLocksHeld())
				.as("a send that worked left its turn held on a connection of the pool")
				.isZero();

		emptyTheFolder();
		Files.delete(PHOTOS);
		Files.writeString(PHOTOS, "ovo je fajl, ne folder");

		Answer failed;

		try {
			failed = send(me, aJpeg("slanje koje ne uspe"));
		}
		finally {
			Files.delete(PHOTOS);
			Files.createDirectory(PHOTOS);
		}

		assertThat(failed.status())
				.as("the send did not fail at the disk, so the case measured a send that worked: %s", failed)
				.isEqualTo(-1);
		assertThat(advisoryLocksHeld())
				.as("a send that rolled back left its turn held on a connection of the pool")
				.isZero();

		assertThat(send(me, aJpeg("slanje posle neuspelog")).status())
				.as("the next send of a member whose send failed was not taken")
				.isEqualTo(200);
	}

	/* ------------------------------------------------------------------------------------------
	   WHAT EVERY FORCED CASE ASKS AT THE END
	   ------------------------------------------------------------------------------------------ */

	/**
	 * The invariants, and the three things that make each of them mean something: the answers are
	 * read off the requests that were sent, the rows off the database, and the screen's view off the
	 * route a screen asks.
	 */
	private void assertWhatAnyNumberOfSendsLeave(Member me, List<Answer> answers, byte[]... sent)
			throws Exception {

		assertThat(answers)
				.as("a send was not taken, so the turn made one of them a fault: %s", answers)
				.allMatch(answer -> answer.status() == 200);

		Shape left = shapeOf(me, answers, sent);

		assertThat(left)
				.as("what the sends left is not what any number of sends of one member leave")
				.isEqualTo(WHAT_ANY_NUMBER_OF_SENDS_LEAVE);

		/* The picture that is kept is one of those sent, and the screen is told it is the one waiting. */
		List<String> digests = Stream.of(sent).map(WhatAPictureIs::digestOf).toList();
		String kept = theDigestsOfThePicturesThatWait(me).getFirst();

		assertThat(digests).as("the picture that waits is not one that was sent").contains(kept);
		assertThat(theDigestTheScreenIsToldHeWaitsOn(me))
				.as("the member's own screen is told his waiting picture is not the one in the queue")
				.isEqualTo(kept);

		/* EVERY ANSWER NAMES THE PICTURE OF ITS OWN SEND, which is what a send after the first has
		   always done: the loser is not told it is the winner's. Two answers carrying one digest
		   would be the loser being handed the survivor. */
		assertThat(new HashSet<>(answers.stream().map(this::digestOf).toList()))
				.as("two answers carry one picture, or an answer names a picture nobody sent")
				.hasSize(answers.size())
				.isSubsetOf(digests);
		assertThat(advisoryLocksHeld())
				.as("a turn is still held after every send has been answered")
				.isZero();
	}

	private Shape shapeOf(Member me, List<Answer> answers, byte[]... sent) throws IOException {
		List<Long> rowsThatWait = theRowsThatWait(me);
		long row = rowsThatWait.size() == 1 ? rowsThatWait.getFirst() : -1;

		List<String> digests = Stream.of(sent).map(WhatAPictureIs::digestOf).toList();

		long photoRows = digests.stream()
				.mapToLong(digest -> db.sql("select count(*) from photo where digest = ?")
						.param(digest).query(Long.class).single())
				.sum();

		try (Stream<Path> files = Files.list(PHOTOS)) {
			return new Shape(
					answers.stream().allMatch(answer -> answer.status() == 200),
					answers.stream().allMatch(answer -> answer.status() == 200
							&& waitingKeyOf(answer) == row),
					rowsThatWait.size(),
					photoRows,
					files.count());
		}
	}

	/* ------------------------------------------------------------------------------------------
	   THE HARNESS
	   ------------------------------------------------------------------------------------------ */

	/**
	 * EVERY REQUEST STOPPED INSIDE THE DATABASE BEFORE ANY COULD COMMIT, AND ONLY THEN RELEASED.
	 *
	 * <p>The shape is {@code ATextSentTwiceAtOnceTest}'s: wait for the requests WHILE the row is
	 * held, require that none has been answered, and read the futures only once it is let go - read
	 * inside, the requests could never finish and the case would hang rather than fail.
	 */
	private List<Answer> atOnceBehind(Runnable holdIt, Member sender, byte[]... pictures)
			throws Exception {

		ExecutorService pool = Executors.newFixedThreadPool(pictures.length);
		List<Future<Answer>> submitted = new ArrayList<>();

		try {
			holdingTheRow.execute(heldOpen -> {
				holdIt.run();

				assertThat(BlockedBehindThisHold.count(db))
						.as("the row is held and nothing has been submitted yet, so a count that is not"
								+ " nought is counting something other than these requests")
						.isZero();

				for (byte[] picture : pictures) {
					submitted.add(pool.submit(() -> send(sender, picture)));
				}

				untilAllAreStopped(pictures.length, submitted);

				assertThat(submitted)
						.as("a request was answered before it reached the database, so they did not meet"
								+ " where this case is written to make them meet")
						.hasSize(pictures.length).noneMatch(Future::isDone);

				return null;
			});

			List<Answer> answers = new ArrayList<>();

			for (Future<Answer> one : submitted) {
				answers.add(one.get(30, TimeUnit.SECONDS));
			}

			return answers;
		}
		finally {
			pool.shutdownNow();
		}
	}

	/**
	 * Polled rather than assumed, the discipline {@code BlockedBehindThisHold.untilBothArrive} has,
	 * for any number of requests: that method waits for two, and this case needs three.
	 */
	private void untilAllAreStopped(int wanted, List<? extends Future<?>> submitted) {
		Instant deadline = Instant.now().plusSeconds(10);

		while (BlockedBehindThisHold.count(db) < wanted) {
			if (Instant.now().isAfter(deadline)) {
				throw new IllegalStateException(wanted + " requests should have been queued behind the"
						+ " held row within ten seconds, and the lock manager never showed that many"
						+ " behind this connection. Futures done: "
						+ submitted.stream().map(Future::isDone).toList());
			}

			try {
				Thread.sleep(20);
			}
			catch (InterruptedException interrupted) {
				throw new IllegalStateException(interrupted);
			}
		}
	}

	/** The member's own row, locked from the thread that is about to submit the requests. */
	private Runnable holdingTheMemberRowOf(Member who) {
		return () -> db.sql("select 1 from competitor where id = ? for update")
				.param(who.id()).query(Integer.class).single();
	}

	/** The queue row of a picture that waits, which is what every send over it asks for. */
	private Runnable holdingTheQueueRow(long row) {
		return () -> db.sql("select 1 from verification where id = ? for update")
				.param(row).query(Integer.class).single();
	}

	private Answer send(Member who, byte[] bytes) {
		try {
			MockMultipartHttpServletRequestBuilder asking = multipart("/api/me/photo");

			asking.file(new MockMultipartFile("picture", "portret.jpg", "image/jpeg", bytes));
			asking.param("cropX", "0.25");
			asking.param("cropY", "0.75");
			asking.param("cropSize", "0.5");

			MockHttpServletResponse answer = http.perform(asking.with(csrf())
							.cookie(new Cookie(SessionCookie.NAME, who.session().secret())))
					.andReturn().getResponse();

			return new Answer(answer.getStatus(), answer.getContentAsString(), null);
		}
		catch (Exception failed) {
			Throwable root = failed;

			while (root.getCause() != null) {
				root = root.getCause();
			}

			return new Answer(-1, "", failed.getClass().getSimpleName() + " / "
					+ root.getClass().getSimpleName() + ": " + root.getMessage());
		}
	}

	private long waitingKeyOf(Answer answer) {
		return mapper.readTree(answer.body()).path("waiting").asLong();
	}

	private String digestOf(Answer answer) {
		return answer.status() == 200 ? mapper.readTree(answer.body()).path("digest").asString() : "";
	}

	/* ------------------------------------------------------------------------------------------
	   WHAT THE DATABASE AND THE SCREEN SAY
	   ------------------------------------------------------------------------------------------ */

	private List<Long> theRowsThatWait(Member me) {
		return db.sql("select id from verification where competitor_id = ? and queue = 'profiles'"
						+ " and state = 'waiting' and photo_id is not null order by id")
				.param(me.id()).query(Long.class).list();
	}

	private long theRowThatWaits(Member me) {
		List<Long> rows = theRowsThatWait(me);

		assertThat(rows).as("the member does not have exactly one picture waiting").hasSize(1);

		return rows.getFirst();
	}

	private List<String> theDigestsOfThePicturesThatWait(Member me) {
		return db.sql("select p.digest from verification v join photo p on p.id = v.photo_id"
						+ " where v.competitor_id = ? and v.queue = 'profiles' and v.state = 'waiting'"
						+ " order by v.id")
				.param(me.id()).query(String.class).list();
	}

	/** What the screen a member sends from is told, read from the route that screen asks. */
	private String theDigestTheScreenIsToldHeWaitsOn(Member me) throws Exception {
		String address = mapper.readTree(http.perform(get("/api/me/photo")
						.cookie(new Cookie(SessionCookie.NAME, me.session().secret())))
				.andReturn().getResponse().getContentAsString()).path("waiting").path("photo").asString();

		return address.substring(address.lastIndexOf('/') + 1);
	}

	/**
	 * Every advisory lock any session of this database holds or is waiting for. The database is this
	 * case's own (one Testcontainers context per folder), so nothing else is counted.
	 */
	private long advisoryLocksHeld() {
		return db.sql("select count(*) from pg_locks where locktype = 'advisory'")
				.query(Long.class).single();
	}

	/* ------------------------------------------------------------------------------------------
	   THE FIXTURE
	   ------------------------------------------------------------------------------------------ */

	/** One member, an account for him and a session, with nothing waiting. */
	private Member aMember() {
		int n = ISSUED.incrementAndGet();
		String address = "dva-slanja-" + n + "@primer.rs";

		long id = db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name, address,"
						+ " shirt_size, health_statement_at)"
						+ " values (?, 'Dvoklik', 'Dvoklikovic', 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " ?, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-01-01 10:00:00+00') returning id")
				.params(String.format("0009%02d", n), String.format("%016x", 0xb233000000000000L + n))
				.query(Long.class).single();

		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id) values"
						+ " ('Roditelj', 'Roditeljevic', ?, (select id from role where code = 'competitor'), ?)")
				.params(address, id).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(address, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		Member made = new Member(id, address, session);

		members.add(made);

		return made;
	}

	private void emptyTheFolder() throws IOException {
		try (Stream<Path> there = Files.list(PHOTOS)) {
			for (Path file : there.toList()) {
				Files.deleteIfExists(file);
			}
		}
	}

	/** A JPEG as far as the portal reads one: its three first bytes, then whatever the case says. */
	private static byte[] aJpeg(String tail) {
		byte[] head = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF };
		byte[] rest = tail.getBytes(StandardCharsets.UTF_8);
		byte[] whole = new byte[head.length + rest.length];

		System.arraycopy(head, 0, whole, 0, head.length);
		System.arraycopy(rest, 0, whole, head.length, rest.length);

		return whole;
	}
}
