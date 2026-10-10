package com.btl.portal.db;

import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.Test;
import org.postgresql.util.PSQLException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

/**
 * THE EDITS V57 MAKES TO THE WRITTEN PAGES, HELD ON THE TEXT THE PORTAL SERVES, IN BOTH LANGUAGES.
 *
 * <p><b>Why this exists.</b> V57 edits the three legal documents in thirty-seven places, in Serbian and in English
 * (the owner's decisions of 10.10.2026). {@code PageApiTest} compares the whole Serbian answer to
 * {@code pages.json}, field by field, and that holds the Serbian half. Nothing holds the English half:
 * the fixture is Serbian only, and {@link WrittenPageTranslationAppliesTest} re-runs V43, so it sees the English of
 * 28.09.2026 and nothing a later migration did to it ({@code PageApiTest}'s own header says the same of V44). This
 * file holds both languages, edit by edit, so that restoring an old sentence in ONE language fails in that language
 * by its name.
 *
 * <p><b>The sweeps are over every row, with no {@code where} clause</b>, the shape of
 * {@link RulebookPenaltyIsGoneTest} and {@link TheWrittenPagesOpenOnTheFifteenthTest} and for their reason: what is
 * worth holding is not that one article is right but that NO article carries the old sentence, in whatever section
 * or language it is written next. {@link #EDITS} says what each edit took out and what it put in, as phrases and
 * not as whole texts: the whole texts are V57, and a second copy of a legal text is a place for it to go stale.
 *
 * <p><b>Both lists have a floor, and neither floor is another list.</b>
 * <ul>
 * <li>Every phrase that must be GONE is looked for in the text the migrations before V57 wrote, read out of the
 * files Flyway resolved ({@link #pageTextOfTheMigrationsBeforeThisOne}). A phrase that was never there is
 * decorative, and the sweep that expects it gone would stay green on a text that never said it.</li>
 * <li>The table names exactly the sections V57 edits, and that is asked of V57 itself and not of its text: run
 * again over the finished text, it refuses and says, line by line, which edit it aimed at which section of which
 * page in which language ({@link #theTableNamesExactlyTheSectionsTheMigrationEdits}). A section added to V57 and
 * not to the table, or the other way round, fails there. Reading the list of edits out of the file would be a
 * parser of a shape of text; asking the migration is asking the tool.</li>
 * </ul>
 *
 * <p><b>And the refusal is held.</b> V57 checks that every old text stands exactly once where it is written and
 * stops, with every edit listed, when one does not. Three cases hold that it does: the finished text (every old text
 * missing), a text that stands twice, and a section that is not there. The reason is the one in V57's header: a
 * replace() that matched nothing is a migration Flyway records as done.
 */
class TheWrittenPagesCarryTheEditsOfTheTenthOfOctoberTest extends DatabaseTest {

	/** The migration this file is about. */
	private static final int THE_MIGRATION = 57;

	private static final String POLICY = "politika-privatnosti";
	private static final String TERMS = "uslovi-koriscenja";
	private static final String RULEBOOK = "pravilnik";

	private static final List<String> NOTHING = List.of();

	/**
	 * One edit in one language: what it took out of the section and what it put in.
	 *
	 * @param label    the owner's name for it, which is also the name V57 gives it
	 * @param slug     the page the section belongs to
	 * @param position the section's place in the page
	 * @param language {@code sr} for the text in {@code static_page_section}, otherwise the translation's language
	 * @param gone     phrases the old text had and no section of any page may carry any more
	 * @param stands   phrases the new text has, each of which stands exactly once in the section it was written for
	 */
	record Edit(String label, String slug, int position, String language, List<String> gone, List<String> stands) {

		String where() {
			return slug + " #" + position + " " + language;
		}
	}

