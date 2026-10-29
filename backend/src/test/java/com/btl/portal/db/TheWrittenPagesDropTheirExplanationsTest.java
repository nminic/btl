package com.btl.portal.db;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;

import java.util.List;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * THE THREE LEGAL PAGES HAVE LOST THEIR EXPLANATIONS AND THEIR FAMILIAR PHRASES, NO LONGER OFFER THE EXEMPTION FROM THE
 * FEE, AND NAME THE ONE EXCEPTION TO "NO REFUND" (V77, owner, 29.10.2026), IN BOTH LANGUAGES.
 *
 * <p><b>Why this exists, and it is the other half of V77 (as {@link TheWrittenPagesOpenOnTheElevenOfNovemberTest} was
 * of V76).</b> V77 makes sixty-one edits in each language with {@code replace()} calls. A replace is exact and has one
 * failure mode, which is to match NOTHING and report success; the migration itself refuses that (it asks every edit
 * how many times its old text stands), so what is held here is the other side: that what the owner approved is what
 * the portal serves, edit by edit, in both languages, and that two sweeps over every section of the three pages find
 * nothing they were written to keep out.
 *
 * <p><b>Three kinds of case.</b> The table of edits ({@link #CHANGES}): for each, the full new text stands once in the
 * section it was aimed at and a piece of the old text is gone, in Serbian and in English separately, so an edit done in
 * one language alone fails the other. The two sweeps: no section, in either language, offers an exemption from the fee
 * (the owner's capitals: "NIGDE NI U JEDNOM TEKSTU NE SME DA SE POMINJE OSLOBADJANJE OD CLANARINE KAO OPCIJA!"), and
 * none says "samo nam se javite" (the owner: it sounds too cheesy). And the two things that must stay: the exception
 * to the refusal of a refund stands in Article 12 and in the terms and nowhere else, and the list of consequences of a
 * disqualification in Article 63 still says the fee is not refunded, without the exception (the owner turned the
 * exception down there).
 *
 * <p><b>The sweeps are over every row, with no section named</b>, three pages in both languages, headings and bodies,
 * the shape of {@link RulebookPenaltyIsGoneTest}. A floor sits under each of them in
 * {@link TheWrittenPagesDropTheirExplanationsCarriedOverTest}: asked of the text as it stood before V77 they find what
 * they are meant to keep out, so a pattern that has gone blind fails there.
 */
class TheWrittenPagesDropTheirExplanationsTest extends DatabaseTest {

	static final String RULEBOOK = "pravilnik";
	static final String TERMS = "uslovi-koriscenja";
	static final String POLICY = "politika-privatnosti";

	private static final List<String> THE_THREE = List.of(RULEBOOK, TERMS, POLICY);

	/** The sentence V77 adds to Article 12 and to the terms, in the owner's wording and in its translation. */
	private static final String EXCEPTION_IN_SERBIAN = "osim u izuzetnim slučajevima odluke Upravnog odbora";
	private static final String EXCEPTION_IN_ENGLISH = "except in exceptional cases by decision of the Managing Board";

	/**
	 * One edit of V77 as the owner approved it. The full new text must stand once in the section, and a piece of the
	 * old text, taken from what the edit removes, must not stand in it. The ids are the draft's
	 * ({@code btl-produkt/primeri/redakcija/nacrt.md}); PRAV-04 is not here because the owner did not choose it (his
	 * own sentence replaced its alternative, PRAV-04b) and PRAV-31 is not in the draft (Article 12, his addition).
	 */
	record Change(String id, String slug, int position, String standsInSerbian, String goneFromSerbian,
			String standsInEnglish, String goneFromEnglish) {
	}

	static final List<Change> CHANGES = List.of(
			new Change("PRAV-01", RULEBOOK, 2,
					"Ako vam posle toga neki rezultat nedostaje, obratite nam se i upisaćemo ga na vaš profil, s tim što on više ne ulazi u tabele, rang liste ni priznanja.",
					"da vam profil bude potpun,",
					"If a result is still missing after that, contact us and we will enter it on your profile, but it no longer enters the tables, rankings, or awards.",
					"profile is complete,"),
			new Change("PRAV-02", RULEBOOK, 3,
					"po uplati izvršenoj zaključno sa 31. martom 2027. godine.",
					"godine ili po odluci Upravnog odbora o oslobađanju od članarine donetoj do istog dana.",
					"by a payment made by 31 March 2027 at the latest.",
					"latest, or by a decision of the Managing Board exempting the member from the fee, adopted by that same day."),
			new Change("PRAV-03", RULEBOOK, 4,
					"### Član 11. Cena i rokovi",
					"oslobađanje od članarine",
					"### Article 11. Price and deadlines",
					"exemption from the membership fee"),
			new Change("PRAV-04b", RULEBOOK, 4,
					"Uplata u dinarima tu taksu nema.\n\nTakmičarski status u nekoj sezoni zavisi od aktiviranog statusa na portalu, dok je rok plaćanja za preduslov rangiranja regulisan Članom 10.",
					"Upravni odbor sme odlukom da redovnog člana oslobodi plaćanja članarine. Član oslobođen članarine ima ista",
					"Payment in dinars carries no such fee.\n\nCompetitor status in a given season depends on the status activated on the portal, while the payment deadline for the precondition of ranking is governed by Article 10.",
					"The Managing Board may, by decision, exempt a regular member from paying the membership fee. A member exempted"),
			new Change("PRAV-31", RULEBOOK, 4,
					"Uplaćena članarina se ne vraća, ni pri odjavi, ni pri prestanku članstva, ni pri diskvalifikaciji, osim u izuzetnim slučajevima odluke Upravnog odbora.",
					"pri diskvalifikaciji.",
					"A paid membership fee is not refunded, whether on cancellation, on termination of membership, or on disqualification, except in exceptional cases by decision of the Managing Board.",
					"on disqualification."),
			new Change("PRAV-05", RULEBOOK, 6,
					"a uspon se u obračunu vrednuje više od spusta.",
					"spusta, jer je i teži.",
					"and ascent is weighted more heavily than descent in the calculation.",
					"calculation, since it is also harder."),
			new Change("PRAV-06", RULEBOOK, 8,
					"i važi od 1. januara te godine.",
					"godine. Prelazak na dan rođendana više ne postoji; to je izmena u odnosu na ranije pravilnike.",
					"and it applies from 1 January of that year.",
					"year. Moving up on your birthday no longer exists; this is a change from earlier rulebooks."),
			new Change("PRAV-07", RULEBOOK, 8,
					"ili u svojoj uzrasnoj. Izbor za narednu sezonu",
					"Naziv govori o tome koliko ste dugo u ligi, a ne o tome koliko brzo trčite.",
					"or in your own age category. You can change",
					"The name speaks of how long you have been in the league, not of how fast you run."),
			new Change("PRAV-08", RULEBOOK, 8,
					"Čim u nekoj sezoni skupite 12 ili više BTL bodova, od sledeće sezone prelazite u svoju uzrasnu kategoriju i tu ostajete.",
					"pređete tu granicu,",
					"As soon as you collect 12 or more BTL points in a season, you move into your age category from the next season and stay there.",
					"cross that threshold"),
			new Change("PRAV-09", RULEBOOK, 9,
					"portal sam popuni ono što ta trka zadaje.",
					"zadaje, pa vam ostaje manje kucanja.",
					"the portal fills in whatever that race specifies by itself.",
					"itself, so there is less for you to type."),
			new Change("PRAV-10", RULEBOOK, 9,
					"Ako trke nema u kalendaru, rezultat možete da prijavite i tada, a uz njega ćemo napraviti i događaj i trku.",
					"vaš rezultat napravićemo",
					"If the race is not in the calendar, you can still submit the result, and we will create both the event and the race along with it.",
					"along with your result."),
			new Change("PRAV-11", RULEBOOK, 9,
					"Dovoljan je link ka zvaničnim rezultatima. Ako ga nemate, pošaljite sliku, na primer snimak sata ili diplomu, i kratko napišite zašto linka nema i šta se na slici vidi.",
					"rezultatima je sasvim dovoljan.",
					"A link to the official results is enough. If you do not have one, send a picture, for example a watch screenshot or a certificate, and briefly say why there is no link and what the picture shows.",
					"say in a few words"),
			new Change("PRAV-12", RULEBOOK, 11,
					"Generalni plasman računa se iz svih trka u sezoni. Svaka bodovana trka ulazi u zbir.",
					"sezoni, a ne iz najboljeg izabranog broja rezultata.",
					"The overall placing is calculated from all races in the season. Every scored race enters the total.",
					"season, not from the best selected number of results."),
			new Change("PRAV-13", RULEBOOK, 11,
					"Tabele se osvežavaju odmah posle svakog verifikovanog rezultata.",
					"rezultata. Periodičnog obračuna nema.",
					"The tables are refreshed immediately after every verified result.",
					"result. There is no periodic calculation."),
			new Change("PRAV-14", RULEBOOK, 11,
					"Na listi je samo onaj ko je trčao i prethodne sezone, i samo onaj čiji je prirast pozitivan.",
					"pozitivan, jer nazadovanje nije napredak.",
					"The list includes only someone who also ran in the previous season, and only someone whose increase is positive.",
					"since a first season has nothing to grow from,"),
			new Change("PRAV-15", RULEBOOK, 11,
					"Redosled merila, dok se izjednačenje ne razreši:",
					"Načelo je jedno: nagrađuje se veći obim, nikad efikasnost. Manji broj trka se ne nagrađuje ni u jednom",
					"The order of criteria, until the tie is broken:",
					"There is one principle: greater volume is rewarded, never efficiency. A smaller number of races is never"),
			new Change("PRAV-16", RULEBOOK, 11,
					"### Član 43. Deljenog mesta nema",
					"Kod najbolje trke raniji datum se namerno ne koristi kao merilo, jer je u najčešćem slučaju izjednačenja reč o",
					"### Article 43. There is no shared placing",
					"For the best race, an earlier date is deliberately not used as a criterion, since in the most common case of a"),
			new Change("PRAV-17", RULEBOOK, 11,
					"Kod timova to je stalan redosled koji liga vodi.",
					"vodi, jer tim nema članski broj; on ne znači ništa i postoji samo zato da tabela ne bi skakala pri svakom",
					"For teams that is a fixed order the league keeps.",
					"keeps, since a team has no member number; it means nothing and exists only so that the table does not jump"),
			new Change("PRAV-18", RULEBOOK, 11,
					"3. Nagrada se ne duplira, pa za jedno mesto postoji jedan takmičar i jedan pehar.",
					"duplira. Jedno mesto,",
					"3. An award is never duplicated, so each place has one competitor and one trophy.",
					"duplicated. One place,"),
			new Change("PRAV-19", RULEBOOK, 12,
					"Klub je organizacija za koju nastupate van lige.",
					"u stvarnom životu.",
					"A club is the organization you compete for outside the league.",
					"compete for in real life."),
			new Change("PRAV-20", RULEBOOK, 12,
					"bez normalizacije po broju članova.",
					"članova. Svaki bod i svaki dodatni član donose timu prednost, i to je namerno.",
					"with no normalization for the number of members.",
					"members. Every point and every additional member gives the team an advantage, and that is deliberate."),
			new Change("PRAV-21", RULEBOOK, 13,
					"### Član 50. Prateće lige",
					"50. Liga kao pojam",
					"### Article 50. Accompanying leagues",
					"League as a concept"),
			new Change("PRAV-22", RULEBOOK, 13,
					"nije ničim ograničen.",
					"ograničen. Daje sjajnu šansu svima da izvuku iz sebe svoj realan maksimum, i pobednik možda neće biti onaj ko",
					"is not limited in any way.",
					"way. It gives everyone a great chance to draw out their real maximum, and the winner may not be the one who"),
			new Change("PRAV-23", RULEBOOK, 13,
					"Cilj je da se tokom sat vremena sakupi što više BTL bodova.",
					"Nije cilj stići prvi, cilj",
					"The goal is to collect as many BTL points as possible within one hour.",
					"goal is not to arrive first; the"),
			new Change("PRAV-24", RULEBOOK, 14,
					"### Član 55. Posebna priznanja",
					"Priznanje za koje se nije trkalo nije priznanje.",
					"### Article 55. Special honours",
					"An honour nobody raced for is not an honour."),
			new Change("PRAV-25", RULEBOOK, 14,
					"Ličnu predaju",
					"Rok postoji da se preuzimanje ne razvlači u nedogled, a ne da bi neko ostao bez nagrade.",
					"You can always",
					"The deadline exists so that collection is not dragged out indefinitely, not so that someone is left without an"),
			new Change("PRAV-26", RULEBOOK, 16,
					"ostaje anonimizovan zapis.",
					"zapis. Oznake \"arhiviran takmičar\" nema, jer takvo stanje ne postoji.",
					"an anonymized record remains.",
					"remains. There is no \"archived competitor\" marker, because no such state exists."),
			new Change("PRAV-27", RULEBOOK, 18,
					"Dukati su bronzani, srebrni i zlatni, po rastućoj težini.",
					"to se na njima vidi: od bronzanih, koje mnogi osvoje već u prvoj sezoni, preko srebrnih, do zlatnih, koji se",
					"Ducats are bronze, silver, and gold, in order of increasing difficulty.",
					"them carry the same weight, and that shows on them: from bronze ones, which many win already in their first"),
			new Change("PRAV-28", RULEBOOK, 19,
					"Pravilnik se donosi iznova za svaku sezonu i objavljuje se pre početka te sezone. Verzija koja je važila u jednoj sezoni ostaje objavljena.",
					"objavljena, jer je zvanični rezultat te sezone donet po njoj.",
					"The Rulebook is adopted anew for every season and published before that season begins. The version that applied in a given season remains published.",
					"published, since that season's official result was reached under it."),
			new Change("PRAV-29", RULEBOOK, 19,
					"upisuje u narednu verziju pravilnika.",
					"pravilnika, da se isto pitanje ne bi rešavalo dvaput različito.",
					"is written into the next version of the Rulebook.",
					"Rulebook, so that the same question is not resolved differently twice."),
			new Change("PRAV-30", RULEBOOK, 19,
					"Poslednja izmena: 29.10.2026.",
					"izmena: 27.10.2026.",
					"Last amended: 29.10.2026.",
					"amended: 27.10.2026."),
			new Change("USL-01", TERMS, 2,
					"a profil se ne prikazuje.",
					"prikazuje. Članarina se, dakle, ne plaća za pristup sajtu nego za članstvo u ligi.",
					"and the profile is not displayed.",
					"displayed. The membership fee is therefore not paid for access to the site but for membership in the league."),
			new Change("USL-02", TERMS, 3,
					"Koliko košta članarina i do kada se plaća, naći ćete u cenovniku",
					"plaća i ko može biti oslobođen plaćanja,",
					"How much the membership fee costs and by when it is paid, you will find in the price list",
					"and who can be exempted from paying it,"),
			new Change("USL-03", TERMS, 3,
					"Uplaćene članarine se ne vraćaju, osim u izuzetnim slučajevima odluke Upravnog odbora.",
					"Pošto je to usluga slobodnog vremena za tačno određen period, uplaćenu članarinu",
					"Paid membership fees are not refunded, except in exceptional cases by decision of the Managing Board.",
					"Since it is a leisure-time service for a precisely defined period, we do"),
			new Change("USL-04", TERMS, 4,
					"i tada dobijate članski broj. Član čiji virtuelni balans",
					"koga je Upravni odbor oslobodio plaćanja članarine prolazi bez koraka 4; članski broj i sva prava dobija u",
					"and that is when you receive your member number. A member whose virtual balance",
					"exempted from the fee by the Managing Board goes through without step 4; they receive their member number and"),
			new Change("USL-05", TERMS, 4,
					"Članovima iz Srbije PayPal se ne prikazuje.",
					"prikazuje, i to nije stvar izbora nego propisa.",
					"PayPal is not shown to members from Serbia.",
					"Serbia, and that is not a matter of choice but of regulation."),
			new Change("USL-06", TERMS, 5,
					"Prijavljujte samo trke koje ste sami istrčali. Sve o tome",
					"Rezultati su srce lige i tu zaista računamo na vaše poštenje: prijavljujte",
					"Submit only races you ran yourself. Everything about",
					"Results are the heart of the league, and here we truly rely on your honesty: submit"),
			new Change("USL-07", TERMS, 6,
					"a koji je prikazan na vašoj strani \"Moja članarina\", uz sam link. Iznos se upisuje na vaš balans u trenutku aktivacije, a ne u trenutku prijave, i o tome vas obaveštavamo porukom.",
					"koji vam stoji ispisan",
					"shown on your \"My fee\" page, next to the link itself. The amount is credited to your balance at the moment of activation, not at the moment of application, and we notify you of this by message.",
					"amount lands on your"),
			new Change("USL-08", TERMS, 9,
					"### BTL nije organizator tuđih trka",
					"Ovo je najvažnija sekcija ovih uslova, pa je izdvojena.",
					"### BTL is not the organizer of other people's races",
					"This is the most important section of these terms, so it stands on its own."),
			new Change("USL-09", TERMS, 9,
					"za njih je liga organizator, sa svim obavezama koje to nosi.",
					"sa svime što uz to",
					"for these the league is the organizer, with all the obligations that role carries.",
					"that comes with it."),
			new Change("USL-10", TERMS, 9,
					"Zahtev izvršavamo u najkraćem roku i bez traženja obrazloženja.",
					"roku, bez rasprave",
					"We carry out the request as soon as possible and without asking for a justification.",
					"possible, without argument"),
			new Change("USL-11", TERMS, 11,
					"Poslednja izmena: 29.10.2026.",
					"izmena: 22.10.2026.",
					"Last amended: 29.10.2026.",
					"amended: 22.10.2026."),
			new Change("POL-01", POLICY, 2,
					"se traži, ali nije obavezan. Vidi ga",
					"obavezan, jer lična karta se izdaje sa 16.",
					"is requested from a member younger than 16, but is not mandatory. Only the administration and you see it",
					"mandatory, since an ID card is issued at 16."),
			new Change("POL-02", POLICY, 2,
					"drugima se ne prikazuje nigde",
					"nigde i stoji odvojeno od podataka koje čitaju ekrani portala, u sopstvenoj tabeli sa sopstvenim pravom",
					"it is not displayed to others anywhere",
					"anywhere and stands apart from the data the portal's screens read, in its own table with its own access rights"),
			new Change("POL-03", POLICY, 3,
					"### Podaci koji nisu javni",
					"Nikada se ne prikazuje",
					"### Data that is not public",
					"### Never displayed"),
			new Change("POL-04", POLICY, 3,
					"ali ne i od ostalih aktivnih članova.",
					"članova, jer bi time nestao smisao zajedničkog rangiranja.",
					"but not from other active members.",
					"members, since that would remove the point of ranking together."),
			new Change("POL-05", POLICY, 3,
					"Ako tražite uklanjanje, sliku na kojoj ste vi predmet uklanjamo, a sa grupne uklanjamo ono što vas identifikuje.",
					"postupamo srazmerno:",
					"If you request removal, we remove a picture in which you are the subject, and from a group picture we remove whatever identifies you.",
					"we act proportionately:"),
			new Change("POL-06", POLICY, 3,
					"i datum, vreme i IP adresu sa koje je dat. Roditelj vodi",
					"dat, jer je to ono što potpis čini dokazivim.",
					"and the date, time, and IP address it was given from. The parent maintains",
					"from, since that is what makes the signature provable."),
			new Change("POL-07", POLICY, 4,
					"u lokalnom skladištu. Postavlja se tek",
					"Pravno je to isto što i kolačić, pa piše ovde iako se tako ne zove.",
					"in local storage. It is set only once",
					"Legally that is the same as a cookie, so it is listed here even though it is not called one."),
			new Change("POL-08", POLICY, 4,
					"trake za pristanak",
					"pristanak: pristanak se traži za ono što nije nužno, a ovde ničega takvog nema",
					"consent banner either",
					"either: consent is asked for whatever is not necessary, and there is nothing of the kind here"),
			new Change("POL-09", POLICY, 4,
					".\n\nOglasnih",
					". Ako to jednog dana uvedemo, ova strana će to reći pre nego što se uvede.",
					".\n\nThere are no advertising",
					". If we ever introduce that, this page will say so before it is introduced."),
			new Change("POL-10", POLICY, 5,
					"Po isteku pet godina",
					"Dalje, dva načina se namerno razlikuju.",
					"Once the five years expire",
					"Beyond that, the two paths deliberately differ."),
			new Change("POL-11", POLICY, 5,
					"ako ste u administraciji lige doneli odluku o članarini nekog člana, vaše ime ostaje uz tu odluku",
					"odobrili da neko plati manje ili da ne plati članarinu,",
					"you made a decision about a member's membership fee, your name stays with that decision",
					"approved that someone pays less or pays no"),
			new Change("POL-12", POLICY, 6,
					"Ne tražimo obrazac ni obrazloženje, a ostvarivanje prava je besplatno. Rok je bez odlaganja,",
					"Bez obrasca, bez obrazloženja i",
					"We do not ask for a form or a justification, and exercising your rights is free of charge. The deadline is without undue delay,",
					"No form, no justification,"),
			new Change("POL-13", POLICY, 6,
					"Pre nego što bilo šta pošaljemo, proveravamo da ste to zaista vi.",
					"vi, jer su podaci poslati pogrešnoj osobi gori od podataka koji kasne.",
					"Before we send anything, we verify that it is really you.",
					"you, because data sent to the wrong person is worse than data that is late."),
			new Change("POL-14", POLICY, 6,
					"Saglasnost za kolačiće se ne povlači jer se ne daje (sekcija 4).",
					"daje: portal postavlja samo dva kolačića, bezbednosni i kolačić sesije, bez kojih slanje obrasca i prijava ne",
					"Consent for cookies is not withdrawn because it is not given (section 4).",
					"given: the portal sets only two cookies, the security cookie and the session cookie, without which submitting"),
			new Change("POL-15", POLICY, 6,
					"Kopiju podataka pripremamo ručno, u CSV ili JSON obliku, kad to tražite.",
					"Dugmeta koje jednim klikom preuzima sve podatke nema; kopiju",
					"We prepare a copy of your data by hand, in CSV or JSON form, when you request it.",
					"There is no button that fetches all your data in one click; we"),
			new Change("POL-16", POLICY, 6,
					"Prvo nam pišite na [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).",
					"pišite, jer se većina stvari reši u jednoj poruci.",
					"Write to us first at [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).",
					"first, since most things are resolved in a single message."),
			new Change("POL-17", POLICY, 7,
					"Ako dođe do povrede podataka koja može da vam naškodi, obaveštavamo vas",
					"Nijedan sistem nije potpuno bezbedan; ako",
					"If a data breach occurs that could harm you, we notify you",
					"No system is completely secure; if"),
			new Change("POL-18", POLICY, 7,
					"Portal bodove, plasman i dukate računa automatski, po pravilima lige.",
					"dukate, što je matematika",
					"The portal calculates points, placing, and ducats automatically, under the league's rules.",
					"ducats, which is arithmetic"),
			new Change("POL-19", POLICY, 7,
					"Poslednja izmena: 29.10.2026.",
					"izmena: 24.10.2026.",
					"Last amended: 29.10.2026.",
					"amended: 24.10.2026.")
	);

	/** One section of one page in one language. */
	record Row(String slug, int position, String language, String heading, String body) {
	}

	/** Every section of the three pages in both languages, headings and bodies, with no section named. */
	static List<Row> theThreePages(JdbcClient db) {
		List<Row> rows = new java.util.ArrayList<>(db
				.sql("select p.slug, s.position, 'sr', s.heading, s.body from static_page_section s"
						+ " join static_page p on p.id = s.page_id where p.slug in ('pravilnik', 'uslovi-koriscenja',"
						+ " 'politika-privatnosti') order by p.slug, s.position")
				.query((row, number) -> new Row(row.getString(1), row.getInt(2), row.getString(3), row.getString(4),
						row.getString(5)))
				.list());

		rows.addAll(db
				.sql("select p.slug, s.position, t.language, t.heading, t.body from static_page_section_translation t"
						+ " join static_page_section s on s.id = t.section_id join static_page p on p.id = s.page_id"
						+ " where p.slug in ('pravilnik', 'uslovi-koriscenja', 'politika-privatnosti')"
						+ " order by p.slug, s.position, t.language")
				.query((row, number) -> new Row(row.getString(1), row.getInt(2), row.getString(3), row.getString(4),
						row.getString(5)))
				.list());

		assertThat(rows).as("there is no page text at all, so this case measures nothing").isNotEmpty();

		return rows;
	}

	/** The sections of the three pages whose heading or body matches, in the language, as "page #position". */
	static List<String> whereItMatches(List<Row> rows, String language, Pattern what) {
		return rows.stream()
				.filter(row -> row.language().equals(language))
				.filter(row -> what.matcher(row.heading()).find() || what.matcher(row.body()).find())
				.map(row -> row.slug() + " #" + row.position())
				.toList();
	}

	static final Pattern AN_EXEMPTION_IN_SERBIAN = Pattern.compile("oslob", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

	static final Pattern AN_EXEMPTION_IN_ENGLISH = Pattern.compile(
			"exempt|waiv|free of the (membership )?fee|pays? no membership fee", Pattern.CASE_INSENSITIVE);

	static final Pattern A_FAMILIAR_PHRASE_IN_SERBIAN = Pattern.compile("samo nam se javite",
			Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

	static final Pattern A_FAMILIAR_PHRASE_IN_ENGLISH = Pattern.compile("just get in touch", Pattern.CASE_INSENSITIVE);

	private String bodyOf(String slug, int position, String language) {
		return language.equals("sr")
				? db.sql("select s.body from static_page_section s join static_page p on p.id = s.page_id"
								+ " where p.slug = :slug and s.position = :position")
						.param("slug", slug).param("position", position).query(String.class).single()
				: db.sql("select t.body from static_page_section_translation t"
								+ " join static_page_section s on s.id = t.section_id join static_page p on p.id = s.page_id"
								+ " where p.slug = :slug and s.position = :position and t.language = :language")
						.param("slug", slug).param("position", position).param("language", language)
						.query(String.class).single();
	}

	private void everyEditHolds(String language) {
		assertThat(CHANGES).as("the table of edits is empty, so this case measures nothing").hasSize(61);

		for (Change change : CHANGES) {
			boolean serbian = language.equals("sr");
			String stands = serbian ? change.standsInSerbian() : change.standsInEnglish();
			String gone = serbian ? change.goneFromSerbian() : change.goneFromEnglish();
			String body = bodyOf(change.slug(), change.position(), language);

			assertThat(body)
					.as("%s (%s #%s, %s): its new text must stand exactly once", change.id(), change.slug(),
							change.position(), language)
					.containsOnlyOnce(stands);
			assertThat(body)
					.as("%s (%s #%s, %s): a piece of its old text still stands", change.id(), change.slug(),
							change.position(), language)
					.doesNotContain(gone);
		}
	}

	@Test
	void everyEditStandsInSerbianAndItsOldWordsAreGone() {
		everyEditHolds("sr");
	}

	@Test
	void everyEditStandsInEnglishAndItsOldWordsAreGone() {
		everyEditHolds("en");
	}

	/**
	 * THE TABLE KNOWS EVERY EDIT THE MIGRATION MAKES, so a sixty-second edit added to V77 without a line here fails
	 * (the floor is the file Flyway resolved): each of the 122 rows of V77 carries one old text, written between two
	 * {@code $old$} marks.
	 */
	@Test
	void theTableNamesEveryEditV77Makes() {
		String sql = migrationSql("77");

		assertThat(sql.split("\\$old\\$", -1).length - 1)
				.as("V77 carries an edit that the table of this file does not name (or the table names one V77 lacks)")
				.isEqualTo(CHANGES.size() * 2 * 2);
	}

	@Test
	void noSectionOfTheThreePagesOffersAnExemptionFromTheFee() {
		List<Row> rows = theThreePages(db);

		assertThat(whereItMatches(rows, "sr", AN_EXEMPTION_IN_SERBIAN))
				.as("a Serbian section still mentions an exemption from the fee, which the owner forbade in every text")
				.isEmpty();
		assertThat(whereItMatches(rows, "en", AN_EXEMPTION_IN_ENGLISH))
				.as("an English section still mentions an exemption from the fee")
				.isEmpty();
		assertThat(rows.stream().map(Row::slug).distinct().toList())
				.as("the sweep did not read all three pages").containsExactlyInAnyOrderElementsOf(THE_THREE);
	}

	@Test
	void noSectionOfTheThreePagesSaysSamoNamSeJavite() {
		List<Row> rows = theThreePages(db);

		assertThat(whereItMatches(rows, "sr", A_FAMILIAR_PHRASE_IN_SERBIAN))
				.as("a Serbian section says \"samo nam se javite\" again").isEmpty();
		assertThat(whereItMatches(rows, "en", A_FAMILIAR_PHRASE_IN_ENGLISH))
				.as("an English section says \"just get in touch\" again").isEmpty();
	}

	/**
	 * THE ONE EXCEPTION TO "NO REFUND" is written twice, in Article 12 and in the terms, and nowhere else (owner,
	 * 29.10.2026: the Managing Board may return a fee in an exceptional case; the portal has neither a screen nor a record
	 * for it). Asked of every section, so a third home or a lost one fails.
	 */
	@Test
	void theExceptionToNoRefundStandsInArticleTwelveAndInTheTermsAndNowhereElse() {
		List<Row> rows = theThreePages(db);

		assertThat(whereItMatches(rows, "sr", Pattern.compile(Pattern.quote(EXCEPTION_IN_SERBIAN))))
				.containsExactlyInAnyOrder(RULEBOOK + " #4", TERMS + " #3");
		assertThat(whereItMatches(rows, "en", Pattern.compile(Pattern.quote(EXCEPTION_IN_ENGLISH))))
				.containsExactlyInAnyOrder(RULEBOOK + " #4", TERMS + " #3");

		assertThat(bodyOf(RULEBOOK, 4, "sr"))
				.containsOnlyOnce("Uplaćena članarina se ne vraća, ni pri odjavi, ni pri prestanku članstva, ni pri"
						+ " diskvalifikaciji, " + EXCEPTION_IN_SERBIAN + ".");
		assertThat(bodyOf(RULEBOOK, 4, "en"))
				.containsOnlyOnce("A paid membership fee is not refunded, whether on cancellation, on termination of"
						+ " membership, or on disqualification, " + EXCEPTION_IN_ENGLISH + ".");
		assertThat(bodyOf(TERMS, 3, "sr"))
				.containsOnlyOnce("Uplaćene članarine se ne vraćaju, " + EXCEPTION_IN_SERBIAN + ".");
		assertThat(bodyOf(TERMS, 3, "en"))
				.containsOnlyOnce("Paid membership fees are not refunded, " + EXCEPTION_IN_ENGLISH + ".");
	}

	/**
	 * THE LIST OF CONSEQUENCES OF A DISQUALIFICATION (Article 63) KEEPS ITS LINE, WITHOUT THE EXCEPTION. The owner
	 * chose the exception for Article 12 only and turned down "an exception in Article 63 as well" (PDL, same decision);
	 * the line in the list is a consequence of a measure and not a rule about a refund.
	 */
	@Test
	void theListOfConsequencesOfADisqualificationStillSaysTheFeeIsNotRefundedAndHasNoException() {
		String sr = bodyOf(RULEBOOK, 16, "sr");
		String en = bodyOf(RULEBOOK, 16, "en");

		assertThat(sr).containsOnlyOnce("- Članarina se ne vraća.\n").doesNotContain("izuzetn");
		assertThat(en).containsOnlyOnce("- The membership fee is not refunded.\n").doesNotContain("exceptional");
	}
}
