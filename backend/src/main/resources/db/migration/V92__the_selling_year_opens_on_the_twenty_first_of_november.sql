/* THE SELLING YEAR OPENS ON 21 NOVEMBER, EVERY YEAR (owner, 10.11.2026).

   HIS WORDS (PDL, "Ciklus od 21. novembra (10.11.2026)"): "Pomeri period prvog uclanjenja i starta portala zvanicno sa 11.11.
   na 21.11. Dakle prvi i najpovoljniji period traje od 21.11. do 30.11., a onda se drugi skracuje tako da pocne 1.12."
   Chosen in the same entry, with the assistant's recommendation: for good, every year; and everything that opened on 11.11.
   moves to 21.11., the end of the period without the right to be ranked being 20.11.

   WHAT CHANGES, AND IT IS THE DAYS AND THE NAMES OF THREE ROWS AND NOTHING ELSE:

     key        before                    after
     early      11.11. - 20.11.           21.11. - 30.11.      35 EUR / 4.200 RSD, ranked
     regular    21.11. - 31.12.            1.12. - 31.12.      40 EUR / 4.800 RSD, ranked
     late        1.1.  - 31.3.             1.1.  - 31.3.       50 EUR / 6.000 RSD, ranked (not touched)
     season      1.4.  - 10.11.            1.4.  - 20.11.      40 EUR / 4.800 RSD, NOT ranked

   THE PRICES DO NOT MOVE, and they are not written here (PDL, the same entry: the prices stay, only the deadlines move). Each
   key keeps the amount it already has, which is what an administrator may have typed over on the pricing screen; the shape and
   the reason are V75's. The ranking column is not written either: none of the three rows changes what it means, only when.

   WHAT THE OLD PAYMENTS KEEP. payment.price_row_id points at a row by its id, and the ids do not move: every amount already
   booked stays exactly what it was. What changes is the days the row is read on, which no payment carries.

   THE LABEL IS OVERWRITTEN UNCONDITIONALLY, for the reason V49 and V75 give: the label NAMES the period, the period has moved,
   and a label left standing would print the old days beside the new ones in the same row. The labels are public text (the
   price table of the rulebook and of the members' page is drawn from them), and their words go to the owner with the rest of
   this change before the merge (PDL P32).

   THE TILING IS KEPT. PriceListRowsTest requires the four periods to tile the year with no gap and no overlap, the first
   beginning 01-01 and the last ending 12-31: 01-01..03-31, 04-01..11-20, 11-21..11-30, 12-01..12-31.

   THE ONE EXCEPTION IS NOT HERE. In 2026 the portal goes on selling from 15 October at the price of the period that opens the
   cycle (owner, 10.11.2026: "Ove godine ostaje otvoreno kako je sada"), so 2027 costs 35 EUR with the right to be ranked until
   30.11.2026 and 40 EUR from 1.12.2026. That is behaviour and it lives in SeasonClock (FIRST_SALE and WINDOW_OPENS), not in a
   row: the table says what the cycle IS.

   WHY A NEW FILE: ADL A2. V75 has been applied, its checksum is in flyway_schema_history. 92 because main stood at V91 on
   10.11.2026 (47bb2d28); an open pull request (707) also names a V92, and whichever of the two is merged second renumbers.

   WHAT HOLDS THIS TOGETHER. PriceListRowsTest (tiling and the rows), TheSellingYearAndTheTransferWindowOpenOnOneDayTest (the
   table against the clock), ThePriceListHasOneHomeTest (the table against frontend/src/data/pricing.ts and the mock), and
   TheCycleOf21NovemberCarriedOverTest for the rows that were already there, with payments pointing at them. */

update price_row set day_from = '11-21', day_to = '11-30',
    label = '21. do 30. novembra' where key = 'early';

update price_row set day_from = '12-01', day_to = '12-31',
    label = '1. do 31. decembra' where key = 'regular';

update price_row set day_from = '04-01', day_to = '11-20',
    label = '1. aprila do 20. novembra' where key = 'season';
