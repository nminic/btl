package com.btl.portal.deploy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.yaml.snakeyaml.Yaml;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * WHICH SETTINGS A STACK REFUSES TO DEPLOY WITHOUT, AND WHICH IT DEPLOYS WITHOUT ON
 * PURPOSE.
 *
 * <p><b>Why this exists at all.</b> Measured on 13.09.2026, on the tree as committed:
 * the whole deploy contract had no reader. Four mutations were written into
 * {@code compose.prod.yml} one at a time and every one of them left both gates green -
 * making the mail login required, making the mail key required, taking the variable's
 * name out of the message that refuses the deploy, and the one that matters most,
 * <b>taking the {@code :?} off the production database password</b>. That last one is
 * the sentence the other three are written against, and nothing anywhere was holding
 * it. A precedent nobody measures is not a precedent, it is a habit.
 *
 * <p><b>What the forms actually mean, because the difference is a deployment and not a
 * style.</b> Compose interpolates the WHOLE file before it looks at which services the
 * command named, which was measured on QA on 09.09.2026 and is written down in
 * {@code btl-produkt/ADL.md} A4a: a missing {@code :?} variable aborts
 * {@code up -d --build frontend}, a command that does not mention the database at all.
 * So {@code :?} does not merely stop a first boot. It stops EVERY command over that
 * file until somebody has pasted a value in. That is exactly right for a database
 * password, and it is a decision rather than an oversight for anything else.
 *
 * <p><b>And the colon is not decoration, which a review measured on this very file.</b>
 * {@code :?} refuses when the variable is unset OR EMPTY; plain {@code ?} refuses only
 * when it is unset, and an empty one walks through. That distinction is the whole point
 * here rather than a detail: {@code .env.example} ships every password EMPTY on purpose
 * and the runbook says to copy it, so under {@code ?} production would start with a
 * blank superuser password - and {@code initdb} sets it only on an empty volume, so
 * editing the file afterwards does not change it. The first draft of this class folded
 * {@code :?} and {@code ?} into one value and a one-character mutation walked past it,
 * proven with {@code docker compose config}. Every operator is therefore held as
 * ITSELF, never as a category.
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
 * <li>It does not read the WORDING of the message a required variable refuses with, only
 *     that the message names the variable it is about. Prose does not converge. What the
 *     name is holding is a different hazard, and a live one: the two compose files are
 *     near-copies of each other and say so, so the message that travels with a
 *     copy-pasted line is the one that names the OTHER stack's variable.
 * <li>It cannot know what any {@code .env} on any host actually holds. That file is not
 *     in this repository and is never read from here.
 * </ol>
 */
class WhatEachStackRequiresTest {

	/**
	 * What a stack does with one setting when that setting has no value.
	 *
	 * <p>Compose's operators, one constant each, because the difference between two of
	 * them is a blank production password. The set is closed - these seven are all there
	 * are - which is what lets the reader below refuse an eighth shape by name instead of
	 * skipping it.
	 */
	private enum Asking {
		/** {@code ${NAME}} or {@code $NAME} - comes up, and substitutes a blank. */
		SUBSTITUTES_BLANK(""),
		/** {@code :?} - refuses the whole file when unset OR empty. */
		REFUSES_UNSET_OR_EMPTY(":?"),
		/** {@code ?} - refuses only when unset; an EMPTY value walks through. */
		REFUSES_UNSET_ONLY("?"),
		/** {@code :-} - falls back to the default when unset or empty. */
		DEFAULTS_UNSET_OR_EMPTY(":-"),
		/** {@code -} - falls back only when unset; an empty value stays empty. */
		DEFAULTS_UNSET_ONLY("-"),
		/** {@code :+} - substitutes the alternate only when set and non-empty. */
		ALTERNATE_IF_NON_EMPTY(":+"),
		/** {@code +} - substitutes the alternate whenever set, empty included. */
		ALTERNATE_IF_SET("+");

		private final String operator;

		Asking(String operator) {
			this.operator = operator;
		}

		static Asking of(String operator) {
			for (Asking one : values()) {
				if (one.operator.equals(operator)) {
					return one;
				}
			}

			return null;
		}
	}

	/** One {@code $...} the reader found, kept with its text so the message can be read. */
	private record Occurrence(String name, Asking asking, String tail) { }

