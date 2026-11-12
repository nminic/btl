package com.btl.portal.db;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * WHAT V95 DOES TO THE TEXT OF THE WRITTEN PAGES THAT IS ALREADY THERE, against a real database.
 *
 * <p><b>Why this exists, and it is the shape of {@link TheTrophiesAreHandedOutAtTheCocktailSessionCarriedOverTest}
 * for the same reason.</b> V95 adds no column and no constraint, so every other case in this suite starts from a database
 * it has just built. The rows that could break it are rows that stood BEFORE it: the eight sentences and the sign-offs as V24 to V94 left them.
 *
 * <p><b>What the owner decided (PDL, "Ton ekrana bez objašnjavanja posledica", 10.11.2026):</b> eight sentences of the
 * policy, the terms, the rulebook and the president's word say the fact and not its consequence, in the owner's own
 * words, letter for letter; the English follows the new Serbian by meaning (owner, 11.11.2026), so an English sentence
 * moves only where a Serbian one does; the sign-offs of the three pages whose words change (the policy, the terms and the rulebook) move to the
 * day, in both languages, and the president's word has none.
 *
 * <p><b>What the whole-text case holds, and why it is the guard the English needed.</b> A case that asks "is the new
 * sentence there and the old one gone" cannot see a migration that changes one sentence MORE than it should, in either
 * language: the English "nothing else" had no guard in the migration before this one. So the case reads every body of
 * every page in both languages before the migration, applies to each exactly the replacements THIS FILE lists (written
 * out here, in the test, and not read back out of V95), and compares the result to what the migration left, row by
 * row. An extra edit, a missing edit, an edit in the other language, or an edit that took more than its own sentence
 * is a row that differs.
 *
 * <p><b>How it is made.</b> The sentences are put back by the reverse of V95's own edits, read out of V95
 * ({@link TheWrittenPagesBeforeV71#undoBodyEdits}), each case first asserting that the OLD text is what it just
 * wrote. Then THE MIGRATION ITSELF is executed, the file Flyway resolved, inside the test's transaction.
 */
class TheWrittenPagesStateTheFactCarriedOverTest extends DatabaseTest {

	@Autowired
	JdbcTemplate jdbc;

	/** One replacement: where the text stands, in which language, and what it is before and after. */
	private record Replacement(String slug, int position, String language, String before, String after) {
	}

	/**
	 * Every replacement V95 makes, written out here. The three removals carry the words next to them that the removal
	 * leaves standing, the way V95's own edits do.
	 */
	private static final List<Replacement> EVERY_REPLACEMENT = List.of(
			new Replacement("politika-privatnosti", 4, "sr",
					"Postavlja se tek kad temu sami izaberete, ostaje u vašem pregledaču i nikada ne stiže do nas:"
							+ " ne šalje se ni sa jednim zahtevom, pa ga naš server ne vidi. Čita ga samo sama"
							+ " strana, u vašem pregledaču, da bi znala u kojoj temi da se iscrta.",
					"Postavlja se tek kad temu sami izaberete."),
			new Replacement("politika-privatnosti", 4, "sr",
					"Drugog skladišta nema. Nema analitike, ni naše ni tuđe, pa nema ni trake za pristanak.",
					"Drugog skladišta, niti analitike, nema."),
			new Replacement("politika-privatnosti", 3, "sr",
					"To je suština usluge koju vam pružamo i na to pristajete učlanjenjem.",
					"Na to pristajete učlanjenjem."),
			new Replacement("uslovi-koriscenja", 4, "sr",
					"1. Popunite formu. Uz svako polje koje ima pravilo stoji objašnjenje tog pravila.",
					"1. Popunite formu."),
			new Replacement("pravilnik", 9, "sr",
					"Dužinu, uspon i spust upisujete sami, jer portal ne učitava zapis staze sa sata.",
					"Dužinu, uspon i spust upisujete sami."),
			new Replacement("pravilnik", 13, "sr",
					"prati se ukupna kilometraža i ukupno vreme. Posebnog prikaza za višestruke polumaratone i"
							+ " maratone nema.",
					"prati se ukupna kilometraža i ukupno vreme."),
			new Replacement("pravilnik", 14, "sr",
					"Poštanske troškove slanja majice i medalje snosi član.\n\nLičnu predaju uvek možete dogovoriti,"
							+ " i kasnije.",
					"Poštanske troškove slanja majice i medalje snosi član."),
			new Replacement("rec-predsednika", 1, "sr",
					"za dodatne informacije nas slobodno kontaktirajte na zvaničnu adresu",
					"za dodatne informacije pišite nam na"),
			new Replacement("politika-privatnosti", 4, "en",
					"It is set only once you choose a theme yourself, stays in your browser, and never reaches us: it is not"
							+ " sent with any request, so our server never sees it. Only the page itself reads it, in your"
							+ " browser, to know which theme to render in.",
					"It is set only once you choose a theme yourself."),
			new Replacement("politika-privatnosti", 4, "en",
					"There is no other storage. There is no analytics, ours or anyone else's, so there is no consent banner"
							+ " either.",
					"There is no other storage, nor analytics."),
			new Replacement("politika-privatnosti", 3, "en",
					"That is the substance of the service we provide you, and you agree to it by joining.",
					"You agree to it by joining."),
			new Replacement("uslovi-koriscenja", 4, "en",
					"1. Fill in the form. Every field that has a rule carries an explanation of that rule.",
					"1. Fill in the form."),
			new Replacement("pravilnik", 9, "en",
					"You enter the length, ascent, and descent yourself, because the portal does not read a course"
							+ " recording from a watch.",
					"You enter the length, ascent, and descent yourself."),
			new Replacement("pravilnik", 13, "en",
					"total distance and total time are tracked. There is no special display for multiple half marathons or"
							+ " marathons.",
					"total distance and total time are tracked."),
			new Replacement("pravilnik", 14, "en",
					"Postal costs for sending the T-shirt and the medal are borne by the member.\n\nYou can always arrange an"
							+ " in-person handover, even later.",
					"Postal costs for sending the T-shirt and the medal are borne by the member."),
			new Replacement("rec-predsednika", 1, "en",
					"for any further information feel free to contact us at our official address",
					"for any further information write to us at"),
			new Replacement("politika-privatnosti", 7, "sr",
					"Poslednja izmena: 08.11.2026.", "Poslednja izmena: 11.11.2026."),
			new Replacement("politika-privatnosti", 7, "en",
					"Last amended: 08.11.2026.", "Last amended: 11.11.2026."),
			new Replacement("uslovi-koriscenja", 11, "sr",
					"Poslednja izmena: 29.10.2026.", "Poslednja izmena: 11.11.2026."),
			new Replacement("uslovi-koriscenja", 11, "en",
					"Last amended: 29.10.2026.", "Last amended: 11.11.2026."),
			new Replacement("pravilnik", 19, "sr",
					"Poslednja izmena: 10.11.2026.", "Poslednja izmena: 11.11.2026."),
			new Replacement("pravilnik", 19, "en",
					"Last amended: 10.11.2026.", "Last amended: 11.11.2026."));

	@BeforeEach
	void theTextAsV24ToV94LeftIt() {
		TheWrittenPagesBeforeV71.undoBodyEdits(db, "95");
	}

	private void theMigration() {
		jdbc.execute(migrationSql("95"));
	}

	/** Every body of every page in both languages, keyed by where it stands, in the order the keys come. */
	private Map<String, String> everyBodyByPlace() {
		Map<String, String> bodies = new LinkedHashMap<>();

		db.sql("select p.slug || '#' || s.position || '#sr' as place, s.body"
						+ " from static_page_section s join static_page p on p.id = s.page_id"
						+ " union all"
						+ " select p.slug || '#' || s.position || '#' || t.language, t.body"
						+ " from static_page_section_translation t"
						+ " join static_page_section s on s.id = t.section_id"
						+ " join static_page p on p.id = s.page_id"
						+ " order by 1")
				.query((row, n) -> {
					bodies.put(row.getString(1), row.getString(2));
					return n;
				}).list();

		return bodies;
	}

	private static String place(Replacement one) {
		return one.slug() + "#" + one.position() + "#" + one.language();
	}

	private String everyBody() {
		return db.sql("select (select string_agg(body, '|' order by id) from static_page_section)"
						+ " || (select string_agg(body, '|' order by id) from static_page_section_translation)")
				.query(String.class).single();
	}

	/** The text of the day before the migration, with each replacement of this file applied to the row it names. */
	private Map<String, String> whatTheMigrationMustLeave(Map<String, String> before) {
		Map<String, String> expected = new LinkedHashMap<>(before);

		for (Replacement one : EVERY_REPLACEMENT) {
			String body = expected.get(place(one));

			assertThat(body).as("there is no text at %s", place(one)).isNotNull();
			assertThat(body)
					.as("the fixture did not put the old text back at %s, so the migration has nothing to change"
							+ " there and this case measures nothing", place(one))
					.containsOnlyOnce(one.before());
			expected.put(place(one), body.replace(one.before(), one.after()));
		}

		return expected;
	}

	@Test
	void everyPageIsLeftExactlyAsTheTwentyTwoReplacementsLeaveItInBothLanguages() {
		Map<String, String> before = everyBodyByPlace();
		Map<String, String> expected = whatTheMigrationMustLeave(before);

		assertThat(expected).as("the replacements changed nothing").isNotEqualTo(before);

		theMigration();

		Map<String, String> after = everyBodyByPlace();

		assertThat(after.keySet()).as("a text was added or removed").isEqualTo(before.keySet());

		List<String> differing = new ArrayList<>();

		for (String where : before.keySet()) {
			if (!after.get(where).equals(expected.get(where))) {
				differing.add(where);
			}
		}

		assertThat(differing)
				.as("these texts are not what the replacements of this file make of them: the migration changed"
						+ " more than its own sentences, or less, or in the other language")
				.isEmpty();
	}

	@Test
	void everyOldTextIsGoneAndEveryNewTextStandsOnceWhereItWasAsked() {
		for (Replacement one : EVERY_REPLACEMENT) {
			assertThat(everyBodyByPlace().get(place(one)))
					.as("the fixture did not put the old text back at %s", place(one))
					.containsOnlyOnce(one.before());

			if (!one.before().contains(one.after())) {
				/* A removal keeps the words next to the sentence, which are in both texts, so only a
				   replacement can be asked to be absent before the migration. */
				assertThat(everyBodyByPlace().get(place(one)))
						.as("the new text already stands at %s", place(one))
						.doesNotContain(one.after());
			}
		}

		theMigration();

		Map<String, String> after = everyBodyByPlace();

		for (Replacement one : EVERY_REPLACEMENT) {
			assertThat(after.get(place(one)))
					.as("the old text was left at %s", place(one))
					.doesNotContain(one.before());
			assertThat(after.get(place(one)))
					.as("the new text does not stand once at %s", place(one))
					.containsOnlyOnce(one.after());
		}
	}

	@Test
	void theEnglishMovesWhereTheSerbianDoesAndNowhereElse() {
		Map<String, String> before = everyBodyByPlace();

		theMigration();

		Map<String, String> after = everyBodyByPlace();
		List<String> movedInEnglish = new ArrayList<>();

		for (String where : before.keySet()) {
			if (where.endsWith("#en") && !after.get(where).equals(before.get(where))) {
				movedInEnglish.add(where);
			}
		}

		assertThat(movedInEnglish)
				.as("the English follows the Serbian by meaning (owner, 11.11.2026), section by section, and moves nowhere"
						+ " else")
				.containsExactlyInAnyOrder("politika-privatnosti#3#en", "politika-privatnosti#4#en",
						"politika-privatnosti#7#en", "uslovi-koriscenja#4#en", "uslovi-koriscenja#11#en",
						"pravilnik#9#en", "pravilnik#13#en", "pravilnik#14#en", "pravilnik#19#en", "rec-predsednika#1#en");
	}

	@Test
	void everyPageWhoseWordsChangeMovesItsSignOffToTheDayAndThePresidentsWordHasNone() {
		Map<String, String> before = everyBodyByPlace();

		assertThat(before.get("pravilnik#19#sr")).contains("Poslednja izmena: 10.11.2026.");
		assertThat(before.get("pravilnik#19#en")).contains("Last amended: 10.11.2026.");

		theMigration();

		Map<String, String> after = everyBodyByPlace();

		for (String where : List.of("pravilnik#19", "politika-privatnosti#7", "uslovi-koriscenja#11")) {
			assertThat(after.get(where + "#sr")).as("the Serbian sign-off at %s", where)
					.contains("Poslednja izmena: 11.11.2026.");
			assertThat(after.get(where + "#en")).as("the English sign-off at %s", where)
					.contains("Last amended: 11.11.2026.");
		}

		assertThat(after.get("rec-predsednika#1#sr")).as("the president's word carries no sign-off")
				.doesNotContain("Poslednja izmena");

		for (String earlier : List.of("08.11.2026", "29.10.2026", "10.11.2026")) {
			assertThat(everyBody())
					.as("the day %s still stands as a sign-off somewhere", earlier)
					.doesNotContain("Poslednja izmena: " + earlier)
					.doesNotContain("Last amended: " + earlier);
		}
	}

	@Test
	void textThatDoesNotHoldTheOldSentencesStopsTheMigrationAndChangesNothing() {
		jdbc.execute("update static_page_section s set body = replace(s.body, 'Drugog skladišta nema.',"
				+ " 'Nesto drugo.') from static_page p where p.id = s.page_id and p.slug = 'politika-privatnosti'"
				+ " and s.position = 4");
		String changed = everyBody();

		jdbc.execute("savepoint before_the_refusal");
		assertThatThrownBy(this::theMigration)
				.hasMessageContaining("the written pages were not edited")
				.hasMessageContaining("1 of 22 edits");
		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(everyBody()).as("a refused migration changed a page").isEqualTo(changed);
	}

	@Test
	void aSerbianSectionThatAlreadyHoldsTheNewSentenceStopsTheMigrationAndChangesNothing() {
		/* The old sentence stands once, as it must, and the new one stands beside it. Each edit is asked about the new
		   text too, so this is refused although the old text was found exactly once. */
		jdbc.execute("update static_page_section s set body = s.body || E'\\n\\nNa to pristajete učlanjenjem.'"
				+ " from static_page p where p.id = s.page_id and p.slug = 'politika-privatnosti' and s.position = 3");
		String before = everyBody();

		jdbc.execute("savepoint before_the_refusal");
		assertThatThrownBy(this::theMigration)
				.hasMessageContaining("the written pages were not edited")
				.hasMessageContaining("found once, and its new text is already there");
		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(everyBody()).as("a refused migration changed a page").isEqualTo(before);
	}

	@Test
	void anEnglishSectionThatAlreadyHoldsTheNewSignOffStopsTheMigrationAndChangesNothing() {
		jdbc.execute("update static_page_section_translation t set body = t.body || E'\\n\\nLast amended: 11.11.2026.'"
				+ " from static_page_section s, static_page p where s.id = t.section_id and p.id = s.page_id"
				+ " and p.slug = 'uslovi-koriscenja' and s.position = 11 and t.language = 'en'");
		String before = everyBody();

		jdbc.execute("savepoint before_the_refusal");
		assertThatThrownBy(this::theMigration)
				.hasMessageContaining("the written pages were not edited")
				.hasMessageContaining("uslovi-koriscenja #11 en: found once, and its new text is already there");
		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(everyBody()).as("a refused migration changed a page").isEqualTo(before);
	}

	@Test
	void anOldTextThatStandsTwiceStopsTheMigrationAndChangesNothing() {
		jdbc.execute("update static_page_section s set body = s.body || E'\\n\\nTo je suština usluge koju vam pružamo"
				+ " i na to pristajete učlanjenjem.' from static_page p where p.id = s.page_id"
				+ " and p.slug = 'politika-privatnosti' and s.position = 3");
		String before = everyBody();

		jdbc.execute("savepoint before_the_refusal");
		assertThatThrownBy(this::theMigration)
				.hasMessageContaining("the written pages were not edited")
				.hasMessageContaining("politika-privatnosti #3 sr: found 2 times");
		jdbc.execute("rollback to savepoint before_the_refusal");

		assertThat(everyBody()).as("a refused migration changed a page").isEqualTo(before);
	}
}