	/**
	 * One entry per edit and language, written by hand. What keeps it honest is the two floors in the class header,
	 * and not whoever wrote it: a phrase that was never in the old text, and a section V57 does not edit, both fail.
	 */
	private static final List<Edit> EDITS = List.of(
			new Edit("A", POLICY, 2, "sr",
					List.of("Lista rođendana"),
					List.of("Prikaz na vašem profilu")),
			new Edit("A", POLICY, 2, "en",
					List.of("Birthday list"),
					List.of("Display on your profile")),
			new Edit("JM", POLICY, 2, "sr",
					NOTHING,
					List.of("Jezik pošte, srpski ili engleski")),
			new Edit("JM", POLICY, 2, "en",
					NOTHING,
					List.of("Language of your e-mail, Serbian or English")),
			new Edit("B", POLICY, 3, "sr",
					List.of("Datum rođenja, adresa elektronske pošte"),
					List.of("### Nikada se ne prikazuje\n\nAdresa elektronske pošte, adresa za slanje")),
			new Edit("B", POLICY, 3, "en",
					List.of("Date of birth, e-mail address"),
					List.of("### Never displayed\n\nE-mail address, mailing address")),
			new Edit("C", POLICY, 3, "sr",
					List.of(
						"tražimo samo da bismo znali",
						"javna je samo kategorija",
						"ali ne i od ostalih članova"),
					List.of(
						"osim ako sami izaberete da se na vašem profilu vidi ceo datum ili samo godina",
						"Javna je uvek kategorija koja iz njega proizlazi, bez obzira na vaš izbor",
						"od svakoga ko nije aktivan član ni administracija",
						"ali ne i od ostalih aktivnih članova")),
			new Edit("C", POLICY, 3, "en",
					List.of(
						"only so that we know the age category",
						"only the category that follows from it is public",
						"but not from other members"),
					List.of(
						"unless you yourself choose to have the full date or only the year shown on your profile",
						"The category that follows from it is always public, whatever you choose",
						"neither an active member nor the administration",
						"but not from other active members")),
			new Edit("Q30", POLICY, 5, "sr",
					NOTHING,
					List.of(
						"Izuzetak su novčani tragovi: ako ste u administraciji lige odobrili da neko plati manje "
							+ "ili da ne plati članarinu",
						"vaše ime ostaje uz tu odluku u evidenciji uplata, članstava i virtuelnog balansa",
						"jer je to zapis o novcu Udruženja. Sam broj ostaje potrošen")),
			new Edit("Q30", POLICY, 5, "en",
					NOTHING,
					List.of(
						"The exception is the money trail: if, as part of the league's administration, you "
							+ "approved that someone pays less or pays no membership fee",
						"your name stays with that decision in the records of payments, memberships, and the "
							+ "virtual balance",
						"because that is a record of the Association's money. The number itself remains spent")),
			new Edit("Z2", POLICY, 6, "sr",
					List.of("palite i gasite"),
					List.of("polja profila menjate i brišete u podešavanjima. Saglasnost za kolačiće")),
			new Edit("Z2", POLICY, 6, "en",
					List.of("turn notifications on and off"),
					List.of("profile fields in settings. Consent for cookies")),
			new Edit("Z1", POLICY, 7, "sr",
					List.of("dvofaktorsk"),
					List.of("sa tačno određenim pravima. Nijedan sistem nije potpuno bezbedan")),
			new Edit("Z1", POLICY, 7, "en",
					List.of("two-factor"),
					List.of(
						"and a small number of people with precisely defined rights have access to the data. No "
							+ "system is completely secure")),
			new Edit("Z5 terms", TERMS, 4, "sr",
					NOTHING,
					List.of("kao i svaki drugi član. Član čiji virtuelni balans pokriva celu članarinu prolazi bez koraka 4.")),
			new Edit("Z5 terms", TERMS, 4, "en",
					NOTHING,
					List.of(
						"at the same moment as any other member. A member whose virtual balance covers the whole "
							+ "membership fee goes through without step 4.")),
			new Edit("Caveat terms", TERMS, 5, "sr",
					List.of("vrstu trke i vreme"),
					List.of("vrstu trke, vreme, dužinu, uspon i spust. Bodove ne dira nikada")),
			new Edit("Caveat terms", TERMS, 5, "en",
					List.of("the type of race, and the time"),
					List.of("the type of race, the time, the length, the ascent, and the descent. It never touches")),
			new Edit("Z3", TERMS, 8, "sr",
					List.of("ovlastiti drugog člana"),
					List.of("ličnu predaju uvek možete dogovoriti.\n\nPehari se uručuju")),
			new Edit("Z3", TERMS, 8, "en",
					List.of("authorize another member"),
					List.of("you can always arrange an in-person handover.\n\nTrophies are presented")),
			new Edit("Z4", TERMS, 12, "sr",
					List.of("to je namerno, jer je pristup sopstvenim trkačkim podacima"),
					List.of("profil se ne prikazuje drugima; svoj profil i dalje otvarate, dok ga administracija ne obriše.")),
			new Edit("Z4", TERMS, 12, "en",
					List.of("this is deliberate, since access to your own racing data"),
					List.of(
						"the profile is not displayed to others; you can still open your own profile, until the "
							+ "administration deletes it.")),
			new Edit("Z5 rulebook", RULEBOOK, 3, "sr",
					List.of("po evidentiranoj uplati članarine ili po odluci"),
					List.of(
						"po evidentiranoj uplati članarine, po odluci Upravnog odbora kojom je član oslobođen "
							+ "plaćanja članarine, ili iz virtuelnog balansa člana.")),
			new Edit("Z5 rulebook", RULEBOOK, 3, "en",
					List.of("has been recorded, or by a decision"),
					List.of(
						"has been recorded, by a decision of the Managing Board exempting the member from paying "
							+ "the fee, or from the member's virtual balance.")),
			new Edit("Z6", RULEBOOK, 3, "sr",
					List.of("a ne po danu kada je liga uplatu evidentirala"),
					List.of("Rok se meri po danu kada je liga uplatu proknjižila.")),
			new Edit("Z6", RULEBOOK, 3, "en",
					List.of("not by the day the league recorded it"),
					List.of("The deadline is measured by the day on which the league booked the payment.")),
			new Edit("Caveat rulebook", RULEBOOK, 10, "sr",
					List.of("vrstu trke i vreme"),
					List.of("vrstu trke, vreme, dužinu, uspon i spust. Takmičar koji smatra")),
			new Edit("Caveat rulebook", RULEBOOK, 10, "en",
					List.of("the type of race, and the time"),
					List.of("the type of race, the time, the length, the ascent, and the descent. A competitor")),
			new Edit("D", RULEBOOK, 17, "sr",
					List.of(
						"Datum rođenja se nikada ne prikazuje",
						"Javna je samo kategorija",
						"Isto važi za adresu elektronske pošte"),
					List.of(
						"Datum rođenja se ne prikazuje ni u punom ni u skraćenom obliku, osim ako sami izaberete",
						"podrazumevano se ne prikazuje ništa",
						"Javna je uvek kategorija koja iz njega proizlazi, bez obzira na vaš izbor",
						"privatne poruke nikada se ne prikazuju")),
			new Edit("D", RULEBOOK, 17, "en",
					List.of(
						"The date of birth is never shown",
						"Only the category that follows from it is public",
						"The same applies to the e-mail address"),
					List.of(
						"The date of birth is not shown, either in full or in shortened form, unless you yourself choose",
						"by default nothing is shown",
						"The category that follows from it is always public, whatever you choose",
						"and private messages are never shown")),
			new Edit("E policy", POLICY, 7, "sr",
					List.of("Poslednja izmena: 28.09.2026."),
					List.of("Poslednja izmena: 10.10.2026.")),
			new Edit("E policy", POLICY, 7, "en",
					List.of("Last amended: 28.09.2026."),
					List.of("Last amended: 10.10.2026.")),
			new Edit("E terms", TERMS, 12, "sr",
					List.of("Poslednja izmena: 28.09.2026."),
					List.of("Poslednja izmena: 10.10.2026.")),
			new Edit("E terms", TERMS, 12, "en",
					List.of("Last amended: 28.09.2026."),
					List.of("Last amended: 10.10.2026.")),
			new Edit("E rulebook", RULEBOOK, 19, "sr",
					List.of("Poslednja izmena: 28.09.2026."),
					List.of("Poslednja izmena: 10.10.2026.")),
			new Edit("E rulebook", RULEBOOK, 19, "en",
					List.of("Last amended: 28.09.2026."),
					List.of("Last amended: 10.10.2026."))
		);

