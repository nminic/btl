package com.btl.portal.web;

import com.sun.net.httpserver.HttpServer;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.UnaryOperator;

/**
 * MICROSOFT'S TRANSLATOR, AS FAR AS A CASE NEEDS IT, on this machine: it records what it is sent and answers in the
 * shape the service documents, so no case ever sends a text over the network. The shape of
 * {@code FacebookIsAskedToReadAChangedCardTest.AFacebookOfItsOwn}.
 *
 * <p>Its translations are the text with the language in front ({@code "EN: "} and {@code "SR: "}), which is a
 * different text for every original and every language, so a translation written under the wrong event, the wrong
 * language or the wrong field cannot pass for the right one.
 */
final class ATranslatorOfItsOwn implements AutoCloseable {

	static final String KEY = "a-key-of-this-case-0123456789";
	static final String REGION = "westeurope";

	/** One request as it arrived. */
	record Asked(String path, String query, Map<String, String> headers, String body, List<String> texts) {
	}

	private static final ObjectMapper JSON = new ObjectMapper();

	private final HttpServer server;
	private final ExecutorService answering = Executors.newCachedThreadPool();
	final List<Asked> asked = new CopyOnWriteArrayList<>();

	/** What the service answers with, instead of a translation. */
	volatile int status = 200;
	/** What the service says when it does not translate; it carries the key, so a case can see it is not logged. */
	volatile String refusal = "{\"error\":{\"code\":401000,\"message\":\"Access denied for key " + KEY + "\"}}";
	/** How long the service takes. */
	volatile long waitMillis;
	/** What the service says each text is written in, by the text; Serbian in the Latin script otherwise. */
	final Map<String, String> heardAs = new ConcurrentHashMap<>();
	/** What the service does to a translation before it answers it, by the language asked for. */
	volatile UnaryOperator<String> changing = UnaryOperator.identity();
	/** What happens while the service holds a request, before it answers, once. */
	volatile Runnable whileAsked = () -> { };
	/** The whole answer instead of the one this server would make, when a case needs a broken one. */
	volatile String answeredInstead;
	/** The texts whose element of the answer carries the English and no Serbian, the others being answered whole. */
	final java.util.Set<String> answeredWithHalf = ConcurrentHashMap.newKeySet();

	ATranslatorOfItsOwn() throws IOException {
		server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
		server.setExecutor(answering);
		server.createContext("/", exchange -> {
			String sent;

			try (InputStream in = exchange.getRequestBody()) {
				sent = new String(in.readAllBytes(), StandardCharsets.UTF_8);
			}

			Map<String, String> headers = new LinkedHashMap<>();
			exchange.getRequestHeaders().forEach((name, values) -> headers.put(name.toLowerCase(), values.get(0)));

			List<String> texts = new ArrayList<>();
			for (JsonNode one : JSON.readTree(sent)) {
				texts.add(one.path("Text").asString());
			}

			asked.add(new Asked(exchange.getRequestURI().getPath(), exchange.getRequestURI().getRawQuery(), headers,
					sent, texts));

			Runnable during = whileAsked;
			whileAsked = () -> { };
			during.run();

			if (waitMillis > 0) {
				try {
					Thread.sleep(waitMillis);
				} catch (InterruptedException stopped) {
					Thread.currentThread().interrupt();
				}
			}

			String answer = status == 200 ? (answeredInstead != null ? answeredInstead : translated(texts)) : refusal;
			byte[] bytes = answer.getBytes(StandardCharsets.UTF_8);
			exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
			exchange.sendResponseHeaders(status, bytes.length);

			try (OutputStream out = exchange.getResponseBody()) {
				out.write(bytes);
			} catch (IOException gone) {
				/* the client gave up first, which is what a case about the term asks for */
			}
		});
		server.start();
	}

	private String translated(List<String> texts) {
		List<Map<String, Object>> answer = new ArrayList<>();

		for (String text : texts) {
			if (answeredWithHalf.contains(text)) {
				answer.add(Map.of(
						"detectedLanguage", Map.of("language", "sr-Latn", "score", 1.0),
						"translations", List.of(Map.of("text", "EN: " + text, "to", "en"))));
				continue;
			}

			answer.add(Map.of(
					"detectedLanguage", Map.of("language", heardAs.getOrDefault(text, "sr-Latn"), "score", 1.0),
					"translations", List.of(
							Map.of("text", changing.apply("EN: " + text), "to", "en"),
							Map.of("text", changing.apply("SR: " + text), "to", "sr-Latn"))));
		}

		return JSON.writeValueAsString(answer);
	}

	String address() {
		return "http://127.0.0.1:" + server.getAddress().getPort();
	}

	/** Every text sent, in the order they were sent. */
	List<String> textsAsked() {
		return asked.stream().flatMap(one -> one.texts().stream()).toList();
	}

	@Override
	public void close() {
		server.stop(0);
		answering.shutdownNow();
	}
}
