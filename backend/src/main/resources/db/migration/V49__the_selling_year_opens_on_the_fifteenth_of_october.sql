/* THE SELLING YEAR OPENS ON 15 OCTOBER AND NO LONGER ON THE FIRST (owner, 29.09.2026).

   HIS WORDS: "Zelim da prvi period postane 15-31. oktobar, drugi 1-30. novembar a ostalo
   ostaje isto. S tim na umu zelim i da se prelazni rok i sve ostalo otvara 15.10. ubuduce, a
   ne 1.10."

   Four questions were put to him before any of this was written, and his answers are what
   this migration carries out:

     - whether the early price is meant to run seventeen days instead of five: "Jeste, OK je";
     - what happens from the 1st to the 14th of October: "Ovo bi bilo pokriveno od 1. januara
       do 14. oktobra", so the row for the running season is EXTENDED rather than a fifth row
       being added;
     - whether it holds for season 2027 already: "Da, za sezonu 2027, dakle odmah";
     - whether only the OPENING of the transfer window moves: "Tacno", so it still shuts at
       the end of 31 December and is fourteen days shorter rather than shifted.

   THE PRICES DO NOT MOVE. Only the days do, and only three rows have any.

   WHY THE ROW FOR THE RUNNING SEASON HAS TO BE EXTENDED, and it is not tidiness:
   PriceListRowsTest requires the four periods to TILE THE YEAR with no gap and no overlap,
   the first beginning 01-01 and the last ending 12-31. Left at 09-30 while the early period
   moves to 10-15, the list would have a fortnight in which the portal has no price at all,
   and the gate would fail rather than the portal quietly stopping selling.

   WHY THIS IS A NEW FILE AND V4 IS NOT EDITED: ADL A2. V4 has been applied, its checksum is
   in flyway_schema_history, and a database that has run it refuses to start against a changed
   copy. The same holds for the labels, which V34 wrote, and for the page text, which V24 wrote
   and V43 and V46 have since rewritten.

   THE LABEL IS OVERWRITTEN UNCONDITIONALLY, AND THAT IS A DECISION RATHER THAN A DETAIL.
   price_row.label is the one thing on this list an administrator can change while the portal
   runs (PUT /api/pricing/{key} writes label, eur and rsd - not the days), so a real database
   may carry his wording rather than the seeded text. It is overwritten anyway: the label NAMES
   the period, the period has moved, and a label left standing would print "1. do 5. oktobra"
   in the same table row whose neighbouring cell draws "15.10. - 31.10." out of the data. There
   is no way to keep somebody's wording for a period that no longer exists without keeping a
   false sentence on the screen a member reads. The wording is a few seconds to set again on
   the pricing screen; the false sentence would stand until somebody noticed it.

   THE PAGE TEXT IS REPLACED PHRASE BY PHRASE AND NOT RETYPED. V46 retyped whole section
   bodies, and it was right to: it changed what an article MEANT. Here five sentences in three
   sections gain fourteen days and nothing else about them changes, so a replace() is the
   smaller and the provable move - it cannot mistype a paragraph it does not touch. What a
   replace() CAN do is silently match nothing, and that is covered from the other side:
   TheWrittenPagesOpenOnTheFifteenthTest asserts over the migrated rows that no section of any
   page in EITHER language still names the old day, and that the new one is there - so a
   replacement that did not fire fails, and so does a further home appearing tomorrow.

   All five Serbian sentences contain "od 1. oktobra" and all five English ones contain
   "from 1 October", which is why one replacement each reaches them all. Measured, not assumed:
   two sections of the rulebook and one of the terms of use, in both languages.

   WHAT THIS DOES NOT TOUCH: no schema change of any kind, no column, no constraint, no key and
   no index. No amount. The late period, which the owner left alone. The junior, processing and
   referral rows, which have no days. And every other section of every other page. */

update price_row set day_from = '10-15', day_to = '10-31', label = '15. do 31. oktobra'
where key = 'early';

update price_row set day_from = '11-01', day_to = '11-30', label = '1. do 30. novembra'
where key = 'regular';

/* The running season, extended by a fortnight so that the four periods still tile the year. */
update price_row set day_to = '10-14', label = '1. januara do 14. oktobra'
where key = 'season';

/* The price list sentence, the two that name when payment is taken, and the transfer window in
   Article 56 - five sentences, three sections, both languages. */
update static_page_section
set body = replace(replace(body,
        'od 1. oktobra', 'od 15. oktobra'),
        'do 30. septembra tekuća', 'do 14. oktobra tekuća')
where body like '%od 1. oktobra%';

update static_page_section_translation
set body = replace(replace(body,
        'from 1 October', 'from 15 October'),
        'to 30 September the current one is', 'to 14 October the current one is')
where body like '%from 1 October%';
