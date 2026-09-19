package com.btl.portal.deploy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeSet;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.fail;

/**
 * WHICH SETTINGS A STACK REFUSES TO DEPLOY WITHOUT, ASKED OF COMPOSE ITSELF.
 *
 * <p><b>Why this exists at all.</b> Measured on 13.09.2026, on the tree as it then
 * stood: the whole deploy contract had no reader. Four mutations were written into
 * {@code compose.prod.yml} one at a time and every one of them left both gates green -
 * making the mail login required, making the mail key required, taking the variable's
 * name out of the message that refuses the deploy, and the one that matters most,
 * <b>taking the {@code :?} off the production database password</b>. A precedent nobody
 * measures is not a precedent, it is a habit.
 *
 * <p><b>Why it asks Compose instead of reading the file, which is the fourth answer to
 * this question and the first one with a bottom.</b> Three drafts tried to recognise how
 * an interpolation was WRITTEN, and review took all three apart, each time on a shape
 * the previous draft had not imagined:
 *
 * <ol>
 * <li>a table keyed on {@code :?} versus {@code :-}, which folded {@code :?} and plain
 *     {@code ?} into one value - and those two differ on exactly the case this repo
 *     ships, an EMPTY value;
 * <li>a pattern for {@code ${...}}, which read {@code $${...}} - Compose's escape, a dead
 *     literal - as a live requirement, and never saw bare {@code $NAME} at all;
 * <li>a forward scanner, which took the first {@code &#125;} as the end and so walked
 *     straight past {@code ${OUTER:-${INNER:?...}}}, where the inner one is live and can
 *     turn the whole stack down.
 * </ol>
 *
 * <p>The number of ways to write the same thing is not finite from where a reader of text
 * stands. From where Compose stands it is one. So this runs
 * {@code docker compose config} and asks the only question that matters: <b>does this
 * stack refuse to come up when this setting has no value?</b>
 *
 * <p><b>And it asks that twice, unset and empty, because those are two questions.</b>
 * {@code :?} refuses both; plain {@code ?} refuses only the first. Measured on Compose
 * v5.3.1: {@code ${V?msg}} with {@code V=} renders {@code ""} and exits 0, while
 * {@code ${V:?msg}} with the same {@code V=} exits 1 and names the variable. That is not
 * a nicety - {@code .env.example} ships every password EMPTY on purpose and
 * {@code deploy/README.md} says to copy it, so under {@code ?} production comes up with a
 * blank superuser password, which {@code initdb} then keeps, because it sets one only on
 * an empty volume.
 *
 * <p><b>What the file itself says is not even asked, and one measurement says why.</b>
 * {@code docker-compose.yml} writes {@code POSTGRES_PASSWORD} twice, once as
 * {@code :?} and once bare, and {@code docker compose config --variables} reports it
 * REQUIRED=false - while Compose itself refuses the file. The column describes the text;
 * the exit code describes the deployment. This holds the exit code.
 *
 * <p><b>What this therefore claims, exactly:</b> that nobody changes what a stack does
 * when a setting has no value WITHOUT MEANING TO. Either direction is a changed table,
 * and a changed table stops the gate and asks for a deliberate act - which is the moment
 * to write the decision down rather than the moment to discover it on a server.
 *
 * <p><b>And what it does not claim, written down rather than left to be found:</b>
 *
 * <ol>
 * <li>It does not know whether a classification is RIGHT. Whoever changes the table is
 *     the person who has to answer that, and the paragraphs above are what they should
 *     read first.
 * <li>It cannot know what any {@code .env} on any host holds. Every probe below runs with
 *     {@code --env-file} pointed at an EMPTY file precisely so that a developer who has a
 *     real one is not measured against it, and so that nothing here ever reads it.
 * <li><b>It holds one of the five places this decision is written.</b> The other four are
 *     prose and it does not read them: the comment beside the mail credentials in
 *     {@code deploy/compose.prod.yml}, the same comment in {@code deploy/compose.qa.yml},
 *     the table and two paragraphs in {@code deploy/README.md}, and the header above the
 *     mail block in {@code .env.example}. Moving a setting here without rewriting those
 *     four leaves four sentences claiming the opposite of what the stack does.
 * </ol>
 */
