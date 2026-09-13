package com.btl.portal.deploy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
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
 * <p><b>What the two forms actually mean, because the difference is a deployment and
 * not a style.</b> Compose interpolates the WHOLE file before it looks at which
 * services the command named, which was measured on QA on 09.09.2026 and is written
 * down in {@code btl-produkt/ADL.md} A4a: a missing {@code :?} variable aborts
 * {@code up -d --build frontend}, a command that does not mention the database at all.
 * So {@code :?} does not merely stop a first boot. It stops EVERY command over that
 * file until somebody has pasted a value in. That is exactly right for a database
 * password, and it is a decision rather than an oversight for anything else.
 *
 * <p><b>What this therefore claims, exactly:</b> that nobody moves a variable between
 * "the stack refuses to come up without it" and "the stack comes up without it" WITHOUT
 * MEANING TO. Either direction is a changed table, and a changed table stops the gate
 * and asks for a deliberate act - which is the moment to write the decision down rather
 * than the moment to discover it on a server.
 *
 * <p><b>And what it does not claim, written down rather than left to be found:</b>
 *
 * <ol>
 * <li>It does not know whether a classification is RIGHT. Whoever changes the table is
 *     the person who has to answer that, and the paragraph above is what they should
 *     read first.
 * <li>It does not read the WORDING of the message a required variable refuses with,
 *     only that the message names the variable it is about. Prose does not converge and
 *     is not what breaks a deploy; a message that names the wrong thing is.
 * <li>It cannot know what any {@code .env} on any host actually holds. That file is not
 *     in this repository and is never read from here.
 * <li>It reads full-line comments out of the file before enumerating, the same way
 *     {@code frontend/src/test/serverConfig.test.ts} does, so a variable written inside
 *     a TRAILING comment would be invisible to it. There is none today.
 * </ol>
 */
class WhatEachStackRequiresTest {

	/**
	 * Compose's operators, as a closed set rather than as a guess.
	 *
	 * <p>This is the whole reason the question can be asked of the text at all. "How is
	 * a module written" has no bottom and a guard that asks it is wrong forever; "which
	 * of these seven operators is this" is finite, so an eighth shape is not a silent
	 * miss - the count below refuses it by name.
	 */
	private static final Pattern INTERPOLATION = Pattern.compile(
			"\\$\\{([A-Za-z_][A-Za-z0-9_]*)(:\\?|\\?|:-|-|:\\+|\\+)?([^}]*)}");

	/** Every {@code ${...}} opening, so the one the pattern above cannot read is counted. */
	private static final Pattern ANY_OPENING = Pattern.compile("\\$\\{");

	private static final Pattern FULL_LINE_COMMENT = Pattern.compile("(?m)^\\s*#.*$");

	private enum Requirement {
		/** {@code :?} or {@code ?} - no value, no deploy, and the whole file is refused. */
		REQUIRED,
		/** {@code :-}, {@code -}, {@code :+} or {@code +} - the stack comes up without it. */
		OPTIONAL,
		/** Bare {@code ${NAME}} - comes up, and silently substitutes nothing. */
		BARE
	}

	/**
	 * THE TABLE, and the floor under it is two cases below: nothing in a stack may be
	 * missing from here, and nothing here may be missing from the stacks.
	 *
	 * <p>Written out rather than derived because what it holds cannot be derived - it is
	 * the decision itself, one line per variable. The precedent for a hand-written table
	 * with a derived floor beside it is {@code frontend/src/test/pages/publicData.test.tsx}.
	 *
	 * <p><b>The two mail credentials are OPTIONAL on both stacks on purpose, and that is
	 * the oldest sentence in this table.</b> It is written in four places -
	 * {@code compose.prod.yml}, {@code compose.qa.yml}, {@code deploy/README.md} and
	 * {@code .env.example} - and it says: a portal that serves every page and cannot send
	 * a confirmation mail is a smaller failure than a portal that is down. Read the
	 * paragraph about A4a at the top of this file before moving either of them, because
	 * moving them does not make production loud, it makes production undeployable while
	 * the key is absent.
	 */
	private static final Map<String, Requirement> HELD = held();

