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
 * ORDER. The owner asked for the president's own word first, "najmanja, i vlasnik je bas nju
 * pomenuo" - one section, 821 characters, no drawing, no table, and no dependency on anything
 * another branch was touching. The rulebook (pravilnik) landed second in this same file, for
 * the same reason: nineteen sections and no pending question either. politika-privatnosti and
 * uslovi-koriscenja land last and in one further commit, because branch b143 (PR 410, merged
 * to main as 5f464318, "The card leaves the public pages") rewrote running text of both under
 * its own V41 while this file was already open. Translating either page before that merge
 * would have translated sentences V41 was about to delete, or handed V41's reviewer two
 * Serbian originals to reconcile with one English page; both are translated below against the
 * text V41 actually left behind, read out of frontend/src/test/mock/pages.json after this
 * branch merged origin/main forward to 5f464318 - not out of this repository's own stale copy
 * of V24, which V26 and V41 have each since rewritten one section of.
 *
 * WHAT V41 CHANGED, AND WHY IT MATTERS TO A TRANSLATOR RATHER THAN JUST TO THE MIGRATION THAT
 * MADE THE CHANGE. Card payment left the portal (owner, 26.09.2026: "Nece biti moguce placanje
 * karticama do daljnjeg"), and V41 removed every sentence naming it from both pages: the
 * "ili karticom" option and the whole paragraph about card data in uslovi-koriscenja position
 * 4, the "Podatke o platnoj kartici..." sentence in politika-privatnosti position 2, and a
 * third home in politika-privatnosti position 5 that V41's own header records was found only
 * in review, by searching the root "karti" rather than "kartic" (the word was "kartično", with
 * č). The English translations below were checked the same way, over the same root, and carry
 * none of the three - V41's own StaticPageSectionTextCarriedOverTest enforces zero mentions of
 * a card anywhere in either page's SERBIAN sections against the real migrated database, and an
 * English page that reintroduced one of the three sentences would put Serbian and English at
 * odds on the same fact, which is exactly the shape "dva doma jedne cinjenice" names as a
 * defect rather than a translation choice. V41 also moved the shared sign-off
 * ("Sportsko udruzenje BTL" / "Poslednja izmena:") on all three legal pages to 28.09.2026 -
 * pravilnik's English sign-off below was written before that commit existed and is corrected
 * to match in this same commit, alongside the two new translations.
 *
 * THE DISCLAIMER OF WHICH LANGUAGE BINDS. PDL.md, "Odredbu o merodavnosti nose SAMO engleske
 * strane" (27.09.2026, owner) settles that the Serbian original is never touched and that the
 * ENGLISH side of "politike privatnosti, uslova koriscenja i pravilnika" (PDL.md, named
 * literally, today at :3213) is what states the Serbian version binds. Pravilnik already
 * carried exactly that sentence as its own Article 4 and needed nothing added. Neither
 * politika-privatnosti nor uslovi-koriscenja carries any such sentence in Serbian, so one is
 * ADDED to each English translation below, in its last section, worded to match Article 4:
 * "This [privacy policy / these terms of use] is published in the Serbian language, in the
 * Latin script. A translation into English, or into any third language, is for information
 * only, and in the event of a discrepancy the Serbian version is authoritative." Confirmed by
 * the owner as the wording to use. rec-predsednika is not one of the three named pages and does
 * not get this sentence - DERIVED from the same two lines, not a separate confirmation from the
 * owner: PDL.md, "Kod pravnih tekstova mora biti izricito navedeno koja je jezicka verzija
 * merodavna, i to je srpska", and the very next line, which names the three by word rather than
 * by count, "Engleska verzija politike privatnosti, uslova koriscenja i pravilnika" (today at
 * :3212-:3213). A page named nowhere in that second line is not one of the three, and
 * rec-predsednika is named in neither.
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

/* THE RULEBOOK, PAGE 4 OF 4 - see this file's own header for the decisions governing all of it.
 * Nineteen sections, seventy-eight articles, translated whole in this one commit so the "whole
 * or nothing" rule in PageApi.pagesIn never has a chance to serve seventeen articles in English
 * and one in Serbian.
 *
 * ARTICLE 4 OF THE RULEBOOK ALREADY IS THE DISCLAIMER PDL.md's "Odredbu o merodavnosti nose SAMO
 * engleske strane" (27.09.2026, owner) asks the English side to carry: "Prevod na engleski ... je
 * informativan, a u slucaju razlike merodavna je srpska verzija" is translated below with the
 * rest of Article 4, word for word, adding nothing beside it.
 *
 * RACE, PLACE AND PERSON NAMES ARE NOT TRANSLATED (PDL P18: "Nazivi trka i mesta ostaju u
 * originalu, bez prevoda, na svim jezicima", task rule 5). "Round 'n' Around" is already English
 * in the Serbian original and is carried over unchanged; "BTL dezorijentiring" and "BTL sreda"
 * are the league's own proper names for competitions it runs itself and are left exactly as
 * branded, the same treatment "Round 'n' Around" already gets; the illustrative relay example in
 * Article 20 keeps "Beogradski maraton" as the untranslated race name it is and translates only
 * the descriptive words around it.
 *
 * NUMBERS AND DATES WRITTEN AS WORDS ARE TRANSLATED, LITERAL VALUES ARE NOT, and the line
 * between them is whether there is a WORD to translate at all. "17. avgusta 2026. godine" has a
 * month spelled out, so it becomes "17 August 2026"; the closing "15.09.2026." carries no word at
 * all and is carried over byte for byte. `42.2`, `21.1`, `000001`, `hh:mm:ss` and `0/0` are
 * literal values a person types or reads off the screen and are never touched. The one genuine
 * judgement call is the comma decimal separator in RUNNING PROSE ("21,1 km", "42,2 km" - not in
 * backticks): rendered with a period ("21.1 km", "42.2 km") to match how this SAME document
 * already writes the identical figures as data (`42.2`, `21.1`), and because a comma left in
 * English prose reads as a thousands separator rather than a decimal point. The value is
 * unchanged either way; only the separator a reader's own language expects has changed.
 */

insert into static_page_translation (page_id, language, title) values
    ((select id from static_page where slug = 'pravilnik'), 'en',
     $$General Rulebook of the Balkanska trkačka liga for the 2027 season$$);

insert into static_page_section_translation (section_id, language, heading, body) values
    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'pravilnik' and s.position = 1),
     'en', $$1. Introductory provisions$$,
     $$This Rulebook governs the competition of the Balkanska trkačka liga in the 2027 season: what counts toward points, how points are calculated, how the categories are divided, how results are submitted and verified, how the rankings are compiled, what can be won, and what is not allowed.

### Article 1. Who adopts the Rulebook

The league's general Rulebook is adopted by the General Assembly of the BTL sports association. The Rulebook is adopted for each season and published before that season begins.

### Article 2. Who it applies to

The Rulebook is binding on every member of the league in the 2027 season. By joining, you confirm that you have read it and that you accept it in full.

### Article 3. Relationship to other documents