class WhatEachStackRequiresTest {

	/** A value no deployment would ever hold, for the settings a probe is not asking about. */
	private static final String PLACEHOLDER = "pr275-probe-placeholder";

	/** What a stack does when one setting has no value, read off Compose's own exit code. */
	private enum Asking {
		/** Refuses the whole file when the setting is unset AND when it is empty. */
		REFUSES_UNSET_OR_EMPTY,
		/** Refuses when unset, but an EMPTY value walks through. */
		REFUSES_UNSET_ONLY,
		/** Comes up either way, which for a credential is a decision and not an oversight. */
		DEPLOYS_WITHOUT_IT
	}

	/**
	 * What the table holds about one setting: what the stack does without it, and HOW MANY
	 * RENDERED VALUES it actually reaches.
	 *
	 * <p><b>The second half is not bookkeeping, and two mutations say why.</b> A password
	 * is asked for twice - once for the database container, once for the backend that
	 * dials it - so disarming ONE of the two leaves the stack still refusing to deploy
	 * without it, and every question above still gets the same answer. Both of these went
	 * green without this: writing {@code $$} in front of one of the two, which is
	 * Compose's escape and turns that one into a dead literal, and pasting a password
	 * straight over one of the two lines.
	 *
	 * <p>So this counts how many values in the RENDERED configuration carry the setting -
	 * which is to say, how many places would actually receive the secret. Compose does the
	 * rendering, so it is once again the tool answering rather than a reader guessing.
	 */
	private record Held(Asking asking, int reaches) { }

	private static Held asked(Asking asking, int reaches) {
		return new Held(asking, reaches);
	}

	/**
	 * THE TABLE, per stack, and the two cases below close it over the files both ways.
	 *
	 * <p>Written out rather than derived because what it holds cannot be derived - it is
	 * the decision itself, one line per setting. The precedent for a hand-written table
	 * with a derived floor beside it is
	 * {@code frontend/src/test/pages/publicData.test.tsx}.
	 *
	 * <p><b>Keyed by the file as well as the name, and that is not tidiness.</b>
	 * {@code compose.prod.yml:30-34} records the decision that the two stacks must NOT
	 * share a database, a role, a password or a relay key, and that different names are
	 * what make that a property of the files instead of a rule somebody has to remember.
	 *
	 * <p><b>The two mail credentials deploy without them on purpose, and that is the
	 * oldest sentence in this table.</b> A portal that serves every page and cannot send a
	 * confirmation mail is a smaller failure than a portal that is down. Before moving
	 * either of them, read {@code btl-produkt/ADL.md} A4a: Compose interpolates the whole
	 * file before it reads which services a command named, so a setting that refuses turns
	 * down EVERY command over that file - the frontend-only deploy included. Moving these
	 * does not make production loud, it makes production undeployable while the key is
	 * absent.
	 */
	private static final Map<String, Map<String, Held>> HELD = held();

