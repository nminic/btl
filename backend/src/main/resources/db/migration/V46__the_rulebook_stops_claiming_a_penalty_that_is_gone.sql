/* THE RULEBOOK STOPS CLAIMING A PENALTY THAT WAS ABOLISHED, AND STOPS TREATING A TEAM AND A PAIR
 * AS ONE RULE.
 *
 * Found ahead of the rulebook's public launch on 30.09.2026: pravilnik, section 12 ("12. Timovi,
 * trkacki parovi i klubovi"), "Clan 56. Promene tima i trkackog para". The text this server has
 * been serving members is wrong in three separate ways, and the third one is worse than stale.
 *
 * ONE. IT NAMES A PENALTY THAT IS DEAD. PDL.md, section "Kaznjeni izlazak iz tima usred godine je
 * MRTAV" (owner, UKINUTO 24.09.2026), on what used to be a three year ban plus the deletion of the
 * member's whole contribution to that season: "Razlog: izlazak se od 24.09.2026 desava samo u
 * prozoru 1.10-31.12, pa izlaska usred godine nema, a time ni kazne. Ostaje jedan put, nekaznjen."
 * The served text still carried both halves of that penalty, in both languages.
 *
 * TWO. IT NAMES THE WRONG MOMENT, AND LUMPS TWO DIFFERENT THINGS INTO ONE SENTENCE. PDL.md,
 * section "Izlazak iz tima ide po PRELAZNOM ROKU, par se raskida bilo kad" (owner, 24.09.2026):
 * "Iz tima se izlazi u istom prozoru u kom se i ulazi (1.10-31.12). Par sme da raskine svaka
 * strana, bilo kad." The reason the owner was given, in the same entry: "tim nosi bodove kroz
 * sezonu, pa bi izlazak usred nje znacio da tabela u januaru i tabela u junu govore razlicito o
 * istoj sezoni. Par to ne nosi." The served text opened by binding team and pair to one rule
 * ("Promena tima ili trkackog para ... stupa na snagu tek 1. januara naredne sezone"), which is
 * the very thing that entry separates. Owner, 29.09.2026: the whole article is rewritten so that
 * it SEPARATES the team from the pair.
 *
 * THREE, AND THIS IS THE ONE THAT IS NOT MERELY STALE: IT ORDERS A SCREEN TO DO SOMETHING THE
 * PORTAL DELIBERATELY DOES NOT DO. "Portal mu obe mogucnosti kaze pre nego sto potvrdi, i trazi
 * potvrdu bas za ovu." That sentence instructs the exit screen to offer a choice between two paths
 * and to warn about the penalty. There is one path now, and no penalty, so the screen written for
 * the exit deliberately offers neither. A rulebook that commands a confirmation the product
 * refuses to ask for is not out of date, it is a promise to the member that the portal breaks on
 * the day it launches.
 *
 * WHY A NEW MIGRATION AND NOT AN EDIT OF V24 OR V43. Both are on main, and ADL A2 as harmonised on
 * 18.09.2026 reads "migracija je nepromenljiva cim se spoji na `main`"; MigrationsAreImmutableTest
 * holds Flyway to it. V24 first wrote this section and NOTHING has rewritten it since - checked by
 * searching every migration for `update static_page_section`, which finds only V26 (privacy policy
 * positions 2, 4 and 6), V41 (uslovi-koriscenja 4, politika-privatnosti 2 and 5, pravilnik 19) and
 * V44 (politika-privatnosti 2), none of them pravilnik position 12. So the text this updates is
 * V24's own, and the English text is V43's own, V43 being the only migration that has ever written
 * a row into static_page_section_translation for this section.
 *
 * WHAT IS THE OWNER'S AND WHAT IS MINE, BECAUSE THESE MUST NOT BE READ AS ONE. The second
 * paragraph below is the owner's approved formulation, transcribed rather than paraphrased
 * (PDL.md, section "Clan 56 Pravilnika se prepisuje: kazne nema, izlazak ide po prozoru",
 * ODLUKA 28.09.2026, chosen between three offered outcomes): "Iz tima se izlazi u istom prozoru u
 * kom se i ulazi, od 1. oktobra do 31. decembra. Izlazak je jedan i ne nosi nikakvu kaznu:
 * doprinos koji je clan dao timu u toj sezoni ostaje, i clan sme odmah da se prijavi drugom timu u
 * istom prozoru. Van tog prozora izlazak nije moguc."
 *   WITHIN that approved text, the clause "doprinos koji je clan dao timu u toj sezoni ostaje" is
 * MY DERIVATION and the journal says so in as many words: deleting the contribution was PART OF
 * THE PENALTY the owner abolished, but that it therefore STAYS is nowhere written down explicitly.
 * It was put to him as mine before he chose. It is also what this backend already does, measured
 * rather than assumed: TeamWriteApi.leave ends a membership that has begun by setting `season_to`
 * to the season being run, and V11 calls that column "the last season he is in it", so the row
 * goes on saying he was in the team for the whole of the current season. The sentence describes
 * the code; it is still a derivation, not a quotation, and if the owner meant otherwise this is
 * the line that falls.
 *
 * THE ACTIVE MEMBERSHIP CONDITION IS KEPT, AND IT WAS MEASURED BEFORE BEING KEPT. "i to samo ako
 * je clanstvo aktivno za tu sezonu" came from V24 and no decision overturns it. Searched for a
 * conflict rather than assumed to have none, and what turned up REINFORCES it: PDL.md, ODLUKA
 * 19.09.2026, "Clan kome je istekla clanarina dopire samo do strane za obnovu, i automatski ispada
 * iz svih timova i parova kad pocne sezona." It is not enforced at the moment a member joins, and
 * that is deliberate and already written down where it belongs rather than discovered here:
 * JoiningATeam's own header says it answers a season NUMBER and not a check - "This says nothing
 * about whether the member has paid, and cannot ... Whether a member has paid is the service
 * layer's question, and it is still open." So the rulebook states the rule, the service layer does
 * not yet enforce it, and that gap is older than this migration and is not closed by it.
 *
 * WHICH SENTENCES SURVIVE UNTOUCHED, AND THE ONE EXCEPTION THAT HAD TO BE SAID OUT LOUD. "Sve
 * promene moraju biti zavrsene do 31. decembra" and "Clan na koga promena utice obavestava se
 * odmah po nastanku promene, a ne na pocetku sezone" are V24's own words and nothing has
 * overturned either, so both are carried over WORD FOR WORD. But the first one, left standing
 * alone beside a pair that may now be broken "bilo kad", would contradict the very decision this
 * migration is carrying out. It is therefore kept verbatim and the pair paragraph names the
 * exception explicitly instead ("Na raskid para se ne odnosi nijedan rok iz ovog clana"). Stating
 * that exception is the 24.09.2026 decision said plainly; the choice to state it there rather than
 * to narrow the owner's sentence is MINE.
 *
 * THE SECOND HOME OF THE SAME FACT, WHICH IS ARTICLE 9, AND WHY IT IS IN THIS SAME MIGRATION.
 * Sweeping the whole rulebook (not only section 12) for the penalty and for the moment -
 * "suspenz", "zabran", "izlazak iz tima", "1. januar", "1. oktobr", "31. decembr", "promen. tima",
 * and on the English side "three years", "both options", "suspend" - turns up exactly one other
 * place that speaks about this, in both languages: section 2, "Clan 9. Rokovi za promene tima i
 * trkackog para" / "Article 9. Deadlines for team and racing pair changes", reading "Sve promene
 * tima i trkackog para moraju biti zavrsene do 31. decembra, da bi vazile u narednoj sezoni.
 * Detalji su u sekciji 12."
 *   It does NOT carry the abolished penalty. What it does is bind team and pair together under one
 * deadline, which is the very thing the 24.09.2026 decision separates - so this migration fixing
 * section 12 alone would have left the rulebook saying two different things about the pair, on its
 * launch day, and a member would have found it rather than us. Owner, 29.09.2026, choosing between
 * three offered outcomes: the deadline is stated as the TEAM's, and the pair is bound by NO
 * deadline. Both languages, this same migration, this same guard.
 *   THE ARTICLE'S HEADING IS DELIBERATELY KEPT, AND THAT IS MY CALL RATHER THAN A DECISION. It goes
 * on naming the pair ("Rokovi za promene tima i trkackog para") although the pair now has no
 * deadline, for one reason: this is the article a member reads to find out what deadline applies to
 * breaking up a pair, and the answer - none - has to be findable from the heading that promises it.
 * A heading narrowed to the team would send that reader away empty. It is also the shape the owner
 * already approved one section further down, where Article 56 keeps both subjects in its heading and
 * separates them in its body. Nothing measured requires the heading to move, so it does not.
 *   Nothing points at this article by name that a rewrite could break: searched the whole repository
 * for "Clan 9." and "Article 9.", and the only hit outside these page files is GuardianshipTest,
 * which cites the STATUTE's Article 9, a different document. The pointer "Detalji su u sekciji 12"
 * is kept exactly as it was and still lands where it always did.
 *
 * WHAT HOLDS THE HOMES TOGETHER. frontend/src/test/mock/pages.json, which PageApiTest compares this
 * server's Serbian answer against field by field, and frontend/src/test/writtenPages.snapshot.json,
 * which writtenVerification.test.ts holds that mock file to in the other direction. Both sections,
 * 12 and 2, are rewritten in both files out of this same corrected text rather than retyped, by one
 * script reading one string. The English side keeps no fixture:
 * WrittenPageTranslationAppliesTest asks that Serbian and English carry one row per section and
 * the same number of markdown table rows per section body. Section 12 has ZERO such rows before and
 * after on both sides; section 2 has FIVE, because Article 7 closes the season in a table, and that
 * table is untouched - all of it counted with that test's own regex, in three directions (Serbian
 * before against after, English before against after, and Serbian against English), rather than
 * assumed. And RulebookPenaltyIsGoneTest, added with this migration, asserts over the real migrated
 * rows that the abolished penalty is absent from EVERY section of EVERY page in BOTH languages, and
 * that no section still binds team and pair to one deadline - so the day a further home of either
 * appears anywhere, it falls there rather than waiting to be found by a member.
 *
 * WHAT THIS DOES NOT TOUCH: no schema change of any kind, no constraint, no key, no index - four
 * UPDATE statements against two body columns, two sections, two languages. The exit route itself,
 * which already behaves the way this text now describes. Article 7's table, and every other article
 * of both sections. And any other section of any other page. */