Membership in, and the operation of, the Association are governed by the Statute of the BTL sports association. In the event of any inconsistency between the Statute and other acts of the Association, the Statute prevails.

Alongside the Rulebook, the portal's terms of use and privacy policy also apply.

- The Rulebook governs the competition exclusively.
- The terms of use govern the relationship between you and the association: your account, the membership fee, and your obligations when using the portal.
- If the Rulebook and the terms of use differ on anything concerning the competition, the Rulebook prevails.

### Article 4. Authoritative version

The Rulebook is published in the Serbian language, in the Latin script. A translation into English, or into any third language, is for information only, and in the event of a discrepancy the Serbian version is authoritative.

### Article 5. Duration and entry into force

The Rulebook applies to the 2027 season, which runs from 1 January to 31 December 2027.

The Rulebook was adopted on 17 August 2026 and enters into force on 15 September 2026.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'pravilnik' and s.position = 2),
     'en', $$2. Season and deadlines$$,
     $$### Article 6. Duration of the season

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

All team and racing pair changes must be completed by 31 December to take effect in the following season. Details are in section 12.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'pravilnik' and s.position = 3),
     'en', $$3. Who competes$$,
     $$### Article 10. Member of the league

A member of the league is a competitor who has been admitted to membership of the Association and whose competitor status has been activated for the season. Status is activated once the membership fee payment has been recorded, or by a decision of the Managing Board exempting the member from paying the fee. Upon activation you receive a member number in the form `000001`, six digits, unique, in the same format for both sexes. The number stays the same through every season and is displayed publicly next to your name.

While competitor status is not active, the account exists, but the competitor is not visible on the portal and cannot submit results.

### Article 11. Right to be ranked

The right to be ranked in the 2027 season belongs to a member whose competitor status is activated for that season, by a payment made by 31 December 2026 at the latest, or by a decision of the Managing Board exempting the member from the fee, adopted by that same day. The deadline is measured by the day of payment, not by the day the league recorded it.

Anyone who joins during the season, that is from 1 January 2027 onward, receives a profile, submits their own results, and tracks their own statistics, but does not compete for placings and does not appear in the rankings or in the category for that season.

### Article 12. Age

There is no minimum age for membership.

For a member younger than 14, the prior consent of a parent or guardian is required. For members younger than 16, the account on the portal is maintained by a parent or guardian. Anyone who is 14 or 15 accepts membership themselves, while their account is still maintained by a parent or guardian.

Both thresholds are measured on the day the application is submitted, not throughout the season.

### Article 13. Liability and fitness to compete

As a rule, the Balkanska trkačka liga does not organize races: it does not lay out courses, does not time them, and does not accept entries, but keeps rankings based on results measured by the organizers. The exception is the league's own competitions from section 13, chiefly the Round 'n' Around ultramarathon and the BTL dezorijentiring, which the league organizes itself.

For everything at the race, including the course and its safety, the organizer of that event is responsible. You are responsible for your own health and for judging whether you are fit for a given race, which you confirm with a statement of fitness to compete at registration.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'pravilnik' and s.position = 4),
     'en', $$4. Membership fee$$,
     $$### Article 14. Price and deadlines

The amount of the membership fee and the payment deadlines are set by the Managing Board through a separate decision.

[[gallery]]

The membership fee is paid for the whole season, and the price depends on the date of payment.

A payment processing fee of 3 EUR is charged on payment in euros. This is not part of the membership fee but the cost of processing the payment with the payment intermediary, and it confers none of the rights under Article 17. Payment in dinars carries no such fee.

The price list repeats every year: from 1 October the following season is sold, and from 1 January to 30 September the current one is, without the right to be ranked.

The junior price is measured across the whole season, not on a single day. Anyone who is 14 years old or younger on at least one day of the season they are registering for pays the junior price. Someone who turns 15 during that season still pays the junior price.

Payments are accepted from 1 October 2026.

### Article 15. Dinar price and exemption from the membership fee

The dinar price is fixed for the whole season and does not change with the exchange rate. A member with an address in Serbia pays the dinar amount; a member from abroad pays the amount in euros, together with the payment processing fee from Article 14, as a separate line item rather than as a higher membership fee.

The Managing Board may, by decision, exempt a regular member from paying the membership fee. A member exempted from the fee has the same rights as any other: activated competitor status, a member number, and the right to be ranked under the conditions of Article 11. Whether someone has competitor status in a given season is measured by the activated status on the portal. Article 11 states by when payment must be made to acquire the right to be ranked.

### Article 16. Refunds

A paid membership fee is not refunded, whether on cancellation, on termination of membership, or on disqualification.

### Article 17. What membership brings

- The season's T-shirt and finisher's medal, which are sent together by post as soon as you collect 12 BTL points in the season,
- The right to all functions of the portal,
- The right to take part in the league's accompanying competitions and gatherings,
- The right to be ranked under the conditions of Article 11,
- The virtual balance from the referral programme, which is never paid out in cash.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'pravilnik' and s.position = 5),
     'en', $$5. What counts toward points$$,
     $$### Article 18. Races that count toward points

Points are awarded for:

- Road races,
- Trail races,
- Track races,
- Obstacle races,
- Stair races,
- Hiking and trekking outings where the time is officially measured.

Points are awarded for races anywhere in the world, with no restriction to a region.

### Article 19. What does not count toward points

- The running segment of a triathlon or duathlon.
- Training runs. Training is not entered on the portal, neither publicly nor unofficially.
- Periodic and league training races.
- Hiking outings with no official timing.

### Article 20. Relays

Relays count toward the total. Points are awarded for the segment you yourself ran, and the record carries the race's name and a relay marker, for example „Beogradski maraton, relay leg 1", with the length, gradient, and time of your own stretch.

### Article 21. Virtual races

A virtual race counts toward points if the league verifies it, under the same conditions as any other race.

### Article 22. Multiple races at the same event

One event has one or more races. You may have more than one result from the same event, but not two results from the same race.

### Article 23. Unfinished race

There is no record of a withdrawal. If a race is not finished, there is no result, and this is not recorded anywhere, neither on your profile nor in the tables. The same applies to a no-show.

If during the race you switched to a different race of the same event, we recognize the result only if you appear in that race's official results and / or the organizer confirms it.

### Article 24. Conditions at the race

Weather conditions, temperature, terrain, and similar factors are not tracked and do not affect points.

### Article 25. Official event

An event is official if it meets all three conditions:

1. The announcement was published in good time, at the latest one month before the day it is held.
2. Official results were published after the event.
3. At least 50 participants took part in the event.

The league retains the discretion to recognize an event that does not meet one of these three conditions.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'pravilnik' and s.position = 6),
     'en', $$6. How points are calculated$$,
     $$### Article 26. Scoring

Points for one race are calculated by the portal from four figures: the length of the race, the total ascent, the total descent, and the finishing time.

A longer and harder course carries more points, a faster time carries more points, and ascent is weighted more heavily than descent in the calculation, since it is also harder. The calculator on the front page computes points for any combination of length, ascent, descent, and time.

### Article 27. Display and rounding

Points are displayed to two decimal places. Only the display is rounded; the calculation uses the full value.