	/**
	 * What the table holds about one setting: how the stack asks, and IN HOW MANY PLACES.
	 *
	 * <p><b>The count is not bookkeeping, and a review measured why.</b> A password is
	 * asked for twice - once for the database container and once for the backend that
	 * dials it - and the table used to key on the name alone. So disarming ONE of the two
	 * left the other one satisfying the table, and the gate stayed green. Measured with
	 * {@code docker compose config}: writing {@code $$} in front of one of them turns that
	 * requirement into a literal string, the deploy is no longer refused, and what reaches
	 * the container is the raw template instead of the secret. Pasting a password straight
	 * into one of the two lines has exactly the same shape, and the same count catches it.
	 */
	private record Held(Asking asking, int places) { }

	private static Held asked(Asking asking, int places) {
		return new Held(asking, places);
	}

	/**
	 * THE TABLE, per stack and not per name, and the floor under it is the two cases that
	 * make it close over the files in both directions.
	 *
	 * <p>Written out rather than derived because what it holds cannot be derived - it is
	 * the decision itself, one line per variable. The precedent for a hand-written table
	 * with a derived floor beside it is
	 * {@code frontend/src/test/pages/publicData.test.tsx}.
	 *
	 * <p><b>Keyed by the file as well as the name, and that is not tidiness.</b>
	 * {@code compose.prod.yml:30-34} records the decision that the database, the role,
	 * the password and the relay key must NOT be shared between the two stacks, and that
	 * different names are what make that a property of the files instead of a rule
	 * somebody has to remember. A table keyed by name alone lets a line copied from one
	 * file into the other pass, which a review measured: production's healthcheck asking
	 * for {@code QA_POSTGRES_USER} left the whole suite green, and on a server it is a
	 * container that never turns healthy and a backend held down behind it.
	 *
	 * <p><b>The two mail credentials are optional on both stacks on purpose, and that is
	 * the oldest sentence in this table.</b> It is written in four places -
	 * {@code compose.prod.yml}, {@code compose.qa.yml}, {@code deploy/README.md} and
	 * {@code .env.example} - and it says: a portal that serves every page and cannot send
	 * a confirmation mail is a smaller failure than a portal that is down. Read the
	 * paragraph about A4a at the top of this file before moving either of them, because
	 * moving them does not make production loud, it makes production undeployable while
	 * the key is absent.
	 */
	private static final Map<String, Map<String, Held>> HELD = held();

	private static Map<String, Map<String, Held>> held() {
		Map<String, Map<String, Held>> table = new LinkedHashMap<>();

		/* The database name, the role and the password are each asked for by the postgres
		   container AND by the backend that dials it, which is why the counts are not all
		   one: the name and the role are also in the healthcheck. */
		table.put("compose.prod.yml", Map.of(
				"PROD_POSTGRES_DB", asked(Asking.DEFAULTS_UNSET_OR_EMPTY, 3),
				"PROD_POSTGRES_USER", asked(Asking.DEFAULTS_UNSET_OR_EMPTY, 3),
				"PROD_POSTGRES_PASSWORD", asked(Asking.REFUSES_UNSET_OR_EMPTY, 2),
				"PROD_MAIL_HOST", asked(Asking.DEFAULTS_UNSET_OR_EMPTY, 1),
				"PROD_MAIL_PORT", asked(Asking.DEFAULTS_UNSET_OR_EMPTY, 1),
				"PROD_MAIL_USERNAME", asked(Asking.DEFAULTS_UNSET_OR_EMPTY, 1),
				"PROD_MAIL_PASSWORD", asked(Asking.DEFAULTS_UNSET_OR_EMPTY, 1)));

		table.put("compose.qa.yml", Map.of(
				"QA_POSTGRES_DB", asked(Asking.DEFAULTS_UNSET_OR_EMPTY, 3),
				"QA_POSTGRES_USER", asked(Asking.DEFAULTS_UNSET_OR_EMPTY, 3),
				"QA_POSTGRES_PASSWORD", asked(Asking.REFUSES_UNSET_OR_EMPTY, 2),
				"QA_MAIL_HOST", asked(Asking.DEFAULTS_UNSET_OR_EMPTY, 1),
				"QA_MAIL_PORT", asked(Asking.DEFAULTS_UNSET_OR_EMPTY, 1),
				"QA_MAIL_USERNAME", asked(Asking.DEFAULTS_UNSET_OR_EMPTY, 1),
				"QA_MAIL_PASSWORD", asked(Asking.DEFAULTS_UNSET_OR_EMPTY, 1)));

		return Map.copyOf(table);
	}

