package com.btl.portal.web;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.account.SessionLife;
import com.btl.portal.domain.card.WhatACardSays;
import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Row;
import com.btl.portal.domain.season.SeasonClock;
import com.btl.portal.domain.token.SecretToken;
import com.sun.net.httpserver.HttpServer;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
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
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
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
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

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
 * asked, whether the member it is asked about is still in the database as another connection reads it. That second
 * half is a signal and not the proof: a request sent before the commit is sent without waiting, and measured on
 * 16.11.2026 it reached this server after the commit all the same. What holds the order is
 * {@link #aDeletionThatRollsBackAsksNothing}: asked before the commit, a deletion that rolls back has asked.
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

		/**
		 * WHAT WAS ASKED FROM THE {@code before}TH REQUEST ON, AS A SNAPSHOT. {@code asked} is a
		 * {@link CopyOnWriteArrayList}, and the {@code subList} of one is a view that throws
		 * {@link java.util.ConcurrentModificationException} on any read after the list has grown, which a request of
		 * this fake Facebook's own threads does at any moment. Four cases read a view of it while the portal's threads
		 * were still asking, and one of them failed on CI with exactly that on 24.11.2026 (a run of
		 * {@code noOrderLosesAnAddressFacebookRead}, on a pull request that does not touch this class). The copy is
		 * taken in one step, and the view is of the copy.
		 */
		List<Asked> since(int before) {
			List<Asked> all = List.copyOf(asked);

			return all.subList(before, all.size());
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

	@Autowired
	private FacebookGraph graph;

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
				GOES + " " + cards.addressOf(GOES, WhatACardSays.ENGLISH).orElseThrow() + " /en/takmicar/" + GOES
						+ "-nikola-minic",
				GOES + " " + cards.addressOf(GOES, WhatACardSays.SERBIAN).orElseThrow() + " /sr/takmicar/" + GOES
						+ "-nikola-minic");
	}

	/**
	 * Read again at the SAME address after the card changed, the row is the card as Facebook was given it this time,
	 * and it is still one row.
	 */
	@Test
	void readAgainTheRowIsWhatItWasGivenThisTime() throws Exception {
		previewOf(GOES + "-sr", THE_CRAWLER);
		String before = cards.addressOf(GOES, WhatACardSays.SERBIAN).orElseThrow();

		db.sql("update competitor set birth_date = date '1960-05-05' where member_number = ?").param(GOES).update();
		previewOf(GOES + "-sr", THE_CRAWLER);

		assertThat(rows()).containsExactly(GOES + " " + cards.addressOf(GOES, WhatACardSays.SERBIAN).orElseThrow()
				+ " /sr/takmicar/" + GOES + "-nikola-minic").noneMatch(row -> row.contains(before));
	}

	/**
	 * READ AT ANOTHER ADDRESS (the member was renamed), the reading is a row of its own, once however often the
	 * crawler comes, and the row of the address Facebook read before stays as it was, with the card it was given
	 * there: no reading touches another address.
	 */
	@Test
	void readAtAnotherAddressTheReadingIsARowOfItsOwnAndTheOldOneStays() throws Exception {
		previewOf(GOES + "-sr", THE_CRAWLER);
		previewOf(STAYS + "-sr", THE_CRAWLER);
		String before = cards.addressOf(GOES, WhatACardSays.SERBIAN).orElseThrow();
		List<String> theOther = rows().stream().filter(row -> row.startsWith(STAYS)).toList();

		db.sql("update competitor set first_name = 'Petar' where member_number = ?").param(GOES).update();
		previewOf(GOES + "-sr", THE_CRAWLER);
		previewOf(GOES + "-sr", THE_CRAWLER);

		assertThat(rows()).filteredOn(row -> row.startsWith(GOES)).containsExactly(
				GOES + " " + before + " /sr/takmicar/" + GOES + "-nikola-minic",
				GOES + " " + cards.addressOf(GOES, WhatACardSays.SERBIAN).orElseThrow() + " /sr/takmicar/" + GOES
						+ "-petar-minic");
		assertThat(rows()).filteredOn(row -> row.startsWith(STAYS)).isEqualTo(theOther);
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
		db.sql("update competitor set birth_date = date '1960-05-05' where member_number = ?").param(GOES).update();

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
		assertThat(answers.get(0).getContentAsString()).contains("<title>Nikola Minić u Balkanskoj trkačkoj ligi</title>");
		assertThat(took).as("the page waited for the write").isLessThan(Duration.ofMillis(1500));
		assertThat(heard).hasSize(1).allSatisfy(one -> {
			assertThat(one.getLevel()).isEqualTo(Level.WARN);
			assertThat(one.getFormattedMessage()).startsWith("What Facebook read was not written down: ")
					.doesNotContain(GOES).doesNotContain("nikola").doesNotContain("Nikola");
		});
		assertThat(rows()).as("the write that gave up wrote something").isEqualTo(before);
	}

	/** Without Facebook nothing is written down, and a deletion reads and asks nothing. */
	@Test
	void withoutFacebookNothingIsWrittenAndNothingAsked() throws Exception {
		WhatFacebookHasRead off = new WhatFacebookHasRead(db, inOneTransaction,
				new FacebookGraph("", "", FACEBOOK.address(), 2000), portal);
		CompetitorCards.Shown shown = cards.shown(GOES, WhatACardSays.SERBIAN).orElseThrow();

		Row row = WhatFacebookHasRead.rowOf(GOES, CompetitorPreviewApi.Words.SERBIAN, shown);

		off.read(THE_CRAWLER, row);
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
	 * A FACEBOOK THAT DOES NOT ANSWER IN TIME IS LOGGED WITHOUT THE PAGE TOO, the third way a request about a deleted
	 * member's page ends beside a success and a refusal (the two cases above), and the line {@link FacebookGraph} writes
	 * for a Facebook not reached, which is also the line of a connection refused. Through the deletion itself, with
	 * Facebook taking longer than the two seconds this class gives a request.
	 */
	@Test
	void aFacebookThatDoesNotAnswerInTimeIsLoggedWithoutTheDeletedMembersPage() throws Exception {
		readByFacebook(GOES);
		FACEBOOK.waitMillis = 3000;

		List<ILoggingEvent> heard = heardWhile(FacebookGraph.class, () -> {
			assertThat(deleted(GOES).getStatus()).isEqualTo(204);
			FACEBOOK.askedOnce(2);
			Thread.sleep(2500);
		});

		assertThat(FACEBOOK.asked).as("the deletion did not ask both its addresses").hasSize(2);
		assertThat(heard).hasSize(2).allSatisfy(one -> {
			assertThat(one.getLevel()).isEqualTo(Level.WARN);
			assertThat(one.getFormattedMessage())
					.startsWith("Facebook was not reached to read the page of a deleted member again: ")
					.contains("HttpTimeoutException")
					.doesNotContain(GOES).doesNotContainIgnoringCase("nikola").doesNotContain("takmicar");
		});
	}

	/**
	 * THE REQUESTS ARE HANDED TO FACEBOOK ONLY AFTER THE COMMIT, NEVER BEFORE IT, and this is told by the order Spring
	 * keeps and not by a race. Owner, PDL P11, 16.11.2026, item 14: the name is kept not a minute after the deletion,
	 * and a request that went before the commit would have Facebook read the page while the member still stands, so it
	 * could keep his name. The case's own synchronization counts the requests handed over at {@code beforeCompletion},
	 * which Spring calls after every {@code beforeCommit} and before the commit itself, so a request sent at
	 * {@code beforeCommit} is counted there every time; and after the commit both addresses have been handed over. The
	 * Facebook here is a {@link FacebookGraph} that counts what it is handed as it is handed, so no request on its way
	 * stands between the asking and the counting (the server of this class records a request only once it has
	 * arrived, which is what let the order hold only by a race, PR 744, second round).
	 */
	@Test
	void theRequestsAreHandedToFacebookAfterTheCommitAndNeverBeforeIt() throws Exception {
		readByFacebook(GOES);
		List<String> handed = new CopyOnWriteArrayList<>();
		FacebookGraph counting = new FacebookGraph("1234567890", "case0secret0of0the0reading0class",
				FACEBOOK.address(), 2000) {

			@Override
			CompletableFuture<Boolean> readAgainUnnamed(String address) {
				handed.add(address);
				return CompletableFuture.completedFuture(true);
			}
		};
		WhatFacebookHasRead reading = new WhatFacebookHasRead(db, inOneTransaction, counting, portal);
		List<Integer> handedBeforeTheCommit = new ArrayList<>();

		inOneTransaction.executeWithoutResult(t -> {
			reading.forgetWhenGone(id(GOES));
			TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {

				@Override
				public void beforeCompletion() {
					handedBeforeTheCommit.add(handed.size());
				}
			});
		});

		assertThat(handedBeforeTheCommit).as("a request was handed to Facebook before the commit").containsExactly(0);
		assertThat(handed).containsExactlyInAnyOrder(portal + "/en/takmicar/" + GOES + "-nikola-minic",
				portal + "/sr/takmicar/" + GOES + "-nikola-minic");
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

	/* ---------------------------------------------------------------------------------------------------------- */
	/* A member renamed after Facebook read him: no address Facebook saw is ever lost                              */
	/* ---------------------------------------------------------------------------------------------------------- */

	/** The two addresses, one per language, at which a member of this name is shown. */
	private List<String> bothAddressesOf(String name) {
		return List.of(portal + "/sr/takmicar/" + GOES + "-" + name, portal + "/en/takmicar/" + GOES + "-" + name);
	}

	/**
	 * THE CRAWLER OPENING THE NEW ADDRESS BEFORE THE JOB HAS RUN LOSES NO ADDRESS. The crawler opens the Serbian page
	 * at its NEW address before the next pass, which is a row of its own and serves what Facebook was just given; the
	 * old addresses, the ones people pasted, are still asked, in both languages, and nothing else is.
	 */
	@Test
	void aRenameThatTheCrawlerOpenedBeforeThePassStillAsksTheOldAddresses() throws Exception {
		readByFacebook(GOES);
		db.sql("update competitor set first_name = 'Petar' where member_number = ?").param(GOES).update();
		previewOf(GOES + "-sr", THE_CRAWLER);

		CompletableFuture.allOf(job.askAgain().toArray(CompletableFuture[]::new)).get(10, TimeUnit.SECONDS);

		assertThat(FACEBOOK.askedOnce(2)).extracting(Asked::id)
				.containsExactlyInAnyOrderElementsOf(bothAddressesOf("nikola-minic"));
	}

	/**
	 * The control: nobody opened the new address, and the two Facebook read are asked, and not the two new ones it
	 * never read (owner, PDL P11, 16.11.2026, item 14: only what the crawler opened).
	 */
	@Test
	void aRenameThatNobodyOpenedAsksTheTwoAddressesFacebookRead() throws Exception {
		readByFacebook(GOES);
		db.sql("update competitor set first_name = 'Petar' where member_number = ?").param(GOES).update();

		CompletableFuture.allOf(job.askAgain().toArray(CompletableFuture[]::new)).get(10, TimeUnit.SECONDS);

		assertThat(FACEBOOK.askedOnce(2)).extracting(Asked::id)
				.containsExactlyInAnyOrderElementsOf(bothAddressesOf("nikola-minic"));
	}

	/**
	 * A DELETION AFTER A RENAME THE CRAWLER OPENED asks every address Facebook saw, the old ones and the new ones: the
	 * name is kept not a minute after the deletion, at either spelling.
	 */
	@Test
	void aDeletionAfterARenameTheCrawlerOpenedAsksTheOldAndTheNewAddresses() throws Exception {
		readByFacebook(GOES);
		db.sql("update competitor set first_name = 'Petar' where member_number = ?").param(GOES).update();
		readByFacebook(GOES);

		assertThat(deleted(GOES).getStatus()).isEqualTo(204);

		List<String> expected = new ArrayList<>(bothAddressesOf("nikola-minic"));
		expected.addAll(bothAddressesOf("petar-minic"));
		assertThat(FACEBOOK.askedOnce(4)).extracting(Asked::id).containsExactlyInAnyOrderElementsOf(expected);
	}

	/** A deletion after a rename that nobody opened asks the two addresses Facebook saw, and not the ones it never did. */
	@Test
	void aDeletionAfterARenameNobodyOpenedAsksOnlyTheOldAddresses() throws Exception {
		readByFacebook(GOES);
		db.sql("update competitor set first_name = 'Petar' where member_number = ?").param(GOES).update();

		assertThat(deleted(GOES).getStatus()).isEqualTo(204);

		assertThat(FACEBOOK.askedOnce(2)).extracting(Asked::id)
				.containsExactlyInAnyOrderElementsOf(bothAddressesOf("nikola-minic"));
	}

	/**
	 * TWO RENAMES BEFORE THE PASS, the crawler opening the page between them: the middle address is one Facebook saw,
	 * and it is asked all the same.
	 */
	@Test
	void twoRenamesWithTheCrawlerBetweenThemLoseTheMiddleAddressNowhere() throws Exception {
		readByFacebook(GOES);
		db.sql("update competitor set first_name = 'Petar' where member_number = ?").param(GOES).update();
		previewOf(GOES + "-sr", THE_CRAWLER);
		db.sql("update competitor set first_name = 'Marko' where member_number = ?").param(GOES).update();
		previewOf(GOES + "-sr", THE_CRAWLER);

		assertThat(deleted(GOES).getStatus()).isEqualTo(204);

		assertThat(FACEBOOK.askedOnce(4)).extracting(Asked::id).containsExactlyInAnyOrder(
				portal + "/sr/takmicar/" + GOES + "-nikola-minic", portal + "/en/takmicar/" + GOES + "-nikola-minic",
				portal + "/sr/takmicar/" + GOES + "-petar-minic", portal + "/sr/takmicar/" + GOES + "-marko-minic");
	}

	/**
	 * WHAT THE JOB ASKED ABOUT STAYS WRITTEN DOWN, with the card Facebook now holds there, so that the next pass asks
	 * nothing and a deletion after it still asks every address: no pass takes a row out.
	 */
	@Test
	void noPassTakesARowOutAndTheNextPassAsksNothing() throws Exception {
		readByFacebook(GOES);
		db.sql("update competitor set first_name = 'Petar' where member_number = ?").param(GOES).update();
		previewOf(GOES + "-sr", THE_CRAWLER);

		CompletableFuture.allOf(job.askAgain().toArray(CompletableFuture[]::new)).get(10, TimeUnit.SECONDS);
		FACEBOOK.askedOnce(2);

		assertThat(rows()).containsExactly(
				GOES + " " + cards.addressOf(GOES, WhatACardSays.ENGLISH).orElseThrow() + " /en/takmicar/" + GOES
						+ "-nikola-minic",
				GOES + " " + cards.addressOf(GOES, WhatACardSays.SERBIAN).orElseThrow() + " /sr/takmicar/" + GOES
						+ "-nikola-minic",
				GOES + " " + cards.addressOf(GOES, WhatACardSays.SERBIAN).orElseThrow() + " /sr/takmicar/" + GOES
						+ "-petar-minic");
		assertThat(job.askAgain()).as("the next pass asked again").isEmpty();
	}

	/**
	 * A RENAME UNDONE BEFORE THE PASS leaves a page equal to what the row holds, which the plan skips, and the address the
	 * crawler read in between is asked all the same: Facebook saw it, and the name sits there.
	 */
	@Test
	void aRenameUndoneBeforeThePassStillAsksTheAddressTheCrawlerReadInBetween() throws Exception {
		readByFacebook(GOES);
		db.sql("update competitor set first_name = 'Petar' where member_number = ?").param(GOES).update();
		previewOf(GOES + "-sr", THE_CRAWLER);
		db.sql("update competitor set first_name = 'Nikola' where member_number = ?").param(GOES).update();

		CompletableFuture.allOf(job.askAgain().toArray(CompletableFuture[]::new)).get(10, TimeUnit.SECONDS);

		assertThat(FACEBOOK.askedOnce(1)).extracting(Asked::id)
				.containsExactly(portal + "/sr/takmicar/" + GOES + "-petar-minic");
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* The invariant: no order of readings, passes, renames, hidings and a deletion loses an address               */
	/* ---------------------------------------------------------------------------------------------------------- */

	/**
	 * The orders a case walks, each a list of steps: {@code read <number> <language>} (the crawler reads a profile
	 * through the preview, at the address it names), {@code pass} (one run of the job with the case's limit),
	 * {@code refused} (one run in which Facebook refuses every request, owner, PDL P11, 16.11.2026, item 16),
	 * {@code rename <first name>}, {@code card} (a change on both members' cards and nothing else), {@code hide} and
	 * {@code show}. All of them are of {@link #GOES} but the readings; {@link #STAYS} is read in both languages first and
	 * is first in the order, so a limit has his rows to spend itself on.
	 */
	private static final Map<String, List<String>> ORDERS = Map.of(
			"the crawler reads the new address before a pass",
			List.of("rename Petar", "read 000902 sr", "pass", "card", "pass"),
			"a rename undone after the crawler read the new address",
			List.of("rename Petar", "read 000902 sr", "rename Nikola", "pass"),
			"two renames with the crawler between them",
			List.of("rename Petar", "read 000902 sr", "rename Marko", "read 000902 sr", "pass"),
			"hidden, renamed while hidden, shown again and read",
			List.of("hide", "pass", "rename Petar", "show", "read 000902 sr", "pass"),
			"cards changing around a rename read in English",
			List.of("card", "pass", "rename Petar", "read 000902 en", "card", "pass", "pass"),
			"a rename and nothing more",
			List.of("rename Petar"),
			"a rename read in both languages, then undone",
			List.of("card", "rename Petar", "read 000902 sr", "read 000902 en", "pass", "rename Nikola", "pass"),
			"Facebook refusing twice after a rename read anew",
			List.of("rename Petar", "read 000902 sr", "refused", "refused", "pass"),
			"Facebook refusing while hidden and shown again",
			List.of("hide", "refused", "show", "refused", "card", "pass"));

	static Stream<Arguments> everyOrderAtEveryLimit() {
		return ORDERS.keySet().stream().sorted().flatMap(order -> Stream.of(1, 2, 3, 10).flatMap(limit ->
				Stream.of(Arguments.of(order, limit, false), Arguments.of(order, limit, true))));
	}

	/**
	 * THE INVARIANT, BY BEHAVIOUR AND NOT BY INSTANCE. A Facebook of the case's own is kept beside the portal: what it
	 * holds at every address it has read, set when the crawler reads an address (to what the address served) and when
	 * it accepts a request to read one again (to what the address serves at that moment), and never otherwise, so a
	 * refused request leaves it holding what it held; it does not read
	 * again by itself after a request, so nothing here rests on the crawler coming back. After every step:
	 * <ul>
	 * <li><b>no address is lost:</b> every address where Facebook holds something the address no longer serves still has
	 * a row whose card is not what the address serves, so a pass will ask it;</li>
	 * <li><b>the limit holds:</b> no pass sends more than its limit;</li>
	 * <li>and at the end, either straight away or after passes until one asks nothing (which must come, and after which
	 * Facebook holds what every address serves), the member is deleted and <b>no address Facebook holds carries his
	 * card</b>, every request made after the commit.</li>
	 * </ul>
	 * What an address serves is asked of the card's own reading ({@link CompetitorCards#addressOf}), by the language
	 * and the number in the address, which is how nginx serves it.
	 */
	@ParameterizedTest(name = "{0}, at most {1} a pass, settled first: {2}")
	@MethodSource("everyOrderAtEveryLimit")
	void noOrderLosesAnAddressFacebookRead(String order, int limit, boolean settledFirst) throws Exception {
		FacebookIsAskedToReadAChangedCard pass = new FacebookIsAskedToReadAChangedCard(cards, db, graph, portal, limit);
		Map<String, String> facebook = new HashMap<>();
		Map<String, String> names = new HashMap<>(Map.of(STAYS, "ana-prva", GOES, "nikola-minic"));
		List<String> steps = new ArrayList<>(List.of("read 000901 sr", "read 000901 en", "read 000902 sr",
				"read 000902 en"));
		steps.addAll(ORDERS.get(order));
		boolean older = false;

		for (String step : steps) {
			String[] said = step.split(" ");

			switch (said[0]) {
				case "read" -> {
					String address = "/" + said[2] + "/takmicar/" + said[1] + "-" + names.get(said[1]);

					previewOf(said[1] + "-" + said[2], THE_CRAWLER);
					facebook.put(address, servedAt(address));
				}
				case "pass", "refused" -> {
					int before = FACEBOOK.asked.size();
					FACEBOOK.status = said[0].equals("pass") ? 200 : 500;
					List<CompletableFuture<Void>> sent = pass.askAgain();

					CompletableFuture.allOf(sent.toArray(CompletableFuture[]::new)).get(10, TimeUnit.SECONDS);
					FACEBOOK.status = 200;
					assertThat(sent).as("%s: a pass sent more than its limit", step).hasSizeLessThanOrEqualTo(limit);

					if (said[0].equals("pass")) {
						FACEBOOK.since(before).forEach(one -> readAgain(facebook, one));
					}
				}
				case "rename" -> {
					db.sql("update competitor set first_name = ? where member_number = ?").params(said[1], GOES).update();
					names.put(GOES, said[1].toLowerCase(java.util.Locale.ROOT) + "-minic");
				}
				case "card" -> {
					older = !older;
					db.sql("update competitor set birth_date = ? where member_number in (?, ?)")
							.params(java.sql.Date.valueOf(older ? "1960-05-05" : "1980-05-05"), STAYS, GOES).update();
				}
				case "hide", "show" -> db.sql("update competitor set profile_hidden = ? where member_number = ?")
						.params(said[0].equals("hide"), GOES).update();
				default -> throw new IllegalArgumentException(step);
			}

			noAddressIsLost(facebook, order + ", after " + step);
		}

		if (settledFirst) {
			int passes = 0;

			while (true) {
				int before = FACEBOOK.asked.size();
				List<CompletableFuture<Void>> sent = pass.askAgain();

				CompletableFuture.allOf(sent.toArray(CompletableFuture[]::new)).get(10, TimeUnit.SECONDS);
				assertThat(sent).as("a pass sent more than its limit").hasSizeLessThanOrEqualTo(limit);
				FACEBOOK.since(before).forEach(one -> readAgain(facebook, one));
				noAddressIsLost(facebook, order + ", settling");

				if (sent.isEmpty()) {
					break;
				}

				assertThat(++passes).as("%s: the passes never came to rest", order).isLessThan(20);
			}

			facebook.forEach((address, holds) -> assertThat(holds)
					.as("%s: settled, Facebook still holds a card %s no longer serves", order, address)
					.isEqualTo(servedAt(address)));
		}

		int before = FACEBOOK.asked.size();
		List<String> his = facebook.entrySet().stream()
				.filter(held -> held.getValue() != null && held.getValue().contains("/competitor/" + GOES + "-"))
				.map(Map.Entry::getKey).toList();

		assertThat(deleted(GOES).getStatus()).isEqualTo(204);

		long until = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);

		while (!FACEBOOK.since(before).stream().map(Asked::id).toList()
				.containsAll(his.stream().map(address -> portal + address).toList()) && System.nanoTime() < until) {
			Thread.sleep(20);
		}

		List<Asked> afterTheDeletion = List.copyOf(FACEBOOK.since(before));

		afterTheDeletion.forEach(one -> readAgain(facebook, one));
		assertThat(afterTheDeletion).as("%s: a deletion asked before its commit", order)
				.noneMatch(Asked::memberStillThere);
		assertThat(facebook).as("%s: after the deletion Facebook keeps his card at an address", order)
				.allSatisfy((address, holds) -> assertThat(holds == null || !holds.contains("/competitor/" + GOES + "-"))
						.as(address).isTrue());
	}

	/**
	 * THE FAKE FACEBOOK'S LIST OF REQUESTS CAN BE READ WHILE ITS OWN THREADS ARE ADDING TO IT. The cases that settle
	 * the addresses read what was asked since a point while the crawler's requests still arrive, and a view of the
	 * list itself (a {@code subList} of a copy-on-write list) fails on the first read after an arrival. Here the
	 * arrivals are made by a thread of this case, as hard as it can, and the reader asks again and again; nothing may
	 * be thrown and nothing may be lost.
	 */
	@Test
	void whatWasAskedSinceAPointCanBeReadWhileMoreIsStillArriving() throws Exception {
		ExecutorService arriving = Executors.newSingleThreadExecutor();
		int arrivals = 3000;
		CountDownLatch started = new CountDownLatch(1);

		try {
			java.util.concurrent.Future<?> done = arriving.submit(() -> {
				started.countDown();

				for (int one = 0; one < arrivals; one++) {
					FACEBOOK.asked.add(new Asked("a request " + one, true));
				}
			});

			assertThat(started.await(10, TimeUnit.SECONDS)).isTrue();

			long reads = 0;

			while (!done.isDone()) {
				assertThat(FACEBOOK.since(0).stream().map(Asked::id).toList()).isNotNull();
				reads++;
			}

			done.get(10, TimeUnit.SECONDS);

			assertThat(reads).as("the reader never overlapped the arrivals, so this case measured nothing").isPositive();
			assertThat(FACEBOOK.since(arrivals - 10)).extracting(Asked::id).hasSize(10);
			assertThat(FACEBOOK.since(arrivals)).isEmpty();
		} finally {
			arriving.shutdownNow();
		}
	}

	/**
	 * Every address where Facebook holds what the address no longer serves has a row that will ask it: a row at that
	 * address whose card is not what it serves.
	 */
	private void noAddressIsLost(Map<String, String> facebook, String when) {
		facebook.forEach((address, holds) -> {
			String serves = servedAt(address);

			if (!Objects.equals(holds, serves)) {
				List<String> written = db.sql("select coalesce(card, 'null') from shared_card where address = ?")
						.param(address).query(String.class).list();

				assertThat(written).as("%s: Facebook holds a card %s no longer serves, and no row will ask it (rows: %s)",
						when, address, written).anyMatch(card -> !card.equals(String.valueOf(serves)));
			}
		});
	}

	/** Facebook, having accepted a request, holds what the address serves at that moment. */
	private void readAgain(Map<String, String> facebook, Asked one) {
		String address = one.id().substring(portal.length());

		facebook.put(address, servedAt(address));
	}

	/** What an address serves now, by the language and the number in it, as nginx serves it; null for the front page. */
	private String servedAt(String address) {
		String[] parts = address.split("/");

		return cards.addressOf(parts[3].substring(0, 6),
				parts[1].equals("sr") ? WhatACardSays.SERBIAN : WhatACardSays.ENGLISH).orElse(null);
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
		return db.sql("select member_number || ' ' || coalesce(card, 'null') || ' ' || address"
				+ " from shared_card where member_number in (?, ?, ?) order by member_number, address")
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