### Article 28. Time

- The net time is used in the calculation, when a race publishes both gross and net time.
- Time is entered in the form `hh:mm:ss`, without tenths of a second.

### Article 29. Ascent and descent

The source of the ascent and descent figures, in order of precedence:

1. What the organizer publishes,
2. Verification from publicly available sources.

Until a figure exists, ascent and descent stand at zero. A race with no gradient data is scored, with the values `0/0`. Where the declared length disagrees with what a watch measured, the organizer's figure takes precedence.

### Article 30. Scoring limits

- There is no upper limit on points for a single race.
- There are no negative points.
- Points are a calculated value. They are never awarded or corrected by hand.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'pravilnik' and s.position = 7),
     'en', $$7. Categories by race length$$,
     $$### Article 31. Five categories

Every race is placed into one of five categories by length:

| Category | Length |
|---|---|
| Shorter races | under 21.1 km |
| Half marathon | 21.1 km |
| Longer races | over 21.1 km, under 42.2 km |
| Marathon | 42.2 km |
| Ultramarathon | over 42.2 km |

These same five categories are also the basis for the awards by number of races in section 14.

### Article 32. No tolerance

Classification follows the exact length entered, with no tolerance whatsoever. A marathon is a race entered as `42.2`, a half marathon is a race entered as `21.1`. Any other value falls into one of the remaining three categories.

That is why entering `42.2` and `21.1` is the mandatory convention for those two distances.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'pravilnik' and s.position = 8),
     'en', $$8. Competitor categories$$,
     $$### Article 33. Division by sex

Competition takes place in the men's and women's fields, and that is the only division by sex. There is no combined list of both sexes.

### Article 34. Age categories

| Marker | Age |
|---|---|
| `24-` | up to 24 years |
| `25-39` | 25 to 39 years |
| `40-54` | 40 to 54 years |
| `55+` | 55 years and over |

### Article 35. Moving to an older category

The category is determined by the age you turn in that calendar year, and it applies from 1 January of that year. Moving up on your birthday no longer exists; this is a change from earlier rulebooks.

The category does not change during the season. All points earned in the season go toward the category assigned at the start of the year.

The date of birth is not verified against a document. You enter it yourself, and you are solely responsible for its accuracy.

### Article 36. Rookie category

Anyone who is new to the league competes in the rookie category, called `Rookies` for men and `Rookies` for women. The name describes time spent in the league, not ability.

- You leave the rookie category when one official season, starting from the 2027 season, ends with 12 or more BTL points, and the change takes effect from the following season. The category does not change mid-season, any more than the age category does.
- Leaving is permanent and irreversible.
- A rookie does not compete in the age category. They have their own rankings and their own awards.
- There is no competing in two categories at once. In a given season a member is either in the rookie category or in their age category.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'pravilnik' and s.position = 9),
     'en', $$9. Submitting results$$,
     $$### Article 37. Who submits and what

You submit the result yourself, through the form on your profile. You enter:

- The race's name and the date of the race,
- The type of race and the location,
- The length of the race,
- The total ascent and total descent,
- The finishing time,
- A link to the official results,
- A picture, optional: a watch screenshot, a certificate, or something else,
- A comment, optional, for anything that needs to be said about the result.

If you upload a picture, the link to the official results becomes optional, but the Comment field becomes mandatory.

A result from a race that is in the calendar can also be submitted from the event's own page, with the „Submit result" button on that race's row. The race is then already known, so the portal takes from it whatever that race specifies, and you enter the rest, along with the link to the official results and, if you wish, a picture and a comment, under the same requirement rules as from the profile.

On the form from your profile, the portal helps you find the same race: once you start typing the race's name, after two letters it offers races from the calendar, from the most recent backward. If you pick one, the portal fills in and locks whatever that race specifies. If you then change the name, the link is broken, those fields are cleared, and you enter them yourself.

The administration may also obtain the official results itself and enter them for competitors.

### Article 38. Deadline

A result is submitted within two days of the day of the race.

A later submission is still entered and scored, but breaching this deadline is a breach of the Rulebook and may lead to the measures in section 16.

### Article 39. Evidence

- A link to the official results is the evidence we ask for, and it is sufficient on its own. It is mandatory on both kinds of submission, from the profile and from the event's page.
- A picture is a second kind of evidence and may stand in for the link, but never alone: a comment is mandatory alongside it, stating what is seen in the picture. A picture with no words proves nothing.
- We delete every submitted picture from the portal immediately after verification, whether you submitted it yourself or at our request.

### Article 40. A race not in the calendar

If the race is not in the portal's calendar, submit it anyway. The administration will create both the event and the race along with your result.

### Article 41. Length and gradient

You enter the length, ascent, and descent by hand, except when the portal takes them from the race itself, which happens when that race specifies them: when submitting from the event's page, and when you pick the race from the offered list on your profile (Article 37). The portal does not accept a course file in GPX, FIT, or TCX form and does not derive these values from one.

If your own measurement differs from what the organizer published, the organizer's figure takes precedence (Article 29).

### Article 42. Publication

A verified result is published and enters the tables within 48 hours of submission.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'pravilnik' and s.position = 10),
     'en', $$10. Verification of results$$,
     $$### Article 43. A result counts only after approval

No result enters the rankings until the league approves it. An unverified result is not shown publicly anywhere.

### Article 44. Corrections

The administration may correct the factual data of a result during verification: the event's name, the race's name, the type of race, and the time. A competitor who believes a correction is a mistake contacts the league.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'pravilnik' and s.position = 11),
     'en', $$11. Rankings and placing$$,
     $$### Article 45. Which lists exist

There is a men's list and a women's list. There is no combined list of both sexes.

For each field, the following are kept:

- The season's overall placing,
- A table by age category, including the rookie category.

The top lists, the team standings, and the racing pair standings are combined and are not split by sex.

### Article 46. How the overall placing is calculated

The overall placing is calculated from all races in the season, not from the best selected number of results. Every scored race enters the total.

### Article 47. Refreshing

The tables are refreshed immediately after every verified result. There is no periodic calculation.

### Article 48. Top lists

The following Top lists are kept, each for ten places:

- Most kilometres,
- Longest time on course,
- Best race, that is, the single result with the most points,
- Best progress,
- Best team,
- Best racing pair,
- Most ultramarathons, marathons, longer races, half marathons, and shorter races.

Best progress measures the increase in points relative to the previous season: the difference between the sum of this season's points and the sum of the previous season's points. The list includes only someone who also ran in the previous season, since a first season has nothing to grow from, and only someone whose increase is positive, since a decline is not progress.

The lists may be shorter than ten places.

### Article 49. Ties

There is one principle: greater volume is rewarded, never efficiency. A smaller number of races is never rewarded in any ranking. Efficiency never outweighs volume, but it may break a complete tie.

The order of criteria, until the tie is broken:

| List | Criteria, in order |
|---|---|
| Overall placing | points, then kilometres, then more races, then more vertical gain, then lower member number |
| Most kilometres | kilometres, then points, then more races, then vertical gain, then reached it earlier, then lower member number |
| Longest time on course | time, then points, then kilometres, then more races, then vertical gain, then lower member number |
| Best race | points on that race, then greater race length, then points in the season, then kilometres in the season, then lower member number |
| Best team | points, then more races, then kilometres, then time on course, then the league's fixed order of teams |
| Best racing pair | points from shared races, then more shared races, then shared kilometres, then shared time on course, then lower sum of member numbers |
| By number of races by type | number of races, then points from exactly those races, then kilometres from those races, then vertical gain from those races, then reached it earlier, then lower member number |

For the best race, an earlier date is deliberately not used as a criterion, since in the most common case of a tie it is the same race on the same day.

### Article 50. There is no shared placing

When there is still no difference after all the criteria:

1. Places go 1, 2, 3 and none is skipped. There is no shared placing.
2. The last criterion is the member number, ascending: the lower one goes first. For teams that is a fixed order the league keeps, since a team has no member number; it means nothing and exists only so that the table does not jump with every recalculation.
3. An award is never duplicated. One place, one competitor, one trophy.

### Article 51. Archive

The official result of every season is kept permanently, on the page with the archive of seasons. An overview across the league's whole history is on the hall of fame.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'pravilnik' and s.position = 12),
     'en', $$12. Teams, racing pairs, and clubs$$,
     $$### Article 52. A team and a club are not the same

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

A change of team or racing pair may be requested at any time during the year, but it takes effect only on 1 January of the following season, and only if membership is active for that season.

There is one exception, and it is a costly one. A member may leave a team immediately, without waiting for a new season, but then:

- all of their results are removed from the team's tally for that season, and
- for the next three years they may not join any team.

The portal tells them both options before they confirm, and specifically asks for confirmation of this one.

All changes must be completed by 31 December. A member affected by a change is notified as soon as the change occurs, not at the start of the season.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'pravilnik' and s.position = 13),
     'en', $$13. Accompanying competitions and leagues$$,
     $$### Article 57. League as a concept

Alongside the main competition there are also Leagues, separate competitions with their own list of events that enter them during the year. The list of events may change during the year.

- Every League is scored with the same BTL points. There is no separate scoring system.
- All members are in a League automatically, with no registration.
- Every League has its own page and table.

What is won in a given League is determined by its organizer, and that is not the subject of this Rulebook.

### Article 58. BTL Round 'n' Around

An ultramarathon in the form of a free-form race: total distance and total time are tracked. There is no special display for multiple half marathons or marathons.

The race can last a few minutes or several days, and the number of BTL points collected on it is not limited in any way. It gives everyone a great chance to draw out their real maximum, and the winner may not be the one who covers the most distance or is the fastest.

Details will be published in the announcement of the event itself in the BTL calendar.

### Article 59. BTL dezorijentiring

The goal is not to arrive first; the goal is to collect as many BTL points as possible within one hour. Details will be published in the announcement of the event itself in the BTL calendar.

### Article 60. BTL sreda

Regular training gatherings of the league's members. They are not scored and do not enter any table.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'pravilnik' and s.position = 14),
     'en', $$14. Awards and honours$$,
     $$### Article 61. What can be won

| Award | Who it belongs to |
|---|---|
| Trophy | the winner of the team placing; the best racing pair; the top three places in the overall placing, men's and women's; the top three places in every category, including the rookie category. Trophies in a category are not awarded if that category has fewer than three members with 12 or more BTL points that season |
| Participant medal | every member with 12 or more BTL points in the season. Sent by post, together with the season's T-shirt, as soon as the threshold is crossed |
| Award figurine | the special honours from Article 62, except for the best team and racing pair of the year, who receive a trophy |
| Online certificate | every member once the tables are frozen, with the season's statistics |

An honour nobody raced for is not an honour.

### Article 62. Special honours

- Most kilometres,
- Longest time on course,
- Best race,
- Best progress,
- Racing pair of the year,
- Best team,
- Most ultramarathons, marathons, longer races, half marathons, and shorter races.

### Article 63. Presentation

Digital awards and certificates are given out automatically, at the moment the tables are frozen, to everyone at the same time and regardless of where each person lives.

Trophies are presented at a ceremony joined with the BTL dezorijentiring.

### Article 64. Collecting physical awards

Trophies are collected in person, by prior arrangement with the Association, within one month of the notice about collection. Only the season's T-shirt and the finisher's medal are sent by post, and together, as soon as a member collects 12 BTL points. Postal costs are borne by the member.

The deadline exists so that collection is not dragged out indefinitely, not so that someone is left without an award. You can always arrange an in-person handover, even later.

### Article 65. Sponsor awards

Sponsor awards will be updated ahead of and during the season, as they are secured.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'pravilnik' and s.position = 15),
     'en', $$15. Code of ethics$$,
     $$### Article 66. Basic rule

Every member is expected to show fair play and respect for all participants, regardless of sex, ethnic origin, race, religion, or sexual orientation. This applies at the race, at the league's gatherings, on the portal, and in messages between members.

### Article 67. What is not allowed

- Submitting a result you did not run, or with inaccurate data,
- Submitting a race that does not meet the conditions of Article 25,
- Any deliberate circumvention of the scoring or verification rules,
- Insulting, threatening, or harassing other members,
- Opening fabricated accounts, including ones opened for the referral programme,
- Posting content you have no right to.

### Article 68. What is expected of a member

To submit results properly and on time, to enter the race data the way the organizer published it, and to report a mistake in their own result themselves as soon as they notice it.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'pravilnik' and s.position = 16),
     'en', $$16. Sanctions and disqualification$$,
     $$### Article 69. Measures

For a breach of the Rulebook, a member may be given:

1. a warning;
2. disqualification from the current season;
3. expulsion from the Association for the most serious or repeated breaches, in cases permitted by the Statute.

The measure is chosen by the Managing Board in proportion to the severity of the breach, its consequences, repetition, and intent.

### Article 70. What disqualification means

- All of the competitor's results and profile are deleted. Results are not hidden from the tables; they disappear.
- Wherever the name was mentioned, an anonymized record remains. There is no „archived competitor" marker, because no such state exists.
- The membership fee is not refunded.

### Article 71. Procedure

1. The Managing Board informs the member in writing of the allegations and gives them the opportunity to respond.
2. The deadline to respond, or to remedy the shortcoming where applicable, is at most 30 days.
3. The first-instance decision is made by the Managing Board. The decision is in writing, reasoned, and delivered to the member.
4. The member may appeal the decision to the General Assembly within 15 days of delivery. The General Assembly decides on the appeal.

### Article 72. Minor breaches

Submitting a result after the deadline in Article 38 is a breach of the Rulebook and may on its own trigger the procedure from Article 71. The result is nonetheless still entered and scored.

The first-instance decision on the disciplinary measure is made by the Managing Board. The member may appeal the decision to the General Assembly within 15 days of delivery.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'pravilnik' and s.position = 17),
     'en', $$17. Publishing data and photographs$$,
     $$### Article 73. What is public

The league is a public competition, so the following are public:

- First and last name, member number, and category,
- Place and country,
- Profile picture,
- Every verified result with its length, ascent, descent, time, and date,
- Points, placing, statistics, ducats, and honours,
- Team, racing pair, and club.

### Article 74. What is never public

The date of birth is never shown, either in full or in shortened form. Only the category that follows from it is public. The same applies to the e-mail address, the address, everything related to the membership fee, and private messages.

### Article 75. Photographs

You give your consent to the publication of photographs from the league's gatherings and competitions in advance, by accepting this Rulebook. Photographs taken by the league's staff are published, as are photographs you send and approve yourself.

There are no photo galleries from races and no tagging of people in photographs on the portal.

### Article 76. Everything else

Everything else about your data is governed by the portal's [privacy policy](/politika-privatnosti), which, alongside this Rulebook and the [terms of use](/uslovi-koriscenja), is the third mandatory document.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'pravilnik' and s.position = 18),
     'en', $$18. Ducats$$,
     $$A ducat is a record of what you have run, in the form of a coin.

It carries no points and does not move you in the table. It is awarded automatically, the moment what you have run crosses the threshold written on it. Some are won every month, others once a season, and others only once.

A won ducat stays forever. It is not taken away when a weaker year comes, nor when the conditions later change, nor when you stop competing, and it stands on your profile as a record of what was run.

Not all of them carry the same weight, and that shows on them: from bronze ones, which many win already in their first season, through silver, to gold ones, which are gathered over years.

[[gallery]]$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'pravilnik' and s.position = 19),
     'en', $$19. Amendments to the Rulebook and final provisions$$,
     $$### Article 77. A new version every season

The Rulebook is written anew for every season and published before that season begins. The version that applied in a given season remains published, since that season's official result was reached under it.

It is not changed during the season, except for article 65, which publishes the specification of sponsorship as it is secured.

### Article 78. Interpretation

The Rulebook is interpreted and applied by the association. A case not covered by the Rulebook is resolved in the spirit of its principles, and the resolution is written into the next version of the Rulebook, so that the same question is not resolved differently twice.

---

BTL sports association
Last amended: 28.09.2026.$$);

/* PRIVACY POLICY, PAGE 3 OF 4. Translated against the text V41 left behind (see this file's own
 * header): section 2's table lost its card-data sentence, section 5's table lost its own
 * separate one, and section 7 gets both the new sign-off date and the new authoritative-version
 * sentence PDL.md requires for this named page (the row naming "politike privatnosti, uslova
 * korišćenja i pravilnika" by name). */

insert into static_page_translation (page_id, language, title) values
    ((select id from static_page where slug = 'politika-privatnosti'), 'en', $$Privacy policy$$);

insert into static_page_section_translation (section_id, language, heading, body) values
    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'politika-privatnosti' and s.position = 1),
     'en', $$1. Who we are and which regulations apply$$,
     $$Your data is handled by the BTL sports association, which runs the Balkanska trkačka liga and the [balkanskatrkackaliga.net](https://balkanskatrkackaliga.net) portal.

| | |
|---|---|
| Registered seat | Beograd |
| Registered address | Bulevar Arsenija Čarnojevića 77, 11070 Novi Beograd |
| Registration number | 28815158 |
| Tax ID (PIB) | 109089912 |
| All privacy questions | [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net) |
| Data Protection Officer | Nikola Minić |

We process your data in accordance with the Personal Data Protection Act of the Republic of Serbia and, where applicable, the EU General Data Protection Regulation (GDPR).$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'politika-privatnosti' and s.position = 2),
     'en', $$2. What data we process, why, and on what basis$$,
     $$### Data you enter when you join

| Data | Why | Legal basis | How long we keep it |
|---|---|---|---|
| First and last name | Identification, profile, tables | Performance of contract | Section 5 |
| Date of birth | Age category and applying the rules for minor members | Performance of contract | Section 5 |
| Sex | Men's and women's rankings | Performance of contract | Section 5 |
| Choice of category, rookie or age based | Placement into the rankings | Performance of contract | Section 5 |
| Place and country | Profile, map of countries visited, payment method, and citizenship in the membership records | Performance of contract and legal obligation | Section 5 |
| E-mail address | Sign-in and mandatory notifications | Performance of contract | Section 5 |
| Password | Account protection, kept only as a cryptographic hash | Performance of contract | For as long as the account exists |
| Profile picture | Display on the public profile | Performance of contract | Section 5 |
| T-shirt size | Making and delivering the T-shirt | Performance of contract | Until delivery |
| Address | Sending the T-shirt and medal, and residential and mailing address in the membership records | Performance of contract and legal obligation | Section 5 |
| Father's name | Membership records the association keeps by law | Legal obligation | Section 5 |
| ID document number | Membership records the association keeps by law. It is requested from a member younger than 16 but is not mandatory, since an ID card is issued at 16. Only the administration sees it; it is not displayed anywhere and stands apart from the data the portal's screens read, in its own table with its own access rights | Legal obligation | Section 5 |
| Phone, optional | To reach you quickly about a payment, an award, or an unclear result | Your consent | Section 5 |
| Statement that you are familiar with the Rulebook and fit to compete | A condition of membership, confirmed in your application | Performance of contract | Section 5 |
| For minors: the parent's or guardian's first and last name, relationship, and the date, time, and IP address the consent was given from | A parent's consent for a member younger than 14 and for maintaining the account of a member younger than 16, and proof that it was given | Performance of contract | Section 5 |

### Data generated while you are a member

| Data | Why | Legal basis | How long we keep it |
|---|---|---|---|
| Race results and everything calculated from them: points, placing, ducats, honours | The substance of the service | Performance of contract | Section 5 |
| A photo of a watch or a screen as evidence | Checking a disputed result | Performance of contract | Deleted immediately after verification |
| Biography, text about yourself, links to Strava and Instagram | Self-presentation, voluntary | Your consent | Section 5 |
| Ratings and comments on events | A guide for other members | Performance of contract | Section 5 |
| Team, racing pair, club | Team and pair standings | Performance of contract | Section 5 |
| Private messages between members | Arranging transport and accommodation | Performance of contract | Section 5 |
| Birthday, if you choose to publish it yourself | Birthday list | Your consent, off by default | Until you turn it off |
| Internal administration notes | Records of disputed cases | Legitimate interest | Section 5 |

### Membership fee

| Data | Why | Legal basis | How long we keep it |
|---|---|---|---|
| Amount, date, method, and status of payment | Activating membership | Performance of contract | Section 5 |
| Virtual balance and the ledger of its changes | The referral programme and paying future membership fees | Performance of contract | Section 5 |
| Proof of payment | Bookkeeping | Legal obligation | Section 5 |

### Data generated simply by visiting

| Data | Why | Legal basis | How long we keep it |
|---|---|---|---|
| Choice of light or dark theme (`btl-theme`, local storage) | So the portal opens in the theme you chose | Necessary for the service provided, since you choose it yourself | Until you delete it yourself |
| Security cookie, and a session cookie once sign-in is working | Without them, submitting a form and signing in cannot work safely | Necessary for the service provided | Until the end of the visit, or until sign-out |
| Server logs | Security and detecting abuse | Legitimate interest | 30 days |$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'politika-privatnosti' and s.position = 3),
     'en', $$3. What is public, and what never is$$,
     $$The league is a public competition and your profile is a public page. That is the substance of the service we provide you, and you agree to it by joining.