	/**
	 * EVERY SETTING A STACK ASKS FOR DOES WHAT THE TABLE SAYS WHEN IT HAS NO VALUE.
	 *
	 * <p>Putting a {@code :?} on a mail credential, taking the one off a database
	 * password, or weakening it to {@code ?}, changes a line here and stops by name.
	 */
	@ParameterizedTest
	@MethodSource("everyStackThisRepoDeploys")
	void everySettingIsAskedForExactlyAsItIsHeld(Path stack) throws Exception {
		String named = stack.getFileName().toString();
		Map<String, Held> expected = HELD.get(named);

		assertThat(expected)
				.as("deploy/ carries %s and nothing says what any of its settings do when they"
						+ " have no value; add a section for it to the table in this file, which is"
						+ " the moment to decide", named)
				.isNotNull();

		Map<String, Held> found = askingOf(stack);

		assertThat(found)
				.as("%s asks the environment for nothing at all, so this measures nothing", named)
				.isNotEmpty();

		for (Map.Entry<String, Held> one : found.entrySet()) {
			assertThat(expected)
					.as("%s asks for %s and nothing says what the stack does when it has no value;"
							+ " add it to the table in this file. If it came from the other stack by"
							+ " copy, the names are deliberately different so that the two cannot"
							+ " share a database, a role, a password or a relay key", named,
							one.getKey())
					.containsKey(one.getKey());

			assertThat(one.getValue().asking())
					.as("%s changed what happens when %s has no value: it is held as %s and the file"
							+ " now says %s. Compose interpolates the whole file before it reads"
							+ " which services a command named, so a setting that refuses turns down"
							+ " EVERY command over this file, the frontend-only deploy included. And"
							+ " the colon is not decoration: ':?' refuses an EMPTY value too, plain"
							+ " '?' lets it through, and every password in .env.example ships empty",
							named, one.getKey(), expected.get(one.getKey()).asking(),
							one.getValue().asking())
					.isEqualTo(expected.get(one.getKey()).asking());

			assertThat(one.getValue().places())
					.as("%s asks for %s in %d places and it is held as %d. A place that stopped"
							+ " asking is a value that now comes from somewhere else - a literal"
							+ " pasted in, or a '$$' that turned the requirement into dead text -"
							+ " and the remaining places go on satisfying every other case here",
							named, one.getKey(), one.getValue().places(),
							expected.get(one.getKey()).places())
					.isEqualTo(expected.get(one.getKey()).places());
		}
	}

	/**
	 * AND THE TABLE HOLDS THE STACKS AND NOTHING ELSE.
	 *
	 * <p>The floor under the table, without which it is only another list: a variable
	 * deleted from a compose file leaves a line here that measures a file nobody reads,
	 * and the next person reads the table as if it were true.
	 */
	@Test
	void theTableNamesEverySettingTheStacksAskForAndNoOthers() throws Exception {
		Set<String> everyStack = new TreeSet<>();

		for (Path stack : everyStackThisRepoDeploys().toList()) {
			String named = stack.getFileName().toString();

			everyStack.add(named);

			Map<String, Held> expected = HELD.get(named);

			if (expected == null) {
				continue;
			}

			assertThat(askingOf(stack).keySet())
					.as("the table says %s asks for settings it no longer asks for, so those lines"
							+ " measure nothing; delete them or find out what the file lost", named)
					.containsAll(expected.keySet());
		}

		assertThat(everyStack)
				.as("the table holds a stack that is no longer in deploy/, so a whole section of it"
						+ " measures nothing")
				.containsAll(HELD.keySet());
	}