	@Autowired
	JdbcTemplate jdbc;

	private List<String> bodiesIn(String language) {
		return language.equals("sr")
				? db.sql("select body from static_page_section").query(String.class).list()
				: db.sql("select body from static_page_section_translation where language = :language")
						.param("language", language).query(String.class).list();
	}

	private String bodyOf(Edit edit) {
		return edit.language().equals("sr")
				? db.sql("select s.body from static_page_section s join static_page p on p.id = s.page_id"
								+ " where p.slug = :slug and s.position = :position")
						.param("slug", edit.slug()).param("position", edit.position())
						.query(String.class).single()
				: db.sql("select t.body from static_page_section_translation t"
								+ " join static_page_section s on s.id = t.section_id"
								+ " join static_page p on p.id = s.page_id"
								+ " where p.slug = :slug and s.position = :position and t.language = :language")
						.param("slug", edit.slug()).param("position", edit.position())
						.param("language", edit.language()).query(String.class).single();
	}

	private void noSectionStillCarriesWhatWasTakenOut(String language) {
		List<String> bodies = bodiesIn(language);

		assertThat(bodies).as("there is no %s page text at all, so this case measures nothing", language).isNotEmpty();

		for (Edit edit : EDITS) {
			if (!edit.language().equals(language)) {
				continue;
			}

			for (String gone : edit.gone()) {
				assertThat(bodies)
						.as("edit %s: a %s section still carries \"%s\", which V57 took out of %s",
								edit.label(), language, gone, edit.where())
						.noneMatch(body -> body.contains(gone));
			}
		}
	}

