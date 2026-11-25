package com.btl.portal.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

/**
 * MICROSOFT'S AZURE TRANSLATOR, AS THE PORTAL SPEAKS TO IT.
 *
 * <p>Owner, PDL P18, 25.11.2026: „1. Sme da ide": an approved text may be sent to Microsoft to be translated, on
 * the free tier, with a sentence of the privacy policy beside it in the owner's own words. Until that sentence
 * is on production the key is not either (the plan he accepted the same day: „ključ na produkciju tek posle
 * rečenice u Politici privatnosti"), and this class is the reason that order costs nothing: without the key it
 * is off and nothing leaves the server.
 *
 * <p><b>THE SHAPE OF {@link FacebookGraph}, the one other service this server speaks to on its own</b>, and for
 * its reasons. The key and the region come from the environment ({@code BTL_TRANSLATOR_KEY} and
 * {@code BTL_TRANSLATOR_REGION}, which the deploy stacks fill from {@code /opt/btl/deploy/.env}), and the key
 * goes in a header and never in the address. Without either of them it is off, half a pair is off too and says
 * so once at start, and what it logs of an answer it did not write is scrubbed of the key first. A request has
 * a term, is sent without waiting, and its future never fails, so nothing that waits on it can be thrown at.
 *
 * <p><b>WHAT IS SENT IS THE TEXT AND NOTHING ELSE.</b> The body is the array the service documents, one
 * {@code {"Text": ...}} per text, and the answer comes back in the same order, so nothing in the request
 * names whose text it is: no member number, no name, no id. The log names nothing of the text either.
 *
 * <p><b>IN EUROPE.</b> The address is the service's endpoint for Europe, {@code api-eur.cognitive.microsofttranslator.com},
 * whose requests Microsoft processes in „France Central or West Europe", where the global endpoint goes to the
 * „closest available datacenter" and, should one fail, may go „outside the originating geography" (Microsoft
 * Learn, „Region support for Azure Translator", text translation, standard NMT endpoints). The same page: „Translator
 * doesn't persist customer data submitted for text translation."
 *
 * <p><b>ONE REQUEST ASKS FOR BOTH LANGUAGES</b> ({@code to=en&to=sr-Latn}) and leaves the language of the original
 * to the service (no {@code from}), which answers it as {@code detectedLanguage}: the owner, „Servis sam prepoznaje
 * jezik originala i prevodi na drugi jezik". Both, rather than the other one only, because which is the other is
 * what the service says; asking for both is one request where asking for the other would be two.
 */
@Component
class Translator {

	private static final Logger LOG = LoggerFactory.getLogger(Translator.class);

	/** How much of an answer that is not a success is logged. */
	private static final int AT_MOST_LOGGED = 300;

	/**
	 * THE PORTAL'S LANGUAGES, AND WHAT THE SERVICE CALLS EACH. Serbian is asked for in the Latin script, because the
	 * portal is written in nothing else (PDL P18, „isključivo latinicom").
	 */
	static final Map<String, String> INTO = orderedOf("en", "en", "sr", "sr-Latn");

	/** The most one request may carry, across all the languages it asks for (Microsoft Learn, „Service limits"). */
	static final int AT_MOST_IN_ONE_REQUEST = 50_000;

	private final String key;
	private final String region;
	private final URI translate;
	private final Duration term;
	private final HttpClient client;
	private final ObjectMapper json;

	/**
	 * @param address    where the service answers; Europe's endpoint everywhere but in a case, which hands in a
	 *                   server of its own on this machine
	 * @param waitMillis how long a request may take before it is given up on. Microsoft names fifteen seconds as
	 *                   the most a standard request takes
	 */
	Translator(@Value("${btl.translator.key:}") String key, @Value("${btl.translator.region:}") String region,
			@Value("${btl.translator.address:https://api-eur.cognitive.microsofttranslator.com}") String address,
			@Value("${btl.translator.wait-millis:20000}") long waitMillis, ObjectMapper json) {
		boolean hasKey = !key.isBlank();
		boolean hasRegion = !region.isBlank();

		if (hasKey != hasRegion) {
			LOG.warn("The translator is off: only one of its key and region is set");
		}

		boolean on = hasKey && hasRegion;
		this.key = on ? key.strip() : null;
		this.region = on ? region.strip() : null;
		this.translate = URI.create(URI.create(address).resolve("/translate") + "?api-version=3.0"
				+ String.join("", INTO.values().stream().map(to -> "&to=" + to).toList()));
		this.term = Duration.ofMillis(waitMillis);
		this.client = HttpClient.newBuilder().connectTimeout(term).build();
		this.json = json;
	}