	/**
	 * AND A SETTING THAT TURNS DOWN THE DEPLOY SAYS WHICH SETTING IT IS.
	 *
	 * <p>Compose prints its own sentence first - {@code required variable NAME is missing
	 * a value} - so the name does reach whoever is standing on the server. What the text
	 * after it adds is WHERE to put the value, and the hazard it guards is the live one:
	 * the two compose files are near-copies and say so in their own headers, so a line
	 * carried from one to the other arrives with the other stack's name in its message
	 * and sends the reader to set a variable this stack never reads.
	 *
	 * <p>Every occurrence is read, not one. Compose refuses at the FIRST it reaches,
	 * which is not the last one written: an earlier draft of this case kept only the last
	 * and a mutation to the first walked past it.
	 */
	@ParameterizedTest
	@MethodSource("everyStackThisRepoDeploys")
	void everySettingThatTurnsDownTheDeployNamesItself(Path stack) throws Exception {
		List<Occurrence> refusing = occurrencesIn(stack).stream()
				.filter(one -> one.asking() == Asking.REFUSES_UNSET_OR_EMPTY
						|| one.asking() == Asking.REFUSES_UNSET_ONLY)
				.toList();

		assertThat(refusing)
				.as("%s turns down the deploy for nothing, so this measures nothing; the database"
						+ " password is required on every stack this repo deploys", stack)
				.isNotEmpty();

		for (Occurrence one : refusing) {
			assertThat(one.tail())
					.as("%s turns the deploy down without %s and the message it prints does not name"
							+ " it, so it sends whoever reads it to set something else", stack,
							one.name())
					.contains(one.name());
		}
	}

	/**
	 * What one stack asks of the environment, and what it does when the answer is nothing.
	 *
	 * <p>Also the floor on the reading itself: one variable written twice in one file and
	 * asked for two different ways is refused here, because what happens when it has no
	 * value would then depend on which line Compose reaches first.
	 */
	private static Map<String, Held> askingOf(Path stack) throws Exception {
		Map<String, Held> asking = new LinkedHashMap<>();
		Set<String> bothWays = new LinkedHashSet<>();

		for (Occurrence one : occurrencesIn(stack)) {
			Held already = asking.get(one.name());

			if (already == null) {
				asking.put(one.name(), asked(one.asking(), 1));
				continue;
			}

			if (already.asking() != one.asking()) {
				bothWays.add(one.name());
			}

			asking.put(one.name(), asked(already.asking(), already.places() + 1));
		}

		assertThat(bothWays)
				.as("%s asks for the same setting twice and differently each time, so what happens"
						+ " when it has no value depends on which line Compose reaches first", stack)
				.isEmpty();

		return asking;
	}

	/**
	 * Every {@code $...} in a stack, read out of the PARSED file rather than off its text.
	 *
	 * <p><b>The parser is why comments cannot lie here.</b> An earlier draft stripped
	 * whole-line comments with a pattern and documented the leftover as a boundary; a
	 * review measured the boundary backwards, and a trailing comment mentioning an old
	 * variable failed the gate over text Compose never reads. YAML already knows which
	 * bytes are a value, so this asks it instead of deciding for itself.
	 */
	private static List<Occurrence> occurrencesIn(Path stack) throws Exception {
		List<Occurrence> found = new ArrayList<>();

		everyScalarIn(new Yaml().load(Files.readString(stack, StandardCharsets.UTF_8)),
				scalar -> readInterpolations(stack, scalar, found));

		return found;
	}

	/** Walks whatever YAML produced and hands every scalar over as text. */
	private static void everyScalarIn(Object parsed, java.util.function.Consumer<String> onScalar) {
		if (parsed instanceof Map<?, ?> map) {
			map.forEach((key, value) -> {
				everyScalarIn(key, onScalar);
				everyScalarIn(value, onScalar);
			});
		} else if (parsed instanceof Iterable<?> many) {
			many.forEach(one -> everyScalarIn(one, onScalar));
		} else if (parsed != null) {
			onScalar.accept(String.valueOf(parsed));
		}
	}

