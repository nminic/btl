package com.btl.portal.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * EVERY FIVE MINUTES, EVERY TEXT A VISITOR IS SERVED THAT HAS NO TRANSLATION OF WHAT IT NOW SAYS IS SENT TO BE
 * TRANSLATED.
 *
 * <p>Owner, PDL P18, 25.11.2026, chosen among the outcomes offered („Plan prevoda, prvi krug pitanja”): „prevod
 * nastaje najkasnije 5 minuta posle odobrenja ili čuvanja teksta. Jedan prolaz na 5 minuta nalazi svaki nov ili
 * izmenjen tekst, bez obzira kojim putem je postao validan, i on je ujedno i ponovni pokušaj kad servis ne
 * odgovori; do tada posetilac na engleskom vidi original." Refused: at once from every road, and once a night.
 *
 * <p><b>WHY A COMPARISON ON A CLOCK AND NOT A CALL FROM EVERY ROAD</b>, the reason
 * {@link FacebookIsAskedToReadAChangedCard} gives and in its words: „A call from each road is a list, and a list
 * misses the road written tomorrow." An event's description is written by the form of the administration, by the
 * copy of an event when the year turns, and arrives empty from an import and from a result approved for an event
 * nobody had entered; a biography will come by an approval and by the administration. So nothing here is told
 * what happened. It reads every served text ({@link WhatIsTranslated#waiting}) and sends the ones that have no
 * machine translation of their present version, and the same pass is the retry of the ones the service did not
 * answer last time, and the one pass that translates the texts that were there before this existed.
 *
 * <p><b>WHAT IT CANNOT SLOW OR STOP.</b> It runs on the scheduler and reads what has been committed, so a service
 * that is slow, down or refusing cannot make anybody wait or fail: the administration's save commits and answers
 * and has nothing to do with this. The request is sent without waiting ({@link Translator#translate}), so not even
 * the scheduler's one thread, which the other jobs share (see {@code WhatRunsWithoutBeingAsked}), waits on it.
 *
 * <p><b>WHAT IT SPENDS.</b> One request a pass, of at most {@code btl.translator.characters-per-pass} characters
 * of text, fifteen thousand by default. Asking for two languages makes that thirty thousand characters by the
 * service's count, which is inside both of its limits: fifty thousand a request, and, on the free tier, two
 * million an hour „consumed evenly throughout the hour", roughly 33,300 a minute (Microsoft Learn, „Service
 * limits"). On 25.11.2026 production held 60 descriptions of 25,632 characters, so the texts already there go in
 * two passes. A text sent is stamped first ({@code text_translation_asked}, V112), so the next pass takes the ones
 * never sent and the ones sent longest ago first, and a text the service keeps failing on cannot hold the head
 * of every pass.
 *
 * <p><b>WITHOUT THE TRANSLATOR IT DOES NOTHING AT ALL</b> ({@link Translator#isOn}): no reading, no writing, no
 * request. That is a developer's machine, the test suite, and production until the key is written into its
 * {@code .env}.
 */
@Component
class TextsAreTranslated {

	private static final Logger LOG = LoggerFactory.getLogger(TextsAreTranslated.class);

	private final JdbcClient db;
	private final Translator translator;
	private final TransactionTemplate inOneTransaction;
	private final int atMost;

	/** @param atMost how many characters of text one pass may send */
	TextsAreTranslated(JdbcClient db, Translator translator, TransactionTemplate inOneTransaction,
			@Value("${btl.translator.characters-per-pass:15000}") int atMost) {
		this.db = db;
		this.translator = translator;
		this.inOneTransaction = inOneTransaction;
		this.atMost = atMost;
	}

	@Scheduled(fixedDelay = 5, initialDelay = 5, timeUnit = TimeUnit.MINUTES)
	void pass() {
		translateWhatChanged();
	}

	/** One text that waits, as it stood when it was read. */
	record Waiting(WhatIsTranslated what, long id, String text, String digest, Timestamp askedAt) {
	}

	/**
	 * ONE PASS: what has nothing left to say loses its translation, and what waits is sent. Returns the request,
	 * finished once the service has answered and the translations are written; a case waits on it and the
	 * scheduler does not.
	 */
	Optional<CompletableFuture<Void>> translateWhatChanged() {
		if (!translator.isOn()) {
			return Optional.empty();
		}

		for (WhatIsTranslated what : WhatIsTranslated.values()) {
			db.sql(what.forgetting()).update();
		}

		List<Waiting> sent = chosen();

		if (sent.isEmpty()) {
			return Optional.empty();
		}

		sent.forEach(this::stamped);

		return Optional.of(translator.translate(sent.stream().map(Waiting::text).toList())
				.thenAccept(answer -> answer.ifPresent(translated -> {
					for (int at = 0; at < sent.size(); at++) {
						try {
							kept(sent.get(at), translated.get(at));
						} catch (RuntimeException refused) {
							/* One text the database would not take is that text's, not the pass's: the rest are
							   still written, and this one is sent again by the next pass. */
							LOG.warn("The translations of {} {} were not written: {}", sent.get(at).what(),
									sent.get(at).id(), refused.getClass().getSimpleName());
						}
					}
				})));
	}

	/**
	 * WHAT THIS PASS SENDS: the texts that wait, never sent first and then the one sent longest ago, while they fit
	 * in the pass. A text that does not fit waits for the next pass, which will take it first. One that is longer
	 * than a whole pass goes alone if the service can take it in one request, so no text waits forever behind its
	 * own length.
	 */
	private List<Waiting> chosen() {
		List<Waiting> waiting = new ArrayList<>();

		for (WhatIsTranslated what : WhatIsTranslated.values()) {
			waiting.addAll(db.sql(what.waiting())
					.query((row, one) -> new Waiting(what, row.getLong(1), row.getString(2), row.getString(3),
							row.getTimestamp(4)))
					.list());
		}

		waiting.sort(Comparator.comparing(Waiting::askedAt, Comparator.nullsFirst(Comparator.naturalOrder())));

		int languages = Translator.INTO.size();
		List<Waiting> chosen = new ArrayList<>();
		int characters = 0;

		for (Waiting one : waiting) {
			int length = one.text().length();

			if (chosen.isEmpty() && length > atMost && length * languages <= Translator.AT_MOST_IN_ONE_REQUEST) {
				return List.of(one);
			}

			if (characters + length <= atMost) {
				chosen.add(one);
				characters += length;
			}
		}

		return chosen;
	}

	/** A text is written down as sent, with the version that was sent, before the request goes. */
	private void stamped(Waiting one) {
		db.sql("insert into text_translation_asked (" + one.what().key + ", field, source_digest, asked_at)"
						+ " values (?, ?, ?, now())"
						+ " on conflict on constraint text_translation_asked_once do update"
						+ " set source_digest = excluded.source_digest, asked_at = excluded.asked_at,"
						+ " thrown_away = false")
				.params(one.id(), one.what().column, one.digest())
				.update();
	}

	/**
	 * THE TRANSLATIONS OF ONE TEXT ARE WRITTEN, MADE OF THE VERSION THAT WAS SENT, and not of whatever stands there
	 * now: a text changed while its request was on its way gets translations of its old words, which no route shows
	 * because their digest is not its digest, and the next pass sends the new words. A text whose thing is gone by
	 * now gets nothing.
	 *
	 * <p>Unless one of them changed an address the original carries ({@link TranslatedText#addressesIn}), or came back
	 * empty: then none is kept, the original stays what everybody is shown, and this version is not sent again.
	 */
	private void kept(Waiting one, Translator.Translated translated) {
		List<String> addresses = TranslatedText.addressesIn(one.text());
		boolean faithful = translated.into().values().stream()
				.allMatch(text -> !text.isBlank() && TranslatedText.addressesIn(text).equals(addresses));

		if (!faithful) {
			LOG.warn("A translation of {} {} was thrown away: it changed an address the text carries, or was empty",
					one.what(), one.id());
			db.sql("update text_translation_asked set thrown_away = true where " + one.what().key + " = ?"
							+ " and field = ? and source_digest = ?")
					.params(one.id(), one.what().column, one.digest())
					.update();
			return;
		}

		inOneTransaction.executeWithoutResult(status -> {
			db.sql("delete from text_translation where " + one.what().key + " = ? and field = ? and origin = 'machine'")
					.params(one.id(), one.what().column)
					.update();

			translated.into().forEach((language, text) -> db.sql("insert into text_translation ("
							+ one.what().key + ", field, language, origin, source_digest, source_language, body)"
							+ " select ?, ?, ?, 'machine', ?, ?, ? where exists (select 1 from " + one.what().table
							+ " where id = ?)")
					.params(one.id(), one.what().column, language, one.digest(), translated.heardAs(), text, one.id())
					.update());
		});
	}
}