### Publicly displayed

First and last name, member number, age and sex category, place and country, profile picture, every verified result with its dates and measurements, points and placing, ducats and honours, team, racing pair, and club, biography, ratings and comments on events, and links you add yourself.

### Never displayed

Date of birth, e-mail address, mailing address, everything related to the membership fee and payment, virtual balance, T-shirt size, father's name, ID document number, phone, private messages, internal administration notes, and everything related to the parental signature: the parent's name, relationship, date, time, and IP address.

We ask for the date of birth only so that we know the age category, and we do not display it in full or in shortened form; only the category that follows from it is public. In settings you can hide your profile from visitors who are not signed in, but not from other members, since that would remove the point of ranking together. When your membership fee expires, your profile is no longer displayed, and your name remains in the historical tables of the seasons in which you were a member.

### Photographs

There is no gallery of race photos and no tagging of people in photographs. Your only photograph is your profile picture, which an administrator approves before publication. You give your consent to pictures the BTL staff take at the association's gatherings by accepting the Rulebook. If you request removal, we act proportionately: we remove a picture in which you are the subject, and from a group picture we remove whatever identifies you.

### Minor members

There is no minimum age for membership. For a member younger than 14, the prior consent of a parent or guardian is required. For members younger than 16, the account on the portal is maintained by a parent or guardian, with an electronic signature on the registration form, without which registration cannot be completed. Along with the signature we keep the parent's first and last name, the relationship (mother, father, or guardian), and the date, time, and IP address it was given from, since that is what makes the signature provable. The parent maintains the account until the child turns 16, and after that the member maintains the account themselves. We apply the 16-year threshold equally in every country.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'politika-privatnosti' and s.position = 4),
     'en', $$4. Cookies and local storage$$,
     $$The portal sets exactly one cookie, and it is a security cookie. It serves only to ensure that a form you submit was really sent from this site, and not planted from somewhere else. It does not track your behaviour, does not build a visitor profile, does not say who you are, and is not shared with anyone. No consent is asked for it, because it is necessary: without it, submitting a form cannot work safely.

Once sign-in is working, a session cookie will stand alongside it, without which sign-in cannot work. The same applies to it too: it does not track your behaviour, does not build a visitor profile, and is not shared with anyone.

Besides the cookie, something else is kept in your browser: the choice of light or dark theme, under the name `btl-theme`, in local storage. Legally that is the same as a cookie, so it is listed here even though it is not called one. It is set only once you choose a theme yourself, stays in your browser, and never reaches us: it is not sent with any request, so our server never sees it. Only the page itself reads it, in your browser, to know which theme to render in. No consent is asked for it, because it is a display setting you requested yourself. You delete it by clearing the site's data in your browser, and the portal will then open you in the dark theme, which is the default.

There is no other storage. There is no analytics, ours or anyone else's, so there is no consent banner either: consent is asked for whatever is not necessary, and there is nothing of the kind here. If we ever introduce that, this page will say so before it is introduced.

There are no advertising networks, social media pixels, or advertising cookies on the portal. We do not sell your data and do not hand it over to advertisers.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'politika-privatnosti' and s.position = 5),
     'en', $$5. How long we keep it and who we pass it to$$,
     $$| Situation | What happens |
|---|---|
| While you are a member | We keep it for as long as membership lasts |
| You stop being a member | Five years from the last season, then the profile is permanently deleted |
| ID document number and father's name | Five years from the last season, same as the rest of the profile. Membership records are kept under the Law on Sport and do not stop existing on the same day as membership |
| The account is never activated | 12 months from opening the account, if it has not been activated in the meantime |
| Bookkeeping documentation on payments | At least five years from the last day of the business year the document relates to, or longer if another applicable regulation requires it |
| Internal administration notes | 5 years from the last season of membership, unless they cease to be needed earlier |
| Archive of outgoing e-mails | 2 years from sending, except for messages that form part of documentation subject to a longer statutory period |

### Two ways in which data disappears

On a request for deletion, we remove data we no longer have a legal basis or obligation to keep. Data we are required to keep, or that we need to protect legal claims, we keep until the relevant period expires. Deleting a profile on the portal and the Association's mandatory records are two different things.

Beyond that, the two paths deliberately differ. Once the five years expire, if you have not requested anything, only your first and last name remain in the historical tables, as plain text with no link: a season's official result is a record of competition that the league has a legitimate interest in keeping whole. If you request deletion yourself, or you have been disqualified, both the profile and the results are deleted, the name and member number disappear, and wherever you were mentioned an anonymized record remains. The number itself remains spent and is not given to anyone else.

### Who we pass it to

We do not sell your data and do not give it to third parties for their own purposes. We share it only with those without whom the portal cannot work, and to the smallest extent possible.

| Who | What they receive | Where |
|---|---|---|
| Hetzner Online GmbH | Portal hosting | Germany |
| Cloudflare | Traffic and IP addresses, protection, and the domain | USA and EU |
| PayPal (Europe) S.à r.l. et Cie, S.C.A. | Name, e-mail address, and amount, for members from abroad | Luxembourg |
| Brevo (Sendinblue SAS) | Your address and the content of the message | France |
| The Association's business bank | Data from the payment order | Serbia |

With each of them we have a formal relationship under which they may use the data only for the work they do for us. We provide data to a state authority only upon a request based on law, which we verify beforehand.

The server is in Germany, that is, in the European Union. For transfers outside the European Union we use the prescribed safeguard mechanisms.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'politika-privatnosti' and s.position = 6),
     'en', $$6. Your rights$$,
     $$You have the right to: access to your data and a copy of it; rectification and completion; erasure; restriction of processing; portability; objection to processing based on legitimate interest; and withdrawal of consent.

You exercise all your rights by writing to [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net). No form, no justification, and free of charge. The deadline is without undue delay, and at the latest 30 days from receiving the request; if the request is complex, we notify you of an extension and the reason within those 30 days. Before we send anything, we verify that it is really you, because data sent to the wrong person is worse than data that is late.

Some of it you can do yourself: you change and delete profile fields in settings, and you turn notifications on and off there. Consent for cookies is not withdrawn because it is not given: the portal sets only one security cookie, without which submitting a form cannot work safely, and the only other thing it keeps in your browser is the choice of theme, which you requested yourself; consent is not asked for either one (section 4). There is no button that fetches all your data in one click; we prepare a copy by hand, in CSV or JSON form, if you request it.

### If you are not satisfied

Write to us first, since most things are resolved in a single message.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'politika-privatnosti' and s.position = 7),
     'en', $$7. Security, automation, and amendments$$,
     $$All traffic goes over an encrypted connection, passwords are kept only as a cryptographic hash, a small number of people with precisely defined rights have access to the data, and the account with the broadest rights uses two-factor sign-in. No system is completely secure; if a data breach occurs that could harm you, we notify you and the supervisory authority within the prescribed deadlines.

