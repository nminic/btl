package com.btl.portal.domain.result;

import com.btl.portal.domain.result.ProofThatTheRunHappened.Outcome;
import com.btl.portal.domain.result.ProofThatTheRunHappened.Report;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** The proof rule, and the forms it was read off. */
class ProofThatTheRunHappenedTest {

	private static final String A_LINK = "https://runtrace.net/rezultat/1";

	private static final Path FORMS = Path.of("..", "frontend", "src", "forms", "definitions");

	/**
	 * A LINK ON ITS OWN IS ENOUGH, AND A PHOTOGRAPH WITH A WORD IS ENOUGH.
	 *
	 * <p>The two ways through, and they are written beside each other because the
	 * rule is that the legs swap: neither one needs the other.
	 */
	@Test
	void eitherHalfOfTheProofWillDo() {
		assertThat(ProofThatTheRunHappened.decide(new Report(A_LINK, false, "")))
				.as("a link on its own was refused")
				.isEqualTo(Outcome.GOOD);

		assertThat(ProofThatTheRunHappened.decide(new Report("", true, "trcao sam sa Markom")))
				.as("a photograph with a word about it was refused")
				.isEqualTo(Outcome.GOOD);
	}

	/**
	 * AND NEITHER HALF IS NOTHING.
	 *
	 * <p>Blank and absent are one case and both are here, because a form posts an
	 * empty string where a script posts nothing, and a rule written against one of
	 * them lets the other through to a table that takes anything but null.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"", "   "})
	void withNoLinkAndNoPhotographThereIsNothingToLookAt(String nothing) {
		assertThat(ProofThatTheRunHappened.decide(new Report(nothing, false, "trcao sam")))
				.as("a report showing nothing at all was accepted, and a comment is not proof")
				.isEqualTo(Outcome.NOTHING_SHOWS_IT_HAPPENED);

		assertThat(ProofThatTheRunHappened.decide(new Report(null, false, nothing)))
				.isEqualTo(Outcome.NOTHING_SHOWS_IT_HAPPENED);
	}

	/**
	 * A PHOTOGRAPH NEVER STANDS ALONE, AND A LINK DOES NOT EXCUSE IT.
	 *
	 * <p>The second half is the one a rule written as „link or photograph" gets
	 * wrong: the comment is required by the PHOTOGRAPH being there, not by the link
	 * being absent, so a report carrying both a good link and a wordless photograph
	 * is still refused.
	 */
	@Test
	void aPhotographAlwaysNeedsAWordAboutIt() {
		assertThat(ProofThatTheRunHappened.decide(new Report("", true, "  ")))
				.isEqualTo(Outcome.A_PHOTOGRAPH_NEVER_STANDS_ALONE);

		assertThat(ProofThatTheRunHappened.decide(new Report(A_LINK, true, null)))
				.as("a wordless photograph rode in on a good link")
				.isEqualTo(Outcome.A_PHOTOGRAPH_NEVER_STANDS_ALONE);
	}

	/**
	 * WHAT IS NOT A WEB ADDRESS IS SAID SO, and said before anything else.
	 *
	 * <p>The photograph is there in the second case on purpose: judged after the
	 * rule rather than before it, a mistyped address would be called fine and then
	 * thrown out by {@code result_submission_link_shape} as a server fault.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"runtrace.net/rezultat/1", "ftp://runtrace.net", "https://",
			"https://runtrace.net/ rezultat", "pogledaj kod mene"})
	void somethingThatIsNotAnAddressIsNotAProof(String notAnAddress) {
		assertThat(ProofThatTheRunHappened.decide(new Report(notAnAddress, false, "")))
				.as("'%s' was taken for a web address", notAnAddress)
				.isEqualTo(Outcome.A_LINK_THAT_IS_NOT_A_LINK);

		assertThat(ProofThatTheRunHappened.decide(new Report(notAnAddress, true, "trcao sam")))
				.as("'%s' passed because a photograph came with it", notAnAddress)
				.isEqualTo(Outcome.A_LINK_THAT_IS_NOT_A_LINK);
	}

	/**
	 * AND THE CLASS SAYS WHAT GETS WRITTEN, not only whether it may be.
	 *
	 * <p>A field nobody filled in goes in as the empty string, because the column is
	 * {@code not null} and takes the empty string or an address and nothing between.
	 * A space left in that field by somebody who proved his run with a photograph is
	 * the case this is for: the report is good and the space is not storable, and
	 * without this the caller would have had to work that out on its own.
	 */
	@Test
	void whatGoesIntoTheRowIsSaidHereAndNotLeftToTheCaller() {
		assertThat(ProofThatTheRunHappened.linkAsItGoesIn(new Report("   ", true, "trcao sam")))
				.as("a space would have been written into a column that refuses one")
				.isEmpty();
		assertThat(ProofThatTheRunHappened.linkAsItGoesIn(new Report(null, true, "trcao sam")))
				.isEmpty();
		assertThat(ProofThatTheRunHappened.linkAsItGoesIn(new Report("  " + A_LINK + " ", false, "")))
				.as("what somebody typed was written down with the space he left around it")
				.isEqualTo(A_LINK);
	}

