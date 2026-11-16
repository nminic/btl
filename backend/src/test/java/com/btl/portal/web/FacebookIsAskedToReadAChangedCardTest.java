package com.btl.portal.web;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.btl.portal.TestcontainersConfiguration;
import com.btl.portal.domain.card.WhatACardSays;
import com.btl.portal.domain.card.WhatFacebookIsAskedAgain.Row;
import com.btl.portal.domain.season.SeasonClock;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.config.FixedDelayTask;
import org.springframework.scheduling.config.ScheduledTask;
import org.springframework.scheduling.config.ScheduledTaskHolder;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * FACEBOOK IS ASKED TO READ A PROFILE AGAIN WHEN ITS CARD CHANGED, AND ONLY THEN, AND NEVER WITHOUT ITS KEY.
 *
 * <p>Owner, PDL P11, 15.11.2026, item 10: „posle svake promene koja menja karticu server traži od Facebooka da
 * ponovo pročita profil." Facebook here is a server of this case's own on this machine, on a port the system hands
 * out, which records every request and answers what the case tells it to; nothing leaves the machine.
 *
 * <p><b>WHAT IS CHANGED IS THE STATE AND NOT A ROAD</b>, because that is what the job reads: every case writes the
 * rows a road would have written (a name, a team, a result, a picture, a square of it, a birth date, the switch that
 * hides a profile) or moves the clock, which no road does, and asks the job what it now asks Facebook.
 *
 * <p><b>WHAT FACEBOOK HAS READ IS WRITTEN BY THE CASE</b>, as the crawler's reading writes it (owner, PDL P11,
 * 16.11.2026, item 14: only a profile Facebook has read is ever asked about), because the job reads those rows and
 * never adds one; that the preview writes them so is {@code WhatFacebookHasReadTest}'s.
 *
 * <p><b>Nothing in the setting is the only one of its kind</b> (the rule in {@code CLAUDE.md} about two sources of
 * one value). The member whose card changes is never first in the order, and beside him stand a member whose card
 * does not change, a member of a later season too, and a hidden profile, so a job that asked about every profile,
 * or about the first one, or about the hidden one, asks other addresses than the case expects.
 *
 * <p><b>REAL COMMITS AND NOT A TRANSACTION THAT ROLLS BACK</b>, because a row is written as refreshed from Facebook's
 * answer (owner, PDL P11, 16.11.2026, item 16), on the thread that answer comes back on, with a connection of its own,
 * which sees nothing a case's own transaction has not committed. So every row a case makes is deleted after it.
 */
@SpringBootTest
@Import({TestcontainersConfiguration.class, FacebookIsAskedToReadAChangedCardTest.TheClockThisFileUses.class})
class FacebookIsAskedToReadAChangedCardTest {

	private static final ZoneId BELGRADE = SeasonClock.ZONE;

	private static final Instant OCTOBER_2028 = LocalDateTime.of(2028, 10, 1, 12, 0).atZone(BELGRADE).toInstant();

	private static final Instant FEBRUARY_2029 = LocalDateTime.of(2029, 2, 1, 12, 0).atZone(BELGRADE).toInstant();

	/** First in the order, whose card does not change in any case, and who is a member of 2029 too. */
	private static final String STILL = "000801";

	/** The member whose card changes. */
	private static final String MOVES = "000802";

	/** A hidden profile, whose fee stands. */
	private static final String HIDDEN = "000803";

	/** The number {@link #MOVES} is given in the case where his number moves, which nobody else holds. */
	private static final String MOVED_TO = "000809";

	private static final String APP_ID = "1234567890";

	/** Not a real secret: a string no real one is, long enough to be found in a log. */
	private static final String APP_SECRET = "case0secret0that0must0never0be0logged";

	/** The same shape the other cases with a clock use, and it reports UTC for the same reason. */
	static final class AClockTheCaseMoves extends Clock {

		private volatile Instant now;

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
	static class TheClockThisFileUses {

		@Bean
		@Primary
		AClockTheCaseMoves aClockForTheCards() {
			return new AClockTheCaseMoves(OCTOBER_2028);
		}
	}

	/** One request Facebook was sent. */
	record Asked(String method, String path, String query, String contentType, Map<String, String> form) {
	}

	/** Facebook, as far as this case needs it: it records and answers what it is told to. */
	static final class AFacebookOfItsOwn implements AutoCloseable {

		private final HttpServer server;
		private final ExecutorService answering = Executors.newCachedThreadPool();
		private final List<Asked> asked = new CopyOnWriteArrayList<>();
		private volatile int status = 200;
		/** What Facebook answers to a request about one address (the whole address, host included), instead of {@link #status}. */
		private final Map<String, Integer> statusAt = new ConcurrentHashMap<>();
		private volatile String body = "{\"id\":\"x\",\"title\":\"t\"}";
		private volatile long waitMillis;
		/**
		 * What happens while Facebook holds the request about one address (the whole address, host included), before
		 * it answers, once: what the real Facebook's crawler does while the request is on its way, which is reading the
		 * page.
		 */
		private final Map<String, Runnable> whileAsked = new ConcurrentHashMap<>();

		AFacebookOfItsOwn() throws IOException {
			server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
			server.setExecutor(answering);
			server.createContext("/", exchange -> {
				int answeredWith;

				try (InputStream in = exchange.getRequestBody()) {
					String sent = new String(in.readAllBytes(), StandardCharsets.UTF_8);

					Asked one = new Asked(exchange.getRequestMethod(), exchange.getRequestURI().getPath(),
							exchange.getRequestURI().getRawQuery(),
							exchange.getRequestHeaders().getFirst("Content-Type"), formOf(sent));

					asked.add(one);
					answeredWith = statusAt.getOrDefault(one.form().get("id"), status);
					whileAsked.getOrDefault(one.form().get("id"), () -> { }).run();
					whileAsked.remove(one.form().get("id"));
				}

				if (waitMillis > 0) {
					try {
						Thread.sleep(waitMillis);
					} catch (InterruptedException stopped) {
						Thread.currentThread().interrupt();
					}
				}

				byte[] answer = body.getBytes(StandardCharsets.UTF_8);
				exchange.sendResponseHeaders(answeredWith, answer.length);

				try (OutputStream out = exchange.getResponseBody()) {
					out.write(answer);
				} catch (IOException gone) {
					/* the client gave up first, which is what a case about the term asks for */
				}
			});
			server.start();
		}

		String address() {
			return "http://127.0.0.1:" + server.getAddress().getPort();
		}