update static_page_section
set body = '### Član 52. Tim i klub nisu isto

- Tim je grupa slobodnog naziva koja okuplja članove koji hoće da se takmiče zajedno. Tim je jedini entitet koji ima poredak.
- Klub je organizacija za koju nastupate u stvarnom životu. Na portalu je neobavezan podatak na profilu, bez poretka i bez prava.

### Član 53. Osnivanje tima

Tim registruje bilo koji član i time postaje administrator tog tima. Naziv tima je slobodan tekst, ne sme biti već zauzet, i svaki novi tim odobrava liga pre nego što postane vidljiv.

Administrator tima odobrava zahteve za učlanjenje i šalje pozive. Učlanjenje ide u oba smera: takmičar šalje zahtev, ili administrator tima šalje poziv.

Član sme da bude u samo jednom timu istovremeno.

### Član 54. Poredak timova

Poredak timova je čist zbir bodova svih članova tima, bez normalizacije po broju članova. Svaki bod i svaki dodatni član donose timu prednost, i to je namerno.

### Član 55. Trkački par

- Trkački par se formira obostranom potvrdom: jedna strana šalje zahtev, druga ga prihvata.
- Trkački par mora biti mešovit, jedan muškarac i jedna žena.
- Poredak trkačkih parova računa se iz bodova osvojenih na zajedničkim trkama.
- „Zajednička trka" znači ista trka, ne samo isti događaj. Ako on trči maraton a ona polumaraton na istoj manifestaciji, to nije zajednička trka.