	/**
	 * Reads one value left to right, the way Compose does, rather than matching a shape.
	 *
	 * <p><b>{@code $$} is consumed first, and a review proved why.</b> It is Compose's
	 * escape: {@code $${NAME:?...}} is a literal string and asks for nothing. A pattern
	 * that looks for {@code ${} finds one inside it, so the first draft read a dead
	 * template as a live requirement - and the mutation that added one character to the
	 * production database password left the suite green while
	 * {@code docker compose config} accepted the file with the raw template as the
	 * password. Scanning forwards cannot make that mistake, because the escape is read
	 * before anything else can match it.
	 *
	 * <p>Both spellings are read, {@code ${NAME}} and bare {@code $NAME}, and a {@code $}
	 * that begins neither stops the gate rather than being skipped.
	 */
	private static void readInterpolations(Path stack, String value, List<Occurrence> into) {
		int at = 0;

		while (at < value.length()) {
			if (value.charAt(at) != '$') {
				at++;
				continue;
			}

			if (at + 1 < value.length() && value.charAt(at + 1) == '$') {
				at += 2;
				continue;
			}

			if (at + 1 < value.length() && value.charAt(at + 1) == '{') {
				int closes = value.indexOf('}', at);

				assertThat(closes)
						.as("%s opens an interpolation and never closes it, in %s", stack, value)
						.isNotEqualTo(-1);

				into.add(readBody(stack, value.substring(at + 2, closes), value));
				at = closes + 1;
				continue;
			}

			int after = at + 1;

			while (after < value.length() && isNameCharacter(value.charAt(after), after == at + 1)) {
				after++;
			}

			assertThat(after)
					.as("%s writes a '$' that begins neither ${NAME} nor $NAME, in %s, so what it"
							+ " asks of the environment could not be read at all; if it is meant to"
							+ " be a literal dollar it has to be written '$$'", stack, value)
					.isNotEqualTo(at + 1);

			into.add(new Occurrence(value.substring(at + 1, after), Asking.SUBSTITUTES_BLANK, ""));
			at = after;
		}
	}

	/** The inside of a {@code ${...}}, split into the name, the operator and the rest. */
	private static Occurrence readBody(Path stack, String body, String whole) {
		int after = 0;

		while (after < body.length() && isNameCharacter(body.charAt(after), after == 0)) {
			after++;
		}

		assertThat(after)
				.as("%s interpolates something that does not begin with a variable name, in %s",
						stack, whole)
				.isNotEqualTo(0);

		String name = body.substring(0, after);
		String rest = body.substring(after);

		if (rest.isEmpty()) {
			return new Occurrence(name, Asking.SUBSTITUTES_BLANK, "");
		}

		/* Two characters when it starts with a colon, one otherwise - and a lone ":" falls
		   through to Asking.of as itself rather than off the end of the string, so the
		   case below says what is wrong instead of throwing an index. */
		String operator = rest.startsWith(":") && rest.length() > 1
				? rest.substring(0, 2)
				: rest.substring(0, 1);
		Asking asking = Asking.of(operator);

		assertThat(asking)
				.as("%s asks for %s with an operator this case has never heard of, in %s, so it"
						+ " would have been read as something it is not; Compose's are"
						+ " :- - :+ + :? ? and nothing else", stack, name, whole)
				.isNotNull();

		return new Occurrence(name, asking, rest.substring(operator.length()));
	}

	private static boolean isNameCharacter(char one, boolean first) {
		boolean letter = one == '_' || Character.isLetter(one);

		return first ? letter : letter || Character.isDigit(one);
	}

	/**
	 * Every compose file in {@code deploy}, asked of the folder rather than written here.
	 *
	 * <p>Taken from {@code PostmanTest}, which had to learn it: until 13.09.2026 that one
	 * read {@code compose.qa.yml} by its name, and on the day production got a stack of
	 * its own, a deletion in the production file left the whole suite green because
	 * nothing opened it. A list of one name is a list, and the file system already knows
	 * the answer.
	 *
	 * <p>{@code .yaml} counts as well as {@code .yml}. It is Compose's own preferred
	 * spelling, and a review measured that a stack named that way was read by nobody
	 * while the count below still passed on the two that were.
	 */
	private static Stream<Path> everyStackThisRepoDeploys() throws Exception {
		try (Stream<Path> inside = Files.list(Path.of("..", "deploy"))) {
			List<Path> stacks = inside
					.filter(one -> one.getFileName().toString().startsWith("compose."))
					.filter(one -> one.getFileName().toString().endsWith(".yml")
							|| one.getFileName().toString().endsWith(".yaml"))
					.sorted().toList();

			assertThat(stacks)
					.as("deploy holds fewer compose files than this repo deploys stacks, so"
							+ " something was not measured at all")
					.hasSizeGreaterThanOrEqualTo(2);

			return stacks.stream();
		}
	}
}