		List<String> idsAsked() {
			return asked.stream().map(one -> one.form().get("id")).toList();
		}

		@Override
		public void close() {
			server.stop(0);
			answering.shutdownNow();
		}

		private static Map<String, String> formOf(String sent) {
			Map<String, String> form = new LinkedHashMap<>();

			for (String pair : sent.split("&")) {
				int at = pair.indexOf('=');

				if (at > 0) {
					form.put(URLDecoder.decode(pair.substring(0, at), StandardCharsets.UTF_8),
							URLDecoder.decode(pair.substring(at + 1), StandardCharsets.UTF_8));
				}
			}

			return form;
		}
	}

	@Autowired
	private JdbcClient db;

	@Autowired
	private CompetitorCards cards;

	@Autowired
	private FacebookGraph theOneTheContextBuilt;

	@Autowired
	private TransactionTemplate inOneTransaction;

	@Autowired
	private AClockTheCaseMoves clock;

	@Autowired
	private ObjectProvider<ScheduledTaskHolder> schedulers;

	@Value("${btl.portal.address}")
	private String portal;

	private AFacebookOfItsOwn facebook;

	/** How many pictures the case has made, so that each has a digest of its own, far from any other case's. */
	private long photos = 0xFACEB00C0000L;

	/** Every picture the case has made, which it deletes after itself. */
	private final List<Long> pictures = new ArrayList<>();

	private FacebookIsAskedToReadAChangedCard job;

	@BeforeEach
	void aLeagueAndAFacebook() throws IOException {
		clock.moveTo(OCTOBER_2028);

		member(STILL, "Ana", "Prva", "F");
		member(MOVES, "Nikola", "Minić", "M");
		member(HIDDEN, "Skriveni", "Član", "M");
		memberOf(STILL, 2028);
		memberOf(STILL, 2029);
		memberOf(MOVES, 2028);
		memberOf(HIDDEN, 2028);
		db.sql("update competitor set profile_hidden = true where member_number = ?").param(HIDDEN).update();
		db.sql("insert into team (slug, name, bio, link, place_id, city, country_id, logo_id, first_season,"
				+ " admin_id) values ('prvi-tim', 'Prvi tim', '', '', (select id from place where rank = 1),"
				+ " null, null, null, 2027, null)").update();

		facebook = new AFacebookOfItsOwn();
		job = jobAsking(facebook.address(), 10, 2000);
	}