	private static Map<String, Map<String, Held>> held() {
		Map<String, Map<String, Held>> table = new LinkedHashMap<>();

		/* The name, the role and the password each reach the postgres container AND the
		   backend that dials it, which is why the counts are not all one; the name and the
		   role reach the healthcheck as well. */
		table.put("compose.prod.yml", Map.of(
				"PROD_POSTGRES_DB", asked(Asking.DEPLOYS_WITHOUT_IT, 3),
				"PROD_POSTGRES_USER", asked(Asking.DEPLOYS_WITHOUT_IT, 3),
				"PROD_POSTGRES_PASSWORD", asked(Asking.REFUSES_UNSET_OR_EMPTY, 2),
				"PROD_MAIL_HOST", asked(Asking.DEPLOYS_WITHOUT_IT, 1),
				"PROD_MAIL_PORT", asked(Asking.DEPLOYS_WITHOUT_IT, 1),
				"PROD_MAIL_USERNAME", asked(Asking.DEPLOYS_WITHOUT_IT, 1),
				"PROD_MAIL_PASSWORD", asked(Asking.DEPLOYS_WITHOUT_IT, 1),
				/* The superadmin's address, and the only setting here that is not
				   stack-prefixed: it names the same person on both stacks, so the files
				   share the NAME while their .env files keep their own values. It
				   deploys without it on purpose - a portal with no superadmin is a
				   smaller failure than a portal that will not come up - and it reaches
				   exactly one value, the backend that reads it. */
				"BTL_SUPERADMIN_EMAIL", asked(Asking.DEPLOYS_WITHOUT_IT, 1)));

		table.put("compose.qa.yml", Map.of(
				"QA_POSTGRES_DB", asked(Asking.DEPLOYS_WITHOUT_IT, 3),
				"QA_POSTGRES_USER", asked(Asking.DEPLOYS_WITHOUT_IT, 3),
				"QA_POSTGRES_PASSWORD", asked(Asking.REFUSES_UNSET_OR_EMPTY, 2),
				"QA_MAIL_HOST", asked(Asking.DEPLOYS_WITHOUT_IT, 1),
				"QA_MAIL_PORT", asked(Asking.DEPLOYS_WITHOUT_IT, 1),
				"QA_MAIL_USERNAME", asked(Asking.DEPLOYS_WITHOUT_IT, 1),
				"QA_MAIL_PASSWORD", asked(Asking.DEPLOYS_WITHOUT_IT, 1),
				/* The same address on this stack, spelled the same way, and the reason
				   is written beside it in both files: the owner administers QA and
				   production alike, so this is the one thing the two stacks are meant
				   to agree about. */
				"BTL_SUPERADMIN_EMAIL", asked(Asking.DEPLOYS_WITHOUT_IT, 1)));

		/* The development stack in the repository root, which CLAUDE.md tells a developer
		   to run as `docker compose up -d postgres`. Its password is required too, and it
		   is the one whose REQUIRED column lies. Its backend and frontend sit behind the
		   "full" profile, which is why every probe here enables all profiles: without that
		   the bare ${POSTGRES_PASSWORD} on the backend is rendered by nobody and counts 1. */
		table.put("docker-compose.yml", Map.of(
				"POSTGRES_DB", asked(Asking.DEPLOYS_WITHOUT_IT, 3),
				"POSTGRES_USER", asked(Asking.DEPLOYS_WITHOUT_IT, 3),
				"POSTGRES_PASSWORD", asked(Asking.REFUSES_UNSET_OR_EMPTY, 2)));

		return Map.copyOf(table);
	}

	/**
	 * EVERY SETTING A STACK ASKS FOR BEHAVES THE WAY THE TABLE SAYS WHEN IT HAS NO VALUE.
	 *
	 * <p>Measured by running Compose twice per setting - once with it unset, once with it
	 * empty - with every other setting held at a placeholder, so the only thing missing is
	 * the one being asked about.
	 */
	@ParameterizedTest
	@MethodSource("everyStackThisRepoDeploys")
	void everySettingBehavesExactlyAsItIsHeld(Path stack) throws Exception {
		String named = stack.getFileName().toString();
		Map<String, Held> expected = HELD.get(named);

		assertThat(expected)
				.as("the repository carries %s and nothing says what any of its settings do when"
						+ " they have no value; add a section for it to the table in this file,"
						+ " which is the moment to decide", named)
				.isNotNull();

		List<String> settings = settingsOf(stack);

		assertThat(settings)
				.as("%s asks the environment for nothing at all, so this measures nothing", named)
				.isNotEmpty();

		Map<String, Integer> reached = whatEachSettingReaches(stack, settings);

		for (String setting : settings) {
			assertThat(expected)
					.as("%s asks for %s and nothing says what the stack does when it has no value;"
							+ " add it to the table in this file. If it came from another stack by"
							+ " copy, the names are deliberately different so that no two stacks can"
							+ " share a database, a role, a password or a relay key", named, setting)
					.containsKey(setting);

			Asking answered = behaviourOf(stack, settings, setting);

			assertThat(answered)
					.as("%s changed what it does when %s has no value: it is held as %s and Compose"
							+ " now answers %s. Compose interpolates the whole file before it reads"
							+ " which services a command named, so a setting that refuses turns down"
							+ " EVERY command over this file, the frontend-only deploy included. And"
							+ " refusing an unset value is not the same as refusing an EMPTY one:"
							+ " every password in .env.example ships empty and the runbook says to"
							+ " copy it", named, setting, expected.get(setting).asking(), answered)
					.isEqualTo(expected.get(setting).asking());

			assertThat(reached.get(setting))
					.as("%s renders %s into %d values and it is held as %d. A value that stopped"
							+ " carrying it is a place now fed from somewhere else - a literal"
							+ " pasted in, or a '$$' that turned the interpolation into dead text -"
							+ " while every other question here still gets the same answer, because"
							+ " the remaining places go on requiring it", named, setting,
							reached.get(setting), expected.get(setting).reaches())
					.isEqualTo(expected.get(setting).reaches());
		}
	}