The portal automatically calculates points, placing, and ducats, which is arithmetic under publicly known rules. No decision with legal consequences for you is made automatically: verifying results, approving profiles, and every measure against members is decided by a person.

We change the policy when what we do changes. If a change materially affects your rights, we notify you by e-mail before it takes effect.

This privacy policy is published in the Serbian language, in the Latin script. A translation into English, or into any third language, is for information only, and in the event of a discrepancy the Serbian version is authoritative.

---

BTL sports association
Last amended: 28.09.2026.$$);

/* TERMS OF USE, PAGE 4 OF 4. Translated against the text V41 left behind: section 4's payment
 * methods table lost "ili karticom" from both rows and the whole paragraph naming the card, and
 * section 12 gets both the new sign-off date and the new authoritative-version sentence PDL.md
 * :3213 requires for this named page. */

insert into static_page_translation (page_id, language, title) values
    ((select id from static_page where slug = 'uslovi-koriscenja'), 'en', $$Terms of use$$);

insert into static_page_section_translation (section_id, language, heading, body) values
    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'uslovi-koriscenja' and s.position = 1),
     'en', $$1. Who we are and what these terms govern$$,
     $$The [balkanskatrkackaliga.net](https://balkanskatrkackaliga.net) portal is run by the BTL sports association, registered with the Serbian Business Registers Agency, registration number 28815158, Tax ID (PIB) 109089912, registered seat Beograd, registered address Bulevar Arsenija Čarnojevića 77, 11070 Novi Beograd. Write to us at [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).

These terms govern the use of the portal and membership in the league. By using the portal you accept them; if you do not agree, do not use the portal.

Membership in, and the operation of, the Association are governed by the [Statute of the BTL sports association](/BTL%20Statut.pdf). In the event of any inconsistency between the Statute and other acts of the Association, the Statute prevails.

Alongside them, two more documents apply: the [league's general Rulebook](/pravilnik), which governs only the competition and is adopted for each season, and the privacy policy, which governs what we do with your data. If these terms and the Rulebook differ on anything concerning the competition, the Rulebook prevails.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'uslovi-koriscenja' and s.position = 2),
     'en', $$2. Who can be a member$$,
     $$Registration on the portal constitutes an application for membership. Admission to membership takes place in accordance with the Statute and the acts of the Managing Board. Membership takes effect once the membership fee payment has been recorded, if a fee has been set for that person.

We require no result and no prior experience, races anywhere in the world count toward points, and membership is open to competitors from every country.

Competitor status for a season is something different from membership. While competitor status is not active, the account exists, but results are not entered, are not ranked, and do not enter the tables, and the profile is not displayed. The membership fee is therefore not paid for access to the site but for membership in the league.

There is no minimum age. For a member younger than 14, the prior consent of a parent or guardian is required. For members younger than 16, the account on the portal is maintained by a parent or guardian. Anyone who is 14 or 15 accepts membership themselves, while their account is still maintained by a parent or guardian.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'uslovi-koriscenja' and s.position = 3),
     'en', $$3. Membership fee$$,
     $$The amount of the membership fee and the payment deadlines are set by the Managing Board through a separate decision. The current price list is published in the [league's general Rulebook](/pravilnik), alongside the article on the membership fee.

The membership fee is paid for a season, which runs from 1 January to 31 December. The price list repeats every year: from 1 October the following season is sold, and from 1 January to 30 September the current one is, without the right to be ranked. We accept payments from 1 October. The dinar price is fixed for the whole season and does not change with the exchange rate.

Anyone who joins during the season receives a profile and submits their own results, but does not compete for placings and does not appear in that season's rankings.

There are no discounted prices, but the Managing Board may, by decision, exempt a regular member from paying the membership fee, with the same rights; for the right to be ranked in a given season, that decision must be made by 31 December of the previous year.

The membership fee is not refunded. Membership is a leisure-time service with a predetermined period of provision: the season for which the fee was paid, from 1 January to 31 December of that calendar year. You may cancel at any time, but a paid membership fee is not refunded.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'uslovi-koriscenja' and s.position = 4),
     'en', $$4. Registration, payment, and activation$$,
     $$An application for membership is submitted primarily through the portal.

1. Fill in the form. Every field that has a rule carries an explanation of that rule.
2. Confirm your e-mail address. Without confirmation the account is not activated.
3. The account is open, but competitor status is not active yet. Until it is, you are not visible on the portal and cannot do anything. You see only what every visitor sees: the calendar, the rankings, and other competitors' profiles.
4. Pay the membership fee.
5. We record the payment and activate your competitor status. You see the status within two days, and that is when you receive your member number. A member exempted from the fee by the Managing Board goes through without step 4; they receive their member number and all rights at the same moment as any other member.

A proper application submitted through the portal is accepted automatically, in accordance with the acts of the Association.

The member number has the form `000001`, is six digits, unique for both sexes, stays the same through every season, and is displayed publicly next to your name. If you take a break, your number remains reserved. A number is never assigned twice, so it remains spent even when you request that your data be deleted.

### Payment methods

| Where you are from | How you pay |
|---|---|
| Serbia | By payment slip, for which the portal generates a QR code |
| Every other country | By PayPal |

PayPal is not shown to members from Serbia, and that is not a matter of choice but of regulation.

The portal does not issue an invoice or proof of payment. The evidence is your bank's or payment system's confirmation, together with the notice we send when we activate your membership fee.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'uslovi-koriscenja' and s.position = 5),
     'en', $$5. Submitting and verifying results$$,
     $$Results are the heart of the league, and this is the only part of these terms where we seriously rely on your honesty. You submit a result in two ways: through the form on your profile, where you enter the race's name, date, type of race, location, length, ascent, descent, time, and a link to the official results; or with the button in the race's row on the event's own page, where the portal takes from that race whatever it specifies. The link is mandatory unless you attach a picture; then a comment alongside it is mandatory.

1. You submit only races you ran yourself.
2. The deadline for submission is two days from the day of the race. We still enter a later submission, but breaching this rule is grounds for the measure in section 7.
3. A link to the official results is mandatory unless you attach a picture. A picture, certificate, or watch screenshot is accepted as evidence only together with a comment stating why the link to the official results is missing, what is seen in the picture, and we delete it immediately after checking.
4. Only a race with an officially measured time counts toward points.
5. The net time is entered, in the form `hh:mm:ss`, without tenths of a second.
6. For a marathon and a half marathon, the length is entered exactly as `42.2` and `21.1`, with no tolerance; any other value places the race in another category by length.
7. If the race is not in the calendar, submit it anyway; the administrator will create both the event and the race along with your result.
8. The same result is submitted once. From one event you may have more than one result if you ran more than one race, but not two from the same race.
9. If you did not finish the race, there is no result. We do not record a withdrawal or a no-show.
10. If you switched to a shorter race, we recognize the result only if you are in that shorter race's official results.

### Verification of results

