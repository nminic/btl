package com.btl.portal.deploy;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.Network;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.images.builder.Transferable;
import org.testcontainers.utility.DockerImageName;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE PORTAL'S OWN NGINX, RUN AS IT SHIPS, AND ASKED WHO IT THINKS IS CALLING.
 *
 * <p>{@code frontend/nginx.conf} and {@code frontend/nginx-to-backend.conf} are copied as they stand
 * into the image the frontend is built on ({@code frontend/Dockerfile}), beside a stand-in for the
 * backend that answers with the {@code X-Btl-Client-Address} it was handed. Each request plays the
 * edge proxy: it comes from a private Docker address, as the edge proxy does, and carries the
 * {@code X-Forwarded-For} the edge proxy writes, which is the address of ITS caller.
 *
 * <p><b>Why a running nginx and not the text of the file.</b> {@code serverConfig.test.ts} holds the
 * text to the character; what it cannot say is what nginx makes of it - which of two headers wins,
 * whether a range matches an address, whether a location that sets a header of its own drops the
 * server's. Those are questions only nginx answers.
 *
 * <p><b>Who is calling, both ways round</b> (owner, 21.11.2026: the address comes from Cloudflare's
 * header, because Cloudflare stands in front of the server; the coordinator: and only when the request
 * really came through Cloudflare):
 * <ul>
 *   <li>from one of Cloudflare's addresses, the visitor it names in {@code CF-Connecting-IP};</li>
 *   <li>from any other address, that address, whatever {@code CF-Connecting-IP} it claims;</li>
 *   <li>and whatever the caller wrote into {@code X-Btl-Client-Address} himself is replaced.</li>
 * </ul>
 */
class TheProxyInFrontOfThePortalTest {

	private static final Path FRONTEND = Path.of("..", "frontend");

	private static final String NGINX = "nginx:1.29-alpine";

	/** In {@code 104.16.0.0/13} and {@code 2606:4700::/32}, two of Cloudflare's published ranges. */
	private static final String CLOUDFLARE = "104.16.0.5";

	private static final String CLOUDFLARE_V6 = "2606:4700::6";

	/** Documentation ranges, nobody's: a visitor, and a caller that reached the server without Cloudflare. */
	private static final String VISITOR = "198.51.100.7";

	private static final String NOT_CLOUDFLARE = "203.0.113.9";

	private static final String THE_BACKEND_STAND_IN = """
			server {
			    listen 8080;
			    default_type text/plain;
			    location / {
			        return 200 "$http_x_btl_client_address";
			    }
			}
			""";

	private static Network network;

	private static GenericContainer<?> backend;

	private static GenericContainer<?> portal;

	private static final HttpClient HTTP = HttpClient.newHttpClient();

	private static int nextVisitor;

	@BeforeAll
	@SuppressWarnings("resource")
	static void theProxyAsItShipsAndABackendThatSaysWhatItWasTold() throws IOException {
		network = Network.newNetwork();

		backend = new GenericContainer<>(DockerImageName.parse(NGINX))
				.withNetwork(network)
				.withNetworkAliases("backend")
				.withCopyToContainer(Transferable.of(THE_BACKEND_STAND_IN), "/etc/nginx/conf.d/default.conf")
				.withExposedPorts(8080)
				.waitingFor(Wait.forListeningPort());
		backend.start();

		portal = new GenericContainer<>(DockerImageName.parse(NGINX))
				.withNetwork(network)
				.withCopyToContainer(Transferable.of(lf(FRONTEND.resolve("nginx.conf"))), "/etc/nginx/conf.d/default.conf")
				.withCopyToContainer(Transferable.of(lf(FRONTEND.resolve("nginx-to-backend.conf"))),
						"/etc/nginx/nginx-to-backend.conf")
				.withCopyToContainer(Transferable.of(lf(FRONTEND.resolve("index.html"))), "/usr/share/nginx/html/index.html")
				.withCopyToContainer(Transferable.of("console.log(1)"), "/usr/share/nginx/html/assets/index-abc.js")
				.withCopyToContainer(Transferable.of("%PDF-1.4"), "/usr/share/nginx/html/BTL Statut.pdf")
				.withExposedPorts(80)
				.waitingFor(Wait.forHttp("/").forStatusCode(200));
		portal.start();
	}

	@AfterAll
	static void stopThem() {
		for (GenericContainer<?> one : new GenericContainer<?>[] {portal, backend}) {
			if (one != null) {
				one.stop();
			}
		}

		if (network != null) {
			network.close();
		}
	}

	private static byte[] lf(Path file) throws IOException {
		return Files.readString(file, StandardCharsets.UTF_8).replace("\r\n", "\n").getBytes(StandardCharsets.UTF_8);
	}

	private static HttpResponse<String> ask(String method, String path, Map<String, String> headers) {
		HttpRequest.Builder request = HttpRequest.newBuilder(
						URI.create("http://" + portal.getHost() + ":" + portal.getMappedPort(80) + path))
				.method(method, HttpRequest.BodyPublishers.noBody());

		headers.forEach(request::header);

		try {
			return HTTP.send(request.build(), HttpResponse.BodyHandlers.ofString());
		} catch (IOException | InterruptedException failed) {
			throw new IllegalStateException(failed);
		}
	}

	/** What the backend was told about who is asking, for a request the edge proxy passed on. */
	private static String theBackendWasTold(Map<String, String> headers) {
		HttpResponse<String> answer = ask("GET", "/api/places", headers);

		assertThat(answer.statusCode()).isEqualTo(200);

		return answer.body();
	}

