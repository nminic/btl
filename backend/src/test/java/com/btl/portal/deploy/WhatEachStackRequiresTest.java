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
	 * {@code deploy/README.md}, read whole. Several cases below read it as PARAGRAPHS rather
	 * than lines, via {@link #paragraphsOf}, because a markdown sentence here often carries
	 * its noun on one line and its verb on the next; a line-by-line reader has already been
	 * measured missing exactly the sentence it existed to catch.
	 */
	private static String runbook() throws IOException {
		return Files.readString(Path.of("..", "deploy", "README.md"), StandardCharsets.UTF_8);
	}

	/** Markdown paragraphs: blocks separated by one or more blank lines. */
	private static List<String> paragraphsOf(String text) {
		return List.of(text.split("\\r?\\n\\s*\\r?\\n+"));
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
	 *
	 * <p><b>Scoped to the stacks this runbook gives a recipe for, and the scope is measured
	 * rather than assumed.</b> {@code docker-compose.yml} used to be asked here too, and its
	 * three settings passed by coincidence: the only two places their bare names appear in
	 * this file are a psql command told, two lines below it, to read the production
	 * CONTAINER's own environment, and a quoted Compose error message - neither one a line
	 * telling the owner to keep or set anything, since this file's own header says it is
	 * production deployment and never opens a {@code .env} for the root stack at all.
	 * Measured 20.09.2026: renaming those two coincidental occurrences failed this case with
	 * a message that would have sent the owner to add development names to the production
	 * runbook. {@link #everyStackThisRunbookGivesARecipeFor} already carries the reason
	 * {@code docker-compose.yml} has no recipe here to be named in; the psql line itself is
	 * pinned by {@code theIdentityCheckReadsTheContainersOwnEnvironment} below rather than
	 * left to this case's coincidence.
	 */
	@Test
	void everySettingEveryStackAsksForIsNamedInTheRunbookThatTellsTheOwnerWhatToKeep() throws Exception {
		String runbook = runbook();

		int asked = 0;

		for (Path stack : everyStackThisRunbookGivesARecipeFor().toList()) {
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
				.as("no stack this runbook covers asks the environment for anything at all, so"
						+ " this compared nothing")
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
	 * AND THE IDENTITY CHECK STILL READS THE CONTAINER'S OWN ENVIRONMENT, NEVER A NAME
	 * WRITTEN HERE.
	 *
	 * <p><b>Why this is pinned instead of left to the naming case above.</b>
	 * {@code docker-compose.yml}'s settings are deliberately out of that case's scope now
	 * (see its javadoc), because {@code deploy/README.md} never gives that stack a recipe.
	 * The one place this file still touches those bare names is the psql line under
	 * "Checking that production really came up", and the paragraph two lines below it says
	 * exactly why that has to stay a live read rather than a written name: "whatever
	 * PROD_POSTGRES_USER and PROD_POSTGRES_DB were set to on this host is what the container
	 * was started with, and that is the only copy that cannot be stale." A rename to
	 * clearer-looking variables, or a literal role and database pasted in, both read as an
	 * improvement and both go stale the day {@code PROD_POSTGRES_USER} changes on the host
	 * without this file being touched.
	 *
	 * <p>Pinned as the exact command rather than a pattern, because there is only one such
	 * line and its words either match what the container carries or they do not.
	 */
	@Test
	void theIdentityCheckReadsTheContainersOwnEnvironment() throws Exception {
		assertThat(runbook())
				.as("deploy/README.md's \"Checking that production really came up\" section"
						+ " should still run psql with -U \"$POSTGRES_USER\" -d"
						+ " \"$POSTGRES_DB\", reading the production postgres container's own"
						+ " environment rather than a name written here, which the paragraph"
						+ " right after it says is the only copy that cannot be stale")
				.contains("psql -U \"$POSTGRES_USER\" -d \"$POSTGRES_DB\"");
	}

	/**
	 * AND NOTHING IN THIS RUNBOOK OFFERS {@code restart} AS THE WAY TO APPLY AN
	 * {@code .env} CHANGE.
	 *
	 * <p><b>Why this is asked of every paragraph rather than the one line that was wrong.</b>
	 * {@code docker compose restart} does not reread {@code .env}: it restarts the
	 * container's existing process, which still carries whatever environment it was created
	 * with. Line 85 of this very file says so - "restart one service" - and separates it
	 * from {@code up -d --build} two lines later. The production superadmin paragraph
	 * nonetheless closed with "put the address into `.env` and restart", the one sentence in
	 * the whole file that told the owner the opposite of what line 85 already says; following
	 * it by hand left {@code BTL_SUPERADMIN_EMAIL} set on disk and empty in the running
	 * container.
	 *
	 * <p><b>Read as paragraphs, never as lines,</b> via {@link #paragraphsOf}, because a
	 * markdown sentence here often carries {@code .env} on one line and {@code restart} on
	 * the next.
	 *
	 * <p><b>What this allows, named rather than guessed:</b> a paragraph is free to mention
	 * both words if it is itself the warning that restart does not reread {@code .env}. Any
	 * other paragraph naming both is the mistake this case exists to catch.
	 */
	@Test
	void restartIsNeverOfferedAsTheWayToApplyAnEnvChange() throws Exception {
		java.util.regex.Pattern restartWord = java.util.regex.Pattern
				.compile("\\brestart\\b", java.util.regex.Pattern.CASE_INSENSITIVE);

		List<String> both = paragraphsOf(runbook()).stream()
				.filter(block -> restartWord.matcher(block).find() && block.contains(".env"))
				.toList();

		assertThat(both)
				.as("every paragraph naming both `restart` and `.env` must say outright that"
						+ " restart does not reread it - `docker compose restart` never"
						+ " applies a changed setting, only recreating the container does,"
						+ " and a paragraph that mentions both without saying so tells the"
						+ " owner the opposite: %s", both)
				.allMatch(block -> block.contains("`restart` does not reread `.env`"));
	}

	/**
	 * AND THE RECIPE LINE NEVER TELLS THE OWNER TO SET THE SUPERADMIN ADDRESS YET.
	 *
	 * <p><b>PDL P21's whole protection is an order: register and confirm the address BEFORE
	 * it goes into {@code .env}.</b> Both {@code cp ../.env.example .env} recipe lines in
	 * this file - production and QA - carried a trailing comment reading "keep the PROD_*
	 * [or QA_*] lines AND BTL_SUPERADMIN_EMAIL, set real values [or the password]", which
	 * told whoever runs it by hand to fill in the real address at the exact moment P21 says
	 * it must still be empty. Both lines were new in the same PR that added P21's own
	 * paragraph a few lines below each one, so the contradiction was that PR's own.
	 *
	 * <p>Reads every recipe line by the same {@code cp ../.env.example .env} anchor
	 * {@link #everySettingSurvivesTheOneRecipeLineTheOwnerActuallyRunsByHand} already uses,
	 * and for any of them that mentions the setting at all, requires it to say the address is
	 * left empty at this step - not that the wording takes any particular shape, only that
	 * "empty" is somewhere in it.
	 */
	@Test
	void theEnvRecipeLineNeverTellsTheOwnerToSetTheSuperadminAddressYet() throws Exception {
		List<String> recipes = runbook().lines()
				.filter(line -> line.contains("cp ../.env.example .env"))
				.toList();

		assertThat(recipes)
				.as("deploy/README.md no longer carries a `cp ../.env.example .env` recipe"
						+ " line, so this measures nothing")
				.isNotEmpty();

		assertThat(recipes)
				.as("no recipe line mentions %s any more, so this case is not measuring the"
						+ " thing it was written for; if the setting is meant to be dropped"
						+ " from these comments on purpose, delete this case rather than"
						+ " leave it passing without reading anything", SUPERADMIN)
				.anyMatch(recipe -> recipe.contains(SUPERADMIN));

		for (String recipe : recipes) {
			if (recipe.contains(SUPERADMIN)) {
				assertThat(recipe)
						.as("\"%s\" mentions %s while copying .env.example, but does not say"
								+ " it is left empty at this step - PDL P21 requires the"
								+ " address to be registered and confirmed BEFORE it goes into"
								+ " .env, so a recipe line that hands it a real value here"
								+ " tells the owner to do the opposite", recipe, SUPERADMIN)
						.contains("empty");
			}
		}
	}

	/**
	 * AND THE QA ORDER ALSO NAMES THE MAIL KEY, BEFORE IT SENDS THE OWNER TO REGISTER.
	 *
	 * <p><b>The production paragraph on this same page already says the mail key has to be
	 * pasted before anybody registers.</b> The QA paragraph explaining why PDL P21's order
	 * does not protect QA sent the owner straight to "raising QA with the setting blank,
	 * registering, confirming" without ever naming {@code QA_MAIL_USERNAME} or
	 * {@code QA_MAIL_PASSWORD}. {@code RegistrationApi.send} swallows a relay failure into a
	 * 204 and a log line rather than an error, so a stack raised with a blank key registers
	 * the owner, never sends the confirmation, and leaves the address unconfirmed with the
	 * stored token holding only a hash - nothing to recover a link from. Following the QA
	 * paragraph by hand therefore still ends with no superadmin on QA, for a different reason
	 * than the one the paragraph itself warns about.
	 *
	 * <p>Anchored on the sentence that already names this decision, so a rewrite of the rest
	 * of the paragraph does not make this case stop reading it.
	 */
	@Test
	void theQaOrderAlsoNamesTheMailKeyBeforeRegistering() throws Exception {
		List<String> qaOrder = paragraphsOf(runbook()).stream()
				.filter(block -> block.contains("ON QA THIS ORDER DOES NOT PROTECT YOU"))
				.toList();

		assertThat(qaOrder)
				.as("deploy/README.md no longer explains PDL P21's QA order in the paragraph"
						+ " this case looks for, so nothing below measures anything")
				.hasSize(1);

		assertThat(qaOrder.get(0))
				.as("the QA order sends the owner to register and confirm with the superadmin"
						+ " setting blank, but never says to paste QA_MAIL_USERNAME and"
						+ " QA_MAIL_PASSWORD first - without them RegistrationApi.send"
						+ " swallows the mail failure into a 204, the address is never"
						+ " confirmed, and the stored token holds only a hash nothing can"
						+ " recover a link from")
				.contains("QA_MAIL_USERNAME")
				.contains("QA_MAIL_PASSWORD");
	}

	/**
	 * ENGLISH CARDINAL NUMBER WORDS THIS FILE SPELLS OUT, so a count can be compared against
	 * the word rather than the word being trusted to have kept up with the count.
	 */
	private static final List<String> NUMBER_WORDS = List.of("zero", "one", "two", "three",
			"four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve");

	private static String numberWord(int count) {
		assertThat(count)
				.as("this case only knows how to spell counts up to twelve in words; %d is"
						+ " outside that range, so extend NUMBER_WORDS rather than trust a"
						+ " mismatch it cannot report", count)
				.isLessThan(NUMBER_WORDS.size());

		return NUMBER_WORDS.get(count);
	}

	private static String capitalized(String word) {
		return Character.toUpperCase(word.charAt(0)) + word.substring(1);
	}

	/**
	 * AND THE PRODUCTION NAME COUNT AGREES WITH WHAT COMPOSE ASKS FOR.
	 *
	 * <p><b>The numbers in this file are all correct as committed and nothing holds them
	 * there.</b> Measured 20.09.2026: adding an eighth setting, {@code QA_MAIL_REPLY_TO}, to
	 * {@code compose.qa.yml}, {@code .env.example}, this runbook and {@code HELD} left the
	 * whole suite green while "Eight names", two paragraphs above the production table and
	 * written for the seven {@code PROD_*} settings plus {@code BTL_SUPERADMIN_EMAIL} this
	 * table carried on 20.09.2026, went uncorrected - a prose count nothing compared against
	 * Compose's own answer.
	 *
	 * <p>So this derives the count from {@link #settingsOf} rather than the table, spells it
	 * with {@link #numberWord}, and requires the sentence introducing the production table to
	 * say that word.
	 */
	@Test
	void theProductionNameCountAgreesWithWhatComposeAsksFor() throws Exception {
		Path prod = everyStackThisRepoDeploys()
				.filter(stack -> stack.getFileName().toString().equals("compose.prod.yml"))
				.findFirst()
				.orElseThrow(() -> new AssertionError("deploy/ no longer carries"
						+ " compose.prod.yml, so this case has nothing to count"));

		int total = settingsOf(prod).size();
		String expected = capitalized(numberWord(total)) + " names, and no value of any of"
				+ " them belongs in this repository or in any";

		assertThat(runbook())
				.as("compose.prod.yml asks for %d settings, so the sentence introducing the"
						+ " production table should read \"%s\" - a setting added to or"
						+ " removed from this stack without touching this sentence leaves it"
						+ " wrong while the suite stays green", total, expected)
				.contains(expected);
	}

	/**
	 * AND THE QA COPY LINE'S THREE COUNTS AGREE WITH WHAT COMPOSE ASKS FOR.
	 *
	 * <p>The same gap as above, over the sentence that tells the QA owner how many
	 * {@code QA_*} lines to copy, and its two parenthetical subtotals. Measured 20.09.2026:
	 * the same {@code QA_MAIL_REPLY_TO} addition left "Copy the seven `QA_*` lines (three
	 * `QA_POSTGRES_*` and four `QA_MAIL_*`)" uncorrected while Compose's own count had
	 * already moved to eight and five.
	 */
	@Test
	void theQaCopyLineCountsAgreeWithWhatComposeAsksFor() throws Exception {
		Path qa = everyStackThisRepoDeploys()
				.filter(stack -> stack.getFileName().toString().equals("compose.qa.yml"))
				.findFirst()
				.orElseThrow(() -> new AssertionError("deploy/ no longer carries"
						+ " compose.qa.yml, so this case has nothing to count"));

		List<String> settings = settingsOf(qa);

		long prefixed = settings.stream().filter(one -> one.startsWith("QA_")).count();
		long postgres = settings.stream().filter(one -> one.startsWith("QA_POSTGRES_")).count();
		long mail = settings.stream().filter(one -> one.startsWith("QA_MAIL_")).count();

		String expected = "Copy the " + numberWord((int) prefixed) + " `QA_*` lines ("
				+ numberWord((int) postgres) + " `QA_POSTGRES_*` and " + numberWord((int) mail)
				+ " `QA_MAIL_*`)";

		assertThat(runbook())
				.as("compose.qa.yml asks for %d QA_* settings (%d QA_POSTGRES_* and %d"
						+ " QA_MAIL_*), so the recipe line telling the owner what to copy"
						+ " should read \"%s\" - a setting added to or removed from this stack"
						+ " without touching this sentence leaves it wrong while the suite"
						+ " stays green", prefixed, postgres, mail, expected)
				.contains(expected);
	}

	/**
	 * THE NAME THE BACKEND IS HANDED FOR THE FOLDER IT KEEPS PICTURES IN.
	 *
	 * <p>{@code PhotoApi} binds it through {@code btl.photos.folder}, which Spring's relaxed
	 * binding spells this way in the environment, and {@code application.properties} defaults
	 * it to a temporary folder - so a stack that hands it nothing does not fail, it silently
	 * keeps members' photographs in the container's {@code /tmp}.
	 */
	private static final String PHOTOS = "BTL_PHOTOS_FOLDER";

	/**
	 * AND EVERY DEPLOYED STACK KEEPS ITS PICTURES SOMEWHERE THAT SURVIVES A BUILD, WHICH IS
	 * ONE FACT WITH TWO HOMES AND THEY ARE COMPARED HERE.
	 *
	 * <p><b>Measured 20.09.2026, twice, and each half was its own finding.</b>
	 *
	 * <ol>
	 * <li><b>The path was written by hand in two places in one file</b> - once as the
	 * setting handed to the backend and once as the target of the mount - and nothing
	 * compared them. Changing the mount to {@code /var/lib/btl/pictures} left this class
	 * green over nineteen cases. What a typo does is silent in the worst way: the rows in
	 * {@code photo} stay, the files go with every {@code up -d --build}, and from outside it
	 * looks like a portal nobody has ever uploaded to.
	 * <li><b>{@code compose.prod.yml} had neither of the two.</b> Production would have
	 * fallen back to {@code application.properties}, which is {@code java.io.tmpdir} - a
	 * folder every process in the container may write, emptied by every build, and covered by
	 * no backup. Nothing here saw it, because the whole of this file asks what a stack does
	 * when a SETTING has no value, and QA's path is written out rather than taken from
	 * {@code .env}, so it has no row in that table at all.
	 * </ol>
	 *
	 * <p><b>Both halves are read off Compose's rendered configuration</b>, so the comparison
	 * is between what the container would really be handed and where something would really
	 * be mounted, not between two pieces of text. The stacks asked are the ones the runbook
	 * gives a recipe for - QA and production - which leaves the root development stack out by
	 * derivation rather than by name: on a developer's machine the temporary folder IS the
	 * right answer, and {@code application.properties} says so in its own note.
	 *
	 * <p><b>What it does not claim:</b> that the mount is a named volume rather than a bind.
	 * ADL A41 decided a named volume and this asks only that SOMETHING durable is mounted at
	 * the path the backend was told about; the day a stack binds a host folder instead, that
	 * is a decision for whoever writes it and not a thing for this line to refuse.
	 */
	@Test
	@SuppressWarnings("unchecked")
	void everyDeployedStackMountsSomethingWhereItToldItsBackendToKeepPictures() throws Exception {
		List<Path> asked = new ArrayList<>();

		for (Path stack : everyStackThisRunbookGivesARecipeFor().toList()) {
			Map<String, String> distinct = new LinkedHashMap<>();

			settingsOf(stack).forEach(one -> distinct.put(one, PLACEHOLDER + "-" + one));

			Ran rendered = compose(stack, List.of("config"), distinct);

			assertThat(rendered.code())
					.as("%s could not be rendered even with every setting given a value, so"
							+ " nothing below reads anything:%n%s", stack, rendered.errors())
					.isZero();

			Map<String, Object> backend = backendEnvironmentOf(rendered.output(), stack);

			assertThat(backend)
					.as("%s deploys a backend and hands it no %s, so the portal falls back to"
							+ " application.properties - which is java.io.tmpdir. Every"
							+ " photograph a member uploads would go to a folder inside the"
							+ " container: writable by everything in it, emptied by the next"
							+ " build, and in no backup", stack, PHOTOS)
					.containsKey(PHOTOS);

			String folder = String.valueOf(backend.get(PHOTOS));

			Map<String, Object> configured = (Map<String, Object>) new Yaml()
					.load(rendered.output());
			Map<String, Object> services = (Map<String, Object>) configured.get("services");
			Map<String, Object> service = (Map<String, Object>) services.get("backend");
			Object mounts = service.get("volumes");

			assertThat(mounts)
					.as("%s tells its backend to keep pictures in %s and mounts nothing at all"
							+ " into it, so they live in the container's own writable layer and"
							+ " go with the next build while the rows describing them stay",
							stack, folder)
					.isInstanceOf(List.class);

			List<String> targets = ((List<Object>) mounts).stream()
					.map(one -> one instanceof Map<?, ?> longhand
							? String.valueOf(longhand.get("target"))
							/* Compose normalises to the long form, so this is the answer to a
							   shape that should not arrive rather than a second reader: a
							   short `source:target` string, whose target is what follows the
							   last colon. Written as a silent skip it would turn a mount this
							   case cannot read into a mount this case says is missing. */
							: String.valueOf(one).substring(String.valueOf(one).lastIndexOf(':') + 1))
					.toList();

			assertThat(targets)
					.as("%s hands its backend %s=%s and mounts nothing at that exact path. The"
							+ " two are written by hand in one file and this is the only thing"
							+ " that compares them: one letter apart, the uploads go into the"
							+ " container and the database goes on describing them. Mounted"
							+ " here: %s", stack, PHOTOS, folder, targets)
					.contains(folder);

			asked.add(stack);
		}

		assertThat(asked)
				.as("no stack this runbook covers deploys a backend at all, so this case"
						+ " measured nothing and reported green")
				.hasSizeGreaterThanOrEqualTo(2);
	}

	/**
	 * AND THE IMAGE MAKES THAT FOLDER BEFORE IT DROPS PRIVILEGE, SO THE FIRST UPLOAD DOES NOT
	 * FALL ON IT.
	 *
	 * <p><b>Measured 20.09.2026 rather than read.</b> Docker creates a fresh named volume
	 * mounted at a path the image does not have as {@code root:root drwxr-xr-x}; from the
	 * same {@code eclipse-temurin:21-jre} as uid 1001, {@code ls} passes and {@code touch}
	 * comes back „Permission denied". {@code backend/Dockerfile} ends in {@code USER btl},
	 * uid 1001. So the stack comes up, the health check is green, every picture already
	 * described by a row answers, and the FIRST upload fails - at a place that has nothing to
	 * do with uploading. What removes it is the image OWNING the directory before the volume
	 * is laid over it: Docker copies an existing directory's content AND its ownership into a
	 * fresh named volume.
	 *
	 * <p><b>The path is not written here.</b> It is the one the stack hands its backend,
	 * rendered by Compose, exactly as in the case above - so the day that path moves, this
	 * moves with it and the Dockerfile is what has to answer.
	 *
	 * <p><b>What it reads and what that is worth.</b> It reads the Dockerfile as text,
	 * which is the shape this repository distrusts, and the reason it is accepted here is
	 * that the alternative is building the image and raising a fresh volume inside the gate -
	 * minutes per run for a fact that changes once. So the claim is kept narrow and literal:
	 * the file must carry a {@code chown} naming both the user the image runs as and this
	 * exact path, and it must do so BEFORE the {@code USER} line, because afterwards it could
	 * not. A Dockerfile that achieves the same some other way fails here and its author says
	 * so once, which is the direction the whole of this file is written in.
	 */
	@Test
	@SuppressWarnings("unchecked")
	void theImageOwnsThatFolderBeforeItStopsBeingRoot() throws Exception {
		List<String> dockerfile = Files.readAllLines(Path.of("..", "backend", "Dockerfile"),
				StandardCharsets.UTF_8);

		int dropsPrivilege = -1;

		for (int at = 0; at < dockerfile.size(); at++) {
			if (dockerfile.get(at).strip().startsWith("USER ")) {
				dropsPrivilege = at;
			}
		}

		assertThat(dropsPrivilege)
				.as("backend/Dockerfile no longer drops privilege at all, so the image runs as"
						+ " root and this case is asking about a problem that has been replaced"
						+ " by a larger one")
				.isNotNegative();

		String whoItRunsAs = dockerfile.get(dropsPrivilege).strip().substring("USER ".length())
				.strip();

		String beforeThat = String.join("\n", dockerfile.subList(0, dropsPrivilege));

		for (Path stack : everyStackThisRunbookGivesARecipeFor().toList()) {
			Map<String, String> distinct = new LinkedHashMap<>();

			settingsOf(stack).forEach(one -> distinct.put(one, PLACEHOLDER + "-" + one));

			Map<String, Object> backend =
					backendEnvironmentOf(compose(stack, List.of("config"), distinct).output(),
							stack);

			String folder = String.valueOf(backend.get(PHOTOS));

			assertThat(beforeThat)
					.as("%s tells its backend to keep pictures in %s, and backend/Dockerfile"
							+ " never gives %s that folder before it stops being root. A fresh"
							+ " named volume is made root-owned, so the stack comes up healthy"
							+ " and the first upload is the thing that falls", stack, folder,
							whoItRunsAs)
					.contains(folder)
					.containsPattern("chown[^\\n]*" + whoItRunsAs);
		}
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
