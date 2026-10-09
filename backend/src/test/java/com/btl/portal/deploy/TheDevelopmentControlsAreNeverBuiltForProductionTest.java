package com.btl.portal.deploy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
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
import java.util.TreeMap;
import java.util.regex.Pattern;
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
 *
 * <p><b>The Dockerfile reads the flag too, and it is the one reader every stack shares.</b>
 * {@code frontend/Dockerfile} takes the build argument in with {@code ARG} and puts it into the
 * environment {@code vite build} reads with {@code ENV}. A value of its own written there,
 * {@code ARG VITE_DEV_TOOLS=1} as a default or {@code ENV VITE_DEV_TOOLS=1}, reaches every stack
 * that builds the file, production among them, whatever that stack's {@code args} say.
 * <b>Measured 09.10.2026:</b> either change, one token, left the case on the addresses green
 * ({@code Tests run: 1, Failures: 0}), and a portal built with the flag at {@code 1} draws both
 * switches. The frontend gate does hold the text of that Dockerfile
 * ({@code src/test/serverConfig.test.ts}) and stops on any change to it, but a held text asks
 * for a deliberate act and judges nothing: once the held lines are brought up to date the value
 * is in, and nothing refuses it. {@link #noDockerfileAStackBuildsGivesTheFlagAValueOfItsOwn} does.
 *
 * <p><b>What it asks, and why it is written to fail the safe way.</b> Every line of every
 * Dockerfile a stack builds that names the flag, comments left out, has to be one of two:
 * {@code ARG VITE_DEV_TOOLS} with no default, and {@code ENV VITE_DEV_TOOLS=$VITE_DEV_TOOLS}
 * (or with braces), which is the argument handed on as it came. Any other line that names it is
 * refused: a default, a literal, a default taken in the expansion, a value in front of the build
 * command, the old two-word form of {@code ENV}, the name among others on one line. That refuses
 * a harmless line written some other way as well, and its author says so once; this is the
 * direction {@code WhatEachStackRequiresTest} reads the other Dockerfile in, and for its
 * reason: it is text, which this repository distrusts, accepted because the alternative is
 * building the image inside the gate. The question is put to one line at a time, so a line that
 * carries the name can be refused wrongly but never passed wrongly.
 *
 * <p><b>What it does not see, written down rather than left to be found:</b> a {@code .env}
 * file under {@code frontend/}, which {@code COPY . .} brings into the image and Vite reads
 * (measured 09.10.2026: a {@code .env.production} naming the flag gave a production build with
 * both switches; none is tracked today, and {@code frontend/.dockerignore} does not leave one
 * out); and the name written so that it never stands whole on a line, through the shell. A
 * Dockerfile written inside a stack ({@code dockerfile_inline}) is refused rather than missed.
 */
class TheDevelopmentControlsAreNeverBuiltForProductionTest {

	private static final String FLAG = "VITE_DEV_TOOLS";

	private static final String ADDRESS = "BTL_PORTAL_ADDRESS";

	/**
	 * The two lines of a Dockerfile that name the flag and give it nothing of their own: the
	 * argument with no default, and the environment variable made of that argument as it came.
	 * The keyword is case-insensitive in a Dockerfile; the name is not, because it is a name.
	 */
	private static final Pattern ONLY_WHAT_THE_STACK_HANDS_ON = Pattern.compile(
			"(?i:ARG)\\s+" + FLAG
					+ "|(?i:ENV)\\s+" + FLAG + "=\\$(\\{" + FLAG + "\\}|" + FLAG + ")");

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

	/**
	 * NO DOCKERFILE A STACK BUILDS GIVES THE FLAG A VALUE OF ITS OWN.
	 *
	 * <p>Found through the stacks and not named, as the flag is: every service that is built
	 * rather than pulled, in either shape Compose takes ({@code build: ../frontend}, or a map
	 * with a {@code context} and perhaps a {@code dockerfile}), resolved against the folder the
	 * stack lives in. A file that is not there fails here with the stack that named it instead
	 * of being skipped.
	 *
	 * <p>And it has to have something to read: at least one of them names the flag outside a
	 * comment. Without that, a Dockerfile that stopped naming it, or kept the words in a
	 * comment, would leave every line above judged and nothing in it to judge.
	 */
	@Test
	void noDockerfileAStackBuildsGivesTheFlagAValueOfItsOwn() throws Exception {
		boolean oneNamesTheFlag = false;

		for (Map.Entry<Path, List<String>> built : everyDockerfileAStackBuilds().entrySet()) {
			assertThat(built.getKey())
					.as("%s builds %s, which is not a file this case can read, so what that build"
							+ " hands %s on as is not known", built.getValue(), built.getKey(), FLAG)
					.isRegularFile();

			List<String> lines = Files.readAllLines(built.getKey(), StandardCharsets.UTF_8);

			oneNamesTheFlag |= namesTheFlag(lines);

			assertThat(linesGivingTheFlagAValueOfItsOwn(lines))
					.as("%s, built by %s, gives %s a value of its own, and a value of its own reaches"
							+ " every stack that builds the file, production among them, whatever that"
							+ " stack's args say (ADL A7). Hand on only what the stack gave: the line"
							+ " `ARG %s` with no default, and `ENV %s=$%s`", built.getKey(),
							built.getValue(), FLAG, FLAG, FLAG, FLAG)
					.isEmpty();
		}

		assertThat(oneNamesTheFlag)
				.as("no Dockerfile a stack builds names %s outside a comment, so the rule above was"
						+ " measured over nothing, and the argument a stack hands on reaches no"
						+ " build; if the controls are gone for good, this class goes with them", FLAG)
				.isTrue();
	}

	/**
	 * THE JUDGE, HELD ON THE SHAPES IT HAS TO TELL APART. The Dockerfile this repository ships
	 * is clean, so the case above never sees it refuse anything; the refusing half is held here,
	 * on every way a value of its own was written or could be, and the other half on the lines it
	 * has to leave alone. The same shapes were also written into the real Dockerfile one at a
	 * time before this was pushed, and the case above refused each of them.
	 */
	@ParameterizedTest(name = "refuses {0}")
	@MethodSource("waysToGiveTheFlagAValueOfItsOwn")
	void refusesAValueOfItsOwnHoweverTheLineIsWritten(String way, String dockerfile) {
		assertThat(linesGivingTheFlagAValueOfItsOwn(dockerfile.lines().toList()))
				.as("%s, written as%n%s", way, dockerfile)
				.isNotEmpty();
	}

	static Stream<Arguments> waysToGiveTheFlagAValueOfItsOwn() {
		return Stream.of(
				Arguments.of("a default on the argument", "ARG " + FLAG + "=1"),
				Arguments.of("an empty default on the argument", "ARG " + FLAG + "="),
				Arguments.of("a value on the environment variable", "ENV " + FLAG + "=1"),
				Arguments.of("the old two-word form of ENV", "ENV " + FLAG + " 1"),
				Arguments.of("a default taken in the expansion", "ENV " + FLAG + "=${" + FLAG + ":-1}"),
				Arguments.of("a value taken from another variable", "ENV " + FLAG + "=$OTHER"),
				Arguments.of("a value in front of the build command", "RUN " + FLAG + "=1 npm run build"),
				Arguments.of("the name among others on one line", "ENV NODE_ENV=production " + FLAG + "=1"),
				Arguments.of("the name among others on a continued line",
						"ENV NODE_ENV=production \\\n    " + FLAG + "=1"),
				Arguments.of("the hand-over itself, continued", "ENV " + FLAG + "=$" + FLAG + " \\\n    OTHER=1"),
				Arguments.of("the instruction in lower case", "env " + FLAG + "=1"));
	}

	@ParameterizedTest(name = "leaves alone {0}")
	@MethodSource("waysToHandTheFlagOnAsItCame")
	void leavesAloneWhatTheStackHandsOnAsItCame(String way, String dockerfile, boolean namesIt) {
		List<String> lines = dockerfile.lines().toList();

		assertThat(linesGivingTheFlagAValueOfItsOwn(lines)).as("%s, written as%n%s", way, dockerfile).isEmpty();
		assertThat(namesTheFlag(lines)).as("%s, written as%n%s", way, dockerfile).isEqualTo(namesIt);
	}

	static Stream<Arguments> waysToHandTheFlagOnAsItCame() {
		return Stream.of(
				Arguments.of("the argument with no default", "ARG " + FLAG, true),
				Arguments.of("the variable made of the argument", "ENV " + FLAG + "=$" + FLAG, true),
				Arguments.of("the same with braces", "ENV " + FLAG + "=${" + FLAG + "}", true),
				Arguments.of("both, loosely spaced and in lower case",
						"  arg   " + FLAG + "  \nenv " + FLAG + "=$" + FLAG, true),
				Arguments.of("a comment that says the refused thing, which is not a line of the Dockerfile",
						"# ARG " + FLAG + "=1 would be a default of its own", false),
				Arguments.of("a Dockerfile that never names it", "FROM nginx:1.29-alpine", false));
	}

	/**
	 * Every line that names the flag and is not one of the two that hand on only what the stack
	 * gave, each with its number. A comment is a line whose first character is {@code #}, and it
	 * is left out as {@code WhatEachStackRequiresTest} leaves it out: words in a comment neither
	 * excuse a line nor count as the flag being named.
	 */
	static List<String> linesGivingTheFlagAValueOfItsOwn(List<String> dockerfile) {
		List<String> refused = new ArrayList<>();

		for (int at = 0; at < dockerfile.size(); at++) {
			String line = dockerfile.get(at).strip();

			if (!line.startsWith("#") && line.contains(FLAG)
					&& !ONLY_WHAT_THE_STACK_HANDS_ON.matcher(line).matches()) {
				refused.add("line " + (at + 1) + ": " + line);
			}
		}

		return refused;
	}

	/** Whether a Dockerfile names the flag on a line that is not a comment. */
	static boolean namesTheFlag(List<String> dockerfile) {
		return dockerfile.stream()
				.map(String::strip)
				.anyMatch(line -> !line.startsWith("#") && line.contains(FLAG));
	}

	/**
	 * The Dockerfile of every service of every stack that is built rather than pulled, with who
	 * builds it. {@code build} is a path, which is the context and the file is {@code Dockerfile}
	 * in it, or a map with a {@code context} and perhaps a {@code dockerfile}, which Compose
	 * resolves against that context.
	 */
	private static Map<Path, List<String>> everyDockerfileAStackBuilds() throws Exception {
		Map<Path, List<String>> builtBy = new TreeMap<>();

		for (Path stack : everyStackThisRepoDeploys()) {
			for (Map.Entry<String, Object> service : servicesOf(stack).entrySet()) {
				if (!(service.getValue() instanceof Map<?, ?> declared) || declared.get("build") == null) {
					continue;
				}

				String who = stack.getFileName() + " (service " + service.getKey() + ")";
				String context;
				String file = "Dockerfile";

				if (declared.get("build") instanceof Map<?, ?> written) {
					assertThat(written.containsKey("dockerfile_inline"))
							.as("%s is built from a Dockerfile written inside the stack, which there is"
									+ " no file to read; write it as a file, so that it can be asked", who)
							.isFalse();

					context = written.get("context") == null ? "." : String.valueOf(written.get("context"));
					file = written.get("dockerfile") == null ? file : String.valueOf(written.get("dockerfile"));
				} else {
					context = String.valueOf(declared.get("build"));
				}

				builtBy.computeIfAbsent(stack.getParent().resolve(context).resolve(file).normalize(),
						one -> new ArrayList<>()).add(who);
			}
		}

		return builtBy;
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