### Član 56. Promene tima i trkačkog para

Za tim i za trkački par ne važi isto pravilo. Tim nosi bodove kroz sezonu, pa bi izlazak usred nje značio da tabela u januaru i tabela u junu govore različito o istoj sezoni. Par to ne nosi.

Iz tima se izlazi u istom prozoru u kom se i ulazi, od 1. oktobra do 31. decembra. Izlazak je jedan i ne nosi nikakvu kaznu: doprinos koji je član dao timu u toj sezoni ostaje, i član sme odmah da se prijavi drugom timu u istom prozoru. Van tog prozora izlazak nije moguć.

Promena tima stupa na snagu 1. januara naredne sezone, i to samo ako je članstvo aktivno za tu sezonu. Sve promene moraju biti završene do 31. decembra.

Trkački par raskida svaka strana, bilo kada, i raskid važi odmah. Na raskid para se ne odnosi nijedan rok iz ovog člana.

Član na koga promena utiče obaveštava se odmah po nastanku promene, a ne na početku sezone.'
where page_id = (select id from static_page where slug = 'pravilnik')
  and position = 12;

update static_page_section_translation
set body = $$### Article 52. A team and a club are not the same

- A team is a group with a freely chosen name that brings together members who want to compete together. A team is the only entity that has a standing.
- A club is the organization you compete for in real life. On the portal it is an optional field on your profile, with no standing and no rights.

### Article 53. Founding a team