	/**
	 * AND THE TABLE HOLDS THE STACKS AND NOTHING ELSE.
	 *
	 * <p>The floor under the table, without which it is only another list: a setting
	 * deleted from a stack leaves a line here that measures a file nobody reads, and the
	 * next person reads the table as if it were true.
	 */
	@Test
	void theTableNamesEverySettingTheStacksAskForAndNoOthers() throws Exception {
		TreeSet<String> everyStack = new TreeSet<>();

		for (Path stack : everyStackThisRepoDeploys().toList()) {
			String named = stack.getFileName().toString();

			everyStack.add(named);

			Map<String, Held> expected = HELD.get(named);

			if (expected == null) {
				continue;
			}

			assertThat(settingsOf(stack))
					.as("the table says %s asks for settings it no longer asks for, so those lines"
							+ " measure nothing; delete them or find out what the file lost", named)
					.containsAll(expected.keySet());
		}

		assertThat(everyStack)
				.as("the table holds a stack the repository no longer carries, so a whole section"
						+ " of it measures nothing")
				.containsAll(HELD.keySet());
	}

	/**
	 * AND A SETTING THAT TURNS THE DEPLOY DOWN SAYS WHICH SETTING IT IS.
	 *
	 * <p>Compose prints its own sentence first, {@code required variable NAME is missing a
	 * value}, so the name does reach whoever is standing on the server. What the text
	 * AFTER it adds is where to put the value, and that is the half this reads: the two
	 * deploy files are near-copies and say so in their own headers, so a line carried from
	 * one to the other arrives with the other stack's name in its message and sends the
	 * reader to set a variable this stack never reads.
	 */
	@ParameterizedTest
	@MethodSource("everyStackThisRepoDeploys")
	void everySettingThatTurnsDownTheDeployNamesItself(Path stack) throws Exception {
		List<String> settings = settingsOf(stack);
		List<String> refusing = new ArrayList<>();

		for (String setting : settings) {
			if (behaviourOf(stack, settings, setting) != Asking.DEPLOYS_WITHOUT_IT) {
				refusing.add(setting);
			}
		}

		assertThat(refusing)
				.as("%s turns the deploy down for nothing, so this measures nothing; every stack"
						+ " this repo deploys requires a database password", stack)
				.isNotEmpty();

		for (String setting : refusing) {
			String marker = "required variable " + setting + " is missing a value: ";
			String complaint = withoutOne(stack, settings, setting).errors();

			assertThat(complaint)
					.as("%s turns the deploy down without %s but does not say so in the shape"
							+ " Compose is documented to print", stack, setting)
					.contains(marker);

			String itsOwnWords = complaint.substring(complaint.indexOf(marker) + marker.length());

			assertThat(itsOwnWords)
					.as("%s turns the deploy down without %s and the message it adds does not name"
							+ " it, so it sends whoever reads it to set something else", stack,
							setting)
					.contains(setting);
		}
	}

