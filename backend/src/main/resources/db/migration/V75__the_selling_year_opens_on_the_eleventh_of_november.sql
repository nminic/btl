/* THE SELLING YEAR OPENS ON 11 NOVEMBER AND THE PRICE LIST HAS A NEW SHAPE (owner, 27.10.2026).

   HIS WORDS (PDL, "Novi godišnji ciklus od 11. novembra (27.10.2026)"): "Prijave ce pocinjati 11. novembra svake godine i
   trajati 10 dana po ceni od 35 eur (4200). Onda ce od 21.11. do 31.12. vaziti period od 40 eur (4800), a zatim od 1.1.
   do 31.3. 50 eur (6000 din). Nakon toga ce biti 40 eur (4800) od 1.4. do 10.11 - period kad kao i sad mogu da se
   prijave ljudi bez rangiranja. Svi ostali periodi ce biti za rangiranje (nakon 11.11. za narednu sezonu, a do 31.3. za
   tekucu sezonu)."

   WHAT CHANGES, AND IT IS THE DAYS AND THE NAMES OF FOUR ROWS AND NOTHING ELSE:

     key        before                    after
     early      15.10. - 31.10.           11.11. - 20.11.      35 EUR / 4.200 RSD, ranked
     regular     1.11. - 30.11.           21.11. - 31.12.      40 EUR / 4.800 RSD, ranked
     late        1.12. - 31.12.            1.1.  - 31.3.       50 EUR / 6.000 RSD, ranked
     season      1.1.  - 14.10.            1.4.  - 10.11.      40 EUR / 4.800 RSD, NOT ranked

   THE PRICES DO NOT MOVE, and they are not written here. Each key keeps the amount it already has: that is what an
   administrator may have typed over on the pricing screen (PUT /api/pricing/{key} writes label, eur and rsd), and a
   migration that wrote the amounts again would discard his edit. The ranking column is written, because it is the
   other half of what a period means and it is not editable from the portal: the three periods that sell a season are
   ranked, and the running season from 1 April is not.

   WHAT THE OLD PAYMENTS KEEP. payment.price_row_id points at a row by its id, and the ids do not move: the row "early"
   still means 35 EUR, so every amount already booked stays exactly what it was. What changes is the days the row is
   read on, which no payment carries.

   THE LABEL IS OVERWRITTEN UNCONDITIONALLY, for the reason V49 gives and which holds unchanged: the label NAMES the
   period, the period has moved, and a label left standing would print the old days beside the new ones in the same row.

   THE TILING IS KEPT. PriceListRowsTest requires the four periods to tile the year with no gap and no overlap, the
   first beginning 01-01 and the last ending 12-31: 01-01..03-31, 04-01..11-10, 11-11..11-20, 11-21..12-31.

   THE ONE EXCEPTION IS NOT HERE. In 2026 the portal sells from 15 October as it does now (owner, 27.10.2026: "hocu da
   ove godine ljudi i dalje mogu da se prijavljuju i pre 11.11. po uslovima koji ce vaziti 11.11."). That is behaviour
   and it lives in SeasonClock (FIRST_SALE), not in a row: the table says what the cycle IS, and the first year is read
   as if it were 11 November.

   WHY A NEW FILE: ADL A2. V4, V34 and V49 have been applied, their checksums are in flyway_schema_history.

   WHAT HOLDS THIS TOGETHER. PriceListRowsTest (tiling), TheSellingYearAndTheTransferWindowOpenOnOneDayTest (the table
   against the clock), ThePriceListHasOneHomeTest (the table against frontend/src/data/pricing.ts and the mock), and
   ThePriceListCarriedOverTest for the rows that were already there, with payments pointing at them. */

update price_row set day_from = '11-11', day_to = '11-20', ranking = true,
    label = '11. do 20. novembra' where key = 'early';

update price_row set day_from = '11-21', day_to = '12-31', ranking = true,
    label = '21. novembra do 31. decembra' where key = 'regular';

update price_row set day_from = '01-01', day_to = '03-31', ranking = true,
    label = '1. januara do 31. marta' where key = 'late';

update price_row set day_from = '04-01', day_to = '11-10', ranking = false,
    label = '1. aprila do 10. novembra' where key = 'season';
