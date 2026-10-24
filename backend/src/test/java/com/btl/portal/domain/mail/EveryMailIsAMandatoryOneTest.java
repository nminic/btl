package com.btl.portal.domain.mail;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
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
 * asked, by reflection, for the dictionaries it loads ({@code words}, one per language); and
 * each dictionary is
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
	private static final Map<String, String> MANDATORY = Map.ofEntries(
			Map.entry("confirmTheAddress", "creating an account and confirming the address"),
			Map.entry("invitedAsAMember", "creating an account: the administration opens it and he takes it over"),
			Map.entry("invitedAsAModerator", "creating an account: the same road, for somebody who moderates"),
			Map.entry("setANewPassword", "changing the password, from the screen that says it is forgotten"),
			Map.entry("thePasswordHasChanged", "changing the password, telling him it happened"),
			/* WORDS, AND SINCE 09.10.2026 NO LETTER. A run sent in is told in the member's inbox and
			   nowhere else (PDL P9, 09.10.2026, „Pri slanju rezultata član dobija samo red u
			   sandučetu"), so these words stay in the dictionary for that line and no mail carries
			   them; the mail „unet rezultat" is `resultApproved` below. This file reads words and not
			   channels, so it cannot see the difference - the case that does is
			   `ResultWriteApiTest.sendingOneInWritesTheLineInHisInboxAndPostsNoLetter`. */
			Map.entry("resultEntered", "a result entered: the line in his inbox when he sends it, and since 09.10.2026 no letter"),
			/* Not on the list of mandatory mails by that name, and named by the owner all the same.
			   PDL P22, an [ODLUKA] in the section that lists them: „Član dobija mejl kad mu je
			   rezultat odobren." And the decision of 28.09.2026 that took the notification screen
			   away whole records the key `resultApproved`, „Kad mi rezultat bude odobren", as
			   „obavezan mejl", one of the two switches that screen offered over „dva od šest
			   obaveznih". Which one of the list it is, the record now says by a derivation of
			   03.10.2026 rather than in the owner's words: „Mejl o odobrenom rezultatu je mejl
			   „unet rezultat" iz spiska". */
			Map.entry("resultApproved", "a result approved: the mandatory mail about a result entered, named by PDL P22 and by the decision of 28.09.2026"),
			Map.entry("resultChanged", "a result changed"),
			Map.entry("resultDeleted", "a result changed: deleting is the cheapest way to change one without a trace"),
			/* THE LEAGUE ENTERS, CHANGES AND DELETES FROM THE EVENT PAGE (PDL P9, 18.10.2026: „Za novi
			   unos član dobija istu poruku kao kad mu moderator odobri rezultat, u sanduče i mejlom;
			   izmena i brisanje rade po P22"). The first is the mandatory „unet rezultat" for a
			   run no season counts, and the change is „promenjen rezultat" made by the league. */
			Map.entry("resultEnteredBeforeTheLeague", "a result entered by the league for a race run before 2027: the mail about a result entered"),
			Map.entry("resultChangedByTheLeague", "a result changed, by the league from the event page"),
			/* THE SENTENCE OF A FROZEN SEASON (PDL P9, 18.10.2026: „Rezultat u ZAMRZNUTOJ sezoni dobija
			   posebnu rečenicu, i kad ga liga unese i kad ga moderator odobri posle zamrzavanja"). The
			   first is the mail about a result entered, the second the mail about a result approved,
			   each for a season whose table no longer moves. */
			Map.entry("resultEnteredInAFrozenSeason", "a result entered by the league in a season that has frozen: the mail about a result entered"),
			Map.entry("resultApprovedInAFrozenSeason", "a result approved after its season froze: the mail about a result approved"),
			/* THE LETTER AFTER A CONFIRMED ADDRESS, six words for one occasion. Named by the owner
			   himself and not on the list P22 keeps: PDL, 23.10.2026, once the address is confirmed the
			   portal writes to the member about his membership, with B, C, D and E that day and F and G on 24.10.2026. Each
			   is a key of its own because each is a different letter; exactly one of them goes, once. */
			Map.entry("welcomeWithASlip", "the letter after a confirmed address: from Serbia, the slip and the code (PDL 23.10.2026, B)"),
			Map.entry("welcomeWithPayPal", "the letter after a confirmed address: from abroad, PayPal (PDL 23.10.2026, C)"),
			Map.entry("welcomeFreedOfTheFee", "the letter after a confirmed address: freed of the fee (PDL 23.10.2026, D)"),
			Map.entry("welcomePaidFromTheBalance", "the letter after a confirmed address: paid from the balance (PDL 23.10.2026, E)"),
			Map.entry("welcomePaid", "the letter after a confirmed address: paid before he confirmed (PDL 24.10.2026, F)"),
			Map.entry("welcomeTheBalanceCovers", "the letter after a confirmed address: the balance covers the fee (PDL 24.10.2026, G)"));

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
		List<ResourceBundle> bundles = dictionariesTheMailClassesLoad();

		assertThat(bundles)
				.as("the walk over domain/mail found fewer dictionaries than the portal has, so the"
						+ " line beside this one is comparing two empty sets and measures nothing")
				.hasSizeGreaterThanOrEqualTo(3 * MailLanguage.values().length);

		assertThat(occasionsThePortalHasWordsFor())
				.as("dictionaries were found but no occasion was read out of them, so the keys are"
						+ " not shaped the way this file reads them")
				.isNotEmpty();
	}

	/**
	 * Every occasion key in every dictionary the mail classes load, in every language.
	 *
	 * <p>A key is {@code <occasion>.subject} or {@code <occasion>.body}, so the occasion is
	 * what stands before the first dot. Read off the bundle rather than off the file, so a
	 * dictionary that moves or is renamed is still the one this reads.
	 */
	private static Set<String> occasionsThePortalHasWordsFor() {
		Set<String> occasions = new TreeSet<>();

		for (ResourceBundle bundle : dictionariesTheMailClassesLoad()) {
			for (String key : bundle.keySet()) {
				int dot = key.indexOf('.');

				occasions.add(dot < 0 ? key : key.substring(0, dot));
			}
		}

		return occasions;
	}

	/**
	 * The dictionaries each class in {@code domain/mail} loads, one per language, asked of the
	 * class itself.
	 *
	 * <p>The classes are found by walking the package's own source directory, and each is asked
	 * through its own {@code words(MailLanguage)} for the bundle it reads in every language the
	 * portal writes in, rather than the names being written out again here. Since the mail follows
	 * its reader's language (V59) a class reads one dictionary per language, so it is asked for
	 * each; a class that loads no dictionary has no such method and contributes nothing, which is
	 * how a helper beside these three stays out of the way without being excluded by name.
	 */
	private static List<ResourceBundle> dictionariesTheMailClassesLoad() {
		Path sources = repositoryRoot().resolve("backend/src/main/java/com/btl/portal/domain/mail");

		try (Stream<Path> tree = Files.list(sources)) {
			return tree
					.map(path -> path.getFileName().toString())
					.filter(name -> name.endsWith(".java"))
					.sorted()
					.map(name -> name.substring(0, name.length() - ".java".length()))
					.flatMap(name -> wordsOf(name).stream())
					.toList();
		} catch (IOException cannot) {
			throw new UncheckedIOException(cannot);
		}
	}

	/** The dictionaries one class reads, one per language, or none if it reads none. */
	private static List<ResourceBundle> wordsOf(String simpleName) {
		try {
			Method words = Class.forName("com.btl.portal.domain.mail." + simpleName)
					.getDeclaredMethod("words", MailLanguage.class);

			words.setAccessible(true);

			List<ResourceBundle> read = new ArrayList<>();

			for (MailLanguage in : MailLanguage.values()) {
				read.add((ResourceBundle) words.invoke(null, in));
			}

			return read;
		} catch (ClassNotFoundException | NoSuchMethodException noDictionary) {
			return List.of();
		} catch (IllegalAccessException | InvocationTargetException cannot) {
			throw new IllegalStateException(simpleName + " could not be asked for its words", cannot);
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
