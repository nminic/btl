package com.btl.portal.web;

import com.btl.portal.TestcontainersConfiguration;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.config.FixedDelayTask;
import org.springframework.scheduling.config.ScheduledTask;
import org.springframework.scheduling.config.ScheduledTaskHolder;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.time.Duration;
import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE PASS THAT SENDS EVERY SERVED TEXT WITH NO TRANSLATION OF WHAT IT NOW SAYS, against a real database and a
 * translator of its own on this machine ({@link ATranslatorOfItsOwn}), so no case sends a text anywhere.
 *
 * <p>Not transactional, for the reason {@code FacebookIsAskedToReadAChangedCardTest} gives: the answer is written
 * by the request's own thread, after the pass has returned, so the case reads what was committed and cleans up
 * after itself.
 *
 * <p><b>Every case has two events at least, and its own is never the first written</b>, so an answer written under
 * the first event of the request, or the first of the table, cannot pass for the answer written under its own.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class TextsAreTranslatedTest {

	private static final ObjectMapper JSON = new ObjectMapper();

	@Autowired
	private JdbcClient db;

	@Autowired
	private TransactionTemplate inOneTransaction;

	@Autowired
	private Translator theOneTheContextBuilt;

	@Autowired
	private TextsAreTranslated theJobTheContextBuilt;

	@Autowired
	private ObjectProvider<ScheduledTaskHolder> schedulers;

	private ATranslatorOfItsOwn service;

	@BeforeEach
	void aServiceOfItsOwn() throws IOException {
		service = new ATranslatorOfItsOwn();
		db.sql("delete from text_translation where ducat_id is null").update();
		db.sql("delete from text_translation_asked").update();
	}

	@AfterEach
	void nothingIsLeftBehind() {
		service.close();
		db.sql("delete from text_translation where ducat_id is null").update();
		db.sql("delete from text_translation_asked").update();
		db.sql("delete from btl_event where slug like 'prevod-%'").update();
	}

	private TextsAreTranslated job(int atMost) {
		return new TextsAreTranslated(db,
				new Translator(ATranslatorOfItsOwn.KEY, ATranslatorOfItsOwn.REGION, service.address(), 2000, JSON),
				inOneTransaction, atMost, Clock.systemUTC(), List.of(WhatIsTranslated.EVENT_DESCRIPTION));
	}

	private TextsAreTranslated job() {
		return job(15000);
	}

	/** One pass, waited on to the end. */
	private static boolean ran(TextsAreTranslated job) throws Exception {
		Optional<CompletableFuture<Void>> sent = job.translateWhatChanged();

		if (sent.isPresent()) {
			sent.get().get(10, TimeUnit.SECONDS);
		}

		return sent.isPresent();
	}

	private long event(String slug, String description) {
		return db.sql("insert into btl_event (slug, name, date, place_id, city, country_id, kind, featured,"
						+ " description, link) values (?, ?, date '2027-05-01', (select id from place where rank = 1),"
						+ " null, null, 'race', false, ?, '') returning id")
				.params(slug, "Događaj " + slug, description)
				.query(Long.class)
				.single();
	}

	private void describe(long event, String description) {
		db.sql("update btl_event set description = ? where id = ?").params(description, event).update();
	}

	private String digestOf(String text) {
		return db.sql("select encode(sha256(convert_to(?, 'UTF8')), 'hex')").param(text).query(String.class).single();
	}

	/** Every translation of one event, by language and origin: {@code en machine -> body}. */
	private Map<String, String> translationsOf(long event) {
		return db.sql("select language || ' ' || origin, body from text_translation where event_id = ?")
				.param(event)
				.query((row, one) -> Map.entry(row.getString(1), row.getString(2)))
				.list()
				.stream()
				.collect(java.util.stream.Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
	}

	private List<String> digestsOf(long event) {
		return db.sql("select distinct source_digest from text_translation where event_id = ? and origin = 'machine'")
				.param(event)
				.query(String.class)
				.list();
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* Off, and on a clock                                                                                         */
	/* ---------------------------------------------------------------------------------------------------------- */

	/**
	 * THE SUITE HAS NO KEY, so the translator the context built is off, and the job the context built reads nothing,
	 * writes nothing and sends nothing; and where that translator would go is Europe's endpoint, whose requests
	 * Microsoft processes in France Central or West Europe (Microsoft Learn, „Region support for Azure Translator").
	 */
	@Test
	void withoutTheKeyNothingIsReadWrittenOrSentAndTheAddressIsEurope() {
		long mine = event("prevod-bez-kljuca", "Kroz grad");

		assertThat(theOneTheContextBuilt.isOn()).as("the suite's own translator is switched on").isFalse();
		assertThat(theOneTheContextBuilt.address().getHost()).isEqualTo("api-eur.cognitive.microsofttranslator.com");
		assertThat(theJobTheContextBuilt.translateWhatChanged()).isEmpty();
		assertThat(translationsOf(mine)).isEmpty();
		assertThat(db.sql("select count(*) from text_translation_asked").query(Integer.class).single()).isZero();
	}

	/** Every five minutes, and the first five minutes after start, which is the owner's „najkasnije 5 minuta". */
	@Test
	void thePassIsScheduledEveryFiveMinutes() {
		String thePass = TextsAreTranslated.class.getName() + ".pass";
		List<ScheduledTask> passes = schedulers.stream()
				.flatMap(each -> each.getScheduledTasks().stream())
				.distinct()
				.filter(task -> task.getTask().getRunnable().toString().equals(thePass))
				.toList();

		assertThat(passes).hasSize(1);
		assertThat(passes.get(0).getTask()).isInstanceOf(FixedDelayTask.class);
		assertThat(((FixedDelayTask) passes.get(0).getTask()).getIntervalDuration()).isEqualTo(Duration.ofMinutes(5));
		assertThat(((FixedDelayTask) passes.get(0).getTask()).getInitialDelayDuration())
				.isEqualTo(Duration.ofMinutes(5));
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* What is sent and what is written                                                                            */
	/* ---------------------------------------------------------------------------------------------------------- */

	/**
	 * A DESCRIPTION IS TRANSLATED INTO BOTH LANGUAGES, under its own event, made of the version that was sent, with
	 * what the service read it as.
	 */
	@Test
	void aDescriptionIsTranslatedIntoBothLanguagesUnderItsOwnEvent() throws Exception {
		long other = event("prevod-drugi", "Drugi opis, drugog događaja");
		long mine = event("prevod-moj", "Kroz grad i nazad");

		assertThat(ran(job())).isTrue();

		assertThat(translationsOf(mine)).isEqualTo(Map.of("en machine", "EN: Kroz grad i nazad",
				"sr machine", "SR: Kroz grad i nazad"));
		assertThat(translationsOf(other)).isEqualTo(Map.of("en machine", "EN: Drugi opis, drugog događaja",
				"sr machine", "SR: Drugi opis, drugog događaja"));
		assertThat(digestsOf(mine)).containsExactly(digestOf("Kroz grad i nazad"));
		assertThat(db.sql("select distinct source_language from text_translation where event_id = ?").param(mine)
				.query(String.class).list()).containsExactly("sr-Latn");
	}

	/** What the service says the text is written in is what is written down, for the text it said it of. */
	@Test
	void whatTheServiceReadEachTextAsIsWrittenUnderThatText() throws Exception {
		long serbian = event("prevod-srpski", "Kroz grad");
		long english = event("prevod-engleski", "Through the town");
		service.heardAs.put("Through the town", "en");

		ran(job());

		assertThat(db.sql("select distinct source_language from text_translation where event_id = ?").param(english)
				.query(String.class).list()).containsExactly("en");
		assertThat(db.sql("select distinct source_language from text_translation where event_id = ?").param(serbian)
				.query(String.class).list()).containsExactly("sr-Latn");
	}

	/** A text whose translation is of what it says now is not sent again: a pass that resends is a quota burnt. */
	@Test
	void aTextAlreadyTranslatedIsNotSentAgain() throws Exception {
		event("prevod-jednom", "Kroz grad");

		ran(job());
		assertThat(ran(job())).as("the second pass sent something").isFalse();

		assertThat(service.textsAsked()).containsExactly("Kroz grad");
	}

	/** An empty description is not sent at all. */
	@Test
	void anEmptyDescriptionIsNotSent() throws Exception {
		event("prevod-prazan", "  ");
		event("prevod-pun", "Kroz grad");

		ran(job());

		assertThat(service.textsAsked()).containsExactly("Kroz grad");
	}

	/**
	 * A CHANGED DESCRIPTION IS SENT AGAIN, AND ITS OLD TRANSLATIONS GO: the next pass after the save, which is the
	 * owner's „najkasnije 5 minuta posle ... čuvanja teksta".
	 */
	@Test
	void aChangedDescriptionIsTranslatedAgainAndTheOldTranslationGoes() throws Exception {
		event("prevod-ostaje", "Ostaje kako je");
		long mine = event("prevod-menja", "Prvo");
		ran(job());

		describe(mine, "Drugo");
		ran(job());

		assertThat(translationsOf(mine)).isEqualTo(Map.of("en machine", "EN: Drugo", "sr machine", "SR: Drugo"));
		assertThat(digestsOf(mine)).containsExactly(digestOf("Drugo"));
		assertThat(service.textsAsked()).containsExactly("Ostaje kako je", "Prvo", "Drugo");
	}

	/**
	 * A DESCRIPTION CHANGED WHILE ITS REQUEST WAS ON ITS WAY gets translations of the words that were SENT, under
	 * the digest of those words, so no route shows them; and the next pass sends the new words. Written down under
	 * the digest of what stands now, the old words would be shown as the translation of the new ones.
	 */
	@Test
	void aDescriptionChangedWhileItWasBeingTranslatedIsTranslatedAgain() throws Exception {
		long mine = event("prevod-u-letu", "Staro");
		service.whileAsked = () -> describe(mine, "Novo");

		ran(job());

		assertThat(digestsOf(mine)).containsExactly(digestOf("Staro"));

		ran(job());

		assertThat(digestsOf(mine)).containsExactly(digestOf("Novo"));
		assertThat(translationsOf(mine)).containsEntry("en machine", "EN: Novo");
	}

	/** An emptied description loses its machine translations; a hand one stays, for the reason V113 gives. */
	@Test
	void anEmptiedDescriptionLosesTheMachinesTranslationsAndKeepsTheHandOne() throws Exception {
		long other = event("prevod-drugi-ostaje", "Drugi");
		long mine = event("prevod-isprazni", "Kroz grad");
		ran(job());
		db.sql("insert into text_translation (event_id, field, language, origin, source_digest, body)"
				+ " values (?, 'description', 'en', 'manual', ?, 'By hand')").params(mine, digestOf("Kroz grad")).update();

		describe(mine, "");
		ran(job());

		assertThat(translationsOf(mine)).isEqualTo(Map.of("en manual", "By hand"));
		assertThat(translationsOf(other)).containsKeys("en machine", "sr machine");
	}

	/** A HAND TRANSLATION IS NEVER REPLACED: the machine writes its own rows beside it. */
	@Test
	void aHandTranslationIsNeverReplaced() throws Exception {
		long mine = event("prevod-rukom", "Kroz grad");
		db.sql("insert into text_translation (event_id, field, language, origin, source_digest, body)"
				+ " values (?, 'description', 'en', 'manual', ?, 'By hand')").params(mine, digestOf("Kroz grad")).update();

		ran(job());

		assertThat(translationsOf(mine)).isEqualTo(Map.of("en manual", "By hand", "en machine", "EN: Kroz grad",
				"sr machine", "SR: Kroz grad"));
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* When the service does not answer                                                                            */
	/* ---------------------------------------------------------------------------------------------------------- */

	/**
	 * A SERVICE THAT DOES NOT ANSWER WRITES NOTHING, and the text is sent again by the next pass, which is the
	 * owner's „ujedno i ponovni pokušaj kad servis ne odgovori".
	 */
	@Test
	void aServiceThatRefusesWritesNothingAndTheNextPassAsksAgain() throws Exception {
		long mine = event("prevod-odbijen", "Kroz grad");
		service.status = 503;

		ran(job());
		assertThat(translationsOf(mine)).isEmpty();

		service.status = 200;
		ran(job());

		assertThat(translationsOf(mine)).containsKeys("en machine", "sr machine");
		assertThat(service.textsAsked()).containsExactly("Kroz grad", "Kroz grad");
	}

	/**
	 * A TEXT THE SERVICE ANSWERS BADLY DOES NOT HOLD THE GOOD TEXTS OF ITS PACK UNTRANSLATED (PENDING, PR 835 S1,
	 * 27.11.2026). Three events in one request, the one in the middle answered with half of what is asked: the texts
	 * either side of it are translated under their own events, so a translation cannot have moved to the neighbour of
	 * the one that was dropped, the middle one has none, and the next pass sends it alone and not the others again.
	 */
	@Test
	void aTextTheServiceAnswersBadlyIsNotTranslatedAndTheGoodOnesOfItsPackAre() throws Exception {
		long before = event("prevod-pre", "Dobar tekst pre");
		long poisoned = event("prevod-otrovan", "Otrovan tekst");
		long after = event("prevod-posle", "Dobar tekst posle");
		service.answeredWithHalf.add("Otrovan tekst");

		ran(job());

		assertThat(translationsOf(before)).isEqualTo(Map.of("en machine", "EN: Dobar tekst pre",
				"sr machine", "SR: Dobar tekst pre"));
		assertThat(translationsOf(after)).isEqualTo(Map.of("en machine", "EN: Dobar tekst posle",
				"sr machine", "SR: Dobar tekst posle"));
		assertThat(translationsOf(poisoned)).isEmpty();

		ran(job());

		assertThat(service.asked).hasSize(2);
		assertThat(service.asked.get(1).texts()).containsExactly("Otrovan tekst");
		assertThat(translationsOf(before)).hasSize(2);
	}

	/**
	 * A TEXT SENT AND NOT ANSWERED GOES BEHIND ONE NEVER SENT, so a text the service keeps failing on cannot hold
	 * the head of every pass. A pass here carries one text only, so the order is the whole answer.
	 */
	@Test
	void aTextSentAndNotAnsweredGoesBehindOneNeverSent() throws Exception {
		event("prevod-prvi", "Prvi");
		service.status = 503;
		ran(job(5));
		event("prevod-kasnije", "Kasnije");

		service.status = 200;
		ran(job(5));

		assertThat(service.textsAsked()).containsExactly("Prvi", "Kasnije");
	}

	/**
	 * A TRANSLATION THAT CHANGED AN ADDRESS THE TEXT CARRIES IS THROWN AWAY, and that version is not sent again: the
	 * same words come back the same. A new version is.
	 */
	@Test
	void aTranslationThatChangedAnAddressIsThrownAwayAndNotAskedForAgain() throws Exception {
		long mine = event("prevod-adresa", "Prijave na [stranici](https://primer.rs/prijava) ili na info@primer.rs.");
		service.changing = text -> text.replace("primer.rs/prijava", "primer.rs/signup");

		ran(job());

		assertThat(translationsOf(mine)).isEmpty();
		assertThat(ran(job())).as("the version thrown away was sent again").isFalse();

		service.changing = text -> text;
		describe(mine, "Prijave na [stranici](https://primer.rs/prijava).");
		ran(job());

		assertThat(translationsOf(mine)).containsEntry("en machine", "EN: Prijave na [stranici](https://primer.rs/prijava).");
	}

	/** A translation that came back empty is thrown away as well: the original is shown, and not nothing. */
	@Test
	void anEmptyTranslationIsThrownAway() throws Exception {
		long mine = event("prevod-prazan-prevod", "Kroz grad");
		service.changing = text -> text.startsWith("EN: ") ? " " : text;

		ran(job());

		assertThat(translationsOf(mine)).isEmpty();
		assertThat(db.sql("select thrown_away from text_translation_asked where event_id = ?").param(mine)
				.query(Boolean.class).single()).isTrue();
	}

	/** And a translation that carries every address unchanged is kept, a mailbox included. */
	@Test
	void aTranslationThatKeepsEveryAddressIsKept() throws Exception {
		long mine = event("prevod-adrese", "Pišite na info@primer.rs ili vidite https://primer.rs/staza.");

		ran(job());

		assertThat(translationsOf(mine)).containsKeys("en machine", "sr machine");
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* How much one pass sends                                                                                     */
	/* ---------------------------------------------------------------------------------------------------------- */

	/** What does not fit in one pass waits for the next one, which takes it first. */
	@Test
	void whatDoesNotFitWaitsForTheNextPass() throws Exception {
		event("prevod-a", "Prvi tekst");
		event("prevod-b", "Drugi tekst");

		ran(job(15));
		assertThat(service.asked).hasSize(1);
		assertThat(service.textsAsked()).containsExactly("Prvi tekst");

		ran(job(15));
		assertThat(service.textsAsked()).containsExactly("Prvi tekst", "Drugi tekst");
	}

	/** Everything that fits goes in ONE request. */
	@Test
	void everythingThatFitsGoesInOneRequest() throws Exception {
		event("prevod-c", "Prvi tekst");
		event("prevod-d", "Drugi tekst");

		ran(job());

		assertThat(service.asked).hasSize(1);
		assertThat(service.asked.get(0).texts()).containsExactly("Prvi tekst", "Drugi tekst");
	}

	/** A text longer than a whole pass goes alone, so no text waits forever behind its own length. */
	@Test
	void aTextLongerThanAPassGoesAlone() throws Exception {
		event("prevod-dug", "Ovo je dug tekst");
		event("prevod-kratak", "Kratak");

		ran(job(10));

		assertThat(service.asked.get(0).texts()).containsExactly("Ovo je dug tekst");
	}

	/**
	 * A TEXT LONGER THAN THE SERVICE TAKES IN ONE REQUEST IS NEVER SENT, and the rest are: no form of the portal
	 * writes one (the description of an event is at most 600 characters), and the service would refuse it whole.
	 */
	@Test
	void aTextLongerThanOneRequestIsNeverSent() throws Exception {
		event("prevod-preveliki", "a".repeat(Translator.AT_MOST_IN_ONE_REQUEST / Translator.INTO.size() + 1));
		event("prevod-obican", "Obican");

		ran(job(10));

		assertThat(service.textsAsked()).containsExactly("Obican");
	}

	/**
	 * ONE TEXT THE DATABASE WILL NOT TAKE IS THAT TEXT'S AND NOT THE PASS'S: the others of the same answer are
	 * still written, and that one is sent again by the next pass.
	 */
	@Test
	void oneTranslationTheDatabaseRefusesDoesNotStopTheOthers() throws Exception {
		long odd = event("prevod-cudan", "Cudan");
		long mine = event("prevod-obicni", "Obicni");
		service.heardAs.put("Cudan", "not a code");

		ran(job());

		assertThat(translationsOf(odd)).isEmpty();
		assertThat(translationsOf(mine)).containsKeys("en machine", "sr machine");
	}

	/** An event deleted while its request was on its way gets nothing, and the others still get theirs. */
	@Test
	void anEventDeletedWhileItWasBeingTranslatedGetsNothing() throws Exception {
		long other = event("prevod-ostaje-ziv", "Ostaje");
		long mine = event("prevod-brisan", "Brisan");
		service.whileAsked = () -> db.sql("delete from btl_event where id = ?").param(mine).update();

		ran(job());

		assertThat(translationsOf(mine)).isEmpty();
		assertThat(translationsOf(other)).containsKeys("en machine", "sr machine");
	}
}