	private static Map<String, Requirement> held() {
		Map<String, Requirement> table = new LinkedHashMap<>();

		/* Production, deploy/compose.prod.yml. */
		table.put("PROD_POSTGRES_DB", Requirement.OPTIONAL);
		table.put("PROD_POSTGRES_USER", Requirement.OPTIONAL);
		table.put("PROD_POSTGRES_PASSWORD", Requirement.REQUIRED);
		table.put("PROD_MAIL_HOST", Requirement.OPTIONAL);
		table.put("PROD_MAIL_PORT", Requirement.OPTIONAL);
		table.put("PROD_MAIL_USERNAME", Requirement.OPTIONAL);
		table.put("PROD_MAIL_PASSWORD", Requirement.OPTIONAL);

		/* QA, deploy/compose.qa.yml. */
		table.put("QA_POSTGRES_DB", Requirement.OPTIONAL);
		table.put("QA_POSTGRES_USER", Requirement.OPTIONAL);
		table.put("QA_POSTGRES_PASSWORD", Requirement.REQUIRED);
		table.put("QA_MAIL_HOST", Requirement.OPTIONAL);
		table.put("QA_MAIL_PORT", Requirement.OPTIONAL);
		table.put("QA_MAIL_USERNAME", Requirement.OPTIONAL);
		table.put("QA_MAIL_PASSWORD", Requirement.OPTIONAL);

		return Map.copyOf(table);
	}