	private void whatWasPutInStandsOnceWhereItWasWritten(String language) {
		int phrasesChecked = 0;

		for (Edit edit : EDITS) {
			if (!edit.language().equals(language)) {
				continue;
			}

			String body = bodyOf(edit);

			for (String stands : edit.stands()) {
				assertThat(body)
						.as("edit %s: %s does not carry \"%s\" exactly once", edit.label(), edit.where(), stands)
						.containsOnlyOnce(stands);
				phrasesChecked++;
			}
		}

		assertThat(phrasesChecked).as("no %s phrase was checked, so this case measures nothing", language).isPositive();
	}

	@Test
	void noSerbianSectionOfAnyPageStillCarriesWhatV57TookOut() {
		noSectionStillCarriesWhatWasTakenOut("sr");
	}

	@Test
	void noEnglishSectionOfAnyPageStillCarriesWhatV57TookOut() {
		noSectionStillCarriesWhatWasTakenOut("en");
	}

	@Test
	void whatV57PutIntoTheSerbianTextStandsOnceWhereItWasWritten() {
		whatWasPutInStandsOnceWhereItWasWritten("sr");
	}

	@Test
	void whatV57PutIntoTheEnglishTextStandsOnceWhereItWasWritten() {
		whatWasPutInStandsOnceWhereItWasWritten("en");
	}

	/**
	 * Every migration before V57 that wrote page text, read out of the files Flyway resolved. Derived and not
	 * listed: which of them wrote page text is a question about their SQL, so the filter is the table they name.
	 */
	private String pageTextOfTheMigrationsBeforeThisOne() {
		StringBuilder text = new StringBuilder();

		for (MigrationInfo applied : flyway.info().applied()) {
			if (applied.getVersion() == null || Integer.parseInt(applied.getVersion().getVersion()) >= THE_MIGRATION) {
				continue;
			}

			String sql = migrationSql(applied.getVersion().getVersion());

			if (sql.contains("static_page_section")) {
				text.append(sql);
			}
		}

		return text.toString();
	}

	/**
	 * THE PHRASES ABOVE REALLY WERE IN THE PAGES, asked of the migrations that wrote them.
	 *
	 * <p>Without this, the two sweeps are satisfied by any phrase nobody ever used, and narrowing them would look
	 * like tightening. All of those migrations are applied and immutable (ADL A2), so V57 cannot make this pass by
	 * editing them.
	 */
	@Test
	void everyPhraseTheSweepsExpectGoneWasReallyWrittenBeforeV57() {
		String before = pageTextOfTheMigrationsBeforeThisOne();

		assertThat(before).as("no migration before V57 wrote page text, so this case measures nothing").isNotBlank();

		for (Edit edit : EDITS) {
			for (String gone : edit.gone()) {
				assertThat(before)
						.as("edit %s: \"%s\" is not in any migration that wrote page text, so holding that it is"
								+ " absent measures nothing", edit.label(), gone)
						.contains(gone);
			}
		}
	}

