package com.btl.portal.web;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.card.WhatACardSays;
import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Key;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import com.sun.net.httpserver.HttpServer;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * WHAT FACEBOOK HAS READ IS WRITTEN DOWN WHEN ITS CRAWLER READS A PROFILE, AND A DELETION ASKS FACEBOOK ABOUT IT AT ONCE.
 *
 * <p>Owner, PDL P11, 16.11.2026, item 14, both chosen with the assistant's recommendation: the server remembers the
 * profiles Facebook's crawler has already opened and asks Facebook to refresh only those; and when a member whose
 * profile is shown is deleted, the server asks Facebook at once, at the moment of the deletion, to read his address
 * again, so that it gets the front page's preview, and keeps the name not a minute after.
 *
 * <p><b>REAL COMMITS AND NOT A TRANSACTION THAT ROLLS BACK</b>, because what a deletion owes Facebook is sent after
 * its commit, and a case inside a transaction of its own never commits. So every row a case makes is deleted after
 * it. Facebook is a server of this case's own on this machine, which records each request and, at the moment it is
 * asked, whether the member it is asked about is still in the database as another connection reads it: a request
 * sent before the commit finds him there.
 *
 * <p><b>No member is the only one of his kind</b> (the rule in {@code CLAUDE.md} about two sources of one value):
 * beside the member who is read and deleted stand a member Facebook has read who stays, and a member Facebook has
 * never read, so a deletion that asked about every row, or a crawler written down for every reader, asks or writes
 * other things than the case expects.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FacebookIsAskedToReadAChangedCardTest.TheClockThisFileUses.class})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class WhatFacebookHasReadTest {

	/** Read by Facebook, and the one who is deleted. */
	private static final String GOES = "000902";

	/** Read by Facebook, and stays; first in the order, so a deletion that asked about the first row asks him. */
	private static final String STAYS = "000901";

	/** Never read by Facebook. */
	private static final String UNREAD = "000903";

	private static final String THE_DELETER = "brise-facebook@primer.rs";

	/** Facebook's sharing crawler, as Meta's page on its crawlers spells it. */
	private static final String THE_CRAWLER = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

	private static final String A_BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0";

	private static final AFacebook FACEBOOK = new AFacebook();

	@DynamicPropertySource
	static void facebookIsOn(DynamicPropertyRegistry registry) {
		registry.add("btl.facebook.app-id", () -> "1234567890");
		registry.add("btl.facebook.app-secret", () -> "case0secret0of0the0reading0class");
		registry.add("btl.facebook.graph", FACEBOOK::address);
		registry.add("btl.facebook.wait-millis", () -> "2000");
	}

	@AfterAll
	static void facebookGoes() {
		FACEBOOK.close();
	}

	/** One request Facebook was sent, and whether the member of the page was still there when it came. */
	record Asked(String id, boolean memberStillThere) {
	}

	/** Facebook, as far as these cases need it. */
	static final class AFacebook implements AutoCloseable {

		private final HttpServer server;
		private final ExecutorService answering = Executors.newCachedThreadPool();
		private final List<Asked> asked = new CopyOnWriteArrayList<>();
		private volatile JdbcClient looking;
		private volatile int status = 200;
		private volatile String body = "{\"id\":\"x\"}";
		private volatile long waitMillis;

		AFacebook() {
			try {
				server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
			} catch (IOException noServer) {
				throw new UncheckedIOException(noServer);
			}

			server.setExecutor(answering);
			server.createContext("/", exchange -> {
				String id;

				try (InputStream in = exchange.getRequestBody()) {
					id = idIn(new String(in.readAllBytes(), StandardCharsets.UTF_8));
				}

				String number = id.replaceAll("^.*/takmicar/([0-9]{6}).*$", "$1");
				boolean there = looking.sql("select exists (select 1 from competitor where member_number = ?)")
						.param(number).query(Boolean.class).single();

				asked.add(new Asked(id, there));

				if (waitMillis > 0) {
					try {
						Thread.sleep(waitMillis);
					} catch (InterruptedException stopped) {
						Thread.currentThread().interrupt();
					}
				}

				byte[] answer = body.getBytes(StandardCharsets.UTF_8);
				exchange.sendResponseHeaders(status, answer.length);

				try (OutputStream out = exchange.getResponseBody()) {
					out.write(answer);
				} catch (IOException gone) {
					/* the client gave up first */
				}
			});
			server.start();
		}

		String address() {
			return "http://127.0.0.1:" + server.getAddress().getPort();
		}

		void reset() {
			asked.clear();
			status = 200;
			body = "{\"id\":\"x\"}";
			waitMillis = 0;
		}

		/** Waits until Facebook has been asked so many times, at most ten seconds, and a moment more for a stray one. */
		List<Asked> askedOnce(int times) throws InterruptedException {
			long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);

			while (asked.size() < times && System.nanoTime() < until) {
				Thread.sleep(20);
			}

			Thread.sleep(300);

			return List.copyOf(asked);
		}

		@Override
		public void close() {
			server.stop(0);
			answering.shutdownNow();
		}

		private static String idIn(String sent) {
			for (String pair : sent.split("&")) {
				if (pair.startsWith("id=")) {
					return URLDecoder.decode(pair.substring(3), StandardCharsets.UTF_8);
				}
			}

			return "";
		}
	}

	@Autowired
	private MockMvc http;

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate inOneTransaction;

	@Autowired
	private CompetitorCards cards;

	@Autowired
	private CompetitorWriteApi members;

	@Autowired
	private ProfilesPastTheirKeepingAreDeleted sweep;

	@Autowired
	private FacebookIsAskedToReadAChangedCard job;

	@Value("${btl.portal.address}")
	private String portal;

	private SecretToken session;

	@BeforeEach
	void threeMembersAndADeleter() {
		FACEBOOK.looking = db;
		FACEBOOK.reset();

		member(STAYS, "Ana", "Prva");
		member(GOES, "Nikola", "Minić");
		member(UNREAD, "Treci", "Necitani");

		db.sql("insert into account (first_name, last_name, email, role_id) values ('Moderator', 'Brisac', ?,"
				+ " (select id from role where code = 'moderator'))").param(THE_DELETER).update();
		db.sql("insert into account_admin_right (account_id, right_code) values"
				+ " ((select id from account where email = ?), ?)").params(THE_DELETER, CompetitorApi.OVER_THE_MEMBERS)
				.update();

		session = SecretToken.fresh();
		Instant now = Instant.now();
		db.sql("insert into account_session (account_id, token_hash, created_at, last_used_at, expires_at) values"
						+ " ((select id from account where email = ?), ?, ?, ?, ?)")
				.params(THE_DELETER, session.hash(), Timestamp.from(now.minus(Duration.ofDays(1))), Timestamp.from(now),
						Timestamp.from(now.plus(SessionLife.LASTS)))
				.update();
	}

	@AfterEach
	void nothingOfItIsLeftBehind() {
		db.sql("delete from account where email = ?").param(THE_DELETER).update();

		for (String number : List.of(STAYS, GOES, UNREAD)) {
			db.sql("delete from membership where competitor_id = (select id from competitor where member_number = ?)")
					.param(number).update();
			db.sql("delete from competitor where member_number = ?").param(number).update();
		}
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* What is written down                                                                                        */
	/* ---------------------------------------------------------------------------------------------------------- */

	/**
	 * FACEBOOK'S CRAWLER READING A SHOWN PROFILE IS WRITTEN DOWN, in the language it read, as the page it was given,
	 * spelt the way the job spells it; and nobody else's reading is: a browser, a reader with no name, Meta's crawler
	 * for training, which keeps no preview, and Facebook at a hidden profile, where it is given the front page.
	 */
	@Test
	void theCrawlerReadingAShownProfileIsWrittenDownAndNobodyElse() throws Exception {
		db.sql("update competitor set profile_hidden = true where member_number = ?").param(UNREAD).update();

		assertThat(previewOf(GOES + "-sr", A_BROWSER).getStatus()).isEqualTo(200);
		assertThat(previewOf(GOES + "-en", null).getStatus()).isEqualTo(200);
		assertThat(previewOf(STAYS + "-sr", "meta-externalagent/1.1 (+https://developers.facebook.com/docs)")
				.getStatus()).isEqualTo(200);
		assertThat(previewOf(UNREAD + "-sr", THE_CRAWLER).getStatus()).isEqualTo(404);
		assertThat(rows()).as("a reader that is not Facebook's crawler was written down").isEmpty();

		MockHttpServletResponse read = previewOf(GOES + "-sr", THE_CRAWLER);

		assertThat(read.getStatus()).isEqualTo(200);
		assertThat(read.getContentAsString()).contains("<title>Nikola Minić u Balkanskoj trkačkoj ligi</title>");
		assertThat(previewOf(GOES + "-en", "FacebookExternalHit/1.1").getStatus()).isEqualTo(200);

		assertThat(rows()).containsExactly(
				GOES + " en " + cards.addressOf(GOES, WhatACardSays.ENGLISH).orElseThrow() + " /en/takmicar/" + GOES
						+ "-nikola-minic",
				GOES + " sr " + cards.addressOf(GOES, WhatACardSays.SERBIAN).orElseThrow() + " /sr/takmicar/" + GOES
						+ "-nikola-minic");
	}

	/** Read again after the card changed, the row is the page as Facebook was given it this time. */
	@Test
	void readAgainTheRowIsWhatItWasGivenThisTime() throws Exception {
		previewOf(GOES + "-sr", THE_CRAWLER);
		String before = cards.addressOf(GOES, WhatACardSays.SERBIAN).orElseThrow();

		db.sql("update competitor set first_name = 'Petar' where member_number = ?").param(GOES).update();
		previewOf(GOES + "-sr", THE_CRAWLER);

		assertThat(rows()).containsExactly(GOES + " sr " + cards.addressOf(GOES, WhatACardSays.SERBIAN).orElseThrow()
				+ " /sr/takmicar/" + GOES + "-petar-minic").noneMatch(row -> row.contains(before));
	}

	/**
	 * WHAT THE PREVIEW WRITES DOWN IS WHAT THE JOB ASKS ABOUT, which is the join between the two halves: a profile read
	 * through the preview and then changed is asked at the address the preview wrote, in each language it was read in,
	 * and a profile changed beside it that Facebook never read is not asked at all.
	 */
	@Test
	void whatThePreviewWritesDownIsWhatTheJobAsksAbout() throws Exception {
		previewOf(GOES + "-sr", THE_CRAWLER);
		previewOf(GOES + "-en", THE_CRAWLER);
		db.sql("update competitor set birth_date = date '1960-05-05' where member_number in (?, ?)")
				.params(GOES, UNREAD).update();

		List<CompletableFuture<Void>> sent = job.askAgain();
		CompletableFuture.allOf(sent.toArray(CompletableFuture[]::new)).get(10, TimeUnit.SECONDS);

		assertThat(FACEBOOK.askedOnce(2)).extracting(Asked::id).containsExactlyInAnyOrder(
				portal + "/sr/takmicar/" + GOES + "-nikola-minic", portal + "/en/takmicar/" + GOES + "-nikola-minic");
	}

	/**
	 * WRITING IT DOWN CANNOT COST THE PAGE: with the row held by another transaction, the write gives up within its
	 * term, the block is served all the same and in time, and the log names neither the member nor his page.
	 */
	@Test
	void aWriteThatCannotBeMadeLeavesThePageAsItIs() throws Exception {
		previewOf(GOES + "-sr", THE_CRAWLER);
		List<String> before = rows();
		db.sql("update competitor set first_name = 'Petar' where member_number = ?").param(GOES).update();

		CountDownLatch held = new CountDownLatch(1);
		CountDownLatch letGo = new CountDownLatch(1);
		CompletableFuture<Void> holding = CompletableFuture.runAsync(() -> inOneTransaction.executeWithoutResult(t -> {
			db.sql("select card from shared_card where member_number = ? for update").param(GOES)
					.query(String.class).list();
			held.countDown();

			try {
				letGo.await(10, TimeUnit.SECONDS);
			} catch (InterruptedException stopped) {
				Thread.currentThread().interrupt();
			}
		}));

		assertThat(held.await(10, TimeUnit.SECONDS)).isTrue();

		List<MockHttpServletResponse> answers = new ArrayList<>();
		long started = System.nanoTime();
		List<ILoggingEvent> heard = heardWhile(WhatFacebookHasRead.class,
				() -> answers.add(previewOf(GOES + "-sr", THE_CRAWLER)));
		Duration took = Duration.ofNanos(System.nanoTime() - started);

		letGo.countDown();
		holding.get(10, TimeUnit.SECONDS);

		assertThat(answers.get(0).getStatus()).isEqualTo(200);
		assertThat(answers.get(0).getContentAsString()).contains("<title>Petar Minić u Balkanskoj trkačkoj ligi</title>");
		assertThat(took).as("the page waited for the write").isLessThan(Duration.ofMillis(1500));
		assertThat(heard).hasSize(1).allSatisfy(one -> {
			assertThat(one.getLevel()).isEqualTo(Level.WARN);
			assertThat(one.getFormattedMessage()).startsWith("What Facebook read was not written down: ")
					.doesNotContain(GOES).doesNotContain("petar").doesNotContain("Petar");
		});
		assertThat(rows()).as("the write that gave up wrote something").isEqualTo(before);
	}

	/** Without Facebook nothing is written down, and a deletion reads and asks nothing. */
	@Test
	void withoutFacebookNothingIsWrittenAndNothingAsked() throws Exception {
		WhatFacebookHasRead off = new WhatFacebookHasRead(db, inOneTransaction,
				new FacebookGraph("", "", FACEBOOK.address(), 2000), portal);
		CompetitorCards.Shown shown = cards.shown(GOES, WhatACardSays.SERBIAN).orElseThrow();

		off.read(THE_CRAWLER, new Key(GOES, "sr"),
				WhatFacebookHasRead.pageOf(GOES, CompetitorPreviewApi.Words.SERBIAN, shown));
		assertThat(rows()).isEmpty();

		previewOf(GOES + "-sr", THE_CRAWLER);
		inOneTransaction.executeWithoutResult(t -> off.forgetWhenGone(id(GOES)));

		assertThat(FACEBOOK.askedOnce(0)).isEmpty();
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* A deletion                                                                                                  */
	/* ---------------------------------------------------------------------------------------------------------- */

	/**
	 * THE ADMINISTRATION DELETES A MEMBER FACEBOOK HAS READ: Facebook is asked both his addresses, after the commit
	 * (he is no longer in the database when the request comes), his rows are gone, and the log does not name him; the
	 * member beside him whom Facebook read too, and the one it never read, are asked nothing.
	 */
	@Test
	void theAdministrationDeletingAMemberFacebookReadAsksBothAddressesAfterTheCommit() throws Exception {
		readByFacebook(STAYS);
		readByFacebook(GOES);

		List<ILoggingEvent> heard = heardWhile(FacebookGraph.class, () -> {
			assertThat(deleted(GOES).getStatus()).isEqualTo(204);
			FACEBOOK.askedOnce(2);
		});

		assertThat(FACEBOOK.asked).containsExactlyInAnyOrder(
				new Asked(portal + "/en/takmicar/" + GOES + "-nikola-minic", false),
				new Asked(portal + "/sr/takmicar/" + GOES + "-nikola-minic", false));
		assertThat(rows()).as("a row outlived the member whose name it carries").allMatch(row -> row.startsWith(STAYS))
				.hasSize(2);
		assertThat(heard).extracting(ILoggingEvent::getFormattedMessage)
				.containsExactly("Facebook read the page of a deleted member again",
						"Facebook read the page of a deleted member again");
	}

	/**
	 * A FACEBOOK THAT IS SLOW CANNOT HOLD THE DELETION UP, and one that refuses cannot fail it: the deletion answers
	 * before Facebook has, and a refusal is logged without the page and without what Facebook answered, which names it.
	 */
	@Test
	void aSlowOrRefusingFacebookNeitherHoldsUpNorFailsTheDeletion() throws Exception {
		readByFacebook(GOES);
		FACEBOOK.waitMillis = 1500;
		FACEBOOK.status = 500;
		FACEBOOK.body = "{\"error\":\"could not read " + portal + "/sr/takmicar/" + GOES + "-nikola-minic\"}";

		long started = System.nanoTime();
		List<ILoggingEvent> heard = heardWhile(FacebookGraph.class, () -> {
			assertThat(deleted(GOES).getStatus()).isEqualTo(204);
			assertThat(Duration.ofNanos(System.nanoTime() - started)).as("the deletion waited for Facebook")
					.isLessThan(Duration.ofMillis(1200));
			FACEBOOK.askedOnce(2);
			Thread.sleep(1800);
		});

		assertThat(FACEBOOK.asked).hasSize(2);
		assertThat(id(GOES)).as("the member is still there").isNull();
		assertThat(heard).hasSize(2).allSatisfy(one -> {
			assertThat(one.getLevel()).isEqualTo(Level.WARN);
			assertThat(one.getFormattedMessage()).isEqualTo("Facebook did not read the page of a deleted member again: 500 ");
		});
	}

	/**
	 * WHAT FACEBOOK ALREADY HOLDS AS THE FRONT PAGE IS NOT ASKED AGAIN, and a member Facebook never read asks nothing:
	 * a member whose profile was hidden and asked about once, and one Facebook never read, are deleted and nothing is
	 * sent.
	 */
	@Test
	void aDeletionAsksNothingWhereFacebookHoldsNoCard() throws Exception {
		readByFacebook(GOES);
		db.sql("update shared_card set card = null where member_number = ?").param(GOES).update();

		assertThat(deleted(GOES).getStatus()).isEqualTo(204);
		assertThat(deleted(UNREAD).getStatus()).isEqualTo(204);
		assertThat(FACEBOOK.askedOnce(0)).isEmpty();
		assertThat(rows()).isEmpty();
	}

	/** A deletion that rolls back asks nothing, because it never happened. */
	@Test
	void aDeletionThatRollsBackAsksNothing() throws Exception {
		readByFacebook(GOES);

		inOneTransaction.executeWithoutResult(t -> {
			members.takeAway(id(GOES));
			t.setRollbackOnly();
		});

		assertThat(FACEBOOK.askedOnce(0)).isEmpty();
		assertThat(rows()).hasSize(2);
	}

	/**
	 * FIVE YEARS AFTER HIS LAST SEASON THE DELETION BY ITSELF ASKS TOO, which is the other road by which a member with a
	 * number goes ({@link ProfilesPastTheirKeepingAreDeleted}, {@link CompetitorWriteApi#takeAwayWithoutAWord}): his
	 * card is still what Facebook holds when the run that would have asked about it has not come yet.
	 */
	@Test
	void theDeletionFiveYearsOnAsksToo() throws Exception {
		readByFacebook(GOES);
		ZonedDateTime fiveYearsOn = LocalDateTime.of(2040, 3, 1, 12, 0).atZone(SeasonClock.ZONE);

		Boolean gone = inOneTransaction.execute(t -> sweep.goes(id(GOES), fiveYearsOn));

		assertThat(gone).isTrue();
		assertThat(FACEBOOK.askedOnce(2)).containsExactlyInAnyOrder(
				new Asked(portal + "/en/takmicar/" + GOES + "-nikola-minic", false),
				new Asked(portal + "/sr/takmicar/" + GOES + "-nikola-minic", false));
	}

	/* ---------------------------------------------------------------------------------------------------------- */

	private MockHttpServletResponse previewOf(String page, String reader) throws Exception {
		var asking = get("/api/previews/competitor/" + page);

		return http.perform(reader == null ? asking : asking.header("User-Agent", reader)).andReturn().getResponse();
	}

	/** Both languages read by Facebook's crawler, through the preview. */
	private void readByFacebook(String number) throws Exception {
		assertThat(previewOf(number + "-sr", THE_CRAWLER).getStatus()).isEqualTo(200);
		assertThat(previewOf(number + "-en", THE_CRAWLER).getStatus()).isEqualTo(200);
	}

	private MockHttpServletResponse deleted(String number) throws Exception {
		return http.perform(delete("/api/competitors/" + number).param("account", "delete").with(csrf())
				.cookie(new Cookie(SessionCookie.NAME, session.secret()))).andReturn().getResponse();
	}

	private Long id(String number) {
		return db.sql("select id from competitor where member_number = ?").param(number).query(Long.class)
				.optional().orElse(null);
	}

	private List<String> rows() {
		return db.sql("select member_number || ' ' || language || ' ' || coalesce(card, 'null') || ' ' || address"
				+ " from shared_card where member_number in (?, ?, ?) order by member_number, language")
				.params(STAYS, GOES, UNREAD).query(String.class).list();
	}

	private void member(String number, String first, String last) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season,"
						+ " referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, 'M', date '1980-05-05',"
						+ " (select id from place where rank = 1), null, null, 2027,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, "0011223399" + number).update();
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values ((select id from competitor where member_number = ?), 2028, 'feeExempt',"
						+ " 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
				.param(number).update();
	}

	/** Something a case does while the log is listened to. */
	@FunctionalInterface
	interface Doing {
		void run() throws Exception;
	}

	private static List<ILoggingEvent> heardWhile(Class<?> speaker, Doing doing) {
		Logger speaking = (Logger) LoggerFactory.getLogger(speaker);
		ListAppender<ILoggingEvent> heard = new ListAppender<>();

		heard.start();
		speaking.addAppender(heard);

		try {
			doing.run();
			return List.copyOf(heard.list);
		} catch (Exception failed) {
			throw new AssertionError("the case failed while the log was listened to", failed);
		} finally {
			speaking.detachAppender(heard);
			heard.stop();
		}
	}
}