A team is registered by any member, who thereby becomes that team's administrator. The team's name is free text, must not already be taken, and every new team is approved by the league before it becomes visible.

The team's administrator approves requests to join and sends invitations. Joining works in both directions: a competitor sends a request, or the team's administrator sends an invitation.

A member may be in only one team at a time.

### Article 54. Team standings

The team standings are the plain sum of the points of all the team's members, with no normalization for the number of members. Every point and every additional member gives the team an advantage, and that is deliberate.

### Article 55. Racing pair

- A racing pair is formed by mutual confirmation: one side sends a request, the other accepts it.
- A racing pair must be mixed, one man and one woman.
- The racing pair standings are calculated from the points earned in shared races.
- A „shared race" means the same race, not just the same event. If he runs the marathon and she runs the half marathon at the same event, that is not a shared race.

### Article 56. Team and racing pair changes

A team and a racing pair are not governed by the same rule. A team carries points through the season, so leaving in the middle of one would mean the table in January and the table in June say different things about the same season. A pair does not carry them.

A member leaves a team in the same window in which they join one, from 1 October to 31 December. There is one exit and it carries no penalty: the contribution they have made to the team in that season stays, and they may apply to another team immediately, within the same window. Outside that window leaving is not possible.

A change of team takes effect on 1 January of the following season, and only if membership is active for that season. All changes must be completed by 31 December.

A racing pair may be ended by either side, at any time, and the ending takes effect immediately. No deadline in this article applies to ending a pair.

A member affected by a change is notified as soon as the change occurs, not at the start of the season.$$
where language = 'en'
  and section_id = (
    select s.id from static_page_section s join static_page p on p.id = s.page_id
    where p.slug = 'pravilnik' and s.position = 12
  );

/* AND ARTICLE 9, THE ONLY OTHER PLACE IN THE RULEBOOK THAT SPEAKS ABOUT THIS - see the
 * header above for why it is in this same migration rather than left standing. */
update static_page_section
set body = '### Član 6. Trajanje sezone

Sezona traje od 1. januara u 00:00 do 31. decembra u 24:00 po srednjoevropskom vremenu (CET). Da bi ušla u bodovanje, trka mora početi unutar tog razdoblja.

### Član 7. Zatvaranje sezone

Sezona se zatvara u tri koraka, sve po CET:

| Trenutak | Šta se dešava |
|---|---|
| 31. decembar, 24:00 | Kraj sezone. Trka koja počne posle ovog trenutka pripada narednoj sezoni |
| 1. januar, 10:00 | Poslednji rok da prijavite sve zaostale rezultate prethodne sezone |
| 1. januar, 16:00 | Tabele se zamrzavaju i taj snimak postaje zvanični rezultat sezone |

### Član 8. Posle zamrzavanja

Zamrznuti snimak tabela čuva se kao zvanični rezultat sezone i više se ne menja.

Rezultate sa te sezone i posle zamrzavanja smete unositi, da bi vaš profil bio potpun, ali oni ne ulaze ni u jednu tabelu, rang listu ni priznanje.

### Član 9. Rokovi za promene tima i trkačkog para

Promene tima moraju biti završene do 31. decembra, da bi važile u narednoj sezoni. Trkački par nije vezan nijednim rokom: raskida ga svaka strana, bilo kada, i raskid važi odmah. Detalji su u sekciji 12.'
where page_id = (select id from static_page where slug = 'pravilnik')
  and position = 2;

update static_page_section_translation
set body = $$### Article 6. Duration of the season

The season runs from 1 January at 00:00 to 31 December at 24:00, Central European Time (CET). To count toward points, a race must start within that period.

### Article 7. Closing the season

The season closes in three steps, all times CET:

| Moment | What happens |
|---|---|
| 31 December, 24:00 | End of the season. A race that starts after this moment belongs to the next season |
| 1 January, 10:00 | The final deadline to submit any outstanding results from the previous season |
| 1 January, 16:00 | The tables are frozen, and that snapshot becomes the season's official result |

### Article 8. After freezing

The frozen snapshot of the tables is kept as the season's official result and is no longer changed.

You may still submit results from that season after freezing, so that your profile is complete, but they do not enter any table, ranking, or award.

### Article 9. Deadlines for team and racing pair changes

Team changes must be completed by 31 December to take effect in the following season. A racing pair is bound by no deadline: it may be ended by either side, at any time, and the ending takes effect immediately. Details are in section 12.$$
where language = 'en'
  and section_id = (
    select s.id from static_page_section s join static_page p on p.id = s.page_id
    where p.slug = 'pravilnik' and s.position = 2
  );