	/** The address a request goes to, which is what says that it goes to Europe. */
	URI address() {
		return translate;
	}

	/** Whether the server may speak to the service at all. */
	boolean isOn() {
		return key != null;
	}

	/**
	 * ONE TEXT, TRANSLATED.
	 *
	 * @param heardAs what the service recognised the original as, its own code ({@code sr-Latn}, {@code hr},
	 *                {@code en})
	 * @param into    the translation into each of the portal's languages ({@link #INTO}), by the portal's tag
	 */
	record Translated(String heardAs, Map<String, String> into) {
	}

	/**
	 * TRANSLATES THESE TEXTS, without waiting for the answer. Off, it sends nothing. The future completes when the
	 * service has answered or the term has run out, and never with a failure: it holds one {@link Translated} per
	 * text, in the order they were given, or nothing at all when the service refused, was not reached, ran out of
	 * time, answered with something that is not one translation into each language per text, or nothing was sent.
	 *
	 * @param texts at most {@link #AT_MOST_IN_ONE_REQUEST} characters across the languages asked for; the caller
	 *              counts them, because it is the caller that decides what waits for the next pass
	 */
	CompletableFuture<Optional<List<Translated>>> translate(List<String> texts) {
		if (!isOn() || texts.isEmpty()) {
			return CompletableFuture.completedFuture(Optional.empty());
		}

		List<Map<String, String>> body = texts.stream().map(text -> Map.of("Text", text)).toList();
		HttpRequest request = HttpRequest.newBuilder(translate)
				.timeout(term)
				.header("Content-Type", "application/json; charset=UTF-8")
				.header("Ocp-Apim-Subscription-Key", key)
				.header("Ocp-Apim-Subscription-Region", region)
				.POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body), StandardCharsets.UTF_8))
				.build();

		return client.sendAsync(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8))
				.handle((answer, failed) -> {
					if (failed != null) {
						LOG.warn("The translator was not reached for {} texts: {}", texts.size(),
								scrubbed(failed.toString()));
						return Optional.<List<Translated>>empty();
					}

					if (answer.statusCode() / 100 != 2) {
						LOG.warn("The translator refused {} texts: {} {}", texts.size(), answer.statusCode(),
								scrubbed(answer.body()));
						return Optional.<List<Translated>>empty();
					}

					Optional<List<Translated>> read = read(answer.body(), texts.size());

					if (read.isEmpty()) {
						LOG.warn("The translator answered {} texts with something that is not their translations",
								texts.size());
					}

					return read;
				});
	}

	/** One translation into each language per text, in order, or nothing. */
	private Optional<List<Translated>> read(String answer, int texts) {
		JsonNode all;

		try {
			all = json.readTree(answer);
		} catch (RuntimeException notJson) {
			return Optional.empty();
		}

		if (!all.isArray() || all.size() != texts) {
			return Optional.empty();
		}

		List<Translated> read = new ArrayList<>();

		for (JsonNode one : all) {
			String heardAs = one.path("detectedLanguage").path("language").asString("");
			Map<String, String> into = new LinkedHashMap<>();

			for (JsonNode translation : one.path("translations")) {
				String to = translation.path("to").asString("");

				INTO.forEach((portal, service) -> {
					if (service.equalsIgnoreCase(to) && translation.path("text").isString()) {
						into.put(portal, translation.path("text").asString());
					}
				});
			}

			if (heardAs.isBlank() || !into.keySet().equals(INTO.keySet())) {
				return Optional.empty();
			}

			read.add(new Translated(heardAs, into));
		}

		return Optional.of(read);
	}

	/** The text without the key, and no longer than a line of the log. */
	private String scrubbed(String text) {
		String without = text.replace(key, "[key]");

		return without.length() > AT_MOST_LOGGED ? without.substring(0, AT_MOST_LOGGED) + "..." : without;
	}

	private static Map<String, String> orderedOf(String... pairs) {
		Map<String, String> ordered = new LinkedHashMap<>();

		for (int at = 0; at < pairs.length; at += 2) {
			ordered.put(pairs[at], pairs[at + 1]);
		}

		return Collections.unmodifiableMap(ordered);
	}
}