	/**
	 * EVERY VARIABLE A STACK INTERPOLATES IS CLASSIFIED THE WAY THE TABLE SAYS.
	 *
	 * <p>This is the case that catches the four mutations from 13.09.2026. Putting a
	 * {@code :?} on a mail credential, or taking the one off the database password,
	 * changes a classification and stops here by name.
	 */
	@ParameterizedTest
	@MethodSource("everyStackThisRepoDeploys")
	void everyVariableIsRequiredOrOptionalExactlyAsItIsHeld(Path stack) throws Exception {
		Map<String, Requirement> found = requirementsOf(stack);

		assertThat(found)
				.as("%s interpolates nothing at all, so this measures nothing", stack)
				.isNotEmpty();

		for (Map.Entry<String, Requirement> one : found.entrySet()) {
			assertThat(HELD)
					.as("%s interpolates %s and nothing says whether the stack may deploy without"
							+ " it; add it to the table in this file, which is the moment to decide",
							stack, one.getKey())
					.containsKey(one.getKey());

			assertThat(one.getValue())
					.as("%s changed what happens when %s has no value: it is held as %s and the file"
							+ " now says %s. A variable moving between those two is a deployment"
							+ " decision - Compose interpolates the whole file before it reads which"
							+ " services a command named, so a required variable with no value"
							+ " refuses EVERY command over this file, the frontend included",
							stack, one.getKey(), HELD.get(one.getKey()), one.getValue())
					.isEqualTo(HELD.get(one.getKey()));
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
	void theTableNamesEveryVariableTheStacksUseAndNoOthers() throws Exception {
		Set<String> acrossEveryStack = new TreeSet<>();

		List<Path> stacks = everyStackThisRepoDeploys().toList();

		for (Path stack : stacks) {
			acrossEveryStack.addAll(requirementsOf(stack).keySet());
		}

		assertThat(acrossEveryStack)
				.as("the table holds a variable no stack in deploy/ interpolates any more, so that"
						+ " line measures nothing; delete it or find out which file lost it")
				.containsAll(HELD.keySet());

		assertThat(HELD.keySet())
				.as("a stack interpolates a variable the table has never heard of")
				.containsAll(acrossEveryStack);
	}

	/**
	 * AND A VARIABLE THAT REFUSES THE DEPLOY SAYS WHICH VARIABLE IT IS.
	 *
	 * <p>Compose prints this text and nothing else when it refuses, and whoever reads it
	 * is standing on a server with a site that will not come up. A message that does not
	 * name the variable sends them to read the compose file to find out what to set,
	 * which is the one thing the message exists to save them.
	 *
	 * <p>It asks about the NAME and not about the wording. The wording is prose, prose
	 * does not converge, and a round spent on the phrasing of an error nobody has seen is
	 * a round spent on the guard rather than on the portal.
	 */
	@ParameterizedTest
	@MethodSource("everyStackThisRepoDeploys")
	void everyRequiredVariableNamesItselfInTheMessageThatRefuses(Path stack) throws Exception {
		Map<String, String> messages = messagesOfRequiredVariablesIn(stack);

		assertThat(messages)
				.as("%s makes nothing required, so this measures nothing; the database password is"
						+ " required on every stack this repo deploys", stack)
				.isNotEmpty();

		messages.forEach((name, message) -> assertThat(message)
				.as("%s refuses to deploy without %s and the message it prints does not name it,"
						+ " so it does not say what to set", stack, name)
				.contains(name));
	}

	/**
	 * What one stack asks of the environment, read off the file as Compose's own
	 * interpolation syntax.
	 *
	 * <p>Also the floor on the reading itself: every {@code ${} opening has to be one the
	 * pattern understood, so a form outside Compose's closed set is refused here rather
	 * than dropped silently.
	 */
	private static Map<String, Requirement> requirementsOf(Path stack) throws Exception {
		String text = withoutFullLineComments(stack);

		Map<String, Requirement> found = new LinkedHashMap<>();
		Set<String> seenTwiceDifferently = new LinkedHashSet<>();

		Matcher reading = INTERPOLATION.matcher(text);
		int understood = 0;

		while (reading.find()) {
			understood++;

			String name = reading.group(1);
			Requirement requirement = requirementOf(reading.group(2));
			Requirement already = found.put(name, requirement);

			if (already != null && already != requirement) {
				seenTwiceDifferently.add(name);
			}
		}

		assertThat(countOf(ANY_OPENING, text))
				.as("%s writes an interpolation in a shape this case cannot read, so it would have"
						+ " been skipped rather than measured; Compose's operators are ${NAME},"
						+ " :- - :+ + and :? ?", stack)
				.isEqualTo(understood);

		assertThat(seenTwiceDifferently)
				.as("%s writes the same variable twice and asks for it differently each time, so"
						+ " what happens when it has no value depends on which line Compose reaches",
						stack)
				.isEmpty();

		return found;
	}

	/** The text each required variable refuses with, by variable. */
	private static Map<String, String> messagesOfRequiredVariablesIn(Path stack) throws Exception {
		Map<String, String> messages = new LinkedHashMap<>();
		Matcher reading = INTERPOLATION.matcher(withoutFullLineComments(stack));

		while (reading.find()) {
			if (requirementOf(reading.group(2)) == Requirement.REQUIRED) {
				messages.put(reading.group(1), reading.group(3));
			}
		}

		return messages;
	}

	private static Requirement requirementOf(String operator) {
		if (operator == null) {
			return Requirement.BARE;
		}

		return operator.endsWith("?") ? Requirement.REQUIRED : Requirement.OPTIONAL;
	}

	private static String withoutFullLineComments(Path stack) throws Exception {
		return FULL_LINE_COMMENT.matcher(Files.readString(stack, StandardCharsets.UTF_8))
				.replaceAll("");
	}

	private static int countOf(Pattern pattern, String text) {
		Matcher counting = pattern.matcher(text);
		int many = 0;

		while (counting.find()) {
			many++;
		}

		return many;
	}

	/**
	 * Every compose file in {@code deploy}, asked of the folder rather than written here.
	 *
	 * <p>Taken from {@code PostmanTest}, which had to learn it: until 13.09.2026 that one
	 * read {@code compose.qa.yml} by its name, and on the day production got a stack of
	 * its own, a deletion in the production file left the whole suite green because
	 * nothing opened it. A list of one name is a list, and the file system already knows
	 * the answer.
	 */
	private static Stream<Path> everyStackThisRepoDeploys() throws Exception {
		try (Stream<Path> inside = Files.list(Path.of("..", "deploy"))) {
			List<Path> stacks = inside
					.filter(one -> one.getFileName().toString().startsWith("compose."))
					.filter(one -> one.getFileName().toString().endsWith(".yml"))
					.sorted().toList();

			assertThat(stacks)
					.as("deploy holds fewer compose files than this repo deploys stacks, so"
							+ " something was not measured at all")
					.hasSizeGreaterThanOrEqualTo(2);

			return stacks.stream();
		}
	}
}