	/**
	 * V57 run once more, over the text it has already edited, and the error PostgreSQL answers with.
	 *
	 * <p>The last thing a case may ask of the database: the error leaves the transaction aborted. The migration is
	 * read from the file Flyway resolved ({@link DatabaseTest#migrationSql}), never from a copy of its statements.
	 */
	private PSQLException v57RunAgain() {
		String sql = migrationSql(String.valueOf(THE_MIGRATION));
		Throwable stopped = catchThrowable(() -> jdbc.execute(sql));

		assertThat(stopped)
				.as("V57 ran over text it was not written for and said nothing: a replace() that matches nothing"
						+ " passes silently, and this is what the check in V57 exists to prevent")
				.isNotNull();

		Throwable cause = NestedExceptionUtils.getMostSpecificCause(stopped);

		assertThat(cause).as("V57 stopped with something other than an error from PostgreSQL").isInstanceOf(PSQLException.class);

		return (PSQLException) cause;
	}

	private static String reportOf(PSQLException error) {
		return error.getServerErrorMessage().getDetail();
	}

	@Test
	void v57RunOverTheFinishedTextStopsAndSaysThatEveryOldTextIsMissing() {
		PSQLException error = v57RunAgain();

		assertThat(error.getServerErrorMessage().getMessage()).contains("the written pages were not edited");
		assertThat(reportOf(error))
				.as("the finished text still holds every old text of V57, so the edits are not finished")
				.contains("A @ politika-privatnosti #2 sr: found 0 times")
				.contains("D @ pravilnik #17 en: found 0 times");
	}

	@Test
	void anOldTextThatStandsTwiceStopsV57Too() {
		String signedOff = "Poslednja izmena: 28.09.2026.";

		assertThat(db.sql("update static_page_section s set body = :body from static_page p"
						+ " where p.id = s.page_id and p.slug = 'pravilnik' and s.position = 19")
				.param("body", signedOff + "\n\n" + signedOff)
				.update())
				.as("there is no sign-off of the rulebook to write twice")
				.isOne();

		assertThat(reportOf(v57RunAgain()))
				.as("the sign-off stands twice and V57 did not say so")
				.contains("E rulebook @ pravilnik #19 sr: found 2 times");
	}

	@Test
	void aSectionThatHasNoSuchTextStopsV57Too() {
		assertThat(db.sql("delete from static_page_section_translation t using static_page_section s, static_page p"
						+ " where s.id = t.section_id and p.id = s.page_id and p.slug = 'politika-privatnosti'"
						+ " and s.position = 2 and t.language = 'en'")
				.update())
				.as("there is no English text of the policy's second section to take away")
				.isOne();

		assertThat(reportOf(v57RunAgain()))
				.as("an edit was aimed at a text that is not there and V57 did not say so")
				.contains("A @ politika-privatnosti #2 en: there is no such text");
	}

	private static final Pattern A_LINE_OF_THE_REPORT = Pattern.compile("^(.+) @ (\\S+) #(\\d+) (\\w+): .+$");

	/**
	 * THE TABLE NAMES EXACTLY THE SECTIONS V57 EDITS, asked of V57 itself.
	 *
	 * <p>Run over the finished text it refuses, and its report has one line for every edit, whether that edit found
	 * its old text or not (so an edit that adds a sentence after an anchor, and finds the anchor still there, is
	 * named as well). The sections those lines name are the floor under {@link #EDITS}.
	 */
	@Test
	void theTableNamesExactlyTheSectionsTheMigrationEdits() {
		Set<String> editedByTheMigration = new HashSet<>();

		for (String line : reportOf(v57RunAgain()).lines().toList()) {
			Matcher named = A_LINE_OF_THE_REPORT.matcher(line);

			assertThat(named.matches()).as("V57 reported a line this case cannot read: %s", line).isTrue();
			editedByTheMigration.add(named.group(2) + " #" + named.group(3) + " " + named.group(4));
		}

		Set<String> heldByTheTable = new HashSet<>();

		for (Edit edit : EDITS) {
			heldByTheTable.add(edit.where());
		}

		assertThat(editedByTheMigration).as("V57 names no section at all, so this case measures nothing").isNotEmpty();
		assertThat(heldByTheTable)
				.as("the table and V57 do not edit the same sections of the same pages in the same languages")
				.isEqualTo(editedByTheMigration);
	}
}
