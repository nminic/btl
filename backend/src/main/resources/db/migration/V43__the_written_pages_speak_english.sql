/* THE FOUR WRITTEN PAGES GET THEIR ENGLISH WORDS, ONE PAGE AND ONE COMMIT AT A TIME.
 *
 * PDL.md, section "Pravni tekstovi se prevode na engleski do 30.09.2026, i prevodim ih JA",
 * owner, 26.09.2026, chosen from four outcomes he was shown: "sema dobija jezik, tekst se
 * prevodi, i sve ide do lansiranja". His own words on the same day, quoted here because they
 * are the reason this migration exists rather than a paraphrase of it: "HOĆEŠ PREVESTI SAM
 * JER JA TAKO KAŽEM". That sentence is also what lifts the general rule against touching a
 * legal document alone (PDL.md, 30.08.2026, "Rekao sam ti da ne diras vise pravna dokumenta
 * SAM, ali kad sam ti dao instrukciju sta tacno da promenis u pravilniku, to je OK") for this
 * one job: the instruction has now been given, and it covers the translation whole.
 *
 * V37 BUILT THE TABLES EMPTY AND SAID THE TRANSLATION WOULD BE ITS OWN MIGRATION, ARRIVING
 * "A BLOCK AT A TIME, IN AS MANY COMMITS AS IT TAKES", WITH NO READER EVER SEEING A HALF
 * TRANSLATED LEGAL TEXT. This file is that migration, and it is taken at its word: a page
 * turns English in PageApi only once its title and every one of its sections carry a row
 * (PageApi.pagesIn, "whole or nothing"), so a commit that adds one page's rows changes
 * nothing for any page not yet finished, and nothing for /api/pages asked without a language
 * at all - the Serbian answer PageApiTest holds byte for byte against pages.json is
 * untouched by every statement below.
 *
 * ORDER, AND WHY THIS COMMIT IS SHORT. The owner asked for the president's own word first,
 * "najmanja, i vlasnik je bas nju pomenuo" - one section, 821 characters, no drawing, no
 * table, and no dependency on anything another branch is touching. The rulebook (pravilnik)
 * is the next to land in this same file, for the same reason: nineteen sections and no
 * pending question either. THE OTHER TWO PAGES OF THE FOUR, uslovi-koriscenja and
 * politika-privatnosti, ARE DELIBERATELY NOT IN THIS FILE YET: branch b143 (PR 410) rewrites
 * running text of both under its own V41, not yet merged at the time of this commit, and
 * translating ahead of that merge would either translate sentences V41 is about to delete or
 * hand V41's reviewer two Serbian originals to reconcile with one English page. They arrive
 * in a later commit to this same V43, once it is settled which Serbian text is the one being
 * translated.
 *
 * THE DISCLAIMER OF WHICH LANGUAGE BINDS IS NOT ADDED TO THIS PAGE. PDL.md, "Odredbu o
 * merodavnosti nose SAMO engleske strane" (27.09.2026, owner) settles that the Serbian
 * original is never touched and that the ENGLISH side of "pravni tekstovi i pravilnik" is
 * what states the Serbian version binds - the rulebook already carries exactly that sentence
 * as its own Article 4 ("Prevod na engleski ... je informativan, a u slucaju razlike
 * merodavna je srpska verzija"), translated faithfully below with the rest of the article.
 * [MOJE REZONOVANJE, nije vlasnikova odluka i trazi njegovu potvrdu ili prigovor.] The
 * president's word is neither a legal text nor the rulebook - it is "the actual copy the
 * owner approved" in V37's own words, a welcome rather than an instrument - so no such
 * sentence is added to it here. If the owner disagrees, one paragraph is added to the
 * section below in the next commit to this file.
 *
 * VALUES ARE DOLLAR QUOTED ($$...$$) RATHER THAN QUOTED WITH DOUBLED APOSTROPHES, which V24
 * uses throughout (for example "Round ''n'' Around"). That form is exactly as valid here, but
 * a translated sentence carries far more of English's own apostrophes ("president's",
 * "portal's", "it is") than the Serbian original ever did, and a single missed doubling is a
 * syntax error a reviewer would have to find by eye across a wall of prose. Dollar quoting
 * needs no escaping for a quote of either kind and the content below contains no literal `$`
 * anywhere, so the two are equivalent in what they store and this one is the safer to write
 * and to review.
 *
 * WHY position AND gallery NEED NO ROW HERE. Both are language independent by V37's own
 * design (its header again: position belongs to the document, gallery is an identifier the
 * frontend resolves to a component) - what a translation adds is exactly title, heading and
 * body, keyed by the page's slug and the section's position, which is the pair V37's header
 * hands a translator and the same pair StaticPageConstraintsTest already writes its own
 * fixtures by.
 */

insert into static_page_translation (page_id, language, title) values
    ((select id from static_page where slug = 'rec-predsednika'), 'en', $$President's word$$);

insert into static_page_section_translation (section_id, language, heading, body) values
    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'rec-predsednika' and s.position = 1),
     'en',
     $$President's word$$,
     $$The Sports Association "BTL," popularly known as the Balkanska trkačka liga, has for years brought together, and will keep bringing together, some of the best recreational and semi-professional runners in the region. Competitors are ranked by the speed at which they cover a stretch of a set length and vertical climb, whether at a marathon, a cross-country race, or any other organized walking or running event.

The league is meant for everyone who wants to experience the thrill of competition, but membership depends solely on how ready each person is to put fair play and consideration for their fellow competitors first.

The complete [rulebook](/pravilnik) for the current season is available on the portal, and for any further information feel free to contact us at our official address, [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).

**Nikola Minić**
President of the Association$$);
