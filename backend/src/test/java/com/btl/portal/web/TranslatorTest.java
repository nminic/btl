package com.btl.portal.web;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.ServerSocket;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE CLIENT OF MICROSOFT'S TRANSLATOR, against a server of its own on this machine ({@link ATranslatorOfItsOwn}),
 * so no case sends a text anywhere.
 */
class TranslatorTest {

	private static final ObjectMapper JSON = new ObjectMapper();

	private ATranslatorOfItsOwn service;

	@BeforeEach
	void aServiceOfItsOwn() throws IOException {
		service = new ATranslatorOfItsOwn();
	}

	@AfterEach
	void itGoes() {
		service.close();
	}

	private Translator translator(String key, String region, long waitMillis) {
		return new Translator(key, region, service.address(), waitMillis, JSON);
	}

	private Translator translator() {
		return translator(ATranslatorOfItsOwn.KEY, ATranslatorOfItsOwn.REGION, 2000);
	}

	private static Optional<List<Translator.Translated>> answered(Translator translator, List<String> texts)
			throws Exception {
		return translator.translate(texts).get(10, TimeUnit.SECONDS);
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* Off                                                                                                         */
	/* ---------------------------------------------------------------------------------------------------------- */

	/** Without the key, or without the region, or without both, nothing leaves the server. */
	@ParameterizedTest
	@ValueSource(strings = {"neither", "no key", "no region"})
	void withoutTheKeyOrTheRegionNothingIsSent(String which) throws Exception {
		Translator off = switch (which) {
			case "no key" -> translator("", ATranslatorOfItsOwn.REGION, 2000);
			case "no region" -> translator(ATranslatorOfItsOwn.KEY, " ", 2000);
			default -> translator("", "", 2000);
		};

		assertThat(off.isOn()).isFalse();
		assertThat(answered(off, List.of("Kroz grad"))).isEmpty();
		assertThat(service.asked).isEmpty();
	}

	/** Half a pair is off, and it is said once, at start, without the half that is there. */
	@Test
	void halfAPairSaysSoAtStart() {
		List<ILoggingEvent> heard = heardWhile(() -> translator(ATranslatorOfItsOwn.KEY, "", 2000));

		assertThat(heard).extracting(ILoggingEvent::getLevel).containsExactly(Level.WARN);
		assertThat(heard.get(0).getFormattedMessage()).doesNotContain(ATranslatorOfItsOwn.KEY);
	}

	/** And the pair is a pair: on with both. */
	@Test
	void withBothItIsOn() {
		assertThat(translator().isOn()).isTrue();
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* What is sent                                                                                                */
	/* ---------------------------------------------------------------------------------------------------------- */

	/**
	 * ONE REQUEST, IN THE SHAPE THE SERVICE DOCUMENTS: the method, both languages, no {@code from}, so the service
	 * says what it read; the key and the region in headers and not in the address.
	 */
	@Test
	void theRequestIsTheOneTheServiceDocuments() throws Exception {
		answered(translator(), List.of("Kroz grad i nazad"));

		assertThat(service.asked).hasSize(1);
		ATranslatorOfItsOwn.Asked one = service.asked.get(0);

		assertThat(one.path()).isEqualTo("/translate");
		assertThat(one.query()).isEqualTo("api-version=3.0&to=en&to=sr-Latn");
		assertThat(one.headers()).containsEntry("ocp-apim-subscription-key", ATranslatorOfItsOwn.KEY)
				.containsEntry("ocp-apim-subscription-region", ATranslatorOfItsOwn.REGION)
				.containsEntry("content-type", "application/json; charset=UTF-8");
		assertThat(one.query()).doesNotContain(ATranslatorOfItsOwn.KEY);
	}

	/**
	 * THE TEXT AND NOTHING ELSE: each element of the body carries exactly one property, the text, so nothing in the
	 * request says whose it is. Read off the body as it arrived, not off what this server took out of it.
	 */
	@Test
	void theBodyCarriesTheTextsAndNothingElse() throws Exception {
		answered(translator(), List.of("Prvi tekst", "Drugi tekst"));

		assertThat(JSON.readTree(service.asked.get(0).body()).toString())
				.isEqualTo("[{\"Text\":\"Prvi tekst\"},{\"Text\":\"Drugi tekst\"}]");
	}

	/* ---------------------------------------------------------------------------------------------------------- */
	/* What is answered                                                                                            */
	/* ---------------------------------------------------------------------------------------------------------- */

	/**
	 * ONE TRANSLATION PER TEXT, IN THE ORDER THEY WERE GIVEN, each with what the service read it as and one text
	 * in each of the portal's languages, by the portal's tag: {@code sr-Latn} is the portal's {@code sr}.
	 */
	@Test
	void eachTextComesBackWithItsOwnTranslationsInOrder() throws Exception {
		service.heardAs.put("Through the town", "en");

		List<Translator.Translated> back = answered(translator(), List.of("Kroz grad", "Through the town")).orElseThrow();

		assertThat(back).containsExactly(
				new Translator.Translated("sr-Latn", Map.of("en", "EN: Kroz grad", "sr", "SR: Kroz grad")),
				new Translator.Translated("en",
						Map.of("en", "EN: Through the town", "sr", "SR: Through the town")));
	}

	/** A service that refuses is nothing, and what it said is logged without the key it carries. */
	@ParameterizedTest
	@ValueSource(ints = {401, 403, 429, 500, 503})
	void aRefusalIsNothingAndTheKeyIsNotLogged(int status) throws Exception {
		service.status = status;

		List<ILoggingEvent> heard = heardWhileGetting(() -> answered(translator(), List.of("Kroz grad")));

		assertThat(heard).extracting(ILoggingEvent::getFormattedMessage)
				.singleElement()
				.satisfies(said -> assertThat(said).contains(String.valueOf(status)).contains("[key]")
						.doesNotContain(ATranslatorOfItsOwn.KEY).doesNotContain("Kroz grad"));
	}

	/** What is logged of a refusal is one line of the log, however long the service's answer. */
	@Test
	void aLongRefusalIsLoggedAsOneLine() throws Exception {
		service.status = 400;
		service.refusal = "{\"error\":\"" + "x".repeat(1000) + "\"}";

		List<ILoggingEvent> heard = heardWhileGetting(() -> answered(translator(), List.of("Kroz grad")));

		assertThat(heard.get(0).getFormattedMessage()).endsWith("...").hasSizeLessThan(400);
	}

	/** A service that takes longer than the term is nothing. */
	@Test
	void aServiceThatTakesTooLongIsNothing() throws Exception {
		service.waitMillis = 1500;

		assertThat(answered(translator(ATranslatorOfItsOwn.KEY, ATranslatorOfItsOwn.REGION, 300),
				List.of("Kroz grad"))).isEmpty();
	}

	/** A service nobody answers at is nothing. */
	@Test
	void aServiceNotReachedIsNothing() throws Exception {
		int nobody;

		try (ServerSocket free = new ServerSocket(0)) {
			nobody = free.getLocalPort();
		}

		Translator nowhere = new Translator(ATranslatorOfItsOwn.KEY, ATranslatorOfItsOwn.REGION,
				"http://127.0.0.1:" + nobody, 2000, JSON);

		assertThat(nowhere.translate(List.of("Kroz grad")).get(10, TimeUnit.SECONDS)).isEmpty();
	}

	/**
	 * AN ANSWER THAT IS NOT ONE TRANSLATION INTO EACH LANGUAGE PER TEXT IS NOTHING, never a part of it: a part would
	 * be the translations of one text written under another, the day the service drops an element.
	 */
	@ParameterizedTest
	@ValueSource(strings = {
			"[]",
			"not an answer",
			"{\"translations\":[]}",
			"[{\"detectedLanguage\":{\"language\":\"sr-Latn\"},\"translations\":[{\"text\":\"EN\",\"to\":\"en\"}]}]",
			"[{\"translations\":[{\"text\":\"EN\",\"to\":\"en\"},{\"text\":\"SR\",\"to\":\"sr-Latn\"}]}]",
			"[{\"detectedLanguage\":{\"language\":\"sr-Latn\"},\"translations\":[{\"text\":\"EN\",\"to\":\"en\"},"
					+ "{\"text\":\"SR\",\"to\":\"sr-Cyrl\"}]}]",
			"[{\"detectedLanguage\":{\"language\":\"sr-Latn\"},\"translations\":[{\"text\":\"EN\",\"to\":\"en\"},"
					+ "{\"text\":7,\"to\":\"sr-Latn\"}]}]",
			"[{\"detectedLanguage\":{\"language\":\"sr-Latn\"},\"translations\":[{\"text\":\"EN\",\"to\":\"en\"},"
					+ "{\"text\":\"SR\",\"to\":\"sr-Latn\"}]},{\"detectedLanguage\":{\"language\":\"en\"},"
					+ "\"translations\":[{\"text\":\"EN\",\"to\":\"en\"},{\"text\":\"SR\",\"to\":\"sr-Latn\"}]}]"})
	void anAnswerThatIsNotAllTheTranslationsIsNothing(String answer) throws Exception {
		service.answeredInstead = answer;

		assertThat(answered(translator(), List.of("Kroz grad"))).isEmpty();
	}

	/** Nothing to send is no request. */
	@Test
	void noTextsAreNoRequest() throws Exception {
		assertThat(answered(translator(), List.of())).isEmpty();
		assertThat(service.asked).isEmpty();
	}

	private static List<ILoggingEvent> heardWhile(Runnable speaking) {
		return heardWhileGetting(() -> {
			speaking.run();
			return null;
		});
	}

	private static List<ILoggingEvent> heardWhileGetting(ThrowingSupplier<?> speaking) {
		Logger logger = (Logger) LoggerFactory.getLogger(Translator.class);
		ListAppender<ILoggingEvent> heard = new ListAppender<>();

		heard.start();
		logger.addAppender(heard);

		try {
			speaking.get();

			return List.copyOf(heard.list);
		} catch (Exception failed) {
			throw new AssertionError(failed);
		} finally {
			logger.detachAppender(heard);
			heard.stop();
		}
	}

	@FunctionalInterface
	private interface ThrowingSupplier<T> {
		T get() throws Exception;
	}
}