	@Test
	void aReportThatIsNotThereAtAllIsRefusedHere() {
		assertThatThrownBy(() -> ProofThatTheRunHappened.decide(null))
				.isInstanceOf(NullPointerException.class)
				.hasMessage("report");

		assertThatThrownBy(() -> ProofThatTheRunHappened.linkAsItGoesIn(null))
				.isInstanceOf(NullPointerException.class)
				.hasMessage("report");
	}

	/**
	 * THE RULE IS THE ONE THE PORTAL'S OWN FORMS CARRY, and the forms are read
	 * rather than remembered.
	 *
	 * <p><b>No form is named here.</b> Every definition in the folder is opened and
	 * the ones carrying {@code optionalWhenFilled} or {@code requiredWhenFilled} are
	 * whatever they turn out to be; the day a third form takes this rule on, it
	 * arrives in this map on its own and fails here instead of quietly getting a
	 * rule nothing on the server knows about.
	 *
	 * <p>What is asserted is the SHAPE of the swap: the link is made optional by the
	 * photograph and the comment is made required by it. A form that made the
	 * comment optional, or that hung either leg on a different field, is a form this
	 * class no longer speaks for.
	 *
	 * <p><b>And the two legs are asserted as a PAIR, per form.</b> Gathered across
	 * all the forms at once they would cover for each other: one form losing the leg
	 * that requires a comment would leave the other form's still in the pile and
	 * nothing would go red, while its members were shown a form that lets them send
	 * a wordless photograph the server then refuses. A form carrying one leg carries
	 * both or it is broken.
	 */
	@Test
	void theSwapIsWhatEveryFormThatHasThisRuleSays() {
		Map<String, Map<String, String>> optionalPerForm = new TreeMap<>();
		Map<String, Map<String, String>> requiredPerForm = new TreeMap<>();

		for (Path form : definitions()) {
			String named = form.getFileName().toString();
			Map<String, String> optional = new TreeMap<>();
			Map<String, String> required = new TreeMap<>();

			collect(read(form), optional, required);

			if (!optional.isEmpty() || !required.isEmpty()) {
				optionalPerForm.put(named, optional);
				requiredPerForm.put(named, required);
			}
		}

		assertThat(optionalPerForm)
				.as("no form carries this rule any more, so this compares nothing")
				.isNotEmpty();

		for (String form : optionalPerForm.keySet()) {
			assertThat(optionalPerForm.get(form))
					.as("%s makes something other than the link optional when a photograph is there", form)
					.isEqualTo(Map.of("link", "photo"));
			assertThat(requiredPerForm.get(form))
					.as("%s lets a photograph stand alone, and the server will refuse what it accepts", form)
					.isEqualTo(Map.of("comment", "photo"));
		}
	}

	/** Every form definition there is, asked of the file system rather than listed. */
	private static Set<Path> definitions() {
		try (Stream<Path> there = Files.list(FORMS)) {
			Set<Path> found = there.filter(one -> one.getFileName().toString().endsWith(".form.json"))
					.collect(Collectors.toSet());

			assertThat(found)
					.as("no form definitions were found under %s, so nothing was read", FORMS)
					.isNotEmpty();

			return found;
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	private static JsonNode read(Path form) {
		try {
			return new ObjectMapper().readTree(Files.readString(form, StandardCharsets.UTF_8));
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	/** Walks a definition and notes every field one other field makes optional or required. */
	private static void collect(JsonNode node, Map<String, String> optional, Map<String, String> required) {
		if (node.isObject()) {
			String named = node.path("name").asString("");

			if (!named.isEmpty()) {
				noteIf(node, "optionalWhenFilled", named, optional);
				noteIf(node, "requiredWhenFilled", named, required);
			}

			node.propertyStream().forEach(one -> collect(one.getValue(), optional, required));
		} else if (node.isArray()) {
			node.valueStream().forEach(one -> collect(one, optional, required));
		}
	}

	private static void noteIf(JsonNode node, String rule, String named, Map<String, String> into) {
		JsonNode saying = node.path(rule);

		if (!saying.isMissingNode()) {
			into.put(named, saying.path("field").asString(""));
		}
	}
}
