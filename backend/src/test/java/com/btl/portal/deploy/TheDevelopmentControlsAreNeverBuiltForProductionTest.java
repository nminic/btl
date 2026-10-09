package com.btl.portal.deploy;

import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE FLAG THAT BUILDS THE DEVELOPMENT CONTROLS INTO THE SCREENS REACHES NO STACK WHOSE
 * BACKEND IS PRODUCTION.
 *
 * <p>{@code VITE_DEV_TOOLS=1} is what puts the role switch and the switch of the day into the
 * bundle ({@code frontend/src/dev/tools.ts}). ADL A7 (30.07.2026) keeps it off production:
 * „U produkciji je ugašeno: sa uključenim prekidačem uloga bilo koji posetilac bi sebi nacrtao
 * administrativni meni, a sa datumom bi čitao portal koji tvrdi stvari koje još nisu tačne."
 * Until this class nothing read that. {@code compose.prod.yml} says it in a comment beside
 * its frontend, and a build argument written under it there left every case in both gates
 * green.
 *
 * <p><b>Which stack is production is asked of the backend it builds, not of the name of its
 * file.</b> The address a backend is told is what the installation IS - {@code compose.qa.yml}
 * writes its own out for that reason - and a backend told nothing falls back to the one
 * {@code application.properties} ships, which is production's. That file is read here for it,
 * so the address has one home. A stack may hand the flag to its screens only where its backend
 * is told an address of its own, written out rather than taken from an {@code .env} this case
 * cannot see.
 *
 * <p><b>The stacks are found, not named</b>, as {@code PostmanTest} finds them and for the
 * reason it gives: a list of names is a list, and the folder already knows the answer. Every
 * service is asked, not one called {@code frontend}, so a renamed service is not a way past.
 */
class TheDevelopmentControlsAreNeverBuiltForProductionTest {

	private static final String FLAG = "VITE_DEV_TOOLS";

	private static final String ADDRESS = "BTL_PORTAL_ADDRESS";

	@Test
	void onlyAStackWhoseBackendIsToldAnAddressOfItsOwnHandsTheFlagToItsScreens() throws Exception {
		String production = theAddressTheBackendShips();
		List<String> handingItOn = new ArrayList<>();
		boolean productionWasRead = false;

		for (Path stack : everyStackThisRepoDeploys()) {
			Map<String, Object> services = servicesOf(stack);
			Object told = environmentOfTheBackend(stack, services).get(ADDRESS);
			String address = told == null ? production : String.valueOf(told);

			productionWasRead |= address.equals(production);

			if (buildArgumentsOf(services).contains(FLAG)) {
				handingItOn.add(stack.getFileName().toString());

				assertThat(address)
						.as("%s builds its screens with %s and tells its backend %s, which is the"
								+ " production address: every visitor of that installation could draw"
								+ " himself an administration menu and read the portal on a day that has"
								+ " not come (ADL A7)", stack, FLAG, address)
						.isNotEqualTo(production);
				assertThat(address)
						.as("%s builds its screens with %s and takes the address of its backend from"
								+ " the environment (%s), so what that installation is cannot be read"
								+ " here at all; write it out, as compose.qa.yml does", stack, FLAG, address)
						.doesNotContain("$");
			}
		}

		assertThat(productionWasRead)
				.as("no stack tells its backend the production address, so the one installation"
						+ " this case exists for was never read")
				.isTrue();
		assertThat(handingItOn)
				.as("no stack hands %s to its screens at all, so the rule above was measured over"
						+ " nothing; if the controls are gone for good, this class goes with them", FLAG)
				.isNotEmpty();
	}

	/** What {@code btl.portal.address} is where nothing overrides it. */
	private static String theAddressTheBackendShips() throws Exception {
		Properties shipped = new Properties();

		try (Reader file = Files.newBufferedReader(
				Path.of("src", "main", "resources", "application.properties"), StandardCharsets.UTF_8)) {
			shipped.load(file);
		}

		String address = shipped.getProperty("btl.portal.address");

		assertThat(address)
				.as("application.properties no longer ships btl.portal.address, so production has"
						+ " no address here to be told apart by")
				.isNotBlank();

		return address;
	}

	/** Every compose file in {@code deploy}, asked of the folder rather than written here. */
	private static List<Path> everyStackThisRepoDeploys() throws Exception {
		try (Stream<Path> inside = Files.list(Path.of("..", "deploy"))) {
			List<Path> stacks = inside
					.filter(one -> one.getFileName().toString().startsWith("compose."))
					.filter(one -> one.getFileName().toString().endsWith(".yml")
							|| one.getFileName().toString().endsWith(".yaml"))
					.sorted()
					.toList();

			assertThat(stacks)
					.as("deploy holds fewer than the two stacks the repository deploys, so this"
							+ " case would measure less than it says")
					.hasSizeGreaterThanOrEqualTo(2);

			return stacks;
		}
	}

	@SuppressWarnings("unchecked")
	private static Map<String, Object> servicesOf(Path stack) throws Exception {
		Map<String, Object> compose = new Yaml().load(Files.readString(stack, StandardCharsets.UTF_8));
		Object services = compose.get("services");

		assertThat(services).as("%s declares no services", stack).isInstanceOf(Map.class);

		return (Map<String, Object>) services;
	}

	/**
	 * What one stack hands its backend, in either of the two shapes Compose takes: a map, or a
	 * list of {@code KEY=value}. A key in the list with no {@code =} takes its value from the
	 * shell running Compose and has none here, so it is entered as an interpolation, which is
	 * exactly what the case refuses beside the flag: a value this case cannot read.
	 */
	@SuppressWarnings("unchecked")
	private static Map<String, Object> environmentOfTheBackend(Path stack, Map<String, Object> services) {
		Object backend = services.get("backend");

		assertThat(backend)
				.as("%s deploys no service called backend, which frontend/nginx.conf proxies /api to"
						+ " by that name; this case has to learn where the backend is", stack)
				.isInstanceOf(Map.class);

		Object environment = ((Map<String, Object>) backend).get("environment");

		if (environment instanceof Map<?, ?> written) {
			return (Map<String, Object>) written;
		}

		Map<String, Object> listed = new LinkedHashMap<>();

		if (environment instanceof List<?> lines) {
			for (Object line : lines) {
				String entry = String.valueOf(line);
				int equals = entry.indexOf('=');

				listed.put(equals < 0 ? entry : entry.substring(0, equals),
						equals < 0 ? "$" + entry : entry.substring(equals + 1));
			}
		}

		return listed;
	}

	/**
	 * The name of every build argument any service of a stack is built with.
	 *
	 * <p>{@code build} is either a path, which carries no arguments, or a map whose
	 * {@code args} is again a map or a list of {@code NAME=value} or bare {@code NAME}. A bare
	 * name hands on whatever the shell running Compose holds, so it counts as handing the flag
	 * on: it is not this file's to promise the shell is empty.
	 */
	private static List<String> buildArgumentsOf(Map<String, Object> services) {
		List<String> names = new ArrayList<>();

		for (Object service : services.values()) {
			if (!(service instanceof Map<?, ?> declared) || !(declared.get("build") instanceof Map<?, ?> build)) {
				continue;
			}

			Object args = build.get("args");

			if (args instanceof Map<?, ?> written) {
				written.keySet().forEach(name -> names.add(String.valueOf(name)));
			} else if (args instanceof List<?> lines) {
				lines.forEach(line -> names.add(String.valueOf(line).split("=", 2)[0]));
			}
		}

		return names;
	}
}
