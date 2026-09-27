package com.btl.portal.web;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.token.SecretToken;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * THE PICTURE A MODERATOR IS DECIDING ABOUT, AND THE FIVE WAYS OF BEING TOLD THERE IS NONE.
 *
 * <p>ADL A60's dopuna of 27.09.2026, and the owner found the hole himself on QA: he approved
 * a photograph WITHOUT SEEING IT, because the queue never drew one. What this file measures
 * is the address that fills that gap, {@code GET /api/verification/{id}/photo}, and the rule
 * it must NOT break: a picture waiting for a decision is still not public.
 *
 * <p><b>WHY THIS IS A FILE OF ITS OWN AND NOT CASES INSIDE {@code PhotoApiTest}.</b> That
 * class is built around one world of nine pictures and four holders, and every case in it
 * reads that fixture; the route here needs something that class has never needed, which is
 * MODERATORS HOLDING DIFFERENT TICKS. Adding rights to a shared fixture thirty cases read
 * would put every one of them at risk for an axis none of them is about. What does stay
 * there is {@code aPictureWaitingForAModeratorIsAnsweredExactlyAsADigestNobodyWrote}, which
 * is the other half of the same rule, and this file measures the two ends TOGETHER in
 * {@link #onePictureAndTwoAddressesThatDisagreeAboutIt} so the halves cannot drift apart.
 *
 * <p><b>FOUR PEOPLE, AND THE ONE THAT MATTERS IS THE SECOND.</b> A fixture made of somebody
 * holding nothing cannot tell „may he moderate THIS tab" from „does he hold any tab at all" -
 * {@code RightsAtTheDoorTest} says exactly that about the three writes of this resource. So
 * there is a moderator who genuinely holds ONE queue and is asked about a row in another, and
 * the pair is measured in BOTH directions, because a guard that had the two queues the wrong
 * way round would pass a one-directional case.
 *
 * <p><b>AND THE SUPERADMIN, WHO HOLDS EVERY RIGHT WITH NO TICK ANYWHERE</b> (V5's
 * {@code rights_mode = 'all'}). He is not decoration: he is the case that falls the moment
 * the privilege is asked as a condition over {@code account_admin_right} inside the SQL,
 * which is the shape a first draft of this route had and which
 * {@code VerificationWriteApi.itemHeMayModerate} warns about in as many words.
 *
 * <p><b>NO ROW HERE IS THE ONLY ONE OF ITS KIND.</b> There are two waiting pictures in the
 * profiles queue, not one, so {@link #eachRowAnswersItsOwnPictureAndNotTheFirstOneThereIs}
 * can tell „the row asked for" apart from „the first row that has a picture" - a query
 * ending {@code order by id limit 1} answers the same bytes as a correct one when there is
 * only one row to find. The two pictures differ in type AND in length AND in content, so no
 * assertion can be satisfied by the wrong one.
 *
 * <p><b>EVERY PICTURE KEEPS A DECOY IN THE FOLDER</b>, which is {@code PhotoApiTest}'s
 * discipline and is copied rather than reinvented: beside the file named after the row's
 * {@code id} there is a second file named after its DIGEST, holding different bytes of the
 * same length. Without it, „the path is built from the row" and „the path is built from
 * something the caller said" answer the same 200.
 *
 * <p><b>AND NO TWO PICTURES SHARE A DIGEST HERE, deliberately.</b> The digest is the content,
 * so a waiting picture that happened to carry an APPROVED picture's digest would be served by
 * {@code /api/photos} through the approved row - and
 * {@link #onePictureAndTwoAddressesThatDisagreeAboutIt} would pass while measuring the wrong
 * row entirely. That is the „two sources of one value" fault, and the fixture separates the
 * sources rather than the assertion hoping they differ.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Transactional
class VerificationPhotoApiTest {

	/** One picture as it was written: what it is, what is in it, and what it is called. */
	private record Written(String digest, String mediaType, byte[] bytes) {
	}

	/**
	 * THE PICTURE THE OWNER WANTS TO SEE: waiting, in the profiles queue, and its moderator's.
	 */
	private static final Written WAITING = new Written("a1".repeat(32), "image/jpeg",
			new byte[] {(byte) 0xFF, (byte) 0xD8, 'w', 'a', 'i', 't'});

	/**
	 * A SECOND ONE, waiting in the SAME queue, so that no case can pass by answering „the
	 * picture that is waiting" instead of „the picture this row is about".
	 */
	private static final Written ALSO_WAITING = new Written("b2".repeat(32), "image/png",
			new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x00, 't', 'w', 'o'});

	/** One on a row in ANOTHER queue, which is what separates his tab from any tab. */
	private static final Written IN_THE_COMMENTS_QUEUE = new Written("c3".repeat(32),
			"image/webp", new byte[] {'R', 'I', 'F', 'F', 0x00, 'c'});

	/** And one belonging to a member who hides his profile, which changes nothing here. */
	private static final Written OF_A_HIDDEN_MEMBER = new Written("d4".repeat(32), "image/jpeg",
			new byte[] {(byte) 0xFF, (byte) 0xD8, 'h', 'i', 'd'});

	/** The moderator the profiles queue belongs to. */
	private static final String MAY_THE_PROFILES = "profili@primer.rs";

	/** Holds ONE queue, and it is not the profiles one. */
	private static final String MAY_THE_COMMENTS = "komentari@primer.rs";

	/** Holds nothing at all, which is a competitor. */
	private static final String HOLDS_NOTHING = "clan@primer.rs";

	/** Holds everything, with no tick anywhere. */
	private static final String HOLDS_EVERYTHING = "sef@primer.rs";

	private static final Path FOLDER = aFolderOfItsOwn();

	@DynamicPropertySource
	static void whereThePicturesAre(DynamicPropertyRegistry settings) {
		settings.add("btl.photos.folder", FOLDER::toString);
	}

	private static Path aFolderOfItsOwn() {
		try {
			return Files.createTempDirectory("btl-verification-photo-case");
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	private final Map<String, SecretToken> sessions = new HashMap<>();

	/** The key the sequence handed each picture, which is what its file is called. */
	private final Map<String, Long> photos = new HashMap<>();

	/** The queue rows, by the picture each is about. */
	private final Map<String, Long> rows = new HashMap<>();

	/** A decided row and a biography row, neither of which holds a picture at all. */
	private long decided;

	private long aBiography;

	private int issued;

	@BeforeEach
	void fourPeopleAndSixRows() {
		member("000901", "Slika");
		member("000902", "Druga");
		member("000903", "Komentar");
		member("000904", "Skriven", true);
		member("000905", "Moderator");

		account(MAY_THE_PROFILES, "moderator", "000905");
		ticked(MAY_THE_PROFILES, "queue:profiles");

		account(MAY_THE_COMMENTS, "moderator", "000903");
		ticked(MAY_THE_COMMENTS, "queue:comments");

		account(HOLDS_NOTHING, "competitor", "000901");

		/* NO TICK ANYWHERE, which is the whole of what makes him the case that falls if the
		   privilege is ever asked as a condition over `account_admin_right`. */
		account(HOLDS_EVERYTHING, "superadmin", "000902");

		write(WAITING);
		write(ALSO_WAITING);
		write(IN_THE_COMMENTS_QUEUE);
		write(OF_A_HIDDEN_MEMBER);

		rows.put(WAITING.digest(), waitingRow("profiles", "000901", WAITING));
		rows.put(ALSO_WAITING.digest(), waitingRow("profiles", "000902", ALSO_WAITING));
		rows.put(IN_THE_COMMENTS_QUEUE.digest(),
				waitingRow("comments", "000903", IN_THE_COMMENTS_QUEUE));
		rows.put(OF_A_HIDDEN_MEMBER.digest(),
				waitingRow("profiles", "000904", OF_A_HIDDEN_MEMBER));

		/* A DECIDED ROW CARRIES NO PICTURE AND CANNOT, which is V9's
		   `verification_decided_keeps_no_photo check (state = 'waiting' or photo_id is null)`.
		   The fixture is not choosing to leave it out: the schema refuses the other shape, and
		   that is exactly why the route needs no condition on the state. */
		decided = db.sql("insert into verification (queue, competitor_id, subject, body, photo_id,"
						+ " state, decided_at, decided_by_name) values ('profiles',"
						+ " (select id from competitor where member_number = '000901'),"
						+ " 'Odlucena slika', '', null, 'approved',"
						+ " timestamptz '2026-09-20 10:00:00+00', 'Moderator')"
						+ " returning id")
				.query(Long.class).single();

		/* AND THE OTHER HALF OF THE SAME TAB. PDL P28a, 06.08.2026: biographies and pictures
		   are ONE row type, „Trkacki profil", so this is not a different queue - it is the same
		   queue with nothing for this route to answer. */
		aBiography = db.sql("insert into verification (queue, competitor_id, subject, body,"
						+ " photo_id, state) values ('profiles',"
						+ " (select id from competitor where member_number = '000902'),"
						+ " 'Nova biografija', 'Trcim deset godina', null, 'waiting')"
						+ " returning id")
				.query(Long.class).single();
	}

	@AfterEach
	void theFolderIsLeftEmpty() throws IOException {
		try (Stream<Path> left = Files.list(FOLDER)) {
			for (Path file : left.toList()) {
				Files.deleteIfExists(file);
			}
		}
	}

	/**
	 * WHAT THE OWNER ASKED FOR: the moderator of that queue is given the picture itself.
	 *
	 * <p><b>Four things are asserted and each would be wrong on its own.</b> The bytes say
	 * the file was read by the ROW'S key and not by anything the caller said - the decoy is
	 * what makes that measurable. The type says it came off the row and was not guessed. The
	 * cache says a day and PRIVATE, which ADL A60 argues and which this route inherits from
	 * the one answer both routes build. And the status says the address exists for him, which
	 * is the half every refusal below denies.
	 */
	@Test
	void theModeratorOfThatQueueIsGivenTheBytesUnderTheTypeOfTheRow() throws Exception {
		MockHttpServletResponse answer = asked(rows.get(WAITING.digest()), MAY_THE_PROFILES);

		assertThat(answer.getStatus())
				.as("the moderator who holds this queue was refused the picture he is deciding"
						+ " about, which is the fault ADL A60's dopuna of 27.09.2026 exists to"
						+ " close - the owner approved a photograph without seeing it")
				.isEqualTo(200);
		assertThat(answer.getContentAsByteArray())
				.as("these are not the bytes of the file the ROW names. A file named after the"
						+ " digest sits in the same folder holding the same number of different"
						+ " bytes, so this is what a server resolving anything the caller said"
						+ " would answer")
				.isEqualTo(WAITING.bytes());
		assertThat(answer.getContentType())
				.as("the type was not taken off the row, so a picture is being served under a"
						+ " type somebody guessed - the one thing ADL A12a says the upload"
						+ " decides and nothing afterwards")
				.isEqualTo(WAITING.mediaType());
		assertThat(answer.getHeader(HttpHeaders.CACHE_CONTROL))
				.as("the term is not a private day. Shared, an intermediary would hand one"
						+ " caller's answer to another, and this chain puts XSRF-TOKEN on"
						+ " everything; longer, a withdrawn picture would go on being drawn")
				.isEqualTo("max-age=86400, private");
	}

	/**
	 * AND HE HOLDS EVERY RIGHT WITH NO TICK ANYWHERE, so the privilege cannot be a condition
	 * over the ticks.
	 *
	 * <p><b>This is the case a first draft of the route failed.</b> Written as
	 * {@code where v.right_code in (select right_code from account_admin_right ...)} the
	 * statement is correct for every moderator and refuses the superadmin his own portal,
	 * because V5 gives his role {@code rights_mode = 'all'} and gives him no row in that table
	 * at all. {@code VerificationWriteApi.itemHeMayModerate} carries the same warning.
	 */
	@Test
	void theSuperadminIsGivenItWithoutASingleTickAnywhere() throws Exception {
		assertThat(ticksOf(HOLDS_EVERYTHING))
				.as("this account holds a tick, so it is an ordinary moderator and the case"
						+ " below no longer measures the role at all")
				.isZero();

		assertThat(asked(rows.get(WAITING.digest()), HOLDS_EVERYTHING).getStatus())
				.as("the superadmin was refused, which means the privilege is being read off"
						+ " account_admin_right instead of being asked of WhatHeMayDo - correct"
						+ " for every moderator and wrong for the one account that holds"
						+ " everything without a tick")
				.isEqualTo(200);
	}

	/**
	 * A MEMBER WHO HIDES HIS PROFILE STILL HAS HIS WAITING PICTURE SHOWN TO ITS MODERATOR.
	 *
	 * <p><b>This pins a condition that is deliberately ABSENT, which is why it is a case and
	 * not a sentence in a comment.</b> Two independent reasons say it must be absent: ADL A60
	 * closes the hiding rule with „Od koga se krije: samo od neprijavljenog", and every caller
	 * of this route is signed in by the chain; and a picture waiting for a decision is not on
	 * the profile yet, so there is no profile field for hiding to cover. Somebody who copied
	 * {@code PhotoApi.photo}'s condition across would break this, and nothing else would
	 * notice.
	 */
	@Test
	void aWaitingPictureOfAHiddenMemberIsStillAnsweredToItsModerator() throws Exception {
		assertThat(hidesHisProfile("000904"))
				.as("this member is not hiding after all, so the case below measures the"
						+ " ordinary path twice and says nothing about hiding")
				.isTrue();

		MockHttpServletResponse answer =
				asked(rows.get(OF_A_HIDDEN_MEMBER.digest()), MAY_THE_PROFILES);

		assertThat(answer.getStatus())
				.as("a hidden member's WAITING picture was refused to the moderator deciding"
						+ " about it, so PhotoApi's rule about visitors has been copied onto a"
						+ " route where every caller is signed in and nothing is on a profile")
				.isEqualTo(200);
		assertThat(answer.getContentAsByteArray())
				.as("the status was right and the bytes are somebody else's")
				.isEqualTo(OF_A_HIDDEN_MEMBER.bytes());
	}

	/**
	 * EACH ROW ANSWERS ITS OWN PICTURE, and this is the case a fixture of one row cannot have.
	 *
	 * <p>Two rows wait in the same queue, so a statement that ended {@code order by v.id limit
	 * 1} - or that read the first row holding a picture - would answer the same bytes for both
	 * ids. Asked for both and compared against two different bodies of two different lengths
	 * under two different types, that shape has nowhere to hide.
	 */
	@ParameterizedTest
	@MethodSource("theTwoWaitingInTheProfilesQueue")
	void eachRowAnswersItsOwnPictureAndNotTheFirstOneThereIs(Written picture) throws Exception {
		MockHttpServletResponse answer = asked(rows.get(picture.digest()), MAY_THE_PROFILES);

		assertThat(answer.getStatus()).isEqualTo(200);
		assertThat(answer.getContentAsByteArray())
				.as("this row was answered with another row's picture, which is what a lookup"
						+ " that ignores the key it was given does when more than one row"
						+ " qualifies")
				.isEqualTo(picture.bytes());
		assertThat(answer.getContentType()).isEqualTo(picture.mediaType());
	}

	private static Stream<Written> theTwoWaitingInTheProfilesQueue() {
		return Stream.of(WAITING, ALSO_WAITING);
	}

	/**
	 * HIS TAB AND NOT ANY TAB, MEASURED IN BOTH DIRECTIONS.
	 *
	 * <p><b>This is the case {@code RightsAtTheDoorTest} says a fixture of somebody holding
	 * nothing cannot have.</b> Both callers are real moderators holding exactly one queue
	 * each, and each is asked about the other's row. One direction alone would pass on a
	 * guard that had the two queues the wrong way round, so both are asked - and each refusal
	 * is compared BYTE FOR BYTE against what an id nobody wrote is answered, because a status
	 * that matched while the body did not would still be an oracle (measured 13.09.2026: a
	 * status written onto the response came back 262 bytes against 412 and chunked).
	 */
	@ParameterizedTest
	@MethodSource("eachModeratorAskedAboutTheOthersRow")
	void aQueueThatIsNotHisIsAnsweredExactlyAsAnIdNobodyWrote(String who, Written notHis)
			throws Exception {

		MockHttpServletResponse refused = asked(rows.get(notHis.digest()), who);
		MockHttpServletResponse nothing = asked(nobodysRow(), who);

		assertThat(refused.getStatus())
				.as("a moderator was served a picture from a queue he does not hold. PDL P28a,"
						+ " 30.07.2026: „Ne treba ni da budu svesni moderatori da postoje akcije"
						+ " koje im nisu dodeljene\"")
				.isEqualTo(404);
		assertThat(whatCameBack(refused))
				.as("the refusal and an id nobody wrote are told apart, which is an oracle for"
						+ " what is standing in a queue this moderator may not open - one"
						+ " request per guess (ADL A8, 13.09.2026)")
				.isEqualTo(whatCameBack(nothing));
	}

	private static Stream<Object[]> eachModeratorAskedAboutTheOthersRow() {
		return Stream.of(new Object[] {MAY_THE_COMMENTS, WAITING},
				new Object[] {MAY_THE_PROFILES, IN_THE_COMMENTS_QUEUE});
	}

	/**
	 * AND EVERY OTHER WAY OF HAVING NOTHING TO ANSWER IS THE SAME ANSWER.
	 *
	 * <p>Five states, one answer, and they arrive by three different roads inside the route:
	 * a caller holding no tick at all fails the privilege; a decided row and a biography fail
	 * the join to {@code photo}, which is the whole reason the route needs no condition on
	 * {@code state}; and an id nobody wrote finds no row. Each is compared whole against an id
	 * nobody wrote, asked by somebody who may - so the comparison is not two refusals that
	 * happen to share a cause.
	 *
	 * <p><b>It is one case with a loop rather than a {@code @ParameterizedTest}</b>, and that
	 * is a lifecycle fact rather than a preference: three of the four rows are keys the
	 * sequence hands out in {@code @BeforeEach}, and a {@code @MethodSource} factory is
	 * resolved before that runs, so a parameterised shape here would read an empty map. The
	 * four are named in the assertion instead, so a failure still says which one it was.
	 *
	 * <p><b>AND THE LOGGER IS WATCHED THROUGHOUT, WHICH IS NOT TIDINESS BUT THE ONLY THING
	 * THAT MAKES TWO OF THESE FOUR MEASURE ANYTHING.</b> Found by mutation and not by
	 * reading: with {@code join} weakened to {@code left join}, a decided row and a
	 * biography row come back as a row whose {@code p.id} is NULL, which JDBC hands over as
	 * NOUGHT - so the route goes looking for a file called „0", fails to find it, and
	 * answers 404 by the MISSING FILE road. Measured: all eleven cases here stayed green and
	 * the log carried two lines of „picture 0 asked for as ...". The status was right for
	 * the wrong reason, which is the two-sources-of-one-value fault in this fixture rather
	 * than in the route.
	 *
	 * <p>So what separates the two roads is asserted directly: nothing to show must be
	 * NOTHING, not a server fault. A picture a queue row does not have is an ordinary state
	 * - most of these rows never had one - while the warning means „a row names a file that
	 * is gone", which ADL A43, 2 says is a backup that did not cover the volume. One of
	 * those is worth waking somebody for and the other is not, and a route that confused
	 * them would write a line per request for every decided row on the portal.
	 */
	@Test
	void nothingToShowIsAnsweredExactlyAsAnIdNobodyWroteAndIsNoServerFault() throws Exception {
		Logger speaking = (Logger) LoggerFactory.getLogger(PhotoApi.class);
		ListAppender<ILoggingEvent> heard = new ListAppender<>();

		heard.start();
		speaking.addAppender(heard);

		try {
			Map<String, Long> byWhatItIs = new LinkedHashMap<>();

			byWhatItIs.put("a row that has already been decided", decided);
			byWhatItIs.put("a biography in the same tab", aBiography);
			byWhatItIs.put("an id nobody wrote", nobodysRow());

			String nothing = whatCameBack(asked(nobodysRow(), MAY_THE_PROFILES));

			for (Map.Entry<String, Long> one : byWhatItIs.entrySet()) {
				MockHttpServletResponse refused = asked(one.getValue(), MAY_THE_PROFILES);

				assertThat(refused.getStatus())
						.as(one.getKey() + " was not answered 404. ADL A8, owner 13.09.2026:"
								+ " „Server odbija moderatora bez privilegije sa 404, ne sa"
								+ " 403\"")
						.isEqualTo(404);
				assertThat(whatCameBack(refused))
						.as(one.getKey() + " is told apart from an id nobody wrote, so the"
								+ " difference between two answers says something the caller"
								+ " was not to be told")
						.isEqualTo(nothing);
			}

			/* AND THE ONE WHOSE REFUSAL COMES BY THE PRIVILEGE ROAD RATHER THAN THE JOIN,
			   asked about a row that really is there and really does hold a picture. Kept
			   beside the three above because it is the same answer arriving a different way,
			   and a case that measured only the join would pass on a route with no privilege
			   at all. */
			MockHttpServletResponse aMember = asked(rows.get(WAITING.digest()), HOLDS_NOTHING);

			assertThat(aMember.getStatus())
					.as("a signed in competitor holding no tick anywhere was served a picture"
							+ " waiting for a moderator's decision")
					.isEqualTo(404);
			assertThat(whatCameBack(aMember))
					.as("a competitor's refusal is told apart from an id nobody wrote, so the"
							+ " difference says a row is standing there")
					.isEqualTo(nothing);

			assertThat(heard.list.stream().map(ILoggingEvent::getFormattedMessage).toList())
					.as("having nothing to show was reported to whoever runs the server, so one"
							+ " of these four is arriving by the MISSING FILE road instead of"
							+ " finding no row - which is what `left join` here does, and it"
							+ " answers the right number for the wrong reason while writing a"
							+ " line per request for every decided row on the portal")
					.isEmpty();
		} finally {
			speaking.detachAppender(heard);
			heard.stop();
		}
	}

	/**
	 * ONE PICTURE, TWO ADDRESSES, AND THEY MUST DISAGREE - WHICH IS THE WHOLE OF ADL A60.
	 *
	 * <p>The decision of 20.09.2026 still stands: „Slika koju drzi samo nesto sto ceka odluku
	 * moderatora nije javna... Takva slika odgovara tacno isto kao slika koje nema." The
	 * dopuna of 27.09.2026 narrows it and does not overturn it. So the SAME picture must be
	 * refused by the digest route and answered by this one, and both halves are measured here
	 * because either alone can be made true by breaking the other.
	 *
	 * <p><b>The digest route is asked BY THE MODERATOR</b>, not by a visitor, which is the
	 * harder of the two questions: a visitor is refused by A60's original rule anyway, while a
	 * signed in moderator is exactly the caller somebody would be tempted to let through
	 * there. Answered 200 by that address, the picture would be public to anybody the digest
	 * reached, which is the leak A60 was written after.
	 */
	@Test
	void onePictureAndTwoAddressesThatDisagreeAboutIt() throws Exception {
		assertThat(asked(rows.get(WAITING.digest()), MAY_THE_PROFILES).getStatus())
				.as("the moderator's own address does not answer the picture, so the half of"
						+ " this case that proves the other half is a refusal of everything")
				.isEqualTo(200);

		MockHttpServletResponse byItsDigest = http
				.perform(get("/api/photos/{name}", WAITING.digest())
						.cookie(new Cookie(SessionCookie.NAME,
								sessions.get(MAY_THE_PROFILES).secret())))
				.andReturn().getResponse();

		assertThat(byItsDigest.getStatus())
				.as("a picture only a queue row holds was served by the PUBLIC address, to a"
						+ " caller holding nothing but its digest. ADL A60, 20.09.2026: such a"
						+ " picture „odgovara tacno isto kao slika koje nema\", and the address"
						+ " is derived from the content so it cannot be revoked")
				.isEqualTo(404);
	}

	/**
	 * AND NOBODY WHO IS NOT SIGNED IN GETS AS FAR AS THE ROUTE.
	 *
	 * <p>The 401 is the chain's and not this route's: the address is on no open list, so
	 * {@code anyRequest().authenticated()} answers it. {@code ApiSecurityTest
	 * .everyRouteNobodyOpenedIsARouteNobodyCanRead} derives that from the dispatcher and
	 * therefore covers this route by existing - this case is here because the number is the
	 * one thing about this address a reader of ADL A8 will want to find asserted in the file
	 * about the address, and because it is what falls if somebody ever opens the route by
	 * name.
	 */
	@Test
	void withoutASessionItIsFourHundredAndOneAndNotFourHundredAndFour() throws Exception {
		assertThat(http.perform(get("/api/verification/{id}/photo", rows.get(WAITING.digest())))
						.andReturn().getResponse().getStatus())
				.as("an unauthenticated caller was not answered 401, so either the address has"
						+ " been opened by name or the route is deciding something the chain is"
						+ " meant to decide first (ADL A8: neprijavljen dobija 401)")
				.isEqualTo(401);
	}

	private MockHttpServletResponse asked(long row, String who) throws Exception {
		MockHttpServletRequestBuilder asks = get("/api/verification/{id}/photo", row);

		return http.perform(asks.cookie(new Cookie(SessionCookie.NAME,
						sessions.get(who).secret())))
				.andReturn().getResponse();
	}

	/**
	 * The status, the body and the type together, which is what „exactly the same" has to
	 * mean.
	 *
	 * <p>The status alone was measured on 13.09.2026 to be the weaker half: two answers
	 * carrying one number and nothing else alike are still an oracle.
	 */
	private static String whatCameBack(MockHttpServletResponse answer) throws Exception {
		return answer.getStatus() + "|" + answer.getContentType() + "|"
				+ answer.getContentAsString();
	}

	/** A key past the end of the table, which is an id nobody wrote rather than a guess. */
	private long nobodysRow() {
		return db.sql("select coalesce(max(id), 0) + 1000 from verification")
				.query(Long.class).single();
	}

	private int ticksOf(String email) {
		return db.sql("select count(*) from account_admin_right where account_id ="
						+ " (select id from account where email = ?)")
				.param(email).query(Integer.class).single();
	}

	private boolean hidesHisProfile(String number) {
		return db.sql("select profile_hidden from competitor where member_number = ?")
				.param(number).query(Boolean.class).single();
	}

	private void write(Written picture) {
		long id = db
				.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y,"
						+ " crop_diameter) values (?, ?, ?, 0.25, 0.75, 0.40) returning id")
				.params(picture.mediaType(), picture.bytes().length, picture.digest())
				.query(Long.class).single();

		photos.put(picture.digest(), id);

		onDisk(String.valueOf(id), picture.bytes());

		/* THE DECOY. A file named after the DIGEST, which is the one string a server building
		   its path out of anything the caller said would land on. Its bytes are this picture's
		   read backwards, so they are the same length: a case that fell on the length alone
		   would not be saying which file was served. */
		onDisk(picture.digest(), backwards(picture.bytes()));
	}

	private long waitingRow(String queue, String number, Written picture) {
		return db.sql("insert into verification (queue, competitor_id, subject, body, photo_id,"
						+ " state) values (?, (select id from competitor where member_number = ?),"
						+ " 'Nova slika', '', ?, 'waiting') returning id")
				.params(queue, number, photos.get(picture.digest()))
				.query(Long.class).single();
	}

	private void member(String number, String first) {
		member(number, first, false);
	}

	/**
	 * @param hiding written out at the one call site that needs it, so the axis is visible
	 *               where a reader meets it rather than hidden in a default
	 */
	private void member(String number, String first, boolean hiding) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, first_season, first_season_2027, active, membership_basis,"
						+ " referral_code, bio, profile_hidden, birthday_shown, father_name,"
						+ " address, shirt_size, health_statement_at)"
						+ " values (?, ?, 'Prezime', 'F', date '1990-01-01',"
						+ " (select id from place where rank = 1), 2027, false, true, 'payment',"
						+ " ?, '', ?, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, String.format("%016x", ++issued), hiding)
				.update();
	}

	private void account(String email, String role, String member) {
		db.sql("insert into account (first_name, last_name, email, role_id, competitor_id)"
						+ " values ('Ime', 'Prezime', ?, (select id from role where code = ?),"
						+ " (select id from competitor where member_number = ?))")
				.params(email, role, member).update();

		SecretToken session = SecretToken.fresh();
		Instant now = Instant.now();

		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at,"
						+ " expires_at) values ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(email, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))),
						Timestamp.from(now), Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();

		sessions.put(email, session);
	}

	private void ticked(String email, String... rights) {
		for (String right : rights) {
			db.sql("insert into account_admin_right (account_id, right_code)"
							+ " values ((select id from account where email = ?), ?)")
					.params(email, right).update();
		}
	}

	private static void onDisk(String name, byte[] bytes) {
		try {
			Files.write(FOLDER.resolve(name), bytes);
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	private static byte[] backwards(byte[] bytes) {
		byte[] other = new byte[bytes.length];

		for (int at = 0; at < bytes.length; at++) {
			other[at] = bytes[bytes.length - 1 - at];
		}

		return other;
	}

	/**
	 * THE FOLDER HOLDS BOTH THE FILE AND ITS DECOY, which is what the note at the head of this
	 * class rests on.
	 *
	 * <p>Written as a case rather than trusted: a fixture that quietly stopped writing the
	 * decoy would leave every assertion about bytes passing while measuring nothing, because
	 * „read by the row's key" and „read by the address" would land on the same file.
	 */
	@Test
	void everyPictureHasBothItsFileAndTheDecoyThatSeparatesTheTwoSources() throws Exception {
		List<String> expected = new ArrayList<>();

		for (Written picture : List.of(WAITING, ALSO_WAITING, IN_THE_COMMENTS_QUEUE,
				OF_A_HIDDEN_MEMBER)) {

			expected.add(String.valueOf(photos.get(picture.digest())));
			expected.add(picture.digest());
		}

		try (Stream<Path> there = Files.list(FOLDER)) {
			assertThat(there.map(one -> one.getFileName().toString())
					.sorted(Comparator.naturalOrder()).toList())
					.as("the folder does not hold exactly one file per picture and one decoy"
							+ " beside it, so every assertion about which bytes came back is"
							+ " measuring a folder nobody set up")
					.containsExactlyInAnyOrderElementsOf(expected);
		}
	}
}