	/**
	 * Which settings a stack asks for, enumerated by Compose rather than by a reader.
	 *
	 * <p>This is the half that no pattern ever got right. Measured on v5.3.1:
	 * {@code --variables} lists a variable nested inside another one's default, lists a
	 * bare {@code $NAME}, and does NOT list one written {@code $${NAME}}, which is an
	 * escape and asks for nothing. All three are shapes a previous draft got wrong.
	 */
	private static List<String> settingsOf(Path stack) throws Exception {
		Ran listing = compose(stack, List.of("config", "--variables"), Map.of());

		assertThat(listing.code())
				.as("docker compose could not even read %s, so nothing below measures anything:%n%s",
						stack, listing.errors())
				.isZero();

		List<String> names = new ArrayList<>();
		String[] lines = listing.output().split("\\R");

		for (int line = 1; line < lines.length; line++) {
			String trimmed = lines[line].trim();

			if (!trimmed.isEmpty()) {
				names.add(trimmed.split("\\s+")[0]);
			}
		}

		return names;
	}

	/**
	 * How many rendered values each setting actually reaches.
	 *
	 * <p>One run, with every setting held at a placeholder that carries its own name, so
	 * two settings can never be mistaken for each other. Then the rendered configuration -
	 * Compose's own output, after all interpolation - is counted.
	 */
	private static Map<String, Integer> whatEachSettingReaches(Path stack, List<String> settings)
			throws Exception {

		Map<String, String> distinct = new LinkedHashMap<>();

		settings.forEach(one -> distinct.put(one, PLACEHOLDER + "-" + one));

		Ran rendered = compose(stack, List.of("config"), distinct);

		assertThat(rendered.code())
				.as("%s could not be rendered even with every setting given a value, so nothing"
						+ " below counts anything:%n%s", stack, rendered.errors())
				.isZero();

		Map<String, Integer> reaches = new LinkedHashMap<>();

		settings.forEach(one -> reaches.put(one, howOften(rendered.output(), distinct.get(one))));

		return reaches;
	}

	private static int howOften(String text, String looking) {
		int many = 0;

		for (int at = text.indexOf(looking); at != -1; at = text.indexOf(looking, at + 1)) {
			many++;
		}

		return many;
	}

	/** What the stack does when this one setting has no value: asked twice, unset and empty. */
	private static Asking behaviourOf(Path stack, List<String> settings, String setting)
			throws Exception {

		if (withoutOne(stack, settings, setting).code() == 0) {
			return Asking.DEPLOYS_WITHOUT_IT;
		}

		Map<String, String> emptied = everythingSet(settings);

		emptied.put(setting, "");

		return compose(stack, List.of("config"), emptied).code() == 0
				? Asking.REFUSES_UNSET_ONLY
				: Asking.REFUSES_UNSET_OR_EMPTY;
	}

	/** One run with every setting held at a placeholder except this one, which is unset. */
	private static Ran withoutOne(Path stack, List<String> settings, String setting)
			throws Exception {

		Map<String, String> held = everythingSet(settings);

		held.remove(setting);

		return compose(stack, List.of("config"), held);
	}

	private static Map<String, String> everythingSet(List<String> settings) {
		Map<String, String> values = new LinkedHashMap<>();

		settings.forEach(one -> values.put(one, PLACEHOLDER));

		return values;
	}

	/** What one run of Compose answered. */
	private record Ran(int code, String output, String errors) { }

	/**
	 * Answers already had from Compose, so one question is not asked twice.
	 *
	 * <p>Each probe is a process, and the cases below ask the same three things of each
	 * setting. Without this the gate spends most of its time re-running a command whose
	 * answer it already has; with it, it runs one per question. The key carries the stack,
	 * so two files asking for a same-named setting are never confused.
	 */
	private static final Map<String, Ran> ALREADY_ASKED = new LinkedHashMap<>();

	/**
	 * Runs Compose over one stack with exactly the environment given and nothing else.
	 *
	 * <p>{@code --env-file} points at an empty file on purpose. Compose would otherwise
	 * read the {@code .env} beside the stack, which on a developer's machine holds real
	 * values and would answer these questions for it. Nothing here reads that file.
	 */
	private static Ran compose(Path stack, List<String> verb, Map<String, String> values)
			throws Exception {

		String question = stack + " " + verb + " " + values;
		Ran answered = ALREADY_ASKED.get(question);

		if (answered != null) {
			return answered;
		}

		Ran ran = ask(stack, verb, values);

		ALREADY_ASKED.put(question, ran);

		return ran;
	}

