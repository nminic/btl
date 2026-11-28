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
	 * A LINK ON ITS OWN IS ENOUGH, A PHOTOGRAPH WITH A WORD IS ENOUGH, AND SO IS A WORD ON ITS OWN.
	 *
	 * <p>The three ways through, written beside each other because the rule is that
	 * the legs swap: none of them needs another. The third is the owner's of
	 * 09.10.2026, „tekst sam je dovoljan dokaz i bez slike", put into force on
	 * 28.11.2026; until then this class called a comment with no link and no
	 * photograph nothing at all.
	 */
	@Test
	void anyOfTheThreeWillDo() {
		assertThat(ProofThatTheRunHappened.decide(new Report(A_LINK, false, "")))
				.as("a link on its own was refused")
				.isEqualTo(Outcome.GOOD);

		assertThat(ProofThatTheRunHappened.decide(new Report("", true, "trcao sam sa Markom")))
				.as("a photograph with a word about it was refused")
				.isEqualTo(Outcome.GOOD);

		assertThat(ProofThatTheRunHappened.decide(new Report("", false, "sat je stao na 12. km")))
				.as("a word on its own was refused")
				.isEqualTo(Outcome.GOOD);

		assertThat(ProofThatTheRunHappened.decide(new Report(null, false, "sat je stao na 12. km")))
				.as("a word on its own, with the link not sent at all, was refused")
				.isEqualTo(Outcome.GOOD);
	}

	/**
	 * AND NONE OF THE THREE IS NOTHING.
	 *
	 * <p>Blank and absent are one case and both are here, for the link and for the
	 * word, because a form posts an empty string where a script posts nothing, and a
	 * rule written against one of them lets the other through to a table that takes
	 * anything but null. <b>Blanks of every kind a person can type</b> are the
	 * comment's own axis: a comment of spaces is the nothing it is on the form.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"", "   ", "\t\n", "\u2009", "\u3000"})
	void withNoLinkAndNoPhotographAndNoWordThereIsNothingToLookAt(String nothing) {
		assertThat(ProofThatTheRunHappened.decide(new Report(nothing, false, nothing)))
				.as("a report showing nothing at all was accepted")
				.isEqualTo(Outcome.NOTHING_SHOWS_IT_HAPPENED);

		assertThat(ProofThatTheRunHappened.decide(new Report(null, false, nothing)))
				.isEqualTo(Outcome.NOTHING_SHOWS_IT_HAPPENED);

		assertThat(ProofThatTheRunHappened.decide(new Report(nothing, false, null)))
				.isEqualTo(Outcome.NOTHING_SHOWS_IT_HAPPENED);
	}

	/**
	 * A COMMENT IS NOTHING EXACTLY WHERE THE FORM SAYS IT IS NOTHING (review of PR 847): the form asks it of
	 * {@code value.trim()}, which takes off the no-break spaces (U+00A0, U+2007, U+202F) and the byte order mark
	 * (U+FEFF) that Java's {@code isBlank} leaves, and leaves the four separators U+001C to U+001F that
	 * {@code isBlank} takes. Asked of the comment alone and with a picture beside it, the two places the rule asks
	 * it; a word with one of them beside it is still a word.
	 */
	@ParameterizedTest
	@ValueSource(strings = {"\u00A0", "\u2007", "\u202F", "\uFEFF", "\u00A0\uFEFF \t\u2028\u3000"})
	void aCommentOfWhatTheFormTrimsIsNoWordWhateverTheLanguageSaysIsBlank(String nothing) {
		assertThat(ProofThatTheRunHappened.decide(new Report("", false, nothing)))
				.as("a comment the form calls empty was a proof of a run")
				.isEqualTo(Outcome.NOTHING_SHOWS_IT_HAPPENED);
		assertThat(ProofThatTheRunHappened.decide(new Report("", true, nothing)))
				.as("a comment the form calls empty stood beside a picture")
				.isEqualTo(Outcome.A_PHOTOGRAPH_NEVER_STANDS_ALONE);
		assertThat(ProofThatTheRunHappened.decide(new Report("", false, nothing + "Sat" + nothing)))
				.isEqualTo(Outcome.GOOD);
	}

	/** And a control character the form does NOT trim is a word to the form, so it is one here, on both sides of
	 *  the range the form trims (U+0009 to U+000D). */
	@ParameterizedTest
	@ValueSource(strings = {"\u001F", "\u0001", "\u0008", "\u000E"})
	void aControlCharacterTheFormKeepsIsAWord(String word) {
		assertThat(ProofThatTheRunHappened.decide(new Report("", false, word)))
				.isEqualTo(Outcome.GOOD);
	}

	/**
	 * A WORD NEVER EXCUSES A LINK THAT IS NOT AN ADDRESS, and the word is not what is judged for it.
	 *
	 * <p>The shape is judged first, so a member who typed `pogledaj kod mene` in the link box and
	 * a good sentence in the comment is told his link is not one, instead of having it thrown out
	 * by the table as a server fault.
	 */
	@Test
	void aWordDoesNotMakeAnAddressOutOfWhatIsNotOne() {
		assertThat(ProofThatTheRunHappened.decide(new Report("pogledaj kod mene", false, "sat je stao")))
				.isEqualTo(Outcome.A_LINK_THAT_IS_NOT_A_LINK);
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

	/**
	 * AND A SPACE IS A SPACE WHATEVER KIND IT IS.
	 *
	 * <p>U+2009 is a thin space, and it is here rather than an ordinary one because
	 * an ordinary one is cut by anything. {@code String.trim} stops at U+0020 and
	 * would leave this one on the end, and the member would be told his address is
	 * not an address over a character he cannot see. Word processors and mail
	 * clients put these in; somebody copying a link out of one brings it along.
	 */
	@Test
	void aSpaceNobodyCanSeeIsStillASpace() {
		/* Written as an escape on purpose: a thin space typed into the source looks
		   exactly like an ordinary one, and the next reader would not know which this
		   case is about. */
		Report pasted = new Report(A_LINK + "\u2009", false, "");

		assertThat(ProofThatTheRunHappened.decide(pasted))
				.as("a link pasted with a thin space on the end was called not an address")
				.isEqualTo(Outcome.GOOD);
		assertThat(ProofThatTheRunHappened.linkAsItGoesIn(pasted))
				.as("the thin space was stored, and the table will not hold it")
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

	/**
	 * WORDS ALONE LET THE LINK GO ON EVERY FORM THAT HAS THIS RULE, which is the half of the rule the
	 * swap above does not hold, and it is held for the same reason: the forms are read and not
	 * remembered.
	 *
	 * <p>The server takes a comment with no link and no photograph (owner, 09.10.2026, put into
	 * force 28.11.2026), so a form that went on asking for the link of somebody who has written
	 * words would refuse in front of the member what the server takes. Per form, and by the field the
	 * photograph rule makes optional: that field's rule names the comment as its second answer, and the
	 * comment is not itself made required by anything but the photograph.
	 */
	@Test
	void everyFormThatHasTheSwapLetsTheLinkGoForTheComment() {
		int checked = 0;

		for (Path form : definitions()) {
			String named = form.getFileName().toString();
			JsonNode written = read(form);
			Map<String, String> optional = new TreeMap<>();

			collect(written, optional, new TreeMap<>());

			for (String field : optional.keySet()) {
				fields(written, one -> {
					if (field.equals(one.path("name").asString(""))) {
						assertThat(one.path("optionalWhenFilled").path("orField").asString(""))
								.as("%s asks for %s of somebody who wrote words and no link, and the server takes them",
										named, field)
								.isEqualTo("comment");
					}
					if ("comment".equals(one.path("name").asString(""))) {
						assertThat(one.path("required").asBoolean(false))
								.as("%s asks for the comment of everybody, which is not the rule", named)
								.isFalse();
					}
				});
				checked++;
			}
		}

		assertThat(checked).as("no form carries the rule, so nothing was compared").isPositive();
	}

	/**
	 * Every form definition there is, asked of the file system rather than listed.
	 *
	 * <p>{@code walk} and not {@code list}: {@code list} reads the folder and stops,
	 * so a definition put in a folder under it would carry this rule with nothing on
	 * the server knowing. Every form today sits flat in the folder and this changes
	 * nothing about them; it is here so that the day one does not, the sweep is
	 * still a sweep.
	 */
	private static Set<Path> definitions() {
		try (Stream<Path> there = Files.walk(FORMS)) {
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
	/**
	 * The rules a form hangs on a PHOTOGRAPH, which is what „this rule" is.
	 *
	 * <p><b>Asked of the field the rule names, and not of the rule's name alone, since 20.11.2026.</b> The
	 * registration then took {@code requiredWhenFilled} for a rule of its own: the telephone is required by the
	 * box for the community on Viber (owner, PDL P36), which is a tick and not a photograph and says nothing
	 * about a run. A leg of the swap hung on a field that is not a photograph drops out here, and the other leg
	 * left alone in the same form is what fails the pair above.
	 */
	private static void collect(JsonNode form, Map<String, String> optional, Map<String, String> required) {
		Set<String> photographs = new java.util.HashSet<>();

		fields(form, field -> {
			if ("photo".equals(field.path("type").asString(""))) {
				photographs.add(field.path("name").asString(""));
			}
		});
		fields(form, field -> {
			noteIf(field, "optionalWhenFilled", photographs, optional);
			noteIf(field, "requiredWhenFilled", photographs, required);
		});
	}

	private static void fields(JsonNode node, java.util.function.Consumer<JsonNode> each) {
		if (node.isObject()) {
			if (!node.path("name").asString("").isEmpty()) {
				each.accept(node);
			}

			node.propertyStream().forEach(one -> fields(one.getValue(), each));
		} else if (node.isArray()) {
			node.valueStream().forEach(one -> fields(one, each));
		}
	}

	private static void noteIf(JsonNode node, String rule, Set<String> photographs, Map<String, String> into) {
		String by = node.path(rule).path("field").asString("");

		if (photographs.contains(by)) {
			into.put(node.path("name").asString(""), by);
		}
	}
}