	@AfterEach
	void facebookGoesAndNothingIsLeftBehind() {
		facebook.close();
		clock.moveTo(OCTOBER_2028);

		String members = "select id from competitor where member_number in ('" + STILL + "', '" + MOVES + "', '"
				+ HIDDEN + "', '" + MOVED_TO + "')";

		for (String table : List.of("verification", "result", "team_membership", "membership")) {
			db.sql("delete from " + table + " where competitor_id in (" + members + ")").update();
		}

		db.sql("delete from competitor where id in (" + members + ")").update();
		db.sql("delete from race where event_id in (select id from btl_event where slug in"
				+ " ('prolece-2028', 'triatlon-2028'))").update();
		db.sql("delete from btl_event where slug in ('prolece-2028', 'triatlon-2028')").update();
		db.sql("delete from team where slug = 'prvi-tim'").update();
		pictures.forEach(id -> db.sql("delete from photo where id = ?").param(id).update());
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* Without Facebook                                                                                            */
	/* ---------------------------------------------------------------------------------------------------------- */

	/**
	 * THE TEST SUITE, QA AND A DEVELOPER'S MACHINE HAVE NO FACEBOOK. The instance the context built reads the
	 * settings every installation reads, and they carry neither the id nor the secret, so it is off; and a job over an
	 * instance that is off reads nothing, writes nothing and sends nothing, however much changes.
	 */
	@Test
	void withoutTheKeyNothingIsReadWrittenOrSent() throws Exception {
		assertThat(theOneTheContextBuilt.isOn()).as("the suite's own Facebook is switched on").isFalse();
		facebookRead(STILL, MOVES);

		List<String> read = rows();

		for (FacebookGraph off : List.of(graph("", "", facebook.address()), graph(APP_ID, "", facebook.address()),
				graph("", APP_SECRET, facebook.address()), graph("  ", "  ", facebook.address()))) {
			FacebookIsAskedToReadAChangedCard idle = new FacebookIsAskedToReadAChangedCard(cards, db, off, portal, 10);

			assertThat(idle.askAgain()).isEmpty();
			rename(MOVES, "Petar");
			assertThat(idle.askAgain()).isEmpty();
			assertThat(off.readAgain(portal + "/sr/takmicar/" + MOVES).get(5, TimeUnit.SECONDS)).isFalse();
		}

		assertThat(rows()).as("a job without Facebook wrote something down").isEqualTo(read);
		assertThat(facebook.asked).as("a job without Facebook sent something").isEmpty();
	}

	/** Half a pair is off, and says so once, without naming either half. */
	@Test
	void halfAPairSaysItIsOffAndNamesNeither() {
		List<ILoggingEvent> heard = heardWhile(FacebookGraph.class, () -> graph(APP_ID, "", facebook.address()));

		assertThat(heard).extracting(ILoggingEvent::getFormattedMessage)
				.containsExactly("Facebook is off: only one of the application's id and secret is set");
		assertThat(heardWhile(FacebookGraph.class, () -> graph(APP_ID, APP_SECRET, facebook.address()))).isEmpty();
		assertThat(heardWhile(FacebookGraph.class, () -> graph("", "", facebook.address()))).isEmpty();
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* What is asked                                                                                               */
	/* ---------------------------------------------------------------------------------------------------------- */

	/**
	 * A PROFILE FACEBOOK HAS NEVER READ IS NEVER ASKED ABOUT (owner, PDL P11, 16.11.2026, item 14), however it changes,
	 * and a run never writes it down: only the crawler does. Beside it a profile Facebook has read changes too, so a run
	 * that asked about every changed profile asks four addresses and not two. And with nothing read, nothing at all.
	 */
	@Test
	void aProfileFacebookHasNeverReadIsNeverAskedAbout() throws Exception {
		assertThat(run()).as("a run with nothing read").isEmpty();
		assertThat(rows()).as("a run wrote down a profile Facebook never read").isEmpty();

		facebookRead(STILL);
		db.sql("update competitor set birth_date = date '1960-05-05' where member_number in (?, ?)")
				.params(STILL, MOVES).update();
		rename(MOVES, "Petar");

		assertThat(run()).containsExactly(portal + "/en/takmicar/" + STILL + "-ana-prva",
				portal + "/sr/takmicar/" + STILL + "-ana-prva");
		assertThat(rows()).as("a run wrote down a profile Facebook never read").allMatch(row -> row.startsWith(STILL))
				.hasSize(2);
		assertThat(run()).as("the second run with nothing changed").isEmpty();
	}

	/**
	 * WHAT A CHANGE THAT IS NOT ON THE CARD ASKS: nothing. The biography, the town, the shirt, the address, a picture
	 * waiting for a moderator, all of them are on the member's row or beside it and none of them is drawn.
	 */
	@Test
	void aChangeThatLeavesTheCardAsItIsAsksNothing() throws Exception {
		facebookRead(STILL, MOVES);

		db.sql("update competitor set bio = 'Trčim od 2010.', city = 'Novi Sad', place_id = null,"
				+ " country_id = (select id from country where code = 'RS'), shirt_size = 'XL',"
				+ " address = 'Druga ulica 2' where member_number = ?").param(MOVES).update();
		long waiting = photo(0.1, 0.1, 0.5);
		db.sql("insert into verification (queue, competitor_id, subject, body, photo_id, state)"
						+ " values ('profiles', (select id from competitor where member_number = ?), 'Nova slika', '', ?,"
						+ " 'waiting')")
				.params(MOVES, waiting).update();

		assertThat(run()).isEmpty();
		assertThat(facebook.asked).isEmpty();
	}

	/**
	 * A NEW NAME IS A NEW CARD, and the addresses Facebook read, which carry the old name, serve it: nginx reads the
	 * number and not the name. So they are asked, in both languages, and the new addresses are not, because Facebook
	 * never read them (owner, PDL P11, 16.11.2026, item 14: only what the crawler opened). The rows keep the old
	 * addresses and get the new card, and no row is added.
	 */
	@Test
	void aNameAsksTheAddressesFacebookReadAndNotTheNewOnes() throws Exception {
		facebookRead(STILL, MOVES);
		rename(MOVES, "Petar");

		assertThat(run()).containsExactly(portal + "/en/takmicar/" + MOVES + "-nikola-minic",
				portal + "/sr/takmicar/" + MOVES + "-nikola-minic");
		assertThat(rows()).filteredOn(row -> row.startsWith(MOVES)).containsExactly(
				MOVES + " " + cards.addressOf(MOVES, WhatACardSays.ENGLISH).orElseThrow() + " /en/takmicar/" + MOVES
						+ "-nikola-minic",
				MOVES + " " + cards.addressOf(MOVES, WhatACardSays.SERBIAN).orElseThrow() + " /sr/takmicar/" + MOVES
						+ "-nikola-minic");
		assertThat(run()).as("asked once, not on every run").isEmpty();
	}

	/**
	 * A MEMBER NUMBER THAT MOVES (a number granted in place of another) leaves the address Facebook read with the old
	 * number in it, and nginx serves that address by its number, which nobody is shown under now: the front page's
	 * preview. So it is asked once and written so, though the member himself is shown as before under his new number.
	 */
	@Test
	void anAddressWhoseNumberMovedServesTheFrontPage() throws Exception {
		facebookRead(STILL, MOVES);
		db.sql("update competitor set member_number = ? where member_number = ?").params(MOVED_TO, MOVES).update();

		assertThat(run()).containsExactly(portal + "/en/takmicar/" + MOVES + "-nikola-minic",
				portal + "/sr/takmicar/" + MOVES + "-nikola-minic");
		assertThat(rows()).filteredOn(row -> row.startsWith(MOVED_TO)).containsExactly(
				MOVED_TO + " null /en/takmicar/" + MOVES + "-nikola-minic",
				MOVED_TO + " null /sr/takmicar/" + MOVES + "-nikola-minic");
		assertThat(run()).as("asked once, not on every run").isEmpty();
	}

	/**
	 * EVERY CHANGE THAT IS ON THE CARD asks its two addresses, one per language, each once: a team, a scored result,
	 * an unscored one, an approved picture, a new square of it, the picture taken away, a birth date that moves the
	 * category, and a team left.
	 */
	@Test
	void everyChangeOnTheCardAsksItsTwoAddresses() throws Exception {
		Map<String, Runnable> changes = new LinkedHashMap<>();
		long event = event("prolece-2028", "2028-04-04", "race");
		long unscored = event("triatlon-2028", "2028-05-05", "unscored");

		changes.put("a team joined", () -> db.sql("insert into team_membership (competitor_id, team_id, season_from,"
						+ " season_to, left_reason) values ((select id from competitor where member_number = ?),"
						+ " (select id from team where slug = 'prvi-tim'), 2028, null, null)").param(MOVES).update());
		changes.put("a scored result", () -> run(MOVES, race(event, "Deset", "2028-04-04", 10), "10"));
		changes.put("an unscored result", () -> run(MOVES, race(unscored, "Plivanje", "2028-05-05", 2), "2"));
		changes.put("a result corrected", () -> db.sql("update result set distance_km = 10.5 where competitor_id ="
						+ " (select id from competitor where member_number = ?) and distance_km = 10").param(MOVES).update());
		changes.put("a picture approved", () -> db.sql("update competitor set photo_id = ? where member_number = ?")
				.params(photo(0.25, 0.5, 0.4), MOVES).update());
		changes.put("its square cut again", () -> db.sql("update photo set crop_x = 0.3 where id ="
						+ " (select photo_id from competitor where member_number = ?)").param(MOVES).update());
		changes.put("the picture taken away", () -> db.sql("update competitor set photo_id = null where member_number = ?")
				.param(MOVES).update());
		changes.put("a birth date that moves the category", () -> db.sql("update competitor set birth_date ="
						+ " date '1960-05-05' where member_number = ?").param(MOVES).update());
		changes.put("a result deleted", () -> db.sql("delete from result where competitor_id ="
						+ " (select id from competitor where member_number = ?) and distance_km = 2").param(MOVES).update());
		changes.put("a team left", () -> db.sql("delete from team_membership where competitor_id ="
						+ " (select id from competitor where member_number = ?)").param(MOVES).update());

		facebookRead(STILL, MOVES);

		for (Map.Entry<String, Runnable> change : changes.entrySet()) {
			change.getValue().run();

			assertThat(run()).as(change.getKey()).containsExactly(
					portal + "/en/takmicar/" + MOVES + "-nikola-minic", portal + "/sr/takmicar/" + MOVES + "-nikola-minic");
		}
	}

	/**
	 * A HIDDEN PROFILE IS ASKED ABOUT ONCE, THE RUN IT IS HIDDEN, and then never while it stays hidden: Facebook reads
	 * the front page's preview at its address, which is what a visitor gets there now, and stops showing the card.
	 * Its rows stay, written down as the front page's, because Facebook has read that profile. Shown again under a
	 * name it got while hidden, it is asked at the addresses Facebook read, which serve its card again.
	 */
	@Test
	void aProfileHiddenIsAskedOnceAndThenNotUntilItIsShownAgain() throws Exception {
		facebookRead(STILL, MOVES);
		db.sql("update competitor set profile_hidden = true where member_number = ?").param(MOVES).update();

		assertThat(run()).containsExactly(portal + "/en/takmicar/" + MOVES + "-nikola-minic",
				portal + "/sr/takmicar/" + MOVES + "-nikola-minic");
		assertThat(rows()).filteredOn(row -> row.startsWith(MOVES)).containsExactly(
				MOVES + " null /en/takmicar/" + MOVES + "-nikola-minic",
				MOVES + " null /sr/takmicar/" + MOVES + "-nikola-minic");

		rename(MOVES, "Petar");
		assertThat(run()).as("a profile that stays hidden is asked about").isEmpty();

		db.sql("update competitor set profile_hidden = false where member_number = ?").param(MOVES).update();
		assertThat(run()).containsExactly(portal + "/en/takmicar/" + MOVES + "-nikola-minic",
				portal + "/sr/takmicar/" + MOVES + "-nikola-minic");
		assertThat(run()).as("asked once, not on every run").isEmpty();
	}

	/**
	 * A FEE THAT LAPSES IS A CHANGE NOBODY MAKES: no road runs and no row is written, only the clock moves on to a
	 * season he is not a member of. His card is gone from what a visitor sees, so he is asked about once; the member
	 * of both seasons beside him is not.
	 */
	@Test
	void aFeeThatLapsesByTheClockAloneIsAskedAbout() throws Exception {
		facebookRead(STILL, MOVES);
		clock.moveTo(FEBRUARY_2029);

		assertThat(run()).containsExactly(portal + "/en/takmicar/" + MOVES + "-nikola-minic",
				portal + "/sr/takmicar/" + MOVES + "-nikola-minic");
		assertThat(rows()).filteredOn(row -> row.startsWith(MOVES))
				.allMatch(row -> row.contains(" null /")).hasSize(2);
	}

	/**
	 * A MEMBER DELETED TAKES HIS ROWS WITH HIM, in the statement that deletes him, so the name his address carries does
	 * not outlive him here, and no run asks about him after: what the deletion asks Facebook it asks itself, at once
	 * ({@link WhatFacebookHasRead#forgetWhenGone}, measured in {@code WhatFacebookHasReadTest}).
	 */
	@Test
	void aDeletedMemberTakesHisRowsAndNoRunAsksAboutHim() throws Exception {
		facebookRead(STILL, MOVES);
		db.sql("delete from membership where competitor_id = (select id from competitor where member_number = ?)")
				.param(MOVES).update();
		db.sql("delete from competitor where member_number = ?").param(MOVES).update();

		assertThat(rows()).noneMatch(row -> row.contains("nikola")).hasSize(2);
		assertThat(run()).isEmpty();
	}

	/** Ten changes to one profile between two runs are one request per address. */
	@Test
	void manyChangesBetweenTwoRunsAreOneRequest() throws Exception {
		facebookRead(STILL, MOVES);

		for (String name : List.of("Petar", "Pavle", "Marko", "Nikola")) {
			rename(MOVES, name);
		}
		db.sql("update competitor set birth_date = date '1960-05-05' where member_number = ?").param(MOVES).update();

		assertThat(run()).containsExactly(portal + "/en/takmicar/" + MOVES + "-nikola-minic",
				portal + "/sr/takmicar/" + MOVES + "-nikola-minic");
	}

	/** At most so many addresses a run, in order; what does not fit is asked the next run and nothing is lost. */
	@Test
	void theLimitSpreadsARunOverTheNextOnes() throws Exception {
		FacebookIsAskedToReadAChangedCard one = jobAsking(facebook.address(), 1, 2000);

		facebookRead(STILL, MOVES);
		db.sql("update competitor set birth_date = date '1960-05-05' where member_number in (?, ?)")
				.params(STILL, MOVES).update();

		List<String> asked = new ArrayList<>();

		for (int run = 0; run < 5; run++) {
			List<String> these = waitedFor(one.askAgain());

			assertThat(these).as("run %s", run).hasSizeLessThanOrEqualTo(1);
			asked.addAll(these);
		}

		assertThat(asked).containsExactly(portal + "/en/takmicar/" + STILL + "-ana-prva",
				portal + "/sr/takmicar/" + STILL + "-ana-prva", portal + "/en/takmicar/" + MOVES + "-nikola-minic",
				portal + "/sr/takmicar/" + MOVES + "-nikola-minic");
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* How it is asked                                                                                             */
	/* ---------------------------------------------------------------------------------------------------------- */

	/**
	 * THE REQUEST IS THE ONE THE OWNER MEASURED: a POST to the root of the Graph API with the address, scrape=true and
	 * the application's token, and the token is in the body and NOT in the address, where a log would keep it.
	 */
	@Test
	void theRequestIsAPostWithTheTokenInItsBody() throws Exception {
		facebookRead(STILL, MOVES);
		db.sql("update competitor set birth_date = date '1960-05-05' where member_number = ?").param(MOVES).update();
		assertThat(run()).hasSize(2);

		assertThat(facebook.asked).hasSize(2).allSatisfy(one -> {
			assertThat(one.method()).isEqualTo("POST");
			assertThat(one.path()).isEqualTo("/");
			assertThat(one.query()).as("the address of the request carries something").isNull();
			assertThat(one.contentType()).isEqualTo("application/x-www-form-urlencoded");
			assertThat(one.form()).containsOnlyKeys("id", "scrape", "access_token")
					.containsEntry("scrape", "true")
					.containsEntry("access_token", APP_ID + "|" + APP_SECRET);
		});
		assertThat(facebook.idsAsked()).containsExactlyInAnyOrder(portal + "/en/takmicar/" + MOVES + "-nikola-minic",
				portal + "/sr/takmicar/" + MOVES + "-nikola-minic");
	}

	/**
	 * FACEBOOK REFUSING IS LOGGED, WITHOUT THE SECRET EVEN WHEN ITS ANSWER CARRIES IT, AND THE ADDRESS IS ASKED AGAIN
	 * (owner, PDL P11, 16.11.2026, item 16: an address is marked as refreshed only when Facebook accepts the request).
	 * The rows stay as they were through every refusal, the next run asks the same addresses, and once Facebook accepts
	 * they are written as it now holds them and nothing more is asked.
	 */
	@Test
	void aRefusalIsLoggedWithoutTheSecretAndAskedAgainUntilFacebookAccepts() throws Exception {
		facebook.status = 400;
		facebook.body = "{\"error\":{\"message\":\"bad token " + APP_ID + "|" + APP_SECRET + "\"," + "\"x\":\""
				+ "y".repeat(400) + "\"}}";
		facebookRead(STILL, MOVES);
		List<String> before = rows();
		db.sql("update competitor set birth_date = date '1960-05-05' where member_number = ?").param(MOVES).update();

		List<ILoggingEvent> heard = heardWhile(FacebookGraph.class, () -> assertThat(run()).hasSize(2));

		assertThat(heard).hasSize(2).allSatisfy(one -> {
			assertThat(one.getLevel()).isEqualTo(Level.WARN);
			assertThat(one.getFormattedMessage()).startsWith("Facebook did not read " + portal + "/")
					.contains(" again: 400 ").contains("[secret]").doesNotContain(APP_SECRET).endsWith("...");
		});
		assertThat(rows()).as("a refused address was written down as refreshed").isEqualTo(before);

		List<String> again = List.of(portal + "/en/takmicar/" + MOVES + "-nikola-minic",
				portal + "/sr/takmicar/" + MOVES + "-nikola-minic");

		assertThat(run()).as("the next run did not ask the refused addresses again").isEqualTo(again);

		facebook.status = 200;
		facebook.body = "{\"id\":\"x\"}";

		assertThat(run()).as("the run Facebook accepts").isEqualTo(again);
		assertThat(rows()).as("an accepted address was not written down").isNotEqualTo(before);
		assertThat(run()).as("an accepted address was asked again").isEmpty();
	}

	/**
	 * THE ANSWER FOR ONE ADDRESS MARKS THAT ADDRESS AND NO OTHER (owner, PDL P11, 16.11.2026, item 16: "adresa se
	 * oznacava kao osvezena tek kad Facebook prihvati zahtev, pa je sledeci prolaz pita ponovo"). Four addresses are
	 * asked in one run, two members' pages in both languages, and Facebook accepts two of them and refuses the other
	 * two, so that the fate of an address is told by the answer for it and by neither of its neighbours: its own
	 * language's twin and the other member's page are each answered the other way. The accepted are written as
	 * Facebook holds them, the refused are not, and the next run asks exactly the refused. Then the answers are
	 * turned round, so no ordering of the addresses can make a job that marks the first, the last or all of them
	 * right.
	 */
	@Test
	void theAnswerForOneAddressMarksThatAddressAndNoOther() throws Exception {
		facebookRead(STILL, MOVES);
		db.sql("update competitor set birth_date = date '1960-05-05' where member_number in (?, ?)")
				.params(STILL, MOVES).update();

		String stillEn = "/en/takmicar/" + STILL + "-ana-prva";
		String stillSr = "/sr/takmicar/" + STILL + "-ana-prva";
		String movesEn = "/en/takmicar/" + MOVES + "-nikola-minic";
		String movesSr = "/sr/takmicar/" + MOVES + "-nikola-minic";
		Map<String, String> held = cardsAt();

		assertThat(held).as("the case reads four addresses").hasSize(4);

		for (String address : List.of(stillSr, movesEn)) {
			facebook.statusAt.put(portal + address, 400);
		}

		assertThat(run()).as("the first run asks all four").containsExactly(portal + stillEn, portal + movesEn,
				portal + stillSr, portal + movesSr);

		Map<String, String> afterTheFirst = cardsAt();

		assertThat(afterTheFirst.get(stillEn)).as("an accepted address was not written down").isNotEqualTo(held.get(stillEn));
		assertThat(afterTheFirst.get(movesSr)).as("an accepted address was not written down").isNotEqualTo(held.get(movesSr));
		assertThat(afterTheFirst.get(stillSr)).as("a refused address was written down as refreshed")
				.isEqualTo(held.get(stillSr));
		assertThat(afterTheFirst.get(movesEn)).as("a refused address was written down as refreshed")
				.isEqualTo(held.get(movesEn));
		assertThat(run()).as("the next run asks the refused two and only them").containsExactly(portal + movesEn,
				portal + stillSr);
		assertThat(cardsAt()).as("a refusal changed a row").isEqualTo(afterTheFirst);

		facebook.statusAt.clear();
		facebook.statusAt.put(portal + movesEn, 200);
		facebook.statusAt.put(portal + stillSr, 500);

		assertThat(run()).containsExactly(portal + movesEn, portal + stillSr);
		assertThat(cardsAt().get(movesEn)).as("the address Facebook now accepted").isNotEqualTo(held.get(movesEn));
		assertThat(cardsAt().get(stillSr)).as("the address Facebook still refused").isEqualTo(held.get(stillSr));
		assertThat(run()).as("only the one still refused is asked").containsExactly(portal + stillSr);

		facebook.statusAt.clear();

		assertThat(run()).containsExactly(portal + stillSr);
		assertThat(cardsAt().get(stillSr)).isNotEqualTo(held.get(stillSr));
		assertThat(run()).isEmpty();
	}

	/**
	 * THE ROW IS WRITTEN FROM FACEBOOK'S ANSWER AND NOT OVER A NEWER ONE. While Facebook takes its time, the crawler
	 * reads the Serbian page anew after the card changed once more, and writes the card it was given; Facebook's
	 * acceptance of the request sent before does not write the older card over it. The English row, which nobody
	 * read in the meantime, is written from the answer.
	 */
	@Test
	void anAcceptedRequestDoesNotWriteOverACardTheCrawlerWroteMeanwhile() throws Exception {
		facebookRead(STILL, MOVES);
		db.sql("update competitor set birth_date = date '1960-05-05' where member_number = ?").param(MOVES).update();
		String asked = cards.addressOf(MOVES, WhatACardSays.ENGLISH).orElseThrow();
		String askedInSerbian = cards.addressOf(MOVES, WhatACardSays.SERBIAN).orElseThrow();
		facebook.waitMillis = 1000;

		List<CompletableFuture<Void>> sent = job.askAgain();

		/* A team joined, which is on the card for certain (a birth date one decade on may stay in the category). */
		db.sql("insert into team_membership (competitor_id, team_id, season_from, season_to, left_reason) values"
				+ " ((select id from competitor where member_number = ?), (select id from team where slug = 'prvi-tim'),"
				+ " 2028, null, null)").param(MOVES).update();
		String newer = cards.addressOf(MOVES, WhatACardSays.SERBIAN).orElseThrow();
		db.sql("update shared_card set card = ? where address = ?")
				.params(newer, "/sr/takmicar/" + MOVES + "-nikola-minic").update();

		assertThat(newer).as("the newer card is the one the request was sent for, so the case measures nothing")
				.isNotEqualTo(askedInSerbian);
		assertThat(sent).as("Facebook answered before the crawler wrote, so the case measures nothing")
				.noneMatch(CompletableFuture::isDone);
		waitedFor(sent);

		assertThat(rows()).filteredOn(row -> row.startsWith(MOVES)).containsExactly(
				MOVES + " " + asked + " /en/takmicar/" + MOVES + "-nikola-minic",
				MOVES + " " + newer + " /sr/takmicar/" + MOVES + "-nikola-minic");
	}

	/**
	 * A READING OF THE CRAWLER WHILE THE REQUEST IS ON ITS WAY IS NOT WRITTEN OVER EVEN WHEN IT WROTE THE VERY CARD THE
	 * ROW HELD (PR 744, fourth round). The profile is hidden, so both addresses are asked and would be written as the
	 * front page. While Facebook holds the request about the Serbian one, the profile is shown again and the crawler
	 * reads that page, through {@link WhatFacebookHasRead#read}, and is given the card the row held before the hiding:
	 * the same value, which a comparison of values cannot tell from no reading at all. Facebook accepts. The Serbian row
	 * keeps the card, because that is what Facebook holds, so a deletion now would still ask about that address
	 * ({@link WhatFacebookHasRead#forgetWhenGone} asks only where a card is held); the English row, which nobody read
	 * meanwhile, is written as the front page. Nothing here waits on a clock: the reading happens inside Facebook's
	 * handling of the request, before it answers.
	 */
	@Test
	void aReadingWhileTheRequestIsOnItsWayIsNotWrittenOverEvenWhenItWroteTheSameCard() throws Exception {
		facebookRead(STILL, MOVES);
		String serbian = "/sr/takmicar/" + MOVES + "-nikola-minic";
		String english = "/en/takmicar/" + MOVES + "-nikola-minic";
		String held = cardsAt().get(serbian);
		WhatFacebookHasRead crawler = new WhatFacebookHasRead(db, inOneTransaction,
				graph(APP_ID, APP_SECRET, facebook.address()), portal);
		List<String> givenToTheCrawler = new CopyOnWriteArrayList<>();

		db.sql("update competitor set profile_hidden = true where member_number = ?").param(MOVES).update();
		facebook.whileAsked.put(portal + serbian, () -> {
			db.sql("update competitor set profile_hidden = false where member_number = ?").param(MOVES).update();
			CompetitorCards.Shown shown = cards.shown(MOVES, WhatACardSays.SERBIAN).orElseThrow();
			givenToTheCrawler.add(shown.address());
			crawler.read("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
					WhatFacebookHasRead.rowOf(MOVES, CompetitorPreviewApi.Words.of(WhatACardSays.SERBIAN), shown));
		});

		assertThat(run()).containsExactly(portal + english, portal + serbian);
		assertThat(givenToTheCrawler).as("the crawler was given another card than the row held, so the case measures"
				+ " a newer card and not the same one").containsExactly(held);
		assertThat(cardsAt()).as("an accepted request wrote over the crawler's reading of the same card")
				.containsEntry(serbian, held).containsEntry(english, null);
		assertThat(run()).as("the address Facebook holds the card at is asked again, or the one it does not is not")
				.containsExactly(portal + english);
	}

	/**
	 * AN ADDRESS FACEBOOK KEEPS REFUSING GOES TO THE BACK, SO THE ONES BEHIND IT ARE ASKED (PR 744, fourth round). One
	 * address a run, and the two addresses first in the order of the member and the address are refused every time:
	 * the four are asked one each in four runs, the two accepted are written as Facebook holds them, and then the two
	 * refused are asked again in turn, because an address is marked as refreshed only when Facebook accepts (owner,
	 * PDL P11, 16.11.2026, item 16).
	 */
	@Test
	void anAddressFacebookKeepsRefusingGoesBehindTheOnesNotYetAsked() throws Exception {
		FacebookIsAskedToReadAChangedCard one = jobAsking(facebook.address(), 1, 2000);

		facebookRead(STILL, MOVES);
		db.sql("update competitor set birth_date = date '1960-05-05' where member_number in (?, ?)")
				.params(STILL, MOVES).update();
		Map<String, String> held = cardsAt();

		String stillEn = "/en/takmicar/" + STILL + "-ana-prva";
		String stillSr = "/sr/takmicar/" + STILL + "-ana-prva";
		String movesEn = "/en/takmicar/" + MOVES + "-nikola-minic";
		String movesSr = "/sr/takmicar/" + MOVES + "-nikola-minic";

		facebook.statusAt.put(portal + stillEn, 400);
		facebook.statusAt.put(portal + stillSr, 400);

		List<String> asked = new ArrayList<>();

		for (int run = 0; run < 6; run++) {
			asked.addAll(waitedFor(one.askAgain()));
		}

		assertThat(asked).containsExactly(portal + stillEn, portal + stillSr, portal + movesEn, portal + movesSr,
				portal + stillEn, portal + stillSr);
		assertThat(cardsAt().get(movesEn)).as("an accepted address was not written down").isNotEqualTo(held.get(movesEn));
		assertThat(cardsAt().get(movesSr)).as("an accepted address was not written down").isNotEqualTo(held.get(movesSr));
		assertThat(cardsAt().get(stillEn)).as("a refused address was written down").isEqualTo(held.get(stillEn));
		assertThat(cardsAt().get(stillSr)).as("a refused address was written down").isEqualTo(held.get(stillSr));
	}

	/** A Facebook that does not answer in time is given up on, logged, and the run is not held up by it. */
	@Test
	void aFacebookThatDoesNotAnswerInTimeIsGivenUpOn() throws Exception {
		facebook.waitMillis = 3000;
		FacebookIsAskedToReadAChangedCard impatient = jobAsking(facebook.address(), 10, 200);

		facebookRead(STILL, MOVES);
		List<String> before = rows();
		db.sql("update competitor set birth_date = date '1960-05-05' where member_number = ?").param(MOVES).update();

		List<CompletableFuture<Void>> sent = new ArrayList<>();
		List<ILoggingEvent> heard = heardWhile(FacebookGraph.class, () -> {
			long started = System.nanoTime();

			sent.addAll(impatient.askAgain());
			assertThat(Duration.ofNanos(System.nanoTime() - started)).as("the run waited for Facebook")
					.isLessThan(Duration.ofMillis(1500));
			waitedFor(sent);
			assertThat(Duration.ofNanos(System.nanoTime() - started)).as("the term of a request was not kept")
					.isLessThan(Duration.ofMillis(2500));
		});

		assertThat(sent).hasSize(2);
		assertThat(heard).hasSize(2).allSatisfy(one -> assertThat(one.getFormattedMessage())
				.startsWith("Facebook was not reached to read " + portal + "/").contains("HttpTimeoutException")
				.doesNotContain(APP_SECRET));
		assertThat(rows()).as("an address Facebook did not answer in time was written down as refreshed")
				.isEqualTo(before);

		facebook.waitMillis = 0;

		assertThat(run()).as("the next run did not ask the addresses Facebook did not answer again").containsExactly(
				portal + "/en/takmicar/" + MOVES + "-nikola-minic", portal + "/sr/takmicar/" + MOVES + "-nikola-minic");
		assertThat(rows()).as("the answer that came in time did not write the rows").isNotEqualTo(before);
	}

	/**
	 * THE RUN DOES NOT WAIT FOR FACEBOOK AT ALL, which is what keeps the scheduler's one thread, shared with every other
	 * job, free of it: with a Facebook that takes three seconds and a term far longer than that, the run is back while
	 * every request is still on its way, and they finish after it.
	 */
	@Test
	void theRunIsBackBeforeFacebookHasAnswered() throws Exception {
		facebook.waitMillis = 3000;
		FacebookIsAskedToReadAChangedCard patient = jobAsking(facebook.address(), 10, 20_000);

		facebookRead(STILL, MOVES);
		List<String> before = rows();
		db.sql("update competitor set birth_date = date '1960-05-05' where member_number = ?").param(MOVES).update();

		long started = System.nanoTime();
		List<CompletableFuture<Void>> sent = patient.askAgain();

		assertThat(Duration.ofNanos(System.nanoTime() - started)).as("the run waited for Facebook")
				.isLessThan(Duration.ofMillis(2000));
		assertThat(sent).hasSize(2).noneMatch(CompletableFuture::isDone);
		assertThat(rows()).as("a row was written as refreshed before Facebook answered").isEqualTo(before);

		waitedFor(sent);

		assertThat(rows()).as("the answer did not write the rows").isNotEqualTo(before);
	}

	/** And one that is not there at all is the same: logged, and nothing is thrown at anybody. */
	@Test
	void aFacebookThatIsNotThereIsLogged() throws Exception {
		int nobody;

		try (ServerSocket free = new ServerSocket(0)) {
			nobody = free.getLocalPort();
		}

		FacebookIsAskedToReadAChangedCard nowhere = jobAsking("http://127.0.0.1:" + nobody, 10, 2000);

		facebookRead(STILL, MOVES);
		List<String> before = rows();
		rename(MOVES, "Petar");

		List<CompletableFuture<Void>> sent = new ArrayList<>();
		List<ILoggingEvent> heard = heardWhile(FacebookGraph.class, () -> {
			sent.addAll(nowhere.askAgain());
			waitedFor(sent);
		});

		assertThat(sent).as("the requests the run made").hasSize(2);
		assertThat(facebook.asked).as("a request reached a Facebook it was not sent to").isEmpty();
		assertThat(heard).hasSize(2).allSatisfy(one -> assertThat(one.getFormattedMessage())
				.startsWith("Facebook was not reached to read ").contains("ConnectException"));
		assertThat(rows()).as("an address Facebook was not reached for was written down as refreshed")
				.isEqualTo(before);
		assertThat(run()).as("the next run did not ask the addresses that were not reached again").containsExactly(
				portal + "/en/takmicar/" + MOVES + "-nikola-minic", portal + "/sr/takmicar/" + MOVES + "-nikola-minic");
		assertThat(rows()).as("the answer that came did not write the rows").isNotEqualTo(before);
	}

	/** An answer that is a success is logged once a page, at the level that is not a warning. */
	@Test
	void aSuccessIsLoggedAsInformation() throws Exception {
		facebookRead(STILL, MOVES);
		db.sql("update competitor set birth_date = date '1960-05-05' where member_number = ?").param(MOVES).update();

		List<ILoggingEvent> heard = heardWhile(FacebookGraph.class, () -> run());

		assertThat(heard).extracting(ILoggingEvent::getLevel).containsExactly(Level.INFO, Level.INFO);
		assertThat(heard).extracting(ILoggingEvent::getFormattedMessage).containsExactlyInAnyOrder(
				"Facebook read " + portal + "/en/takmicar/" + MOVES + "-nikola-minic again",
				"Facebook read " + portal + "/sr/takmicar/" + MOVES + "-nikola-minic again");
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* When it runs                                                                                                */
	/* ---------------------------------------------------------------------------------------------------------- */

	/**
	 * IT RUNS ON THE SCHEDULER, EVERY FIVE MINUTES AND FIVE MINUTES AFTER START, which is what keeps it out of every
	 * request: asked of the scheduler the context really built. And the method the scheduler runs is the run.
	 */
	@Test
	void itRunsOnTheSchedulerEveryFiveMinutesAndFiveAfterStart() throws Exception {
		String thePass = FacebookIsAskedToReadAChangedCard.class.getName() + ".pass";
		List<ScheduledTask> tasks = schedulers.stream()
				.flatMap(each -> each.getScheduledTasks().stream())
				.distinct()
				.filter(task -> task.getTask().getRunnable().toString().equals(thePass))
				.toList();

		assertThat(tasks).as("the scheduler holds no task that asks Facebook").hasSize(1);
		assertThat(tasks.get(0).getTask()).isInstanceOf(FixedDelayTask.class);
		assertThat(((FixedDelayTask) tasks.get(0).getTask()).getIntervalDuration()).isEqualTo(Duration.ofMinutes(5));
		assertThat(((FixedDelayTask) tasks.get(0).getTask()).getInitialDelayDuration()).isEqualTo(Duration.ofMinutes(5));

		facebookRead(STILL, MOVES);
		job.pass();
		db.sql("update competitor set birth_date = date '1960-05-05' where member_number = ?").param(MOVES).update();
		job.pass();

		long waitedUntil = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);

		while (facebook.asked.size() < 2 && System.nanoTime() < waitedUntil) {
			Thread.onSpinWait();
		}

		assertThat(facebook.idsAsked()).containsExactlyInAnyOrder(portal + "/en/takmicar/" + MOVES + "-nikola-minic",
				portal + "/sr/takmicar/" + MOVES + "-nikola-minic");
	}

	@Test
	void noRunAsksFewerThanOneAddress() {
		FacebookGraph on = graph(APP_ID, APP_SECRET, facebook.address());

		assertThatThrownBy(() -> new FacebookIsAskedToReadAChangedCard(cards, db, on, portal, 0))
				.isInstanceOf(IllegalArgumentException.class).hasMessageContaining("btl.facebook.per-pass");
	}

	/* ---------------------------------------------------------------------------------------------------------- */

	/** One run, waited for, and the addresses Facebook was sent in it, sorted, because they are sent at once. */
	private List<String> run() throws Exception {
		int before = facebook.asked.size();
		List<CompletableFuture<Void>> sent = job.askAgain();

		CompletableFuture.allOf(sent.toArray(CompletableFuture[]::new)).get(10, TimeUnit.SECONDS);

		assertThat(facebook.asked).as("Facebook was sent a different number of requests than the run made")
				.hasSize(before + sent.size());

		return facebook.idsAsked().subList(before, facebook.idsAsked().size()).stream().sorted().toList();
	}

	private List<String> waitedFor(List<CompletableFuture<Void>> sent) {
		try {
			CompletableFuture.allOf(sent.toArray(CompletableFuture[]::new)).get(10, TimeUnit.SECONDS);
		} catch (Exception failed) {
			throw new AssertionError("a request failed or never finished", failed);
		}

		assertThat(sent).allSatisfy(one -> assertThat(one).isCompletedWithValue(null));

		return facebook.idsAsked().stream().skip(Math.max(0, facebook.asked.size() - sent.size())).sorted().toList();
	}

	private FacebookIsAskedToReadAChangedCard jobAsking(String graph, int atMost, long waitMillis) {
		return new FacebookIsAskedToReadAChangedCard(cards, db, new FacebookGraph(APP_ID, APP_SECRET, graph, waitMillis),
				portal, atMost);
	}

	private static FacebookGraph graph(String id, String secret, String address) {
		return new FacebookGraph(id, secret, address, 2000);
	}

	/**
	 * THE PROFILES FACEBOOK'S CRAWLER HAS READ, in both languages, as the preview writes them down when the crawler
	 * reads them: the row through {@link WhatFacebookHasRead#rowOf}, the one spelling the preview writes down. That the
	 * preview really writes them so is {@code WhatFacebookHasReadTest}'s.
	 */
	private void facebookRead(String... numbers) {
		for (String number : numbers) {
			for (WhatACardSays language : WhatACardSays.values()) {
				CompetitorCards.Shown shown = cards.shown(number, language).orElseThrow();
				Row row = WhatFacebookHasRead.rowOf(number, CompetitorPreviewApi.Words.of(language), shown);

				db.sql("insert into shared_card (member_number, address, card) values (?, ?, ?)")
						.params(row.memberNumber(), row.address(), row.card()).update();
			}
		}
	}

	/** The card Facebook is written down as holding at every address, by address. */
	private Map<String, String> cardsAt() {
		Map<String, String> held = new LinkedHashMap<>();

		db.sql("select address, card from shared_card order by address")
				.query((row, at) -> held.put(row.getString(1), row.getString(2))).list();

		return held;
	}

	private List<String> rows() {
		return db.sql("select member_number || ' ' || coalesce(card, 'null') || ' ' || address from shared_card"
				+ " order by member_number, address").query(String.class).list();
	}

	/** Something a case does while the log is listened to, which may throw what a case throws. */
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

	private void rename(String number, String first) {
		db.sql("update competitor set first_name = ? where member_number = ?").params(first, number).update();
	}

	private void member(String number, String first, String last, String gender) {
		db.sql("insert into competitor (member_number, first_name, last_name, gender, birth_date,"
						+ " place_id, city, country_id, first_season,"
						+ " referral_code, referred_by, bio, profile_hidden,"
						+ " birthday_shown, father_name, address, shirt_size, health_statement_at)"
						+ " values (?, ?, ?, ?, date '1980-05-05',"
						+ " (select id from place where rank = 1), null, null, 2027,"
						+ " ?, null, '', false, 'none', 'Otac', 'Ulica 1', 'M',"
						+ " timestamptz '2026-09-01 10:00:00+00')")
				.params(number, first, last, gender, "0011223388" + number).update();
	}

	private void memberOf(String number, int season) {
		db.sql("insert into membership (competitor_id, season, basis, decided_by_name, decided_at)"
						+ " values ((select id from competitor where member_number = ?), ?, 'feeExempt',"
						+ " 'Probni Probic', timestamptz '2026-09-01 10:00:00+00')")
				.params(number, season).update();
	}

	private long event(String slug, String day, String kind) {
		return db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind,"
						+ " featured, description, link)"
						+ " values (?, ?, cast(? as date), null, 'Grad', (select id from country where code = 'RS'),"
						+ " ?, false, '', '') returning id")
				.params(slug, slug, day, kind).query(Long.class).single();
	}

	private long race(long event, String name, String day, double kilometres) {
		return db.sql("insert into race (event_id, name, renamed, date, kind, limit_seconds,"
						+ " distance_km, ascent_m, descent_m)"
						+ " values (?, ?, false, cast(? as date), 'length', 0, ?, 0, 0) returning id")
				.params(event, name, day, kilometres).query(Long.class).single();
	}

	private void run(String member, long race, String kilometres) {
		db.sql("insert into result (competitor_id, race_id, race_date, distance_km, ascent_m, descent_m, seconds,"
						+ " points) select (select id from competitor where member_number = ?), id, date,"
						+ " cast(? as numeric), 0, 0, 3600, 0 from race where id = ?")
				.params(member, kilometres, race).update();
	}

	private long photo(double x, double y, double size) {
		long made = db.sql("insert into photo (media_type, byte_size, digest, crop_x, crop_y, crop_diameter)"
						+ " values ('image/jpeg', 10, ?, ?, ?, ?) returning id")
				.params("%064x".formatted(++photos), x, y, size)
				.query(Long.class).single();

		pictures.add(made);

		return made;
	}
}