	private static Ran ask(Path stack, List<String> verb, Map<String, String> values)
			throws Exception {

		/* Every profile is enabled, because a service behind one is still a service this
		   repository deploys. Measured: without it, the root stack's backend is rendered by
		   nobody, so the bare ${POSTGRES_PASSWORD} it carries is counted by nobody either. */
		List<String> command = new ArrayList<>(List.of("docker", "compose",
				"-f", stack.toString(), "--env-file", nothing().toString(), "--profile", "*"));

		command.addAll(verb);

		ProcessBuilder starting = new ProcessBuilder(command);

		/* Cleared rather than added to: a developer whose own shell exports PROD_MAIL_HOST
		   would otherwise be measuring their shell instead of the file. */
		starting.environment().keySet().removeIf(one -> HELD.values().stream()
				.anyMatch(settings -> settings.containsKey(one)));
		starting.environment().putAll(values);

		Process running = starting.start();

		String output = new String(running.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
		String errors = new String(running.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);

		assertThat(running.waitFor(2, TimeUnit.MINUTES))
				.as("docker compose did not answer within two minutes for %s", stack)
				.isTrue();

		return new Ran(running.exitValue(), output, errors);
	}

	private static Path nothing() throws IOException {
		Path empty = Path.of(System.getProperty("java.io.tmpdir"), "pr275-empty.env");

		if (!Files.exists(empty)) {
			Files.writeString(empty, "");
		}

		return empty;
	}

	/**
	 * Every stack this repository deploys, and the gate STOPS if Compose is not here.
	 *
	 * <p>A guard that cannot ask its tool has to go red, never quiet. Skipped, it would
	 * report the same green as a stack whose contract is intact, which is the worst of the
	 * three outcomes. The suite already needs a Docker daemon for Testcontainers; what
	 * this adds is the compose plugin beside it.
	 *
	 * <p>The files are found rather than listed: everything in {@code deploy} that Compose
	 * would recognise, plus the development stack in the root under any of the four names
	 * the Compose specification gives it. That list of four is the specification's own and
	 * is closed; the floor under it is the count below.
	 */
	private static Stream<Path> everyStackThisRepoDeploys() throws Exception {
		Ran version = new Ran(0, "", "");

		try {
			ProcessBuilder asking = new ProcessBuilder("docker", "compose", "version");
			Process running = asking.start();

			running.getInputStream().readAllBytes();
			running.waitFor(1, TimeUnit.MINUTES);
			version = new Ran(running.exitValue(), "", "");
		} catch (IOException cannot) {
			fail("this gate asks `docker compose` what each stack refuses to deploy without, and"
					+ " the command is not on this machine: " + cannot.getMessage() + ". The suite"
					+ " already needs a Docker daemon for Testcontainers; this needs the compose"
					+ " plugin beside it. It is not skipped when absent, because a skipped guard"
					+ " reports the same green as an intact one.");
		}

		assertThat(version.code())
				.as("`docker compose version` answered non-zero, so this gate cannot ask it what"
						+ " any stack requires; it fails rather than skipping, because a skipped"
						+ " guard reports the same green as an intact one")
				.isZero();

		List<Path> stacks = new ArrayList<>();

		try (Stream<Path> inside = Files.list(Path.of("..", "deploy"))) {
			inside.filter(one -> one.getFileName().toString().startsWith("compose."))
					.filter(one -> one.getFileName().toString().endsWith(".yml")
							|| one.getFileName().toString().endsWith(".yaml"))
					.sorted().forEach(stacks::add);
		}

		for (String spelling : List.of("compose.yaml", "compose.yml",
				"docker-compose.yaml", "docker-compose.yml")) {
			Path root = Path.of("..", spelling);

			if (Files.exists(root)) {
				stacks.add(root);
			}
		}

		assertThat(stacks)
				.as("fewer stacks were found than this repository deploys, so something was not"
						+ " measured at all")
				.hasSizeGreaterThanOrEqualTo(3);

		return stacks.stream();
	}
}