No result enters the rankings until we approve it. An unverified result is not shown publicly anywhere. The administration may correct the factual data of a result during verification: the event's name, the race's name, the type of race, and the time. It never touches the points, since they are a calculated value. A competitor who believes a correction is a mistake contacts the league.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'uslovi-koriscenja' and s.position = 6),
     'en', $$6. Referral programme$$,
     $$Every member has a personal referral link. Anyone who joins through it, and whose membership fee is activated the next time, brings you the amount that applies on that day, shown to you on your "My fee" page, next to the link itself. The amount lands on your balance at the moment of activation, not at the moment of application, and we notify you of this by message.

The balance pays for future membership fees, in whole or in part. It is never paid out in cash and is not transferred to another member: it is tied to the account it was earned on. Every change is visible to you on your account, with the date and the reason.

The programme may not be used to register fabricated accounts or accounts belonging to someone else. Such accounts are deleted, and the balance earned is voided.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'uslovi-koriscenja' and s.position = 7),
     'en', $$7. Rules of conduct and measures$$,
     $$We expect every member to show fair play and respect for all participants, regardless of sex, ethnic origin, race, religion, or sexual orientation. This is the league's code of ethics and is part of the Rulebook.

Not allowed: submitting a result you did not run, or with inaccurate data; insulting, threatening, and harassing other members; posting content you have no right to; opening fabricated accounts; and attempting to circumvent the scoring or verification rules.

Comments are published only after approval.

### Measures for breaching the rules

The measures for breaching the rules and the procedure in which they are imposed are governed by the [league's general Rulebook](/pravilnik). In short: measures range from a warning, through disqualification from the current season, to expulsion from the Association for the most serious or repeated breaches. The measure is chosen in proportion to the severity of the breach, its consequences, repetition, and intent.

The first-instance decision on the measure is made by the Managing Board, by a written and reasoned decision, after giving you the opportunity to respond. You may appeal the decision to the General Assembly within 15 days of delivery.

The membership fee is not refunded.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'uslovi-koriscenja' and s.position = 8),
     'en', $$8. Awards$$,
     $$Awards and honours are governed by the Rulebook for the current season, on the [league rulebook](/pravilnik) page. Three rules are worth knowing in advance:

1. Digital awards and certificates are given out automatically when the tables are frozen, to everyone at the same moment, regardless of where you live.
2. The deadline for collecting physical awards is one month, by prior arrangement with the Association. We do not send trophies by post; the season's T-shirt and the finisher's medal are sent, and together, as soon as a member collects 12 BTL points. Postal costs are borne by the member. The deadline exists so that collection is not dragged out indefinitely, not so that someone is left without an award: you can always arrange an in-person handover.
3. With a button on your profile you can authorize another member to collect your award for you.

Trophies are presented at a ceremony joined with the BTL dezorijentiring.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'uslovi-koriscenja' and s.position = 9),
     'en', $$9. Content you post$$,
     $$You post a profile picture, a biography, text about yourself, and ratings and comments on events to the portal. That content remains yours, and we claim no rights to it.

By posting it you give us a non-exclusive right to display it on the portal and use it to represent the portal and the league, for example in the image for sharing your profile. That right ends when you remove the content, except where it has already been embedded in a historical record of competition. By posting it you also confirm that you have the right to post it.

We approve the profile picture and biography before publication, and we may remove content that breaches these rules, with notice to you.

Content created by BTL, including texts, the logo, the portal's design, and the way points are calculated, remains ours and is not used without our permission.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'uslovi-koriscenja' and s.position = 10),
     'en', $$10. What the portal is and what it is not$$,
     $$This is the most important section of these terms, so it stands on its own.

### BTL is not the organizer of other people's races

As a rule, the league does not organize races: it does not lay out courses, does not time them, and does not accept entries, but keeps a ranking of recreational runners under its own formula, based on results measured by the organizers. The exception is competitions the league organizes itself, today the Round n Around ultramarathon and the BTL dezorijentiring; for these the league is the organizer, with everything that comes with it.

For all other races, the following applies:

- The calendar is informational. We collect dates from the organizer and verify them, but the only authoritative source is always the organizer.
- Registration for a race is done exclusively with the organizer, through the link listed with the race. The portal does not accept registrations and does not act as an intermediary.
- The organizer is responsible for everything at the race: course safety, timing, the start package, cancellation, and refunding the entry fee.
- When you express an intention on the portal to go to a race, that is not a registration either to us or to the organizer, but information for other members for arranging transport.
- Except where this is precisely stated on the portal, BTL does not organize transport. You and the person you arrange it with are responsible for the arrangement and for the trip.

### You run at your own risk

Running and hiking carry risk. You are responsible for your own health and for judging whether you are ready for a given race, and you confirm this at registration.

### The portal is regularly maintained

We strive for the portal to run without interruption and for the data to be accurate, but we cannot guarantee this. We are not liable for damage arising from using the portal, from relying on race data, from the portal's unavailability, or from the actions of other members. This does not apply to damage we cause intentionally or through gross negligence, nor to cases in which liability cannot be excluded by law.

### For race organizers

If you see inaccurate information alongside your race, or you do not want your race to be in our calendar, write to [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net). We carry out the request as soon as possible, without argument and without asking for a justification. Alongside every race we display only facts, and nowhere do we claim to be the organizer, a partner, or a place of registration.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'uslovi-koriscenja' and s.position = 11),
     'en', $$11. Technical partners$$,
     $$The portal is the technical property of the Green Time Consulting agency from Beograd.

The list of places and countries the portal offers during entry is taken from the [GeoNames](https://www.geonames.org/) database, used under the [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) licence.$$),

    ((select s.id from static_page_section s join static_page p on p.id = s.page_id
        where p.slug = 'uslovi-koriscenja' and s.position = 12),
     'en', $$12. Cancellation, deletion, changes, and disputes$$,
     $$| What you want | What happens |
|---|---|
| Cancel for the current season | You stop entering results for that year, you remain in the historical tables, the membership fee is not refunded |
| Not renewing competitor status for the next season | The profile is no longer displayed, the name remains in the historical tables, we keep the data for five years |
| Deleting your data | We remove your first name, last name, and member number from everywhere, together with the results; wherever you were mentioned, an anonymized record remains |

Measures against a member are imposed under the procedure in section 7. While competitor status for a season is not activated, the member does not appear in that season's rankings and their profile is not displayed. Once they activate it, it is displayed again. When competitor status is not active, the profile is not displayed; this is deliberate, since access to your own racing data is one of the things membership brings. Ducats and honours remain recorded forever and come back with you when you renew.

We may change these terms, and we notify you by e-mail of every material change before it takes effect; if you do not agree with the change, you may terminate your membership.

The law of the Republic of Serbia applies. If you live in another country, this does not deprive you of the protection given to you by the mandatory regulations of your country of residence.

If you have a complaint, write to us first at [info@balkanskatrkackaliga.net](mailto:info@balkanskatrkackaliga.net).

These terms of use are published in the Serbian language, in the Latin script. A translation into English, or into any third language, is for information only, and in the event of a discrepancy the Serbian version is authoritative.

---

BTL sports association
Last amended: 28.09.2026.$$);