	private static Map<String, String> fromTheEdge(String caller, String cloudflareSays) {
		Map<String, String> headers = new LinkedHashMap<>();

		headers.put("X-Forwarded-For", caller);

		if (cloudflareSays != null) {
			headers.put("CF-Connecting-IP", cloudflareSays);
		}

		return headers;
	}

	private static String aFreshVisitor() {
		nextVisitor++;

		return "198.51.100." + (100 + nextVisitor);
	}

	// ---------------------------------------------------------------------------- who is asking

	@Test
	void throughCloudflareItIsTheVisitorCloudflareNames() {
		assertThat(theBackendWasTold(fromTheEdge(CLOUDFLARE, VISITOR))).isEqualTo(VISITOR);
		assertThat(theBackendWasTold(fromTheEdge(CLOUDFLARE_V6, "2001:db8::5"))).isEqualTo("2001:db8::5");
	}

	@Test
	void fromAnywhereElseItIsThatAddressWhateverItClaims() {
		assertThat(theBackendWasTold(fromTheEdge(NOT_CLOUDFLARE, VISITOR))).isEqualTo(NOT_CLOUDFLARE);
		assertThat(theBackendWasTold(fromTheEdge(NOT_CLOUDFLARE, null))).isEqualTo(NOT_CLOUDFLARE);
	}

	@Test
	void aChainIsReadFromTheRightSoAForgedCloudflareInFrontOfItIsNotBelieved() {
		/* A caller who reaches the server directly can write a Cloudflare address into the chain
		   himself; what he cannot do is make the last untrusted address in it, the one the edge proxy
		   saw, anything but his own. */
		assertThat(theBackendWasTold(fromTheEdge(CLOUDFLARE + ", " + NOT_CLOUDFLARE, VISITOR)))
				.isEqualTo(NOT_CLOUDFLARE);
		assertThat(theBackendWasTold(fromTheEdge("192.0.2.1, " + CLOUDFLARE, VISITOR))).isEqualTo(VISITOR);
	}

	@Test
	void cloudflareThatNamesNobodyIsCountedAsItself() {
		assertThat(theBackendWasTold(fromTheEdge(CLOUDFLARE, null))).isEqualTo(CLOUDFLARE);
	}

	@Test
	void whatTheCallerWritesUnderTheBackendsOwnNameIsReplaced() {
		Map<String, String> headers = fromTheEdge(NOT_CLOUDFLARE, null);

		headers.put("X-Btl-Client-Address", VISITOR);

		assertThat(theBackendWasTold(headers)).isEqualTo(NOT_CLOUDFLARE);
	}

	@Test
	void theLimitsCountVisitorsAndNotTheCloudflareMachineThatCarriesThem() {
		/* `registration`: five a minute with a burst of three, so the first four are let through at
		   once and the fifth is refused. Keyed on the address the edge proxy saw, which is Cloudflare's
		   for everybody, the second visitor below would have been refused with the first. */
		String first = aFreshVisitor();

		for (int one = 1; one <= 4; one++) {
			assertThat(ask("POST", "/api/registration", fromTheEdge(CLOUDFLARE, first)).statusCode())
					.as("attempt %d", one).isEqualTo(200);
		}

		assertThat(ask("POST", "/api/registration", fromTheEdge(CLOUDFLARE, first)).statusCode()).isEqualTo(429);
		assertThat(ask("POST", "/api/registration", fromTheEdge(CLOUDFLARE, aFreshVisitor())).statusCode())
				.as("another visitor through the same Cloudflare machine").isEqualTo(200);
	}

	// ------------------------------------------------------------------- what a page may load

	private static String thePolicyTheFileDeclares() throws IOException {
		Matcher declared = Pattern.compile("map \\$host \\$btl_content_security_policy \\{\\s*default \"([^\"]+)\";")
				.matcher(Files.readString(FRONTEND.resolve("nginx.conf"), StandardCharsets.UTF_8));

		assertThat(declared.find()).as("nginx.conf declares no $btl_content_security_policy").isTrue();

		return declared.group(1);
	}

	@Test
	void everyAnswerCarriesThePolicyTheLocationsThatSetHeadersOfTheirOwnIncluded() throws IOException {
		String policy = thePolicyTheFileDeclares();

		Map<String, Integer> answers = new LinkedHashMap<>();
		answers.put("/", 200);
		answers.put("/sr/kalendar", 200);
		answers.put("/sr/takmicar/000127-petar-petrovic", 200);
		answers.put("/assets/index-abc.js", 200);
		answers.put("/assets/nothing-here.js", 404);
		answers.put("/BTL%20Statut.pdf", 200);
		answers.put("/api/places", 200);

		answers.forEach((path, status) -> {
			HttpResponse<String> answer = ask("GET", path, fromTheEdge(NOT_CLOUDFLARE, null));

			assertThat(answer.statusCode()).as(path).isEqualTo(status);
			assertThat(answer.headers().allValues("Content-Security-Policy")).as(path).containsExactly(policy);
		});
	}

	@Test
	void andTheOneLocationThatSetsAHeaderOfItsOwnStillSetsIt() {
		/* Two `Cache-Control` lines go out there, `expires` writing one and `add_header` the other, and
		   it is the second that this location exists for. */
		assertThat(ask("GET", "/assets/index-abc.js", Map.of()).headers().allValues("Cache-Control"))
				.contains("public, immutable");
	}

}
