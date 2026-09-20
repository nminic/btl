package com.btl.portal.deploy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.yaml.snakeyaml.Yaml;

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
 *     prose, and two of them it still does not read at all: the comment beside the mail
 *     credentials in {@code deploy/compose.prod.yml} and the same comment in
 *     {@code deploy/compose.qa.yml}. Moving a setting here without rewriting those two
 *     leaves two sentences claiming the opposite of what the stack does. The other two it
 *     does open, narrowly and not for their prose. {@code .env.example}: whether every
 *     setting has a LINE there at all, which is what the runbook's
 *     {@code cp .env.example .env} turns into a value on a host. {@code deploy/README.md},
 *     since 20.09.2026: whether it NAMES a setting anywhere, whether the one recipe line
 *     the owner actually runs by hand would still leave him keeping it, and whether the
 *     production table lists it. None of that asks whether the sentences around the name
 *     are well put.
 * </ol>
 */
class WhatEachStackRequiresTest {

	/** A value no deployment would ever hold, for the settings a probe is not asking about. */
	private static final String PLACEHOLDER = "pr275-probe-placeholder";

	/**
	 * The one setting this file is also asked about BY NAME, and the reason the question
	 * below had to be added at all.
	 *
	 * <p>Everything else here answers „what does this stack do when a setting has no
	 * value", which is a question about the file. Measured 20.09.2026: that question is
	 * blind to the NAME the backend is handed. Renaming the key on the left of
	 * {@code BTL_SUPERADMIN_EMAIL: ${BTL_SUPERADMIN_EMAIL:-}} in both stacks, leaving the
	 * interpolation alone, left every case in this file green - the variable is still
	 * asked for, still deploys without it, still reaches one value - while the backend was
	 * handed a name nothing in it reads and the portal had no superadmin on either stack.
	 */
	private static final String SUPERADMIN = "BTL_SUPERADMIN_EMAIL";

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
	 * AND THE STACKS THAT NAME A SUPERADMIN HAND THAT NAME TO THE BACKEND THAT READS IT.
	 *
	 * <p><b>A different question from every other one in this file, and that is why it is
	 * here.</b> The table answers „what does the stack do when this setting has no value",
	 * which is about the variable on the RIGHT of the colon. Which key the backend
	 * receives is the name on the LEFT, and nothing was asking about it: renaming that
	 * half alone left this whole file green while the portal lost its superadmin on both
	 * stacks. {@code PostmanTest#everyInstallationThatSignsInAlsoRequiresTls} is the
	 * precedent - it reads what a stack hands its backend and asks of that.
	 *
	 * <p><b>Both halves are asked in one breath, and each catches a different mutation.</b>
	 * The key must be there, which renaming it breaks; and its value must be the
	 * placeholder the setting was given, which a literal pasted over the line or a
	 * {@code $$} that turns the interpolation into dead text breaks - the same two shapes
	 * the count of rendered values was written for.
	 *
	 * <p><b>Which stacks are asked is derived, not listed:</b> every stack found on the
	 * file system whose settings include this one. The floor under that is the count at
	 * the end - a name that vanished from both deploy files would leave this case
	 * measuring nothing and reporting green, which is the failure this whole file exists
	 * to refuse.
	 *
	 * <p><b>What it does not claim,</b> written here rather than left to be found: nothing
	 * says the OTHER settings reach the backend under the names it reads. Those are
	 * {@code SPRING_}-prefixed, Spring's own relaxed binding answers for them, and no
	 * mutation has yet shown that question to be live. This one is, and it is the one
	 * asked.
	 */
	@Test
	void everyStackThatNamesASuperadminHandsThatNameToItsBackend() throws Exception {
		List<Path> naming = new ArrayList<>();

		for (Path stack : everyStackThisRepoDeploys().toList()) {
			List<String> settings = settingsOf(stack);

			if (!settings.contains(SUPERADMIN)) {
				continue;
			}

			naming.add(stack);

			Map<String, String> distinct = new LinkedHashMap<>();

			settings.forEach(one -> distinct.put(one, PLACEHOLDER + "-" + one));

			Ran rendered = compose(stack, List.of("config"), distinct);

			assertThat(rendered.code())
					.as("%s could not be rendered even with every setting given a value, so"
							+ " nothing below reads anything:%n%s", stack, rendered.errors())
					.isZero();

			Map<String, Object> backend = backendEnvironmentOf(rendered.output(), stack);

			assertThat(backend)
					.as("%s asks for %s and then hands its backend no such setting, so the"
							+ " address sits in deploy/.env and reaches nothing: the portal comes"
							+ " up, serves every page, and has no superadmin. The name on the LEFT"
							+ " of the colon is what Spring binds to btl.superadmin.email",
							stack, SUPERADMIN)
					.containsKey(SUPERADMIN);

			assertThat(String.valueOf(backend.get(SUPERADMIN)))
					.as("%s hands its backend a %s that no longer comes from the setting of that"
							+ " name - a value pasted straight over the line, or a '$$' that turned"
							+ " the interpolation into dead text. The key is there and the .env is"
							+ " read by nobody", stack, SUPERADMIN)
					.isEqualTo(distinct.get(SUPERADMIN));
		}

		assertThat(naming)
				.as("no stack in this repository asks for %s any more, so this case measured"
						+ " nothing at all and reported green. Both deploy stacks carry it because"
						+ " the same person administers QA and production", SUPERADMIN)
				.hasSizeGreaterThanOrEqualTo(2);
	}

	/**
	 * AND EVERY SETTING EVERY STACK ASKS FOR HAS A LINE IN THE FILE THE RUNBOOK SAYS TO
	 * COPY.
	 *
	 * <p><b>Measured 20.09.2026 on this very increment.</b> {@code deploy/README.md} tells
	 * whoever raises a stack to run {@code cp ../.env.example .env} and then fill it in. A
	 * setting added to a stack and not to that file therefore reaches the host as a line
	 * nobody knows to write: the stack comes up - every setting here that deploys without
	 * a value comes up - and the thing it configures is silently absent, with nothing
	 * anywhere saying why.
	 *
	 * <p><b>Nothing is listed here.</b> The names come from Compose, over every stack
	 * found on the file system, which is the same floor the rest of this file stands on. A
	 * setting that arrives tomorrow is measured the day it arrives.
	 *
	 * <p><b>What it claims is that a line EXISTS, not that its value is right</b> - every
	 * password in that file ships empty on purpose, and the header there says why.
	 */
	@Test
	void everySettingEveryStackAsksForHasALineInTheFileTheRunbookSaysToCopy() throws Exception {
		List<String> lines = Files.readAllLines(Path.of("..", ".env.example"),
						StandardCharsets.UTF_8).stream()
				.map(String::strip)
				.toList();

		int asked = 0;

		for (Path stack : everyStackThisRepoDeploys().toList()) {
			for (String setting : settingsOf(stack)) {
				assertThat(lines)
						.as("%s asks for %s and .env.example carries no line for it, while"
								+ " deploy/README.md says to raise a stack by copying that file."
								+ " Whoever follows the runbook gets a stack that comes up with"
								+ " that setting silently unset", stack, setting)
						.anyMatch(line -> line.startsWith(setting + "="));

				asked++;
			}
		}

		assertThat(asked)
				.as("no stack asks the environment for anything at all, so this compared nothing")
				.isNotZero();
	}

	/**
	 * Whether the runbook NAMES this setting, rather than merely containing its letters.
	 *
	 * <p>A name is bounded by anything that is not a name character, or by the ends of the
	 * file. That is what separates {@code MAIL_PORT} from {@code PROD_MAIL_PORT}, which is
	 * the whole reason this method exists instead of {@code contains}.
	 */
	private static boolean namedIn(String runbook, String setting) {
		return java.util.regex.Pattern
				.compile("(^|[^A-Za-z0-9_])" + java.util.regex.Pattern.quote(setting) + "([^A-Za-z0-9_]|$)")
				.matcher(runbook)
				.find();
	}

	/**
	 * THE SAME FLOOR, OVER THE FILE THE OWNER ACTUALLY READS.
	 *
	 * <p>The case above proves a setting has a LINE in {@code .env.example}. That is not
	 * enough, and this was measured rather than argued: {@code deploy/README.md} tells the
	 * owner to copy that file and then <i>"keep the PROD_* lines"</i>, listing the names in a
	 * table. A setting whose name carries no {@code PROD_} prefix and sits in no row of that
	 * table is one the runbook tells him to DELETE, even though the stack asks for it.
	 *
	 * <p>That is how {@code BTL_SUPERADMIN_EMAIL} arrived: present in Compose, present in
	 * {@code .env.example}, absent from the runbook. Following the runbook produced a stack
	 * that comes up green with no superadmin and nothing saying why.
	 *
	 * <p><b>Nothing is listed here either.</b> The names come from Compose, the same floor as
	 * above, so a setting that arrives tomorrow is measured the day it arrives. What is
	 * claimed is only that the runbook MENTIONS the name - not where, not how well.
	 */
	@Test
	void everySettingEveryStackAsksForIsNamedInTheRunbookThatTellsTheOwnerWhatToKeep() throws Exception {
		String runbook = Files.readString(Path.of("..", "deploy", "README.md"),
				StandardCharsets.UTF_8);

		int asked = 0;

		for (Path stack : everyStackThisRepoDeploys().toList()) {
			for (String setting : settingsOf(stack)) {
				/* BY NAME, NOT BY SUBSTRING, and that distinction was measured rather
				   than argued. The first draft of this case asked `contains(setting)`,
				   and a setting called MAIL_PORT then passed on a file that only ever
				   says PROD_MAIL_PORT and QA_MAIL_PORT. Three live names were green
				   that way on the day this was written. The sibling case ten lines up
				   compares `startsWith(setting + "=")` for the same reason. */
				assertThat(runbook)
						.as("%s asks for %s, but deploy/README.md never names it. The runbook"
								+ " tells the owner to copy .env.example and keep only the lines"
								+ " it lists, so a name missing from it is a name he is told to"
								+ " delete - and the stack then comes up with that setting"
								+ " silently unset", stack, setting)
						.matches(whole -> namedIn(whole, setting));

				asked++;
			}
		}

		assertThat(asked)
				.as("no stack asks the environment for anything at all, so this compared nothing")
				.isNotZero();
	}

	/**
	 * Every {@code compose.<env>.yml} stack this repository deploys, restricted to the ones
	 * this runbook hands the owner a recipe for.
	 *
	 * <p>The root development stack is not among them: {@code docker-compose.yml} carries no
	 * {@code PREFIX_} convention and this file has no {@code cp .env.example .env} step for
	 * it at all, so there is no recipe line to hold it to.
	 */
	private static Stream<Path> everyStackThisRunbookGivesARecipeFor() throws Exception {
		return everyStackThisRepoDeploys()
				.filter(stack -> stack.getFileName().toString().matches("compose\\.[a-z0-9]+\\.ya?ml"));
	}

	/**
	 * AND EVERY SETTING SURVIVES THE ONE RECIPE LINE THE OWNER ACTUALLY RUNS BY HAND.
	 *
	 * <p><b>The case above proves a name is somewhere in the file. That is a weaker claim
	 * than it looks, and this was measured rather than argued.</b> {@code
	 * BTL_SUPERADMIN_EMAIL} was named in the production table and in two paragraphs while
	 * the line the owner actually runs, {@code cp ../.env.example .env}, told him in its own
	 * trailing comment to keep only the {@code PROD_*} lines. Reverting just that one
	 * comment back to that state left every other case in this file green, because the name
	 * still appeared four other places nobody's hand follows.
	 *
	 * <p><b>So this reads the recipe line itself, never the prose around it.</b> Each stack
	 * here is named {@code compose.<env>.yml}; its {@code PREFIX_} is that environment word,
	 * upper-cased with a trailing underscore, which is also how every setting it asks for by
	 * that convention is spelled. The line in the runbook that runs
	 * {@code cp ../.env.example .env} and also says {@code PREFIX_*} is the recipe this
	 * stack's owner follows by hand. A setting either falls under that mask, or it has to be
	 * named on that same line outright the way {@code BTL_SUPERADMIN_EMAIL} is - there is no
	 * third way to survive being copied by hand.
	 *
	 * <p><b>What it does not claim:</b> that the mask or the name is spelled correctly
	 * anywhere else, or that the table agrees with it. A production-only case beside this one
	 * covers the table; nothing here asks about QA's, because QA's settings are prose, not a
	 * table.
	 */
	@ParameterizedTest
	@MethodSource("everyStackThisRunbookGivesARecipeFor")
	void everySettingSurvivesTheOneRecipeLineTheOwnerActuallyRunsByHand(Path stack) throws Exception {
		String named = stack.getFileName().toString();
		String environment = named.replaceFirst("^compose\\.", "").replaceFirst("\\.ya?ml$", "");
		String prefix = environment.toUpperCase(java.util.Locale.ROOT) + "_";

		String runbook = Files.readString(Path.of("..", "deploy", "README.md"), StandardCharsets.UTF_8);

		List<String> recipes = runbook.lines()
				.filter(line -> line.contains("cp ../.env.example .env"))
				.filter(line -> line.contains(prefix + "*"))
				.toList();

		assertThat(recipes)
				.as("%s asks the owner to keep its %s* lines, but no line in deploy/README.md"
						+ " that runs `cp ../.env.example .env` says so, so nothing ties this"
						+ " stack to the recipe the owner actually runs by hand", named, prefix)
				.isNotEmpty();

		for (String setting : settingsOf(stack)) {
			boolean underTheMask = setting.startsWith(prefix);
			boolean namedOutright = recipes.stream().anyMatch(line -> namedIn(line, setting));

			assertThat(underTheMask || namedOutright)
					.as("%s asks for %s, and the recipe line the owner actually runs for this"
							+ " stack keeps only the %s* lines - which %s does not start with -"
							+ " without naming %s outright either. Following that line by hand"
							+ " deletes this setting from .env and the stack comes up without"
							+ " it", named, setting, prefix, setting, setting)
					.isTrue();
		}
	}

	/**
	 * AND THE PRODUCTION TABLE NAMES EVERY SETTING PRODUCTION ASKS FOR.
	 *
	 * <p><b>Scoped to {@code compose.prod.yml} on purpose, and the scope is measured rather
	 * than assumed.</b> A row here is any stripped line starting with {@code |}, no Markdown
	 * parser needed to find one. Asked of this file as it stands on 20.09.2026: all eight
	 * production names are genuinely in such a row; none of QA's seven are in any, because
	 * the QA half of this runbook explains its settings in prose and carries no table at
	 * all. Extending this case to QA would therefore not measure a missing row, only a
	 * missing table - a different, larger claim this case does not make.
	 *
	 * <p>What this closes that the case above cannot: deleting a row from this table leaves
	 * every other name in the file untouched, {@code BTL_SUPERADMIN_EMAIL} included, so
	 * nothing that merely asks whether a name appears ANYWHERE catches it.
	 */
	@Test
	void theProductionTableNamesEverySettingProductionAsksFor() throws Exception {
		List<String> lines = Files.readAllLines(Path.of("..", "deploy", "README.md"),
				StandardCharsets.UTF_8);

		int header = -1;

		for (int at = 0; at < lines.size(); at++) {
			if (lines.get(at).strip().equals("| name | what it is | required |")) {
				header = at;
				break;
			}
		}

		assertThat(header)
				.as("deploy/README.md no longer carries the production settings table under the"
						+ " heading this case looks for, so nothing below reads anything")
				.isNotEqualTo(-1);

		TreeSet<String> named = new TreeSet<>();

		for (int at = header + 2; at < lines.size(); at++) {
			String row = lines.get(at).strip();

			if (!row.startsWith("|")) {
				break;
			}

			java.util.regex.Matcher backtick = java.util.regex.Pattern.compile("`([^`]+)`").matcher(row);

			if (backtick.find()) {
				named.add(backtick.group(1));
			}
		}

		Path prod = everyStackThisRepoDeploys()
				.filter(stack -> stack.getFileName().toString().equals("compose.prod.yml"))
				.findFirst()
				.orElseThrow(() -> new AssertionError("deploy/ no longer carries compose.prod.yml,"
						+ " so this case has nothing to measure the table against"));

		assertThat(named)
				.as("the production table in deploy/README.md is missing a row for a setting"
						+ " compose.prod.yml asks for; following it by hand deletes that"
						+ " setting from .env and production comes up without it")
				.containsAll(settingsOf(prod));
	}

	/**
	 * What one stack hands its backend, read off COMPOSE'S OWN rendered configuration.
	 *
	 * <p>The shape is {@code PostmanTest}'s, with one difference that matters here: it
	 * reads the rendered output rather than the file, so interpolation has already
	 * happened and the value seen is the value the container would get. Reading the text
	 * instead would put this back among the three drafts the header above describes.
	 */
	@SuppressWarnings("unchecked")
	private static Map<String, Object> backendEnvironmentOf(String rendered, Path stack) {
		Map<String, Object> configured = new Yaml().load(rendered);
		Map<String, Object> services = (Map<String, Object>) configured.get("services");

		assertThat(services)
				.as("%s renders no services at all, so it hands nothing to anything", stack)
				.isNotNull();

		Map<String, Object> backend = (Map<String, Object>) services.get("backend");

		assertThat(backend)
				.as("%s deploys no backend at all, so it hands it no settings; if that is on"
						+ " purpose this case has to say which stacks carry one", stack)
				.isNotNull();

		Object environment = backend.get("environment");

		/* Compose takes `environment` as a map or as a list of `KEY=value`, and this reads
		   the map, which is what `docker compose config` normalises to. Written as a bare
		   cast it would fail with a ClassCastException naming neither the superadmin nor
		   the stack, and the next person would be tempted to make the failure go away
		   rather than to keep what it was guarding. */
		assertThat(environment)
				.as("%s renders its backend settings as a list rather than a map, and this case"
						+ " reads the map - rewrite it to read both rather than dropping it,"
						+ " because what it holds is that the superadmin's address reaches the"
						+ " backend at all", stack)
				.isInstanceOf(Map.class);

		return (Map<String, Object>) environment;
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
