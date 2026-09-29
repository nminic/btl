package com.btl.portal.domain.mail;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.ResourceBundle;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE PORTAL CAN SEND A MAIL FOR A MANDATORY OCCASION AND FOR NOTHING ELSE.
 *
 * <p><b>The decision this stands under.</b> The owner, 29.09.2026 (PDL, „Drustvena
 * obavestenja idu SAMO u sanduce portala, mejla nema"): „Ako su ovo prekidaci, ja bih da se
 * u potpunosti za njih izbace mailovi i da funkcionise samo kao poruke u inbox portala." The
 * six social notices - a comment, a team invitation, a pair request, an offer of a lift, a
 * ducat won, a message in the inbox - ring the bell and travel no other road. He chose that
 * with <b>no exception</b> for the two that carry a deadline, the team invitation and the
 * pair request, with the price in front of him: a member who does not sign in can let one
 * run out without being told.
 *
 * <p><b>Why a guard at all, when V48 already dropped the switches.</b> Dropping
 * {@code notification_setting} removes the SWITCH. It does not remove the possibility of a
 * mail: a mail nobody can switch off is still a mail, and the shortest road back to the
 * thing the owner refused is somebody adding one and never thinking about the switch at all.
 * {@code ConventionsTest} already fails the day that table returns, in both directions, so
 * this file deliberately says nothing about the schema. It asks the other question.
 *
 * <p><b>WHAT IS ASSERTED IS A PROPERTY, NOT A LIST: every occasion the portal has words for
 * is one of the mandatory six.</b> The table below is written by hand, and it is the sort of
 * hand-written table this portal allows, because it carries what cannot be derived - WHICH
 * mandatory mail each occasion serves, and the owner's sentence that put it there. What it
 * is NOT allowed to be is a list without a floor, so the floor is underneath it and is read
 * rather than remembered.
 *
 * <p><b>THE FLOOR, and it is derived twice over.</b> The classes that turn an occasion into
 * words are found by <b>walking</b> {@code domain/mail} rather than named here; each is
 * asked, by reflection, for the dictionary it loads ({@code WORDS}); and each dictionary is
 * asked for its own keys. So a seventh occasion fails here whichever way it arrives - a new
 * key in a dictionary that already exists, a new dictionary, or a whole new class beside
 * these three. Nothing about it can be forgotten by this file, because this file does not
 * remember anything: it reads the tree, the field and the bundle.
 *
 * <p><b>What a failure here means, said plainly so the next reader does not simply widen the
 * table.</b> A new occasion is either one of the six mandatory mails - in which case it
 * belongs in the table with the sentence of P22 that names it - or it is not, and then it is
 * a mail the owner decided the portal does not send. The second case is a decision to take
 * back to him, not a row to add.
 *
 * <p><b>Where this stops.</b> It reads what the portal has WORDS for. A mail sent with a
 * subject and body built in Java, naming no dictionary key, would not be seen here;
 * {@code PostmanTest} and the route's own cases are where that would show. The boundary is
 * written down rather than left to be discovered, and it is narrow on purpose: every mail
 * this portal sends today is built from one of these bundles, which is the fact that makes
 * the question above answerable off a single read.
 */
class EveryMailIsAMandatoryOneTest {

	/** The bundles are loaded under this locale by every class that loads one. */
	private static final Locale ONE_SET_OF_WORDS = Locale.ROOT;

	/**
	 * Every occasion the portal has words for, and which mandatory mail each one serves.
	 *
	 * <p>PDL P22, 11.08.2026, names the six that are compulsory and unswitchable: „Sest
	 * obaveznih mejlova u prvoj verziji: kreiranje naloga i potvrda mejla, promena lozinke,
	 * UNET REZULTAT, PROMENJEN REZULTAT, dodatni zahtev za verifikaciju, krupna izmena na
	 * portalu", and „Sest mejlova iz spiska su obavezni i clan ih ne moze iskljuciti."
	 *
	 * <p>Two of those six have no occasion here yet - the extra request to check something,
	 * and the large change to the portal. They are absent because they are unbuilt, not
	 * because they are unwanted, and the day either is built it arrives in this table under
	 * its own name rather than as an exception to it.
	 */
	private static final Map<String, String> MANDATORY = Map.of(
			"confirmTheAddress", "creating an account and confirming the address",
			"invitedAsAMember", "creating an account: the administration opens it and he takes it over",
			"invitedAsAModerator", "creating an account: the same road, for somebody who moderates",
			"setANewPassword", "changing the password, from the screen that says it is forgotten",
			"thePasswordHasChanged", "changing the password, telling him it happened",
			"resultEntered", "a result entered",
			/* Not one of the six by name, and named by the owner all the same. PDL P22, an [ODLUKA]
			   in the section that lists the six: „Član dobija mejl kad mu je rezultat odobren." And
			   the decision of 28.09.2026 that took the notification screen away whole records the key
			   `resultApproved`, „Kad mi rezultat bude odobren", as „obavezan mejl", one of the two
			   switches that screen offered over „dva od šest obaveznih". Which of the six it is
			   PDL does not say, so no number is claimed here. */
			"resultApproved", "a result approved: named a mandatory mail by PDL P22 and by the decision of 28.09.2026",
			"resultChanged", "a result changed",
			"resultDeleted", "a result changed: deleting is the cheapest way to change one without a trace");

	@Test
	void thePortalHasWordsForNoOccasionThatIsNotAMandatoryMail() {
		Set<String> occasions = occasionsThePortalHasWordsFor();

		assertThat(occasions)
				.as("the portal can send a mail for an occasion no mandatory mail of P22 names,"
						+ " which is the thing the owner removed on 29.09.2026: the six social notices"
						+ " ring the bell and travel no other road. If this is one of the six"
						+ " mandatory mails, name it in MANDATORY with the sentence that puts it"
						+ " there; if it is not, it is a decision for the owner and not a row here")
				.containsExactlyInAnyOrderElementsOf(MANDATORY.keySet());
	}

	/**
	 * THE FLOOR UNDER THE LINE ABOVE, and it is here because a sweep that finds nothing
	 * would satisfy that line perfectly.
	 *
	 * <p>{@code containsExactlyInAnyOrder} against an empty set passes for an empty set, so
	 * a walk that stopped recognising these classes - a moved package, a renamed field, a
	 * dictionary that failed to load - would report no occasions at all and read as though
	 * the portal sends no mail. Three dictionaries are found today; the assertion is written
	 * as a floor rather than as the number, because a fourth is allowed to arrive and a
	 * second is not.
	 */
	@Test
	void theSweepReadsTheDictionariesRatherThanFindingNone() {
		List<String> bundles = dictionariesTheMailClassesLoad();

		assertThat(bundles)
				.as("the walk over domain/mail found fewer dictionaries than the portal has, so the"
						+ " line beside this one is comparing two empty sets and measures nothing")
				.hasSizeGreaterThanOrEqualTo(3);

		assertThat(occasionsThePortalHasWordsFor())
				.as("dictionaries were found but no occasion was read out of them, so the keys are"
						+ " not shaped the way this file reads them")
				.isNotEmpty();
	}

	/**
	 * Every occasion key in every dictionary the mail classes load.
	 *
	 * <p>A key is {@code <occasion>.subject} or {@code <occasion>.body}, so the occasion is
	 * what stands before the first dot. Read off the bundle rather than off the file, so a
	 * dictionary that moves or is renamed is still the one this reads.
	 */
	private static Set<String> occasionsThePortalHasWordsFor() {
		Set<String> occasions = new TreeSet<>();

		for (String bundle : dictionariesTheMailClassesLoad()) {
			for (String key : ResourceBundle.getBundle(bundle, ONE_SET_OF_WORDS).keySet()) {
				int dot = key.indexOf('.');

				occasions.add(dot < 0 ? key : key.substring(0, dot));
			}
		}

		return occasions;
	}

	/**
	 * The dictionary each class in {@code domain/mail} loads, asked of the class itself.
	 *
	 * <p>The classes are found by walking the package's own source directory, and the name
	 * of the bundle is read off the {@code WORDS} field rather than written out again here.
	 * A class that loads no dictionary simply has no such field and contributes nothing,
	 * which is how a helper beside these three stays out of the way without being excluded
	 * by name.
	 */
	private static List<String> dictionariesTheMailClassesLoad() {
		Path sources = repositoryRoot().resolve("backend/src/main/java/com/btl/portal/domain/mail");

		try (Stream<Path> tree = Files.list(sources)) {
			return tree
					.map(path -> path.getFileName().toString())
					.filter(name -> name.endsWith(".java"))
					.map(name -> name.substring(0, name.length() - ".java".length()))
					.map(EveryMailIsAMandatoryOneTest::wordsOf)
					.filter(words -> words != null)
					.sorted()
					.toList();
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	/** The {@code WORDS} constant of one class, or {@code null} if it holds none. */
	private static String wordsOf(String simpleName) {
		try {
			Field words = Class.forName("com.btl.portal.domain.mail." + simpleName)
					.getDeclaredField("WORDS");

			words.setAccessible(true);

			return (String) words.get(null);
		} catch (ClassNotFoundException | NoSuchFieldException | IllegalAccessException noDictionary) {
			return null;
		}
	}

	/**
	 * The root of the repository, found rather than assumed.
	 *
	 * <p>Surefire runs with {@code backend/} as the working directory and somebody running
	 * one test from an editor may not, so this climbs until it finds the two directories
	 * that make this repository what it is. The same reasoning, and the same shape, as
	 * {@code DatabaseTest.repositoryRoot()}; it is repeated rather than shared because that
	 * one is package private to {@code db} and this file needs no database at all.
	 */
	private static Path repositoryRoot() {
		Path here = Path.of("").toAbsolutePath();

		for (Path candidate = here; candidate != null; candidate = candidate.getParent()) {
			if (Files.isDirectory(candidate.resolve("backend"))
					&& Files.isDirectory(candidate.resolve("frontend"))) {
				return candidate;
			}
		}

		throw new IllegalStateException("no directory above " + here + " holds both backend/ and frontend/");
	}
}
